<?php
require_once __DIR__ . '/config.php';

// ── Koneksi DB (PDO, singleton) ──────────────────────────────────────────────
function db(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = 'mysql:host=' . DB_HOST . ';port=' . DB_PORT . ';dbname=' . DB_NAME . ';charset=utf8mb4';
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    }
    return $pdo;
}

/** Cek apakah DB sudah ter-install (tabel users ada & terisi). */
function is_installed(): bool {
    try {
        $n = db()->query('SELECT COUNT(*) FROM users')->fetchColumn();
        return $n !== false;
    } catch (Throwable $e) {
        return false;
    }
}

// ── Settings key-value (DB) ──────────────────────────────────────────────────
function cfg(string $key, $default = null) {
    static $cache = null;
    if ($cache === null) {
        $cache = [];
        try {
            foreach (db()->query('SELECT k, v FROM settings') as $r) $cache[$r['k']] = $r['v'];
        } catch (Throwable $e) { $cache = []; }
    }
    return array_key_exists($key, $cache) ? $cache[$key] : $default;
}

function cfg_set(string $key, ?string $value): void {
    $st = db()->prepare('INSERT INTO settings (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)');
    $st->execute([$key, $value]);
}

// ── Enkripsi data sensitif (AES-256-CBC dengan APP_KEY) ──────────────────────
function secret_encrypt(string $plain): string {
    $key = hash('sha256', APP_KEY, true);
    $iv  = random_bytes(16);
    $ct  = openssl_encrypt($plain, 'aes-256-cbc', $key, OPENSSL_RAW_DATA, $iv);
    return base64_encode($iv . $ct);
}
function secret_decrypt(?string $enc): string {
    if (!$enc) return '';
    $raw = base64_decode($enc, true);
    if ($raw === false || strlen($raw) < 17) return '';
    $key = hash('sha256', APP_KEY, true);
    $iv  = substr($raw, 0, 16);
    $ct  = substr($raw, 16);
    $pt  = openssl_decrypt($ct, 'aes-256-cbc', $key, OPENSSL_RAW_DATA, $iv);
    return $pt === false ? '' : $pt;
}
function secret_set(string $key, string $plain): void { cfg_set($key, $plain === '' ? '' : secret_encrypt($plain)); }
function secret_get(string $key): string { return secret_decrypt(cfg($key)); }

// ── Cache fallback API PosPro (agar toko tetap jalan saat PosPro down) ───────
// Tiap respons GET publik yang sukses disalin ke tabel api_cache. Kalau PosPro
// mati/timeout, storefront memakai salinan terakhir alih-alih tampil kosong.
function ensure_api_cache_table(): void {
    static $done = false;
    if ($done) return;
    $done = true;
    try {
        db()->exec("CREATE TABLE IF NOT EXISTS api_cache (
            k VARCHAR(190) NOT NULL PRIMARY KEY,
            v LONGTEXT NOT NULL,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            KEY idx_updated (updated_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    } catch (Throwable $e) { /* DB belum siap — api_get jalan tanpa fallback */ }
}

/** Baca cache mentah (string JSON) untuk path tertentu, atau null bila belum ada. */
function api_cache_read(string $key): ?string {
    ensure_api_cache_table();
    try {
        $st = db()->prepare('SELECT v FROM api_cache WHERE k = ? LIMIT 1');
        $st->execute([$key]);
        $v = $st->fetchColumn();
    } catch (Throwable $e) { return null; }
    return $v === false ? null : (string)$v;
}

/** Simpan/replace cache untuk path tertentu (upsert). */
function api_cache_write(string $key, string $json): void {
    ensure_api_cache_table();
    try {
        db()->prepare('INSERT INTO api_cache (k, v, updated_at) VALUES (?,?,NOW())
                       ON DUPLICATE KEY UPDATE v = VALUES(v), updated_at = NOW()')
            ->execute([mb_substr($key, 0, 190), $json]);
    } catch (Throwable $e) { /* gagal cache tidak fatal */ }
}

/** Waktu (UNIX) cache terakhir diperbarui untuk path, atau 0 bila belum ada. */
function api_cache_time(string $key): int {
    ensure_api_cache_table();
    try {
        $st = db()->prepare('SELECT UNIX_TIMESTAMP(updated_at) FROM api_cache WHERE k = ? LIMIT 1');
        $st->execute([$key]);
        $t = $st->fetchColumn();
    } catch (Throwable $e) { return 0; }
    return $t === false ? 0 : (int)$t;
}

// ── Migrasi ringan: tabel keamanan (rate-limit login) ────────────────────────
function ensure_security_tables(): void {
    static $done = false;
    if ($done) return;
    $done = true;
    try {
        db()->exec("CREATE TABLE IF NOT EXISTS login_attempts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            ip VARCHAR(64) NOT NULL,
            email VARCHAR(190) NOT NULL DEFAULT '',
            ok TINYINT(1) NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            KEY idx_ip_time (ip, created_at),
            KEY idx_email_time (email, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    } catch (Throwable $e) { /* DB belum siap — biarkan, login tetap jalan tanpa throttle */ }
}

// ── Migrasi ringan: tabel rate-limit order publik (anti boom order) ──────────
function ensure_order_attempts_table(): void {
    static $done = false;
    if ($done) return;
    $done = true;
    try {
        db()->exec("CREATE TABLE IF NOT EXISTS order_attempts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            ip VARCHAR(64) NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            KEY idx_ip_time (ip, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    } catch (Throwable $e) { /* tanpa DB, throttle order dilewati */ }
}

// ── Migrasi ringan: pastikan kolom SEO ada (untuk DB lama) ───────────────────
function ensure_article_columns(): void {
    static $done = false;
    if ($done) return;
    $done = true;
    try {
        $cols = [];
        foreach (db()->query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'articles'") as $r) {
            $cols[strtolower($r['COLUMN_NAME'])] = true;
        }
        $add = [];
        if (!isset($cols['seo_keyword']))      $add[] = "ADD COLUMN seo_keyword VARCHAR(120) NULL";
        if (!isset($cols['meta_title']))       $add[] = "ADD COLUMN meta_title VARCHAR(200) NULL";
        if (!isset($cols['meta_description'])) $add[] = "ADD COLUMN meta_description VARCHAR(300) NULL";
        if (!isset($cols['seo_score']))        $add[] = "ADD COLUMN seo_score TINYINT NOT NULL DEFAULT 0";
        if (!isset($cols['scheduled_at']))     $add[] = "ADD COLUMN scheduled_at DATETIME NULL";
        if ($add) db()->exec('ALTER TABLE articles ' . implode(', ', $add));
    } catch (Throwable $e) { /* abaikan, biar tak memblok halaman */ }
}

/**
 * Terbitkan artikel terjadwal yang waktunya sudah tiba (auto-publish).
 * Dipanggil saat ada kunjungan (lazy) — tak butuh cron. Bisa juga lewat cron.php.
 */
function publish_due_articles(): int {
    try {
        $st = db()->prepare("UPDATE articles SET status='PUBLISHED', published_at=COALESCE(published_at, scheduled_at), scheduled_at=NULL WHERE status='SCHEDULED' AND scheduled_at IS NOT NULL AND scheduled_at <= NOW()");
        $st->execute();
        return $st->rowCount();
    } catch (Throwable $e) { return 0; }
}

// ── Upload gambar (disimpan di folder uploads/ milik toko) ───────────────────
function uploads_dir(): string {
    $dir = __DIR__ . '/uploads';
    if (!is_dir($dir)) @mkdir($dir, 0775, true);
    // Defense-in-depth (Apache): folder upload hanya boleh file statis —
    // tolak eksekusi skrip walau ada file aneh yang lolos masuk.
    $ht = $dir . '/.htaccess';
    if (!is_file($ht)) {
        @file_put_contents($ht, "<FilesMatch \"\\.(php|phar|phtml|php[0-9]|pl|py|cgi|sh)$\">\nRequire all denied\n</FilesMatch>\n");
    }
    return $dir;
}

/**
 * Simpan file gambar yang diupload. Return URL relatif (/uploads/xxx) atau null.
 * $file = elemen dari $_FILES.
 */
function save_upload(array $file): ?string {
    if (empty($file['tmp_name']) || ($file['error'] ?? 1) !== UPLOAD_ERR_OK) return null;
    $info = @getimagesize($file['tmp_name']);
    if ($info === false) return null; // bukan gambar valid
    $ext = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/gif' => 'gif', 'image/webp' => 'webp'][$info['mime']] ?? null;
    if (!$ext) return null;
    if (($file['size'] ?? 0) > 40 * 1024 * 1024) return null; // maks 40MB (foto HP modern; dikompres setelahnya)
    $name = 'img_' . bin2hex(random_bytes(12)) . '.' . $ext;
    $dest = uploads_dir() . '/' . $name;
    if (!move_uploaded_file($file['tmp_name'], $dest)) return null;
    compress_uploaded_image($dest, $info['mime']);
    return 'uploads/' . $name; // relatif terhadap root aplikasi toko (/toko/)
}

/**
 * Kompres gambar in-place via GD: sisi terpanjang maks 1920px, JPEG/WebP q82,
 * PNG level 9 (transparansi dipertahankan). GIF dilewati (bisa beranimasi).
 * Gagal kompres = file asli tetap dipakai (tidak fatal).
 */
function compress_uploaded_image(string $path, string $mime, int $maxDim = 1920, int $quality = 82): void {
    if ($mime === 'image/gif' || !function_exists('imagecreatetruecolor')) return;
    try {
        // Foto HP modern bisa 100-200MP — GD butuh ±5 byte/piksel saat dekode.
        // Naikkan memory_limit seperlunya; di atas ~3GB lewati (file asli dipakai).
        $dim = @getimagesize($path);
        if ($dim) {
            $need = (int)($dim[0] * $dim[1] * 5 * 1.6) + 96 * 1024 * 1024;
            if ($need > 3 * 1024 * 1024 * 1024) return;
            $cur = trim((string)ini_get('memory_limit'));
            $unit = strtoupper(substr($cur, -1));
            $curBytes = $cur === '-1' ? PHP_INT_MAX
                : (float)$cur * ($unit === 'G' ? 1073741824 : ($unit === 'M' ? 1048576 : ($unit === 'K' ? 1024 : 1)));
            if ($need > $curBytes) @ini_set('memory_limit', (string)(int)ceil($need / 1048576) . 'M');
        }
        $src = match ($mime) {
            'image/jpeg' => @imagecreatefromjpeg($path),
            'image/png'  => @imagecreatefrompng($path),
            'image/webp' => @imagecreatefromwebp($path),
            default      => null,
        };
        if (!$src) return;
        $w = imagesx($src); $h = imagesy($src);
        $scale = min(1, $maxDim / max($w, $h));
        $nw = max(1, (int)round($w * $scale)); $nh = max(1, (int)round($h * $scale));
        if ($scale < 1) {
            $dst = imagecreatetruecolor($nw, $nh);
            if ($mime === 'image/png' || $mime === 'image/webp') {
                imagealphablending($dst, false);
                imagesavealpha($dst, true);
            }
            imagecopyresampled($dst, $src, 0, 0, 0, 0, $nw, $nh, $w, $h);
            imagedestroy($src);
            $src = $dst;
        }
        $tmp = $path . '.tmp';
        $ok = match ($mime) {
            'image/jpeg' => imagejpeg($src, $tmp, $quality),
            'image/png'  => imagepng($src, $tmp, 9),
            'image/webp' => imagewebp($src, $tmp, $quality),
            default      => false,
        };
        imagedestroy($src);
        // pakai hasil kompres hanya bila valid DAN lebih kecil dari aslinya
        if ($ok && filesize($tmp) > 0 && filesize($tmp) < filesize($path)) {
            @rename($tmp, $path);
        } else {
            @unlink($tmp);
        }
    } catch (Throwable $e) { /* biarkan file asli */ }
}
