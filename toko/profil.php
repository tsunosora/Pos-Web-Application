<?php
require_once __DIR__ . '/lib.php';
require_once __DIR__ . '/sections.php';

$st = settings();
$seo_title = 'Tentang Kami — ' . ($st['storeName'] ?? 'Toko');
$seo_desc  = meta_desc('Mengenal ' . ($st['storeName'] ?? 'kami') . ', percetakan digital di Bantul, Yogyakarta. Layanan lengkap, kualitas terjaga, alur produksi terkontrol, kirim ke seluruh Indonesia.');
include __DIR__ . '/header.php';

$c = site_content('profil');
$kontak = site_content('kontak');

// Hero statement
sec_page_hero('Profil Perusahaan', $c['heroTitle'] ?? '', $c['heroAccent'] ?? '', $c['heroSubtitle'] ?? '');

// Siapa kami — teks + gambar (opsional) + poin
$items = parse_items($c['list'] ?? '');
$img = trim($c['image'] ?? '');
?>
<section class="co-sec" data-reveal>
    <div class="grid md:grid-cols-2 gap-10 lg:gap-16 items-center">
        <?php if ($img): ?><img src="<?= h($img) ?>" alt="<?= h($st['storeName'] ?? '') ?>" loading="lazy" class="w-full rounded-2xl aspect-[4/3] object-cover border border-slate-200" data-reveal-item><?php endif; ?>
        <div class="<?= $img ? '' : 'md:col-span-2 max-w-3xl' ?>" data-reveal-item>
            <span class="co-kicker">Tentang Kami</span>
            <h2 class="co-h2"><?= h($c['title'] ?? 'Siapa Kami') ?></h2>
            <?php if (!empty($c['text'])): ?><p class="co-sub !max-w-none mt-4"><?= h($c['text']) ?></p><?php endif; ?>
            <?php if ($items): ?>
                <ul class="mt-7 space-y-3">
                    <?php foreach ($items as $it): ?>
                        <li class="flex items-start gap-3 text-slate-700 text-sm"><span class="co-dot !mt-[7px]"></span><span><?= h($it[0]) ?></span></li>
                    <?php endforeach; ?>
                </ul>
            <?php endif; ?>
        </div>
    </div>
</section>
<?php

// Nilai perusahaan — grid hairline
$nilai = parse_items($c['nilai'] ?? '');
if ($nilai): ?>
<section class="co-sec" data-reveal>
    <?= co_head('Nilai Kami', 'Cara Kami Bekerja') ?>
    <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-slate-200 border border-slate-200 rounded-2xl overflow-hidden">
        <?php foreach ($nilai as $i => $it): ?>
            <div class="bg-white p-7" data-reveal-item>
                <span class="co-svc-num">0<?= $i + 1 ?></span>
                <h3 class="font-head font-extrabold text-slate-900 text-lg mt-3"><?= h($it[0]) ?></h3>
                <?php if (!empty($it[1])): ?><p class="mt-2 text-sm text-slate-500 leading-relaxed"><?= h($it[1]) ?></p><?php endif; ?>
            </div>
        <?php endforeach; ?>
    </div>
</section>
<?php endif;

sec_statistik();
sec_video();
sec_testimoni();
sec_kontak();
sec_cta();

include __DIR__ . '/footer.php';
