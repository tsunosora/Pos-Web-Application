<?php
require_once __DIR__ . '/lib.php';
require_once __DIR__ . '/home_blocks.php';

$st = settings();
$seo_title = 'Portofolio — ' . ($st['storeName'] ?? 'Toko');
$seo_desc  = meta_desc('Lihat portofolio & galeri hasil karya ' . ($st['storeName'] ?? 'kami') . ': label, buku, souvenir, merchandise, dan cetakan lainnya. Bukti kualitas, bukan sekadar janji.');
include __DIR__ . '/header.php';

$products = public_products();
$cats = [];
foreach ($products as $p) {
    $c = $p['category'] ?? null;
    if ($c && !isset($cats[$c['id']])) $cats[$c['id']] = $c['name'];
}
$ctx = ['products' => $products, 'cats' => $cats, 'st' => $st];

foreach (page_layout('portofolio') as $block) {
    echo render_home_block($block, $ctx);
}
?>
<?php include __DIR__ . '/footer.php'; ?>
