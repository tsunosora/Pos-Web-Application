<?php
require_once __DIR__ . '/lib.php';
require_admin();
$st = settings();
$u  = current_user();
$active     = $active ?? '';
$page_title = $page_title ?? 'Dashboard';
$with_chart = $with_chart ?? false;

$nav = [
    ['key' => 'dashboard', 'href' => 'dashboard.php', 'label' => 'Dashboard',
     'icon' => 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6'],
    ['key' => 'orders', 'href' => 'orders.php', 'label' => 'Order',
     'icon' => 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z'],
    ['key' => 'articles', 'href' => 'articles.php', 'label' => 'Artikel',
     'icon' => 'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z'],
    ['key' => 'accounts', 'href' => 'accounts.php', 'label' => 'Akun',
     'icon' => 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z'],
    ['key' => 'appearance', 'href' => 'content.php', 'label' => 'Konten',
     'icon' => 'M4 5a1 1 0 011-1h14a1 1 0 011 1v4H4V5zm0 6h7v8H5a1 1 0 01-1-1v-7zm9 0h7v7a1 1 0 01-1 1h-6v-8z'],
    ['key' => 'settings', 'href' => 'settings.php', 'label' => 'Setelan',
     'icon' => 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z'],
    ['key' => 'backup', 'href' => 'backup.php', 'label' => 'Backup',
     'icon' => 'M4 7v10c0 2 1.5 3 4 3h8c2.5 0 4-1 4-3V7M4 7c0-2 1.5-3 4-3h8c2.5 0 4 1 4 3M4 7c0 2 1.5 3 4 3h8c2.5 0 4-1 4-3'],
];
$initial = strtoupper(substr($u['name'] ?? 'A', 0, 1));
?>
<!doctype html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title><?= h($page_title) ?> — <?= h($st['storeName'] ?? 'Toko') ?></title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>tailwind.config = { theme: { extend: { colors: { brand: '<?= h(BRAND_COLOR) ?>' }, fontFamily: { sans: ['Plus Jakarta Sans','ui-sans-serif','system-ui'] } } } };</script>
    <?php if ($with_chart): ?><script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script><?php endif; ?>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>body{font-family:'Plus Jakarta Sans',ui-sans-serif,system-ui,sans-serif}::-webkit-scrollbar{width:8px;height:8px}::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:8px}</style>
    <?= $head_extra ?? '' ?>
</head>
<body class="bg-slate-100 text-slate-800 antialiased">
<div class="flex min-h-screen">
    <!-- Sidebar -->
    <aside id="sidebar" class="fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col -translate-x-full lg:translate-x-0 transition-transform">
        <div class="h-16 flex items-center gap-2.5 px-5 border-b border-slate-100">
            <?php if (!empty($st['logoImageUrl'])): ?>
                <img src="<?= h(img_url($st['logoImageUrl'])) ?>" alt="" class="h-9 w-9 rounded-xl object-cover">
            <?php else: ?>
                <span class="h-9 w-9 rounded-xl bg-brand text-white grid place-items-center font-extrabold">T</span>
            <?php endif; ?>
            <span class="font-extrabold text-slate-900 truncate"><?= h($st['storeName'] ?? 'Toko') ?></span>
        </div>
        <nav class="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            <?php foreach ($nav as $item): $on = $active === $item['key']; ?>
                <a href="<?= h($item['href']) ?>"
                   class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition <?= $on ? 'bg-brand/10 text-brand' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800' ?>">
                    <svg class="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="<?= $item['icon'] ?>"/></svg>
                    <?= h($item['label']) ?>
                </a>
            <?php endforeach; ?>
        </nav>
        <div class="p-3 border-t border-slate-100">
            <div class="flex items-center gap-3 px-2 py-2">
                <span class="h-9 w-9 rounded-full bg-gradient-to-br from-brand to-fuchsia-500 text-white grid place-items-center font-bold text-sm"><?= h($initial) ?></span>
                <div class="min-w-0 flex-1">
                    <div class="text-sm font-semibold text-slate-800 truncate"><?= h($u['name'] ?? '') ?></div>
                    <div class="text-xs text-slate-400 truncate"><?= h($u['role'] ?? '') ?></div>
                </div>
                <a href="logout.php" title="Keluar" class="text-slate-400 hover:text-rose-500 p-1.5">
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
                </a>
            </div>
        </div>
    </aside>
    <div id="overlay" onclick="toggleSidebar()" class="fixed inset-0 z-40 bg-black/30 hidden lg:hidden"></div>

    <!-- Konten -->
    <div class="flex-1 flex flex-col min-w-0">
        <header class="sticky top-0 z-30 h-16 bg-white/80 backdrop-blur border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 gap-4">
            <div class="flex items-center gap-3 min-w-0">
                <button onclick="toggleSidebar()" class="lg:hidden p-2 -ml-2 text-slate-500">
                    <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"/></svg>
                </button>
                <div class="min-w-0">
                    <h1 class="font-extrabold text-slate-900 leading-tight truncate"><?= h($page_title) ?></h1>
                    <p class="text-xs text-slate-400"><?= h(date('l, d M Y')) ?></p>
                </div>
            </div>
            <a href="index.php" target="_blank" class="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                Lihat Toko
            </a>
        </header>
        <main class="flex-1 p-4 sm:p-6">
