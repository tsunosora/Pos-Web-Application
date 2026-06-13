<?php
// ── Contoh config.local.php (per-server) ────────────────────────────────────
// Salin file ini jadi `config.local.php` di server hosting, lalu isi nilainya.
// File config.local.php TIDAK ikut git & dikecualikan dari auto-deploy,
// jadi kredensial tidak pernah tertimpa saat update kode.

// Database MySQL dari hPanel Hostinger (nama DB & user berprefix, mis. u123456789_toko)
define('DB_HOST', 'localhost');
define('DB_PORT', '3306');
define('DB_NAME', 'u123456789_toko');
define('DB_USER', 'u123456789_toko');
define('DB_PASS', 'password-db-kamu');

// WAJIB: string acak panjang (mis. hasil `openssl rand -hex 32`).
// Dipakai mengenkripsi password service PosPro di database.
define('APP_KEY', 'isi-string-acak-panjang-di-sini');

// Opsional: URL backend PosPro (bisa juga diatur lewat Dashboard → Setelan)
// define('API_BASE', 'https://api.domainkamu.com');

// Opsional: warna brand
// define('BRAND_COLOR', '#0EA5E9');
