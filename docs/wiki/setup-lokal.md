# Menjalankan PosPro di komputer sendiri

Panduan untuk mengembangkan PosPro di laptop, bukan di server produksi. Server
hanya dipakai untuk deploy.

**Kenapa begitu?** Build frontend mematikan aplikasi (lihat `deploy.sh`), dan
disk server masih lambat — fsync rata-rata 58 ms dengan puncak 1,8 detik, jadi
`npm install` dan `next build` di sana berebut I/O dengan commit MySQL kasir.
CPU dan RAM server justru lega (25 inti, 23 GB); yang sempit hanya disknya.

---

## Hasil akhirnya

![Halaman login PosPro saat dijalankan di komputer sendiri](images/login.webp)

Kalau seluruh langkah di bawah berhasil, alamat lokal (mis.
`http://localhost:3002`) akan menampilkan halaman login yang sama dengan versi
produksi — lengkap dengan data seed yang sudah disamarkan, sehingga bisa
dipakai mencoba fitur tanpa menyentuh data toko sungguhan.

## 1. Prasyarat

| Kebutuhan | Versi | Catatan |
|---|---|---|
| Node.js | **22 LTS** | `package.json` menuntut `>=20 <25`. Jangan pakai 25 walau server kebetulan menjalankannya. |
| MySQL | 8.x | MariaDB belum diuji. |
| Git | apa saja | |
| Windows | **WSL2 (Ubuntu)** | Prisma & Next jauh lebih lancar, dan perilakunya sama dengan server. |

Pasang Node lewat nvm supaya bisa berpindah versi:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash && exec $SHELL && nvm install 22 && nvm use 22
```

## 2. Ambil kode

```bash
git clone git@github.com:tsunosora/Pos-Web-Application.git pospro && cd pospro
```

## 3. Siapkan database

```bash
sudo mysql -e "CREATE DATABASE pospro_dev CHARACTER SET utf8mb4; CREATE DATABASE pospro_dev_shadow CHARACTER SET utf8mb4; CREATE USER 'pospro_dev'@'localhost' IDENTIFIED BY 'dev12345'; GRANT ALL ON pospro_dev.* TO 'pospro_dev'@'localhost'; GRANT ALL ON pospro_dev_shadow.* TO 'pospro_dev'@'localhost';"
```

`pospro_dev_shadow` itu database bantu untuk `npx prisma migrate dev`: Prisma
memutar ulang semua migrasi di sana untuk mencari selisih, lalu mengosongkannya.
Isinya tidak pernah dipakai aplikasi. Tanpa database ini, Prisma mencoba membuat
database sementara sendiri dan gagal karena user `pospro_dev` tidak punya hak
`CREATE DATABASE` (dan memang tidak perlu punya).

## 4. Masukkan data seed

![Halaman login](images/login.webp)


Berkas seed dibuat di server dengan skrip `backend/prisma/scripts/dump-dev-seed.ts`
(lihat bagian 8). Setelah berkasnya ada di laptop:

```bash
zcat pospro-dev-seed-*.sql.gz | mysql -u pospro_dev -p pospro_dev
```

Isi seed: struktur **seluruh 108 tabel**, ditambah katalog (178 produk, 750
varian, harga jual, kategori, satuan, cabang, jadwal piket) dan akun yang sudah
disamarkan. **Tidak ada** transaksi, chat, HPP, gaji, token, atau data pelanggan
sungguhan di dalamnya.

Seed yang dibuat setelah produksi di-baseline ikut membawa riwayat migrasi
(tabel `_prisma_migrations`). Seed yang lebih tua belum — cek dengan:

```bash
cd backend && npx prisma migrate status
```

Kalau hasilnya bilang `0_init` belum diterapkan padahal tabelnya sudah ada,
tandai sekali (struktur dari seed memang sudah sama dengan `0_init`):

```bash
npx prisma migrate resolve --applied 0_init
```

Lalu jalankan `npx prisma migrate deploy` untuk migrasi yang lebih baru dari
seed-nya. Detailnya di [Migrasi Database](migrasi-database.md).

### Akun untuk masuk

Sandi semua akun: **`dev12345`**

| Peran | Email |
|---|---|
| Owner | `pengguna4@contoh.test`, `pengguna9@contoh.test`, `pengguna17@contoh.test` |
| Manajer | `pengguna13@contoh.test` |
| Admin (kasir/CS) | `pengguna2@contoh.test`, `pengguna8@contoh.test`, `pengguna11@contoh.test`, `pengguna12@contoh.test`, `pengguna23@contoh.test` |
| Operator | `pengguna20@contoh.test`, `pengguna21@contoh.test`, `pengguna24@contoh.test`, `pengguna25@contoh.test` |
| Designer | `pengguna18@contoh.test`, `pengguna19@contoh.test` |

PIN untuk halaman kerja:

- **PIN pribadi desainer/operator** = `1000 + id`. Yang aktif di seed: 1001, 1002,
  1004–1009, 1011–1013.
- **PIN masuk /cetak dan /produksi (PIN cabang)** = `1234`.

## 5. Backend

`backend/.env` — buat sendiri, tidak pernah ada di repo:

```ini
DATABASE_URL="mysql://pospro_dev:dev12345@localhost:3306/pospro_dev"
SHADOW_DATABASE_URL="mysql://pospro_dev:dev12345@localhost:3306/pospro_dev_shadow"
JWT_SECRET="rahasia-lokal-apa-saja"
PORT=3001
ALLOWED_ORIGINS="http://localhost:3002"
```

Kunci integrasi (`WA_*`, `HR_API_KEY`, `STAFF_KPI_API_KEY`) **dibiarkan kosong**.
Modulnya tetap hidup, fiturnya saja yang menganggap dirinya belum dikonfigurasi.

```bash
cd backend && npm install && npx prisma generate && npm run start:dev
```

## 6. Frontend

`frontend/.env.local`:

```ini
NEXT_PUBLIC_API_URL="http://localhost:3001"
```

```bash
cd frontend && npm install && npm run dev -- -p 3002
```

Buka `http://localhost:3002` di browser. Pakai `npm run dev`, bukan `npm run build` —
build hanya diperlukan saat deploy.

## 7. Yang tidak bisa diuji di laptop

| Fitur | Sebabnya | Cara mengujinya |
|---|---|---|
| Webhook WhatsApp & Instagram | Meta perlu memanggil domain publik `api.*` | Uji di server, di luar jam buka |
| Backup ke Google Drive | Kredensial rclone ada di server | Uji di server |
| Iklan Meta | Token iklan milik akun bisnis | Uji di server |
| Sinkronisasi pusat–lokal | Perlu dua mesin | Justru pas: laptop jadi "cabang", server jadi "pusat" — itu topologi yang dijual |

Selebihnya — kasir, produksi, cetak, klik mesin, SO desainer, papan tugas,
laporan, pengaturan — jalan penuh di laptop.

## 8. Memperbarui seed

Dijalankan **di server**, lalu berkasnya diunduh:

```bash
cd /home/homelab/pos/pospro/backend && npx ts-node prisma/scripts/dump-dev-seed.ts
```

Hasilnya masuk ke `backend/backups/` (sudah masuk `.gitignore`). Skripnya
menjaga diri dengan dua lapis aturan default-tolak:

1. Tabel yang tidak terdaftar di `MASTER`/`SAMAR` ikut **strukturnya saja** —
   tabel baru tidak pernah bocor tanpa diputuskan dulu.
2. Di tabel yang disamarkan, kolom teks tanpa aturan eksplisit **dikosongkan** —
   kolom baru pun tidak ikut terbawa.

Ditambah penyapu terakhir: nama seluruh staf dicari di hasil akhir dan disensor,
karena nama orang kerap menyelip di teks master (produk custom atas nama
seseorang, catatan biaya). Kemiripan dengan nama pelanggan dilaporkan jumlahnya
saja — kebanyakan kata umum seperti "hari" atau "hitam".

> **Jangan pernah** menarik dump produksi apa adanya ke laptop. Di dalamnya ada
> 2.538 pelanggan, HPP, gaji, dan token API. Yang dibutuhkan untuk
> mengembangkan fitur hanyalah bentuk datanya, dan itu sudah ada di seed.
> Berkas seed juga jangan di-commit.

## 9. Alur kerja harian

```bash
git switch -c fitur/paket-langganan   # kerjakan di branch
# ... koding & uji di laptop ...
npm test                              # backend: jest
git push -u origin fitur/paket-langganan
```

Lalu di server, **di luar jam buka toko** (Senin–Sabtu di luar 08.30–20.50, atau
kapan saja hari Minggu):

```bash
cd /home/homelab/pos/pospro && git pull && ./deploy.sh
```

Perubahan skema database dibuat di laptop sebagai migrasi
(`npx prisma migrate dev --name <nama>` ke `pospro_dev`), folder migrasinya
ikut di-commit, lalu `deploy.sh` menerapkannya di server lewat
`npx prisma migrate deploy`. **Jangan pakai `npx prisma db push` lagi** — alasan
dan langkah lengkapnya di [Migrasi Database](migrasi-database.md).
