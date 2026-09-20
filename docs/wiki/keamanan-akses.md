# 🔐 Model Akses & Keamanan

Empat cara berbeda seseorang bisa mengakses PosPro. Memahami keempatnya penting
sebelum menyimpulkan sesuatu "aman" atau "bocor".

## 1. Login email + sandi (JWT)

Cara utama. Sandi disimpan sebagai hash bcrypt, dan setelah login klien memegang
**token JWT** yang dikirim di setiap permintaan. Endpoint yang dijaga
`JwtAuthGuard` menolak permintaan tanpa token dengan HTTP 401.

Peran pengguna dibaca dari database pada **setiap permintaan**, bukan dari isi
token — jadi menurunkan peran seseorang langsung berlaku tanpa menunggu
tokennya kedaluwarsa.

## 2. Pembatasan peran (RolesGuard)

Di atas login, sebagian endpoint dibatasi peran tertentu dengan `@Roles(...)`,
misalnya kartu HR yang hanya untuk Owner dan Manajer. Pencocokan namanya
tidak peduli huruf besar/kecil, tapi **harus sama persis** — `MANAJER` cocok,
`MANAGER SENIOR` tidak.

Terpisah dari itu, `roles.menu_access` mengatur **menu yang terlihat**. Perlu
diingat: menyembunyikan menu bukan mengamankan data. Pembatasan yang sungguhan
adalah `@Roles` di backend.

## 3. PIN untuk papan kerja

`/produksi`, `/cetak`, dan `/so-designer` tidak memakai login email, karena satu
perangkat dipakai bergantian sepanjang hari di ruang produksi. Yang dipakai:

| PIN | Disimpan di | Membuktikan |
|---|---|---|
| PIN cabang | `branch_settings.operator_pin` | perangkat ini berada di cabang tersebut |
| PIN pribadi | `designers.pin` | siapa orang yang mengerjakan |

Konsekuensinya: **endpoint papan kerja sengaja tanpa penjaga login**, dan
verifikasi terjadi lewat PIN. Ini pertukaran yang disadari — kalau papan
produksi menuntut login penuh, dalam praktiknya staf akan berbagi satu akun,
yang justru lebih buruk untuk penelusuran.

## 4. Tautan publik & webhook

Halaman penilaian pelanggan, opname lapangan, landing page, artikel, dan webhook
Meta harus bisa diakses tanpa akun. Yang menjaganya adalah **token acak panjang
sekali pakai** (untuk tautan) dan **verifikasi tanda tangan/verify token** (untuk
webhook).

---

## Audit endpoint tanpa penjaga login

Kondisi per **20 September 2026**: dari **580 endpoint**, **81 tanpa
`JwtAuthGuard`**. Daftar terbaru selalu bisa dibangkitkan ulang —
lihat [Referensi Endpoint](referensi-endpoint.md).

| Kelompok | Terbuka | Alasannya |
|---|---:|---|
| `ProductionController` | 21/28 | papan produksi ber-PIN |
| `SalesOrdersPublicController` | 12/12 | portal desainer ber-PIN |
| `WhatsappController` (bot lama) | 0/10 | sudah diberi penjaga login (20 Sep 2026) — lihat di bawah |
| `PrintQueueController` | 8/8 | papan cetak ber-PIN |
| `TaskBoardPinController` | 6/6 | piket di papan kerja ber-PIN |
| `KpiPublicController` | 5/5 | papan TV & verifikasi PIN |
| `CsRatingPublicController` | 5/5 | tautan penilaian pelanggan |
| `StockOpnamePublicController` | 3/3 | tautan opname lapangan |
| `ProductsPublicController` | 3/3 | halaman produk publik `/p/[id]` |
| `DesignersPublicController` | 2/2 | daftar nama & verifikasi PIN |
| `WhatsappWebhookController` | 2/2 | webhook Meta (diverifikasi tanda tangan) |
| `SocialWebhookController` | 2/2 | webhook Instagram/Facebook |
| `ArticlesController` | 2/7 | artikel publik |
| `PrinterRelayController` | 2/9 | agen printer di PC kasir (memakai token sendiri) |
| `LandingController` | 1/5 | landing page publik |
| `SettingsController` | 1/7 | nama & tema toko untuk halaman login |
| `CompanyBranchesController` | 1/6 | daftar cabang untuk pemilih di halaman ber-PIN |
| `AuthController` | 1/2 | endpoint login itu sendiri |
| `HrPinController` | 1/1 | tukar PIN → tautan portal absensi |
| `CustomersPublicController` | 1/1 | pencarian nama pelanggan untuk form publik |
| `WebhookController` | 1/1 | webhook GitHub (diverifikasi `github_webhook_secret`) |
| `AppController` | 1/1 | health check |

### Catatan: bot WhatsApp lama

`WhatsappController` (modul `backend/src/whatsapp/`) adalah bot berbasis sesi QR
yang masih terpasang karena WhatsApp Cloud API resmi tidak bisa mengirim ke
**grup**, sementara rekap shift dikirim ke grup pemilik.

Modul ini sempat tidak memakai penjaga login — sisa dari versi awal aplikasi,
bukan keputusan yang disengaja. Sejak 20 September 2026 seluruh endpointnya
memakai `JwtAuthGuard` seperti modul lain.

## Hal lain yang patut diperhatikan

- **`/tv/leaderboard`** menampilkan omzet dan nama karyawan tanpa login,
  karena TV tidak bisa mengetik sandi. Sebaiknya hanya dapat diakses dari
  jaringan toko.
- **Kunci integrasi** (`HR_API_KEY`, `STAFF_KPI_API_KEY`) dipakai untuk
  panggilan antar-server dan tidak pernah dikirim ke browser.
- **Cabang** diambil dari header `X-Branch-Id` untuk akun Owner, sementara staf
  memakai cabang dari tokennya — header dari staf diabaikan, jadi tidak bisa
  dipakai untuk melihat cabang lain.
- **Repo ini publik.** Jangan pernah menaruh berkas `.env`, unggahan pelanggan,
  dokumen karyawan, atau daftar harga di dalamnya. Lihat
  [Setup Lokal](setup-lokal.md) untuk cara membuat data uji yang aman.
