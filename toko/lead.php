<?php
// Endpoint form "Order Last-Minute" (PRD §5.6).
// Submit → POST /orders/public PosPro → tercatat sebagai Lead WEBSITE di CRM
// (notif Discord "Lead baru" otomatis dari backend). Tanpa items (lead murni).
// Proteksi spam: honeypot field + rate limit per sesi (tanpa CAPTCHA).
require_once __DIR__ . '/lib.php';

// Halaman builder yang valid sebagai tujuan redirect (anti open-redirect)
$allowedBack = ['index.php', 'profil.php', 'portofolio.php'];
$back = basename($_POST['back'] ?? 'index.php');
if (!in_array($back, $allowedBack, true)) $back = 'index.php';
$go = fn(string $qs) => header('Location: ' . $back . $qs . '#order-cepat');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') { header('Location: index.php'); exit; }

// Honeypot: manusia tidak mengisi field tersembunyi "website"
if (trim($_POST['website'] ?? '') !== '') { $go('?lead=ok'); exit; } // diam-diam buang bot

// Rate limit: 1 kiriman per 60 detik per sesi
if (session_status() !== PHP_SESSION_ACTIVE) session_start();
$last = (int)($_SESSION['lead_last_submit'] ?? 0);
if (time() - $last < 60) { $go('?lead=err'); exit; }

// Rate limit per-IP (lintas sesi, tahan bot yang tak bawa cookie): 3/menit, 12/jam, 30/hari
if (order_throttled() > 0) { $go('?lead=err'); exit; }

$name     = trim($_POST['name'] ?? '');
$phone    = trim($_POST['phone'] ?? '');
$note     = trim($_POST['note'] ?? '');
$branchId = (int)($_POST['branchId'] ?? 0);

if ($name === '' || $note === '') { $go('?lead=err'); exit; }
// Konten spam judol/link → pura-pura sukses, tidak dikirim ke CRM.
if (looks_like_spam($name, $note)) { $go('?lead=ok'); exit; }
if (mb_strlen($name) > 120) $name = mb_substr($name, 0, 120);
if (mb_strlen($note) > 2000) $note = mb_substr($note, 0, 2000);

$noteParts = ['[Order Cepat — form website]', $note];

$payload = [
    'name'  => $name,
    'phone' => $phone,
    'note'  => implode("\n", $noteParts),
];
// Cabang/lokasi cetak pilihan customer (divalidasi ulang di backend)
if ($branchId > 0) $payload['branchId'] = $branchId;

$res = api_post('/orders/public', $payload);

if ($res && !empty($res['ok'])) {
    $_SESSION['lead_last_submit'] = time();
    record_order_attempt();
    $go('?lead=ok&n=' . rawurlencode(mb_substr($name, 0, 40)));
} else {
    $go('?lead=err');
}
exit;
