# 🔑 Lisensi Qendali (pembacaan & penegakan)

Aplikasi ini bisa membaca **kunci lisensi Qendali** — satu baris teks bertanda tangan yang
diterbitkan qendali.com — lalu menolak fitur yang tidak dibeli klien dan beralih ke mode
**hanya-baca** kalau masa berlakunya habis.

Kontrak kuncinya (bentuk, aturan, endpoint penyegaran) ada di repo website qendali.com:
`docs/lisensi.md`. Halaman ini cuma menjelaskan **sisi aplikasi**.

::: tip Singkatnya
**Tidak memasang token dan tidak ada berkas kunci = tidak ada penegakan sama sekali.**
Aplikasi berjalan persis seperti sebelum fitur ini ada. Itu bawaan yang disengaja.
:::

## Kenapa verifikasinya lokal

Kunci ditandatangani Ed25519 oleh qendali.com. Aplikasi hanya memegang **kunci publik**, dan
memeriksa tanda tangannya sendiri — **tanpa jaringan**. Jadi hak akses tidak pernah bergantung
pada internet atau pada hidup-matinya server induk. Penyegaran harian cuma mengambil kunci yang
lebih baru; gagal menyegarkan bukan masalah, kunci lama tetap dipakai.

Kode: `backend/src/lisensi/`

| Berkas | Isinya |
|---|---|
| `periksa-kunci.ts` | Verifikasi tanda tangan, masa berlaku, pencocokan alamat. Salinan logika dari `lib/lisensi.mjs` di repo qendali. |
| `keadaan-lisensi.ts` | Menyimpulkan keadaan: ditegakkan / tidak, aktif / tenggang / hanya-baca, daftar fitur & batas. **Aturan gagal-terbuka ada di sini.** |
| `simpanan-lisensi.ts` | Baca/tulis berkas kunci. |
| `lisensi.service.ts` | Memuat kunci saat boot, menyegarkan sekali sehari, menjawab "boleh pakai fitur ini?". |
| `fitur.guard.ts` + `butuh-fitur.decorator.ts` | `@ButuhFitur('kode.fitur')` → 403 kalau kodenya tidak ada di kunci. |
| `hanya-baca.guard.ts` | Menolak POST/PUT/PATCH/DELETE saat lisensi kedaluwarsa melewati tenggang. |
| `lisensi.controller.ts` | `GET /saya/fitur`, `POST /saya/lisensi/segarkan`. |

## Memasang token instalasi

Token dibuat di **qendali.com → /admin → klien → Buat token instalasi** (atau
`npm run klien -- token --kode=<klien>` di repo itu). Token **hanya diperlihatkan sekali**.
Lalu di `backend/.env`:

```ini
QENDALI_LISENSI_TOKEN=<token instalasi dari qendali.com>
QENDALI_ALAMAT=kasir.namaklien.com
```

Restart backend. Di log akan muncul salah satu dari:

```
[Lisensi] Lisensi produksi / Toko Budi aktif, berlaku sampai 2026-10-25T… (29 hari lagi).
[Lisensi] Tanpa kunci lisensi (…/storage/lisensi-qendali.json) — PENEGAKAN MATI, semua fitur terbuka.
```

Kalau penyegaran pertama gagal (internet klien belum siap), **aplikasi tetap terbuka** —
bukan terkunci. Penyegaran dicoba lagi saat boot berikutnya dan tiap hari pukul 03.37 WIB.

## Variabel lingkungan

| Variabel | Bawaan | Gunanya |
|---|---|---|
| `QENDALI_LISENSI_TOKEN` | *(kosong)* | Token instalasi untuk menyegarkan kunci. **Kosong = penyegaran dilewati.** |
| `QENDALI_LISENSI_URL` | `https://qendali.com` | Alamat penerbit. Diubah hanya untuk uji coba. |
| `QENDALI_ALAMAT` | *(kosong → `PUBLIC_BASE_URL` → tidak diperiksa)* | Alamat pemasangan ini, dicocokkan ke `alamatSah` di kunci. Boleh dengan `https://` dan port — dibersihkan sendiri. |
| `QENDALI_LISENSI_BERKAS` | `<backend>/storage/lisensi-qendali.json` | Tempat kunci disimpan. |
| `QENDALI_KUNCI_PUBLIK` | *(kosong)* | Kunci publik tambahan, JSON `{"prod-1":"-----BEGIN PUBLIC KEY-----\n…"}`. Dipakai saat kunci penanda tangan dirotasi, supaya tidak perlu build ulang. |
| `QENDALI_VERSI` | dari `package.json` | Nilai header `X-Qendali-Versi` saat menyegarkan — dicatat penerbit sebagai versi aplikasi yang terpasang. |

Kunci **publik** bawaan (`kid` `uji-1`) ditanam di `kunci-publik.ts`. Itu aman: kunci publik
hanya bisa memeriksa, tidak bisa menerbitkan.

## Di mana kuncinya disimpan, dan kenapa di berkas

`backend/storage/lisensi-qendali.json` (folder `storage/` sudah di-gitignore):

```json
{
  "kunci": "q1.eyJ2ZXJzaSI6MS…",
  "terakhirTerlihat": "2026-09-26T03:37:12.004Z",
  "terakhirDicoba": "2026-09-26T03:37:12.004Z",
  "catatanTerakhir": "kunci lama masih segar"
}
```

Bukan tabel database, dengan tiga alasan: repo ini belum punya riwayat migrasi Prisma (jadi
menambah tabel berarti satu langkah tangan di tiap instalasi yang sudah jalan), kunci harus bisa
dibaca sebelum & tanpa database, dan sudah ada presedennya — `storage/studio-ai-config.json`.

`terakhirTerlihat` itu **stempel penyegaran terakhir yang berhasil**, dan itu yang menangkal jam
mesin yang dimundurkan: kalau jam lokal melompat mundur lebih dari 2 jam dari stempel ini, jam
lokalnya yang diabaikan — bukan lisensinya. (Di server Voliko sendiri jam pernah salah 10 jam.)

## Apa yang terjadi kalau kunci habis masa berlakunya

| Keadaan | Membaca, mencari, mencetak | Membuat/mengubah data | Catatan |
|---|---|---|---|
| Tanpa kunci | ✅ | ✅ | Penegakan mati total. |
| Aktif | ✅ | ✅ | |
| **Tenggang** (lewat `berlakuSampai`, masih dalam `tenggangHari`) | ✅ | ✅ | Frontend sebaiknya memasang peringatan "segera perbarui". |
| **Hanya-baca** (tenggang habis, atau kuncinya tidak sah) | ✅ | ❌ 403 | Data lama tetap bisa dibuka & dicetak. |

**Habis masa = hanya-baca, BUKAN mati.** Kasir yang sedang melayani pelanggan tidak peduli soal
tagihan. Aturan yang sama berlaku saat klien turun paket: fitur yang hilang dari kunci berhenti
bisa dipakai, sisanya jalan seperti biasa.

Yang **tetap boleh** walau hanya-baca, beserta alasannya:

- `/auth/**` dan semua `…/pin/verify` — kalau masuk pun tidak bisa, tidak ada yang bisa membaca
  data lama sama sekali.
- `POST /saya/lisensi/segarkan` — satu-satunya jalan keluar dari hanya-baca setelah klien bayar.
- Webhook pihak luar (`/webhook/**`, `/whatsapp/webhook`, `/social/**`) — Meta & GitHub
  mematikan langganan webhook kalau terus dijawab galat, dan kerusakan itu bertahan lama setelah
  tagihannya dibayar.

Jawaban 403-nya bisa dibaca orang dan membawa kode mesin:

```json
{ "statusCode": 403, "kode": "lisensi_hanya_baca",
  "message": "Lisensi Qendali sudah habis masa berlakunya, jadi aplikasi sedang HANYA-BACA: …" }
```

## Cara MEMATIKAN penegakan

1. **Jangan isi `QENDALI_LISENSI_TOKEN`** di `.env`, dan
2. pastikan tidak ada berkas kunci (`backend/storage/lisensi-qendali.json`) — hapus kalau ada.

Selesai. Aplikasi kembali terbuka seluruhnya dan hanya menulis satu peringatan di log setiap
boot. Ini juga yang membuat **lingkungan pengembangan dan instalasi Voliko yang sudah jalan
produksi tidak tersentuh** oleh perubahan ini: penegakan menyala hanya kalau memang ada kunci.

Kalau token dicabut tapi berkas kuncinya ditinggal, kunci itu tetap ditegakkan sampai masa
berlakunya habis — dan setelah itu jadi hanya-baca. Jadi hapus berkasnya, bukan cuma tokennya.

## Menjaga endpoint dengan kode fitur

```ts
import { ButuhFitur } from '../lisensi/butuh-fitur.decorator';

@ButuhFitur('print.queue')       // boleh di kelas controller…
@Controller('print-queue')
export class PrintQueueController {

  @ButuhFitur('production.board') // …atau di satu metode
  @Get('jobs')
  getJobs() { … }
}
```

Kode fiturnya kosakata `data/paket.json` di repo qendali (`pos.core`, `production.board`,
`print.queue`, `ai.studio`, `branch.ledger`, …). **Tulis kodenya apa adanya** — nama baru yang
dikarang di sini tidak akan pernah cocok dengan kunci yang terbit.

Penjaganya sudah terpasang global, jadi tidak perlu ikut `@UseGuards`. Endpoint tanpa dekorator
tidak tersentuh, dan tanpa kunci lisensi dekorator ini tidak berpengaruh apa pun.

Yang **sudah** dijaga sekarang (sengaja sedikit, sebagai contoh yang benar-benar jalan):

| Endpoint | Kode fitur |
|---|---|
| Seluruh `/studio-ai/*` | `ai.studio` (add-on paket Produksi & Bisnis) |
| Seluruh `/print-queue/*` | `print.queue` |
| `GET /production/jobs` | `production.board` |

## `GET /saya/fitur` (untuk frontend)

Wajib login. Mengembalikan status lisensi, daftar kode fitur, batas, paket, produk, dan tanggal
berlaku — **tanpa** kunci mentah dan **tanpa** token.

```json
{
  "ditegakkan": true, "status": "aktif", "hanyaBaca": false, "alasan": null,
  "produk": "qendali", "paket": "produksi", "klien": "toko-budi", "namaKlien": "Toko Budi",
  "fitur": ["pos.core", "print.queue", "production.board"],
  "batas": { "limit.users": 8, "limit.branches": null },
  "berlakuSampai": "2026-10-25T00:00:00.000Z", "tenggangSampai": "2026-11-08T00:00:00.000Z",
  "sisaHari": 29, "sisaHariTenggang": 43, "terakhirTerlihat": "2026-09-26T03:37:12.004Z"
}
```

`POST /saya/lisensi/segarkan` (Owner) menarik kunci terbaru sekarang — dipakai setelah klien
bayar atau ganti paket, supaya menu baru langsung muncul tanpa menunggu jadwal harian.

Pakai ini untuk menyembunyikan menu, **tapi ingat: menyembunyikan menu itu kosmetik.** Yang
menolak sungguhan adalah penjaga di backend.

## Yang BELUM dikerjakan (jangan dianggap sudah)

- **Batas angka belum ditegakkan sama sekali.** `limit.users`, `limit.branches`,
  `limit.customers`, `limit.retention` bisa dibaca (`lisensi.batasFitur('limit.users')`) tapi
  tidak ada satu pun tempat yang menolak penambahan pengguna atau cabang. Klien paket Usaha
  masih bisa membuat 50 pengguna. Menegakkannya perlu keputusan sendiri: yang sudah lewat batas
  saat kunci pertama dipasang mau diapakan.
- **Baru 3 titik yang dijaga `@ButuhFitur`.** Sisa modul (CRM, WhatsApp, cabang, papan tugas,
  leaderboard, backup, …) masih terbuka untuk semua paket. `/production` sengaja belum dijaga
  menyeluruh: `meter/*` sebenarnya milik `click.counting` dan `pipeline/*` milik
  `production.pipeline`, jadi satu kode untuk seluruh controller justru salah.
- `limit.wa_percakapan` **jangan pernah ditegakkan** walau muncul di kunci lama — Meta menagih
  per pesan langsung ke akun klien, jadi tidak ada kuota yang perlu dijaga aplikasi. Alasan
  lengkapnya di `docs/lisensi.md` repo qendali.
- Frontend belum memakai `GET /saya/fitur` — menu masih tampil semua, dan pemakainya baru tahu
  fiturnya tidak ada setelah kena 403.
- Belum ada halaman **Pengaturan → Langganan** yang memanggil `/api/aplikasi/*` di qendali.com
  (ganti paket, tagihan, domain). Kontraknya sudah siap di `docs/lisensi.md` repo itu.

## Pemecahan masalah

| Yang terlihat di log | Artinya |
|---|---|
| `Tanpa kunci lisensi (…) — PENEGAKAN MATI` | Normal untuk dev & instalasi yang belum dilisensi. |
| `QENDALI_LISENSI_TOKEN belum diisi — penyegaran dilewati` | Token belum dipasang. Bukan galat. |
| `Tidak bisa menghubungi https://qendali.com: timeout 10 detik` | Kunci lama tetap dipakai, dicoba lagi besok. |
| `Penyegaran ditolak (403 langganan_berhenti)` | Langganan berhenti di penerbit. Aplikasi **tidak** dimatikan — kunci lama dipakai sampai masa berlakunya habis. |
| `Kunci dari … tidak lolos verifikasi (tanda_tangan_tidak_cocok)` | Kunci baru ditolak; kunci lama yang sudah bekerja dipertahankan. Cek `kid` & rotasi kunci publik. |
| `Lisensi … TIDAK BERLAKU (alamat_tidak_sah)` | `QENDALI_ALAMAT` tidak ada di `alamatSah` kunci. Terbitkan ulang kunci dengan alamat yang benar. |
| `Jam mesin ini lebih mundur dari stempel penyegaran terakhir` | Perbaiki jam server (NTP). Lisensinya tidak salah. |

Alasan penolakan yang mungkin muncul (nama yang sama dipakai penerbit):
`bentuk_kunci_salah`, `amplop_tidak_dikenal`, `isi_rusak`, `versi_isi_tidak_didukung`,
`kid_tidak_dikenal`, `tanda_tangan_rusak`, `tanda_tangan_tidak_cocok`, `alamat_tidak_sah`,
plus `produk_tidak_cocok` (kunci Qendali Event dipasang di aplikasi POS) dan
`masa_berlaku_habis`.

## Tesnya

```bash
cd backend && npm test          # termasuk src/lisensi/*.spec.ts — murni, tanpa DB & jaringan
```

Tes lisensinya meniru kasus uji di sisi penerbit (`test/lisensi.test.mjs` di repo qendali), jadi
kalau suatu hari dua sisi berbeda, ketahuannya dari tes yang gagal — bukan dari klien yang
menelepon. Pasangan kunci untuk tes dibuat di dalam tes itu sendiri; kunci privat penerbit tidak
pernah masuk repo mana pun.
