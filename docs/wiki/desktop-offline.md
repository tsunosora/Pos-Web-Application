# 🖥️ Aplikasi Desktop 100% Offline

PosPro tersedia sebagai **aplikasi desktop Windows (Electron)** yang menjalankan **stack penuh secara lokal** — `MariaDB (embedded) → NestJS backend → frontend Next.js` — di dalam satu proses supervisor. Seluruh fitur (kasir, stok, laporan, CRM) jalan **tanpa internet**; data lokal tersinkron dua arah ke server pusat saat online (model *single-device local-primary*).

> **Untuk pengguna akhir?** Lompat ke [Cara Pakai](#cara-pakai-pengguna). Sisanya adalah referensi teknis (build, konfigurasi, env).

---

## Kenapa Ada Versi Desktop?

Versi web/PWA butuh koneksi ke server. Bila internet cabang tidak stabil, kasir bisa berhenti total. Versi desktop membawa database + backend di dalam komputer sehingga:

- **Kasir tetap jalan** meski internet putus — transaksi, cetak, stok, laporan semua lokal.
- **Tidak ada agen `.bat`/Python** untuk cetak — printer diakses langsung dari proses utama.
- **Data aman berlapis** — auto-backup lokal + sinkron ke pusat.

Versi web/PWA tetap tersedia dan berbagi data yang sama lewat pusat.

---

## Cara Pakai (Pengguna)

### Pemasangan pertama (first-run)

1. **Install** — jalankan installer `.exe`. Database & backend sudah dibundel; tidak perlu install MariaDB/Node terpisah.
2. **Daftarkan perangkat ke pusat** — masukkan alamat server pusat + **token pendaftaran** (dari Owner). Perangkat mendapat **device-token permanen** yang aman meski database di-reset.
3. **Data awal terunduh** — produk, user, dan master data ditarik dari pusat. Sesudah ini login & transaksi jalan penuh tanpa internet.

### Operasional harian

- Transaksi offline disimpan lokal, lalu **otomatis dikirim ke pusat** begitu online.
- Perubahan master data di pusat (produk/harga/user) **turun otomatis** ke perangkat pada interval sinkron.
- Cetak nota thermal langsung ke printer — lihat [Nota Thermal 58mm](nota-thermal-58mm.md).

> ⚠️ **Sinkron sebelum perangkat hilang.** Transaksi offline baru benar-benar aman setelah tersinkron ke pusat. Pastikan perangkat online berkala agar data tidak hilang bila komputer rusak/hilang.

### Backup, recovery & reset

| Fitur | Fungsi |
|-------|--------|
| **Auto-backup** | Otomatis tiap aplikasi dibuka (sebelum migrasi), rotasi 7 terakhir di `userData/backups/` |
| **Backup manual** | Simpan file `.sql` ke lokasi pilihan (dialog simpan, `mariadb-dump`) |
| **Recovery** | Bila database lokal rusak (korupsi), aplikasi menawarkan re-init + bootstrap ulang dari pusat |
| **Reset** | Hapus data lokal → relaunch → tarik ulang dari pusat. **Device-token dipertahankan** (tidak membuat perangkat ganda) |

### Update otomatis

Saat versi baru tersedia, aplikasi menampilkan **banner notifikasi di dalam aplikasi** — klik **Unduh** lalu **Pasang**. Tidak perlu mengunduh installer manual.

---

## Referensi Teknis

### Arsitektur

Electron menjadi *supervisor* 3 proses lokal:

```
Electron (main)
 ├─ 1. MariaDB embedded   (biner portabel, data dir di userData/db)
 ├─ 2. NestJS backend     (Electron-as-Node, connect MariaDB lokal)
 └─ 3. frontend Next.js   (standalone server, menembak backend lokal)
```

Skema Prisma **tidak diubah** (MariaDB = MySQL-compatible). Sinkronisasi lokal⟷pusat berjalan **backend-ke-backend**: backend lokal bertindak sebagai *klien* endpoint `/sync/*` di server pusat.

Mode lokal aktif otomatis di app terpaket (`app.isPackaged`). Untuk dev, set `POSPRO_LOCAL=1`; paksa mode remote (lama) dengan `POSPRO_LOCAL=0`.

### Sinkronisasi & device-token

- Perangkat didaftarkan **sekali** via `POST /sync/register-device` memakai `bootstrapToken` (JWT owner sekali-pakai) → dapat **device-token** permanen (disimpan di `userData/device-token`, aman saat reset DB).
- Sesudah itu semua sync memakai header **`x-device-token`**, bukan JWT.
- **Pull master**: filter `updatedAt > since`, cursor disimpan lokal (`SyncState`) — pusat stateless untuk pull.
- **Push transaksional**: mutasi lokal ditangkap `PushCaptureInterceptor` → antrean `SyncPush` (`pushedAt=null`) → didorong ke `PUSAT/sync/push` → pusat memutar ulang lewat `SyncService.applyOp` (idempoten via `clientId` di `SyncedOp`; `centralId` dipetakan balik).
- **Interval: tiap 30 detik** (`@Interval(30000)` di `LocalSyncService`), urutan **push → pull**. Butuh online + device terdaftar.

### Cakupan sinkronisasi

**Turun (pusat → desktop), delta tiap 30 dtk** — data referensi (server-authoritative, last-write-wins by id): roles, units, kategori, kategori produksi, cabang, pengaturan toko & per-cabang, user (+passwordHash utk login offline), rekening bank, produk, varian, harga bertingkat, pelanggan, **supplier + item supplier**, **SalesOrder + item & Lead + item** (alur desainer → SO → Lead → Nota), dan **stok per cabang** (nilai absolut, di-scope ke cabang device).

#### Alur desainer: SO → Lead → Nota (offline)

Desainer buat **SalesOrder** di portal `/so-designer` (login PIN, **butuh pusat/online**) → otomatis jadi **Lead** → dari lead/SO, kasir buat **Nota** di POS (`/pos?fromSO=<id>`).

Karena SO & Lead **dibuat di pusat** (id stabil) lalu **ditarik ke lokal**, kasir desktop bisa membuka SO/Lead, prefill keranjang, dan buat nota **meski offline**. Nota membawa `salesOrderId` (id pusat) → saat push, pusat otomatis menandai **SO = INVOICED** & **Lead = CLOSED_WON** (`transactions.service.ts`, hook `convertedSalesOrderId`) — tanpa perlu remap FK.

> **Batasan:** membuat **SO/Lead baru dari nol saat offline** (mis. tombol "Buat Nota di Kasir" pada lead CS yang belum punya SO → membuat SO draft) belum didukung — SO yang lahir di lokal punya id lokal yang tak cocok saat push (butuh pemetaan FK lintas-sync). Untuk saat ini: buat SO/Lead saat **online** (desainer/CS memang bekerja online), lalu konversi ke nota bisa offline. Foto proof desain juga tak tampil offline (file `/uploads` tidak ikut disinkron, hanya baris DB-nya).

**Naik (desktop → pusat)** — mutasi yang dibuat offline, ditangkap & diputar ulang idempoten:

| Operasi | Op type | Efek di pusat |
|---------|---------|---------------|
| Transaksi jual | `transaction.create` | Nota + item + potong stok + cashflow + job produksi |
| Kas manual | `cashflow.create` | Insert cashflow (kas masuk/keluar/biaya) |
| Pembelian / stok masuk | `stockPurchase.create` | `StockPurchasesService.create` → stok +delta + StockMovement IN |
| Opname (koreksi) | `stockOpname.finish` | Set stok absolut per varian + StockMovement ADJUST (tanpa sesi — `applyOfflineFinish`) |
| Transfer antar cabang | `stockTransfer.create` | `createTransfer` → pindah stok 2 cabang + StockMovement OUT/IN |

> **Idempotensi:** tiap op dijaga `clientId` — retry/duplikat tak menggandakan. Stok pembelian/transfer = delta komutatif; opname = set absolut (aman diulang). Op yang error TIDAK dicatat `SyncedOp` → otomatis di-retry tick berikutnya.

> **Catatan SO/Lead:** SalesOrder & Lead **ditarik ke lokal** (bisa dibuka & dikonversi jadi nota offline; SO/lead ditutup di pusat saat nota push). Yang **belum** didukung: **membuat** SO/Lead baru saat offline (butuh remap FK lintas-sync).

> **Belum disinkronkan sama sekali (dikerjakan di pusat saja):** update status job produksi, permintaan edit transaksi, invoice/SPH, bonus/beban tetap. Bila dibutuhkan offline, perlu perluasan serupa (tangkap endpoint + handler `applyOp`).

### Konfigurasi pusat (first-run)

Backend lokal butuh tahu server pusat lewat file `pospro-config.json` di folder `userData`:

```json
{
  "centralUrl": "https://pos-anda.com",
  "bootstrapToken": "<JWT owner sekali-pakai>",
  "branchId": 1,
  "deviceName": "Kasir Depan",
  "printerRelayToken": "<opsional — x-printer-token dari Settings → Printer>"
}
```

Tanpa `centralUrl`, app tetap jalan lokal tapi **tanpa sync**, dan first-run tak bisa bootstrap (DB kosong → tak bisa login).

Field **`printerRelayToken`** bersifat opsional — mengaktifkan mode **pusat cetak** (lihat bawah).

### Mode Pusat Cetak (melayani cetak device lain)

Secara default aplikasi desktop **hanya mencetak notanya sendiri**. Bila diisi `printerRelayToken`, aplikasi menjalankan **agen relay internal** (`desktop/src/relay-agent.ts`) yang long-poll ke server pusat dan mencetak job dari device lain (browser/tablet) ke printer PC ini — **tanpa perlu menjalankan `agent.py` terpisah**. Cocok untuk skenario "1 PC pegang printer, banyak kasir cetak ke sana".

- Token diambil dari **Settings → Printer** di server pusat (buat `PrinterDevice` → salin token).
- Agen poll ke **`centralUrl`** (bukan backend lokal), karena antrean relay device lain ada di pusat.
- Nyala/mati mengikuti lifecycle app (start setelah window siap, stop saat shutdown).
- Detail protokol relay: [Nota Thermal 58mm](nota-thermal-58mm.md#aplikasi-desktop-sebagai-pusat-cetak-melayani-device-lain).

### Build installer Windows

```bash
cd desktop && npm install && npm run dist
```

`dist` menjalankan `scripts/build-all.mjs`: build backend (`nest build` + `prisma generate` dengan engine Windows via `binaryTargets`), build frontend standalone, cek biner MariaDB, lalu `electron-builder --win nsis`. Hasil di `desktop/release/`.

- **Biner MariaDB** (WAJIB): ekstrak MariaDB ZIP (Windows x86_64) ke `desktop/mariadb/` sampai ada `bin/mariadbd.exe` dll. Folder `mariadb/` di-`.gitignore`; disalin ke installer via `extraResources`.
- **GOTCHA `NODE_ENV`**: build frontend WAJIB `NODE_ENV=production` (skrip sudah memaksanya) — kalau shell mewarisi `development`, prerender Next gagal (`useContext` null).
- **GOTCHA Prisma engine**: `binaryTargets = ["native","windows"]` agar `query_engine-windows.dll.node` ikut; salah engine → backend gagal start di Windows.
- **Ukuran** installer ~200–350MB (MariaDB ~150MB + backend node_modules + Prisma engine + frontend).

### Env flags (dev/uji)

| Flag | Fungsi |
|------|--------|
| `POSPRO_LOCAL=1` / `=0` | Paksa mode lokal / remote (dev) |
| `POSPRO_MARIADB_DIR` | Folder biner MariaDB (dev; default `resources/mariadb`) |
| `POSPRO_CENTRAL_URL` / `POSPRO_CENTRAL_TOKEN` / `POSPRO_BRANCH_ID` | Override konfigurasi pusat |
| `POSPRO_FRONTEND_DIR` / `POSPRO_BACKEND_DIR` | Override lokasi (debug) |

Contoh uji lokal penuh di Linux (pakai MariaDB sistem):

```bash
POSPRO_LOCAL=1 POSPRO_DEV=1 POSPRO_MARIADB_DIR=/opt/lampp \
POSPRO_CENTRAL_URL=http://localhost:3001 POSPRO_CENTRAL_TOKEN=<jwt> POSPRO_BRANCH_ID=1 \
npm start
```

> **Catatan:** lapisan offline IndexedDB pada frontend (untuk PWA murni) menjadi **redundan** di desktop karena backend lokal selalu ada — dibiarkan dorman, tidak dihapus.

Detail implementasi & keputusan desain ada di `desktop/README.md` dan `.hermes/plans/`.

---

## Lihat Juga

- [🧾 Nota Thermal 58mm](nota-thermal-58mm.md) — cetak struk dari aplikasi desktop
- [💾 Backup & Restore](backup.md) — backup versi web/server (rclone + ZIP)
- [🚀 Panduan Deployment](deployment.md) — setup server pusat (home server / VPS)
