# toko/ — Storefront + Dashboard (aplikasi mandiri)

Toko online + dashboard pengelolaan, **dirancang untuk hosting terpisah** dari server PosPro
(punya **database & domain sendiri**). PHP murni + PDO (MySQL/MariaDB), styling Tailwind CDN.

- **Storefront** (publik): katalog produk dari PosPro, keranjang, checkout → order tercatat sebagai Lead di CRM PosPro.
- **Dashboard** (admin): akun sendiri, kelola artikel + tracking baca, lihat order dari PosPro, atur koneksi API.

## Arsitektur
- **Database toko (MySQL)** menyimpan: akun pengelola (`users`), setelan (`settings`), artikel (`articles`), kunjungan artikel (`article_views`).
- **PosPro (server homelab)** tetap sumber: produk (`/products/public`), profil toko (`/settings/public`),
  order publik (`POST /orders/public`), dan data order/lead (`/crm/leads`, butuh login).
- Dashboard membaca order via **service account PosPro** (email+password disimpan terenkripsi di setelan;
  toko login otomatis untuk dapat JWT). Diatur di menu **Setelan**.

## Pemasangan
1. Siapkan database MySQL kosong di hosting (mis. `toko`).
2. Set kredensial DB (env atau ubah `config.php`):
   - `TOKO_DB_HOST`, `TOKO_DB_PORT`, `TOKO_DB_NAME`, `TOKO_DB_USER`, `TOKO_DB_PASS`
   - `TOKO_APP_KEY` — string acak panjang (untuk enkripsi data sensitif). **Wajib diganti di produksi.**
   - `TOKO_BRAND` — warna brand hex (opsional, default `#6366f1`)
3. Jalankan & buka `install.php` → installer membuat tabel + akun admin pertama.
4. Login di `login.php`, lalu buka **Setelan** untuk menghubungkan API PosPro.

Lokal (butuh MySQL + PHP):
```bash
cd toko
TOKO_DB_NAME=toko TOKO_DB_USER=root TOKO_DB_PASS= php -S localhost:8090
```

## Halaman
**Storefront:** `index.php` (beranda/page builder), `produk.php` (katalog: search + filter kategori + sortir + **pagination 24/halaman**), `profil.php` (company profile, editable via builder), `portofolio.php` (**galeri hasil karya**, editable via builder), `product.php` (detail: galeri thumbnail, pilih varian, stepper jumlah, tombol WhatsApp, produk serupa), `cart.php` (keranjang+checkout), `artikel.php` (blog publik + baca), `header/footer.php` (header marketplace + menu hamburger mobile; footer 3 kolom).
**Dashboard:** `login.php`, `logout.php`, `install.php`, `dashboard.php` (ringkasan bento + chart),
`orders.php` (daftar order), `order.php` (detail), `articles.php` (daftar artikel), `article-edit.php` (editor + SEO),
`accounts.php` (kelola akun), `appearance.php` (page builder beranda), `settings.php` (koneksi API PosPro),
`backup.php` (backup & restore), `upload.php` (endpoint upload gambar), `admin_header/admin_footer.php` (layout dashboard).

## Tampilan Toko (Page Builder — e-commerce + company profile)
- Header storefront gaya **marketplace** (Tokopedia-like): search bar di tengah, ikon keranjang + badge, link Artikel. Pencarian dari header memfilter blok Produk (`?q=`/`?cat=`).
- Menu **Tampilan** — susun halaman **Beranda / Profil / Portofolio** (tab) dari blok yang bisa di-**drag** (SortableJS), diatur, diaktif/nonaktifkan, tambah & hapus.
- **Blok e-commerce**: Hero, **Slider Hero** (carousel auto-rotate, sampai 4 slide), Produk (kartu gaya marketplace, badge "Mulai Rp.. / N pilihan varian"), Kategori, Banner/Promo, **Popup Promo** (modal layar saat dibuka, tutup, sekali/hari), CTA.
- **Blok company profile**: Tentang Kami (gambar+teks+keunggulan), Layanan/Keunggulan (grid), Statistik/Angka (counter), Testimoni, FAQ (accordion), Kontak (alamat/telp/WA/email/Maps), Teks/Info.
- **Blok Portofolio / Galeri**: sampai 8 foto karya (judul + keterangan per foto), grid dengan hover overlay + **lightbox** (klik untuk perbesar, navigasi panah/keyboard). Kalau belum ada foto, placeholder hanya tampil untuk admin.
- Blok berisi daftar (Layanan/Statistik/Testimoni/FAQ) diisi via teks multi-baris format `A | B [| C]`.
- Layout disimpan JSON di `settings.home_layout` / `profil_layout` / `portofolio_layout`; halaman me-render via `home_blocks.php` (fallback default per halaman).

## Backup & Restore
- **Backup**: unduh satu file berisi dump database (`database.sql`) + folder `uploads/` + `meta.json`.
  Format **.zip** kalau ekstensi `ZipArchive` ada (default XAMPP), fallback **.sql** (DB saja).
  Nama file memuat nama toko: `backup-<nama-toko>-YYYYMMDD-HHMMSS.zip`.
- **Restore**: unggah file backup (.zip/.sql) → menimpa data saat ini (DROP+CREATE+INSERT) & memulihkan gambar.
  Destruktif — ada konfirmasi. Dump dibuat via PDO (tanpa `mysqldump`, aman di shared hosting).
**Inti:** `config.php`, `db.php` (PDO + settings + enkripsi + upload + migrasi), `lib.php` (HTTP/PosPro/auth/helper), `schema.sql`.

## Modul Artikel (CMS + SEO)
- Editor rich-text **Quill** (heading, bold/italic, list, link, blockquote) + **upload gambar inline** (via `upload.php` → `uploads/`).
- **Gambar cover** per artikel, slug otomatis dari judul.
- **Analisis SEO langsung**: kata kunci fokus, meta title/description, skor 0-100 + checklist + pratinjau Google.
  Cek: kata kunci di judul/isi/slug/meta, panjang judul (40-60), meta desc (120-160), isi ≥300 kata, ada cover & gambar isi.
- Publik di `artikel.php` (list) & `artikel.php?slug=` (baca) dengan **meta SEO dinamis** (title/description/OG) + canonical.
- **Tracking baca**: `articles.views` (counter) + `article_views` (per kunjungan, untuk grafik tren & pengunjung; dedupe per sesi).
- Gambar disimpan lokal di `uploads/` (path relatif, aman di subfolder `/toko/`).
- **Jadwal tayang**: status `SCHEDULED` + `scheduled_at`. Auto-terbit saat waktunya tiba — tanpa cron (lazy, terjadi saat ada kunjungan ke artikel/dashboard). Untuk presisi, set cron hosting ke `cron.php?key=<cron_key>` (mis. tiap menit).

## SEO
- Tiap halaman publik punya **title unik, meta description, canonical, Open Graph + Twitter Card** (di `header.php`, bisa di-override per halaman via `$seo_title/$seo_desc/$seo_image/$seo_canonical/$seo_type/$seo_robots/$seo_jsonld`).
- **Structured data JSON-LD**: `Store`/Organization (beranda), `Product` + Offer (detail produk), `BreadcrumbList` (katalog), `Article` (artikel).
- **sitemap.php** (dinamis: beranda, produk, profil, portofolio, artikel + tiap produk & artikel terbit) & **robots.txt** (blokir halaman admin & keranjang). Submit `https://<domain>/sitemap.php` ke Google Search Console; edit baris `Sitemap:` di robots.txt.
- Keranjang/halaman admin di-`noindex`. Helper URL absolut: `base_url()`, `abs_url()`, `current_url()` di lib.php.

## Kategori tersembunyi
- Produk bertipe **RAW_MATERIAL** (bahan baku) otomatis tidak tampil publik (filter di `public_products()` + backend `findAllPublicSafe`).
- Kategori tertentu bisa **disembunyikan dari toko** lewat **Setelan → Kategori Tampil di Toko** (centang yang mau disembunyikan). Disimpan di `settings.hidden_cats` (CSV id kategori); berlaku di beranda, katalog, pencarian, detail, dan sitemap.

## Catatan
- Data sensitif (password service PosPro) disimpan terenkripsi AES-256-CBC dengan `APP_KEY`.
- Produk & profil toko TETAP dikelola di PosPro; toko hanya menampilkan + mencatat order.
- Artikel & akun dikelola di DB toko (independen dari modul `articles`/`users` PosPro).
- Status pembangunan: fondasi (DB, akun, dashboard, order, setelan API) selesai; **modul Artikel menyusul**.
