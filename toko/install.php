<?php
require_once __DIR__ . '/lib.php';

// Sudah ter-install → jangan jalankan lagi
if (is_installed()) { header('Location: login.php'); exit; }

$error = null;
$dbOk  = false;
$dbErr = null;

// Cek koneksi DB lebih dulu (pakai kredensial dari config.php / env)
try { db()->query('SELECT 1'); $dbOk = true; }
catch (Throwable $e) { $dbErr = $e->getMessage(); }

if ($dbOk && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $name  = trim($_POST['name'] ?? '');
    $email = trim($_POST['email'] ?? '');
    $pass  = $_POST['password'] ?? '';

    if ($name === '' || $email === '' || $pass === '') {
        $error = 'Semua field wajib diisi.';
    } elseif (strlen($pass) < 8) {
        $error = 'Password minimal 8 karakter.';
    } else {
        try {
            // Jalankan skema (multi-statement)
            $sql = file_get_contents(__DIR__ . '/schema.sql');
            foreach (array_filter(array_map('trim', explode(';', $sql))) as $stmt) {
                if ($stmt !== '') db()->exec($stmt);
            }
            // Buat admin pertama
            $st = db()->prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)');
            $st->execute([$name, $email, password_hash($pass, PASSWORD_DEFAULT), 'admin']);
            header('Location: login.php?installed=1');
            exit;
        } catch (Throwable $e) {
            $error = 'Gagal memasang: ' . $e->getMessage();
        }
    }
}
?>
<!doctype html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Pasang Toko</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>tailwind.config = { theme: { extend: { colors: { brand: '<?= h(BRAND_COLOR) ?>' } } } };</script>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>body{font-family:'Plus Jakarta Sans',ui-sans-serif,system-ui,sans-serif}</style>
</head>
<body class="bg-slate-950 min-h-screen flex flex-col justify-center items-center px-4 py-12 text-slate-200">
    <div class="w-full max-w-md">
        <div class="text-center mb-6">
            <div class="h-12 w-12 mx-auto rounded-2xl bg-brand grid place-items-center font-extrabold text-lg text-white">T</div>
            <h1 class="mt-3 text-2xl font-extrabold text-white">Pasang Toko</h1>
            <p class="text-sm text-slate-400">Setup awal database & akun admin</p>
        </div>

        <?php if (!$dbOk): ?>
            <div class="rounded-2xl bg-rose-500/10 border border-rose-500/30 p-5 text-sm">
                <p class="font-semibold text-rose-300">Koneksi database gagal.</p>
                <p class="mt-1 text-rose-200/80"><?= h($dbErr) ?></p>
                <p class="mt-3 text-slate-400">Periksa kredensial di <code class="text-slate-300">config.php</code> atau environment variable
                    <code class="text-slate-300">TOKO_DB_HOST / TOKO_DB_NAME / TOKO_DB_USER / TOKO_DB_PASS</code>, lalu muat ulang.</p>
            </div>
        <?php else: ?>
            <?php if ($error): ?>
                <div class="mb-4 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm"><?= h($error) ?></div>
            <?php endif; ?>
            <form method="post" class="bg-slate-900 rounded-2xl border border-slate-800 p-6 space-y-4">
                <p class="text-xs text-emerald-400">Database terhubung: <?= h(DB_NAME) ?>@<?= h(DB_HOST) ?></p>
                <div>
                    <label class="block text-sm font-semibold text-slate-300 mb-1.5">Nama Admin</label>
                    <input type="text" name="name" required value="<?= h($_POST['name'] ?? '') ?>"
                           class="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-brand text-white">
                </div>
                <div>
                    <label class="block text-sm font-semibold text-slate-300 mb-1.5">Email</label>
                    <input type="email" name="email" required value="<?= h($_POST['email'] ?? '') ?>"
                           class="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-brand text-white">
                </div>
                <div>
                    <label class="block text-sm font-semibold text-slate-300 mb-1.5">Password <span class="text-slate-500">(min 8)</span></label>
                    <input type="password" name="password" required minlength="8"
                           class="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-brand text-white">
                </div>
                <button type="submit" class="w-full px-6 py-3 rounded-xl bg-brand text-white font-semibold hover:opacity-90 transition">Pasang & Buat Admin</button>
            </form>
        <?php endif; ?>
    </div>
</body>
</html>
