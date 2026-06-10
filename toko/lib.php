<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';

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
        $_SESSION['user'] = $u;
        try { db()->prepare('UPDATE users SET last_login_at = NOW() WHERE id = ?')->execute([$u['id']]); } catch (Throwable $e) {}
        return true;
    }
    return false;
}
function admin_logout(): void { unset($_SESSION['user'], $_SESSION['pospro_token']); }

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
    $t = 0; foreach (cart() as $it) $t += (float)$it['unitPrice'] * (int)$it['quantity']; return $t;
}
