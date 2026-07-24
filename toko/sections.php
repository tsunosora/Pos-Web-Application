<?php
// ── Sections: desain tetap website (corporate editorial premium) ────────────
// Pengganti sistem blok. Setiap fungsi merender satu section; ISI diambil dari
// content_store (Dashboard → Konten). Desain tidak diatur dari admin — hanya isi.
require_once __DIR__ . '/content_store.php';
require_once __DIR__ . '/home_blocks.php'; // helper legacy: parse_items, hero_title_html, product_card_html

/** Judul dengan kata aksen ber-serif italic (display). */
function co_title_html(string $title, string $accent = ''): string {
    $safe = h($title);
    $acc = trim($accent);
    if ($acc !== '' && mb_stripos($title, $acc) !== false) {
        $sa = h($acc);
        $pos = mb_stripos($safe, $sa);
        if ($pos !== false) {
            return mb_substr($safe, 0, $pos)
                . '<em class="co-accent">' . mb_substr($safe, $pos, mb_strlen($sa)) . '</em>'
                . mb_substr($safe, $pos + mb_strlen($sa));
        }
    }
    return $safe;
}

/** Header section standar: kicker bergaris + judul + subjudul + link kanan. */
function co_head(string $kicker, string $title, string $subtitle = '', string $moreText = '', string $moreLink = ''): string {
    ob_start(); ?>
    <div class="co-head" data-reveal>
        <div>
            <?php if ($kicker !== ''): ?><span class="co-kicker"><?= h($kicker) ?></span><?php endif; ?>
            <h2 class="co-h2"><?= h($title) ?></h2>
            <?php if ($subtitle !== ''): ?><p class="co-sub"><?= h($subtitle) ?></p><?php endif; ?>
        </div>
        <?php if ($moreText !== ''): ?>
            <a href="<?= h($moreLink) ?>" class="co-more"><?= h($moreText) ?>
                <span class="co-more-ico"><svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 17L17 7M17 7H8m9 0v9"/></svg></span>
            </a>
        <?php endif; ?>
    </div>
    <?php return ob_get_clean();
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. HERO — layar penuh, ink, slider crossfade, panel gambar berbingkai
// ─────────────────────────────────────────────────────────────────────────────
function sec_hero(): void {
    $c = site_content('hero');
    if (empty($c['enabled'])) return;
    $slides = array_values(array_filter($c['slides'] ?? [], fn($s) => !empty($s['title'])));
    if (!$slides) return;
    $stats = array_slice(parse_items($c['stats'] ?? ''), 0, 3);
    $hs = settings();
    $wa = preg_replace('/^0/', '62', preg_replace('/\D/', '', $hs['storePhone'] ?? ''));
    ?>
    <section class="pk-herosplit" data-reveal>
        <div class="pk-hs-main">
            <div class="hero-swiper swiper" data-hero-swiper>
                <div class="swiper-wrapper">
                    <?php foreach ($slides as $s): $img = trim($s['image'] ?? ''); ?>
                        <div class="swiper-slide !h-auto">
                            <div class="pk-hs-slide">
                                <div class="pk-hs-copy">
                                    <?php if (!empty($c['kicker'])): ?><span class="pk-hs-kicker"><?= h($c['kicker']) ?></span><?php endif; ?>
                                    <h1 class="pk-hs-title"><?= co_title_html($s['title'], $s['accent'] ?? '') ?></h1>
                                    <?php if (!empty($s['subtitle'])): ?><p class="pk-hs-sub"><?= h($s['subtitle']) ?></p><?php endif; ?>
                                    <div class="pk-hs-actions">
                                        <?php if (!empty($s['btn1Text'])): ?><a href="<?= h($s['btn1Link'] ?: '#order-cepat') ?>" class="pk-hs-btn pk-hs-btn--cta"><?= h($s['btn1Text']) ?><svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.4"><path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg></a><?php endif; ?>
                                        <?php if (!empty($s['btn2Text'])): ?><a href="<?= h($s['btn2Link'] ?: 'produk.php') ?>" class="pk-hs-btn pk-hs-btn--ghost"><?= h($s['btn2Text']) ?></a><?php endif; ?>
                                    </div>
                                    <?php if ($stats): ?>
                                        <div class="pk-hs-stats">
                                            <?php foreach ($stats as $it): ?>
                                                <div class="pk-hs-stat"><b data-count="<?= h($it[0]) ?>"><?= h($it[0]) ?></b><span><?= h($it[1] ?? '') ?></span></div>
                                            <?php endforeach; ?>
                                        </div>
                                    <?php endif; ?>
                                </div>
                                <div class="pk-hs-media">
                                    <?php if ($img): ?>
                                        <img class="pk-hs-photo" src="<?= h($img) ?>" alt="<?= h($s['title']) ?>" onerror="this.style.display='none';var f=this.parentNode.querySelector('.pk-hs-fallback');if(f)f.style.display='grid';">
                                    <?php endif; ?>
                                    <div class="pk-hs-fallback" aria-hidden="true"<?= $img ? ' style="display:none"' : '' ?>>
                                        <div class="pk-hf-core">
                                            <?php if (!empty($hs['logoImageUrl'])): ?>
                                                <img src="<?= h(img_url($hs['logoImageUrl'])) ?>" alt="">
                                            <?php else: ?>
                                                <span class="pk-hf-init"><?= h(strtoupper(mb_substr($hs['storeName'] ?? 'T', 0, 1))) ?></span>
                                            <?php endif; ?>
                                            <span class="pk-hf-label">Percetakan Digital</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    <?php endforeach; ?>
                </div>
                <?php if (count($slides) > 1): ?>
                    <div class="swiper-pagination"></div>
                    <div class="pk-hs-swnav">
                        <button type="button" class="hero2-prev pk-arrow" aria-label="Slide sebelumnya"><svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.4"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg></button>
                        <button type="button" class="hero2-next pk-arrow" aria-label="Slide berikutnya"><svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.4"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg></button>
                    </div>
                <?php endif; ?>
            </div>
            <div class="pk-hs-trust">
                <div class="pk-hs-trust-item"><span class="pk-hs-trust-ico"><i class="fa-solid fa-bolt"></i></span><div><div class="pk-hs-trust-t">Pengerjaan Cepat</div><div class="pk-hs-trust-d">Bisa siap di hari yang sama</div></div></div>
                <div class="pk-hs-trust-item"><span class="pk-hs-trust-ico"><i class="fa-solid fa-tags"></i></span><div><div class="pk-hs-trust-t">Bisa Satuan</div><div class="pk-hs-trust-d">Tanpa minimal order</div></div></div>
                <div class="pk-hs-trust-item"><span class="pk-hs-trust-ico"><i class="fa-solid fa-pen-ruler"></i></span><div><div class="pk-hs-trust-t">Dibantu Desain</div><div class="pk-hs-trust-d">Konsultasi gratis</div></div></div>
                <div class="pk-hs-trust-item"><span class="pk-hs-trust-ico"><i class="fa-solid fa-shield-halved"></i></span><div><div class="pk-hs-trust-t">Kualitas Terjaga</div><div class="pk-hs-trust-d">Mesin &amp; bahan premium</div></div></div>
            </div>
        </div>
    </section>
    <?php
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. TICKER — strip layanan berjalan, hairline atas-bawah
// ─────────────────────────────────────────────────────────────────────────────
function sec_ticker(): void {
    $c = site_content('ticker');
    if (empty($c['enabled'])) return;
    $items = parse_items($c['items'] ?? '');
    if (!$items) return;
    $row = '';
    foreach ($items as $it) {
        $row .= '<span class="co-tick-item">' . h(rtrim(trim($it[0]), '✦ ')) . '<span class="co-tick-sep">✦</span></span>';
    }
    ?>
    <section class="co-ticker bleed" data-reveal>
        <div class="marquee"><div class="marquee__track marquee__track--l" style="--mdur:38s"><?= $row . $row ?></div></div>
    </section>
    <?php
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. LAYANAN — indeks editorial bernomor, baris hover invert
// ─────────────────────────────────────────────────────────────────────────────
function sec_layanan(): void {
    $c = site_content('layanan');
    if (empty($c['enabled'])) return;
    $items = parse_items($c['items'] ?? '');
    if (!$items) return;
    $hasImg = (bool)array_filter($items, fn($it) => trim($it[3] ?? '') !== '');
    ?>
    <section id="layanan" class="co-sec scroll-mt-24" data-reveal>
        <?= co_head($c['kicker'] ?? '', $c['title'] ?? '', $c['subtitle'] ?? '', 'Lihat katalog', 'produk.php') ?>
        <div class="grid <?= $hasImg ? 'lg:grid-cols-[1.2fr_.8fr]' : '' ?> gap-8 lg:gap-12 items-start" id="co-svc-zone">
            <div class="co-svc">
                <?php foreach ($items as $i => $it): $link = trim($it[2] ?? '') ?: 'produk.php'; $im = trim($it[3] ?? ''); ?>
                    <a href="<?= h($link) ?>" class="co-svc-row" data-svc="<?= $i ?>" data-reveal-item>
                        <span class="co-svc-num"><?= str_pad((string)($i + 1), 2, '0', STR_PAD_LEFT) ?></span>
                        <span class="co-svc-main">
                            <?php if ($im): ?><img src="<?= h($im) ?>" alt="" loading="lazy" class="co-svc-thumb lg:hidden"><?php endif; ?>
                            <span class="co-svc-name"><?= h($it[0]) ?></span>
                        </span>
                        <span class="co-svc-desc"><?= h($it[1] ?? '') ?></span>
                        <span class="co-svc-arrow"><svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 17L17 7M17 7H8m9 0v9"/></svg></span>
                    </a>
                <?php endforeach; ?>
            </div>
            <!-- Panel foto produksi: mengikuti baris yang di-hover -->
            <?php if ($hasImg): ?>
            <div class="co-svc-vis hidden lg:block" data-reveal-item>
                <?php foreach ($items as $i => $it): $im = trim($it[3] ?? ''); if (!$im) continue; ?>
                    <figure class="co-svc-img <?= $i === 0 ? 'is-on' : '' ?>" data-svc-img="<?= $i ?>">
                        <img src="<?= h($im) ?>" alt="<?= h($it[0]) ?>" loading="lazy">
                        <figcaption><?= h($it[0]) ?></figcaption>
                    </figure>
                <?php endforeach; ?>
            </div>
            <?php endif; ?>
        </div>
    </section>
    <script>
    (function () {
        var zone = document.getElementById('co-svc-zone');
        if (!zone) return;
        var imgs = zone.querySelectorAll('[data-svc-img]');
        if (!imgs.length) return;
        zone.querySelectorAll('[data-svc]').forEach(function (row) {
            row.addEventListener('mouseenter', function () {
                imgs.forEach(function (f) { f.classList.toggle('is-on', f.dataset.svcImg === row.dataset.svc); });
            });
        });
    })();
    </script>
    <?php
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. TENTANG — band ink: statement + badge berputar + checklist
// ─────────────────────────────────────────────────────────────────────────────
function sec_tentang(): void {
    $c = site_content('tentang');
    if (empty($c['enabled'])) return;
    $items = parse_items($c['list'] ?? '');
    ?>
    <section class="co-band bleed bleed--pad" data-reveal>
        <div class="co-band-glow" aria-hidden="true"></div>
        <div class="relative grid md:grid-cols-[1fr_auto] gap-10 items-center">
            <div>
                <span class="co-kicker co-kicker--light"><?= h($c['kicker'] ?? 'Tentang Kami') ?></span>
                <h2 class="co-h2 co-h2--light max-w-3xl"><?= h($c['title'] ?? '') ?></h2>
                <?php if (!empty($c['text'])): ?><p class="mt-5 text-white/65 max-w-2xl leading-relaxed"><?= h($c['text']) ?></p><?php endif; ?>
                <?php if ($items): ?>
                    <ul class="mt-8 grid sm:grid-cols-2 gap-x-10 gap-y-3">
                        <?php foreach ($items as $it): ?>
                            <li class="flex items-start gap-3 text-white/85 text-sm">
                                <span class="co-dot"></span><span><?= h($it[0]) ?></span>
                            </li>
                        <?php endforeach; ?>
                    </ul>
                <?php endif; ?>
            </div>
            <a href="<?= h($c['badgeLink'] ?? 'profil.php') ?>" class="relative h-36 w-36 sm:h-44 sm:w-44 shrink-0 grid place-items-center justify-self-center md:justify-self-end group" aria-label="Profil perusahaan">
                <svg viewBox="0 0 100 100" class="rotating-badge absolute inset-0 w-full h-full">
                    <defs><path id="cocirc" d="M 50,50 m -38,0 a 38,38 0 1,1 76,0 a 38,38 0 1,1 -76,0"/></defs>
                    <text class="fill-white/70" style="font-size:8px;letter-spacing:2.4px;font-weight:600">
                        <textPath href="#cocirc"><?= h($c['badgeText'] ?? 'PROFIL PERUSAHAAN ✦') ?></textPath>
                    </text>
                </svg>
                <span class="h-12 w-12 rounded-full border border-white/30 text-white grid place-items-center group-hover:bg-white group-hover:text-slate-900 transition-colors">
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 17L17 7M17 7H8m9 0v9"/></svg>
                </span>
            </a>
        </div>
    </section>
    <?php
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. PORTOFOLIO — masonry + lightbox
// ─────────────────────────────────────────────────────────────────────────────
function sec_portofolio(array $opts = []): void {
    $c = site_content('portofolio');
    if (empty($c['enabled']) && empty($opts['force'])) return;
    $items = array_values(array_filter($c['items'] ?? [], fn($it) => !empty($it['image'])));
    if (!$items) {
        if (is_admin()): ?>
            <section class="co-sec"><div class="rounded-2xl border-2 border-dashed border-slate-300 p-10 text-center text-slate-400 text-sm">Belum ada foto karya — isi lewat Dashboard &rarr; Konten &rarr; Karya Terpilih. (Hanya terlihat admin.)</div></section>
        <?php endif;
        return;
    }
    $limit = (int)($opts['limit'] ?? 0);
    if ($limit > 0) $items = array_slice($items, 0, $limit);
    $gid = 'pf' . substr(md5(json_encode($items)), 0, 6);
    ?>
    <section class="co-sec scroll-mt-24" id="<?= $gid ?>" data-reveal>
        <?= co_head($c['kicker'] ?? 'Portofolio', $c['title'] ?? 'Karya Terpilih', $c['subtitle'] ?? '', empty($opts['noMore']) ? 'Semua karya' : '', 'portofolio.php') ?>
        <div class="columns-2 md:columns-3 lg:columns-4 gap-3 sm:gap-4 [&>*]:mb-3 sm:[&>*]:mb-4">
            <?php foreach ($items as $i => $it): ?>
                <button type="button" data-pf="<?= $i ?>" class="card-in group relative w-full rounded-xl overflow-hidden bg-slate-100 text-left cursor-zoom-in break-inside-avoid" style="animation-delay:<?= ($i % 8) * 60 ?>ms">
                    <img src="<?= h($it['image']) ?>" alt="<?= h($it['title'] ?? 'Karya') ?>" loading="lazy" class="w-full h-auto object-cover group-hover:scale-[1.04] transition-transform duration-700">
                    <span class="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></span>
                    <span class="absolute inset-x-0 bottom-0 p-4 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                        <?php if (!empty($it['title'])): ?><span class="block text-white font-semibold text-sm leading-snug"><?= h($it['title']) ?></span><?php endif; ?>
                        <?php if (!empty($it['caption'])): ?><span class="block text-white/60 text-xs mt-0.5 uppercase tracking-wider"><?= h($it['caption']) ?></span><?php endif; ?>
                    </span>
                </button>
            <?php endforeach; ?>
        </div>
        <div data-pf-box class="fixed inset-0 z-[70] hidden items-center justify-center bg-slate-950/92 backdrop-blur-sm p-4 sm:p-8">
            <button type="button" data-pf-close class="absolute top-4 right-4 h-10 w-10 grid place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 z-10" aria-label="Tutup"><svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></button>
            <?php if (count($items) > 1): ?>
                <button type="button" data-pf-nav="-1" class="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 h-11 w-11 grid place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 z-10" aria-label="Sebelumnya"><svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg></button>
                <button type="button" data-pf-nav="1" class="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 h-11 w-11 grid place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 z-10" aria-label="Berikutnya"><svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg></button>
            <?php endif; ?>
            <figure class="max-w-4xl w-full text-center">
                <img data-pf-img src="" alt="" class="max-h-[75vh] w-auto mx-auto rounded-lg shadow-2xl">
                <figcaption class="mt-3">
                    <span data-pf-title class="block text-white font-semibold"></span>
                    <span data-pf-cap class="block text-white/55 text-sm uppercase tracking-wider"></span>
                </figcaption>
            </figure>
        </div>
    </section>
    <script>
    (function () {
        var root = document.getElementById('<?= $gid ?>');
        if (!root) return;
        var data = <?= json_encode(array_map(fn($it) => ['src' => $it['image'], 't' => $it['title'] ?? '', 'c' => $it['caption'] ?? ''], $items), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?>;
        var box = root.querySelector('[data-pf-box]'), img = root.querySelector('[data-pf-img]'),
            tt = root.querySelector('[data-pf-title]'), cp = root.querySelector('[data-pf-cap]'), cur = 0;
        function show(i) { cur = (i + data.length) % data.length; var d = data[cur]; img.src = d.src; img.alt = d.t || 'Karya'; tt.textContent = d.t; cp.textContent = d.c; }
        function open(i) { show(i); box.classList.remove('hidden'); box.classList.add('flex'); document.body.style.overflow = 'hidden'; }
        function close() { box.classList.add('hidden'); box.classList.remove('flex'); document.body.style.overflow = ''; }
        root.querySelectorAll('[data-pf]').forEach(function (b) { b.addEventListener('click', function () { open(+b.dataset.pf); }); });
        root.querySelector('[data-pf-close]').addEventListener('click', close);
        root.querySelectorAll('[data-pf-nav]').forEach(function (b) { b.addEventListener('click', function (e) { e.stopPropagation(); show(cur + +b.dataset.pfNav); }); });
        box.addEventListener('click', function (e) { if (e.target === box) close(); });
        document.addEventListener('keydown', function (e) {
            if (box.classList.contains('hidden')) return;
            if (e.key === 'Escape') close();
            if (e.key === 'ArrowRight') show(cur + 1);
            if (e.key === 'ArrowLeft') show(cur - 1);
        });
    })();
    </script>
    <?php
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. STATISTIK — kolom hairline, numeral display besar
// ─────────────────────────────────────────────────────────────────────────────
function sec_statistik(): void {
    $c = site_content('statistik');
    if (empty($c['enabled'])) return;
    $items = parse_items($c['items'] ?? '');
    if (!$items) return;
    ?>
    <section class="co-stats bleed bleed--pad" data-reveal>
        <div class="grid grid-cols-2 md:grid-cols-<?= min(4, max(2, count($items))) ?>">
            <?php foreach ($items as $i => $it): ?>
                <div class="co-stat <?= $i > 0 ? 'co-stat--line' : '' ?>" data-reveal-item>
                    <span class="co-stat-num" data-count="<?= h($it[0]) ?>"><?= h($it[0]) ?></span>
                    <span class="co-stat-lbl"><?= h($it[1] ?? '') ?></span>
                </div>
            <?php endforeach; ?>
        </div>
    </section>
    <?php
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. PRODUK UNGGULAN — bento kurasi + link katalog
// ─────────────────────────────────────────────────────────────────────────────
function sec_produk(array $products): void {
    $c = site_content('produk');
    if (empty($c['enabled'])) return;
    $ids = array_map('strval', (array)($c['ids'] ?? []));
    $list = $ids
        ? array_values(array_filter($products, fn($p) => in_array((string)$p['id'], $ids, true)))
        : array_slice($products, 0, 5);
    if ($ids) usort($list, fn($a, $z) => array_search((string)$a['id'], $ids) <=> array_search((string)$z['id'], $ids));
    $list = array_slice($list, 0, 7);
    if (!count($list)) return;
    $spans = ['bento-feature', '', 'bento-tall', '', 'bento-wide', '', ''];
    ?>
    <section id="produk" class="co-sec scroll-mt-24" data-reveal>
        <?= co_head($c['kicker'] ?? 'Katalog', $c['title'] ?? 'Produk Unggulan', $c['subtitle'] ?? '', 'Semua produk', 'produk.php') ?>
        <div class="bento">
            <?php foreach ($list as $i => $p):
                $im = product_image($p);
                $vc = count($p['variants'] ?? []);
                $isFeat = $i === 0;
                $desc = trim(strip_tags((string)($p['description'] ?? '')));
                ?>
                <a href="product.php?id=<?= h($p['id']) ?>" class="bento-card <?= $spans[$i % count($spans)] ?>" data-reveal-item>
                    <?php if ($im): ?><img src="<?= h($im) ?>" alt="<?= h($p['name']) ?>" loading="lazy" class="bg"><?php else: ?><div class="absolute inset-0 bg-gradient-to-br from-slate-200 to-slate-300"></div><?php endif; ?>
                    <span class="veil"></span>
                    <span class="absolute inset-x-0 bottom-0 p-4 <?= $isFeat ? 'sm:p-6' : '' ?> z-[2]">
                        <?php if (!empty($p['category']['name'])): ?><span class="inline-block text-[10px] font-semibold uppercase tracking-widest text-white/70 mb-1.5"><?= h($p['category']['name']) ?></span><?php endif; ?>
                        <span class="block font-head font-extrabold text-white leading-snug <?= $isFeat ? 'text-xl sm:text-3xl' : 'text-sm sm:text-base line-clamp-2' ?>"><?= h($p['name']) ?></span>
                        <?php if ($isFeat && $desc): ?><span class="hidden sm:block text-white/65 text-sm mt-1.5 line-clamp-2 max-w-md"><?= h(mb_substr($desc, 0, 160)) ?></span><?php endif; ?>
                        <span class="flex items-center gap-2 mt-2.5 flex-wrap">
                            <span class="inline-flex items-baseline gap-1 bg-white text-slate-900 rounded-full px-3 py-1 text-xs font-extrabold"><?= $vc > 1 ? '<span class="font-medium text-slate-400">Mulai</span> ' : '' ?><?= rupiah(product_price($p)) ?><?= product_is_area($p) ? '<span class="font-semibold text-slate-400">/m²</span>' : '' ?></span>
                            <?php if ($vc > 1): ?><span class="text-[11px] text-white/60"><?= $vc ?> varian</span><?php endif; ?>
                        </span>
                    </span>
                </a>
            <?php endforeach; ?>
        </div>
    </section>
    <?php
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. VIDEO / FASILITAS — media lebar + tombol play
// ─────────────────────────────────────────────────────────────────────────────
function sec_video(): void {
    $c = site_content('video');
    if (empty($c['enabled'])) return;
    $img = trim($c['image'] ?? '');
    if ($img === '') return;
    $yt = trim($c['youtube'] ?? '');
    if ($yt && preg_match('~(?:youtu\.be/|v=|embed/)([A-Za-z0-9_-]{6,})~', $yt, $m)) $yt = $m[1];
    ?>
    <section class="co-sec" data-reveal>
        <?= co_head($c['kicker'] ?? 'Fasilitas', $c['title'] ?? '', $c['text'] ?? '') ?>
        <div class="co-media" data-reveal-item>
            <img src="<?= h($img) ?>" alt="<?= h($c['title'] ?? 'Fasilitas produksi') ?>" loading="lazy">
            <?php if ($yt): ?>
                <button type="button" data-video-open="<?= h($yt) ?>" class="co-play" aria-label="Putar video">
                    <span class="co-play-ring"></span>
                    <svg class="w-6 h-6 translate-x-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5.14v13.72c0 .79.87 1.27 1.54.84l10.07-6.86a1 1 0 000-1.68L9.54 4.3A1 1 0 008 5.14z"/></svg>
                </button>
            <?php endif; ?>
        </div>
    </section>
    <?php
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. TESTIMONI — band ink, kartu kutipan
// ─────────────────────────────────────────────────────────────────────────────
function sec_testimoni(): void {
    $c = site_content('testimoni');
    if (empty($c['enabled'])) return;
    $items = parse_items($c['items'] ?? '');
    if (!$items) return;
    $tc = count($items);
    $tcls = $tc >= 4 ? 'lg:grid-cols-4' : ($tc === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2');
    ?>
    <section class="pk-sec" data-reveal>
        <h2 class="pk-section-title"><?= h($c['title'] ?: 'Apa Kata Mereka Tentang Kami?') ?></h2>
        <div class="pk-testi-grid <?= $tcls ?>">
            <?php foreach ($items as $it): $photo = trim($it[3] ?? ''); ?>
                <figure class="glass pk-testi" data-reveal-item>
                    <div class="pk-testi-stars" aria-hidden="true">
                        <i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i>
                    </div>
                    <blockquote class="pk-testi-quote">&ldquo;<?= h($it[0]) ?>&rdquo;</blockquote>
                    <figcaption class="pk-testi-foot">
                        <?php if ($photo): ?>
                            <img src="<?= h($photo) ?>" alt="<?= h($it[1] ?? '') ?>" loading="lazy" class="pk-testi-ava">
                        <?php else: ?>
                            <span class="pk-testi-ava pk-testi-ava--init"><?= h(strtoupper(mb_substr($it[1] ?? 'A', 0, 1))) ?></span>
                        <?php endif; ?>
                        <span>
                            <span class="pk-testi-name"><?= h($it[1] ?? '') ?></span>
                            <?php if (!empty($it[2])): ?><span class="pk-testi-role"><?= h($it[2]) ?></span><?php endif; ?>
                        </span>
                    </figcaption>
                </figure>
            <?php endforeach; ?>
        </div>
    </section>
    <?php
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. KLIEN — marquee chip lurus, hairline
// ─────────────────────────────────────────────────────────────────────────────
function sec_klien(): void {
    $c = site_content('klien');
    if (empty($c['enabled'])) return;
    $items = parse_items($c['items'] ?? '');
    if (!$items) return;
    $chip = function (array $it): string {
        $name = $it[0] ?? ''; $logo = trim($it[1] ?? '');
        // hanya logo; nama dipakai sebagai alt/fallback bila logo kosong
        $inner = $logo !== ''
            ? '<img src="' . h($logo) . '" alt="' . h($name) . '" title="' . h($name) . '" loading="lazy" class="h-9 sm:h-11 w-auto max-w-[150px] object-contain grayscale opacity-75 hover:grayscale-0 hover:opacity-100 transition">'
            : '<span class="font-head font-semibold text-slate-400 whitespace-nowrap text-sm tracking-wide uppercase">' . h($name) . '</span>';
        return '<div class="co-chip">' . $inner . '</div>';
    };
    $row = implode('', array_map($chip, $items));
    ?>
    <section class="co-sec" data-reveal>
        <p class="text-center text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-400 mb-7"><?= h($c['title'] ?? 'Dipercaya Perusahaan & Instansi') ?></p>
        <div class="bleed">
            <div class="marquee"><div class="marquee__track marquee__track--l" style="--mdur:70s"><?= $row . $row ?></div></div>
        </div>
    </section>
    <?php
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. ORDER — panel split: info ink + form konsultasi (→ lead.php → CRM)
// ─────────────────────────────────────────────────────────────────────────────
function sec_order(): void {
    $c = site_content('order');
    if (empty($c['enabled'])) return;
    $st = settings();
    $kontak = site_content('kontak');
    $branches = array_values(array_filter(array_map('trim', preg_split('/\r?\n/', $c['branches'] ?? ''))));
    $waNum = preg_replace('/^0/', '62', preg_replace('/\D/', '', ($c['whatsapp'] ?? '') ?: ($kontak['whatsapp'] ?? '') ?: ($st['storePhone'] ?? '')));
    $sentOk  = ($_GET['lead'] ?? '') === 'ok';
    $sentErr = ($_GET['lead'] ?? '') === 'err';
    $waText  = rawurlencode('Halo, saya baru saja mengisi form konsultasi di website. Nama saya ' . ($_GET['n'] ?? '') . ', mohon dibantu.');
    ?>
    <section id="order-cepat" class="co-sec scroll-mt-24" data-reveal>
        <div class="grid md:grid-cols-[1fr_1.1fr] rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-white">
            <div class="relative co-ink p-8 sm:p-12 text-white flex flex-col justify-between min-h-[300px]">
                <div class="co-band-glow" aria-hidden="true"></div>
                <div class="relative">
                    <span class="co-kicker co-kicker--light"><?= h($c['kicker'] ?? 'Konsultasi') ?></span>
                    <h2 class="co-h2 co-h2--light"><?= h($c['title'] ?? '') ?></h2>
                    <?php if (!empty($c['subtitle'])): ?><p class="mt-4 text-white/60 text-sm leading-relaxed max-w-sm"><?= h($c['subtitle']) ?></p><?php endif; ?>
                </div>
                <div class="relative mt-10 space-y-3 text-sm text-white/70">
                    <?php if (!empty($kontak['phone'])): ?><div class="flex items-center gap-3"><span class="co-dot"></span><?= h($kontak['phone']) ?></div><?php endif; ?>
                    <?php if (!empty($kontak['email'])): ?><div class="flex items-center gap-3"><span class="co-dot"></span><?= h($kontak['email']) ?></div><?php endif; ?>
                    <?php if ($branches): ?><div class="flex items-center gap-3"><span class="co-dot"></span><?= h(implode(' · ', $branches)) ?></div><?php endif; ?>
                </div>
            </div>
            <div class="p-6 sm:p-10">
                <?php if ($sentOk): ?>
                    <div class="h-full flex flex-col items-center justify-center text-center py-8">
                        <span class="h-14 w-14 rounded-full bg-emerald-50 text-emerald-600 grid place-items-center mb-4 border border-emerald-200"><svg class="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg></span>
                        <h3 class="font-head text-xl font-extrabold text-slate-900">Permintaan Anda sudah kami terima.</h3>
                        <p class="mt-2 text-sm text-slate-500 max-w-xs">Tim kami akan segera menghubungi Anda pada jam kerja. Ingin lebih cepat?</p>
                        <?php if ($waNum): ?><a href="https://wa.me/<?= h($waNum) ?>?text=<?= $waText ?>" target="_blank" rel="noopener" class="co-btn co-btn--dark mt-5 text-sm">Lanjutkan via WhatsApp</a><?php endif; ?>
                    </div>
                <?php else: ?>
                    <?php if ($sentErr): ?><div class="mb-4 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">Gagal mengirim — silakan coba lagi atau hubungi kami via WhatsApp.</div><?php endif; ?>
                    <form method="post" action="lead.php" class="space-y-4">
                        <input type="hidden" name="back" value="<?= h(($_SERVER['PHP_SELF'] ?? 'index.php')) ?>">
                        <input type="text" name="website" value="" tabindex="-1" autocomplete="off" class="hidden" aria-hidden="true">
                        <div>
                            <label class="co-label">Nama</label>
                            <input type="text" name="name" required class="co-input" placeholder="Nama Anda / perusahaan">
                        </div>
                        <div>
                            <label class="co-label">No. HP / WhatsApp</label>
                            <input type="tel" name="phone" required class="co-input" placeholder="08xxxxxxxxxx">
                        </div>
                        <div>
                            <label class="co-label">Kebutuhan</label>
                            <textarea name="note" rows="3" required class="co-input" placeholder="Contoh: banner 3×1 m, dibutuhkan Jumat pagi"></textarea>
                        </div>
                        <?php $poBranches = pospro_branches(); ?>
                        <?php if (count($poBranches) > 1): ?>
                            <div>
                                <label class="co-label">Cetak di cabang</label>
                                <select name="branchId" required class="co-input">
                                    <option value="">— Pilih lokasi cetak —</option>
                                    <?php foreach ($poBranches as $b): ?><option value="<?= (int)$b['id'] ?>"><?= h($b['name']) ?></option><?php endforeach; ?>
                                </select>
                            </div>
                        <?php elseif (count($poBranches) === 1): ?>
                            <input type="hidden" name="branchId" value="<?= (int)$poBranches[0]['id'] ?>">
                        <?php endif; ?>
                        <button type="submit" class="co-btn co-btn--dark w-full justify-center text-sm">
                            Kirim &amp; Minta Penawaran
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.4"><path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
                        </button>
                        <p class="text-[11px] text-slate-400 text-center">Tanpa biaya — tim kami merespons pada jam kerja.</p>
                    </form>
                <?php endif; ?>
            </div>
        </div>
    </section>
    <?php
}

// ─────────────────────────────────────────────────────────────────────────────
// 12. ARTIKEL — unggulan besar + daftar baris editorial
// ─────────────────────────────────────────────────────────────────────────────
function sec_artikel(): void {
    $c = site_content('artikel');
    if (empty($c['enabled'])) return;
    $limit = max(1, (int)($c['limit'] ?? 5));
    $arts = [];
    try { $arts = db()->query("SELECT title, slug, excerpt, cover_url, COALESCE(published_at, created_at) AS pub FROM articles WHERE status='PUBLISHED' ORDER BY pub DESC LIMIT " . $limit)->fetchAll(); } catch (Throwable $e) {}
    if (!count($arts)) return;
    $feat = $arts[0];
    $rest = array_slice($arts, 1);
    ?>
    <section class="co-sec" data-reveal>
        <?= co_head($c['kicker'] ?? 'Blog', $c['title'] ?? 'Wawasan & Panduan', '', 'Semua artikel', 'artikel.php') ?>
        <div class="grid lg:grid-cols-2 gap-8">
            <a href="artikel.php?slug=<?= h($feat['slug']) ?>" class="group block" data-reveal-item>
                <div class="aspect-[16/10] rounded-2xl bg-slate-100 overflow-hidden">
                    <?php if (!empty($feat['cover_url'])): ?><img src="<?= h($feat['cover_url']) ?>" alt="" loading="lazy" class="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-700"><?php endif; ?>
                </div>
                <div class="mt-5">
                    <span class="text-[11px] font-semibold uppercase tracking-widest text-slate-400"><?= h(tgl($feat['pub'] ?? null)) ?></span>
                    <h3 class="font-head text-xl sm:text-2xl font-extrabold text-slate-900 leading-snug mt-1.5 group-hover:underline decoration-2 underline-offset-4"><?= h($feat['title']) ?></h3>
                    <?php if (!empty($feat['excerpt'])): ?><p class="mt-2 text-sm text-slate-500 line-clamp-2 max-w-xl"><?= h($feat['excerpt']) ?></p><?php endif; ?>
                </div>
            </a>
            <?php if ($rest): ?>
                <div class="divide-y divide-slate-200 border-t border-slate-200 lg:border-t-0">
                    <?php foreach ($rest as $a): ?>
                        <a href="artikel.php?slug=<?= h($a['slug']) ?>" class="group flex items-center gap-5 py-5 first:lg:pt-0" data-reveal-item>
                            <div class="w-28 h-20 rounded-xl bg-slate-100 overflow-hidden shrink-0">
                                <?php if (!empty($a['cover_url'])): ?><img src="<?= h($a['cover_url']) ?>" alt="" loading="lazy" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"><?php endif; ?>
                            </div>
                            <div class="min-w-0">
                                <span class="text-[10px] font-semibold uppercase tracking-widest text-slate-400"><?= h(tgl($a['pub'] ?? null)) ?></span>
                                <h3 class="font-semibold text-slate-800 leading-snug line-clamp-2 mt-0.5 group-hover:text-slate-950 transition-colors"><?= h($a['title']) ?></h3>
                            </div>
                            <span class="co-more-ico ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"><svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 17L17 7M17 7H8m9 0v9"/></svg></span>
                        </a>
                    <?php endforeach; ?>
                </div>
            <?php endif; ?>
        </div>
    </section>
    <?php
}

// ─────────────────────────────────────────────────────────────────────────────
// 13. FAQ — accordion dua kolom
// ─────────────────────────────────────────────────────────────────────────────
function sec_faq(): void {
    $c = site_content('faq');
    if (empty($c['enabled'])) return;
    $items = parse_items($c['items'] ?? '');
    if (!$items) return;
    ?>
    <section class="co-sec" data-reveal>
        <div class="grid lg:grid-cols-[0.8fr_1.2fr] gap-10">
            <div>
                <span class="co-kicker"><?= h($c['kicker'] ?? 'FAQ') ?></span>
                <h2 class="co-h2"><?= h($c['title'] ?? '') ?></h2>
                <p class="co-sub">Tidak menemukan jawaban yang Anda cari? <a href="#order-cepat" class="underline underline-offset-4 decoration-slate-300 hover:decoration-slate-900 text-slate-700">Hubungi tim kami</a>.</p>
            </div>
            <div class="divide-y divide-slate-200 border-y border-slate-200">
                <?php foreach ($items as $it): ?>
                    <details class="group py-5" data-reveal-item>
                        <summary class="flex items-center justify-between cursor-pointer font-semibold text-slate-900 list-none gap-4">
                            <span><?= h($it[0]) ?></span>
                            <span class="co-faq-ico shrink-0"><svg class="w-4 h-4 group-open:rotate-45 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg></span>
                        </summary>
                        <?php if (!empty($it[1])): ?><p class="mt-3 text-slate-500 text-sm leading-relaxed max-w-2xl"><?= nl2br(h($it[1])) ?></p><?php endif; ?>
                    </details>
                <?php endforeach; ?>
            </div>
        </div>
    </section>
    <?php
}

// ─────────────────────────────────────────────────────────────────────────────
// 14. KONTAK — info + peta
// ─────────────────────────────────────────────────────────────────────────────
function sec_kontak(): void {
    $c = site_content('kontak');
    if (empty($c['enabled'])) return;
    // Multi-lokasi; fallback dari field lama bila locations kosong
    $locs = array_values(array_filter((array)($c['locations'] ?? []), fn($l) => trim($l['name'] ?? '') !== '' || trim($l['address'] ?? '') !== ''));
    if (!$locs) {
        $locs = [[
            'name' => $c['title'] ?? 'Lokasi Kami', 'address' => $c['address'] ?? '',
            'phone' => $c['phone'] ?? '', 'whatsapp' => $c['whatsapp'] ?? '',
            'hours' => '', 'mapsEmbed' => $c['mapsEmbed'] ?? '',
        ]];
    }
    $email = trim($c['email'] ?? '');
    ?>
    <section id="kontak" class="co-sec scroll-mt-24" data-reveal>
        <?= co_head('Kontak', $c['title'] ?? 'Hubungi Kami', count($locs) > 1 ? 'Kami melayani Anda dari ' . count($locs) . ' lokasi — pilih cabang terdekat.' : '', $email !== '' ? $email : '', $email !== '' ? 'mailto:' . $email : '') ?>
        <div class="grid lg:grid-cols-[.95fr_1.05fr] gap-px bg-slate-200 rounded-2xl overflow-hidden border border-slate-200" id="co-loc-zone">
            <!-- Daftar lokasi -->
            <div class="bg-white divide-y divide-slate-100">
                <?php foreach ($locs as $i => $l):
                    $wa = preg_replace('/^0/', '62', preg_replace('/\D/', '', $l['whatsapp'] ?? '')); ?>
                    <div class="co-loc <?= $i === 0 ? 'is-on' : '' ?>" data-loc="<?= $i ?>" role="button" tabindex="0">
                        <div class="flex items-start justify-between gap-3">
                            <div class="min-w-0">
                                <h3 class="font-head font-extrabold text-slate-900 flex items-center gap-2.5">
                                    <span class="co-loc-pin"><svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><circle cx="12" cy="11" r="3"/></svg></span>
                                    <?= h($l['name'] ?? ('Cabang ' . ($i + 1))) ?>
                                </h3>
                                <?php if (!empty($l['address'])): ?><p class="mt-2 text-sm text-slate-500 whitespace-pre-line leading-relaxed pl-9"><?= h($l['address']) ?></p><?php endif; ?>
                                <div class="mt-3 pl-9 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-slate-500">
                                    <?php if (!empty($l['phone'])): ?><a href="tel:<?= h(preg_replace('/\D/', '', $l['phone'])) ?>" class="hover:text-slate-900 font-medium" onclick="event.stopPropagation()"><?= h($l['phone']) ?></a><?php endif; ?>
                                    <?php if (!empty($l['hours'])): ?><span class="inline-flex items-center gap-1.5"><svg class="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path stroke-linecap="round" d="M12 7v5l3 2"/></svg><?= h($l['hours']) ?></span><?php endif; ?>
                                </div>
                            </div>
                            <span class="co-loc-arrow shrink-0"><svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg></span>
                        </div>
                        <?php if ($wa): ?><div class="pl-9 mt-3.5"><a href="https://wa.me/<?= h($wa) ?>" target="_blank" rel="noopener" onclick="event.stopPropagation()" class="inline-flex items-center gap-2 text-xs font-bold text-slate-700 border border-slate-200 rounded-full px-3.5 py-1.5 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition">Chat WhatsApp Cabang Ini</a></div><?php endif; ?>
                    </div>
                <?php endforeach; ?>
                <?php if ($email !== ''): ?>
                    <div class="px-6 py-4 text-xs text-slate-400 flex items-center gap-3">
                        <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                        Email: <a href="mailto:<?= h($email) ?>" class="text-slate-600 hover:text-slate-900 font-medium"><?= h($email) ?></a>
                    </div>
                <?php endif; ?>
            </div>
            <!-- Peta lokasi aktif -->
            <div class="bg-slate-50 relative min-h-[320px] lg:min-h-0">
                <?php $adaPeta = false; foreach ($locs as $i => $l): $mu = maps_embed_src($l['mapsEmbed'] ?? ''); if ($mu === '') continue; $adaPeta = true; ?>
                    <iframe data-loc-map="<?= $i ?>" src="<?= h($mu) ?>" class="absolute inset-0 w-full h-full <?= $i === 0 ? '' : 'hidden' ?>" style="border:0" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Peta <?= h($l['name'] ?? '') ?>"></iframe>
                <?php endforeach; ?>
                <div data-loc-map="none" class="absolute inset-0 grid place-items-center text-slate-300 <?= maps_embed_src($locs[0]['mapsEmbed'] ?? '') !== '' ? 'hidden' : '' ?>">
                    <div class="text-center">
                        <svg class="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/></svg>
                        <?php if (is_admin()): ?><p class="text-xs mt-2 text-slate-400">Isi "URL embed Maps" cabang ini di Dashboard &rarr; Konten &rarr; Kontak</p><?php endif; ?>
                    </div>
                </div>
            </div>
        </div>
    </section>
    <script>
    (function () {
        var zone = document.getElementById('co-loc-zone');
        if (!zone) return;
        var rows = zone.querySelectorAll('[data-loc]');
        var maps = zone.querySelectorAll('[data-loc-map]');
        function activate(i) {
            rows.forEach(function (r) { r.classList.toggle('is-on', r.dataset.loc === String(i)); });
            var ada = false;
            maps.forEach(function (m) {
                if (m.dataset.locMap === String(i)) { m.classList.remove('hidden'); ada = true; }
                else if (m.dataset.locMap !== 'none') m.classList.add('hidden');
            });
            var ph = zone.querySelector('[data-loc-map="none"]');
            if (ph) ph.classList.toggle('hidden', ada);
        }
        rows.forEach(function (r) {
            r.addEventListener('click', function () { activate(r.dataset.loc); });
            r.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(r.dataset.loc); } });
        });
    })();
    </script>
    <?php
}

// ─────────────────────────────────────────────────────────────────────────────
// 15. CTA PENUTUP — band ink terpusat
// ─────────────────────────────────────────────────────────────────────────────
function sec_cta(): void {
    $c = site_content('cta');
    if (empty($c['enabled'])) return;
    ?>
    <section class="co-band bleed bleed--pad text-center" data-reveal>
        <div class="co-band-glow" aria-hidden="true"></div>
        <div class="relative max-w-3xl mx-auto">
            <h2 class="co-h2 co-h2--light"><?= h($c['title'] ?? '') ?></h2>
            <?php if (!empty($c['subtitle'])): ?><p class="mt-4 text-white/60 leading-relaxed"><?= h($c['subtitle']) ?></p><?php endif; ?>
            <?php if (!empty($c['btnText'])): ?>
                <a href="<?= h($c['btnLink'] ?: '#order-cepat') ?>" class="co-btn co-btn--invert mt-8"><?= h($c['btnText']) ?><svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.4"><path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg></a>
            <?php endif; ?>
        </div>
    </section>
    <?php
}

// ─────────────────────────────────────────────────────────────────────────────
// 16. POPUP PROMO (opsional)
// ─────────────────────────────────────────────────────────────────────────────
function sec_popup(): void {
    $c = site_content('popup');
    if (empty($c['enabled'])) return;
    $img = trim($c['image'] ?? '');
    if ($img === '' && empty($c['title'])) return;
    $key = 'pop_' . substr(md5(($c['title'] ?? '') . '|' . $img), 0, 10);
    $pid = 'pu' . substr(md5($key), 0, 6);
    $once = !empty($c['once']);
    ?>
    <div id="<?= $pid ?>" class="fixed inset-0 z-[60] hidden items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
        <div class="relative bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl">
            <button type="button" data-close class="absolute top-3 right-3 h-9 w-9 grid place-items-center rounded-full bg-black/40 text-white hover:bg-black/60 z-10" aria-label="Tutup"><svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></button>
            <?php if ($img): $tag = '<img src="' . h($img) . '" class="w-full" alt="">'; ?>
                <?php if (!empty($c['link'])): ?><a href="<?= h($c['link']) ?>" target="_blank" rel="noopener"><?= $tag ?></a><?php else: ?><?= $tag ?><?php endif; ?>
            <?php endif; ?>
            <?php if (!empty($c['title']) || !empty($c['text']) || !empty($c['btnText'])): ?>
                <div class="p-6 text-center">
                    <?php if (!empty($c['title'])): ?><h3 class="font-head text-lg font-extrabold text-slate-900"><?= h($c['title']) ?></h3><?php endif; ?>
                    <?php if (!empty($c['text'])): ?><p class="mt-1.5 text-sm text-slate-500"><?= h($c['text']) ?></p><?php endif; ?>
                    <?php if (!empty($c['btnText'])): ?><a href="<?= h($c['btnLink'] ?: '#') ?>" class="co-btn co-btn--dark !py-2.5 text-sm mt-4"><?= h($c['btnText']) ?></a><?php endif; ?>
                </div>
            <?php endif; ?>
        </div>
    </div>
    <script>
    (function () {
        var key = '<?= $key ?>', once = <?= $once ? 'true' : 'false' ?>;
        try { if (once && localStorage.getItem(key) === new Date().toDateString()) return; } catch (e) {}
        var el = document.getElementById('<?= $pid ?>');
        if (!el) return;
        function open() { el.classList.remove('hidden'); el.classList.add('flex'); }
        function close() { el.classList.add('hidden'); el.classList.remove('flex'); try { if (once) localStorage.setItem(key, new Date().toDateString()); } catch (e) {} }
        setTimeout(open, 1200);
        el.querySelector('[data-close]').addEventListener('click', close);
        el.addEventListener('click', function (e) { if (e.target === el) close(); });
    })();
    </script>
    <?php
}

// ─────────────────────────────────────────────────────────────────────────────
// HERO STATIS (halaman dalam: profil / portofolio) — band ink ringkas
// ─────────────────────────────────────────────────────────────────────────────
function sec_page_hero(string $kicker, string $title, string $accent = '', string $subtitle = ''): void {
    ?>
    <section class="co-pagehero bleed bleed--pad" data-reveal>
        <div class="co-band-glow" aria-hidden="true"></div>
        <div class="relative max-w-3xl">
            <span class="co-kicker co-kicker--light"><?= h($kicker) ?></span>
            <h1 class="co-h1 !text-4xl sm:!text-5xl lg:!text-6xl"><?= co_title_html($title, $accent) ?></h1>
            <?php if ($subtitle !== ''): ?><p class="mt-5 text-white/60 leading-relaxed max-w-2xl"><?= h($subtitle) ?></p><?php endif; ?>
        </div>
    </section>
    <?php
}

// ═══════════════════════════════════════════════════════════════════════════
// RENDERER GAYA MOCKUP "PrintKreatif" (kategori ikon, grid produk, layanan)
// ═══════════════════════════════════════════════════════════════════════════

/** Petakan nama kategori → ikon Font Awesome. */
function pk_cat_icon(string $name): string {
    $n = mb_strtolower($name);
    $map = [
        'spanduk' => 'fa-flag', 'banner' => 'fa-flag', 'baliho' => 'fa-flag', 'outdoor' => 'fa-flag',
        'roll' => 'fa-scroll', 'x-banner' => 'fa-panorama', 'standee' => 'fa-panorama', 'standing' => 'fa-panorama',
        'stiker' => 'fa-note-sticky', 'sticker' => 'fa-note-sticky', 'label' => 'fa-note-sticky', 'kisscut' => 'fa-note-sticky',
        'kartu' => 'fa-id-card', 'pvc' => 'fa-id-card', 'nama' => 'fa-id-card', 'card' => 'fa-id-card',
        'brosur' => 'fa-file-lines', 'flyer' => 'fa-file-lines', 'poster' => 'fa-file-lines', 'indoor' => 'fa-file-lines',
        'kaos' => 'fa-shirt', 'kaus' => 'fa-shirt', 'dtf' => 'fa-shirt', 'sablon' => 'fa-shirt', 'jersey' => 'fa-shirt', 'apparel' => 'fa-shirt',
        'undangan' => 'fa-envelope-open-text', 'amplop' => 'fa-envelope',
        'akrilik' => 'fa-gem', 'laser' => 'fa-gem', 'cutting' => 'fa-scissors', 'plakat' => 'fa-award', 'medali' => 'fa-medal',
        'kalender' => 'fa-calendar-days', 'buku' => 'fa-book', 'spiral' => 'fa-book',
        'gantungan' => 'fa-key', 'kunci' => 'fa-key', 'souvenir' => 'fa-gift', 'merch' => 'fa-gift', 'mug' => 'fa-mug-hot',
        'uv' => 'fa-droplet', 'foto' => 'fa-image',
    ];
    foreach ($map as $k => $icon) if (strpos($n, $k) !== false) return $icon;
    return 'fa-print';
}

/** Shop by Category — baris kartu kategori (ikon + nama + jumlah), gaya referensi. */
function sec_categories(array $products): void {
    $cats = []; $counts = [];
    foreach ($products as $p) {
        $c = $p['category'] ?? null;
        if ($c && !empty($c['id'])) { $cats[$c['id']] = $c['name']; $counts[$c['id']] = ($counts[$c['id']] ?? 0) + 1; }
    }
    if (!$cats) return;
    $cats = array_slice($cats, 0, 12, true);
    ?>
    <section id="kategori" class="pk-sec" data-reveal>
        <div class="pk-shead">
            <div class="pk-shead-l">
                <span class="pk-shead-ico"><i class="fa-solid fa-grip"></i></span>
                <h2 class="pk-shead-title">Belanja per Kategori</h2>
            </div>
            <a href="produk.php" class="pk-shead-more">Lihat semua <i class="fa-solid fa-arrow-right" style="font-size:.8em"></i></a>
        </div>
        <div class="pk-catrow">
            <?php foreach ($cats as $id => $name): ?>
                <a href="produk.php?cat=<?= h($id) ?>" class="pk-catcard" data-reveal-item>
                    <span class="pk-catcard-ico"><i class="fa-solid <?= h(pk_cat_icon($name)) ?>"></i></span>
                    <span class="pk-catcard-name"><?= h($name) ?></span>
                    <span class="pk-catcard-count"><?= (int)($counts[$id] ?? 0) ?> produk</span>
                </a>
            <?php endforeach; ?>
        </div>
    </section>
    <?php
}

/** Grid produk gaya mockup — kartu glass: gambar, judul, meta, harga biru, tombol. */
function sec_products_grid(array $products): void {
    $c = site_content('produk');
    if (empty($c['enabled'])) return;
    $ids = array_map('strval', (array)($c['ids'] ?? []));
    $list = $ids
        ? array_values(array_filter($products, fn($p) => in_array((string)$p['id'], $ids, true)))
        : array_slice($products, 0, 8);
    if ($ids) usort($list, fn($a, $z) => array_search((string)$a['id'], $ids) <=> array_search((string)$z['id'], $ids));
    $list = array_slice($list, 0, 8);
    if (!count($list)) return;
    ?>
    <section id="produk" class="pk-sec" data-reveal>
        <div class="pk-shead">
            <div class="pk-shead-l">
                <span class="pk-shead-ico"><i class="fa-solid fa-fire"></i></span>
                <h2 class="pk-shead-title"><?= h($c['title'] ?? 'Produk Terlaris') ?></h2>
            </div>
            <a href="produk.php" class="pk-shead-more">Lihat semua <i class="fa-solid fa-arrow-right" style="font-size:.8em"></i></a>
        </div>
        <div class="pk-bs-grid">
            <?php foreach ($list as $i => $p) echo bs_card_html($p, $i, $i < 3); ?>
        </div>
        <div style="text-align:center;margin-top:1.8rem"><a href="produk.php" class="co-btn pk-btn-ghost">Lihat Semua Produk <i class="fa-solid fa-arrow-right" style="font-size:.8em"></i></a></div>
    </section>
    <?php
}

/** Tiga kartu nilai/keunggulan (glass) — "Kenapa Kami". */
function sec_services(): void {
    $items = [
        ['fa-truck-fast', 'Pengerjaan Cepat', 'Proses produksi kilat — banyak item bisa siap di hari yang sama untuk kondisi mendesak.'],
        ['fa-medal', 'Kualitas Premium', 'Mesin cetak terkini dan material terbaik untuk hasil tajam, warna akurat, dan awet.'],
        ['fa-headset', 'Support & Desain', 'Tim kami siap membantu menyiapkan dan merapikan file desain Anda, kapan saja.'],
    ];
    ?>
    <section class="pk-sec" data-reveal>
        <div class="pk-svc-grid">
            <?php foreach ($items as [$ic, $t, $d]): ?>
                <div class="glass pk-svc" data-reveal-item>
                    <i class="fa-solid <?= $ic ?> pk-svc-icon"></i>
                    <div><h3 class="pk-svc-title"><?= h($t) ?></h3><p class="pk-svc-desc"><?= h($d) ?></p></div>
                </div>
            <?php endforeach; ?>
        </div>
    </section>
    <?php
}
