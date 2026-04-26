# 🎨 Sales Order & Designer Portal

> Sistem **Sales Order (SO)** untuk alur kerja desainer → kasir/operator. Desainer (internal atau freelance) bisa input order baru via portal sendiri tanpa akun staff penuh, lalu broadcast ke grup WA internal supaya kasir lanjutkan ke invoice.

---

## 🎯 Use Case

- **Toko percetakan dengan desainer freelance** — desainer ambil order langsung dari customer (chat WA pribadi), input ke sistem, kirim ke grup WA internal supaya kasir tahu ada order baru yang harus diinvoice.
- **Workflow approval** — desainer bisa upload screenshot bukti ACC customer sebagai lampiran, lalu kasir bisa verifikasi sebelum invoice dibuat.
- **Multi-cabang dengan satu pool desainer** — desainer dengan `branchName` bisa bikin SO untuk cabang manapun, broadcast ke grup WA cabang yang sesuai.

---

## 🔐 Login Desainer (Portal Khusus)

Desainer tidak pakai login email/password — mereka punya **PIN** numerik.

**URL portal**: `/so-designer`

1. Buka URL → halaman pilih nama desainer dari list
2. Input PIN (default 4-6 digit, di-set admin di `/settings/designers`)
3. Sesi tersimpan di localStorage browser desainer (token PIN)
4. Akses dashboard → bisa buat/lihat/kirim SO

> Desainer tidak bisa akses fitur lain di sistem (POS, inventori, dll). Hanya portal SO.

---

## 📝 Buat Sales Order Baru

Desainer atau Admin bisa bikin SO. Halaman:
- **Desainer**: `/so-designer/new`
- **Admin/Kasir**: `/sales-orders/new`

### Form Fields

| Field | Wajib | Keterangan |
|---|---|---|
| **Nama Customer** | ✓ | Auto-suggest dari database. Kalau baru, otomatis tersimpan |
| **No. HP Customer** | – | Format `+62...` atau `08...` |
| **Alamat Customer** | – | Untuk pengiriman atau invoice |
| **Nama Desainer** | ✓ | Auto-fill dari sesi (kalau via portal) |
| **Catatan / Instruksi Cetak** | – | Spesifikasi: warna, finishing, bahan, dll |
| **Deadline** | – | Kapan order harus selesai |
| **Items** | ✓ (≥1) | Produk yang di-order, qty, ukuran (kalau AREA_BASED), catatan |
| **Screenshot Proof Final** | – | Bukti ACC customer (opsional, max 10 gambar) |

### Item per Baris

Search produk → pilih dari catalog. Untuk produk **AREA_BASED**: muncul field Lebar × Tinggi × Pcs (kopi). Untuk **UNIT**: cuma Qty.

Catatan per item bebas (mis. "warna full color, finishing laminating doff").

### Upload Screenshot Proof

Field opsional tapi rekomended. Bisa input pakai 3 cara:

1. **Klik "Pilih Gambar"** — file picker tradisional
2. **`Ctrl + V`** (paste) — paste screenshot dari clipboard langsung. Cocok buat desainer yang screenshot WA chat customer
3. **Drag & drop** — drag file dari File Explorer ke dropzone

Maksimal 10 gambar per SO. Auto-rename file paste jadi `pasted-<timestamp>.png`. Mime type otomatis dideteksi dari clipboard (image/png, image/jpeg, dll).

### Auto-Tag Branch

Saat SO disubmit:
- Dari **Desainer Portal** — `branchName` auto = `Designer.branchName`
- Dari **Cashier `/sales-orders/new`** — `branchName` auto = nama cabang aktif kasir (dari header `X-Branch-Id`)

Branch tag dipakai untuk routing ke grup WA per cabang saat broadcast.

---

## 🔄 Status Lifecycle SO

```
DRAFT (baru dibuat, belum dibroadcast)
   ↓
SENT (sudah broadcast ke grup WA internal)
   ↓
INVOICED (kasir sudah convert ke invoice/transaksi POS)
   ↓ atau
CANCELLED (dibatalkan dengan alasan)
```

Indicator badge:
- ⚪ **DRAFT** — gray
- 🔵 **SENT** — biru
- 🟢 **INVOICED** — hijau
- 🔴 **CANCELLED** — merah

Sidebar entry "Sales Order" punya badge angka = jumlah SO yang status `SENT` (menunggu di-invoice oleh kasir). Polling 30 detik.

---

## 📤 Kirim ke WA Group Internal

Tombol **"Kirim ke WA Group"** muncul di SO detail page (status DRAFT atau SENT).

Saat klik:
1. Sistem resolve cabang dari `SO.branchName` (4 strategi: exact, code, substring, token-based scoring)
2. Lookup `BranchSettings(branchId).waDesignGroupId` di per-cabang config
3. Fallback ke `whatsapp_bot_config.json > designGroupId` (global default)
4. Compose pesan otomatis: nomor SO, customer, item list, deadline, catatan, link detail
5. Attach proof images (kalau ada)
6. Kirim ke grup WA via WhatsApp bot
7. Status SO → SENT, set `sentToWaAt = now()`

Pesan WA akan muncul di grup internal cabang yang sesuai. Kasir/operator yang ada di grup itu langsung tahu ada order baru yang harus dilanjutkan.

### Setup Grup Per Cabang

1. Owner: `/settings/branch-config`
2. Pilih cabang
3. Card "WhatsApp Group" → field **"Design Group ID"**
4. Format: `120363xxxxx@g.us` (dapat lewat command `!getgroupid` di grup WA)
5. Simpan

> Jika field per-cabang kosong, sistem fallback ke konfigurasi global. Lihat [Mode Cabang](mode-cabang.md) untuk detail lengkap WA per cabang.

---

## 📋 Dashboard SO

### Untuk Desainer (`/so-designer/dashboard`)
- List SO yang dia buat
- Filter status: DRAFT / SENT / INVOICED / CANCELLED
- Klik SO → detail (lihat status, kirim WA, edit kalau masih DRAFT)

### Untuk Admin (`/sales-orders`)
- List semua SO dari semua desainer (kalau Owner) atau cabang aktif (kalau staff)
- Filter status + search by SO number / customer / designer
- Tab **Pending Invoice** (badge angka) — SO status SENT yang belum di-convert ke invoice
- Klik SO → detail lengkap

---

## 🧾 Convert SO ke Invoice (POS)

Saat customer datang bayar, kasir tinggal:

1. Buka `/pos`
2. Klik tombol **"Buat dari SO"** (atau scan QR di nota SO kalau ada)
3. Pilih SO dari list (filter status SENT)
4. Item-items SO otomatis ke-load ke cart POS
5. Adjust kalau perlu (mis. tambah item, ubah qty), pilih payment method
6. Submit checkout
7. Sistem auto-update SO: `status = INVOICED`, `transactionId = <new tx id>`, `invoicedAt = now()`

Sales Order jadi rekam jejak: customer lihat penawaran (SO), kemudian convert ke transaksi (Invoice). Mempermudah audit & rekonsiliasi.

---

## 🛠️ Manajemen Desainer

Halaman: `/settings/designers` (Owner only)

| Field | Keterangan |
|---|---|
| **Nama** | Nama lengkap desainer |
| **PIN** | Numerik 4-6 digit untuk login portal |
| **Branch Name** | Nama cabang asal (mis. "Voliko Cabang Sewon" atau "CAB"). Dipakai untuk auto-tag SO |
| **Aktif** | Toggle. Non-aktif = tidak bisa login portal |

### Penting: Branch Name Harus Match

`Designer.branchName` dipakai untuk routing WA group saat broadcast SO. Sistem coba 4 strategi matching:

1. Exact match dengan `CompanyBranch.name`
2. Match dengan `CompanyBranch.code` (case-insensitive)
3. Substring (mis. "Sewon" match "Voliko Cabang Sewon")
4. Token-based scoring (mis. "Cab Sewon" match "Voliko Cabang Sewon (CAB)" karena 2 token cocok)

Tetap, paling aman: copy-paste persis nama cabang dari `/settings/branches` ke field `Branch Name` desainer.

---

## 🔔 Bot Command untuk SO

Tidak ada command WA khusus untuk SO. Broadcast manual via tombol di UI. Notif balik dari WA bot saat:
- Pesan SO terkirim sukses (silent — hanya status SO update)
- Gagal kirim → muncul notif Discord (kalau enabled) + alert di UI

---

## ⚙️ API Endpoints (Reference)

### Public (Designer Portal)
- `POST /sales-orders/designer` — buat SO (perlu designerId + pin)
- `GET /sales-orders/designer/:id` — detail SO
- `POST /sales-orders/designer/:id/proofs` — upload proof images
- `POST /sales-orders/designer/:id/send-wa` — kirim WA broadcast
- `POST /sales-orders/designer/:id/cancel` — cancel SO

### Authenticated (Cashier/Admin)
- `GET /sales-orders` — list (scoped by branch)
- `POST /sales-orders` — buat SO baru
- `PATCH /sales-orders/:id` — edit (DRAFT only)
- `POST /sales-orders/:id/proofs` — upload proof
- `POST /sales-orders/:id/send-wa` — kirim WA
- `POST /sales-orders/:id/cancel` — cancel
- `GET /sales-orders/pending-invoice-count` — badge sidebar

---

## 🧪 Testing Flow Cepat

### Skenario: Desainer Freelance → Kasir Cabang Sewon

1. Owner: `/settings/branches` → pastikan ada cabang "Voliko Cabang Sewon" dengan code "CAB"
2. Owner: `/settings/branch-config` → pilih Sewon → set "Design Group ID" dengan grup WA tim Sewon
3. Owner: `/settings/designers` → tambah desainer "Mas Asad" PIN 1234, branchName "CAB"
4. Mas Asad: buka `/so-designer` di HP → pilih nama → input PIN 1234 → masuk dashboard
5. Klik **"+ SO Baru"** → input customer "Asita", item "Banner 3×2m × 1pcs" → ctrl+V screenshot WA chat → submit
6. Kembali ke detail SO → klik **"Kirim ke WA Group"** → grup Sewon dapat notif dengan SO + lampiran
7. Kasir Sewon di grup baca → buka `/pos` → klik "Buat dari SO" → pilih SO Asita → submit checkout
8. SO status berubah jadi INVOICED, transaksi tercatat di Sewon

---

## ⚠️ Troubleshooting

### "Group WA Desain belum di-set" saat klik kirim WA
Sistem tidak ketemu group ID. Diagnostik error message akan kasih detail:
- `SO branchName: "..."` — apa yang disimpan di SO
- `Cabang ter-resolve: ...` — apakah berhasil match ke CompanyBranch
- `Cabang tersedia: ...` — list nama cabang aktif yang bisa dipilih

Solusi:
- Pastikan `Designer.branchName` match (atau mirip) salah satu nama cabang
- Set `BranchSettings.waDesignGroupId` di `/settings/branch-config`
- Atau set global fallback di `/settings/whatsapp` → "Group Internal Sales Order"

### Bot WA tidak terhubung
- Buka `/settings/whatsapp` → cek status QR code
- Scan ulang kalau perlu
- Pesan error 400 akan kasih tahu kalau bot disconnected

### Upload gambar gagal
- Cek folder `public/uploads/so-proofs` ada (auto-create di startup)
- Cek file image valid (jpg/png/gif/webp/bmp/svg)
- Mime type harus `image/*` (clipboard paste kadang tidak punya extension — sudah dihandle)

### SO tidak muncul di POS "Buat dari SO"
- Cek SO status = SENT (DRAFT belum bisa di-invoice)
- Cek SO branchName match cabang aktif kasir (kalau staff non-owner)

---

## 🔗 Halaman Terkait

- [🏢 Mode Cabang](mode-cabang.md) — multi-cabang & WA per cabang
- [📄 Invoice & SPH](invoice-sph.md) — beda Invoice vs SO
- [🤖 WhatsApp Bot](README.md#-9-pengaturan-whatsapp-bot) — setup bot

---

*Terakhir diperbarui: 26 April 2026 | Designer Portal v1.0 + WA per-cabang routing*
