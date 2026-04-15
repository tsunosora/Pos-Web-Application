# 📖 Wiki — PosPro: Aplikasi Kasir & Manajemen Bisnis Berbasis Web

> Selamat datang di dokumentasi lengkap **PosPro** — panduan ini ditujukan untuk siapa saja yang ingin memahami, menggunakan, atau mengembangkan aplikasi ini, mulai dari kasir toko hingga pemilik bisnis.

---

## Apa itu PosPro?

**PosPro** adalah aplikasi kasir berbasis web yang dirancang untuk bisnis modern — percetakan digital, toko kelontong, kafe, konveksi, atau usaha jasa lainnya. Tidak perlu install aplikasi tambahan, cukup buka browser dan langsung bisa digunakan.

Yang membedakan PosPro dari kasir biasa adalah **ekosistemnya yang lengkap**: bukan hanya mencatat penjualan, tapi juga mengelola stok, membuat penawaran harga profesional ke klien perusahaan, melacak arus kas, memetakan posisi kompetitor, dan mengirim laporan otomatis ke grup WhatsApp pemilik toko.

---

## Daftar Isi Wiki

> **Baru di sini?** Mulai dari [🔄 Alur Bisnis](alur-bisnis.md) untuk memahami bagaimana semua fitur terhubung, lalu baca panduan sesuai peran Anda.

| # | Halaman | Ringkasan |
|---|---|---|
| 0 | [🔄 Alur Bisnis](alur-bisnis.md) | Setup awal, alur harian kasir, alur produksi, review keuangan — **mulai dari sini** |
| 1 | [Login & Dashboard](#-1-login-ke-aplikasi) | Cara masuk dan membaca ringkasan bisnis harian |
| 2 | [Kasir / POS](#-3-kasir--point-of-sale-pos) | Cara melayani pelanggan dan mencatat transaksi |
| 3 | [Manajemen Produk & Stok](#-4-manajemen-produk--stok) | Cara kelola produk, varian, foto, stok, pembelian bahan baku, riwayat stok |
| 4 | [DP / Piutang](#-5-daftar-dp--piutang) | Melacak pelanggan yang belum lunas — tab DP, Kredit, Bayar Nanti |
| 5 | [📊 Laporan Penjualan](laporan-penjualan.md) | Ringkasan metrik, Trend Produk, Histori Log transaksi |
| 6 | [Laporan Tutup Shift](#-7-laporan-tutup-shift-) | Rekonsiliasi kas dan rekening bank akhir shift |
| 6b | [📜 Riwayat Tutup Shift](riwayat-shift.md) | Log historis semua shift, backup pesan WA, kirim ulang |
| 7 | [Laporan Laba Kotor](#-laporan-laba-kotor) | Profit & margin per produk berdasarkan HPP |
| 8 | [Data Pelanggan](#-8-data-pelanggan) | Database & riwayat belanja pelanggan |
| 9 | [WhatsApp Bot](#-9-pengaturan-whatsapp-bot) | Setup bot laporan otomatis ke grup WA owner |
| 10 | [💰 Cashflow Bisnis](cashflow.md) | Arus kas pemasukan & pengeluaran, chart, export |
| 11 | [📊 Laporan Stok](laporan-stok.md) | Pergerakan stok per periode, filter IN/OUT/ADJUST, export CSV |
| 12 | [📄 Invoice & Penawaran Harga](invoice-sph.md) | Buat invoice & SPH profesional untuk klien B2B |
| 13 | [🗺️ Peta Cuan Lokasi](peta-cuan.md) | Peta cabang, kompetitor, dan pencarian bisnis |
| 14 | [🎨 Tampilan Login](#-10-pengaturan-tampilan-halaman-login) | Upload foto latar, atur tagline, animated logo |
| 15 | [🖨️ Antrian Produksi](produksi.md) | Antrian cetak, job satuan & batch, produk rakitan multi-tahap, search, detail invoice |
| 16 | [📋 Stok Opname](stock-opname.md) | Hitung fisik stok via link operator untuk karyawan |
| 17 | [🏭 Data Supplier](suppliers.md) | Kelola data supplier dan harga beli per varian produk |
| 18 | [💾 Backup & Restore](backup.md) | Backup database ke ZIP, auto-backup via Rclone, dan restore |
| 19 | [🧮 Kalkulator HPP](hpp-calculator.md) | Worksheet biaya produksi, multi-varian, biaya tambah, simpan sebagai produk |
| 20 | [🚀 Panduan Deployment](deployment.md) | Setup di home server / VPS dengan Cloudflare Tunnel |

---

## 🔐 1. Login ke Aplikasi

Buka browser dan akses alamat aplikasi (contoh: `http://localhost:3000`).

- **Email**: masukkan email akun Anda (contoh: `admin@toko.com`)
- **Password**: masukkan kata sandi

Klik **Sign In**. Jika berhasil, Anda akan masuk ke halaman Dashboard.

> **Lupa password?** Hubungi administrator toko untuk mereset akun Anda.

### Auto-Logout Otomatis

Jika sesi login sudah kadaluarsa (token JWT habis masa berlakunya), sistem akan secara otomatis mengarahkan kembali ke halaman login. Ini terjadi saat ada permintaan API yang mengembalikan error **401 Unauthorized** — misalnya ketika halaman dibiarkan terbuka dalam waktu yang sangat lama.

> Tidak perlu khawatir kehilangan data transaksi yang sudah diinput — keranjang belanja di kasir disimpan di browser (Zustand state). Setelah login ulang, kembali ke halaman `/pos`.

---

## 🏠 2. Halaman Utama / Dashboard

Setelah login, Anda akan melihat **Dashboard** — halaman ringkasan kondisi bisnis hari ini secara sekilas.

| Kartu Informasi | Penjelasan |
|---|---|
| **Total Penjualan Hari Ini** | Jumlah uang yang masuk dari semua transaksi hari ini |
| **Jumlah Transaksi** | Berapa kali terjadi transaksi penjualan |
| **Produk Terjual** | Total item yang sudah laku |
| **Saldo per Rekening** | Saldo terkini di setiap rekening bank yang terdaftar |

Di Dashboard juga terdapat **grafik penjualan** yang menampilkan tren harian atau mingguan, sehingga pemilik toko bisa langsung melihat perkembangan bisnis tanpa perlu membuka laporan detail.

---

## 🛒 3. Kasir / Point of Sale (POS)

Halaman kasir adalah inti dari aplikasi — tempat mencatat setiap transaksi penjualan secara real-time.

### Cara Bertransaksi

**Langkah 1 — Cari dan Tambah Produk**
- Ketik nama produk di kotak pencarian, atau
- Gunakan **scanner barcode** (kamera HP atau scanner fisik) — klik ikon kamera di sebelah kotak pencarian
- Klik produk untuk menambahkannya ke keranjang

**Langkah 2 — Atur Keranjang**
- Klik tombol **+** / **−** untuk mengubah jumlah
- Untuk produk **Digital Printing** (banner, sticker, MMT): masukkan ukuran lebar dan tinggi — harga dihitung otomatis sesuai satuan:
  - **Meter (m²)**: harga per m², masukkan Lebar × Tinggi dalam meter
  - **Sentimeter (cm²)**: harga per cm², masukkan Lebar × Tinggi dalam cm — cocok untuk produk harga-per-cm²
  - **Menit**: harga per menit, masukkan durasi di kolom lebar
- Produk dengan **∞** (Tanpa Lacak Stok) bisa ditambahkan ke keranjang tanpa batas
- Klik ikon tempat sampah untuk menghapus item dari keranjang

**Langkah 3 — Atur Tagihan (Opsional)**

Di modal checkout, tersedia dua kolom tambahan sebelum grand total:

| Kolom | Keterangan |
|---|---|
| **Diskon** | Nominal diskon dalam rupiah — dikurangi dari subtotal sebelum pajak dihitung |
| **Ongkos Kirim** | Biaya pengiriman — ditambahkan ke grand total |

Formula grand total: **Subtotal − Diskon + Pajak + Ongkos Kirim**

> Diskon yang diinput otomatis dicatat sebagai pengeluaran **"Diskon"** di Cashflow — sehingga laporan keuangan tetap akurat.

**Langkah 4 — Pilih Metode Pembayaran**

| Metode | Keterangan |
|---|---|
| **Tunai (Cash)** | Pembayaran tunai — masukkan nominal yang diterima |
| **Transfer Bank** | Pilih rekening tujuan transfer dari daftar rekening toko |
| **QRIS** | Tampilkan QR code ke pelanggan untuk dipindai |
| **KREDIT** ⭐ | Nota kredit tanpa uang muka — pelanggan bayar di kemudian hari dengan jatuh tempo. Pilih jatuh tempo dari preset (Akhir Minggu/Bulan/2 Bulan/6 Bulan/1 Tahun) atau input manual |
| **BAYAR NANTI** ⭐ | Simpan invoice tanpa pembayaran sama sekali — status PENDING, pelanggan bayar nanti melalui menu Piutang |

> **KREDIT vs DP:** DP artinya pelanggan sudah membayar sebagian. KREDIT artinya belum ada pembayaran sama sekali, hanya nota yang tersimpan dengan jatuh tempo.

**Langkah 5 — Isi Data Pelanggan (Wajib)**

Di bagian bawah modal checkout, tersedia kolom **Nama Pelanggan** dan **No. HP**:
- Saat mengetik nama atau HP, sistem menampilkan **dropdown saran** dari database pelanggan
- Jika HP sudah pernah terdaftar, semua kolom terisi **otomatis** (nama + alamat)
- Badge indikator menampilkan **"✓ Pelanggan lama"** (hijau) atau **"+ Pelanggan baru"** (biru)
- Pelanggan baru dengan nama + HP akan **otomatis tersimpan** ke database saat transaksi selesai — tidak perlu input manual terpisah

**Langkah 6 — Selesaikan Transaksi**
- Klik **Konfirmasi Lunas** untuk pembayaran penuh
- Klik **Konfirmasi Pembayaran DP** jika pelanggan hanya membayar sebagian (uang muka) — transaksi akan masuk ke daftar Piutang
- Klik **Simpan Nota Kredit** untuk menyimpan transaksi kredit tanpa pembayaran
- Klik **Simpan Invoice (Bayar Nanti)** untuk menyimpan invoice tanpa pembayaran sama sekali

**Langkah 7 — Struk**
- Setelah transaksi selesai, struk muncul otomatis
- Klik **Cetak** untuk mencetak ke printer thermal — baris **Diskon** dan **Ongkos Kirim** muncul di struk jika nilainya > 0
- Klik **Kirim WA** untuk mengirim ringkasan tagihan ke WhatsApp pelanggan
- Status transaksi ditampilkan: **✓ LUNAS** (hijau), **✓ DP / BELUM LUNAS** (kuning), atau **⏳ BELUM DIBAYAR** (biru)

> **Tips**: Produk mode **Area Based** akan otomatis memunculkan modal input Lebar × Tinggi saat ditambahkan ke keranjang. Pilih satuan yang sesuai produk (m, cm, atau menit) — harga dan stok dihitung secara independen berdasarkan satuan tersebut.

---

## 📦 4. Manajemen Produk & Stok

Halaman untuk mengelola semua produk, varian, bahan baku, dan stok yang dijual di toko.

### Yang Bisa Dilakukan

**Menambah Produk Baru**
1. Klik **+ Tambah Produk**
2. Isi nama, kategori, satuan, dan harga jual
3. Pilih **Mode Harga**:
   - **Normal (per unit)**: untuk produk yang dijual per pcs, lusin, kg, dll
   - **Area Based**: untuk banner, sticker, MMT, kain — harga dihitung dari lebar × tinggi. Pilih satuan:
     - **m** → harga per m² (standar percetakan)
     - **cm** → harga per cm² (produk dengan harga satuan cm²)
     - **menit** → harga per menit (jasa berbasis durasi)
4. Atur **Lacak Stok**:
   - **Aktif** (default): stok terpotong otomatis setiap transaksi, bisa dimonitor & diisi ulang
   - **Nonaktif** (Tanpa Lacak Stok): produk/jasa tidak butuh kontrol stok — tampil **∞** di kasir dan inventori, bisa diorder tanpa batas
5. Upload foto produk (opsional tapi direkomendasikan; format JPG, PNG, WEBP, JFIF)
6. Tambahkan **Varian** jika produk memiliki pilihan ukuran/warna/jenis
7. Tambahkan **Bahan Baku** jika ingin stok bahan baku otomatis terpotong saat produk terjual
8. Klik **Simpan**

**Mengelola Stok**
- Stok terpotong **otomatis** setiap kali ada transaksi di kasir (hanya produk yang **Lacak Stok** aktif)
- Produk dengan **Tanpa Lacak Stok** ditampilkan dengan simbol **∞** — tidak perlu diisi stoknya, tetap bisa diorder
- Untuk penambahan stok manual, klik ikon **+** (Tambah Stok) di kolom Aksi → masukkan jumlah
- Semua pergerakan stok tercatat di **Riwayat Stok** — klik ikon jam/history di kolom Aksi untuk melihatnya

**Pembelian Bahan Baku**

Fitur khusus untuk mencatat pembelian stok masuk dari supplier secara terstruktur:

1. Buka halaman **Inventori** → klik tombol **Pembelian** (hijau, pojok kanan atas toolbar)
2. Pilih **Supplier** (opsional) — jika dipilih, harga beli per item akan terisi otomatis dari data harga supplier
3. Isi **No. Invoice** (opsional) — nomor faktur dari supplier untuk keperluan pembukuan
4. Isi **Catatan** (opsional) — misalnya keterangan jenis pembelian
5. Cari dan tambahkan produk/bahan baku ke keranjang:
   - Ketik nama produk atau SKU di kolom pencarian
   - Klik item yang muncul untuk menambahkannya ke keranjang
6. Di keranjang, atur **Jumlah** dan **Harga Beli/Unit** per item
7. Klik **Simpan Pembelian** — stok semua item di keranjang akan bertambah sekaligus

> Setiap pembelian tercatat di riwayat stok dengan keterangan `purchase-{id}` sehingga mudah dilacak.

**Riwayat Stok (Kartu Stok)**

Setiap pergerakan stok varian dicatat secara lengkap dan bisa dilihat kapan saja:

1. Di tabel inventori, klik ikon **riwayat** (jam/history) di kolom Aksi pada baris varian yang diinginkan
2. Modal **Riwayat Stok** akan muncul — menampilkan semua pergerakan stok dari yang terbaru

| Kolom | Keterangan |
|---|---|
| Tipe | **MASUK** (hijau) / **KELUAR** (merah) / **SESUAIKAN** (biru) |
| Keterangan | Alasan pergerakan (misal: Transaksi, Stok Awal, Pembelian, Opname) |
| Referensi | Kode sumber (contoh: `purchase-12`, `opname-abc123`, `initial-stock`) |
| Jumlah | Banyaknya stok yang bergerak |
| Sisa | Saldo stok setelah pergerakan tersebut |
| Waktu | Tanggal dan jam tercatatnya pergerakan |

**Kolom Stok Awal**

Tabel inventori menampilkan kolom **Stok Awal** yang menunjukkan berapa stok yang tercatat pertama kali untuk setiap varian. Nilai ini diambil dari entri stok tertua dengan keterangan "Stok Awal" atau kode `initial-stock`.

Cara mengisi stok awal:
- **Saat tambah varian baru**: isi kolom stok, sistem otomatis mencatat sebagai stok awal
- **Untuk produk yang sudah ada**: gunakan **Sesuaikan Stok** → masukkan jumlah → beri catatan mengandung kata **"Stok Awal"**

**Kolom Aksi (Menu Kebab ⋮)**

Kolom aksi di tabel inventori dirancang ringkas untuk kemudahan penggunaan sehari-hari:

| Tombol | Fungsi |
|---|---|
| **+** (ikon plus) | Tambah stok / catat stok masuk |
| **jam** (ikon history) | Lihat riwayat stok lengkap |
| **⋮** (kebab menu) | Buka menu aksi lainnya |

Menu kebab berisi: **Catat Susut**, **Edit Produk**, **Kalkulator HPP**, **Salin Link Produk**, dan **Hapus Produk**.

**Varian Produk**

Cocok untuk produk yang punya variasi. Contoh:
- Kaos → Varian: S, M, L, XL (stok dan harga bisa berbeda per varian)
- Tinta Printer → Varian: Hitam, Cyan, Magenta, Yellow

**Harga Bertingkat (Price Tiers)**

Setiap varian bisa punya beberapa level harga berdasarkan jumlah qty yang dibeli. Contoh:

| Range Qty | Harga per Unit |
|---|---|
| 1–5 pcs | Rp 25.000 |
| 6–20 pcs | Rp 22.000 |
| 21 pcs ke atas | Rp 18.000 |

- Cara set: buka halaman **Edit Produk** → bagian **Varian** → klik **+ Tambah Tier**
- Di kasir POS: harga otomatis berubah sesuai qty yang dimasukkan operator
- Harga yang tampil di kartu produk kasir = harga tier pertama (harga qty terendah)
- Harga yang tampil di inventori = harga tier pertama, dengan badge jumlah tier aktif
- Jika qty tidak cocok tier manapun, harga fallback ke **Harga Jual** utama varian

**Tipe Produk**

Saat membuat produk, pilih tipe yang sesuai:

| Tipe | Keterangan |
|---|---|
| **Produk Jual** (SELLABLE) | Produk/jasa yang dijual ke pelanggan — muncul di kasir |
| **Bahan Baku** (RAW_MATERIAL) | Material produksi — **tidak muncul di kasir**, hanya muncul di inventori sebagai bahan untuk BOM/Ingredient |
| **Jasa** (SERVICE) | Layanan tanpa stok fisik |

> **Bahan Baku tidak dijual ke pelanggan** — sehingga tidak tampil di halaman kasir maupun di tab kategori kasir. Ini mencegah kasir salah memilih bahan baku sebagai produk jual.

**Tab Kategori di Inventori**

Halaman Inventori memiliki dua baris tab untuk navigasi cepat:

1. **Tab Tipe Produk** (baris atas): `Semua` / `Siap Jual` / `Bahan Baku` / `Jasa` — masing-masing menampilkan jumlah produk
2. **Tab Kategori** (baris bawah): muncul dinamis berdasarkan tipe yang dipilih — hanya kategori yang relevan dengan tipe tersebut yang ditampilkan

Klik tab tipe terlebih dahulu, lalu pilih kategori spesifik untuk menyempurnakan tampilan. Reset ke tab **Semua** untuk melihat seluruh inventori.

**Impor Produk Massal (Bulk Import)**

Untuk menambahkan banyak produk sekaligus tanpa input satu per satu:

1. Buka halaman **Inventori** → klik tombol **Import Excel**
2. Klik **Download Template** — unduh file Excel dengan contoh isi dan panduan kolom
3. Isi data produk di file Excel (nama, kategori, varian, harga, HPP, stok)
4. Upload file yang sudah diisi → sistem menampilkan **preview validasi** sebelum data disimpan
5. Klik **Impor** — produk yang valid langsung tersimpan; error per baris ditampilkan terpisah

**Pengaturan Material Roll**

Untuk produk berbahan gulungan (banner, vinyl, MMT, kain):

1. Di halaman Edit Produk → bagian Varian → centang **Bahan roll (banner, MMT, dll)**
2. Isi **Lebar Fisik (m)** — lebar total gulungan saat diterima dari supplier
3. Isi **Lebar Cetak Efektif (m)** — lebar yang bisa dipakai untuk cetak (setelah dikurangi tepi/waste)

Data ini digunakan operator di halaman Antrian Produksi untuk menghitung pemakaian bahan aktual per job.

**Stok Menipis**

Badge **"Menipis"** (merah) hanya muncul untuk produk yang mengaktifkan **Lacak Stok**. Produk dengan simbol **∞** (Tanpa Lacak Stok) tidak pernah masuk daftar peringatan stok menipis — baik di dashboard maupun di halaman inventori.

---

## 💳 5. Daftar DP / Piutang

Daftar semua transaksi yang **belum sepenuhnya dilunasi** oleh pelanggan.

Transaksi masuk ke daftar piutang saat kasir memilih **Bayar DP**, **KREDIT**, atau **BAYAR NANTI** saat bertransaksi.

### Tab Filter ⭐

Halaman piutang memiliki **4 tab filter** untuk mempermudah pengelolaan:

| Tab | Keterangan | Badge |
|---|---|---|
| **Semua** | Semua transaksi yang belum lunas | Total piutang |
| **DP** | Pelanggan sudah bayar sebagian (uang muka) | 🟡 Kuning |
| **Kredit** | Nota kredit — belum ada pembayaran, ada jatuh tempo | 🟣 Ungu |
| **Bayar Nanti** | Invoice disimpan tanpa pembayaran sama sekali | 🔵 Biru |

### Informasi yang Ditampilkan

| Kolom | Keterangan |
|---|---|
| Nama Pelanggan | Siapa yang punya piutang |
| Total Tagihan | Harga total transaksi |
| Sudah Dibayar | Jumlah DP yang sudah masuk (0 untuk kredit/bayar nanti) |
| Sisa Tagihan | Yang masih harus dilunasi |
| Jatuh Tempo | Deadline pelunasan — **merah** jika sudah lewat |
| Status | Badge: **DP** (kuning), **KREDIT** (ungu), **BAYAR NANTI** (biru) |

### Tombol Aksi per Nota

| Tombol | Fungsi |
|---|---|
| **Cetak Struk** | Cetak ulang struk transaksi |
| **Kirim WA** | Kirim tagihan ke WhatsApp pelanggan |
| **Edit** | Ajukan perubahan transaksi (butuh approval admin) |
| **Lunasi** | Buka modal pelunasan |

### Cara Mencatat Pelunasan ⭐

Saat pelanggan datang untuk melunasi:
1. Cari nama pelanggan di daftar piutang (gunakan tab filter atau search)
2. Klik tombol **Lunasi**
3. Di modal pelunasan:
   - **Nominal Pelunasan**: isi jumlah yang dibayar (default = sisa tagihan penuh)
   - **Metode Pembayaran**: pilih Cash, QRIS, atau Transfer (pilih rekening)
   - **Kasir Checkout**: pilih kasir yang menerima pembayaran
   - **Waktu Checkout**: atur tanggal & jam pelunasan (default = sekarang, bisa di-backdate)
4. Klik **Konfirmasi Pelunasan** — sistem otomatis:
   - Mengupdate sisa tagihan
   - Mencatat pembayaran di **Cashflow** sebagai pemasukan
   - Memberi nomor checkout pada transaksi

> Setiap pelunasan otomatis tercatat di **Cashflow** sebagai pemasukan. Nomor checkout (CKO-XXXX) tercatat terpisah dari nomor nota asli.

---

## 📊 6. Laporan Penjualan

> Panduan lengkap tersedia di halaman standalone: **[📊 Laporan Penjualan](laporan-penjualan.md)**

Pusat analisis transaksi toko dengan filter periode fleksibel dan **3 tab** terintegrasi:

| Tab | Konten |
|---|---|
| **Ringkasan** | 3 kartu metrik (Total Pendapatan, Volume Transaksi, Basket Size), Top 5 Produk Terlaris, Distribusi Metode Pembayaran |
| **Trend Produk** ⭐ | Ranking produk dengan badge tren ↑↓ vs periode sebelumnya, toggle Qty vs Revenue, bar visual perbandingan |
| **Histori Log** ⭐ | Tabel semua transaksi, pencarian by nama pelanggan / nomor invoice, expand detail item per baris, modal detail lengkap |

**Filter Periode:** Hari Ini / Kemarin / Minggu Ini / Bulan Ini / Bulan Lalu / Tahun Ini / Semua / Kustom — berlaku untuk semua tab sekaligus.

**Export:** Excel (termasuk kolom Pelanggan dan Ongkos Kirim) dan PDF ringkasan siap cetak.

---

## 📈 Laporan Laba Kotor

Analisis margin profit per produk dalam periode tertentu — tersedia di **Laporan → Laba Kotor** (`/reports/profit`).

| Kolom | Keterangan |
|---|---|
| Nama Produk / Varian | Item yang terjual pada periode tersebut |
| Total Pendapatan | Harga jual × jumlah terjual |
| Total HPP | Modal per unit × jumlah terjual |
| Laba Kotor | Pendapatan − Total HPP |
| Margin % | (Laba Kotor ÷ Pendapatan) × 100% |

**Cara menggunakan:**
1. Buka **Laporan → Laba Kotor**
2. Pilih rentang tanggal (filter dari–sampai)
3. Laporan menampilkan breakdown per produk/varian yang terjual dalam periode tersebut
4. Klik **Export Excel** untuk menyimpan laporan

> **Sumber HPP:** nilai HPP yang dipakai di laporan ini berasal dari field **Modal/HPP** yang diset di setiap varian produk. Pastikan HPP varian sudah diisi (bisa melalui Kalkulator HPP) agar laporan ini akurat.

---

## 📋 7. Laporan Tutup Shift ⭐

Fitur unggulan PosPro — sistem rekonsiliasi kas yang membantu kasir dan pemilik toko memastikan tidak ada selisih keuangan di akhir shift.

### Konsep Dasar

Sistem secara otomatis menghitung berapa uang yang **seharusnya** ada berdasarkan data transaksi. Kasir kemudian menginput berapa yang **aktualnya** ada. Sistem langsung menampilkan selisihnya.

### Cara Mengisi Form Tutup Shift

**Step 1 — Identitas Kasir**
- Pilih nama kasir dari dropdown
- Pilih jenis shift: **Shift Pagi** / **Shift Siang** / **Long Shift**

**Step 2 — Panel Kiri: "Data Sistem" (Baca Saja)**

Panel ini sudah terisi otomatis, kasir hanya perlu membacanya:

| Label | Artinya |
|---|---|
| Total Gross Shift | Total pendapatan kotor shift ini |
| Cash | Total uang tunai dari transaksi |
| Transfer BCA / Mandiri / dll | Total transfer masuk per rekening |
| QRIS | Total pembayaran via QRIS |
| Target Saldo Bank | Prediksi saldo rekening sekarang (saldo awal + masuk shift ini) |

**Step 3 — Panel Kanan: "Aktual" (Isi Oleh Kasir)**
- **Uang Tunai di Laci**: hitung fisik uang di laci kasir, lalu masukkan totalnya
- **Total QRIS Hari Ini**: buka aplikasi QRIS, lihat total mutasi masuk
- Setelah diisi, badge otomatis muncul:
  - 🟢 **LEBIH** — uang aktual lebih dari target
  - 🔴 **KURANG** — uang aktual kurang dari target
  - ✅ **BALANCE** — tepat sesuai

**Step 4 — Catat Pengeluaran Shift**

Catat semua pengeluaran yang terjadi selama shift:
- Klik **+ Tambah Item**
- Isi: keterangan (contoh: "Beli kertas HVS"), nominal, metode bayar (cash/transfer)

**Step 5 — Saldo Rekening Bank**

Buka mBanking masing-masing rekening, lalu isi:
- **Saldo di Laporan mBanking**: angka yang terlihat di aplikasi bank
- **Saldo Real**: saldo yang dikonfirmasi sudah benar-benar masuk

**Step 6 — Lampirkan Foto & Kirim**
- Upload foto bukti (foto laci uang, layar EDC QRIS, layar mBanking) — maksimal 20 foto
- Klik **Kirim Laporan Shift ke WA** → laporan terkirim otomatis ke grup WhatsApp pemilik

### Riwayat Tutup Shift ⭐

Semua laporan tutup shift tersimpan secara historis dan bisa diakses kapan saja di halaman **Riwayat Tutup Shift** (`/reports/shift-history`).

Fitur yang tersedia:
- **Lihat log** semua shift yang pernah ditutup (dengan pagination)
- **Salin pesan WA** — salin backup pesan WhatsApp yang dikirim saat tutup shift
- **Kirim ulang** — kirim ulang laporan ke grup WhatsApp jika pengiriman pertama gagal
- **Expand detail** — lihat rincian Tunai, QRIS, Transfer per rekening, dan pengeluaran per shift

> Panduan lengkap tersedia di halaman standalone: **[📜 Riwayat Tutup Shift](riwayat-shift.md)**

---

## 👥 8. Data Pelanggan

Database seluruh pelanggan toko, lengkap dengan riwayat transaksi dan statistik belanja.

**Informasi per pelanggan:**
- Nama, nomor HP, alamat
- Total pembelian sepanjang waktu
- Frekuensi belanja
- Rata-rata nilai transaksi
- Daftar transaksi terakhir

**Kegunaan:**
- Lacak pelanggan setia untuk program loyalitas
- Identifikasi pelanggan dengan piutang terbesar
- Export data pelanggan untuk kebutuhan pemasaran

---

## 🤖 9. Pengaturan WhatsApp Bot

Bot WhatsApp berjalan langsung di dalam server PosPro — tidak perlu aplikasi atau layanan pihak ketiga.

### Cara Menghubungkan Bot

1. Buka halaman **Pengaturan → WhatsApp Bot**
2. Tunggu QR Code muncul di layar
3. Di HP Anda: buka **WhatsApp → Perangkat Tertaut → Tautkan Perangkat**
4. Scan QR Code
5. Status berubah menjadi **"TERHUBUNG SEDIA"** ✅

### Cara Setup Grup Penerima Laporan

1. Buat atau buka grup WhatsApp yang akan menerima laporan (contoh: "Owner VOLIKO")
2. Tambahkan nomor WhatsApp bot ke grup tersebut
3. Ketik `!getgroupid` di grup — bot akan balas dengan ID grup
4. Salin ID tersebut (formatnya angka panjang diakhiri `@g.us`)
5. Ketik: `!botadmin setreportgroup [ID_GRUP_TADI]`
6. Bot siap mengirim laporan shift ke grup tersebut ✅

### Perintah Bot

| Perintah | Fungsi |
|---|---|
| `!getgroupid` | Tampilkan ID grup ini |
| `!botadmin status` | Cek status bot |
| `!botadmin addgroup [ID]` | Izinkan bot beroperasi di grup ini |
| `!botadmin removegroup [ID]` | Cabut izin grup |
| `!botadmin listgroups` | Lihat semua grup yang diizinkan |
| `!botadmin setreportgroup [ID]` | Atur grup tujuan laporan shift |

### Broadcast & Pengumuman

Selain laporan shift, bot WhatsApp juga mendukung dua fitur pesan massal:

**Broadcast ke Banyak Grup**
- Kirim satu pesan ke semua grup yang terdaftar di daftar `broadcastGroups` sekaligus
- Cocok untuk mengumumkan promosi, perubahan harga, atau info toko
- Konfigurasi grup broadcast via API: `POST /whatsapp/broadcast` dengan payload `{ message: "..." }`

**Announcement Channel**
- Kirim pesan ke satu saluran pengumuman khusus (`announcementChannelId`)
- Cocok untuk notifikasi internal ke tim atau channel toko
- Endpoint: `POST /whatsapp/announce` dengan payload `{ message: "..." }`

Konfigurasi `broadcastGroups[]` dan `announcementChannelId` disimpan di `backend/whatsapp_bot_config.json` (sama seperti `reportGroupId`).

> **Perbedaan Broadcast vs Report**: Broadcast mengirim ke **semua** grup di `broadcastGroups[]`, sedangkan laporan shift hanya dikirim ke **satu** `reportGroupId` yang ditentukan.

### Jika Bot Terputus

Masuk ke **Pengaturan → WhatsApp Bot**, klik **Logout & Restart Bot**, lalu scan QR Code ulang.

---

## 🎨 10. Pengaturan Tampilan Halaman Login

Pemilik toko dapat menyesuaikan tampilan halaman login agar sesuai dengan identitas brand.

Buka **Pengaturan → Tampilan Login** untuk mengakses pengaturan ini.

### Gambar Latar (Background Slideshow)

- Klik **Upload Gambar** untuk mengunggah foto (JPG, PNG, WEBP)
- Bisa upload beberapa foto sekaligus
- Foto akan tampil bergantian setiap **6 detik** dengan efek **Ken Burns** (zoom + geser halus) otomatis
- Klik ikon **×** pada thumbnail untuk menghapus gambar
- Jika tidak ada gambar yang diupload, halaman login menggunakan **gradient gelap** bawaan

### Tagline / Slogan

Teks yang berganti-ganti di bagian bawah panel kiri halaman login.

- Ketik tagline di kolom input, lalu klik **Tambah** (atau tekan Enter)
- Tagline berganti setiap **5 detik**
- Jika tidak ada tagline, tampil default: *"Solusi POS Terpadu untuk Bisnis Anda"*

### Logo & Nama Toko

Logo dan nama toko yang tampil di pojok kiri atas panel login diambil **otomatis** dari pengaturan **Profil Toko** — tidak perlu diatur ulang di sini.

> Setelah mengubah gambar atau tagline, klik **Simpan Perubahan** agar tersimpan.

---

## ❓ FAQ Umum

**Q: Apakah PosPro bisa dipakai di HP?**
> Ya. Tampilan responsif untuk layar HP, tablet, dan PC. Untuk kasir aktif, tablet atau PC lebih nyaman digunakan.

**Q: Apakah data tersimpan secara online atau lokal?**
> Data tersimpan di database server lokal milik toko (MySQL). Anda memiliki kendali penuh atas data sendiri.

**Q: Apakah bisa multi-kasir (lebih dari satu perangkat)?**
> Ya — karena berbasis web, beberapa perangkat bisa login dan mengakses PosPro secara bersamaan dari jaringan yang sama.

**Q: Apakah ada fitur laporan pajak?**
> PosPro mendukung PPN pada Invoice & Penawaran Harga. Untuk laporan pajak formal, gunakan fitur export Excel dan olah di aplikasi akuntansi Anda.

**Q: Bagaimana cara menambah akun kasir baru?**
> Login sebagai Admin → buka **Pengaturan → Manajemen User** → klik **+ Tambah User** → isi nama, email, dan password.

---

## 📚 Halaman Wiki Lanjutan

Dokumentasi lengkap untuk fitur-fitur bisnis tingkat lanjut:

| Wiki | Isi |
|---|---|
| [🔄 Alur Bisnis](alur-bisnis.md) | **Mulai dari sini** — setup awal, alur harian, alur produksi, review keuangan |
| [📜 Riwayat Tutup Shift](riwayat-shift.md) | Log historis shift, backup pesan WA, kirim ulang laporan |
| [💰 Cashflow Bisnis](cashflow.md) | Arus kas, chart tren, kategorisasi, export Excel |
| [📊 Laporan Stok](laporan-stok.md) | Pergerakan stok per periode, filter IN/OUT/ADJUST, export CSV |
| [📄 Invoice & Penawaran Harga](invoice-sph.md) | Invoice B2B, SPH, catalog picker, area-based pricing |
| [🗺️ Peta Cuan Lokasi](peta-cuan.md) | Peta cabang, kompetitor, pencarian bisnis by keyword |
| [🖨️ Antrian Produksi](produksi.md) | Antrian cetak, batch, produk rakitan multi-tahap, search pelanggan, detail invoice |
| [📋 Stok Opname](stock-opname.md) | Link operator blind count, review admin, update stok otomatis |
| [🏭 Data Supplier](suppliers.md) | Kelola supplier dan harga beli per varian produk |
| [💾 Backup & Restore](backup.md) | Backup database ke ZIP, auto-backup via Rclone, restore |
| [🧮 Kalkulator HPP](hpp-calculator.md) | Worksheet biaya produksi, multi-varian, biaya tambah, simpan sebagai produk |
| [🚀 Panduan Deployment Cloudflare](deployment.md) | Setup produksi di Home Server (MySQL, PM2, Cloudflare Tunnel) |

---

*Dokumentasi PosPro — Terakhir diperbarui: 16 April 2026 | v4.0 — Metode KREDIT & Bayar Nanti, Tab DP/Kredit/Bayar Nanti, Pelunasan fleksibel (kasir + waktu), Riwayat Tutup Shift, Rclone Auto-Backup, Pengeluaran Terstruktur per Shift*
