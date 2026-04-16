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
| **Keterangan** | Alasan pergerakan (lihat tabel di bawah) |

### Keterangan Pergerakan Stok

| Keterangan | Artinya |
|---|---|
| `Penjualan #INV-...` | Stok terpotong karena transaksi di kasir |
| `Terpotong BOM: ...` | Bahan baku otomatis terpotong via BOM/Ingredient |
| `Pembelian #purchase-N` | Stok bertambah dari pembelian bahan baku |
| `Stok Opname` | Stok dikoreksi dari hasil opname fisik |
| `Penyesuaian Manual` | Koreksi stok oleh admin secara manual |
| `Hapus Transaksi #INV-...` | Stok dikembalikan akibat transaksi dihapus |
| `Susut: ...` | Penyusutan bahan (catatan susut) |
| `Produksi Job #JOB-...` | Stok terpotong saat job produksi dimulai |

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

*Halaman ini ditambahkan di versi v3.0 — April 2026*

**© 2026 Muhammad Faisal. All rights reserved.**
