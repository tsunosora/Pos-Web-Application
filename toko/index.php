<?php
require_once __DIR__ . '/lib.php';
require_once __DIR__ . '/sections.php';

$st = settings();
$seo_title = ($st['storeName'] ?? 'Toko') . ' — Percetakan Digital Bantul, Yogyakarta: Banner, Stiker, DTF & Cutting Laser';
$seo_desc  = meta_desc('Percetakan digital terpercaya di Bantul, Yogyakarta. Cetak banner, stiker meteran, UV roll, sablon DTF & cutting laser — kualitas konsisten, tepat waktu, bisa satuan. 2 cabang: Imogiri & Sewon.');
$seo_canonical = base_url();
include __DIR__ . '/header.php';

$products = public_products();

// Beranda gaya "PrintKreatif" (glass + biru) menampilkan SELURUH konten yang
// sudah diisi di DB (logo klien, testimoni, portofolio, artikel, dll).
// Isi tiap section diatur lewat Dashboard → Konten.
sec_hero();                    // hero kaca (foto + statistik)
sec_categories($products);     // grid kategori (kartu kaca + ikon gradient)
sec_products_grid($products);  // grid produk (harga biru + tombol Keranjang)
sec_services();                // 3 kartu keunggulan
sec_tentang();                 // tentang kami (band kaca)
sec_portofolio(['limit' => 8]);// karya kami (galeri + lightbox)
sec_statistik();               // angka pencapaian
sec_testimoni();               // testimoni pelanggan
sec_klien();                   // logo klien (marquee)
sec_order();                   // form konsultasi → CRM (anchor #order-cepat)
sec_artikel();                 // wawasan & panduan (blog)
sec_cta();                     // ajakan penutup
sec_popup();                   // popup promo (jika aktif)

include __DIR__ . '/footer.php';
