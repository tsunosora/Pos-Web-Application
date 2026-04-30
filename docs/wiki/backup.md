# 💾 Backup & Restore Data

> Panduan lengkap untuk mengekspor data ke file ZIP dan memulihkan data dari backup.

---

## Apa itu Fitur Backup?

Fitur **Backup & Restore** memungkinkan Anda mengekspor seluruh (atau sebagian) data database PosPro ke dalam satu file ZIP. File tersebut bisa disimpan sebagai cadangan dan digunakan untuk memulihkan data jika terjadi masalah.

Manfaat:
- **Cadangan berkala** sebelum update sistem
- **Migrasi data** ke server baru
- **Pemulihan data** setelah kerusakan atau kesalahan input massal

---

## Halaman Backup

Buka **Pengaturan → Backup & Restore** (`/settings/backup`).

---

## Export (Membuat Backup)

### Langkah-langkah Export

1. Buka halaman **Pengaturan → Backup & Restore**
2. Di panel **Export**, pilih **grup data** yang ingin dicadangkan:
   - Centang grup yang diperlukan (contoh: Produk, Transaksi, Pelanggan)
   - Atau klik **Pilih Semua** untuk mencadangkan seluruh database
3. Atur opsi **Sertakan Gambar**:
   - **Aktif** (default): gambar produk, logo, dan foto bukti ikut dimasukkan ke dalam ZIP
   - **Nonaktif**: hanya data teks/angka dari database, ukuran file lebih kecil
4. Klik **Export** — file ZIP langsung diunduh ke komputer Anda

> **Catatan Teknis**: File ZIP di-*stream* langsung ke browser tanpa dibuffer di memori server. Ini berarti export data besar tetap efisien dan tidak membebani server.

### Grup Data yang Tersedia

Endpoint `GET /backup/groups` mengembalikan daftar grup yang bisa dipilih. Versi backup saat ini adalah **3.2** (Mode Cabang Multi-Tenant + Buku Titipan Paper Print Settlement) dengan grup berikut:

| Grup | Isi |
|---|---|
| 🏷️ Master Data | Role, kategori, unit, store settings, bank, branch (peta) |
| 🏢 Cabang & Pengaturan Cabang | `companyBranch`, `branchSettings` (PIN, WA group, fee titipan), `branchStock` (stok per cabang) |
| 👤 Pengguna | User + branch assignment + role |
| 📦 Produk & Inventori | Produk, varian, BOM, harga tier, batch, stock movement, pembelian stok |
| 🚚 Supplier | Supplier dan harga beli |
| 👥 Pelanggan | Database pelanggan (share antar cabang) |
| 🧮 HPP & Costing | Worksheet HPP + variable cost + fixed cost |
| 💰 Transaksi & Penjualan | Transaksi, item, cashflow, edit/change request |
| 📄 Invoice & Penawaran | Invoice + SPH (Quotation) |
| 🎨 Sales Order & Designer | SO B2B + designer portal data |
| 🏭 Produksi & Antrian Cetak | Production batch/job + print queue |
| 🔁 Work Order Antar Cabang | `branchWorkOrder` (cabang minta order ke pusat — model lama) |
| 🔄 Transfer Stok Antar Cabang | `stockTransfer`, `stockTransferItem` (transfer bahan dari cabang A ke B) |
| 📒 Buku Titipan Antar Cabang (Paper Print Settlement) | `interBranchLedger`, `ledgerSettlement` — settlement titipan paper print (cabang ganti bahan + biaya klik). **Banner tidak masuk ledger** — tracking via StockMovement & laporan `/reports/inter-branch-usage` |
| 🖨️ Click Counting | Tarif klik + log mesin + meter reading + reject |
| 📋 Stok Opname | Sesi opname + item opname |
| 📊 Laporan Shift | Shift report + competitor (peta cuan) |

> **Catatan tentang Bahan Titipan**: Laporan `/reports/inter-branch-usage` (audit bahan Pusat dipakai cabang) **tidak butuh tabel sendiri** — diturunkan dari `stock_movements` saat di-render. Backup `stockMovement` di grup "Produk & Inventori" sudah cukup untuk preserve riwayat tracking.

> **Catatan kompatibilitas:**
> - **File backup v2.x** (single-tenant lama) tetap bisa di-restore — tabel multi-cabang baru akan kosong, data lama auto-tag ke cabang Pusat
> - **File backup v3.0** (Mode Cabang awal) tetap bisa di-restore — tabel `interBranchLedger`/`ledgerSettlement`/`stockTransfer` akan kosong (tidak crash karena urutan FK sudah dijaga di RESTORE_ORDER)
> - **File backup v3.1** punya 4 tabel tambahan; kalau di-restore di sistem schema lama yang belum punya tabel itu, akan di-skip silent (tidak fatal)
> - **File backup v3.2** TIDAK punya tabel baru — hanya bump versi karena perubahan **logika & default**:
>   - `BranchSettings.titipanFeePercent` default `0` (sebelumnya 20). Sesuai konsep 1 owner / 1 perusahaan: tidak ada margin antar cabang, cabang ganti real cost saja.
>   - **Banner-only titipan tidak masuk ledger** lagi (tracking via StockMovement). Hanya paper print (yang ada biaya klik mesin) yang dapat entry ledger formal untuk settlement.
>   - Backup v3.2 100% kompatibel di-restore di sistem v3.1 (tabel sama persis).

---

## Preview Sebelum Restore

Sebelum melakukan restore, Anda bisa **preview** isi file backup:

1. Klik tombol **Preview Backup**
2. Upload file ZIP backup
3. Sistem menampilkan ringkasan: berapa record per tabel yang ada di dalam file
4. Tinjau informasi ini sebelum memutuskan apakah akan melanjutkan restore

---

## Restore (Memulihkan dari Backup)

> ⚠️ **Peringatan**: Restore adalah operasi yang **tidak bisa dibatalkan**. Selalu buat backup terbaru sebelum melakukan restore.

### Langkah-langkah Restore

1. Di panel **Restore**, klik **Pilih File** dan unggah file ZIP backup
2. Pilih **Mode Restore**:
   - **Skip** — data yang sudah ada di database dibiarkan, hanya data baru yang ditambahkan
   - **Overwrite** — data yang sudah ada akan **ditimpa** dengan data dari backup
3. Klik **Mulai Restore**
4. Tunggu proses selesai — sistem menampilkan ringkasan berapa record berhasil diimpor

### Perbedaan Mode Skip vs Overwrite

| Skenario | Skip | Overwrite |
|---|---|---|
| Record dengan ID yang sama sudah ada | Dilewati | Ditimpa dengan data backup |
| Record baru (ID belum ada di DB) | Dimasukkan | Dimasukkan |
| Cocok untuk | Menambah data ke DB yang sudah berisi | Mengembalikan DB ke kondisi snapshot backup |

---

## Endpoint API (Untuk Developer)

| Method | Endpoint | Fungsi |
|---|---|---|
| `GET` | `/backup/groups` | Ambil daftar grup data yang bisa di-export |
| `POST` | `/backup/export` | Export data ke ZIP (returns binary stream) |
| `POST` | `/backup/preview` | Preview isi file backup tanpa merestore |
| `POST` | `/backup/restore` | Restore data dari file ZIP |
| `GET` | `/backup/rclone/status` | Status rclone (installed, enabled, last backup, local files) |
| `POST` | `/backup/rclone/settings` | Simpan pengaturan rclone (remote, jadwal, keep count) |
| `POST` | `/backup/rclone/trigger` | Jalankan backup rclone manual |

> **Catatan**: `POST /backup/export` mengembalikan **binary stream** (bukan JSON). Jika memanggil endpoint ini dari kode, pastikan response type diset ke `blob` atau `arraybuffer`, bukan JSON.

---

## ☁️ Backup Otomatis via Rclone ⭐

Selain backup manual, PosPro mendukung **backup otomatis terjadwal** menggunakan [rclone](https://rclone.org) — tools open-source untuk sync file ke cloud storage.

### Prasyarat

1. **Rclone terinstal** di server backend — install dengan:
   ```bash
   curl https://rclone.org/install.sh | sudo bash
   ```
2. **Remote dikonfigurasi** — jalankan `rclone config` di server untuk setup koneksi ke Google Drive, S3, Dropbox, dll.

### Cara Mengaktifkan

Buka **Pengaturan → Backup & Restore** → scroll ke bagian **Backup Otomatis via Rclone**.

**Step 1 — Remote Destination**
- Isi path tujuan rclone, contoh: `gdrive:Backups/PosPro` atau `s3:mybucket/pospro`
- Format: `nama-remote:path/tujuan`
- Kosongkan jika hanya ingin backup lokal tanpa upload ke cloud

**Step 2 — Jadwal Otomatis**
- Pilih dari preset yang tersedia:

| Preset | Cron |
|---|---|
| Setiap hari jam 02:00 | `0 2 * * *` |
| Setiap hari jam 23:00 | `0 23 * * *` |
| Setiap 12 jam | `0 */12 * * *` |
| Setiap Senin jam 02:00 | `0 2 * * 1` |
| Setiap minggu (Minggu jam 01:00) | `0 1 * * 0` |

**Step 3 — Jumlah File Lokal**
- Tentukan berapa file backup disimpan di server (3, 5, 7, 14, atau 30)
- File lama dihapus otomatis saat melebihi batas
- Disimpan di `backend/backups/`

**Step 4 — Aktifkan & Simpan**
- Toggle switch **Auto-backup aktif/nonaktif**
- Klik **Simpan Pengaturan**

### Backup Manual (Trigger)

Klik tombol **Backup Sekarang** untuk menjalankan backup secara manual. Status backup terakhir (berhasil/gagal) dan daftar file lokal ditampilkan di bagian bawah panel.

### Informasi Status

| Field | Keterangan |
|---|---|
| Versi rclone | Versi yang terinstal di server |
| Status terakhir | Berhasil / Gagal dengan keterangan |
| Tanggal backup terakhir | Timestamp backup terakhir |
| File backup lokal | Daftar file backup di server beserta ukurannya |

---

## Catatan Penting

- **Backup rutin dianjurkan** — minimal seminggu sekali, atau sebelum setiap update sistem
- **Aktifkan Rclone** untuk backup otomatis ke cloud — lebih aman dari kerusakan hardware
- **Simpan file backup di lokasi terpisah** dari server (hard drive eksternal, cloud storage)
- **Ukuran file** tergantung jumlah data dan apakah gambar disertakan:
  - Tanpa gambar: biasanya beberapa MB
  - Dengan gambar: bisa puluhan hingga ratusan MB tergantung banyaknya foto produk
- **Mode Overwrite** cocok untuk disaster recovery; **Mode Skip** cocok untuk merge data dari dua instalasi berbeda

---

*Wiki PosPro — Backup & Restore | April 2026*

**© 2026 Muhammad Faisal. All rights reserved.**
