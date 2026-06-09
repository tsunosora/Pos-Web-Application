<?php
require_once __DIR__ . '/config.php';

// ── Helper API ──────────────────────────────────────────────────────────────
function api_get(string $path) {
    $ctx = stream_context_create(['http' => ['timeout' => 8, 'ignore_errors' => true]]);
    $res = @file_get_contents(API_BASE . $path, false, $ctx);
    if ($res === false) return null;
    return json_decode($res, true);
}

function api_post(string $path, array $data) {
    $payload = json_encode($data);
    $ctx = stream_context_create(['http' => [
        'method'        => 'POST',
        'header'        => "Content-Type: application/json\r\nContent-Length: " . strlen($payload) . "\r\n",
        'content'       => $payload,
        'timeout'       => 10,
        'ignore_errors' => true,
    ]]);
    $res = @file_get_contents(API_BASE . $path, false, $ctx);
    if ($res === false) return null;
    return json_decode($res, true);
}

// ── Helper umum ─────────────────────────────────────────────────────────────
function h($s): string { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }
function rupiah($n): string { return 'Rp ' . number_format((float)$n, 0, ',', '.'); }

function img_url(?string $u): string {
    if (!$u) return '';
    if (preg_match('/^https?:/i', $u)) return $u;
    return API_BASE . $u;
}

function product_price(array $p): float {
    $min = null;
    foreach (($p['variants'] ?? []) as $v) {
        $pr = (float)($v['price'] ?? 0);
        if ($pr > 0 && ($min === null || $pr < $min)) $min = $pr;
    }
    return $min !== null ? $min : (float)($p['price'] ?? 0);
}

function product_image(array $p): string {
    if (!empty($p['imageUrl'])) return img_url($p['imageUrl']);
    foreach (($p['variants'] ?? []) as $v) {
        if (!empty($v['imageUrl'])) return img_url($v['imageUrl']);
    }
    return '';
}

function settings(): array {
    static $s = null;
    if ($s === null) $s = api_get('/settings/public') ?: [];
    return $s;
}

function cart(): array { return $_SESSION['cart'] ?? []; }
function cart_count(): int {
    $c = 0;
    foreach (cart() as $it) $c += (int)$it['quantity'];
    return $c;
}
function cart_total(): float {
    $t = 0;
    foreach (cart() as $it) $t += (float)$it['unitPrice'] * (int)$it['quantity'];
    return $t;
}
