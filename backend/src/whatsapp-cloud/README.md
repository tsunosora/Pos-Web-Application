# WhatsApp Cloud API (resmi Meta) — Modul `whatsapp-cloud`

Modul ini memakai **WhatsApp Business Cloud API resmi dari Meta** (Graph API, default
**v23.0**). **TERPISAH** dari modul lama `src/whatsapp/` (berbasis `whatsapp-web.js`,
tidak resmi, `WHATSAPP_ENABLED=false`). Jangan campur keduanya.

Referensi resmi: https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started

## Ruang lingkup rilis pertama (Fase 0–4)

Inbox multi-agen + sinkron chat ⇄ Lead/Customer. Broadcast, template lanjutan, dan
reminder POS menyusul (lihat `.hermes/plans/2026-07-21_162915-whatsapp-crm-wa-business-api.md`).

## Model: PER CABANG

Tiap cabang punya nomor WABA sendiri. `phone_number_id` & `waba_id` disimpan **per
`WaChannel` di database**, BUKAN di `.env`. Satu token System User level-Business
mengelola semua nomor di bawah Business yang sama, jadi cukup **satu** webhook.

## Prasyarat (langkah manual di Meta — lakukan sekali)

1. Buat **Meta Business** (business.facebook.com) + **WhatsApp Business Account (WABA)**.
2. Tambah & verifikasi nomor telepon tiap cabang → catat `PHONE_NUMBER_ID` & `WABA_ID`
   masing-masing (nanti dimasukkan ke `WaChannel` lewat UI/settings, bukan env).
3. Buat **App** (type: Business) di developers.facebook.com → tambah produk **WhatsApp**.
4. Buat **System User** level-Business dengan **permanent access token**, scope:
   `whatsapp_business_messaging`, `whatsapp_business_management`, `business_management`
   (sesuai dok resmi Meta). Assign asset WABA ke user ini. → isi `WA_ACCESS_TOKEN`.
5. Salin **App Secret** (App → Settings → Basic) → isi `WA_APP_SECRET`
   (untuk verifikasi signature `X-Hub-Signature-256`).
6. Buat string acak sendiri untuk `WA_VERIFY_TOKEN` (mis. `openssl rand -hex 16`).
7. Set **Webhook** di App → WhatsApp → Configuration:
   - Callback URL: `https://<domain-publik>/whatsapp/webhook`
   - Verify token: nilai `WA_VERIFY_TOKEN`
   - Subscribe field: **messages**.
8. Isi semua nilai di `backend/.env` (JANGAN commit). Set `WA_CLOUD_ENABLED="true"` saat siap.

## Env (lihat `.env.example`)

```
WA_CLOUD_ENABLED, WA_GRAPH_VERSION, WA_ACCESS_TOKEN, WA_APP_SECRET,
WA_VERIFY_TOKEN, WA_BROADCAST_RATE_PER_SEC
```

## Catatan penting

- **Jendela layanan 24 jam:** di luar 24 jam sejak pesan masuk terakhir, HANYA boleh
  kirim **template** yang sudah di-approve Meta (bukan teks bebas).
- **Signature webhook** butuh **raw body** (bukan hasil `JSON.stringify` payload).
- **Telepon:** pakai `src/common/utils/phone.util.ts` (`toWaPhone` → `62...`,
  `toLeadKey` → `81...` untuk cocokkan ke `Lead.phoneNormalized`).
- **Online-only:** fitur ini butuh internet + webhook publik; tidak termasuk jalur
  offline-sync desktop.
- Setiap model Prisma baru wajib didaftarkan ke `src/backup/backup.service.ts`.

## Troubleshoot ringkas

- **401 saat kirim:** token kadaluarsa/salah scope, atau nomor belum di-assign ke System User.
- **Signature webhook gagal:** pastikan raw body aktif & `WA_APP_SECRET` benar.
- **Template ditolak:** cek kategori (MARKETING/UTILITY/AUTHENTICATION) & isi; lihat alasan di dashboard Meta.
- **Rate limit / quality turun:** kurangi laju broadcast (`WA_BROADCAST_RATE_PER_SEC`), hormati opt-out.

---

## Alur Penggunaan (Setup → Fitur → Peran)

> Versi ringkas juga tersedia in-app: tombol **Panduan (?)** di header Inbox.

### Peran & akses
```
 Fitur / Halaman          │ Owner/Admin │ Marketing │  CS  │ Operator
 ─────────────────────────┼─────────────┼───────────┼──────┼─────────
 Pengaturan Channel       │     ✅      │    ✖      │  ✖   │   ✖
 Template Meta            │     ✅      │    ✅     │  ✖   │   ✖
 Broadcast                │     ✅      │    ✅     │  ✖   │   ✖
 Balasan Otomatis         │     ✅      │    ✅     │  ✖   │   ✖
 Reminder POS             │     ✅      │    ✅     │  ✖   │   ✖
 Analitik                 │     ✅      │    ✖      │  ✖   │   ✖
 Inbox Chat (balas)       │     ✅      │    ✅     │  ✅  │   ✖
```
Guard backend: `ADMIN_ROLES` (Owner/Admin) · `TEMPLATE_ROLES` (+Marketing) · `INBOX_ROLES` (+CS).

### Setup awal (sekali — Owner/Admin)
```
 Meta Business + App ─▶ WABA + nomor tiap cabang ─▶ System User token permanen
   ─▶ isi .env (WA_ACCESS_TOKEN/APP_SECRET/VERIFY_TOKEN, WA_CLOUD_ENABLED=true) ─▶ restart
   ─▶ set Webhook Meta /whatsapp/webhook (field: messages)
   ─▶ UI "Pengaturan Channel": daftar phone_number_id per cabang ─▶ "Cek koneksi" ✅
```

### Alur pesan masuk (otomatis)
```
 Pelanggan ─▶ Meta ─▶ [webhook cek tanda tangan] ─▶ route cabang (phone_number_id)
   ─▶ simpan pesan (idempoten) ─▶ tautkan Lead / AUTO-CREATE Lead WHATSAPP
   ─▶ percakapan OPEN (24 jam) + auto-reply ─▶ muncul di INBOX ─▶ agen balas
```

### Alur tiap fitur
```
 Inbox      : pilih chat ─▶ Ambil ─▶ (dalam 24 jam) teks / (luar) template ─▶ Selesai
 Template   : buat draf ─▶ Submit Meta ─▶ Sinkron ─▶ APPROVED/REJECTED
 Broadcast  : template APPROVED + segmen (opt-out dikecualikan) + variabel ─▶ preview ─▶ (jadwal) ─▶ kirim ⏸▶✖
 Auto-reply : KEYWORD ─▶ GREETING(chat baru) ─▶ DEFAULT ; "STOP" = opt-out ; skip bila agen aktif <30mnt
 Reminder   : ORDER_READY (saat SIAP AMBIL) · PAYMENT_DUE · FOLLOWUP_DUE (cron 15mnt) — template, dedup
 Analitik   : rentang 7/30/90 hari + filter channel ─▶ kartu metrik + grafik harian
```

### Ingat
- Di luar **jendela 24 jam** hanya boleh **template** APPROVED.
- Kontak **opt-out** (balas STOP) otomatis dilewati di semua fitur.
- Broadcast & reminder wajib template ber-status **APPROVED**.
