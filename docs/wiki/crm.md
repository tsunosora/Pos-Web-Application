# 🎯 CRM — Lead Pipeline, Follow-Up & Customer Relationship

> **TL;DR**: Modul CRM PosPro membantu Anda **tidak kehilangan calon customer**, **tidak lupa follow-up**, dan **tidak melupakan customer lama**. Dari chat WA pertama sampai repeat order tahun depan — semua ter-tracking otomatis.

---

## Apa itu CRM di PosPro?

**CRM (Customer Relationship Management)** adalah sistem untuk mengelola hubungan dengan calon customer & customer existing, mulai dari **lead masuk** sampai **after-sales**, sehingga tidak ada peluang penjualan yang lewat begitu saja.

PosPro memiliki **4 halaman utama** untuk CRM:

| Halaman | Fungsi |
|---|---|
| `/crm` | **Dashboard KPI** — metrik performa CRM (response time, closing rate, dll) |
| `/crm/leads` | **Pipeline Lead** — input lead baru, kanban drag-drop status, convert ke customer |
| `/crm/follow-ups` | **Daily Worklist** — tugas hubungi customer hari ini (paling sering dibuka) |
| `/crm/templates` | **Setup Template WA** — pesan siap copy-paste untuk berbagai skenario |

---

## 🔄 Alur Lengkap CRM

```
LEAD MASUK (NEW)
  ↓
FOLLOW UP (chat berkala, gali kebutuhan)
  ↓
NEGOSIASI (kasih penawaran, deal harga)
  ↓
CLOSED_WON → Convert → [Customer] + [SPK/SO] + [Invoice]
  ↓
PRODUKSI (handover ke designer/operator)
  ↓
PICKUP (customer ambil pesanan)
  ↓
AFTER_SALES (auto 3 hari → minta testimoni)
  ↓
REPEAT_ORDER (auto weekly cek customer dormant)
```

---

## 1. Halaman `/crm/leads` — Pipeline Lead

### Apa itu Lead?
**Lead** = calon customer yang sudah kontak tapi belum closing. Berbeda dengan customer (yang sudah pernah bayar).

### Status Lead
- 🆕 **NEW** — Baru chat, belum di-FU
- ⏰ **FOLLOW_UP** — Sudah dihubungi, menunggu respons
- 💬 **NEGOTIATION** — Sedang nego harga / desain
- ✅ **CLOSED_WON** — Deal! Sudah di-convert ke customer + SPK/Invoice
- ❌ **CLOSED_LOST** — Tidak jadi (alasan dicatat)

### Tampilan: Card View vs Kanban View
- **Card view** — grid kartu standar, cocok untuk scrolling daftar lengkap
- **Kanban view** — 5 kolom status, **drag-drop** antar kolom untuk update status (paling cepat & intuitif)

### Fitur di Form Lead
- **Multi-image upload** — sampai 5 gambar, tampil sebagai slider/carousel di kanban card
- **Phone dedup** — saat ketik HP, sistem auto-cek customer existing → kasih banner "pakai data ini" untuk hindari duplikat
- **Product picker** — pilih item dari katalog atau custom (free-text + harga manual), auto-calc subtotal AREA_BASED (untuk banner/cetak ukuran)
- **CS assignment** — pilih user dari daftar `/settings/users` yang pegang lead ini
- **Image cover di kartu** — gambar pertama jadi cover kanban card

### Convert Lead → Closing
Klik tombol **"Convert"** di detail lead → 3 checkbox:
- 👤 **Buat Customer Baru** — record di `Customer` master
- 📋 **Buat SPK (Sales Order) Draft** — untuk production-bound order (banner, jersey, dll yang butuh desain)
- 🧾 **Buat Invoice / Quotation Draft** — INV-... atau SPH-... untuk tagihan

**Otomatis terjadi saat convert**:
- Items dari lead masuk ke SO + Invoice (yang dari katalog → SO, semua → Invoice)
- Gambar lead di-copy ke SO Proof Gambar (desainer langsung lihat referensi)
- Lead status berubah ke CLOSED_WON, link ke customer + SO + invoice ter-record

---

## 2. Halaman `/crm/follow-ups` — Daily Worklist CS ⭐

> **Halaman paling sering dibuka CS dalam keseharian.** Anggap aja seperti "Inbox tugas" — semua reminder "wajib chat customer hari ini" terkumpul di sini.

### 3 Section Visual Otomatis
- 🔥 **Overdue** (merah) — tugas yang sudah lewat tanggal due. **Prioritas utama**.
- 📅 **Akan Datang** (amber) — tugas hari ini & beberapa hari ke depan
- ✓ **Selesai/Skip** — history (switch filter ke DONE/SKIPPED)

### 4 Jenis Tugas Otomatis

| Tipe | Trigger | Due Date |
|---|---|---|
| 🎯 **LEAD_FU** | CS set `followUpDate` saat input/edit lead | Sesuai tanggal yang di-set |
| 📦 **AFTER_SALES** | Operator klik pickup job di `/produksi` | Auto +3 hari, jam 9 pagi |
| 🔄 **REPEAT_ORDER** | Cron Senin pagi → customer 90-180 hari tidak order | Auto +1 hari |
| 💰 **PAYMENT_REMINDER** | (Placeholder Phase 2) | — |

### 2 Tab View
- **👤 Tugas Saya** (default) — hanya task assigned ke user yang login
- **🌐 Semua** — view owner/supervisor, lihat semua task lintas user/cabang

### 3 Tombol Aksi per Task
- **✓ Selesai** → modal isi catatan singkat → task DONE + activity log
- **💬 WA** → pilih template → preview rendered (placeholder `{{name}}` auto-isi) → Copy + buka WA langsung
- **⏭ Skip** → task ke status SKIPPED (mis. customer ghosting)

### Kenapa Halaman Ini Penting?
| Tanpa halaman ini | Dengan halaman ini |
|---|---|
| Lead hilang karena lupa FU | Reminder pasti muncul di tanggal due |
| Tidak ada testimoni karena lupa minta | Auto-task 3 hari pasca pickup |
| Repeat order rendah | Cron auto-tag customer dormant |
| Tidak tahu siapa CS yang rajin | KPI dashboard track per-user |

---

## 3. Halaman `/crm/templates` — Template WA

Kumpulan pesan siap-pakai dengan placeholder yang auto-isi data customer.

### Placeholder Tersedia
- `{{name}}` — Nama lead/customer
- `{{phone}}` — Nomor HP
- `{{soNumber}}` — Nomor Sales Order
- `{{status}}` — Status SO/lead
- `{{estimatedDays}}` — Hari sampai deadline SO
- `{{monthsSinceLastOrder}}` — Bulan sejak order terakhir customer

### Kategori Default (Seed 5)
1. **Greeting Lead Baru** — sambutan untuk lead yang baru chat
2. **Follow Up Lead Hari ke-3** — nudge lead yang belum respons
3. **Update Progress: Masuk Printing** — info ke customer pesanan masuk produksi
4. **After Sales (Cek Penerimaan)** — minta testimoni / foto pakai
5. **Repeat Order Nudge** — tawarkan repeat order ke customer lama

Klik tombol **"Seed 5 Default"** saat pertama kali pakai untuk dapat template starter. Bisa di-edit / dihapus / nonaktifkan sesuai kebutuhan.

---

## 4. Halaman `/crm` — Dashboard KPI

Metrik performa CRM untuk owner monitoring:

| Metrik | Cara Hitung |
|---|---|
| **Response Time Avg** | Rata-rata berapa jam sampai lead di-respons CS |
| **Closing Rate** | % lead yang berhasil di-convert ke customer |
| **FU Compliance** | % follow-up done sebelum due date + 1 hari |
| **Repeat Order Rate** | % customer yang order ≥2 kali |
| **Leads by Source** | Pie + bar chart: WA / IG / FB / Marketplace / Referral / dll |
| **Leaderboard CS** | Ranking per user: leads handled, deals closed, pcs/omzet lead, **+ kontribusi POS walk-in** (Pcs WO / Trx WO / Omzet WO), avg response |

Filter periode: hari ini / 7 hari / bulan ini / custom range.

**Skor Leaderboard CS = Lead + POS walk-in.** Selain metrik dari lead (closing,
pcs/omzet hasil convert), leaderboard juga menghitung transaksi POS langsung yang
ditangani CS:

- **Pcs WO** — jumlah barang dari transaksi POS walk-in (non-lead).
- **Trx WO** — jumlah transaksi POS walk-in.
- **Omzet WO** — total nilai (grandTotal) transaksi POS walk-in.

Atribusi walk-in dicocokkan lewat kolom **Kasir/Staff** di POS (`cashierName`) yang
sama dengan nama user CS. Transaksi yang berasal dari konversi lead **tidak** dihitung
lagi sebagai walk-in (anti dobel). Sisa piutang transaksi PENDING/DP walk-in ikut
masuk ke kolom **Nilai Akan Datang**. CS yang hanya punya penjualan POS (tanpa lead)
tetap muncul di leaderboard.

---

## 📅 Contoh Alur 1 Hari Kerja CS

### 08:30 — CS sampai kantor, buka `/crm/follow-ups`

Tab **"Tugas Saya"** menampilkan:

```
🔥 OVERDUE (2)
┌────────────────────────────────────────┐
│ 🎯 LEAD_FU · kemarin                   │
│ PT Bina Sekolah · Lead                 │
│ 📞 081234567890                        │
│ "Tunggu konfirmasi tim sebelum closing"│
│ [✓ Selesai] [💬 WA] [⏭ Skip]           │
├────────────────────────────────────────┤
│ 📦 AFTER_SALES · 2hr lalu              │
│ Pak Andi (Komunitas Futsal) · Customer │
│ 📞 081876543210                        │
│ "Auto-scheduled setelah pickup..."     │
│ [✓ Selesai] [💬 WA] [⏭ Skip]           │
└────────────────────────────────────────┘

📅 AKAN DATANG (4)
┌────────────────────────────────────────┐
│ 🎯 LEAD_FU · hari ini, 14:00           │
│ SD Cendekia · Lead                     │
│ ...                                    │
│ [✓ Selesai] [💬 WA] [⏭ Skip]           │
└────────────────────────────────────────┘
... 3 lagi
```

### 08:35 — Kerjakan Overdue dulu (PT Bina Sekolah)
1. Klik **💬 WA** di task PT Bina
2. Modal terbuka → pilih template **"Follow Up Lead Hari ke-3"**
3. Preview text muncul:
   > *"Halo kak PT Bina Sekolah 🙏 Mau follow up kebutuhan jersey futsal-nya kemarin..."*
4. Klik **Copy** → text tersalin → klik **Buka WA** → tab baru ke `wa.me/628...` dengan text auto-paste
5. Chat dengan Pak Anto (kontak PT Bina) → dia bilang setuju, mau closing besok
6. Kembali ke `/crm/follow-ups` → klik **✓ Selesai** di task PT Bina → isi notes: *"Customer setuju, deal closing besok 10:00"*

### 08:55 — Task Andi Futsal (After-Sales)
1. Klik **💬 WA** → pilih template **"After Sales (Cek Penerimaan)"**
2. Preview: *"Halo kak Andi 🙌 Jersey-nya sudah diterima ya? Bagus ngga hasilnya? Boleh kami minta foto saat dipakai?"*
3. Copy → kirim via WA
4. Pak Andi balas dengan **foto tim main futsal pakai jersey buatan toko Anda** + *"Mantap kak, bahan adem, sablon awet"*
5. CS Anda screenshot → simpan di folder konten IG, akan di-post sore
6. Mark **✓ Selesai** dengan notes: *"Customer puas, dapat foto tim + testimoni positif. Pajang di IG 24/5"*

### 10:00 — Closing PT Bina (dari follow-up tadi pagi)
1. Pak Anto chat: *"OK kak lanjut order 30pcs"*
2. CS buka `/crm/leads` → klik card PT Bina → klik **"Convert (Closing)"**
3. Centang: ✅ Buat Customer Baru + ✅ Buat SPK + ✅ Buat Invoice → designer: Andi → submit
4. Alert: *"✓ Customer #15 + SPK #28 (1 item dari katalog) + INV-20260524-001"*
5. Auto-copy gambar referensi PT Bina → SO Proof → designer Andi langsung lihat
6. Pak Anto dikabari nomor SO + akan dikirim invoice oleh kasir

### 13:30 — Kerjakan tugas siang (SD Cendekia)
1. Refresh `/crm/follow-ups` → SD Cendekia masih di Akan Datang
2. Hubungi via WA → mereka belum putuskan
3. Drag SD Cendekia di Kanban `/crm/leads` dari FOLLOW_UP ke NEGOTIATION
4. Set followUpDate baru: 3 hari lagi → otomatis task baru muncul tanggal itu

### 15:00 — Refresh check
Task baru muncul (mungkin dari operator yang baru pickup pesanan lain). Kerjakan.

### 16:30 — Final check sebelum pulang
- Pastikan section Overdue kosong (semua sudah di-handle atau di-skip)
- Buka `/crm` dashboard → cek angka hari ini: 3 closing, 5 FU done, response time avg 1.2 jam
- Catatan untuk besok: cek lead Toko Baju Andi yang janji konfirmasi besok pagi

---

## 🤖 Otomasi Behind The Scenes

| Trigger | Yang Otomatis Terjadi |
|---|---|
| Input lead dengan `followUpDate` | Auto-create FollowUp task LEAD_FU di tanggal itu |
| Edit lead, ubah `followUpDate` | Update task existing (tidak duplikat) |
| Hapus `followUpDate` | Task pending di-mark SKIPPED |
| Operator klik pickup job | Auto-create FollowUp AFTER_SALES due +3 hari |
| Cron Senin pagi | Auto-create FollowUp REPEAT_ORDER untuk customer 90-180 hari dormant |
| Convert lead | Create Customer + SPK + Invoice dengan items + images auto-copied |
| Click "✓ Selesai" task | Activity log tercatat di lead/customer timeline |

---

## 🔗 Integrasi dengan Modul Lain

| Modul | Hubungan dengan CRM |
|---|---|
| **Customer** (`/customers`) | Detail customer extended dengan CRM panel: timeline aktivitas, dropdown CS assigned, tombol Buat FU + Copy Template |
| **Sales Order** (`/sales-orders`) | SO bisa dibuat dari Convert Lead (items + proof gambar auto-copied) |
| **Invoice** (`/invoices`) | Invoice draft bisa dibuat dari Convert Lead (items auto-copied dengan description) |
| **POS** (`/pos`) | Tombol "Buat Nota" di SO list bawa item ke POS cart untuk checkout |
| **Production** (`/produksi`) | Pickup job auto-trigger after-sales FU |
| **Settings → Users** (`/settings/users`) | Sumber daftar CS untuk assignment di lead/customer |
| **WhatsApp** | Template di-copy manual ke WA (tidak pakai bot API — lebih aman & fleksibel) |
| **Backup** | Grup "CRM" di-include di backup v3.3+ |

---

## 📊 KPI yang Bisa Di-Evaluasi

Owner/manager bisa pakai KPI dashboard untuk evaluasi bulanan:

1. **Lead Quality** — sumber mana yang paling produktif? (Leads by Source chart)
2. **CS Performance** — siapa paling cepat respons, paling tinggi closing rate? (Leaderboard)
3. **Operational Excellence** — FU compliance rate (kepatuhan jadwal follow-up)
4. **Customer Loyalty** — repeat order rate (% customer balik lagi)

Gunakan untuk:
- Bonus CS bulanan (closing rate tertinggi)
- Decision marketing (channel mana harus ditambah budget)
- Coaching CS (yang FU compliance rendah perlu reminder)
- Strategi product (customer dormant kategori apa yang sering perlu repeat)

---

## ⚙️ Catatan Teknis

- **Multi-tenant**: lead & follow-up isolated per cabang. Owner di mode "Semua Cabang" lihat agregat lintas cabang.
- **WhatsApp manual**: tidak pakai bot API untuk send. CS copy template + paste sendiri ke WA. Lebih aman (tidak rate-limited), tidak rusak kalau WA Web disconnect, dan customer dapat chat dari nomor pribadi CS (lebih personal).
- **Phone dedup heuristic**: cek match last-8-digit (handle format +62/0/spasi/dash beda).
- **Image storage**: gambar lead disimpan di `/public/uploads/lead_xxx.jpg`, di-include di backup v3.3+.
- **Cron**: `@nestjs/schedule` weekly Senin 00:00 untuk REPEAT_ORDER nudge.

---

## 🆘 Troubleshooting

### "Saya set tanggal FU di lead tapi tidak muncul di /crm/follow-ups"
- Sebelumnya: gap UX (tanggal FU di lead tidak auto-create task)
- Sudah diperbaiki di v3.3 — set tanggal FU otomatis bikin task LEAD_FU
- Untuk lead lama yang sudah ada sebelum fix: jalankan backfill script `backend/prisma/scripts/backfill-lead-followups.ts`

### "Tombol WA error / tidak buka WA"
- Pastikan customer punya nomor HP terisi di lead/customer
- Format `wa.me/628...` auto-konversi dari format Indonesia (08xxx)
- Browser pop-up blocker bisa block — allow popups dari domain Anda

### "Task tidak muncul untuk saya tapi muncul untuk CS lain"
- Cek dropdown "Tugas Saya" vs "Semua" di atas
- Cek apakah `assignedToId` di task sesuai user.id Anda
- Owner default lihat "Semua", staff lihat "Tugas Saya"

### "After-sales tidak auto-trigger setelah pickup"
- Pastikan customer di transaction sudah ter-set (`Transaction.customerId`)
- Cek customer punya `assignedCsId` (CS yang pegang) — kalau null, akan fallback ke kasir yang handle transaksi
- Dedup window 7 hari — kalau pickup sebelumnya untuk customer sama < 7 hari lalu, skip (intentional)

---

> 📚 **Lanjut baca**: [Alur Bisnis](alur-bisnis.md) untuk melihat bagaimana CRM terhubung dengan modul lain · [Sales Order](sales-orders.md) untuk flow setelah convert · [Backup & Restore](backup.md) v3.3 untuk backup data CRM
