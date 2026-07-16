# POS Pro — Aplikasi Desktop (Electron)

Membungkus POS Web App jadi aplikasi Windows yang:
- **Mencetak thermal langsung** ke printer lokal (tanpa agen `.bat`/Python) via IPC.
- **Offline-first**: katalog & transaksi tersedia tanpa internet, auto-sync saat online.

Frontend Next.js dijalankan sebagai server mandiri (output `standalone`) di dalam
Electron (`127.0.0.1`, port acak), lalu window memuatnya.

## Struktur

```
desktop/
├── src/
│   ├── main.ts          # proses utama: window + IPC + auto-update
│   ├── preload.ts       # jembatan aman window.electron.*
│   ├── next-server.ts   # jalankan frontend (dev: next start; prod: standalone server.js)
│   ├── printing.ts      # cetak ESC/POS (Windows RAW / COM) — lihat docs/printing-spike.md
│   ├── win-print.ts     # PowerShell winspool + SerialPort (nol native module)
│   └── printer-config.ts
├── electron-builder.yml # konfigurasi installer NSIS + extraResources frontend
├── scripts/build-frontend.mjs
└── docs/printing-spike.md
```

## Development

```bash
cd desktop
npm install
npm run dev        # build main + jalankan Electron (POSPRO_DEV=1 → next start dari ../frontend)
```

Frontend harus sudah pernah di-build (`cd ../frontend && npm run build`) agar `next start` punya `.next`.

Override folder frontend untuk debug: `POSPRO_FRONTEND_DIR=/path/ke/standalone npm start`.

## Build installer Windows (.exe)

> **Harus di Windows** (atau Linux+wine). `npm run dist` otomatis membangun frontend
> mode standalone lalu mengemas NSIS.

```bash
cd desktop
npm install
npm run dist
```

Langkah yang dijalankan `dist`:
1. `scripts/build-frontend.mjs` → `POSPRO_DESKTOP=1 NODE_ENV=production` build frontend
   → menghasilkan `frontend/.next/standalone` (server mandiri + node_modules ter-trace, ~70MB).
2. `tsc` → compile `src/*.ts` → `dist/`.
3. `electron-builder --win nsis` → menyalin standalone + `.next/static` + `public` sebagai
   resources, hasilkan installer di `desktop/release/`.

> **GOTCHA:** build frontend WAJIB `NODE_ENV=production`. Bila shell mewarisi
> `NODE_ENV=development`, prerender Next gagal (`useContext` null). Skrip sudah memaksanya.

Ikon (opsional): taruh `desktop/build/icon.ico` lalu aktifkan baris `icon:` di `electron-builder.yml`.

## Auto-update (opsional)

Sudah di-wire (`electron-updater`) tapi non-aktif sampai `publish` diatur di
`electron-builder.yml`. Contoh GitHub Releases:

```yaml
publish:
  provider: github
  owner: <user>
  repo: <repo>
```

Lalu rilis: naikkan `version` di `package.json`, `npm run dist`, unggah isi `release/`
(termasuk `latest.yml`) ke GitHub Release.

Saat versi baru terdeteksi, aplikasi menampilkan **banner notifikasi di dalam aplikasi**
(alur unduh → pasang) — pengguna tak perlu mengunduh installer manual. Untuk update mulus
tanpa peringatan SmartScreen, installer perlu ditandatangani (code signing).

## Cetak

Aplikasi mencetak ESC/POS (nota device ini sendiri) langsung dari proses utama:
- **Windows (spooler RAW)** — PowerShell P/Invoke `winspool.drv WritePrinter` (replika agen lama).
- **USB (COM)** — `System.IO.Ports.SerialPort`.
- Nol native module (tak perlu `electron-rebuild`). Detail: `docs/printing-spike.md`.

Pengaturan printer di aplikasi: **Settings → Printer** → panel "Printer Aplikasi (Desktop)".

### Mode pusat cetak (melayani cetak device lain)

Secara default app hanya mencetak notanya sendiri. Isi **`printerRelayToken`** di
`pospro-config.json` untuk menjalankan **agen relay internal** (`src/relay-agent.ts`):
app long-poll ke server **pusat** (`centralUrl` + `/printer-relay/poll`, header
`x-printer-token`) dan mencetak job dari device lain ke printer PC ini via jalur
`printEscpos` yang sama — tanpa menjalankan `tools/print-bridge/agent.py` terpisah.

```json
{ "centralUrl": "https://pos-anda.com", "printerRelayToken": "<token Settings → Printer>" }
```

- Token = `x-printer-token` dari `PrinterDevice` (Settings → Printer di pusat), **bukan**
  device-token sync. Bisa juga di-override via env `POSPRO_PRINTER_TOKEN`.
- Poll ke **pusat** (bukan backend lokal) karena antrean relay device lain ada di pusat.
- Start di `startRelayServing()` (setelah window siap), stop di `shutdown()`.
- Tanpa token → nonaktif (log `[relay] ... nonaktif`), perilaku lama tak berubah.

---

## Mode "100% offline" (backend + database lokal)

Aplikasi terpaket menjalankan **stack penuh secara lokal** di dalam Electron:
`MariaDB (embedded) → NestJS backend → frontend`. Semua fitur jalan tanpa internet;
data lokal tersinkron ke server pusat (model *single-device local-primary*).

Aktif otomatis di app terpaket (`app.isPackaged`). Untuk dev, set `POSPRO_LOCAL=1`.
Paksa mode remote (lama) dengan `POSPRO_LOCAL=0`.

### Menyiapkan biner MariaDB (WAJIB untuk paket)
1. Unduh **MariaDB ZIP** (Windows x86_64) dari mariadb.org/download.
2. Ekstrak isinya ke `desktop/mariadb/` sehingga ada `desktop/mariadb/bin/mariadbd.exe`,
   `mariadb-install-db.exe`, `mariadb.exe`, `mariadb-admin.exe`, `mariadb-dump.exe` +
   `share/`. (Folder `mariadb/` di-`.gitignore` — tidak ikut repo.)
3. `npm run dist` menyalinnya ke installer via `extraResources`.

Dev di Linux: pakai biner sistem lewat `POSPRO_MARIADB_DIR=/opt/lampp` (atau path lain
yang punya `bin/`+`sbin/`).

### Konfigurasi pusat (first-run)
Backend lokal butuh tahu server pusat untuk bootstrap awal + sync. Sediakan file
`pospro-config.json` di folder userData aplikasi:
```json
{
  "centralUrl": "https://pos-anda.com",
  "bootstrapToken": "<JWT owner sekali-pakai untuk mendaftarkan perangkat>",
  "branchId": 1,
  "deviceName": "Kasir Depan"
}
```
- `bootstrapToken` (JWT) dipakai SEKALI untuk memanggil `POST /sync/register-device` →
  perangkat dapat **device token** permanen (disimpan di `userData/device-token`, aman
  saat reset DB). Sesudah itu semua sync pakai device token, bukan JWT.
- Tanpa `centralUrl`, app tetap jalan lokal tapi **tanpa sync**, dan first-run tak bisa
  bootstrap (DB kosong → tak bisa login). → Layar setup first-run (menulis file ini)
  adalah pekerjaan lanjutan yang direkomendasikan.

### Build installer
```bash
cd desktop && npm install && npm run dist
```
`dist` menjalankan `scripts/build-all.mjs`: build backend (`nest build` + `prisma
generate` dengan engine Windows via `binaryTargets`), build frontend standalone, cek
biner MariaDB, lalu `electron-builder --win nsis`. Hasil di `desktop/release/`.

> **Ukuran** installer besar (~200–350MB): MariaDB (~150MB) + backend `node_modules` +
> Prisma engine + frontend. Optimasi backend (nft/esbuild bundling) = pekerjaan lanjutan.

> **Prisma engine:** `schema.prisma` generator `binaryTargets = ["native","windows"]`
> agar `query_engine-windows.dll.node` ikut. Salah engine → backend gagal start di Windows.

### Backup, recovery & reset (mode lokal)
- **Auto-backup** tiap start (sebelum migrasi) ke `userData/backups/` (rotasi 7 terakhir).
- **Backup manual**: `window.electron.backupDb()` → dialog simpan `.sql` (mariadb-dump).
- **Reset**: `window.electron.resetDb()` → konfirmasi → hapus DB lokal → relaunch →
  bootstrap ulang dari pusat. Device token dipertahankan (tak bikin device ganda).
- **Recovery**: bila DB lokal gagal start (korupsi), app menawarkan reset otomatis.

### Env flags (dev/uji)
- `POSPRO_LOCAL=1` — paksa mode lokal (dev). `=0` paksa remote.
- `POSPRO_MARIADB_DIR` — folder biner MariaDB (dev; default: `resources/mariadb`).
- `POSPRO_CENTRAL_URL` / `POSPRO_CENTRAL_TOKEN` / `POSPRO_BRANCH_ID` — override config pusat.
- `POSPRO_FRONTEND_DIR` / `POSPRO_BACKEND_DIR` — override lokasi (debug).

Contoh uji lokal penuh di Linux:
```bash
POSPRO_LOCAL=1 POSPRO_DEV=1 POSPRO_MARIADB_DIR=/opt/lampp \
POSPRO_CENTRAL_URL=http://localhost:3001 POSPRO_CENTRAL_TOKEN=<jwt> POSPRO_BRANCH_ID=1 \
npm start
```
