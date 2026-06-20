<?php
// ── Content store: isi tiap section website (pengganti sistem blok) ─────────
// Layout/desain tetap (hand-crafted di sections.php); admin hanya mengganti ISI
// lewat Dashboard → Konten. Tiap section disimpan sebagai JSON di settings
// dengan key 'content_<section>'. Field yang tidak diisi memakai default.
require_once __DIR__ . '/lib.php';

/** Default isi semua section (copy korporat formal — tanpa emoji). */
function content_defaults(): array {
    return [
        'hero' => [
            'enabled' => true,
            'kicker'  => 'Percetakan Digital — Imogiri & Sewon, Bantul',
            'stats'   => "1.600+ | Pesanan Selesai (60 Hari)\n900+ | Klien Aktif\n4.9/5 | Penilaian Klien",
            'slides'  => [
                ['image' => 'uploads/hero-slide-1.jpg', 'title' => 'Mitra Produksi Cetak untuk Bisnis Anda', 'accent' => 'Produksi Cetak', 'subtitle' => 'Voliko Print menangani kebutuhan cetak perusahaan, instansi, dan brand — dari materi promosi hingga merchandise — dengan alur produksi in-house yang terukur.', 'btn1Text' => 'Konsultasikan Kebutuhan', 'btn1Link' => '#order-cepat', 'btn2Text' => 'Lihat Portofolio', 'btn2Link' => 'portofolio.php'],
                ['image' => 'uploads/hero-slide-2.jpg', 'title' => 'Presisi Warna. Ketepatan Waktu. Setiap Pesanan.', 'accent' => 'Presisi', 'subtitle' => 'Standar kerja yang kami pegang di setiap lini produksi: reproduksi warna akurat, finishing rapi, dan serah terima sesuai jadwal yang disepakati.', 'btn1Text' => 'Jelajahi Layanan', 'btn1Link' => '#layanan', 'btn2Text' => '', 'btn2Link' => ''],
                ['image' => 'uploads/hero-slide-3.jpg', 'title' => 'Satu Tim untuk Seluruh Materi Cetak Anda', 'accent' => 'Satu Tim', 'subtitle' => 'Banner, stiker meteran, UV roll, DTF, hingga cutting laser — dikerjakan satu tim dengan satu standar kualitas, untuk kebutuhan rutin maupun proyek besar.', 'btn1Text' => 'Hubungi Kami', 'btn1Link' => '#order-cepat', 'btn2Text' => 'Katalog Produk', 'btn2Link' => 'produk.php'],
            ],
        ],
        'ticker' => [
            'enabled' => true,
            'items'   => "CETAK BANNER\nSTIKER METERAN\nCETAK UV ROLL\nPRINT DTF\nCUTTING LASER\nMERCHANDISE\nDESAIN GRAFIS",
        ],
        'layanan' => [
            'enabled'  => true,
            'kicker'   => 'Lini Layanan',
            'title'    => 'Lima Lini Produksi Inti',
            'subtitle' => 'Seluruh proses dikerjakan in-house — kualitas terkontrol dari file masuk hingga serah terima.',
            'items'    => "Cetak Bahan Banner | Flexi & albatros untuk kebutuhan indoor-outdoor, ukuran fleksibel | produk.php | uploads/svc-1.jpg\nCetak Stiker Meteran | Vinyl, chromo & transparan, dipotong sesuai kebutuhan | produk.php | uploads/svc-2.jpg\nCutting Laser | Akrilik, kayu & souvenir custom berpresisi tinggi | produk.php | uploads/svc-3.jpg\nCetak UV Roll | Tinta UV tahan cuaca dengan reproduksi warna akurat | produk.php | uploads/svc-4.jpg\nPrint DTF | Sablon kaos satuan dengan gradasi warna penuh | produk.php | uploads/svc-5.jpg",
        ],
        'tentang' => [
            'enabled'   => true,
            'badgeText' => 'PROFIL PERUSAHAAN ✦ VOLIKO PRINT ✦',
            'badgeLink' => 'profil.php',
            'kicker'    => 'Tentang Kami',
            'title'     => 'Kualitas yang Konsisten Lahir dari Proses yang Disiplin.',
            'text'      => 'Voliko Print dibangun di atas satu keyakinan: materi cetak yang baik adalah hasil dari proses yang terkontrol. Setiap pesanan melewati alur yang sama — pemeriksaan file, antrean produksi terjadwal, kontrol kualitas sebelum serah terima — sehingga hasil yang Anda terima hari ini sama baiknya dengan pesanan berikutnya.',
            'list'      => "Melayani korporat, instansi & brand\nProduksi in-house di dua fasilitas\nKontrol kualitas pada setiap tahap\nPengiriman ke seluruh Indonesia",
        ],
        'portofolio' => [
            'enabled'  => true,
            'kicker'   => 'Portofolio',
            'title'    => 'Karya Terpilih',
            'subtitle' => 'Sebagian pekerjaan yang kami selesaikan untuk klien korporat, instansi, dan brand.',
            'items'    => [
                ['image' => 'uploads/work-1.jpg', 'title' => 'Roll Up Banner', 'caption' => 'Promosi bisnis'],
                ['image' => 'uploads/work-2.jpg', 'title' => 'Standee Akrilik', 'caption' => 'Karakter custom'],
                ['image' => 'uploads/work-3.jpg', 'title' => 'Cetak Indoor', 'caption' => 'Poster komersial'],
                ['image' => 'uploads/work-4.jpg', 'title' => 'Kartu Menu QR', 'caption' => 'Resto & kafe'],
                ['image' => 'uploads/work-5.jpg', 'title' => 'Kalender Custom', 'caption' => 'Korporat'],
                ['image' => 'uploads/work-6.jpg', 'title' => 'Buku Menu Spiral', 'caption' => 'Resto & kuliner'],
                ['image' => 'uploads/work-7.jpg', 'title' => 'X-Banner', 'caption' => 'Event nasional'],
                ['image' => 'uploads/work-8.jpg', 'title' => 'Stiker Custom', 'caption' => 'Kisscut satuan'],
            ],
        ],
        'statistik' => [
            'enabled' => true,
            'items'   => "1.600+ | Pesanan Selesai (60 Hari)\n900+ | Klien Aktif\n2 | Fasilitas Produksi\n4.9/5 | Penilaian Klien",
        ],
        'produk' => [
            'enabled'  => true,
            'kicker'   => 'Katalog',
            'title'    => 'Produk Unggulan',
            'subtitle' => 'Produk dengan tingkat pemesanan ulang tertinggi dari katalog kami.',
            'ids'      => [],
        ],
        'video' => [
            'enabled' => true,
            'kicker'  => 'Fasilitas',
            'title'   => 'Fasilitas & Proses Produksi',
            'text'    => 'Dua fasilitas produksi di Imogiri dan Sewon dengan lini mesin yang dirawat rutin.',
            'image'   => 'assets/demo/team.svg',
            'youtube' => '',
        ],
        'testimoni' => [
            'enabled' => true,
            'kicker'  => 'Testimoni',
            'title'   => 'Apa Kata Klien Kami',
            'items'   => "Vendor cetak langganan kantor kami — spesifikasi selalu sesuai, tidak perlu revisi. | Andi Pratama | Staf Pengadaan Instansi\nLabel kemasan produk kami terlihat premium dan datang tepat jadwal produksi. | Sari Wulandari | Pemilik Brand Kuliner\nPlakat akrilik untuk acara penghargaan dikerjakan halus sampai detail terkecil. | Budi Santoso | Ketua Panitia\nBanner & backdrop event selesai H-2 — komunikasinya profesional dari awal sampai akhir. | Rina Maharani | Event Organizer",
        ],
        'klien' => [
            'enabled' => true,
            'kicker'  => 'Klien',
            'title'   => 'Dipercaya Perusahaan & Instansi',
            // logo dari situs resmi/Wikimedia (sesuaikan dengan klien asli + izin pemakaian)
            'items'   => "Exindo Pratama | uploads/klien-exindo.png\nXposer Event | uploads/klien-xposer.png\nIndomaret | uploads/klien-indomaret.svg\nAlfamart | uploads/klien-alfamart.svg\nRS JIH | uploads/klien-jih.jpg\nJogja Expo Center | uploads/klien-jec.webp\nJIEXPO | uploads/klien-jiexpo.png\nRoyal Ambarrukmo | uploads/klien-ambarrukmo.png\nJogja City Mall | uploads/klien-jcm.png\nMarriott | uploads/klien-marriott.svg\nLippo Mall | uploads/klien-lippo.svg\nErigo | uploads/klien-erigo.svg\nPemkab Bantul | uploads/klien-bantul.svg\nPemda DIY | uploads/klien-diy.svg\nPemkot Yogyakarta | uploads/klien-kotayk.svg\nUniversitas Negeri Yogyakarta | uploads/klien-uny.png\nSMA N 1 Imogiri | uploads/klien-tutwuri.png\nPondok Pesantren & Madrasah | uploads/klien-kemenag.png",
        ],
        'order' => [
            'enabled'  => true,
            'kicker'   => 'Konsultasi',
            'title'    => 'Konsultasikan Kebutuhan Cetak Anda',
            'subtitle' => 'Sampaikan kebutuhan dan tenggat Anda. Tim kami akan merespons dengan rekomendasi material dan estimasi biaya — tanpa kewajiban apa pun.',
            'whatsapp' => '',
            'branches' => "Imogiri\nSewon",
        ],
        'artikel' => [
            'enabled' => true,
            'kicker'  => 'Blog',
            'title'   => 'Wawasan & Panduan',
            'limit'   => 5,
        ],
        'faq' => [
            'enabled' => true,
            'kicker'  => 'FAQ',
            'title'   => 'Pertanyaan yang Sering Diajukan',
            'items'   => "Berapa lama waktu pengerjaan? | Pesanan reguler umumnya selesai 1–3 hari kerja, bergantung jenis produk dan antrean produksi. Kebutuhan mendesak dapat dikomunikasikan terlebih dahulu.\nApakah ada minimal order? | Sebagian besar produk dapat dicetak satuan — termasuk sablon DTF dan stiker.\nDi mana lokasi Voliko Print? | Kami memiliki dua cabang di Bantul, Yogyakarta: Imogiri dan Sewon. Pesanan juga dapat dikirim ke seluruh Indonesia.\nFormat file apa yang diterima? | PDF, AI, CDR, atau PNG/JPG resolusi tinggi. Belum memiliki file desain? Tim kami siap membantu menyiapkannya.\nBagaimana cara memesan? | Pilih produk pada katalog lalu lakukan checkout, atau konsultasikan kebutuhan Anda langsung melalui WhatsApp.",
        ],
        'kontak' => [
            'enabled'   => true,
            'title'     => 'Hubungi Kami',
            'email'     => 'halo@volikoprint.com',
            // beberapa lokasi/cabang — ditampilkan sebagai tab + peta
            'locations' => [
                ['name' => 'Voliko Print — Imogiri', 'address' => "Imogiri, Bantul,\nDaerah Istimewa Yogyakarta", 'phone' => '0812-3456-7890', 'whatsapp' => '081234567890', 'hours' => 'Senin–Sabtu 08.00–20.00', 'mapsEmbed' => ''],
                ['name' => 'Voliko Print — Sewon', 'address' => "Sewon, Bantul,\nDaerah Istimewa Yogyakarta", 'phone' => '0812-3456-7890', 'whatsapp' => '081234567890', 'hours' => 'Senin–Sabtu 08.00–20.00', 'mapsEmbed' => ''],
            ],
            // kompat lama (masih dibaca sec_order sebagai fallback)
            'address'   => "Imogiri, Bantul,\nDaerah Istimewa Yogyakarta",
            'phone'     => '0812-3456-7890',
            'whatsapp'  => '081234567890',
            'mapsEmbed' => '',
        ],
        'cta' => [
            'enabled'  => true,
            'title'    => 'Siap Mencetak dengan Standar yang Berbeda?',
            'subtitle' => 'Konsultasikan kebutuhan banner, stiker, DTF, atau cutting laser Anda — penawaran transparan sejak awal.',
            'btnText'  => 'Mulai Konsultasi',
            'btnLink'  => '#order-cepat',
        ],
        'popup' => [
            'enabled' => false,
            'title'   => '',
            'text'    => '',
            'image'   => '',
            'link'    => '',
            'btnText' => '',
            'btnLink' => '',
            'once'    => true,
        ],
        // ── Halaman Profil ──
        'profil' => [
            'enabled'  => true,
            'heroTitle'    => 'Percetakan yang Dibangun di Atas Disiplin Produksi',
            'heroAccent'   => 'Disiplin Produksi',
            'heroSubtitle' => 'Sejak berdiri di Imogiri, Voliko Print tumbuh menjadi mitra produksi cetak untuk bisnis, instansi, dan kreator di Yogyakarta.',
            'title'    => 'Siapa Kami',
            'text'     => 'Kami percetakan yang berfokus pada hasil yang rapi, harga transparan, dan ketepatan waktu. Dari label produk, materi promosi, hingga merchandise — semua dikerjakan teliti dengan material terbaik dan alur produksi yang terkontrol.',
            'image'    => '',
            'list'     => "Melayani satuan hingga partai besar\nPendampingan desain hingga siap cetak\nPengiriman ke seluruh Indonesia",
            'nilai'    => "Kualitas | Mesin dirawat rutin demi hasil tajam & konsisten.\nKetepatan | Jadwal produksi jelas, serah terima sesuai komitmen.\nKeahlian | Tim desain & operator berpengalaman di tiap lini.\nTransparansi | Penawaran jelas, tanpa biaya tersembunyi.",
        ],
        // ── Halaman Portofolio ──
        'portofolio_page' => [
            'heroTitle'    => 'Hasil Kerja Kami Berbicara Lebih Jelas',
            'heroAccent'   => 'Hasil Kerja',
            'heroSubtitle' => 'Galeri pekerjaan yang telah kami selesaikan — bukti standar kualitas yang kami pegang di setiap pesanan.',
        ],
        // ── Slider promo halaman Katalog Produk (multi-slide, bisa digeser) ──
        'katalog' => [
            'enabled' => true,
            'slides'  => [
                ['badge' => 'Bisa Satuan', 'title' => 'Semua Kebutuhan Cetak Anda, Satu Tempat', 'subtitle' => 'Telusuri ratusan produk siap pesan — banner, stiker, merchandise, hingga cutting laser. Harga transparan.', 'image' => '', 'btnText' => 'Konsultasi Cepat', 'btnLink' => 'index.php#order-cepat'],
                ['badge' => 'Layanan 24 Jam', 'title' => 'Punya Order Mendadak?', 'subtitle' => 'Untuk kondisi tertentu kami melayani cetak 24 jam — hubungi kami lebih dulu, tim siap membantu.', 'image' => '', 'btnText' => 'Hubungi Kami', 'btnLink' => 'index.php#order-cepat'],
            ],
        ],
    ];
}

/** Ambil isi section: default ⊕ override tersimpan (key settings 'content_<sec>'). */
function site_content(string $sec): array {
    $defaults = content_defaults();
    $def = $defaults[$sec] ?? [];
    try { $raw = cfg('content_' . $sec); } catch (Throwable $e) { $raw = null; }
    $saved = $raw ? json_decode($raw, true) : null;
    if (!is_array($saved)) return $def;
    return array_merge($def, $saved);
}

function save_site_content(string $sec, array $data): void {
    cfg_set('content_' . $sec, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
}

/** Daftar section untuk editor admin (urut tampil di beranda). */
function content_sections(): array {
    return [
        'hero'       => 'Hero Slider',
        'ticker'     => 'Strip Layanan Berjalan',
        'layanan'    => 'Lini Layanan',
        'tentang'    => 'Tentang (Band Gelap)',
        'portofolio' => 'Karya Terpilih',
        'statistik'  => 'Statistik',
        'produk'     => 'Produk Unggulan',
        'video'      => 'Fasilitas / Video',
        'testimoni'  => 'Testimoni',
        'klien'      => 'Klien',
        'order'      => 'Form Konsultasi',
        'artikel'    => 'Artikel',
        'faq'        => 'FAQ',
        'kontak'     => 'Kontak',
        'cta'        => 'CTA Penutup',
        'katalog'    => 'Banner Halaman Produk',
        'popup'      => 'Popup Promo',
        'profil'     => 'Halaman Profil',
        'portofolio_page' => 'Halaman Portofolio',
    ];
}
