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

## Keamanan
- **Session**: cookie `HttpOnly` + `SameSite=Lax` (+`Secure` saat HTTPS), `use_strict_mode`; `session_regenerate_id()` saat login/logout (anti session-fixation).
- **Login**: rate-limit 8 gagal/15 menit per IP/email (tabel `login_attempts`, dibuat otomatis), delay acak saat gagal, pesan error generik.
- **CSRF berlapis**: (1) guard origin terpusat di `lib.php` — semua POST ditolak 403 bila Origin/Referer beda host; (2) token per-sesi (`csrf_field()`/`require_csrf()`) di form login, akun, setelan, backup/restore, konten, artikel, upload (header `X-CSRF-Token`), dan checkout.
- **Role**: hanya `admin` yang bisa tambah/hapus akun; `editor` cuma bisa ganti password sendiri. Password minimal 8 karakter.
- **Upload**: validasi `getimagesize` + whitelist mime, nama acak, `.htaccess` anti-eksekusi skrip di `uploads/` (dibuat otomatis).
- **Header**: `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy`, HSTS saat HTTPS.
- **Lainnya**: URL API PosPro divalidasi http(s); `cron.php` pakai `hash_equals`; peringatan di Setelan bila `TOKO_APP_KEY` masih bawaan. **Produksi: wajib HTTPS + ganti `TOKO_APP_KEY`.**

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

### Deploy ke Hostinger (GitHub Actions)
Repo ini monorepo (toko jadi satu dengan PosPro), jadi deploy TIDAK pakai fitur Git Hostinger
(itu meng-clone seluruh repo). Pakai workflow `.github/workflows/deploy-toko.yml`:
tiap push ke `main` yang menyentuh `toko/**`, hanya isi folder `toko/` di-upload via FTP.
- Isi 4 secrets di GitHub: `HOSTINGER_FTP_HOST/USER/PASS/DIR`.
- Kredensial DB + `APP_KEY` di server ditaruh di `config.local.php` (salin dari
  `config.local.example.php` via File Manager) — dikecualikan dari deploy, tidak pernah tertimpa.
- Folder `uploads/` & skrip utilitas dev (`seed_articles_seo.php`, dll.) dikecualikan dari deploy.
- Setelah deploy pertama: set PHP 8.2 di hPanel, buka `install.php`, lalu hubungkan API PosPro di Setelan.

## Halaman
**Storefront:** `index.php` (beranda/page builder), `produk.php` (katalog: search + filter kategori + sortir + **pagination 24/halaman**), `profil.php` (company profile, editable via builder), `portofolio.php` (**galeri hasil karya**, editable via builder), `product.php` (detail: galeri thumbnail, pilih varian, stepper jumlah, tombol WhatsApp, produk serupa), `cart.php` (keranjang+checkout), `artikel.php` (blog publik + baca), `header/footer.php` (header marketplace + menu hamburger mobile; footer 3 kolom).

### Harga per luas (AREA_BASED) & harga grosir (tier)
Mengikuti aturan harga PosPro (formula sama dengan POS):
- **Produk per luas** (`pricingMode = AREA_BASED`, harga varian = harga per m²): halaman produk menampilkan harga `/m²` + input **Panjang × Lebar (cm)** wajib; estimasi total live = `harga/m² × (P×L÷10.000) × pcs`. Ukuran ikut tersimpan di keranjang (`widthCm/heightCm/unitType`) dan dikirim ke `POST /orders/public` sehingga Lead di CRM mencatat ukuran & `estimatedValue` benar.
- **Harga bertingkat** (`priceTiers` varian): tabel "Harga Grosir" tampil di halaman produk, harga satuan otomatis berubah sesuai jumlah (baris tier aktif di-highlight). Harga final **dihitung ulang di server** (`tier_price()` di `lib.php`) saat tambah ke keranjang — tidak percaya harga dari client.
- Subtotal keranjang/order via `cart_item_subtotal()` (`lib.php`) — sadar item area; dipakai juga di `order.php` dashboard.
**Dashboard:** `login.php`, `logout.php`, `install.php`, `dashboard.php` (ringkasan bento + chart),
`orders.php` (daftar order), `order.php` (detail), `articles.php` (daftar artikel), `article-edit.php` (editor + SEO),
`accounts.php` (kelola akun), `appearance.php` (page builder beranda), `settings.php` (koneksi API PosPro),
`backup.php` (backup & restore), `upload.php` (endpoint upload gambar), `admin_header/admin_footer.php` (layout dashboard).

## Desain (PRD-website-voliko, Jun 2026 — gaya hue)
Storefront di-redesign mengikuti `docs/design/PRD-website-voliko.md`: navbar **glassmorphism** sticky (mengecil saat scroll, tombol pill "Order via WA"), **hero slider Swiper** (autoplay 6 dtk, swipe, headline ber-highlight, 2 CTA, objek PNG **zero-gravity** + parallax mouse, kartu statistik kaca), section gelap `#0E0E10` (Tentang dgn **badge berputar**, Statistik count-up, Testimoni foto oval, CTA), **marquee logo klien** 2 arah miring, blok **Form Order Cepat** (lead magnet → `lead.php` → `POST /orders/public` PosPro, honeypot + rate limit 60 dtk), blok **Video/Foto Tim** (play button kaca → modal YouTube), blog 2 kartu besar + baris kecil, footer 4 kolom + jam buka. Scroll-reveal via **IntersectionObserver + CSS** (anti-gagal: konten tampil tanpa JS, safety net 3 dtk); semua animasi mati saat `prefers-reduced-motion`. Aset: `assets/voliko.css` (token: Plus Jakarta Sans + Inter, aksen dari `TOKO_BRAND`) & `assets/voliko.js`. CDN: Swiper 11 saja.

## Tampilan Toko (Page Builder — e-commerce + company profile)
- Header storefront gaya **marketplace** (Tokopedia-like): search bar di tengah, ikon keranjang + badge, link Artikel. Pencarian dari header memfilter blok Produk (`?q=`/`?cat=`).
- Menu **Tampilan** — susun halaman **Beranda / Profil / Portofolio** (tab) dari blok yang bisa di-**drag** (SortableJS), diatur, diaktif/nonaktifkan, tambah & hapus.
- **Blok e-commerce**: Hero, **Slider Hero** (Swiper, sampai 4 slide + highlight kata + 2 tombol + gambar melayang + kartu statistik), Produk (kartu gaya marketplace, badge "Mulai Rp.. / N pilihan varian"), Kategori (kartu ikon hover aksen), Banner/Promo, **Popup Promo** (modal layar saat dibuka, tutup, sekali/hari), CTA.
- **Blok baru (PRD Jun 2026)**: **Video / Foto Tim** (foto + tombol play → modal YouTube), **Form Order Cepat** (form lead last-minute → CRM PosPro, pilih cabang, lanjut chat WA), **Logo Klien** (marquee 2 baris berlawanan arah). Blok Tentang punya opsi **mode gelap** + badge berputar.
  ⚠ Layout lama tersimpan di DB — blok baru TIDAK muncul otomatis; tambahkan via **Tampilan → Tambah Blok** atau **Reset ke bawaan**.
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
