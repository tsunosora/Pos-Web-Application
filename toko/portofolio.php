<?php
require_once __DIR__ . '/lib.php';
require_once __DIR__ . '/sections.php';

$st = settings();
$seo_title = 'Portofolio — ' . ($st['storeName'] ?? 'Toko');
$seo_desc  = meta_desc('Lihat portofolio & galeri hasil karya ' . ($st['storeName'] ?? 'kami') . ': label, banner, signage, merchandise, dan cetakan lainnya. Bukti kualitas, bukan sekadar janji.');
include __DIR__ . '/header.php';

$c = site_content('portofolio_page');

sec_page_hero('Portofolio', $c['heroTitle'] ?? '', $c['heroAccent'] ?? '', $c['heroSubtitle'] ?? '');
sec_portofolio(['force' => true, 'noMore' => true]); // galeri penuh, tanpa batas
sec_statistik();
sec_klien();
sec_testimoni();
sec_cta();

include __DIR__ . '/footer.php';
