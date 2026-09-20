# 👥 Akun & PIN Karyawan

Halaman **`/settings/users`** (menu *Karyawan (Akun & PIN)*) mengelola satu
daftar orang. Dulu ini dua halaman terpisah dan membingungkan; sekarang satu
baris = satu orang, dengan dua "pintu" yang bisa dimiliki sendiri-sendiri atau
bersamaan.

## Dua pintu masuk, satu orang

| Pintu | Untuk apa | Tabel |
|---|---|---|
| **Akun login** (email + sandi) | aplikasi kantor: kasir, laporan, pengaturan | `users` |
| **PIN kerja** (4–6 angka) | papan kerja: `/so-designer`, `/produksi`, `/cetak` | `designers` |

Keduanya dihubungkan oleh `designers.user_id`. Hubungan itu yang membuat tugas
piket, pengingat, teguran, dan [kartu absensi](absensi-hr.md) milik orang itu
bisa muncul di papan kerja yang tidak pakai login.

> Staf yang **hanya punya PIN** tetap bisa bekerja, tapi tidak akan menerima
> pop-up piket maupun kartu absensi sampai PIN-nya ditautkan ke akun login.
> Di daftar, orang seperti ini ditandai chip **"Tanpa login"**.

## Peran (role)

Lima peran, disimpan di `roles`:

| Peran | Biasanya untuk |
|---|---|
| `Owner` | pemilik — akses penuh, termasuk HPP & analisa keuangan |
| `Manajer` | laporan, pengaturan, persetujuan edit nota |
| `Admin` | kasir & CS |
| `Designer` | desainer |
| `Operator` | operator produksi/cetak |

**Peran tidak membatasi papan kerja.** `/produksi` dan `/cetak` dijaga PIN, dan
daftar operatornya adalah semua PIN aktif — karena di percetakan satu orang
biasanya menguasai semua mesin. Yang diatur peran adalah **menu aplikasi
kantor**.

## Akses menu per peran

Kolom `roles.menu_access` menyimpan daftar menu yang boleh dilihat peran itu
(JSON berisi href). Owner mengaturnya di **`/owner/akses-menu`** dengan
mencentang menu; kosong = pakai preset divisi bawaan. Ini cara membatasi,
misalnya, agar kasir tidak melihat HPP dan laba.

## Karyawan keluar (resign)

Menghapus akun karyawan yang keluar **bukan** pilihan yang baik: riwayat
kerjanya melekat di nota, pekerjaan produksi, dan leaderboard. Karena itu ada
penandaan keluar:

- `resigned_at` + `resign_note` di tabel `users`.
- Menonaktifkan akun **sekaligus mematikan PIN kerja** orang itu, supaya tidak
  ada pintu yang tertinggal terbuka.
- Riwayatnya tetap utuh; namanya tetap tampil di data lama.

Pagar yang berlaku saat menghapus/menonaktifkan:

1. Tidak bisa menonaktifkan **diri sendiri**.
2. Tidak bisa menonaktifkan **Owner aktif terakhir** — supaya sistem tidak
   pernah kehilangan pemilik.
3. Sebelum penghapusan permanen, ditampilkan **ringkasan riwayat** orang itu
   (berapa nota, berapa pekerjaan, berapa tugas) agar keputusannya sadar.

## Endpoint terkait

| Metode | Jalur | Untuk |
|---|---|---|
| GET | `/users` | daftar orang |
| POST | `/users` | membuat akun login |
| PATCH | `/users/:id` | mengubah data/peran |
| PATCH | `/users/:id/status` | menandai keluar / mengaktifkan kembali |
| DELETE | `/users/:id` | hapus permanen (berpagar) |
| GET/POST/PATCH | `/designers` | PIN kerja |
| POST | `/designers/verify-pin` | verifikasi PIN (dipakai papan kerja) |
