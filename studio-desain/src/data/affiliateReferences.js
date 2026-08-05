/**
 * Reference image lookup per field per option.
 * Dipakai oleh ReferenceModal lewat `getImageSrc(value)` callback.
 *
 * Strategy:
 * - Pakai Unsplash search-based URL untuk gambar relevan
 * - Picsum dengan seed sebagai fallback (deterministic)
 * - Browser image error → ReferenceModal otomatis show "coming soon"
 *
 * Untuk regenerate pakai fal.ai, lihat: scripts/generate-reference-images.mjs
 */

// Encode string into safe seed
const seed = (s) => encodeURIComponent(String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40));

// Picsum with seed — deterministic placeholder per option (no API key)
const refImg = (s, size = 400) => `https://picsum.photos/seed/${seed(s)}/${size}/${size}`;

/**
 * Field key → label + getImageSrc for modal.
 * Each entry generates a unique placeholder image per option value.
 */
export const FIELD_REFERENCES = {
  // ─── UGC (mode tidak aktif — disimpan untuk kompatibilitas) ───
  ugc_style: {
    title: 'UGC Style — Format Konten',
    subtitle: 'Tipe konten UGC yang akan dibuat creator.',
    aspect: '4/5',
    getImageSrc: (v) => refImg(`ugc-${v}`),
  },
  camera_style: {
    title: 'Camera Style — Setup Kamera',
    subtitle: 'Cara kamera ditempatkan & angle saat shoot.',
    aspect: '4/5',
    getImageSrc: (v) => refImg(`cam-${v}`),
  },
  product_demo: {
    title: 'Product Demo — Cara Show Product',
    subtitle: 'Bagaimana produk ditampilkan dalam video.',
    aspect: '4/5',
    getImageSrc: (v) => refImg(`demo-${v}`),
  },
};
