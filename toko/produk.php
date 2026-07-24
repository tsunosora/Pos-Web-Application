<?php
require_once __DIR__ . '/lib.php';
require_once __DIR__ . '/home_blocks.php';
require_once __DIR__ . '/content_store.php';

$st   = settings();
$shop = $st['storeName'] ?? 'Toko';
$products = public_products();

$q    = trim($_GET['q'] ?? '');
$cat  = $_GET['cat'] ?? '';
$sort = $_GET['sort'] ?? '';

// Kategori unik + hitung jumlah (dihitung dari hasil pencarian aktif → informatif)
$cats = [];
foreach ($products as $p) {
    $c = $p['category'] ?? null;
    if ($c && !isset($cats[$c['id']])) $cats[$c['id']] = $c['name'];
}
$bySearch = $q === '' ? $products : array_values(array_filter($products, fn($p) => stripos($p['name'] ?? '', $q) !== false));
$catCount = [];
foreach ($bySearch as $p) {
    $cid = (string)($p['categoryId'] ?? ($p['category']['id'] ?? ''));
    if ($cid !== '') $catCount[$cid] = ($catCount[$cid] ?? 0) + 1;
}
$totalCount = count($bySearch);

// Filter kategori + sortir
$list = $cat === '' ? $bySearch : array_values(array_filter($bySearch, fn($p) => (string)($p['categoryId'] ?? ($p['category']['id'] ?? '')) === (string)$cat));
switch ($sort) {
    case 'murah': usort($list, fn($a, $b) => product_price($a) <=> product_price($b)); break;
    case 'mahal': usort($list, fn($a, $b) => product_price($b) <=> product_price($a)); break;
    case 'nama':  usort($list, fn($a, $b) => strcasecmp($a['name'] ?? '', $b['name'] ?? '')); break;
}

$catName = $cat !== '' ? ($cats[$cat] ?? '') : '';
$qs = fn($over) => 'produk.php?' . http_build_query(array_filter(array_merge(['q' => $q, 'cat' => $cat, 'sort' => $sort], $over), fn($v) => $v !== '' && $v !== null));

// Pagination (link kategori/sortir otomatis reset ke halaman 1 karena 'page' tidak ikut di $qs dasar)
$perPage    = 24;
$totalItems = count($list);
$totalPages = max(1, (int)ceil($totalItems / $perPage));
$pageNum    = min(max(1, (int)($_GET['page'] ?? 1)), $totalPages);
$pageList   = array_slice($list, ($pageNum - 1) * $perPage, $perPage);
$fromItem   = $totalItems ? ($pageNum - 1) * $perPage + 1 : 0;
$toItem     = min($pageNum * $perPage, $totalItems);

// ── SEO ──────────────────────────────────────────────────────────────────────
if ($q !== '')       { $seo_title = 'Cari "' . $q . '" — ' . $shop; $seo_robots = 'noindex,follow'; }
elseif ($catName)    { $seo_title = $catName . ' — ' . $shop; }
else                 { $seo_title = 'Semua Produk — ' . $shop; }
$seo_desc = meta_desc(($catName ?: 'Semua produk') . ' di ' . $shop . '. ' . count($list) . ' produk siap dipesan, harga bersahabat, pesan online.');
$seo_canonical = $cat !== '' ? abs_url('produk.php?cat=' . urlencode($cat)) : abs_url('produk.php');
$crumbs = [['n' => 'Beranda', 'u' => abs_url('index.php')], ['n' => 'Produk', 'u' => abs_url('produk.php')]];
if ($catName) $crumbs[] = ['n' => $catName, 'u' => $seo_canonical];
$seo_jsonld = json_encode(['@context' => 'https://schema.org', '@type' => 'BreadcrumbList', 'itemListElement' => array_map(fn($c, $i) => ['@type' => 'ListItem', 'position' => $i + 1, 'name' => $c['n'], 'item' => $c['u']], $crumbs, array_keys($crumbs))], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
include __DIR__ . '/header.php';
?>

<?php
$kat = site_content('katalog');
$isDefault = ($q === '' && $cat === '');
$promoSlides = array_values(array_filter($kat['slides'] ?? [], fn($s) => trim($s['title'] ?? '') !== '' || trim($s['image'] ?? '') !== ''));
// Judul kontekstual untuk header ringkas
if ($q !== '')      { $hTitle = 'Hasil pencarian "' . $q . '"'; $hSub = $totalCount . ' produk ditemukan'; }
elseif ($catName)   { $hTitle = $catName; $hSub = ($catCount[$cat] ?? count($list)) . ' produk dalam kategori ini'; }
else                { $hTitle = 'Semua Produk'; $hSub = count($list) . ' produk siap dipesan di ' . $shop; }
?>

<!-- Atas katalog: teks kategori (kiri) + kartu slider promo (kanan) -->
<?php $hasPromo = !empty($kat['enabled']) && $promoSlides; ?>
<div class="pk-cattop <?= $hasPromo ? 'pk-cattop--promo' : '' ?>" data-reveal>
    <div class="pk-cattop-head">
        <nav class="pk-cathead-bc">
            <a href="index.php">Beranda</a><span>/</span>
            <?php if ($q !== '' || $catName): ?><a href="produk.php">Produk</a><?php if ($catName): ?><span>/</span><span><?= h($catName) ?></span><?php endif; ?><?php else: ?><span>Produk</span><?php endif; ?>
        </nav>
        <h1 class="pk-cathead-title"><?= h($hTitle) ?></h1>
        <p class="pk-cathead-count"><?= $hSub ?></p>
    </div>

    <?php if ($hasPromo): ?>
    <div class="pk-cattop-promo">
        <div class="hero-swiper swiper" data-hero-swiper>
            <div class="swiper-wrapper">
                <?php foreach ($promoSlides as $s): $img = trim($s['image'] ?? '');
                    $pStyle = $img ? 'background-image:linear-gradient(180deg, rgba(13,20,70,.15), rgba(13,20,70,.82)), url(' . h($img) . ');' : ''; ?>
                    <div class="swiper-slide !h-auto">
                        <div class="pk-pcard <?= $img ? 'pk-pcard--img' : 'glass' ?>" style="<?= $pStyle ?>">
                            <?php if (!empty($s['badge'])): ?><span class="pk-pcard-badge"><i class="fa-solid fa-bolt"></i> <?= h($s['badge']) ?></span><?php endif; ?>
                            <div class="pk-pcard-body">
                                <h3 class="pk-pcard-title"><?= h($s['title']) ?></h3>
                                <?php if (!empty($s['subtitle'])): ?><p class="pk-pcard-sub"><?= h($s['subtitle']) ?></p><?php endif; ?>
                                <?php if (!empty($s['btnText'])): ?><a href="<?= h($s['btnLink'] ?: '#') ?>" class="pk-pcard-btn"><?= h($s['btnText']) ?> <i class="fa-solid fa-arrow-right" style="font-size:.75em"></i></a><?php endif; ?>
                            </div>
                        </div>
                    </div>
                <?php endforeach; ?>
            </div>
            <?php if (count($promoSlides) > 1): ?>
                <div class="pk-pcard-nav">
                    <button type="button" class="hero2-prev pk-arrow pk-arrow--sm" aria-label="Promo sebelumnya"><svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.6"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg></button>
                    <button type="button" class="hero2-next pk-arrow pk-arrow--sm" aria-label="Promo berikutnya"><svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.6"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg></button>
                </div>
            <?php endif; ?>
        </div>
    </div>
    <?php endif; ?>
</div>
<div class="pk-cattop-line"></div>

<div class="grid lg:grid-cols-[220px_1fr] gap-8 lg:gap-12 items-start">
    <!-- Sidebar kategori (desktop) -->
    <aside class="hidden lg:block sticky top-20">
        <div class="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-4 pb-3 border-b border-slate-200">Kategori</div>
        <ul class="space-y-0.5">
            <li>
                <a href="<?= h($qs(['cat' => ''])) ?>" class="flex items-center justify-between px-3 py-2 rounded-lg text-sm transition <?= $cat === '' ? 'bg-brand text-white font-semibold' : 'text-slate-600 hover:bg-slate-100' ?>">
                    <span>Semua Produk</span><span class="text-xs <?= $cat === '' ? 'text-white/60' : 'text-slate-400' ?>"><?= $totalCount ?></span>
                </a>
            </li>
            <?php foreach ($cats as $id => $name): $cnt = $catCount[$id] ?? 0; ?>
                <li>
                    <a href="<?= h($qs(['cat' => $id])) ?>" class="flex items-center justify-between px-3 py-2 rounded-lg text-sm transition <?= (string)$cat === (string)$id ? 'bg-brand text-white font-semibold' : 'text-slate-600 hover:bg-slate-100' ?>">
                        <span class="truncate pr-2"><?= h($name) ?></span><span class="text-xs <?= (string)$cat === (string)$id ? 'text-white/60' : 'text-slate-400' ?>"><?= $cnt ?></span>
                    </a>
                </li>
            <?php endforeach; ?>
        </ul>
    </aside>

    <!-- Konten -->
    <div>
        <!-- Kategori chips (mobile) -->
        <div class="lg:hidden flex gap-2 overflow-x-auto pb-2 mb-4 -mx-1 px-1">
            <a href="<?= h($qs(['cat' => ''])) ?>" class="shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium transition <?= $cat === '' ? 'bg-brand text-white' : 'bg-white border border-slate-200 text-slate-600' ?>">Semua (<?= $totalCount ?>)</a>
            <?php foreach ($cats as $id => $name): ?>
                <a href="<?= h($qs(['cat' => $id])) ?>" class="shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium transition <?= (string)$cat === (string)$id ? 'bg-brand text-white' : 'bg-white border border-slate-200 text-slate-600' ?>"><?= h($name) ?></a>
            <?php endforeach; ?>
        </div>

        <!-- Toolbar -->
        <div class="flex items-center justify-between gap-3 border-b border-slate-200 pb-3 mb-7">
            <span class="text-sm text-slate-500">Menampilkan <b class="text-slate-900 font-semibold"><?= $fromItem ?>&ndash;<?= $toItem ?></b> dari <b class="text-slate-900 font-semibold"><?= $totalItems ?></b> produk</span>
            <form method="get" class="flex items-center gap-2">
                <?php if ($q !== ''): ?><input type="hidden" name="q" value="<?= h($q) ?>"><?php endif; ?>
                <?php if ($cat !== ''): ?><input type="hidden" name="cat" value="<?= h($cat) ?>"><?php endif; ?>
                <label class="text-xs font-semibold uppercase tracking-wide text-slate-400 hidden sm:inline">Urutkan</label>
                <select name="sort" onchange="this.form.submit()" class="px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/30">
                    <option value="">Unggulan</option>
                    <option value="murah" <?= $sort === 'murah' ? 'selected' : '' ?>>Harga termurah</option>
                    <option value="mahal" <?= $sort === 'mahal' ? 'selected' : '' ?>>Harga tertinggi</option>
                    <option value="nama" <?= $sort === 'nama' ? 'selected' : '' ?>>Nama A-Z</option>
                </select>
            </form>
        </div>

        <!-- Active filter -->
        <?php if ($q !== '' || $cat !== ''): ?>
            <div class="flex items-center flex-wrap gap-2 mb-5 text-sm">
                <span class="text-slate-400">Filter aktif:</span>
                <?php if ($q !== ''): ?><span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-slate-200 text-slate-600">&ldquo;<?= h($q) ?>&rdquo;</span><?php endif; ?>
                <?php if ($catName): ?><span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-slate-200 text-slate-600"><?= h($catName) ?></span><?php endif; ?>
                <a href="produk.php" class="text-slate-900 font-medium underline underline-offset-4 decoration-slate-300 hover:decoration-slate-900">Hapus semua</a>
            </div>
        <?php endif; ?>

        <!-- Grid / kosong -->
        <?php if (!count($list)): ?>
            <div class="text-center py-20 border border-slate-200 rounded-2xl">
                <div class="w-14 h-14 mx-auto rounded-full border border-slate-200 grid place-items-center text-slate-300 mb-4">
                    <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M11 17a6 6 0 100-12 6 6 0 000 12z"/></svg>
                </div>
                <p class="font-head font-bold text-slate-900">Produk tidak ditemukan</p>
                <p class="text-sm text-slate-400 mt-1">Coba kata kunci lain atau lihat semua produk.</p>
                <a href="produk.php" class="co-btn co-btn--dark mt-5 text-sm">Lihat semua produk</a>
            </div>
        <?php else: ?>
            <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                <?php foreach ($pageList as $i => $p) echo bs_card_html($p, $i); ?>
            </div>

            <?php if ($totalPages > 1): ?>
                <nav class="mt-10 flex items-center justify-center gap-1.5 flex-wrap" aria-label="Halaman">
                    <?php if ($pageNum > 1): ?>
                        <a href="<?= h($qs(['page' => $pageNum - 1])) ?>" class="h-10 px-3 inline-flex items-center rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:border-brand hover:text-brand transition">&larr; Sebelumnya</a>
                    <?php endif; ?>
                    <?php $dots = false; for ($pp = 1; $pp <= $totalPages; $pp++):
                        if ($pp !== 1 && $pp !== $totalPages && abs($pp - $pageNum) > 2) { if (!$dots) { echo '<span class="px-1 text-slate-400">…</span>'; $dots = true; } continue; }
                        $dots = false; ?>
                        <a href="<?= h($qs(['page' => $pp])) ?>" class="h-10 w-10 inline-flex items-center justify-center rounded-lg text-sm font-semibold transition <?= $pp === $pageNum ? 'bg-brand text-white' : 'border border-slate-200 text-slate-600 hover:border-brand hover:text-brand' ?>"><?= $pp ?></a>
                    <?php endfor; ?>
                    <?php if ($pageNum < $totalPages): ?>
                        <a href="<?= h($qs(['page' => $pageNum + 1])) ?>" class="h-10 px-3 inline-flex items-center rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:border-brand hover:text-brand transition">Berikutnya &rarr;</a>
                    <?php endif; ?>
                </nav>
            <?php endif; ?>
        <?php endif; ?>
    </div>
</div>

<?php include __DIR__ . '/footer.php'; ?>
