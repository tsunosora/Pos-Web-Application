# 📦 Stok Masuk, Transfer & Mutasi


Tiga jalan stok berubah di PosPro: **dibeli**, **dipindah antar cabang**, dan
**terpakai oleh penjualan**. Semuanya meninggalkan jejak di `stock_movements`,
jadi pertanyaan "stok ini hilang ke mana?" selalu bisa dijawab.

## Langkah demi langkah: transfer stok antar cabang

### 1. Pilih cabang asal & tujuan, lalu barangnya

![Form transfer: cabang asal, cabang tujuan, catatan, dan daftar barang](images/inv-5-transfer.webp)

Cabang asal dan tujuan dipilih lebih dulu, baru barangnya dicari dan diisi
jumlahnya. Catatan membantu mengingat alasan pemindahan.

### 2. Transfer dibuat

![Transfer tercatat setelah dibuat](images/inv-6-terkirim.webp)

Begitu dibuat, stok cabang pengirim berkurang dan cabang penerima bertambah
dalam satu langkah — total stok perusahaan tidak berubah.

### 3. Jejaknya di laporan stok

![Laporan stok memuat mutasi dari transfer tadi](images/inv-7-mutasi.webp)

Semua pergerakan — pembelian, penjualan, transfer, opname — meninggalkan jejak
di [Laporan Stok](laporan-stok.md), jadi pertanyaan "stok ini hilang ke mana?"
selalu bisa dijawab.

---

## 1. Pembelian dari supplier

Halaman pembelian mencatat nota dari supplier: bahan apa, berapa banyak, harga
beli berapa. Selain menambah stok, harga belinya menjadi acuan
[HPP](hpp-calculator.md) — jadi mencatat pembelian bukan pekerjaan administratif
belaka, tapi yang menjaga perhitungan modal tetap benar.

Data tersimpan di `stock_purchases` + `stock_purchase_items`, dan daftar barang
yang biasa dibeli dari tiap supplier ada di `supplier_items`.

## 2. Transfer antar cabang

Halaman **`/inventory/transfer`** memindahkan bahan dari satu cabang ke cabang
lain. Yang penting dipahami: transfer **mengurangi stok pengirim dan menambah
stok penerima** dalam satu langkah, sehingga total stok perusahaan tidak berubah
— berbeda dari pembelian (menambah) atau penjualan (mengurangi).

Tabelnya `stock_transfers` + `stock_transfer_items`, dan stok per cabang
disimpan di `branch_stocks`.

> Jangan bingung dengan **[Titip Cetak](titip-cetak.md)** dan
> **[Buku Titipan](buku-titipan.md)**. Transfer stok memindahkan *bahan*;
> titip cetak memindahkan *pekerjaan*; buku titipan mencatat *utang jasa*
> antar cabang.

## 3. Terpakai oleh penjualan

Setiap nota untuk produk bertanda `trackStock` memotong stok lewat resep
bahannya. Kalau stok tidak cukup, nota **ditolak** dengan menyebut nama
bahannya — ini disengaja, supaya tidak ada penjualan yang stoknya minus.

## Menyelaraskan dengan kenyataan

Angka di sistem pasti bergeser dari kenyataan (susut, sisa potongan, salah
catat). Yang menyelaraskannya adalah **[Stok Opname](stock-opname.md)**, dan
hasil laporannya dibaca di **[Laporan Stok](laporan-stok.md)**.

Untuk bahan yang dipakai cabang lain tapi miliknya cabang tertentu, rekapnya di
**`/reports/inter-branch-usage`** — lihat [Buku Titipan](buku-titipan.md).

## Halaman & tabel terkait

| Halaman | Tabel utama |
|---|---|
| `/inventory` | `products`, `product_variants`, `branch_stocks` |
| `/inventory/transfer` | `stock_transfers`, `stock_transfer_items` |
| `/inventory/opname` | `stock_opname_sessions`, `stock_opname_items` |
| `/inventory/suppliers` | `suppliers`, `supplier_items` |
| `/reports/stock` | `stock_movements` |
