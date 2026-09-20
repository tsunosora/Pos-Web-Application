# 🧹 Papan Tugas & Piket

Bagian ini menjawab pertanyaan yang tidak bisa dijawab aplikasi kasir:
**siapa mengerjakan tugas non-penjualan hari ini, dan apakah sudah dikerjakan.**
Menyapu, buang sampah, bersihkan toilet, rapikan tempat tidur bagi yang tinggal
di toko — semuanya terjadwal, tercatat, dan kalau lewat tenggat, **sistem yang
menegur**, bukan atasan.

![Papan piket hari ini beserta kartu tugas tiap orang](images/piket-4-papan.webp)

## Langkah demi langkah

Contoh nyata: menambah satu tugas harian baru, lalu melihatnya sampai ke
pantauan manajer.

### 1. Daftar jadwal yang sudah berjalan

![Daftar jadwal piket beserta frekuensi dan jam batasnya](images/piket-1-jadwal.webp)

Semua aturan piket berkumpul di sini. Ini bukan daftar tugas hari ini,
melainkan **aturan** yang setiap hari melahirkan tugas-tugasnya sendiri.

### 2. Buat jadwal baru

![Form jadwal: judul, keterangan, frekuensi, jam batas, penerima, dan shift](images/piket-2-baru.webp)

Yang ditentukan di sini: judul, keterangan, **frekuensi** (sekali, harian,
mingguan, bulanan), **jam batas**, siapa penerimanya (karyawan tertentu, grup,
divisi, atau semua), dan apakah terikat shift.

Dua pilihan penerima yang membedakan:

- **Penerima tetap** — orang yang sama setiap kali.
- **Giliran bergilir harian** — tugas berpindah orang tiap hari, supaya tidak
  selalu jatuh ke orang yang sama.

> Penerima wajib dipilih. Tanpa itu jadwal tidak tersimpan.

### 3. Buat kartu tugasnya sekarang

![Jadwal baru tersimpan dan kartu tugasnya dibuat](images/piket-3-kartu.webp)

Normalnya kartu tugas dibuat otomatis tiap hari pukul 00.05. Tombol **Buat
Kartu Sekarang** memicunya langsung — berguna saat aturan baru dibuat di tengah
hari dan ingin langsung berlaku.

### 4. Papan piket hari ini

![Papan piket menampilkan tugas hari ini per orang beserta jam batasnya](images/piket-4-papan.webp)

Inilah yang dilihat karyawan: tugas hari ini, jam batasnya, dan tanda sudah
atau belum dikerjakan. Tombol **Unduh jadwal (PDF)** menghasilkan lembar jadwal
siap tempel — dibangun dari data, bukan diketik ulang tiap bulan.

### 5. Pantauan & teguran

![Pantauan kepatuhan piket beserta jumlah teguran](images/piket-5-pantau.webp)

Manajer melihat siapa yang rutin dan siapa yang tertinggal, per hari maupun
rekap bulanan. Teguran untuk tugas yang lewat batas **diterbitkan otomatis
setiap lima menit** — jadi yang menegur adalah aturan, bukan atasan yang
kebetulan sedang lewat.

### 6. Tugas milik sendiri

![Papan tugas pribadi berisi pekerjaan yang jadi tanggung jawab sendiri](images/piket-6-tugas.webp)

Selain piket rutin, papan tugas menampung pekerjaan lain yang perlu
ditindaklanjuti seseorang.

---


Bagian ini menjawab pertanyaan yang tidak bisa dijawab aplikasi kasir:
**siapa mengerjakan tugas non-penjualan hari ini, dan apakah sudah dikerjakan.**
Menyapu, buang sampah, bersihkan toilet, rapikan tempat tidur bagi yang tinggal
di toko — semuanya terjadwal, tercatat, dan kalau lewat tenggat, **sistem yang
menegur**, bukan atasan.

## Empat halaman

| Halaman | Untuk siapa | Isinya |
|---|---|---|
| `/tugas` | semua staf | papan tugas umum, bisa digeser antar kolom |
| `/tugas/papan-piket` | semua staf | piket hari ini: siapa, tugas apa, batas jam berapa |
| `/tugas/jadwal` | Manajer+ | membuat & mengatur jadwal berulang |
| `/tugas/grup` | Manajer+ | kelompok staf (mis. penghuni toko vs pulang) |
| `/tugas/pantau` | Manajer+ | rekap kepatuhan & teguran |

## Jadwal: sekali atur, jalan sendiri

`task_schedules` menyimpan aturannya, bukan tugasnya:

| Kolom | Gunanya |
|---|---|
| `frequency` | `DAILY`, `WEEKLY`, atau `MONTHLY` |
| `days_of_week` / `day_of_month` | hari mana saja yang berlaku |
| `skip_weekends` | lewati Sabtu–Minggu |
| `time_of_day` | batas jam tugas itu harus selesai |
| `shift_slot` | slot shift (mis. `PAGI`) supaya tugas menempel ke shift, bukan ke jam saja |
| `target_role` / `target_all` | ditujukan ke peran tertentu atau semua orang |
| `rotation_user_ids` | **rotasi**: giliran berpindah antar orang, jadi tidak selalu orang yang sama |
| `group_id` | dibatasi ke satu [grup tim](#grup-tim) |

Tugas hariannya dibuat otomatis oleh pekerjaan terjadwal **`05 0 * * *`**
(00.05 tiap hari) ke tabel `task_items`. Kalau perlu segera, Manajer bisa
memicunya manual lewat `POST /task-board/schedules/generate-now`.

## Teguran otomatis

Pekerjaan terjadwal **tiap 5 menit** memeriksa tugas yang lewat batas waktu dan
menuliskan teguran ke `task_warnings`. Teguran muncul sebagai pop-up di halaman
yang sedang dibuka orangnya — termasuk di papan kerja ber-PIN — dan harus
diakui (`POST /task-board/pin/warnings/ack`) supaya tidak menumpuk.

Masa uji coba bisa disetel (`piket_trial_until` di pengaturan toko): selama
masa itu tugas tetap tampil dan bisa dicentang, tapi **teguran tidak
diterbitkan**. Berguna saat aturan piket baru diperkenalkan ke tim.

## Absen shift (check-in)

`task_shift_checkins` mencatat konfirmasi "saya yang bertugas di shift ini".
Di portal desainer, konfirmasi ulang diminta sekitar pukul 13.00 supaya tugas
tidak tercatat atas nama orang shift sebelumnya.

## Grup tim

Tidak semua tugas berlaku untuk semua orang. `task_groups` +
`task_group_members` memisahkan, misalnya, staf yang menginap di toko (dapat
tugas pagi) dari yang pulang. Jadwal yang terikat grup hanya menyasar
anggotanya.

## Papan piket di halaman kerja

Staf produksi dan cetak jarang membuka menu; mereka seharian di papan
kerjanya. Karena itu piket, pengingat, dan teguran **ikut muncul di
`/produksi`, `/cetak`, dan `/so-designer`**, dibuktikan dengan PIN pribadi
masing-masing — tanpa perlu login email. Lihat
[Akun & PIN Karyawan](karyawan-akun-pin.md).

## Cetak jadwal jadi PDF

`GET /task-board/board/pdf` membuat lembar jadwal piket siap tempel, dibangun
dari data — bukan diketik ulang tiap bulan. Tanda tangan penanggung jawab
disimpan di pengaturan (`piket_signatures`) dan ikut tercetak.

## Endpoint terkait

Versi login ada di `/task-board/*`, versi PIN di `/task-board/pin/*`
(sengaja tanpa penjaga login — lihat [Model Akses & Keamanan](keamanan-akses.md)).
Daftar lengkapnya di [Referensi Endpoint](referensi-endpoint.md).
