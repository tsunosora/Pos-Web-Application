<?php
require_once __DIR__ . '/lib.php';
require_once __DIR__ . '/home_blocks.php';

$st = settings();
$seo_title = ($st['storeName'] ?? 'Toko') . ' — Percetakan & Sablon, Pesan Online';
$seo_desc  = meta_desc('Cetak label, buku, souvenir & merchandise berkualitas. Tanpa minimal order, respon cepat, desain gratis. Pesan online di ' . ($st['storeName'] ?? 'toko kami') . '.');
$seo_canonical = base_url();
include __DIR__ . '/header.php';

$products = public_products();

// Kumpulkan kategori unik (untuk blok produk/kategori)
$cats = [];
foreach ($products as $p) {
    $c = $p['category'] ?? null;
    if ($c && !isset($cats[$c['id']])) $cats[$c['id']] = $c['name'];
}

$ctx = ['products' => $products, 'cats' => $cats, 'st' => settings()];

// Render beranda sesuai susunan blok yang diatur di dashboard (Tampilan)
foreach (home_layout() as $block) {
    echo render_home_block($block, $ctx);
}
?>
<?php include __DIR__ . '/footer.php'; ?>
