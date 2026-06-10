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
    if (($file['size'] ?? 0) > 8 * 1024 * 1024) return null; // maks 8MB
    $name = 'img_' . bin2hex(random_bytes(12)) . '.' . $ext;
    if (!move_uploaded_file($file['tmp_name'], uploads_dir() . '/' . $name)) return null;
    return 'uploads/' . $name; // relatif terhadap root aplikasi toko (/toko/)
}
