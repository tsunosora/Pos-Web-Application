<?php
// ── Konfigurasi Storefront PHP ──────────────────────────────────────────────
// URL backend PosPro (API). Atur lewat env POSPRO_API atau ubah default di sini.
// Contoh produksi: https://api.tokokamu.com
define('API_BASE', rtrim(getenv('POSPRO_API') ?: 'http://localhost:3001', '/'));

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
