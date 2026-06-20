<?php
require_once __DIR__ . '/lib.php';
require_admin();

$me  = current_user();
$msg = null; $err = null;
$isAdminRole = ($me['role'] ?? '') === 'admin';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    require_csrf();
    $action = $_POST['action'] ?? '';
    try {
        if ($action === 'add') {
            if (!$isAdminRole) $err = 'Hanya admin yang boleh menambah akun.';
            else {
                $name = trim($_POST['name'] ?? '');
                $email = trim($_POST['email'] ?? '');
                $pass = $_POST['password'] ?? '';
                $role = ($_POST['role'] ?? 'editor') === 'admin' ? 'admin' : 'editor';
                if ($name === '' || $email === '' || $pass === '') $err = 'Nama, email, dan password wajib diisi.';
                elseif (strlen($pass) < 8) $err = 'Password minimal 8 karakter.';
                else {
                    $st = db()->prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?,?)');
                    $st->execute([$name, $email, password_hash($pass, PASSWORD_DEFAULT), $role]);
                    $msg = 'Akun ditambahkan.';
                }
            }
        } elseif ($action === 'delete') {
            $id = (int)($_POST['id'] ?? 0);
            if (!$isAdminRole) $err = 'Hanya admin yang boleh menghapus akun.';
            elseif ($id === (int)$me['id']) $err = 'Tidak bisa menghapus akun sendiri.';
            else { db()->prepare('DELETE FROM users WHERE id=?')->execute([$id]); $msg = 'Akun dihapus.'; }
        } elseif ($action === 'passwd') {
            $cur = $_POST['current'] ?? ''; $new = $_POST['new'] ?? '';
            $row = db()->query('SELECT password_hash FROM users WHERE id=' . (int)$me['id'])->fetch();
            if (!$row || !password_verify($cur, $row['password_hash'])) $err = 'Password saat ini salah.';
            elseif (strlen($new) < 8) $err = 'Password baru minimal 8 karakter.';
            else { db()->prepare('UPDATE users SET password_hash=? WHERE id=?')->execute([password_hash($new, PASSWORD_DEFAULT), $me['id']]); $msg = 'Password diperbarui.'; }
        }
    } catch (Throwable $e) {
        $err = (str_contains($e->getMessage(), 'Duplicate')) ? 'Email sudah dipakai.' : 'Gagal menyimpan. Coba lagi.';
    }
}

$users = db()->query('SELECT id, name, email, role, last_login_at, created_at FROM users ORDER BY id')->fetchAll();

$page_title = 'Akun';
$active = 'accounts';
include __DIR__ . '/admin_header.php';
?>

<div class="grid lg:grid-cols-3 gap-6 items-start">
    <!-- Daftar akun -->
    <div class="lg:col-span-2 space-y-4">
        <?php if ($msg): ?><div class="px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm"><?= h($msg) ?></div><?php endif; ?>
        <?php if ($err): ?><div class="px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm"><?= h($err) ?></div><?php endif; ?>

        <div class="bg-white rounded-3xl border border-slate-200 overflow-hidden">
            <div class="px-6 py-4 border-b border-slate-100 font-bold text-slate-900">Pengelola Dashboard</div>
            <div class="divide-y divide-slate-100">
                <?php foreach ($users as $usr): ?>
                    <div class="flex items-center gap-4 px-6 py-4">
                        <span class="h-10 w-10 rounded-full bg-gradient-to-br from-brand to-fuchsia-500 text-white grid place-items-center font-bold"><?= h(strtoupper(substr($usr['name'], 0, 1))) ?></span>
                        <div class="flex-1 min-w-0">
                            <div class="font-semibold text-slate-800 truncate"><?= h($usr['name']) ?>
                                <?php if ($usr['id'] == $me['id']): ?><span class="text-xs text-slate-400 font-normal">(kamu)</span><?php endif; ?>
                            </div>
                            <div class="text-xs text-slate-400 truncate"><?= h($usr['email']) ?></div>
                        </div>
                        <span class="px-2.5 py-1 rounded-full text-xs font-semibold <?= $usr['role'] === 'admin' ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-600' ?>"><?= h($usr['role']) ?></span>
                        <?php if ($usr['id'] != $me['id'] && $isAdminRole): ?>
                            <form method="post" onsubmit="return confirm('Hapus akun ini?')">
                                <?= csrf_field() ?>
                                <input type="hidden" name="action" value="delete">
                                <input type="hidden" name="id" value="<?= (int)$usr['id'] ?>">
                                <button class="text-slate-300 hover:text-rose-500 p-1.5" title="Hapus">
                                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                </button>
                            </form>
                        <?php endif; ?>
                    </div>
                <?php endforeach; ?>
            </div>
        </div>
    </div>

    <!-- Tambah akun + ganti password -->
    <div class="space-y-6">
        <?php if ($isAdminRole): ?>
        <div class="bg-white rounded-3xl border border-slate-200 p-6">
            <h3 class="font-bold text-slate-900 mb-4">Tambah Akun</h3>
            <form method="post" class="space-y-3">
                <?= csrf_field() ?>
                <input type="hidden" name="action" value="add">
                <input type="text" name="name" placeholder="Nama" required class="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand/50">
                <input type="email" name="email" placeholder="Email" required class="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand/50">
                <input type="password" name="password" placeholder="Password (min 8)" required minlength="8" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand/50">
                <select name="role" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand/50">
                    <option value="editor">Editor</option>
                    <option value="admin">Admin</option>
                </select>
                <button class="w-full px-5 py-2.5 rounded-xl bg-brand text-white font-semibold hover:opacity-90 transition">Tambah</button>
            </form>
        </div>
        <?php endif; ?>

        <div class="bg-white rounded-3xl border border-slate-200 p-6">
            <h3 class="font-bold text-slate-900 mb-4">Ubah Password Saya</h3>
            <form method="post" class="space-y-3">
                <?= csrf_field() ?>
                <input type="hidden" name="action" value="passwd">
                <input type="password" name="current" placeholder="Password saat ini" required class="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand/50">
                <input type="password" name="new" placeholder="Password baru (min 8)" required minlength="8" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand/50">
                <button class="w-full px-5 py-2.5 rounded-xl bg-slate-900 text-white font-semibold hover:bg-slate-800 transition">Perbarui</button>
            </form>
        </div>
    </div>
</div>

<?php include __DIR__ . '/admin_footer.php'; ?>
