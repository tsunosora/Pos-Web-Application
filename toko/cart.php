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
    $name    = trim($_POST['name'] ?? '');
    $phone   = trim($_POST['phone'] ?? '');
    $address = trim($_POST['address'] ?? '');
    $note    = trim($_POST['note'] ?? '');
    $items   = cart();

    if ($name === '') {
        $error = 'Nama wajib diisi.';
    } elseif (!count($items)) {
        $error = 'Keranjang masih kosong.';
    } else {
        $payload = [
            'name'    => $name,
            'phone'   => $phone,
            'address' => $address,
            'note'    => $note,
            'items'   => array_map(fn($it) => [
                'productVariantId' => $it['productVariantId'],
                'description'      => $it['description'],
                'quantity'        => (int)$it['quantity'],
                'unitPrice'       => (float)$it['unitPrice'],
            ], $items),
        ];
        $res = api_post('/orders/public', $payload);
        if ($res && !empty($res['ok'])) {
            $sent = true;
            $leadId = $res['leadId'] ?? null;
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

<h1 class="text-2xl font-extrabold text-slate-900 mb-6">Keranjang</h1>

<?php if ($sent): ?>
    <div class="max-w-md mx-auto text-center bg-white rounded-3xl border border-slate-200 p-8">
        <div class="w-16 h-16 mx-auto rounded-full bg-emerald-100 text-emerald-600 grid place-items-center mb-4">
            <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
        </div>
        <h2 class="text-xl font-bold text-slate-900">Order terkirim!</h2>
        <p class="mt-2 text-slate-600">Terima kasih, order kamu sudah kami terima<?= $leadId ? " (No. #" . h($leadId) . ")" : '' ?>. Tim kami akan menghubungi untuk konfirmasi.</p>
        <a href="index.php" class="inline-block mt-6 px-6 py-3 rounded-xl bg-brand text-white font-semibold hover:opacity-90 transition">Belanja lagi</a>
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
                            <div class="text-sm text-slate-500"><?= rupiah($it['unitPrice']) ?> &times; <?= (int)$it['quantity'] ?></div>
                        </div>
                        <div class="font-bold text-slate-900 whitespace-nowrap"><?= rupiah($it['unitPrice'] * $it['quantity']) ?></div>
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
                <input type="hidden" name="action" value="checkout">
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
                <button type="submit" class="w-full px-6 py-3 rounded-xl bg-brand text-white font-semibold hover:opacity-90 transition">Kirim Order</button>
            </form>
        </div>
    <?php endif; ?>
<?php endif; ?>

<?php include __DIR__ . '/footer.php'; ?>
