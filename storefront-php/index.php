<?php
require_once __DIR__ . '/lib.php';
include __DIR__ . '/header.php';

$products = api_get('/products/public') ?: [];
$q   = trim($_GET['q'] ?? '');
$cat = $_GET['cat'] ?? '';

// Kumpulkan kategori
$cats = [];
foreach ($products as $p) {
    $c = $p['category'] ?? null;
    if ($c && !isset($cats[$c['id']])) $cats[$c['id']] = $c['name'];
}

// Filter
$filtered = array_values(array_filter($products, function ($p) use ($q, $cat) {
    $pid = (string)($p['categoryId'] ?? ($p['category']['id'] ?? ''));
    if ($cat !== '' && $pid !== (string)$cat) return false;
    if ($q !== '' && stripos($p['name'] ?? '', $q) === false) return false;
    return true;
}));
?>
<h1 class="page-title">Produk Kami</h1>

<form class="filter" method="get">
    <input type="text" name="q" value="<?= h($q) ?>" placeholder="Cari produk...">
    <select name="cat" onchange="this.form.submit()">
        <option value="">Semua kategori</option>
        <?php foreach ($cats as $id => $name): ?>
            <option value="<?= h($id) ?>" <?= (string)$cat === (string)$id ? 'selected' : '' ?>><?= h($name) ?></option>
        <?php endforeach; ?>
    </select>
    <button type="submit">Cari</button>
</form>

<?php if (!count($filtered)): ?>
    <p class="muted">Tidak ada produk ditemukan.</p>
<?php else: ?>
    <div class="grid">
        <?php foreach ($filtered as $p): $img = product_image($p); ?>
            <a class="card" href="product.php?id=<?= h($p['id']) ?>">
                <div class="thumb"><?php if ($img): ?><img src="<?= h($img) ?>" alt="<?= h($p['name']) ?>"><?php endif; ?></div>
                <div class="card-body">
                    <?php if (!empty($p['category']['name'])): ?><span class="cat"><?= h($p['category']['name']) ?></span><?php endif; ?>
                    <div class="name"><?= h($p['name']) ?></div>
                    <div class="price"><?= rupiah(product_price($p)) ?></div>
                </div>
            </a>
        <?php endforeach; ?>
    </div>
<?php endif; ?>

<?php include __DIR__ . '/footer.php'; ?>
