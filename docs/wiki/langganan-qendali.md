# 💳 Langganan (Pengaturan → Langganan)

Halaman **Pengaturan → Langganan** membuat pemilik toko bisa mengurus langganannya sendiri dari
dalam aplikasi: lihat paket, bayar tagihan, ganti paket, pasang add-on, dan pasang domain sendiri.
Tujuannya supaya klien cuma kenal **satu dasbor** — dasbor aplikasinya — tanpa perlu membuka
qendali.com.

Kontrak API-nya ada di repo website qendali.com: `docs/lisensi.md` → **"API untuk aplikasi:
`/api/aplikasi/*`"**. Halaman ini menjelaskan **sisi aplikasi**.

::: tip Singkatnya
Tanpa `QENDALI_LISENSI_TOKEN`, halaman ini **tidak error** — dia cuma bilang instalasi ini belum
tersambung ke Qendali, dan tidak ada yang perlu dilakukan. Itu keadaan normal untuk instalasi lama
dan lingkungan pengembangan.
:::

---

## Untuk pemilik toko

Menunya cuma muncul untuk peran **Owner / Pemilik / SuperAdmin**. Kasir, admin, manajer, dan kepala
produksi tidak melihatnya — dan kalaupun mereka tahu alamatnya, server menolak.

### Yang bisa kamu lakukan sendiri

| Bagian | Isinya |
|---|---|
| **Paket sekarang** | Nama paket, harga per bulan, status, dibayar sampai kapan, berapa fitur yang aktif. |
| **Tagihan** | Tagihan yang belum dibayar, tombol **"Saya sudah transfer"** + kolom catatan, dan riwayat singkat. |
| **Ubah paket** | Kartu tiap paket dengan harga dan **akibatnya** — berapa yang harus dibayar, mulai kapan berlaku, apa yang ikut hilang. |
| **Tambahan (add-on)** | Pasang atau lepas add-on, mis. WhatsApp resmi. |
| **Perubahan yang sedang berjalan** | Apa yang sudah kamu ajukan, statusnya, dan tombol membatalkannya. |
| **Alamat aplikasi** | Alamat utama, dan (kalau paketmu memuatnya) pemasangan domain sendiri. |

### Tiga hal yang sering disalahpahami

**1. "Saya sudah transfer" TIDAK membuat tagihan lunas.**
Tombol itu cuma memberi tahu Qendali bahwa kamu sudah mengirim uang; statusnya pindah ke
*Menunggu dicek Qendali*. Yang menandai **lunas** tetap Qendali, setelah melihat mutasi banknya.
Ini disengaja — kalau aplikasi boleh melunaskan tagihannya sendiri, langganan bisa diperpanjang
tanpa pernah membayar.

**2. Naik paket berlaku SETELAH tagihan selisihnya lunas.**
Saat kamu memilih paket yang lebih tinggi, Qendali membuat tagihan berisi selisih prorata untuk
sisa masa yang sudah kamu bayar. Fiturnya baru menyala begitu tagihan itu dinyatakan lunas. Jadi
menekan tombolnya **tidak** langsung menarik uang dan **tidak** langsung mengubah paket.

**3. Turun paket berlaku di akhir masa yang sudah dibayar.**
Tidak ada pengembalian uang untuk sisa masa berjalan, dan fitur yang hilang baru hilang di tanggal
itu. Selama belum berlaku, perubahannya masih bisa dibatalkan.

### Domain sendiri

Kalau paketmu memuat fitur `domain.sendiri` (Produksi, Bisnis, Vendor Event), kamu bisa memakai
domain sendiri, mis. `kasir.tokokamu.com`.

1. Beli domainnya di penyedia mana pun — **Qendali tidak menjual domain**.
2. Isi nama domainnya di halaman ini.
3. Pasang satu record **CNAME** sesuai petunjuk yang muncul, di panel DNS penyedia domainmu.
4. Tekan **Periksa DNS**. Kalau sudah cocok, statusnya berpindah ke *menyiapkan*, lalu *aktif*
   setelah Qendali memasangnya.

Domain utama (mis. `tokokamu.com` tanpa awalan) ditolak — pakai `kasir.tokokamu.com` atau
sejenisnya. Kalau paketmu belum memuat fitur itu, halaman menjelaskannya apa adanya dan kamu tetap
memakai subdomain `.qendali.com`.

### Kalau qendali.com sedang tidak bisa dihubungi

Halaman ini akan bilang begitu, apa adanya. **Kasir tetap jalan seperti biasa** — hak akses
diverifikasi dari kunci lisensi yang sudah tersimpan di server, secara lokal, tanpa jaringan.
Langgananmu juga tidak berubah apa-apa.

---

## Untuk pemasang

### Env

**Tidak ada env baru.** Halaman ini memakai **persis** dua env yang sudah dipakai penyegaran
lisensi (lihat [Lisensi Qendali](lisensi-qendali.md)):

| Env | Bawaan | Gunanya di sini |
|---|---|---|
| `QENDALI_LISENSI_TOKEN` | *(kosong)* | Token instalasi. **Kosong = halaman langganan tampil sebagai "belum tersambung".** |
| `QENDALI_LISENSI_URL` | `https://qendali.com` | Alamat penerbit. Diisi lain cuma untuk pengembangan. |

Sengaja tidak dibuatkan pasangan env sendiri: kalau ada dua, suatu hari keduanya diisi berbeda dan
gejalanya membingungkan — lisensi tersegarkan tapi halaman langganan bilang tidak tersambung.

::: warning Token instalasi setara kunci
Pemegang token bisa mengganti paket dan menyatakan tagihan sudah ditransfer. Simpan di `.env`
server, jangan pernah di berkas yang ikut ter-commit, dan **jangan pernah kirim ke browser**.
:::

### Jalur datanya

```
Browser (halaman Langganan)
  └─ frontend/src/lib/api/langganan.ts     → memanggil BACKEND POS, bukan qendali.com
      └─ backend/src/langganan/langganan.controller.ts   (JwtAuthGuard + OwnerGuard)
          └─ backend/src/langganan/langganan.service.ts  ← SATU-SATUNYA pembaca token
              └─ <QENDALI_LISENSI_URL>/api/aplikasi/*    dengan Authorization: Bearer <token>
```

Token **tidak pernah** melewati browser. Frontend memanggil backend sendiri; backend yang
menempelkan token ke permintaan keluar. Kalau suatu hari ada yang memindahkan panggilan ini
langsung ke browser supaya "lebih singkat", token itu harus ikut — dan saat itu juga siapa pun yang
membuka DevTools bisa mengubah langganan orang.

| Jalur di aplikasi | Diteruskan ke |
|---|---|
| `GET /langganan` | `GET /api/aplikasi/langganan` |
| `POST /langganan/perubahan` | `POST /api/aplikasi/perubahan` |
| `DELETE /langganan/perubahan` | `DELETE /api/aplikasi/perubahan` |
| `POST /langganan/tagihan` | `POST /api/aplikasi/tagihan` |
| `GET /langganan/domain` | `GET /api/aplikasi/domain` |
| `PUT /langganan/domain` | `PUT /api/aplikasi/domain` |
| `POST /langganan/domain/periksa` | `POST /api/aplikasi/domain` |
| `DELETE /langganan/domain` | `DELETE /api/aplikasi/domain` |

### Aturan yang tidak boleh dilonggarkan

- **`OwnerGuard`, bukan `ManagerGuard`.** Endpoint ini bisa menerbitkan tagihan. Manajer dan kepala
  produksi tidak ada urusan dengan paket dan tagihan.
- **Galat penerbit diteruskan apa adanya** (kode status + `{salah, pesan}`). Terutama `409 ditolak`:
  `pesan`-nya ditulis di sisi penerbit untuk langsung dibaca pemilik toko. Jangan diterjemahkan
  ulang di sini — nanti ada dua versi kalimat yang lama-lama beda.
- **Aplikasi tidak menghitung apa pun.** Selisih prorata, tanggal berlaku, alasan penolakan — semua
  datang matang dari penerbit sebagai `rincian`, `jumlah`, `berlakuPada`, `alasan`.
- **`/langganan/**` dikecualikan dari mode hanya-baca** (`lisensi/hanya-baca.guard.ts`). Lisensi yang
  habis masa membuat aplikasi hanya-baca, dan halaman inilah jalan keluarnya: bayar tagihan lalu
  segarkan kunci. Memblokirnya berarti mengunci orang di luar pintu yang kuncinya ada di dalam.
- **Penyegaran kunci otomatis** dipanggil backend begitu sebuah perubahan berstatus `diterapkan`,
  supaya fitur barunya tidak menunggu penyegaran harian 03.37. Ada juga tombol **Segarkan lisensi**
  di halaman, untuk kasus "Qendali baru menandai tagihanku lunas".

### Tes

`backend/src/langganan/langganan.spec.ts` — 28 tes, tanpa jaringan (`fetch` dipalsukan). Yang dijaga:
token tidak pernah ikut ke jawaban (termasuk jawaban galat), 409 diteruskan apa adanya, keadaan
"belum tersambung" tidak melempar galat, dan non-Owner ditolak.

### Yang belum ada

- **Belum ada tombol berhenti berlangganan.** Memang tidak disediakan penerbit lewat API ini —
  klien harus menghubungi Qendali. Disengaja.
- **Pemasangan domain di Cloudflare masih manual** di sisi Qendali setelah CNAME cocok; halaman ini
  cuma menampilkan statusnya.
- **Belum ada gerbang pembayaran.** Pembayaran masih transfer manual lalu dicek Qendali.
