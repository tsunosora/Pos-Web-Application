# 🏢 Mode Cabang (Multi-Tenant per Branch)

> Panduan lengkap fitur **Mode Cabang** — memungkinkan PosPro mengelola beberapa toko cabang dalam satu sistem, dengan data operasional terpisah per cabang namun master data (produk, pelanggan, supplier) tetap bersama.

---

## 🎯 Apa itu Mode Cabang?

Mode Cabang adalah kemampuan PosPro untuk menjalankan **beberapa toko/cabang** dalam satu aplikasi yang sama. Setiap cabang punya **kasir sendiri, stok sendiri, kas sendiri, dan laporan sendiri** — tapi **katalog produk dan pelanggan tetap satu** agar ekspansi lebih mudah.

### Yang Terpisah per Cabang (Isolated)

| Data | Penjelasan |
|---|---|
| **User/Karyawan** | Tiap kasir/admin ter-lock di satu cabang — tidak bisa lihat data cabang lain |
| **Stok (BranchStock)** | Tiap cabang punya stok sendiri per varian. Produknya sama, stoknya beda |
| **Transaksi** | Penjualan, DP, kredit, invoice — tercatat di cabang transaksi terjadi |
| **Cashflow** | Arus kas (masuk/keluar) per cabang, saldo kas sendiri |
| **Tutup Shift** | Shift close per cabang — laporan WA ke grup berbeda |
| **Rekening Bank** | Tiap cabang punya rekening sendiri (atau share, fleksibel) |
| **Antrian Produksi & Print** | Job cetak/produksi muncul hanya di cabang yang order (atau cabang pelaksana titipan) |
| **Click Counting** | Meter mesin cetak per cabang (meter reading harian terpisah) |
| **Konfigurasi WA** | Grup laporan shift, broadcast, & SO design — per cabang |
| **PIN Operator Produksi** | PIN berbeda per cabang untuk akses halaman `/produksi` |
| **Identitas Nota** | Nama toko, alamat, telepon, logo, header/footer nota — per cabang |
| **Fee Titipan** | Persentase fee layanan saat menerima titipan cetak dari cabang lain (default 20%) |

### Yang Tetap Bersama (Global / Shared)

| Data | Alasan |
|---|---|
| **Katalog Produk** | Satu master → ganti harga sekali, berlaku semua cabang |
| **Kategori & Unit** | Tidak perlu duplikasi per cabang |
| **Pelanggan** | Pelanggan bisa belanja di cabang mana saja, history tercatat agregat |
| **Supplier** | Supplier biasanya melayani beberapa cabang |
| **Kalkulator HPP** | Worksheet biaya produksi, cost-agnostic per cabang |
| **Desainer (SO)** | Freelance designer bisa buat SO untuk cabang manapun |

---

## 👤 Konsep Role & Akses

PosPro pakai 2 tipe role dalam Mode Cabang:

### 1. Staff (Kasir / Admin / Manajer)
- **Wajib** di-assign ke satu cabang (`branchId` terisi)
- Hanya bisa login & lihat data **cabang itu saja**
- Tidak bisa switch cabang — locked via JWT
- Topbar tampilkan **badge cabang tetap** (contoh: `PST · Pusat`)

### 2. Owner / SuperAdmin
- `branchId` kosong (null) → akses semua cabang
- Di topbar muncul **dropdown switcher cabang** (kalau ada ≥2 cabang)
- Bisa pilih cabang aktif atau **"Semua Cabang"** untuk laporan agregat
- Role yang dianggap Owner: nama role persis `OWNER`, `SUPERADMIN`, atau `SUPER_ADMIN`

> Jika sistem baru punya **1 cabang saja** (cuma Pusat), dropdown switcher tidak muncul — cabang auto-pinned. Halaman POS, Tutup Shift, Opname jalan normal tanpa banner "Pilih Cabang Dulu".

---

## 🚀 Setup Awal: Tambah Cabang Baru

### Langkah 1 — Login sebagai Owner

Login pakai akun dengan role **Owner** atau **SuperAdmin** (`owner@voliko.com` atau setara). Akun staff biasa tidak bisa mengelola cabang.

### Langkah 2 — Buka Pengaturan Cabang

1. Sidebar → **Pengaturan → Daftar Cabang** (`/settings/branches`)
2. Klik **+ Tambah Cabang**
3. Isi form:
   - **Nama Cabang** (wajib) — contoh: `Voliko Cabang Sewon`
   - **Kode** (2–4 huruf, wajib) — contoh: `SWN` (dipakai di prefix nota & badge)
   - **Alamat** — alamat lengkap cabang
   - **Telepon** — nomor kontak
   - **Status Aktif** — centang kalau cabang sudah beroperasi

### Langkah 3 — Konfigurasi Per Cabang

Buka **Pengaturan → Pengaturan Per Cabang** (`/settings/branch-config`) dan pilih cabang baru dari daftar. Isi:

| Section | Keterangan |
|---|---|
| **Operator PIN** | PIN numerik untuk akses halaman `/produksi` cabang ini. Operator cabang lain tidak bisa pakai PIN ini |
| **WhatsApp Group — Report** | ID grup WA penerima laporan tutup shift cabang ini (format: `12345@g.us`). Dapat lewat perintah `!getgroupid` di grup |
| **WhatsApp Group — Broadcast** | ID grup untuk broadcast ke banyak grup (satu ID per baris) |
| **WhatsApp Group — Design** | Grup khusus approval desain SO (opsional) |
| **Identitas Toko** | Nama toko, alamat, telepon — muncul di nota cetak |
| **Logo URL** | URL logo yang tampil di nota (opsional) |
| **Nota Header/Footer** | Teks tambahan di atas/bawah nota cetak |

> **Kalau field ini dikosongkan, sistem fallback ke konfigurasi global** di `StoreSettings` dan `whatsapp_bot_config.json`. Jadi cabang yang belum atur WA group tetap bisa jalan — laporan akan kirim ke grup default.

### Langkah 4 — Buat User untuk Cabang Baru

1. **Pengaturan → Manajemen Akses & Karyawan** (`/settings/users`)
2. Klik **+ Karyawan Baru**
3. Isi data kasir/admin cabang
4. Pilih **Role** (Kasir, Admin, Manajer)
5. **Pilih Cabang** dari dropdown — wajib untuk role non-Owner
6. Set password → **Simpan**

Sekarang kasir tersebut bisa login dan otomatis masuk ke konteks cabang yang di-assign.

### Langkah 5 — Isi Stok Awal Cabang

Cabang baru punya stok **0 untuk semua varian**. Ada 2 cara mengisi:

**Opsi A — Pembelian Langsung ke Cabang**
1. Owner: switch ke cabang baru via dropdown topbar
2. Buka **Inventori → Pembelian**
3. Input pembelian dari supplier → stok langsung masuk ke BranchStock cabang itu

**Opsi B — Transfer dari Cabang Lain**
1. Owner: buka **Inventori → Transfer Stok** (`/inventory/transfer`)
2. Pilih cabang asal (mis. Pusat) dan cabang tujuan (mis. Sewon)
3. Cari produk & masukkan qty
4. Klik **Proses Transfer** → stok cabang asal berkurang, cabang tujuan bertambah
5. Tercatat sebagai 2 StockMovement (OUT + IN) untuk audit trail

---

## 🔄 Alur Harian per Cabang

### Kasir Cabang Sewon

1. **Login** dengan akun cabang Sewon (mis. `kasir.swn@voliko.com`)
2. Topbar tampilkan badge hijau `SWN · Voliko Cabang Sewon`
3. Buka **POS** — katalog produk sama (share global), tapi **stok yang tampil = stok Sewon saja**
4. Bertransaksi normal — transaksi tercatat `branchId=Sewon`
5. Antrian produksi cabang Sewon hanya menampilkan job dari transaksi Sewon
6. Akhir shift → Tutup Shift → laporan kirim ke grup WA Sewon (configured di `branch-config`)

### Owner / SuperAdmin

1. Login `owner@voliko.com`
2. Topbar tampilkan dropdown **"Pusat ▾"** (atau cabang terakhir yang dipilih)
3. **Pilih "Pusat"** → semua query (POS, laporan, cashflow, stok) scoped ke Pusat
4. **Pilih "Sewon"** → switcher invalidate cache → data refresh dengan stok & transaksi Sewon
5. **Pilih "Semua Cabang"** → laporan agregat gabungan semua cabang
   - POS diblock saat "Semua Cabang" dengan banner "Pilih cabang dulu"
   - Laporan penjualan, cashflow, HPP tetap jalan (menampilkan total semua cabang)

> **Tip**: Owner dengan 1 cabang saja tidak akan lihat dropdown — topbar tampilkan badge cabang tunggal. Ketika cabang kedua dibuat, dropdown otomatis muncul setelah refresh.

---

## 📦 Manajemen Stok per Cabang

### Konsep `BranchStock`

Dulu stok disimpan di `ProductVariant.stock` (satu angka global). Sekarang:

- **`ProductVariant.stock`** → dipertahankan sebagai **cache agregat** (total stok semua cabang)
- **`BranchStock(branchId, variantId, stock)`** → **sumber kebenaran** baru, stok per cabang

### Aturan Pengurangan Stok

| Event | Yang Berkurang |
|---|---|
| Transaksi di POS | `BranchStock(transaksi.branchId, varian)` — kalau 0, error "stok cabang ini 0" |
| Transfer stok | `BranchStock(asal)` berkurang, `BranchStock(tujuan)` bertambah |
| Produksi mulai | Kurangi stok bahan baku dari `BranchStock(job.branchId, bahan)` |
| Opname stok | Update `BranchStock` cabang sesi opname — tidak pengaruhi cabang lain |

### Tampilan di Inventori

- Staff / Owner pilih satu cabang → kolom **Stok** menampilkan stok cabang aktif
- Badge "Stok Menipis" di tiap cabang independen (cabang A bisa menipis, cabang B aman)
- Owner "Semua Cabang" → kolom stok menampilkan agregat global

### Laporan Stok Cabang

Menu **Laporan → Laporan Stok** tetap jalan — sekarang scoped ke cabang aktif. Filter:
- Cabang aktif di topbar menentukan data apa yang ditampilkan
- Filter IN / OUT / ADJUST tetap berlaku
- Export CSV otomatis include `branchId` dan `branchName`

---

## 💬 WhatsApp Bot per Cabang

### Alur Dispatch

Saat **Tutup Shift** cabang Sewon dikirim:
1. Sistem baca `BranchSettings(branchId=Sewon).waReportGroupId`
2. Kalau ada → kirim ke grup itu
3. Kalau kosong → fallback ke `whatsapp_bot_config.json > reportGroupId` (grup global)

Ini memudahkan transisi: cabang lama (Pusat) tetap kirim ke grup existing, cabang baru bisa atur grup baru tanpa mengganggu.

### Setup Grup Baru untuk Cabang

1. Bot WA sudah connected (lihat [WhatsApp Bot](#-9-pengaturan-whatsapp-bot))
2. Buat/buka grup "Laporan Cabang Sewon"
3. Tambahkan nomor bot ke grup
4. Di grup, ketik `!getgroupid` → bot balas dengan ID grup
5. Salin ID → buka **Pengaturan Per Cabang → Sewon → WA Report Group** → paste
6. Klik **Simpan**

Mulai shift berikutnya, laporan Sewon akan kirim ke grup ini.

---

## 📋 Skenario Umum & Contoh

### Skenario 1: Toko Baru Buka Cabang Kedua
**Situasi**: Voliko Pusat sudah berjalan, sekarang buka cabang Sewon.

**Langkah**:
1. Data lama → tetap di Pusat (migration sudah backfill otomatis)
2. Buka `/settings/branches` → tambah "Voliko Cabang Sewon" (code `SWN`)
3. Buka `/settings/branch-config` → pilih Sewon → atur PIN, WA group, identitas nota
4. Buat akun kasir Sewon di `/settings/users` dengan `branchId=Sewon`
5. Transfer stok awal: `/inventory/transfer` → Pusat → Sewon, pilih produk & qty
6. Owner login → dropdown muncul → Sewon siap pakai

### Skenario 2: Owner Lihat Laporan Konsolidasi
**Tujuan**: Lihat total penjualan semua cabang bulan ini.

**Langkah**:
1. Owner login → dropdown topbar → **"Semua Cabang"**
2. Buka **Laporan → Laporan Penjualan**
3. Pilih periode "Bulan Ini"
4. Laporan menampilkan angka gabungan Pusat + Sewon
5. Export Excel → kolom `branchId`/`branchName` ada di detail transaksi

### Skenario 3: Kasir Lupa Cabang
**Situasi**: Login tapi bingung di cabang mana.

**Solusi**: Cek badge di topbar (pojok kanan atas) — warna slate dengan nama cabang. Kalau tidak muncul badge, coba logout lalu login ulang.

### Skenario 4: Transfer Stok Tidak Cukup
**Situasi**: Mau transfer 10 pcs kertas dari Pusat ke Sewon, tapi Pusat hanya punya 5.

**Solusi**: Halaman transfer akan menolak dengan pesan "Stok cabang asal tidak mencukupi". Tambah stok Pusat dulu via Pembelian, atau sesuaikan qty transfer.

### Skenario 5: Pisahkan Rekening Bank Cabang
**Situasi**: Cabang Sewon punya rekening BCA terpisah dari Pusat.

**Langkah**:
1. Owner: switch ke Sewon di dropdown
2. **Pengaturan → Rekening Bank** → tambah rekening BCA Sewon
3. Rekening ini otomatis ter-tag `branchId=Sewon` — hanya tampil saat Sewon aktif
4. Transaksi transfer di POS Sewon hanya bisa pilih rekening Sewon

### Skenario 6: Titip Cetak ke Cabang Lain
**Situasi**: Cabang Bantul terima order banner besar tapi tidak punya mesin large format. Pusat punya. Mau titip cetak ke Pusat.

**Langkah**:
1. Kasir Bantul → POS → tambah produk → klik toggle **"Titip Cetak"** di header cart → pilih Pusat
2. Customer bayar Rp 200rb di Bantul (revenue masuk cashflow Bantul)
3. Stok bahan otomatis dipotong dari **BranchStock Pusat** (cabang pelaksana)
4. Job otomatis muncul di **Titipan Masuk** Pusat (popup notif kuning)
5. Operator Pusat klik "Terima & Kerjakan" → job masuk antrian `/produksi` Pusat
6. Operator selesai → klik "Tandai Siap Diambil" → notif hijau muncul di Bantul
7. Customer ambil di Bantul → kasir klik "Konfirmasi Sudah Diambil"
8. Sistem auto-catat hutang Bantul → Pusat di **Buku Titipan**: HPP bahan + fee 20% (configurable)
9. Bantul settle: bayar tunai (transfer rekening) atau kirim balik bahan setara nilai

Detail lengkap: **[🔁 Titip Cetak](titip-cetak.md)** dan **[📒 Buku Titipan](buku-titipan.md)**.

---

## ⚠️ Troubleshooting

### "Cabang wajib dipilih untuk role non-Owner"
Terjadi saat create/edit user non-Owner tanpa pilih cabang. Solusi: pilih cabang di dropdown modal edit user.

### "Stok cabang ini 0"
Cabang baru belum ada stok. Solusi: lakukan Pembelian atau Transfer Stok dulu.

### Dropdown switcher tidak muncul untuk Owner
- Pastikan role user **persis** `Owner`, `SuperAdmin`, atau `Super_Admin` (case-insensitive)
- Kalau cabang aktif hanya 1, dropdown memang disembunyikan (pakai badge statis)
- Cek bahwa ada ≥2 cabang dengan `isActive=true`

### Data cabang Pusat "tidak muncul" setelah switch
Klik dropdown → pilih ulang cabang. BranchSwitcher melakukan `queryClient.invalidateQueries()` otomatis, tapi kalau masih aneh: F5 refresh halaman.

### WA laporan shift kirim ke grup salah
Cek `/settings/branch-config` → pilih cabang → pastikan `waReportGroupId` benar. Kalau kosong, sistem fallback ke `whatsapp_bot_config.json > reportGroupId` (grup global default).

### Transfer stok error di Windows ("EPERM" Prisma client)
Ini karena Prisma client belum regenerate (backend DLL ter-lock). Solusi: stop backend → `npx prisma generate` → restart backend. Atau tunggu build ulang berikutnya — kode pakai pola `(prisma as any).branchStock` supaya tetap jalan tanpa regenerate client.

---

## 🔐 Keamanan Scoping

Semua endpoint backend yang menangani data operasional memakai decorator `@CurrentBranch()` yang:

1. Untuk **staff**: baca `branchId` dari JWT (hard-locked, header `X-Branch-Id` diabaikan)
2. Untuk **Owner**: baca header `X-Branch-Id` dari request (dikirim axios interceptor dari `activeBranchId` di store)
3. Endpoint filter/write memakai helper:
   - `branchWhere(ctx)` — tambah `WHERE branchId = ?` ke query
   - `requireBranch(ctx)` — throw kalau branchId null (untuk endpoint create/write)
   - `assertBranchAccess(ctx, resourceBranchId)` — cek kalau update/delete data cabang lain

Audit endpoint: `branch-context.decorator.ts`, `branch-where.helper.ts` — semua service yang butuh scoping pakai pola ini.

---

## 📚 Referensi Teknis

Untuk developer yang ingin mengembangkan fitur baru dengan scoping cabang:

- **Schema**: `backend/prisma/schema.prisma` — model operasional pasti punya `branchId Int?` + relasi ke `CompanyBranch`
- **Decorator**: `backend/src/common/branch-context.decorator.ts`
- **Helper**: `backend/src/common/branch-where.helper.ts`
- **Migration script**: `backend/prisma/scripts/multi-branch-init.ts` — untuk init awal / backfill data lama
- **Frontend store**: `frontend/src/store/branch-store.ts` (Zustand)
- **Switcher**: `frontend/src/components/layout/BranchSwitcher.tsx`
- **Axios interceptor**: `frontend/src/lib/api/client.ts` (inject `X-Branch-Id`)

> **Rule**: setiap endpoint baru yang menangani data operasional (stok, transaksi, kas, job) **wajib** pakai `@CurrentBranch()` + filter via `branchWhere(ctx)`. Tanpa itu, data cabang bocor ke cabang lain.

---

## 🔗 Fitur Lanjutan Multi-Cabang

| Fitur | Wiki |
|---|---|
| **🔁 Titip Cetak** — kasir A bikin nota, dicetak di cabang B | [titip-cetak.md](titip-cetak.md) |
| **📒 Buku Titipan** — auto-catat hutang/piutang antar cabang dari titip cetak | [buku-titipan.md](buku-titipan.md) |
| **🎨 Sales Order & Designer Portal** — workflow desainer freelance bikin SO, broadcast WA per cabang | [sales-orders.md](sales-orders.md) |

---

*Terakhir diperbarui: 26 April 2026 | Mode Cabang v1.2 — Titip Cetak + Buku Titipan + Designer Portal multi-cabang*
