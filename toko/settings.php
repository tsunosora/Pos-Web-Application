<?php
require_once __DIR__ . '/lib.php';
require_admin();

$msg = null; $msgType = 'ok'; $testResult = null;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? 'save';

    // Simpan kategori yang disembunyikan dari toko
    if ($action === 'cats') {
        $ids = array_filter(array_map('intval', $_POST['hidden'] ?? []));
        cfg_set('hidden_cats', implode(',', $ids));
        header('Location: settings.php?cats=1');
        exit;
    }

    // Simpan nilai API (berlaku untuk Simpan maupun Tes)
    cfg_set('pospro_api', rtrim(trim($_POST['pospro_api'] ?? ''), '/'));
    cfg_set('pospro_email', trim($_POST['pospro_email'] ?? ''));
    $pw = $_POST['pospro_password'] ?? '';
    if ($pw !== '') secret_set('pospro_password', $pw);  // hanya update kalau diisi
    unset($_SESSION['pospro_token']);

    if ($action === 'save') {
        header('Location: settings.php?saved=1');
        exit;
    }
    // action === 'test'
    $tok = pospro_token();
    if ($tok) {
        $probe = pospro_get('/crm/leads?source=WEBSITE&limit=1');
        $testResult = is_array($probe)
            ? ['ok' => true,  'text' => 'Berhasil terhubung & membaca order (total: ' . (int)($probe['total'] ?? 0) . ').']
            : ['ok' => false, 'text' => 'Login berhasil tapi gagal membaca order. Pastikan akun punya akses CRM.'];
    } else {
        $testResult = ['ok' => false, 'text' => 'Gagal login ke PosPro. Periksa URL, email, dan password.'];
    }
}
if (isset($_GET['saved'])) { $msg = 'Setelan tersimpan.'; }
if (isset($_GET['cats']))  { $msg = 'Kategori toko diperbarui.'; }

$apiUrl   = cfg('pospro_api', API_BASE);
$apiEmail = cfg('pospro_email', '');
$hasPass  = (cfg('pospro_password') ?? '') !== '';

// Kategori dari katalog (untuk pilih mana yang disembunyikan)
$rawProducts = api_get('/products/public') ?: [];
$allCats = []; $catCount = [];
foreach ($rawProducts as $p) {
    $c = $p['category'] ?? null;
    if ($c) { $allCats[$c['id']] = $c['name']; $catCount[$c['id']] = ($catCount[$c['id']] ?? 0) + 1; }
}
$hidden = array_flip(hidden_cats());

$page_title = 'Setelan';
$active = 'settings';
include __DIR__ . '/admin_header.php';
?>

<div class="max-w-2xl space-y-6">
    <?php if ($msg): ?>
        <div class="px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm"><?= h($msg) ?></div>
    <?php endif; ?>
    <?php if ($testResult): ?>
        <div class="px-4 py-3 rounded-xl text-sm <?= $testResult['ok'] ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-rose-50 border border-rose-200 text-rose-700' ?>"><?= h($testResult['text']) ?></div>
    <?php endif; ?>

    <!-- Koneksi API PosPro -->
    <div class="bg-white rounded-3xl border border-slate-200 p-6">
        <div class="flex items-center gap-3 mb-1">
            <span class="h-10 w-10 rounded-2xl bg-brand/10 text-brand grid place-items-center">
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
            </span>
            <div>
                <h3 class="font-bold text-slate-900">Koneksi API PosPro</h3>
                <p class="text-xs text-slate-400">Hubungkan ke server PosPro untuk menarik data order.</p>
            </div>
            <span class="ml-auto px-2.5 py-1 rounded-full text-xs font-semibold <?= pospro_configured() ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500' ?>"><?= pospro_configured() ? 'Terkonfigurasi' : 'Belum diatur' ?></span>
        </div>

        <form method="post" class="mt-5 space-y-4">
            <div>
                <label class="block text-sm font-semibold text-slate-700 mb-1.5">URL API PosPro</label>
                <input type="url" name="pospro_api" required value="<?= h($apiUrl) ?>" placeholder="https://api.tokokamu.com"
                       class="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand/50">
                <p class="mt-1 text-xs text-slate-400">Alamat backend PosPro di server homelab (harus bisa diakses dari hosting ini).</p>
            </div>
            <div>
                <label class="block text-sm font-semibold text-slate-700 mb-1.5">Email akun service PosPro</label>
                <input type="email" name="pospro_email" value="<?= h($apiEmail) ?>" placeholder="bot@tokokamu.com"
                       class="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand/50">
            </div>
            <div>
                <label class="block text-sm font-semibold text-slate-700 mb-1.5">Password akun service</label>
                <input type="password" name="pospro_password" placeholder="<?= $hasPass ? '•••••••• (biarkan kosong jika tidak diubah)' : 'masukkan password' ?>"
                       class="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand/50">
                <p class="mt-1 text-xs text-slate-400">Disimpan terenkripsi. Disarankan pakai akun khusus (bukan akun owner utama).</p>
            </div>
            <div class="flex gap-3 pt-1">
                <button type="submit" name="action" value="save" class="px-5 py-2.5 rounded-xl bg-brand text-white font-semibold hover:opacity-90 transition">Simpan</button>
                <button type="submit" name="action" value="test" class="px-5 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 transition">Tes Koneksi</button>
            </div>
        </form>
    </div>

    <!-- Kategori tampil di toko -->
    <div class="bg-white rounded-3xl border border-slate-200 p-6">
        <div class="flex items-center gap-3 mb-1">
            <span class="h-10 w-10 rounded-2xl bg-brand/10 text-brand grid place-items-center">
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
            </span>
            <div>
                <h3 class="font-bold text-slate-900">Kategori Tampil di Toko</h3>
                <p class="text-xs text-slate-400">Centang kategori yang ingin <b>disembunyikan</b> dari etalase (mis. bahan baku).</p>
            </div>
        </div>
        <?php if (!count($allCats)): ?>
            <p class="mt-4 text-sm text-slate-400">Belum ada kategori (atau API PosPro belum terhubung).</p>
        <?php else: ?>
            <form method="post" class="mt-4">
                <input type="hidden" name="action" value="cats">
                <div class="grid sm:grid-cols-2 gap-2">
                    <?php foreach ($allCats as $id => $name): $isHidden = isset($hidden[$id]); ?>
                        <label class="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border <?= $isHidden ? 'border-rose-200 bg-rose-50' : 'border-slate-200' ?> cursor-pointer hover:bg-slate-50">
                            <input type="checkbox" name="hidden[]" value="<?= (int)$id ?>" <?= $isHidden ? 'checked' : '' ?> class="accent-rose-500">
                            <span class="flex-1 text-sm text-slate-700 truncate"><?= h($name) ?></span>
                            <span class="text-xs text-slate-400"><?= (int)($catCount[$id] ?? 0) ?> produk</span>
                        </label>
                    <?php endforeach; ?>
                </div>
                <p class="mt-3 text-xs text-slate-400">Yang dicentang tidak akan muncul di beranda, katalog, pencarian, maupun sitemap.</p>
                <button type="submit" class="mt-4 px-5 py-2.5 rounded-xl bg-brand text-white font-semibold hover:opacity-90 transition">Simpan Kategori</button>
            </form>
        <?php endif; ?>
    </div>
</div>

<?php include __DIR__ . '/admin_footer.php'; ?>
