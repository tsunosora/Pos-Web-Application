# 🛒 PosPro — Aplikasi Kasir & Manajemen Toko Berbasis Web

[![PosPro Banner](https://img.shields.io/badge/PosPro-Point%20of%20Sale-blue?style=for-the-badge&logo=shopify)](https://github.com/tsunosora/Pos-Web-Application)
[![NestJS](https://img.shields.io/badge/Backend-NestJS-red?style=flat-square&logo=nestjs)](https://nestjs.com)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![MySQL](https://img.shields.io/badge/Database-MySQL-orange?style=flat-square&logo=mysql)](https://mysql.com)
[![WhatsApp](https://img.shields.io/badge/WhatsApp-Bot%20Terintegrasi-green?style=flat-square&logo=whatsapp)](https://github.com/tsunosora/Pos-Web-Application)

**Solusi kasir modern untuk toko kelontong, percetakan digital, café, dan usaha kecil menengah lainnya.**

> 🆕 **Update Maret 2026 (v2.7)** — Ditambahkan: **Harga Bertingkat** (tiered pricing per varian, harga otomatis berubah sesuai qty di kasir), **Impor Produk Massal** (template Excel + preview sebelum simpan), **Kalkulator HPP Multi-Varian** (biaya tambah per baris, simpan sebagai produk multi-varian), **Laporan Laba Kotor**, **Supplier Management**, **Backup & Restore**. Produk **Tanpa Lacak Stok** kini tidak pernah masuk daftar peringatan Stok Menipis.

---

## 📖 Apa itu PosPro?

**PosPro** adalah aplikasi kasir berbasis web yang dirancang untuk memudahkan operasional bisnis sehari-hari. Berbeda dengan aplikasi kasir tradisional yang hanya mencatat transaksi, PosPro hadir dengan ekosistem lengkap: mulai dari kasir real-time, manajemen stok, laporan keuangan, pelacakan piutang, invoice profesional, penawaran harga B2B, arus kas bisnis, peta lokasi kompetitor, hingga **Bot WhatsApp** yang otomatis melaporkan mutasi keuangan ke grup pemilik toko.

Cukup buka browser, tap, dan transaksi selesai — tanpa perlu instalasi aplikasi tambahan.

---

## ✨ Fitur-Fitur Utama

### 🏪 1. Kasir (POS) Real-Time
- Cari produk berdasarkan nama atau scan **barcode** menggunakan kamera / scanner
- Tambah item ke keranjang belanja dengan mudah
- Pilih metode pembayaran: **Tunai, Transfer Bank, QRIS**
- Cetak **struk thermal** langsung dari browser
- Kirim **tagihan (invoice)** ke WhatsApp pelanggan hanya dengan satu klik
- Produk **Area-Based** mendukung tiga satuan: **meter (m²)**, **sentimeter (cm²)**, dan **menit** — harga dan stok dihitung otomatis sesuai satuan yang dipilih
- Produk dengan **Tanpa Lacak Stok** tetap bisa diorder tanpa batas (tampil ∞)

### 💳 2. Pembayaran DP (Down Payment) & Pelunasan Piutang
- Kasir bisa memilih **Bayar Lunas** atau **Bayar DP (uang muka)**
- Semua transaksi DP tersimpan di daftar **Piutang**
- Ada tombol **Pelunasan** untuk mencatat pembayaran cicilan berikutnya
- Setiap pelunasan otomatis masuk ke laporan arus kas

### 📦 3. Manajemen Produk & Stok
- Tambah, edit, hapus produk dengan **foto produk** (JPG, PNG, WEBP, JFIF)
- Dukung produk dengan **varian** (ukuran, warna, dll)
- Mode harga khusus untuk **Digital Printing** — harga dihitung per area (m² atau cm²) atau per menit
- Toggle **Lacak Stok**: aktifkan untuk produk yang butuh kontrol stok; nonaktifkan untuk produk/jasa unlimited (tampil simbol **∞** di kasir dan inventori, stok tidak pernah habis)
- **Harga Bertingkat (Price Tiers)** per varian — set harga berbeda berdasarkan qty pembelian (misal: 1–5 pcs = Rp 25.000, 6+ = Rp 20.000). Harga berubah **otomatis di kasir** sesuai qty yang diorder
- **Impor Produk Massal** — download template Excel, isi data ratusan produk, upload dan preview validasi sebelum disimpan
- Tipe produk: **Produk Jual** (muncul di kasir), **Bahan Baku** (untuk BOM/ingredient), **Jasa** (tanpa stok)
- Notifikasi stok menipis hanya untuk produk yang mengaktifkan Lacak Stok — produk ∞ tidak pernah masuk peringatan

### 🏦 4. Multi-Rekening Bank
- Daftarkan beberapa rekening bank toko (BCA, Mandiri, BRI, dll)
- Setiap transaksi transfer dapat dilacak per rekening
- Saldo tiap rekening terupdate otomatis saat kasir menutup shift

### 💰 5. Cashflow Bisnis
- Catat semua **pemasukan dan pengeluaran** manual bisnis secara terstruktur
- Filter periode: **Bulan Ini / 3 Bulan Terakhir / Tahun Ini / Semua**
- **Chart tren 6 bulan** (Area Chart): Pemasukan vs. Pengeluaran
- **Chart breakdown kategori** (Bar Chart horizontal): distribusi per kategori
- Entri dari transaksi POS masuk **otomatis** (ditandai badge "Otomatis")
- **Export ke Excel** untuk laporan eksternal

### 📄 6. Invoice Generator & Penawaran Harga (SPH)
- Buat **Invoice profesional** dengan detail klien lengkap
- Buat **Surat Penawaran Harga (SPH)** khusus untuk klien B2B, perusahaan, brand, dan event
- **Catalog Picker**: pilih langsung produk/jasa dari daftar inventori
- **Custom Item**: input deskripsi, satuan, dan harga bebas untuk jasa non-katalog
- **Area-Based Item**: input ukuran banner/spanduk dalam Lebar × Tinggi (m), total m² terhitung otomatis
- SPH yang diterima bisa **dikonversi ke Invoice** dengan satu klik
- **Cetak PDF** — tampilan profesional siap kirim ke klien

### 📊 7. Laporan Penjualan & Profit
- Lihat riwayat semua transaksi dengan filter tanggal
- Laporan **Laba Kotor** — analisis margin per produk/varian: pendapatan, HPP, laba kotor, dan margin %
- Laporan **HPP** (Harga Pokok Penjualan) dengan **Kalkulator HPP** lengkap:
  - Worksheet biaya variabel + biaya tetap per produk
  - Setiap bahan baku bisa diinput **Lebar × Tinggi (m)** untuk auto-hitung luas m² — cocok untuk bahan banner/vinyl
  - **Kalkulasi Multi-Varian**: hitung HPP beberapa ukuran sekaligus dengan biaya tambah (laminasi, cutting) per baris
  - Simpan hasil langsung sebagai **produk baru multi-varian** atau apply ke varian yang sudah ada
- Export laporan ke Excel

### 🔄 8. Laporan Tutup Shift Kasir
- Sistem menghitung otomatis total kas, QRIS, dan transfer per shift
- Perbandingan **Sistem vs. Aktual** — langsung kelihatan selisihnya

### 🗺️ 9. Peta Cuan Lokasi
- Visualisasi **cabang toko** di peta interaktif
- Tambah **pin kompetitor** manual
- **Cari bisnis by keyword** via OpenStreetMap Overpass API

### 📱 10. Bot WhatsApp Terintegrasi
- Bot berjalan langsung di dalam aplikasi — tidak perlu aplikasi terpisah
- Scan QR Code sekali dari halaman pengaturan, bot langsung aktif
- Bot otomatis mengirim **laporan mutasi keuangan** ke grup WhatsApp pemilik

| Perintah | Fungsi |
|---|---|
| `!getgroupid` | Lihat ID grup WhatsApp |
| `!botadmin status` | Cek status bot |
| `!botadmin addgroup [ID]` | Tambahkan grup ke whitelist |
| `!botadmin removegroup [ID]` | Hapus grup dari whitelist |
| `!botadmin listgroups` | Lihat semua grup terdaftar |
| `!botadmin setreportgroup [ID]` | Atur grup tujuan laporan shift |

### 🖨️ 11. Antrian Produksi (Production Queue)

Khusus untuk toko percetakan digital — setiap order cetak yang masuk dari kasir otomatis masuk ke antrian produksi operator mesin.

- Kasir bisa set **Prioritas** (Normal / **EXPRESS**) dan **Deadline** selesai saat checkout
- Operator membuka halaman `/produksi` langsung dari HP (tanpa login, cukup PIN)
- Kelola antrian: **Satuan** (per job) atau **Gabung Cetak** (beberapa job dalam satu lembaran/batch)
- Saat mulai cetak: pilih bahan roll yang dipakai → stok bahan otomatis terpotong sesuai luas (m²)
- **Badge kategori** di picker bahan (Bahan Baku / Produk Jual + nama kategori) untuk memudahkan operator memilih
- **Cari job** berdasarkan nama pelanggan, nomor invoice, atau nomor job langsung dari halaman antrian
- **Tombol detail invoice** di setiap job card — operator bisa lihat info transaksi lengkap dari kasir tanpa harus login ke sistem
- Alur status job: **ANTRIAN → PROSES → SELESAI → DIAMBIL**
- Job EXPRESS selalu muncul di urutan paling atas antrian

**Produk Rakitan (Multi-Tahap Produksi):**
- Untuk produk yang butuh proses lebih dari sekadar cetak (contoh: Standing Banner — cetak + pasang rangka)
- Centang **"Produk Rakitan — Ada Tahap Pemasangan"** saat buat/edit produk (hanya muncul jika produk sudah bertanda "Perlu Proses Produksi")
- Bahan rakitan (rangka, frame, dll) didaftarkan sebagai **Ingredient** produk
- Alur status diperluas: **ANTRIAN → PROSES → MENUNGGU PASANG → DIPASANG → SELESAI → DIAMBIL**
- Stok bahan rakitan (BOM) dipotong otomatis saat operator klik **Mulai Pasang** — bukan saat checkout

### 📋 12. Stok Opname

Hitung fisik stok gudang dengan sistem link operator yang aman dan terstruktur.

- Admin buat sesi opname dari `/inventory/opname` → generate link unik (berlaku 8–72 jam)
- Link dibagikan ke karyawan — karyawan buka di HP tanpa perlu login
- **Blind count**: stok sistem sengaja disembunyikan dari operator agar hitungan jujur
- Draft tersimpan otomatis di HP operator (aman jika sinyal terputus)
- Admin review hasil hitungan per operator secara real-time (auto-refresh 10 detik)
- Admin konfirmasi angka akhir → stok di sistem diperbarui + `StockMovement ADJUST` otomatis tercatat
- Bisa filter per kategori produk untuk opname parsial

### 🎨 13. Kustomisasi Tampilan Halaman Login
- Upload beberapa **foto latar** yang berganti otomatis dengan efek **Ken Burns** (zoom + geser halus)
- Atur **tagline / slogan** toko yang tampil bergantian di panel login
- Logo dan nama toko mengikuti pengaturan di **Profil Toko** secara otomatis
- **Animated logo** Voliko dengan efek stroke draw-in dan letter pop-in
- Tampilan login **responsif penuh** — di HP menggunakan glass-morphism card di atas background animasi, di desktop split-panel dua kolom

### 🔐 14. Sistem Autentikasi & Role
- Login dengan email & password
- Sistem **token JWT** yang aman
- Multi-role: Admin, Kasir, Manager, Owner

### 👥 15. Data Pelanggan (CRM)
- Database pelanggan toko dengan riwayat transaksi
- Statistik per pelanggan: total belanja, frekuensi, rata-rata transaksi
- Export data pelanggan

---

## 🖥️ Peta Halaman Aplikasi

```
📱 Halaman-Halaman PosPro
├── /                       → Dashboard ringkasan bisnis
├── /pos                    → Kasir (tambah item, checkout, cetak struk)
├── /pos/close-shift        → Form tutup shift kasir
├── /transactions/dp        → Daftar piutang & pelunasan DP
├── /inventory              → Manajemen produk & stok
├── /inventory/opname       → Stok Opname — kelola sesi hitung fisik (admin) 🆕
├── /produksi               → Antrian Produksi — antrean cetak operator (publik + PIN) 🆕
├── /opname/[token]         → Form hitung fisik stok untuk karyawan (tanpa login) 🆕
├── /customers              → Data pelanggan & CRM
├── /invoices               → Invoice Generator & Penawaran Harga (SPH)
├── /cashflow               → Arus kas bisnis dengan chart & filter
├── /maps                   → Peta Cuan Lokasi (cabang + kompetitor)
├── /inventory/suppliers    → Data Supplier & harga beli per varian 🆕
├── /reports/sales          → Laporan riwayat transaksi
├── /reports/profit         → Laporan Laba Kotor & margin per produk
├── /reports/hpp            → Kalkulator HPP & Kalkulasi Multi-Varian
└── /settings               → Pengaturan toko, bot WhatsApp, rekening bank
    ├── /settings/general       → Profil toko (nama, logo, pajak, PIN operator)
    ├── /settings/payments      → Metode pembayaran & QRIS
    ├── /settings/users         → Manajemen staf / akun kasir
    ├── /settings/whatsapp      → Bot WhatsApp QR & konfigurasi grup
    ├── /settings/bank-accounts → Rekening bank & reset saldo
    ├── /settings/backup        → Backup & Restore database ke ZIP 🆕
    └── /settings/login         → Kustomisasi tampilan halaman login
```

---

## 🔄 Alur Penggunaan

```
SETUP AWAL (sekali)
┌─────────────────────────────────────────────────────────────────┐
│  /settings/general  →  Isi nama toko, logo, pajak, PIN operator │
│  /settings/users    →  Tambah akun kasir & staf                  │
│  /inventory         →  Input produk, varian, stok awal, HPP      │
│  /settings/whatsapp →  Scan QR Code bot WhatsApp                 │
└─────────────────────────────────────────────────────────────────┘
              ↓
OPERASIONAL HARIAN
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│  /pos ──────────────────────────────────────────────────────────────────┐│
│  (Kasir melayani pelanggan)                                             ││
│    │                                                                    ││
│    ├── Transaksi LUNAS ───────────→ Cashflow INCOME otomatis terbuat   ││
│    ├── Transaksi DP ─────────────→ Masuk /transactions/dp (piutang)   ││
│    ├── Produk cetak (AREA_BASED) →  Job otomatis masuk /produksi       ││
│    └── Stok terpotong otomatis                                         ││
│                                                                    ↓    ││
│  /produksi (operator mesin, tanpa login, pakai PIN)             /trans/dp││
│    → Proses job cetak → pilih roll bahan → stok bahan terpotong  → Lunasi││
│                                                                         ││
└─────────────────────────────────────────────────────────────────────────┘│
              ↓                                                             │
AKHIR SHIFT                                                                │
┌─────────────────────────────────────────────────────────────────┐       │
│  /pos/close-shift                                               │       │
│  → Sistem vs Aktual → Upload bukti foto                         │       │
│  → Laporan terkirim ke grup WhatsApp owner otomatis             │       │
│  → Saldo rekening bank ter-update                               │       │
└─────────────────────────────────────────────────────────────────┘       │
              ↓                                                             │
REVIEW PERIODIK (pemilik toko)                                             │
┌─────────────────────────────────────────────────────────────────┐       │
│  /cashflow      → Pemasukan & pengeluaran, chart tren 6 bulan   │       │
│  /reports/sales → Riwayat transaksi + export Excel              │       │
│  /reports/profit→ Margin profit per produk                      │       │
│  /customers     → Analitik pelanggan, frekuensi, nilai rata-rata│       │
│  /invoices      → Buat invoice B2B / Penawaran Harga (SPH)      │       │
│  /maps          → Peta cabang + kompetitor di sekitar toko      │       │
└─────────────────────────────────────────────────────────────────┘
```

### Bagaimana Data Mengalir Antar Modul

| Kejadian di POS | Efek Otomatis di Modul Lain |
|---|---|
| Transaksi lunas | Cashflow INCOME terbuat, stok terpotong |
| Transaksi DP | Masuk daftar piutang, cashflow INCOME sebesar DP saja |
| Pelunasan piutang | Cashflow INCOME terbuat untuk sisa tagihan |
| Produk cetak (requiresProduction) | Job baru masuk antrian `/produksi` |
| Operator mulai cetak | Stok bahan roll terpotong sesuai luas m² |
| Tutup shift kasir | Laporan shift WA terkirim, saldo rekening ter-update |
| Stok opname selesai | StockMovement ADJUST tercatat, stok diperbarui |

---

## 🔧 Teknologi yang Digunakan

### Frontend
| Teknologi | Fungsi |
|---|---|
| **Next.js 14** | Framework tampilan web (App Router) |
| **Tailwind CSS v4** | Sistem desain responsif |
| **TanStack Query** | Sinkronisasi data server-client |
| **Zustand** | State management keranjang belanja POS |
| **Axios** | HTTP client dengan JWT interceptor otomatis |
| **Recharts** | Grafik interaktif |
| **React Leaflet** | Peta interaktif OpenStreetMap |
| **xlsx** | Export laporan ke format Excel |

### Backend
| Teknologi | Fungsi |
|---|---|
| **NestJS** | Server API modular |
| **Prisma** | ORM database |
| **MySQL** | Database utama |
| **JWT + Passport** | Sistem keamanan login |
| **Multer** | Upload foto produk, QRIS |
| **whatsapp-web.js** | Bot WhatsApp terintegrasi |

---

## 🚀 Cara Menjalankan di Komputer Lokal

### Prasyarat
- [Node.js](https://nodejs.org) versi 18 ke atas
- [MySQL](https://www.mysql.com)
- Git

### Langkah 1 — Clone Proyek
```bash
git clone https://github.com/tsunosora/Pos-Web-Application.git
cd Pos-Web-Application
```

### Langkah 2 — Setup Backend
```bash
cd backend
cp .env.example .env
```

Isi file `.env`:
```env
DATABASE_URL="mysql://root:PASSWORD_KAMU@localhost:3306/pospro"
JWT_SECRET="isi_dengan_kalimat_rahasia_acak_yang_panjang"
PORT=3001
```

```bash
npm install
npx prisma db push
npm run start:dev
```
> ✅ Backend berjalan di: **http://localhost:3001**

### Langkah 3 — Setup Frontend
```bash
cd frontend
```

Buat file `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

```bash
npm install
npm run dev
```
> ✅ Aplikasi dapat diakses di: **http://localhost:3000**

### Langkah 4 — Setup Bot WhatsApp (Opsional)
1. Buka `http://localhost:3000/settings/whatsapp`
2. Scan QR Code via WhatsApp → Perangkat Tertaut
3. Bot WhatsApp siap digunakan ✅

---

## 🌐 Deploy ke Server (Self-Hosted + Cloudflare Tunnel)

Bagian ini menjelaskan cara deploy PosPro ke homeserver/VPS menggunakan **Cloudflare Tunnel** agar bisa diakses publik dengan domain sendiri tanpa membuka port router.

### Arsitektur Deploy

```
Browser User
     │
     ▼
Cloudflare Tunnel
     │
     ├──► frontend.domain.com  ──► Server:3002  (Frontend Next.js)
     │
     └──► api.domain.com       ──► Server:3001  (Backend NestJS)
                                         │
                                         ▼
                                   MySQL (localhost:3306)
```

### Langkah 1 — Konfigurasi Environment Backend

```bash
nano backend/.env
```

```env
DATABASE_URL="mysql://pospro_user:PASSWORD@localhost:3306/pospro_db"
PORT=3001
JWT_SECRET="isi_string_rahasia_panjang_dan_acak"
```

### Langkah 2 — Konfigurasi Environment Frontend

```bash
nano frontend/.env.local
```

```env
NEXT_PUBLIC_API_URL=https://api.domain-kamu.com
```

> ⚠️ **WAJIB DIPERHATIKAN — Sumber Error Paling Umum:**
> - Nilai `NEXT_PUBLIC_API_URL` harus mengarah ke **URL backend/API**, **bukan URL frontend**
> - Jangan gunakan tanda kutip (`"`) pada nilai di `.env.local` Next.js
> - File ini harus ada **sebelum** menjalankan `npm run build`
> - Setelah mengubah file ini, **wajib rebuild** frontend

### Langkah 3 — Pastikan Tidak Ada Hardcode URL di Source Code

Cek dan pastikan semua file menggunakan environment variable, bukan `localhost`:

```bash
# Cek apakah masih ada localhost yang tertinggal
grep -r "localhost:3001" frontend/src --include="*.ts" --include="*.tsx"
```

File yang perlu diperhatikan:

**`frontend/src/components/user-auth-form.tsx`** — pastikan endpoint login menggunakan env:
```typescript
// ❌ Salah — hardcoded localhost
const endpoint = isRegistering
  ? 'http://localhost:3001/auth/register'
  : 'http://localhost:3001/auth/login';

// ✅ Benar — pakai environment variable
const endpoint = isRegistering
  ? `${process.env.NEXT_PUBLIC_API_URL}/auth/register`
  : `${process.env.NEXT_PUBLIC_API_URL}/auth/login`;
```

**`frontend/src/lib/api.ts`** — pastikan baseURL menggunakan env:
```typescript
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
});
```

### Langkah 4 — Konfigurasi CORS Backend

File `backend/src/main.ts`:

```typescript
app.enableCors({
  origin: ['https://frontend.domain-kamu.com'],
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204,
});
```

### Langkah 5 — Build & Jalankan dengan PM2

```bash
# Backend
cd backend
npm install
npm run build
pm2 start dist/main.js --name backend

# Frontend
cd ../frontend
npm install
npm run build
pm2 start npm --name frontend -- start -- -p 3002

pm2 save
pm2 startup
```

### Langkah 6 — Setup Cloudflare Tunnel

```bash
cloudflared tunnel login
cloudflared tunnel create pospro
```

Buat file `~/.cloudflared/config.yml`:

```yaml
tunnel: <TUNNEL_ID>
credentials-file: /home/USER/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: frontend.domain-kamu.com
    service: http://localhost:3002
  - hostname: api.domain-kamu.com
    service: http://localhost:3001
  - service: http_status:404
```

```bash
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
```

---

## ✅ Checklist Sebelum Deploy

Gunakan checklist ini setiap kali deploy ulang untuk menghindari error umum:

### Backend
- [ ] File `.env` sudah ada dan terisi lengkap
- [ ] `DATABASE_URL` mengarah ke MySQL yang benar
- [ ] `JWT_SECRET` sudah diisi (jangan kosong)
- [ ] CORS di `main.ts` menggunakan **string domain** (bukan `true`)
- [ ] Folder `public/uploads/` ada: `mkdir -p public/uploads`
- [ ] Build berhasil: `npm run build`

### Frontend
- [ ] File `.env.local` **sudah ada** sebelum build
- [ ] `NEXT_PUBLIC_API_URL` mengarah ke URL **backend** (bukan frontend)
- [ ] Tidak ada hardcode `localhost` di source code (`grep -r "localhost:3001" src/`)
- [ ] Build berhasil: `npm run build`
- [ ] Setelah deploy, **login ulang** untuk mendapatkan token baru

### Cloudflare
- [ ] Tunnel berjalan: `sudo systemctl status cloudflared`
- [ ] DNS record sudah terdaftar di Cloudflare dashboard
- [ ] Tidak ada Transform Rules CORS yang konflik di Cloudflare dashboard

---

## 🐛 Troubleshooting

### ❌ Error: CORS Policy — `Access-Control-Allow-Origin` invalid value `'true'`

**Penyebab:** Nilai CORS di `main.ts` backend salah konfigurasi.

**Solusi:** Pastikan `origin` berisi string domain, bukan boolean:
```typescript
// ❌ Salah
app.enableCors({ origin: true });

// ✅ Benar
app.enableCors({ origin: ['https://frontend.domain-kamu.com'] });
```

**Cara verifikasi CORS sudah benar:**
```bash
curl -I -X OPTIONS https://api.domain-kamu.com/settings \
  -H "Origin: https://frontend.domain-kamu.com" \
  -H "Access-Control-Request-Method: GET"

# Response harus ada:
# access-control-allow-origin: https://frontend.domain-kamu.com  ✅
# Bukan: access-control-allow-origin: true  ❌
```

---

### ❌ Error: 401 Unauthorized — Token tidak tersimpan

**Cara diagnosa:**
```javascript
// Buka DevTools → Console → ketik:
localStorage.getItem('token')
// Jika null → login gagal, token tidak tersimpan
```

**Penyebab & solusi:**

| Penyebab | Solusi |
|---|---|
| URL login di `user-auth-form.tsx` hardcode `localhost` | Ganti dengan `process.env.NEXT_PUBLIC_API_URL` |
| `NEXT_PUBLIC_API_URL` salah mengarah ke frontend | Perbaiki `.env.local`, rebuild frontend |
| Token lama dari sesi sebelumnya | Logout, hapus cache browser, login ulang |

---

### ❌ Frontend tidak bisa akses API (ERR_FAILED / Network Error)

**Kemungkinan penyebab:**
- `NEXT_PUBLIC_API_URL` di `.env.local` salah atau tidak ada
- `.env.local` dibuat **setelah** `npm run build`
- Menggunakan `http://` tapi server hanya menerima `https://`

**Solusi:**
```bash
cat frontend/.env.local
# Pastikan: NEXT_PUBLIC_API_URL=https://api.domain-kamu.com

cd frontend && npm run build && pm2 restart frontend
```

---

### ❌ Bot WhatsApp terputus
1. Masuk ke **Pengaturan → Bot WhatsApp**
2. Klik **Logout & Restart Bot**
3. Scan QR Code kembali

---

### ❌ Gambar produk / logo / QRIS tidak muncul
```bash
mkdir -p backend/public/uploads
chmod 755 backend/public/uploads
pm2 restart backend
```

---

## 📂 Struktur Folder Proyek

```
Pos-Web-Application/
│
├── backend/                        # Server API (NestJS)
│   ├── prisma/
│   │   └── schema.prisma           # Skema database
│   ├── src/
│   │   ├── auth/                   # JWT login
│   │   ├── products/               # Produk, varian, foto
│   │   ├── transactions/           # POS checkout, DP, dashboard
│   │   ├── invoices/               # Invoice & SPH
│   │   ├── cashflow/               # Arus kas
│   │   ├── reports/                # Shift close, profit report
│   │   ├── branches/               # Data cabang toko
│   │   ├── competitors/            # Data kompetitor peta
│   │   ├── customers/              # Data pelanggan
│   │   ├── bank-accounts/          # Multi-rekening bank
│   │   ├── hpp/                    # Kalkulator HPP
│   │   ├── production/             # Antrian produksi cetak (job & batch)
│   │   ├── stock-opname/           # Stok opname (sesi, item, operator public)
│   │   ├── suppliers/              # Data supplier & item harga beli 🆕
│   │   ├── backup/                 # Export/import database ZIP 🆕
│   │   ├── settings/               # Pengaturan toko, logo, QRIS
│   │   └── whatsapp/               # Bot WhatsApp engine
│   └── public/
│       └── uploads/                # Foto produk, QRIS, bukti shift
│
└── frontend/                       # Tampilan Web (Next.js)
    └── src/
        ├── app/
        │   ├── pos/                # Kasir utama
        │   ├── transactions/dp/    # Piutang & pelunasan
        │   ├── inventory/          # Manajemen produk
        │   │   └── opname/         # Stok Opname — admin kelola sesi 🆕
        │   ├── produksi/           # Antrian Produksi — operator mesin 🆕
        │   ├── opname/[token]/     # Form hitung fisik karyawan (publik) 🆕
        │   ├── invoices/           # Invoice Generator & SPH
        │   ├── cashflow/           # Arus kas bisnis
        │   ├── maps/               # Peta Cuan Lokasi
        │   ├── customers/          # Data pelanggan
        │   └── reports/            # Laporan penjualan, profit, HPP
        ├── lib/
        │   ├── api.ts              # Barrel re-export (import dari sini tetap bekerja)
        │   ├── api/                # Sub-modul API per domain
        │   │   ├── client.ts       # Axios instance + JWT interceptor
        │   │   ├── products.ts     # Produk, varian, stok, impor massal
        │   │   ├── transactions.ts # POS checkout, DP, rekening bank
        │   │   ├── cashflow.ts     # Arus kas & laporan bulanan
        │   │   ├── reports.ts      # Dashboard, penjualan, shift close
        │   │   ├── invoices.ts     # Invoice & SPH
        │   │   ├── customers.ts    # Data pelanggan
        │   │   ├── settings.ts     # Pengaturan toko, user, cabang
        │   │   ├── hpp.ts          # Kalkulator HPP
        │   │   ├── production.ts   # Antrian produksi (publik, no-JWT)
        │   │   ├── opname.ts       # Stok opname (admin + publik)
        │   │   ├── suppliers.ts    # Supplier & harga beli
        │   │   ├── whatsapp.ts     # Bot WhatsApp
        │   │   └── backup.ts       # Backup & restore
        │   ├── receipt.ts          # Generator struk kasir
        │   └── export.ts           # Helper export Excel
        └── store/
            └── cart-store.ts       # Zustand store keranjang belanja
```

---

## 📚 Dokumentasi & Wiki

| Dokumen | Isi |
|---|---|
| [🔄 Alur Bisnis](docs/wiki/alur-bisnis.md) | **Mulai dari sini** — setup awal, alur kasir harian, alur produksi, review keuangan |
| [Panduan Umum](docs/wiki/README.md) | Login, Dashboard, Kasir, Produk, Tutup Shift, WhatsApp Bot |
| [Kalkulator HPP](docs/wiki/hpp-calculator.md) | Worksheet HPP, multi-varian, biaya tambah, simpan produk |
| [Cashflow Bisnis](docs/wiki/cashflow.md) | Cara kelola arus kas, filter, chart, export |
| [Invoice & Penawaran Harga](docs/wiki/invoice-sph.md) | Buat invoice, SPH, catalog picker, konversi SPH ke invoice |
| [Peta Cuan Lokasi](docs/wiki/peta-cuan.md) | Kelola cabang, tambah kompetitor, pencarian bisnis |
| [Antrian Produksi](docs/wiki/produksi.md) | Antrian cetak, job satuan & batch, produk rakitan multi-tahap |
| [Stok Opname](docs/wiki/stock-opname.md) | Hitung fisik stok via link operator, blind count, konfirmasi selisih |
| [Data Supplier](docs/wiki/suppliers.md) | Kelola supplier dan harga beli per varian |
| [Backup & Restore](docs/wiki/backup.md) | Backup database ke ZIP, restore skip/overwrite |
| [Deployment Cloudflare](docs/wiki/deployment.md) | Setup produksi di home server (MySQL, PM2, Cloudflare Tunnel) |

---

## ❓ Pertanyaan Umum (FAQ)

**Q: Apakah bisa digunakan tanpa internet?**
> Fitur peta memerlukan internet. Kasir, laporan, dan cashflow berjalan di jaringan lokal.

**Q: Apakah bisa digunakan di HP?**
> Ya! Tampilan responsif untuk semua ukuran layar. Disarankan tablet untuk meja kasir.

**Q: Apakah bisa untuk lebih dari satu cabang?**
> Ya — fitur multi-cabang sudah tersedia dengan koordinat GPS dan data omset per cabang.

**Q: Bagaimana cara buat penawaran harga untuk klien perusahaan?**
> Buka menu **Invoice & Penawaran** → tab **Penawaran Harga (SPH)** → klik **+ Buat SPH**.

**Q: Setelah deploy ulang, kenapa harus login ulang?**
> Token JWT lama di browser tidak berlaku setelah rebuild. Selalu logout dan login ulang setelah deploy.

---

## 🗺️ Roadmap Pengembangan

- [x] Kasir POS dengan barcode scanner
- [x] Pembayaran DP & Pelunasan Piutang
- [x] Multi-rekening bank tracking
- [x] Tutup Shift Kasir (Actual vs Expected)
- [x] Bot WhatsApp terintegrasi
- [x] Upload & tampilkan foto produk
- [x] Laporan HPP
- [x] Export laporan ke Excel
- [x] Dashboard analitik pemilik toko
- [x] Cashflow Bisnis dengan chart tren & kategori
- [x] Invoice Generator profesional
- [x] Penawaran Harga / SPH untuk klien B2B
- [x] Peta Cuan Lokasi
- [x] Kustomisasi tampilan halaman login (background slideshow, taglines, animated logo)
- [x] Antrian Produksi — job cetak, batch, manajemen roll, PIN operator, produk rakitan multi-tahap
- [x] Antrian Produksi — pencarian pelanggan, detail invoice, badge kategori bahan
- [x] Stok Opname — link operator, blind count, review & konfirmasi stok
- [x] HPP Calculator — input Lebar × Tinggi m² per baris bahan baku (auto-hitung luas)
- [x] HPP Kalkulasi Multi-Varian — biaya tambah per baris, HPP Final = base + biaya tambah, simpan sebagai produk multi-varian
- [x] Harga Bertingkat (Price Tiers) — tiered pricing per varian, harga otomatis di kasir POS sesuai qty
- [x] Impor Produk Massal — template Excel, preview validasi sebelum simpan, error per baris
- [x] Laporan Laba Kotor — profit & margin per produk dengan filter tanggal dan export Excel
- [x] Supplier Management — kelola supplier dan harga beli per varian produk
- [x] Backup & Restore — export selective tables ke ZIP, restore mode skip/overwrite
- [x] Produk "Tanpa Lacak Stok" — unlimited stock, tetap bisa diorder, tampil ∞ di kasir & inventori
- [x] Kasir Area-Based multi-satuan — m², cm², dan menit dengan harga & stok per satuan yang benar
- [x] Upload gambar produk mendukung format JFIF dan nama file kapital (JPG, JPEG)
- [x] HPP: sync kategori produk dari database inventori (bukan hardcoded)
- [x] Notifikasi stok menipis — dashboard card + badge di inventori (hanya produk Lacak Stok aktif)
- [ ] Mode offline (PWA)
- [ ] Fitur loyalty point pelanggan

---

## 🤝 Kontribusi

Pull request sangat disambut! Untuk perubahan besar, harap buka issue terlebih dahulu.

---

## 📄 Lisensi

Proyek ini dikembangkan untuk kebutuhan bisnis internal.

---

Dibuat dengan ❤️ menggunakan **NestJS** + **Next.js**
