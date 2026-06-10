<?php
require_once __DIR__ . '/lib.php';

// Belum ter-install → ke installer
if (!is_installed()) { header('Location: install.php'); exit; }
// Sudah login → ke dashboard
if (is_admin()) { header('Location: dashboard.php'); exit; }

$error = null;
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = trim($_POST['email'] ?? '');
    $pass  = $_POST['password'] ?? '';
    if ($email === '' || $pass === '') {
        $error = 'Email dan password wajib diisi.';
    } elseif (admin_login($email, $pass)) {
        header('Location: dashboard.php');
        exit;
    } else {
        $error = 'Email atau password salah.';
    }
}
$installed = isset($_GET['installed']);
$st = settings();
?>
<!doctype html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Masuk — <?= h($st['storeName'] ?? 'Toko') ?></title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>tailwind.config = { theme: { extend: { colors: { brand: '<?= h(BRAND_COLOR) ?>' } } } };</script>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>body{font-family:'Plus Jakarta Sans',ui-sans-serif,system-ui,sans-serif}</style>
</head>
<body class="min-h-screen lg:grid lg:grid-cols-2 bg-slate-950 text-white">
    <!-- Panel kiri (branding) -->
    <div class="hidden lg:flex flex-col justify-between p-12 relative overflow-hidden min-h-screen">
        <div class="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-brand/30 blur-3xl"></div>
        <div class="absolute bottom-0 right-0 w-96 h-96 rounded-full bg-fuchsia-500/20 blur-3xl"></div>
        <div class="relative flex items-center gap-2 font-extrabold text-lg">
            <span class="h-9 w-9 rounded-xl bg-brand grid place-items-center">T</span>
            <?= h($st['storeName'] ?? 'Toko') ?>
        </div>
        <div class="relative">
            <h2 class="text-4xl font-extrabold leading-tight">Kelola toko<br>dari satu dashboard.</h2>
            <p class="mt-4 text-slate-400 max-w-sm">Order, artikel, pengunjung, dan koneksi PosPro — semua dalam satu tempat yang rapi.</p>
        </div>
        <div class="relative text-sm text-slate-500">&copy; <?= date('Y') ?> <?= h($st['storeName'] ?? 'Toko') ?></div>
    </div>

    <!-- Panel kanan (form) -->
    <div class="min-h-screen flex flex-col justify-center p-6 py-12 bg-slate-100 text-slate-800">
        <div class="w-full max-w-sm mx-auto">
            <h1 class="text-2xl font-extrabold text-slate-900">Selamat datang kembali</h1>
            <p class="text-sm text-slate-500 mt-1">Masuk ke dashboard admin.</p>

            <?php if ($installed): ?>
                <div class="mt-5 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">Pemasangan selesai. Silakan login.</div>
            <?php endif; ?>
            <?php if ($error): ?>
                <div class="mt-5 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm"><?= h($error) ?></div>
            <?php endif; ?>

            <form method="post" class="mt-6 space-y-4">
                <div>
                    <label class="block text-sm font-semibold text-slate-700 mb-1.5">Email</label>
                    <input type="email" name="email" required autofocus value="<?= h($_POST['email'] ?? '') ?>"
                           class="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand/50">
                </div>
                <div>
                    <label class="block text-sm font-semibold text-slate-700 mb-1.5">Password</label>
                    <input type="password" name="password" required
                           class="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand/50">
                </div>
                <button type="submit" class="w-full px-6 py-3 rounded-xl bg-brand text-white font-semibold hover:opacity-90 transition">Masuk</button>
            </form>
        </div>
    </div>
</body>
</html>
