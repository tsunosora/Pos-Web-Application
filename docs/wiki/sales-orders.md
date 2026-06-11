# 🎨 Sales Order & Designer Portal

> Sistem **Sales Order (SO)** untuk alur kerja desainer → kasir/operator. Desainer (internal atau freelance) bisa input order baru via portal sendiri tanpa akun staff penuh, lalu broadcast ke channel Discord internal (#produksi) supaya kasir lanjutkan ke invoice.

---

## 🎯 Use Case

- **Toko percetakan dengan desainer freelance** — desainer ambil order langsung dari customer (chat WA pribadi), input ke sistem, kirim ke Discord internal supaya kasir tahu ada order baru yang harus diinvoice.
- **Workflow approval** — desainer bisa upload screenshot bukti ACC customer sebagai lampiran, lalu kasir bisa verifikasi sebelum invoice dibuat.
- **Multi-cabang dengan satu pool desainer** — desainer dengan `branchName` bisa bikin SO untuk cabang manapun; nama cabang ikut tercantum di pesan Discord.

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

### Tiga tombol simpan: Draft / Lead Order / Buat Nota (Jun 2026)

Saat membuat SO, desainer punya **tiga pilihan** sesuai kepastian order:

| Tombol | Kapan dipakai | Yang terjadi |
|---|---|---|
| **Simpan Draft** | Masih dikerjakan, belum final | SO tersimpan DRAFT, belum di-broadcast. Bisa diedit/dikirim nanti. |
| **Lead Order (CS)** | Order **belum pasti** / customer masih nego | SO tersimpan + **Lead CRM otomatis dibuat & tertaut** (status Negosiasi, level HOT, estimasi nilai dari item). CS dapat notif Discord #penjualan lalu follow-up dari `/crm/leads`. Nota tetap dibuat dari SO ini — saat di-checkout di POS, lead otomatis closing. |
| **Buat Nota (Kirim)** | Order **sudah pasti** | SO di-broadcast ke Discord #produksi cabang (status SENT) — kasir tinggal buatkan nota dari SO di POS. |

Lead Order bersifat idempoten: kalau SO ini sudah punya lead, tidak dibuat dobel. Setelah simpan, desainer kembali ke dashboard portal.

### Edit SO tanpa bikin ulang (Jun 2026)

Salah input bahan, qty, nama, atau catatan? Buka detail SO → tombol **Edit** (muncul selama status DRAFT atau SENT, belum jadi nota). Form yang sama terbuka dengan data ter-prefill; ubah lalu **Simpan** atau **Simpan & Kirim** ulang. Item boleh diubah selama SO **belum di-invoice/dibatalkan**. Setelah jadi nota (INVOICED) atau dibatalkan, SO terkunci.

### Catatan order tampil di nota (Jun 2026)

Field **Catatan / Instruksi Cetak** di SO ikut terbawa ke POS saat SO dibuatkan nota (`productionNotes`) dan **dicetak di nota/struk** (kotak "Catatan Order" di atas tabel item, juga di share WhatsApp). Catatan per-item tetap tampil di bawah nama item masing-masing.

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

Branch tag dicantumkan sebagai baris `Cabang:` di pesan Discord saat broadcast.

---

## 🔄 Status Lifecycle SO

```
DRAFT (baru dibuat, belum dibroadcast)
   ↓
SENT (sudah broadcast ke Discord internal)
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

## 📤 Kirim ke Discord Internal

Tombol **"Kirim ke Discord"** muncul di SO detail page (status DRAFT atau SENT).

Saat klik:
1. Compose pesan otomatis: nomor SO, customer, desainer, **cabang**, item list, deadline, catatan
2. Attach proof images sebagai lampiran (kalau ada)
3. Kirim ke channel Discord **#produksi** via webhook (event `Surat Order Desain`)
4. Status SO → SENT, set `sentToWaAt = now()` (nama kolom legacy dari era WhatsApp)

Pesan akan muncul di channel produksi. Kasir/operator yang ada di channel itu langsung tahu ada order baru yang harus dilanjutkan.

### Setup Channel

1. Owner: `/settings/discord`
2. Aktifkan master switch, isi webhook URL channel **#produksi**
3. Pastikan event **Surat Order Desain** aktif (default aktif)

> Routing grup WA per cabang (`BranchSettings.waDesignGroupId`) tidak dipakai lagi — semua SO masuk ke satu channel produksi, dengan nama cabang tercantum di pesan. Lihat [Notifikasi Discord](discord.md).

---

## 📋 Dashboard SO

### Untuk Desainer (`/so-designer/dashboard`)
- List SO yang dia buat
- Filter status: DRAFT / SENT / INVOICED / CANCELLED
- Klik SO → detail (lihat status, kirim ke Discord, edit kalau masih DRAFT)

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

### Branch Name

`Designer.branchName` dipakai sebagai auto-tag cabang di SO (tercantum di pesan Discord & untuk scoping list SO per cabang). Paling aman: copy-paste persis nama cabang dari `/settings/branches` ke field `Branch Name` desainer.

---

## 🔔 Notifikasi SO

Broadcast manual via tombol di UI:
- Pesan SO terkirim sukses → status SO update jadi SENT (silent)
- Gagal kirim → error 400 dengan petunjuk setting Discord + alert di UI

---

## ⚙️ API Endpoints (Reference)

### Public (Designer Portal)
- `POST /sales-orders/designer` — buat SO (perlu designerId + pin)
- `GET /sales-orders/designer/:id` — detail SO
- `POST /sales-orders/designer/:id/proofs` — upload proof images
- `POST /sales-orders/designer/:id/update` — edit SO (PIN; customer/catatan/item selama belum invoiced)
- `POST /sales-orders/designer/:id/create-lead` — "Lead Order": buat Lead CRM tertaut dari SO (PIN; idempoten)
- `POST /sales-orders/designer/:id/send-wa` — broadcast ke Discord (#produksi) — path "send-wa" legacy
- `POST /sales-orders/designer/:id/cancel` — cancel SO

### Authenticated (Cashier/Admin)
- `GET /sales-orders` — list (scoped by branch)
- `POST /sales-orders` — buat SO baru
- `PATCH /sales-orders/:id` — edit (DRAFT only)
- `POST /sales-orders/:id/proofs` — upload proof
- `POST /sales-orders/:id/send-wa` — broadcast ke Discord (#produksi) — path "send-wa" legacy
- `POST /sales-orders/:id/cancel` — cancel
- `GET /sales-orders/pending-invoice-count` — badge sidebar

---

## 🧪 Testing Flow Cepat

### Skenario: Desainer Freelance → Kasir Cabang Sewon

1. Owner: `/settings/branches` → pastikan ada cabang "Voliko Cabang Sewon" dengan code "CAB"
2. Owner: `/settings/discord` → aktifkan + isi webhook channel **#produksi**
3. Owner: `/settings/designers` → tambah desainer "Mas Asad" PIN 1234, branchName "CAB"
4. Mas Asad: buka `/so-designer` di HP → pilih nama → input PIN 1234 → masuk dashboard
5. Klik **"+ SO Baru"** → input customer "Asita", item "Banner 3×2m × 1pcs" → ctrl+V screenshot WA chat → submit
6. Kembali ke detail SO → klik **"Kirim ke Discord"** → channel #produksi dapat notif SO + lampiran (cabang Sewon tercantum)
7. Kasir Sewon baca channel → buka `/pos` → klik "Buat dari SO" → pilih SO Asita → submit checkout
8. SO status berubah jadi INVOICED, transaksi tercatat di Sewon

---

## ⚠️ Troubleshooting

### "Gagal kirim Surat Order ke Discord" saat klik kirim
Sistem tidak bisa mengirim ke webhook. Cek di `/settings/discord`:
- Master switch **aktif**
- Webhook URL channel **#produksi** terisi & valid (coba tombol **Test**)
- Event **Surat Order Desain** tidak dimatikan

### Upload gambar gagal
- Cek folder `public/uploads/so-proofs` ada (auto-create di startup)
- Cek file image valid (jpg/png/gif/webp/bmp/svg)
- Mime type harus `image/*` (clipboard paste kadang tidak punya extension — sudah dihandle)

### SO tidak muncul di POS "Buat dari SO"
- Cek SO status = SENT (DRAFT belum bisa di-invoice)
- Cek SO branchName match cabang aktif kasir (kalau staff non-owner)

---

## 🔗 Halaman Terkait

- [🏢 Mode Cabang](mode-cabang.md) — multi-cabang
- [📄 Invoice & SPH](invoice-sph.md) — beda Invoice vs SO
- [🔔 Notifikasi Discord](discord.md) — setup webhook channel

---

*Terakhir diperbarui: Juni 2026 | Designer Portal v1.1 — broadcast SO pindah ke Discord (#produksi)*
