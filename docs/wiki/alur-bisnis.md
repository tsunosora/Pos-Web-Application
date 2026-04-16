# 🔄 Alur Bisnis PosPro — Panduan Lengkap Alur Penggunaan

Halaman ini menjelaskan bagaimana semua modul PosPro bekerja bersama dalam satu ekosistem bisnis — mulai dari pertama kali setup, operasional harian kasir, hingga review keuangan pemilik toko.

---

## Gambaran Besar

```
PRODUK & STOK         KASIR (POS)           PRODUKSI
─────────────         ──────────            ────────
Input produk    →    Transaksi     →    Job cetak masuk
harga, stok          pelanggan          antrian operator
    │                    │
    │                    ├── Stok terpotong otomatis
    │                    ├── Cashflow INCOME terbuat
    │                    └── Job produksi terbuat (jika cetak)
    │
    └── Stok Opname (hitung fisik berkala)

                          ↓
                   LAPORAN & REVIEW
                   ──────────────────
                   Cashflow Bisnis
                   Laporan Penjualan
                   Laporan Laba Kotor
                   Tutup Shift
                   Analytics Pelanggan
```

---

## Bagian 1 — Setup Pertama Kali

Lakukan langkah ini **sekali** saat pertama kali menggunakan PosPro.

### Urutan Setup yang Disarankan

**1. Profil Toko** → `/settings/general`
- Isi nama toko, alamat, nomor telepon
- Upload logo toko (tampil di invoice, struk, dan halaman login)
- Atur tarif pajak (PPN) — berlaku untuk kasir dan invoice
- Buat PIN Operator (untuk akses halaman Produksi)

**2. Akun Pengguna** → `/settings/users`
- Buat akun untuk setiap kasir/staf
- Role: **Admin** (akses penuh) / **Kasir** (hanya kasir & transaksi) / **Manager** / **Owner**

**3. Rekening Bank** → `/settings/bank-accounts`
- Daftarkan semua rekening bank yang digunakan untuk menerima transfer
- Setiap rekening akan muncul sebagai pilihan di kasir saat pelanggan bayar transfer
- Saldo awal diisi nol — akan diupdate otomatis saat pertama kali tutup shift

**4. Produk & Inventori** → `/inventory`
- Buat kategori produk terlebih dahulu (menu Kategori)
- Input semua produk yang dijual:
  - Produk biasa: isi nama, harga, stok awal
  - Produk cetak (banner, sticker): pilih mode **Area Based**
  - Jasa/produk unlimited: nonaktifkan **Lacak Stok**
- Tambahkan varian jika produk punya pilihan (ukuran, warna, dll)
- Set HPP setiap varian agar laporan laba kotor akurat

**5. Supplier** → `/inventory/suppliers` *(opsional)*
- Input data supplier bahan baku
- Hubungkan ke varian produk dengan harga beli

**6. WhatsApp Bot** → `/settings/whatsapp`
- Scan QR Code untuk menghubungkan bot
- Setup grup WhatsApp penerima laporan shift (lihat [panduan WhatsApp](../wiki/README.md#-9-pengaturan-whatsapp-bot))

---

## Bagian 2 — Operasional Harian Kasir

### Alur Transaksi Normal

```
Pelanggan datang
       ↓
Kasir buka /pos
       ↓
Cari produk (ketik nama atau scan barcode)
       ↓
Tambah ke keranjang
│
├── Produk biasa: klik → langsung masuk keranjang
├── Produk Area Based: input Lebar × Tinggi → harga otomatis terhitung
└── Produk dengan Price Tiers: harga berubah otomatis sesuai qty
       ↓
Pilih metode pembayaran (Tunai / Transfer / QRIS)
       ↓
┌─── Bayar LUNAS ──────────────────────────────────────────────────┐
│ → Transaksi tersimpan status PAID                                 │
│ → Stok semua item terpotong otomatis                              │
│ → Cashflow INCOME dibuat otomatis (tidak perlu input manual)      │
│ → Struk muncul → bisa cetak atau kirim WA ke pelanggan           │
│ → Jika ada produk cetak → job masuk antrian /produksi            │
└──────────────────────────────────────────────────────────────────┘
       atau
┌─── Bayar DP ─────────────────────────────────────────────┐
│ → Transaksi tersimpan status PARTIAL                              │
│ → Cashflow INCOME dibuat sebesar nilai DP saja                    │
│ → Masuk daftar piutang di /transactions/dp (tab DP)               │
│ → Saat pelanggan kembali melunasi → buka /transactions/dp        │
│   → klik Lunasi → Cashflow INCOME terbuat untuk sisa tagihan     │
└──────────────────────────────────────────────────────────────┘
       atau
┌─── KREDIT (tanpa DP) ────────────────────────────────────┐
│ → Transaksi tersimpan status PENDING (belum ada pembayaran)       │
│ → Tidak ada Cashflow INCOME (belum ada uang masuk)               │
│ → Masuk daftar piutang di /transactions/dp (tab Kredit)           │
│ → Jatuh tempo tercatat → badge merah jika lewat                  │
└──────────────────────────────────────────────────────────────┘
       atau
┌─── BAYAR NANTI ──────────────────────────────────────────┐
│ → Invoice disimpan tanpa pembayaran sama sekali                   │
│ → Masuk daftar piutang di /transactions/dp (tab Bayar Nanti)      │
│ → Pelanggan bisa bayar kapan saja melalui menu Piutang           │
└──────────────────────────────────────────────────────────────┘────┘
```

### Alur Produk Cetak (Percetakan Digital)

```
Kasir input order cetak di POS
       ↓
Transaksi selesai (PAID atau DP)
       ↓
Job otomatis masuk antrian /produksi
(Kasir bisa set Prioritas: Normal atau EXPRESS, dan Deadline)
       ↓
Operator mesin buka /produksi (tanpa login, cukup PIN)
       ↓
Lihat antrian → pilih job → klik "Proses"
       ↓
Pilih bahan roll yang dipakai
→ Stok bahan roll terpotong otomatis (sesuai luas m² job)
       ↓
Cetak selesai → klik "Selesai"
→ Status: SELESAI (siap diambil pelanggan)
       ↓
Pelanggan ambil barang → klik "Sudah Diambil"
→ Status: DIAMBIL
```

> **Produk Rakitan** (contoh: standing banner dengan rangka): alur diperluas jadi ANTRIAN → PROSES → MENUNGGU PASANG → PASANG → SELESAI → DIAMBIL. Stok bahan rangka (BOM) baru terpotong saat operator klik "Mulai Pasang".

---

## Bagian 3 — Dokumen B2B (Invoice & Penawaran Harga)

Untuk transaksi dengan klien perusahaan, event organizer, atau brand yang butuh dokumen formal:

```
Buka /invoices
       ↓
Tab "Penawaran Harga (SPH)" → + Buat SPH
→ Isi data klien (nama, perusahaan, alamat, email, telp)
→ Tambah item (pilih dari katalog produk atau input manual)
→ Cetak PDF dan kirim ke klien
       ↓
Klien setuju?
├── YA → klik "Konversi ke Invoice"
│         → Invoice baru terbuat otomatis
│         → SPH berubah status ke DITERIMA
│         → Invoice bisa dicetak ulang dan dikirim
│
└── TIDAK → ubah status SPH ke DITOLAK
```

---

## Bagian 4 — Tutup Shift

Dilakukan oleh kasir di akhir setiap shift kerja.

```
Buka /pos/close-shift
       ↓
PANEL KIRI (otomatis, hanya baca):
- Total penjualan shift ini
- Rincian: Tunai, QRIS, Transfer per rekening
- Target saldo rekening (saldo awal + masuk hari ini)
       ↓
PANEL KANAN (isi oleh kasir):
- Hitung uang fisik di laci → isi "Uang Tunai di Laci"
- Buka aplikasi QRIS → isi total QRIS hari ini
- Buka mBanking → isi saldo aktual per rekening
→ Badge selisih muncul otomatis (LEBIH / KURANG / BALANCE)
       ↓
Catat pengeluaran shift (beli materai, isi bensin motor kurir, dll)
       ↓
Upload foto bukti (laci, layar QRIS, mBanking)
       ↓
Klik "Kirim Laporan Shift ke WA"
→ Laporan terkirim ke grup WhatsApp owner
→ Saldo rekening bank ter-update ke nilai aktual
→ Menjadi baseline shift berikutnya
```

---

## Bagian 5 — Review Keuangan (Pemilik Toko)

### Harian
- **Dashboard** (`/`) — total penjualan, jumlah transaksi, produk terjual, saldo rekening
- **Laporan Penjualan** (`/reports/sales`) — Ringkasan metrik, **Trend Produk** (perbandingan tren vs periode sebelumnya), Histori Log dengan search pelanggan

### Mingguan / Bulanan
- **Cashflow** (`/cashflow`) — chart tren pemasukan vs pengeluaran 6 bulan, breakdown per kategori
- **Laporan Laba Kotor** (`/reports/profit`) — margin profit per produk, filter periode + export Excel
- **Piutang** (`/transactions/dp`) — cek siapa yang masih punya tagihan belum lunas, filter per tab (DP/Kredit/Bayar Nanti)

### Berkala
- **Riwayat Shift** (`/reports/shift-history`) — lihat log semua shift, salin pesan WA, kirim ulang
- **Stok Opname** (`/inventory/opname`) — hitung fisik stok, bagi link ke karyawan, konfirmasi selisih
- **Data Pelanggan** (`/customers`) — analitik per pelanggan: total belanja, frekuensi, produk favorit
- **Backup** (`/settings/backup`) — export database ke ZIP, auto-backup via Rclone, simpan di cloud

---

## Bagian 6 — Kalkulator HPP (untuk Penetapan Harga)

Digunakan **sebelum** menentukan harga jual suatu produk baru.

```
Buka /reports/hpp
       ↓
+ Buat Worksheet Baru
→ Pilih produk yang ingin dihitung HPP-nya
→ Input biaya variabel (bahan baku): pilih dari stok atau input manual
   - Untuk bahan berbentuk lembaran: aktifkan mode Lebar × Tinggi (m²)
→ Input biaya tetap (listrik, sewa, gaji): isi nama + nominal bulanan
→ Isi Target Produksi per bulan
→ Kalkulator otomatis hitung: HPP per unit, biaya overhead per unit
       ↓
Multi-Varian (opsional):
→ Klik "Kalkulasi Multi-Varian" untuk hitung beberapa ukuran sekaligus
→ Tambah biaya finishing per ukuran (laminasi, cutting)
→ Lihat HPP Final masing-masing varian
       ↓
Simpan hasil:
├── "Daftarkan sebagai Produk Baru" → produk + semua varian langsung tersimpan ke inventori
└── "Terapkan ke Varian yang Sudah Ada" → update HPP varian yang sudah ada
```

> Setelah HPP diset di varian, **Laporan Laba Kotor** (`/reports/profit`) akan menampilkan margin % yang akurat.

---

## Bagian 7 — Peta Cuan Lokasi

Fitur analisis kompetitor dan ekspansi bisnis.

```
Buka /maps
       ↓
Kiri: Daftar Cabang Toko
→ + Tambah Cabang → isi nama, alamat, omset, margin
→ Pin di peta dengan warna berbeda sesuai margin
→ Klik pin → lihat info detail cabang
       ↓
Kiri: Daftar Kompetitor
→ + Tambah Kompetitor → isi nama, tipe bisnis, lokasi, catatan
→ Bisa isi koordinat manual atau klik tombol "Cari" untuk geocoding dari nama alamat
       ↓
Kotak Pencarian di Peta:
→ Ketik keyword (contoh: "toko bahan bangunan") → klik Cari
→ Peta menampilkan semua bisnis serupa dalam area yang sedang dilihat
→ Klik pin hasil pencarian untuk lihat nama & info bisnis
```

---

## Ringkasan: Data Otomatis yang Terbuat

| Kejadian | Data Otomatis | Perlu Input Manual? |
|---|---|---|
| Transaksi kasir LUNAS | Cashflow INCOME | ❌ Tidak perlu |
| Transaksi DP | Cashflow INCOME (sebesar DP) | ❌ |
| Transaksi KREDIT | Cashflow belum tercatat (nol) | ❌ |
| Transaksi BAYAR NANTI | Cashflow belum tercatat (nol) | ❌ |
| Pelunasan piutang | Cashflow INCOME (sebesar sisa) | ❌ |
| Produk cetak terjual | Job produksi masuk antrian | ❌ |
| Operator mulai cetak | Stok bahan roll terpotong | ❌ |
| Mulai pasang (rakitan) | Stok BOM terpotong | ❌ |
| Tutup shift | Laporan WA terkirim | ❌ |
| Tutup shift | Saldo rekening bank diupdate | ❌ |
| Konfirmasi opname | StockMovement ADJUST tercatat | ❌ |
| Pengeluaran/Pemasukan lain | Cashflow entry | ✅ Input manual di /cashflow |

---

## Lihat Juga

| Wiki | Relevansi |
|---|---|
| [Kasir POS](README.md#-3-kasir--point-of-sale-pos) | Detail lengkap cara bertransaksi di kasir |
| [Antrian Produksi](produksi.md) | Panduan lengkap untuk operator mesin cetak |
| [Invoice & SPH](invoice-sph.md) | Cara buat dokumen B2B profesional |
| [Cashflow Bisnis](cashflow.md) | Cara baca laporan arus kas |
| [Kalkulator HPP](hpp-calculator.md) | Cara hitung HPP dan simpan ke produk |
| [Stok Opname](stock-opname.md) | Panduan hitung fisik stok berkala |
| [Backup & Restore](backup.md) | Cara backup, auto-backup Rclone, dan pulihkan data |
| [Riwayat Tutup Shift](riwayat-shift.md) | Log historis shift, backup pesan WA, kirim ulang |

---

*Dokumentasi PosPro — Terakhir diperbarui: 16 April 2026*

**© 2026 Muhammad Faisal. All rights reserved.**
