// Build CSS Tailwind untuk storefront toko/ (menggantikan CDN "play" yang
// mengompilasi CSS di browser dan memperlambat halaman).
//
// Build ulang setiap kali menambah class Tailwind baru di toko/**:
//   ./tailwindcss -c toko-build/tailwind.config.js -i toko-build/input.css -o toko/assets/tailwind.css --minify
// (binary standalone v3.4.x: https://github.com/tailwindlabs/tailwindcss/releases)
//
// toko-build/snapshots/ berisi HTML halaman publik yang dirender (produk,
// artikel, dll) supaya class dari konten DB / PosPro ikut ter-generate.
module.exports = {
  content: [
    './toko/**/*.php',
    './toko/assets/**/*.js',
    './toko-build/snapshots/**/*.html',
  ],
  theme: {
    extend: {
      // Warna brand dinamis (Dashboard → Tampilan) lewat CSS variable dari header.php,
      // tetap mendukung modifier opasitas seperti bg-brand/40.
      colors: { brand: 'rgb(var(--brand-rgb) / <alpha-value>)' },
    },
  },
};
