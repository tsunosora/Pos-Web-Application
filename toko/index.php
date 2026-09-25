<?php
require_once __DIR__ . '/lib.php';
require_once __DIR__ . '/sections.php';

$st = settings();
// Kata kunci utama di depan title: "Digital Printing Jogja", lalu "Percetakan" & "Cetak Cepat".
$seo_title = 'Digital Printing Jogja & Percetakan Cepat — ' . ($st['storeName'] ?? 'Toko');
$seo_desc  = meta_desc('Digital printing Jogja: cetak cepat banner, spanduk, X-banner, stiker, DTF & cutting laser. Vendor cetak event & EO, siap order mendesak. 2 cabang di Bantul.');
$seo_jsonld_extra = [seo_faq_jsonld(home_faqs())];
$seo_canonical = base_url();
include __DIR__ . '/header.php';

$products = public_products();

// Beranda gaya "PrintKreatif" (glass + biru) menampilkan SELURUH konten yang
// sudah diisi di DB (logo klien, testimoni, portofolio, artikel, dll).
// Isi tiap section diatur lewat Dashboard → Konten.
sec_hero();                    // hero kaca (foto + statistik)
sec_categories($products);     // grid kategori (kartu kaca + ikon gradient)
sec_products_grid($products);  // grid best-seller (kartu gaya referensi)
// sec_services() dihapus dari beranda — value-props sudah ada di strip trust hero
sec_tentang();                 // tentang kami (band kaca)
sec_portofolio(['limit' => 8]);// karya kami (galeri + lightbox)
sec_statistik();               // angka pencapaian
sec_testimoni();               // testimoni pelanggan
sec_klien();                   // logo klien (marquee)
sec_seo_jogja();               // konten SEO lokal + FAQ (FAQPage)
sec_order();                   // form konsultasi → CRM (anchor #order-cepat)
sec_artikel();                 // wawasan & panduan (blog)
sec_cta();                     // ajakan penutup
sec_popup();                   // popup promo (jika aktif)

include __DIR__ . '/footer.php';
