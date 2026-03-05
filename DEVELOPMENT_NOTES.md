# 📋 DEVELOPMENT NOTES — PosPro Web Application

> **Tujuan dokumen ini**: Referensi lengkap untuk agent baru / sesi baru agar dapat melanjutkan pengembangan tanpa kehilangan konteks.
>
> **Terakhir diperbarui**: 5 Maret 2026

---

## 🏗️ RINGKASAN APLIKASI

**PosPro** adalah aplikasi Point of Sale (POS) berbasis web yang dirancang untuk digunakan di berbagai jenis usaha — toko klontong, percetakan digital (digital printing), café, dan sejenisnya.

Fitur utama yang sudah ada:
- Manajemen produk & stok dengan varian, gambar, dan ingredient
- Kasir POS real-time dengan barcode scanner
- Dukungan produk berbasis luas cetak (m²) untuk digital printing
- Pembayaran cicilan / Down Payment (DP) & Pelunasan Piutang
- Cetak Struk Rekap & Kirim Tagihan via WhatsApp Client (Customer)
- Laporan Penjualan & Arus Kas (Per-Rekening Bank)
- Laporan Tutup Shift Kasir dengan perhitungan Actual vs Expected
- **WhatsApp Bot Terintegrasi (NestJS)** untuk lapor mutasi otomatis ke Grup Owner

---

## 🔧 TECH STACK

### Backend
| Komponen | Versi/Detail |
|---|---|
| Runtime | Node.js |
| Framework | **NestJS** |
| ORM | **Prisma** |
| Database | **MySQL** (database: `pospro`) |
| Auth | **JWT** (`@nestjs/jwt` + `JwtAuthGuard`) |
| WhatsApp Bot| **whatsapp-web.js** (berjalan langsung di NestJS) |
| Port | `3001` |

### Frontend
| Komponen | Versi/Detail |
|---|---|
| Framework | **Next.js** (App Router) |
| Styling | **Tailwind CSS** |
| State Management | **Zustand** (`cart-store.ts`) |
| Data Fetching | **TanStack Query** (`@tanstack/react-query`) |
| HTTP Client | **Axios** (`src/lib/api.ts`) |
| Icons | **Lucide React** |
| Port | `3000` |

### Environment Variables
```ini
# Backend (.env di folder backend/)
DATABASE_URL="mysql://root:password@localhost:3306/pospro"
JWT_SECRET="your-secret"

# Frontend (.env.local di folder frontend/)
NEXT_PUBLIC_API_URL="http://localhost:3001"
```

---

## 📁 STRUKTUR PROYEK (Penting)

```text
comprehensive-pos-web-application/
├── backend/                    # NestJS API Server
│   ├── prisma/schema.prisma    # Database schema (selalu sync dengan DB)
│   ├── whatsapp_bot_config.json# Konfigurasi dinamis Grup WA Bot (auto-save)
│   └── src/
│       ├── transactions/       # Logika Kasir & Pelunasan DP
│       ├── reports/            # Laporan Shift Kasir (Close Shift)
│       └── whatsapp/           # Bot Engine (whatsapp-web.js) + Command WA
│
└── frontend/                   # Next.js App
    └── src/
        ├── app/
        │   ├── pos/            # Halaman kasir utama ⭐ (paling kompleks)
        │   │   └── close-shift/# Form Input Saldo Bank Aktual Kasir sebelum pulang
        │   ├── transactions/dp/# Tabel manajemen hutang/piutang pelanggan
        │   ├── reports/sales/  # Laporan riwayat transaksi & Cetak Ulang Struk
        │   └── settings/whatsapp/ # Tampilan QR Code Login Bot WhatsApp
        ├── store/cart-store.ts # Zustand store keranjang belanja
        ├── lib/
        │   ├── api.ts          # Axios instance + interceptor sync localstorage
        │   └── receipt.ts      # Generator Template HTML Struk Kasir
        └── components/
```

---

## 🗄️ DATABASE SCHEMA (Terbaru)

### Model utama:

| Model | Tabel | Keterangan |
|---|---|---|
| `Product` | `products` | produk dengan `pricingMode` (UNIT/AREA_BASED) |
| `ProductVariant` | `product_variants` | harga per m² atau per unit |
| `Transaction` | `transactions` | Transaksi bisa PAID atau PARTIAL (DP) |
| `TransactionItem` | `transaction_items` | areaCm2 (luasan) / Catatan mesin cetak |
| `Cashflow` | `cashflows` | Arus kas, terhubung ke `BankAccount` |
| `BankAccount` | `bank_accounts` | Rekening toko, punya field `currentBalance` |
| `ShiftReport` | `shift_reports` | Laporan tutup shift (Actual vs Expected) |

### Field / Enum Penting yang Sering Terlupakan:
- `Transaction.status`: `PAID`, `PARTIAL`, `CANCELLED`
- `Transaction.downPayment` & `remainingBalance`: Untuk piutang (DP).
- `Transaction.bankAccountId` & `Cashflow.bankAccountId`: Wajib diisi jika metode `BANK_TRANSFER`.
- `BankAccount.currentBalance`: Dicatat dan diperbarui saat Kasir menutup shift (berdasarkan input Saldo Aktual di mutasi mBanking).
- `ShiftReport.actualBankBalances` (JSON): Simpanan pecahan nominal uang di berbagai rekening per tutupan.

---

## ⭐ FITUR BARU & LOGIC CORE AKTUAL

### 1. Sistem Pembayaran Lunas & DP (Piutang)
- **POS Checkout**: Kasir dapat memilih *LUNAS* atau *BAYAR DP*. Jika DP, input field nominal DP akan muncul.
- **Daftar Piutang (`/transactions/dp`)**: Berisi transaksi berstatus `PARTIAL`. Ada tombol **Pelunasan** untuk membayar sisa tagihan.
- **Logika Cashflow Backend**:
  - Transaksi Baru (LUNAS): Omset Penuh masuk Cashflow.
  - Transaksi Baru (DP): Hanya uang DP yang masuk Cashflow.
  - Pelunasan DP: Sisa uang (Remaining Balance) masuk jadi row Pemasukan baru di Cashflow.

### 2. Multi-Rekening (Bank Account) Tracking
- Transaksi `BANK_TRANSFER` wajib menyertakan Rekening Mana (BCA, Mandiri, dll).
- Berlaku juga di form Pelunasan DP. Uang yang cair dari piutang bisa dibayar via Transfer ke rekening yang berbeda dari saat bayar DP awal.

### 3. Cetak Ulang Struk & Invoice WhatsApp Customer
- File `lib/receipt.ts` merender HTML *Receipt* dinamis. Disuntikkan `iframe` untuk mencetak Struk di mesin Thermal.
- Menekan logo WA di *Transaction Detail Modal* (Riwayat Transaksi) / Laporan Penjualan akan membuat _Deep Link_ URL WA web memuat tagihan teks ke arah nomor *Customer*.

### 4. Laporan Tutup Shift (Close Shift)
- Halaman UI Split: **Sistem vs Input Kasir**.
- Sistem otomatis menghitung `Gross Cash`, `Gross QRIS`, dan `Gross` masing-masing Bank dari riwayat pembayaran Shift berjalan.
- Kasir diwajibkan input **Saldo Fisik** murni dan **Saldo Mutasi Rekening Aktual** mBanking.
- Data disimpan ke `ShiftReport`. Field `currentBalance` di `BankAccount` ditimpa dengan *Actual Balance* hitungan Kasir agar shift esok hari berlanjut ke target sistem akurat.

### 5. Bot WhatsApp Terintegrasi (NestJS)
- Backend sekarang _host_ **whatsapp-web.js** secara langsung.
- Terminal backend memuat QR Code login, **ATAU** bisa discan UI web di `/settings/whatsapp`.
- Mengirim pesan format Laporan Keuangan ke grup WhatsApp yang didaftarkan.
- Konfigurasi Grup Laporan (Target IDs), Group Whitelist tidak direkam di `.env` (karena statis), melainkan direkam pada _filesystem_ `frontend/whatsapp_bot_config.json` via Command WhatsApp.
- **Daftar Perintah WA (Command)**:
  - `!getgroupid` (Dapatkan ID Group untuk didaftarkan sbg penerima)
  - `!botadmin status` (Cek kesehatan bot)
  - `!botadmin addgroup [ID]`, `!botadmin removegroup [ID]`, `!botadmin listgroups`
  - `!botadmin setreportgroup [ID]` (Set Tujuan Laporan Shift)

---

## ⚠️ CATATAN PENTING UNTUK AGENT BARU

### 1. Harga Kalkulasi Cetakan
> **PENTING**: Jangan gunakan `product.pricePerUnit` untuk kalkulasi `AREA_BASED` (Digital Printing).
> Selalu gunakan `variant.price` — ini adalah harga pokok per satuan meter persegi (m²).

### 2. Bypass Compile TypeScript (Prisma)
> Jika usai mengubah schema `prisma` dan melakukan push (`npx prisma db push`), TypeScript terkadang masih memprotes tipe dari Prisma Client lama yang membandel (misal field baru dianggap tidak ada). Typecast `(this.prisma as any).modelName` jika build TS gagal akibat *stale client generated*.

### 3. Frontend Interceptor Request Auth
> Interceptor Axios di `lib/api.ts` bersifat sinkron. Ini krusial agar React/Next JS Client Component yang merender `useQuery` pertama kali tidak kehabisan nafas gara-gara delay localstorage get token yang diasynchrone-kan.

### 4. Restart WhatsApp / Regenerate Session QR
> Saat Bot menyangkut atau ingin ganti nomor pengirim pesan bot, masuk UI web **Pengaturan > Bot WhatsApp**, lalu tekan **Logout & Restart Bot**. Backend secara manual menghancurkan *session files*, lalu menyela re-init otomatis untuk menyemburkan `WAITING_QR` yang segar.
