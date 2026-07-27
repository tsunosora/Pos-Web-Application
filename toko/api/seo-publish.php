<?php
/**
 * SEO Machine — Remote Publish Endpoint (untuk storefront "toko")
 * ==============================================================
 * Menerima artikel dari SEO Machine (POST JSON + Bearer key) lalu meng-upsert
 * ke tabel `articles` situs ini. Konfigurasi (aktif/nonaktif, API key, status
 * default) dibaca dari tabel `settings` (k/v) toko via cfg() → bisa di-ON/OFF
 * kapan saja dari Dashboard → Pengaturan → SEO Machine.
 *
 * Kontrak API: lihat seomachine/php-site/README.md
 *   POST /api/seo-publish.php
 *   Authorization: Bearer <seomachine_api_key>   (fallback: header X-API-Key)
 *   Body JSON: { title, content_html, slug?, meta_title?, meta_description?,
 *                focus_keyword?, excerpt?, status?, featured_image_url?, ... }
 *   {"ping": true} → cek koneksi & auth tanpa menyimpan.
 *
 * Adaptasi khusus toko: status disimpan UPPERCASE (DRAFT/PUBLISHED),
 * kolom content/cover_url/seo_keyword, set published_at saat publish.
 */

declare(strict_types=1);

/* ---------- Mode uji: muat definisi fungsi saja (handler TAK dijalankan) ----------
 * Dipakai tests/slug-resolution.test.php agar logika INTI anti-timpa bisa diuji
 * tanpa DB. Deklarasi fungsi tetap ter-hoist walau eksekusi dihentikan di sini. */
if (PHP_SAPI === 'cli' && getenv('SEO_ENDPOINT_TEST') === '1') {
    return;
}

/* ---------- Helper respons JSON ---------- */
function seo_respond(int $code, array $data): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

/* ---------- Slug: normalisasi & resolusi bentrok (INTI anti-timpa) ---------- */
function seo_normalize_slug(string $s): string {
    $s = strtolower(trim($s));
    $s = preg_replace('/[^a-z0-9]+/', '-', $s);
    return trim($s, '-');
}

/**
 * Kembalikan slug bebas pertama. Bila $base sudah dipakai, tambahkan akhiran
 * -2, -3, … sampai menemukan yang belum ada — sehingga artikel lama TIDAK
 * tertimpa (kebijakan on_duplicate="new"). $exists(slug):bool = penanda DB.
 */
function seo_next_free_slug(string $base, callable $exists): string {
    if (!$exists($base)) return $base;
    for ($i = 2; $i < 100000; $i++) {
        $cand = $base . '-' . $i;
        if (!$exists($cand)) return $cand;
    }
    return $base . '-' . substr(md5($base . uniqid('', true)), 0, 8);
}

/* ---------- Muat koneksi & config toko (memberi db(), cfg()) ---------- */
require_once __DIR__ . '/../db.php';

/* ---------- Baca konfigurasi seomachine dari tabel settings (cfg) ---------- */
$seo = ['enabled' => false, 'api_key' => '', 'default_status' => 'draft'];
try {
    $seo['enabled']        = ((string)cfg('seomachine_enabled', '0')) === '1';
    $seo['api_key']        = trim((string)cfg('seomachine_api_key', ''));
    $seo['default_status'] = ((string)cfg('seomachine_default_status', 'draft')) === 'publish' ? 'publish' : 'draft';
} catch (Throwable $e) {
    error_log('[seo-machine] gagal baca settings: ' . $e->getMessage());
    seo_respond(500, ['success' => false, 'error' => 'Konfigurasi integrasi tidak dapat dibaca.']);
}

/* URL publik absolut untuk permalink hasil (artikel.php?slug=...) */
$scheme   = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$httpHost = $_SERVER['HTTP_HOST'] ?? 'localhost';
// root situs = satu level di atas folder /api
$siteBase = rtrim(str_replace('\\', '/', dirname(dirname($_SERVER['SCRIPT_NAME'] ?? '/api/x'))), '/');
if ($siteBase === '.' || $siteBase === '') $siteBase = '';

$CONFIG = [
    'uploads_dir'     => __DIR__ . '/../uploads/articles',
    'uploads_url'     => 'uploads/articles',   // relatif ke root situs (dipakai apa adanya di <img src>)
    'public_base'     => $scheme . '://' . $httpHost . $siteBase . '/artikel.php',
    'default_status'  => $seo['default_status'],
    // HTTPS diwajibkan kecuali di localhost (dev pakai http).
    'require_https'   => !in_array(strtolower(explode(':', $httpHost)[0]), ['localhost', '127.0.0.1'], true),
    'trusted_proxies' => [],
    'max_body_bytes'  => 8 * 1024 * 1024,
    'allowed_img_ext' => ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    'max_image_bytes' => 5 * 1024 * 1024,
];

/* ---------- 0. Integrasi harus AKTIF ---------- */
if (!$seo['enabled']) {
    seo_respond(403, ['success' => false, 'error' => 'Integrasi SEO Machine sedang NONAKTIF. Aktifkan di Dashboard → Pengaturan.']);
}

/* ============================ Helper keamanan ============================ */
function seo_sanitize_html(string $html): string {
    if ($html === '') return '';
    $html = preg_replace('#<\s*(script|style|iframe|object|embed|form|link|meta|base)\b[^>]*>.*?<\s*/\s*\1\s*>#is', '', $html);
    $html = preg_replace('#<\s*/?\s*(script|style|iframe|object|embed|form|link|meta|base)\b[^>]*>#is', '', $html);
    $html = preg_replace('#\son[a-z]+\s*=\s*"[^"]*"#is', '', $html);
    $html = preg_replace("#\son[a-z]+\s*=\s*'[^']*'#is", '', $html);
    $html = preg_replace('#\son[a-z]+\s*=\s*[^\s>]+#is', '', $html);
    $html = preg_replace('#\b(href|src)\s*=\s*("|\')\s*(javascript|vbscript|data)\s*:[^"\']*\2#is', '$1=$2#$2', $html);
    return $html;
}

function seo_is_safe_public_url(string $url): bool {
    if (!filter_var($url, FILTER_VALIDATE_URL)) return false;
    $p = parse_url($url);
    $sc = strtolower($p['scheme'] ?? '');
    $host = $p['host'] ?? '';
    if (!in_array($sc, ['http', 'https'], true) || $host === '') return false;
    if (filter_var($host, FILTER_VALIDATE_IP)) {
        $ip = $host;
    } else {
        $ip = gethostbyname($host);
        if ($ip === $host) return false;
    }
    return (bool) filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE);
}

function seo_fetch_remote_image(string $url, int $maxBytes) {
    if (!seo_is_safe_public_url($url)) return false;
    $ctx = stream_context_create(['http' => ['timeout' => 8, 'follow_location' => 0]]);
    $data = @file_get_contents($url, false, $ctx, 0, $maxBytes + 1);
    if ($data === false || strlen($data) > $maxBytes) return false;
    return $data;
}

function seo_image_ext_from_bytes(string $data, array $allowed): ?string {
    $info = @getimagesizefromstring($data);
    if ($info === false) return null;
    $map = [IMAGETYPE_JPEG => 'jpg', IMAGETYPE_PNG => 'png', IMAGETYPE_GIF => 'gif', IMAGETYPE_WEBP => 'webp'];
    $ext = $map[$info[2]] ?? null;
    return ($ext !== null && in_array($ext, $allowed, true)) ? $ext : null;
}

/* ---------- 1. Wajib HTTPS (kecuali localhost) ---------- */
$https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
if (!$https && ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https'
    && in_array($_SERVER['REMOTE_ADDR'] ?? '', $CONFIG['trusted_proxies'], true)) {
    $https = true;
}
if ($CONFIG['require_https'] && !$https) {
    seo_respond(400, ['success' => false, 'error' => 'HTTPS wajib digunakan.']);
}

/* ---------- 2. Autentikasi API key (timing-safe) — berlaku untuk semua method ---------- */
$provided = '';
$auth = $_SERVER['HTTP_AUTHORIZATION'] ?? ($_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
if (stripos($auth, 'Bearer ') === 0) {
    $provided = trim(substr($auth, 7));
} elseif (!empty($_SERVER['HTTP_X_API_KEY'])) {
    $provided = trim((string)$_SERVER['HTTP_X_API_KEY']);
}
if ($seo['api_key'] === '') {
    seo_respond(500, ['success' => false, 'error' => 'API key belum dikonfigurasi. Isi di Dashboard → Pengaturan → SEO Machine.']);
}
if ($provided === '' || !hash_equals($seo['api_key'], $provided)) {
    seo_respond(401, ['success' => false, 'error' => 'API key tidak valid.']);
}

/* ---------- 2b. Rute cek-slug (GET, read-only) — deteksi bentrok TERMASUK draft ----------
 * GET {endpoint}?slug=<slug> → { success, slug, exists, status(publish|draft|null), url|null }
 * Dashboard memakai ini SEBELUM publish agar slug berstatus draft pun terdeteksi
 * (artikel draft 404 di halaman publik → tak bisa dideteksi lewat URL biasa). */
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET') {
    $qslug = seo_normalize_slug((string)($_GET['slug'] ?? ''));
    if ($qslug === '') {
        seo_respond(400, ['success' => false, 'error' => 'Parameter slug wajib.']);
    }
    try {
        $stmt = db()->prepare("SELECT status FROM articles WHERE slug = :s LIMIT 1");
        $stmt->execute([':s' => $qslug]);
        $row = $stmt->fetch();
    } catch (Throwable $e) {
        error_log('[seo-machine] cek-slug gagal: ' . $e->getMessage());
        seo_respond(500, ['success' => false, 'error' => 'Gagal memeriksa slug.']);
    }
    if (!$row) {
        seo_respond(200, ['success' => true, 'slug' => $qslug, 'exists' => false, 'status' => null, 'url' => null]);
    }
    $isPub = (strtoupper((string)$row['status']) === 'PUBLISHED');
    seo_respond(200, [
        'success' => true, 'slug' => $qslug, 'exists' => true,
        'status'  => $isPub ? 'publish' : 'draft',           // SCHEDULED/DRAFT → "draft" (belum publik)
        'url'     => $isPub ? (rtrim($CONFIG['public_base'], '/') . '?slug=' . rawurlencode($qslug)) : null,
    ]);
}

/* ---------- 2c. Selain GET/POST ditolak ---------- */
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: GET, POST');
    seo_respond(405, ['success' => false, 'error' => 'Hanya menerima GET (cek-slug) atau POST.']);
}

/* ---------- 4. Baca & validasi body JSON ---------- */
$declaredLen = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
if ($declaredLen > $CONFIG['max_body_bytes']) {
    seo_respond(413, ['success' => false, 'error' => 'Body terlalu besar.']);
}
$raw = file_get_contents('php://input', false, null, 0, $CONFIG['max_body_bytes'] + 1);
if ($raw !== false && strlen($raw) > $CONFIG['max_body_bytes']) {
    seo_respond(413, ['success' => false, 'error' => 'Body terlalu besar.']);
}
$body = json_decode((string)$raw, true);
if (!is_array($body)) {
    seo_respond(400, ['success' => false, 'error' => 'Body harus JSON valid.']);
}

/* ---------- 4a. Mode PING ---------- */
if (!empty($body['ping'])) {
    $dbOk = null; $dbMsg = 'tidak dicek';
    try { db()->query('SELECT 1'); $dbOk = true; $dbMsg = 'koneksi DB OK'; }
    catch (Throwable $e) { $dbOk = false; $dbMsg = 'koneksi DB GAGAL'; }
    seo_respond(200, [
        'success' => true, 'message' => 'pong — endpoint aktif & API key valid',
        'mode' => 'db', 'db_ok' => $dbOk, 'db_status' => $dbMsg,
        'default_status' => $CONFIG['default_status'], 'php' => PHP_VERSION, 'time' => date('c'),
    ]);
}

$title   = trim((string)($body['title'] ?? ''));
$content = (string)($body['content_html'] ?? $body['content'] ?? '');
if ($title === '' || $content === '') {
    seo_respond(422, ['success' => false, 'error' => 'Field wajib: title dan content_html.']);
}

/* slug */
$slug = seo_normalize_slug(((string)($body['slug'] ?? '')) ?: $title);
if ($slug === '') $slug = 'artikel-' . date('YmdHis');

/* status: draft|publish → toko UPPERCASE DRAFT|PUBLISHED */
$reqStatus = in_array(($body['status'] ?? ''), ['draft', 'publish'], true) ? (string)$body['status'] : $CONFIG['default_status'];
$statusDb  = ($reqStatus === 'publish') ? 'PUBLISHED' : 'DRAFT';

/* kebijakan slug bentrok (INTI anti-timpa) — default "new" bila tak dikirim */
$onDup = strtolower(trim((string)($body['on_duplicate'] ?? 'new')));
if (!in_array($onDup, ['new', 'update', 'skip'], true)) $onDup = 'new';

$article = [
    'slug'             => $slug,
    'title'            => $title,
    'content_html'     => seo_sanitize_html($content),
    'meta_title'       => trim((string)($body['meta_title'] ?? $title)),
    'meta_description' => trim((string)($body['meta_description'] ?? '')),
    'focus_keyword'    => trim((string)($body['focus_keyword'] ?? $body['target_keyword'] ?? '')),
    'excerpt'          => trim((string)($body['excerpt'] ?? $body['meta_description'] ?? '')),
    'status'           => $statusDb,
    'featured_image'   => '',
];

/* ---------- 5. Featured image ---------- */
$imgUrl    = trim((string)($body['featured_image_url'] ?? ''));
$imgBase64 = (string)($body['featured_image_base64'] ?? '');
if ($imgUrl !== '' || $imgBase64 !== '') {
    if (!is_dir($CONFIG['uploads_dir'])) {
        @mkdir($CONFIG['uploads_dir'], 0755, true);
        @file_put_contents($CONFIG['uploads_dir'] . '/.htaccess',
            "php_flag engine off\nRemoveHandler .php .phtml .phar .phtm .php3 .php4 .php5 .pht\n");
    }
    $fname = $slug . '-' . substr(md5($slug . $title), 0, 8);
    $saved = '';
    try {
        $data = false;
        if ($imgBase64 !== '') {
            if (preg_match('#^data:image/[\w.+-]+;base64,#i', $imgBase64)) {
                $decoded = base64_decode(substr($imgBase64, strpos($imgBase64, ',') + 1), true);
                if ($decoded !== false && strlen($decoded) <= $CONFIG['max_image_bytes']) $data = $decoded;
            }
        } elseif ($imgUrl !== '') {
            $data = seo_fetch_remote_image($imgUrl, $CONFIG['max_image_bytes']);
        }
        if ($data !== false) {
            $ext = seo_image_ext_from_bytes($data, $CONFIG['allowed_img_ext']);
            if ($ext !== null) {
                file_put_contents($CONFIG['uploads_dir'] . "/$fname.$ext", $data);
                $saved = "$fname.$ext";
            }
        }
    } catch (Throwable $e) { /* abaikan kegagalan gambar */ }
    if ($saved !== '') {
        $article['featured_image'] = rtrim($CONFIG['uploads_url'], '/') . '/' . $saved;
    }
}

/* ---------- 6. Simpan (patuhi on_duplicate) ---------- */
try {
    $result = seo_save_to_db(db(), $article, $onDup);
} catch (Throwable $e) {
    error_log('[seo-machine] gagal menyimpan artikel: ' . $e->getMessage());
    seo_respond(500, ['success' => false, 'error' => 'Gagal menyimpan artikel.']);
}

/* ---------- 7. Respons sukses (slug FINAL + renamed) ---------- */
$finalSlug = $result['slug'];
seo_respond(200, [
    'success'  => true,
    'action'   => $result['action'],                 // created | updated | skipped
    'id'       => $result['id'] ?? null,
    'slug'     => $finalSlug,
    'renamed'  => (bool)($result['renamed'] ?? false),
    'status'   => $reqStatus,
    'url'      => rtrim($CONFIG['public_base'], '/') . '?slug=' . rawurlencode($finalSlug),
    'featured' => $article['featured_image'] ?: null,
]);


/* =========================================================================
 *  Penyimpanan DB (disesuaikan skema toko), PATUH kebijakan on_duplicate:
 *   - "new"    : slug bentrok → buat BARU dgn akhiran -2/-3 (artikel lama utuh)
 *   - "update" : timpa artikel lama (edit sengaja)
 *   - "skip"   : tak menulis apa pun
 *  articles(content, cover_url, seo_keyword, status VARCHAR uppercase, published_at)
 *  Return: ['action'=>created|updated|skipped, 'id'=>int, 'slug'=>final, 'renamed'=>bool]
 * ========================================================================= */
function seo_save_to_db(PDO $pdo, array $a, string $onDup): array {
    $t = 'articles';
    $existing = [];
    foreach ($pdo->query("SHOW COLUMNS FROM `$t`")->fetchAll() as $c) {
        $existing[strtolower($c['Field'])] = strtolower($c['Type']);
    }

    // Penanda eksistensi slug di DB (dipakai untuk resolusi -2/-3 & cek bentrok)
    $slugExists = function (string $s) use ($pdo, $t): bool {
        $q = $pdo->prepare("SELECT 1 FROM `$t` WHERE `slug` = :s LIMIT 1");
        $q->execute([':s' => $s]);
        return (bool) $q->fetchColumn();
    };

    // Cari baris eksisting berdasarkan slug asli (abaikan status: draft & publish sama dihitung "ada")
    $row = null;
    if (isset($existing['slug'])) {
        $stmt = $pdo->prepare("SELECT id FROM `$t` WHERE `slug` = :s LIMIT 1");
        $stmt->execute([':s' => $a['slug']]);
        $row = $stmt->fetch();
    }

    // ---- Terapkan kebijakan on_duplicate SEBELUM membangun query ----
    $renamed = false;
    if ($row) {
        if ($onDup === 'skip') {
            return ['action' => 'skipped', 'id' => (int)$row['id'], 'slug' => $a['slug'], 'renamed' => false];
        }
        if ($onDup === 'new') {
            // INTI anti-timpa: JANGAN sentuh artikel lama; buat slug baru -2/-3/…
            $newSlug = seo_next_free_slug($a['slug'], $slugExists);
            $renamed = ($newSlug !== $a['slug']);
            $a['slug'] = $newSlug;
            $row = null;                 // paksa jalur INSERT (artikel BARU)
        }
        // $onDup === 'update' → biarkan $row terisi → jalur UPDATE (timpa sengaja)
    }

    // nilai kanonik (slug sudah FINAL) → kandidat kolom (alias) sesuai skema toko
    $vals = [
        'slug'         => $a['slug'],
        'title'        => $a['title'],
        'content_html' => $a['content_html'],
        'meta_title'   => $a['meta_title'],
        'meta_desc'    => $a['meta_description'],
        'focus_kw'     => $a['focus_keyword'],
        'excerpt'      => ($a['excerpt'] ?: $a['meta_description']),
        'status'       => $a['status'],
        'cover'        => $a['featured_image'],
    ];
    $aliases = [
        'slug'         => ['slug', 'permalink'],
        'title'        => ['title', 'judul', 'post_title', 'name'],
        'content_html' => ['content', 'content_html', 'body', 'isi', 'post_content', 'konten'],
        'meta_title'   => ['meta_title', 'seo_title'],
        'meta_desc'    => ['meta_description', 'meta_desc', 'seo_description', 'description'],
        'focus_kw'     => ['seo_keyword', 'focus_keyword', 'focus_keyphrase', 'keyword'],
        'excerpt'      => ['excerpt', 'ringkasan', 'summary'],
        'status'       => ['status', 'state'],
        'cover'        => ['cover_url', 'featured_image', 'image', 'thumbnail', 'cover', 'image_url', 'gambar'],
    ];

    $assign = []; $used = []; $slugCol = null;
    foreach ($aliases as $canon => $cands) {
        foreach ($cands as $col) {
            if (isset($existing[$col]) && empty($used[$col])) {
                $v = $vals[$canon];
                // Kolom kosong ('') untuk cover → biarkan NULL (jangan timpa dgn string kosong)
                if ($canon === 'cover' && $v === '') { $used[$col] = true; break; }
                $assign[$col] = $v;
                $used[$col] = true;
                if ($canon === 'slug') $slugCol = $col;
                break;
            }
        }
    }
    if (!$assign) throw new RuntimeException("Tidak ada kolom cocok di tabel `$t`.");

    $isPublished = (strtoupper((string)$a['status']) === 'PUBLISHED');
    $hasPublishedAt = isset($existing['published_at']);
    $hasUpdatedAt   = isset($existing['updated_at']);
    $hasCreatedAt   = isset($existing['created_at']);

    // ---- UPDATE (hanya on_duplicate="update") ----
    if ($row) {
        $set = []; $params = [':id' => $row['id']];
        foreach ($assign as $col => $v) { $set[] = "`$col` = :$col"; $params[":$col"] = $v; }
        if ($hasUpdatedAt)   $set[] = "`updated_at` = NOW()";
        if ($isPublished && $hasPublishedAt) $set[] = "`published_at` = COALESCE(`published_at`, NOW())";
        $pdo->prepare("UPDATE `$t` SET " . implode(', ', $set) . " WHERE id = :id")->execute($params);
        return ['action' => 'updated', 'id' => (int)$row['id'], 'slug' => $a['slug'], 'renamed' => false];
    }

    // ---- INSERT (artikel baru). Retry bila balapan UNIQUE(slug) untuk kebijakan "new". ----
    for ($attempt = 0; ; $attempt++) {
        $colNames = []; $place = []; $params = [];
        foreach ($assign as $col => $v) { $colNames[] = "`$col`"; $place[] = ":$col"; $params[":$col"] = $v; }
        if ($isPublished && $hasPublishedAt) { $colNames[] = "`published_at`"; $place[] = "NOW()"; }
        if ($hasCreatedAt) { $colNames[] = "`created_at`"; $place[] = "NOW()"; }
        if ($hasUpdatedAt) { $colNames[] = "`updated_at`"; $place[] = "NOW()"; }
        $sql = "INSERT INTO `$t` (" . implode(', ', $colNames) . ") VALUES (" . implode(', ', $place) . ")";
        try {
            $pdo->prepare($sql)->execute($params);
            return ['action' => 'created', 'id' => (int)$pdo->lastInsertId(), 'slug' => $a['slug'], 'renamed' => $renamed];
        } catch (PDOException $e) {
            // 23000 = pelanggaran UNIQUE (slug keburu dipakai proses lain di antara cek & insert)
            if ($onDup === 'new' && $e->getCode() === '23000' && $slugCol !== null && $attempt < 3) {
                $a['slug'] = seo_next_free_slug($a['slug'], $slugExists);
                $renamed = true;
                $assign[$slugCol] = $a['slug'];
                continue;
            }
            throw $e;
        }
    }
}
