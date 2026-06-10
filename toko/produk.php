<?php
require_once __DIR__ . '/lib.php';
require_once __DIR__ . '/home_blocks.php';

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

<!-- Header katalog -->
<div class="rounded-3xl bg-gradient-to-br from-brand to-sky-600 text-white p-6 sm:p-8 mb-6 relative overflow-hidden">
    <div class="absolute -top-12 -right-8 w-56 h-56 rounded-full bg-white/10 blur-2xl"></div>
    <nav class="relative text-xs text-white/70 mb-2"><a href="index.php" class="hover:text-white">Beranda</a> <span class="mx-1">/</span> <span class="text-white">Produk</span><?php if ($catName): ?> <span class="mx-1">/</span> <span class="text-white"><?= h($catName) ?></span><?php endif; ?></nav>
    <h1 class="relative text-2xl sm:text-3xl font-extrabold">
        <?php if ($q !== ''): ?>Pencarian "<?= h($q) ?>"<?php elseif ($catName): ?><?= h($catName) ?><?php else: ?>Semua Produk<?php endif; ?>
    </h1>
    <p class="relative text-white/85 text-sm mt-1"><?= count($list) ?> produk siap dipesan di <?= h($shop) ?></p>
</div>

<div class="grid lg:grid-cols-[230px_1fr] gap-6 items-start">
    <!-- Sidebar kategori (desktop) -->
    <aside class="hidden lg:block sticky top-20 bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div class="px-4 py-3 border-b border-slate-100 font-bold text-slate-900 text-sm">Kategori</div>
        <ul class="p-2">
            <li>
                <a href="<?= h($qs(['cat' => ''])) ?>" class="flex items-center justify-between px-3 py-2 rounded-lg text-sm <?= $cat === '' ? 'bg-brand/10 text-brand font-semibold' : 'text-slate-600 hover:bg-slate-50' ?>">
                    <span>Semua Produk</span><span class="text-xs <?= $cat === '' ? 'text-brand' : 'text-slate-400' ?>"><?= $totalCount ?></span>
                </a>
            </li>
            <?php foreach ($cats as $id => $name): $cnt = $catCount[$id] ?? 0; ?>
                <li>
                    <a href="<?= h($qs(['cat' => $id])) ?>" class="flex items-center justify-between px-3 py-2 rounded-lg text-sm <?= (string)$cat === (string)$id ? 'bg-brand/10 text-brand font-semibold' : 'text-slate-600 hover:bg-slate-50' ?>">
                        <span class="truncate pr-2"><?= h($name) ?></span><span class="text-xs <?= (string)$cat === (string)$id ? 'text-brand' : 'text-slate-400' ?>"><?= $cnt ?></span>
                    </a>
                <?php endforeach; ?>
        </ul>
    </aside>

    <!-- Konten -->
    <div>
        <!-- Kategori chips (mobile) -->
        <div class="lg:hidden flex gap-2 overflow-x-auto pb-2 mb-3 -mx-1 px-1">
            <a href="<?= h($qs(['cat' => ''])) ?>" class="shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium <?= $cat === '' ? 'bg-brand text-white' : 'bg-white border border-slate-200 text-slate-600' ?>">Semua (<?= $totalCount ?>)</a>
            <?php foreach ($cats as $id => $name): ?>
                <a href="<?= h($qs(['cat' => $id])) ?>" class="shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium <?= (string)$cat === (string)$id ? 'bg-brand text-white' : 'bg-white border border-slate-200 text-slate-600' ?>"><?= h($name) ?></a>
            <?php endforeach; ?>
        </div>

        <!-- Toolbar -->
        <div class="flex items-center justify-between gap-3 bg-white rounded-xl border border-slate-200 px-4 py-2.5 mb-5">
            <span class="text-sm text-slate-500">Menampilkan <b class="text-slate-800"><?= $fromItem ?>&ndash;<?= $toItem ?></b> dari <b class="text-slate-800"><?= $totalItems ?></b> produk</span>
            <form method="get" class="flex items-center gap-2">
                <?php if ($q !== ''): ?><input type="hidden" name="q" value="<?= h($q) ?>"><?php endif; ?>
                <?php if ($cat !== ''): ?><input type="hidden" name="cat" value="<?= h($cat) ?>"><?php endif; ?>
                <label class="text-sm text-slate-400 hidden sm:inline">Urutkan</label>
                <select name="sort" onchange="this.form.submit()" class="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand/50">
                    <option value="">Unggulan</option>
                    <option value="murah" <?= $sort === 'murah' ? 'selected' : '' ?>>Harga termurah</option>
                    <option value="mahal" <?= $sort === 'mahal' ? 'selected' : '' ?>>Harga tertinggi</option>
                    <option value="nama" <?= $sort === 'nama' ? 'selected' : '' ?>>Nama A-Z</option>
                </select>
            </form>
        </div>

        <!-- Active filter -->
        <?php if ($q !== '' || $cat !== ''): ?>
            <div class="flex items-center flex-wrap gap-2 mb-4 text-sm">
                <span class="text-slate-400">Filter aktif:</span>
                <?php if ($q !== ''): ?><span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">"<?= h($q) ?>"</span><?php endif; ?>
                <?php if ($catName): ?><span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600"><?= h($catName) ?></span><?php endif; ?>
                <a href="produk.php" class="text-brand font-medium hover:underline">Hapus semua</a>
            </div>
        <?php endif; ?>

        <!-- Grid / kosong -->
        <?php if (!count($list)): ?>
            <div class="text-center py-20 bg-white rounded-2xl border border-slate-200">
                <div class="w-16 h-16 mx-auto rounded-2xl bg-slate-100 grid place-items-center text-slate-300 mb-3">
                    <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M11 17a6 6 0 100-12 6 6 0 000 12z"/></svg>
                </div>
                <p class="text-slate-600 font-medium">Produk tidak ditemukan</p>
                <p class="text-sm text-slate-400 mt-1">Coba kata kunci lain atau lihat semua produk.</p>
                <a href="produk.php" class="inline-block mt-4 px-5 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:opacity-90">Lihat semua produk</a>
            </div>
        <?php else: ?>
            <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                <?php foreach ($pageList as $i => $p) echo product_card_html($p, $i, $shop, false); ?>
            </div>

            <?php if ($totalPages > 1): ?>
                <nav class="mt-8 flex items-center justify-center gap-1.5 flex-wrap" aria-label="Halaman">
                    <?php if ($pageNum > 1): ?>
                        <a href="<?= h($qs(['page' => $pageNum - 1])) ?>" class="h-10 px-3 inline-flex items-center rounded-xl bg-white border border-slate-200 text-sm font-medium text-slate-600 hover:border-brand hover:text-brand transition">&larr; Sebelumnya</a>
                    <?php endif; ?>
                    <?php $dots = false; for ($pp = 1; $pp <= $totalPages; $pp++):
                        if ($pp !== 1 && $pp !== $totalPages && abs($pp - $pageNum) > 2) { if (!$dots) { echo '<span class="px-1 text-slate-400">…</span>'; $dots = true; } continue; }
                        $dots = false; ?>
                        <a href="<?= h($qs(['page' => $pp])) ?>" class="h-10 w-10 inline-flex items-center justify-center rounded-xl text-sm font-semibold transition <?= $pp === $pageNum ? 'bg-brand text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-brand hover:text-brand' ?>"><?= $pp ?></a>
                    <?php endfor; ?>
                    <?php if ($pageNum < $totalPages): ?>
                        <a href="<?= h($qs(['page' => $pageNum + 1])) ?>" class="h-10 px-3 inline-flex items-center rounded-xl bg-white border border-slate-200 text-sm font-medium text-slate-600 hover:border-brand hover:text-brand transition">Berikutnya &rarr;</a>
                    <?php endif; ?>
                </nav>
            <?php endif; ?>
        <?php endif; ?>
    </div>
</div>

<?php include __DIR__ . '/footer.php'; ?>
