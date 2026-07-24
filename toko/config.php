<?php
// ── Konfigurasi Toko (aplikasi mandiri) ─────────────────────────────────────
// Toko ini punya DB + domain sendiri (hosting terpisah dari server PosPro).
// Urutan prioritas: config.local.php (per-server, TIDAK ikut git/deploy)
// → environment variable → default di bawah.

// Override per-server: buat file config.local.php berisi define() yang mau
// diganti (DB_*, APP_KEY, dll). Aman dari tertimpa saat auto-deploy.
if (is_file(__DIR__ . '/config.local.php')) require __DIR__ . '/config.local.php';

// Database (MySQL/MariaDB) — DB milik toko sendiri
defined('DB_HOST') || define('DB_HOST', getenv('TOKO_DB_HOST') ?: '127.0.0.1');
defined('DB_PORT') || define('DB_PORT', getenv('TOKO_DB_PORT') ?: '3306');
defined('DB_NAME') || define('DB_NAME', getenv('TOKO_DB_NAME') ?: 'toko');
defined('DB_USER') || define('DB_USER', getenv('TOKO_DB_USER') ?: 'root');
defined('DB_PASS') || define('DB_PASS', getenv('TOKO_DB_PASS') ?: '');

// Kunci aplikasi untuk enkripsi data sensitif (mis. password service PosPro).
// WAJIB diganti string acak panjang saat deploy produksi.
defined('APP_KEY') || define('APP_KEY', getenv('TOKO_APP_KEY') ?: 'ganti-kunci-ini-saat-produksi');

// URL backend PosPro default (fallback sebelum dikonfigurasi via dashboard).
defined('API_BASE') || define('API_BASE', rtrim(getenv('POSPRO_API') ?: 'http://localhost:3001', '/'));

// Warna brand (dipakai Tailwind di layout) — BIRU solid clean modern (#2563EB),
// dipadu CTA hijau untuk aksi beli/order. Bisa dioverride via Dashboard → Tampilan.
defined('BRAND_COLOR') || define('BRAND_COLOR', getenv('TOKO_BRAND') ?: '#2563EB');

if (session_status() === PHP_SESSION_NONE) {
    // Cookie session aman: HttpOnly (tak bisa dibaca JS), SameSite=Lax (cookie
    // tidak ikut pada POST lintas situs → lapis anti-CSRF), Secure saat HTTPS,
    // strict mode (tolak session id buatan luar → anti session-fixation).
    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
    @ini_set('session.use_strict_mode', '1');
    @ini_set('session.use_only_cookies', '1');
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'secure'   => $secure,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}
