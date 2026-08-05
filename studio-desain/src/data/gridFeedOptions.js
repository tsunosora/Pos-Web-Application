// Feed Grid 3x3 — opsi dropdown + "style map".
// Website HANYA generate prompt (bukan gambar). User copy prompt → paste ke
// ChatGPT biasa → ChatGPT yang render gambar grid.

export const FEED_COUNTS = [
  { value: '3',  label: '3 Feeds (1x3) — Ringkas' },
  { value: '6',  label: '6 Feeds (2x3) — Sedang' },
  { value: '9',  label: '9 Feed Konsisten (disarankan)' },
  { value: '12', label: '12 Feeds (4x3) — Maksimal' },
];

export const GOALS = [
  'Promo penjualan', 'Launching produk', 'Branding premium', 'Awareness', 'Edukasi',
];

export const VISUAL_STYLES_GRID = [
  'Korean pastel premium',
  'Luxury elegant',
  'Clean minimalist',
  'Dark premium',
  'Futuristic tech',
  'Natural organic',
  'Fun colorful',
  'Beauty/fashion editorial',
];

// Tiap style menentukan elemen yang KONSISTEN di semua feed: palette, typography,
// lighting, background dasar, extra elements, dan "grid mood".
export const STYLE_MAP = {
  'Korean pastel premium': {
    aesthetic: 'Korean pastel luxury commercial',
    bg: 'soft pastel gradient studio, dreamy aesthetic, subtle cloud & sparkle',
    palette: 'pastel pink, pearl white, soft cream, baby gold',
    typo: 'bold modern rounded typography, premium hierarchy, friendly & mudah dibaca',
    lighting: 'soft cinematic studio lighting, glossy highlights, clean soft shadow',
    extra: 'floating soft elements, sparkle',
    mood: 'Pastel pink • Pearl white • Soft cream • Gold accent',
  },
  'Luxury elegant': {
    aesthetic: 'high-end luxury editorial',
    bg: 'elegant studio, marble/silk texture, deep soft gradient',
    palette: 'ivory white, soft beige, champagne gold, deep black accent',
    typo: 'elegant modern serif & thin luxury typography, generous spacing',
    lighting: 'cinematic luxury glow, dramatic soft shadow, premium reflection',
    extra: 'gold line accent, subtle glow',
    mood: 'Ivory • Beige • Champagne gold • Black',
  },
  'Clean minimalist': {
    aesthetic: 'clean minimalist commercial',
    bg: 'plain soft neutral background, lots of negative space',
    palette: 'white, light grey, soft black, one accent color',
    typo: 'clean modern sans-serif, minimal hierarchy',
    lighting: 'bright even soft lighting, subtle shadow',
    extra: 'thin line, simple geometric shape',
    mood: 'White • Light grey • Soft black • 1 accent',
  },
  'Dark premium': {
    aesthetic: 'dark premium cinematic',
    bg: 'dark moody studio, subtle spotlight, gradient black',
    palette: 'deep black, charcoal, metallic silver, gold/neon accent',
    typo: 'bold modern typography, strong contrast',
    lighting: 'dramatic dark cinematic lighting, rim light, glossy reflection',
    extra: 'glow accent, soft particle',
    mood: 'Black • Charcoal • Metallic • Accent glow',
  },
  'Futuristic tech': {
    aesthetic: 'futuristic tech commercial',
    bg: 'futuristic gradient, soft tech grid, glow',
    palette: 'deep blue, cyan, violet, white glow',
    typo: 'modern geometric sans-serif, techy hierarchy',
    lighting: 'neon cinematic lighting, glossy reflection, soft glow',
    extra: 'glow line, holographic accent, particle',
    mood: 'Blue • Cyan • Violet • White glow',
  },
  'Natural organic': {
    aesthetic: 'natural organic lifestyle',
    bg: 'natural soft background, plant/leaf element, warm daylight',
    palette: 'soft beige, earthy green, cream, warm brown',
    typo: 'soft modern serif/sans, friendly natural',
    lighting: 'natural soft daylight, gentle shadow',
    extra: 'leaf, natural element, soft sparkle',
    mood: 'Beige • Earthy green • Cream • Warm brown',
  },
  'Fun colorful': {
    aesthetic: 'fun colorful playful commercial',
    bg: 'bright colorful gradient, playful shapes',
    palette: 'vibrant multi-color, white, bold accent',
    typo: 'bold rounded playful typography',
    lighting: 'bright clean lighting, soft pop shadow',
    extra: 'confetti, playful shape, sparkle',
    mood: 'Vibrant • Playful • Bold • White',
  },
  'Beauty/fashion editorial': {
    aesthetic: 'beauty & fashion editorial',
    bg: 'editorial studio, soft gradient, fashion backdrop',
    palette: 'nude, soft pink, cream, gold accent',
    typo: 'editorial serif + modern sans, fashion hierarchy',
    lighting: 'soft beauty lighting, glossy highlight, elegant shadow',
    extra: 'soft sparkle, glass effect, premium accent',
    mood: 'Nude • Soft pink • Cream • Gold',
  },
};
