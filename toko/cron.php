<?php
// Endpoint untuk auto-publish artikel terjadwal — panggil via cron hosting, mis:
//   * * * * * curl -s "https://tokokamu.com/cron.php?key=RAHASIA" >/dev/null
// Atau biarkan saja: artikel tetap auto-terbit saat ada kunjungan (lazy publish).
require_once __DIR__ . '/lib.php';
header('Content-Type: application/json');

// Proteksi opsional: kalau setelan `cron_key` diisi, wajib cocok.
$key = cfg('cron_key', '');
if ($key !== '' && !hash_equals($key, (string)($_GET['key'] ?? ''))) {
    http_response_code(403);
    echo json_encode(['error' => 'forbidden']);
    exit;
}

$n = publish_due_articles();

// Mirror gambar PosPro ke hosting (batch besar) agar toko 100% tahan-mati,
// termasuk gambar. Aman dipanggil berulang — hanya unduh yang belum ada.
$img = 0;
foreach (['/products/public', '/settings/public', '/company-branches/public-active'] as $p) {
    $d = api_get($p);
    if (is_array($d)) $img += mirror_scan($d, 80 - $img);
    if ($img >= 80) break;
}

echo json_encode(['ok' => true, 'published' => $n, 'mirrored_images' => $img, 'time' => date('c')]);
