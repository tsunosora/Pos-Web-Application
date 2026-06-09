# Landing Page Builder

Bangun landing page toko dengan **drag-and-drop** (pakai library Puck), kelola dari dashboard, sajikan di **domain custom terpisah**.

## Alur pakai
1. Dashboard → `Pengaturan › Landing Page` (membuka editor full-screen `/landing-builder`).
2. Tarik blok dari panel kiri ke kanvas, atur isinya di panel kanan, urutkan dengan drag.
3. **Simpan Draft** untuk menyimpan tanpa menayangkan; **Terbitkan** untuk menayangkan ke publik.
4. **Pratinjau** membuka `/landing`.

## Blok tersedia
Hero, Judul, Teks, Gambar, Tombol, Jarak (spacer), Galeri, Kontak & Peta (alamat + WhatsApp + embed Google Maps), dan **Grid Produk** (otomatis menarik produk dari katalog POS — gambar & harga ikut data produk).

## Domain custom
- Halaman publik: `/landing`.
- Untuk domain sendiri (mis. `www.tokokamu.com`):
  1. Set env `NEXT_PUBLIC_LANDING_DOMAIN=https://www.tokokamu.com`.
  2. Arahkan DNS domain itu + reverse proxy (nginx/Cloudflare) ke app Next.js yang sama.
  - Saat ada pengunjung di domain itu, app otomatis menyajikan landing (tanpa login). Domain POS (mis. `app.tokokamu.com`) tetap ke dashboard seperti biasa.

## Aktivasi (developer)
- Backend: `npx prisma generate` lalu restart (model `LandingConfig` / tabel `landing_config`).
- Frontend: dependency `@measured/puck` (sudah di `package.json`).

## Catatan
Pengaturan SEO (judul/deskripsi/favicon) tersimpan di config; form pengaturannya menyusul. Konten yang dirender publik hanya versi yang sudah **Terbitkan**.
