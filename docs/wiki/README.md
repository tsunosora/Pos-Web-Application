# 📖 Wiki — PosPro: Aplikasi Kasir & Manajemen Bisnis Berbasis Web

> Selamat datang di dokumentasi lengkap **PosPro** — panduan ini ditujukan untuk siapa saja yang ingin memahami, menggunakan, atau mengembangkan aplikasi ini, mulai dari kasir toko hingga pemilik bisnis.

---

## Apa itu PosPro?

**PosPro** adalah aplikasi kasir berbasis web yang dirancang untuk bisnis modern — percetakan digital, toko kelontong, kafe, konveksi, atau usaha jasa lainnya. Tidak perlu install aplikasi tambahan, cukup buka browser dan langsung bisa digunakan.

Yang membedakan PosPro dari kasir biasa adalah **ekosistemnya yang lengkap**: bukan hanya mencatat penjualan, tapi juga mengelola stok, membuat penawaran harga profesional ke klien perusahaan, melacak arus kas, memetakan posisi kompetitor, dan mengirim laporan otomatis ke grup WhatsApp pemilik toko.

---

## Daftar Isi Wiki

| # | Halaman | Ringkasan |
|---|---|---|
| 1 | [Login & Dashboard](#-1-login-ke-aplikasi) | Cara masuk dan membaca ringkasan bisnis harian |
| 2 | [Kasir / POS](#-3-kasir--point-of-sale-pos) | Cara melayani pelanggan dan mencatat transaksi |
| 3 | [Manajemen Produk & Stok](#-4-manajemen-produk--stok) | Cara kelola produk, varian, foto, dan stok |
| 4 | [DP / Piutang](#-5-daftar-dp--piutang) | Melacak pelanggan yang belum lunas |
| 5 | [Laporan Penjualan](#-6-laporan-penjualan) | Riwayat semua transaksi dengan filter tanggal |
| 6 | [Laporan Tutup Shift](#-7-laporan-tutup-shift-) | Rekonsiliasi kas dan rekening bank akhir shift |
| 7 | [Data Pelanggan](#-8-data-pelanggan) | Database & riwayat belanja pelanggan |
| 8 | [WhatsApp Bot](#-9-pengaturan-whatsapp-bot) | Setup bot laporan otomatis ke grup WA owner |
| 9 | [💰 Cashflow Bisnis](cashflow.md) | Arus kas pemasukan & pengeluaran, chart, export |
| 10 | [📄 Invoice & Penawaran Harga](invoice-sph.md) | Buat invoice & SPH profesional untuk klien B2B |
| 11 | [🗺️ Peta Cuan Lokasi](peta-cuan.md) | Peta cabang, kompetitor, dan pencarian bisnis |
| 12 | [🎨 Tampilan Login](#-10-pengaturan-tampilan-halaman-login) | Upload foto latar, atur tagline, animated logo |
| 13 | [🖨️ Antrian Produksi](produksi.md) | Antrian cetak, job satuan & batch, produk rakitan multi-tahap, search, detail invoice 🆕 |
| 14 | [📋 Stok Opname](stock-opname.md) | Hitung fisik stok via link operator untuk karyawan 🆕 |

---

## 🔐 1. Login ke Aplikasi

Buka browser dan akses alamat aplikasi (contoh: `http://localhost:3000`).

- **Email**: masukkan email akun Anda (contoh: `admin@toko.com`)
- **Password**: masukkan kata sandi

Klik **Sign In**. Jika berhasil, Anda akan masuk ke halaman Dashboard.

> **Lupa password?** Hubungi administrator toko untuk mereset akun Anda.

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
- Untuk produk **Digital Printing** (banner, sticker, MMT): masukkan ukuran lebar dan tinggi dalam meter — harga otomatis dihitung per m²
- Klik ikon tempat sampah untuk menghapus item dari keranjang

**Langkah 3 — Pilih Metode Pembayaran**
- **Tunai (Cash)**: masukkan nominal yang diterima, sistem otomatis hitung kembalian
- **Transfer Bank**: pilih rekening tujuan transfer yang diinginkan pelanggan
- **QRIS**: tampilkan QR code ke pelanggan untuk dipindai

**Langkah 4 — Selesaikan Transaksi**
- Klik **Bayar Lunas** untuk pembayaran penuh
- Klik **Bayar DP** jika pelanggan hanya membayar sebagian (uang muka) — transaksi akan masuk ke daftar Piutang

**Langkah 5 — Struk**
- Setelah transaksi selesai, struk muncul otomatis
- Klik **Cetak** untuk mencetak ke printer thermal
- Klik **Kirim WA** untuk mengirim ringkasan tagihan ke WhatsApp pelanggan

> **Tips**: Untuk toko percetakan digital, produk dengan mode **Area Based** akan otomatis memunculkan input Lebar × Tinggi saat ditambahkan ke keranjang.

---

## 📦 4. Manajemen Produk & Stok

Halaman untuk mengelola semua produk, varian, bahan baku, dan stok yang dijual di toko.

### Yang Bisa Dilakukan

**Menambah Produk Baru**
1. Klik **+ Tambah Produk**
2. Isi nama, kategori, satuan, dan harga jual
3. Pilih **Mode Harga**:
   - **Normal (per unit)**: untuk produk yang dijual per pcs, lusin, kg, dll
   - **Area Based (per m²)**: untuk banner, sticker, MMT, kain — harga dihitung dari lebar × tinggi
4. Upload foto produk (opsional tapi direkomendasikan)
5. Tambahkan **Varian** jika produk memiliki pilihan ukuran/warna/jenis
6. Tambahkan **Bahan Baku** jika ingin stok bahan baku otomatis terpotong saat produk terjual
7. Klik **Simpan**

**Mengelola Stok**
- Stok terpotong **otomatis** setiap kali ada transaksi di kasir
- Untuk penambahan stok (restock), buka produk → klik **Tambah Stok** → masukkan jumlah
- Semua pergerakan stok tercatat di **Riwayat Stok** (masuk, keluar, penyesuaian)

**Varian Produk**

Cocok untuk produk yang punya variasi. Contoh:
- Kaos → Varian: S, M, L, XL (stok dan harga bisa berbeda per varian)
- Tinta Printer → Varian: Hitam, Cyan, Magenta, Yellow

---

## 💳 5. Daftar DP / Piutang

Daftar semua transaksi yang **belum sepenuhnya dilunasi** oleh pelanggan.

Ini muncul ketika kasir memilih **Bayar DP** saat bertransaksi — artinya pelanggan baru membayar sebagian dan masih punya sisa tagihan.

### Informasi yang Ditampilkan

| Kolom | Keterangan |
|---|---|
| Nama Pelanggan | Siapa yang punya piutang |
| Total Tagihan | Harga total transaksi |
| Sudah Dibayar | Jumlah DP yang sudah masuk |
| Sisa Tagihan | Yang masih harus dilunasi |
| Jatuh Tempo | Deadline pelunasan |

### Cara Mencatat Pelunasan

Saat pelanggan datang untuk melunasi:
1. Cari nama pelanggan di daftar piutang
2. Klik tombol **Lunasi**
3. Pilih metode pembayaran pelunasan
4. Klik **Konfirmasi** — sistem otomatis mencatat pembayaran dan mengupdate sisa tagihan

> Setiap pelunasan otomatis tercatat di **Cashflow** sebagai pemasukan.

---

## 📊 6. Laporan Penjualan

Ringkasan lengkap semua transaksi yang pernah terjadi, bisa difilter berdasarkan rentang tanggal.

**Yang tersedia:**
- Filter tanggal (pilih dari–sampai)
- Detail setiap transaksi: waktu, kasir, item terjual, metode bayar, total
- Tombol **Cetak Ulang Struk** untuk transaksi lama
- **Export ke Excel** untuk laporan eksternal atau pembukuan manual

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
| [💰 Cashflow Bisnis](cashflow.md) | Arus kas, chart tren, kategorisasi, export Excel |
| [📄 Invoice & Penawaran Harga](invoice-sph.md) | Invoice B2B, SPH, catalog picker, area-based pricing |
| [🗺️ Peta Cuan Lokasi](peta-cuan.md) | Peta cabang, kompetitor, pencarian bisnis by keyword |
| [🖨️ Antrian Produksi](produksi.md) | Antrian cetak, batch, produk rakitan multi-tahap, search pelanggan, detail invoice 🆕 |
| [📋 Stok Opname](stock-opname.md) | Link operator blind count, review admin, update stok otomatis 🆕 |
| [🚀 Panduan Deployment Cloudflare](deployment.md) | Setup produksi di Home Server (MySQL, PM2, Cloudflare Tunnel) |

---

*Dokumentasi PosPro — Terakhir diperbarui: 9 Maret 2026*
