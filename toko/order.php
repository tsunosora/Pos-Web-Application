<?php
require_once __DIR__ . '/lib.php';
require_admin();

$id = (int)($_GET['id'] ?? 0);
$o  = ($id && pospro_configured()) ? pospro_get('/crm/leads/' . $id) : null;

$page_title = 'Detail Order';
$active = 'orders';
include __DIR__ . '/admin_header.php';

if (!$o || empty($o['id'])) {
    echo '<div class="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-400">Order tidak ditemukan. <a href="orders.php" class="text-brand hover:underline">Kembali</a></div>';
    include __DIR__ . '/admin_footer.php';
    exit;
}
$items = $o['items'] ?? [];
$totalItem = 0;
foreach ($items as $it) $totalItem += cart_item_subtotal($it); // sadar item area (widthCm×heightCm)
$wa = preg_replace('/^0/', '62', preg_replace('/\D/', '', $o['phone'] ?? ''));
?>

<a href="orders.php" class="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand mb-5">
    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
    Kembali ke order
</a>

<div class="grid lg:grid-cols-3 gap-6 items-start">
    <div class="bg-white rounded-3xl border border-slate-200 p-6">
        <div class="flex items-center justify-between mb-4">
            <h1 class="text-lg font-extrabold text-slate-900">Order #<?= (int)$o['id'] ?></h1>
            <span class="inline-block px-2.5 py-1 rounded-full text-xs font-semibold <?= lead_status_class($o['status'] ?? null) ?>"><?= h(lead_status_label($o['status'] ?? null)) ?></span>
        </div>
        <dl class="space-y-3 text-sm">
            <div><dt class="text-slate-400">Nama</dt><dd class="font-semibold text-slate-800"><?= h($o['name'] ?? '-') ?></dd></div>
            <div><dt class="text-slate-400">Telepon / WA</dt><dd class="font-semibold">
                <?php if ($wa): ?><a href="https://wa.me/<?= h($wa) ?>" target="_blank" class="text-emerald-600 hover:underline"><?= h($o['phone']) ?></a><?php else: ?><span class="text-slate-800">-</span><?php endif; ?>
            </dd></div>
            <?php if (!empty($o['city'])): ?><div><dt class="text-slate-400">Kota / Alamat</dt><dd class="text-slate-800"><?= h($o['city']) ?></dd></div><?php endif; ?>
            <?php if (!empty($o['needs'])): ?><div><dt class="text-slate-400">Catatan</dt><dd class="text-slate-800 whitespace-pre-line"><?= h($o['needs']) ?></dd></div><?php endif; ?>
            <div><dt class="text-slate-400">Masuk</dt><dd class="text-slate-800"><?= h(tgl($o['createdAt'] ?? null)) ?></dd></div>
        </dl>
        <p class="mt-5 pt-4 border-t border-slate-100 text-xs text-slate-400">Kelola lanjutan (follow-up, ubah status) lewat CRM PosPro.</p>
    </div>

    <div class="lg:col-span-2 bg-white rounded-3xl border border-slate-200 overflow-hidden">
        <div class="px-6 py-4 border-b border-slate-100 font-bold text-slate-900">Item Pesanan</div>
        <?php if (!count($items)): ?>
            <div class="p-8 text-center text-slate-400 text-sm">Tidak ada rincian item.</div>
        <?php else: ?>
            <table class="w-full text-sm">
                <thead><tr class="text-left text-slate-500 bg-slate-50 border-b border-slate-100">
                    <th class="px-6 py-2.5 font-semibold">Produk</th>
                    <th class="px-6 py-2.5 font-semibold text-center">Qty</th>
                    <th class="px-6 py-2.5 font-semibold text-right">Harga</th>
                    <th class="px-6 py-2.5 font-semibold text-right">Subtotal</th>
                </tr></thead>
                <tbody class="divide-y divide-slate-100">
                    <?php foreach ($items as $it): $sub = cart_item_subtotal($it); $isAreaItem = !empty($it['widthCm']) && !empty($it['heightCm']); ?>
                        <tr>
                            <td class="px-6 py-3 text-slate-800">
                                <?= h($it['description'] ?? ($it['productVariant']['product']['name'] ?? '-')) ?>
                                <?php if ($isAreaItem): $ut = $it['unitType'] ?? 'cm'; $ul = $ut === 'm' ? 'm' : ($ut === 'menit' ? 'unit' : 'cm'); ?><span class="block text-xs text-slate-400"><?= h($it['widthCm']) ?>&times;<?= h($it['heightCm']) ?> <?= h($ul) ?> (<?= h(rtrim(rtrim(number_format(area_m2((float)$it['widthCm'], (float)$it['heightCm'], $ut), 2, ',', '.'), '0'), ',')) ?> m²)</span><?php endif; ?>
                            </td>
                            <td class="px-6 py-3 text-center text-slate-600"><?= (int)($it['quantity'] ?? 0) ?></td>
                            <td class="px-6 py-3 text-right text-slate-600"><?= rupiah($it['unitPrice'] ?? 0) ?><?= $isAreaItem ? '<span class="text-xs text-slate-400">/m²</span>' : '' ?></td>
                            <td class="px-6 py-3 text-right font-semibold text-slate-800"><?= rupiah($sub) ?></td>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
                <tfoot><tr class="bg-slate-50">
                    <td colspan="3" class="px-6 py-3 text-right font-semibold text-slate-600">Total</td>
                    <td class="px-6 py-3 text-right text-lg font-extrabold text-slate-900"><?= rupiah($totalItem ?: ($o['estimatedValue'] ?? 0)) ?></td>
                </tr></tfoot>
            </table>
        <?php endif; ?>
    </div>
</div>

<?php include __DIR__ . '/admin_footer.php'; ?>
