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
        // Produk per-luas: SELALU per m² (base). Pelanggan pilih satuan input
        // cm/m (form 'sizeUnit', default cm) → unitType 'cm' (÷10.000) / 'm'.
        $unitType = (($_POST['sizeUnit'] ?? 'cm') === 'm') ? 'm' : 'cm';
        $ul = $unitType === 'm' ? 'm' : 'cm';
        $w = (float)str_replace(',', '.', (string)($_POST['width'] ?? ''));
        $h = (float)str_replace(',', '.', (string)($_POST['height'] ?? ''));
        if ($w <= 0 || $h <= 0) {
            header('Location: product.php?id=' . (int)$p['id'] . '&err=ukuran');
            exit;
        }
        $fmt = fn(float $n) => rtrim(rtrim(number_format($n, 2, '.', ''), '0'), '.');
        $item['widthCm']  = $w;
        $item['heightCm'] = $h;
        $item['unitType'] = $unitType;
        $item['description'] .= ' (' . $fmt($w) . '×' . $fmt($h) . ' ' . $ul . ')';
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
// AREA_BASED SELALU per m² (base) — persis POS. Pelanggan pilih satuan INPUT
// cm/m (default cm) yang cuma mengonversi dimensi. Harga varian = per m².
$sqLabel = 'm²';                              // basis harga: selalu m²
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

// Tombol WhatsApp (utamakan blok Kontak toko, fallback storePhone PosPro)
$waNum  = store_wa();
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

<?php
$price = product_price($p);
$old = 0;
foreach (['priceOld', 'compareAtPrice', 'oldPrice', 'strikePrice'] as $k) { if (!empty($p[$k]) && (float)$p[$k] > $price) { $old = (float)$p[$k]; break; } }
$disc   = $old ? (int)round(100 - ($price / $old * 100)) : 0;
$rating = isset($p['rating']) ? (float)$p['rating'] : 0;
$rcount = $p['ratingCount'] ?? $p['reviewCount'] ?? 0;
$rr = (int)round($rating);
?>
<nav class="pd-crumb">
    <a href="index.php">Beranda</a><span class="sep">/</span>
    <a href="produk.php">Produk</a>
    <?php if (!empty($p['category']['name'])): ?><span class="sep">/</span><a href="produk.php?cat=<?= h($cid) ?>"><?= h($p['category']['name']) ?></a><?php endif; ?>
    <span class="sep">/</span><span class="cur"><?= h($p['name']) ?></span>
</nav>

<div class="pd-grid">
    <div class="pd-gallery<?= count($gallery) > 1 ? ' pd-gallery--multi' : '' ?>">
        <?php if (count($gallery) > 1): ?>
            <div class="pd-thumbs">
                <?php foreach ($gallery as $gi => $g): ?>
                    <button type="button" data-thumb="<?= h($g) ?>" class="thumb pd-thumb <?= $gi === 0 ? 'border-brand' : '' ?>">
                        <img src="<?= h($g) ?>" alt="">
                    </button>
                <?php endforeach; ?>
            </div>
        <?php endif; ?>
        <div class="pd-stage">
            <?php if ($disc > 0): ?><span class="pd-badge">-<?= $disc ?>%</span><?php endif; ?>
            <?php if ($gallery): ?>
                <img id="mainImg" src="<?= h($gallery[0]) ?>" alt="<?= h($p['name']) ?>">
            <?php else: ?>
                <svg class="ph w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 19.5h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5z"/></svg>
            <?php endif; ?>
        </div>
    </div>

    <div class="pd-info">
        <?php if (!empty($p['category']['name'])): ?><span class="pd-cat"><?= h($p['category']['name']) ?></span><?php endif; ?>
        <h1 class="pd-title"><?= h($p['name']) ?></h1>
        <?php if ($rating > 0): ?>
            <div class="pd-rate"><span class="stars"><?= str_repeat('★', $rr) . str_repeat('☆', max(0, 5 - $rr)) ?></span><span class="c"><?= number_format($rating, 1) ?><?= $rcount ? ' (' . (int)$rcount . ' ulasan)' : '' ?></span></div>
        <?php endif; ?>
        <div class="pd-price-row">
            <?php if (count($variants) > 1): ?><span class="pd-unit">Mulai</span><?php endif; ?>
            <span id="prc" class="pd-price" data-base="<?= $price ?>"><?= rupiah($price) ?></span>
            <?php if ($isArea): ?><span class="pd-unit">/<?= h($sqLabel) ?></span><?php endif; ?>
            <?php if ($old): ?><span class="pd-old"><?= rupiah($old) ?></span><span class="pd-save">Hemat <?= rupiah($old - $price) ?></span><?php endif; ?>
        </div>
        <?php if (isset($_GET['err']) && $_GET['err'] === 'ukuran'): ?>
            <div class="mt-4 px-4 py-3 rounded-xl text-sm font-semibold" style="background:rgba(225,29,72,.08);border:1px solid rgba(225,29,72,.25);color:#be123c">Mohon isi ukuran (panjang &times; lebar) yang valid dulu ya.</div>
        <?php endif; ?>
        <?php if (!empty($p['description'])): ?>
            <p class="pd-desc"><?= nl2br(h($p['description'])) ?></p>
        <?php endif; ?>

        <form method="post" class="pd-form">
            <?php if (count($variants) === 1): ?><input type="hidden" name="variant" value="<?= h($variants[0]['id']) ?>"><?php endif; ?>
            <?php if (count($variants) > 1): ?>
                <div>
                    <label class="pd-label">Pilih Varian</label>
                    <div class="pd-variants">
                        <?php foreach ($variants as $k => $v): ?>
                            <label class="cursor-pointer">
                                <input type="radio" name="variant" value="<?= h($v['id']) ?>" data-price="<?= (float)$v['price'] ?>" <?= $k === 0 ? 'checked' : '' ?> class="peer sr-only">
                                <span class="inline-flex flex-col px-4 py-2.5 rounded-xl border border-slate-200 text-sm peer-checked:border-brand peer-checked:bg-brand peer-checked:text-white hover:border-slate-400 transition" style="color:var(--pk-text)">
                                    <span class="font-bold"><?= h($v['variantName'] ?: $p['name']) ?></span>
                                    <span class="text-xs opacity-70"><?= rupiah($v['price']) ?></span>
                                </span>
                            </label>
                        <?php endforeach; ?>
                    </div>
                </div>
            <?php endif; ?>

            <?php if ($hasTiers && !$isArea): ?>
                <div id="tierBox" class="pd-tier hidden">
                    <div class="pd-tier-h">Harga Grosir</div>
                    <table class="w-full text-sm"><tbody id="tierRows" class="divide-y divide-slate-100"></tbody></table>
                </div>
            <?php endif; ?>

            <?php if ($isArea): ?>
                <div>
                    <label class="pd-label">Ukuran</label>
                    <div class="pd-size">
                        <input id="szW" type="number" name="width" min="0.01" step="any" required placeholder="Panjang">
                        <span class="font-bold" style="color:var(--pk-soft)">&times;</span>
                        <input id="szH" type="number" name="height" min="0.01" step="any" required placeholder="Lebar">
                        <select id="szUnit" name="sizeUnit" class="rounded-lg border px-2 py-1 text-sm" style="border-color:var(--pk-border);background:var(--pk-card)">
                            <option value="cm" selected>cm</option>
                            <option value="m">m</option>
                        </select>
                    </div>
                    <p id="areaInfo" class="mt-2 text-xs" style="color:var(--pk-soft)">
                        Pilih satuan cm / m. Default cm: panjang &times; lebar (cm) &divide; 10.000 = m&sup2; &times; harga/m&sup2;.
                    </p>
                </div>
            <?php endif; ?>

            <div>
                <label class="pd-label"><?= $isArea ? 'Jumlah (pcs)' : 'Jumlah' ?></label>
                <div class="pd-qty">
                    <button type="button" data-step="-1" aria-label="Kurangi">&minus;</button>
                    <input id="qty" type="number" name="qty" value="1" min="1">
                    <button type="button" data-step="1" aria-label="Tambah">+</button>
                </div>
            </div>

            <?php if ($isArea || $hasTiers): ?>
                <div class="pd-est">
                    <span class="pd-est-l">Estimasi total</span>
                    <span id="estTotal" class="pd-est-v"><?= $isArea ? '—' : rupiah($price) ?></span>
                </div>
            <?php endif; ?>

            <div class="pd-actions">
                <button type="submit" class="pd-btn pd-btn--primary">
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293A1 1 0 005.414 17H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
                    Tambah ke Keranjang
                </button>
                <?php if ($waNum): ?>
                    <a href="https://wa.me/<?= h($waNum) ?>?text=<?= $waText ?>" target="_blank" rel="noopener" class="pd-btn pd-btn--wa">
                        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.87 9.87 0 004.74 1.21c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0012.04 2zm0 18.13a8.2 8.2 0 01-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 01-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 012.41 5.83c0 4.54-3.7 8.23-8.23 8.23zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.8-.78.97-.14.16-.29.18-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.51.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.16 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.1-.23-.16-.48-.27z"/></svg>
                        Pesan via WhatsApp
                    </a>
                <?php endif; ?>
            </div>
        </form>
    </div>
</div>

<div class="pd-trust">
    <div class="pd-trust-item"><span class="pd-trust-ico"><i class="fa-solid fa-bolt"></i></span><div><div class="pd-trust-t">Respon Cepat</div><div class="pd-trust-d">Dibalas &amp; dikerjakan cepat</div></div></div>
    <div class="pd-trust-item"><span class="pd-trust-ico"><i class="fa-solid fa-medal"></i></span><div><div class="pd-trust-t">Kualitas Terjaga</div><div class="pd-trust-d">Mesin &amp; bahan premium</div></div></div>
    <div class="pd-trust-item"><span class="pd-trust-ico"><i class="fa-solid fa-pen-ruler"></i></span><div><div class="pd-trust-t">Bisa Custom</div><div class="pd-trust-d">Desain dibantu gratis</div></div></div>
    <div class="pd-trust-item"><span class="pd-trust-ico"><i class="fa-solid fa-truck"></i></span><div><div class="pd-trust-t">Antar &amp; Kirim</div><div class="pd-trust-d">Ambil di tempat / dikirim</div></div></div>
</div>

<?php if ($related): ?>
    <section class="pk-sec" style="margin-top:3.5rem">
        <div class="pk-shead">
            <div class="pk-shead-l"><span class="pk-shead-ico"><i class="fa-solid fa-grip"></i></span><h2 class="pk-shead-title">Produk Serupa</h2></div>
            <a href="produk.php?cat=<?= h($cid) ?>" class="pk-shead-more">Lihat kategori <i class="fa-solid fa-arrow-right" style="font-size:.8em"></i></a>
        </div>
        <div class="pk-bs-grid">
            <?php foreach ($related as $i => $rp) echo bs_card_html($rp, $i); ?>
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
    var szUnit = document.getElementById('szUnit');   // select cm/m (default cm)
    var areaInfo = document.getElementById('areaInfo');
    // Satuan input efektif dari toggle (cm/m); base harga selalu m².
    function curUnit() { return (szUnit && szUnit.value === 'm') ? 'm' : 'cm'; }
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
            // AREA_BASED selalu per m². Satuan input (curUnit): 'cm'→P×L÷10.000; 'm'→P×L.
            var u = curUnit();
            if (prc) prc.textContent = rp(v.price);
            var w = parseFloat(szW && szW.value) || 0;
            var h = parseFloat(szH && szH.value) || 0;
            var m2 = u === 'm' ? (w * h) : (w * h) / 10000;
            var ok = w > 0 && h > 0;
            if (est) est.textContent = ok ? rp(v.price * m2 * q) : '—';
            if (areaInfo && ok) {
                areaInfo.textContent = w + '×' + h + ' ' + u + ' = ' + (Math.round(m2 * 100) / 100).toLocaleString('id-ID') + ' m² × ' + rp(v.price) + '/m²' + (q > 1 ? ' × ' + q + ' pcs' : '');
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
    if (szUnit) szUnit.addEventListener('change', recalc);
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
