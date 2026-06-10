<?php
require_once __DIR__ . '/lib.php';
require_once __DIR__ . '/home_blocks.php';

$st = settings();
$seo_title = 'Tentang Kami — ' . ($st['storeName'] ?? 'Toko');
$seo_desc  = meta_desc('Mengenal ' . ($st['storeName'] ?? 'kami') . ', percetakan & sablon sejak 2018. Layanan lengkap, kualitas terjaga, pelayanan ramah, antar/kirim seluruh Indonesia.');
include __DIR__ . '/header.php';

$products = public_products();
$cats = [];
foreach ($products as $p) {
    $c = $p['category'] ?? null;
    if ($c && !isset($cats[$c['id']])) $cats[$c['id']] = $c['name'];
}
$ctx = ['products' => $products, 'cats' => $cats, 'st' => settings()];

foreach (page_layout('profil') as $block) {
    echo render_home_block($block, $ctx);
}
?>
<?php include __DIR__ . '/footer.php'; ?>
