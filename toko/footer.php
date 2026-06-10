</main>
<?php
$ft = settings();
$ftName  = $ft['storeName'] ?? 'Toko';
$ftPhone = $ft['storePhone'] ?? '';
$ftAddr  = $ft['storeAddress'] ?? ($ft['address'] ?? '');
$ftWa    = preg_replace('/^0/', '62', preg_replace('/\D/', '', $ftPhone));
?>
<footer class="mt-10 bg-slate-900 text-slate-300">
    <div class="max-w-6xl mx-auto px-4 py-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
        <div class="lg:col-span-2">
            <div class="flex items-center gap-2.5 mb-3">
                <?php if (!empty($ft['logoImageUrl'])): ?>
                    <img src="<?= h(img_url($ft['logoImageUrl'])) ?>" alt="" class="h-10 w-10 rounded-xl object-cover">
                <?php else: ?>
                    <span class="h-10 w-10 rounded-xl bg-brand text-white grid place-items-center font-extrabold"><?= h(strtoupper(mb_substr($ftName, 0, 1))) ?></span>
                <?php endif; ?>
                <span class="font-extrabold text-white text-lg"><?= h($ftName) ?></span>
            </div>
            <p class="text-sm text-slate-400 leading-relaxed max-w-sm">Layanan cetak & sablon berkualitas — label, buku, kalender, souvenir, dan merchandise. Tanpa minimal order, respon cepat, desain dibantu gratis.</p>
        </div>
        <div>
            <h3 class="text-white font-bold text-sm uppercase tracking-wide mb-3">Jelajahi</h3>
            <ul class="space-y-2 text-sm">
                <li><a href="produk.php" class="text-slate-400 hover:text-white transition">Semua Produk</a></li>
                <li><a href="portofolio.php" class="text-slate-400 hover:text-white transition">Portofolio</a></li>
                <li><a href="profil.php" class="text-slate-400 hover:text-white transition">Tentang Kami</a></li>
                <li><a href="artikel.php" class="text-slate-400 hover:text-white transition">Artikel</a></li>
                <li><a href="cart.php" class="text-slate-400 hover:text-white transition">Keranjang</a></li>
            </ul>
        </div>
        <div>
            <h3 class="text-white font-bold text-sm uppercase tracking-wide mb-3">Hubungi Kami</h3>
            <ul class="space-y-2.5 text-sm">
                <?php if ($ftAddr): ?>
                    <li class="flex items-start gap-2.5 text-slate-400">
                        <svg class="w-4 h-4 mt-0.5 shrink-0 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><circle cx="12" cy="11" r="3"/></svg>
                        <span class="whitespace-pre-line"><?= h($ftAddr) ?></span>
                    </li>
                <?php endif; ?>
                <?php if ($ftPhone): ?>
                    <li class="flex items-center gap-2.5">
                        <svg class="w-4 h-4 shrink-0 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11 11 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                        <a href="tel:<?= h($ftPhone) ?>" class="text-slate-400 hover:text-white transition"><?= h($ftPhone) ?></a>
                    </li>
                <?php endif; ?>
                <?php if ($ftWa): ?>
                    <li><a href="https://wa.me/<?= h($ftWa) ?>" target="_blank" rel="noopener" class="inline-flex items-center gap-2 mt-1 px-4 py-2 rounded-xl bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 transition">Chat WhatsApp</a></li>
                <?php endif; ?>
            </ul>
        </div>
    </div>
    <div class="border-t border-white/10">
        <div class="max-w-6xl mx-auto px-4 py-4 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>&copy; <?= date('Y') ?> <?= h($ftName) ?>. Semua hak dilindungi.</span>
            <a href="<?= is_admin() ? 'dashboard.php' : 'login.php' ?>" class="hover:text-slate-300 transition">Admin</a>
        </div>
    </div>
</footer>
</body>
</html>
