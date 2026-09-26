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
| `aturan-batas.ts` | Aturan batas angka (`limit.users`, `limit.branches`): boleh nambah atau tidak, plus kalimatnya. Murni, tanpa import. |
| `batas.service.ts` | Menghitung pemakaian sekarang & melempar 403. **Satu-satunya tempat** yang menegakkan batas angka. |
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

Yang **sudah** dijaga sekarang:

| Endpoint | Kode fitur | Dipasang di |
|---|---|---|
| Seluruh `/studio-ai/*` | `ai.studio` (add-on paket Produksi & Bisnis) | kelas |
| Seluruh `/print-queue/*` | `print.queue` | kelas |
| `GET /production/jobs` | `production.board` | metode |
| Seluruh `/crm/leads/*` | `crm.leads` | kelas |
| Seluruh `/crm/lead-sources/*` | `crm.leads` | kelas |
| Seluruh `/crm/follow-ups/*` | `crm.leads` | kelas |
| Seluruh `/crm/templates/*` | `crm.leads` | kelas |
| `/whatsapp/*` — inbox, channel, template Meta, katalog, QR chat, pesan cepat, analitik, kredensial, SSE | `wa.cloud` | kelas |
| `/whatsapp/broadcasts*` (10 rute), `/whatsapp/auto-replies*` (4), `/whatsapp/reminders/*` (3) | `wa.cloud` **+** `wa.automation` | metode |
| Seluruh `/social/*` (kecuali webhook & data-deletion) | `social.inbox` | kelas |
| Seluruh `/meta-ads/*` | `ads.meta` | kelas |
| Seluruh `/crm/kpi/*` | `crm.leads` **atau** `team.leaderboard` **atau** `cs.rating` | kelas, `@ButuhSalahSatuFitur` |
| Seluruh `/crm/custom-product-metrics/*` | sama dengan `/crm/kpi` | kelas, `@ButuhSalahSatuFitur` |

`WhatsappCloudController` itu contoh **campuran yang dijaga per metode**: bawaannya `wa.cloud` di
kelas, lalu broadcast/balasan-otomatis/reminder menulis ulang `@ButuhFitur('wa.cloud', 'wa.automation')`
di metodenya masing-masing. Ditulis ULANG, bukan ditambahi: dekorator di metode **menimpa**
dekorator kelas (`getAllAndOverride`), jadi kalau `wa.cloud` tidak disebut lagi di situ, broadcast
justru jadi lebih longgar daripada inboxnya. Keduanya memang dijual satu paket (add-on
`whatsapp_resmi` = `wa.cloud` + `wa.automation`), tapi pengecualian per klien di dasbor bisa
memberi salah satunya saja — dan siaran tanpa channel WA tidak ada artinya.

### `@ButuhFitur` vs `@ButuhSalahSatuFitur`

Dua dekorator, dan **bedanya menentukan apakah klien yang sudah bayar kena 403 atau tidak**:

| Dekorator | Artinya | Dipakai untuk |
|---|---|---|
| `@ButuhFitur('a', 'b')` | **SEMUA** kode wajib ada di kunci (DAN) | Add-on yang memang dijual sepaket, mis. `wa.cloud` + `wa.automation` untuk broadcast |
| `@ButuhSalahSatuFitur('a', 'b', 'c')` | **SALAH SATU** sudah cukup (ATAU) | Halaman yang isinya campur dari beberapa fitur sekaligus |

Yang kedua lahir dari `/crm/kpi`: satu layar berisi kepatuhan follow-up (`crm.leads`), leaderboard
desainer & operator (`team.leaderboard`), dan tren rating CS (`cs.rating`). Dengan `@ButuhFitur`
ketiganya jadi syarat sekaligus, jadi klien yang cuma berlangganan leaderboard ditolak di halaman
yang separuhnya memang miliknya — itu sebabnya kedua endpoint ini sebelumnya dibiarkan **terbuka
sama sekali**. `/crm/custom-product-metrics` ikut daftar yang sama karena dia halaman setelan
metrik yang tampil di dasbor itu; kalau satu daftar diubah, ubah dua-duanya.

Metadatanya dua kunci yang **terpisah**, jadi keduanya tidak saling menimpa: memasang dua-duanya
di satu handler berarti dua-duanya harus lolos. Boleh, tapi hampir selalu tanda daftar fiturnya
perlu dipikir ulang, bukan ditumpuk.

::: warning Yang TIDAK dilakukannya
`@ButuhSalahSatuFitur` **tidak menyaring isi jawaban**. Klien yang cuma punya `cs.rating` tetap
menerima seluruh payload dasbor KPI, termasuk angka leaderboard. Menyaring per bagian butuh
pemikiran produk sendiri (panel kosong tanpa penjelasan lebih membingungkan daripada panel yang
ada isinya), dan endpoint ini sebelumnya tidak dijaga sama sekali — jadi keadaan sekarang lebih
rapat daripada sebelumnya, bukan lebih longgar.
:::

### Yang SENGAJA dikecualikan (jangan "dirapikan")

| Endpoint | Kenapa dibiarkan terbuka |
|---|---|
| `GET/POST /whatsapp/webhook` | **Webhook Meta.** Dipanggil tanpa sesi pengguna. Sekali dijawab 403, Meta menonaktifkan webhooknya → pesan pelanggan hilang tanpa jejak, juga untuk klien yang paketnya MEMANG memuat WhatsApp. |
| `GET/POST /social/webhook` | Sama: webhook Messenger & Instagram. DM dan komentar masuk lewat sini. |
| `POST/GET /social/data-deletion` | Callback hapus-data Meta + halaman statusnya. Kewajiban menghapus data tidak ikut hilang kalau klien turun paket. |
| `GET /storefront/*` | API baca-lead untuk situs toko klien; otentikasinya token tersendiri (`X-Storefront-Read-Token`), bukan sesi pengguna. Menjaganya = mematikan situs yang sedang hidup. |
| `POST /orders/public` | Form order di situs klien. 403 di sini = order pelanggan hilang di tengah jalan. |
| `POST /crm/public/*` | Dasbor marketing & papan TV, masuknya cuma PIN. Tanpa sesi pengguna, dan layarnya menyala terus — 403 di situ tidak ada yang membacanya. Dasbor KPI yang pakai login SUDAH dijaga, lihat tabel di atas. |
| Seluruh `/customers/*` | `customers.core` ada di **semua** paket termasuk Gratis. Menjaganya nol gunanya dan cuma menambah kemungkinan salah. |
| `/whatsapp/status`, `/whatsapp/send`, `/whatsapp/broadcast`, `/whatsapp/config/*` (kelas `WhatsappController`) | Bot tempel-QR (whatsapp-web.js), **bukan** Cloud API: tidak punya kode fitur di `paket.json`, tidak dijual di paket mana pun, tidak menagih Meta sepeser pun. Dipakai rekap shift ke grup pemilik. Alasan yang sama dengan menu `/settings/whatsapp` di frontend. |
| `/work-orders/*` | Namanya di bawah `crm/`, tapi isinya SPK cetak (mockup, pola print) — urusan produksi, bukan prospek. |

Aturannya sama dengan aturan menu: **kalau ragu, biarkan terbuka.** Endpoint yang ternyata boleh
dipakai lalu ditolak 403 jauh lebih mahal daripada endpoint yang kelewat longgar.

**Penjaga ini tingkat HTTP, jadi cron tidak tersentuh** — dan itulah kenapa ada bagian berikutnya.

## Pekerjaan terjadwal ikut lisensi

`FiturGuard` cuma melihat permintaan yang masuk lewat controller. Cron dan alur webhook tidak lewat
controller, jadi sampai 26 Sep 2026 klien yang add-on WhatsApp-nya dicabut **tetap mengirim**
broadcast & reminder yang sudah terjadwal sebelum paketnya turun — dan tiap pesan itu ditagih Meta
ke kartu kliennya sendiri. Celah itu sekarang ditutup di **satu tempat**:

| Berkas | Isinya |
|---|---|
| `src/lisensi/aturan-terjadwal.ts` | Aturannya: pekerjaan → kode fitur, dan putusannya. Murni, tanpa Nest/DB/jaringan. |
| `src/lisensi/penjaga-terjadwal.service.ts` | `PenjagaTerjadwal` (disuntik lewat `LisensiModule` yang `@Global`) + fungsi `lewatiKarenaLisensi()` yang dipakai call site. |

Satu baris di paling atas tiap penjadwal, sebelum baris apa pun disentuh:

```ts
@Cron('0 * * * * *')
async sweepScheduled() {
    if (lewatiKarenaLisensi(this.penjagaTerjadwal, 'wa.broadcast')) return;
    …
}
```

### Penjadwal → kode fitur → tempat pemeriksaannya

| Penjadwal | Jadwal | Kode fitur (semua wajib) | Berhenti saat hanya-baca? | Dipasang di |
|---|---|---|---|---|
| Broadcast terjadwal | tiap menit | `wa.cloud` + `wa.automation` | **ya** | `broadcast.service.ts` → `sweepScheduled()` |
| Pengingat follow-up | tiap 15 menit | `wa.cloud` + `wa.automation` | **ya** | `reminders.service.ts` → `sweepFollowUps()` |
| Balasan otomatis WA | dipicu webhook | `wa.cloud` + `wa.automation` | **ya** | `auto-reply.service.ts` → `handleInbound()` |
| Sinkron status template Meta | tiap 10 menit | `wa.cloud` | tidak | `templates.service.ts` → `autoSyncStatuses()` |
| Sinkron komentar & DM IG/FB | tiap 5 menit | `social.inbox` | tidak | `social-comments.service.ts` → `autoSync()` |
| Repeat order CRM | Senin 08.00 WIB | `crm.leads` | **ya** | `follow-ups.cron.ts` → `scheduleRepeatOrders()` |

Yang terakhir juga masih mati kecuali `CRM_REPEAT_ORDER_AUTO=on`, dan **sakelar itu diperiksa
lebih dulu**: fitur ini mati untuk hampir semua instalasi, jadi memeriksa lisensi di depan berarti
tiap Senin menulis peringatan lisensi untuk pekerjaan yang tidak akan jalan juga — log yang
menuduh hal yang salah lebih buruk daripada log yang tidak ada.

Balasan otomatis bukan cron, tapi celahnya persis sama: webhook Meta **sengaja** dibiarkan terbuka
(lihat tabel pengecualian di atas), jadi tanpa pemeriksaan di situ balasannya tetap terkirim dan
tetap ditagih. Yang dilewati **pesannya**, bukan pencatatannya: pesan masuk tetap tersimpan, dan
**opt-out/opt-in tetap dicatat ke database** — orang yang membalas "STOP" harus berhenti dapat
pesan apa pun keadaan langganannya, itu janji yang tertulis di footer template dan tidak ikut
kedaluwarsa. Yang hilang cuma balasan konfirmasinya.

**Bersih-bersih media WA (03.00) sengaja TIDAK dijaga.** Dia cuma menghapus berkas media lama di
disk sendiri: tidak mengirim apa pun, tidak menyentuh Meta, tidak menagih klien sepeser pun. Tidak
ada kode fitur yang cocok untuk tukang sapu, dan menjaganya justru merugikan klien — disknya penuh
sementara dia sudah bayar lagi. Penyegaran lisensi harian juga tidak dijaga: itu satu-satunya jalan
KELUAR dari keadaan terkunci.

### Hanya-baca: yang mengirim berhenti, yang menarik tidak

Keputusannya (26 Sep 2026): saat lisensi sudah **hanya-baca** (kedaluwarsa melewati tenggang),
pengiriman terjadwal **ikut dilewati** — dia membuat data baru di instalasi yang statusnya sudah
"cuma boleh dibaca", dan menimbulkan biaya Meta ke klien yang justru sedang tidak membayar.

Yang **tidak** ikut berhenti: sinkron status template dan sinkron komentar/DM. Keduanya cuma
MENARIK keadaan dari Meta. Memblokirnya berarti membuang komentar dan pesan pelanggan — alasan yang
persis sama dengan kenapa webhook Meta dibiarkan terbuka di `hanya-baca.guard.ts`.

::: tip MASA TENGGANG MASIH JALAN PENUH
Cuma kedaluwarsa yang berhenti. Selama tenggang, keenam penjadwal jalan seperti biasa — sama
seperti menulis data yang masih boleh selama tenggang. Tenggang yang mematikan broadcast sama saja
dengan tenggang yang tidak ada gunanya.
:::

### Pekerjaan yang dilewati TIDAK HILANG

Ini yang paling penting, dan yang paling gampang dirusak orang yang "merapikan" kode ini nanti.
Pekerjaan yang dilewati **tidak ditandai gagal, tidak dihapus, dan penghitung percobaannya tidak
dinaikkan**. Karena itu pemeriksaannya dipasang **sebelum baris apa pun diklaim**:

- **Broadcast** tetap `SCHEDULED` dengan `scheduledAt` yang sudah lewat → sapuan menit berikutnya
  setelah fiturnya dipasang lagi menjalankannya sendiri. Kalau pemeriksaannya dipindah ke bawah
  `run()`, statusnya sudah jadi `RUNNING` → `PAUSED` dan staf harus melanjutkan manual.
- **Reminder** keluar sebelum `send()` pernah dipanggil. `send()` menulis `WaReminderLog` sebagai
  penanda dedup, dan penanda itu membuat FU yang sama **tidak pernah** diingatkan lagi.
- **Repeat order CRM** tidak membuat satu baris `FollowUp` pun.

Yang menjaganya: `prisma` palsu di tesnya **melempar begitu disentuh**, jadi tesnya lulus hanya
kalau cron-nya benar-benar keluar sebelum satu baris pun dibaca atau ditulis.

**Satu pengecualian yang harus jujur disebut:** repeat order CRM jendelanya **bergerak** (order
terakhir 90–97 hari lalu, irisan satu minggu). Putaran yang dilewati tidak kembali sendiri minggu
depan — irisannya sudah bergeser. Itu sifat pekerjaannya, bukan kerusakan yang dibawa penjaga ini
(hal yang sama terjadi kalau server mati pada Senin 08.00), tapi jangan pernah mengklaim
"semuanya lanjut sendiri" untuk yang satu ini.

### Log: per PERUBAHAN, bukan per putaran

Penjadwal broadcast jalan **tiap menit**. Satu baris per putaran = 1.440 baris sehari untuk satu
klien yang paketnya turun, dan log server yang tenggelam justru membuat masalah sungguhan tidak
kelihatan. Jadi `PenjagaTerjadwal` mencatat **sekali saat keadaannya berubah**, lalu diam 6 jam
untuk alasan yang sama, dan menulis satu baris lagi saat pekerjaannya pulih:

```
WARN  [Lisensi] broadcast WhatsApp terjadwal dilewati: kode fitur wa.cloud, wa.automation tidak
                ada di paket usaha. Pekerjaannya tidak dibatalkan — dilanjutkan sendiri begitu
                fiturnya dipasang lagi di qendali.com
WARN  [Lisensi] pengingat follow-up WhatsApp dilewati: lisensi HANYA-BACA (masa_berlaku_habis).
                Pekerjaannya tidak dibatalkan — dilanjutkan sendiri setelah lisensi diperbarui
LOG   [Lisensi] broadcast WhatsApp terjadwal jalan lagi (lisensinya sudah cocok).
```

Tiap pekerjaan punya barisnya sendiri, dan alasan yang **berubah** (fitur dicabut → lalu
kedaluwarsa) dicatat lagi; kalau tidak, log berhenti bercerita. Polanya dipinjam dari
`social-comments.service.ts` (`lastAutoErrors`), yang sudah pakai cara yang sama untuk galat
sinkron tiap 5 menit.

### Gagal-terbuka, dan penjadwal yang tidak boleh mati

`bolehJalan()` **tidak pernah melempar**, dan kalau ragu jawabannya "jalan":

| Keadaan | Hasilnya |
|---|---|
| Tanpa kunci / penegakan mati | jalan seperti biasa |
| Kunci gagal dibaca / tidak sah | jalan untuk yang cuma menarik; pengiriman berhenti karena statusnya hanya-baca |
| Pemeriksaannya sendiri melempar galat | **jalan**, galatnya dicatat sebagai `error` untuk diperbaiki |
| `PenjagaTerjadwal` tidak tersuntik | jalan (`lewatiKarenaLisensi(undefined, …)` = `false`) |

Penjadwal yang mati diam-diam tidak meninggalkan jejak galat di mana pun: pemiliknya baru tahu
berhari-hari kemudian, dari pelanggan yang tidak pernah dihubungi. Itu kerusakan yang jauh lebih
mahal daripada beberapa pesan yang kelewat terkirim.

::: danger Jangan menulis `!this.penjagaTerjadwal?.bolehJalan(kode)`
Parameter penjaganya `@Optional()`. `!undefined?.bolehJalan(…)` bernilai `true`, jadi bentuk itu
membuat penjadwalnya **berhenti total tanpa satu baris log** begitu penjaganya tidak tersuntik —
arah kegagalan yang persis kebalikan dari yang dimaui, dari satu karakter. Selalu lewat
`lewatiKarenaLisensi()`.
:::

Kenapa `@Optional()`: belasan tes lama membangun service-nya langsung
(`new BroadcastService(prisma, cloud)`) untuk menguji hal yang sama sekali bukan lisensi, dan tes
yang harus diubah tiap ada dependensi baru adalah tes yang cepat atau lambat dimatikan orang.
Konsekuensinya salah wiring tidak meledak di mana pun — cuma membuat penegakannya diam-diam
hilang. Yang menangkapnya cuma satu tes: "modul menyediakan `PenjagaTerjadwal`" di
`lisensi.module.spec.ts`. Jangan hapus tes itu.

## Batas angka: jumlah pengguna & cabang

Selain daftar fitur, kunci juga membawa batas angka (`batas` di kunci, `limit.*` di
`data/paket.json`). Yang **ditegakkan** cuma dua, dan cuma saat MENAMBAH:

| Kode | Ditegakkan di | Yang dihitung |
|---|---|---|
| `limit.users` | `POST /users` (`UsersService.create`) | `users` dengan `is_active = true` |
| `limit.branches` | `POST /company-branches` (`CompanyBranchesService.create`) | `company_branches` dengan `is_active = true` |

Pemeriksanya **satu**: `BatasService.wajibBolehMenambah('limit.users')`. Jangan pernah menyalin
logikanya ke controller — dua tempat yang menghitung "aktif" dengan cara berbeda akan menolak
klien yang sebenarnya belum penuh.

::: danger Klien yang sudah lewat batas DIBIARKAN
Tidak ada pengguna dinonaktifkan, tidak ada cabang dimatikan, tidak ada data disembunyikan.
Toko dengan **8 pengguna** di paket berbatas 5: delapan-delapannya tetap masuk kerja besok pagi;
yang ditolak cuma penambahan orang kesembilan.

Alasannya: batas ini dipasang di tengah jalan. Kunci pertama yang terbit untuk klien yang sudah
setahun memakai aplikasi tidak boleh mengunci karyawannya di luar pintu gara-gara angka di
paket — itu memutus jualan, bukan menagih. Karena itu penegakannya **hanya di `create`**, bukan
di `update`/`delete`: klien yang lewat batas harus tetap bisa merapikan datanya sendiri.
:::

### Yang SENGAJA tidak ditegakkan

| Kode | Kenapa |
|---|---|
| `limit.customers` | Pelanggan sering dibuat di tengah transaksi. Menolaknya berarti menghentikan penjualan di depan pembeli yang sedang menunggu di kasir. Tidak sebanding dengan apa pun yang dihemat. |
| `limit.retention` | Itu soal sejauh apa laporan boleh menengok ke belakang — **penyaringan**, bukan penolakan. Butuh pemikiran produk sendiri (laporan yang diam-diam terpotong lebih membingungkan daripada ditolak terang-terangan). |
| `limit.wa_percakapan` | **Jangan pernah.** Meta menagih per pesan langsung ke akun WhatsApp Business klien, jadi tidak ada kuota yang perlu dijaga aplikasi. Alasan lengkapnya di `docs/lisensi.md` repo qendali. |

### Empat aturan yang jangan dilonggarkan

1. **Gagal-terbuka.** Tidak ada kunci, kunci tidak sah, atau nilai batasnya `null` → **tanpa
   batas sama sekali**, dan database tidak disentuh (nol query tambahan di jalur itu). Kode batas
   yang **tidak ada** di kunci juga dibaca `null` = tanpa batas — itu memang disengaja, jangan
   "diperbaiki" jadi nol.
2. **Hitungannya gagal = jangan menolak.** Kalau query hitungnya melempar (database sedang
   bermasalah), batasnya dilewati dan cukup dicatat di log. Menolak orang karena *hitungannya*
   gagal berarti menolak tanpa tahu dia sudah penuh atau belum.
3. **`0` ≠ `null`.** Nol berarti jenis itu memang **tidak termasuk paket** → satu pun tidak
   boleh. Di kode ini artinya `if (batas === null)`, bukan `if (!batas)`.
4. **Yang dihitung hanya yang aktif.** Karyawan yang keluar tidak dihapus (`isActive: false` +
   `resignedAt`, supaya riwayat lead/kas/tugasnya tetap utuh), dan cabang yang punya riwayat
   memang tidak bisa dihapus — jadi menghitung semua baris berarti menagih klien untuk orang yang
   resign dua tahun lalu, dan klien yang menutup satu cabang tidak akan pernah bisa buka cabang
   baru lagi.

::: warning `limit.branches` = CompanyBranch, bukan Branch
Model `Branch` (tabel `branches`) itu **titik di Peta Cuan** — lat/long plus omzet pesaing, bisa
diisi puluhan baris untuk riset lokasi. Cabang yang dilisensi adalah **`CompanyBranch`** (tabel
`company_branches`). Tertukar di sini = klien satu outlet ditolak menambah cabang karena dia
rajin memetakan pesaing. Tesnya menjaga ini: `prisma.branch.count` **tidak boleh** pernah
dipanggil.
:::

### Apa yang dilihat klien

Jawaban penolakannya:

```json
{ "statusCode": 403, "error": "Forbidden", "kode": "lisensi_batas_penuh",
  "batas": { "kode": "limit.users", "nilai": 5, "pemakaian": 5 },
  "message": "Paket Usaha membatasi 5 pengguna, dan sekarang sudah ada 5. …" }
```

`message`-nya menyebut jumlah sekarang, batasnya, nama paketnya, dan dua jalan keluar — jadi
frontend cukup menampilkannya apa adanya, tidak perlu mengarang kalimat sendiri:

> Paket Usaha membatasi 5 pengguna, dan sekarang sudah ada 5. Naikkan paket di Pengaturan →
> Langganan, atau tandai pengguna lain keluar dulu.

Yang sudah lewat batas mendapat kalimat yang menenangkan dulu, karena pertanyaan pertama di
kepalanya adalah "karyawan saya dihapus?":

> Paket Usaha membatasi 5 pengguna, dan sekarang sudah ada 8. Yang 8 itu tetap jalan seperti
> biasa — yang belum bisa cuma menambah yang baru. Naikkan paket di Pengaturan → Langganan, atau
> tandai pengguna lain keluar dulu.

Di **Pengaturan → Langganan** ada bagian "Pemakaian paket": `Pengguna 4 dari 5 pengguna` dengan
bar tipis. Penandanya cuma muncul kalau tinggal satu slot (amber, "Tinggal 1 pengguna lagi.")
atau sudah penuh — **bukan** merah, dan tidak ada tombol yang dimatikan dari situ. Aturannya di
`frontend/src/lib/lisensi/pemakaian-batas.ts` (murni, ada tesnya); batas `null` tidak ditampilkan
sama sekali, batas `0` tetap ditampilkan.

### Kalau mau menambah jenis batas baru

Tiga tempat, semuanya wajib:

1. `BATAS_DITEGAKKAN` di `aturan-batas.ts` — kode, nama, satuan, saran jalan keluar.
2. `CARA_HITUNG` di `batas.service.ts` — cara menghitung yang **aktif** (sebut kolomnya di
   komentar, dan pastikan modelnya yang benar).
3. Tempat penambahannya memanggil `wajibBolehMenambah()`, **sesudah** semua pemeriksaan wewenang —
   kalau dipanggil sebelum, orang yang tidak berhak ikut diberi tahu jumlah data klien ini.

Plus label di `frontend/src/lib/lisensi/pemakaian-batas.ts` supaya barisnya ikut tampil.

::: tip Kenapa bukan penjaga global seperti `@ButuhFitur`
`BatasService` perlu database, dan penjaga global (APP_GUARD) jalan **sebelum** `JwtAuthGuard` di
controller — jadi tamu yang belum masuk pun bisa memancing jumlah pengguna klien lewat pesan
galatnya. Karena itu yang memanggilnya adalah service tempat penambahan terjadi.
:::

## `GET /saya/fitur` (untuk frontend)

Wajib login. Mengembalikan status lisensi, daftar kode fitur, batas, pemakaian, paket, produk,
dan tanggal berlaku — **tanpa** kunci mentah dan **tanpa** token.

```json
{
  "ditegakkan": true, "status": "aktif", "hanyaBaca": false, "alasan": null,
  "produk": "qendali", "paket": "produksi", "klien": "toko-budi", "namaKlien": "Toko Budi",
  "fitur": ["pos.core", "print.queue", "production.board"],
  "batas": { "limit.users": 8, "limit.branches": null },
  "pemakaian": { "limit.users": 5 },
  "berlakuSampai": "2026-10-25T00:00:00.000Z", "tenggangSampai": "2026-11-08T00:00:00.000Z",
  "sisaHari": 29, "sisaHariTenggang": 43, "terakhirTerlihat": "2026-09-26T03:37:12.004Z"
}
```

`pemakaian` = jumlah yang terpakai sekarang, bentuknya kembar dengan `batas` supaya gampang
dipasangkan di layar. Yang masuk ke situ **hanya** kode yang benar-benar punya batas angka: yang
tanpa batas tidak dihitung (nol query), dan kode yang gagal dihitung **dilewati** — jangan dibaca
sebagai nol. Instalasi tanpa kunci menjawab `{}`.

`POST /saya/lisensi/segarkan` (Owner) menarik kunci terbaru sekarang — dipakai setelah klien
bayar atau ganti paket, supaya menu baru langsung muncul tanpa menunggu jadwal harian.

Pakai ini untuk menyembunyikan menu, **tapi ingat: menyembunyikan menu itu kosmetik.** Yang
menolak sungguhan adalah penjaga di backend.

## Menu dasbor ikut isi kunci

::: danger Kosmetik, bukan keamanan
Menu yang disembunyikan **bukan** penjagaan. Siapa pun bisa mengubah JavaScript di browsernya
sendiri, mengetik alamatnya langsung, atau memanggil API-nya dengan curl. Yang benar-benar
menolak tetap `FiturGuard` & `HanyaBacaGuard` di backend. Gunanya penyembunyian ini cuma satu:
pemakai tidak dibiarkan mengklik menu yang pasti menjawab 403. **Jangan pernah menghapus penjaga
backend dengan alasan "menunya kan sudah disembunyikan".**
:::

Kode: `frontend/src/lib/lisensi/aturan-menu.ts` (aturan murni, tanpa satu pun import),
`frontend/src/hooks/useLisensi.ts` (pengambil & cache), dan
`frontend/src/components/layout/SpandukLisensi.tsx` (spanduk).

Peta menu → kode fitur ada di **satu** tabel, `PETA_FITUR_MENU`:

| Menu | Kode fitur |
|---|---|
| Laporan Laba Kotor | `reports.profit` |
| Tutup Buku Bulanan | `books.monthly` |
| Riwayat Tutup Shift | `shift.close` |
| DP / Piutang | `ar.dp` |
| Cashflow Bisnis | `finance.cashflow` |
| Manajemen Stok, Laporan Stok, Data Supplier | `inventory.stock` |
| Stok Opname | `inventory.opname` |
| Titipan Masuk & Keluar, Buku Titipan, Laporan Bahan Titipan | `branch.ledger` |
| Transfer Stok Cabang, Order Cabang | `branch.ops` |
| Antrian Produksi | `production.board` |
| Pipeline Produksi | `production.pipeline` |
| Antrian Cetak Paper | `print.queue` |
| Klik Mesin Cetak | `click.counting` |
| CRM Dashboard, Leads, Tugas Follow-up, Template Pesan | `crm.leads` |
| Data Pelanggan | `customers.core` |
| Invoice & Penawaran | `invoice.quotation` |
| Sales Order | `so.designer` |
| Inbox Chat, QR Chat, Pesan Cepat, Template Meta, Katalog Produk, Analitik, Pengaturan Channel | `wa.cloud` |
| Broadcast, Balasan Otomatis, Reminder POS | `wa.automation` |
| Inbox Sosial (IG/FB) | `social.inbox` |
| Iklan Meta | `ads.meta` |
| Landing Page, Artikel | `site.landing` |
| Kalkulator HPP, Rumus HPP per Produk | `hpp.calc` |
| Leaderboard | `team.leaderboard` |
| Papan Tugas, Papan Piket, Pantau Piket, Grup Tim, Jadwal Tugas | `tasks.piket` |
| Studio Desain (`/desainer`) | `ai.studio` |
| Pengaturan → Akses Menu Role | `rbac.menu` |
| Pengaturan → Discord | `notify.discord` |
| Pengaturan → Backup & Recovery | `backup.cloud` |

Yang **sengaja tidak dipetakan** (jadi selalu tampil): Dashboard, Beranda Saya, Kasir POS, Rekap
Penjualan, Permintaan Edit, Peta Cuan Lokasi, Dashboard Owner, dan di Pengaturan: Profil Toko,
Pembayaran, Rekening Bank, Printer Struk, Tampilan Login, Karyawan, Cabang Perusahaan, Per
Cabang, Bot WhatsApp, Notifikasi, dan **Langganan**. Alasan tiap satunya ditulis di tabel
komentar `PETA_FITUR_MENU` — tiga yang paling penting:

- **Kasir POS & Beranda** tidak pernah disembunyikan. `pos.core` ada di semua paket jadi tidak
  ada yang bisa disembunyikan, sementara salah sembunyi berarti kasir tidak bisa jualan.
- **Bot WhatsApp** di Pengaturan itu bot tempel-QR, **bukan** Cloud API — `wa.cloud` salah
  alamat, dan bot itu tidak dijual di paket mana pun.
- **Langganan** adalah satu-satunya jalan keluar dari hanya-baca. Kalau menunya ikut hilang,
  klien yang telat bayar tidak punya cara membayar. Ada tes yang gagal kalau lima href ini
  (`/`, `/pos`, `/beranda`, `/reports/sales`, `/settings/langganan`) suatu hari dipetakan.

### Gagal-terbuka, empat lapis

1. `/saya/fitur` gagal, lambat, atau menjawab galat → **semua menu tampil**. `useLisensi.ts`
   memakai `retry: false` dan tidak pernah menahan menu sambil menunggu.
2. `ditegakkan: false` (tanpa kunci — Voliko & semua lingkungan pengembangan) → semua tampil.
3. `fitur` kosong padahal `ditegakkan: true` (kunci ada tapi ditolak: tanda tangan rusak, alamat
   salah, produk lain) → semua tampil. Tidak ada paket Qendali yang isinya nol fitur, jadi daftar
   kosong selalu berarti "tidak tahu". Kalau ini ditutup, satu kunci rusak melenyapkan seluruh
   menu sekaligus — padahal saat itu klien justru perlu membuka laporan lamanya.
4. Menu yang tidak ada di peta → tampil.

`hanyaBaca` **tidak pernah** dipakai untuk menyembunyikan menu. Saat hanya-baca, laporan,
pencarian, dan cetak ulang harus tetap bisa dibuka — yang ditolak cuma menulis, dan itu tugas
`HanyaBacaGuard`.

### Kapan keadaannya ditarik ulang

Sekali saat layout dasbor pertama dipakai (sesudah login), lalu **tiap 30 menit** — bukan tiap
pindah halaman: isi paket berubah beberapa kali setahun, sementara orang berpindah halaman
ratusan kali sehari. Halaman **Pengaturan → Langganan** membuang cache ini
(`segarkanKeadaanLisensi()`) tiap kali sebuah perubahan berhasil, supaya menu barunya muncul
seketika, bukan setengah jam kemudian.

### Spanduk keadaan lisensi

Satu strip tipis di bawah header (`SpandukLisensi`, dipasang sekali di `MainLayout`). Sengaja
**bukan** kotak dialog seperti `ShiftReminderBanner`: kasir yang sedang melayani pelanggan tidak
boleh harus menutup dialog dulu.

| Keadaan | Spanduk |
|---|---|
| Tanpa kunci / penegakan mati | **Tidak ada apa-apa.** Instalasi yang belum tersambung ke qendali.com itu keadaan normal; mengganggunya cuma melatih orang mengabaikan spanduk. |
| Aktif | Tidak ada. |
| **Tenggang** | Kuning, halus: "Kunci lisensi belum tersegarkan — sisa N hari sebelum aplikasi jadi hanya-baca. Sampai itu semua transaksi masih bisa dicatat seperti biasa." Bisa ditutup, **kembali besok**. |
| **Hanya-baca** | Merah: "Data lama tetap bisa dibuka, dicari, dan dicetak ulang. Transaksi baru belum bisa dicatat sampai lisensinya diperbarui." Tidak bisa ditutup. |

Tautan "Buka Langganan" hanya muncul untuk Owner — halaman itu `ownerOnly` dan backend
menolaknya juga, jadi mengirim kasir ke sana cuma memberi dia galat. Yang bukan pemilik dapat
kalimat "Beri tahu pemilik: Pengaturan → Langganan."

Kalimat tenggang **tidak boleh** ditulis seolah aplikasinya sudah mati. Selama tenggang, menulis
masih boleh — itu memang gunanya tenggang.

## Yang BELUM dikerjakan (jangan dianggap sudah)

- **Menyalakan kembali yang nonaktif belum dibatasi.** `limit.users` & `limit.branches` dijaga di
  `create` saja (keputusan pemilik: jangan sentuh endpoint ubah/hapus), jadi klien yang sudah
  penuh masih bisa menaikkan jumlah aktifnya dengan mengaktifkan lagi karyawan yang keluar atau
  cabang yang ditutup. Dibiarkan dengan sadar — memblokirnya berarti klien yang lewat batas tidak
  bisa lagi merapikan datanya, dan itu jalan keluarnya. Yang perlu diperhatikan kalau nanti mau
  ditutup: `setStatus({active:true})` di `users.service.ts` dan `update({isActive:true})` di
  `company-branches.service.ts`.
- **Batas yang lain memang tidak ditegakkan.** `limit.customers` & `limit.retention` sengaja
  dilewati — alasannya di bagian "Batas angka" di atas, jangan ditambahkan tanpa membacanya dulu.
- **Masih banyak modul yang belum dijaga `@ButuhFitur`.** Yang sudah: Studio AI, antrian cetak,
  papan produksi, CRM prospek & follow-up, dasbor KPI, WhatsApp Cloud, inbox IG/FB, iklan Meta
  (tabel di atas). Yang belum: cabang & buku titipan, papan tugas, leaderboard, backup, landing
  page, invoice & penawaran, portal desainer. `/production` sengaja belum dijaga menyeluruh:
  `meter/*` sebenarnya milik `click.counting` dan `pipeline/*` milik `production.pipeline`, jadi
  satu kode untuk seluruh controller justru salah — di situ yang dibutuhkan pemilahan per metode,
  bukan `@ButuhSalahSatuFitur` (dua endpoint itu memang beda fitur, bukan satu halaman campuran).
- **Halaman frontend yang memanggil `/whatsapp/*` dari luar menu WA** — mis. tombol "buka chat" di
  halaman Leads — baru tahu fiturnya tidak ada setelah kena 403. Menu-nya sendiri sudah
  disembunyikan lewat `PETA_FITUR_MENU`. (Cron-nya sendiri sudah ikut lisensi sejak 26 Sep 2026,
  lihat "Pekerjaan terjadwal ikut lisensi".)
- **`RemindersService.sendOrderReady()` dari `branch-inbox` belum dijaga.** Titipan yang ditandai
  SIAP_AMBIL memanggilnya langsung di dalam proses (`branch-inbox.service.ts:280`), jadi dia lolos
  dari `FiturGuard` sama seperti cron dulu. **Dibiarkan dengan sadar**, dan alasannya bukan
  kemalasan: dia dipicu satu kejadian, bukan disapu berkala. Kalau dilewati, pemberitahuan "pesanan
  siap diambil" **hilang permanen** — tidak ada sapuan yang mengulanginya setelah paketnya
  dipulihkan, jadi menjaganya sekarang justru melanggar aturan "pekerjaan yang dilewati tidak
  hilang". Yang perlu ada lebih dulu: antrean/sapuan untuk reminder jenis ini. Jalur manualnya
  (`POST /whatsapp/reminders/order-ready`) sudah dijaga `wa.cloud` + `wa.automation`.
- **Broadcast yang sudah `RUNNING` tidak dihentikan di tengah jalan.** Yang dijaga pemicunya
  (sapuan terjadwal + endpoint HTTP untuk memulai), bukan loop yang sedang mengirim. Disengaja:
  memutus di tengah meninggalkan separuh penerima sudah dapat pesan dan separuhnya tidak, dan itu
  lebih buruk daripada menyelesaikannya. Setelah restart, `RUNNING` jadi `PAUSED` seperti biasa.
- **Cron di luar WA/CRM/sosial belum dijaga sama sekali** — papan tugas & piket
  (`task-board.cron.ts`), champion Discord mingguan (`kpi.cron.ts`), sinkron desktop
  (`local-sync.service.ts`). Sengaja: endpoint-nya sendiri juga belum dijaga, dan cron yang lebih
  rapat daripada endpoint-nya berarti dua tempat menjawab beda untuk fitur yang sama.
- **Halaman, bukan menu, belum dijaga di frontend.** Menu yang fiturnya tidak ada sudah
  disembunyikan (lihat "Menu dasbor ikut isi kunci"), tapi mengetik alamatnya langsung tetap
  membuka halamannya — isinya baru kosong/galat saat API-nya menjawab 403. Itu disengaja untuk
  sekarang: yang menolak sungguhan adalah backend, dan menambah pengalihan di frontend berisiko
  memantul-mantulkan orang kalau `/saya/fitur` gagal. Kalau nanti dibuat, pengalihannya wajib
  ikut gagal-terbuka.
- **Menu di luar `PETA_FITUR_MENU` belum dipetakan** — mis. `/tv/leaderboard` (`team.tvboard`),
  `/owner/analisa-keuangan` (`owner.finance`), dan `/owner/laporan-bulanan`. Ketiganya bukan item
  nav (dibuka dari dalam halaman lain), jadi penyembunyian lewat nav tidak menyentuhnya.
- **Pemakaian baru tampil di satu layar.** Pengaturan → Langganan sudah menulis "4 dari 5
  pengguna", tapi halaman Karyawan & Cabang sendiri belum memberi tahu apa pun sebelum orangnya
  menekan Simpan dan kena 403. Yang perlu diingat kalau nanti ditambahkan: jangan mematikan
  tombolnya dari frontend (`/saya/fitur` yang gagal akan mengunci pemilik dari halaman
  karyawannya) — cukup tampilkan angkanya.

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
cd backend  && npm test         # termasuk src/lisensi/*.spec.ts — murni, tanpa DB & jaringan
cd frontend && npm test         # aturan menu & spanduk — node --test, tanpa jest
```

Tes frontend-nya `src/lib/lisensi/aturan-menu.test.mjs` + `pemakaian-batas.test.mjs`, dijalankan
oleh **test runner bawaan Node** (`node --test`). Tidak ada jest, tidak ada dependensi baru, dan
kedua berkas yang diujinya sengaja tanpa satu pun import — jadi tesnya jalan di mesin yang
`frontend/node_modules`-nya belum dipasang sekalipun. Perlu **Node ≥ 22.18** (yang melepas tipe
dari `.ts` sendiri); di Node 20 tesnya tidak jalan, sementara `npm run build` tetap aman.

Yang dijaganya: fitur ada → tampil, fitur tidak ada → sembunyi, gagal ambil → semua tampil,
tidak ditegakkan → semua tampil, menu tanpa pemetaan → tampil, hanya-baca tidak menyembunyikan
apa-apa, dan lima href yang tidak boleh pernah dipetakan. Untuk batas: `null` disembunyikan, `0`
tetap tampil, dan hitungan yang tidak dikirim backend tidak ditebak jadi nol.

Penjagaan kode fitur punya dua berkas tes juga, dan bedanya sama pentingnya:

| Berkas | Yang dijaganya |
|---|---|
| `src/lisensi/penjaga-lisensi.spec.ts` | Keputusan penjaganya, dengan Reflector palsu: gagal-terbuka, 403 yang menyebut kode fiturnya, hanya-baca tidak mematikan fitur. |
| `src/lisensi/penjaga-crm-wa.spec.ts` | Bahwa dekoratornya benar-benar **terpasang di controller yang sungguhan** — Reflector-nya asli, metadatanya dibaca dari kelas & metode CRM/WhatsApp yang nyata. Gagal kalau dekoratornya hilang, pindah metode, atau kodenya salah tulis. Di dalamnya ada tes khusus **webhook Meta tetap terbuka di kunci apa pun**, dan tes bahwa kelas webhook tidak pernah disatukan dengan kelas yang dijaga. Kalau yang itu gagal: cabut dekoratornya, jangan diakali. |
| `src/lisensi/penjaga-terjadwal.spec.ts` | Penegakan di **pekerjaan terjadwal**. Yang dijaganya: fitur ada → jalan, dicabut → dilewati, tanpa kunci → jalan, kunci rusak → jalan (dan dilaporkan sebagai hanya-baca, bukan sebagai fitur hilang), tenggang → jalan penuh, hanya-baca → pengiriman berhenti tapi sinkron tidak, pemeriksaannya melempar galat → penjadwal **tetap hidup**, penjaga tidak tersuntik → jalan, 200 putaran dilewati tetap **satu baris log**, dan opt-out WA tetap dicatat walau balasannya tidak dikirim. `prisma` palsunya **melempar begitu disentuh** — itu cara membuktikan antreannya tidak rusak, bukan cuma "tidak ditandai gagal". Plus satu tes yang membaca `design:paramtypes` keenam service: separuh wiring-nya, separuh yang lain ada di `lisensi.module.spec.ts`. |

Dekorator `@ButuhSalahSatuFitur` diuji di `penjaga-crm-wa.spec.ts` — tempat yang sama dengan
dekorator lain yang terpasang di controller sungguhan. Di dalamnya ada tes **"dua dekorator tidak
tertukar"**: dua kelas contoh dengan daftar kode yang identik, jadi yang membedakan hasilnya cuma
dekoratornya. Kalau yang itu gagal, `@ButuhFitur` dan `@ButuhSalahSatuFitur` sudah tertukar di
suatu tempat, dan gejalanya di produksi adalah klien yang sudah bayar kena 403.

Batasnya punya dua berkas tes di backend, dan keduanya menjaga hal yang berbeda:

| Berkas | Yang dijaganya |
|---|---|
| `src/lisensi/batas.spec.ts` | Keputusannya: gagal-terbuka, `0` ≠ `null`, pas-di-batas ditolak, dan `where` yang dikirim ke Prisma (`isActive: true`, model `companyBranch` — `prisma.branch.count` tidak boleh pernah dipanggil). |
| `src/lisensi/batas-terpasang.spec.ts` | Bahwa keputusan itu benar-benar **dipanggil** di `UsersService.create` & `CompanyBranchesService.create`, sesudah pemeriksaan wewenang, dan **tidak** dipanggil di `setStatus`/`update`. Tanpa tes ini, pemeriksanya bisa sempurna tapi tidak pernah dijalankan siapa pun. |

Hitungannya juga pernah **diuji ke MySQL sungguhan** sekali (26 Sep 2026, database sekali pakai
`pos_uji_batas`): 5 baris `users` dengan 2 yang sudah keluar → dihitung 3; 3 `company_branches`
dengan 1 ditutup → dihitung 2; 5 titik Peta Cuan di tabel `branches` → diabaikan; dan penolakan
tidak mengubah satu baris pun. Angkanya dicocokkan ke `SELECT COUNT(*) … WHERE is_active=1`
langsung. Tes DB-nya tidak ikut masuk repo — `npm test` harus tetap jalan tanpa database.

Tes lisensinya meniru kasus uji di sisi penerbit (`test/lisensi.test.mjs` di repo qendali), jadi
kalau suatu hari dua sisi berbeda, ketahuannya dari tes yang gagal — bukan dari klien yang
menelepon. Pasangan kunci untuk tes dibuat di dalam tes itu sendiri; kunci privat penerbit tidak
pernah masuk repo mana pun.
