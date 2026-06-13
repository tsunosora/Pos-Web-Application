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
    $basePrice = $variant ? (float)$variant['price'] : product_price($p);
    $name = $p['name'] . ($variant && !empty($variant['variantName']) ? ' - ' . $variant['variantName'] : '');
    $item = [
        'productVariantId' => $variant ? (int)$variant['id'] : null,
        'description'      => $name,
        'quantity'         => $qty,
        'unitPrice'        => $basePrice,
        'image'            => product_image($p),
    ];

    if (product_is_area($p)) {
        // Produk per-luas: harga varian = harga per m², wajib isi ukuran (cm).
        // Subtotal = qty × (w×h/10000) × harga/m² — formula sama dengan POS & backend.
        $w = (float)str_replace(',', '.', (string)($_POST['width'] ?? ''));
        $h = (float)str_replace(',', '.', (string)($_POST['height'] ?? ''));
        if ($w <= 0 || $h <= 0) {
            header('Location: product.php?id=' . (int)$p['id'] . '&err=ukuran');
            exit;
        }
        $fmt = fn(float $n) => rtrim(rtrim(number_format($n, 2, '.', ''), '0'), '.');
        $item['widthCm']  = $w;
        $item['heightCm'] = $h;
        $item['unitType'] = 'cm';
        $item['description'] .= ' (' . $fmt($w) . '×' . $fmt($h) . ' cm)';
    } else {
        // Harga bertingkat (grosir): hitung ulang di server sesuai qty — jangan percaya harga dari client
        $item['unitPrice'] = $variant ? tier_price($qty, $basePrice, $variant['priceTiers'] ?? []) : $basePrice;
    }

    $_SESSION['cart'][] = $item;
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
$isArea = product_is_area($p);
$hasTiers = false;
foreach ($variants as $v) { if (!empty($v['priceTiers'])) { $hasTiers = true; break; } }
// Data varian untuk JS (harga dinamis: tier per qty & estimasi luas)
$jsVariants = array_values(array_map(fn($v) => [
    'id'    => (string)$v['id'],
    'price' => (float)$v['price'],
    'tiers' => array_values(array_map(fn($t) => [
        'minQty'   => (int)($t['minQty'] ?? 1),
        'maxQty'   => isset($t['maxQty']) && $t['maxQty'] !== null ? (int)$t['maxQty'] : null,
        'price'    => (float)($t['price'] ?? 0),
        'tierName' => $t['tierName'] ?? null,
    ], $v['priceTiers'] ?? [])),
], $variants));

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

<nav class="text-sm text-slate-400 mb-7 flex items-center gap-2 flex-wrap">
    <a href="index.php" class="hover:text-brand transition-colors">Beranda</a><span class="text-slate-300">/</span>
    <a href="produk.php" class="hover:text-brand transition-colors">Produk</a>
    <?php if (!empty($p['category']['name'])): ?><span class="text-slate-300">/</span><a href="produk.php?cat=<?= h($cid) ?>" class="hover:text-brand transition-colors"><?= h($p['category']['name']) ?></a><?php endif; ?>
    <span class="text-slate-300">/</span><span class="text-slate-600 truncate max-w-[200px]"><?= h($p['name']) ?></span>
</nav>

<div class="grid md:grid-cols-2 gap-8 lg:gap-14">
    <div>
        <div class="aspect-square rounded-xl bg-slate-50 border border-slate-200 overflow-hidden">
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
                    <button type="button" data-thumb="<?= h($g) ?>" class="thumb shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 <?= $gi === 0 ? 'border-brand' : 'border-transparent hover:border-slate-300' ?> transition">
                        <img src="<?= h($g) ?>" alt="" class="w-full h-full object-cover">
                    </button>
                <?php endforeach; ?>
            </div>
        <?php endif; ?>
    </div>

    <div class="flex flex-col">
        <?php if (!empty($p['category']['name'])): ?>
            <span class="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-3"><?= h($p['category']['name']) ?></span>
        <?php endif; ?>
        <h1 class="font-head text-3xl sm:text-4xl font-extrabold text-slate-900 leading-[1.1] tracking-tight"><?= h($p['name']) ?></h1>
        <div class="mt-4 flex items-baseline gap-2 pb-6 border-b border-slate-200">
            <?php if (count($variants) > 1): ?><span class="text-xs font-semibold uppercase tracking-wide text-slate-400">Mulai</span><?php endif; ?>
            <span id="prc" class="font-head text-3xl sm:text-4xl font-extrabold text-brand" data-base="<?= product_price($p) ?>"><?= rupiah(product_price($p)) ?></span>
            <?php if ($isArea): ?><span class="text-sm font-bold text-slate-400">/m²</span><?php endif; ?>
        </div>
        <?php if (isset($_GET['err']) && $_GET['err'] === 'ukuran'): ?>
            <div class="mt-4 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-medium">Mohon isi ukuran (panjang &times; lebar) yang valid dulu ya.</div>
        <?php endif; ?>
        <?php if (!empty($p['description'])): ?>
            <p class="mt-5 text-slate-600 leading-relaxed"><?= nl2br(h($p['description'])) ?></p>
        <?php endif; ?>

        <form method="post" class="mt-7 pt-7 border-t border-slate-200 space-y-6">
            <?php if (count($variants) === 1): ?><input type="hidden" name="variant" value="<?= h($variants[0]['id']) ?>"><?php endif; ?>
            <?php if (count($variants) > 1): ?>
                <div>
                    <label class="co-label !mb-2.5">Pilih Varian</label>
                    <div class="flex flex-wrap gap-2">
                        <?php foreach ($variants as $k => $v): ?>
                            <label class="cursor-pointer">
                                <input type="radio" name="variant" value="<?= h($v['id']) ?>" data-price="<?= (float)$v['price'] ?>" <?= $k === 0 ? 'checked' : '' ?> class="peer sr-only">
                                <span class="inline-flex flex-col px-4 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-700 peer-checked:border-brand peer-checked:bg-brand peer-checked:text-white hover:border-slate-400 transition">
                                    <span class="font-semibold"><?= h($v['variantName'] ?: $p['name']) ?></span>
                                    <span class="text-xs opacity-70"><?= rupiah($v['price']) ?></span>
                                </span>
                            </label>
                        <?php endforeach; ?>
                    </div>
                </div>
            <?php endif; ?>

            <?php if ($hasTiers && !$isArea): ?>
                <!-- Tabel harga grosir varian terpilih (isi via JS) -->
                <div id="tierBox" class="hidden rounded-xl border border-slate-200 overflow-hidden">
                    <div class="px-4 py-2.5 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">Harga Grosir</div>
                    <table class="w-full text-sm"><tbody id="tierRows" class="divide-y divide-slate-100"></tbody></table>
                </div>
            <?php endif; ?>

            <?php if ($isArea): ?>
                <div>
                    <label class="co-label !mb-2.5">Ukuran (cm)</label>
                    <div class="flex items-center gap-2">
                        <input id="szW" type="number" name="width" min="1" step="any" required placeholder="Panjang" class="w-28 h-11 px-3 text-center font-semibold rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand/50">
                        <span class="text-slate-400 font-bold">&times;</span>
                        <input id="szH" type="number" name="height" min="1" step="any" required placeholder="Lebar" class="w-28 h-11 px-3 text-center font-semibold rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand/50">
                        <span class="text-sm text-slate-400">cm</span>
                    </div>
                    <p id="areaInfo" class="mt-2 text-xs text-slate-400">Harga dihitung dari luas: panjang &times; lebar (cm) &divide; 10.000 = m².</p>
                </div>
            <?php endif; ?>

            <div>
                <label class="co-label !mb-2.5"><?= $isArea ? 'Jumlah (pcs)' : 'Jumlah' ?></label>
                <div class="flex items-center rounded-lg border border-slate-200 overflow-hidden w-fit">
                    <button type="button" data-step="-1" class="h-11 w-11 grid place-items-center text-slate-500 hover:bg-brand hover:text-white transition text-lg font-bold" aria-label="Kurangi">&minus;</button>
                    <input id="qty" type="number" name="qty" value="1" min="1" class="w-16 h-11 text-center font-semibold border-x border-slate-200 focus:outline-none">
                    <button type="button" data-step="1" class="h-11 w-11 grid place-items-center text-slate-500 hover:bg-brand hover:text-white transition text-lg font-bold" aria-label="Tambah">+</button>
                </div>
            </div>

            <?php if ($isArea || $hasTiers): ?>
                <div class="flex items-center justify-between px-4 py-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span class="text-sm font-semibold text-slate-500">Estimasi total</span>
                    <span id="estTotal" class="font-head text-lg font-extrabold text-slate-900"><?= $isArea ? '—' : rupiah(product_price($p)) ?></span>
                </div>
            <?php endif; ?>

            <div class="flex flex-col sm:flex-row gap-3">
                <button type="submit" class="co-btn co-btn--dark flex-1 justify-center !py-3.5">
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293A1 1 0 005.414 17H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
                    Tambah ke Keranjang
                </button>
                <?php if ($waNum): ?>
                    <a href="https://wa.me/<?= h($waNum) ?>?text=<?= $waText ?>" target="_blank" rel="noopener" class="flex-1 justify-center inline-flex items-center gap-2 px-6 py-3.5 rounded-full border border-slate-200 text-slate-700 font-bold hover:border-brand transition">
                        <svg class="w-5 h-5 text-emerald-600" fill="currentColor" viewBox="0 0 24 24"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.87 9.87 0 004.74 1.21c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0012.04 2zm0 18.13a8.2 8.2 0 01-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 01-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 012.41 5.83c0 4.54-3.7 8.23-8.23 8.23zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.8-.78.97-.14.16-.29.18-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.51.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.16 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.1-.23-.16-.48-.27z"/></svg>
                        Tanya via WhatsApp
                    </a>
                <?php endif; ?>
            </div>

            <div class="grid grid-cols-2 gap-y-2.5 gap-x-4 pt-4 border-t border-slate-200">
                <?php foreach (['Respon cepat', 'Kualitas terjaga', 'Bisa custom desain', 'Antar & kirim'] as $f): ?>
                    <div class="flex items-center gap-2.5 text-xs text-slate-500"><svg class="w-4 h-4 text-slate-900 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg><?= h($f) ?></div>
                <?php endforeach; ?>
            </div>
        </form>
    </div>
</div>

<?php if ($related): ?>
    <section class="mt-16 pt-10 border-t border-slate-200">
        <div class="co-head">
            <div>
                <span class="co-kicker">Katalog</span>
                <h2 class="co-h2">Produk Serupa</h2>
            </div>
            <a href="produk.php?cat=<?= h($cid) ?>" class="co-more">Lihat kategori <span class="co-more-ico"><svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 17L17 7M17 7H8m9 0v9"/></svg></span></a>
        </div>
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
    // ── Harga dinamis: tier per qty + estimasi luas (m²) ──────────────────
    var VARIANTS = <?= json_encode($jsVariants, JSON_UNESCAPED_UNICODE) ?>;
    var IS_AREA  = <?= $isArea ? 'true' : 'false' ?>;
    var prc = document.getElementById('prc');
    var qty = document.getElementById('qty');
    var est = document.getElementById('estTotal');
    var szW = document.getElementById('szW');
    var szH = document.getElementById('szH');
    var areaInfo = document.getElementById('areaInfo');
    var tierBox = document.getElementById('tierBox');
    var tierRows = document.getElementById('tierRows');

    function rp(n) { return 'Rp ' + Math.round(n).toLocaleString('id-ID'); }
    function currentVariant() {
        var el = document.querySelector('input[name="variant"]:checked') || document.querySelector('input[name="variant"][type="hidden"]');
        var id = el ? String(el.value) : null;
        return VARIANTS.find(function (v) { return v.id === id; }) || VARIANTS[0] || null;
    }
    // Logika sama dengan POS: tier minQty terbesar yang qty >= minQty && (maxQty null || qty <= maxQty)
    function tierPrice(q, v) {
        if (!v || !v.tiers || !v.tiers.length) return v ? v.price : 0;
        var sorted = v.tiers.slice().sort(function (a, b) { return b.minQty - a.minQty; });
        for (var i = 0; i < sorted.length; i++) {
            var t = sorted[i];
            if (q >= t.minQty && (t.maxQty === null || q <= t.maxQty)) return t.price;
        }
        return v.price;
    }
    function renderTiers(v, q) {
        if (!tierBox || !tierRows) return;
        if (!v || !v.tiers || !v.tiers.length) { tierBox.classList.add('hidden'); return; }
        tierBox.classList.remove('hidden');
        tierRows.innerHTML = '';
        var rows = [{ minQty: 1, maxQty: v.tiers.slice().sort(function (a, b) { return a.minQty - b.minQty; })[0].minQty - 1, price: v.price, tierName: null }]
            .filter(function (r) { return r.maxQty >= r.minQty; })
            .concat(v.tiers.slice().sort(function (a, b) { return a.minQty - b.minQty; }));
        rows.forEach(function (t) {
            var active = q >= t.minQty && (t.maxQty === null || q <= t.maxQty);
            var label = (t.tierName ? t.tierName + ' · ' : '') + t.minQty + (t.maxQty === null ? '+' : '–' + t.maxQty) + ' pcs';
            var tr = document.createElement('tr');
            if (active) tr.className = 'bg-brand/5';
            tr.innerHTML = '<td class="px-4 py-2 ' + (active ? 'font-bold text-brand' : 'text-slate-600') + '">' + label + '</td>'
                + '<td class="px-4 py-2 text-right ' + (active ? 'font-bold text-brand' : 'text-slate-600') + '">' + rp(t.price) + '</td>';
            tierRows.appendChild(tr);
        });
    }
    function recalc() {
        var v = currentVariant();
        if (!v) return;
        var q = Math.max(1, parseInt(qty && qty.value, 10) || 1);
        if (IS_AREA) {
            // Harga per m² × luas (cm² → m²) × pcs
            if (prc) prc.textContent = rp(v.price);
            var w = parseFloat(szW && szW.value) || 0;
            var h = parseFloat(szH && szH.value) || 0;
            var m2 = (w * h) / 10000;
            if (est) est.textContent = (w > 0 && h > 0) ? rp(v.price * m2 * q) : '—';
            if (areaInfo && w > 0 && h > 0) {
                areaInfo.textContent = w + '×' + h + ' cm = ' + (Math.round(m2 * 100) / 100).toLocaleString('id-ID') + ' m² × ' + rp(v.price) + '/m²' + (q > 1 ? ' × ' + q + ' pcs' : '');
            }
        } else {
            var unit = tierPrice(q, v);
            if (prc) prc.textContent = rp(unit);
            if (est) est.textContent = rp(unit * q);
            renderTiers(v, q);
        }
    }

    document.querySelectorAll('input[name="variant"]').forEach(function (r) { r.addEventListener('change', recalc); });
    if (qty) { qty.addEventListener('input', recalc); qty.addEventListener('change', recalc); }
    [szW, szH].forEach(function (el) { if (el) el.addEventListener('input', recalc); });
    // Stepper jumlah
    document.querySelectorAll('[data-step]').forEach(function (b) {
        b.addEventListener('click', function () {
            qty.value = Math.max(1, (parseInt(qty.value, 10) || 1) + parseInt(b.dataset.step, 10));
            recalc();
        });
    });
    recalc();
})();
</script>

<?php include __DIR__ . '/footer.php'; ?>
