<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';

// ── Keamanan dasar ───────────────────────────────────────────────────────────
/** IP klien. Sengaja TIDAK percaya X-Forwarded-For (mudah dipalsukan tanpa proxy). */
function client_ip(): string {
    return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
}

/** Header keamanan standar untuk semua halaman. */
function send_security_headers(): void {
    if (headers_sent()) return;
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: SAMEORIGIN');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    if (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') {
        header('Strict-Transport-Security: max-age=31536000');
    }
}

/**
 * Guard CSRF terpusat: semua POST harus berasal dari situs ini sendiri.
 * Cek header Origin (fallback Referer) vs Host. Tanpa keduanya → loloskan
 * (klien non-browser); lapisan SameSite cookie + token tetap berlaku.
 */
function verify_post_origin(): void {
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') return;
    $host = strtolower(preg_replace('/:\d+$/', '', $_SERVER['HTTP_HOST'] ?? ''));
    if ($host === '') return;
    foreach (['HTTP_ORIGIN', 'HTTP_REFERER'] as $k) {
        $v = $_SERVER[$k] ?? '';
        if ($v === '' || $v === 'null') continue;
        $oHost = strtolower((string)(parse_url($v, PHP_URL_HOST) ?? ''));
        if ($oHost === $host) return;
        http_response_code(403);
        exit('Permintaan ditolak: asal form tidak dikenali (lintas situs).');
    }
}

/** Token CSRF per-sesi (untuk form sensitif: login, akun, setelan, backup, dll). */
function csrf_token(): string {
    if (empty($_SESSION['csrf_token'])) $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    return $_SESSION['csrf_token'];
}
function csrf_field(): string {
    return '<input type="hidden" name="csrf" value="' . h(csrf_token()) . '">';
}
/** Wajib dipanggil di awal halaman yang memproses POST sensitif (no-op untuk GET). */
function require_csrf(): void {
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') return;
    $tok = $_POST['csrf'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    if (!is_string($tok) || $tok === '' || !hash_equals($_SESSION['csrf_token'] ?? '', $tok)) {
        http_response_code(419);
        exit('Sesi form kedaluwarsa atau tidak valid. Muat ulang halaman lalu coba lagi.');
    }
}

/** Sisa detik blokir login untuk IP/email ini (0 = boleh coba). 8 gagal / 15 menit. */
function login_throttled(string $email): int {
    ensure_security_tables();
    try {
        $st = db()->prepare(
            'SELECT COUNT(*) AS n, UNIX_TIMESTAMP(MAX(created_at)) AS last FROM login_attempts
             WHERE ok = 0 AND created_at > (NOW() - INTERVAL 15 MINUTE) AND (ip = ? OR email = ?)'
        );
        $st->execute([client_ip(), mb_substr($email, 0, 190)]);
        $r = $st->fetch();
        if ($r && (int)$r['n'] >= 8) return max(60, 900 - (time() - (int)$r['last']));
    } catch (Throwable $e) { /* tanpa DB throttle, login tetap jalan */ }
    return 0;
}
function record_login_attempt(string $email, bool $ok): void {
    ensure_security_tables();
    try {
        db()->prepare('INSERT INTO login_attempts (ip, email, ok) VALUES (?,?,?)')
            ->execute([client_ip(), mb_substr($email, 0, 190), $ok ? 1 : 0]);
        if ($ok) db()->prepare('DELETE FROM login_attempts WHERE ip = ? AND ok = 0')->execute([client_ip()]);
        if (random_int(1, 20) === 1) db()->exec('DELETE FROM login_attempts WHERE created_at < (NOW() - INTERVAL 7 DAY)');
    } catch (Throwable $e) {}
}

send_security_headers();
verify_post_origin();

// ── HTTP helper (umum) ───────────────────────────────────────────────────────
/** Request JSON. Return ['status'=>int, 'data'=>mixed]. */
function http_json(string $method, string $url, ?array $body = null, ?string $bearer = null): array {
    $headers = "Accept: application/json\r\n";
    if ($body !== null)  $headers .= "Content-Type: application/json\r\n";
    if ($bearer)         $headers .= "Authorization: Bearer $bearer\r\n";
    $opts = ['method' => $method, 'header' => $headers, 'timeout' => 10, 'ignore_errors' => true];
    if ($body !== null) $opts['content'] = json_encode($body);
    $ctx = stream_context_create(['http' => $opts]);
    $res = @file_get_contents($url, false, $ctx);
    $status = 0;
    foreach (($http_response_header ?? []) as $hd) {
        if (preg_match('#^HTTP/\S+\s+(\d+)#', $hd, $m)) { $status = (int)$m[1]; break; }
    }
    return ['status' => $status, 'data' => $res === false ? null : json_decode($res, true)];
}

// ── Klien PosPro (server homelab) ────────────────────────────────────────────
/** Base URL PosPro: dari setelan dashboard, fallback ke konstanta. */
function pospro_base(): string {
    try { $u = cfg('pospro_api'); } catch (Throwable $e) { $u = null; }
    return rtrim($u ?: API_BASE, '/');
}

/** True kalau kredensial service PosPro sudah diisi di setelan. */
function pospro_configured(): bool {
    try { return !empty(cfg('pospro_email')) && cfg('pospro_password') !== null && cfg('pospro_password') !== ''; }
    catch (Throwable $e) { return false; }
}

/** Login ke PosPro pakai service account tersimpan; cache JWT di session. */
function pospro_token(): ?string {
    if (!empty($_SESSION['pospro_token'])) return $_SESSION['pospro_token'];
    if (!pospro_configured()) return null;
    $r = http_json('POST', pospro_base() . '/auth/login', [
        'email'    => cfg('pospro_email'),
        'password' => secret_get('pospro_password'),
    ]);
    if (($r['status'] ?? 0) === 200 && !empty($r['data']['access_token'])) {
        return $_SESSION['pospro_token'] = $r['data']['access_token'];
    }
    return null;
}

/** GET terotentikasi ke PosPro (auto refresh token sekali kalau 401). */
function pospro_get(string $path) {
    $t = pospro_token();
    if (!$t) return null;
    $r = http_json('GET', pospro_base() . $path, null, $t);
    if (($r['status'] ?? 0) === 401) {
        unset($_SESSION['pospro_token']);
        $t = pospro_token();
        if ($t) $r = http_json('GET', pospro_base() . $path, null, $t);
    }
    return $r['data'] ?? null;
}

// ── API publik PosPro (storefront — produk/profil toko) ──────────────────────
function api_get(string $path) {
    $r = http_json('GET', pospro_base() . $path);
    return $r['data'];
}
function api_post(string $path, array $data) {
    $r = http_json('POST', pospro_base() . $path, $data);
    return $r['data'];
}

/** Warna brand efektif: setting DB 'brand_color' (di-set lewat preset Tampilan) > BRAND_COLOR (env/konstanta). */
function brand_color(): string {
    try { $c = cfg('brand_color'); } catch (Throwable $e) { $c = null; }
    return ($c && preg_match('/^#[0-9a-fA-F]{6}$/', $c)) ? $c : BRAND_COLOR;
}

// ── Auth dashboard (akun sendiri di DB toko) ─────────────────────────────────
function current_user(): ?array { return $_SESSION['user'] ?? null; }
function is_admin(): bool { return !empty($_SESSION['user']); }
function require_admin(): void { if (!is_admin()) { header('Location: login.php'); exit; } }

function admin_login(string $email, string $password): bool {
    try {
        $st = db()->prepare('SELECT * FROM users WHERE email = ? LIMIT 1');
        $st->execute([$email]);
        $u = $st->fetch();
    } catch (Throwable $e) { return false; }
    if ($u && password_verify($password, $u['password_hash'])) {
        unset($u['password_hash']);
        session_regenerate_id(true);                          // anti session-fixation
        $_SESSION['user'] = $u;
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));  // token CSRF baru tiap login
        record_login_attempt($email, true);
        try { db()->prepare('UPDATE users SET last_login_at = NOW() WHERE id = ?')->execute([$u['id']]); } catch (Throwable $e) {}
        return true;
    }
    record_login_attempt($email, false);
    usleep(random_int(200000, 500000)); // perlambat brute force + samarkan timing
    return false;
}
function admin_logout(): void {
    unset($_SESSION['user'], $_SESSION['pospro_token'], $_SESSION['csrf_token']);
    session_regenerate_id(true);
}

// ── Helper umum ──────────────────────────────────────────────────────────────
function h($s): string { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }
function rupiah($n): string { return 'Rp ' . number_format((float)$n, 0, ',', '.'); }

// ── URL helper (untuk SEO: canonical, OG, sitemap) ───────────────────────────
function site_scheme(): string { return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http'; }
function base_url(): string {
    $dir = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/')), '/');
    return site_scheme() . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost') . $dir . '/';
}
function abs_url(string $path): string {
    if ($path === '') return '';
    if (preg_match('#^https?://#i', $path)) return $path;
    return base_url() . ltrim($path, '/');
}
function current_url(): string {
    return site_scheme() . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost') . ($_SERVER['REQUEST_URI'] ?? '/');
}
function meta_desc(string $s, int $len = 160): string {
    $s = trim(preg_replace('/\s+/', ' ', strip_tags($s)));
    return mb_strlen($s) > $len ? mb_substr($s, 0, $len - 1) . '…' : $s;
}
function tgl(?string $iso): string {
    if (!$iso) return '-';
    $ts = strtotime($iso);
    return $ts ? date('d/m/Y H:i', $ts) : '-';
}
function slugify(string $s): string {
    $s = strtolower(trim($s));
    $s = preg_replace('/[^a-z0-9]+/', '-', $s);
    return trim($s, '-') ?: 'artikel';
}

function img_url(?string $u): string {
    if (!$u) return '';
    if (preg_match('/^https?:/i', $u)) return $u;
    return pospro_base() . $u;
}
function product_price(array $p): float {
    $min = null;
    foreach (($p['variants'] ?? []) as $v) {
        $pr = (float)($v['price'] ?? 0);
        if ($pr > 0 && ($min === null || $pr < $min)) $min = $pr;
    }
    return $min !== null ? $min : (float)($p['price'] ?? 0);
}

/** True kalau produk dijual per luas (m²) — harga varian = harga per m². */
function product_is_area(array $p): bool {
    return ($p['pricingMode'] ?? 'UNIT') === 'AREA_BASED';
}

/**
 * Harga satuan sesuai tier qty (harga grosir). Logika sama dengan POS:
 * ambil tier dengan minQty terbesar yang qty >= minQty dan (maxQty null atau qty <= maxQty).
 * Fallback ke harga dasar kalau tidak ada tier yang cocok.
 */
function tier_price(int $qty, float $basePrice, array $tiers): float {
    if (!$tiers) return $basePrice;
    usort($tiers, fn($a, $b) => (int)($b['minQty'] ?? 0) <=> (int)($a['minQty'] ?? 0));
    foreach ($tiers as $t) {
        $min = (int)($t['minQty'] ?? 0);
        $max = $t['maxQty'] ?? null;
        if ($qty >= $min && ($max === null || $qty <= (int)$max)) return (float)($t['price'] ?? $basePrice);
    }
    return $basePrice;
}

/**
 * Subtotal satu item keranjang. Item area (ada widthCm & heightCm):
 * qty × (w × h / 10000) × unitPrice (unitPrice = harga per m²) — formula sama
 * dengan calcItemSubtotal di backend PosPro. Selain itu: qty × unitPrice.
 */
function cart_item_subtotal(array $it): float {
    $qty = (int)($it['quantity'] ?? 0);
    $price = (float)($it['unitPrice'] ?? 0);
    $w = (float)($it['widthCm'] ?? 0);
    $h = (float)($it['heightCm'] ?? 0);
    if ($w > 0 && $h > 0) return $qty * (($w * $h) / 10000) * $price;
    return $qty * $price;
}
function product_image(array $p): string {
    if (!empty($p['imageUrl'])) return img_url($p['imageUrl']);
    foreach (($p['variants'] ?? []) as $v) {
        if (!empty($v['imageUrl'])) return img_url($v['imageUrl']);
    }
    return '';
}

/** Profil toko dari PosPro (nama, logo, telepon) untuk storefront. */
function settings(): array {
    static $s = null;
    if ($s === null) $s = api_get('/settings/public') ?: [];
    return $s;
}

/** ID kategori yang disembunyikan dari toko (diatur di Setelan). */
function hidden_cats(): array {
    static $h = null;
    if ($h === null) {
        try { $raw = cfg('hidden_cats', ''); } catch (Throwable $e) { $raw = ''; }
        $h = array_values(array_filter(array_map('trim', explode(',', (string)$raw)), 'strlen'));
    }
    return $h;
}

/** Produk publik untuk storefront — buang bahan baku (RAW_MATERIAL) & kategori tersembunyi. */
function public_products(): array {
    $all = api_get('/products/public') ?: [];
    $hidden = array_flip(hidden_cats());
    return array_values(array_filter($all, function ($p) use ($hidden) {
        if (($p['productType'] ?? 'SELLABLE') === 'RAW_MATERIAL') return false;
        $cid = (string)($p['categoryId'] ?? ($p['category']['id'] ?? ''));
        return !($cid !== '' && isset($hidden[$cid]));
    }));
}

/** True kalau produk tidak boleh tampil publik (bahan baku atau kategori disembunyikan). */
function product_is_hidden(array $p): bool {
    if (($p['productType'] ?? 'SELLABLE') === 'RAW_MATERIAL') return true;
    $cid = (string)($p['categoryId'] ?? ($p['category']['id'] ?? ''));
    return $cid !== '' && in_array($cid, hidden_cats(), true);
}

// ── Backup & Restore (DB toko + uploads) ─────────────────────────────────────
/** Slug nama toko untuk penamaan file backup (fallback 'toko'). */
function store_slug(): string {
    $name = '';
    try { $name = settings()['storeName'] ?? ''; } catch (Throwable $e) {}
    return slugify($name ?: 'toko');
}

/** Dump seluruh database toko jadi string SQL (DROP+CREATE+INSERT). */
function db_dump_sql(): string {
    $pdo = db();
    $out  = "-- Backup Toko\n-- Dibuat: " . date('c') . "\n";
    $out .= "SET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS=0;\n\n";
    $tables = $pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN);
    foreach ($tables as $t) {
        $create = $pdo->query('SHOW CREATE TABLE `' . $t . '`')->fetch(PDO::FETCH_NUM);
        $out .= "DROP TABLE IF EXISTS `$t`;\n" . $create[1] . ";\n\n";
        $rows = $pdo->query('SELECT * FROM `' . $t . '`');
        foreach ($rows as $row) {
            $cols = implode(',', array_map(fn($c) => '`' . $c . '`', array_keys($row)));
            $vals = implode(',', array_map(fn($v) => $v === null ? 'NULL' : $pdo->quote($v), array_values($row)));
            $out .= "INSERT INTO `$t` ($cols) VALUES ($vals);\n";
        }
        $out .= "\n";
    }
    $out .= "SET FOREIGN_KEY_CHECKS=1;\n";
    return $out;
}

/** Pecah skrip SQL jadi statement (sadar quote & escape). */
function sql_split(string $sql): array {
    $sql = preg_replace('/^\s*--.*$/m', '', $sql); // buang baris komentar
    $stmts = []; $buf = ''; $inStr = false; $q = ''; $len = strlen($sql);
    for ($i = 0; $i < $len; $i++) {
        $ch = $sql[$i];
        $buf .= $ch;
        if ($inStr) {
            if ($ch === '\\' && $i + 1 < $len) { $buf .= $sql[++$i]; }
            elseif ($ch === $q) { $inStr = false; }
        } else {
            if ($ch === "'" || $ch === '"') { $inStr = true; $q = $ch; }
            elseif ($ch === ';') { $stmts[] = trim($buf); $buf = ''; }
        }
    }
    if (trim($buf) !== '') $stmts[] = trim($buf);
    return array_values(array_filter($stmts, fn($s) => $s !== ''));
}

/** Jalankan skrip SQL restore (destruktif — mengganti data). */
function db_restore_sql(string $sql): void {
    $pdo = db();
    $pdo->exec('SET FOREIGN_KEY_CHECKS=0');
    foreach (sql_split($sql) as $stmt) {
        $pdo->exec($stmt);
    }
    $pdo->exec('SET FOREIGN_KEY_CHECKS=1');
}

// ── Label & warna status order (Lead PosPro) ─────────────────────────────────
function lead_status_label(?string $s): string {
    return [
        'NEW' => 'Baru', 'FOLLOW_UP' => 'Follow Up', 'NEGOTIATION' => 'Negosiasi',
        'CLOSED_WON' => 'Deal', 'CLOSED_LOST' => 'Batal', 'INVALID' => 'Invalid',
    ][$s] ?? ($s ?: '-');
}
function lead_status_class(?string $s): string {
    return [
        'NEW' => 'bg-sky-100 text-sky-700', 'FOLLOW_UP' => 'bg-amber-100 text-amber-700',
        'NEGOTIATION' => 'bg-violet-100 text-violet-700', 'CLOSED_WON' => 'bg-emerald-100 text-emerald-700',
        'CLOSED_LOST' => 'bg-rose-100 text-rose-700', 'INVALID' => 'bg-slate-200 text-slate-600',
    ][$s] ?? 'bg-slate-100 text-slate-600';
}

// ── Keranjang (session) ──────────────────────────────────────────────────────
function cart(): array { return $_SESSION['cart'] ?? []; }
function cart_count(): int {
    $c = 0; foreach (cart() as $it) $c += (int)$it['quantity']; return $c;
}
function cart_total(): float {
    $t = 0; foreach (cart() as $it) $t += cart_item_subtotal($it); return $t;
}
