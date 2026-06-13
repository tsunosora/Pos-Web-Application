<?php
require_once __DIR__ . '/lib.php';
ensure_article_columns();
publish_due_articles(); // auto-terbit artikel terjadwal yang waktunya tiba

$st   = settings();
$brand = $st['storeName'] ?? 'Toko';
$slug = trim($_GET['slug'] ?? '');
$single = null;

if ($slug !== '') {
    $stm = db()->prepare("SELECT * FROM articles WHERE slug = ? AND status = 'PUBLISHED' LIMIT 1");
    $stm->execute([$slug]);
    $single = $stm->fetch();

    // Tracking baca (dedupe per sesi agar refresh tak menggelembungkan angka)
    if ($single) {
        $seen = $_SESSION['seen_articles'] ?? [];
        if (!in_array((int)$single['id'], $seen, true)) {
            try {
                db()->prepare('UPDATE articles SET views = views + 1 WHERE id = ?')->execute([$single['id']]);
                db()->prepare('INSERT INTO article_views (article_id, ip_hash, referrer, user_agent) VALUES (?,?,?,?)')
                    ->execute([
                        $single['id'],
                        hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . APP_KEY),
                        mb_substr($_SERVER['HTTP_REFERER'] ?? '', 0, 255),
                        mb_substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 255),
                    ]);
                $single['views']++;
            } catch (Throwable $e) {}
            $seen[] = (int)$single['id'];
            $_SESSION['seen_articles'] = $seen;
        }
    }
}

// ── SEO (dikonsumsi header.php) ──
if ($single) {
    $seo_title     = ($single['meta_title'] ?: $single['title']) . ' — ' . $brand;
    $seo_desc      = meta_desc($single['meta_description'] ?: $single['excerpt'] ?: $single['title']);
    $seo_image     = !empty($single['cover_url']) ? abs_url($single['cover_url']) : null;
    $seo_type      = 'article';
    $seo_canonical = abs_url('artikel.php?slug=' . urlencode($slug));
    $seo_jsonld = json_encode([
        '@context' => 'https://schema.org', '@type' => 'Article',
        'headline' => $single['title'],
        'description' => $seo_desc,
        'image' => $seo_image,
        'datePublished' => $single['published_at'] ?: $single['created_at'],
        'dateModified' => $single['updated_at'] ?? ($single['published_at'] ?: $single['created_at']),
        'author' => ['@type' => 'Organization', 'name' => $brand],
        'publisher' => ['@type' => 'Organization', 'name' => $brand],
        'mainEntityOfPage' => $seo_canonical,
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
} elseif ($slug !== '') {
    $seo_title  = 'Artikel tidak ditemukan — ' . $brand;
    $seo_robots = 'noindex,follow';
    $seo_canonical = abs_url('artikel.php');
} else {
    $seo_title     = 'Wawasan & Panduan — ' . $brand;
    $seo_desc      = meta_desc('Wawasan, panduan, dan tips seputar percetakan digital, branding, event, dan UMKM dari ' . $brand . '.');
    $seo_canonical = abs_url('artikel.php');
}

include __DIR__ . '/header.php';
?>

<?php if ($slug !== '' && !$single): ?>
    <div class="text-center py-24">
        <p class="font-head text-xl font-bold text-slate-900">Artikel tidak ditemukan.</p>
        <a href="artikel.php" class="co-btn co-btn--dark mt-5 text-sm">Lihat semua artikel</a>
    </div>

<?php elseif ($single): ?>
    <!-- ── Artikel tunggal ── -->
    <article class="max-w-3xl mx-auto">
        <a href="artikel.php" class="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors mb-8">
            <span class="h-7 w-7 grid place-items-center rounded-full border border-slate-200"><svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg></span>
            Semua artikel
        </a>
        <span class="co-kicker">Wawasan &amp; Panduan</span>
        <h1 class="font-head text-3xl sm:text-5xl font-extrabold text-slate-900 leading-[1.08] tracking-tight"><?= h($single['title']) ?></h1>
        <div class="mt-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
            <span><?= h(tgl($single['published_at'] ?: $single['created_at'])) ?></span>
            <span class="h-1 w-1 rounded-full bg-slate-300"></span>
            <span><?= (int)$single['views'] ?>&times; dibaca</span>
        </div>
        <?php if (!empty($single['cover_url'])): ?>
            <img src="<?= h($single['cover_url']) ?>" alt="<?= h($single['title']) ?>" class="w-full rounded-2xl border border-slate-200 mt-8 aspect-[16/9] object-cover">
        <?php endif; ?>
        <div class="prose-art mt-8"><?= $single['content'] ?></div>

        <!-- CTA penutup -->
        <div class="co-ink rounded-2xl mt-14 p-8 sm:p-10 text-center text-white relative overflow-hidden">
            <div class="co-band-glow" aria-hidden="true"></div>
            <div class="relative">
                <h2 class="font-head text-2xl sm:text-3xl font-extrabold leading-tight">Punya kebutuhan cetak?</h2>
                <p class="mt-3 text-white/60 max-w-md mx-auto text-sm leading-relaxed">Konsultasikan kebutuhan Anda — tim kami merespons dengan rekomendasi material dan estimasi biaya, tanpa kewajiban.</p>
                <a href="index.php#order-cepat" class="co-btn co-btn--invert mt-6">Mulai Konsultasi
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.4"><path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
                </a>
            </div>
        </div>
    </article>

    <?php
    // Artikel lainnya
    $others = db()->prepare("SELECT title, slug, excerpt, cover_url, published_at, created_at FROM articles WHERE status='PUBLISHED' AND id <> ? ORDER BY COALESCE(published_at, created_at) DESC LIMIT 3");
    $others->execute([$single['id']]);
    $others = $others->fetchAll();
    if ($others): ?>
        <section class="max-w-5xl mx-auto mt-16 pt-12 border-t border-slate-200">
            <div class="co-head"><div><span class="co-kicker">Lainnya</span><h2 class="co-h2">Baca Juga</h2></div></div>
            <div class="grid sm:grid-cols-3 gap-7">
                <?php foreach ($others as $a): ?>
                    <a href="artikel.php?slug=<?= h($a['slug']) ?>" class="group block" data-reveal-item>
                        <div class="aspect-[16/10] rounded-xl bg-slate-100 border border-slate-200 overflow-hidden">
                            <?php if (!empty($a['cover_url'])): ?><img src="<?= h($a['cover_url']) ?>" alt="" loading="lazy" class="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-700"><?php endif; ?>
                        </div>
                        <span class="block mt-4 text-[10px] font-semibold uppercase tracking-widest text-slate-400"><?= h(tgl($a['published_at'] ?: $a['created_at'])) ?></span>
                        <h3 class="font-head font-bold text-slate-900 leading-snug mt-1 line-clamp-2 group-hover:underline decoration-1 underline-offset-2"><?= h($a['title']) ?></h3>
                    </a>
                <?php endforeach; ?>
            </div>
        </section>
    <?php endif; ?>

<?php else: ?>
    <!-- ── Daftar artikel ── -->
    <?php $list = db()->query("SELECT title, slug, excerpt, cover_url, views, published_at, created_at FROM articles WHERE status='PUBLISHED' ORDER BY COALESCE(published_at, created_at) DESC")->fetchAll(); ?>

    <header class="mb-10 pb-8 border-b border-slate-200" data-reveal>
        <span class="co-kicker">Blog</span>
        <h1 class="co-h2">Wawasan &amp; Panduan</h1>
        <p class="co-sub">Tips dan referensi seputar percetakan digital, branding, event, dan UMKM dari <?= h($brand) ?>.</p>
    </header>

    <?php if (!count($list)): ?>
        <div class="text-center py-20 text-slate-400">Belum ada artikel.</div>
    <?php else: ?>
        <?php $feat = $list[0]; $rest = array_slice($list, 1); ?>
        <!-- Artikel unggulan -->
        <a href="artikel.php?slug=<?= h($feat['slug']) ?>" class="group grid md:grid-cols-2 gap-8 lg:gap-12 items-center mb-14 pb-14 border-b border-slate-200" data-reveal>
            <div class="aspect-[16/10] rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden order-1 md:order-none">
                <?php if (!empty($feat['cover_url'])): ?><img src="<?= h($feat['cover_url']) ?>" alt="<?= h($feat['title']) ?>" class="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-700"><?php endif; ?>
            </div>
            <div>
                <span class="co-kicker">Artikel Terbaru</span>
                <h2 class="font-head text-2xl sm:text-3xl font-extrabold text-slate-900 leading-tight tracking-tight group-hover:underline decoration-2 underline-offset-4"><?= h($feat['title']) ?></h2>
                <?php if (!empty($feat['excerpt'])): ?><p class="mt-3 text-slate-500 leading-relaxed line-clamp-3"><?= h($feat['excerpt']) ?></p><?php endif; ?>
                <span class="co-more mt-6">Baca selengkapnya <span class="co-more-ico"><svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 17L17 7M17 7H8m9 0v9"/></svg></span></span>
            </div>
        </a>

        <?php if ($rest): ?>
            <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-7 gap-y-10">
                <?php foreach ($rest as $a): ?>
                    <a href="artikel.php?slug=<?= h($a['slug']) ?>" class="group block" data-reveal-item>
                        <div class="aspect-[16/10] rounded-xl bg-slate-100 border border-slate-200 overflow-hidden">
                            <?php if (!empty($a['cover_url'])): ?>
                                <img src="<?= h($a['cover_url']) ?>" alt="<?= h($a['title']) ?>" loading="lazy" class="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-700">
                            <?php else: ?>
                                <div class="w-full h-full grid place-items-center text-slate-300"><svg class="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.4"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M4 6h16v12H4z"/></svg></div>
                            <?php endif; ?>
                        </div>
                        <span class="block mt-4 text-[10px] font-semibold uppercase tracking-widest text-slate-400"><?= h(tgl($a['published_at'] ?: $a['created_at'])) ?> &middot; <?= (int)$a['views'] ?>&times; dibaca</span>
                        <h2 class="font-head text-lg font-extrabold text-slate-900 leading-snug mt-1.5 line-clamp-2 group-hover:underline decoration-1 underline-offset-2"><?= h($a['title']) ?></h2>
                        <?php if (!empty($a['excerpt'])): ?><p class="mt-2 text-sm text-slate-500 line-clamp-2"><?= h($a['excerpt']) ?></p><?php endif; ?>
                    </a>
                <?php endforeach; ?>
            </div>
        <?php endif; ?>
    <?php endif; ?>
<?php endif; ?>

<?php include __DIR__ . '/footer.php'; ?>
