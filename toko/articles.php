<?php
require_once __DIR__ . '/lib.php';
require_admin();
ensure_article_columns();
publish_due_articles(); // terbitkan yang jadwalnya sudah tiba

$msg = $_GET['msg'] ?? null;

// Aksi: hapus / ubah status
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? '';
    $id = (int)($_POST['id'] ?? 0);
    if ($action === 'delete' && $id) {
        db()->prepare('DELETE FROM articles WHERE id=?')->execute([$id]);
        db()->prepare('DELETE FROM article_views WHERE article_id=?')->execute([$id]);
        header('Location: articles.php?msg=' . urlencode('Artikel dihapus.')); exit;
    }
    if ($action === 'toggle' && $id) {
        $cur = db()->query('SELECT status FROM articles WHERE id=' . $id)->fetchColumn();
        if ($cur === 'PUBLISHED') {
            db()->prepare("UPDATE articles SET status='DRAFT' WHERE id=?")->execute([$id]);
        } else { // DRAFT atau SCHEDULED → terbitkan sekarang
            db()->prepare("UPDATE articles SET status='PUBLISHED', published_at=COALESCE(published_at, NOW()), scheduled_at=NULL WHERE id=?")->execute([$id]);
        }
        header('Location: articles.php?msg=' . urlencode('Status diperbarui.')); exit;
    }
}

$filter = $_GET['status'] ?? '';
$sql = 'SELECT id, title, slug, status, views, seo_score, cover_url, scheduled_at, published_at, updated_at FROM articles';
if (in_array($filter, ['DRAFT', 'PUBLISHED', 'SCHEDULED'], true)) $sql .= " WHERE status='" . $filter . "'";
$sql .= ' ORDER BY updated_at DESC';
$articles = db()->query($sql)->fetchAll();

$page_title = 'Artikel';
$active = 'articles';
include __DIR__ . '/admin_header.php';

function seo_badge(int $s): string {
    if ($s >= 80) return 'bg-emerald-100 text-emerald-700';
    if ($s >= 50) return 'bg-amber-100 text-amber-700';
    return 'bg-rose-100 text-rose-700';
}
?>

<div class="flex items-center justify-between mb-6 gap-3 flex-wrap">
    <div class="flex gap-2">
        <?php $tabs = ['' => 'Semua', 'PUBLISHED' => 'Terbit', 'SCHEDULED' => 'Terjadwal', 'DRAFT' => 'Draf'];
        foreach ($tabs as $k => $lbl): $on = $filter === $k; ?>
            <a href="articles.php<?= $k === '' ? '' : '?status=' . $k ?>" class="px-3.5 py-1.5 rounded-full text-sm font-medium <?= $on ? 'bg-brand text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50' ?>"><?= h($lbl) ?></a>
        <?php endforeach; ?>
    </div>
    <a href="article-edit.php" class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:opacity-90 transition">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
        Tulis Artikel
    </a>
</div>

<?php if ($msg): ?><div class="mb-4 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm"><?= h($msg) ?></div><?php endif; ?>

<?php if (!count($articles)): ?>
    <div class="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-400">
        Belum ada artikel. <a href="article-edit.php" class="text-brand font-medium hover:underline">Tulis yang pertama</a>.
    </div>
<?php else: ?>
    <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <?php foreach ($articles as $a): ?>
            <div class="bg-white rounded-3xl border border-slate-200 overflow-hidden flex flex-col">
                <div class="aspect-[16/9] bg-slate-100 overflow-hidden">
                    <?php if (!empty($a['cover_url'])): ?>
                        <img src="<?= h($a['cover_url']) ?>" alt="" class="w-full h-full object-cover">
                    <?php else: ?>
                        <div class="w-full h-full grid place-items-center text-slate-300">
                            <svg class="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.4"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M4 6h16v12H4z"/></svg>
                        </div>
                    <?php endif; ?>
                </div>
                <div class="p-4 flex flex-col flex-1">
                    <?php
                    $stMap = [
                        'PUBLISHED' => ['Terbit', 'bg-emerald-100 text-emerald-700'],
                        'SCHEDULED' => ['Terjadwal', 'bg-indigo-100 text-indigo-700'],
                        'DRAFT'     => ['Draf', 'bg-slate-100 text-slate-500'],
                    ];
                    [$stTxt, $stCls] = $stMap[$a['status']] ?? $stMap['DRAFT'];
                    ?>
                    <div class="flex items-center gap-2 mb-2">
                        <span class="px-2 py-0.5 rounded-full text-[11px] font-semibold <?= $stCls ?>"><?= $stTxt ?></span>
                        <span class="px-2 py-0.5 rounded-full text-[11px] font-semibold <?= seo_badge((int)$a['seo_score']) ?>" title="Skor SEO">SEO <?= (int)$a['seo_score'] ?></span>
                        <span class="ml-auto text-xs text-slate-400"><?= (int)$a['views'] ?>x baca</span>
                    </div>
                    <h3 class="font-bold text-slate-800 leading-snug line-clamp-2"><?= h($a['title']) ?></h3>
                    <?php if ($a['status'] === 'SCHEDULED' && !empty($a['scheduled_at'])): ?>
                        <p class="mt-1 text-xs font-semibold text-indigo-600 flex items-center gap-1">
                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                            Tayang <?= h(tgl($a['scheduled_at'])) ?>
                        </p>
                    <?php else: ?>
                        <p class="mt-1 text-xs text-slate-400">Diubah <?= h(tgl($a['updated_at'])) ?></p>
                    <?php endif; ?>
                    <div class="mt-auto pt-3 flex items-center gap-2">
                        <a href="article-edit.php?id=<?= (int)$a['id'] ?>" class="flex-1 text-center px-3 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200">Edit</a>
                        <?php if ($a['status'] === 'PUBLISHED'): ?>
                            <a href="artikel.php?slug=<?= h($a['slug']) ?>" target="_blank" class="px-3 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200" title="Lihat">Lihat</a>
                        <?php endif; ?>
                        <form method="post" class="contents">
                            <input type="hidden" name="id" value="<?= (int)$a['id'] ?>">
                            <button name="action" value="toggle" class="px-3 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200" title="<?= $a['status'] === 'PUBLISHED' ? 'Jadikan draf' : 'Terbitkan' ?>">
                                <?= $a['status'] === 'PUBLISHED' ? 'Tarik' : 'Terbit' ?>
                            </button>
                        </form>
                        <form method="post" class="contents" onsubmit="return confirm('Hapus artikel ini?')">
                            <input type="hidden" name="id" value="<?= (int)$a['id'] ?>">
                            <button name="action" value="delete" class="p-2 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50" title="Hapus">
                                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        <?php endforeach; ?>
    </div>
<?php endif; ?>

<?php include __DIR__ . '/admin_footer.php'; ?>
