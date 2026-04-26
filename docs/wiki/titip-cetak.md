# 🔁 Titip Cetak Antar Cabang

> Fitur memungkinkan **kasir cabang A** menerima order customer untuk dicetak/diproduksi di **cabang B** (yang punya mesin atau bahan). Customer tidak perlu tahu — bayar di A, ambil di A. Backend otomatis routing job ke cabang B & catat semua keuangannya.

---

## 🎯 Use Case

- Cabang Bantul cuma punya printer kecil. Customer pesan banner besar 3×2m → titip cetak ke Pusat (yang punya mesin large format).
- Cabang Sewon overload order → operator titip ke Pusat sebagai bantuan kapasitas.
- Cabang baru belum punya stok kertas khusus → titip ke Pusat selama bulan transisi.

Tanpa fitur ini, kasir Bantul harus menelepon Pusat manual, kirim foto WA, atur kurir, dan catat manual di buku — ribet, error-prone, & tidak ada audit trail.

---

## 🎨 Toggle "Titip Cetak" di POS Kasir

Di halaman `/pos`, panel kanan (cart sidebar) ada **banner sticky** tepat di bawah header "Keranjang":

### Mode Normal (Cetak di Cabang Ini)

Banner abu-abu netral:
- Icon 🏢 **Building**
- Label: **"Cetak di Cabang Ini"**
- Subtitle: "Antrian produksi & stok di cabang aktif"
- Tombol **kuning prominent**: **"Titip Cetak"**

Klik tombol → banner berubah ke mode amber.

### Mode Titip Aktif

Banner amber dengan:
- Icon ✈️ **Send**
- Label: **"TITIP CETAK ke Cabang Lain"**
- **Dropdown** cabang tujuan (auto-select cabang pertama yang available)
- Tombol outline **"Batal Titip"** untuk kembali normal
- Footer info kuning:
  > 💡 Pendapatan tetap masuk cabang ini. Stok bahan & antrian produksi tercatat di cabang tujuan. Auto-tercatat di Buku Titipan saat cetakan diserahkan.

Banner hanya muncul kalau ada **≥ 2 cabang aktif**. Kalau cuma 1 cabang, toggle disembunyikan.

---

## 🔄 Flow Lengkap End-to-End

```
[CABANG A — Kasir]                      [CABANG B — Operator]
─────────────────                       ────────────────────
1. Tap Titip Cetak → pilih B
2. Customer bayar Rp 200rb
3. Submit checkout
   ├─ Stok bahan dipotong dari B (BranchStock Pusat)
   ├─ ProductionJob/PrintJob dibuat dengan branchId=B
   └─ InterBranchLedger PENDING ← auto-create
                                       4. Notif kuning popup "Titipan Masuk"
                                          (Titipan Masuk Inbox)
                                       5. Klik "Terima & Kerjakan"
                                          → handover_status: BARU → DIPROSES
                                          → Job muncul di /produksi atau /print-queue
                                          dengan badge ⚑ Titipan BTL → PST
                                       6. Operator kerjakan job
                                          (klik Mulai → Selesai)
                                       7. Klik "Tandai Siap Diambil"
                                          → handover_status: SIAP_AMBIL
8. Notif HIJAU popup "Cetakan Sudah Jadi"
   (Titipan Outbox Ready)
9. Customer datang ambil
10. Klik "Konfirmasi Sudah Diambil"
    → handover_status: DISERAHKAN
    → Auto re-trigger ledger create
      (idempotent — skip kalau sudah ada)
11. Buka Buku Titipan → Bayar tunai/stok ke B
```

---

## 📦 Aturan Stok Bahan

Stok bahan **selalu dipotong dari cabang pelaksana** (`productionBranchId`), bukan cabang pemesan. Logic-nya:

```ts
const stockBranchId = productionBranchId ?? branchId;
// Kalau titip cetak: productionBranchId != null & beda branch → stockBranchId = pelaksana
// Kalau bukan titip: productionBranchId null → fallback ke branchId pemesan
```

Dipakai konsisten di:
- Variant utama (UNIT & AREA_BASED)
- Product-level BOM (ingredients)
- Variant-level BOM (variantIngredients)
- Restore saat hapus/edit transaksi (✓ fix penting — kalau salah → inflasi stok pemesan)

> **Catatan**: untuk produk AREA_BASED dengan `requiresProduction=true`, stok bahan baru dipotong saat operator klik **"Mulai Job"** di `/produksi` (bukan saat checkout). Stok dipotong dari `job.branchId` yang juga = `productionBranchId`.

---

## 🎟️ Antrian Produksi & Cetak Paper

Jobs dari titipan otomatis muncul di **cabang pelaksana**:

| Halaman | Yang Ditampilkan |
|---|---|
| `/produksi` cabang Pusat | ProductionJob (AREA_BASED, requires production) dari semua transaksi Pusat **+ titipan dari cabang lain** |
| `/print-queue` cabang Pusat | PrintJob (UNIT/AREA_BASED dengan ClickRate) dari Pusat **+ titipan dari cabang lain** |
| `/produksi` cabang Bantul | Hanya job Bantul. Titipan keluar tidak muncul (karena tidak dikerjakan di sini) |

### Badge Indikator di Job Card

| Badge | Arti |
|---|---|
| 🏢 **PST** (sky) | Job dari nota cabang Pusat sendiri |
| ⚑ **Titipan BTL** (amber) | Job dari nota cabang Bantul, dititipkan ke kita untuk dikerjakan |

Hover badge untuk tooltip lengkap (`Titipan cetak dari cabang Bantul → Pusat`).

### Filter Pending Titipan

Job titipan **DISEMBUNYIKAN** dari `/produksi` dan `/print-queue` cabang pelaksana selama `handover_status` masih `BARU` (belum di-acknowledge operator). Tujuan: operator harus klik "Terima & Kerjakan" dulu di Inbox sebelum job muncul di antrian — supaya tahu ada titipan baru.

Kriteria filter (di `production.service.ts` & `print-queue.service.ts`):
```ts
if (transaction.productionBranchId != transaction.branchId
    && (handoverStatus IS NULL OR handoverStatus = 'BARU')) {
    HIDE this job
}
```

---

## 📥 Titipan Masuk (Inbox Cabang Pelaksana)

Halaman: `/titipan-masuk`

| Tab | Isi |
|---|---|
| **BARU** | Titipan baru masuk, belum di-acknowledge operator |
| **DIPROSES** | Sudah Terima, sedang dikerjakan |
| **SIAP_AMBIL** | Selesai cetak, menunggu customer ambil |
| **DISERAHKAN** | Sudah selesai siklus |
| **ALL** | Semua |

Setiap entry tampilkan:
- Nomor invoice asal
- Cabang pemesan (badge sky)
- Nama customer + telepon
- Daftar item titipan
- Catatan produksi
- Tombol aksi sesuai status:
  - **Terima & Kerjakan** (kalau BARU)
  - **Tandai Siap Diambil** (kalau DIPROSES)
  - **Diserahkan** (kalau SIAP_AMBIL — opsional, biasanya kasir A yang konfirmasi)

### Notifikasi Popup BARU

Polling setiap **15 detik**. Saat ada titipan baru status BARU yang belum di-acknowledge, banner kuning floating muncul di pojok layar (semua halaman kecuali cetak/print preview). Klik banner → langsung redirect ke `/titipan-masuk`.

---

## 📤 Titipan Keluar (Outbox Cabang Pemesan)

Halaman: `/titipan-keluar`

Mirror dari Titipan Masuk — kasir A bisa pantau status titipan-titipan yang dia kirim ke cabang lain.

| Tab | Isi |
|---|---|
| **BARU** | Sudah submit, belum di-acknowledge operator |
| **DIPROSES** | Operator B sudah Terima |
| **SIAP_AMBIL** | Cetakan sudah jadi, siap ambil di sini |
| **DISERAHKAN** | Sudah selesai |
| **ALL** | Semua |

Tombol aksi:
- **Konfirmasi Sudah Diambil** (kalau SIAP_AMBIL) — kasir A klik saat customer datang ambil cetakan, tutup siklus.

### Notifikasi Popup SIAP_AMBIL

Saat operator B klik **"Tandai Siap Diambil"**, polling deteksi → banner **hijau emerald** floating muncul di cabang A: *"Cetakan sudah jadi siap diambil!"*. Klik → redirect ke `/titipan-keluar` tab SIAP_AMBIL.

Polling: 15 detik. State ack tersimpan di `localStorage` (`branch-outbox-ready-ack-ids`) supaya tidak spam notif berulang.

---

## 💰 Aspek Keuangan (Buku Titipan)

Saat handover sukses (`DISERAHKAN`), sistem otomatis hitung hutang A ke B berdasarkan:
- HPP bahan × qty
- Plus fee layanan (`titipanFeePercent`, default 20%)

Detail lengkap → [📒 Buku Titipan Antar Cabang](buku-titipan.md).

Singkatnya:
- **Revenue customer** Rp 200rb → masuk cashflow A (sesuai realita fisik)
- **Hutang A → B** Rp 96rb (HPP 80rb + fee 16rb) → otomatis tercatat di `inter_branch_ledger`
- A bayar B (tunai atau kirim bahan) → `LedgerSettlement` + cashflow pair

---

## 🏷️ Badge Titipan di Berbagai Halaman

Konsistensi visual badge `⚑ Titipan BTL → PST` (amber) atau `🏢 PST` (sky biasa) ada di:

- `/produksi` (job card di antrian produksi cabang pelaksana)
- `/print-queue` (job card antrian cetak paper)
- `/cetak` (operator paper print public page)
- `/transactions/[id]` (detail nota — header badge)
- `/reports/stock` (kolom Keterangan saat klik link nota)
- `/inventory` Riwayat Stok modal (per varian)

---

## ⚙️ Setup Awal

### Prasyarat
1. ≥2 cabang aktif (`/settings/branches`)
2. Tiap cabang punya operator PIN dan staff (`/settings/branch-config` & `/settings/users`)

### Aktifkan
Tidak perlu setting khusus. Begitu cabang kedua dibuat, toggle "Titip Cetak" otomatis muncul di POS untuk kasir manapun.

### Konfigurasi Fee (untuk Buku Titipan)
1. Owner: `/settings/branch-config`
2. Pilih cabang yang akan jadi pelaksana (mis. Pusat)
3. Card "Titipan Antar Cabang" → set "Fee Titipan Masuk (%)"
4. Default 20%, set sesuai negosiasi internal antar cabang

---

## 🧪 Testing Flow Cepat

1. Login kasir Bantul → `/pos`
2. Tambah produk Banner 1×1m → toggle **"Titip Cetak"** → pilih Pusat
3. Customer name "Test Titipan" → checkout cash Rp 100rb
4. Buka new tab login operator Pusat → `/titipan-masuk` → muncul "Test Titipan" dengan badge `BTL`
5. Klik **Terima & Kerjakan** → status DIPROSES
6. Buka `/produksi` → job muncul dengan badge `⚑ Titipan BTL`
7. Klik Mulai → pilih roll → klik Selesai
8. Balik ke `/titipan-masuk` → klik **Tandai Siap Diambil**
9. Switch ke kasir Bantul → notif hijau muncul "Cetakan Sudah Jadi"
10. Buka `/titipan-keluar` → klik **Konfirmasi Sudah Diambil**
11. Buka `/branch-ledger` → entri PENDING dengan hutang Rp HPP×1.2 ke Pusat
12. Bayar Tunai atau Kirim Bahan → SETTLED ✓

---

## ⚠️ Troubleshooting

### Toggle "Titip Cetak" tidak muncul
- Cek hanya ada 1 cabang aktif. Tambah cabang baru di `/settings/branches`
- Refresh halaman POS setelah tambah cabang

### Job titipan tidak muncul di /produksi atau /print-queue cabang pelaksana
- Cek operator sudah klik **Terima & Kerjakan** di `/titipan-masuk` (status: DIPROSES, bukan BARU)
- Untuk PrintJob: produk harus punya `clickRate` aktif (kalau tidak, PrintJob tidak terbentuk)

### Stok berkurang di cabang pemesan, bukan pelaksana
- Bug ini sudah di-fix April 2026. Kalau masih terjadi, restart backend untuk apply fix
- Untuk koreksi data lama yang sudah inflate: lakukan **Stok Opname** fisik di kedua cabang

### Notifikasi cetakan siap tidak muncul
- Cek polling jalan (DevTools → Network → request `/branch-inbox/ready-outbox` setiap 15s)
- Cek `localStorage.branch-outbox-ready-ack-ids` — kalau ID-nya sudah ke-ack, notif tidak muncul lagi (sengaja). Hapus key kalau mau test ulang

### Hutang tidak masuk Buku Titipan
- Cek transaksi memang `productionBranchId != null && != branchId`
- Cek log `[createLedgerEntry]` di terminal backend
- Kalau handover sudah DISERAHKAN tapi ledger kosong, klik ulang button (idempotent — tidak duplikat)

---

## 🔗 Halaman Terkait

- [🏢 Mode Cabang](mode-cabang.md) — fondasi multi-cabang
- [📒 Buku Titipan](buku-titipan.md) — settlement keuangan
- [🖨️ Antrian Produksi](produksi.md) — kerjakan job
- [🖨️ Antrian Cetak Paper](mesin-cetak.md) — print queue paper

---

*Terakhir diperbarui: 26 April 2026 | Titip Cetak v1.1 (POS toggle prominent + badge konsisten + Buku Titipan integration)*
