#!/usr/bin/env bash
# Deploy POS Web Application di server (homelab). Jalankan dari folder project:
#   bash deploy.sh
# Melakukan: git pull -> backend (prisma db push + generate + build) ->
# frontend (stop -> build bersih -> start) -> restart pm2 -> cek kesehatan.
#
# PERHATIAN: frontend MATI selama build frontend (beberapa menit). Jalankan saat
# toko sepi. Ini disengaja — alasannya ada di langkah [3/5].
#
# Catatan:
# - Aman untuk perubahan schema yang menambah tabel/kolom (mis. printer_devices).
set -e
cd "$(dirname "$0")"
ROOT="$(pwd)"
echo "==> Project: $ROOT"

# Cegah dua deploy/build bertumpuk. 2026-09-11 dua build frontend berjalan
# berdekatan dan saling menimpa .next -> /pos & /leaderboard crash
# ("client reference manifest ... does not exist").
LOCK=/tmp/pospro-deploy.lock
exec 9>"$LOCK"
if ! flock -n 9; then
  echo "!! Deploy lain sedang berjalan (lock $LOCK). Batal."
  exit 1
fi
if pgrep -f "next build" >/dev/null; then
  echo "!! Ada 'next build' lain yang sedang berjalan. Batal agar .next tidak saling timpa."
  exit 1
fi

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

echo "==> [3/5] Frontend: dependencies + build bersih (frontend DIHENTIKAN selama build)"
cd "$ROOT/frontend"
npm install --no-audit --no-fund
# JANGAN build selagi `next start` masih melayani dari .next yang sama: build
# menghapus/menimpa manifest yang sedang dipakai server, halaman crash dengan
# "Invariant: The client reference manifest for route ... does not exist" dan
# user melihat "This page couldn't load".
# Build di folder lain lalu tukar juga TIDAK aman di proyek ini: turbopack.root
# = process.cwd() dan next-pwa menulis service worker ke public/ saat build, jadi
# hasil build terikat ke folder proyek. Maka: stop -> simpan build lama -> build.
pm2 stop pospro-frontend || true
rm -rf .next.prev
if [ -d .next ]; then
  mv .next .next.prev
  # Pakai ulang cache build lama supaya build lebih cepat (tak dibutuhkan next start).
  if [ -d .next.prev/cache ]; then mkdir -p .next && mv .next.prev/cache .next/cache; fi
fi
# NODE_ENV WAJIB production saat build: bila shell mewarisi NODE_ENV=development,
# worker prerender Next memuat React build dev → gagal "Cannot read properties of
# null (reading 'useContext')" di /_not-found & /_global-error. Scope hanya ke
# build (bukan npm install di atas, yang butuh devDependencies utk next build).
if ! NODE_ENV=production npm run build; then
  echo "!! Build frontend GAGAL — memulihkan build sebelumnya."
  if [ -d .next.prev ]; then rm -rf .next && mv .next.prev .next; fi
  pm2 restart pospro-frontend --update-env || true
  echo "!! Frontend kembali ke versi lama. Backend TIDAK di-restart (proses lama tetap jalan)."
  exit 1
fi

echo "==> [4/5] Restart pm2 (HANYA proses pospro, jangan ganggu app lain di server)"
cd "$ROOT"
ERRLOG="$HOME/.pm2/logs/pospro-frontend-error.log"
ERR_BEFORE=$(grep -c "client reference manifest" "$ERRLOG" 2>/dev/null || true)
ERR_BEFORE=${ERR_BEFORE:-0}
# Server homelab menjalankan banyak app — restart hanya milik POS ini.
pm2 restart pospro-backend pospro-frontend --update-env || {
  echo "!! pm2 restart gagal. Jalankan manual: pm2 restart pospro-backend pospro-frontend"
  echo "!! Lihat daftar proses dengan: pm2 list"
}

echo "==> [5/5] Cek kesehatan"
FE=$(curl -s -o /dev/null -w "%{http_code}" --retry 20 --retry-connrefused --retry-delay 1 -m 5 http://localhost:3002/login || true)
BE=$(curl -s -o /dev/null -w "%{http_code}" --retry 20 --retry-connrefused --retry-delay 1 -m 5 http://localhost:3001/printer-relay/status || true)
ERR_AFTER=$(grep -c "client reference manifest" "$ERRLOG" 2>/dev/null || true)
ERR_AFTER=${ERR_AFTER:-0}
echo "    frontend /login                -> HTTP $FE (harus 200)"
echo "    backend  /printer-relay/status -> HTTP $BE (bukan 000)"
echo "    error manifest di log frontend -> $ERR_BEFORE -> $ERR_AFTER (harus sama)"
if [ "$FE" = "200" ] && [ "$BE" != "000" ] && [ "$ERR_AFTER" = "$ERR_BEFORE" ]; then
  rm -rf "$ROOT/frontend/.next.prev"
  echo "SELESAI. Deploy sehat."
else
  echo "!! Ada yang tidak sehat. Build lama disimpan di frontend/.next.prev untuk rollback:"
  echo "!!   pm2 stop pospro-frontend && cd frontend && rm -rf .next && mv .next.prev .next && pm2 restart pospro-frontend"
fi
pm2 list || true
