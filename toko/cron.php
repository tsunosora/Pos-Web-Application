<?php
// Endpoint untuk auto-publish artikel terjadwal — panggil via cron hosting, mis:
//   * * * * * curl -s "https://tokokamu.com/cron.php?key=RAHASIA" >/dev/null
// Atau biarkan saja: artikel tetap auto-terbit saat ada kunjungan (lazy publish).
require_once __DIR__ . '/lib.php';
header('Content-Type: application/json');

// Proteksi opsional: kalau setelan `cron_key` diisi, wajib cocok.
$key = cfg('cron_key', '');
if ($key !== '' && ($_GET['key'] ?? '') !== $key) {
    http_response_code(403);
    echo json_encode(['error' => 'forbidden']);
    exit;
}

$n = publish_due_articles();
echo json_encode(['ok' => true, 'published' => $n, 'time' => date('c')]);
