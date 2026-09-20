# 🌐 Halaman Publik

Tidak semua halaman PosPro butuh login. Sebagian memang dibuat untuk dibuka
pelanggan atau ditempel sebagai QR — daftarnya di sini supaya jelas apa yang
terlihat dari luar.

| Halaman | Untuk siapa | Cara mengamankannya |
|---|---|---|
| `/landing`, `/landing-page` | calon pelanggan | publik memang; isinya diatur di [Landing Page Builder](landing.md) |
| `/artikel`, `/artikel/[slug]` | calon pelanggan & mesin pencari | publik; isi dari [Artikel/Blog](artikel.md) |
| `/p/[id]` | pelanggan yang dikirimi tautan produk | hanya menampilkan satu produk & harganya |
| `/nilai/[token]` | pelanggan yang diundang menilai | token acak sekali pakai — lihat [Rating CS](rating-cs.md) |
| `/nilai/cabang/[branchId]` | siapa pun (QR di meja kasir) | hanya menerima penilaian |
| `/opname/[token]` | petugas opname di lapangan | token acak; hanya untuk sesi opname itu |
| `/tv/leaderboard` | ditampilkan di TV toko | tanpa login supaya TV tidak perlu sesi; jangan diarahkan ke internet publik |
| `/login` | semua | halaman masuk |
| `/help` | staf | panduan singkat di dalam aplikasi |

## Halaman kerja ber-PIN

Bukan publik, tapi juga bukan login biasa:

| Halaman | Dibuka dengan |
|---|---|
| `/so-designer` → `/so-designer/dashboard` | nama + PIN pribadi desainer |
| `/produksi` | nama + PIN pribadi operator |
| `/cetak` | PIN cabang, lalu PIN pribadi saat memilih nama operator |

Alasannya praktis: di ruang produksi, satu perangkat dipakai bergantian
sepanjang hari, dan mengetik email + sandi setiap kali tidak akan dilakukan.
Rinciannya di [Model Akses & Keamanan](keamanan-akses.md).

## Yang sebaiknya tidak dibuka ke internet

`/tv/leaderboard` menampilkan omzet dan nama karyawan. Halaman ini tanpa login
karena TV tidak bisa mengetik sandi — jadi sebaiknya hanya dapat diakses dari
jaringan toko, bukan dari mana saja.
