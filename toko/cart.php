<?php
require_once __DIR__ . '/lib.php';

// Hapus item dari keranjang
if (isset($_GET['remove'])) {
    $i = (int)$_GET['remove'];
    if (isset($_SESSION['cart'][$i])) {
        array_splice($_SESSION['cart'], $i, 1);
    }
    header('Location: cart.php');
    exit;
}

$error = null;
$sent  = false;
$leadId = null;

// Checkout → kirim order ke PosPro (tercatat sebagai Lead WEBSITE)
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'checkout') {
    require_csrf();
    $name     = trim($_POST['name'] ?? '');
    $phone    = trim($_POST['phone'] ?? '');
    $address  = trim($_POST['address'] ?? '');
    $note     = trim($_POST['note'] ?? '');
    $branchId = (int)($_POST['branchId'] ?? 0);
    $items    = cart();

    if (trim($_POST['website'] ?? '') !== '' || looks_like_spam($name, $note, $address)) {
        // Honeypot terisi / konten spam judol → bot. Pura-pura sukses tanpa kirim.
        $sent = true;
        $_SESSION['cart'] = [];
    } elseif (!turnstile_verify($_POST['cf-turnstile-response'] ?? '')) {
        $error = 'Verifikasi anti-bot gagal. Muat ulang halaman lalu kirim ulang order.';
    } elseif (order_throttled() > 0) {
        $error = 'Terlalu banyak order beruntun dari perangkat ini. Coba lagi beberapa saat lagi atau hubungi kami via WhatsApp.';
    } elseif ($name === '') {
        $error = 'Nama wajib diisi.';
    } elseif (!count($items)) {
        $error = 'Keranjang masih kosong.';
    } else {
        $payload = [
            'name'    => $name,
            'phone'   => $phone,
            'address' => $address,
            'note'    => $note,
            // Cabang/lokasi cetak pilihan customer (divalidasi ulang di backend)
            'branchId' => $branchId > 0 ? $branchId : null,
            'items'   => array_map(function ($it) {
                $row = [
                    'productVariantId' => $it['productVariantId'],
                    'description'      => $it['description'],
                    'quantity'         => (int)$it['quantity'],
                    'unitPrice'        => (float)$it['unitPrice'],
                ];
                // Item per-luas: kirim ukuran + unitType apa adanya. Backend
                // calcItemSubtotal memahami model yang sama: 'm'/'cm2' → P×L×harga,
                // 'cm' → (P×L÷10.000)×harga, 'menit' → P×harga.
                if (!empty($it['widthCm']) && !empty($it['heightCm'])) {
                    $row['widthCm']  = (float)$it['widthCm'];
                    $row['heightCm'] = (float)$it['heightCm'];
                    $row['unitType'] = $it['unitType'] ?? 'cm';
                }
                return $row;
            }, $items),
        ];
        $res = api_post('/orders/public', $payload);
        if ($res && !empty($res['ok'])) {
            $sent = true;
            $leadId = $res['leadId'] ?? null;
            record_order_attempt();
            $_SESSION['cart'] = [];
        } else {
            $error = 'Gagal mengirim order. Coba lagi atau hubungi kami.';
        }
    }
}

$seo_title = 'Keranjang — ' . (settings()['storeName'] ?? 'Toko');
$seo_robots = 'noindex,nofollow';
include __DIR__ . '/header.php';
$items = cart();
$total = cart_total();
?>

<h1 class="font-head text-2xl sm:text-3xl font-extrabold text-slate-900 mb-6">Keranjang</h1>

<?php if ($sent): ?>
    <div class="max-w-md mx-auto text-center bg-white rounded-3xl border border-slate-200 p-8">
        <div class="w-16 h-16 mx-auto rounded-full bg-emerald-100 text-emerald-600 grid place-items-center mb-4">
            <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
        </div>
        <h2 class="text-xl font-bold text-slate-900">Order terkirim!</h2>
        <p class="mt-2 text-slate-600">Terima kasih, order kamu sudah kami terima<?= $leadId ? " (No. #" . h($leadId) . ")" : '' ?>. Tim kami akan menghubungi untuk konfirmasi.</p>
        <a href="index.php" class="btn-pill btn-pill--dark justify-center mt-6">Belanja lagi</a>
    </div>
<?php else: ?>
    <?php if ($error): ?>
        <div class="mb-5 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-medium"><?= h($error) ?></div>
    <?php endif; ?>

    <?php if (!count($items)): ?>
        <div class="text-center py-20 text-slate-400">
            <p class="text-lg">Keranjang masih kosong.</p>
            <a href="index.php" class="text-brand font-medium hover:underline">Mulai belanja</a>
        </div>
    <?php else: ?>
        <div class="grid lg:grid-cols-3 gap-6 items-start">
            <!-- Daftar item -->
            <div class="lg:col-span-2 bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
                <?php foreach ($items as $i => $it): ?>
                    <div class="flex items-center gap-4 p-4">
                        <div class="w-16 h-16 rounded-xl bg-slate-100 overflow-hidden shrink-0">
                            <?php if (!empty($it['image'])): ?><img src="<?= h($it['image']) ?>" alt="" class="w-full h-full object-cover"><?php endif; ?>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="font-semibold text-slate-800 truncate"><?= h($it['description']) ?></div>
                            <?php if (!empty($it['widthCm']) && !empty($it['heightCm'])): $ut = $it['unitType'] ?? 'cm'; $sq = area_sq_label($ut); $area = area_native((float)$it['widthCm'], (float)$it['heightCm'], $ut); ?>
                                <div class="text-sm text-slate-500"><?= rupiah($it['unitPrice']) ?>/<?= $sq ?> &times; <?= h(rtrim(rtrim(number_format($area, 2, ',', '.'), '0'), ',')) ?> <?= $sq ?> &times; <?= (int)$it['quantity'] ?> pcs</div>
                            <?php else: ?>
                                <div class="text-sm text-slate-500"><?= rupiah($it['unitPrice']) ?> &times; <?= (int)$it['quantity'] ?></div>
                            <?php endif; ?>
                        </div>
                        <div class="font-bold text-slate-900 whitespace-nowrap"><?= rupiah(cart_item_subtotal($it)) ?></div>
                        <a href="cart.php?remove=<?= $i ?>" class="text-slate-300 hover:text-rose-500 transition p-1" title="Hapus">
                            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                        </a>
                    </div>
                <?php endforeach; ?>
                <div class="flex items-center justify-between p-4 bg-slate-50 rounded-b-2xl">
                    <span class="font-semibold text-slate-600">Total</span>
                    <span class="text-xl font-extrabold text-slate-900"><?= rupiah($total) ?></span>
                </div>
            </div>

            <!-- Form pemesan -->
            <form method="post" class="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
                <?= csrf_field() ?>
                <input type="hidden" name="action" value="checkout">
                <!-- Honeypot anti-bot: harus tetap kosong; disembunyikan dari manusia -->
                <input type="text" name="website" value="" tabindex="-1" autocomplete="off" class="hidden" aria-hidden="true">
                <h2 class="font-bold text-slate-900">Data Pemesan</h2>
                <div>
                    <label class="block text-sm font-semibold text-slate-700 mb-1.5">Nama <span class="text-rose-500">*</span></label>
                    <input type="text" name="name" required class="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand/50">
                </div>
                <div>
                    <label class="block text-sm font-semibold text-slate-700 mb-1.5">No. WhatsApp / Telepon</label>
                    <input type="text" name="phone" placeholder="0812..." class="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand/50">
                </div>
                <div>
                    <label class="block text-sm font-semibold text-slate-700 mb-1.5">Alamat</label>
                    <textarea name="address" rows="2" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand/50"></textarea>
                </div>
                <div>
                    <label class="block text-sm font-semibold text-slate-700 mb-1.5">Catatan</label>
                    <textarea name="note" rows="2" placeholder="Warna, ukuran, dll" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand/50"></textarea>
                </div>
                <?php $poBranches = pospro_branches(); ?>
                <?php if (count($poBranches) > 1): ?>
                    <div>
                        <label class="block text-sm font-semibold text-slate-700 mb-1.5">Cetak di cabang <span class="text-rose-500">*</span></label>
                        <select name="branchId" required class="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand/50">
                            <option value="">— Pilih lokasi cetak —</option>
                            <?php foreach ($poBranches as $b): ?><option value="<?= (int)$b['id'] ?>"><?= h($b['name']) ?></option><?php endforeach; ?>
                        </select>
                    </div>
                <?php elseif (count($poBranches) === 1): ?>
                    <input type="hidden" name="branchId" value="<?= (int)$poBranches[0]['id'] ?>">
                <?php endif; ?>
                <?php if (turnstile_enabled()): ?>
                    <div class="cf-turnstile" data-sitekey="<?= h(turnstile_site_key()) ?>"></div>
                    <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
                <?php endif; ?>
                <button type="submit" class="btn-pill btn-pill--accent w-full justify-center !py-3.5">
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
                    Kirim Order
                </button>
            </form>
        </div>
    <?php endif; ?>
<?php endif; ?>

<?php include __DIR__ . '/footer.php'; ?>
