<?php
// Endpoint upload gambar untuk editor artikel (AJAX). Admin only. Return JSON {url}.
require_once __DIR__ . '/lib.php';
header('Content-Type: application/json');

if (!is_admin()) { http_response_code(401); echo json_encode(['error' => 'unauthorized']); exit; }
require_csrf(); // token via header X-CSRF-Token (dikirim editor artikel)
if ($_SERVER['REQUEST_METHOD'] !== 'POST' || empty($_FILES['image'])) {
    http_response_code(400); echo json_encode(['error' => 'no file']); exit;
}
$url = save_upload($_FILES['image']);
if (!$url) { http_response_code(422); echo json_encode(['error' => 'invalid image']); exit; }
echo json_encode(['url' => $url]);
