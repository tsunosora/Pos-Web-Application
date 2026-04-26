# 📊 Laporan Stok

Halaman **Laporan Stok** (`/reports/stock`) memberikan visibilitas lengkap atas semua pergerakan stok dalam periode tertentu — siapa yang melakukan pembelian bahan baku, berapa yang terjual, kapan terjadi koreksi, dan berapa saldo stok saat ini.

---

## Cara Membuka

Dari sidebar navigasi: **Laporan → Laporan Stok**

Atau akses langsung ke `/reports/stock`.

---

## Filter Laporan

### Preset Tanggal

| Preset | Rentang |
|---|---|
| **Hari Ini** | 00:00 s/d sekarang |
| **Bulan Ini** | Awal bulan s/d sekarang |
| **Bulan Lalu** | Seluruh bulan kalender sebelumnya |
| **Kustom** | Pilih tanggal dari–sampai secara bebas |

Klik salah satu tombol preset untuk langsung memuat data. Untuk rentang bebas, pilih **Kustom** lalu isi dua kolom tanggal.

### Filter Tipe Pergerakan

| Filter | Arti |
|---|---|
| **Semua** | Tampilkan semua jenis pergerakan |
| **Masuk (IN)** | Hanya stok yang bertambah (pembelian, opname, manual +) |
| **Keluar (OUT)** | Hanya stok yang berkurang (penjualan, BOM, susut) |
| **Koreksi (ADJUST)** | Hanya penyesuaian stok (opname selesai, manual adjust) |

### Pencarian

Ketik nama produk, nama varian, atau SKU di kolom pencarian untuk memfilter baris secara langsung.

---

## Kartu Ringkasan

Di bagian atas halaman, tersedia 4 kartu ringkasan yang terupdate sesuai filter aktif:

| Kartu | Keterangan |
|---|---|
| **Total Pergerakan** | Jumlah baris log stok dalam periode |
| **Total Masuk** | Akumulasi quantity stok yang masuk (IN) |
| **Total Keluar** | Akumulasi quantity stok yang keluar (OUT) |
| **Total Koreksi** | Jumlah entri koreksi (ADJUST) dalam periode |

---

## Tabel Pergerakan Stok

Tabel menampilkan hingga **1.000 baris terbaru** sesuai filter. Kolom yang tersedia:

| Kolom | Keterangan |
|---|---|
| **Tanggal & Waktu** | Kapan pergerakan tercatat |
| **Produk / Varian** | Nama produk dan varian (beserta SKU) |
| **Tipe** | Badge berwarna: MASUK (hijau) / KELUAR (merah) / KOREKSI (biru) |
| **Jumlah** | Kuantitas yang bergerak — dalam satuan nyata produk (bukan ×100) |
| **Saldo Setelah** | Stok tersisa setelah pergerakan ini |
| **Keterangan** | Alasan pergerakan + link ke nota + nama customer + badge cabang/titipan (kalau dari transaksi) |

### Kolom Keterangan dengan Link Nota ⭐

Setiap movement yang berasal dari transaksi otomatis menampilkan:
1. **Reason text** dengan suffix invoice (mis. *"Terpotong oleh Penjualan Banner — SO-20260426-0007"*)
2. **Link nota biru** dengan icon ↗ — klik buka detail transaksi `/transactions/[id]`
3. **Nama customer** (font medium, dipisah `·`)
4. **Badge cabang/titipan**:
   - 🏢 **PST** (sky badge) — nota cabang biasa
   - ⚑ **Titipan BTL → PST** (amber badge) — nota titip cetak antar cabang
5. **Badge "Nota Dihapus"** (merah) — kalau transaksi sudah dihapus, info masih tersnapshot di reason text

Resolver bisa menangani 2 format `referenceId`:
- `tx-<invoiceNumber>` — dari checkout/edit/hapus transaksi
- `JOB-<date>-<seq>` — dari operator klik "Mulai Job" di `/produksi` (lookup via ProductionJob → transaction)

### Keterangan Pergerakan Stok

| Keterangan | Artinya |
|---|---|
| `Penjualan ... — SO-20260426-XXXX` | Stok terpotong karena transaksi di kasir (UNIT product) |
| `Penjualan Cetak WxH ×Npcs (Ym²) — SO-...` | Stok terpotong AREA_BASED tanpa production job |
| `Terpotong oleh Penjualan ... — SO-...` | BOM ingredient terpotong otomatis |
| `Terpotong (varian) oleh Penjualan ... — SO-...` | Variant-level BOM terpotong |
| `Pembelian #purchase-N` | Stok bertambah dari pembelian bahan baku |
| `Stok Opname #...` | Stok dikoreksi dari hasil opname fisik |
| `Penyesuaian Manual` | Koreksi stok oleh admin secara manual |
| `Hapus Transaksi SO-... \| Customer \| Titipan BTL → PST` | Restore stok dari hapus nota — info customer & titipan ter-snapshot di reason supaya tetap kebaca walau transaksi sudah dihapus |
| `Susut: ...` | Penyusutan bahan (catatan susut) |
| `Produksi Job #JOB-...` | Stok terpotong saat operator klik "Mulai Job" di `/produksi` |
| `Pemasangan Job #JOB-... — <ingredient>` | BOM rakitan terpotong saat operator klik "Mulai Pasang" |
| `Gabung Cetak BATCH-...` | Stok terpotong saat batch print mode |
| `Bayar titipan cetak (ledger #X) ke cabang #Y` | Stok dikirim ke cabang lain sebagai pelunasan Buku Titipan |
| `Terima bahan dari cabang #X (ledger #Y)` | Stok masuk dari cabang lain sebagai pelunasan Buku Titipan |

### Tampilan Quantity

Quantity ditampilkan dalam satuan nyata produk:
- Nilai integer (misal `5`, `100`) tampil tanpa desimal
- Nilai desimal (misal `2.5`, `0.375`) tampil hingga 4 angka di belakang koma, trailing zero dihapus otomatis

---

## Export CSV

Klik tombol **Export CSV** di pojok kanan atas tabel untuk mengunduh semua baris yang sedang ditampilkan (sesuai filter aktif) ke file `.csv`.

File CSV berisi kolom: **Tanggal, Produk, Varian, SKU, Tipe, Jumlah, Saldo Setelah, Keterangan**.

File otomatis diberi nama `laporan-stok-YYYY-MM-DD.csv` berdasarkan tanggal hari ini.

---

## Tips Penggunaan

**Cek stok masuk hari ini:**
1. Klik preset **Hari Ini**
2. Klik filter **Masuk (IN)**
3. Semua pembelian dan tambah stok hari ini tampil

**Review pergerakan bahan baku bulan lalu:**
1. Klik preset **Bulan Lalu**
2. Cari nama bahan baku di kolom pencarian
3. Lihat kapan bahan baku masuk (pembelian) dan kapan keluar (terpotong BOM/produksi)

**Audit koreksi stok:**
1. Klik filter **Koreksi (ADJUST)**
2. Lihat semua perubahan stok dari opname dan penyesuaian manual
3. Export CSV untuk arsip pembukuan

---

## Catatan Teknis

- Data diambil langsung dari tabel `StockMovement` — setiap pergerakan dicatat secara real-time oleh sistem
- Quantity tersimpan dalam format `Decimal(10,4)` — akurat untuk produk per-meter, per-kg, maupun per-pcs
- Batas tampil: **1.000 baris terbaru** per query — gunakan filter tanggal untuk mempersempit jika data besar
- Kolom **Saldo Setelah** menunjukkan stok setelah pergerakan tersebut, bukan stok saat ini — untuk stok saat ini cek halaman Inventori

---

## Riwayat Stok per Varian

Selain laporan stok global di `/reports/stock`, ada juga **modal Riwayat Stok per varian** yang bisa dibuka dari halaman `/inventory`:

1. Klik ikon **jam/history** di kolom Aksi pada baris varian
2. Modal muncul dengan list movement varian itu (50 terakhir, paginated)
3. Setiap entry tampilkan: tipe (MASUK/KELUAR/KOREKSI), reason, qty, sisa stok, link nota & customer & badge titipan (kalau dari transaksi)

Sama enrichment seperti `/reports/stock` — tinggal klik link nota untuk pindah ke detail transaksi.

---

## Multi-Cabang

- Staff cabang Bantul lihat `/reports/stock` → hanya movement Bantul
- Owner mode "Semua Cabang" → semua movement dari semua cabang
- Owner switch ke cabang spesifik → filter ke cabang itu

Untuk movement **titip cetak**: stok terpotong tercatat di cabang **pelaksana** (cabang yang mencetak), bukan cabang pemesan. Jadi lihat dari `/reports/stock` cabang Pusat → akan ada movement OUT dengan badge `⚑ Titipan BTL → PST` (artinya nota dari Bantul, tapi stok terpotong di Pusat).

---

*Halaman ini ditambahkan di versi v3.0 — April 2026 | Updated v3.1: link nota + badge titipan di kolom Keterangan*

**© 2026 Muhammad Faisal. All rights reserved.**
