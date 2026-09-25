</main>
<?php
$ft = settings();
$ftName  = $ft['storeName'] ?? 'Toko';
// Nomor toko: utamakan blok Kontak (editable dari Dashboard → Konten), fallback storePhone PosPro.
$ftPhone = store_phone();
$ftAddr  = $ft['storeAddress'] ?? ($ft['address'] ?? '');
$ftWa    = store_wa();
// Cabang dari blok Kontak (Dashboard → Konten); fallback alamat profil PosPro.
require_once __DIR__ . '/content_store.php';
$ftLocs = array_values(array_filter((array)(site_content('kontak')['locations'] ?? []),
    fn($l) => trim($l['name'] ?? '') !== '' && trim($l['address'] ?? '') !== ''));
/** Link "Petunjuk arah" Google Maps: koordinat dari URL embed bila ada, else cari nama+alamat. */
$ftMapsLink = function (array $l): string {
    if (preg_match('/!2d(-?[\d.]+)!3d(-?[\d.]+)/', (string)($l['mapsEmbed'] ?? ''), $m)) {
        return 'https://www.google.com/maps/dir/?api=1&destination=' . $m[2] . ',' . $m[1];
    }
    return 'https://www.google.com/maps/search/?api=1&query=' . rawurlencode(($l['name'] ?? '') . ', ' . ($l['address'] ?? ''));
};
?>
<footer class="mt-12 text-slate-300" style="background:#0E0E10">
    <div class="max-w-[96rem] mx-auto px-4 py-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-9">
        <div>
            <div class="flex items-center gap-2.5 mb-3.5">
                <?php if (!empty($ft['logoImageUrl'])): ?>
                    <img src="<?= h(img_url($ft['logoImageUrl'])) ?>" alt="" class="h-10 w-10 rounded-xl object-cover">
                <?php else: ?>
                    <span class="h-10 w-10 rounded-xl bg-brand text-white grid place-items-center font-extrabold"><?= h(strtoupper(mb_substr($ftName, 0, 1))) ?></span>
                <?php endif; ?>
                <span class="font-head font-extrabold text-white text-lg"><?= h($ftName) ?></span>
            </div>
            <p class="text-sm text-slate-400 leading-relaxed">Digital printing Jogja di Bantul — cetak banner, stiker, sablon DTF, cutting laser, souvenir &amp; merchandise. Tanpa minimal order, respon cepat, desain dibantu gratis.</p>
            <?php if (!$ftLocs && $ftAddr): ?>
                <p class="mt-4 text-sm text-slate-500 whitespace-pre-line flex items-start gap-2">
                    <svg class="w-4 h-4 mt-0.5 shrink-0 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><circle cx="12" cy="11" r="3"/></svg>
                    <span><?= h($ftAddr) ?></span>
                </p>
            <?php endif; ?>
        </div>
        <div>
            <h3 class="text-white font-head font-bold text-sm uppercase tracking-widest mb-4">Jelajahi</h3>
            <ul class="space-y-2.5 text-sm">
                <li><a href="produk.php" class="text-slate-400 hover:text-white transition">Semua Produk</a></li>
                <li><a href="portofolio.php" class="text-slate-400 hover:text-white transition">Portofolio</a></li>
                <li><a href="profil.php" class="text-slate-400 hover:text-white transition">Tentang Kami</a></li>
                <li><a href="artikel.php" class="text-slate-400 hover:text-white transition">Artikel</a></li>
                <li><a href="cart.php" class="text-slate-400 hover:text-white transition">Keranjang</a></li>
            </ul>
        </div>
        <div>
            <h3 class="text-white font-head font-bold text-sm uppercase tracking-widest mb-4">Layanan</h3>
            <ul class="space-y-2.5 text-sm text-slate-400">
                <li><a href="/cetak-banner-event-jogja" class="hover:text-white transition">Cetak Banner Event Jogja</a></li>
                <li><a href="product.php?id=6" class="hover:text-white transition">Cetak Banner &amp; Spanduk</a></li>
                <li><a href="product.php?id=190" class="hover:text-white transition">Cetak Stiker &amp; Label</a></li>
                <li><a href="product.php?id=71" class="hover:text-white transition">Sablon DTF Jogja</a></li>
                <li><a href="product.php?id=87" class="hover:text-white transition">Cutting Laser &amp; Akrilik</a></li>
                <li><a href="produk.php" class="hover:text-white transition">Merchandise &amp; Souvenir</a></li>
            </ul>
        </div>
        <div>
            <h3 class="text-white font-head font-bold text-sm uppercase tracking-widest mb-4">Hubungi Kami</h3>
            <ul class="space-y-2.5 text-sm">
                <?php if (!$ftLocs): ?>
                <li class="flex items-start gap-2.5 text-slate-400">
                    <svg class="w-4 h-4 mt-0.5 shrink-0 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path stroke-linecap="round" stroke-linejoin="round" d="M12 7v5l3 2"/></svg>
                    <span>Senin–Sabtu, 08.00–21.00<br><span class="text-slate-500">Minggu tutup</span></span>
                </li>
                <?php endif; ?>
                <?php if ($ftPhone): ?>
                    <li class="flex items-center gap-2.5">
                        <svg class="w-4 h-4 shrink-0 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11 11 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                        <a href="tel:<?= h($ftPhone) ?>" class="text-slate-400 hover:text-white transition"><?= h($ftPhone) ?></a>
                    </li>
                <?php endif; ?>
                <?php if ($ftWa): ?>
                    <li><a href="https://wa.me/<?= h($ftWa) ?>" target="_blank" rel="noopener" class="btn-pill btn-pill--accent !py-2 !px-4 text-sm mt-1.5">Chat WhatsApp</a></li>
                <?php endif; ?>
            </ul>
        </div>
    </div>
    <?php if ($ftLocs): ?>
    <div class="border-t border-white/10">
        <div class="max-w-[96rem] mx-auto px-4 py-9">
            <h3 class="text-white font-head font-bold text-sm uppercase tracking-widest mb-5">Lokasi Kami</h3>
            <div class="grid md:grid-cols-2 gap-6">
                <?php foreach ($ftLocs as $l): ?>
                    <div class="flex items-start gap-3 rounded-2xl border border-white/10 p-5">
                        <svg class="w-5 h-5 mt-0.5 shrink-0 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><circle cx="12" cy="11" r="3"/></svg>
                        <div class="min-w-0 text-sm">
                            <p class="font-semibold text-white"><?= h($l['name']) ?></p>
                            <p class="mt-1 text-slate-400 leading-relaxed"><?= h($l['address']) ?></p>
                            <?php if (!empty($l['hours'])): ?><p class="mt-2 text-slate-500"><?= h($l['hours']) ?> · Minggu tutup</p><?php endif; ?>
                            <p class="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5">
                                <?php if (!empty($l['phone'])): ?><a href="tel:<?= h(preg_replace('/[^\d+]/', '', $l['phone'])) ?>" class="text-slate-300 hover:text-white transition"><?= h($l['phone']) ?></a><?php endif; ?>
                                <a href="<?= h($ftMapsLink($l)) ?>" target="_blank" rel="noopener" class="text-brand hover:underline underline-offset-4">Petunjuk arah →</a>
                            </p>
                        </div>
                    </div>
                <?php endforeach; ?>
            </div>
        </div>
    </div>
    <?php endif; ?>
    <div class="border-t border-white/10">
        <div class="max-w-[96rem] mx-auto px-4 py-4 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>&copy; <?= date('Y') ?> <?= h($ftName) ?>. Semua hak dilindungi.</span>
            <a href="<?= is_admin() ? 'dashboard.php' : 'login.php' ?>" class="hover:text-slate-300 transition">Admin</a>
        </div>
    </div>
</footer>
</body>
</html>
