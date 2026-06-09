<?php
require_once __DIR__ . '/lib.php';

$id = (int)($_GET['id'] ?? 0);
$p = $id ? api_get('/products/public/' . $id) : null;

// Tambah ke keranjang
if ($p && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $variantId = $_POST['variant'] ?? '';
    $qty = max(1, (int)($_POST['qty'] ?? 1));
    $variant = null;
    foreach (($p['variants'] ?? []) as $v) {
        if ((string)$v['id'] === (string)$variantId) { $variant = $v; break; }
    }
    if (!$variant && !empty($p['variants'])) $variant = $p['variants'][0];
    $price = $variant ? (float)$variant['price'] : product_price($p);
    $name = $p['name'] . ($variant && !empty($variant['variantName']) ? ' - ' . $variant['variantName'] : '');
    $_SESSION['cart'][] = [
        'productVariantId' => $variant ? (int)$variant['id'] : null,
        'description'      => $name,
        'quantity'         => $qty,
        'unitPrice'        => $price,
        'image'            => product_image($p),
    ];
    header('Location: cart.php');
    exit;
}

include __DIR__ . '/header.php';

if (!$p) {
    echo '<p class="muted">Produk tidak ditemukan. <a href="index.php">Kembali</a></p>';
    include __DIR__ . '/footer.php';
    exit;
}
$img = product_image($p);
$variants = $p['variants'] ?? [];
?>
<a class="back" href="index.php">← Semua produk</a>
<div class="detail">
    <div class="detail-img"><?php if ($img): ?><img src="<?= h($img) ?>" alt="<?= h($p['name']) ?>"><?php endif; ?></div>
    <div class="detail-info">
        <?php if (!empty($p['category']['name'])): ?><span class="cat"><?= h($p['category']['name']) ?></span><?php endif; ?>
        <h1><?= h($p['name']) ?></h1>
        <div class="price big"><?= rupiah(product_price($p)) ?></div>
        <?php if (!empty($p['description'])): ?><p class="desc"><?= nl2br(h($p['description'])) ?></p><?php endif; ?>

        <form method="post" class="buy">
            <?php if (count($variants) > 1): ?>
                <label>Pilihan
                    <select name="variant">
                        <?php foreach ($variants as $v): ?>
                            <option value="<?= h($v['id']) ?>"><?= h($v['variantName'] ?: $p['name']) ?> — <?= rupiah($v['price']) ?></option>
                        <?php endforeach; ?>
                    </select>
                </label>
            <?php elseif (count($variants) === 1): ?>
                <input type="hidden" name="variant" value="<?= h($variants[0]['id']) ?>">
            <?php endif; ?>
            <label>Jumlah <input type="number" name="qty" value="1" min="1"></label>
            <button type="submit" class="btn-primary">+ Keranjang</button>
        </form>
    </div>
</div>
<?php include __DIR__ . '/footer.php'; ?>
