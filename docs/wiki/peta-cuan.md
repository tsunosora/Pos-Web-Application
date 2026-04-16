# 🗺️ Peta Cuan Lokasi

> **Peta Cuan Lokasi** adalah fitur peta interaktif berbasis OpenStreetMap yang membantu pemilik bisnis **melihat kinerja cabang secara visual**, **mencatat posisi kompetitor**, dan **menemukan bisnis sejenis** di area manapun — semua dalam satu tampilan peta.

---

## Apa Kegunaan Fitur Ini?

Sebagai pemilik bisnis, Anda sering menghadapi pertanyaan seperti:
- "Di area mana saja saya punya cabang dan mana yang performanya bagus?"
- "Ada berapa kompetitor digital printing di radius 5 km dari toko saya?"
- "Jika saya mau buka cabang baru, area mana yang masih kosong kompetitor?"

**Peta Cuan Lokasi menjawab semua itu secara visual** — hanya dengan melihat peta, Anda langsung bisa menganalisis kondisi bisnis dan persaingan di lapangan.

---

## Cara Mengakses

Di sidebar kiri, klik menu **🗺️ Peta Cuan Lokasi**.

---

## Tampilan Halaman

```
┌────────────────────────────────────────────────────────────────┐
│  [🔍 Cari bisnis...] [Cari]    [Cabang ✓] [Kompetitor ✓] [Hasil Cari ✓] │
├───────────────┬────────────────────────────────────────────────┤
│               │                                                │
│  SIDEBAR      │                                                │
│  Tab: Cabang  │           PETA INTERAKTIF                      │
│  Tab: Kompet. │           (OpenStreetMap)                      │
│               │                                                │
│  [+ Tambah]   │                                                │
│  Daftar item  │                                                │
│               │                                                │
│  --- Legenda  │                                                │
│               │                                                │
└───────────────┴────────────────────────────────────────────────┘
```

---

## Fitur 1 — Visualisasi Cabang Toko

### Membaca Warna Marker Cabang

Setiap cabang ditampilkan sebagai **lingkaran berwarna** di peta. Warna mencerminkan margin profit cabang tersebut:

| Warna | Margin Profit | Interpretasi |
|---|---|---|
| 🟢 **Hijau** | > 35% | Cabang sangat profitable — pertahankan performa |
| 🟡 **Kuning** | 15% – 35% | Profit cukup — ada ruang untuk optimasi |
| 🔴 **Merah** | < 15% | Margin rendah — perlu evaluasi serius |

### Melihat Detail Cabang

Klik marker cabang di peta untuk melihat popup detail:

```
● Cabang Utama Imogiri
  Jl. Imogiri Barat No. 45, Bantul

  Omset:   Rp 24.500.000
  Margin:  38%

  ✅ Profit Tinggi
```

---

## Fitur 2 — Mengelola Data Cabang (CRUD)

### Menambah Cabang Baru

**Cara A — Klik Langsung di Peta (paling mudah):**

1. Di sidebar, pastikan tab **Cabang** aktif
2. Klik tombol **+ Tambah Cabang**
3. Banner kuning muncul di atas peta: *"Klik di peta untuk menentukan lokasi cabang"*
4. Kursor berubah menjadi **crosshair (+)**
5. Klik tepat di lokasi cabang pada peta
6. Form otomatis terbuka dengan koordinat yang sudah terisi
7. Lengkapi data:
   - **Nama Cabang** — contoh: "Cabang Bantul"
   - **Alamat** — alamat lengkap
   - **Omset (Rp)** — omset rata-rata per bulan
   - **Margin (%)** — persentase margin profit
8. Klik **Simpan** — marker langsung muncul di peta

**Cara B — Input Alamat dengan Geocoding:**

1. Di form tambah/edit cabang, ketik alamat di kolom **Alamat**
2. Klik tombol **📍 Cari** di sebelah kolom koordinat
3. Sistem otomatis mencari koordinat GPS berdasarkan alamat tersebut
4. Kolom Latitude dan Longitude terisi otomatis
5. Klik **Simpan**

> **Geocoding** adalah proses mengubah teks alamat menjadi koordinat GPS (latitude/longitude). Fitur ini menggunakan layanan **Nominatim** dari OpenStreetMap — gratis dan tidak perlu API key.

### Mengedit Data Cabang

1. Di sidebar, temukan nama cabang di daftar
2. Klik tombol **✏️** di sebelah nama cabang
3. Form edit terbuka — ubah data yang ingin diperbarui (omset, margin, nama, alamat, atau koordinat)
4. Klik **Simpan**

> **Tips:** Update omset dan margin secara rutin (idealnya bulanan) agar visualisasi warna di peta akurat mencerminkan kondisi terkini.

### Menghapus Cabang

1. Di sidebar, klik tombol **🗑️** di sebelah nama cabang
2. Konfirmasi penghapusan
3. Marker hilang dari peta

---

## Fitur 3 — Melacak Kompetitor

### Melihat Kompetitor di Peta

Kompetitor ditampilkan sebagai **kotak merah miring (♦ diamond)** di peta.

Klik marker untuk melihat popup detail:

```
♦ Digital Printing Maju Jaya
  Percetakan
  Jl. Parangtritis Km. 7, Bantul
  "Harga murah, mesin baru 2024"
```

### Menambah Kompetitor Baru

1. Di sidebar, klik tab **Kompetitor**
2. Klik tombol **+ Tambah Kompetitor**
3. Banner muncul, kursor berubah ke crosshair
4. Klik lokasi kompetitor di peta
5. Isi form:
   - **Nama** — nama bisnis kompetitor
   - **Tipe Bisnis** — contoh: "Digital Printing", "Percetakan Offset", "Fotocopy"
   - **Alamat** — alamat bisnis (opsional, bisa pakai geocoding)
   - **Catatan** — info penting tentang kompetitor (harga, keunggulan, kelemahan, dll)
6. Klik **Simpan**

### Kapan Fitur Ini Berguna?

- Tandai semua kompetitor di area operasional Anda sebagai **referensi visual**
- Tambahkan catatan tentang kekuatan/kelemahan mereka untuk strategi bersaing
- Identifikasi apakah ada "blank spot" (area tanpa kompetitor) yang bisa dimasuki

---

## Fitur 4 — Pencarian Bisnis by Keyword

Fitur paling powerful di Peta Cuan — memungkinkan Anda **menemukan semua bisnis dengan kategori tertentu** di area manapun yang sedang Anda lihat di peta.

### Cara Kerja

Fitur ini terhubung ke **Overpass API** (database bisnis OpenStreetMap) — database peta dunia yang bisa dicari secara bebas.

### Langkah Penggunaan

1. **Arahkan peta** ke area yang ingin Anda teliti (scroll, zoom, atau drag peta)
2. Di kotak pencarian di **Top Bar**, ketik keyword bisnis
   - Contoh: `Digital Printing`
   - Contoh: `Percetakan`
   - Contoh: `Fotocopy`
   - Contoh: `Sablon Kaos`
   - Contoh: `Kafe`
3. Klik tombol **Cari** atau tekan **Enter**
4. Peta akan menampilkan **titik-titik biru** untuk setiap bisnis yang ditemukan
5. Klik titik biru untuk melihat nama dan alamat bisnis tersebut

### Contoh Skenario Nyata

> Anda ingin membuka cabang baru di daerah Bantul. Sebelum memutuskan lokasi, Anda zoom peta ke Bantul, lalu cari "Digital Printing". Ternyata ada 7 titik biru di sisi barat, tapi sisi timur Bantul hampir kosong. Kesimpulan: sisi timur punya potensi pasar yang lebih besar dengan persaingan lebih rendah.

### Tips Pencarian Efektif

- **Zoom dulu, baru cari** — hasil pencarian dibatasi pada area peta yang terlihat di layar. Semakin besar area yang terlihat, semakin banyak hasil.
- **Coba beberapa variasi keyword** — "Percetakan" dan "Digital Printing" bisa memberikan hasil yang berbeda
- **Hasil terbatas 50 titik** — jika area terlalu luas, zoom in ke area yang lebih spesifik

> **Catatan penting:** Hasil pencarian berasal dari data OpenStreetMap yang dikontribusikan komunitas. Bisnis yang belum pernah didaftarkan di OSM tidak akan muncul — dan ini bisa menjadi **peluang bisnis**: kompetitor yang tidak terlihat di peta berarti mereka belum memanfaatkan digital presence.

---

## Fitur 5 — Toggle Layer

Di **Top Bar** bagian kanan, ada 3 tombol yang berfungsi sebagai filter tampilan:

| Toggle | Fungsi |
|---|---|
| **Cabang** | Tampilkan / sembunyikan semua marker cabang sendiri |
| **Kompetitor** | Tampilkan / sembunyikan semua marker kompetitor |
| **Hasil Cari** | Tampilkan / sembunyikan hasil pencarian keyword |

- Tombol **aktif** = berwarna biru → layer ditampilkan
- Tombol **tidak aktif** = berwarna abu-abu → layer disembunyikan

**Gunaan praktis:** Ketika sedang fokus menganalisis kompetitor saja, sembunyikan layer Cabang agar peta tidak terlalu ramai.

---

## Legenda Marker

| Marker | Warna & Bentuk | Tipe | Penjelasan |
|---|---|---|---|
| ● | Hijau, lingkaran | Cabang Sendiri | Margin profit > 35% |
| ● | Kuning, lingkaran | Cabang Sendiri | Margin profit 15–35% |
| ● | Merah, lingkaran | Cabang Sendiri | Margin profit < 15% |
| ♦ | Merah, diamond | Kompetitor | Data kompetitor yang diinput manual |
| ● | Biru kecil, lingkaran | Hasil Pencarian | Bisnis ditemukan via keyword search |

---

## Strategi Penggunaan untuk Analisis Bisnis

### Analisis Persaingan di Area Existing

1. Zoom ke area toko Anda
2. Pastikan layer Kompetitor aktif — lihat sebaran kompetitor
3. Gunakan keyword search untuk cari bisnis sejenis yang belum Anda tandai
4. Hitung: "Dalam radius X km ada berapa kompetitor?"
5. Bandingkan dengan omset cabang Anda — apakah persaingan mempengaruhi performa?

### Riset Ekspansi Cabang Baru

1. Zoom ke area target ekspansi
2. Cari keyword bisnis Anda (contoh: "Digital Printing")
3. Lihat apakah ada blank spot (area tanpa kompetitor biru)
4. Tandai lokasi potensial sebagai pin kompetitor sementara dengan catatan "Calon Lokasi Baru"
5. Bandingkan beberapa kandidat lokasi sebelum memutuskan

### Monitor Kinerja Cabang secara Visual

1. Lihat semua cabang sekaligus di peta
2. Cabang merah = perlu perhatian → buka data detail, evaluasi omset dan margin
3. Cabang hijau = best practice → pelajari apa yang mereka lakukan dengan baik
4. Update data omset/margin secara rutin agar peta selalu akurat

---

## Pertanyaan Umum

**Q: Apakah peta ini butuh koneksi internet?**
> Ya — peta OpenStreetMap dan fitur pencarian Overpass API memerlukan koneksi internet. Data cabang dan kompetitor Anda sendiri tersimpan di database lokal.

**Q: Seberapa akurat geocoding alamat dengan tombol "📍 Cari"?**
> Cukup akurat untuk alamat jalan utama. Untuk gang atau lokasi pelosok, lebih baik klik langsung di peta untuk menentukan koordinat yang tepat.

**Q: Kenapa hasil pencarian keyword sedikit atau tidak ada?**
> Bisa jadi: (1) Area yang terlihat di peta terlalu besar — zoom in lebih dekat, atau (2) Bisnis di area tersebut belum terdaftar di OpenStreetMap. Coba cari dengan keyword yang berbeda.

**Q: Apakah data kompetitor yang saya masukkan bisa dilihat orang lain?**
> Tidak — data kompetitor yang Anda input tersimpan di database lokal server Anda sendiri, tidak diunggah ke mana-mana.

**Q: Bisa tidak melihat peta dari kota lain?**
> Bisa — drag atau scroll peta ke area manapun di dunia, lalu gunakan pencarian keyword untuk mencari bisnis di area tersebut.

---

*Dokumentasi PosPro — Peta Cuan Lokasi | Terakhir diperbarui: April 2026*

**© 2026 Muhammad Faisal. All rights reserved.**
