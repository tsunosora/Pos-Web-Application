<?php
require_once __DIR__ . '/lib.php';
require_admin();
require_csrf();

$msg = $_GET['msg'] ?? null;
$err = null;

// ── Export: stream file (sebelum output apa pun) ─────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'export') {
    $sql   = db_dump_sql();
    $fname = 'backup-' . store_slug() . '-' . date('Ymd-His');

    if (class_exists('ZipArchive')) {
        $tmp = tempnam(sys_get_temp_dir(), 'tokobak');
        $zip = new ZipArchive();
        $zip->open($tmp, ZipArchive::OVERWRITE);
        $zip->addFromString('database.sql', $sql);
        $zip->addFromString('meta.json', json_encode([
            'app' => 'toko', 'store' => settings()['storeName'] ?? '', 'created' => date('c'),
        ], JSON_PRETTY_PRINT));
        foreach (glob(uploads_dir() . '/*') as $f) {
            if (is_file($f) && basename($f) !== '.gitkeep') $zip->addFile($f, 'uploads/' . basename($f));
        }
        $zip->close();
        header('Content-Type: application/zip');
        header('Content-Disposition: attachment; filename="' . $fname . '.zip"');
        header('Content-Length: ' . filesize($tmp));
        readfile($tmp);
        @unlink($tmp);
        exit;
    }
    // Fallback tanpa ZipArchive: hanya database .sql
    header('Content-Type: application/sql');
    header('Content-Disposition: attachment; filename="' . $fname . '.sql"');
    echo $sql;
    exit;
}

// ── Restore ──────────────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'restore') {
    if (($_POST['confirm'] ?? '') !== 'yes') {
        $err = 'Centang konfirmasi dulu — restore akan menimpa data saat ini.';
    } elseif (empty($_FILES['backup']['tmp_name']) || ($_FILES['backup']['error'] ?? 1) !== UPLOAD_ERR_OK) {
        $err = 'File backup belum dipilih atau gagal diunggah.';
    } else {
        $tmp  = $_FILES['backup']['tmp_name'];
        $name = strtolower($_FILES['backup']['name'] ?? '');
        try {
            $sql = null;
            if (substr($name, -4) === '.zip' && class_exists('ZipArchive')) {
                $zip = new ZipArchive();
                if ($zip->open($tmp) !== true) throw new Exception('File ZIP tidak valid.');
                $sql = $zip->getFromName('database.sql');
                if ($sql === false) throw new Exception('database.sql tidak ditemukan dalam ZIP.');
                // Pulihkan uploads
                for ($i = 0; $i < $zip->numFiles; $i++) {
                    $entry = $zip->getNameIndex($i);
                    if (strpos($entry, 'uploads/') === 0 && substr($entry, -1) !== '/') {
                        $base = basename($entry);
                        if ($base !== '' && $base !== '.gitkeep') {
                            $data = $zip->getFromIndex($i);
                            if ($data !== false) @file_put_contents(uploads_dir() . '/' . $base, $data);
                        }
                    }
                }
                $zip->close();
            } else {
                $sql = file_get_contents($tmp);
            }
            if (!$sql || stripos($sql, 'CREATE TABLE') === false) throw new Exception('Isi backup tidak dikenali.');
            db_restore_sql($sql);
            header('Location: backup.php?msg=' . urlencode('Restore berhasil. Data telah dipulihkan.'));
            exit;
        } catch (Throwable $e) {
            $err = 'Gagal restore: ' . $e->getMessage();
        }
    }
}

// Statistik untuk ditampilkan
$counts = [];
try {
    foreach (['users', 'articles', 'article_views', 'settings'] as $t) {
        $counts[$t] = (int) db()->query('SELECT COUNT(*) FROM `' . $t . '`')->fetchColumn();
    }
} catch (Throwable $e) {}
$uploadCount = count(array_filter(glob(uploads_dir() . '/*') ?: [], fn($f) => is_file($f) && basename($f) !== '.gitkeep'));
$hasZip = class_exists('ZipArchive');

$page_title = 'Backup & Restore';
$active = 'backup';
include __DIR__ . '/admin_header.php';
?>

<div class="max-w-3xl space-y-6">
    <?php if ($msg): ?><div class="px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm"><?= h($msg) ?></div><?php endif; ?>
    <?php if ($err): ?><div class="px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm"><?= h($err) ?></div><?php endif; ?>

    <!-- Backup -->
    <div class="bg-white rounded-3xl border border-slate-200 p-6">
        <div class="flex items-start gap-3">
            <span class="h-10 w-10 rounded-2xl bg-brand/10 text-brand grid place-items-center shrink-0">
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M4 7v10c0 2 1.5 3 4 3h8c2.5 0 4-1 4-3V7M4 7c0-2 1.5-3 4-3h8c2.5 0 4 1 4 3M4 7c0 2 1.5 3 4 3h8c2.5 0 4-1 4-3M12 12v6m0 0l-2.5-2.5M12 18l2.5-2.5"/></svg>
            </span>
            <div class="flex-1">
                <h3 class="font-bold text-slate-900">Backup</h3>
                <p class="text-sm text-slate-500">Unduh cadangan database <?= $hasZip ? '+ gambar (uploads)' : '' ?> dalam satu file.</p>
            </div>
        </div>
        <div class="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div class="rounded-xl bg-slate-50 p-3"><div class="text-xl font-extrabold text-slate-800"><?= $counts['articles'] ?? 0 ?></div><div class="text-xs text-slate-400">Artikel</div></div>
            <div class="rounded-xl bg-slate-50 p-3"><div class="text-xl font-extrabold text-slate-800"><?= $counts['article_views'] ?? 0 ?></div><div class="text-xs text-slate-400">Kunjungan</div></div>
            <div class="rounded-xl bg-slate-50 p-3"><div class="text-xl font-extrabold text-slate-800"><?= $counts['users'] ?? 0 ?></div><div class="text-xs text-slate-400">Akun</div></div>
            <div class="rounded-xl bg-slate-50 p-3"><div class="text-xl font-extrabold text-slate-800"><?= $uploadCount ?></div><div class="text-xs text-slate-400">Gambar</div></div>
        </div>
        <div class="mt-4 flex items-center justify-between gap-3 flex-wrap">
            <p class="text-xs text-slate-400">Nama file: <code class="text-slate-600">backup-<?= h(store_slug()) ?>-<?= date('Ymd-His') ?>.<?= $hasZip ? 'zip' : 'sql' ?></code></p>
            <form method="post">
                <?= csrf_field() ?>
                <button name="action" value="export" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:opacity-90 transition">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/></svg>
                    Unduh Backup
                </button>
            </form>
        </div>
    </div>

    <!-- Restore -->
    <div class="bg-white rounded-3xl border border-slate-200 p-6">
        <div class="flex items-start gap-3">
            <span class="h-10 w-10 rounded-2xl bg-amber-100 text-amber-600 grid place-items-center shrink-0">
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            </span>
            <div class="flex-1">
                <h3 class="font-bold text-slate-900">Restore</h3>
                <p class="text-sm text-slate-500">Pulihkan dari file backup (.zip / .sql).</p>
            </div>
        </div>
        <div class="mt-4 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs">
            Perhatian: restore akan <b>menimpa</b> seluruh data toko saat ini (artikel, akun, setelan). Pastikan sudah punya backup terbaru.
        </div>
        <form method="post" enctype="multipart/form-data" class="mt-4 space-y-3" onsubmit="return confirm('Yakin restore? Data saat ini akan ditimpa.')">
            <?= csrf_field() ?>
            <input type="hidden" name="action" value="restore">
            <input type="file" name="backup" accept=".zip,.sql" required
                   class="block w-full text-sm text-slate-500 file:mr-3 file:px-4 file:py-2 file:rounded-lg file:border-0 file:bg-slate-200 file:text-slate-700 file:font-semibold file:cursor-pointer">
            <label class="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" name="confirm" value="yes" class="accent-rose-500"> Saya paham data saat ini akan ditimpa.</label>
            <button class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition">Restore Sekarang</button>
        </form>
    </div>
</div>

<?php include __DIR__ . '/admin_footer.php'; ?>
