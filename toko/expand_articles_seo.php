<?php
// Perluas 5 artikel SEO hingga >1000 kata: sisip section tambahan + gambar inline
// tepat sebelum <h2>Kesimpulan</h2>. CLI only; aman diulang (cek penanda).
if (PHP_SAPI !== 'cli') { http_response_code(403); exit("CLI only\n"); }
require_once __DIR__ . '/db.php';

$extra = [];

$extra['percetakan-event-jogja-panduan-vendor-cetak'] = <<<HTML
<figure><img src="uploads/work-7.jpg" alt="Deretan X-banner seragam untuk rangkaian national meeting — percetakan event Jogja" loading="lazy"><figcaption>Deretan X-banner seragam yang kami produksi untuk rangkaian acara nasional — dicetak satu batch agar warna konsisten.</figcaption></figure>
<h2>Kesalahan Umum Panitia Event (dan Cara Menghindarinya)</h2>
<p><strong>Pertama, menganggap semua bahan banner sama.</strong> Flexi 280 gsm untuk backdrop indoor dan baliho outdoor adalah dua dunia berbeda — yang satu mengejar tampilan halus di kamera, yang lain mengejar ketahanan angin dan hujan. Sebutkan selalu lokasi pemasangan saat memesan, dan biarkan vendor merekomendasikan bahan yang tepat.</p>
<p><strong>Kedua, mengirim file resolusi rendah.</strong> Poster Instagram 1080 piksel tidak bisa ditarik menjadi backdrop enam meter. Jika tim desain Anda terbatas, kirim file mentah yang ada — tim kami akan memeriksa dan memberi tahu apakah aman dicetak besar, atau membantu membangun ulang desainnya.</p>
<p><strong>Ketiga, lupa menghitung waktu pemasangan.</strong> Materi selesai dicetak bukan berarti selesai urusan: backdrop perlu rangka, baliho perlu izin titik pasang, umbul-umbul perlu tiang. Sisakan minimal satu hari penuh antara barang jadi dan acara dimulai.</p>
<p><strong>Keempat, tidak punya rencana cadangan.</strong> Cuaca, vendor lain yang terlambat, atau perubahan rundown bisa mengacaukan segalanya. Simpan kontak percetakan yang sanggup bergerak di luar jam kerja — Anda akan bersyukur memilikinya tepat saat dibutuhkan.</p>
<h2>Pertanyaan yang Sering Diajukan Panitia</h2>
<p><strong>Berapa lama waktu produksi backdrop 4×3 meter?</strong> Pada antrean normal, satu hari kerja sudah termasuk finishing mata ayam atau lipatan rangka. Saat musim event (Agustus, Desember, dan musim wisuda), tambahkan satu hari untuk amannya.</p>
<p><strong>Apakah bisa cetak malam ini, pasang besok pagi?</strong> Untuk kondisi tertentu, bisa — itulah layanan 24 jam kami. Hubungi kami sebelum pukul berapa pun via WhatsApp; selama material tersedia dan file siap cetak, tim kami akan mengatur antrean khusus.</p>
<p><strong>Apakah melayani pemasangan?</strong> Untuk area Yogyakarta dan sekitarnya, kami dapat membantu koordinasi pemasangan. Untuk luar kota, kami sertakan panduan pemasangan dan kelengkapan rangka sesuai kebutuhan.</p>
<p><strong>Bagaimana sistem pembayarannya untuk instansi?</strong> Kami terbiasa bekerja dengan sistem pengadaan instansi dan perusahaan — penawaran resmi, invoice, dan dokumen pendukung dapat kami siapkan.</p>
HTML;

$extra['vendor-pameran-checklist-materi-booth'] = <<<HTML
<figure><img src="uploads/work-1.jpg" alt="Roll up banner produksi vendor pameran Jogja" loading="lazy"><figcaption>Roll up banner — materi paling serbaguna di booth pameran: ringan, berdiri sendiri, dan bisa dipakai ulang di event berikutnya.</figcaption></figure>
<h2>Studi Kasus: Booth 3×3 dengan Anggaran Efisien</h2>
<p>Seorang klien kami — brand kuliner lokal — mendapat slot booth 3×3 meter di sebuah expo UMKM besar dengan waktu persiapan hanya enam hari. Anggaran materi cetaknya terbatas, sehingga kami menyusun paket prioritas: satu backwall albatros 3×2,4 meter dengan satu pesan besar ("Oleh-oleh Khas Jogja — Sejak 2018"), dua roll up banner berisi best-seller dan QR katalog, lima ratus stiker logo kisscut untuk dibagikan, dan dua apron DTF untuk penjaga booth.</p>
<p>Hasilnya: booth mereka termasuk yang paling banyak difoto pengunjung — bukan karena paling besar, melainkan karena visualnya bersih dan pesannya jelas dari ujung lorong. Stok stiker habis di hari kedua dan menjadi penanda berapa banyak orang yang benar-benar mampir. Total biaya materi cetak? Lebih kecil dari biaya sewa booth-nya sendiri.</p>
<p>Pelajaran pentingnya: <strong>kelengkapan mengalahkan kemewahan</strong>. Booth dengan materi lengkap di semua titik kontak — dinding, lantai depan, meja, tangan pengunjung — selalu menang melawan booth yang hanya mengandalkan satu spanduk besar.</p>
<h2>Pertanyaan yang Sering Diajukan Peserta Pameran</h2>
<p><strong>Lebih baik sewa booth polos atau bawa materi sendiri?</strong> Hampir selalu lebih hemat mencetak materi sendiri — dan materi itu menjadi aset yang bisa dipakai di pameran berikutnya, terutama roll up dan tension fabric.</p>
<p><strong>Berapa lama produksi paket booth lengkap?</strong> Paket standar (backwall, dua roll up, brosur, stiker) umumnya selesai 2–3 hari kerja. Saat mepet, hubungi kami — untuk kondisi tertentu kami melayani produksi 24 jam dengan koordinasi sebelumnya.</p>
<p><strong>Pameran saya di luar kota, kapan harus order?</strong> Hitung mundur: tanggal pameran, dikurangi waktu kirim ekspedisi (1–4 hari tergantung kota), dikurangi waktu produksi. Tim kami bantu hitungkan begitu Anda menyebut kota dan tanggalnya.</p>
<p><strong>Apakah desain bisa dibantu?</strong> Bisa. Kirim logo, foto produk, dan pesan utama Anda — tim desain kami menyiapkan pratinjau sebelum naik cetak, dan Anda hanya membayar setelah desain disetujui.</p>
HTML;

$extra['branding-toko-digital-printing'] = <<<HTML
<figure><img src="uploads/work-4.jpg" alt="Kartu menu QR PVC untuk branding toko resto dan kafe" loading="lazy"><figcaption>Kartu QR menu berbahan PVC — pengganti menu kertas yang lecek; salah satu upgrade branding termurah untuk kafe dan resto.</figcaption></figure>
<h2>Checklist Audit Visual Toko Anda</h2>
<p>Sebelum memutuskan order apa pun, lakukan audit sederhana ini. Berdirilah di seberang jalan depan toko Anda dan jawab jujur:</p>
<ul>
<li>Apakah nama toko terbaca jelas dari jarak 20 meter, siang dan malam?</li>
<li>Apakah orang yang baru pertama lewat langsung paham toko ini menjual apa?</li>
<li>Apakah ada alasan untuk berhenti — promo, penawaran, atau visual yang menarik?</li>
<li>Masuklah ke dalam: apakah pelanggan baru bisa menemukan kasir, harga, dan cara memesan tanpa bertanya?</li>
<li>Saat pelanggan keluar membawa belanjaan, adakah identitas brand yang ikut terbawa?</li>
</ul>
<p>Setiap jawaban "tidak" adalah titik kebocoran persepsi — dan hampir semuanya bisa ditambal dengan materi cetak yang tepat, bukan renovasi mahal.</p>
<h2>Material Tahan Lama vs. Material Promo: Bedakan Anggarannya</h2>
<p>Kesalahan klasik branding toko adalah memakai material permanen untuk pesan sementara, dan sebaliknya. Signage nama toko adalah investasi 3–5 tahun: gunakan akrilik, huruf timbul, atau lightbox. Sementara promo "Diskon Ramadan" hanya hidup sebulan: cukup banner flexi atau stiker kaca yang murah dan mudah dilepas. Memisahkan dua anggaran ini membuat toko selalu segar tanpa membongkar identitas utamanya.</p>
<p>Untuk toko berkonsep musiman — fashion, kado, F&B — kami sarankan menjadwalkan rotasi materi promo per kuartal. Banyak klien toko kami berlangganan pola ini: desain disiapkan di awal, dicetak bergiliran, dan toko tidak pernah terlihat "itu-itu saja" di mata pelanggan tetap.</p>
<h2>Pertanyaan yang Sering Diajukan Pemilik Toko</h2>
<p><strong>Mulai dari anggaran berapa branding toko bisa jalan?</strong> Lebih kecil dari yang Anda kira — banner nama toko dan satu rol stiker label bisa menjadi titik awal yang layak. Yang penting konsisten: satu logo, satu warna utama, di semua materi.</p>
<p><strong>Toko saya franchise/cabang, bisa samakan dengan pusat?</strong> Bisa. Kirim panduan brand (atau sekadar foto cabang pusat) — kami sesuaikan warna dan material agar seragam.</p>
<p><strong>Grand opening minggu ini, materi belum ada sama sekali?</strong> Hubungi kami sekarang. Untuk kondisi tertentu seperti ini kami melayani pengerjaan 24 jam — banner, stiker kaca, dan menu board adalah paket yang paling sering kami kebut untuk pembukaan toko.</p>
HTML;

$extra['digital-printing-yogyakarta-segala-kebutuhan'] = <<<HTML
<figure><img src="uploads/svc-4.jpg" alt="Mesin cetak UV roll digital printing Yogyakarta sedang berproduksi" loading="lazy"><figcaption>Lini cetak roll kami sedang berproduksi — seluruh proses dikerjakan in-house di fasilitas kami di Bantul, Yogyakarta.</figcaption></figure>
<h2>Di Balik Layar: Bagaimana Pesanan Anda Diproses</h2>
<p>Transparansi proses adalah cara terbaik memahami kualitas sebuah percetakan. Beginilah perjalanan order Anda di tempat kami: <strong>(1) Pemeriksaan file</strong> — setiap file dicek resolusi, mode warna, dan area potongnya; masalah ditemukan di tahap ini, bukan setelah barang jadi. <strong>(2) Antrean produksi terjadwal</strong> — order masuk sistem antrean dengan estimasi selesai yang jelas, bukan janji lisan. <strong>(3) Cetak dan kontrol warna</strong> — operator memeriksa hasil meter-meter pertama sebelum melanjutkan cetakan penuh. <strong>(4) Finishing</strong> — pemotongan, mata ayam, laminasi, atau press sesuai spesifikasi. <strong>(5) Pemeriksaan akhir dan serah terima</strong> — barang difoto dan dicocokkan dengan pesanan sebelum diserahkan atau dikirim.</p>
<p>Lima tahap ini berlaku sama untuk order satu lembar stiker maupun kontrak ribuan meter banner — karena konsistensi proses itulah yang membuat hasil hari ini sama baiknya dengan hasil bulan depan.</p>
<h2>Memilih Layanan yang Tepat: Panduan Cepat</h2>
<ul>
<li><strong>Butuh promosi outdoor murah dan cepat?</strong> → Cetak bahan banner flexi.</li>
<li><strong>Butuh label produk atau stiker bentuk custom?</strong> → Stiker meteran kisscut.</li>
<li><strong>Butuh materi outdoor yang awet bertahun-tahun?</strong> → Cetak UV roll.</li>
<li><strong>Butuh kaos/merchandise kain, bahkan cuma satu?</strong> → Print DTF.</li>
<li><strong>Butuh plakat, signage timbul, atau souvenir presisi?</strong> → Cutting laser.</li>
</ul>
<p>Masih ragu kebutuhan Anda masuk kategori mana? Justru itu gunanya konsultasi — ceritakan tujuannya ("saya ingin kios saya lebih terlihat", "saya butuh suvenir acara 200 pcs"), dan biarkan kami yang menerjemahkannya menjadi spesifikasi teknis beserta perbandingan harganya.</p>
<h2>Pertanyaan yang Paling Sering Kami Terima</h2>
<p><strong>Apakah benar bisa cetak satuan?</strong> Benar. Satu banner, satu kaos DTF, satu plakat — semua kami layani tanpa minimal order. Harga satuan tentu berbeda dengan harga partai, dan keduanya kami sampaikan transparan di awal.</p>
<p><strong>Apakah harga di Jogja benar-benar lebih murah?</strong> Untuk sebagian besar produk large format dan stiker, ya — biaya operasional Yogyakarta membuat harga kami kompetitif secara nasional, itulah mengapa banyak order kami justru datang dari luar kota.</p>
<p><strong>Seberapa cepat layanan 24 jam itu?</strong> Tergantung jenis produk dan antrean — tetapi prinsipnya: hubungi kami kapan pun, jelaskan tenggat Anda, dan kami jawab jujur sanggup atau tidak beserta opsinya. Kami lebih memilih menolak dengan jujur daripada menyanggupi lalu mengecewakan.</p>
HTML;

$extra['strategi-promosi-umkm-materi-cetak-efektif'] = <<<HTML
<figure><img src="uploads/svc-2.jpg" alt="Stiker label kemasan kisscut untuk promosi UMKM" loading="lazy"><figcaption>Label kemasan kisscut — materi cetak dengan dampak persepsi terbesar per rupiah untuk produk UMKM.</figcaption></figure>
<h2>Hitung-Hitungan Sederhana: Biaya per Tayangan</h2>
<p>Mari bandingkan dengan kacamata "biaya per dilihat". Satu banner depan kios dilewati ratusan hingga ribuan orang setiap hari, selama 1–2 tahun umur pakainya — biaya per tayangannya nyaris nol. Satu label kemasan dilihat bukan hanya oleh pembeli, tetapi semua orang di sekitarnya selama produk itu dikonsumsi. Satu stiker di botol minum pelanggan tampil di setiap rapat dan kelas yang ia hadiri. Tidak banyak kanal promosi modern yang bisa menandingi angka-angka ini — dan tidak ada yang menagih biaya berlangganan bulanan.</p>
<p>Ini bukan berarti promosi digital tidak penting; keduanya saling melengkapi. Materi cetak membangun kepercayaan di dunia nyata, promosi digital memperluas jangkauan. Namun bagi UMKM dengan anggaran terbatas, fondasi cetak yang baik membuat setiap rupiah iklan digital bekerja lebih keras — karena orang yang penasaran lalu datang ke lokasi atau menerima paketnya tidak akan kecewa oleh tampilan yang seadanya.</p>
<h2>Kisah Lapangan: Dari Kemasan Polos ke Repeat Order</h2>
<p>Salah satu klien kami memulai dengan satu produk sambal rumahan berkemasan jar polos. Order pertamanya sederhana: label kisscut. Tiga bulan kemudian ia kembali — kali ini untuk stiker segel, kartu ucapan kecil, dan banner kios. Apa yang berubah? Reseller mulai berdatangan setelah produknya "terlihat layak toko", dan pembeli online mulai memfoto paketnya untuk story. Branding tidak menjual rasa sambalnya — tetapi branding membuat orang <em>mau mencoba</em>, dan rasa yang menjadikan mereka pelanggan tetap.</p>
<h2>Pertanyaan yang Sering Diajukan Pelaku UMKM</h2>
<p><strong>Saya tidak punya desainer, bagaimana?</strong> Kirim logo (atau bahkan sekadar nama usaha), foto produk, dan referensi yang Anda suka — tim kami bantu siapkan desain sederhana yang layak cetak. Anda meninjau pratinjau dulu sebelum produksi.</p>
<p><strong>Minimal order label berapa?</strong> Stiker meteran kami dijual per meter — satu meter pun jadi. Untuk efisiensi, kebanyakan UMKM memesan sesuai satu batch produksi agar desain masih bisa diperbaiki di cetakan berikutnya.</p>
<p><strong>Saya di luar Jogja, ongkirnya bagaimana?</strong> Stiker dan label itu ringan — ongkos kirimnya kecil dibanding selisih harga produksinya. Kami kirim ke seluruh Indonesia setiap hari kerja.</p>
<p><strong>Pesanan saya tiba-tiba melonjak, bisa dikebut?</strong> Bisa, untuk kondisi tertentu kami melayani produksi 24 jam — hubungi kami via WhatsApp sebelum stok kemasan Anda benar-benar habis.</p>
HTML;

$pdo = db();
$sel = $pdo->prepare("SELECT id, content FROM articles WHERE slug = ?");
$upd = $pdo->prepare("UPDATE articles SET content = ? WHERE id = ?");
foreach ($extra as $slug => $html) {
    $sel->execute([$slug]);
    $row = $sel->fetch();
    if (!$row) { echo "tidak ditemukan: $slug\n"; continue; }
    if (strpos($row['content'], '<figure>') !== false) { echo "lewati (sudah diperluas): $slug\n"; continue; }
    $new = str_replace('<h2>Kesimpulan</h2>', $html . "\n<h2>Kesimpulan</h2>", $row['content']);
    $upd->execute([$new, $row['id']]);
    echo "diperluas: $slug → ±" . str_word_count(strip_tags($new)) . " kata\n";
}
