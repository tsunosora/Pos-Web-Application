# 🧮 Kalkulator HPP (Harga Pokok Penjualan)

> Kalkulator HPP adalah alat bantu untuk menghitung biaya produksi per unit secara terstruktur — terpisah dari alur transaksi kasir. Hasil kalkulasi bisa langsung diterapkan ke varian produk di inventori sebagai nilai HPP resmi.

---

## Apa itu HPP?

**HPP (Harga Pokok Penjualan)** adalah total biaya yang dikeluarkan untuk memproduksi satu unit produk — mencakup bahan baku, bahan pendukung, dan overhead (listrik, sewa, gaji, dll).

Dengan mengetahui HPP yang akurat, pemilik toko bisa:
- Menentukan harga jual yang menghasilkan margin yang diinginkan
- Memantau apakah harga jual saat ini masih menguntungkan
- Membandingkan HPP antar ukuran/varian produk secara sekaligus

---

## Membuka Kalkulator HPP

Buka menu **Laporan → Kalkulator HPP** (atau akses `/reports/hpp`).

> **Mode Edit dari Halaman Produk**: Saat di halaman edit produk (`/inventory/products/[id]/edit`), terdapat tombol "Hitung HPP" yang membuka halaman ini dengan URL parameter `?editProductId=xxx`. Sistem otomatis masuk ke **Mode Edit** — worksheet sudah terisi data produk tersebut, dan tombol simpan akan memperbarui produk itu langsung (bukan membuat produk baru).

---

## Worksheet — Lembar Kerja HPP

**Worksheet** adalah satu "lembar kerja" untuk satu jenis produk. Semua worksheet tersimpan di server dan bisa dibuka kembali kapan saja.

### Bar Navigasi Worksheet

Di bagian atas halaman terdapat **bar selector worksheet** dengan 3 tombol:

| Tombol | Fungsi |
|---|---|
| **Simpan** (biru) | Simpan worksheet aktif ke server |
| **Baru** (hijau) | Reset form untuk membuat worksheet baru |
| **Hapus** (merah) | Hapus worksheet yang sedang aktif (muncul hanya jika ada worksheet aktif) |

Dropdown di sebelah kiri menampilkan semua worksheet tersimpan. Pilih dari dropdown untuk membuka worksheet lama.

---

## Parameter Kalkulasi

Setelah memilih atau membuat worksheet, isi bagian **Parameter Kalkulasi**:

### Nama Produk & Kategori
- **Nama Produk** (wajib): nama produk yang akan dihitung HPP-nya, misalnya "Spanduk MMT 440gsm" atau "Kopi Susu Aren"
- **Kategori Produk**: kategori yang akan dipakai saat produk didaftarkan ke inventori

### Terapkan HPP ke Varian Produk (kotak ungu)

Bagian ini memungkinkan penerapan HPP worksheet ke varian produk yang **sudah ada** di inventori secara langsung, tanpa perlu masuk ke halaman Multi-Varian:

1. Pilih produk dari dropdown
2. Centang varian yang ingin di-update HPP-nya (atau klik "Pilih semua")
3. Klik **Terapkan ke Varian Terpilih (N)**

> Tombol terapkan hanya muncul jika: ada varian dipilih, kalkulasi sudah dijalankan, dan worksheet sudah tersimpan.

### Gambar Produk (Opsional)

Upload gambar produk yang akan digunakan saat produk didaftarkan ke inventori. Klik area gambar atau tombol "Pilih Gambar dari Perangkat". Format: JPG, PNG, WEBP. Maks 5MB.

### Mode Perhitungan HPP

Pilih salah satu dari dua mode:

| Mode | Kapan Dipakai | Cara Hitung |
|---|---|---|
| **Per Pcs (Satuan)** | Produk dijual satuan — kopi, sablon, banner | Bahan baku diisi per 1 unit produk jadi. HPP = total bahan per 1 pcs |
| **Per Resep (Batch)** | Produk massal — kue 1 loyang, catering 1 pot | Bahan baku diisi untuk sekali produksi penuh. Isi "Jumlah Hasil Jadi" (misal: 12 potong/loyang). HPP per pcs = total bahan ÷ jumlah hasil jadi |

---

## Kalkulasi Multi-Varian

Bagian ini (bisa dilipat) memungkinkan penghitungan HPP beberapa ukuran/varian sekaligus dari satu worksheet yang sama.

**Contoh penggunaan:** Spanduk MMT tersedia dalam 3 ukuran (60×90cm, 100×150cm, 200×300cm). HPP per m² sama, tapi total HPP berbeda karena luasnya berbeda.

### Mode Kalkulasi

Pilih mode di tombol atas tabel:

| Mode | Kapan Dipakai | Field yang Diisi |
|---|---|---|
| **Area (m²)** | Produk cetak (spanduk, sticker, banner) | Lebar (m) dan Tinggi (m) per varian |
| **Unit (×)** | Produk satuan dengan faktor pengali (misal paket bundel) | Faktor pengali (angka) per varian |

### Kolom Per Baris Varian

| Kolom | Isi |
|---|---|
| **Nama Varian** | Identitas: ukuran, jenis, finishing (mis: "60×90 cm", "A3 Glossy") |
| **Lebar/Tinggi** atau **Faktor** | Tergantung mode yang dipilih |
| **+ Biaya** | Biaya tambahan flat: laminasi doff Rp 5.000, mata ayam Rp 2.000, dll |
| **HPP Base** | Otomatis = HPP/unit × skala (luas m² atau faktor) |
| **HPP Final** | Otomatis = HPP Base + Biaya Tambahan — **nilai ini yang disimpan ke produk** |
| **Link Varian** | Hubungkan baris ke varian yang sudah ada di inventori |
| **Tier** | Klik badge untuk membuka editor harga bertingkat (opsional) |

### Harga Bertingkat per Varian (Opsional)

Klik badge **[+ tier]** atau **[N tier]** di kolom Tier untuk mengatur harga berdasarkan qty:
- Min Qty dan Max Qty (kosongkan Max = tidak ada batas atas)
- Harga per unit pada range qty tersebut
- Label opsional: "Reseller", "Grosir", dll

### Menyimpan Multi-Varian

Klik **Simpan & Terapkan Semua (N varian)** — hanya baris yang sudah di-link ke varian atau ditandai sebagai varian baru yang akan diproses.

---

## Biaya Variabel (Bahan Baku)

Biaya yang berubah proporsional dengan jumlah produksi. Setiap baris mewakili satu bahan baku atau material.

### Sumber Bahan

Setiap baris punya dua mode input:

- **Dari Stok Inventori** (default): ketik nama di dropdown pencarian, pilih varian produk dari daftar. Harga per satuan otomatis terisi dari data stok.
- **Input Manual**: klik "manual" di dropdown jika bahan belum ada di inventori. Ketik nama dan harga secara bebas.

### Takaran (Mode Satuan)

Isi jumlah pemakaian dan pilih satuan dari dropdown:

| Kelompok | Satuan Tersedia |
|---|---|
| Berat | gram, kg, mg |
| Volume | ml, L, gelas, sdm, sdt |
| Satuan | pcs, buah, lembar, bungkus, box, pak |
| Panjang/Luas | cm, m, m² |

### Takaran (Mode Area m²)

Klik tautan **"pakai m²"** di pojok kanan untuk beralih ke mode luas. Isi:
- **L (m)** — lebar dalam meter
- **T (m)** — tinggi dalam meter

Sistem otomatis menghitung luas (L × T m²) dan menampilkan nilai m² di bawah. Contoh: Vinyl 1,2m × 0,8m = 0,96 m², harga Rp 15.000/m² → biaya Rp 14.400.

Klik **"kembali ke satuan"** untuk menonaktifkan mode m².

### Harga per Satuan

Isi harga dan pilih unit harga dari dropdown (terpisah dari unit takaran). Sistem menghitung konversi jika satuan takaran dan satuan harga berbeda.

### Jadikan Acuan Stok Produk

Checkbox ini muncul untuk baris yang **terhubung ke stok inventori** (bukan input manual). Jika dicentang:
- Stok produk jadi akan dihitung berdasarkan sisa stok bahan ini dibagi dengan takaran pemakaian per pcs.
- Berguna untuk produk yang stoknya bergantung pada satu bahan baku utama.

### Total per Baris

Subtotal setiap baris (hijau) = takaran × harga satuan (dengan konversi unit otomatis).

---

## Biaya Tetap (Fixed Costs)

Biaya overhead yang tetap tanpa memandang jumlah produksi — dibagi rata ke seluruh volume target.

Contoh: listrik Rp 500.000/bulan ÷ target 100 pcs = HPP tambahan Rp 5.000/pcs.

### Mengisi Biaya Tetap

1. Klik **+ Tambah** untuk menambah baris baru
2. Isi **Nama Biaya** (mis: "Sewa Tempat", "Gaji Operator", "Listrik")
3. Isi **Total Biaya Bulanan** dalam rupiah

### Target Volume Penjualan

Input di bagian atas kartu Biaya Tetap. Isi perkiraan jumlah produk yang diproduksi/dijual per bulan. Digunakan untuk membagi total biaya tetap ke per-pcs.

### Preset Biaya Tetap

Klik **Simpan & Gunakan Preset** (tombol kuning) untuk membuka modal preset:

- **Simpan preset baru**: beri nama (mis: "Operasional Bulan Maret") → klik Simpan. Preset menyimpan seluruh daftar biaya tetap saat ini.
- **Gunakan preset**: klik tombol **Gunakan** di preset yang tersimpan — daftar biaya tetap akan diganti dengan isi preset tersebut.
- **Hapus preset**: klik ikon tempat sampah di samping preset.

Preset tersimpan di browser (localStorage) — tidak hilang saat halaman di-refresh, tapi tidak tersinkronisasi antar perangkat.

---

## Menjalankan Kalkulasi

Setelah mengisi semua biaya, klik tombol **REFRESH KALKULASI HASIL** (biru, di bagian bawah form kiri).

---

## Panel Hasil Analisis HPP

Panel di sisi kanan (atau bawah di layar kecil) menampilkan hasil setelah kalkulasi dijalankan.

### Struktur Modal / Pcs

| Item | Keterangan |
|---|---|
| **Bahan Baku** | Total semua biaya variabel per pcs |
| **Biaya Tetap/Pcs** | Total biaya tetap ÷ target volume |
| **TOTAL MODAL POKOK** | HPP = bahan baku + biaya tetap/pcs |

### Opsi Harga Jual

Tiga pilihan harga dengan margin berbeda — klik salah satu untuk memilih:

| Tier | Margin | Keterangan |
|---|---|---|
| **Kompetitif** (biru) | ~10–15% | Harga bersaing, cocok untuk pasar ramai |
| **Standar** (primer) | ~25–35% | Margin sehat, disarankan untuk operasional normal |
| **Premium** (kuning) | ~40–60% | Margin tinggi, cocok untuk produk eksklusif atau layanan cepat |

Tier yang dipilih menjadi dasar harga jual yang digunakan saat mendaftarkan produk.

### Estimasi Laba Bulanan

Menampilkan estimasi laba bersih per bulan = (harga jual − HPP) × target volume.

### Harga Jual Kustom

Jika tidak ingin menggunakan harga dari tier, isi field **Harga Jual Kustom**. Klik "Reset" untuk kembali ke harga yang disarankan sistem.

### Pilih Mode Penjualan

Pilih mode penjualan produk yang akan didaftarkan:
- **Produk Satuan (Pcs/Box)** — harga per unit, mode `UNIT` di kasir
- **Cetak Luas (m²)** — harga per m², mode `AREA_BASED` di kasir (cocok untuk produk cetak digital)

---

## Menyimpan Hasil ke Inventori

### Opsi 1 — Simpan sebagai Produk Baru (Hijau)

Klik **Simpan Perhitungan & Jadikan Produk**:
- Membuat produk baru dengan nama, kategori, dan gambar yang sudah diisi
- Jika tabel Multi-Varian terisi → setiap baris Multi-Varian menjadi satu varian produk, lengkap dengan HPP Final, harga jual, dan price tiers
- Jika Multi-Varian kosong → produk dibuat dengan satu varian default

Setelah sukses, muncul konfirmasi dengan tautan ke halaman produk untuk mengatur detail lebih lanjut.

> **Mode Edit**: Jika halaman dibuka dari halaman edit produk (`?editProductId=xxx`), tombol ini berubah menjadi **Simpan Perubahan Produk** (biru) — data produk yang sudah ada diperbarui, bukan dibuat produk baru.

### Opsi 2 — Tambah sebagai Varian ke Produk yang Ada (Biru)

Klik **Tambah ke Produk Ada**:
1. Pilih produk dari dropdown
2. Isi nama varian baru (mis: "F340", "2m", "Glossy")
3. HPP yang digunakan = nilai HPP/pcs dari kalkulasi saat ini

### Opsi 3 — Perbarui HPP Varian yang Sudah Ada (Kuning)

Klik **Perbarui HPP Varian**:
1. Pilih produk
2. Pilih varian — nilai HPP saat ini ditampilkan di samping nama varian
3. Klik Perbarui HPP — hanya nilai HPP yang berubah, harga jual tidak berubah

### Opsi 4 — Terapkan via Kotak Ungu (Parameter Card)

Lihat bagian [Terapkan HPP ke Varian Produk](#terapkan-hpp-ke-varian-produk-kotak-ungu) di atas — cara bulk apply ke banyak varian sekaligus.

---

## Alur Lengkap yang Disarankan

```
Buka /reports/hpp
      ↓
Pilih worksheet lama ATAU klik Baru untuk worksheet kosong
      ↓
Isi Parameter:
  → Nama produk + kategori
  → Upload gambar (opsional)
  → Pilih Mode: Per Pcs atau Per Batch
      ↓
Isi Bahan Baku (Biaya Variabel):
  → Pilih dari stok atau input manual
  → Isi takaran + satuan (atau aktifkan m² untuk material lembaran)
  → Centang "Jadikan Acuan Stok" jika relevan
      ↓
Isi Target Volume + Biaya Tetap:
  → Tambah listrik, sewa, gaji, dll
  → Simpan sebagai preset jika akan dipakai ulang
      ↓
Klik REFRESH KALKULASI HASIL
      ↓
Pilih tier harga (Kompetitif / Standar / Premium)
→ Atau isi Harga Jual Kustom
→ Pilih Mode Penjualan (Satuan / m²)
      ↓
Klik Simpan (di worksheet bar) untuk simpan worksheet
      ↓
Pilih aksi simpan:
  ├── Simpan & Jadikan Produk (produk baru)
  ├── Tambah ke Produk Ada (varian baru)
  ├── Perbarui HPP Varian (update HPP saja)
  └── Terapkan ke Varian Terpilih via kotak ungu (bulk)
```

---

## Tips Penggunaan

- **Simpan worksheet dulu** sebelum menekan tombol Terapkan/Jadikan Produk — beberapa aksi memerlukan worksheet tersimpan.
- **Preset biaya tetap** berguna untuk toko dengan biaya overhead yang relatif stabil setiap bulan — simpan sekali, gunakan di setiap worksheet baru.
- **Mode Per Batch untuk produk dapur/catering** — lebih mudah menghitung bahan untuk "1 loyang = 12 potong" daripada menghitung per potong satu per satu.
- **Multi-Varian untuk produk cetak** — satu worksheet sudah cukup untuk menghitung HPP semua ukuran banner sekaligus.
- **Jadikan Acuan Stok** hanya perlu dicentang pada bahan baku utama (mis: roll vinyl untuk produk banner) agar estimasi stok produk jadi akurat.
- Setelah HPP diset di varian, **Laporan Laba Kotor** (`/reports/profit`) akan menampilkan margin % yang akurat untuk setiap produk.

---

*Dokumentasi Kalkulator HPP — PosPro v2.8 | 26 Maret 2026*
