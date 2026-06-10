<?php
require_once __DIR__ . '/lib.php';

// ── Layout beranda toko (tersimpan JSON di settings 'home_layout') ───────────
function default_home_layout(): array {
    return [
        ['type' => 'slider', 'enabled' => true, 'slides' => [
            ['image' => '', 'title' => 'Setiap Cetakan, Bikin Senang!', 'subtitle' => 'Label produk, buku, kalender, sampai souvenir & merchandise — hasil rapi, harga bersahabat.', 'btnText' => 'Mulai Pesan', 'btnLink' => '#produk'],
            ['image' => '', 'title' => 'Tanpa Minimal Order', 'subtitle' => 'Cetak satuan? Bisa! Cocok untuk kebutuhan kecil sampai partai besar.', 'btnText' => 'Lihat Produk', 'btnLink' => '#produk'],
            ['image' => '', 'title' => 'Respon Cepat, Bisa Buru-Buru', 'subtitle' => 'Butuh cepat? Tim kami siap bantu sampai deadline-mu aman.', 'btnText' => 'Chat Kami', 'btnLink' => '#kontak'],
        ]],
        ['type' => 'fitur', 'enabled' => true, 'title' => 'Apa yang Bisa Kami Cetak?', 'subtitle' => 'Satu tempat untuk semua kebutuhan cetakmu.', 'items' => "Label & Stiker Produk | Bikin kemasanmu makin profesional.\nCetak Buku | Satuan, tanpa minimal order.\nSouvenir & Merchandise | Kipas, medali akrilik, gantungan, dan lainnya.\nGelang Tiket & Event | Untuk konser, wahana, dan acara spesial.\nKalender & Hang Tag | Custom sesuai tema dan momenmu.\nDesain Kreatif | Tim desainer bantu wujudkan ide dari nol."],
        ['type' => 'kategori', 'enabled' => true, 'title' => 'Jelajahi Kategori'],
        ['type' => 'produk', 'enabled' => true, 'title' => 'Produk Unggulan', 'source' => 'all', 'categoryId' => '', 'limit' => 8, 'search' => false],
        ['type' => 'fitur', 'enabled' => true, 'title' => 'Kenapa Pilih Kami?', 'subtitle' => 'Pelayanan yang bikin kamu balik lagi.', 'items' => "Respon Cepat | Pertanyaan & order dibalas kilat, tanpa nunggu lama.\nTanpa Minimal Order | Banyak produk bisa cetak satuan.\nDesain Gratis | Tim kreatif bantu wujudkan idemu jadi visual.\nAntar & Kirim | Layanan pengiriman dengan dukungan logistik.\nKualitas Terjaga | Mesin dirawat rutin demi hasil tajam & konsisten.\nFleksibel Waktu | Jam kerja panjang demi kejar tenggatmu."],
        ['type' => 'statistik', 'enabled' => true, 'items' => "2018 | Tahun Berdiri\n1000+ | Pesanan Selesai\n500+ | Pelanggan Senang\n4.9/5 | Rating Pelanggan"],
        ['type' => 'tentang', 'enabled' => true, 'title' => 'Bukan Sekadar Cetak — Kami Antar Kebahagiaan', 'text' => 'Kami percaya setiap hasil cetak bisa bikin pelanggan senang. Dari label, buku, kalender, sampai souvenir & merchandise, semua dikerjakan efisien dengan kualitas terbaik — supaya kamu nyaman dan balik lagi.', 'image' => '', 'list' => "Melayani satuan & partai besar\nKonsultasi & desain gratis\nAntar dan kirim ke seluruh Indonesia"],
        ['type' => 'testimoni', 'enabled' => true, 'title' => 'Kata Pelanggan', 'items' => "Cetakannya rapi banget, prosesnya cepat! | Andi | Pemilik Brand Lokal\nDibantu desain dari nol, ramah dan sabar. | Sari | Pelaku UMKM\nLangganan label & souvenir, selalu memuaskan. | Budi | Panitia Event"],
        ['type' => 'artikel', 'enabled' => true, 'title' => 'Tips & Inspirasi', 'limit' => 3],
        ['type' => 'faq', 'enabled' => true, 'title' => 'Pertanyaan Umum', 'items' => "Bagaimana cara pesan? | Pilih produk lalu checkout, atau langsung chat kami via WhatsApp/Instagram.\nApakah ada minimal order? | Banyak produk bisa satuan, tanpa minimal order.\nBisa kirim luar kota? | Bisa, kami antar & kirim dengan dukungan logistik.\nButuh cepat, bisa? | Bisa! Bilang ke kami, akan kami usahakan sesuai tenggatmu."],
        ['type' => 'kontak', 'enabled' => true, 'title' => 'Hubungi Kami', 'address' => "Imogiri, Bantul,\nDaerah Istimewa Yogyakarta", 'phone' => '0812-3456-7890', 'whatsapp' => '081234567890', 'email' => 'halo@tokokamu.com', 'mapsEmbed' => ''],
        ['type' => 'cta', 'enabled' => true, 'title' => 'Yuk, Wujudkan Cetakanmu!', 'subtitle' => 'Konsultasi gratis, respon cepat. Klik dan ceritakan kebutuhanmu — kami bantu sampai jadi.', 'btnText' => 'Mulai Sekarang', 'btnLink' => '#produk'],
        ['type' => 'popup', 'enabled' => true, 'image' => '', 'title' => 'Tanpa Minimal Order!', 'text' => 'Cetak satuan pun bisa. Yuk pesan sekarang, gratis konsultasi.', 'btnText' => 'Lihat Produk', 'btnLink' => '#produk', 'link' => '', 'once' => true],
    ];
}

// Layout default halaman Profil (company profile)
function default_profil_layout(): array {
    return [
        ['type' => 'slider', 'enabled' => true, 'slides' => [
            ['image' => '', 'title' => 'Percetakan yang Mengantar Kebahagiaan', 'subtitle' => 'Sejak 2018 kami membantu pelaku usaha & individu mewujudkan ide jadi cetakan berkualitas.', 'btnText' => 'Hubungi Kami', 'btnLink' => '#kontak'],
        ]],
        ['type' => 'tentang', 'enabled' => true, 'title' => 'Siapa Kami', 'text' => 'Kami percetakan yang fokus pada hasil rapi, harga bersahabat, dan pelayanan ramah. Dari label produk, buku, kalender, sampai souvenir & merchandise — semua dikerjakan teliti dengan bahan terbaik. Filosofi kami sederhana: setiap cetakan harus bikin pelanggan senang.', 'image' => '', 'list' => "Melayani satuan hingga partai besar\nKonsultasi & desain gratis\nAntar dan kirim ke seluruh Indonesia"],
        ['type' => 'fitur', 'enabled' => true, 'title' => 'Nilai yang Kami Pegang', 'subtitle' => '', 'items' => "Kualitas | Mesin dirawat rutin demi hasil tajam & konsisten.\nKecepatan | Respon cepat, bisa kejar tenggat waktumu.\nKreativitas | Tim desainer bantu wujudkan ide dari nol.\nKepercayaan | Transparan, tanpa biaya tersembunyi."],
        ['type' => 'statistik', 'enabled' => true, 'items' => "2018 | Tahun Berdiri\n1000+ | Pesanan Selesai\n500+ | Pelanggan Senang\n4.9/5 | Rating Pelanggan"],
        ['type' => 'fitur', 'enabled' => true, 'title' => 'Apa yang Kami Kerjakan', 'subtitle' => 'Layanan cetak lengkap dalam satu tempat.', 'items' => "Label & Stiker | Untuk kemasan produkmu.\nCetak Buku | Satuan, tanpa minimal order.\nSouvenir & Merchandise | Kipas, medali akrilik, gantungan, dll.\nGelang Tiket & Event | Konser, wahana, acara spesial.\nKalender & Hang Tag | Custom sesuai tema.\nDesain Kreatif | Visualisasi ide dari nol."],
        ['type' => 'testimoni', 'enabled' => true, 'title' => 'Apa Kata Mereka', 'items' => "Cetakannya rapi banget, prosesnya cepat! | Andi | Pemilik Brand Lokal\nDibantu desain dari nol, ramah dan sabar. | Sari | Pelaku UMKM\nLangganan label & souvenir, selalu memuaskan. | Budi | Panitia Event"],
        ['type' => 'kontak', 'enabled' => true, 'title' => 'Hubungi Kami', 'address' => "Imogiri, Bantul,\nDaerah Istimewa Yogyakarta", 'phone' => '0812-3456-7890', 'whatsapp' => '081234567890', 'email' => 'halo@tokokamu.com', 'mapsEmbed' => ''],
        ['type' => 'cta', 'enabled' => true, 'title' => 'Punya Proyek Cetak?', 'subtitle' => 'Ceritakan kebutuhanmu, kami bantu sampai jadi.', 'btnText' => 'Konsultasi Gratis', 'btnLink' => '#kontak'],
    ];
}
// Layout default halaman Portofolio (galeri karya)
function default_portofolio_layout(): array {
    return [
        ['type' => 'slider', 'enabled' => true, 'slides' => [
            ['image' => '', 'title' => 'Portofolio Karya Kami', 'subtitle' => 'Bukti kualitas, bukan sekadar janji. Lihat hasil cetakan yang sudah kami kerjakan untuk pelanggan.', 'btnText' => 'Pesan Sekarang', 'btnLink' => 'produk.php'],
        ]],
        ['type' => 'portofolio', 'enabled' => true, 'title' => 'Galeri Hasil Karya', 'subtitle' => 'Beberapa proyek terbaik yang pernah kami kerjakan.', 'items' => []],
        ['type' => 'statistik', 'enabled' => true, 'items' => "2018 | Tahun Berdiri\n1000+ | Pesanan Selesai\n500+ | Pelanggan Senang\n4.9/5 | Rating Pelanggan"],
        ['type' => 'testimoni', 'enabled' => true, 'title' => 'Kata Pelanggan Kami', 'items' => "Cetakannya rapi banget, prosesnya cepat! | Andi | Pemilik Brand Lokal\nDibantu desain dari nol, ramah dan sabar. | Sari | Pelaku UMKM\nLangganan label & souvenir, selalu memuaskan. | Budi | Panitia Event"],
        ['type' => 'cta', 'enabled' => true, 'title' => 'Suka dengan Hasil Kami?', 'subtitle' => 'Yuk wujudkan proyek cetakmu berikutnya. Konsultasi gratis, respon cepat.', 'btnText' => 'Mulai Pesan', 'btnLink' => 'produk.php'],
    ];
}
/** Layout per halaman (page = 'home' | 'profil' | 'portofolio'). */
function layout_key(string $page): string {
    return ['profil' => 'profil_layout', 'portofolio' => 'portofolio_layout'][$page] ?? 'home_layout';
}
function page_layout(string $page): array {
    try { $raw = cfg(layout_key($page)); } catch (Throwable $e) { $raw = null; }
    $arr = $raw ? json_decode($raw, true) : null;
    if (is_array($arr) && $arr) return $arr;
    return default_layout_for($page);
}
function save_page_layout(string $page, array $blocks): void {
    cfg_set(layout_key($page), json_encode(array_values($blocks), JSON_UNESCAPED_UNICODE));
}
function default_layout_for(string $page): array {
    if ($page === 'profil') return default_profil_layout();
    if ($page === 'portofolio') return default_portofolio_layout();
    return default_home_layout();
}
// Kompatibilitas
function home_layout(): array { return page_layout('home'); }
function save_home_layout(array $blocks): void { save_page_layout('home', $blocks); }

// Daftar tipe blok + label (untuk palet & editor)
function home_block_types(): array {
    return [
        'hero'      => 'Hero / Sampul',
        'slider'    => 'Hero / Slider',
        'produk'    => 'Produk',
        'kategori'  => 'Kategori',
        'portofolio'=> 'Portofolio / Galeri',
        'tentang'   => 'Tentang Kami',
        'fitur'     => 'Layanan / Keunggulan',
        'statistik' => 'Statistik / Angka',
        'testimoni' => 'Testimoni',
        'faq'       => 'FAQ',
        'artikel'   => 'Artikel',
        'banner'    => 'Banner / Promo',
        'teks'      => 'Teks / Info',
        'kontak'    => 'Kontak',
        'cta'       => 'Ajakan (CTA)',
        'popup'     => 'Popup Promo',
    ];
}

/** Tipe blok yang muncul di palet "Tambah Blok". Hero lama digabung ke 'slider'
 *  (Hero / Slider) — pakai 1 slide untuk hero statis, 2+ slide jadi carousel. */
function addable_block_types(): array {
    $t = home_block_types();
    unset($t['hero']);
    return $t;
}

// Parse teks multi-baris "A | B [| C]" → array of [parts]
function parse_items(string $text): array {
    $out = [];
    foreach (preg_split('/\r?\n/', trim($text)) as $line) {
        $line = trim($line);
        if ($line === '') continue;
        $out[] = array_map('trim', explode('|', $line));
    }
    return $out;
}

// Kartu produk beranimasi (dipakai di beranda & halaman katalog)
function product_card_html(array $p, int $i = 0, string $shop = '', bool $badge = false): string {
    $im = product_image($p);
    ob_start(); ?>
    <a href="product.php?id=<?= h($p['id']) ?>" class="pcard card-in group relative bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-xl hover:shadow-brand/10 hover:border-brand/50 hover:-translate-y-1 transition-all duration-300 flex flex-col" style="animation-delay:<?= ($i % 8) * 60 ?>ms">
        <div class="relative aspect-square bg-slate-100 overflow-hidden">
            <?php if ($im): ?><img src="<?= h($im) ?>" alt="<?= h($p['name']) ?>" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"><?php else: ?><div class="w-full h-full grid place-items-center text-slate-300"><svg class="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.4"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M4 6h16v12H4z"/></svg></div><?php endif; ?>
            <span class="shine"></span>
            <?php if ($badge): ?><span class="absolute top-2 left-2 text-[10px] font-bold text-white bg-rose-500 px-2 py-0.5 rounded-full shadow-sm">TERLARIS</span><?php endif; ?>
            <span class="absolute bottom-2 right-2 h-9 w-9 rounded-full bg-brand text-white grid place-items-center shadow-lg opacity-0 translate-y-3 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300"><svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg></span>
        </div>
        <div class="p-2.5 sm:p-3 flex flex-col flex-1">
            <?php if (!empty($p['category']['name'])): ?><span class="text-[10px] font-semibold text-brand/80 uppercase tracking-wide mb-0.5 truncate"><?= h($p['category']['name']) ?></span><?php endif; ?>
            <div class="text-sm font-medium text-slate-700 line-clamp-2 leading-snug min-h-[2.5em] group-hover:text-brand transition-colors"><?= h($p['name']) ?></div>
            <?php $vc = count($p['variants'] ?? []); ?>
            <div class="mt-1.5 flex items-baseline gap-1">
                <?php if ($vc > 1): ?><span class="text-[10px] text-slate-400 font-medium">Mulai</span><?php endif; ?>
                <span class="font-extrabold text-slate-900 text-base"><?= rupiah(product_price($p)) ?></span>
            </div>
            <?php if ($vc > 1): ?><div class="text-[11px] text-slate-400"><?= $vc ?> pilihan varian</div><?php endif; ?>
            <?php if ($shop !== ''): ?>
                <div class="mt-auto pt-2 flex items-center gap-1 text-[11px] text-slate-400">
                    <svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><circle cx="12" cy="11" r="2.5"/></svg>
                    <span class="truncate"><?= h($shop) ?></span>
                </div>
            <?php endif; ?>
        </div>
    </a>
    <?php return ob_get_clean();
}

// ── Render satu blok ke HTML ─────────────────────────────────────────────────
function render_home_block(array $b, array $ctx): string {
    if (($b['enabled'] ?? true) === false) return '';
    $type = $b['type'] ?? '';
    $products = $ctx['products'] ?? [];
    $cats     = $ctx['cats'] ?? [];
    $st       = $ctx['st'] ?? [];
    ob_start();

    switch ($type) {
        case 'hero':
            $title = $b['title'] ?: ('Belanja di ' . ($st['storeName'] ?? 'Toko Kami'));
            $img   = $b['image'] ?? '';
            $hasImg = (bool)$img;
            $style = $hasImg ? "background-image:linear-gradient(rgba(15,23,42,.55),rgba(15,23,42,.55)),url('" . h($img) . "');background-size:cover;background-position:center" : '';
            $cls   = $hasImg ? 'text-white' : 'bg-gradient-to-br from-brand via-brand to-sky-600 text-white';
            ?>
            <section class="relative overflow-hidden rounded-3xl <?= $cls ?> p-8 sm:p-14 mb-10 shadow-xl shadow-brand/20" style="<?= $style ?>">
                <?php if (!$hasImg): ?>
                    <div class="absolute -top-20 -right-10 w-72 h-72 rounded-full bg-white/10 blur-2xl"></div>
                    <div class="absolute -bottom-24 -left-10 w-80 h-80 rounded-full bg-fuchsia-400/20 blur-3xl"></div>
                    <div class="absolute top-1/2 right-10 w-24 h-24 rounded-2xl bg-white/10 rotate-12 hidden sm:block"></div>
                <?php endif; ?>
                <div class="relative max-w-xl">
                    <?php if (!empty($b['badge'])): ?><span class="inline-flex items-center gap-1.5 text-xs font-semibold bg-white/20 backdrop-blur px-3 py-1.5 rounded-full mb-4"><span class="w-2 h-2 rounded-full bg-white animate-pulse"></span><?= h($b['badge']) ?></span><?php endif; ?>
                    <h1 class="text-3xl sm:text-5xl font-extrabold leading-[1.1] tracking-tight"><?= h($title) ?></h1>
                    <?php if (!empty($b['subtitle'])): ?><p class="mt-4 text-white/90 text-base sm:text-lg max-w-lg"><?= h($b['subtitle']) ?></p><?php endif; ?>
                    <?php if (!empty($b['btnText'])): ?>
                        <a href="<?= h($b['btnLink'] ?: '#produk') ?>" class="inline-flex items-center gap-2 mt-6 px-6 py-3.5 rounded-xl bg-white text-slate-900 font-bold hover:scale-[1.03] active:scale-95 transition shadow-lg"><?= h($b['btnText']) ?><svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg></a>
                    <?php endif; ?>
                </div>
            </section>
            <?php break;

        case 'slider':
            $slides = array_values(array_filter($b['slides'] ?? [], fn($s) => !empty($s['image']) || !empty($s['title'])));
            if (!$slides) break;
            $sid = 'sld' . substr(md5(json_encode($slides)), 0, 6);
            ?>
            <section class="mb-10">
                <div id="<?= $sid ?>" class="relative overflow-hidden rounded-3xl shadow-xl">
                    <?php foreach ($slides as $i => $s):
                        $img = $s['image'] ?? '';
                        $sty = $img ? "background-image:linear-gradient(rgba(15,23,42,.5),rgba(15,23,42,.5)),url('" . h($img) . "');background-size:cover;background-position:center" : '';
                        $scl = $img ? 'text-white' : ($i % 2 ? 'bg-gradient-to-br from-fuchsia-500 to-brand text-white' : 'bg-gradient-to-br from-brand to-sky-600 text-white'); ?>
                        <div class="slide <?= $scl ?> <?= $i === 0 ? '' : 'hidden' ?> p-8 sm:p-14 min-h-[260px] sm:min-h-[360px] flex flex-col justify-center" style="<?= $sty ?>">
                            <div class="max-w-xl">
                                <?php if (!empty($s['title'])): ?><h2 class="text-2xl sm:text-4xl font-extrabold leading-tight tracking-tight"><?= h($s['title']) ?></h2><?php endif; ?>
                                <?php if (!empty($s['subtitle'])): ?><p class="mt-3 text-white/90 sm:text-lg max-w-lg"><?= h($s['subtitle']) ?></p><?php endif; ?>
                                <?php if (!empty($s['btnText'])): ?><a href="<?= h($s['btnLink'] ?: '#produk') ?>" class="inline-block mt-5 px-6 py-3 rounded-xl bg-white text-slate-900 font-bold hover:scale-[1.03] transition shadow-lg"><?= h($s['btnText']) ?></a><?php endif; ?>
                            </div>
                        </div>
                    <?php endforeach; ?>
                    <?php if (count($slides) > 1): ?>
                        <button type="button" data-prev class="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 grid place-items-center rounded-full bg-white/85 hover:bg-white text-slate-800 shadow"><svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg></button>
                        <button type="button" data-next class="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 grid place-items-center rounded-full bg-white/85 hover:bg-white text-slate-800 shadow"><svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg></button>
                        <div class="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                            <?php foreach ($slides as $i => $s): ?><button type="button" data-dot="<?= $i ?>" class="h-2.5 rounded-full transition-all <?= $i === 0 ? 'w-6 bg-white' : 'w-2.5 bg-white/50' ?>"></button><?php endforeach; ?>
                        </div>
                    <?php endif; ?>
                </div>
            </section>
            <script>
            (function () {
                var root = document.getElementById('<?= $sid ?>');
                if (!root) return;
                var slides = root.querySelectorAll('.slide'), dots = root.querySelectorAll('[data-dot]'), n = slides.length, cur = 0, timer;
                function show(i) {
                    cur = (i + n) % n;
                    slides.forEach(function (s, k) { s.classList.toggle('hidden', k !== cur); });
                    dots.forEach(function (d, k) { d.className = 'h-2.5 rounded-full transition-all ' + (k === cur ? 'w-6 bg-white' : 'w-2.5 bg-white/50'); });
                }
                function reset() { clearInterval(timer); if (n > 1) timer = setInterval(function () { show(cur + 1); }, 5000); }
                var nx = root.querySelector('[data-next]'), pv = root.querySelector('[data-prev]');
                if (nx) nx.addEventListener('click', function () { show(cur + 1); reset(); });
                if (pv) pv.addEventListener('click', function () { show(cur - 1); reset(); });
                dots.forEach(function (d) { d.addEventListener('click', function () { show(+d.dataset.dot); reset(); }); });
                reset();
            })();
            </script>
            <?php break;

        case 'produk':
            $q = trim($_GET['q'] ?? ''); $cat = $_GET['cat'] ?? '';
            $useSearch = !empty($b['search']);
            $activeFilter = ($q !== '' || $cat !== '');
            $list = $products;
            if (($b['source'] ?? 'all') === 'category' && !empty($b['categoryId'])) {
                $list = array_filter($list, fn($p) => (string)($p['categoryId'] ?? ($p['category']['id'] ?? '')) === (string)$b['categoryId']);
            }
            if ($activeFilter) {
                $list = array_filter($list, function ($p) use ($q, $cat) {
                    $pid = (string)($p['categoryId'] ?? ($p['category']['id'] ?? ''));
                    if ($cat !== '' && $pid !== (string)$cat) return false;
                    if ($q !== '' && stripos($p['name'] ?? '', $q) === false) return false;
                    return true;
                });
            }
            $list = array_values($list);
            $limit = (int)($b['limit'] ?? 8);
            if ($limit > 0 && !$activeFilter) $list = array_slice($list, 0, $limit);
            $shop = $st['storeName'] ?? 'Toko';
            ?>
            <section id="produk" class="mb-10 scroll-mt-20">
                <div class="flex items-center justify-between mb-4 gap-3 flex-wrap">
                    <?php if ($activeFilter && $q !== ''): ?>
                        <h2 class="text-xl font-extrabold text-slate-900">Hasil pencarian "<?= h($q) ?>"</h2>
                    <?php elseif (!empty($b['title'])): ?>
                        <h2 class="text-2xl font-extrabold text-slate-900"><?= h($b['title']) ?></h2>
                    <?php endif; ?>
                    <?php if ($activeFilter): ?><a href="index.php" class="text-sm font-medium text-brand hover:underline">Reset</a>
                    <?php elseif (($b['source'] ?? 'all') === 'all'): ?><a href="produk.php" class="text-sm font-medium text-brand hover:underline">Lihat semua &rarr;</a><?php endif; ?>
                </div>
                <?php if ($useSearch): ?>
                    <form method="get" class="flex flex-col sm:flex-row gap-3 mb-6">
                        <select name="cat" onchange="this.form.submit()" class="px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand/50">
                            <option value="">Semua kategori</option>
                            <?php foreach ($cats as $id => $name): ?><option value="<?= h($id) ?>" <?= (string)$cat === (string)$id ? 'selected' : '' ?>><?= h($name) ?></option><?php endforeach; ?>
                        </select>
                        <?php if ($q !== ''): ?><input type="hidden" name="q" value="<?= h($q) ?>"><?php endif; ?>
                    </form>
                <?php endif; ?>
                <?php if (!count($list)): ?>
                    <p class="text-slate-400 py-10 text-center">Tidak ada produk ditemukan.</p>
                <?php else: ?>
                    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                        <?php foreach ($list as $i => $p) echo product_card_html($p, $i, $shop, $i < 3 && !$activeFilter); ?>
                    </div>
                <?php endif; ?>
            </section>
            <?php break;

        case 'kategori':
            if (!count($cats)) break; ?>
            <section class="mb-10">
                <?php if (!empty($b['title'])): ?><h2 class="text-2xl font-extrabold text-slate-900 mb-4"><?= h($b['title']) ?></h2><?php endif; ?>
                <div class="flex flex-wrap gap-2.5">
                    <?php foreach ($cats as $id => $name): ?>
                        <a href="produk.php?cat=<?= h($id) ?>" class="px-4 py-2 rounded-full bg-white border border-slate-200 text-sm font-medium text-slate-700 hover:border-brand hover:text-brand transition"><?= h($name) ?></a>
                    <?php endforeach; ?>
                </div>
            </section>
            <?php break;

        case 'artikel':
            $limit = max(1, (int)($b['limit'] ?? 3));
            $arts = [];
            try { $arts = db()->query("SELECT title, slug, excerpt, cover_url FROM articles WHERE status='PUBLISHED' ORDER BY COALESCE(published_at, created_at) DESC LIMIT " . $limit)->fetchAll(); } catch (Throwable $e) {}
            if (!count($arts)) break; ?>
            <section class="mb-10">
                <div class="flex items-center justify-between mb-4">
                    <?php if (!empty($b['title'])): ?><h2 class="text-2xl font-extrabold text-slate-900"><?= h($b['title']) ?></h2><?php endif; ?>
                    <a href="artikel.php" class="text-sm font-medium text-brand hover:underline">Semua artikel</a>
                </div>
                <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    <?php foreach ($arts as $a): ?>
                        <a href="artikel.php?slug=<?= h($a['slug']) ?>" class="group bg-white rounded-3xl border border-slate-200 overflow-hidden hover:shadow-lg transition-all flex flex-col">
                            <div class="aspect-[16/9] bg-slate-100 overflow-hidden">
                                <?php if (!empty($a['cover_url'])): ?><img src="<?= h($a['cover_url']) ?>" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"><?php endif; ?>
                            </div>
                            <div class="p-5">
                                <h3 class="font-bold text-slate-800 line-clamp-2 group-hover:text-brand"><?= h($a['title']) ?></h3>
                                <?php if (!empty($a['excerpt'])): ?><p class="mt-2 text-sm text-slate-500 line-clamp-2"><?= h($a['excerpt']) ?></p><?php endif; ?>
                            </div>
                        </a>
                    <?php endforeach; ?>
                </div>
            </section>
            <?php break;

        case 'tentang':
            $img = $b['image'] ?? '';
            $items = parse_items($b['list'] ?? '');
            ?>
            <section class="mb-12">
                <div class="grid md:grid-cols-2 gap-8 items-center">
                    <?php if ($img): ?><img src="<?= h($img) ?>" class="w-full rounded-3xl aspect-[4/3] object-cover shadow-sm"><?php endif; ?>
                    <div class="<?= $img ? '' : 'md:col-span-2 max-w-2xl mx-auto text-center' ?>">
                        <span class="inline-block text-xs font-semibold text-brand bg-brand/10 px-3 py-1 rounded-full mb-3">Tentang Kami</span>
                        <?php if (!empty($b['title'])): ?><h2 class="text-2xl sm:text-3xl font-extrabold text-slate-900 leading-tight"><?= h($b['title']) ?></h2><?php endif; ?>
                        <?php if (!empty($b['text'])): ?><div class="prose-toko mt-3 text-slate-600"><?= $b['text'] ?></div><?php endif; ?>
                        <?php if ($items): ?>
                            <ul class="mt-5 space-y-2 <?= $img ? '' : 'inline-block text-left' ?>">
                                <?php foreach ($items as $it): ?>
                                    <li class="flex items-start gap-2 text-slate-700"><svg class="w-5 h-5 text-brand mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg><span><?= h($it[0]) ?></span></li>
                                <?php endforeach; ?>
                            </ul>
                        <?php endif; ?>
                    </div>
                </div>
            </section>
            <?php break;

        case 'fitur':
            $items = parse_items($b['items'] ?? '');
            if (!$items) break; ?>
            <section class="mb-12">
                <?php if (!empty($b['title'])): ?><h2 class="text-2xl sm:text-3xl font-extrabold text-slate-900 text-center mb-2"><?= h($b['title']) ?></h2><?php endif; ?>
                <?php if (!empty($b['subtitle'])): ?><p class="text-slate-500 text-center mb-8 max-w-xl mx-auto"><?= h($b['subtitle']) ?></p><?php else: ?><div class="mb-8"></div><?php endif; ?>
                <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    <?php foreach ($items as $it): ?>
                        <div class="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-md transition">
                            <div class="h-11 w-11 rounded-xl bg-brand/10 text-brand grid place-items-center mb-4"><svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg></div>
                            <h3 class="font-bold text-slate-900"><?= h($it[0]) ?></h3>
                            <?php if (!empty($it[1])): ?><p class="mt-1.5 text-sm text-slate-500 leading-relaxed"><?= h($it[1]) ?></p><?php endif; ?>
                        </div>
                    <?php endforeach; ?>
                </div>
            </section>
            <?php break;

        case 'statistik':
            $items = parse_items($b['items'] ?? '');
            if (!$items) break;
            $gc = count($items); $gcls = $gc >= 4 ? 'md:grid-cols-4' : ($gc === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'); ?>
            <section class="mb-12 rounded-3xl bg-slate-900 text-white p-8 sm:p-10">
                <div class="grid grid-cols-2 <?= $gcls ?> gap-6 text-center">
                    <?php foreach ($items as $it): ?>
                        <div><div class="text-3xl sm:text-4xl font-extrabold text-brand"><?= h($it[0]) ?></div><div class="mt-1 text-sm text-white/70"><?= h($it[1] ?? '') ?></div></div>
                    <?php endforeach; ?>
                </div>
            </section>
            <?php break;

        case 'testimoni':
            $items = parse_items($b['items'] ?? '');
            if (!$items) break; ?>
            <section class="mb-12">
                <?php if (!empty($b['title'])): ?><h2 class="text-2xl sm:text-3xl font-extrabold text-slate-900 text-center mb-8"><?= h($b['title']) ?></h2><?php endif; ?>
                <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    <?php foreach ($items as $it): ?>
                        <div class="bg-white rounded-2xl border border-slate-200 p-6">
                            <svg class="w-8 h-8 text-brand/20" fill="currentColor" viewBox="0 0 24 24"><path d="M7.17 6A5.17 5.17 0 002 11.17V18h6.83v-6.83H5.5A1.5 1.5 0 017 9.5V6zM18.17 6A5.17 5.17 0 0013 11.17V18h6.83v-6.83H16.5a1.5 1.5 0 011.5-1.67V6z"/></svg>
                            <p class="mt-2 text-slate-600 italic leading-relaxed">"<?= h($it[0]) ?>"</p>
                            <div class="mt-4 flex items-center gap-3">
                                <span class="h-9 w-9 rounded-full bg-brand/10 text-brand grid place-items-center font-bold text-sm"><?= h(strtoupper(mb_substr($it[1] ?? 'A', 0, 1))) ?></span>
                                <div><div class="font-semibold text-slate-800 text-sm"><?= h($it[1] ?? '') ?></div><?php if (!empty($it[2])): ?><div class="text-xs text-slate-400"><?= h($it[2]) ?></div><?php endif; ?></div>
                            </div>
                        </div>
                    <?php endforeach; ?>
                </div>
            </section>
            <?php break;

        case 'faq':
            $items = parse_items($b['items'] ?? '');
            if (!$items) break; ?>
            <section class="mb-12 max-w-3xl mx-auto">
                <?php if (!empty($b['title'])): ?><h2 class="text-2xl sm:text-3xl font-extrabold text-slate-900 text-center mb-8"><?= h($b['title']) ?></h2><?php endif; ?>
                <div class="space-y-3">
                    <?php foreach ($items as $it): ?>
                        <details class="group bg-white rounded-2xl border border-slate-200 p-5">
                            <summary class="flex items-center justify-between cursor-pointer font-semibold text-slate-800 list-none gap-3">
                                <span><?= h($it[0]) ?></span>
                                <svg class="w-5 h-5 text-slate-400 shrink-0 group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
                            </summary>
                            <?php if (!empty($it[1])): ?><p class="mt-3 text-slate-600 text-sm leading-relaxed"><?= nl2br(h($it[1])) ?></p><?php endif; ?>
                        </details>
                    <?php endforeach; ?>
                </div>
            </section>
            <?php break;

        case 'portofolio':
            $items = array_values(array_filter($b['items'] ?? [], fn($it) => !empty($it['image'])));
            if (!$items) {
                if (is_admin()): ?>
                    <section class="mb-12 rounded-3xl border-2 border-dashed border-slate-300 p-10 text-center">
                        <p class="font-bold text-slate-500"><?= h($b['title'] ?: 'Portofolio / Galeri') ?></p>
                        <p class="text-sm text-slate-400 mt-1">Belum ada foto karya — tambahkan lewat Dashboard &rarr; Tampilan. <span class="block mt-0.5">(Pesan ini hanya terlihat oleh admin.)</span></p>
                    </section>
                <?php endif;
                break;
            }
            $gid = 'pf' . substr(md5(json_encode($items)), 0, 6);
            ?>
            <section class="mb-12 scroll-mt-20" id="<?= $gid ?>">
                <?php if (!empty($b['title'])): ?><h2 class="text-2xl sm:text-3xl font-extrabold text-slate-900 text-center mb-2"><?= h($b['title']) ?></h2><?php endif; ?>
                <?php if (!empty($b['subtitle'])): ?><p class="text-slate-500 text-center mb-8 max-w-xl mx-auto"><?= h($b['subtitle']) ?></p><?php else: ?><div class="mb-8"></div><?php endif; ?>
                <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                    <?php foreach ($items as $i => $it): ?>
                        <button type="button" data-pf="<?= $i ?>" class="card-in group relative aspect-square rounded-2xl overflow-hidden bg-slate-100 text-left cursor-zoom-in" style="animation-delay:<?= ($i % 8) * 60 ?>ms">
                            <img src="<?= h($it['image']) ?>" alt="<?= h($it['title'] ?? 'Karya') ?>" loading="lazy" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500">
                            <span class="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></span>
                            <span class="absolute inset-x-0 bottom-0 p-3 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                                <?php if (!empty($it['title'])): ?><span class="block text-white font-bold text-sm leading-snug"><?= h($it['title']) ?></span><?php endif; ?>
                                <?php if (!empty($it['caption'])): ?><span class="block text-white/70 text-xs mt-0.5"><?= h($it['caption']) ?></span><?php endif; ?>
                            </span>
                            <span class="absolute top-2.5 right-2.5 h-8 w-8 grid place-items-center rounded-full bg-white/25 backdrop-blur text-white opacity-0 group-hover:opacity-100 transition"><svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M11 17a6 6 0 100-12 6 6 0 000 12zM11 8v6m-3-3h6"/></svg></span>
                        </button>
                    <?php endforeach; ?>
                </div>
                <!-- Lightbox -->
                <div data-pf-box class="fixed inset-0 z-[70] hidden items-center justify-center bg-slate-950/90 backdrop-blur-sm p-4 sm:p-8">
                    <button type="button" data-pf-close class="absolute top-4 right-4 h-10 w-10 grid place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 z-10" aria-label="Tutup"><svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></button>
                    <?php if (count($items) > 1): ?>
                        <button type="button" data-pf-nav="-1" class="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 h-11 w-11 grid place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 z-10" aria-label="Sebelumnya"><svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg></button>
                        <button type="button" data-pf-nav="1" class="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 h-11 w-11 grid place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 z-10" aria-label="Berikutnya"><svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg></button>
                    <?php endif; ?>
                    <figure class="max-w-4xl w-full text-center">
                        <img data-pf-img src="" alt="" class="max-h-[75vh] w-auto mx-auto rounded-xl shadow-2xl">
                        <figcaption class="mt-3">
                            <span data-pf-title class="block text-white font-bold"></span>
                            <span data-pf-cap class="block text-white/60 text-sm"></span>
                        </figcaption>
                    </figure>
                </div>
            </section>
            <script>
            (function () {
                var root = document.getElementById('<?= $gid ?>');
                if (!root) return;
                var data = <?= json_encode(array_map(fn($it) => ['src' => $it['image'], 't' => $it['title'] ?? '', 'c' => $it['caption'] ?? ''], $items), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?>;
                var box = root.querySelector('[data-pf-box]'), img = root.querySelector('[data-pf-img]'),
                    tt = root.querySelector('[data-pf-title]'), cp = root.querySelector('[data-pf-cap]'), cur = 0;
                function show(i) { cur = (i + data.length) % data.length; var d = data[cur]; img.src = d.src; img.alt = d.t || 'Karya'; tt.textContent = d.t; cp.textContent = d.c; }
                function open(i) { show(i); box.classList.remove('hidden'); box.classList.add('flex'); document.body.style.overflow = 'hidden'; }
                function close() { box.classList.add('hidden'); box.classList.remove('flex'); document.body.style.overflow = ''; }
                root.querySelectorAll('[data-pf]').forEach(function (b) { b.addEventListener('click', function () { open(+b.dataset.pf); }); });
                root.querySelector('[data-pf-close]').addEventListener('click', close);
                root.querySelectorAll('[data-pf-nav]').forEach(function (b) { b.addEventListener('click', function (e) { e.stopPropagation(); show(cur + +b.dataset.pfNav); }); });
                box.addEventListener('click', function (e) { if (e.target === box) close(); });
                document.addEventListener('keydown', function (e) {
                    if (box.classList.contains('hidden')) return;
                    if (e.key === 'Escape') close();
                    if (e.key === 'ArrowRight') show(cur + 1);
                    if (e.key === 'ArrowLeft') show(cur - 1);
                });
            })();
            </script>
            <?php break;

        case 'kontak':
            $wa = preg_replace('/^0/', '62', preg_replace('/\D/', '', $b['whatsapp'] ?? '')); ?>
            <section id="kontak" class="mb-12 scroll-mt-20">
                <?php if (!empty($b['title'])): ?><h2 class="text-2xl sm:text-3xl font-extrabold text-slate-900 text-center mb-8"><?= h($b['title']) ?></h2><?php endif; ?>
                <div class="grid md:grid-cols-2 gap-6 items-stretch">
                    <div class="bg-white rounded-3xl border border-slate-200 p-6 space-y-4">
                        <?php if (!empty($b['address'])): ?><div class="flex items-start gap-3"><svg class="w-5 h-5 text-brand mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><circle cx="12" cy="11" r="3"/></svg><span class="text-slate-600 text-sm whitespace-pre-line"><?= h($b['address']) ?></span></div><?php endif; ?>
                        <?php if (!empty($b['phone'])): ?><div class="flex items-center gap-3"><svg class="w-5 h-5 text-brand shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11 11 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg><a href="tel:<?= h($b['phone']) ?>" class="text-slate-600 text-sm hover:text-brand"><?= h($b['phone']) ?></a></div><?php endif; ?>
                        <?php if (!empty($b['email'])): ?><div class="flex items-center gap-3"><svg class="w-5 h-5 text-brand shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg><a href="mailto:<?= h($b['email']) ?>" class="text-slate-600 text-sm hover:text-brand"><?= h($b['email']) ?></a></div><?php endif; ?>
                        <?php if ($wa): ?><a href="https://wa.me/<?= h($wa) ?>" target="_blank" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 transition mt-2">Chat WhatsApp</a><?php endif; ?>
                    </div>
                    <?php if (!empty($b['mapsEmbed'])): ?>
                        <div class="rounded-3xl overflow-hidden border border-slate-200 min-h-[260px]"><iframe src="<?= h($b['mapsEmbed']) ?>" class="w-full h-full min-h-[260px]" style="border:0" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div>
                    <?php endif; ?>
                </div>
            </section>
            <?php break;

        case 'banner':
            if (empty($b['image'])) break; ?>
            <section class="mb-10">
                <?php $bn = '<img src="' . h($b['image']) . '" class="w-full rounded-3xl">'; ?>
                <?php if (!empty($b['link'])): ?><a href="<?= h($b['link']) ?>" target="_blank"><?= $bn ?></a><?php else: ?><?= $bn ?><?php endif; ?>
            </section>
            <?php break;

        case 'teks': ?>
            <section class="mb-10 bg-white rounded-3xl border border-slate-200 p-6 sm:p-8">
                <?php if (!empty($b['title'])): ?><h2 class="text-2xl font-extrabold text-slate-900 mb-3"><?= h($b['title']) ?></h2><?php endif; ?>
                <div class="prose-toko text-slate-600 leading-relaxed"><?= $b['html'] ?? '' ?></div>
            </section>
            <?php break;

        case 'cta': ?>
            <section class="mb-12 relative overflow-hidden rounded-3xl bg-slate-900 text-white p-10 sm:p-14 text-center">
                <div class="absolute -top-16 -left-10 w-64 h-64 rounded-full bg-brand/30 blur-3xl"></div>
                <div class="absolute -bottom-20 -right-10 w-72 h-72 rounded-full bg-fuchsia-500/20 blur-3xl"></div>
                <div class="relative">
                    <?php if (!empty($b['title'])): ?><h2 class="text-2xl sm:text-4xl font-extrabold"><?= h($b['title']) ?></h2><?php endif; ?>
                    <?php if (!empty($b['subtitle'])): ?><p class="mt-3 text-white/80 max-w-xl mx-auto"><?= h($b['subtitle']) ?></p><?php endif; ?>
                    <?php if (!empty($b['btnText'])): ?>
                        <a href="<?= h($b['btnLink'] ?: '#') ?>" class="cta-btn group inline-flex items-center gap-2 mt-7 px-8 py-4 rounded-2xl bg-gradient-to-r from-brand via-fuchsia-500 to-brand text-white font-bold text-lg shadow-xl shadow-brand/30 hover:scale-[1.06] active:scale-95 transition">
                            <svg class="wig w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><circle cx="12" cy="12" r="9"/></svg>
                            <?= h($b['btnText']) ?>
                        </a>
                    <?php endif; ?>
                </div>
            </section>
            <?php break;

        case 'popup':
            $img = $b['image'] ?? '';
            if ($img === '' && empty($b['title'])) break;
            $key = 'pop_' . substr(md5(($b['title'] ?? '') . '|' . $img), 0, 10);
            $pid = 'pu' . substr(md5($key), 0, 6);
            $once = !empty($b['once']);
            ?>
            <div id="<?= $pid ?>" class="fixed inset-0 z-[60] hidden items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                <div class="relative bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl animate-[pop_.25s_ease]">
                    <button type="button" data-close class="absolute top-3 right-3 h-9 w-9 grid place-items-center rounded-full bg-black/40 text-white hover:bg-black/60 z-10"><svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></button>
                    <?php if ($img): $imgTag = '<img src="' . h($img) . '" class="w-full">'; ?>
                        <?php if (!empty($b['link'])): ?><a href="<?= h($b['link']) ?>" target="_blank"><?= $imgTag ?></a><?php else: ?><?= $imgTag ?><?php endif; ?>
                    <?php endif; ?>
                    <?php if (!empty($b['title']) || !empty($b['text']) || !empty($b['btnText'])): ?>
                        <div class="p-6 text-center">
                            <?php if (!empty($b['title'])): ?><h3 class="text-lg font-extrabold text-slate-900"><?= h($b['title']) ?></h3><?php endif; ?>
                            <?php if (!empty($b['text'])): ?><p class="mt-1.5 text-sm text-slate-500"><?= h($b['text']) ?></p><?php endif; ?>
                            <?php if (!empty($b['btnText'])): ?><a href="<?= h($b['btnLink'] ?: '#') ?>" class="inline-block mt-4 px-6 py-2.5 rounded-xl bg-brand text-white font-semibold hover:opacity-90 transition"><?= h($b['btnText']) ?></a><?php endif; ?>
                        </div>
                    <?php endif; ?>
                </div>
            </div>
            <style>@keyframes pop{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:scale(1)}}</style>
            <script>
            (function () {
                var key = '<?= $key ?>', once = <?= $once ? 'true' : 'false' ?>;
                try { if (once && localStorage.getItem(key) === new Date().toDateString()) return; } catch (e) {}
                var el = document.getElementById('<?= $pid ?>');
                if (!el) return;
                function open() { el.classList.remove('hidden'); el.classList.add('flex'); }
                function close() { el.classList.add('hidden'); el.classList.remove('flex'); try { if (once) localStorage.setItem(key, new Date().toDateString()); } catch (e) {} }
                setTimeout(open, 1000);
                el.querySelector('[data-close]').addEventListener('click', close);
                el.addEventListener('click', function (e) { if (e.target === el) close(); });
            })();
            </script>
            <?php break;
    }
    return ob_get_clean();
}
