# Migrasi database (Prisma Migrate)

Mulai 22 Sep 2026 skema database **tidak lagi diubah dengan `prisma db push`**.
Setiap perubahan jadi satu folder migrasi di `backend/prisma/migrations/`, ikut
di-commit, dan dijalankan di server dengan `npx prisma migrate deploy`.

**Kenapa diganti?** `db push` cocok selama databasenya cuma satu. Begitu tiap
klien punya instalasi dan database sendiri, `db push` jadi berbahaya:

- tidak ada riwayat — tiap server menebak sendiri selisihnya dengan
  `schema.prisma`, jadi hasilnya bisa berbeda antar-instalasi;
- ganti nama kolom dibaca sebagai "hapus kolom lama + buat kolom baru", dan
  isinya ikut hilang;
- tidak ada yang bisa di-review sebelum jalan di database klien.

Dengan migrasi, perubahannya berupa file SQL biasa yang bisa dibaca di git,
dijalankan **urut dan sama persis** di semua instalasi, dan tercatat di tabel
`_prisma_migrations` di masing-masing database.

---

## Yang ada di repo

| Berkas | Isinya |
|---|---|
| `backend/prisma/migrations/0_init/migration.sql` | **Baseline**: seluruh skema per 22 Sep 2026 — 110 tabel, 161 foreign key. Dibangkitkan dari `schema.prisma` dengan `prisma migrate diff --from-empty`. |
| `backend/prisma/migrations/migration_lock.toml` | Penanda provider (`mysql`). Jangan diedit. |
| `deploy.sh` | Langkah backend sekarang `npx prisma migrate deploy`. Kalau gagal, deploy berhenti sebelum frontend dimatikan. |
| `desktop/src/backend-server.ts` | Aplikasi desktop offline juga `migrate deploy` saat start. DB lokal dari versi lama ditransisikan otomatis sekali. |

Sudah diuji di MariaDB lokal: `0_init` di database kosong menghasilkan 110 tabel
+ `_prisma_migrations`, cek selisih sesudahnya kosong, dan database hasil
`db push` **identik** dengan hasil `0_init` (dibandingkan lewat
`mysqldump --no-data`). Produksi memakai MySQL, jadi cek selisih di langkah 1c
tetap wajib — jangan dilewati.

---

## 1. Sekali jalan: baseline database produksi

Database produksi dibuat dengan `db push`, jadi tabelnya sudah lengkap tapi
riwayat migrasinya kosong. Kalau langsung `migrate deploy`, Prisma menolak
dengan **P3005** ("database schema is not empty") dan tidak mengubah apa pun.
Yang perlu dilakukan: memberi tahu Prisma bahwa isi `0_init` **sudah ada** di
database itu.

Ini cuma untuk database yang dibuat `db push` (produksi Voliko, dan `pospro_dev`
lama di laptop). **Instalasi klien baru tidak perlu** — mereka mulai dari
database kosong, lihat bagian 5.

Kerjakan **di luar jam buka toko**.

### 1a. Backup dulu

```bash
cd /home/homelab/pos/pospro/backend
mysqldump --single-transaction --routines --triggers --no-tablespaces \
  -u <user_db> -p <nama_db> | gzip > ~/backup-sebelum-baseline-$(date +%Y%m%d-%H%M).sql.gz
gunzip -t ~/backup-sebelum-baseline-*.sql.gz && ls -lh ~/backup-sebelum-baseline-*.sql.gz
```

`<user_db>` dan `<nama_db>` sama dengan yang ada di `DATABASE_URL`. Sandinya
diminta di prompt, jadi tidak tercatat di riwayat shell. Kalau `gunzip -t` diam
saja, berkasnya utuh.

### 1b. Ambil kode terbaru — jangan jalankan `deploy.sh` dulu

```bash
cd /home/homelab/pos/pospro && git pull origin main
cd backend && npm install --no-audit --no-fund
```

(Kalau `deploy.sh` telanjur dijalankan, tidak apa-apa: dia berhenti di P3005
sebelum menyentuh apa pun, dan versi lama tetap jalan.)

### 1c. Cek selisih database vs `schema.prisma`

Muat `DATABASE_URL` ke shell tanpa menampilkannya, lalu bandingkan:

```bash
export DATABASE_URL="$(grep -E '^DATABASE_URL=' .env | cut -d= -f2- | sed -e 's/^["'\'']//' -e 's/["'\'']$//')"
npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script
```

Hasil yang **wajib** muncul:

```text
-- This is an empty migration.
```

Kalau yang muncul perintah SQL (`CREATE TABLE`, `ALTER TABLE ...`), **berhenti
di sini dan jangan lanjut ke 1d.** Simpan hasilnya ke berkas
(`... --script > selisih.sql`) lalu periksa baris per baris. Penyebab yang
paling mungkin:

| Isi selisih | Artinya | Yang dilakukan |
|---|---|---|
| Cuma `CREATE TABLE` / `ADD COLUMN` / `CREATE INDEX` | Produksi tertinggal dari kode — ada commit yang mengubah skema tapi belum ter-deploy. | Jalankan cara lama **sekali terakhir**: `npx prisma db push` (tanpa `--accept-data-loss`), lalu ulangi 1c sampai kosong. |
| Ada `DROP TABLE` / `DROP COLUMN` | Di database ada sisa tabel/kolom yang sudah tidak ada di `schema.prisma`. | Putuskan dulu: datanya masih perlu? Kalau tidak, backup tabel itu lalu hapus manual. Kalau perlu, kembalikan ke `schema.prisma`. **Jangan** `db push --accept-data-loss`. |
| `MODIFY` tipe kolom, index beda nama | Ada yang pernah mengubah database langsung, di luar Prisma. | Cari tahu asalnya sebelum memilih mana yang benar. |

Versi yang cuma menjawab ya/tidak: tambahkan `--exit-code` —
kode keluar `0` = sama, `2` = ada selisih, `1` = galat.

### 1d. Tandai `0_init` sebagai sudah jalan

```bash
npx prisma migrate resolve --applied 0_init
npx prisma migrate status
```

`resolve` hanya membuat tabel `_prisma_migrations` dan mengisi satu baris —
tabel lain tidak disentuh, SQL di `0_init` tidak dijalankan. `status` harus
menjawab `Database schema is up to date!`.

### 1e. Deploy seperti biasa

```bash
cd /home/homelab/pos/pospro && ./deploy.sh
```

Di langkah backend akan muncul `No pending migrations to apply.` Selesai —
mulai sekarang database ini diurus migrasi.

**Laptop (`pospro_dev`)**: sama saja — cek selisih lalu `resolve --applied
0_init`. Atau lebih gampang: buang databasenya dan impor seed terbaru
(seed yang dibuat setelah produksi di-baseline sudah membawa riwayat migrasi).

---

## 2. Mulai sekarang: cara mengubah skema

Semua di laptop, ke `pospro_dev`. Prasyaratnya ada di
[Setup Pengembangan Lokal](setup-lokal.md) — termasuk `SHADOW_DATABASE_URL`.

1. Ubah `backend/prisma/schema.prisma`.
2. Buat migrasinya:

   ```bash
   cd backend
   npx prisma migrate dev --name tambah_kolom_catatan_nota
   ```

   Prisma membuat `prisma/migrations/<waktu>_tambah_kolom_catatan_nota/migration.sql`,
   menjalankannya ke `pospro_dev`, dan membangkitkan ulang Prisma Client.
   Nama: huruf kecil + garis bawah, bahasa Indonesia tidak masalah.
3. **Baca SQL-nya.** Hal yang sering salah:
   - **Ganti nama kolom/tabel** muncul sebagai `DROP` + `ADD` — isinya hilang.
     Pakai `--create-only` supaya migrasinya dibuat tanpa dijalankan, lalu ganti
     SQL-nya dengan `ALTER TABLE ... RENAME COLUMN a TO b` (MySQL 8 / MariaDB 10.5+),
     baru `npx prisma migrate dev` lagi untuk menjalankannya.
   - **Kolom wajib (`NOT NULL`) baru di tabel yang sudah berisi** — beri
     `@default(...)`, atau buat nullable dulu, isi datanya, baru jadikan wajib di
     migrasi berikutnya.
   - Pengisian data (backfill) boleh ditulis langsung di `migration.sql` sebagai
     `UPDATE ...` — ikut jalan sekali di semua instalasi, tidak perlu skrip terpisah.
4. Commit `schema.prisma` **dan** folder migrasinya dalam satu commit.
5. Di server: `./deploy.sh` → `migrate deploy` menjalankan migrasi yang belum ada.
   Ambil backup dulu kalau deploy itu membawa migrasi baru.

`migrate dev` butuh **database bayangan** (_shadow database_): tempat Prisma
memutar ulang semua migrasi untuk mencari selisih, lalu mengosongkannya. Kalau
`SHADOW_DATABASE_URL` diisi, Prisma memakai database itu. Kalau tidak, Prisma
membuat dan menghapus database sementara sendiri — dan itu butuh hak
`CREATE`, `ALTER`, `DROP`, `REFERENCES` di **semua** database (`ON *.*`), yang
sengaja tidak diberikan ke user `pospro_dev`. `migrate deploy` di server **tidak**
butuh database bayangan.

---

## 3. Aturan yang tidak boleh dilanggar

- **Jangan edit, hapus, atau ganti nama folder migrasi yang sudah pernah jalan
  di mana pun** — produksi, database klien, bahkan laptop. Prisma menyimpan
  checksum tiap migrasi; kalau isinya berubah atau foldernya hilang,
  `migrate dev` minta database di-reset (sudah dicoba: menghapus folder yang
  sudah jalan langsung memicu "We need to reset the database"). Salah tulis?
  Buat migrasi **baru** yang membetulkannya.
- **Jangan `prisma db push`** ke database yang sudah diurus migrasi. Strukturnya
  berubah tanpa tercatat, dan migrasi berikutnya bisa gagal di tengah jalan.
  Satu-satunya pengecualian: langkah 1c di atas, sekali, sebelum baseline.
- **Jangan `prisma migrate dev` atau `prisma migrate reset` di server.** Keduanya
  alat laptop dan bisa mengosongkan database.
- **`--accept-data-loss` tidak pernah dipakai di produksi.**

---

## 4. Kalau migrasi gagal di tengah jalan

MySQL tidak bisa membatalkan perubahan struktur dalam transaksi. Kalau satu
migrasi berisi lima perintah dan yang ketiga gagal, dua perintah pertama sudah
permanen. Prisma mencatat migrasi itu **gagal**, dan `migrate deploy` berikutnya
menolak jalan (**P3009**) sampai kamu memutuskan. `deploy.sh` berhenti sebelum
frontend dimatikan, jadi toko tetap jalan dengan versi lama.

1. `npx prisma migrate status` — lihat migrasi mana yang gagal dan pesannya.
2. Cocokkan isi `migration.sql` dengan keadaan database: perintah mana yang
   sudah jalan, mana yang belum.
3. Pilih salah satu:
   - **Selesaikan manual**: jalankan sisa perintahnya sendiri, lalu
     `npx prisma migrate resolve --applied <nama_migrasi>`.
   - **Kembalikan manual**: batalkan perintah yang sudah jalan, lalu
     `npx prisma migrate resolve --rolled-back <nama_migrasi>`. Perbaiki
     migrasinya (boleh, **asal belum pernah berhasil di instalasi mana pun**),
     lalu deploy ulang.
   - **Pulihkan backup** kalau keadaannya tidak jelas.

Supaya kejadian ini jarang: satu migrasi = satu perubahan kecil, dan uji dulu
di laptop dengan data seed.

---

## 5. Instalasi klien baru

Database kosong → langsung:

```bash
npx prisma migrate deploy
```

Tanpa `resolve`, tanpa `db push`. Setelah itu buat akun Owner dan cabang Pusat
— langkahnya di [Panduan Deployment](deployment.md).

---

## Ringkasan perintah

| Perintah | Kapan |
|---|---|
| `npx prisma migrate status` | Lihat migrasi yang sudah/belum jalan di database ini. |
| `npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script` | Selisih database vs `schema.prisma`. Kosong = sama. |
| `npx prisma migrate deploy` | Server & instalasi klien: jalankan migrasi yang belum ada. |
| `npx prisma migrate dev --name <nama>` | Laptop saja: buat migrasi baru dari perubahan `schema.prisma`. |
| `npx prisma migrate resolve --applied <nama>` | Catat migrasi sebagai sudah jalan **tanpa** menjalankan SQL-nya (baseline, atau setelah diselesaikan manual). |
| `npx prisma migrate resolve --rolled-back <nama>` | Catat migrasi gagal sebagai dibatalkan, supaya bisa dicoba lagi. |

Catatan: perintah Prisma membaca `backend/.env` sendiri lewat `prisma.config.ts`,
tapi `"$DATABASE_URL"` di baris perintah butuh variabel shell — itu gunanya baris
`export` di langkah 1c. Alternatif tanpa menyentuh variabel shell:
`--from-schema-datasource prisma/schema.prisma` menggantikan `--from-url "$DATABASE_URL"`.
