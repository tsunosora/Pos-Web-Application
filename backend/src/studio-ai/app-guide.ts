// Basis pengetahuan "cara pakai aplikasi" untuk Asisten AI.
// DIBUAT OTOMATIS oleh: npm run gen:guide  (jangan edit tangan).
// Sumber: frontend/src/app/help/page.tsx — regenerasi bila halaman /help berubah.
export const APP_GUIDE = `## Setup Pertama Kali
- **Profil Toko — /settings/general** — Isi nama toko, alamat, telepon, upload logo. Atur tarif PPN dan PIN Operator untuk akses halaman Produksi.
- **Akun Pengguna — /settings/users** — Buat akun untuk setiap kasir/staf. Role: Admin, Manager, Kasir, Owner.
- **Rekening Bank — /settings/bank-accounts** — Daftarkan rekening bank untuk menerima transfer. Masing-masing muncul sebagai pilihan di kasir.
- **Produk & Inventori — /inventory** — Buat kategori produk, input semua produk (biasa atau Area Based untuk cetak). Set HPP setiap varian agar laporan laba akurat.
- **Supplier — /inventory/suppliers (opsional)** — Input data supplier dan harga beli per varian produk.
- **Notifikasi Discord — /settings/discord** — Isi webhook URL per channel untuk tiap cabang (penjualan, produksi, keuangan, dll) — laporan shift, lead, SO, dan stok terkirim otomatis ke Discord.

## Login & Dashboard

## Kasir / POS

### Cara Bertransaksi
- **Cari & Tambah Produk** — Ketik nama produk di kotak pencarian, atau scan barcode (klik ikon kamera). Klik produk untuk masuk keranjang.
- **Atur Keranjang** — Klik +/− untuk ubah jumlah. Produk Area Based otomatis menampilkan modal input Lebar × Tinggi. Produk bertanda ∞ bisa ditambah tanpa batas.
- **Atur Tagihan (Opsional)**
- **Pilih Metode Pembayaran** — Tunai, Transfer Bank, QRIS, KREDIT (nota kredit tanpa DP), atau BAYAR NANTI (simpan tanpa bayar).
- **Isi Data Pelanggan** — Ketik nama atau HP — dropdown dari database muncul otomatis. Pelanggan baru tersimpan otomatis.
- **Selesaikan Transaksi** — Klik Konfirmasi Lunas / Konfirmasi DP / Simpan Nota Kredit / Simpan Invoice. Struk muncul otomatis — bisa cetak atau kirim WA.

### Metode Pembayaran
- [KREDIT vs DP] DP = pelanggan sudah bayar sebagian. KREDIT = belum ada pembayaran sama sekali, hanya nota + jatuh tempo.

### Produk Digital Printing (Area Based)

### Potongan Platform / Marketplace Fee
- **Gulir ke bagian Potongan Platform di form checkout** — Klik + Tambah Potongan.
- **Isi nama platform dan nominal**
- **Preview Nett muncul otomatis** — Diterima (nett) = Grand Total − Total Potongan.
- **Konfirmasi Transaksi** — Cashflow tercatat: INCOME sebesar nett yang diterima + EXPENSE Biaya Platform terpisah.
- [Cashflow Split Otomatis] Potongan marketplace TIDAK mengurangi Grand Total nota — harga closing ke pelanggan tetap utuh. Yang berubah hanya cashflow: income masuk sebesar yang benar-benar diterima, expense Biaya Platform dicatat terpisah.

### Struk & Setelah Transaksi

## Manajemen Produk & Stok

### Tipe Produk

### Cara Tambah Produk
- **Klik + Tambah Produk** — Tombol di pojok kanan atas.
- **Isi nama, kategori, satuan, harga jual** — Pilih mode harga: Normal (per unit) atau Area Based (per m²/cm²/menit).
- **Atur Lacak Stok** — Aktif: stok terpotong otomatis. Nonaktif (∞): produk/jasa tanpa kontrol stok.
- **Upload foto produk (opsional)** — Format JPG, PNG, WEBP, JFIF.
- **Tambahkan Varian (jika ada pilihan)** — Ukuran, warna, jenis — stok dan harga bisa berbeda per varian.
- **Tambahkan Bahan Baku (BOM)** — Stok bahan otomatis terpotong saat produk terjual.
- **Klik Simpan** — 

### Harga Bertingkat (Price Tiers)

### Aksi di Kolom Tabel Inventori

### Pembelian Bahan Baku
- **Inventori → klik tombol Pembelian (hijau)** — 
- **Pilih Supplier (opsional)** — Harga beli terisi otomatis dari data supplier.
- **Isi No. Invoice & Catatan** — 
- **Cari dan tambahkan produk ke keranjang** — Atur jumlah dan harga beli per item.
- **Klik Simpan Pembelian** — Stok semua item bertambah sekaligus.

### Impor Massal (Bulk Import)
- **Inventori → klik Import Excel** — 
- **Download Template** — File Excel dengan contoh dan panduan kolom.
- **Isi data produk** — Nama, kategori, varian, harga, HPP, stok.
- **Upload file → lihat preview validasi** — 
- **Klik Impor** — Produk valid tersimpan; error per baris ditampilkan.

### Stok Opname

### Data Supplier — /inventory/suppliers

## Produk Custom (Buku & Konfigurasi)

### Cara Kerja Buku Custom
- **Dirakit dari 3 bagian** — ISI (cetak kertas per lembar A3, bahan bebas) + COVER (cetak 1 lembar) + JILID (finishing).
- **Ukuran & bahan** — Ukuran A6 / A5 / A4 / A3. Bahan isi & cover bebas (Art Paper, HVS, Ivory/Art Cartoon, dll).
- **Finishing** — Spiral / Steples / Binding Lem / Steples+Lakban.
- **Konversi halaman → lembar A3 (cetak bolak-balik)** — A3=2, A4=4, A5=8, A6=16 halaman per lembar. Lembar A3 isi = ceil(jumlah halaman ÷ angka tsb).
- **Rumus harga** — Harga = (lembar A3 × harga cetak isi) + (harga cetak cover) + (harga jilid).
- [Contoh Hitung] A5, 40 halaman, isi Art Paper 150, cover Ivory 260, jilid Spiral ≈ Rp37.000. Lembar A3 isi = ceil(40 ÷ 8) = 5 lembar.

### Cara Order di POS
- **Pilih produk Buku Custom** — Muncul form konfigurasi (ukuran / halaman / bahan / finishing) → harga otomatis.
- **Bila konfigurator nonaktif** — Rakit manual: Cetak Isi ×N + Cetak Cover ×1 + Jilid ×1.

### Aktif / Nonaktifkan Konfigurator
- [Untuk Asisten AI] Saat customer tanya harga buku/makalah/laporan: tanyakan ukuran, jumlah halaman, bahan isi & cover, dan finishing — lalu hitung dengan rumus di atas.

## DP & Piutang

### Tab Filter

### Informasi per Nota

### Cara Mencatat Pelunasan
- **Cari pelanggan di daftar piutang** — Gunakan tab filter atau search.
- **Klik tombol Bayar → pilih Lunas Penuh** — 
- **Isi Nominal Diterima (opsional)** — Untuk menghitung kembalian.
- **Isi Potongan Platform jika ada (opsional)**
- **Pilih Metode Pembayaran, Kasir & Waktu Checkout** — Waktu bisa dibackdate.
- **Klik Proses Pelunasan** — Sistem update sisa tagihan, catat ke Cashflow sebagai INCOME + EXPENSE Biaya Platform (jika ada fee).

## Laporan Penjualan

## Tutup Shift
- **Identitas Kasir** — Pilih nama kasir dan jenis shift (Pagi / Siang / Long Shift).
- **Panel Kiri — Data Sistem (Baca Saja)** — Total pendapatan, rincian per metode bayar, dan Target Saldo Bank sudah terisi otomatis.
- **Panel Kanan — Aktual (Isi Kasir)** — Hitung uang di laci → isi Uang Tunai. Buka aplikasi QRIS → isi total QRIS. Badge LEBIH/KURANG/BALANCE muncul otomatis.
- **Catat Pengeluaran Shift** — Klik + Tambah Item → isi keterangan, nominal, metode bayar.
- **Saldo Rekening Bank** — Buka mBanking masing-masing rekening → isi saldo aktual.
- **Lampirkan Foto & Kirim** — Upload foto bukti (laci, QRIS, mBanking) maks. 20 foto. Klik Kirim Laporan Shift ke Discord.

## Cashflow Bisnis

## Laporan Laba Kotor

## Laporan Stok

## Leaderboard Kinerja

## Metrik Produk Custom ⭐

### Cara membuat
- **Buka Owner Dashboard**
- **Isi Nama & Label** — Nama = keterangan internal (mis. Roll Up Banner F340). Label = teks pendek yang muncul sebagai judul kolom di leaderboard (mis. Roll Up).
- **Pilih Cara Hitung** — PCS (default), QTY, OMZET, atau NOTA — menentukan angka apa yang muncul di kolom.
- **Pilih Tampil di Leaderboard** — Centang CS, Designer, dan/atau Operator — kolom hanya muncul di divisi yang dipilih.
- **Pilih Produk / Varian dari Inventori** — Cari & centang varian yang ingin dilacak. Tiap varian dihitung terpisah (karena namanya beda) — mis. hanya varian F340, bukan F300.
- **Simpan** — Kolom langsung muncul di /leaderboard pada divisi yang dipilih. Bisa diedit, dinonaktifkan, atau dihapus kapan saja.

### Cara hitung (countMode)

### Atribusi ke siapa
- [Tiap varian = produk berbeda] Karena nama varian berbeda, tiap varian diperlakukan sebagai item tersendiri. Pilih varian yang tepat — hanya varian yang dicentang yang dihitung.
- [Aturan lanjutan (opsional)] Selain memilih varian, bisa juga mencocokkan berdasarkan kategori atau kata kunci nama (mis. “jersey”) lewat bagian “Aturan lanjutan”. Cocok bila produknya banyak dan ingin cakupan luas.

## Antrian Produksi
- [Cara Akses Operator] Buka /produksi → masukkan PIN Operator. Session aktif 24 jam. PIN diatur di Pengaturan → Umum → kolom PIN Operator.

### Status Job

### Mode 1 — Cetak Satuan (per Job)
- **Klik ▶ Mulai pada job** — Dialog muncul — pilih bahan roll, atau centang Pakai Waste jika memakai sisa bahan.
- **Luas Bahan (m²) otomatis terhitung** — Bisa diubah manual jika perlu.
- **Klik Mulai Cetak** — Status berubah ke PROSES + stok roll terpotong.
- **Setelah selesai, klik ✓ Selesai** — Produk biasa → SELESAI. Produk rakitan → MENUNGGU PASANG.
- **Di tab SELESAI, klik 📦 Diambil** — Saat pelanggan mengambil pesanan.

### Mode 2 — Gabung Cetak (Batch)
- **Klik Gabung Cetak (kanan atas)** — 
- **Centang job-job yang ingin digabung** — Hanya job berstatus ANTRIAN.
- **Pilih bahan roll atau centang Pakai Waste** — Total luas (m²) tampil otomatis.
- **Klik Buat Batch** — Nomor batch dibuat (misal: BATCH-0001), semua job masuk PROSES.
- **Klik ✓ Selesai Batch** — Semua job dalam batch berubah ke SELESAI.

### Setup Produk Cetak
- **Edit produk → mode harga = Area Based** — 
- **Centang Perlu Proses Produksi** — Setiap penjualan produk ini akan membuat job di antrian produksi.
- **Centang Produk Rakitan (jika ada tahap pasang)** — Contoh: Standing Banner, Neon Box. Tambahkan komponen BOM di bagian Ingredient.
- **Daftarkan Bahan Roll sebagai varian RAW_MATERIAL** — Centang 'Bahan Roll', isi lebar fisik dan lebar efektif cetak.

### Pemotongan Stok

### Prioritas & Deadline

### Pipeline Produksi — /produksi/pipeline

### Filter Pipeline

## Invoice & Penawaran Harga (SPH)

### Invoice vs SPH

### Alur Kerja Umum
- **Buat SPH** — Isi data klien (nama, perusahaan, alamat, email), tambah item dari katalog atau manual, set masa berlaku.
- **Cetak PDF & Kirim ke Klien** — 
- **Klien Setuju?**
- **Tagih Pembayaran** — Invoice dicetak ulang dan dikirim ke klien.

### Status Dokumen

## CRM — Lead Pipeline & Follow-Up

### 4 Halaman CRM

### Status Lead

### Alur Order CS & Desainer (Satu Pintu)
- [Prinsip Satu Pintu — CS pemilik lead] Setiap calon order = 1 lead , dan CS yang memegangnya . Desainer boleh ikut (cek desain / bikin SO), tapi pekerjaannya menempel ke lead CS — bukan bikin data paralel. Jadi tidak ada lead dobel . Semua order berakhir di titik yang sama: nota dibuat di KASIR (POS) biar formatnya seragam.

### Cek Desain (pra-jual) — kerja tim CS & Desainer

### 3 Jalur Order (siapa pertama pegang customer)
- [Anti lead/nota dobel — otomatis] Saat desainer menekan &quot;SO jadi Lead&quot; , sistem cek nomor HP dulu : kalau customer sudah punya lead CS yang aktif, SO otomatis ditempel ke lead itu (jadi Negosiasi) — tidak bikin lead baru . Jadi tabrakan &quot;CS sudah bikin lead, lalu desainer bikin lagi&quot; sudah tertangani sendiri. Untuk SO yang dibuat di tempat lain, CS juga bisa pakai tombol Tautkan SO di detail lead.

### Langkah CS di jalur C (Lead Order)
- **Lead muncul otomatis di /crm/leads** — Desainer menekan Lead Order — lead langsung berstatus Negosiasi, level HOT, estimasi harga terisi dari item SO. Notif masuk ke Discord #penjualan.
- **CS follow-up seperti biasa** — Chat customer, catat aktivitas, naik-turunkan status. Kotak ungu “Tertaut ke Sales Order” tampil di detail lead.
- **Deal → klik “🧾 Buat Nota di POS”** — POS terbuka dengan cart ter-prefill dari SO. Checkout seperti transaksi biasa.
- **Selesai otomatis** — Lead jadi CLOSED_WON menunjuk nota itu, SO jadi INVOICED. CS dapat closing, desainer dapat omzet — tanpa nota dobel.

### Tombol closing di detail lead
- [Link Nota di Detail Lead] Setelah lead diconvert ke nota produksi, panel detail lead menampilkan tautan langsung ke nota — klik Lihat Nota #ID untuk membuka nota transaksi. Riwayat aktivitas lead juga mencatat link nota untuk audit trail.

### Follow-Up Otomatis

### Sales Order & Designer Portal

### Leaderboard Tim — lihat performa CS & Desainer

## Notifikasi: Discord & WhatsApp Bot

### Discord (utama)
- **Buka Pengaturan → Discord** — Aktifkan master toggle notifikasi.
- **Isi webhook URL per channel untuk tiap cabang** — Channel: penjualan, produksi, keuangan, inventory, leaderboard, system. Buat webhook dari Discord: Server Settings → Integrations → Webhooks.
- **Klik Test per channel** — Pastikan pesan test masuk ke channel yang benar. Event cabang hanya terkirim ke webhook cabang itu.

### WhatsApp Bot (opsional — nonaktif default)
- [Bot WA dinonaktifkan secara default] Sejak notifikasi pindah ke Discord, bot WhatsApp tidak dijalankan otomatis. Untuk mengaktifkan kembali: set WHATSAPP_ENABLED=true di file .env backend lalu restart server.

### Cara Menghubungkan
- **Buka Pengaturan → WhatsApp Bot** — 
- **Tunggu QR Code muncul di layar** — 
- **Di HP: WhatsApp → Perangkat Tertaut → Tautkan Perangkat** — 
- **Scan QR Code** — Status berubah menjadi TERHUBUNG SEDIA ✅.

### Setup Grup Laporan
- **Tambahkan nomor bot ke grup WhatsApp** — Contoh grup: 'Owner VOLIKO'.
- **Ketik !getgroupid di grup** — Bot balas dengan ID grup (format angka panjang diakhiri @g.us).
- **Ketik !botadmin setreportgroup [ID_GRUP]** — Bot siap mengirim laporan shift ke grup tersebut ✅.

### Perintah Bot
- [Jika Bot Terputus] Masuk ke Pengaturan → WhatsApp Bot → klik Logout & Restart Bot → scan QR Code ulang.
- [Broadcast vs Laporan Shift] Broadcast mengirim ke semua grup di broadcastGroups[] . Laporan Shift hanya ke satu reportGroupId .

## WhatsApp CRM (Cloud API resmi Meta)
- [Beda dengan “WhatsApp Bot” lama] Modul ini resmi & terpisah dari bot lama (scan QR, untuk notifikasi Discord/grup). WhatsApp CRM ini pakai nomor bisnis terdaftar di Meta, stabil, dan tidak perlu HP menyala.

### Alur pesan masuk (otomatis)
- **Pelanggan chat ke nomor bisnis** — Pesan dikirim Meta ke server via Webhook (sudah diverifikasi + tanda tangan diperiksa).
- **Diarahkan ke channel/cabang** — Berdasarkan phone_number_id → cocokkan ke Channel WA cabang.
- **Tautkan / auto-buat Lead** — Nomor dicocokkan ke Lead (dedup by HP); kalau belum ada & fitur aktif → Lead baru status NEW sumber WHATSAPP.
- **Auto-reply (opsional)** — Jika ada aturan cocok (kata kunci / salam / di luar jam) → balasan otomatis.
- **Muncul di Inbox** — Percakapan tampil dengan penanda belum dibaca; media diarsipkan ke server.

### Inbox Chat — balas & kelola percakapan
- [Jendela layanan 24 jam (aturan Meta)] Dalam 24 jam sejak pesan terakhir pelanggan, Anda bebas balas teks/media. Di luar 24 jam , hanya bisa mengirim template yang sudah di- APPROVED Meta.

### Template Pesan Meta — /crm/whatsapp/templates
- **Buat template**
- **Isi keterangan tiap variabel** — Form otomatis mendeteksi variabel → beri keterangan (mis. Nama pelanggan) + contoh nilai (wajib agar lolos review).
- **Submit ke Meta** — Status jadi PENDING → tunggu review (menit–jam) → APPROVED.
- **Sinkron status** — Tombol Sinkron menarik status terbaru dari Meta.
- [Kategori template] UTILITY (transaksional: pesanan siap, tagihan) — murah. MARKETING (promo) — lebih mahal. AUTHENTICATION (OTP).

### Broadcast — /crm/whatsapp/broadcast

### Reminder POS otomatis — /crm/whatsapp/reminders

### Auto-reply — /crm/whatsapp/auto-reply

### Analitik, Biaya & Kecepatan Balas CS — /crm/whatsapp/analytics

### Penyimpanan Media — /crm/whatsapp/settings
- [Kenapa perlu arsip] Meta hanya menyimpan file media ±30 hari. Arsip lokal memastikan gambar/dokumen lama tetap bisa dibuka.

### Pengaturan Channel & Profil Bisnis — /crm/whatsapp/settings

### Integrasi ke Leaderboard CS

### Peran & akses

### Setup awal (sekali — Owner/Admin)
- **Meta App + produk WhatsApp** — Buat WABA, daftarkan nomor bisnis (verifikasi OTP).
- **Token & rahasia** — Isi WA_ACCESS_TOKEN (System User, permanen), WA_APP_SECRET, WA_VERIFY_TOKEN, WA_APP_ID di .env server; set WA_CLOUD_ENABLED=true.
- **Webhook**
- **Daftarkan Channel + Verifikasi Bisnis + Pembayaran** — Tambah Channel per cabang; selesaikan Business Verification & metode pembayaran di Meta agar bisa kirim ke semua pelanggan.
- [Tips penting] Gunakan token permanen (System User, Never expire) — token 24 jam akan mati. Buat template UTILITY dulu (murah & cepat approve) untuk reminder pesanan.

## Multi-Cabang

### Role dalam Multi-Cabang

### Data yang Terpisah per Cabang

### Titip Cetak Antar Cabang
- **Kasir cabang A buat transaksi dengan toggle Titipkan ke Cabang Lain** — Pilih cabang pelaksana yang akan mengerjakan.
- **Notifikasi popup muncul di cabang pelaksana** — Halaman /titipan-masuk menampilkan order masuk.
- **Operator klik Terima & Kerjakan** — Job masuk antrian /produksi di cabang pelaksana.
- **Cashflow & ledger antar cabang tercatat otomatis** — Buku Titipan — /branch-ledger.

### Buku Titipan — /branch-ledger

## Pengaturan & Admin

### Profil Toko — /settings/general

### Manajemen User — /settings/users

### Tampilan Login — /settings/login

### Backup & Restore — /settings/backup
- **Pilih grup data → klik Export Backup** — Sistem generate file ZIP berisi dump database MySQL + foto (proof SO, gambar lead, dll) — download otomatis. Grup data bisa dipilih sebagian (mis. hanya transaksi & CRM).
- **Simpan file ZIP di tempat aman** — Bisa di cloud, USB, atau storage eksternal.
- **Auto-Backup Server via Rclone** — Konfigurasi di bagian bawah halaman Backup — jadwal cron, jumlah file yang disimpan, dan remote tujuan (Google Drive dll). Status & daftar file backup lokal tampil di halaman yang sama, plus notifikasi hasil backup ke Discord.
- **Restore mandiri dari halaman yang sama** — Upload/drag file backup (.zip/.sql) → sistem tampilkan preview isi per tabel → pilih tabel yang mau direstore → pilih mode Skip Existing (aman) atau Overwrite (hapus & tulis ulang) → konfirmasi. Foto & konfigurasi ikut dipulihkan dari file ZIP.

### Kalkulator HPP — /reports/hpp
- **+ Buat Worksheet Baru** — Pilih produk yang ingin dihitung HPP-nya.
- **Input biaya variabel (bahan baku)** — Pilih dari stok atau input manual. Mode Lebar × Tinggi (m²) tersedia untuk bahan lembaran.
- **Input biaya tetap** — Listrik, sewa, gaji — isi nama + nominal bulanan + target produksi per bulan.
- **Multi-Varian (opsional)** — Hitung HPP beberapa ukuran sekaligus, tambah biaya finishing per ukuran (laminasi, cutting).
- **Simpan hasil** — Daftarkan sebagai produk baru ATAU terapkan ke varian yang sudah ada.

### Peta Cuan Lokasi — /maps

## FAQ & Troubleshooting
- **Pelanggan Datang / Menghubungi** — Via WhatsApp, Instagram, datang langsung ke toko, atau dari marketplace
- **CS Follow-Up & Negosiasi** — Lead dicatat (manual oleh CS, atau otomatis dari tombol Lead Order desainer), CS di-assign, follow-up dijadwalkan. Status: Baru → Follow Up → Negosiasi
- **Deal! Kasir Input Transaksi** — Lead di-convert → transaksi terbuat otomatis. Atau nota dibuat dari SO desainer (POS → Buat dari SO; lead yang tertaut otomatis closing). Atau kasir input manual di POS.
- **Nota Terbit & Pembayaran Dicatat** — Struk dicetak / dikirim WA. Cashflow terbuat otomatis. DP → status Belum Lunas, bisa dilunasi kapan saja.
- **Job Cetak Masuk Produksi** — Untuk produk cetak, job antrian terbuat otomatis. Operator buka halaman Produksi, masukkan bahan roll, mulai cetak.
- **Proses Produksi Bertahap** — Admin geser card di Pipeline Kanban sesuai progres. Foto bukti design bisa diupload di tahap DESIGN.
- **Packing & Pengiriman / Pickup** — Barang selesai, di-packing, dikirim atau diambil pelanggan. Upload foto bukti kirim untuk konfirmasi.
- **After Sales & Repeat Order** — Sistem otomatis jadwalkan follow-up 3 hari setelah pickup. CS hubungi pelanggan → peluang repeat order!

## Alur Sistem PosPro

### Siapa Pakai Apa?

### Alur Transaksi — dari Pertama Hubungi sampai Selesai

### Tahapan Pipeline Produksi

### Alur Keuangan
- [Mulai dari Mana?] Bagi pengguna baru: setup Produk & Stok dulu → coba Transaksi pertama di Kasir → cek hasilnya di Laporan Penjualan . Tiga langkah itu sudah cukup untuk operasional dasar hari pertama.

## Cetak Nota Thermal 58mm

### Cara Mengaktifkan
- **Pilih format Thermal 58mm**
- **Pilih metode koneksi printer** — Sesuaikan dengan perangkat kamu — lihat tabel di bawah.
- **Cetak** — Struk otomatis dirender dan dikirim ke printer thermal.

### Metode Koneksi Printer
- [Safari / iOS] Web Bluetooth tidak didukung di Safari iOS . Untuk iPhone/iPad, gunakan Aplikasi Desktop, Printer Relay, atau fallback browser.
- [Nota panjang] Struk dengan banyak item dikirim sebagai gambar raster yang bisa berukuran besar — sistem sudah menaikkan batas ukuran kiriman agar nota panjang tidak gagal terkirim.

## Aplikasi Desktop (Offline)
- [Kapan pakai versi desktop?] Untuk kasir yang harus tetap jalan meski internet putus, atau cabang dengan koneksi tidak stabil. Versi web/PWA tetap tersedia dan berbagi data yang sama.

### Cara Kerja Offline
- [Selalu konsisten] Stok & data keluar-masuk dijaga konsisten dua arah: setiap operasi diberi penanda unik sehingga tidak terhitung ganda walau sinkron diulang, dan nilai stok otoritatif dari pusat dikembalikan ke tiap perangkat.

### Pemasangan Pertama (First-Run)
- **Install aplikasi** — Jalankan installer .exe. Database & backend sudah dibundel di dalamnya — tidak perlu install terpisah.
- **Daftarkan perangkat ke pusat** — Masukkan alamat server pusat + token pendaftaran (dari Owner). Perangkat mendapat device token permanen — aman meski database di-reset.
- **Data awal terunduh** — Produk, user, dan master data ditarik dari pusat. Setelah ini login & transaksi jalan penuh tanpa internet.

### Backup, Recovery & Reset
- [Sinkron sebelum perangkat hilang] Transaksi yang dibuat offline baru benar-benar aman setelah tersinkron ke pusat . Pastikan perangkat online secara berkala agar data tidak hilang bila komputer rusak atau hilang.

### Jadikan Pusat Cetak (1 printer untuk banyak kasir)
- **Buat token printer di pusat**
- **Isikan token di PC printer**
- **Kasir lain langsung cetak** — Di device kasir lain, pilih metode Aplikasi Desktop/Printer Relay — nota tercetak di printer PC pusat.
- [Syarat] PC pusat cetak harus menyala dan aplikasi berjalan. Semua device harus di cabang yang sama . Bila PC pusat mati, device lain tidak bisa mencetak.

### Update Otomatis`;
