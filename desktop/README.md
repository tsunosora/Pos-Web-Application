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
(termasuk `latest.yml`) ke GitHub Release. App terpasang akan menawarkan update saat start.
Untuk update mulus tanpa peringatan SmartScreen, installer perlu ditandatangani (code signing).

## Cetak

Aplikasi mencetak ESC/POS langsung dari proses utama:
- **Windows (spooler RAW)** — PowerShell P/Invoke `winspool.drv WritePrinter` (replika agen lama).
- **USB (COM)** — `System.IO.Ports.SerialPort`.
- Nol native module (tak perlu `electron-rebuild`). Detail: `docs/printing-spike.md`.

Pengaturan printer di aplikasi: **Settings → Printer** → panel "Printer Aplikasi (Desktop)".
