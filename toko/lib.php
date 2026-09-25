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
 * Normalisasi nilai "URL embed Google Maps". Pengguna kerap menempel SELURUH
 * tag <iframe ...> alih-alih hanya URL di dalam src="..." → kalau dirender apa
 * adanya, src jadi tag iframe ter-encode dan browser memperlakukannya sebagai
 * path relatif (mis. /%3Ciframe...%3E → 404). Fungsi ini:
 *  - menarik isi src="..." bila yang ditempel tag <iframe>,
 *  - men-decode entitas HTML (&amp; → &),
 *  - hanya menerima URL embed Google Maps (selain itu dikosongkan → cegah
 *    injeksi iframe dengan src sembarang).
 * Dipakai saat menyimpan DAN saat merender, jadi data lama yang terlanjur
 * salah ikut sembuh otomatis.
 */
function maps_embed_src(?string $raw): string {
    $v = trim((string)$raw);
    if ($v === '') return '';
    if (stripos($v, '<iframe') !== false && preg_match('~src\s*=\s*["\']([^"\']+)["\']~i', $v, $m)) {
        $v = $m[1];
    }
    $v = trim(html_entity_decode($v, ENT_QUOTES, 'UTF-8'));
    if (!preg_match('~^https://(www\.)?google\.com/maps/embed\?~i', $v)) return '';
    return $v;
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
/** Request JSON. Return ['status'=>int, 'data'=>mixed]. $extra = header tambahan. */
function http_json(string $method, string $url, ?array $body = null, ?string $bearer = null, array $extra = []): array {
    $headers = "Accept: application/json\r\n";
    if ($body !== null)  $headers .= "Content-Type: application/json\r\n";
    if ($bearer)         $headers .= "Authorization: Bearer $bearer\r\n";
    foreach ($extra as $k => $v) {
        $v = preg_replace('/[\r\n]/', '', (string)$v);  // cegah header injection
        if ($v !== '') $headers .= $k . ': ' . $v . "\r\n";
    }
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

/**
 * True kalau token baca lead sudah diisi di Setelan (menu Order/Dashboard aktif).
 * Tidak ada lagi login akun+password ke PosPro: website hanya membawa token.
 */
function pospro_configured(): bool {
    try { return (string)cfg('storefront_read_token', '') !== ''; }
    catch (Throwable $e) { return false; }
}

/**
 * GET ke API baca-lead khusus toko di PosPro: /storefront{path}, diautentikasi
 * header X-Storefront-Read-Token (= env STOREFRONT_READ_TOKEN di backend).
 * Hanya lead ber-source WEBSITE, hanya-baca. Gagal/tidak diatur → null.
 * Token ini TERPISAH dari kunci kirim order (storefront_token) supaya bocornya
 * satu tidak membuka yang lain.
 */
function pospro_get(string $path) {
    try { $tok = (string)cfg('storefront_read_token', ''); } catch (Throwable $e) { $tok = ''; }
    if ($tok === '') return null;
    $r = http_json('GET', pospro_base() . '/storefront' . $path, null, null, ['X-Storefront-Read-Token' => $tok]);
    return ($r['status'] ?? 0) === 200 ? ($r['data'] ?? null) : null;
}

// ── API publik PosPro (storefront — produk/profil toko) ──────────────────────
/**
 * GET publik ke PosPro DENGAN fallback cache. Respons sukses (200) disalin ke
 * tabel api_cache; bila PosPro down/timeout/error, kembalikan salinan terakhir
 * agar storefront tetap tampil normal. Hanya null bila tak ada data & tak ada
 * cache sama sekali.
 */
/**
 * Umur maksimal cache API sebelum diperbarui (detik). PosPro ada di homelab —
 * /products/public butuh 1–1,5 dtk per panggilan; tanpa cache ini tiap kunjungan
 * halaman ikut menunggu (penyebab utama "server response" lambat di PageSpeed).
 */
const API_CACHE_TTL = 300;

function api_get(string $path, bool $force = false) {
    if (!$force) {
        $row = api_cache_row($path);
        $d = $row ? json_decode($row['v'], true) : null;
        if ($d !== null) {
            $stale = time() - $row['t'] >= API_CACHE_TTL;
            // Segar → pakai langsung. Kedaluwarsa → tetap sajikan salinan ini dulu,
            // lalu perbarui dari PosPro SETELAH respons terkirim ke pengunjung
            // (stale-while-revalidate). Tanpa dukungan finish_request → ambil langsung.
            if (!$stale || api_refresh_later($path)) {
                if (is_array($d)) mirror_opportunistic($d);
                return $d;
            }
        }
    }
    $r = http_json('GET', pospro_base() . $path);
    $result = null;
    if (($r['status'] ?? 0) === 200 && ($r['data'] ?? null) !== null) {
        $json = json_encode($r['data'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        // Selalu tulis (juga bila isi sama) supaya umur cache ter-reset.
        if ($json !== false) api_cache_write($path, $json);
        $result = $r['data'];
    } elseif (($r['status'] ?? 0) === 404) {
        // Data memang sudah tidak ada (mis. produk diarsipkan) → jangan tampilkan salinan lama.
        $result = null;
    } else {
        // PosPro tidak menjawab dengan benar (down/timeout/5xx) → pakai cache terakhir bila ada.
        $cached = api_cache_read($path);
        if ($cached !== null) {
            $d = json_decode($cached, true);
            $result = $d !== null ? $d : ($r['data'] ?? null);
        } else {
            $result = $r['data'] ?? null;
        }
    }
    // Salin gambar PosPro ke hosting secara bertahap (tahan-mati + Google Images).
    if (is_array($result)) mirror_opportunistic($result);
    return $result;
}
/**
 * Jadwalkan api_get($path, true) setelah respons selesai dikirim. Return false
 * bila server tidak bisa menutup koneksi lebih awal (tanpa LiteSpeed/FPM) →
 * pemanggil mengambil data langsung seperti biasa.
 */
function api_refresh_later(string $path): bool {
    static $queue = null;
    if (PHP_SAPI === 'cli') return false;
    if (!function_exists('litespeed_finish_request') && !function_exists('fastcgi_finish_request')) return false;
    if ($queue === null) {
        $queue = [];
        register_shutdown_function(function () use (&$queue) {
            if (session_status() === PHP_SESSION_ACTIVE) session_write_close(); // lepas lock sesi
            if (function_exists('litespeed_finish_request')) litespeed_finish_request();
            else fastcgi_finish_request();
            @set_time_limit(30);
            foreach (array_keys($queue) as $p) { try { api_get($p, true); } catch (Throwable $e) {} }
        });
    }
    $queue[$path] = true;
    return true;
}

function api_post(string $path, array $data) {
    // Teruskan IP customer asli + token toko agar PosPro bisa rate-limit per
    // customer (lihat PublicOrderThrottleGuard). Tanpa token, backend pakai IP soket.
    $extra = ['X-Client-IP' => client_ip()];
    try { $tok = (string)cfg('storefront_token', ''); } catch (Throwable $e) { $tok = ''; }
    if ($tok !== '') $extra['X-Storefront-Token'] = $tok;
    $r = http_json('POST', pospro_base() . $path, $data, null, $extra);
    return $r['data'];
}

/**
 * Throttle order per-IP (lapisan PHP, melihat IP customer asli). Return 0 bila
 * boleh; >0 = detik tunggu. Batas: 3/menit, 12/jam, 30/hari per IP.
 */
function order_throttled(): int {
    ensure_order_attempts_table();
    try {
        $st = db()->prepare(
            'SELECT
                SUM(created_at > NOW() - INTERVAL 1 MINUTE) AS m,
                SUM(created_at > NOW() - INTERVAL 1 HOUR)   AS h,
                SUM(created_at > NOW() - INTERVAL 1 DAY)    AS d
             FROM order_attempts WHERE ip = ?'
        );
        $st->execute([client_ip()]);
        $r = $st->fetch();
    } catch (Throwable $e) { return 0; } // tanpa DB, jangan blokir order sah
    if (!$r) return 0;
    if ((int)$r['m'] >= 3)  return 60;
    if ((int)$r['h'] >= 12) return 3600;
    if ((int)$r['d'] >= 30) return 86400;
    return 0;
}
function record_order_attempt(): void {
    ensure_order_attempts_table();
    try {
        db()->prepare('INSERT INTO order_attempts (ip) VALUES (?)')->execute([client_ip()]);
        if (random_int(1, 30) === 1) db()->exec('DELETE FROM order_attempts WHERE created_at < (NOW() - INTERVAL 7 DAY)');
    } catch (Throwable $e) {}
}

/**
 * Deteksi order spam (judol / promosi link) dari bot. Sinyal sangat tinggi:
 *  - kata kunci judi online di teks mana pun, ATAU
 *  - ada URL/domain di field NAMA (nama tidak pernah berisi tautan).
 * Catatan boleh berisi URL referensi yang sah → di sana hanya kata kunci ditolak.
 */
function looks_like_spam(string $name, string $note = '', string $address = ''): bool {
    static $kw = [
        'slot', 'gacor', 'maxwin', 'judi', 'togel', 'toto', 'jackpot', 'pragmatic',
        'pgsoft', 'sbobet', 'parlay', 'rungkad', 'scatter', 'zeus', 'olympus',
        'starlight', 'jp paus', 'rtp live', 'mahjong ways', 'situs slot',
        'link alternatif', 'bonus new member', 'deposit pulsa', 'anti rungkad', 'cuan88',
    ];
    $hay = mb_strtolower($name . ' ' . $note . ' ' . $address);
    foreach ($kw as $k) if (mb_strpos($hay, $k) !== false) return true;
    // URL/domain di nama
    $urlRe = '~(https?://|www\.|\b[a-z0-9-]{2,}\.(com|net|org|xyz|info|online|site|club|vip|link|live|bet|win|top|asia|cc|me|id|co|biz|store|shop|fun|icu|pro)\b)~i';
    if (preg_match($urlRe, $name)) return true;
    // Aksara non-Latin (Kiril, CJK, Arab, Thai, Devanagari, Hangul, dll) → pelanggan
    // percetakan lokal tidak menulis dengan aksara ini; tipikal bot spam asing.
    if (preg_match('/[\p{Cyrillic}\p{Han}\p{Hiragana}\p{Katakana}\p{Hangul}\p{Arabic}\p{Hebrew}\p{Thai}\p{Devanagari}\p{Greek}]/u', $name . $note . $address)) return true;
    // Spam asing berbahasa Inggris (jasa SEO/web, kripto, pinjaman, dll). Pakai batas
    // kata supaya kata Indonesia tidak ikut kena (mis. "seorang" ≠ "seo").
    $enRe = '/\b(seo|backlinks?|guest ?posts?|crypto|bitcoin|btc|usdt|forex|casino|viagra|cialis|porn|escort|loans?|'
          . 'web ?design(er)?|web ?development|app development|digital marketing|lead generation|'
          . 'google (ranking|first page)|first page of google|increase (your )?(traffic|sales)|'
          . 'business proposal|dear (sir|madam)|telegram|unsubscribe)\b/iu';
    if (preg_match($enRe, $name . ' ' . $note . ' ' . $address)) return true;
    // Banyak tautan di catatan (≥ 2) → promosi. Satu tautan referensi (GDrive) tetap boleh.
    return preg_match_all('~https?://|www\.~i', $note . ' ' . $address) >= 2;
}

/**
 * Validasi & normalisasi nomor HP/WA Indonesia. Terima 08xx, 628xx, +62 8xx
 * (boleh ada spasi/strip), panjang 10–14 digit. Return format 08xx, atau '' bila
 * tidak valid (telepon kantor 0274… juga diterima; nomor luar negeri seperti +1, +44, +91 ditolak).
 */
function normalize_id_phone(string $raw): string {
    $d = preg_replace('/\D/', '', $raw);
    if (str_starts_with($d, '62')) $d = '0' . substr($d, 2);
    return preg_match('/^(08[1-9]\d{7,11}|0[2-7]\d{7,10})$/', $d) ? $d : '';
}

/**
 * Jebakan waktu anti-bot: form menyertakan timestamp bertanda tangan HMAC.
 * Bot biasanya submit < 3 detik setelah memuat halaman (atau memalsukan field).
 */
function form_ts_field(): string {
    $t = (string)time();
    return '<input type="hidden" name="fts" value="' . $t . '.' . hash_hmac('sha256', $t, APP_KEY) . '">';
}
function form_ts_ok(?string $v, int $minSec = 3, int $maxSec = 604800): bool {
    [$t, $sig] = array_pad(explode('.', (string)$v, 2), 2, '');
    if (!ctype_digit($t) || !hash_equals(hash_hmac('sha256', $t, APP_KEY), $sig)) return false;
    $age = time() - (int)$t;
    return $age >= $minSec && $age <= $maxSec;
}

/**
 * Daftar cabang aktif PosPro untuk pilihan "lokasi cetak" saat order.
 * Endpoint publik (tanpa auth). Tiap item: { id, name, code, phone }.
 * Hasil di-cache per-request. Kosong = tidak ditampilkan (lead jadi tanpa cabang).
 */
function pospro_branches(): array {
    static $cache = null;
    if ($cache !== null) return $cache;
    try { $r = api_get('/company-branches/public-active'); }
    catch (Throwable $e) { $r = null; }
    if (!is_array($r)) return $cache = [];
    return $cache = array_values(array_filter($r, fn($b) => !empty($b['id']) && !empty($b['name'])));
}

// ── Cloudflare Turnstile (CAPTCHA tak terlihat untuk checkout) ───────────────
/** Site key publik (untuk widget di frontend). Kosong = fitur nonaktif. */
function turnstile_site_key(): string {
    try { return (string)cfg('turnstile_site_key', ''); } catch (Throwable $e) { return ''; }
}
/** True kalau kedua kunci sudah diisi di Setelan → verifikasi diaktifkan. */
function turnstile_enabled(): bool {
    try { return turnstile_site_key() !== '' && secret_get('turnstile_secret') !== ''; }
    catch (Throwable $e) { return false; }
}
/**
 * Verifikasi token Turnstile ke Cloudflare. Belum dikonfigurasi → true (jangan
 * blokir order). Konfigurasi ada tapi token kosong/invalid → false.
 */
function turnstile_verify(?string $token): bool {
    if (!turnstile_enabled()) return true;
    $token = trim((string)$token);
    if ($token === '') return false;
    try {
        $r = http_json('POST', 'https://challenges.cloudflare.com/turnstile/v0/siteverify', [
            'secret'   => secret_get('turnstile_secret'),
            'response' => $token,
            'remoteip' => client_ip(),
        ]);
    } catch (Throwable $e) { return false; }
    return ($r['status'] ?? 0) === 200 && !empty($r['data']['success']);
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

// ── Mirror gambar PosPro ke hosting toko (tahan-mati + Google Images) ─────────
// Gambar produk/logo aslinya disajikan dari server PosPro; kalau PosPro mati,
// gambar jadi rusak. Solusi: salin gambar ke folder uploads/mirror milik toko,
// lalu sajikan salinan lokal itu. Unduhan dilakukan bertahap (anggaran kecil per
// kunjungan) sehingga otomatis lengkap seiring traffic, tanpa wajib cron.
function mirror_dir(): string {
    $dir = uploads_dir() . '/mirror';            // uploads/.htaccess (deny skrip) ikut berlaku di subfolder
    if (!is_dir($dir)) @mkdir($dir, 0775, true);
    return $dir;
}

/** Nama file lokal deterministik dari path gambar PosPro (stabil walau base berubah). */
function mirror_name(string $remoteKey): string {
    $p   = parse_url($remoteKey, PHP_URL_PATH) ?: $remoteKey;
    $ext = strtolower(pathinfo($p, PATHINFO_EXTENSION));
    if (!preg_match('/^(jpe?g|png|gif|webp|svg)$/', $ext)) $ext = 'img';
    return sha1($p) . '.' . $ext;               // hash PATH saja (tanpa host) → konsisten
}

/** Path relatif lokal bila mirror sudah ada (uploads/mirror/xxx), else null. */
function mirror_existing(string $remoteKey): ?string {
    $name = mirror_name($remoteKey);
    return is_file(mirror_dir() . '/' . $name) ? 'uploads/mirror/' . $name : null;
}

/**
 * Buat salinan WebP (sisi terpanjang maks 1000px, q80) di samping file mirror
 * JPG/PNG. Foto produk PosPro banyak berupa PNG 1254px ±650 KB → WebP jauh lebih
 * ringan. File asli tetap disimpan (dipakai og:image & fallback).
 */
function mirror_make_webp(string $absPath): void {
    if (!function_exists('imagewebp') || !preg_match('/\.(png|jpe?g)$/i', $absPath)) return;
    $out = preg_replace('/\.(png|jpe?g)$/i', '.webp', $absPath);
    if (is_file($out)) return;
    $info = @getimagesize($absPath);
    if (!$info || $info[0] * $info[1] > 40000000) return;
    $src = $info[2] === IMAGETYPE_PNG ? @imagecreatefrompng($absPath) : @imagecreatefromjpeg($absPath);
    if (!$src) return;
    $w = imagesx($src); $h = imagesy($src); $scale = min(1, 1000 / max($w, $h));
    $dst = imagecreatetruecolor(max(1, (int)round($w * $scale)), max(1, (int)round($h * $scale)));
    imagealphablending($dst, false); imagesavealpha($dst, true);
    imagecopyresampled($dst, $src, 0, 0, 0, 0, imagesx($dst), imagesy($dst), $w, $h);
    if (@imagewebp($dst, $out . '.tmp', 80) && filesize($out . '.tmp') > 0) @rename($out . '.tmp', $out); else @unlink($out . '.tmp');
    imagedestroy($src); imagedestroy($dst);
}

/** Path lokal (relatif root toko) dari URL gambar milik situs ini, atau null. */
function local_upload_path(?string $src): ?string {
    $src = trim((string)$src);
    if ($src === '') return null;
    if (preg_match('#^https?://#i', $src)) {
        $host = strtolower((string)parse_url($src, PHP_URL_HOST));
        if ($host !== strtolower(preg_replace('/:\d+$/', '', $_SERVER['HTTP_HOST'] ?? ''))) return null;
        $src = (string)parse_url($src, PHP_URL_PATH);
    }
    $src = ltrim(preg_replace('/[?#].*$/', '', $src), '/');
    if (!preg_match('#^uploads/[^\0]+$#', $src) || str_contains($src, '..')) return null;
    return is_file(__DIR__ . '/' . $src) ? $src : null;
}

/**
 * Versi WebP ter-resize (lebar maks $maxW) untuk gambar JPG/PNG/WebP di uploads/
 * (hero, portofolio, logo klien, cover artikel). Dibuat SEKALI di uploads/opt/
 * lalu dipakai ulang; nama memuat hash mtime → ganti file asli = versi baru.
 * Gagal/bukan gambar lokal → kembalikan $src apa adanya.
 */
function img_opt(?string $src, int $maxW = 1000): string {
    $src = (string)$src;
    $rel = local_upload_path($src);
    if ($rel === null || !preg_match('/\.(jpe?g|png|webp)$/i', $rel) || str_starts_with($rel, 'uploads/opt/') || !function_exists('imagewebp')) return $src;
    $abs = __DIR__ . '/' . $rel;
    $out = 'uploads/opt/' . pathinfo($rel, PATHINFO_FILENAME) . '-' . substr(sha1($rel . '|' . @filemtime($abs)), 0, 8) . '-' . $maxW . '.webp';
    if (is_file(__DIR__ . '/' . $out)) return $out;
    $info = @getimagesize($abs);
    if (!$info || $info[0] * $info[1] > 40000000) return $src;
    if ($info[0] <= $maxW && $info[2] === IMAGETYPE_WEBP) return $src; // sudah WebP & cukup kecil
    $im = match ($info[2]) { IMAGETYPE_PNG => @imagecreatefrompng($abs), IMAGETYPE_WEBP => @imagecreatefromwebp($abs), default => @imagecreatefromjpeg($abs) };
    if (!$im) return $src;
    $w = imagesx($im); $h = imagesy($im); $scale = min(1, $maxW / $w);
    $dst = imagecreatetruecolor(max(1, (int)round($w * $scale)), max(1, (int)round($h * $scale)));
    imagealphablending($dst, false); imagesavealpha($dst, true);
    imagecopyresampled($dst, $im, 0, 0, 0, 0, imagesx($dst), imagesy($dst), $w, $h);
    @mkdir(__DIR__ . '/uploads/opt', 0775, true);
    $ok = @imagewebp($dst, __DIR__ . '/' . $out . '.tmp', 78);
    imagedestroy($im); imagedestroy($dst);
    if ($ok && @filesize(__DIR__ . '/' . $out . '.tmp') > 0 && @rename(__DIR__ . '/' . $out . '.tmp', __DIR__ . '/' . $out)) return $out;
    @unlink(__DIR__ . '/' . $out . '.tmp');
    return $src;
}

/** Atribut width/height gambar lokal (cegah layout bergeser / CLS). Kosong bila tak diketahui. */
function img_dims(?string $src): string {
    $rel = local_upload_path($src);
    $i = $rel ? @getimagesize(__DIR__ . '/' . $rel) : false;
    return $i ? 'width="' . (int)$i[0] . '" height="' . (int)$i[1] . '"' : '';
}

/** Unduh satu gambar PosPro ke mirror lokal. Return path relatif atau null bila gagal. */
function mirror_fetch(string $remoteUrl, string $remoteKey): ?string {
    $name = mirror_name($remoteKey);
    $dest = mirror_dir() . '/' . $name;
    if (is_file($dest)) return 'uploads/mirror/' . $name;
    $ctx = stream_context_create(['http' => ['method' => 'GET', 'timeout' => 6, 'ignore_errors' => true]]);
    $bin = @file_get_contents($remoteUrl, false, $ctx);
    if ($bin === false || strlen($bin) < 64 || strlen($bin) > 15 * 1024 * 1024) return null;
    $tmp = $dest . '.tmp';
    if (@file_put_contents($tmp, $bin) === false) return null;
    // Validasi: harus gambar raster valid, atau SVG asli (bukan halaman error HTML).
    $isSvg = substr($name, -4) === '.svg' && stripos($bin, '<svg') !== false && stripos($bin, '<?php') === false;
    if (@getimagesize($tmp) === false && !$isSvg) { @unlink($tmp); return null; }
    @rename($tmp, $dest);
    mirror_make_webp($dest);
    return 'uploads/mirror/' . $name;
}

/**
 * Scan rekursif (iteratif) struktur data untuk URL gambar PosPro, lalu unduh yang
 * belum ter-mirror sampai $budget habis. Return jumlah yang baru diunduh.
 */
function mirror_scan($data, int $budget): int {
    if ($budget <= 0 || !is_array($data)) return 0;
    $base = pospro_base(); $blen = strlen($base); $done = 0;
    $stack = [$data];
    while ($stack && $budget > 0) {
        $node = array_pop($stack);
        foreach ($node as $v) {
            if (is_array($v)) { $stack[] = $v; continue; }
            if (!is_string($v) || !preg_match('#\.(jpe?g|png|gif|webp|svg)(\?|$)#i', $v)) continue;
            $isAbs = (bool)preg_match('#^https?://#i', $v);
            if ($isAbs && strncmp($v, $base, $blen) !== 0) continue; // gambar eksternal — lewati
            $key = $isAbs ? substr($v, $blen) : $v;
            if (mirror_existing($key)) continue;                     // sudah ada
            if (mirror_fetch($isAbs ? $v : $base . $v, $key)) { $done++; if (--$budget <= 0) break; }
        }
    }
    return $done;
}

/** Mirroring oportunistik: unduh maksimal beberapa gambar baru per kunjungan. */
function mirror_opportunistic($data): void {
    static $left = 4;                            // anggaran unduh total per request
    if ($left <= 0) return;
    $left -= mirror_scan($data, $left);
}

function img_url(?string $u, bool $webp = true): string {
    if (!$u) return '';
    $isAbs = (bool)preg_match('#^https?://#i', $u);
    $base  = pospro_base();
    // Gambar milik PosPro → utamakan salinan lokal bila sudah ter-mirror.
    if (!$isAbs || strncmp($u, $base, strlen($base)) === 0) {
        $key   = $isAbs ? substr($u, strlen($base)) : $u;
        $local = mirror_existing($key);
        if ($local) {
            // Versi WebP ringan bila sudah dibuat (lihat mirror_make_webp); og:image pakai asli.
            $wp = preg_replace('/\.(png|jpe?g)$/i', '.webp', $local);
            if ($webp && $wp !== $local && is_file(__DIR__ . '/' . $wp)) return abs_url($wp);
            return abs_url($local);             // absolut di domain toko (valid utk og:image)
        }
    }
    return $isAbs ? $u : $base . $u;            // fallback: sajikan langsung dari PosPro
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
 * Produk AREA_BASED SELALU dihitung per METER PERSEGI (base m²) — persis POS.
 * `variant.price` = harga per m². Nama master Unit produk hanya LABEL (tak dipakai).
 * `unitType` cuma konversi INPUT dimensi:
 *   'm'    → P×L (m²)            (pelanggan input meter)
 *   'cm'   → P×L ÷ 10.000 (m²)   (pelanggan input cm — default)
 *   'menit'→ P (durasi/jumlah)   (produk berbasis waktu; jarang di storefront)
 * (Ref POS: cart-store.ts computeAreaPrice "price is always per-m²".)
 */
function area_native(float $w, float $h, string $unitType): float {
    if ($unitType === 'menit') return $w;
    if ($unitType === 'm')     return $w * $h;       // input meter → m²
    if ($unitType === 'cm2')   return $w * $h;       // produk basis cm² → cm² (tanpa ÷10.000)
    return ($w * $h) / 10000;                         // 'cm' / default → m²
}

/** Label satuan luas untuk tampilan: cm² (cm2) / unit (menit) / m² (m & cm). */
function area_sq_label(string $unitType): string {
    if ($unitType === 'menit') return 'unit';
    if ($unitType === 'cm2')   return 'cm²';
    return 'm²';
}

/** Basis luas produk dari field areaUnit (POS): 'CM2' → per cm², else per m². */
function product_area_basis(array $p): string {
    return (($p['areaUnit'] ?? 'M2') === 'CM2') ? 'CM2' : 'M2';
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
 * Subtotal satu item keranjang. Item area: qty × luas × unitPrice, di mana luas
 * dalam SATUAN ASLI produk & unitPrice per satuan² tsb (area_native()):
 * 'm' → P×L m² × harga/m²; 'cm' → P×L cm² × harga/cm²; 'menit' → P × harga.
 * TANPA ÷10.000. Selain area: qty × unitPrice.
 */
function cart_item_subtotal(array $it): float {
    $qty = (int)($it['quantity'] ?? 0);
    $price = (float)($it['unitPrice'] ?? 0);
    $w = (float)($it['widthCm'] ?? 0);
    $h = (float)($it['heightCm'] ?? 0);
    $unitType = (string)($it['unitType'] ?? 'cm');
    if ($unitType === 'menit' && $w > 0) return $qty * area_native($w, 0, 'menit') * $price;
    if ($w > 0 && $h > 0) return $qty * area_native($w, $h, $unitType) * $price;
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

/**
 * Nomor telepon toko efektif untuk tampilan (tel:, footer, JSON-LD). Utamakan
 * blok "Kontak" yang bisa diedit admin dari Dashboard → Konten; baru fallback ke
 * storePhone profil PosPro bila kosong. Dibuat satu sumber agar admin toko bisa
 * mengganti nomor di satu tempat dan berlaku di seluruh storefront.
 */
function store_phone(): string {
    static $v = null;
    if ($v !== null) return $v;
    require_once __DIR__ . '/content_store.php';
    $k = site_content('kontak');
    $p = trim((string)($k['phone'] ?? ''));
    if ($p === '') $p = trim((string)(settings()['storePhone'] ?? ''));
    return $v = $p;
}

/** Nomor WhatsApp toko (format 62…) — utamakan WA blok Kontak, lalu telepon Kontak, lalu storePhone. */
function store_wa(): string {
    static $v = null;
    if ($v !== null) return $v;
    require_once __DIR__ . '/content_store.php';
    $k = site_content('kontak');
    $raw = trim((string)($k['whatsapp'] ?? '')) ?: trim((string)($k['phone'] ?? '')) ?: trim((string)(settings()['storePhone'] ?? ''));
    return $v = preg_replace('/^0/', '62', preg_replace('/\D/', '', $raw));
}

/**
 * JSON-LD bisnis lokal (@graph): Organization + satu LocalBusiness per cabang dari
 * blok Kontak (alamat, telp, jam buka, koordinat dari URL embed Maps). Sinyal
 * penting untuk pencarian lokal "digital printing jogja / percetakan terdekat".
 */
function seo_business_jsonld(): array {
    require_once __DIR__ . '/content_store.php';
    $st   = settings();
    $name = $st['storeName'] ?? 'Voliko Print';
    $logo = !empty($st['logoImageUrl']) ? img_url($st['logoImageUrl'], false) : '';
    $k    = site_content('kontak');
    $orgId = base_url() . '#org';
    $org = [
        '@type' => 'Organization', '@id' => $orgId, 'name' => $name, 'url' => base_url(),
        'alternateName' => ['Voliko Digital Printing', 'Voliko Digital Printing & Cutting Laser'],
    ];
    if ($logo) $org['logo'] = $logo;
    if (!empty($k['email'])) $org['email'] = $k['email'];
    if (($ph = store_phone()) !== '') $org['telephone'] = $ph;
    $graph = [$org];

    $days = ['Senin' => 'Monday', 'Selasa' => 'Tuesday', 'Rabu' => 'Wednesday', 'Kamis' => 'Thursday',
             'Jumat' => 'Friday', 'Sabtu' => 'Saturday', 'Minggu' => 'Sunday'];
    $dayKeys = array_keys($days);
    foreach ((array)($k['locations'] ?? []) as $i => $l) {
        if (trim($l['name'] ?? '') === '' || trim($l['address'] ?? '') === '') continue;
        $b = [
            '@type' => 'LocalBusiness', '@id' => base_url() . '#cabang-' . ($i + 1),
            'name' => $l['name'], 'parentOrganization' => ['@id' => $orgId], 'url' => base_url(),
            'priceRange' => 'Rp', 'image' => $logo ?: null,
            'address' => ['@type' => 'PostalAddress', 'streetAddress' => $l['address'],
                          'addressLocality' => 'Bantul', 'addressRegion' => 'Daerah Istimewa Yogyakarta',
                          'addressCountry' => 'ID'],
            'areaServed' => ['Yogyakarta', 'Bantul', 'Sleman', 'Kota Yogyakarta', 'Daerah Istimewa Yogyakarta'],
        ];
        if (preg_match('/\b(\d{5})\b/', $l['address'], $m)) $b['address']['postalCode'] = $m[1];
        if (!empty($l['phone'])) $b['telephone'] = $l['phone'];
        if ($c = location_coords($l)) {
            $b['geo'] = ['@type' => 'GeoCoordinates', 'latitude' => $c[0], 'longitude' => $c[1]];
        }
        // "Senin–Sabtu 08.00–21.00" → openingHoursSpecification
        if (preg_match('/(\p{L}+)\s*[–-]\s*(\p{L}+)\s+(\d{1,2})[.:](\d{2})\s*[–-]\s*(\d{1,2})[.:](\d{2})/u', (string)($l['hours'] ?? ''), $m)
            && isset($days[$m[1]], $days[$m[2]])) {
            $from = array_search($m[1], $dayKeys, true); $to = array_search($m[2], $dayKeys, true);
            $b['openingHoursSpecification'] = [
                '@type' => 'OpeningHoursSpecification',
                'dayOfWeek' => array_map(fn($d) => $days[$d], array_slice($dayKeys, $from, $to - $from + 1)),
                'opens' => sprintf('%02d:%s', $m[3], $m[4]), 'closes' => sprintf('%02d:%s', $m[5], $m[6]),
            ];
        }
        $graph[] = array_filter($b, fn($v) => $v !== null);
    }
    return ['@context' => 'https://schema.org', '@graph' => $graph];
}

/**
 * Koordinat [lat, lng] sebuah cabang. Utamakan field 'coords' ("lat, lng" — disalin
 * dari pin Google Maps); fallback angka di URL embed (!3d/!2d). Catatan: angka embed
 * adalah TITIK TENGAH tampilan peta, bukan pin — bisa meleset ratusan meter.
 */
function location_coords(array $l): ?array {
    if (preg_match('/^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/', (string)($l['coords'] ?? ''), $m)
        && abs((float)$m[1]) <= 90 && abs((float)$m[2]) <= 180) {
        return [(float)$m[1], (float)$m[2]];
    }
    if (preg_match('/!2d(-?[\d.]+)!3d(-?[\d.]+)/', (string)($l['mapsEmbed'] ?? ''), $m)) return [(float)$m[2], (float)$m[1]];
    return null;
}

/** JSON-LD FAQPage dari daftar [pertanyaan, jawaban]. */
function seo_faq_jsonld(array $faqs): array {
    return ['@context' => 'https://schema.org', '@type' => 'FAQPage', 'mainEntity' => array_map(fn($f) => [
        '@type' => 'Question', 'name' => $f[0],
        'acceptedAnswer' => ['@type' => 'Answer', 'text' => $f[1]],
    ], $faqs)];
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
