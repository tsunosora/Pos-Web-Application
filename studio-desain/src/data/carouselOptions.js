// Carousel Feeds — opsi form, story flow per template, dan layout variation engine.
// Website ini HANYA prompt generator (tidak generate gambar, tidak pakai AI di sisi web).

// ---------------------------------------------------------------------------
// Dropdown options
// ---------------------------------------------------------------------------
export const TEMPLATE_TYPES = [
  { value: 'product',        label: 'Product Ads' },
  { value: 'service',        label: 'Service Ads' },
  { value: 'motivation',     label: 'Motivation' },
  { value: 'educational',    label: 'Educational' },
  { value: 'personal',       label: 'Personal Branding' },
  { value: 'promo',          label: 'Promo / Discount' },
  { value: 'testimonial',    label: 'Testimonial / Review' },
  { value: 'problemsolution',label: 'Problem Solution' },
  { value: 'mythfact',       label: 'Myth vs Fact' },
  { value: 'tipshowto',      label: 'Tips / How To' },
  { value: 'beforeafter',    label: 'Before After' },
  { value: 'storytelling',   label: 'Storytelling / Journey' },
  { value: 'news',           label: 'News (Berita) — cukup isi berita' },
];

export const TEMPLATE_LABELS = TEMPLATE_TYPES.reduce((m, t) => {
  m[t.value] = t.label;
  return m;
}, {});

export const SLIDE_PRESETS = [
  { value: '3', label: '3 Slide — Ringkas (Hook → Value → CTA)' },
  { value: '4', label: '4 Slide — Singkat' },
  { value: '5', label: '5 Slide — Standar' },
  { value: '6', label: '6 Slide — Lengkap' },
  { value: '7', label: '7 Slide — Storytelling Lengkap' },
];

export const VISUAL_STYLES = [
  'Minimal Clean', 'Luxury Premium', 'Bold Modern', 'Soft Pastel',
  'Dark Cinematic', 'Vibrant Gradient', 'Editorial Magazine',
  '3D Render', 'Flat Illustration', 'Natural Lifestyle',
];

export const TONE_OPTIONS = [
  'Persuasive', 'Friendly / Casual', 'Professional', 'Bold / Punchy',
  'Emotional', 'Educative', 'Luxury / Premium', 'Fun / Playful',
];

export const PLATFORMS = ['Instagram', 'TikTok', 'LinkedIn', 'Facebook'];

export const RATIOS = ['1:1 (Square)', '4:5 (Portrait)', '9:16 (Story / Reels)'];

export const COLOR_MOODS = [
  'Warm', 'Cool', 'Monochrome', 'Vibrant', 'Pastel',
  'Earthy', 'Dark / Moody', 'Bright / Airy',
];

// ---------------------------------------------------------------------------
// Generic fallback flow (dipakai kalau template tidak punya preset count tertentu)
// ---------------------------------------------------------------------------
const GENERIC_FLOWS = {
  3:  ['Hook', 'Value', 'CTA'],
  4:  ['Hook', 'Problem / Context', 'Main Value', 'CTA'],
  5:  ['Hook', 'Problem / Context', 'Main Value', 'Proof / Benefit', 'CTA'],
  6:  ['Hook', 'Problem', 'Insight', 'Solution', 'Benefit', 'CTA'],
  7:  ['Hook', 'Problem', 'Insight', 'Solution', 'Benefit', 'Proof', 'CTA'],
};

// ---------------------------------------------------------------------------
// Story flow per template type. Setiap template punya alur cerita sendiri,
// menyesuaikan jumlah slide (3 / 5 / 7 / 10). Slide 1 selalu Hook, slide
// terakhir selalu CTA. Master = flow 10-slide, dipakai untuk men-synthesize
// jumlah slide custom (mis. 4, 6, 8) lewat sampleFlow().
// ---------------------------------------------------------------------------
export const STORY_FLOWS = {
  product: {
    3:  ['Hook', 'Main Benefit', 'CTA'],
    5:  ['Hook', 'Problem', 'Product Solution', 'Benefits', 'CTA'],
    7:  ['Hook', 'Problem', 'Hidden Cause', 'Product Reveal', 'Feature Benefits', 'Trust / Review', 'CTA'],
    10: ['Hook', 'Problem', 'Pain Detail', 'Why Common Products Fail', 'Product Reveal',
         'Feature 1', 'Feature 2', 'Comparison', 'Trust Proof', 'CTA'],
  },
  service: {
    3:  ['Hook', 'Service Value', 'CTA'],
    5:  ['Hook', 'Client Problem', 'Service Solution', 'Result / Benefit', 'CTA'],
    7:  ['Hook', 'Problem', 'Mistake Audience Makes', 'Service Method', 'Result Preview', 'Trust / Portfolio', 'CTA'],
    10: ['Hook', 'Problem', 'Pain Detail', 'Why DIY Fails', 'Service Introduction',
         'Process Step 1', 'Process Step 2', 'Expected Result', 'Trust / Case Study', 'CTA'],
  },
  motivation: {
    3:  ['Strong Quote Hook', 'Core Message', 'Action CTA'],
    5:  ['Emotional Hook', 'Relatable Struggle', 'Mindset Shift', 'Empowering Message', 'CTA / Save This'],
    7:  ['Hook', 'Pain / Struggle', 'Reality Check', 'New Perspective', 'Practical Reminder', 'Emotional Push', 'CTA / Share / Save'],
    10: ['Hook', 'Relatable Pain', 'Harsh Truth', 'Hidden Lesson', 'Mindset Shift',
         'Step 1', 'Step 2', 'Step 3', 'Final Reminder', 'CTA'],
  },
  educational: {
    3:  ['Topic Hook', 'Key Lesson', 'Summary CTA'],
    5:  ['Hook', 'Common Mistake', 'Explanation', 'Practical Tip', 'CTA / Save'],
    7:  ['Hook', 'Problem', 'Misconception', 'Explanation', 'Example', 'Key Takeaway', 'CTA'],
    10: ['Hook', 'Why It Matters', 'Mistake 1', 'Mistake 2', 'Core Concept',
         'Step 1', 'Step 2', 'Example', 'Summary', 'CTA'],
  },
  personal: {
    3:  ['Personal Hook', 'Core Belief / Lesson', 'Follow CTA'],
    5:  ['Hook', 'Personal Story', 'Lesson Learned', 'Value for Audience', 'CTA'],
    7:  ['Hook', 'Personal Problem', 'Turning Point', 'Lesson', 'Framework', 'Result / Belief', 'CTA'],
    10: ['Hook', 'Backstory', 'Struggle', 'Mistake', 'Turning Point',
         'Lesson 1', 'Lesson 2', 'Result', 'Personal Belief', 'CTA'],
  },
  promo: {
    3:  ['Offer Hook', 'Value Stack', 'CTA'],
    5:  ['Hook', 'Offer Detail', 'Benefits', 'Urgency', 'CTA'],
    7:  ['Hook', 'Why This Offer Matters', 'Product / Service Value', 'Bonus / Feature', 'Price Comparison', 'Urgency / Scarcity', 'CTA'],
    10: ['Hook', 'Audience Problem', 'Offer Reveal', 'Main Benefit', 'Bonus 1',
         'Bonus 2', 'Price Anchor', 'Objection Handling', 'Urgency', 'CTA'],
  },
  testimonial: {
    3:  ['Review Hook', 'Result / Benefit', 'CTA'],
    5:  ['Hook', 'Before Condition', 'Experience', 'Result', 'CTA'],
    7:  ['Hook', 'Customer Problem', 'Why They Tried It', 'Product / Service Experience', 'Result', 'Review Proof', 'CTA'],
    10: ['Hook', 'Customer Background', 'Problem', 'Hesitation', 'First Impression',
         'Favorite Feature', 'Result', 'Review Quote', 'Recommendation', 'CTA'],
  },
  mythfact: {
    3:  ['Myth Hook', 'Fact Reveal', 'CTA'],
    5:  ['Myth Hook', 'Why People Believe It', 'Fact', 'Better Way', 'CTA'],
    7:  ['Hook', 'Myth', "Why It's Wrong", 'Fact', 'Example', 'Key Takeaway', 'CTA'],
    10: ['Hook', 'Myth 1', 'Fact 1', 'Myth 2', 'Fact 2',
         'Myth 3', 'Fact 3', 'Better Framework', 'Summary', 'CTA'],
  },
  tipshowto: {
    3:  ['Hook', 'Main Tip', 'CTA'],
    5:  ['Hook', 'Tip 1', 'Tip 2', 'Tip 3', 'CTA'],
    7:  ['Hook', 'Mistake', 'Tip 1', 'Tip 2', 'Tip 3', 'Bonus Tip', 'CTA'],
    10: ['Hook', 'Common Mistake', 'Step 1', 'Step 2', 'Step 3',
         'Step 4', 'Step 5', 'Example', 'Summary', 'CTA'],
  },
  // Template tambahan (tidak ada di brief detail, di-synthesize konsisten)
  problemsolution: {
    3:  ['Problem Hook', 'Solution', 'CTA'],
    5:  ['Hook', 'Problem', 'Root Cause', 'Solution', 'CTA'],
    7:  ['Hook', 'Problem', 'Why It Happens', 'Failed Attempts', 'Solution', 'Result', 'CTA'],
    10: ['Hook', 'Problem', 'Pain Detail', 'Hidden Cause', 'Why Common Fixes Fail',
         'Solution Reveal', 'How It Works', 'Result', 'Proof', 'CTA'],
  },
  beforeafter: {
    3:  ['Before Hook', 'After Result', 'CTA'],
    5:  ['Hook', 'Before State', 'Turning Point', 'After State', 'CTA'],
    7:  ['Hook', 'Before', 'Problem', 'Change / Action', 'After', 'Proof', 'CTA'],
    10: ['Hook', 'Before State', 'Pain Detail', 'Decision', 'Process Step 1',
         'Process Step 2', 'After State', 'Comparison', 'Proof', 'CTA'],
  },
  storytelling: {
    3:  ['Story Hook', 'Lesson', 'CTA'],
    5:  ['Hook', 'Beginning', 'Conflict', 'Resolution', 'CTA'],
    7:  ['Hook', 'Beginning', 'Struggle', 'Turning Point', 'Lesson', 'Outcome', 'CTA'],
    10: ['Hook', 'Background', 'Beginning', 'Struggle', 'Low Point',
         'Turning Point', 'Action', 'Lesson', 'Outcome', 'CTA'],
  },
  // News: alur carousel berita. Slide 1 = headline/cover, slide akhir = sumber + follow.
  news: {
    3:  ['Headline', 'Key Facts', 'Source / Follow'],
    5:  ['Headline', 'Lead / Ringkasan', 'Key Facts', 'Konteks / Dampak', 'Source / Follow'],
    7:  ['Headline', 'Lead / Ringkasan', 'Key Facts', 'Latar Belakang', 'Dampak', 'Kutipan / Reaksi', 'Source / Follow'],
    10: ['Headline', 'Lead / Ringkasan', 'Fakta 1', 'Fakta 2', 'Latar Belakang',
         'Dampak', 'Kutipan / Reaksi', 'Langkah Selanjutnya', 'Kesimpulan', 'Source / Follow'],
  },
};

// Synthesize flow untuk jumlah slide yang tidak punya preset (mis. 4, 6, 8, 12).
// Selalu Hook di awal & CTA di akhir, isi tengah disampling merata dari master 10-slide.
function sampleFlow(master, n) {
  if (n <= 1) return [master[master.length - 1] || 'CTA'];
  if (n === 2) return [master[0], master[master.length - 1]];
  const hook = master[0];
  const cta = master[master.length - 1];
  const pool = master.slice(1, master.length - 1);
  const midCount = n - 2;
  const mids = [];
  for (let i = 0; i < midCount; i++) {
    const idx = midCount === 1
      ? Math.floor(pool.length / 2)
      : Math.round((i * (pool.length - 1)) / (midCount - 1));
    mids.push(pool[Math.min(idx, pool.length - 1)] || 'Value');
  }
  return [hook, ...mids, cta];
}

// Turunkan flow 4 dari flow 5 (buang 1 slide pendukung) & flow 6 dari flow 7,
// supaya alur tetap rapi & nyambung tanpa harus menulis manual tiap template.
function deriveFlow(table, n) {
  if (n === 4 && table[5]) { const f = [...table[5]]; f.splice(3, 1); return f; } // drop slide ke-4
  if (n === 6 && table[7]) { const f = [...table[7]]; f.splice(5, 1); return f; } // drop slide ke-6
  return null;
}

/** Ambil story flow (array objective) sesuai templateType + jumlah slide. */
export function getStoryFlow(templateType, totalSlides) {
  const table = STORY_FLOWS[templateType] || null;
  const n = totalSlides;
  if (table) {
    if (table[n]) return [...table[n]];
    const derived = deriveFlow(table, n);
    if (derived) return derived;
    return sampleFlow(table[7] || table[10] || table[5], n);
  }
  if (GENERIC_FLOWS[n]) return [...GENERIC_FLOWS[n]];
  const gd = deriveFlow(GENERIC_FLOWS, n);
  if (gd) return gd;
  return sampleFlow(GENERIC_FLOWS[7], n);
}

// ---------------------------------------------------------------------------
// Layout Variation Engine
// Setiap slide punya layout berbeda. Tidak boleh posisi gambar/teks sama 2x
// berturut-turut. Slide terakhir selalu pakai layout konversi final.
// ---------------------------------------------------------------------------
export const LAYOUT_SEQUENCE = [
  {
    name: 'Hero layout',
    image: 'center / right',
    text: 'top-left',
    note: 'Main product/image as hero (center or right). Big headline top/left. Strong focal point.',
  },
  {
    name: 'Split layout',
    image: 'right',
    text: 'left',
    note: 'Split composition: text on the left, image on the right. Good for showing a problem visual.',
  },
  {
    name: 'Diagonal layout',
    image: 'bottom-left',
    text: 'top-right',
    note: 'Diagonal energy: image bottom-left, text top-right. Add small icons / info cards.',
  },
  {
    name: 'Center hero reveal',
    image: 'center',
    text: 'top & bottom',
    note: 'Product/image centered as a reveal. Text placed above and below the visual.',
  },
  {
    name: 'Feature cards layout',
    image: 'left / right',
    text: 'around cards',
    note: 'Image on one side, with 3 floating feature cards distributed around it.',
  },
  {
    name: 'Social proof layout',
    image: 'right',
    text: 'left (review cards)',
    note: 'Review / proof cards on the left, image or product on the right.',
  },
  {
    name: 'Comparison layout',
    image: 'split left/right',
    text: 'top labels',
    note: 'Before/after or left vs right comparison. Clear divider between the two sides.',
  },
  {
    name: 'Trust layout',
    image: 'right / inset',
    text: 'left',
    note: 'Trust elements: rating, proof badges, testimonial. Clean and credible.',
  },
  {
    name: 'Insight layout',
    image: 'wide background',
    text: 'centered overlay',
    note: 'Wide cinematic shot as background with a centered overlay statement / insight.',
  },
  {
    name: 'CTA layout',
    image: 'large center',
    text: 'bottom center',
    note: 'Big final visual, headline strong, CTA button bottom center.',
  },
];

export const FINAL_LAYOUT = {
  name: 'Final conversion layout',
  image: 'large center',
  text: 'bottom center',
  note: 'Clean strong conversion page. Main visual large, prominent CTA button, slide indicator.',
};

// PRNG deterministik (mulberry32) + seed dari string → "random" tapi stabil
// untuk input yang sama (tidak flicker pas ngetik), beda untuk konten berbeda.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function makeSeed(str) {
  let h = 2166136261;
  const s = String(str || '');
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/**
 * Assign layout tiap slide. Slide 1 (index 0) dioverride oleh cover layout
 * pilihan user di builder. Slide 2..sebelum akhir = OTOMATIS & RANDOM (di-shuffle
 * dari LAYOUT_SEQUENCE pakai seed konten), tidak repeat berturut-turut.
 * Slide terakhir = FINAL_LAYOUT (closing/CTA).
 */
export function assignLayouts(totalSlides, seed = 1) {
  const rnd = mulberry32((seed >>> 0) || 1);
  // Fisher-Yates shuffle (seeded) → urutan layout acak tapi deterministik.
  const pool = [...LAYOUT_SEQUENCE];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const layouts = [];
  let pi = 0;
  for (let i = 0; i < totalSlides; i++) {
    if (i === totalSlides - 1) { layouts.push(FINAL_LAYOUT); continue; }
    let pick = pool[pi % pool.length]; pi++;
    const prev = layouts[i - 1];
    // Hindari posisi gambar+teks identik dengan slide sebelumnya.
    if (prev && prev.image === pick.image && prev.text === pick.text) {
      pick = pool[pi % pool.length]; pi++;
    }
    layouts.push(pick);
  }
  return layouts;
}

/** Susun deskripsi layout untuk dipakai di prompt. */
export function layoutDirection(layout) {
  return [
    layout.name,
    `Image position: ${layout.image}`,
    `Text position: ${layout.text}`,
    layout.note,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Pilihan layout untuk SLIDE 1 (cover): letak gambar & teks.
// Dipakai SEMUA template carousel — bersama oleh prompt (layoutDirection) &
// mockup wireframe, supaya user bisa atur komposisi slide pertama.
// ---------------------------------------------------------------------------
export const COVER_LAYOUTS = [
  { value: 'auto',         label: 'Otomatis (Hero) — Default',    image: 'center / right', text: 'top-left',     note: 'Main product/image as hero (center or right). Big headline top/left. Strong focal point.', promptName: 'Hero layout' },
  { value: 'image-top',    label: 'Gambar Atas · Teks Bawah',     image: 'top',         text: 'bottom',         note: 'Foto/produk di bagian atas, headline besar di bawah.' },
  { value: 'image-bottom', label: 'Gambar Bawah · Teks Atas',     image: 'bottom',      text: 'top',            note: 'Headline di atas, foto/produk di bagian bawah.' },
  { value: 'image-right',  label: 'Gambar Kanan · Teks Kiri',     image: 'right',       text: 'left',           note: 'Foto/produk di sisi kanan, headline di kiri (split).' },
  { value: 'image-left',   label: 'Gambar Kiri · Teks Kanan',     image: 'left',        text: 'right',          note: 'Foto/produk di sisi kiri, headline di kanan (split).' },
  { value: 'image-full',   label: 'Gambar Full · Teks Overlay',   image: 'full-bleed',  text: 'overlay-bottom', note: 'Foto/produk memenuhi frame, headline overlay di bawah dengan gradient gelap.' },
  { value: 'text-focus',   label: 'Teks Dominan · Gambar Kecil',  image: 'small-strip', text: 'hero',           note: 'Headline mega-besar mendominasi, foto/produk kecil sebagai aksen.' },
];

export const COVER_MAP = COVER_LAYOUTS.reduce((m, l) => { m[l.value] = l; return m; }, {});

/** Ambil objek layout cover slide 1 (untuk prompt) berdasarkan value dropdown. */
export function getCoverLayout(value) {
  const l = COVER_MAP[value] || COVER_MAP.auto || COVER_LAYOUTS[0];
  // promptName dipakai supaya default 'auto' menghasilkan teks "Hero layout"
  // persis seperti sebelum fitur letak gambar & teks ditambahkan.
  return { name: l.promptName || l.label, image: l.image, text: l.text, note: l.note };
}
