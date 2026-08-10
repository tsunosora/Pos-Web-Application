<?php require_once __DIR__ . '/lib.php'; $st = settings(); $cc = cart_count(); $qval = trim($_GET['q'] ?? '');
$hdrWa = store_wa(); ?>
<!doctype html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <?php
    $storeName     = $st['storeName'] ?? 'Toko';
    $logoAbs       = !empty($st['logoImageUrl']) ? img_url($st['logoImageUrl']) : '';
    $seo_title     = $seo_title     ?? $storeName;
    $seo_desc      = $seo_desc      ?? meta_desc('Belanja produk & layanan cetak berkualitas di ' . $storeName . '. Pesan online, respon cepat, hasil rapi.');
    $seo_image     = $seo_image     ?? $logoAbs;
    $seo_canonical = $seo_canonical ?? current_url();
    $seo_type      = $seo_type      ?? 'website';
    $seo_robots    = $seo_robots    ?? 'index,follow';
    if (!isset($seo_jsonld)) {
        $orgLd = ['@context' => 'https://schema.org', '@type' => 'Store', 'name' => $storeName, 'url' => base_url()];
        if ($logoAbs) $orgLd['logo'] = $logoAbs;
        if (($phEff = store_phone()) !== '') $orgLd['telephone'] = $phEff;
        $seo_jsonld = json_encode($orgLd, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    }
    ?>
    <title><?= h($seo_title) ?></title>
    <meta name="description" content="<?= h($seo_desc) ?>">
    <meta name="robots" content="<?= h($seo_robots) ?>">
    <link rel="canonical" href="<?= h($seo_canonical) ?>">
    <meta name="theme-color" content="<?= h(brand_color()) ?>">
    <?php if ($logoAbs): ?><link rel="icon" href="<?= h($logoAbs) ?>"><?php endif; ?>
    <meta property="og:type" content="<?= h($seo_type) ?>">
    <meta property="og:title" content="<?= h($seo_title) ?>">
    <meta property="og:description" content="<?= h($seo_desc) ?>">
    <meta property="og:url" content="<?= h($seo_canonical) ?>">
    <meta property="og:site_name" content="<?= h($storeName) ?>">
    <?php if ($seo_image): ?><meta property="og:image" content="<?= h($seo_image) ?>"><?php endif; ?>
    <meta name="twitter:card" content="<?= $seo_image ? 'summary_large_image' : 'summary' ?>">
    <meta name="twitter:title" content="<?= h($seo_title) ?>">
    <meta name="twitter:description" content="<?= h($seo_desc) ?>">
    <?php if ($seo_image): ?><meta name="twitter:image" content="<?= h($seo_image) ?>"><?php endif; ?>
    <?php if ($seo_jsonld): ?><script type="application/ld+json"><?= $seo_jsonld ?></script><?php endif; ?>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>tailwind.config = { theme: { extend: { colors: { brand: '<?= h(brand_color()) ?>' } } } };</script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Rubik:ital,wght@0,400;0,500;0,600;0,700;0,800;1,500;1,600&family=Nunito+Sans:ital,wght@0,400;0,600;0,700;0,800;1,600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css">
    <link rel="stylesheet" href="assets/voliko.css?v=<?= @filemtime(__DIR__ . '/assets/voliko.css') ?: '1' ?>">
    <style>
    :root { --accent: <?= h(brand_color()) ?>; }
    .prose-toko a{color:<?= h(brand_color()) ?>;text-decoration:underline}.prose-toko h2,.prose-toko h3{font-weight:700;color:#0f172a;margin:.5rem 0}.prose-toko p{margin:.5rem 0}.prose-toko ul{list-style:disc;padding-left:1.25rem}
    /* Animasi kartu produk & CTA (dipertahankan dari tema lama) */
    @keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
    .card-in{animation:fadeUp .55s cubic-bezier(.22,1,.36,1) both}
    @keyframes shineMove{to{transform:translateX(320%) skewX(-15deg)}}
    .pcard:hover .shine{animation:shineMove .85s ease}
    .shine{position:absolute;top:0;left:-80%;width:60%;height:100%;background:linear-gradient(110deg,transparent,rgba(255,255,255,.6),transparent);transform:translateX(0) skewX(-15deg);pointer-events:none;z-index:5}
    @keyframes ctaGrad{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
    .cta-btn{background-size:220% 220%;animation:ctaGrad 4s ease infinite}
    @keyframes wiggle{0%,100%{transform:rotate(0)}25%{transform:rotate(-8deg)}75%{transform:rotate(8deg)}}
    .cta-btn:hover .wig{animation:wiggle .5s ease}
    @media (prefers-reduced-motion:reduce){.card-in,.cta-btn,.pcard:hover .shine{animation:none}}
    </style>
    <script src="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js" defer></script>
    <script src="assets/voliko.js?v=<?= @filemtime(__DIR__ . '/assets/voliko.js') ?: '1' ?>" defer></script>
</head>
<body class="antialiased min-h-screen flex flex-col">
<!-- Background blobs pastel (tema PrintKreatif) -->
<div class="pk-blob pk-blob-1"></div>
<div class="pk-blob pk-blob-2"></div>
<div class="pk-blob pk-blob-3"></div>
<header class="nav-glass sticky top-0 z-40">
    <div class="nav-inner max-w-[96rem] mx-auto px-4 flex items-center gap-3 sm:gap-5">
        <a href="index.php" class="flex items-center gap-2 font-extrabold text-lg text-slate-900 shrink-0 font-head">
            <?php if (!empty($st['logoImageUrl'])): ?>
                <img src="<?= h(img_url($st['logoImageUrl'])) ?>" alt="" class="h-9 w-9 rounded-xl object-cover">
            <?php else: ?>
                <span class="h-9 w-9 rounded-xl bg-brand text-white grid place-items-center"><?= h(strtoupper(mb_substr($storeName, 0, 1))) ?></span>
            <?php endif; ?>
            <span class="hidden sm:inline"><?= h($storeName) ?></span>
        </a>

        <!-- Search bar -->
        <form method="get" action="produk.php" class="flex-1 max-w-xl hidden sm:block">
            <div class="relative">
                <input type="text" name="q" value="<?= h($qval) ?>" placeholder="Cari produk..."
                       class="w-full pl-4 pr-11 py-2 rounded-full border border-slate-200/80 bg-white/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand text-sm">
                <button type="submit" class="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 grid place-items-center rounded-full bg-brand text-white hover:opacity-90" aria-label="Cari">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M11 17a6 6 0 100-12 6 6 0 000 12z"/></svg>
                </button>
            </div>
        </form>

        <nav class="flex items-center gap-1 sm:gap-1.5 shrink-0 ml-auto">
            <a href="produk.php" class="hidden lg:inline-block px-3 py-2 rounded-full text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-white/70 transition">Produk</a>
            <a href="portofolio.php" class="hidden lg:inline-block px-3 py-2 rounded-full text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-white/70 transition">Portofolio</a>
            <a href="profil.php" class="hidden lg:inline-block px-3 py-2 rounded-full text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-white/70 transition">Profil</a>
            <a href="artikel.php" class="hidden lg:inline-block px-3 py-2 rounded-full text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-white/70 transition">Artikel</a>
            <a href="cart.php" class="relative h-10 w-10 grid place-items-center rounded-full text-slate-700 hover:bg-white/70 transition" aria-label="Keranjang">
                <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293A1 1 0 005.414 17H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
                <?php if ($cc > 0): ?><span class="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-brand text-white text-[11px] font-bold grid place-items-center"><?= $cc ?></span><?php endif; ?>
            </a>
            <?php if ($hdrWa): ?>
                <a href="https://wa.me/<?= h($hdrWa) ?>" target="_blank" rel="noopener" class="btn-pill btn-pill--accent !py-2 !px-4 text-sm hidden sm:inline-flex">
                    Order via WA
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
                </a>
            <?php endif; ?>
            <button type="button" class="lg:hidden h-10 w-10 grid place-items-center rounded-full text-slate-700 hover:bg-white/70 transition" aria-label="Menu" onclick="document.getElementById('mnav').classList.toggle('hidden')">
                <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"/></svg>
            </button>
        </nav>
    </div>
    <!-- Menu mobile -->
    <div id="mnav" class="lg:hidden hidden border-t border-white/40 bg-white/85 backdrop-blur-xl">
        <nav class="max-w-[96rem] mx-auto px-4 py-3 grid grid-cols-2 gap-1">
            <a href="produk.php" class="px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:bg-white">Produk</a>
            <a href="portofolio.php" class="px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:bg-white">Portofolio</a>
            <a href="profil.php" class="px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:bg-white">Profil</a>
            <a href="artikel.php" class="px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:bg-white">Artikel</a>
            <form method="get" action="produk.php" class="col-span-2 pt-1">
                <input type="text" name="q" value="<?= h($qval) ?>" placeholder="Cari produk..."
                       class="w-full px-4 py-2.5 rounded-full border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand/40 text-sm">
            </form>
            <?php if ($hdrWa): ?>
                <a href="https://wa.me/<?= h($hdrWa) ?>" target="_blank" rel="noopener" class="col-span-2 btn-pill btn-pill--accent justify-center text-sm mt-1">Order via WA</a>
            <?php endif; ?>
        </nav>
    </div>
</header>
<main class="flex-1 max-w-[96rem] w-full mx-auto px-4 py-6">
