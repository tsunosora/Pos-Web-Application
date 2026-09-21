# 💬 WhatsApp CRM (Cloud API)

![Inbox WhatsApp](images/whatsapp.webp)

Ini modul terbesar di PosPro setelah kasir: **83 endpoint** untuk mengubah chat
WhatsApp menjadi pekerjaan yang tercatat. Bukan sekadar kirim pesan — chat masuk
menjadi lead, lead menjadi order, dan ongkos iklan bisa dihitung per lead nyata.

![Inbox WhatsApp](images/whatsapp.webp)

## Bedanya dengan bot WA lama

Ada dua modul WhatsApp di kode:

| Modul | Jalur | Status |
|---|---|---|
| **WhatsApp Cloud API** (resmi Meta) | `/whatsapp/conversations`, `/whatsapp/broadcasts`, … | yang dipakai sekarang |
| Bot lama berbasis sesi QR | `/whatsapp/status`, `/whatsapp/send`, `/whatsapp/groups` | peninggalan, untuk kirim ke **grup** |

Bot lama masih terpasang karena Cloud API resmi **tidak bisa mengirim ke grup**,
sementara rekap shift dan laporan harian dikirim ke grup pemilik. Catatan
keamanannya ada di [Model Akses & Keamanan](keamanan-akses.md).

## Inbox chat

Halaman **`/crm/whatsapp`**. Percakapan (`wa_conversations`), kontak
(`wa_contacts`), dan pesan (`wa_messages`) tersimpan di database sendiri, jadi
riwayat tetap ada walau aplikasi WhatsApp di HP dibuka-tutup.

- Pesan masuk lewat **webhook** `POST /whatsapp/webhook` (wajib lewat domain
  `api.*` yang publik).
- Webhook untuk satu nomor **diproses berurutan**. Meta kadang mengirim
  beberapa kejadian paralel untuk kontak yang sama; tanpa pengurutan, dua
  proses saling rebut baris yang sama dan pesannya hilang.
- Lampiran gambar/dokumen diunduh ke `WA_MEDIA_DIR` dan dibersihkan otomatis
  setelah `WA_MEDIA_RETENTION_DAYS` hari.
- `WA_AUTO_CREATE_LEAD` menentukan apakah chat dari nomor baru langsung menjadi
  lead di [CRM](crm.md).

Berpindah ke percakapan lain saat balasan atau lampiran masih terkirim tidak
lagi mengosongkan draf percakapan yang baru dibuka atau memasukkan pesan ke
percakapan yang salah (sejak 22 September 2026). Pengingat follow-up tidak
dikirim untuk lead yang sudah ditutup.

## Pesan gagal terkirim dan alasannya

![Inbox WhatsApp: template yang gagal terkirim diberi tanda merah beserta alasannya dan kode error Meta](images/wa-9-gagal-kirim.webp)

Tanda di pojok gelembung pesan keluar mengikuti status dari Meta dan berganti
**seketika** (tanpa menunggu muat ulang):

| Tanda | Arti |
|---|---|
| 🕒 jam | masih menunggu Meta |
| ✓ / ✓✓ | terkirim / sampai di HP pelanggan |
| ✓✓ biru | sudah dibaca |
| ⓘ merah + keterangan | **gagal** — alasannya ditulis di bawah gelembung |

Keterangan gagal diterjemahkan dari kode error Meta (`frontend/src/lib/wa-error.ts`):

| Kode | Artinya | Yang dilakukan |
|---|---|---|
| `131042` | masalah **pembayaran** akun WhatsApp Business | bereskan metode bayar di WhatsApp Manager; selama belum beres, **template** tidak terkirim (chat biasa dalam 24 jam tetap jalan) |
| `131047` | sudah lewat 24 jam sejak pelanggan terakhir membalas | kirim **template** |
| `131026` | nomor tidak bisa menerima pesan | cek nomor / pelanggan belum pakai WhatsApp |
| `131049` | ditahan Meta: pelanggan terlalu banyak menerima pesan pemasaran | coba lain waktu |
| `131056` | terlalu banyak pesan ke nomor yang sama dalam waktu singkat | tunggu sebentar |
| `131031` | akun WhatsApp Business dikunci Meta | hubungi dukungan Meta |
| `132000`–`132016` | isian template tidak cocok / template dijeda / dinonaktifkan | periksa template di WhatsApp Manager |

Kode lain ditampilkan apa adanya dari pesan Meta. Status aslinya tersimpan di
`wa_messages.status`, `error_code`, dan `error_message` — periksa di sana dulu
sebelum menduga ada kerusakan aplikasi.

## Broadcast

Halaman **`/crm/whatsapp/broadcast`**. Alurnya sengaja bertahap supaya tidak
ada blast yang tidak sengaja:

1. Pilih penerima — per segmen atau daftar nomor.
2. **Pratinjau** (`POST /whatsapp/broadcasts/preview`): berapa penerima,
   siapa saja, template apa.
3. Jalankan (`/run`), bisa **dijeda** (`/pause`) di tengah jalan.
4. Status per penerima tercatat di `wa_broadcast_recipients` — terkirim,
   gagal, atau dilewati.

Kecepatan kirim dibatasi `WA_BROADCAST_RATE_PER_SEC` supaya tidak dianggap spam
oleh Meta.

Sejak 22 September 2026 satu broadcast hanya punya **satu** proses kirim: jeda lalu
lanjutkan cepat-cepat tidak lagi membuat sisa penerima menerima pesan dua kali.
Bila server restart saat broadcast berjalan, statusnya menjadi **Dijeda** —
lanjutkan sendiri dari daftar broadcast setelah memeriksa hasilnya.

### Langkah demi langkah

#### 1. Daftar broadcast

![Daftar broadcast beserta statusnya: selesai dan draf](images/bc-1-daftar.webp)

Semua kampanye terkumpul di sini beserta statusnya. Yang sudah jalan tidak bisa
diubah lagi — hanya dilihat hasilnya.

#### 2. Susun kampanye

![Form broadcast: nama kampanye, channel, template APPROVED, dan pemetaan variabel](images/bc-2-buat.webp)

Yang dipilih: nomor pengirim, **template yang sudah disetujui Meta**, lalu nilai
untuk tiap variabel template (`{{1}}`, `{{2}}`, …). Variabel bisa diisi teks
tetap atau diambil dari data kontak. Penerima ditentukan dengan tiga cara:
**semua (segmen)**, **pilih kontak** satu per satu, atau **impor nomor** dari
CSV/tempelan.

#### 3. Hitung penerima dulu

![Tombol Hitung penerima menampilkan jumlahnya: 14 kontak](images/bc-3-hitung.webp)

Tombol **Hitung penerima** memperlihatkan berapa kontak yang akan menerima
(di contoh ini 14), termasuk memotong kontak yang sudah *opt-out*. Langkah ini
disengaja: broadcast yang terlanjur terkirim tidak bisa ditarik kembali.

#### 4. Simpan draf dulu, kirim belakangan

![Kampanye tersimpan sebagai draf](images/bc-4-draf.webp)

Kampanye bisa disimpan sebagai **draf** atau dijadwalkan.

#### 5. Hasil per penerima

![Rincian penerima beserta status kirimnya](images/bc-5-hasil.webp)

Setelah dijalankan, status tiap penerima tercatat satu per satu — terkirim,
gagal, atau dilewati karena opt-out.

#### 6. Template yang dipakai

![Daftar template Meta beserta status persetujuannya](images/bc-6-template.webp)

Template harus lolos persetujuan Meta sebelum bisa dipakai. Di luar jendela
24 jam sejak pesan terakhir pelanggan, hanya template yang boleh dikirim —
itulah sebabnya broadcast selalu berbasis template.

## Balasan otomatis & pesan cepat

![Form aturan balasan otomatis: pemicu, channel, teks balasan, dan prioritas](images/wa-1b-aturan.webp)

Aturannya **rule-based, tanpa AI**, dan dievaluasi saat pesan masuk selama
percakapan masih dalam jendela 24 jam. Urutan pemeriksaannya:

**kata kunci → salam (chat baru) → default / di luar jam**

Dua pagar penting tertulis langsung di halamannya: balasan otomatis
**dilewati** bila agen manusia baru saja membalas (<30 menit) — supaya bot
tidak menimpa percakapan yang sedang berjalan — dan pesan **STOP** dari
pelanggan otomatis meng-opt-out kontak itu.

Tiap aturan memilih pemicu (mis. *Salam pembuka*), channel mana yang dipakai,
teks balasannya (boleh disalin dari template), dan **prioritas** bila ada
beberapa aturan yang cocok sekaligus.

![Halaman Pesan Cepat dengan penjelasan pemakaian pintasan](images/wa-2-pesancepat.webp)

**Pesan Cepat** berbeda dari template Meta: ini daftar balasan milik sendiri
yang dipanggil CS di kotak chat dengan mengetik `/pintasan`. Karena berupa
teks bebas, hanya sah dikirim selama percakapan masih dalam 24 jam.


| Fitur | Halaman | Tabel |
|---|---|---|
| Balasan otomatis (kata kunci → jawaban) | `/crm/whatsapp/auto-reply` | `wa_auto_reply_rules` |
| Pesan cepat (jawaban siap pakai untuk CS) | `/crm/whatsapp/quick-replies` | `wa_quick_replies` |
| Template resmi Meta | `/crm/whatsapp/templates` | `wa_templates` |
| Katalog produk di WhatsApp | `/crm/whatsapp/catalog` | dari katalog produk |

**Template Meta** perlu dipahami: di luar jendela 24 jam sejak pesan terakhir
pelanggan, WhatsApp hanya mengizinkan template yang sudah disetujui Meta. Karena
itu broadcast memakai template, sementara balasan di dalam percakapan aktif
bisa berupa teks bebas.

## Reminder POS

![Halaman Reminder Otomatis dengan daftar event POS](images/wa-3-reminder.webp)

Reminder mengirim template otomatis saat sebuah **event POS** terjadi —
misalnya pesanan siap diambil. Tiga syaratnya disebut di halaman itu juga:
template harus berstatus **APPROVED**, channel harus aktif, dan kontak yang
sudah opt-out otomatis dilewati. Tiap event hanya dikirim **sekali per
transaksi/follow-up**, jadi pelanggan tidak menerima pesan berulang.


Halaman **`/crm/whatsapp/reminders`** (Manajer+). Menghubungkan kejadian di
kasir dengan pesan otomatis: pesanan siap diambil, DP jatuh tempo, ucapan
terima kasih. Konfigurasinya di `wa_reminder_configs`, dan setiap pengiriman
dicatat di `wa_reminder_logs` supaya tidak terkirim dua kali.

Pengingat **follow-up / tagihan jatuh tempo** (bila diaktifkan) sejak 22 September
2026: hanya follow-up yang jatuh tempo 7 hari terakhir, satu kali percobaan per
follow-up (yang gagal tidak dikirim ulang tiap 15 menit), dan variabel ke-2 template
berisi **tanggal jatuh tempo** — catatan internal follow-up tidak pernah dikirim ke
pelanggan. Pakai `{{1}}` = nama pelanggan dan `{{2}}` = tanggal saat membuat template.

## QR Chat

![Halaman QR Chat dengan panel pembuatan QR](images/wa-4-qr.webp)

QR Chat membuat kode yang begitu dipindai langsung membuka WhatsApp dengan
pesan pembuka yang sudah terisi. Berguna ditempel di meja kasir, spanduk, atau
kemasan — dan karena tiap QR bisa dibedakan, ketahuan pesan datang dari media
yang mana.


Halaman **`/crm/whatsapp/qr`**. Membuat tautan/QR yang begitu dipindai langsung
membuka chat dengan pesan pembuka terisi. Tiap QR punya kode sendiri
(`wa_qr_links`), jadi bisa diketahui QR mana yang benar-benar mendatangkan chat
— berguna untuk membandingkan spanduk, brosur, atau kemasan.

## Analitik

![Analitik WhatsApp: pesan masuk/keluar, kontak, lead, estimasi biaya API, dan kecepatan balas CS](images/wa-5-analitik.webp)

Tiga lapis angka dalam satu halaman:

1. **Volume** — pesan masuk & keluar (berikut yang gagal), percakapan baru,
   total kontak beserta jumlah opt-out, lead dari WA, dan broadcast.
2. **Estimasi biaya WhatsApp API** — mengikuti model harga per-pesan Meta:
   pesan *template* ditagih per kategori (Marketing / Utilitas / Autentikasi)
   sementara balasan *layanan* dalam jendela 24 jam gratis. Tarif per pesan
   diisi sendiri sesuai akun, lalu sistem mengalikannya dengan volume nyata.
3. **Kecepatan balas CS** — *First Response Time* dihitung sampai balasan
   **manusia** pertama; auto-reply tidak dihitung, dan metrik Desainer,
   Operator, serta Owner/Manajer dipisah agar angka CS tetap murni.


Halaman **`/crm/whatsapp/analytics`** (Manajer+): jumlah percakapan, kecepatan
balas CS, dan sebaran jam sibuk. Angka kecepatan balas inilah yang dipakai di
[Leaderboard](leaderboard.md) kolom "Balas WA".

Sejak 22 September 2026 grafik harian dihitung **per hari WIB**. Dulu per hari
UTC: pesan pukul 00.00–06.59 masuk ke hari sebelumnya dan rentang "dari" baru
dimulai pukul 07.00.

## Konfigurasi

![Pengaturan channel & penyimpanan media WhatsApp](images/wa-7-konfigurasi.webp)

Selain kredensial channel, halaman pengaturan mengurus **penyimpanan media**:
foto dan berkas yang masuk lewat WhatsApp menumpuk di server. Pembersihan
otomatis bisa dimatikan (media disimpan sampai dihapus manual) atau dijalankan
lewat tombol di halaman itu — dengan pengingat untuk memantau sisa disk.

![Halaman Katalog Produk WhatsApp Business](images/wa-6-katalog.webp)

**Katalog** menghubungkan produk ke katalog resmi WhatsApp Business (Meta
Commerce). Produk tersimpan di katalog WABA, dan URL gambarnya harus bisa
diakses publik. Halaman ini hanya berfungsi bila katalog sudah terhubung di
Commerce Manager — di lingkungan demo dokumentasi ini sengaja belum
dihubungkan.

![Halaman Bot WhatsApp lama di menu Pengaturan](images/wa-8-botlama.webp)

Menu **Pengaturan → Bot WhatsApp** adalah konfigurasi bot generasi lama
(berbasis nomor pribadi & grup). Keduanya bisa hidup berdampingan; lihat
bagian *Bedanya dengan bot WA lama* di awal halaman ini.


| Variabel | Untuk |
|---|---|
| `WA_CLOUD_ENABLED` | saklar utama modul |
| `WA_ACCESS_TOKEN`, `WA_APP_ID`, `WA_APP_SECRET` | kredensial aplikasi Meta |
| `WA_VERIFY_TOKEN` | kata sandi verifikasi webhook |
| `WA_GRAPH_VERSION` | versi Graph API |
| `WA_BROADCAST_RATE_PER_SEC` | batas kecepatan broadcast |
| `WA_AUTO_CREATE_LEAD` | chat baru otomatis jadi lead |
| `WA_MEDIA_DIR`, `WA_MEDIA_RETENTION_DAYS` | tempat & umur simpan lampiran |

Nomor dan kanal yang aktif disimpan di `wa_channels` dan diatur di
**`/crm/whatsapp/settings`**.
