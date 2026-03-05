# 📖 Panduan & Wiki — Aplikasi POS VOLIKO

> Panduan lengkap untuk kasir, admin, dan pemilik toko dalam menggunakan aplikasi Point of Sale (POS) berbasis web.

---

## 🔐 1. Login ke Aplikasi

![Halaman Login](images/login.png)

Buka browser dan masuk ke alamat aplikasi (contoh: `http://localhost:3000`).

- **Email:** masukkan email akun kamu (contoh: `admin@voliko.com`)
- **Password:** masukkan kata sandi akun kamu

Klik **Sign In** untuk masuk. Jika berhasil, kamu akan diarahkan ke halaman utama POS.

---

## 🏠 2. Halaman Utama / Dashboard

![Dashboard](images/dashboard.png)

Setelah login, kamu akan melihat **Dashboard** — halaman ringkasan status toko hari ini:

| Informasi | Penjelasan |
|---|---|
| Total Penjualan Hari Ini | Berapa uang yang sudah masuk hari ini dari semua transaksi |
| Jumlah Transaksi | Berapa kali terjadi penjualan |
| Produk Terjual | Total item yang sudah terjual |
| Saldo per Rekening | Saldo terkini di setiap rekening bank |

---

## 🛒 3. Kasir / POS (Point of Sale)

![Halaman Kasir](images/pos.png)

Ini adalah halaman utama kasir untuk **melayani pelanggan dan mencatat transaksi penjualan**.

### Cara Menggunakannya:
1. **Cari produk** — ketik nama produk di kotak pencarian atau scan barcode
2. **Klik produk** untuk menambahkannya ke keranjang
3. **Atur jumlah** — klik + atau – untuk mengubah jumlah
4. **Pilih metode bayar** — Cash, QRIS, atau Transfer Bank
5. **Klik Bayar** — input nominal yang diterima, sistem otomatis hitung kembalian
6. **Struk** akan muncul dan bisa dicetak atau dibagikan ke pelanggan

> 💡 **Tip:** Kalau pelanggan mau bayar cicilan/DP, pilih opsi **"DP / Piutang"** saat pembayaran.

---

## 📦 4. Manajemen Produk & Stok

![Halaman Produk](images/inventory.png)

Halaman untuk **mengelola semua produk** yang dijual di toko.

**Yang bisa dilakukan:**
- ➕ Tambah produk baru beserta foto, harga, dan stok
- ✏️ Edit produk yang sudah ada
- 📊 Lihat stok yang tersisa
- 🗑️ Hapus produk yang sudah tidak dijual

---

## 💳 5. Daftar DP / Piutang

![Halaman DP](images/dp.png)

Daftar semua transaksi yang **belum lunas** — pelanggan yang baru bayar sebagian (DP) atau belum bayar sama sekali.

**Informasi yang ditampilkan:**
- Nama pelanggan
- Total tagihan dan jumlah yang sudah dibayar
- Sisa yang harus dilunasi
- Tanggal jatuh tempo

Klik tombol **"Lunasi"** ketika pelanggan datang untuk melunasi sisanya.

---

## 📊 6. Laporan Penjualan

![Halaman Laporan Penjualan](images/sales.png)

Halaman rangkuman semua transaksi penjualan. Kamu bisa **filter berdasarkan tanggal** untuk melihat penjualan hari tertentu, minggu, atau bulan.

---

## 📋 7. Laporan Tutup Shift ⭐

![Halaman Tutup Shift](images/closeshift.png)

Halaman ini adalah **penutup shift kasir** — diisi di akhir shift sebelum kasir pulang. Hasil laporan otomatis dikirim ke **WhatsApp Group Owner**.

### Penjelasan Panel Kiri: "Data Sistem (Otomatis)"

Ini adalah angka yang **sudah dihitung otomatis oleh POS** — kasir tidak perlu isi, hanya perlu membacanya:

| Label | Artinya |
|---|---|
| **Total Gross Shift** | Total semua pendapatan shift ini sebelum dikurangi pengeluaran |
| **Cash** | Uang tunai yang masuk dari transaksi POS |
| **BCA / Mandiri / dll** | Uang yang masuk via transfer ke rekening tersebut |
| **QRIS** | Uang yang masuk via QRIS |
| **Uang tunai di laci** | Berapa uang cash yang seharusnya ada di laci (target sistem) |
| **EDC QRIS shift ini** | Berapa total QRIS yang seharusnya masuk hari ini |
| **Target Saldo Bank** | Berapa saldo rekening yang **seharusnya** ada sekarang |

> 📌 **Apa itu "Target Saldo Bank"?**
>
> Ini adalah saldo yang **sistem perkirakan** setelah menjumlahkan saldo awal + semua pendapatan transfer hari ini.
>
> **Contoh:**
> - Saldo BCA awal shift = Rp 45.464
> - Pendapatan BCA hari ini = Rp 34.000
> - **Target Sistem = Rp 79.464**
>
> Kamu bandingkan angka ini dengan saldo yang kamu lihat di mBanking.

---

### Cara Mengisi Form Tutup Shift (Step by Step)

**Step 1 — Pilih Nama Kasir & Shift**
- Pilih namamu dari dropdown "Nama Kasir / CS"
- Pilih jenis shift: **Shift Pagi** / **Shift Siang** / **Long Shift**

**Step 2 — Isi Kas Aktual**
- **Uang Tunai di Laci:** Hitung fisik uang di laci, masukkan totalnya
- **Total Mutasi Masuk QRIS:** Buka aplikasi QRIS, lihat total masuk hari ini

Badge akan muncul otomatis:
- 🟢 **LEBIH** = uang aktual lebih dari target sistem
- 🔴 **KURANG** = uang aktual kurang dari target sistem
- ✅ **BALANCE** = pas sesuai

**Step 3 — Catat Pengeluaran**
- Catat semua pengeluaran yang terjadi di shift ini per metode pembayaran
- Contoh: `Pengeluaran BCA → "Transfer ke supplier" Rp 100.000`
- Contoh: `Pengeluaran Cash → "Beli gula kopi" Rp 28.000`
- Klik **"+ Tambah Item"** untuk menambah baris baru

**Step 4 — Isi Saldo Rekening Bank**

Buka mBanking untuk setiap rekening, lalu isi **dua kolom**:
| Kolom | Isi dengan |
|---|---|
| Saldo di Laporan mBanking | Angka yang tertera di layar mBanking |
| Saldo Real di Bank | Saldo yang sudah dikonfirmasi benar-benar masuk |

**Step 5 — Lampirkan Foto & Kirim**
- Lampirkan foto bukti (struk, laci uang, layar EDC, layar mBanking) — bisa lebih dari 1 foto
- Klik **"📤 Kirim Laporan Shift ke WA"** — laporan otomatis terkirim ke WhatsApp group owner

---

## 👥 8. Data Pelanggan

![Halaman Pelanggan](images/customers.png)

Database pelanggan toko. Berguna untuk mencatat pelanggan yang sering berbelanja atau yang punya piutang.

**Informasi pelanggan:** Nama, nomor HP, alamat, riwayat transaksi.

---

## 🤖 9. Pengaturan WhatsApp Bot

![Halaman WhatsApp](images/whatsapp.png)

Halaman untuk menghubungkan **bot WhatsApp** yang bertugas mengirimkan laporan shift secara otomatis ke group owner.

### Cara Menghubungkan Bot:
1. Tunggu QR Code muncul di layar
2. Buka WhatsApp di HP → **Perangkat Tertaut** → **Tautkan Perangkat**
3. Scan QR Code yang ada di layar
4. Status akan berubah menjadi **"TERHUBUNG SEDIA"** ✅

### Cara Setup Grup Penerima Laporan:
1. Tambahkan nomor bot ke group WhatsApp owner
2. Ketik `!getgroupid` di grup tersebut
3. Bot akan balas dengan ID grup (angka berakhiran `@g.us`)
4. Masukkan ID tersebut ke variabel `WHATSAPP_REPORT_GROUP_ID` di file `.env` server

---

## ❓ FAQ

**Q: Kenapa saldo sistem berbeda dengan yang di mBanking?**
> Bisa karena ada transaksi yang belum diinput ke POS, atau ada transfer yang belum tercatat. Gunakan kolom "Saldo Laporan mBanking" dan "Saldo Real" untuk mencatatnya.

**Q: Apa yang terjadi kalau nilai aktual kasir berbeda dari target sistem?**
> Sistem akan menampilkan badge LEBIH atau KURANG sebagai informasi. Laporan tetap bisa dikirim. Perbedaan ini terekam untuk dikonfirmasi admin.

**Q: Kenapa dropdown "Nama Kasir" kosong?**
> Berarti belum ada data staff/user yang terdaftar. Minta admin untuk menambahkan akun kasir di menu Manajemen User.

**Q: Berapa maksimal foto yang bisa dilampirkan di laporan shift?**
> Maksimal **20 foto** per laporan shift.

**Q: Apa itu Long Shift?**
> Long Shift adalah shift panjang yang mencakup lebih dari satu slot waktu normal (misalnya kasir yang kerja dari pagi sampai malam penuh).

---

*Dokumentasi ini dibuat untuk tim VOLIKO IMOGIRI. Terakhir diperbarui: 6 Maret 2026.*
