/* ====================================================================
   KONFIGURASI - edit file ini lalu upload. TIDAK perlu build/coding.
   Baca PANDUAN-SETUP.txt untuk panduan lengkap + aturan tanda kutip.
   ==================================================================== */
window.__AF_CONFIG = {

  /* -- 1. BRANDING --------------------------------------------------- */
  brandName: "Studio Desain",              // nama brandmu (kata terakhir tampil warna aksen)
  tagline:   "AI Design Studio",           // teks kecil di bawah logo
  logoUrl:   "/landing/brand/logo.png",    // timpa file logo di folder ini, atau isi URL gambar

  /* -- 1b. WARNA (opsional) - kosongkan "" = pakai bawaan -------------
     accentColor : warna utama (tombol, link, glow). bgColor : background GELAP. */
  accentColor: "",   // contoh: "#7c3aed" (ungu) / "#2563eb" (biru) / "#0d9488" (teal)
  bgColor:     "",   // contoh: "#0a0a14" (navy gelap) / "#0c0a09" (charcoal)

  /* -- 2. LINK ------------------------------------------------------- */
  paymentUrl:   "https://CHECKOUT-KAMU.com",   // link pembayaran/checkout kamu
  affiliateUrl: "",                            // link daftar affiliate (boleh kosong "")

  // Mode "9 Feed Konsisten" - link ChatGPT untuk tombol setelah Copy & tutorial.
  // chatgptUrl = ChatGPT biasa. gptUrl = Custom GPT kamu sendiri (kosong "" = tombol GPT disembunyikan).
  chatgptUrl: "https://chatgpt.com/",
  gptUrl:     "",

  /* -- 2b. SOCIAL (footer) ------------------------------------------- */
  instagramUrl:    "https://instagram.com/akunkamu",
  instagramHandle: "@akunkamu",
  facebookUrl:     "https://facebook.com/akunkamu",
  facebookHandle:  "Akun Kamu",

  /* -- 3. HARGA (tampilan teks) -------------------------------------- */
  price:       "99.000",     // harga tampil
  priceStrike: "700.000",    // harga coret
  affiliatePerSignup: 63000, // komisi affiliate per pendaftaran (angka, tanpa kutip)

  /* -- 3b. TIER LISENSI RESELLER ------------------------------------
     false = sembunyikan kartu "Jual Ulang" (untuk situs jualan biasa). */
  showResellerTier: false,

  /* -- 4. LOGIN via GOOGLE SPREADSHEET ------------------------------
     1. Buat Google Sheet, kolom A1 = "Email", isi email pelanggan ke bawah.
     2. File > Share > Publish to web > pilih sheet > format CSV > Publish.
     3. Salin URL (berakhiran output=csv), tempel DI ANTARA kutip di bawah. */
  sheetCsvUrl: "",

  // Password login (semua pelanggan pakai 1 password ini). JANGAN tulis
  // password apa adanya - buka hash-tool.html, ketik password, salin hash-nya,
  // tempel DI ANTARA kutip (ganti kode lama).
  loginPasswordHash: "963c3db89fe46ce864f484d91214378d1e5f52948afef6828d2ab28e479c90ee",
  // ^ bawaan = password "Designitumudah". Ganti dengan punyamu (pakai hash-tool.html).
};
