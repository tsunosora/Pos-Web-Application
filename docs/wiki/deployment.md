# 🚀 Panduan Deployment PosPro di Home Server (Cloudflare Tunnel)

Panduan ini akan membantu Anda meng-_install_ dan memublikasikan aplikasi **PosPro** di Home Server Anda (misal: Ubuntu Linux) menggunakan **MySQL**, **PM2** (sebagai _process manager_), dan **Cloudflare Zero Trust Tunnel** agar bisa diakses publik menggunakan nama domain/subdomain tanpa perlu membuka _port_ di router (Port Forwarding).

---

## 📋 Persyaratan Sistem (_Prerequisites_)

Pastikan Home Server Anda sudah terinstal:
1. **Node.js** (v18 atau v20 ke atas) & **npm**.
2. **Git** (untuk _clone_ repositori).
3. **MySQL Server** (versi 8+ disarankan).
4. **PM2** (Process Manager untuk Node.js). Install global dengan: `npm install -g pm2`
5. Akun **Cloudflare** aktif dengan domain yang sudah tertaut ke Cloudflare.

---

## 🛠️ Langkah 1: Persiapan Database MySQL

Masuk ke MySQL _command line_ di server Anda:

```bash
sudo mysql -u root -p
```

Buat database baru untuk PosPro (misalnya bernama `pospro_db`):

```sql
CREATE DATABASE pospro_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'pospro_user'@'localhost' IDENTIFIED BY '<PASSWORD_ANDA>';
GRANT ALL PRIVILEGES ON pospro_db.* TO 'pospro_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

---

## 📥 Langkah 2: Clone Repositori

Tarik (_clone_) kode aplikasi PosPro Anda ke dalam server:

```bash
cd ~
git clone https://github.com/tsunosora/Pos-Web-Application.git pospro
cd pospro
```

---

## ⚙️ Langkah 3: Konfigurasi & Menjalankan Backend (NestJS)

Masuk ke folder backend dan atur _environment_ variabelnya.

```bash
cd backend
npm install
cp .env.example .env
```

Edit file `.env` (misal menggunakan `nano .env`) dan sesuaikan `DATABASE_URL` ke akun MySQL yang baru Anda buat, serta tentukan port jalan backend:

```env
# Ubah kredensial sesuai dengan MySQL yang Anda buat di Langkah 1
DATABASE_URL="mysql://pospro_user:<PASSWORD_ANDA>@localhost:3306/pospro_db"

PORT=3001
JWT_SECRET="ganti_dengan_secret_key_yang_sangat_rumit_dan_panjang_sekali"

# CORS — daftar domain yang diizinkan (pisahkan dengan koma)
ALLOWED_ORIGINS="https://domainanda.com,https://share.domainanda.com"

# Pengaturan WhatsApp Bot
WHATSAPP_REPORT_GROUP_ID=""

# Google Service Account untuk Rclone/GDrive (opsional)
GOOGLE_APPLICATION_CREDENTIALS="./google-service-account.json"
```

Setelah `.env` sesuai, jalankan migrasi database agar tabel-tabel terbuat:

```bash
npx prisma generate
npx prisma migrate deploy
```

*(Opsional)* Jika ini server baru dan tabel masih kosong, jalankan _seeding_ data awal:
```bash
npx prisma db seed
```

**(PENTING):** _Build_ aplikasi NestJS ke versi produksi dan jalankan menggunakan PM2:

```bash
npm run build
pm2 start dist/main.js --name "pospro-backend"
```

Aplikasi Backend sekarang berjalan di latar belakang pada port `3001` (atau sesuai isi `.env`).
Simpan status PM2 agar otomatis jalan saat server _restart_:
```bash
pm2 save
pm2 startup
```

---

## 🖥️ Langkah 4: Konfigurasi & Menjalankan Frontend (Next.js)

Sekarang pindah ke folder `frontend`.

```bash
cd ../frontend
npm install
cp .env.example .env.local
```

Edit file `.env.local` (misal: `nano .env.local`). Arahkan `NEXT_PUBLIC_API_URL` ke domain _public_ yang nantinya akan diarahkan ke backend (kita asumsikan Anda akan mendeploy backend di `api.domainanda.com`).

```env
# URL Publik Backend yang akan dibuat di Cloudflare
NEXT_PUBLIC_API_URL="https://api.domainanda.com"

# (Opsional) Domain khusus untuk halaman share produk publik
# Jika diisi, halaman /p/* hanya bisa diakses dari domain ini
NEXT_PUBLIC_SHARE_DOMAIN="https://share.domainanda.com"
```

Lakukan _build_ pada Next.js (proses ini mengkompilasi file React menjadi statik & server optimal):

```bash
npm run build
```

Jalankan Frontend Next.js dengan PM2:

```bash
pm2 start npm --name "pospro-frontend" -- start -- -p 3000
```
Simpan lagi pengaturan PM2: `pm2 save`.

Saat ini:
- Backend berjalan di `localhost:3001`
- Frontend berjalan di `localhost:3000`

---

## 🌐 Langkah 5: Setup Cloudflare Zero Trust Tunnel

Cloudflare Tunnel (`cloudflared`) akan menghubungkan _localhost_ Anda dengan domain publik tanpa harus ribet setting port di router WiFi/ISP (tidak perlu IP Statis/Public).

### 5.1. Buka Cloudflare Zero Trust Dashboard
1. Buka [one.dash.cloudflare.com](https://one.dash.cloudflare.com)
2. Masuk ke menu **Networks** -> **Tunnels**
3. Klik **Create a tunnel**.
4. Pilih **Cloudflared** (connector).
5. Beri nama tunnel (contoh: `pospro-home-server`). Kemudian **Save tunnel**.
6. Cloudflare akan menampilkan perintah _install_ `cloudflared` untuk berbagai OS.
7. Pilih **Debian/Ubuntu** (atau sesuai Linux Anda), _copy_ perinthanya, dan _paste_ di terminal Home Server Anda.
8. Tunggu hingga di _dashboard_ Cloudflare status koneksinya berubah menjadi **Connected** atau **Healthy**, lalu klik **Next**.

### 5.2. Routing Subdomain
Di halaman _Public Hostnames_, tambahkan rute agar sub-domain Anda nyambung ke port lokal yang tepat.

**A. Membuat Routing untuk FRONTEND (User Akses):**
- **Subdomain:** `pos` (nantinya menjadi `pos.domainanda.com`)
- **Domain:** Pilih domain Anda yang aktif di Cloudflare.
- **Service Type:** `HTTP`
- **URL:** `localhost:3000`
- Klik **Save hostname**

**B. Membuat Routing untuk BACKEND (API Akses):**
- Klik **Add public hostname** lagi.
- **Subdomain:** `api` (nantinya menjadi `api.domainanda.com`)
- **Domain:** Pilih domain Anda.
- **Service Type:** `HTTP`
- **URL:** `localhost:3001`
- Klik **Save hostname**

*(Catatan: Pastikan `NEXT_PUBLIC_API_URL` di folder frontend Langkah 4 **benar-benar sama** dengan URL api.domainanda.com yang baru Anda buat, serta diawali dengan `https://`.)*

---

## 🎉 Langkah 6: Selesai!

Sekarang Anda bisa mengakses aplikasi PosPro via internet melalui:
- Aplikasi Web: **https://pos.domainanda.com**

Semua komunikasi via domain Cloudflare tersebut sudah **Otomatis HTTPS (SSL/TLS terenkripsi)**.

### 🔄 Tips Maintenance
- **Melihat log (pesan error)**: `pm2 logs`
- **Restart backend (misal habis ganti file)**: `pm2 restart pospro-backend`
- **Restart frontend**: `pm2 restart pospro-frontend`

Aplikasi kini aman, _online_ secara publik, dan berjalan _live_ 24/7 dari Home Server Anda!

---

**© 2026 Muhammad Faisal. All rights reserved.**
