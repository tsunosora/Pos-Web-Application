#!/usr/bin/env bash
# Deploy POS Web Application di server (homelab). Jalankan dari folder project:
#   bash deploy.sh
# Melakukan: git pull -> backend (prisma db push + generate + build) ->
# frontend (build bersih) -> restart pm2.
#
# Catatan:
# - Aman untuk perubahan schema yang menambah tabel/kolom (mis. printer_devices).
# - Kalau nama proses pm2-mu spesifik, ganti "pm2 restart all" di bawah dengan
#   nama prosesnya, mis: pm2 restart pos-backend pos-frontend
set -e
cd "$(dirname "$0")"
ROOT="$(pwd)"
echo "==> Project: $ROOT"

echo "==> [1/5] git pull"
git pull origin main

echo "==> [2/5] Backend: dependencies + prisma + build"
cd "$ROOT/backend"
npm install --no-audit --no-fund
npx prisma db push
npx prisma generate
npm run build

# Catatan: hasil build Studio Desain (frontend/public/studio-desain/) kini
# DI-COMMIT ke repo (bukan di-generate saat deploy) → langsung tersedia via
# git pull, tak perlu build sub-app di server. Untuk regenerasi setelah ubah
# source: jalankan `npm run build:studio` di frontend, lalu commit hasilnya.

echo "==> [3/5] Frontend: dependencies + build bersih"
cd "$ROOT/frontend"
npm install --no-audit --no-fund
rm -rf .next
# NODE_ENV WAJIB production saat build: bila shell mewarisi NODE_ENV=development,
# worker prerender Next memuat React build dev → gagal "Cannot read properties of
# null (reading 'useContext')" di /_not-found & /_global-error. Scope hanya ke
# build (bukan npm install di atas, yang butuh devDependencies utk next build).
NODE_ENV=production npm run build

echo "==> [4/5] Restart pm2 (HANYA proses pospro, jangan ganggu app lain di server)"
cd "$ROOT"
# Server homelab menjalankan banyak app — restart hanya milik POS ini.
pm2 restart pospro-backend pospro-frontend --update-env || {
  echo "!! pm2 restart gagal. Jalankan manual: pm2 restart pospro-backend pospro-frontend"
  echo "!! Lihat daftar proses dengan: pm2 list"
}

echo "==> [5/5] Selesai. Proses pm2 saat ini:"
pm2 list || true
echo ""
echo "SELESAI. Cek: buka <URL-backend>/printer-relay/status di browser (harus muncul JSON, bukan 'Cannot GET')."
