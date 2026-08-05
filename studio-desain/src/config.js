/**
 * KONFIGURASI RUNTIME (white-label / reseller).
 *
 * Nilai dibaca dari window.__AF_CONFIG yang di-set oleh /config.js
 * (file teks biasa di root, dimuat SEBELUM bundle). Artinya buyer bisa
 * mengubah brand, link bayar, password, & sumber login HANYA dengan
 * mengedit /config.js — TANPA build ulang.
 *
 * Kalau window.__AF_CONFIG tidak ada (mis. dev), pakai default di bawah —
 * yaitu setup ASLI milik kamu (Airtable). Jadi situsmu sendiri tidak berubah.
 */

const cfg = (typeof window !== 'undefined' && window.__AF_CONFIG) || {};
const pick = (v, d) => (v === undefined || v === null || v === '' ? d : v);

export const CONFIG = {
  // ── Branding ──────────────────────────────────────────────
  brandName: pick(cfg.brandName, 'Auto Feeds'),
  tagline:   pick(cfg.tagline, 'AI Design Studio · v2.1'),
  logoUrl:   pick(cfg.logoUrl, '/landing/brand/logo.png'),

  // ── Warna (opsional; kosong = pakai default merah/gelap) ──
  // accentColor : warna utama brand (tombol, link, glow). Hex, mis "#7c3aed".
  // bgColor     : warna dasar background (gelap). Hex, mis "#0a0a14".
  accentColor: pick(cfg.accentColor, ''),
  bgColor:     pick(cfg.bgColor, ''),

  // ── Link ──────────────────────────────────────────────────
  paymentUrl:   pick(cfg.paymentUrl, 'https://aiautomation.myr.id/pl/auto-feeds/'),
  affiliateUrl: pick(cfg.affiliateUrl, 'https://web.mayar.id/sign-in/referral/fUAlH05'),

  // Tombol setelah Copy: link ChatGPT biasa + Custom GPT (kosong = sembunyikan tombol GPT).
  chatgptUrl: pick(cfg.chatgptUrl, 'https://chatgpt.com/'),
  gptUrl:     pick(cfg.gptUrl, ''),

  // ── Social (footer) ───────────────────────────────────────
  instagramUrl:    pick(cfg.instagramUrl, 'https://instagram.com/brandmu'),
  instagramHandle: pick(cfg.instagramHandle, '@brandmu'),
  facebookUrl:     pick(cfg.facebookUrl, 'https://www.facebook.com/people/Autofeedsid/61590446791266/'),
  facebookHandle:  pick(cfg.facebookHandle, 'Autofeedsid'),

  // ── Harga (tampilan) ──────────────────────────────────────
  price:        pick(cfg.price, '90.000'),
  priceStrike:  pick(cfg.priceStrike, '700.000'),
  affiliatePerSignup: Number(pick(cfg.affiliatePerSignup, 63000)),

  // ── Tier 2: Lisensi Reseller (hak jual kembali, profit 100%) ──
  showResellerTier:   cfg.showResellerTier !== false,        // true = tampilkan kartu reseller
  resellerPrice:      pick(cfg.resellerPrice, '290.000'),
  resellerStrike:     pick(cfg.resellerStrike, '2.000.000'),
  resellerPaymentUrl: pick(cfg.resellerPaymentUrl, pick(cfg.paymentUrl, 'https://aiautomation.myr.id/pl/auto-feeds/')),

  // ── LOGIN ─────────────────────────────────────────────────
  // mode: 'sheet' (Google Spreadsheet CSV) | 'airtable' (default lama).
  // Kalau sheetCsvUrl diisi → otomatis mode 'sheet'.
  sheetCsvUrl: pick(cfg.sheetCsvUrl, ''),
  // Proxy server (mis. "/auth.php"): password + token diverifikasi SERVER-SIDE
  // → tidak ada token/password di config.js maupun bundle. Kalau diisi,
  // login lewat proxy ini (paling aman untuk situs utama).
  authEndpoint: pick(cfg.authEndpoint, ''),
  // SHA-256(salt + password). Default = password lama 'Designitumudah'.
  // Buyer ganti pakai hash-tool.html (tanpa coding).
  loginPasswordHash: pick(cfg.loginPasswordHash, '963c3db89fe46ce864f484d91214378d1e5f52948afef6828d2ab28e479c90ee'),

  // Kredensial Airtable (terobfuscate) HANYA ada di config milik pemilik asli.
  // Paket reseller TIDAK menyertakan ini → token kamu tidak ikut terjual.
  // Bentuk: { t, b, f:[...], k }
  airtable: cfg.airtable || null,
};

// Wordmark: kata terakhir di-accent (mis. "Auto Feeds" → Auto + <Feeds>).
export function brandParts() {
  const words = CONFIG.brandName.trim().split(/\s+/);
  if (words.length === 1) return { lead: '', accent: words[0] };
  return { lead: words.slice(0, -1).join(' '), accent: words[words.length - 1] };
}
