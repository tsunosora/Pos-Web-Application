<?php
require_once __DIR__ . '/lib.php';
require_admin();
ensure_article_columns();
publish_due_articles(); // terbitkan artikel terjadwal yang waktunya tiba

// ── Statistik dari DB toko ───────────────────────────────────────────────────
$totalReads   = (int) db()->query('SELECT COALESCE(SUM(views),0) FROM articles')->fetchColumn();
$publishedArt = (int) db()->query("SELECT COUNT(*) FROM articles WHERE status='PUBLISHED'")->fetchColumn();
$totalUsers   = (int) db()->query('SELECT COUNT(*) FROM users')->fetchColumn();

// Tren kunjungan artikel 14 hari terakhir
$days = [];
for ($i = 13; $i >= 0; $i--) $days[date('Y-m-d', strtotime("-$i day"))] = 0;
$rows = db()->query("SELECT DATE(viewed_at) d, COUNT(*) c FROM article_views WHERE viewed_at >= (CURRENT_DATE - INTERVAL 13 DAY) GROUP BY DATE(viewed_at)");
foreach ($rows as $r) { if (isset($days[$r['d']])) $days[$r['d']] = (int)$r['c']; }
$chartLabels = array_map(fn($d) => date('d/m', strtotime($d)), array_keys($days));
$chartData   = array_values($days);

// Artikel populer
$popular = db()->query("SELECT id, title, slug, views, status FROM articles ORDER BY views DESC LIMIT 5")->fetchAll();

// ── Order dari PosPro (kalau API terhubung) ──────────────────────────────────
$apiOn = pospro_configured();
$totalOrder = null; $newOrder = null; $recentOrders = [];
if ($apiOn) {
    $res = pospro_get('/crm/leads?source=WEBSITE&limit=5');
    if (is_array($res)) {
        $totalOrder   = (int)($res['total'] ?? 0);
        $recentOrders = $res['items'] ?? [];
        $sum = pospro_get('/crm/leads/status-summary');
        $newOrder = is_array($sum) ? (int)($sum['NEW'] ?? 0) : null;
    } else { $apiOn = false; } // kredensial ada tapi gagal konek
}

$u = current_user();
$page_title = 'Dashboard';
$active = 'dashboard';
$with_chart = true;
include __DIR__ . '/admin_header.php';
?>

<!-- Greeting -->
<div class="mb-6">
    <h2 class="text-2xl font-extrabold text-slate-900">Halo, <?= h($u['name'] ?? 'Admin') ?>!</h2>
    <p class="text-slate-500">Ini ringkasan toko kamu hari ini.</p>
</div>

<!-- Bento stat cards -->
<div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
    <div class="rounded-3xl p-5 text-white bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/20">
        <div class="flex items-center justify-between">
            <span class="text-white/80 text-sm font-medium">Total Order</span>
            <svg class="w-5 h-5 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
        </div>
        <div class="mt-3 text-3xl font-extrabold"><?= $totalOrder === null ? '—' : $totalOrder ?></div>
        <div class="text-white/70 text-xs mt-1"><?= $apiOn ? ($newOrder !== null ? "$newOrder order baru" : 'dari website') : 'API belum terhubung' ?></div>
    </div>
    <div class="rounded-3xl p-5 text-white bg-gradient-to-br from-sky-400 to-cyan-500 shadow-lg shadow-sky-500/20">
        <div class="flex items-center justify-between">
            <span class="text-white/80 text-sm font-medium">Total Baca</span>
            <svg class="w-5 h-5 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
        </div>
        <div class="mt-3 text-3xl font-extrabold"><?= number_format($totalReads, 0, ',', '.') ?></div>
        <div class="text-white/70 text-xs mt-1">akumulasi semua artikel</div>
    </div>
    <div class="rounded-3xl p-5 text-white bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-500/20">
        <div class="flex items-center justify-between">
            <span class="text-white/80 text-sm font-medium">Artikel Terbit</span>
            <svg class="w-5 h-5 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7"/></svg>
        </div>
        <div class="mt-3 text-3xl font-extrabold"><?= $publishedArt ?></div>
        <div class="text-white/70 text-xs mt-1">artikel dipublikasikan</div>
    </div>
    <div class="rounded-3xl p-5 text-white bg-gradient-to-br from-emerald-400 to-teal-500 shadow-lg shadow-emerald-500/20">
        <div class="flex items-center justify-between">
            <span class="text-white/80 text-sm font-medium">Akun</span>
            <svg class="w-5 h-5 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4z"/></svg>
        </div>
        <div class="mt-3 text-3xl font-extrabold"><?= $totalUsers ?></div>
        <div class="text-white/70 text-xs mt-1">pengelola dashboard</div>
    </div>
</div>

<div class="grid lg:grid-cols-3 gap-6">
    <!-- Chart tren -->
    <div class="lg:col-span-2 bg-white rounded-3xl border border-slate-200 p-6">
        <div class="flex items-center justify-between mb-4">
            <div>
                <h3 class="font-bold text-slate-900">Kunjungan Artikel</h3>
                <p class="text-xs text-slate-400">14 hari terakhir</p>
            </div>
            <span class="text-sm font-semibold text-brand"><?= array_sum($chartData) ?> kunjungan</span>
        </div>
        <div class="relative h-64"><canvas id="trendChart"></canvas></div>
    </div>

    <!-- Artikel populer -->
    <div class="bg-white rounded-3xl border border-slate-200 p-6">
        <h3 class="font-bold text-slate-900 mb-4">Artikel Populer</h3>
        <?php if (!count($popular)): ?>
            <div class="text-sm text-slate-400 py-8 text-center">Belum ada artikel.<br><a href="articles.php" class="text-brand hover:underline">Tulis artikel pertama</a></div>
        <?php else: ?>
            <ul class="space-y-3">
                <?php foreach ($popular as $i => $a): ?>
                    <li class="flex items-center gap-3">
                        <span class="h-7 w-7 shrink-0 rounded-lg bg-slate-100 text-slate-500 grid place-items-center text-xs font-bold"><?= $i + 1 ?></span>
                        <span class="flex-1 min-w-0 text-sm font-medium text-slate-700 truncate"><?= h($a['title']) ?></span>
                        <span class="text-xs font-semibold text-slate-400 whitespace-nowrap"><?= number_format($a['views'], 0, ',', '.') ?>x</span>
                    </li>
                <?php endforeach; ?>
            </ul>
        <?php endif; ?>
    </div>
</div>

<!-- Order terbaru -->
<div class="bg-white rounded-3xl border border-slate-200 p-6 mt-6">
    <div class="flex items-center justify-between mb-4">
        <h3 class="font-bold text-slate-900">Order Terbaru</h3>
        <a href="orders.php" class="text-sm text-brand font-medium hover:underline">Lihat semua</a>
    </div>
    <?php if (!$apiOn): ?>
        <div class="text-center py-10">
            <p class="text-slate-400 text-sm">API PosPro belum terhubung, jadi order belum bisa ditampilkan.</p>
            <a href="settings.php" class="inline-block mt-3 px-4 py-2 rounded-xl bg-brand text-white text-sm font-semibold hover:opacity-90">Hubungkan Sekarang</a>
        </div>
    <?php elseif (!count($recentOrders)): ?>
        <p class="text-slate-400 text-sm py-6 text-center">Belum ada order masuk.</p>
    <?php else: ?>
        <div class="divide-y divide-slate-100">
            <?php foreach ($recentOrders as $o): ?>
                <a href="order.php?id=<?= (int)$o['id'] ?>" class="flex items-center gap-4 py-3 hover:bg-slate-50 -mx-2 px-2 rounded-lg">
                    <span class="h-9 w-9 rounded-full bg-slate-100 text-slate-500 grid place-items-center font-bold text-sm"><?= h(strtoupper(substr($o['name'] ?? 'O', 0, 1))) ?></span>
                    <div class="flex-1 min-w-0">
                        <div class="text-sm font-semibold text-slate-800 truncate"><?= h($o['name'] ?? '-') ?></div>
                        <div class="text-xs text-slate-400"><?= h(tgl($o['createdAt'] ?? null)) ?></div>
                    </div>
                    <span class="px-2.5 py-1 rounded-full text-xs font-semibold <?= lead_status_class($o['status'] ?? null) ?>"><?= h(lead_status_label($o['status'] ?? null)) ?></span>
                    <span class="text-sm font-bold text-slate-800 whitespace-nowrap hidden sm:block"><?= rupiah($o['estimatedValue'] ?? 0) ?></span>
                </a>
            <?php endforeach; ?>
        </div>
    <?php endif; ?>
</div>

<script>
const ctx = document.getElementById('trendChart');
const grad = ctx.getContext('2d').createLinearGradient(0, 0, 0, 200);
grad.addColorStop(0, '<?= h(BRAND_COLOR) ?>55');
grad.addColorStop(1, '<?= h(BRAND_COLOR) ?>00');
new Chart(ctx, {
    type: 'line',
    data: {
        labels: <?= json_encode($chartLabels) ?>,
        datasets: [{
            data: <?= json_encode($chartData) ?>,
            borderColor: '<?= h(BRAND_COLOR) ?>',
            backgroundColor: grad,
            borderWidth: 3, fill: true, tension: 0.4,
            pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: '<?= h(BRAND_COLOR) ?>',
        }]
    },
    options: {
        plugins: { legend: { display: false } },
        scales: {
            x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 11 } } },
            y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { color: '#94a3b8', precision: 0 } }
        },
        maintainAspectRatio: false,
    }
});
</script>

<?php include __DIR__ . '/admin_footer.php'; ?>
