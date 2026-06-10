<?php
require_once __DIR__ . '/lib.php';
require_admin();

$status = $_GET['status'] ?? '';
$apiOn  = pospro_configured();
$orders = [];
$failed = false;
if ($apiOn) {
    $query = '/crm/leads?source=WEBSITE&limit=200' . ($status !== '' ? '&status=' . urlencode($status) : '');
    $res = pospro_get($query);
    if (is_array($res)) $orders = $res['items'] ?? [];
    else $failed = true;
}

$page_title = 'Order';
$active = 'orders';
include __DIR__ . '/admin_header.php';
?>

<?php if (!$apiOn || $failed): ?>
    <div class="bg-white rounded-3xl border border-slate-200 p-12 text-center">
        <p class="text-slate-500"><?= $failed ? 'Gagal terhubung ke PosPro. Periksa setelan API.' : 'API PosPro belum terhubung.' ?></p>
        <a href="settings.php" class="inline-block mt-4 px-5 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:opacity-90">Buka Setelan API</a>
    </div>
<?php else: ?>
    <!-- Filter status -->
    <div class="flex flex-wrap gap-2 mb-5">
        <?php
        $tabs = ['' => 'Semua', 'NEW' => 'Baru', 'FOLLOW_UP' => 'Follow Up', 'NEGOTIATION' => 'Negosiasi', 'CLOSED_WON' => 'Deal', 'CLOSED_LOST' => 'Batal'];
        foreach ($tabs as $key => $label): $on = (string)$status === (string)$key; ?>
            <a href="orders.php<?= $key === '' ? '' : '?status=' . h($key) ?>"
               class="px-3.5 py-1.5 rounded-full text-sm font-medium transition <?= $on ? 'bg-brand text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50' ?>"><?= h($label) ?></a>
        <?php endforeach; ?>
    </div>

    <?php if (!count($orders)): ?>
        <div class="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-400">Belum ada order pada kategori ini.</div>
    <?php else: ?>
        <div class="bg-white rounded-3xl border border-slate-200 overflow-hidden">
            <div class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead><tr class="text-left text-slate-500 bg-slate-50 border-b border-slate-100">
                        <th class="px-5 py-3 font-semibold">#</th>
                        <th class="px-5 py-3 font-semibold">Pemesan</th>
                        <th class="px-5 py-3 font-semibold">Kontak</th>
                        <th class="px-5 py-3 font-semibold">Status</th>
                        <th class="px-5 py-3 font-semibold text-right">Nilai</th>
                        <th class="px-5 py-3 font-semibold">Tanggal</th>
                        <th class="px-5 py-3"></th>
                    </tr></thead>
                    <tbody class="divide-y divide-slate-100">
                        <?php foreach ($orders as $o): ?>
                            <tr class="hover:bg-slate-50">
                                <td class="px-5 py-3 text-slate-400">#<?= (int)$o['id'] ?></td>
                                <td class="px-5 py-3 font-semibold text-slate-800"><?= h($o['name'] ?? '-') ?></td>
                                <td class="px-5 py-3 text-slate-600"><?= h($o['phone'] ?? '-') ?></td>
                                <td class="px-5 py-3"><span class="inline-block px-2.5 py-1 rounded-full text-xs font-semibold <?= lead_status_class($o['status'] ?? null) ?>"><?= h(lead_status_label($o['status'] ?? null)) ?></span></td>
                                <td class="px-5 py-3 text-right font-semibold text-slate-800"><?= rupiah($o['estimatedValue'] ?? 0) ?></td>
                                <td class="px-5 py-3 text-slate-500 whitespace-nowrap"><?= h(tgl($o['createdAt'] ?? null)) ?></td>
                                <td class="px-5 py-3 text-right"><a href="order.php?id=<?= (int)$o['id'] ?>" class="text-brand font-medium hover:underline">Detail</a></td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        </div>
    <?php endif; ?>
<?php endif; ?>

<?php include __DIR__ . '/admin_footer.php'; ?>
