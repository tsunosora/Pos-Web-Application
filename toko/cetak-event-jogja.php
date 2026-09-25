<?php
// Landing SEO: "Cetak Banner Event Jogja" / "Digital Printing EO" / order mendesak.
// URL bersih: /cetak-banner-event-jogja (lihat .htaccess). URL lama situs WordPress
// "digital-printing-jogja-24-jam" di-301 ke sini — kami TIDAK buka 24 jam, jadi
// halaman ini jujur menjelaskan layanan order mendesak di luar jam operasional.
require_once __DIR__ . '/lib.php';
require_once __DIR__ . '/sections.php';

$st = settings();
$wa = store_wa();
$seo_title = 'Cetak Banner Event Jogja & Vendor Cetak EO — ' . ($st['storeName'] ?? 'Toko');
$seo_desc  = meta_desc('Cetak banner event Jogja untuk EO & vendor acara: backdrop, X-banner, roll-up, ID card, stiker. Siap order mendesak menjelang event, termasuk malam hari. Bantul, Yogyakarta.');
$seo_canonical = abs_url('cetak-banner-event-jogja');

$faqs = [
    ['Apakah bisa cetak banner mendadak untuk event malam ini?',
     'Bisa diusahakan. Hubungi WhatsApp kami secepatnya dengan ukuran, jumlah, dan file desain. Di luar jam operasional, pengerjaan order mendesak dilakukan sesuai kesepakatan dan ketersediaan tim.'],
    ['Apakah Voliko Print buka 24 jam?',
     'Tidak. Jam operasional Senin–Sabtu 08.00–21.00 (Pusat Imogiri) dan 08.00–16.00 (Cabang Sewon), Minggu tutup. Namun untuk kebutuhan event yang mendesak, kami siap dihubungi dan mengusahakan pengerjaan di luar jam tersebut.'],
    ['Apa saja yang bisa dicetak untuk kebutuhan event?',
     'Backdrop dan banner panggung, spanduk, X-banner, roll-up banner, standing banner, event desk, ID card & lanyard panitia, stiker, tentcard, sertifikat, hingga merchandise seperti kaos DTF, mug, dan tumbler.'],
    ['Apakah melayani EO dan vendor event dengan order rutin?',
     'Ya. Kami terbiasa bekerja dengan EO, panitia kampus, instansi, dan vendor pameran — dari satu banner hingga paket materi booth lengkap.'],
    ['Bagaimana cara mengirim file desain?',
     'Kirim file via WhatsApp atau link Google Drive. Format yang disarankan PDF, AI, CDR, atau JPG/PNG resolusi tinggi sesuai ukuran cetak. Belum punya desain? Tim kami bisa membantu.'],
];
$seo_jsonld_extra = [seo_faq_jsonld($faqs), [
    '@context' => 'https://schema.org', '@type' => 'Service',
    'name' => 'Cetak Banner Event Jogja', 'serviceType' => 'Digital printing untuk event & EO',
    'provider' => ['@id' => base_url() . '#org'], 'areaServed' => 'Daerah Istimewa Yogyakarta',
    'url' => $seo_canonical,
]];
include __DIR__ . '/header.php';

sec_page_hero('Cetak Event Jogja', 'Cetak Banner Event Jogja, Siap Order Mendesak', 'Siap Order Mendesak',
    'Vendor cetak untuk EO, panitia, dan pameran di Yogyakarta — backdrop, banner, X-banner, ID card, hingga merchandise. Menjelang acara dan butuh cepat? Kami siap dihubungi, termasuk untuk event malam hari.');

$items = [
    ['Backdrop & banner panggung', 'Flexi/albatros ukuran besar, warna tajam untuk foto dokumentasi.', 'product.php?id=6'],
    ['X-banner & roll-up banner', 'Paket lengkap dengan rangka, siap pasang di venue.', 'product.php?id=143'],
    ['Standing banner & event desk', 'Media promosi booth dan meja registrasi.', 'product.php?id=77'],
    ['ID card & lanyard panitia', 'PVC tebal, bisa satuan atau ratusan pcs.', 'product.php?id=84'],
    ['Stiker & tentcard', 'Label, nomor meja, penanda area, stiker outdoor.', 'product.php?id=190'],
    ['Merchandise event', 'Kaos DTF panitia, mug, tumbler, plakat & medali akrilik.', 'product.php?id=71'],
];
?>
<section class="co-sec" data-reveal>
    <?= co_head('Kebutuhan Event', 'Apa yang Bisa Kami Cetak untuk Acara Anda', 'Satu vendor untuk seluruh materi cetak event — mengurangi koordinasi dan risiko telat.') ?>
    <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-slate-200 border border-slate-200 rounded-2xl overflow-hidden">
        <?php foreach ($items as $i => [$t, $d, $href]): ?>
            <a href="<?= h($href) ?>" class="bg-white p-7 hover:bg-slate-50 transition-colors" data-reveal-item>
                <span class="co-svc-num">0<?= $i + 1 ?></span>
                <h3 class="font-head font-extrabold text-slate-900 text-lg mt-3"><?= h($t) ?></h3>
                <p class="mt-2 text-sm text-slate-500 leading-relaxed"><?= h($d) ?></p>
            </a>
        <?php endforeach; ?>
    </div>
</section>

<section class="co-sec" data-reveal>
    <div class="grid lg:grid-cols-2 gap-10 items-start">
        <div>
            <span class="co-kicker">Order Mendesak</span>
            <h2 class="co-h2">Event Besok atau Malam Ini? Begini Cara Order Cepat</h2>
            <ol class="mt-6 space-y-4 text-slate-600">
                <li><strong class="text-slate-900">1. Chat WhatsApp</strong> — sebutkan jenis cetak, ukuran, jumlah, dan jam acara.</li>
                <li><strong class="text-slate-900">2. Kirim file desain</strong> — via WhatsApp atau link Google Drive. Belum ada desain? Kami bantu.</li>
                <li><strong class="text-slate-900">3. Konfirmasi harga &amp; jam jadi</strong> — kami sampaikan estimasi yang realistis sebelum produksi.</li>
                <li><strong class="text-slate-900">4. Produksi &amp; ambil</strong> — ambil di Imogiri atau Sewon, atau atur pengantaran ke venue di Jogja.</li>
            </ol>
            <p class="mt-6 text-sm text-slate-500">Jam operasional: Senin–Sabtu 08.00–21.00 (Pusat Imogiri), 08.00–16.00 (Cabang Sewon), Minggu tutup. Order mendesak di luar jam tersebut dikerjakan sesuai kesepakatan.</p>
            <?php if ($wa): ?><a href="https://wa.me/<?= h($wa) ?>?text=<?= rawurlencode('Halo Voliko, saya butuh cetak untuk event (mendesak):') ?>" target="_blank" rel="noopener" class="btn-pill btn-pill--accent mt-7 text-sm">Chat WhatsApp sekarang</a><?php endif; ?>
        </div>
        <div class="divide-y divide-slate-200 border-y border-slate-200">
            <?php foreach ($faqs as [$q, $a]): ?>
                <details class="group py-5" data-reveal-item>
                    <summary class="flex items-center justify-between cursor-pointer font-semibold text-slate-900 list-none gap-4">
                        <h3 class="text-base font-semibold"><?= h($q) ?></h3>
                        <span class="co-faq-ico shrink-0"><svg class="w-4 h-4 group-open:rotate-45 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg></span>
                    </summary>
                    <p class="mt-3 text-slate-500 text-sm leading-relaxed max-w-2xl"><?= h($a) ?></p>
                </details>
            <?php endforeach; ?>
        </div>
    </div>
</section>
<?php
sec_portofolio(['limit' => 8]);
sec_order();
sec_kontak();

include __DIR__ . '/footer.php';
