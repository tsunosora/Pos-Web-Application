# Storefront PHP — Toko Online Customer

Situs ringan (PHP murni, tanpa framework) yang menampilkan produk dari **PosPro** lewat API publik, dan mengirim **order online** yang otomatis tercatat sebagai **Lead** di CRM PosPro.

## Cara kerja
- Tarik data dari API publik PosPro:
  - `GET /products/public` — katalog produk (tanpa harga modal/hpp)
  - `GET /products/public/:id` — detail produk
  - `GET /settings/public` — nama toko, logo, telepon
- Keranjang disimpan di **session PHP**.
- Checkout → `POST /orders/public` → membuat Lead `WEBSITE` (status NEW) di PosPro + notifikasi Discord "Lead Baru".

## Menjalankan
1. Pastikan backend PosPro berjalan & **bisa diakses** dari server PHP ini.
2. Set URL API (pilih salah satu):
   - Env: `POSPRO_API=https://api.tokokamu.com`
   - atau ubah default di `config.php`.
3. Jalankan:
   ```bash
   cd storefront-php
   POSPRO_API=http://localhost:3001 php -S localhost:8080
   ```
   Buka http://localhost:8080
4. Untuk produksi: taruh folder ini di hosting PHP (Apache/Nginx + PHP), set `POSPRO_API` ke URL backend publik.

## Catatan
- Backend PosPro **harus bisa diakses publik** (mis. `api.tokokamu.com`) agar situs ini jalan di internet. CORS untuk endpoint publik sudah dibuka.
- File: `index.php` (katalog), `product.php` (detail + add to cart), `cart.php` (keranjang + checkout), `header/footer.php` (layout), `lib.php` (helper API), `config.php` (konfigurasi), `style.css`.
- Order masuk ke **CRM → Leads** (sumber "Website"), bisa di-follow-up & di-convert ke transaksi seperti lead lain.
