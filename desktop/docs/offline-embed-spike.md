# Spike Fase 0 — Kelayakan "100% Offline" (backend + DB lokal)

Status: **LULUS** (divalidasi end-to-end di Linux, 2026-07-16). Bundling biner Windows
divalidasi terpisah oleh user.

## Yang diuji & hasil
Skrip: siklus penuh init MariaDB embedded → prisma db push → backend via Electron-as-Node.

1. **Init MariaDB embedded** — `mysql_install_db --no-defaults --basedir=... --datadir=<userData/db> --auth-root-authentication-method=normal` → datadir bersih (exit 0).
2. **Start mysqld** — `mysqld --no-defaults --basedir=... --datadir=... --port=<free> --socket=<pendek> --bind-address=127.0.0.1` → hidup, isolatif dari MySQL sistem.
3. **DB + TCP** — `CREATE DATABASE pospro`; koneksi TCP root (empty password via `--auth-root-authentication-method=normal`) OK.
4. **Prisma** — `DATABASE_URL=mysql://root@127.0.0.1:<port>/pospro npx prisma db push` → **76 tabel** terbentuk. Skema MySQL TIDAK diubah.
5. **Backend via Electron-as-Node** — `ELECTRON_RUN_AS_NODE=1 DATABASE_URL=... PORT=... WHATSAPP_ENABLED=false JWT_SECRET=<kuat> electron backend/dist/src/main.js` → "Nest application successfully started", PrismaModule init.
6. **Endpoint** — `/printer-relay/status`, `/products` → HTTP 401 (rute hidup + ter-guard; backend melayani dari DB embedded).

## GOTCHA penting (untuk implementasi Fase 1–2)
- **Socket UNIX < ~108 char.** Path socket panjang (mis. di bawah scratchpad dalam) → `Can't create UNIX socket`. Taruh socket di path pendek (mis. `userData/db/m.sock` yang pendek, atau `/tmp`-setara Windows N/A — Windows pakai named pipe/TCP saja).
- **Entry backend = `dist/src/main.js`** (bukan `dist/main.js`) karena `nest build` mempertahankan struktur `src/`.
- **JWT_SECRET wajib kuat** (≥16 char, bukan "super-secret"). Generate secret lokal acak per-instal, simpan di `userData`.
- **`WHATSAPP_ENABLED=false`** mematikan bot WA (device kasir tak perlu; hindari puppeteer boot).
- **`--no-defaults` wajib** agar mysqld/mysql_install_db abaikan my.cnf sistem.
- **Auth root:** `--auth-root-authentication-method=normal` → root TCP empty-password (lokal, bind 127.0.0.1). Untuk produksi, pertimbangkan set password lokal acak.
- **Prisma engine** ikut otomatis dari `node_modules` backend saat dijalankan via electron-as-node (di spike memakai node_modules dev; saat paket pastikan `libquery_engine-*` per-OS ikut).

## Kesimpulan
Pendekatan **MariaDB terbundel + NestJS via Electron-as-Node + Prisma** LAYAK. Lanjut ke
Fase 1 (`desktop/src/mariadb.ts`) & Fase 2 (`backend-server.ts`) tanpa pivot ke PGlite.
Biner MariaDB Windows (portable, ~150MB) harus disertakan di paket (Fase 10).
