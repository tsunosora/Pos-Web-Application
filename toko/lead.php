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

$name   = trim($_POST['name'] ?? '');
$phone  = trim($_POST['phone'] ?? '');
$note   = trim($_POST['note'] ?? '');
$branch = trim($_POST['branch'] ?? '');

if ($name === '' || $note === '') { $go('?lead=err'); exit; }
if (mb_strlen($name) > 120) $name = mb_substr($name, 0, 120);
if (mb_strlen($note) > 2000) $note = mb_substr($note, 0, 2000);

$noteParts = ['[Order Cepat — form website]'];
if ($branch !== '') $noteParts[] = 'Cabang: ' . $branch;
$noteParts[] = $note;

$res = api_post('/orders/public', [
    'name'  => $name,
    'phone' => $phone,
    'note'  => implode("\n", $noteParts),
]);

if ($res && !empty($res['ok'])) {
    $_SESSION['lead_last_submit'] = time();
    $go('?lead=ok&n=' . rawurlencode(mb_substr($name, 0, 40)));
} else {
    $go('?lead=err');
}
exit;
