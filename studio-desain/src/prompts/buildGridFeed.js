// Feed Grid 3x3 — builder.
// User cukup isi BRIEF (info yang dibaca AI). Output = info produk + arahan gaya
// visual (konsisten) + STRUKTUR tiap feed (ditunjukkan SEKALI) + daftar PERAN
// feed (ringkas). ChatGPT yang menulis copy tiap feed & render gambar grid —
// website TIDAK menulis per-feed.

import { STYLE_MAP } from '../data/gridFeedOptions.js';

export const INITIAL_GRIDFEED = {
  brandName: '',
  username: '',
  productName: '',
  productDesc: '',
  mainBenefit: '',
  targetAudience: '',
  headline: '',
  supportingText: '',
  ctaText: '',
  price: '',
  visualStyle: 'Korean pastel premium',
  goal: 'Promo penjualan',
  feedCount: '9',
  useCustomColor: false,
  colorPrimary: '#ec4899',
  colorSecondary: '#ffffff',
};

const t = (v, d = '') => (typeof v === 'string' ? v.trim() : v || '') || d;
const atUser = (u) => {
  const x = t(u).replace(/^@+/, '');
  return x ? '@' + x : '@brand';
};

// Peran tiap feed — hanya nama + objektif (ringkas). ChatGPT yang isi detailnya.
function roleList(price) {
  return {
    hero:       'HERO — hook utama, perkenalkan produk tampil besar dengan headline kuat',
    lifestyle:  'LIFESTYLE — manfaat emosional / adegan pemakaian di kehidupan nyata',
    fitur:      'FITUR / ISI PAKET — tampilkan fitur unggulan atau isi paket produk',
    benefit:    'KEUNGGULAN — tonjolkan keunggulan utama & alasan memilih produk',
    usecase:    'USE CASE / MOMEN — momen atau situasi pemakaian (hadiah, harian, dll)',
    offer:      'HARGA / PROMO — tonjolkan penawaran/harga + urgency ringan' + (price ? ` (harga Rp${price})` : ''),
    testimoni:  'TESTIMONI — bangun kepercayaan lewat rating / ulasan pelanggan',
    brand:      'BRAND IDENTITY — tampilkan identitas / tagline brand',
    cta:        'CTA / ORDER — ajakan order, arahkan ke link bio',
    extraFitur:     'DETAIL FITUR — close-up keunggulan / fitur tambahan',
    extraTestimoni: 'TESTIMONI 2 — social proof tambahan',
    extraLifestyle: 'LIFESTYLE 2 — produk dalam keseharian',
  };
}

const ROLE_SETS = {
  3:  ['hero', 'benefit', 'cta'],
  6:  ['hero', 'lifestyle', 'fitur', 'offer', 'testimoni', 'cta'],
  9:  ['hero', 'lifestyle', 'fitur', 'benefit', 'usecase', 'offer', 'testimoni', 'brand', 'cta'],
  12: ['hero', 'lifestyle', 'fitur', 'benefit', 'usecase', 'offer', 'testimoni', 'extraTestimoni', 'extraLifestyle', 'extraFitur', 'brand', 'cta'],
};

export function buildGridFeed(s) {
  const brand = t(s.brandName, 'BRAND');
  const user = atUser(s.username || s.brandName);
  const product = t(s.productName, 'Produk');
  const style = STYLE_MAP[s.visualStyle] || STYLE_MAP['Korean pastel premium'];

  // Warna: kalau user pilih CUSTOM → pakai itu. Kalau TIDAK dipilih → ChatGPT
  // tentukan sendiri dari warna DOMINAN foto produk yang diupload.
  const colorFamily = s.useCustomColor
    ? `${t(s.colorPrimary, '#ec4899')} (warna utama), ${t(s.colorSecondary, '#ffffff')} (sekunder), + warna netral pendukung — tiap feed tonjolkan kombinasi/proporsi BERBEDA dari keluarga ini`
    : `TENTUKAN SENDIRI dari warna DOMINAN foto produk yang diupload — bentuk 1 keluarga warna yang serasi dengan produk (selaraskan dengan mood "${style.aesthetic}"). Tiap feed tonjolkan kombinasi/proporsi warna yang BERBEDA dari keluarga itu`;

  const n = [3, 6, 9, 12].includes(parseInt(s.feedCount, 10)) ? parseInt(s.feedCount, 10) : 9;
  const cols = 3;
  const rows = Math.ceil(n / cols);
  const roles = ROLE_SETS[n];
  const ROLES = roleList(t(s.price));

  const desc = t(s.productDesc);
  const benefit = t(s.mainBenefit, t(s.supportingText));
  const aud = t(s.targetAudience);
  const price = t(s.price);
  const cta = t(s.ctaText);

  let out = '';
  // ── INSTRUKSI untuk ChatGPT ──
  out += `Buat campaign Instagram GRID ${cols}x${rows} (${n} feed) dari info produk di bawah.\n`;
  out += `1) SETIAP FEED HARUS BERBEDA & TIDAK BOLEH KEMBAR — variasikan SEMUANYA tiap feed: layout, komposisi, sudut/angle produk, background, MAIN TEXT (3-6 kata), SUB TEXT, CTA, extra elements, DAN kombinasi/emphasis warna. Jangan ada dua feed yang susunan atau warnanya mirip. Tulis semua copy sendiri dalam Bahasa Indonesia.\n`;
  out += `2) IMPROVE sendiri kualitasnya: tingkatkan tampilan foto produk ke level commercial premium (perbaiki lighting, refleksi, bayangan, ketajaman, retouch halus) TANPA mengubah bentuk, logo, atau warna asli produk. Pilih & improve sendiri TYPOGRAPHY, komposisi, ANGLE/sudut pandang & perspektif produk, framing, dan detail estetik terbaik yang paling cocok dengan produk & mood — variasikan tiap feed.\n`;
  out += `3) Supaya grid TETAP SERASI jadi satu campaign (bukan 9 gambar acak): semua feed ambil dari SATU KELUARGA WARNA yang sama (lihat "GAYA VISUAL"), pakai SATU keluarga font yang konsisten, dan produk dijaga sama. Tiap feed hanya beda emphasis/variasi — bukan beda total.\n`;
  out += `4) Render SATU gambar grid ${cols}x${rows} dalam ORIENTASI POTRET/VERTIKAL (JANGAN per-feed, JANGAN satu-satu — semua dalam 1 gambar potret).\n`;
  out += `   ATURAN RASIO (WAJIB, tidak bisa ditawar): SETIAP SEL/feed di dalam grid HARUS tepat rasio 4:5 POTRET (lebar:tinggi = 4:5, mis. tiap sel 1080x1350 px). DILARANG sel berbentuk 2:3 (terlalu tinggi), 1:1 (kotak), atau landscape.\n`;
  out += `   Cara mencapainya: beri GUTTER/jarak (boleh warna netral senada) antar sel; biarkan ada ruang kosong jika perlu — yang penting tiap kotak feed-nya pas 4:5 potret. JANGAN meregangkan/menggepengkan sel untuk memenuhi kanvas. Total kanvas grid POTRET = 3 sel 4:5 melebar x ${rows} sel 4:5 menurun (keseluruhan tetap potret).\n`;
  out += `   Taruh elemen penting (logo, headline, harga, CTA) agak ke tengah sel, tidak mepet tepi.\n`;

  // ── INFO PRODUK ──
  out += `\n── INFO PRODUK ──\n`;
  out += `Brand: ${brand} | Username: ${user}\n`;
  out += `Produk: ${product}${desc ? ` — ${desc}` : ''}\n`;
  if (benefit) out += `Manfaat utama: ${benefit}\n`;
  if (aud) out += `Target audience: ${aud}\n`;
  if (price) out += `Harga: Rp${price}\n`;
  if (cta) out += `Preferensi CTA: ${cta} (boleh divariasikan tiap feed)\n`;
  out += `Goal: ${t(s.goal, 'Promo penjualan')}\n`;
  out += `Concept (benang merah): ${t(s.headline) ? `"${t(s.headline)}"` : `"${product} — ${brand}"`}\n`;

  // ── GAYA VISUAL (konsisten semua feed) ──
  out += `\n── GAYA VISUAL (anchor keserasian — emphasis-nya variasikan tiap feed) ──\n`;
  out += `Style: ${style.aesthetic}\n`;
  out += `Keluarga warna: ${colorFamily}\n`;
  out += `Typography: pilih & improve sendiri gaya typography premium yang paling cocok dengan produk & mood (saran: ${style.typo}). Pakai 1 keluarga font KONSISTEN, boleh beda ukuran/berat tiap feed\n`;
  out += `Lighting: ${style.lighting}  (senada semua feed)\n`;
  out += `Format: Instagram Feed, Portrait 4:5, 1080x1350, premium social media composition\n`;
  out += `Product presentation: IMPROVE produk ke level commercial premium — ultra realistic textures, glossy reflections, premium shadows, cinematic highlights, retouch halus, luxury product rendering (bentuk, logo & warna asli produk TIDAK diubah)\n`;
  out += `Quality: premium commercial advertising, 4K ultra detailed, high-end Instagram feed campaign\n`;

  // ── STRUKTUR TIAP FEED (ditunjukkan sekali; kamu yang isi [ ... ]) ──
  out += `\n── STRUKTUR TIAP FEED (isi [ ... ], BEDA tiap feed) ──\n`;
  out += `STYLE: [peran feed + aesthetic]\n`;
  out += `LAYOUT: [komposisi unik per feed: posisi produk, teks, logo, angle]\n`;
  out += `BACKGROUND: [scene/latar unik per feed, masih dalam gaya visual]\n`;
  out += `COLOR PALETTE: [kombinasi warna dari keluarga di atas — emphasis BERBEDA tiap feed]\n`;
  out += `MAIN TEXT: "[headline singkat 3-6 kata]"\n`;
  out += `SUB TEXT: "[kalimat pendukung]"\n`;
  out += `CTA: "[ajakan] • ${user}"\n`;
  out += `EXTRA ELEMENTS: [dekor kecil sesuai tema, beda tiap feed]\n`;
  out += `(FORMAT, TYPOGRAPHY 1 keluarga font, LIGHTING, PRODUCT PRESENTATION, QUALITY = ikut "GAYA VISUAL")\n`;

  // ── PERAN TIAP FEED ──
  out += `\n── PERAN ${n} FEED ──\n`;
  roles.forEach((key, i) => { out += `${i + 1}. ${ROLES[key]}\n`; });

  out += `\nCATATAN: produk WAJIB dijaga bentuk, logo & warnanya sesuai foto/asli (jangan mengarang produk baru).`;

  return out;
}
