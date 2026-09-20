# 🖨️ Antrian Produksi

Papan kerja operator mesin. Setiap order dari kasir yang produknya bertanda
*wajib produksi* otomatis berdiri di sini sebagai **job** — tidak ada yang perlu
dicatat ulang. Operator membukanya dengan **PIN pribadi**, bukan email dan
sandi, karena satu perangkat dipakai bergantian sepanjang hari di ruang
produksi.

![Pipeline produksi: seluruh tahap terlihat sekaligus](images/pipeline-produksi.webp)

## Enam tahap pekerjaan

| Tahap | Artinya |
|---|---|
| **Antrian** | job baru dari kasir, belum dipegang siapa pun |
| **Proses** | sedang dikerjakan, sudah ada nama operatornya |
| **Menunggu Pasang** | cetakan jadi, menunggu tahap pemasangan/perakitan |
| **Dipasang** | sedang dipasang/dirakit |
| **Selesai** | siap diambil pelanggan |
| **Diambil** | sudah diserahkan — riwayat |

Tahap *Menunggu Pasang* dan *Dipasang* hanya muncul untuk produk yang
bertanda punya tahap pemasangan (mis. banner + rangka, neonbox).

---

## Langkah demi langkah

### 1. Masuk dengan PIN pribadi

![Layar masuk papan produksi: pilih cabang, pilih nama, masukkan PIN](images/produksi-1-pin.webp)

Operator memilih namanya dari daftar lalu memasukkan **PIN pribadi**. PIN inilah
yang menentukan pekerjaan tercatat atas nama siapa — dan yang memunculkan tugas
piket serta [kartu absensi](absensi-hr.md) miliknya di halaman ini.

### 2. Lihat antrian

![Tab Antrian berisi job dari kasir, lengkap dengan nomor SO dan pelanggannya](images/produksi-2-antrian.webp)

Tiap kartu memuat nomor job, nomor SO, nama pelanggan, produk, dan jumlahnya.
Order **EXPRESS** dan yang punya tenggat naik ke atas.

### 3. Ambil pekerjaan

![Dialog konfirmasi sebelum pekerjaan dimulai](images/produksi-3-mulai.webp)

Tombolnya **Kerjakan** untuk produk satuan. Setelah dikonfirmasi, job pindah ke
tab *Proses* dengan nama operator yang menempel — jadi selalu jelas siapa yang
sedang mengerjakan apa.

### 4. Sedang dikerjakan

![Tab Proses menampilkan pekerjaan yang sedang berjalan](images/produksi-4-proses.webp)

Selama di tab ini, pekerjaan terlihat oleh semua orang, termasuk kasir yang
ditanya pelanggan "sudah jadi belum?".

### 5. Tandai selesai — termasuk rekan kerjanya

![Dialog selesai dengan pilihan rekan kerja yang ikut mengerjakan](images/produksi-5-selesai.webp)

Kalau pekerjaan dikerjakan berdua, operator mencentang rekannya di sini.
Keduanya diakui di [Leaderboard](leaderboard.md) — ini yang mencegah orang
enggan membantu pekerjaan orang lain karena takut tidak terhitung.

### 6. Siap diambil

![Tab Selesai: pekerjaan menunggu diambil pelanggan](images/produksi-6-selesai.webp)

Begitu masuk tab *Selesai*, pelanggan bisa dikabari. Kasir juga melihat status
yang sama tanpa perlu bertanya ke ruang produksi.

### 7. Diserahkan ke pelanggan

![Tab Diambil menjadi riwayat pekerjaan yang sudah diserahkan](images/produksi-7-diambil.webp)

Tombol **Sudah Diambil** memindahkannya menjadi riwayat, beserta jam
penyerahannya.

---

## Pekerjaan per meter: pilih bahannya dulu

![Dialog pemilihan bahan untuk pekerjaan per meter, termasuk opsi memakai sisa bahan](images/produksi-8-bahan.webp)

Untuk produk yang dihitung per meter, tombolnya **Proses** dan dialognya menuntut
operator memilih bahan lebih dulu:

- **Bahan Baru (Potong Stok)** — memotong stok bahan seperti biasa.
- **Sisa / Waste** — memakai sisa potongan yang masih layak, sehingga stok bahan
  baru tidak berkurang dan sisa tidak terbuang.

Kalau stok bahannya kurang, dialog ini menolak melanjutkan dan menampilkan
kekurangannya — bukan membiarkan pekerjaan berjalan dengan stok minus.

## Gabung Cetak

Tombol **Gabung Cetak** menggabungkan beberapa job sejenis menjadi satu batch
supaya sekali naik mesin bisa untuk beberapa order. Menyelesaikan batch akan
menyelesaikan semua job di dalamnya sekaligus.

## Yang juga muncul di halaman ini

Karena operator jarang membuka menu lain, tiga hal ikut ditampilkan di sini:

- **Tugas piket hari ini** beserta teguran bila lewat batas waktu —
  lihat [Papan Tugas & Piket](papan-tugas-piket.md).
- **Kartu absensi pribadi** — lihat [Absensi & Portal HR](absensi-hr.md).
- **Titipan cetak dari cabang lain** — lihat [Titip Cetak](titip-cetak.md).

## Kaitan dengan modul lain

| Dari / ke | Hubungannya |
|---|---|
| [Kasir POS](kasir-pos.md) | sumber job: produk bertanda *wajib produksi* |
| [Katalog Produk](katalog-produk.md) | tempat menyalakan tanda *wajib produksi* & tahap pemasangan |
| [Antrian Cetak Paper](mesin-cetak.md) | papan terpisah untuk produk yang digerakkan tarif klik |
| [Leaderboard](leaderboard.md) | menghitung pekerjaan selesai per operator, termasuk rekan kerja |
