<?php
require_once __DIR__ . '/lib.php';

// Hapus item
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

// Checkout → kirim order ke PosPro (jadi Lead)
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

include __DIR__ . '/header.php';
$items = cart();
$total = cart_total();
?>
<h1 class="page-title">Keranjang</h1>

<?php if ($sent): ?>
    <div class="alert success">
        <h2>✅ Order terkirim!</h2>
        <p>Terima kasih, order kamu sudah kami terima<?= $leadId ? " (No. #$leadId)" : '' ?>. Tim kami akan menghubungi untuk konfirmasi.</p>
        <a class="btn-primary" href="index.php">Belanja lagi</a>
    </div>
<?php else: ?>
    <?php if ($error): ?><div class="alert error"><?= h($error) ?></div><?php endif; ?>

    <?php if (!count($items)): ?>
        <p class="muted">Keranjang kosong. <a href="index.php">Mulai belanja →</a></p>
    <?php else: ?>
        <table class="cart-table">
            <thead><tr><th>Produk</th><th>Harga</th><th>Qty</th><th>Subtotal</th><th></th></tr></thead>
            <tbody>
                <?php foreach ($items as $i => $it): ?>
                    <tr>
                        <td class="ci">
                            <?php if (!empty($it['image'])): ?><img src="<?= h($it['image']) ?>" alt=""><?php endif; ?>
                            <span><?= h($it['description']) ?></span>
                        </td>
                        <td><?= rupiah($it['unitPrice']) ?></td>
                        <td><?= (int)$it['quantity'] ?></td>
                        <td><?= rupiah($it['unitPrice'] * $it['quantity']) ?></td>
                        <td><a class="rm" href="cart.php?remove=<?= $i ?>">✕</a></td>
                    </tr>
                <?php endforeach; ?>
            </tbody>
            <tfoot><tr><td colspan="3" class="tr">Total</td><td colspan="2" class="total"><?= rupiah($total) ?></td></tr></tfoot>
        </table>

        <form method="post" class="checkout">
            <input type="hidden" name="action" value="checkout">
            <h2>Data Pemesan</h2>
            <label>Nama *<input type="text" name="name" required></label>
            <label>No. WhatsApp / Telepon<input type="text" name="phone" placeholder="0812..."></label>
            <label>Alamat<textarea name="address" rows="2"></textarea></label>
            <label>Catatan<textarea name="note" rows="2" placeholder="Warna, ukuran, dll"></textarea></label>
            <button type="submit" class="btn-primary">Kirim Order</button>
        </form>
    <?php endif; ?>
<?php endif; ?>

<?php include __DIR__ . '/footer.php'; ?>
