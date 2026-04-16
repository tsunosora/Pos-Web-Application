# 📄 Invoice Generator & Penawaran Harga (SPH)

> Halaman **Invoice & Penawaran** adalah modul untuk membuat dokumen bisnis profesional — baik **Invoice (Faktur Tagihan)** maupun **Surat Penawaran Harga (SPH)**. Dirancang khusus untuk bisnis yang melayani klien perusahaan, brand, event organizer, atau instansi yang memerlukan dokumen formal sebelum dan sesudah deal.

---

## Apa Bedanya Invoice dan SPH?

| | Invoice (Faktur Tagihan) | SPH (Surat Penawaran Harga) |
|---|---|---|
| **Tujuan** | Menagih klien yang sudah sepakat | Menawarkan harga ke calon klien |
| **Kapan dibuat** | Setelah deal dan pekerjaan siap ditagih | Sebelum deal — saat klien minta penawaran |
| **Nomor** | `INV-YYYYMMDD-XXX` | `SPH-YYYYMMDD-XXX` |
| **Tanggal penting** | Jatuh Tempo (due date) | Berlaku Hingga (valid until) |
| **Cocok untuk** | Tagihan pekerjaan yang sudah disepakati | Penawaran ke procurement perusahaan |

**Alur kerja umum:**
```
Klien minta penawaran → Buat SPH → Kirim ke klien
     → Klien ACC → Konversi SPH ke Invoice → Tagih pembayaran
```

---

## Cara Mengakses

Di sidebar kiri, klik menu **📄 Invoice & Penawaran**.

---

## Tampilan Halaman

Di bagian atas terdapat **dua tab**:
- Tab **Invoice** — daftar semua faktur tagihan
- Tab **Penawaran Harga (SPH)** — daftar semua surat penawaran

Masing-masing tab memiliki kartu ringkasan di bagian atas:

### Kartu di Tab Invoice
| Kartu | Penjelasan |
|---|---|
| **Total Invoice** | Berapa total invoice yang pernah dibuat |
| **Belum Lunas** | Invoice dengan status SENT yang belum dibayar |
| **Jatuh Tempo** | Invoice yang sudah melewati due date dan belum PAID |

### Kartu di Tab SPH
| Kartu | Penjelasan |
|---|---|
| **Total SPH** | Berapa total penawaran yang pernah dibuat |
| **Menunggu Respons** | SPH yang sudah dikirim, belum ada jawaban dari klien |
| **Diterima** | SPH yang sudah disetujui klien (ACCEPTED) |

---

## Cara Membuat Dokumen Baru

### Langkah 1 — Klik Tombol Buat

- Di tab **Invoice**: klik **+ Buat Invoice**
- Di tab **SPH**: klik **+ Buat SPH**

### Langkah 2 — Isi Informasi Klien

| Field | Keterangan |
|---|---|
| **Nama Klien** *(wajib)* | Nama orang atau PIC yang bertanggung jawab |
| **Nama Perusahaan** | Nama instansi/perusahaan klien (opsional) |
| **Email** | Email klien untuk pengiriman dokumen |
| **Nomor HP** | Nomor WhatsApp/HP klien |
| **Alamat** | Alamat lengkap perusahaan atau klien |

### Langkah 3 — Isi Tanggal

- **Invoice**: Tanggal Dokumen + **Tanggal Jatuh Tempo** (deadline bayar)
- **SPH**: Tanggal Dokumen + **Berlaku Hingga** (batas waktu penawaran ini valid)

### Langkah 4 — Tambahkan Item Pekerjaan

Ini bagian inti dokumen — rincian produk/jasa apa saja yang ditagihkan atau ditawarkan.

> Lihat bagian **"Cara Input Item"** di bawah untuk penjelasan lengkap tiga mode input.

### Langkah 5 — Isi Diskon dan Pajak (Opsional)

| Field | Keterangan |
|---|---|
| **Diskon (%)** | Potongan harga dari subtotal, contoh: `10` untuk 10% |
| **PPN (%)** | Pajak Pertambahan Nilai, contoh: `11` untuk PPN 11% |

Perhitungan otomatis:
```
Subtotal          = Total semua item
Setelah Diskon    = Subtotal - (Subtotal × Diskon%)
PPN               = Setelah Diskon × PPN%
TOTAL AKHIR       = Setelah Diskon + PPN
```

### Langkah 6 — Tambahkan Catatan (Opsional)

Isi kolom **Catatan/Notes** untuk informasi tambahan seperti:
- Syarat pembayaran ("Pembayaran paling lambat 14 hari")
- Informasi rekening bank tujuan transfer
- Catatan khusus untuk klien

### Langkah 7 — Simpan

Klik **Simpan** — dokumen tersimpan dengan status **DRAFT**.

---

## Cara Input Item (3 Mode)

### Mode 1 — Pilih dari Katalog Produk

Cocok ketika produk atau jasa sudah ada di daftar inventori toko.

1. Klik kolom **Deskripsi Pekerjaan** di baris item
2. Mulai ketik nama produk — dropdown pencarian akan muncul
3. Klik produk atau varian yang sesuai dari hasil pencarian
4. **Harga otomatis terisi** sesuai harga yang terdaftar di inventori
5. Sesuaikan **Qty** (jumlah) dan **Satuan** jika perlu

**Keuntungan mode ini:** Harga konsisten dengan yang ada di sistem, tidak perlu input ulang, dan bisa langsung pilih varian (misalnya ukuran atau warna produk).

---

### Mode 2 — Input Custom (Jasa / Item Non-Katalog)

Cocok untuk jasa yang belum terdaftar di inventori, atau item dengan harga yang dinegosiasi khusus per proyek.

1. Ketik langsung **deskripsi bebas** di kolom Deskripsi Pekerjaan
   - Contoh: "Jasa Desain Logo", "Instalasi Sistem CCTV", "Konsultasi Branding"
2. Ketik atau pilih **Satuan** (contoh: `paket`, `jam`, `hari`, `pcs`)
3. Input **Qty** dan **Harga Satuan** secara manual

**Keuntungan mode ini:** Fleksibel total — tidak terbatas pada katalog produk yang ada.

---

### Mode 3 — Area Based (Banner, Spanduk, Sticker per m²)

Mode khusus untuk produk percetakan yang dihitung berdasarkan ukuran fisik (lebar × tinggi).

**Cara mengaktifkan:**
- Pilih produk bertipe **Area Based** dari katalog, ATAU
- Klik ikon **📐** di baris item untuk mengaktifkan mode area secara manual

**Setelah mode aktif**, sub-baris biru akan muncul di bawah item:

```
┌─────────────────────────────────────────────────────────┐
│  📐 L (Lebar): [3] m  ×  T (Tinggi): [2] m  = 6 m²    │
└─────────────────────────────────────────────────────────┘
```

- Isi **L (Lebar)** dalam meter — contoh: `3`
- Isi **T (Tinggi)** dalam meter — contoh: `2`
- Total m² terhitung otomatis: `3 × 2 = 6 m²`
- **Qty** otomatis terisi = 6 (total m²)
- **Satuan** terkunci ke `m²`
- **Total harga** = Harga/m² × Total m²

**Contoh nyata:**
```
Banner MMT Outdoor
  L: 4m × T: 1.5m = 6 m²
  Harga: Rp 45.000/m²
  Total: Rp 270.000
```

**Saat dokumen disimpan**, deskripsi item otomatis diperbarui menjadi:
`"Banner MMT Outdoor (4m × 1.5m)"` — sehingga klien bisa melihat ukuran yang dipesan.

---

## Alur Status Dokumen

Status dokumen menunjukkan di tahap mana proses bisnis sedang berjalan.

### Status Invoice

| Status | Arti | Langkah Selanjutnya |
|---|---|---|
| **DRAFT** | Baru dibuat, belum dikirim | Ubah ke SENT setelah siap kirim |
| **SENT** | Sudah dikirim ke klien | Ubah ke PAID saat klien membayar |
| **PAID** | Sudah lunas dibayar | Selesai |
| **CANCELLED** | Dibatalkan | Selesai |

### Status SPH (Penawaran Harga)

| Status | Arti | Langkah Selanjutnya |
|---|---|---|
| **DRAFT** | Baru dibuat, belum dikirim | Ubah ke SENT saat siap dikirim ke klien |
| **SENT** | Sudah dikirim, menunggu respons klien | Ubah sesuai jawaban klien |
| **ACCEPTED** | Klien setuju dengan penawaran | Konversi ke Invoice untuk penagihan |
| **REJECTED** | Klien menolak penawaran | Arsip atau buat SPH baru dengan revisi harga |
| **EXPIRED** | Masa berlaku habis tanpa respons | Tawarkan lagi dengan SPH baru |

### Cara Mengubah Status

Di tabel daftar dokumen, klik tombol aksi di kolom **Status** — pilihan status yang tersedia akan muncul sesuai alur yang logis.

---

## Konversi SPH ke Invoice

Ketika klien menyetujui penawaran Anda:

1. Ubah status SPH menjadi **ACCEPTED** (klik tombol di kolom aksi)
2. Tombol **"🔄 Jadikan Invoice"** akan muncul di baris tersebut
3. Klik tombol tersebut — sistem otomatis membuat Invoice baru dengan:
   - Nomor baru format `INV-YYYYMMDD-XXX`
   - Semua data klien, item, diskon, PPN dari SPH diambil otomatis
   - Due date diset 14 hari dari tanggal konversi
4. Invoice baru langsung muncul di tab Invoice dengan status **DRAFT** — siap dikirim ke klien

**Tidak perlu input ulang apapun** — semua data berpindah otomatis.

---

## Cetak / Export ke PDF

1. Di baris dokumen yang ingin dicetak, klik ikon **🖨️**
2. Jendela cetak akan terbuka dengan tampilan profesional:
   - Header: Logo toko + nama dan alamat toko
   - Info klien: nama, perusahaan, email, HP, alamat
   - Nomor dokumen, tanggal, dan jatuh tempo
   - Tabel item dengan Qty, Satuan, Harga Satuan, Subtotal
   - Baris Diskon dan PPN
   - **Total Akhir** yang jelas dan besar
   - Catatan/Notes di bagian bawah
3. Gunakan **Ctrl+P** (Windows) atau **Cmd+P** (Mac) untuk:
   - **Cetak fisik** ke printer
   - **Simpan sebagai PDF** — pilih "Save as PDF" sebagai printer tujuan

---

## Tips Penggunaan

**Selalu mulai dari DRAFT** — simpan dulu, baca ulang seluruh dokumen, pastikan tidak ada yang salah sebelum dikirim ke klien.

**Manfaatkan SPH untuk klien baru** — jauh lebih profesional dibanding kirim harga via chat WhatsApp. Klien perusahaan biasanya memerlukan dokumen formal untuk proses approval internal mereka.

**Set "Berlaku Hingga" yang realistis** — biasanya 7–14 hari untuk harga yang berfluktuasi (bahan baku, dolar), atau 30 hari untuk jasa/harga tetap. Ini mendorong klien lebih cepat memutuskan.

**Gunakan Catalog Picker** untuk produk yang ada di inventori — harga terjaga konsisten dan tidak perlu input manual yang rentan typo.

**Catat semua catatan penting di Notes** — rekening bank tujuan transfer, syarat pembayaran, catatan khusus proyek. Ini akan tercetak di dokumen dan memudahkan klien.

---

## Pertanyaan Umum

**Q: Apakah bisa buat invoice untuk transaksi yang sudah terjadi di kasir?**
> Invoice di modul ini terpisah dari kasir POS — ditujukan untuk proyek/klien B2B yang butuh dokumen formal, bukan untuk transaksi ritel harian.

**Q: Berapa banyak item yang bisa ditambahkan dalam satu dokumen?**
> Tidak ada batasan — Anda bisa menambahkan sebanyak item yang dibutuhkan.

**Q: Bisa tidak mengubah isi Invoice setelah dikirim (status SENT)?**
> Bisa — klik ikon edit di baris dokumen untuk membuka form edit. Pastikan Anda konfirmasi ulang ke klien jika ada perubahan setelah dokumen dikirim.

**Q: Apakah SPH yang sudah dikonversi ke Invoice masih bisa diedit?**
> SPH aslinya tetap tersimpan dan tidak berubah. Invoice baru yang dibuat dari konversi adalah dokumen terpisah yang bisa diedit secara independen.

---

*Dokumentasi PosPro — Invoice & Penawaran Harga | Terakhir diperbarui: April 2026*

**© 2026 Muhammad Faisal. All rights reserved.**
