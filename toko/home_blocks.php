<?php
require_once __DIR__ . '/lib.php';

// ── Layout beranda toko (tersimpan JSON di settings 'home_layout') ───────────
// Desain mengikuti PRD-website-voliko: hero slider + zero-gravity, glassmorphism,
// section gelap, marquee klien, form order last-minute. Layout lama di DB tetap
// kompatibel — field baru opsional dengan fallback aman.
function default_home_layout(): array {
    return [
        ['type' => 'slider', 'enabled' => true, 'variant' => 'studio',
            'statText' => '1.600+ pesanan selesai', 'statSub' => '60 hari terakhir · 900+ pelanggan aktif',
            'floats' => '',
            'slides' => [
                ['image' => 'assets/demo/hero-1.svg', 'title' => 'Standar Baru Percetakan di Yogyakarta', 'highlight' => 'Standar Baru', 'subtitle' => 'Dari cetak banner hingga cutting laser — Voliko Print mengerjakan setiap detail dengan disiplin produksi dan ketepatan waktu yang dapat Anda andalkan.', 'btnText' => 'Konsultasi Gratis', 'btnLink' => '#order-cepat', 'btn2Text' => 'Lihat Katalog', 'btn2Link' => 'produk.php'],
                ['image' => 'assets/demo/hero-2.svg', 'title' => 'Warna Tepat. Potongan Presisi. Selesai Tepat Waktu.', 'highlight' => 'Presisi.', 'subtitle' => 'Tiga hal sederhana yang jarang konsisten di dunia percetakan — dan menjadi standar kerja kami setiap hari di Imogiri dan Sewon, Bantul.', 'btnText' => 'Jelajahi Layanan', 'btnLink' => '#produk', 'btn2Text' => '', 'btn2Link' => ''],
                ['image' => 'assets/demo/hero-3.svg', 'title' => 'Partner Cetak untuk Bisnis, Instansi & Kreator', 'highlight' => 'Partner Cetak', 'subtitle' => 'Kebutuhan rutin perusahaan, materi event, hingga merchandise komunitas — ditangani satu tim dengan satu standar kualitas.', 'btnText' => 'Hubungi Kami', 'btnLink' => '#order-cepat', 'btn2Text' => 'Portofolio', 'btn2Link' => 'portofolio.php'],
            ]],
        ['type' => 'klien', 'enabled' => true, 'title' => '', 'items' => "CETAK BANNER ✦\nSTIKER METERAN ✦\nCETAK UV ROLL ✦\nPRINT DTF ✦\nCUTTING LASER ✦\nMERCHANDISE ✦\nDESAIN GRAFIS ✦"],
        ['type' => 'layanan_banner', 'enabled' => true, 'title' => 'Lima Lini Produksi Inti', 'subtitle' => 'Seluruh proses dikerjakan in-house — kualitas terkontrol dari file masuk hingga serah terima.', 'items' => "Cetak Bahan Banner | Flexi & albatros untuk kebutuhan indoor-outdoor, ukuran fleksibel\nCetak Stiker Meteran | Vinyl, chromo & transparan, dipotong sesuai kebutuhan\nCutting Laser | Akrilik, kayu & souvenir custom berpresisi tinggi\nCetak UV Roll | Tinta UV tahan cuaca dengan reproduksi warna akurat\nPrint DTF | Sablon kaos satuan dengan gradasi warna penuh"],
        ['type' => 'produk_pilihan', 'enabled' => true, 'title' => 'Karya yang Paling Sering Dipesan', 'subtitle' => 'Dipilih dari katalog kami — produk dengan tingkat pemesanan ulang tertinggi.', 'ids' => []],
        ['type' => 'statistik', 'enabled' => true, 'items' => "1.600+ | Pesanan Selesai (60 Hari)\n900+ | Pelanggan Aktif\n2 | Cabang di Bantul\n4.9/5 | Penilaian Pelanggan"],
        ['type' => 'tentang', 'enabled' => true, 'dark' => true, 'badgeText' => 'TENTANG VOLIKO ✦ SEJAK IMOGIRI ✦', 'badgeLink' => 'profil.php', 'title' => 'Dikerjakan Tim yang Memahami Arti Sebuah Tenggat', 'text' => 'Kami tahu materi cetak Anda hampir selalu terikat jadwal — acara, peluncuran produk, atau tender. Karena itu Voliko Print membangun alur produksi yang terukur di dua cabang Bantul: antrean jelas, progres terpantau, dan kualitas yang tidak ditawar.', 'image' => '', 'list' => "Melayani retail, korporat & instansi\nAlur produksi in-house yang terkontrol\nPendampingan desain hingga siap cetak\nPengiriman ke seluruh Indonesia"],
        ['type' => 'video', 'enabled' => true, 'title' => 'Suasana Ruang Produksi Kami', 'image' => 'assets/demo/team.svg', 'youtube' => ''],
        ['type' => 'produk', 'enabled' => true, 'title' => 'Katalog Produk', 'source' => 'all', 'categoryId' => '', 'limit' => 8, 'search' => false],
        ['type' => 'order', 'enabled' => true, 'title' => 'Mulai dari Percakapan Sederhana', 'subtitle' => 'Ceritakan kebutuhan atau tenggat Anda. Tim kami membalas dengan rekomendasi material dan estimasi biaya — tanpa kewajiban apa pun.', 'image' => 'assets/demo/cs.svg', 'whatsapp' => '', 'branches' => "Imogiri\nSewon"],
        ['type' => 'fitur', 'enabled' => true, 'title' => 'Cara Kami Bekerja', 'subtitle' => 'Empat langkah yang sama untuk setiap pesanan — besar maupun kecil.', 'items' => "1. Konsultasi | Diskusikan kebutuhan, material, dan tenggat bersama tim kami.\n2. Desain & Persetujuan | File Anda diperiksa — atau dibuatkan — lalu dikonfirmasi sebelum naik cetak.\n3. Produksi Terjadwal | Pesanan masuk antrean produksi dengan progres yang terpantau.\n4. Serah Terima | Ambil di cabang Imogiri / Sewon, atau kami kirim sampai alamat Anda."],
        ['type' => 'testimoni', 'enabled' => true, 'title' => 'Dipercaya karena Konsisten', 'items' => "Vendor cetak langganan kantor kami — spesifikasi selalu sesuai, tidak perlu revisi. | Andi Pratama | Staf Pengadaan Instansi\nLabel kemasan produk kami terlihat premium dan datang tepat jadwal produksi. | Sari Wulandari | Pemilik Brand Kuliner\nPlakat akrilik untuk acara penghargaan dikerjakan halus sampai detail terkecil. | Budi Santoso | Ketua Panitia\nBanner & backdrop event selesai H-2 — komunikasinya enak dari awal sampai akhir. | Rina Maharani | Event Organizer"],
        ['type' => 'artikel', 'enabled' => true, 'title' => 'Panduan & Referensi Cetak', 'limit' => 6],
        ['type' => 'faq', 'enabled' => true, 'title' => 'Pertanyaan yang Sering Diajukan', 'items' => "Berapa lama waktu pengerjaan? | Pesanan reguler umumnya selesai 1–3 hari kerja, bergantung jenis produk dan antrean produksi. Kebutuhan mendesak dapat dikomunikasikan terlebih dahulu.\nApakah ada minimal order? | Sebagian besar produk dapat dicetak satuan — termasuk sablon DTF dan stiker.\nDi mana lokasi Voliko Print? | Kami memiliki dua cabang di Bantul, Yogyakarta: Imogiri dan Sewon. Pesanan juga dapat dikirim ke seluruh Indonesia.\nFormat file apa yang diterima? | PDF, AI, CDR, atau PNG/JPG resolusi tinggi. Belum memiliki file desain? Tim kami siap membantu menyiapkannya.\nBagaimana cara memesan? | Pilih produk pada katalog lalu lakukan checkout, atau konsultasikan kebutuhan Anda langsung melalui WhatsApp."],
        ['type' => 'kontak', 'enabled' => true, 'title' => 'Hubungi Kami', 'address' => "Imogiri, Bantul,\nDaerah Istimewa Yogyakarta", 'phone' => '0812-3456-7890', 'whatsapp' => '081234567890', 'email' => 'halo@tokokamu.com', 'mapsEmbed' => ''],
        ['type' => 'cta', 'enabled' => true, 'title' => 'Siap Mencetak dengan Standar yang Berbeda?', 'subtitle' => 'Konsultasikan kebutuhan banner, stiker, DTF, atau cutting laser Anda — tanpa biaya, penawaran transparan sejak awal.', 'btnText' => 'Mulai Konsultasi', 'btnLink' => '#order-cepat'],
    ];
}

// Preset "Corporate Editorial" — tampilan korporat-premium: monokrom, tipografi
// besar, band gelap full-bleed, tanpa elemen playful. Susunan: hero statement →
// strip layanan → statement gelap → lini layanan bernomor → karya terpilih →
// statistik → fasilitas → produk unggulan → testimoni → klien → konsultasi → wawasan.
// Dipilih dari menu Tampilan → tombol preset (warna brand kembali ke bawaan).
function corporate_home_layout(): array {
    return [
        ['type' => 'slider', 'enabled' => true, 'variant' => 'editorial',
            'statText' => '1.600+ pesanan diselesaikan', 'statSub' => 'dalam 60 hari terakhir · 900+ klien aktif',
            'floats' => '',
            'slides' => [
                ['image' => 'assets/demo/hero-1.svg', 'title' => 'Mitra Produksi Cetak untuk Bisnis Anda', 'highlight' => 'Produksi Cetak', 'subtitle' => 'Voliko Print menangani kebutuhan cetak perusahaan, instansi, dan brand — dari materi promosi hingga merchandise — dengan alur produksi in-house yang terukur di dua fasilitas kami di Bantul, Yogyakarta.', 'btnText' => 'Konsultasikan Kebutuhan', 'btnLink' => '#order-cepat', 'btn2Text' => 'Lihat Portofolio', 'btn2Link' => 'portofolio.php'],
                ['image' => 'assets/demo/hero-2.svg', 'title' => 'Presisi Warna. Ketepatan Waktu. Setiap Pesanan.', 'highlight' => 'Presisi', 'subtitle' => 'Standar kerja yang kami pegang di setiap lini produksi: reproduksi warna akurat, finishing rapi, dan serah terima sesuai jadwal yang disepakati.', 'btnText' => 'Jelajahi Layanan', 'btnLink' => '#produk', 'btn2Text' => '', 'btn2Link' => ''],
                ['image' => 'assets/demo/hero-3.svg', 'title' => 'Satu Tim untuk Seluruh Materi Cetak Anda', 'highlight' => 'Satu Tim', 'subtitle' => 'Banner, stiker meteran, UV roll, DTF, hingga cutting laser — dikerjakan satu tim dengan satu standar kualitas, untuk kebutuhan rutin maupun proyek berskala besar.', 'btnText' => 'Hubungi Kami', 'btnLink' => '#order-cepat', 'btn2Text' => 'Katalog Produk', 'btn2Link' => 'produk.php'],
            ]],
        ['type' => 'klien', 'enabled' => true, 'title' => '', 'items' => "CETAK BANNER ✦\nSTIKER METERAN ✦\nCETAK UV ROLL ✦\nPRINT DTF ✦\nCUTTING LASER ✦\nMERCHANDISE ✦\nDESAIN GRAFIS ✦"],
        ['type' => 'tentang', 'enabled' => true, 'dark' => true, 'badgeText' => 'PROFIL PERUSAHAAN ✦ VOLIKO PRINT ✦', 'badgeLink' => 'profil.php', 'title' => 'Kualitas yang Konsisten Lahir dari Proses yang Disiplin.', 'text' => 'Voliko Print dibangun di atas satu keyakinan: materi cetak yang baik adalah hasil dari proses yang terkontrol. Setiap pesanan melewati alur yang sama — pemeriksaan file, antrean produksi terjadwal, kontrol kualitas sebelum serah terima — sehingga hasil yang Anda terima hari ini sama baiknya dengan pesanan berikutnya.', 'image' => '', 'list' => "Melayani korporat, instansi & brand\nProduksi in-house di dua fasilitas\nKontrol kualitas pada setiap tahap\nPengiriman ke seluruh Indonesia"],
        ['type' => 'layanan_banner', 'enabled' => true, 'title' => 'Lini Layanan', 'subtitle' => 'Lima lini produksi inti — seluruhnya dikerjakan in-house dengan kontrol kualitas penuh.', 'items' => "Cetak Bahan Banner | Flexi & albatros untuk kebutuhan indoor-outdoor, ukuran fleksibel\nCetak Stiker Meteran | Vinyl, chromo & transparan, dipotong sesuai kebutuhan\nCutting Laser | Akrilik, kayu & souvenir custom berpresisi tinggi\nCetak UV Roll | Tinta UV tahan cuaca dengan reproduksi warna akurat\nPrint DTF | Sablon kaos satuan dengan gradasi warna penuh"],
        ['type' => 'portofolio', 'enabled' => true, 'title' => 'Karya Terpilih', 'subtitle' => 'Sebagian pekerjaan yang kami selesaikan untuk klien korporat, instansi, dan brand.', 'items' => [
            ['image' => 'assets/demo/work-1.svg', 'title' => 'Label Kemasan', 'caption' => 'Brand kuliner'],
            ['image' => 'assets/demo/work-2.svg', 'title' => 'Backdrop Event', 'caption' => 'Konferensi korporat'],
            ['image' => 'assets/demo/work-3.svg', 'title' => 'Signage Akrilik', 'caption' => 'Kantor instansi'],
            ['image' => 'assets/demo/work-4.svg', 'title' => 'Kartu Nama', 'caption' => 'Identitas korporat'],
            ['image' => 'assets/demo/work-5.svg', 'title' => 'Apparel DTF', 'caption' => 'Seragam komunitas'],
            ['image' => 'assets/demo/work-6.svg', 'title' => 'Plakat Penghargaan', 'caption' => 'Instansi pemerintah'],
            ['image' => 'assets/demo/work-7.svg', 'title' => 'Roll Banner', 'caption' => 'Booth pameran'],
            ['image' => 'assets/demo/work-8.svg', 'title' => 'Kemasan Premium', 'caption' => 'Butik fashion'],
        ]],
        ['type' => 'statistik', 'enabled' => true, 'items' => "1.600+ | Pesanan Selesai (60 Hari)\n900+ | Klien Aktif\n2 | Fasilitas Produksi\n4.9/5 | Penilaian Klien"],
        ['type' => 'video', 'enabled' => true, 'title' => 'Fasilitas & Proses Produksi', 'image' => 'assets/demo/team.svg', 'youtube' => ''],
        ['type' => 'produk_pilihan', 'enabled' => true, 'title' => 'Produk Unggulan', 'subtitle' => 'Produk dengan tingkat pemesanan ulang tertinggi dari katalog kami.', 'ids' => []],
        ['type' => 'testimoni', 'enabled' => true, 'title' => 'Apa Kata Klien Kami', 'items' => "Vendor cetak langganan kantor kami — spesifikasi selalu sesuai, tidak perlu revisi. | Andi Pratama | Staf Pengadaan Instansi\nLabel kemasan produk kami terlihat premium dan datang tepat jadwal produksi. | Sari Wulandari | Pemilik Brand Kuliner\nPlakat akrilik untuk acara penghargaan dikerjakan halus sampai detail terkecil. | Budi Santoso | Ketua Panitia\nBanner & backdrop event selesai H-2 — komunikasinya profesional dari awal sampai akhir. | Rina Maharani | Event Organizer"],
        ['type' => 'klien', 'enabled' => true, 'title' => 'Dipercaya Perusahaan & Instansi', 'items' => "SMA N 1 Imogiri\nUniversitas di Yogyakarta\nDinas Kabupaten Bantul\nBrand Kuliner Lokal\nKomunitas Kreatif Jogja\nEvent Organizer Yogyakarta\nUMKM Binaan Bantul\nSekolah & Pondok Pesantren"],
        ['type' => 'order', 'enabled' => true, 'title' => 'Konsultasikan Kebutuhan Cetak Anda', 'subtitle' => 'Sampaikan kebutuhan dan tenggat Anda. Tim kami akan merespons dengan rekomendasi material dan estimasi biaya — tanpa kewajiban apa pun.', 'image' => '', 'whatsapp' => '', 'branches' => "Imogiri\nSewon"],
        ['type' => 'artikel', 'enabled' => true, 'title' => 'Wawasan & Panduan', 'limit' => 6],
        ['type' => 'kontak', 'enabled' => true, 'title' => 'Hubungi Kami', 'address' => "Imogiri, Bantul,\nDaerah Istimewa Yogyakarta", 'phone' => '0812-3456-7890', 'whatsapp' => '081234567890', 'email' => 'halo@tokokamu.com', 'mapsEmbed' => ''],
    ];
}

// Layout default halaman Profil (company profile)
function default_profil_layout(): array {
    return [
        ['type' => 'slider', 'enabled' => true, 'slides' => [
            ['image' => '', 'title' => 'Percetakan yang Mengantar Kebahagiaan', 'highlight' => 'Kebahagiaan', 'subtitle' => 'Sejak 2018 kami membantu pelaku usaha & individu mewujudkan ide jadi cetakan berkualitas.', 'btnText' => 'Hubungi Kami', 'btnLink' => '#kontak'],
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
            ['image' => '', 'title' => 'Portofolio Karya Kami', 'highlight' => 'Karya', 'subtitle' => 'Bukti kualitas, bukan sekadar janji. Lihat hasil cetakan yang sudah kami kerjakan untuk pelanggan.', 'btnText' => 'Pesan Sekarang', 'btnLink' => 'produk.php'],
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
        'produk_pilihan' => 'Produk Pilihan (Bento)',
        'layanan_banner' => 'Banner Layanan (Glass)',
        'kategori'  => 'Kategori',
        'portofolio'=> 'Portofolio / Galeri',
        'video'     => 'Video / Foto Tim',
        'tentang'   => 'Tentang Kami',
        'order'     => 'Form Order Cepat',
        'klien'     => 'Logo Klien (Marquee)',
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

/** Judul hero dengan satu kata di-highlight warna aksen (PRD §5.2). */
function hero_title_html(string $title, string $highlight = ''): string {
    $safe = h($title);
    $hl = trim($highlight);
    if ($hl !== '' && mb_stripos($title, $hl) !== false) {
        $safeHl = h($hl);
        $pos = mb_stripos($safe, $safeHl);
        if ($pos !== false) {
            return mb_substr($safe, 0, $pos)
                . '<span class="hero-mark">' . mb_substr($safe, $pos, mb_strlen($safeHl)) . '</span>'
                . mb_substr($safe, $pos + mb_strlen($safeHl));
        }
    }
    return $safe;
}

// Kartu produk "image-forward" (dipakai di katalog, produk serupa & beranda)
// Foto memenuhi kartu; info di bar kaca mengambang. Tema PrintKreatif glass+biru.
function product_card_html(array $p, int $i = 0, string $shop = '', bool $badge = false): string {
    $im = product_image($p);
    $vc = count($p['variants'] ?? []);
    ob_start(); ?>
    <a href="product.php?id=<?= h($p['id']) ?>" class="pk-card2 card-in" style="animation-delay:<?= ($i % 8) * 60 ?>ms">
        <div class="pk-card2-media">
            <?php if ($im): ?><img src="<?= h($im) ?>" alt="<?= h($p['name']) ?>" class="pk-card2-img" loading="lazy"><?php else: ?><div class="pk-card2-img pk-card2-img--empty"><i class="fa-solid fa-image"></i></div><?php endif; ?>
        </div>
        <?php if (!empty($p['category']['name'])): ?><span class="pk-card2-cat"><?= h($p['category']['name']) ?></span><?php endif; ?>
        <?php if ($badge): ?><span class="pk-card2-badge">Terlaris</span><?php endif; ?>
        <div class="pk-card2-overlay">
            <h3 class="pk-card2-title"><?= h($p['name']) ?></h3>
            <div class="pk-card2-foot">
                <span class="pk-card2-price">
                    <small><?= $vc > 1 ? 'Mulai dari' : 'Harga' ?></small>
                    <b><?= rupiah(product_price($p)) ?><?= product_is_area($p) ? '<small class="font-semibold opacity-70">/m²</small>' : '' ?></b>
                </span>
                <span class="pk-card2-cart" aria-hidden="true"><i class="fa-solid fa-plus"></i></span>
            </div>
        </div>
    </a>
    <?php return ob_get_clean();
}

/**
 * Kartu produk gaya "best-seller" (referensi SoundHub): gambar atas, badge diskon/Terlaris,
 * wishlist, judul, rating bintang (bila ada), harga + harga coret, tombol cart hijau.
 * Dipakai bersama di homepage (sec_products_grid), katalog (produk.php), & produk serupa.
 */
function bs_card_html(array $p, int $i = 0, bool $badge = false): string {
    $im = product_image($p); $vc = count($p['variants'] ?? []);
    $price = product_price($p); $old = 0;
    foreach (['priceOld', 'compareAtPrice', 'oldPrice', 'strikePrice'] as $k) { if (!empty($p[$k]) && (float)$p[$k] > $price) { $old = (float)$p[$k]; break; } }
    $disc   = $old ? (int)round(100 - ($price / $old * 100)) : 0;
    $rating = isset($p['rating']) ? (float)$p['rating'] : 0;
    $rcount = $p['ratingCount'] ?? $p['reviewCount'] ?? 0;
    $rr = (int)round($rating);
    ob_start(); ?>
    <div class="pk-bs-card card-in" style="animation-delay:<?= ($i % 8) * 55 ?>ms" data-reveal-item>
        <a href="product.php?id=<?= h($p['id']) ?>" class="pk-bs-media <?= $im ? '' : 'pk-bs-media--empty' ?>">
            <?php if ($disc > 0): ?><span class="pk-bs-badge pk-bs-badge--disc">-<?= $disc ?>%</span>
            <?php elseif ($badge): ?><span class="pk-bs-badge">Terlaris</span><?php endif; ?>
            <span class="pk-bs-fav" aria-hidden="true"><i class="fa-regular fa-heart"></i></span>
            <?php if ($im): ?><img src="<?= h($im) ?>" alt="<?= h($p['name']) ?>" loading="lazy"><?php else: ?><i class="fa-solid fa-image"></i><?php endif; ?>
        </a>
        <div class="pk-bs-body">
            <?php if (!empty($p['category']['name'])): ?><span class="pk-bs-cat"><?= h($p['category']['name']) ?></span><?php endif; ?>
            <a href="product.php?id=<?= h($p['id']) ?>" class="pk-bs-title"><?= h($p['name']) ?></a>
            <?php if ($rating > 0): ?><div class="pk-bs-rate"><span class="pk-bs-stars"><?= str_repeat('★', $rr) . str_repeat('☆', max(0, 5 - $rr)) ?></span><span class="pk-bs-rate-c"><?= number_format($rating, 1) ?><?= $rcount ? ' (' . (int)$rcount . ')' : '' ?></span></div><?php endif; ?>
            <div class="pk-bs-foot">
                <span class="pk-bs-price"><small><?= $vc > 1 ? 'Mulai' : 'Harga' ?></small><span class="pk-bs-price-row"><b><?= rupiah($price) ?><?= product_is_area($p) ? '<small class="font-semibold opacity-70">/m²</small>' : '' ?></b><?php if ($old): ?><span class="pk-bs-oldprice"><?= rupiah($old) ?></span><?php endif; ?></span></span>
                <a href="product.php?id=<?= h($p['id']) ?>" class="pk-bs-cart" aria-label="Lihat produk"><i class="fa-solid fa-plus"></i></a>
            </div>
        </div>
    </div>
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
            $style = $hasImg ? "background-image:linear-gradient(rgba(14,14,16,.55),rgba(14,14,16,.55)),url('" . h($img) . "');background-size:cover;background-position:center" : '';
            $cls   = $hasImg ? 'text-white' : 'bg-gradient-to-br from-brand via-brand to-[#2FA1DA] text-white';
            ?>
            <section class="relative overflow-hidden rounded-[28px] <?= $cls ?> p-8 sm:p-14 mb-10 shadow-xl shadow-brand/20" style="<?= $style ?>">
                <?php if (!$hasImg): ?>
                    <div class="absolute -top-20 -right-10 w-72 h-72 rounded-full bg-white/10 blur-2xl"></div>
                    <div class="absolute -bottom-24 -left-10 w-80 h-80 rounded-full bg-[#2FA1DA]/25 blur-3xl"></div>
                <?php endif; ?>
                <div class="relative max-w-xl">
                    <?php if (!empty($b['badge'])): ?><span class="inline-flex items-center gap-1.5 text-xs font-semibold bg-white/20 backdrop-blur px-3 py-1.5 rounded-full mb-4"><span class="w-2 h-2 rounded-full bg-white animate-pulse"></span><?= h($b['badge']) ?></span><?php endif; ?>
                    <h1 class="text-3xl sm:text-5xl font-extrabold leading-[1.08] tracking-tight"><?= h($title) ?></h1>
                    <?php if (!empty($b['subtitle'])): ?><p class="mt-4 text-white/90 text-base sm:text-lg max-w-lg"><?= h($b['subtitle']) ?></p><?php endif; ?>
                    <?php if (!empty($b['btnText'])): ?>
                        <a href="<?= h($b['btnLink'] ?: '#produk') ?>" class="btn-pill btn-pill--white mt-6"><?= h($b['btnText']) ?><svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg></a>
                    <?php endif; ?>
                </div>
            </section>
            <?php break;

        case 'slider':
            // Hero Slider v2 (PRD §5.2, desain "split editorial"): teks di kiri,
            // visual produk miring di kanan, latar mesh terang, crossfade antar
            // slide, objek zero-gravity + parallax mouse di sekitar visual.
            $slides = array_values(array_filter($b['slides'] ?? [], fn($s) => !empty($s['image']) || !empty($s['title'])));
            if (!$slides) break;
            $floats = array_slice(array_values(array_filter(array_map('trim', preg_split('/\r?\n/', $b['floats'] ?? '')))), 0, 6);
            $floatPos = [
                'top:6%;right:34%;width:88px',  'top:14%;right:3%;width:68px',
                'bottom:18%;right:2%;width:96px', 'bottom:6%;right:38%;width:72px',
                'top:44%;right:46%;width:58px', 'bottom:40%;right:20%;width:52px',
            ];
            $eyebrow = '✦ ' . ($st['storeName'] ?? 'Percetakan') . ' — Imogiri & Sewon';
            $variant = $b['variant'] ?? 'editorial';
            if ($variant === 'studio'):
                // Varian "Studio": panel gelap biru-tinta, tipografi besar,
                // tanpa objek/ikon — elegan & tegas. Gambar slide (opsional)
                // tampil sebagai frame tipis di kanan.
                ?>
                <section class="mb-10 bleed bleed--hero">
                    <div class="hero-swiper hero3 swiper relative text-white" data-hero-swiper>
                        <div class="swiper-wrapper">
                            <?php foreach ($slides as $s): $img = $s['image'] ?? ''; ?>
                                <div class="swiper-slide !h-auto">
                                    <div class="relative p-8 sm:p-12 lg:p-16 pb-20 sm:pb-24 min-h-[480px] flex flex-col justify-center overflow-hidden <?= $img ? 'lg:pr-[46%]' : '' ?>">
                                        <span class="hero3-watermark" aria-hidden="true"><?= h(strtoupper(strtok($st['storeName'] ?? 'VOLIKO', ' '))) ?></span>
                                        <span class="hero3-kicker"><?= h($eyebrow) ?></span>
                                        <?php if (!empty($s['title'])): ?><h2 class="font-head text-3xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.05] tracking-tight mt-5 max-w-3xl"><?= hero_title_html($s['title'], $s['highlight'] ?? '') ?></h2><?php endif; ?>
                                        <?php if (!empty($s['subtitle'])): ?><p class="mt-5 text-white/65 sm:text-lg max-w-xl leading-relaxed"><?= h($s['subtitle']) ?></p><?php endif; ?>
                                        <div class="mt-8 flex flex-wrap items-center gap-3">
                                            <?php if (!empty($s['btnText'])): ?><a href="<?= h($s['btnLink'] ?: '#produk') ?>" class="btn-pill btn-pill--accent"><?= h($s['btnText']) ?><svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg></a><?php endif; ?>
                                            <?php if (!empty($s['btn2Text'])): ?><a href="<?= h($s['btn2Link'] ?: '#produk') ?>" class="btn-pill btn-pill--ghost"><?= h($s['btn2Text']) ?></a><?php endif; ?>
                                        </div>
                                        <?php if (!empty($b['statText'])): ?>
                                            <div class="mt-9 flex flex-wrap gap-3">
                                                <span class="hero3-stat">
                                                    <span class="font-head font-extrabold text-lg leading-none" data-count="<?= h($b['statText']) ?>"><?= h($b['statText']) ?></span>
                                                    <?php if (!empty($b['statSub'])): ?><span class="text-[11px] text-white/50"><?= h($b['statSub']) ?></span><?php endif; ?>
                                                </span>
                                            </div>
                                        <?php endif; ?>
                                        <?php if ($img): ?>
                                            <div class="hidden lg:block absolute right-12 xl:right-16 top-1/2 -translate-y-1/2 w-[34%]">
                                                <div class="hero3-stack">
                                                    <span class="stack-back" aria-hidden="true"></span>
                                                    <img src="<?= h($img) ?>" alt="<?= h($s['title'] ?? 'Produk') ?>" class="stack-front">
                                                    <span class="stack-chip"><svg class="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg> Produksi in-house · QC berlapis</span>
                                                </div>
                                            </div>
                                        <?php endif; ?>
                                    </div>
                                </div>
                            <?php endforeach; ?>
                        </div>
                        <?php if (count($slides) > 1): ?>
                            <div class="swiper-pagination !bottom-6 !left-2 !w-auto z-20"></div>
                            <div class="absolute bottom-5 right-5 z-20 flex gap-2">
                                <button type="button" class="hero2-arrow hero2-prev" aria-label="Slide sebelumnya"><svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.4"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg></button>
                                <button type="button" class="hero2-arrow hero2-next" aria-label="Slide berikutnya"><svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.4"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg></button>
                            </div>
                        <?php endif; ?>
                    </div>
                </section>
            <?php else: ?>
            <section class="mb-10 bleed bleed--hero" data-parallax-zone>
                <div class="hero-swiper hero2 swiper relative" data-hero-swiper>
                    <div class="swiper-wrapper">
                        <?php foreach ($slides as $i => $s): $img = $s['image'] ?? ''; ?>
                            <div class="swiper-slide !h-auto">
                                <div class="grid md:grid-cols-[1.05fr_.95fr] gap-6 md:gap-10 items-center p-7 sm:p-10 lg:p-14 pb-16 sm:pb-20 min-h-[460px]">
                                    <div class="relative z-10">
                                        <span class="hero2-chip"><?= h($eyebrow) ?></span>
                                        <?php if (!empty($s['title'])): ?><h2 class="font-head text-3xl sm:text-5xl lg:text-[3.4rem] font-extrabold leading-[1.06] tracking-tight text-slate-900 mt-4"><?= hero_title_html($s['title'], $s['highlight'] ?? '') ?></h2><?php endif; ?>
                                        <?php if (!empty($s['subtitle'])): ?><p class="mt-4 text-slate-500 sm:text-lg max-w-md leading-relaxed"><?= h($s['subtitle']) ?></p><?php endif; ?>
                                        <div class="mt-7 flex flex-wrap items-center gap-3">
                                            <?php if (!empty($s['btnText'])): ?><a href="<?= h($s['btnLink'] ?: '#produk') ?>" class="btn-pill btn-pill--dark"><?= h($s['btnText']) ?><svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg></a><?php endif; ?>
                                            <?php if (!empty($s['btn2Text'])): ?><a href="<?= h($s['btn2Link'] ?: '#produk') ?>" class="btn-pill border border-slate-300 text-slate-700 hover:border-brand hover:text-brand bg-white/70"><?= h($s['btn2Text']) ?></a><?php endif; ?>
                                        </div>
                                        <?php if (!empty($b['statText'])): ?>
                                            <div class="inline-flex items-center gap-3 mt-8 rounded-2xl bg-white/75 border border-slate-200 backdrop-blur px-4 py-3 shadow-sm">
                                                <span class="h-10 w-10 rounded-full bg-brand/10 text-brand grid place-items-center shrink-0"><svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg></span>
                                                <span>
                                                    <span class="block font-head font-extrabold text-slate-900 leading-tight" data-count="<?= h($b['statText']) ?>"><?= h($b['statText']) ?></span>
                                                    <?php if (!empty($b['statSub'])): ?><span class="block text-xs text-slate-400"><?= h($b['statSub']) ?></span><?php endif; ?>
                                                </span>
                                            </div>
                                        <?php endif; ?>
                                    </div>
                                    <div class="relative md:min-h-[320px]">
                                        <div class="hero2-blob"></div>
                                        <?php if ($img): ?>
                                            <img src="<?= h($img) ?>" alt="<?= h($s['title'] ?? 'Produk') ?>" class="hero2-img relative w-full max-w-[300px] sm:max-w-[420px] mx-auto">
                                        <?php else: ?>
                                            <div class="hero2-img relative w-full max-w-[300px] sm:max-w-[420px] mx-auto aspect-[6/5] bg-white grid place-items-center text-slate-300">
                                                <svg class="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.2"><path stroke-linecap="round" stroke-linejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659"/></svg>
                                            </div>
                                        <?php endif; ?>
                                    </div>
                                </div>
                            </div>
                        <?php endforeach; ?>
                    </div>

                    <?php foreach ($floats as $fi => $fimg): ?>
                        <div class="float-wrap hidden md:block z-[12]" style="<?= h($floatPos[$fi % count($floatPos)]) ?>">
                            <img src="<?= h($fimg) ?>" alt="" loading="lazy" class="float w-full drop-shadow-xl"
                                 style="--dur:<?= 6 + ($fi % 5) ?>s;--delay:<?= $fi * 0.7 ?>s;--amp:-<?= 14 + ($fi % 3) * 5 ?>px;--r0:<?= ($fi % 2 ? -4 : 3) ?>deg;--r1:<?= ($fi % 2 ? 5 : -4) ?>deg">
                        </div>
                    <?php endforeach; ?>

                    <?php if (count($slides) > 1): ?>
                        <div class="swiper-pagination !bottom-6 !left-2 !w-auto z-20"></div>
                        <div class="absolute bottom-5 right-5 z-20 flex gap-2">
                            <button type="button" class="hero2-arrow hero2-prev" aria-label="Slide sebelumnya"><svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.4"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg></button>
                            <button type="button" class="hero2-arrow hero2-next" aria-label="Slide berikutnya"><svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.4"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg></button>
                        </div>
                    <?php endif; ?>
                </div>
            </section>
            <?php endif;
            break;

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
            <section id="produk" class="mb-12 scroll-mt-24" data-reveal>
                <div class="flex items-center justify-between mb-4 gap-3 flex-wrap">
                    <?php if ($activeFilter && $q !== ''): ?>
                        <h2 class="font-head text-xl font-extrabold text-slate-900">Hasil pencarian "<?= h($q) ?>"</h2>
                    <?php elseif (!empty($b['title'])): ?>
                        <h2 class="font-head text-2xl sm:text-3xl font-extrabold text-slate-900"><?= h($b['title']) ?></h2>
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

        case 'produk_pilihan':
            // Bento grid produk PILIHAN (kurasi admin) — kartu besar, info lebih
            // lengkap, susunan asimetris playful. Kosong → fallback 5 produk pertama.
            $ids = array_map('strval', (array)($b['ids'] ?? []));
            $list = $ids
                ? array_values(array_filter($products, fn($p) => in_array((string)$p['id'], $ids, true)))
                : array_slice($products, 0, 5);
            // pertahankan urutan pilihan admin
            if ($ids) usort($list, fn($a, $z) => array_search((string)$a['id'], $ids) <=> array_search((string)$z['id'], $ids));
            $list = array_slice($list, 0, 7);
            if (!count($list)) break;
            // pola span bento (berulang): feature besar → kecil → tinggi → kecil → lebar
            $spans = ['bento-feature', '', 'bento-tall', '', 'bento-wide', '', ''];
            ?>
            <section class="mb-12" data-reveal>
                <div class="flex items-end justify-between mb-5 gap-3 flex-wrap">
                    <div>
                        <h2 class="font-head text-2xl sm:text-3xl font-extrabold text-slate-900"><?= h($b['title'] ?: 'Produk Pilihan') ?></h2>
                        <?php if (!empty($b['subtitle'])): ?><p class="text-slate-500 mt-1"><?= h($b['subtitle']) ?></p><?php endif; ?>
                    </div>
                    <a href="produk.php" class="text-sm font-medium text-brand hover:underline shrink-0">Lihat semua &rarr;</a>
                </div>
                <div class="bento">
                    <?php foreach ($list as $i => $p):
                        $im = product_image($p);
                        $vc = count($p['variants'] ?? []);
                        $isFeat = $i === 0;
                        $desc = trim(strip_tags((string)($p['description'] ?? '')));
                        ?>
                        <a href="product.php?id=<?= h($p['id']) ?>" class="bento-card <?= $spans[$i % count($spans)] ?>" data-reveal-item>
                            <?php if ($im): ?><img src="<?= h($im) ?>" alt="<?= h($p['name']) ?>" loading="lazy" class="bg"><?php else: ?><div class="absolute inset-0 bg-gradient-to-br from-brand/20 to-amber-100"></div><?php endif; ?>
                            <span class="veil"></span>
                            <?php if ($isFeat): ?><span class="bento-badge">✦ PILIHAN KAMI</span><?php endif; ?>
                            <span class="absolute inset-x-0 bottom-0 p-4 <?= $isFeat ? 'sm:p-6' : '' ?> z-[2]">
                                <?php if (!empty($p['category']['name'])): ?><span class="inline-block text-[10px] font-bold uppercase tracking-wider text-white/80 bg-white/15 backdrop-blur px-2 py-0.5 rounded-full mb-1.5"><?= h($p['category']['name']) ?></span><?php endif; ?>
                                <span class="block font-head font-extrabold text-white leading-snug <?= $isFeat ? 'text-xl sm:text-3xl' : 'text-sm sm:text-base line-clamp-2' ?>"><?= h($p['name']) ?></span>
                                <?php if ($isFeat && $desc): ?><span class="hidden sm:block text-white/70 text-sm mt-1.5 line-clamp-2 max-w-md"><?= h(mb_substr($desc, 0, 160)) ?></span><?php endif; ?>
                                <span class="flex items-center gap-2 mt-2 flex-wrap">
                                    <span class="inline-flex items-baseline gap-1 bg-white text-slate-900 rounded-full px-3 py-1 text-xs font-extrabold"><?= $vc > 1 ? '<span class="font-medium text-slate-400">Mulai</span> ' : '' ?><?= rupiah(product_price($p)) ?><?= product_is_area($p) ? '<span class="font-semibold text-slate-400">/m²</span>' : '' ?></span>
                                    <?php if ($vc > 1): ?><span class="text-[11px] text-white/70"><?= $vc ?> varian</span><?php endif; ?>
                                    <?php if ($isFeat): ?>
                                        <span class="ml-auto hidden sm:inline-flex items-center gap-1.5 text-white text-xs font-bold bg-brand rounded-full px-3.5 py-1.5">Pesan Sekarang <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg></span>
                                    <?php endif; ?>
                                </span>
                            </span>
                        </a>
                    <?php endforeach; ?>
                </div>
            </section>
            <?php break;

        case 'layanan_banner':
            // Banner layanan spesialis (clean glassmorph, kartu miring playful).
            // Format baris: Judul | Deskripsi | URL ikon (opsional) | Link (opsional)
            $items = parse_items($b['items'] ?? '');
            if (!$items) break;
            $tilts = ['-2deg', '1.6deg', '-1.2deg', '2deg', '-1.8deg', '1.2deg'];
            ?>
            <section class="mb-12" data-reveal>
                <div class="svc-strip relative rounded-[28px] p-6 sm:p-9 overflow-hidden">
                    <div class="flex items-end justify-between gap-3 flex-wrap mb-6">
                        <div>
                            <span class="hero2-chip">⚡ Layanan Spesialis</span>
                            <h2 class="font-head text-2xl sm:text-3xl font-extrabold text-slate-900 mt-3"><?= h($b['title'] ?: 'Mesin Lengkap, Hasil Maksimal') ?></h2>
                            <?php if (!empty($b['subtitle'])): ?><p class="text-slate-500 mt-1 max-w-lg"><?= h($b['subtitle']) ?></p><?php endif; ?>
                        </div>
                    </div>
                    <div class="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-3 -mx-1 px-1 lg:grid lg:overflow-visible lg:pb-0" style="<?= count($items) >= 4 ? 'grid-template-columns:repeat(' . min(count($items), 5) . ',1fr)' : 'grid-template-columns:repeat(3,1fr)' ?>">
                        <?php foreach ($items as $i => $it): $link = trim($it[3] ?? '') ?: 'produk.php'; ?>
                            <a href="<?= h($link) ?>" class="svc-card glass snap-start" style="--tilt:<?= $tilts[$i % count($tilts)] ?>" data-reveal-item>
                                <span class="svc-ico">
                                    <?php if (!empty($it[2])): ?>
                                        <img src="<?= h($it[2]) ?>" alt="" loading="lazy" style="--dur:<?= 5 + ($i % 3) ?>s;--delay:<?= $i * 0.4 ?>s">
                                    <?php else: ?>
                                        <span class="svc-num">0<?= $i + 1 ?></span>
                                    <?php endif; ?>
                                </span>
                                <span class="font-head font-extrabold text-slate-900 text-[15px] leading-tight"><?= h($it[0]) ?></span>
                                <?php if (!empty($it[1])): ?><span class="text-xs text-slate-500 leading-relaxed"><?= h($it[1]) ?></span><?php endif; ?>
                                <span class="svc-arrow mt-auto inline-flex items-center gap-1 text-xs font-bold text-slate-700 pt-1.5">Selengkapnya <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg></span>
                            </a>
                        <?php endforeach; ?>
                    </div>
                </div>
            </section>
            <?php break;

        case 'kategori':
            // Bar kategori ala "Printing Partner" (PRD §5.3): kartu ikon, hover aksen
            if (!count($cats)) break;
            $catIcons = [
                ['stiker|label', 'M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z'],
                ['banner|outdoor|spanduk|baliho', 'M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3'],
                ['dokumen|print|kertas|buku|fotokopi', 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z'],
                ['merchandise|souvenir|mug|kaos|jersey', 'M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z'],
                ['akrilik|laser|medali|plakat', 'M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0'],
                ['desain|design|kreatif', 'M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42'],
            ];
            $iconFor = function (string $name) use ($catIcons): string {
                foreach ($catIcons as [$kw, $path]) {
                    if (preg_match('/' . $kw . '/i', $name)) return $path;
                }
                return 'M2.25 7.125C2.25 6.504 2.754 6 3.375 6h6c.621 0 1.125.504 1.125 1.125v3.75c0 .621-.504 1.125-1.125 1.125h-6a1.125 1.125 0 01-1.125-1.125v-3.75zM14.25 8.625c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v8.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-8.25zM3.75 16.125c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-2.25z';
            };
            ?>
            <section class="mb-12" data-reveal>
                <?php if (!empty($b['title'])): ?><h2 class="font-head text-2xl sm:text-3xl font-extrabold text-slate-900 mb-5"><?= h($b['title']) ?></h2><?php endif; ?>
                <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <?php foreach ($cats as $id => $name): ?>
                        <a href="produk.php?cat=<?= h($id) ?>" class="cat-card p-4 flex flex-col items-start gap-3" data-reveal-item>
                            <span class="cat-ico h-11 w-11 rounded-xl bg-brand/10 text-brand grid place-items-center">
                                <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="<?= $iconFor($name) ?>"/></svg>
                            </span>
                            <span class="text-sm font-bold text-slate-800 leading-snug"><?= h($name) ?></span>
                        </a>
                    <?php endforeach; ?>
                </div>
            </section>
            <?php break;

        case 'video':
            // Section video/foto tim (PRD §5.4) — play button glassmorph → modal YouTube
            $img = $b['image'] ?? '';
            $yt  = trim($b['youtube'] ?? '');
            // terima URL penuh atau ID
            if ($yt && preg_match('~(?:youtu\.be/|v=|embed/)([A-Za-z0-9_-]{6,})~', $yt, $m)) $yt = $m[1];
            if ($img === '') {
                if (is_admin()): ?>
                    <section class="mb-12 rounded-[28px] border-2 border-dashed border-slate-300 p-10 text-center">
                        <p class="font-bold text-slate-500"><?= h($b['title'] ?: 'Video / Foto Tim') ?></p>
                        <p class="text-sm text-slate-400 mt-1">Belum ada foto — unggah lewat Dashboard &rarr; Tampilan. (Hanya terlihat admin.)</p>
                    </section>
                <?php endif;
                break;
            } ?>
            <section class="mb-12" data-reveal>
                <div class="relative rounded-[28px] overflow-hidden shadow-lg">
                    <img src="<?= h($img) ?>" alt="<?= h($b['title'] ?? 'Tim produksi') ?>" loading="lazy" class="w-full aspect-[21/9] sm:aspect-[21/8] object-cover">
                    <div class="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent"></div>
                    <?php if ($yt): ?>
                        <button type="button" data-video-open="<?= h($yt) ?>" class="play-btn absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" aria-label="Putar video">
                            <svg class="w-9 h-9 translate-x-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5.14v13.72c0 .78.85 1.26 1.52.85l10.6-6.86a1 1 0 000-1.7L9.52 4.29A1 1 0 008 5.14z"/></svg>
                        </button>
                    <?php endif; ?>
                    <?php if (!empty($b['title'])): ?>
                        <div class="absolute bottom-5 left-6 right-6">
                            <h2 class="font-head text-white text-xl sm:text-3xl font-extrabold drop-shadow"><?= h($b['title']) ?></h2>
                        </div>
                    <?php endif; ?>
                </div>
            </section>
            <?php break;

        case 'artikel':
            // Layout blog ala hue (PRD §5.10): 2 kartu besar + sisanya baris kecil
            $limit = max(1, (int)($b['limit'] ?? 6));
            $arts = [];
            try { $arts = db()->query("SELECT title, slug, excerpt, cover_url FROM articles WHERE status='PUBLISHED' ORDER BY COALESCE(published_at, created_at) DESC LIMIT " . $limit)->fetchAll(); } catch (Throwable $e) {}
            if (!count($arts)) break;
            $big = array_slice($arts, 0, 2);
            $rest = array_slice($arts, 2); ?>
            <section class="mb-12" data-reveal>
                <div class="flex items-center justify-between mb-5">
                    <?php if (!empty($b['title'])): ?><h2 class="font-head text-2xl sm:text-3xl font-extrabold text-slate-900"><?= h($b['title']) ?></h2><?php endif; ?>
                    <a href="artikel.php" class="text-sm font-medium text-brand hover:underline">Semua artikel &rarr;</a>
                </div>
                <div class="grid lg:grid-cols-2 gap-5">
                    <div class="grid sm:grid-cols-2 lg:grid-cols-1 <?= count($big) > 1 ? 'lg:grid-rows-1 lg:grid-cols-2' : '' ?> gap-5">
                        <?php foreach ($big as $a): ?>
                            <a href="artikel.php?slug=<?= h($a['slug']) ?>" class="group bg-white rounded-[22px] border border-slate-200 overflow-hidden hover:shadow-xl hover:shadow-slate-200/80 hover:-translate-y-1 transition-all flex flex-col" data-reveal-item>
                                <div class="aspect-[16/10] bg-slate-100 overflow-hidden">
                                    <?php if (!empty($a['cover_url'])): ?><img src="<?= h($a['cover_url']) ?>" alt="" loading="lazy" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"><?php endif; ?>
                                </div>
                                <div class="p-5">
                                    <h3 class="font-head font-bold text-slate-900 leading-snug line-clamp-2 group-hover:text-brand transition-colors"><?= h($a['title']) ?></h3>
                                    <?php if (!empty($a['excerpt'])): ?><p class="mt-2 text-sm text-slate-500 line-clamp-2"><?= h($a['excerpt']) ?></p><?php endif; ?>
                                </div>
                            </a>
                        <?php endforeach; ?>
                    </div>
                    <?php if ($rest): ?>
                        <div class="flex flex-col gap-3">
                            <?php foreach ($rest as $a): ?>
                                <a href="artikel.php?slug=<?= h($a['slug']) ?>" class="group flex items-center gap-4 bg-white rounded-2xl border border-slate-200 p-3 hover:border-brand/40 hover:shadow-md transition-all" data-reveal-item>
                                    <div class="w-24 h-20 rounded-xl bg-slate-100 overflow-hidden shrink-0">
                                        <?php if (!empty($a['cover_url'])): ?><img src="<?= h($a['cover_url']) ?>" alt="" loading="lazy" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"><?php endif; ?>
                                    </div>
                                    <div class="min-w-0">
                                        <h3 class="font-semibold text-slate-800 text-sm leading-snug line-clamp-2 group-hover:text-brand transition-colors"><?= h($a['title']) ?></h3>
                                        <?php if (!empty($a['excerpt'])): ?><p class="mt-1 text-xs text-slate-400 line-clamp-1"><?= h($a['excerpt']) ?></p><?php endif; ?>
                                    </div>
                                    <svg class="w-4 h-4 text-slate-300 group-hover:text-brand ml-auto shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
                                </a>
                            <?php endforeach; ?>
                        </div>
                    <?php endif; ?>
                </div>
            </section>
            <?php break;

        case 'tentang':
            $img = $b['image'] ?? '';
            $items = parse_items($b['list'] ?? '');
            $dark = !empty($b['dark']);
            if ($dark):
                // Section gelap "Tentang" (PRD §5.5) + badge sirkular berputar
                $badgeText = trim($b['badgeText'] ?? '') ?: 'SELENGKAPNYA ✦ TENTANG KAMI ✦';
                $badgeLink = $b['badgeLink'] ?? 'profil.php'; ?>
                <section class="mb-12 relative overflow-hidden rounded-[28px] text-white p-8 sm:p-14 bleed bleed--pad" style="background:#0E0E10" data-reveal>
                    <div class="absolute -top-24 -right-16 w-80 h-80 rounded-full bg-brand/20 blur-3xl"></div>
                    <div class="relative grid md:grid-cols-[1fr_auto] gap-8 items-center">
                        <div>
                            <span class="inline-block text-xs font-bold tracking-widest text-brand uppercase mb-4">Tentang Kami</span>
                            <?php if (!empty($b['title'])): ?><h2 class="font-head text-2xl sm:text-4xl font-extrabold leading-[1.15] max-w-2xl"><?= h($b['title']) ?></h2><?php endif; ?>
                            <?php if (!empty($b['text'])): ?><div class="mt-4 text-white/70 max-w-xl leading-relaxed"><?= $b['text'] ?></div><?php endif; ?>
                            <?php if ($items): ?>
                                <ul class="mt-6 space-y-2.5">
                                    <?php foreach ($items as $it): ?>
                                        <li class="flex items-start gap-2.5 text-white/85"><svg class="w-5 h-5 text-brand mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg><span><?= h($it[0]) ?></span></li>
                                    <?php endforeach; ?>
                                </ul>
                            <?php endif; ?>
                        </div>
                        <a href="<?= h($badgeLink) ?>" class="relative h-32 w-32 sm:h-40 sm:w-40 shrink-0 grid place-items-center justify-self-center md:justify-self-end group" aria-label="Selengkapnya tentang kami">
                            <svg viewBox="0 0 100 100" class="rotating-badge absolute inset-0 w-full h-full">
                                <defs><path id="circ" d="M 50,50 m -38,0 a 38,38 0 1,1 76,0 a 38,38 0 1,1 -76,0"/></defs>
                                <text class="fill-white/80" style="font-size:8.5px;letter-spacing:2.2px;font-weight:700">
                                    <textPath href="#circ"><?= h($badgeText) ?></textPath>
                                </text>
                            </svg>
                            <span class="h-12 w-12 rounded-full bg-brand text-white grid place-items-center group-hover:scale-110 transition-transform">
                                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 17L17 7M17 7H8m9 0v9"/></svg>
                            </span>
                        </a>
                    </div>
                </section>
            <?php else: ?>
                <section class="mb-12" data-reveal>
                    <div class="grid md:grid-cols-2 gap-8 items-center">
                        <?php if ($img): ?><img src="<?= h($img) ?>" alt="" loading="lazy" class="w-full rounded-[24px] aspect-[4/3] object-cover shadow-sm" data-reveal-item><?php endif; ?>
                        <div class="<?= $img ? '' : 'md:col-span-2 max-w-2xl mx-auto text-center' ?>" data-reveal-item>
                            <span class="inline-block text-xs font-semibold text-brand bg-brand/10 px-3 py-1 rounded-full mb-3">Tentang Kami</span>
                            <?php if (!empty($b['title'])): ?><h2 class="font-head text-2xl sm:text-3xl font-extrabold text-slate-900 leading-tight"><?= h($b['title']) ?></h2><?php endif; ?>
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
            <?php endif;
            break;

        case 'order':
            // Form Order Last-Minute (PRD §5.6) — lead magnet utama.
            // Submit → lead.php → POST /orders/public PosPro → Lead WEBSITE di CRM.
            $img = $b['image'] ?? '';
            $branches = array_values(array_filter(array_map('trim', preg_split('/\r?\n/', $b['branches'] ?? ''))));
            $waNum = preg_replace('/^0/', '62', preg_replace('/\D/', '', ($b['whatsapp'] ?? '') ?: ($st['storePhone'] ?? '')));
            $sentOk  = ($_GET['lead'] ?? '') === 'ok';
            $sentErr = ($_GET['lead'] ?? '') === 'err';
            $waText  = rawurlencode('Halo! Saya baru saja mengisi form order di website. Nama saya ' . ($_GET['n'] ?? '') . ', mohon dibantu ya.');
            ?>
            <section id="order-cepat" class="mb-12 scroll-mt-24" data-reveal>
                <div class="grid md:grid-cols-2 rounded-[28px] overflow-hidden shadow-xl">
                    <div class="relative bg-brand p-8 sm:p-12 text-white flex flex-col justify-end min-h-[280px]">
                        <?php if ($img): ?>
                            <img src="<?= h($img) ?>" alt="" loading="lazy" class="absolute inset-0 w-full h-full object-cover">
                            <div class="absolute inset-0 bg-gradient-to-t from-brand via-brand/40 to-transparent"></div>
                        <?php else: ?>
                            <div class="absolute -top-16 -right-10 w-64 h-64 rounded-full bg-white/15 blur-2xl"></div>
                        <?php endif; ?>
                        <div class="relative">
                            <h2 class="font-head text-2xl sm:text-4xl font-extrabold leading-tight"><?= h($b['title'] ?: 'Order Mepet Deadline?') ?></h2>
                            <?php if (!empty($b['subtitle'])): ?><p class="mt-3 text-white/85 max-w-md"><?= h($b['subtitle']) ?></p><?php endif; ?>
                        </div>
                    </div>
                    <div class="bg-white/70 backdrop-blur-xl p-6 sm:p-10 border-l border-white/40">
                        <?php if ($sentOk): ?>
                            <div class="h-full flex flex-col items-center justify-center text-center py-8">
                                <span class="h-14 w-14 rounded-full bg-emerald-100 text-emerald-600 grid place-items-center mb-4"><svg class="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg></span>
                                <h3 class="font-head text-xl font-extrabold text-slate-900">Pesananmu sudah masuk!</h3>
                                <p class="mt-2 text-sm text-slate-500 max-w-xs">Tim kami akan segera menghubungimu. Mau lebih cepat? Lanjut chat sekarang.</p>
                                <?php if ($waNum): ?><a href="https://wa.me/<?= h($waNum) ?>?text=<?= $waText ?>" target="_blank" rel="noopener" class="btn-pill btn-pill--accent mt-5 text-sm">Lanjut chat WA</a><?php endif; ?>
                            </div>
                        <?php else: ?>
                            <?php if ($sentErr): ?><div class="mb-4 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">Gagal mengirim — coba lagi atau langsung chat WA kami.</div><?php endif; ?>
                            <form method="post" action="lead.php" class="space-y-3.5">
                                <input type="hidden" name="back" value="<?= h(($_SERVER['PHP_SELF'] ?? 'index.php')) ?>">
                                <!-- honeypot anti-spam: dibiarkan kosong oleh manusia -->
                                <input type="text" name="website" value="" tabindex="-1" autocomplete="off" class="hidden" aria-hidden="true">
                                <div>
                                    <label class="text-xs font-bold text-slate-600 uppercase tracking-wide">Nama</label>
                                    <input type="text" name="name" required class="mt-1 w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white/80 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand" placeholder="Nama kamu">
                                </div>
                                <div>
                                    <label class="text-xs font-bold text-slate-600 uppercase tracking-wide">No. HP / WhatsApp</label>
                                    <input type="tel" name="phone" required class="mt-1 w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white/80 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand" placeholder="08xxxxxxxxxx">
                                </div>
                                <div>
                                    <label class="text-xs font-bold text-slate-600 uppercase tracking-wide">Kebutuhan</label>
                                    <textarea name="note" rows="3" required class="mt-1 w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white/80 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand" placeholder="Mis. banner 3x1 m, butuh besok pagi"></textarea>
                                </div>
                                <?php if (count($branches) > 1): ?>
                                    <div>
                                        <label class="text-xs font-bold text-slate-600 uppercase tracking-wide">Ambil / kirim dari cabang</label>
                                        <select name="branch" class="mt-1 w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white/80 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40">
                                            <?php foreach ($branches as $br): ?><option value="<?= h($br) ?>"><?= h($br) ?></option><?php endforeach; ?>
                                        </select>
                                    </div>
                                <?php elseif ($branches): ?>
                                    <input type="hidden" name="branch" value="<?= h($branches[0]) ?>">
                                <?php endif; ?>
                                <button type="submit" class="btn-pill btn-pill--accent w-full justify-center text-sm">
                                    Kirim & Minta Penawaran
                                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
                                </button>
                                <p class="text-[11px] text-slate-400 text-center">Tanpa biaya — tim kami balas secepatnya di jam kerja.</p>
                            </form>
                        <?php endif; ?>
                    </div>
                </div>
            </section>
            <?php break;

        case 'klien':
            // Marquee logo klien 2 baris berlawanan arah, sedikit miring (PRD §5.8)
            $items = parse_items($b['items'] ?? '');
            if (!$items) {
                if (is_admin()): ?>
                    <section class="mb-12 rounded-[28px] border-2 border-dashed border-slate-300 p-8 text-center">
                        <p class="font-bold text-slate-500"><?= h($b['title'] ?: 'Logo Klien') ?></p>
                        <p class="text-sm text-slate-400 mt-1">Isi daftar klien lewat Dashboard &rarr; Tampilan (format: <code>Nama | URL logo</code>, logo opsional). (Hanya terlihat admin.)</p>
                    </section>
                <?php endif;
                break;
            }
            // Judul kosong → mode TICKER: satu baris tipografis tipis (strip keyword),
            // bukan kartu logo. Cocok ditaruh tepat di bawah hero.
            if (trim($b['title'] ?? '') === '') {
                $tick = function (array $it): string {
                    $name = trim(rtrim($it[0] ?? '', "✦ \t"));
                    return '<span class="ticker-item">' . h($name) . '<span class="tick">✦</span></span>';
                };
                $rowHtml = implode('', array_map($tick, $items));
                ?>
                <section class="mb-12 ticker bleed" data-reveal>
                    <div class="marquee"><div class="marquee__track marquee__track--l" style="gap:1.5rem"><?= $rowHtml . $rowHtml ?></div></div>
                </section>
                <?php break;
            }
            $chip = function (array $it): string {
                $name = $it[0] ?? ''; $logo = $it[1] ?? '';
                $inner = $logo
                    ? '<img src="' . h($logo) . '" alt="' . h($name) . '" loading="lazy" class="h-8 sm:h-10 w-auto object-contain">'
                    : '<span class="font-head font-bold text-slate-500 whitespace-nowrap">' . h($name) . '</span>';
                return '<div class="flex items-center justify-center px-7 py-4 bg-white rounded-2xl border border-slate-200 shrink-0">' . $inner . '</div>';
            };
            $rowHtml = implode('', array_map($chip, $items));
            ?>
            <section class="mb-14 overflow-hidden" data-reveal>
                <?php if (!empty($b['title'])): ?><h2 class="font-head text-xl font-extrabold text-slate-400 text-center uppercase tracking-widest mb-7"><?= h($b['title']) ?></h2><?php endif; ?>
                <div class="space-y-4 bleed">
                    <div class="marquee marquee--tiltl"><div class="marquee__track marquee__track--l"><?= $rowHtml . $rowHtml ?></div></div>
                    <?php if (count($items) > 2): ?>
                        <div class="marquee marquee--tiltr"><div class="marquee__track marquee__track--r"><?= $rowHtml . $rowHtml ?></div></div>
                    <?php endif; ?>
                </div>
            </section>
            <?php break;

        case 'fitur':
            $items = parse_items($b['items'] ?? '');
            if (!$items) break; ?>
            <section class="mb-12" data-reveal>
                <?php if (!empty($b['title'])): ?><h2 class="font-head text-2xl sm:text-3xl font-extrabold text-slate-900 text-center mb-2"><?= h($b['title']) ?></h2><?php endif; ?>
                <?php if (!empty($b['subtitle'])): ?><p class="text-slate-500 text-center mb-8 max-w-xl mx-auto"><?= h($b['subtitle']) ?></p><?php else: ?><div class="mb-8"></div><?php endif; ?>
                <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    <?php foreach ($items as $it): ?>
                        <div class="bg-white rounded-[20px] border border-slate-200 p-6 hover:shadow-lg hover:shadow-slate-200/70 hover:-translate-y-0.5 transition-all" data-reveal-item>
                            <div class="h-11 w-11 rounded-xl bg-brand/10 text-brand grid place-items-center mb-4"><svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg></div>
                            <h3 class="font-head font-bold text-slate-900"><?= h($it[0]) ?></h3>
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
            <section class="mb-12 rounded-[28px] text-white p-8 sm:p-12 relative overflow-hidden bleed bleed--pad" style="background:#0E0E10" data-reveal>
                <div class="absolute -top-20 -left-16 w-72 h-72 rounded-full bg-brand/15 blur-3xl"></div>
                <div class="relative grid grid-cols-2 <?= $gcls ?> gap-7 text-center">
                    <?php foreach ($items as $it): ?>
                        <div data-reveal-item>
                            <div class="font-head text-3xl sm:text-5xl font-extrabold text-brand" data-count="<?= h($it[0]) ?>"><?= h($it[0]) ?></div>
                            <div class="mt-1.5 text-sm text-white/60"><?= h($it[1] ?? '') ?></div>
                        </div>
                    <?php endforeach; ?>
                </div>
            </section>
            <?php break;

        case 'testimoni':
            // Section gelap, foto oval + nama + jabatan + kutipan (PRD §5.9)
            // Format baris: Kutipan | Nama | Peran | URL foto (opsional)
            $items = parse_items($b['items'] ?? '');
            if (!$items) break;
            $tc = count($items); $tcls = $tc >= 4 ? 'lg:grid-cols-4' : ($tc === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'); ?>
            <section class="mb-12 rounded-[28px] text-white p-8 sm:p-12 relative overflow-hidden bleed bleed--pad" style="background:#0E0E10" data-reveal>
                <div class="absolute -bottom-24 -right-16 w-80 h-80 rounded-full bg-brand/15 blur-3xl"></div>
                <?php if (!empty($b['title'])): ?><h2 class="relative font-head text-2xl sm:text-3xl font-extrabold text-center mb-10"><?= h($b['title']) ?></h2><?php endif; ?>
                <div class="relative grid sm:grid-cols-2 <?= $tcls ?> gap-5">
                    <?php foreach ($items as $it): $photo = trim($it[3] ?? ''); ?>
                        <div class="rounded-[20px] bg-white/[.06] border border-white/10 p-6 flex flex-col" data-reveal-item>
                            <svg class="w-7 h-7 text-brand/70 mb-3" fill="currentColor" viewBox="0 0 24 24"><path d="M7.17 6A5.17 5.17 0 002 11.17V18h6.83v-6.83H5.5A1.5 1.5 0 017 9.5V6zM18.17 6A5.17 5.17 0 0013 11.17V18h6.83v-6.83H16.5a1.5 1.5 0 011.5-1.67V6z"/></svg>
                            <p class="text-white/80 text-sm leading-relaxed flex-1">"<?= h($it[0]) ?>"</p>
                            <div class="mt-5 flex items-center gap-3">
                                <?php if ($photo): ?>
                                    <img src="<?= h($photo) ?>" alt="<?= h($it[1] ?? '') ?>" loading="lazy" class="testi-photo shrink-0">
                                <?php else: ?>
                                    <span class="h-11 w-11 rounded-full bg-brand/20 text-brand grid place-items-center font-bold shrink-0"><?= h(strtoupper(mb_substr($it[1] ?? 'A', 0, 1))) ?></span>
                                <?php endif; ?>
                                <div><div class="font-semibold text-white text-sm"><?= h($it[1] ?? '') ?></div><?php if (!empty($it[2])): ?><div class="text-xs text-white/50"><?= h($it[2]) ?></div><?php endif; ?></div>
                            </div>
                        </div>
                    <?php endforeach; ?>
                </div>
            </section>
            <?php break;

        case 'faq':
            $items = parse_items($b['items'] ?? '');
            if (!$items) break; ?>
            <section class="mb-12 max-w-3xl mx-auto" data-reveal>
                <?php if (!empty($b['title'])): ?><h2 class="font-head text-2xl sm:text-3xl font-extrabold text-slate-900 text-center mb-8"><?= h($b['title']) ?></h2><?php endif; ?>
                <div class="space-y-3">
                    <?php foreach ($items as $it): ?>
                        <details class="group bg-white rounded-[18px] border border-slate-200 p-5 open:shadow-md transition-shadow" data-reveal-item>
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
                    <section class="mb-12 rounded-[28px] border-2 border-dashed border-slate-300 p-10 text-center">
                        <p class="font-bold text-slate-500"><?= h($b['title'] ?: 'Portofolio / Galeri') ?></p>
                        <p class="text-sm text-slate-400 mt-1">Belum ada foto karya — tambahkan lewat Dashboard &rarr; Tampilan. <span class="block mt-0.5">(Pesan ini hanya terlihat oleh admin.)</span></p>
                    </section>
                <?php endif;
                break;
            }
            $gid = 'pf' . substr(md5(json_encode($items)), 0, 6);
            ?>
            <section class="mb-12 scroll-mt-24" id="<?= $gid ?>" data-reveal>
                <?php if (!empty($b['title'])): ?><h2 class="font-head text-2xl sm:text-3xl font-extrabold text-slate-900 text-center mb-2"><?= h($b['title']) ?></h2><?php endif; ?>
                <?php if (!empty($b['subtitle'])): ?><p class="text-slate-500 text-center mb-8 max-w-xl mx-auto"><?= h($b['subtitle']) ?></p><?php else: ?><div class="mb-8"></div><?php endif; ?>
                <div class="columns-2 md:columns-3 lg:columns-4 gap-3 sm:gap-4 [&>*]:mb-3 sm:[&>*]:mb-4">
                    <?php foreach ($items as $i => $it): ?>
                        <button type="button" data-pf="<?= $i ?>" class="card-in group relative w-full rounded-2xl overflow-hidden bg-slate-100 text-left cursor-zoom-in break-inside-avoid" style="animation-delay:<?= ($i % 8) * 60 ?>ms">
                            <img src="<?= h($it['image']) ?>" alt="<?= h($it['title'] ?? 'Karya') ?>" loading="lazy" class="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-500">
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
            <section id="kontak" class="mb-12 scroll-mt-24" data-reveal>
                <?php if (!empty($b['title'])): ?><h2 class="font-head text-2xl sm:text-3xl font-extrabold text-slate-900 text-center mb-8"><?= h($b['title']) ?></h2><?php endif; ?>
                <div class="grid md:grid-cols-2 gap-6 items-stretch">
                    <div class="bg-white rounded-[24px] border border-slate-200 p-6 space-y-4" data-reveal-item>
                        <?php if (!empty($b['address'])): ?><div class="flex items-start gap-3"><svg class="w-5 h-5 text-brand mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><circle cx="12" cy="11" r="3"/></svg><span class="text-slate-600 text-sm whitespace-pre-line"><?= h($b['address']) ?></span></div><?php endif; ?>
                        <?php if (!empty($b['phone'])): ?><div class="flex items-center gap-3"><svg class="w-5 h-5 text-brand shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11 11 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg><a href="tel:<?= h($b['phone']) ?>" class="text-slate-600 text-sm hover:text-brand"><?= h($b['phone']) ?></a></div><?php endif; ?>
                        <?php if (!empty($b['email'])): ?><div class="flex items-center gap-3"><svg class="w-5 h-5 text-brand shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg><a href="mailto:<?= h($b['email']) ?>" class="text-slate-600 text-sm hover:text-brand"><?= h($b['email']) ?></a></div><?php endif; ?>
                        <?php if ($wa): ?><a href="https://wa.me/<?= h($wa) ?>" target="_blank" class="btn-pill btn-pill--accent !py-2.5 text-sm mt-2">Chat WhatsApp</a><?php endif; ?>
                    </div>
                    <?php $mu = maps_embed_src($b['mapsEmbed'] ?? ''); if ($mu !== ''): ?>
                        <div class="rounded-[24px] overflow-hidden border border-slate-200 min-h-[260px]" data-reveal-item><iframe src="<?= h($mu) ?>" class="w-full h-full min-h-[260px]" style="border:0" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div>
                    <?php endif; ?>
                </div>
            </section>
            <?php break;

        case 'banner':
            if (empty($b['image'])) break; ?>
            <section class="mb-10" data-reveal>
                <?php $bn = '<img src="' . h($b['image']) . '" loading="lazy" class="w-full rounded-[24px]">'; ?>
                <?php if (!empty($b['link'])): ?><a href="<?= h($b['link']) ?>" target="_blank"><?= $bn ?></a><?php else: ?><?= $bn ?><?php endif; ?>
            </section>
            <?php break;

        case 'teks': ?>
            <section class="mb-10 bg-white rounded-[24px] border border-slate-200 p-6 sm:p-8" data-reveal>
                <?php if (!empty($b['title'])): ?><h2 class="font-head text-2xl font-extrabold text-slate-900 mb-3"><?= h($b['title']) ?></h2><?php endif; ?>
                <div class="prose-toko text-slate-600 leading-relaxed"><?= $b['html'] ?? '' ?></div>
            </section>
            <?php break;

        case 'cta': ?>
            <section class="mb-12 relative overflow-hidden rounded-[28px] text-white p-10 sm:p-14 text-center" style="background:#0E0E10" data-reveal>
                <div class="absolute -top-16 -left-10 w-64 h-64 rounded-full bg-brand/30 blur-3xl"></div>
                <div class="absolute -bottom-20 -right-10 w-72 h-72 rounded-full bg-[#2FA1DA]/20 blur-3xl"></div>
                <div class="relative">
                    <?php if (!empty($b['title'])): ?><h2 class="font-head text-2xl sm:text-4xl font-extrabold"><?= h($b['title']) ?></h2><?php endif; ?>
                    <?php if (!empty($b['subtitle'])): ?><p class="mt-3 text-white/70 max-w-xl mx-auto"><?= h($b['subtitle']) ?></p><?php endif; ?>
                    <?php if (!empty($b['btnText'])): ?>
                        <a href="<?= h($b['btnLink'] ?: '#') ?>" class="cta-btn group inline-flex items-center gap-2 mt-7 px-8 py-4 rounded-full bg-gradient-to-r from-brand via-[#4FB3E3] to-brand text-white font-bold text-lg shadow-xl shadow-brand/30 hover:scale-[1.05] active:scale-95 transition">
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
                <div class="relative bg-white rounded-[24px] max-w-md w-full overflow-hidden shadow-2xl animate-[pop_.25s_ease]">
                    <button type="button" data-close class="absolute top-3 right-3 h-9 w-9 grid place-items-center rounded-full bg-black/40 text-white hover:bg-black/60 z-10"><svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></button>
                    <?php if ($img): $imgTag = '<img src="' . h($img) . '" class="w-full">'; ?>
                        <?php if (!empty($b['link'])): ?><a href="<?= h($b['link']) ?>" target="_blank"><?= $imgTag ?></a><?php else: ?><?= $imgTag ?><?php endif; ?>
                    <?php endif; ?>
                    <?php if (!empty($b['title']) || !empty($b['text']) || !empty($b['btnText'])): ?>
                        <div class="p-6 text-center">
                            <?php if (!empty($b['title'])): ?><h3 class="font-head text-lg font-extrabold text-slate-900"><?= h($b['title']) ?></h3><?php endif; ?>
                            <?php if (!empty($b['text'])): ?><p class="mt-1.5 text-sm text-slate-500"><?= h($b['text']) ?></p><?php endif; ?>
                            <?php if (!empty($b['btnText'])): ?><a href="<?= h($b['btnLink'] ?: '#') ?>" class="btn-pill btn-pill--accent !py-2.5 text-sm mt-4"><?= h($b['btnText']) ?></a><?php endif; ?>
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
