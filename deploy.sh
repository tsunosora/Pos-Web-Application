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

echo "==> [3/5] Frontend: dependencies + build bersih"
cd "$ROOT/frontend"
npm install --no-audit --no-fund
rm -rf .next
npm run build

echo "==> [4/5] Restart pm2"
cd "$ROOT"
# Ganti 'all' dengan nama proses spesifik bila perlu (lihat: pm2 list).
pm2 restart all --update-env || {
  echo "!! pm2 restart gagal. Jalankan manual: pm2 restart <nama-proses>"
  echo "!! Lihat daftar proses dengan: pm2 list"
}

echo "==> [5/5] Selesai. Proses pm2 saat ini:"
pm2 list || true
echo ""
echo "SELESAI. Cek: buka <URL-backend>/printer-relay/status di browser (harus muncul JSON, bukan 'Cannot GET')."
