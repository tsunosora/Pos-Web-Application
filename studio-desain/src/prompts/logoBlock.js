import { LOGO_POSITION_EN } from '../data/logoOptions.js';

/** Nama brand terbaik dari state (dukung berbagai skema mode). */
function brandOf(s) {
  return (s.logoText || s.brand || s.brandName || s.channel || '').trim() || 'the brand';
}

/**
 * Blok teks LOGO untuk builder yang mengembalikan STRING (fotoproduk, thumbnail).
 * Kosong string kalau logo tidak diaktifkan.
 */
export function buildLogoBlock(s = {}) {
  if (!s.useLogo) return '';
  const pos = LOGO_POSITION_EN[s.logoPosition] || 'top-left corner';
  const lines = [
    ``,
    `BRAND LOGO`,
    `- Display the brand logo for "${brandOf(s)}" in the ${pos}, at a tasteful, clearly legible size.`,
    `- A brand logo image is PROVIDED (uploaded) — reproduce it EXACTLY: do not redraw, distort, recolor, crop, or change its text or proportions.`,
    `- Keep brand identity consistent across every output: identical logo, brand colors, and typography.`,
    s.logoNotes?.trim() ? `- Brand notes: ${s.logoNotes.trim()}.` : null,
  ];
  return lines.filter((l) => l !== null).join('\n');
}

/**
 * Varian OBJEK untuk builder yang mengembalikan JSON (banner, carousel).
 * null kalau logo tidak diaktifkan.
 */
export function buildLogoObject(s = {}) {
  if (!s.useLogo) return null;
  return {
    show_brand_logo: true,
    brand: brandOf(s),
    position: s.logoPosition || 'top-left',
    directive:
      'A brand logo image is provided (uploaded). Reproduce the uploaded logo EXACTLY — do not redraw, distort, recolor, crop, or change its text/proportions. Keep brand identity (logo, colors, typography) consistent across all outputs.',
    ...(s.logoNotes?.trim() ? { notes: s.logoNotes.trim() } : {}),
  };
}
