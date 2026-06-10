<?php
// ── Konfigurasi Toko (aplikasi mandiri) ─────────────────────────────────────
// Toko ini punya DB + domain sendiri (hosting terpisah dari server PosPro).
// Atur lewat environment variable, atau ubah default di bawah saat deploy.

// Database (MySQL/MariaDB) — DB milik toko sendiri
define('DB_HOST', getenv('TOKO_DB_HOST') ?: '127.0.0.1');
define('DB_PORT', getenv('TOKO_DB_PORT') ?: '3306');
define('DB_NAME', getenv('TOKO_DB_NAME') ?: 'toko');
define('DB_USER', getenv('TOKO_DB_USER') ?: 'root');
define('DB_PASS', getenv('TOKO_DB_PASS') ?: '');

// Kunci aplikasi untuk enkripsi data sensitif (mis. password service PosPro).
// WAJIB diganti string acak panjang saat deploy produksi.
define('APP_KEY', getenv('TOKO_APP_KEY') ?: 'ganti-kunci-ini-saat-produksi');

// URL backend PosPro default (fallback sebelum dikonfigurasi via dashboard).
define('API_BASE', rtrim(getenv('POSPRO_API') ?: 'http://localhost:3001', '/'));

// Warna brand (dipakai Tailwind di layout).
define('BRAND_COLOR', getenv('TOKO_BRAND') ?: '#6366f1');

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
