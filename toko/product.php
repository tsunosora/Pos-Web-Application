<?php
require_once __DIR__ . '/lib.php';
require_once __DIR__ . '/home_blocks.php';

$id = (int)($_GET['id'] ?? 0);
$p = $id ? api_get('/products/public/' . $id) : null;
if ($p && product_is_hidden($p)) $p = null; // bahan baku / kategori disembunyikan

// Tambah ke keranjang lalu redirect ke cart
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

// ── SEO ──────────────────────────────────────────────────────────────────────
$st = settings();
if ($p) {
    $pimg  = product_image($p);
    $price = product_price($p);
    $seo_title     = ($p['name'] ?? 'Produk') . ' — ' . ($st['storeName'] ?? 'Toko');
    $seo_desc      = meta_desc(!empty($p['description']) ? $p['description'] : (($p['name'] ?? 'Produk') . ' di ' . ($st['storeName'] ?? 'toko') . '. Pesan online, respon cepat, hasil rapi.'));
    $seo_image     = $pimg ?: null;
    $seo_type      = 'product';
    $seo_canonical = abs_url('product.php?id=' . (int)$p['id']);
    $ld = ['@context' => 'https://schema.org', '@type' => 'Product', 'name' => $p['name'] ?? '', 'description' => meta_desc($p['description'] ?? ($p['name'] ?? ''), 300)];
    if ($pimg) $ld['image'] = $pimg;
    if (!empty($p['category']['name'])) $ld['category'] = $p['category']['name'];
    if ($price > 0) $ld['offers'] = ['@type' => 'Offer', 'price' => (string)$price, 'priceCurrency' => 'IDR', 'availability' => 'https://schema.org/InStock', 'url' => $seo_canonical, 'seller' => ['@type' => 'Organization', 'name' => $st['storeName'] ?? 'Toko']];
    $seo_jsonld = json_encode($ld, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
} else {
    $seo_title  = 'Produk tidak ditemukan';
    $seo_robots = 'noindex,follow';
}

include __DIR__ . '/header.php';

if (!$p) {
    echo '<div class="text-center py-20 text-slate-400"><p class="text-lg">Produk tidak ditemukan.</p><a href="index.php" class="text-brand font-medium hover:underline">Kembali ke beranda</a></div>';
    include __DIR__ . '/footer.php';
    exit;
}
$img = product_image($p);
$variants = $p['variants'] ?? [];

// Galeri: gambar produk + gambar tiap varian (unik, non-kosong)
$gallery = [];
if (!empty($p['imageUrl'])) $gallery[] = img_url($p['imageUrl']);
foreach ($variants as $v) {
    if (!empty($v['imageUrl'])) $gallery[] = img_url($v['imageUrl']);
}
$gallery = array_values(array_unique(array_filter($gallery)));
if (!$gallery && $img) $gallery[] = $img;

// Tombol WhatsApp (nomor toko dari PosPro)
$waNum  = preg_replace('/^0/', '62', preg_replace('/\D/', '', $st['storePhone'] ?? ''));
$waText = rawurlencode('Halo ' . ($st['storeName'] ?? '') . ', saya mau tanya produk "' . ($p['name'] ?? '') . '" — ' . abs_url('product.php?id=' . (int)$p['id']));

// Produk terkait (kategori sama)
$related = [];
$cid = (string)($p['categoryId'] ?? ($p['category']['id'] ?? ''));
if ($cid !== '') {
    foreach (public_products() as $rp) {
        if ((string)($rp['id'] ?? '') === (string)$p['id']) continue;
        if ((string)($rp['categoryId'] ?? ($rp['category']['id'] ?? '')) !== $cid) continue;
        $related[] = $rp;
        if (count($related) >= 4) break;
    }
}
?>

<nav class="text-sm text-slate-400 mb-5 flex items-center gap-1.5 flex-wrap">
    <a href="index.php" class="hover:text-brand">Beranda</a><span>/</span>
    <a href="produk.php" class="hover:text-brand">Produk</a>
    <?php if (!empty($p['category']['name'])): ?><span>/</span><a href="produk.php?cat=<?= h($cid) ?>" class="hover:text-brand"><?= h($p['category']['name']) ?></a><?php endif; ?>
    <span>/</span><span class="text-slate-600 truncate max-w-[200px]"><?= h($p['name']) ?></span>
</nav>

<div class="grid md:grid-cols-2 gap-8 bg-white rounded-3xl border border-slate-200 p-5 sm:p-8">
    <div>
        <div class="aspect-square rounded-2xl bg-slate-100 overflow-hidden">
            <?php if ($gallery): ?>
                <img id="mainImg" src="<?= h($gallery[0]) ?>" alt="<?= h($p['name']) ?>" class="w-full h-full object-cover">
            <?php else: ?>
                <div class="w-full h-full grid place-items-center text-slate-300">
                    <svg class="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 19.5h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5z"/></svg>
                </div>
            <?php endif; ?>
        </div>
        <?php if (count($gallery) > 1): ?>
            <div class="mt-3 flex gap-2 overflow-x-auto pb-1">
                <?php foreach ($gallery as $gi => $g): ?>
                    <button type="button" data-thumb="<?= h($g) ?>" class="thumb shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 <?= $gi === 0 ? 'border-brand' : 'border-transparent hover:border-slate-300' ?> transition">
                        <img src="<?= h($g) ?>" alt="" class="w-full h-full object-cover">
                    </button>
                <?php endforeach; ?>
            </div>
        <?php endif; ?>
    </div>

    <div class="flex flex-col">
        <?php if (!empty($p['category']['name'])): ?>
            <span class="inline-block w-fit text-xs font-semibold text-brand bg-brand/10 px-2.5 py-1 rounded-full mb-3"><?= h($p['category']['name']) ?></span>
        <?php endif; ?>
        <h1 class="text-2xl sm:text-3xl font-extrabold text-slate-900 leading-tight"><?= h($p['name']) ?></h1>
        <div class="mt-3 flex items-baseline gap-2">
            <?php if (count($variants) > 1): ?><span class="text-sm text-slate-400">Mulai</span><?php endif; ?>
            <span id="prc" class="text-3xl font-extrabold text-brand" data-base="<?= product_price($p) ?>"><?= rupiah(product_price($p)) ?></span>
        </div>
        <?php if (!empty($p['description'])): ?>
            <p class="mt-4 text-slate-600 leading-relaxed"><?= nl2br(h($p['description'])) ?></p>
        <?php endif; ?>

        <form method="post" class="mt-auto pt-6 space-y-5">
            <?php if (count($variants) > 1): ?>
                <div>
                    <label class="block text-sm font-semibold text-slate-700 mb-2">Pilih Varian</label>
                    <div class="flex flex-wrap gap-2">
                        <?php foreach ($variants as $k => $v): ?>
                            <label class="cursor-pointer">
                                <input type="radio" name="variant" value="<?= h($v['id']) ?>" data-price="<?= (float)$v['price'] ?>" <?= $k === 0 ? 'checked' : '' ?> class="peer sr-only">
                                <span class="inline-flex flex-col px-4 py-2 rounded-xl border-2 border-slate-200 text-sm text-slate-700 peer-checked:border-brand peer-checked:bg-brand/5 peer-checked:text-brand hover:border-slate-300 transition">
                                    <span class="font-semibold"><?= h($v['variantName'] ?: $p['name']) ?></span>
                                    <span class="text-xs opacity-75"><?= rupiah($v['price']) ?></span>
                                </span>
                            </label>
                        <?php endforeach; ?>
                    </div>
                </div>
            <?php elseif (count($variants) === 1): ?>
                <input type="hidden" name="variant" value="<?= h($variants[0]['id']) ?>">
            <?php endif; ?>

            <div>
                <label class="block text-sm font-semibold text-slate-700 mb-2">Jumlah</label>
                <div class="flex items-center rounded-xl border border-slate-200 overflow-hidden w-fit">
                    <button type="button" data-step="-1" class="h-11 w-11 grid place-items-center text-slate-500 hover:bg-slate-50 text-lg font-bold" aria-label="Kurangi">&minus;</button>
                    <input id="qty" type="number" name="qty" value="1" min="1" class="w-16 h-11 text-center font-semibold border-x border-slate-200 focus:outline-none">
                    <button type="button" data-step="1" class="h-11 w-11 grid place-items-center text-slate-500 hover:bg-slate-50 text-lg font-bold" aria-label="Tambah">+</button>
                </div>
            </div>

            <div class="flex flex-col sm:flex-row gap-3">
                <button type="submit" class="flex-1 px-6 py-3.5 rounded-xl bg-brand text-white font-bold hover:opacity-90 active:scale-[.98] transition flex items-center justify-center gap-2">
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293A1 1 0 005.414 17H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
                    Tambah ke Keranjang
                </button>
                <?php if ($waNum): ?>
                    <a href="https://wa.me/<?= h($waNum) ?>?text=<?= $waText ?>" target="_blank" rel="noopener" class="flex-1 px-6 py-3.5 rounded-xl bg-emerald-500 text-white font-bold hover:bg-emerald-600 active:scale-[.98] transition flex items-center justify-center gap-2">
                        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.87 9.87 0 004.74 1.21c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0012.04 2zm0 18.13a8.2 8.2 0 01-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 01-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 012.41 5.83c0 4.54-3.7 8.23-8.23 8.23zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.8-.78.97-.14.16-.29.18-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.51.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.16 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.1-.23-.16-.48-.27z"/></svg>
                        Tanya via WhatsApp
                    </a>
                <?php endif; ?>
            </div>

            <div class="grid grid-cols-2 gap-2 pt-1">
                <div class="flex items-center gap-2 text-xs text-slate-500"><svg class="w-4 h-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>Respon cepat</div>
                <div class="flex items-center gap-2 text-xs text-slate-500"><svg class="w-4 h-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>Kualitas terjaga</div>
                <div class="flex items-center gap-2 text-xs text-slate-500"><svg class="w-4 h-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>Bisa custom desain</div>
                <div class="flex items-center gap-2 text-xs text-slate-500"><svg class="w-4 h-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>Antar &amp; kirim</div>
            </div>
        </form>
    </div>
</div>

<?php if ($related): ?>
    <section class="mt-10">
        <h2 class="text-xl sm:text-2xl font-extrabold text-slate-900 mb-4">Produk Serupa</h2>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <?php foreach ($related as $i => $rp) echo product_card_html($rp, $i, $st['storeName'] ?? ''); ?>
        </div>
    </section>
<?php endif; ?>

<script>
(function () {
    // Ganti gambar utama dari thumbnail
    var main = document.getElementById('mainImg');
    document.querySelectorAll('.thumb').forEach(function (t) {
        t.addEventListener('click', function () {
            if (main) main.src = t.dataset.thumb;
            document.querySelectorAll('.thumb').forEach(function (x) { x.classList.remove('border-brand'); x.classList.add('border-transparent'); });
            t.classList.add('border-brand'); t.classList.remove('border-transparent');
        });
    });
    // Update harga sesuai varian terpilih
    var prc = document.getElementById('prc');
    document.querySelectorAll('input[name="variant"][data-price]').forEach(function (r) {
        r.addEventListener('change', function () {
            if (prc) prc.textContent = 'Rp ' + Number(r.dataset.price).toLocaleString('id-ID');
        });
    });
    // Stepper jumlah
    var qty = document.getElementById('qty');
    document.querySelectorAll('[data-step]').forEach(function (b) {
        b.addEventListener('click', function () {
            qty.value = Math.max(1, (parseInt(qty.value, 10) || 1) + parseInt(b.dataset.step, 10));
        });
    });
})();
</script>

<?php include __DIR__ . '/footer.php'; ?>
