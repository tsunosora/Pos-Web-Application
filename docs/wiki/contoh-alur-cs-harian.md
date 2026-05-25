# 📅 Contoh Alur 1 Hari Kerja CS dengan PosPro CRM

> Skenario realistis seorang CS (Customer Service) di toko cetak/jersey custom yang pakai PosPro CRM, dari pagi sampai sore. Tunjukan bagaimana halaman `/crm/follow-ups`, `/crm/leads`, dan modul lain digunakan dalam keseharian.

---

## 👤 Profil

- **Nama**: Sari, CS di VolikoPrint cabang Pusat
- **Tanggung jawab**: Handle lead masuk dari WA/IG, follow-up customer, dan koordinasi dengan tim produksi & kasir
- **Tools**: Laptop dengan browser Chrome buka tab PosPro + WA Web

---

## ⏰ 08:30 — Sampai Kantor, Buka `/crm/follow-ups`

Sari buka laptop, login ke PosPro. Sidebar menunjukkan badge merah **"Tugas Follow-up: 6"**. Klik → halaman terbuka di tab **"Tugas Saya"**.

### Tampilan Halaman

```
🔥 OVERDUE (2)
┌────────────────────────────────────────────────┐
│ 🎯 LEAD_FU · kemarin                           │
│ PT Bina Sekolah · Lead                         │
│ 📞 081234567890                                │
│ "Tunggu konfirmasi tim sebelum closing"        │
│ [✓ Selesai] [💬 WA] [⏭ Skip]                   │
├────────────────────────────────────────────────┤
│ 📦 AFTER_SALES · 2hr lalu                      │
│ Pak Andi (Komunitas Futsal) · Customer         │
│ 📞 081876543210                                │
│ "Auto-scheduled setelah pickup..."             │
│ [✓ Selesai] [💬 WA] [⏭ Skip]                   │
└────────────────────────────────────────────────┘

📅 AKAN DATANG (4)
┌────────────────────────────────────────────────┐
│ 🎯 LEAD_FU · hari ini, deadline 14:00          │
│ SD Cendekia · Lead                             │
├────────────────────────────────────────────────┤
│ 🔄 REPEAT_ORDER · hari ini                     │
│ CV Maju Bersama · Customer (5 bulan dormant)   │
├────────────────────────────────────────────────┤
│ 🎯 LEAD_FU · besok                             │
│ Toko Baju Cinta · Lead                         │
├────────────────────────────────────────────────┤
│ 📦 AFTER_SALES · besok                         │
│ Bu Ratna · Customer                            │
└────────────────────────────────────────────────┘
```

Sari mulai dari section **Overdue** dulu.

---

## ⏰ 08:35 — Handle Task #1: PT Bina Sekolah (LEAD_FU Overdue)

Sari ingat kemarin dia kontak Pak Anto (admin PT Bina), tapi belum dapat respons final.

1. Klik **💬 WA** di card PT Bina Sekolah
2. Modal terbuka dengan list template:
   - GREETING — Greeting Lead Baru
   - **FU_LEAD — Follow Up Lead Hari ke-3** ← klik
   - PROGRESS — Update Progress: Masuk Printing
   - AFTER_SALES — After Sales (Cek Penerimaan)
   - REPEAT — Repeat Order Nudge
3. Preview text muncul (placeholder `{{name}}` auto-isi):
   > *"Halo kak PT Bina Sekolah 🙏 Mau follow up kebutuhan jersey futsal-nya kemarin. Apakah ada yang bisa kami bantu lebih lanjut? Kalau ada pertanyaan tentang bahan, harga, atau timeline, langsung tanya saja ya kak 🙌"*
4. Sari klik **Copy** → text tersalin ke clipboard
5. Klik **Buka WA** → tab baru terbuka ke `wa.me/6281234567890?text=...` dengan text auto-paste
6. WA Web terbuka, chat ke Pak Anto. Sari kirim pesan, lalu nunggu balasan sambil kerjain task lain
7. Sambil nunggu, **belum mark Selesai** dulu — biarkan task tetap di list, nanti update setelah dapat respons

---

## ⏰ 08:55 — Handle Task #2: Pak Andi (AFTER_SALES)

Pak Andi customer komunitas futsal yang ambil 30 jersey 3 hari lalu. Task auto-trigger karena pickup sudah konfirmasi.

1. Klik **💬 WA** → pilih template **"After Sales (Cek Penerimaan)"**
2. Preview:
   > *"Halo kak Andi 🙌 Pesanannya sudah diterima dengan baik ya? Semoga hasil cetakannya cocok dan tim/komunitas suka 🙏 Kalau berkenan, boleh kami minta foto pakai atau testimoni singkat untuk kami pajang? Sangat membantu untuk semangat tim kami. Terima kasih banyak kak!"*
3. Copy → buka WA → kirim ke Pak Andi
4. Pak Andi balas **dalam 2 menit**: kirim **3 foto tim main futsal pakai jersey buatan toko Sari** + caption *"Mantap kak, bahan adem, sablon awet ngga luntur. Insya Allah next month order lagi untuk varian away"*
5. Sari screenshot 3 foto itu, save ke folder `~/Konten/IG/jersey-futsal/24-Mei`
6. Kembali ke `/crm/follow-ups` → klik **✓ Selesai** di task Pak Andi
7. Modal "Catatan FU" muncul, isi:
   > *"Customer puas, dapat 3 foto tim + testimoni positif tentang bahan & sablon. Hint: akan order lagi varian away bulan depan → set reminder."*
8. Klik **Mark Done** → task ter-mark DONE, hilang dari pending, badge sidebar turun -1
9. Sari catat di kalender pribadi: 24 Juni, kontak Pak Andi tawarkan varian away

---

## ⏰ 09:30 — Pak Anto Balas (PT Bina)

Pesan dari Pak Anto masuk: *"OK kak, tim setuju. Lanjut order 30pcs jersey futsal seperti yang kemarin kami diskusikan. Boleh dijadwalkan?"*

Sari excited — closing!

1. Buka tab `/crm/leads` → cari card "PT Bina Sekolah" → klik
2. Detail drawer terbuka → klik **"Convert (Closing)"**
3. Modal Convert terbuka, centang:
   - ✅ Buat Customer Baru (data dari lead: PT Bina Sekolah · 0812345678)
   - ✅ Buat SPK (Sales Order) Draft → input designer: **Andi** (designer freelance VolikoPrint)
   - ✅ Buat Invoice Draft → type: **Invoice** (INV-...)
   - Catatan: *"Order 30 pcs jersey futsal custom desain, deadline 2 minggu. Customer minta warna utama biru-putih dengan logo sekolah di dada kiri."*
4. Klik **Convert** → loading 2 detik → alert popup:
   ```
   ✓ Lead di-convert berhasil!
   
   👤 Customer #15
   📋 SPK #28 (1 item dari katalog)
      🖼 3 gambar referensi di-copy ke SPK proof
   🧾 INV-20260524-001 (1 item)
   ```
5. Sari kabari Pak Anto via WA: *"Mantap kak, sudah kami input ya. Nomor SO #28 dan invoice INV-20260524-001 akan dikirim by tim kasir. Designer Andi akan kontak kakak untuk approval desain hari ini juga 🙏"*
6. Sari kembali ke `/crm/follow-ups` → cari task PT Bina yang masih pending → klik **✓ Selesai** dengan notes: *"Closing berhasil! Lead converted ke Customer #15 + SPK #28 + INV-20260524-001."*

---

## ⏰ 10:30 — Lead Baru Masuk dari Instagram DM

Notif WA dari rekan admin IG: *"Sis, ada lead DM IG @volikoprint dari toko 'Andini Sport Yogya', tanyain harga jersey 50pcs untuk komunitas lari."*

1. Sari buka `/crm/leads` → klik **"+ Lead Baru"**
2. Form terbuka, isi:
   - **Nama**: Andini Sport Yogya
   - **No. HP**: 081765432123 (dari profil IG)
     - **🔄 Sistem otomatis cek dedup** → banner kuning muncul: *"⚠️ Customer dengan HP serupa sudah terdaftar (1)"* dengan nama "Pak Andini Pratama" dari order sebelumnya 6 bulan lalu (jersey komunitas gowes)
     - Sari klik **"Pakai Data Ini"** → nama lead auto-fill jadi "Pak Andini Pratama" → no duplikat ✓
   - **Source**: INSTAGRAM
   - **Detail Sumber**: "IG @volikoprint - DM tanya jersey lari 50pcs"
   - **Level**: 🌤️ WARM
   - **Kebutuhan**: "Jersey lari komunitas 50pcs, deadline 3 minggu, budget 250rb/pcs. Sudah ada referensi desain (file PDF dikirim via WA)"
   - **Estimasi Nilai**: 12.500.000 (auto bisa dari items)
   - **Tanggal FU**: 27 Mei (3 hari lagi)
   - **CS yang Pegang Lead**: Sari (auto-select dari current user)
   - **Items**:
     - Klik "+ Tambah Produk" → pilih "Jersey Running Custom — Dryfit" dari katalog
     - Qty: 50, harga auto-fill 250.000 → subtotal Rp 12.500.000 ✓
   - **Gambar**: upload 2 screenshot DM IG + 1 file referensi desain (3 gambar total)
3. Klik **Simpan** → lead masuk ke kolom **NEW** di kanban
4. **Otomatis behind the scenes**: sistem create FollowUp record { type: LEAD_FU, due: 27 Mei, assigned: Sari, lead: Andini Sport }

Sari balas DM IG: *"Halo kak Andini! Untuk jersey running 50pcs sudah kami terima ya. Akan saya buatkan penawaran resmi sore ini. Tim desainer kami siap bantu finalisasi desain juga. 🙏"*

---

## ⏰ 12:00 — Lunch Break ☕

Sari makan siang. Saat kembali jam 13:00, refresh `/crm/follow-ups`.

---

## ⏰ 13:00 — Handle Task #3: SD Cendekia (LEAD_FU Hari Ini)

Section "Akan Datang" punya task SD Cendekia. Sari kontak via WA.

1. Klik **💬 WA** → pilih template **"Follow Up Lead Hari ke-3"**
2. Edit text sedikit untuk customize: tambahkan *"...kalau ada masukan dari komite sekolah, langsung saya bantu siapkan revisi penawaran ya kak"*
3. Copy + buka WA → kirim
4. Belum dapat respons setelah 30 menit. Sari refresh `/crm/leads` → drag card SD Cendekia di Kanban **dari kolom FOLLOW_UP ke NEGOTIATION** → status auto-update + activity log tercatat `STATUS_CHANGE`
5. Buka detail card → set tanggal FU baru: 26 Mei (besok lusa) → save
6. Task lama auto-update (tidak duplikat). Task baru muncul nanti.
7. Sari mark task SD Cendekia hari ini sebagai **✓ Selesai** dengan notes: *"Sudah kontak via WA, customer belum respons. Reschedule FU ke 26 Mei. Status pipeline naik ke NEGOTIATION karena ada kemungkinan deal."*

---

## ⏰ 13:30 — Handle Task #4: CV Maju Bersama (REPEAT_ORDER)

CV Maju Bersama customer lama yang sudah 5 bulan tidak order. Cron Senin pagi auto-create task ini.

1. Klik **💬 WA** → pilih template **"Repeat Order Nudge"**
2. Preview:
   > *"Halo kak CV Maju Bersama 👋 Sudah 5 bulan ya sejak order terakhir di VolikoPrint. Kalau ada agenda baru — turnamen, event, atau seragam — kami siap bantu dengan harga & timeline terbaik untuk customer langganan 🙏 Langsung balas chat ini kalau ada yang mau dibahas ya kak 🙌"*
3. Copy + kirim WA
4. Pak Heri (PIC CV Maju) balas: *"Wah pas banget kak, kami lagi pikirin seragam tim baru untuk acara company gathering bulan Juli. Bisa minta katalog?"*
5. Sari kirim katalog PDF + harga
6. Pak Heri: *"OK saya diskusi dulu, nanti kabari lagi minggu depan"*
7. Sari kembali ke `/crm/follow-ups` → klik **✓ Selesai** dengan notes: *"Customer interest tinggi, ada plan order seragam untuk gathering Juli. Akan kontak lagi minggu depan."*
8. Buka `/customers` → klik card CV Maju → buka detail (AnalyticsModal) → scroll ke section **CRM** → klik **+ Buat Follow-up** → tipe: LEAD_FU, due: 30 Mei (minggu depan), notes: *"Cek progress decision seragam gathering"*

---

## ⏰ 14:30 — Customer Walk-in di Toko

Mbak Risa, customer baru, datang ke toko pesan banner ulang tahun. Kasir (Pak Joko) handle transaksi langsung.

Sari tidak ter-libat di flow ini, tapi tahu kalau setelah pickup, akan auto-trigger after-sales task untuk dia (karena Mbak Risa belum punya CS assigned, default ke kasir Pak Joko).

---

## ⏰ 15:00 — Refresh Cek Task Baru

Sari refresh `/crm/follow-ups`. Muncul 1 task baru:

```
📦 AFTER_SALES · 27 Mei (3 hari lagi)
Bu Lia · Customer
📞 081555444333
notes: "Auto-scheduled setelah pickup. Hubungi customer untuk minta testimoni/foto pakai."
```

Bu Lia ambil pesanan tadi siang (banner promosi untuk warung baru). Task akan due hari Sabtu — Sari catat di kalender, weekend nanti chat dari rumah.

---

## ⏰ 15:30 — Cek Dashboard KPI Sebentar

Sari penasaran performance hari ini. Buka `/crm` dashboard, filter **"Hari Ini"**.

```
📊 Hari Ini (24 Mei 2026)
─────────────────────────────────────────
⏰ Response Time Avg: 1.2 jam
🎯 Closing Rate: 50% (1 dari 2 lead jadi)
✅ FU Compliance: 100% (4 dari 4 due hari ini done)
🔄 Repeat Order Rate: 12% (bulan ini)

🎨 Leads by Source (hari ini)
  ▰▰▰▰▰▰▰▰ Instagram (1)
  ▰▰▰▰▰▰▰▰ Walk-in (1)

🏆 Leaderboard CS
  🥇 Sari (saya) — 2 leads, 1 deal, 1.2h response
  🥈 Andre — 1 lead, 0 deal, 3.5h response
```

Sari puas — closing rate 50%, FU compliance 100%. Buat catatan pribadi: minggu depan ajak Andre share tips response time biar lebih cepat.

---

## ⏰ 16:30 — Final Check Sebelum Pulang

Sari refresh `/crm/follow-ups` terakhir kali:

```
🔥 OVERDUE (0) ✓
📅 AKAN DATANG (5)
  ├─ besok: 2 task
  ├─ 26 Mei: 1 task (SD Cendekia, dari reschedule)
  ├─ 27 Mei: 1 task (Andini Sport + Bu Lia)
  └─ 30 Mei: 1 task (CV Maju)
```

**Section Overdue kosong** — semua tugas hari ini sudah di-handle. 🎉

Sari pulang dengan tenang, tidak ada beban "siapa yang belum gua chat".

---

## 📊 Statistik Hari Sari

| Aktivitas | Jumlah |
|---|---|
| Tasks dikerjakan | 4 (1 LEAD_FU, 1 AFTER_SALES, 1 LEAD_FU SD Cendekia, 1 REPEAT_ORDER) |
| Lead baru di-input | 1 (Andini Sport via IG, dengan dedup-link ke customer existing) |
| Closing | 1 (PT Bina → SPK + Invoice + customer baru) |
| Foto testimoni dapat | 3 (dari Pak Andi) |
| Customer dormant di-aktifkan | 1 (CV Maju, plan order Juli) |
| Status update di Kanban | 1 (SD Cendekia: FOLLOW_UP → NEGOTIATION) |

---

## 💡 Yang Sari Dapatkan dari Halaman /crm/follow-ups

1. **Tidak ada lead yang lupa di-FU** — section Overdue kasih warning
2. **Tidak ada testimoni yang missed** — after-sales auto-trigger 3 hari pasca pickup
3. **Customer lama tidak hilang** — repeat order weekly nudge
4. **Tidak duplikat kontak** — phone dedup banner
5. **Workflow cepat** — Copy WA template dalam 5 detik
6. **Accountable** — semua aktivitas ter-track di activity log
7. **Kerjaan terjadwal** — tidak random scroll-scroll WA cari "siapa belum dichat"

Hari kerja Sari produktif & fokus — bukan reaktif (nunggu customer chat duluan) tapi proaktif (sistem reminder yang gerakin).

---

## 🎯 Lesson Learned untuk Owner

Setelah pakai CRM 1 bulan, Sari & tim bisa:
- Tingkatkan **closing rate** dari 30% → 50% (karena FU lebih konsisten)
- Naikan **repeat order rate** dari 8% → 20% (karena ada nudge weekly)
- Kumpulkan **testimoni 5x lebih banyak** (after-sales auto-trigger)
- Bisa evaluasi CS objective (KPI dashboard, leaderboard)

**Investment ROI**: Update PosPro v3.3 zero biaya hardware/license tambahan. ROI dari extra closing + repeat order menutupi development cost dalam bulan pertama.

---

> 📚 Lanjut baca: [CRM — Lead Pipeline & Follow-Up](crm.md) untuk dokumentasi teknis lengkap
