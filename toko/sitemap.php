<?php
require_once __DIR__ . '/lib.php';
header('Content-Type: application/xml; charset=utf-8');

$urls = [];
$add = function (string $loc, string $freq = 'weekly', string $pri = '0.7', ?string $lastmod = null) use (&$urls) {
    $urls[] = ['loc' => $loc, 'freq' => $freq, 'pri' => $pri, 'lastmod' => $lastmod];
};

$add(abs_url('index.php'),  'daily',   '1.0');
$add(abs_url('produk.php'), 'daily',   '0.9');
$add(abs_url('profil.php'), 'monthly', '0.5');
$add(abs_url('portofolio.php'), 'monthly', '0.6');
$add(abs_url('artikel.php'),'weekly',  '0.6');

// Produk dari katalog PosPro
foreach (public_products() as $p) {
    if (!empty($p['id'])) $add(abs_url('product.php?id=' . (int)$p['id']), 'weekly', '0.8');
}
// Artikel terbit
try {
    foreach (db()->query("SELECT slug, COALESCE(published_at, updated_at) lm FROM articles WHERE status='PUBLISHED'") as $a) {
        $add(abs_url('artikel.php?slug=' . urlencode($a['slug'])), 'monthly', '0.6', $a['lm']);
    }
} catch (Throwable $e) { /* DB belum siap */ }

echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
foreach ($urls as $u) {
    echo '  <url><loc>' . h($u['loc']) . '</loc>';
    if ($u['lastmod']) echo '<lastmod>' . h(date('Y-m-d', strtotime($u['lastmod']))) . '</lastmod>';
    echo '<changefreq>' . $u['freq'] . '</changefreq><priority>' . $u['pri'] . '</priority></url>' . "\n";
}
echo '</urlset>';
