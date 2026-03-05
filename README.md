# 🛒 PosPro — Aplikasi Kasir & Manajemen Toko Berbasis Web

<div align="center">

![PosPro Banner](https://img.shields.io/badge/PosPro-Point%20of%20Sale-blue?style=for-the-badge&logo=shopify)
![NestJS](https://img.shields.io/badge/Backend-NestJS-red?style=flat-square&logo=nestjs)
![Next.js](https://img.shields.io/badge/Frontend-Next.js-black?style=flat-square&logo=next.js)
![MySQL](https://img.shields.io/badge/Database-MySQL-orange?style=flat-square&logo=mysql)
![WhatsApp](https://img.shields.io/badge/WhatsApp-Bot%20Terintegrasi-green?style=flat-square&logo=whatsapp)

**Solusi kasir modern untuk toko kelontong, percetakan digital, café, dan usaha kecil menengah lainnya.**

</div>

---

## 📖 Apa itu PosPro?

**PosPro** adalah aplikasi kasir berbasis web yang dirancang untuk memudahkan operasional bisnis sehari-hari. Berbeda dengan aplikasi kasir tradisional yang hanya mencatat transaksi, PosPro hadir dengan ekosistem lengkap: mulai dari kasir real-time, manajemen stok, laporan keuangan, pelacakan piutang, hingga **Bot WhatsApp** yang otomatis melaporkan mutasi keuangan ke grup pemilik toko.

Cukup buka browser, tap, dan transaksi selesai — tanpa perlu instalasi aplikasi tambahan.

---

## ✨ Fitur-Fitur Utama

### 🏪 1. Kasir (POS) Real-Time
- Cari produk berdasarkan nama atau scan **barcode** menggunakan kamera / scanner
- Tambah item ke keranjang belanja dengan mudah
- Pilih metode pembayaran: **Tunai, Transfer Bank, QRIS**
- Cetak **struk thermal** langsung dari browser
- Kirim **tagihan (invoice)** ke WhatsApp pelanggan hanya dengan satu klik

### 💳 2. Pembayaran DP (Down Payment) & Pelunasan Piutang
- Kasir bisa memilih **Bayar Lunas** atau **Bayar DP (uang muka)**
- Semua transaksi DP tersimpan di daftar **Piutang**
- Ada tombol **Pelunasan** untuk mencatat pembayaran cicilan berikutnya
- Setiap pelunasan otomatis masuk ke laporan arus kas

### 📦 3. Manajemen Produk & Stok
- Tambah, edit, hapus produk dengan **foto produk**
- Dukung produk dengan **varian** (ukuran, warna, dll)
- Mode harga khusus untuk **Digital Printing** — harga dihitung per meter persegi (m²)
- Pantau stok real-time, dengan notifikasi ketika stok menipis

### 🏦 4. Multi-Rekening Bank
- Daftarkan beberapa rekening bank toko (BCA, Mandiri, BRI, dll)
- Setiap transaksi transfer dapat dilacak per rekening
- Saldo tiap rekening terupdate otomatis saat kasir menutup shift

### 📊 5. Laporan Penjualan
- Lihat riwayat semua transaksi dengan filter tanggal
- Cetak ulang struk transaksi lama
- Ekspor laporan ke format yang mudah dibaca

### 🔄 6. Laporan Tutup Shift Kasir
- Sistem menghitung otomatis total kas, QRIS, dan transfer per shift
- Kasir wajib input **saldo fisik uang tunai** dan **saldo rekening aktual** dari mBanking
- Sistem membandingkan: **Sistem vs. Aktual** — langsung kelihatan selisihnya
- Data tersimpan rapi sebagai laporan shift harian

### 📱 7. Bot WhatsApp Terintegrasi
- Bot WhatsApp berjalan langsung di dalam aplikasi — **tidak perlu aplikasi terpisah**
- Scan QR Code sekali dari halaman pengaturan, bot langsung aktif
- Bot otomatis mengirim **laporan mutasi keuangan** ke grup WhatsApp pemilik
- Mendukung perintah (command) via chat WhatsApp:

| Perintah | Fungsi |
|---|---|
| `!getgroupid` | Lihat ID grup WhatsApp (untuk didaftarkan) |
| `!botadmin status` | Cek status bot |
| `!botadmin addgroup [ID]` | Tambahkan grup ke whitelist bot |
| `!botadmin removegroup [ID]` | Hapus grup dari whitelist |
| `!botadmin listgroups` | Lihat semua grup terdaftar |
| `!botadmin setreportgroup [ID]` | Atur grup tujuan laporan shift |

### 🔐 8. Sistem Autentikasi & Role
- Login dengan email & password
- Sistem **token JWT** yang aman — sesi otomatis berakhir jika tidak aktif
- Siap dikembangkan untuk multi-role (Admin, Kasir, Manager, Owner)

---

## 🖥️ Tampilan Aplikasi

```
📱 Halaman Utama Dashboard
├── /pos              → Kasir (tambah item, checkout, cetak struk)
├── /pos/close-shift  → Form tutup shift kasir
├── /transactions/dp  → Daftar piutang & pelunasan DP
├── /reports/sales    → Laporan riwayat transaksi
├── /products         → Manajemen produk & stok
├── /customers        → Data pelanggan
└── /settings/whatsapp → QR Code login Bot WhatsApp
```

---

## 🔧 Teknologi yang Digunakan

> **Untuk pengguna awam:** Bagian ini menjelaskan "dapur" di balik aplikasi. Tidak perlu dipahami sepenuhnya untuk menggunakan aplikasi.

### Frontend (Tampilan)
| Teknologi | Fungsi |
|---|---|
| **Next.js** | Framework tampilan web yang cepat dan modern |
| **Tailwind CSS** | Sistem desain yang membuat tampilan konsisten dan rapi |
| **Zustand** | Pengelola data keranjang belanja |
| **TanStack Query** | Sinkronisasi data antara server dan tampilan secara otomatis |
| **Axios** | Komunikasi antara frontend dan backend |

### Backend (Server)
| Teknologi | Fungsi |
|---|---|
| **NestJS** | Server API yang kuat dan terstruktur |
| **Prisma** | Jembatan antara server dan database |
| **MySQL** | Database penyimpanan semua data toko |
| **JWT** | Sistem keamanan login yang modern |
| **whatsapp-web.js** | Bot WhatsApp yang terintegrasi langsung di server |

---

## 🚀 Cara Menjalankan di Komputer Lokal

### Prasyarat
Pastikan sudah terinstall:
- [Node.js](https://nodejs.org) versi 18 ke atas
- [MySQL](https://www.mysql.com) — sudah berjalan di komputer
- Git

---

### Langkah 1 — Clone Proyek
```bash
git clone https://github.com/tsunosora/Pos-Web-Application.git
cd Pos-Web-Application
```

---

### Langkah 2 — Setup Backend

```bash
cd backend
```

Buat file konfigurasi `.env` dari template:
```bash
copy .env.example .env
```

Isi file `.env` dengan konfigurasi database kamu:
```ini
DATABASE_URL="mysql://root:PASSWORD_KAMU@localhost:3306/pospro"
JWT_SECRET="isi_dengan_kalimat_rahasia_acak"
```

Install semua paket yang dibutuhkan:
```bash
npm install
```

Buat tabel database secara otomatis:
```bash
npx prisma db push
```

Jalankan server backend:
```bash
npm run start:dev
```

> ✅ Backend berjalan di: **http://localhost:3001**

---

### Langkah 3 — Setup Frontend

Buka terminal baru, lalu:
```bash
cd frontend
```

Buat file konfigurasi `.env.local`:
```bash
copy .env.example .env.local
```

Isi file `.env.local`:
```ini
NEXT_PUBLIC_API_URL=http://localhost:3001
```

Install paket:
```bash
npm install
```

Jalankan frontend:
```bash
npm run dev
```

> ✅ Aplikasi dapat diakses di: **http://localhost:3000**

---

### Langkah 4 — Setup Bot WhatsApp (Opsional)

1. Buka browser dan akses: `http://localhost:3000/settings/whatsapp`
2. Akan muncul QR Code
3. Buka WhatsApp di HP → **Perangkat Tertaut** → Scan QR Code
4. Bot WhatsApp siap digunakan! ✅

---

## 📂 Struktur Folder Proyek

```
Pos-Web-Application/
│
├── backend/                    # Server API (NestJS)
│   ├── prisma/
│   │   └── schema.prisma       # Skema / struktur database
│   ├── src/
│   │   ├── auth/               # Login & token keamanan
│   │   ├── products/           # API manajemen produk
│   │   ├── transactions/       # API kasir & pelunasan DP
│   │   ├── reports/            # API laporan shift kasir
│   │   ├── cashflows/          # API arus kas & rekening bank
│   │   ├── customers/          # API data pelanggan
│   │   └── whatsapp/           # Bot WhatsApp engine
│   └── public/
│       └── uploads/            # Folder foto produk
│
└── frontend/                   # Tampilan Web (Next.js)
    └── src/
        ├── app/
        │   ├── pos/            # ⭐ Halaman Kasir Utama
        │   ├── transactions/dp/# Daftar Piutang & Pelunasan DP
        │   ├── reports/sales/  # Laporan Riwayat Transaksi
        │   ├── products/       # Halaman Manajemen Produk
        │   ├── customers/      # Data Pelanggan
        │   └── settings/       # Pengaturan Bot WhatsApp
        ├── lib/
        │   ├── api.ts          # Pengaturan koneksi ke server
        │   └── receipt.ts      # Generator struk kasir
        └── store/
            └── cart-store.ts   # Data keranjang belanja
```

---

## ❓ Pertanyaan Umum (FAQ)

**Q: Apakah bisa digunakan tanpa internet?**
> Saat ini aplikasi membutuhkan koneksi untuk sinkronisasi data. Mode offline direncanakan untuk pengembangan berikutnya.

**Q: Apakah bisa digunakan di HP?**
> Ya! Tampilan responsif dan bisa diakses dari browser HP (Chrome, Safari). Disarankan menggunakan tablet untuk pengalaman terbaik di meja kasir.

**Q: Bagaimana jika Bot WhatsApp terputus?**
> Masuk ke **Pengaturan → Bot WhatsApp**, klik tombol **Logout & Restart Bot**, lalu scan QR Code kembali.

**Q: Apakah data aman?**
> Data disimpan di database lokal yang kamu kelola sendiri. Login menggunakan sistem JWT yang terenkripsi. Pastikan server kamu diamankan dengan baik.

**Q: Bisa untuk toko dengan lebih dari satu cabang?**
> Arsitektur sudah dirancang untuk mendukung multi-cabang. Fitur ini dalam roadmap pengembangan.

---

## 🗺️ Roadmap Pengembangan

- [x] Kasir POS dengan barcode scanner
- [x] Pembayaran DP & Pelunasan Piutang
- [x] Multi-rekening bank tracking
- [x] Tutup Shift Kasir (Actual vs Expected)
- [x] Bot WhatsApp terintegrasi
- [x] Upload & tampilkan foto produk
- [ ] Mode offline (PWA)
- [ ] Multi-cabang / Multi-outlet
- [ ] Laporan HPP (Harga Pokok Penjualan)
- [ ] Export laporan ke PDF/Excel
- [ ] Dashboard analitik pemilik toko

---

## 🤝 Kontribusi

Pull request sangat disambut! Untuk perubahan besar, harap buka issue terlebih dahulu untuk mendiskusikan perubahan yang diinginkan.

---

## 📄 Lisensi

Proyek ini bersifat privat dan dikembangkan untuk kebutuhan bisnis internal.

---

<div align="center">
  Dibuat dengan ❤️ menggunakan <strong>NestJS</strong> + <strong>Next.js</strong>
</div>
