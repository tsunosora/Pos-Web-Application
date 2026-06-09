<?php require_once __DIR__ . '/lib.php'; $st = settings(); ?>
<!doctype html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title><?= h($st['storeName'] ?? 'Toko') ?></title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
<header class="nav">
    <a class="brand" href="index.php">
        <?php if (!empty($st['logoImageUrl'])): ?><img src="<?= h(img_url($st['logoImageUrl'])) ?>" alt=""><?php endif; ?>
        <span><?= h($st['storeName'] ?? 'Toko') ?></span>
    </a>
    <nav class="menu">
        <a href="index.php">Beranda</a>
        <a href="cart.php" class="cart-link">🛒 Keranjang<?php if (cart_count() > 0): ?> <b><?= cart_count() ?></b><?php endif; ?></a>
    </nav>
</header>
<main class="container">
