# Discord Announcement — PosPro v3.3 CRM Module

> 2 versi tersedia: **Singkat** (untuk channel `#announcement` umum) dan **Panjang** (untuk channel `#changelog` atau forum thread). Pilih sesuai kebutuhan, copy-paste ke Discord.

---

## ✂️ Versi 1: Singkat (untuk `#announcement`)

```
🎯 **UPDATE BESAR — PosPro v3.3 CRM Module**

Halo tim! Hari ini PosPro release update besar — fitur **CRM (Customer Relationship Management)** lengkap. Sekarang kita bisa tracking calon customer dari chat WA pertama sampai repeat order tahun depan, semua otomatis.

**✨ Yang Baru:**
🆕 `/crm/leads` — Pipeline lead pra-jual (input lead dari WA/IG/FB), kanban drag-drop, multi-image carousel
📋 `/crm/follow-ups` — **Daily worklist CS** dengan auto-reminder, template WA siap copy-paste
📊 `/crm` — Dashboard KPI: response time, closing rate, leaderboard CS
✉️ `/crm/templates` — Template pesan WA dengan placeholder otomatis

**🤖 Otomasi:**
• After-sales auto-trigger 3 hari setelah pickup → minta testimoni
• Repeat order nudge weekly untuk customer dormant
• Convert lead → bikin Customer + SPK + Invoice sekaligus
• Image lead auto-copy ke SO Proof (designer langsung lihat referensi)

**🔒 Backup:** version 3.3 — semua data CRM tercover di backup ZIP.

**📚 Dokumentasi lengkap:**
👉 https://tsunosora.github.io/Pos-Web-Application/crm

Update **wajib di-deploy** sebelum besok pagi. Tutorial deploy ada di pinned message #dev. Tanya kalau ada masalah! 🚀
```

---

## 📖 Versi 2: Panjang (untuk `#changelog` / thread forum)

```
# 🎯 PosPro v3.3 — Major Release: CRM Module

**TL;DR:** Modul CRM lengkap untuk lead pipeline, follow-up scheduler, dan customer relationship — semua dari chat WA pertama sampai repeat order.

---

## 🆕 4 Halaman Baru

### 1. `/crm/leads` — Pipeline Lead Pra-Jual
- Status pipeline: NEW → FOLLOW_UP → NEGOTIATION → CLOSED_WON / CLOSED_LOST
- **2 mode view**: Card grid atau Kanban (drag-drop antar kolom untuk update status)
- **Multi-image** lead sampai 5 gambar, tampil sebagai slider/carousel di kanban card
- **Phone dedup** otomatis: saat ketik HP, sistem auto-cek customer existing → hindari duplikat
- **Product picker**: pilih item dari katalog atau custom free-text, auto-calc subtotal AREA_BASED
- **CS assignment**: pilih dari daftar user yang sudah terdaftar
- **Convert flow**: 1 klik bikin Customer + SPK (Sales Order) + Invoice/Quotation sekaligus dengan items + gambar auto-copied

### 2. `/crm/follow-ups` — Daily Worklist CS ⭐
> Halaman ini akan jadi **halaman paling sering dibuka CS dalam keseharian**. Anggap seperti inbox tugas — semua reminder "wajib chat customer hari ini" terkumpul di sini.

- **3 section visual otomatis**: 🔥 Overdue (merah) / 📅 Akan Datang (amber) / ✓ Selesai
- **2 tab**: Tugas Saya (default) vs Semua (owner view)
- **3 tombol per task**: ✓ Selesai (+ notes), 💬 WA (copy template), ⏭ Skip
- **4 jenis tugas otomatis**:
  - 🎯 LEAD_FU — dari `followUpDate` di lead
  - 📦 AFTER_SALES — auto +3 hari setelah operator klik pickup
  - 🔄 REPEAT_ORDER — cron weekly Senin pagi untuk customer dormant 90-180 hari
  - 💰 PAYMENT_REMINDER — placeholder Phase 2

### 3. `/crm/templates` — Template WA Manager
- CRUD template dengan placeholder: `{{name}}`, `{{phone}}`, `{{soNumber}}`, `{{status}}`, `{{estimatedDays}}`, `{{monthsSinceLastOrder}}`
- 5 template default (klik "Seed Default" pertama kali): Greeting, FU Day 3, Progress Printing, After Sales, Repeat Order
- Preview real-time dengan dummy data
- Aktif/non-aktif toggle

### 4. `/crm` — Dashboard KPI
- Metrik: Response Time Avg, Closing Rate, FU Compliance, Repeat Order Rate
- Charts: Leads by Source (pie + bar)
- Leaderboard CS: ranking per user untuk leads handled, deals closed, avg response
- Filter periode: today / week / month / custom

---

## 🤖 Otomasi Behind The Scenes

| Trigger | Yang Otomatis Terjadi |
|---|---|
| Input lead dengan `followUpDate` | Auto-create FollowUp task LEAD_FU |
| Edit lead, ubah `followUpDate` | Update task existing (tidak duplikat) |
| Operator klik pickup job | Auto-create FollowUp AFTER_SALES (+3 hari, dedup 7 hari) |
| Cron Senin pagi | Auto-create REPEAT_ORDER untuk customer 90-180 hari dormant |
| Convert lead | Bikin Customer + SPK + Invoice dengan items + images auto-copied |

---

## 🔗 Integrasi dengan Modul Existing

- **Customer detail (`/customers`)**: Sekarang ada panel CRM dengan timeline aktivitas + dropdown CS assigned + tombol Buat FU + Copy Template
- **Sales Order detail (`/sales-orders/[id]`)**: Tombol "Buat Nota" sekarang aktif dari status DRAFT (tidak perlu kirim WA group dulu)
- **POS (`/pos?fromSO=X`)**: Cart auto-prefill dari SO termasuk SO DRAFT (sebelumnya wajib SENT)
- **Production pickup**: Trigger after-sales auto
- **Sidebar**: 4 entry baru di section "Pelanggan & Order" dengan badge polling

---

## 🔒 Backup & Restore v3.3

- Grup baru: **"CRM — Leads, Follow-ups, Templates"**
- 6 tabel baru ter-backup: `lead`, `lead_items`, `lead_images`, `lead_activities`, `follow_ups`, `message_templates`
- 4 kolom baru di `customers` ter-backup
- Backward compat: backup v3.2 ke bawah tetap bisa di-restore di sistem v3.3

---

## ⚡ Performance Improvements

Bonus: optimasi polling sidebar dari ~13 req/min idle → ~5 req/min (-60%). Update tidak terasa di UX (badge update tetap akurat), tapi backend lebih lega.

---

## 🚀 Deploy ke Production

```bash
cd ~/pospro
git checkout main && git pull origin main

# Backend
cd backend
npm install
npx prisma db push   # ← akan create 6 tabel CRM baru
npx prisma generate
pm2 restart backend

# Frontend
cd ../frontend
npm install
rm -rf .next
npm run build
pm2 restart frontend
```

---

## 📚 Dokumentasi Lengkap

🔗 **https://tsunosora.github.io/Pos-Web-Application/crm**

Termasuk:
- Penjelasan tiap halaman + screenshot
- Contoh alur 1 hari kerja CS pakai halaman ini
- Skenario penggunaan per jenis bisnis (print shop, jersey custom, dll)
- Troubleshooting common issues
- API endpoint references untuk developer

---

## ❓ Pertanyaan?

Tag @owner atau buka thread di #pospro-support. Update ini critical — semua kasir & CS perlu paham flow CRM-nya. Schedule short training session minggu ini? React 👍 kalau setuju.
```

---

## 📋 Catatan Penggunaan

### Cara Post ke Discord

1. **Versi singkat** → channel `#announcement` atau `#general` (yang semua orang baca)
2. **Versi panjang** → channel `#changelog` atau bikin thread di `#dev-updates`
3. Bisa juga jadi **Forum Post** (Discord Forum Channel) kalau workspace pakai forum format

### Tips Format Discord

- Code block (` ``` `) untuk emoji tetap render
- Header (`# / ## / ###`) di Discord rendering: `#` jadi besar, `##` medium, `###` kecil. Pakai sesuai hirarki
- Bold pakai `**text**`, italic pakai `*text*`
- Mention role bisa pakai `@everyone` atau `@here` di awal
- Link dokumentasi penting di-bold + emoji 👉

### Kustomisasi Lebih Lanjut

Ganti placeholder berikut sebelum post:
- `tsunosora.github.io/Pos-Web-Application` → URL docs Anda kalau pakai subdomain custom
- `#pospro-support` / `#dev` / `#announcement` → nama channel sesuai server Anda
- `@owner` → mention role yang tepat
- Tambah screenshot pakai upload attachment di Discord

---

## 🎁 Bonus: Webhook Discord Auto-Post

Kalau Anda pakai Discord webhook untuk notif commit GitHub, bisa juga di-trigger manual saat release:

```bash
curl -X POST "https://discord.com/api/webhooks/YOUR_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "🎯 **PosPro v3.3 — CRM Module Released!** 📚 Docs: https://tsunosora.github.io/Pos-Web-Application/crm",
    "username": "PosPro Bot",
    "avatar_url": "https://your-logo-url.png"
  }'
```
