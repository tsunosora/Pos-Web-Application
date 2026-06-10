<?php
require_once __DIR__ . '/lib.php';
ensure_article_columns();
publish_due_articles(); // auto-terbit artikel terjadwal yang waktunya tiba

$st   = settings();
$slug = trim($_GET['slug'] ?? '');
$single = null;

if ($slug !== '') {
    $stm = db()->prepare("SELECT * FROM articles WHERE slug = ? AND status = 'PUBLISHED' LIMIT 1");
    $stm->execute([$slug]);
    $single = $stm->fetch();

    // Tracking baca (dedupe per sesi agar refresh tak menggelembungkan angka)
    if ($single) {
        $seen = $_SESSION['seen_articles'] ?? [];
        if (!in_array((int)$single['id'], $seen, true)) {
            try {
                db()->prepare('UPDATE articles SET views = views + 1 WHERE id = ?')->execute([$single['id']]);
                db()->prepare('INSERT INTO article_views (article_id, ip_hash, referrer, user_agent) VALUES (?,?,?,?)')
                    ->execute([
                        $single['id'],
                        hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . APP_KEY),
                        mb_substr($_SERVER['HTTP_REFERER'] ?? '', 0, 255),
                        mb_substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 255),
                    ]);
                $single['views']++;
            } catch (Throwable $e) {}
            $seen[] = (int)$single['id'];
            $_SESSION['seen_articles'] = $seen;
        }
    }
}

// Meta SEO
$brand = $st['storeName'] ?? 'Toko';
if ($single) {
    $metaTitle = ($single['meta_title'] ?: $single['title']) . ' — ' . $brand;
    $metaDesc  = $single['meta_description'] ?: $single['excerpt'];
    $ogImage   = $single['cover_url'] ?? '';
} else {
    $metaTitle = 'Artikel — ' . $brand;
    $metaDesc  = 'Kumpulan artikel & tips dari ' . $brand;
    $ogImage   = '';
}
?>
<!doctype html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title><?= h($metaTitle) ?></title>
    <meta name="description" content="<?= h($metaDesc) ?>">
    <meta property="og:title" content="<?= h($metaTitle) ?>">
    <meta property="og:description" content="<?= h($metaDesc) ?>">
    <meta property="og:type" content="<?= $single ? 'article' : 'website' ?>">
    <meta property="og:site_name" content="<?= h($brand) ?>">
    <?php if ($ogImage): ?><meta property="og:image" content="<?= h(abs_url($ogImage)) ?>"><?php endif; ?>
    <meta name="twitter:card" content="<?= $ogImage ? 'summary_large_image' : 'summary' ?>">
    <meta name="twitter:title" content="<?= h($metaTitle) ?>">
    <meta name="twitter:description" content="<?= h($metaDesc) ?>">
    <?php if ($ogImage): ?><meta name="twitter:image" content="<?= h(abs_url($ogImage)) ?>"><?php endif; ?>
    <link rel="canonical" href="<?= h($single ? abs_url('artikel.php?slug=' . urlencode($slug)) : abs_url('artikel.php')) ?>">
    <?php if ($single): ?>
    <script type="application/ld+json"><?= json_encode([
        '@context' => 'https://schema.org', '@type' => 'Article',
        'headline' => $single['title'],
        'description' => $metaDesc,
        'image' => $ogImage ? abs_url($ogImage) : null,
        'datePublished' => $single['published_at'] ?: $single['created_at'],
        'dateModified' => $single['updated_at'] ?? ($single['published_at'] ?: $single['created_at']),
        'author' => ['@type' => 'Organization', 'name' => $brand],
        'publisher' => ['@type' => 'Organization', 'name' => $brand],
        'mainEntityOfPage' => abs_url('artikel.php?slug=' . urlencode($slug)),
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?></script>
    <?php endif; ?>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>tailwind.config = { theme: { extend: { colors: { brand: '<?= h(BRAND_COLOR) ?>' } } } };</script>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>body{font-family:'Plus Jakarta Sans',ui-sans-serif,system-ui,sans-serif}
    .prose-art{line-height:1.8;color:#334155}
    .prose-art h1{font-size:1.9rem;font-weight:800;margin:1.75rem 0 .75rem;color:#0f172a}
    .prose-art h2{font-size:1.5rem;font-weight:800;margin:1.5rem 0 .75rem;color:#0f172a}
    .prose-art h3{font-size:1.25rem;font-weight:700;margin:1.25rem 0 .5rem;color:#1e293b}
    .prose-art h4{font-size:1.1rem;font-weight:700;margin:1.1rem 0 .5rem;color:#1e293b}
    .prose-art h5{font-size:1rem;font-weight:700;margin:1rem 0 .5rem;color:#334155}
    .prose-art h6{font-size:.9rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin:1rem 0 .5rem;color:#64748b}
    .prose-art p{margin:.75rem 0}
    .prose-art img{border-radius:1rem;margin:1.25rem 0;max-width:100%;height:auto}
    .prose-art ul{list-style:disc;padding-left:1.5rem;margin:.75rem 0}
    .prose-art ol{list-style:decimal;padding-left:1.5rem;margin:.75rem 0}
    .prose-art li{margin:.25rem 0}
    .prose-art a{color:<?= h(BRAND_COLOR) ?>;text-decoration:underline}
    .prose-art s,.prose-art del{text-decoration:line-through;color:#94a3b8}
    .prose-art sub{vertical-align:sub;font-size:.75em}.prose-art sup{vertical-align:super;font-size:.75em}
    .prose-art blockquote{border-left:4px solid <?= h(BRAND_COLOR) ?>;padding:.25rem 0 .25rem 1rem;color:#64748b;font-style:italic;margin:1rem 0}
    .prose-art code{background:#f1f5f9;padding:.1rem .35rem;border-radius:.35rem;font-family:monospace;font-size:.9em;color:#db2777}
    .prose-art pre,.prose-art .ql-syntax{background:#0f172a;color:#e2e8f0;padding:1rem 1.25rem;border-radius:.75rem;overflow-x:auto;font-family:monospace;font-size:.9rem;line-height:1.6;margin:1rem 0;white-space:pre-wrap}
    .prose-art .ql-indent-1{padding-left:3rem}.prose-art .ql-indent-2{padding-left:4.5rem}.prose-art .ql-indent-3{padding-left:6rem}
    .prose-art .ql-indent-4{padding-left:7.5rem}.prose-art .ql-indent-5{padding-left:9rem}.prose-art .ql-indent-6{padding-left:10.5rem}
    .prose-art .ql-video{width:100%;aspect-ratio:16/9;height:auto;border-radius:1rem;margin:1.25rem 0;border:0}
    .prose-art hr{border:0;border-top:1px solid #e2e8f0;margin:1.5rem 0}</style>
</head>
<body class="bg-slate-50 text-slate-800 min-h-screen flex flex-col">
<header class="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-slate-200">
    <div class="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
        <a href="index.php" class="flex items-center gap-2 font-extrabold text-slate-900">
            <?php if (!empty($st['logoImageUrl'])): ?><img src="<?= h(img_url($st['logoImageUrl'])) ?>" class="h-9 w-9 rounded-lg object-cover"><?php endif; ?>
            <?= h($brand) ?>
        </a>
        <nav class="flex items-center gap-1">
            <a href="index.php" class="px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100">Beranda</a>
            <a href="artikel.php" class="px-3 py-2 rounded-lg text-sm font-medium <?= $single ? 'text-slate-600 hover:bg-slate-100' : 'text-brand' ?>">Artikel</a>
            <a href="cart.php" class="px-3 py-2 rounded-lg text-sm font-semibold text-white bg-brand hover:opacity-90">Keranjang</a>
        </nav>
    </div>
</header>

<main class="flex-1 max-w-5xl w-full mx-auto px-4 py-8">
<?php if ($slug !== '' && !$single): ?>
    <div class="text-center py-20 text-slate-400">
        <p class="text-lg">Artikel tidak ditemukan.</p>
        <a href="artikel.php" class="text-brand font-medium hover:underline">Lihat semua artikel</a>
    </div>

<?php elseif ($single): ?>
    <!-- Single article -->
    <article class="max-w-3xl mx-auto">
        <a href="artikel.php" class="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand mb-5">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>Semua artikel
        </a>
        <h1 class="text-3xl sm:text-4xl font-extrabold text-slate-900 leading-tight"><?= h($single['title']) ?></h1>
        <div class="mt-3 flex items-center gap-3 text-sm text-slate-400">
            <span><?= h(tgl($single['published_at'] ?: $single['created_at'])) ?></span>
            <span>·</span>
            <span><?= (int)$single['views'] ?>x dibaca</span>
        </div>
        <?php if (!empty($single['cover_url'])): ?>
            <img src="<?= h($single['cover_url']) ?>" alt="<?= h($single['title']) ?>" class="w-full rounded-3xl mt-6 aspect-[16/9] object-cover">
        <?php endif; ?>
        <div class="prose-art mt-6 text-[16px]"><?= $single['content'] ?></div>
    </article>

<?php else: ?>
    <!-- List -->
    <h1 class="text-3xl font-extrabold text-slate-900 mb-1">Artikel</h1>
    <p class="text-slate-500 mb-8">Tips, kabar, dan cerita dari <?= h($brand) ?>.</p>
    <?php
    $list = db()->query("SELECT title, slug, excerpt, cover_url, views, published_at, created_at FROM articles WHERE status='PUBLISHED' ORDER BY COALESCE(published_at, created_at) DESC")->fetchAll();
    ?>
    <?php if (!count($list)): ?>
        <div class="text-center py-20 text-slate-400">Belum ada artikel.</div>
    <?php else: ?>
        <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <?php foreach ($list as $a): ?>
                <a href="artikel.php?slug=<?= h($a['slug']) ?>" class="group bg-white rounded-3xl border border-slate-200 overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all flex flex-col">
                    <div class="aspect-[16/9] bg-slate-100 overflow-hidden">
                        <?php if (!empty($a['cover_url'])): ?>
                            <img src="<?= h($a['cover_url']) ?>" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300">
                        <?php else: ?>
                            <div class="w-full h-full grid place-items-center text-slate-300"><svg class="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.4"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M4 6h16v12H4z"/></svg></div>
                        <?php endif; ?>
                    </div>
                    <div class="p-5 flex flex-col flex-1">
                        <h2 class="font-bold text-slate-800 leading-snug line-clamp-2 group-hover:text-brand"><?= h($a['title']) ?></h2>
                        <?php if (!empty($a['excerpt'])): ?><p class="mt-2 text-sm text-slate-500 line-clamp-3"><?= h($a['excerpt']) ?></p><?php endif; ?>
                        <div class="mt-auto pt-3 text-xs text-slate-400"><?= h(tgl($a['published_at'] ?: $a['created_at'])) ?> · <?= (int)$a['views'] ?>x dibaca</div>
                    </div>
                </a>
            <?php endforeach; ?>
        </div>
    <?php endif; ?>
<?php endif; ?>
</main>

<footer class="border-t border-slate-200 bg-white">
    <div class="max-w-5xl mx-auto px-4 py-6 text-sm text-slate-500 text-center">
        <?= h($brand) ?> &copy; <?= date('Y') ?>
    </div>
</footer>
</body>
</html>
