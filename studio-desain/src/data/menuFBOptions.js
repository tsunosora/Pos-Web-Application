/**
 * Menu F&B mode — constants for ratios, layouts, themes, typography, business types.
 * All values are simple strings/object arrays consumable by SelectField directly.
 */

// ── Aspect ratios (dropdown only) ──────────────────────────────────────────
export const RATIOS = [
  '4:5 (IG Feed Portrait — 1080×1350)',
  '1:1 (IG Square / Carousel — 1080×1080)',
  '9:16 (IG Story / Reels — 1080×1920)',
  '3:4 (Poster Vertikal — 1080×1440)',
  'A4 Portrait (Print Booklet — 2480×3508)',
  'A5 Portrait (Table Menu — 1748×2480)',
  '2:3 (Long Menu — 1080×1620)',
];

export const DEFAULT_RATIO = RATIOS[0]; // 4:5

// Parse any ratio label → [w, h] integers.
export function ratioToWH(ratioLabel) {
  if (!ratioLabel) return [4, 5];
  if (ratioLabel.startsWith('A4')) return [2480, 3508]; // 1:1.414
  if (ratioLabel.startsWith('A5')) return [1748, 2480];
  const m = ratioLabel.match(/(\d+)\s*[:x]\s*(\d+)/i);
  if (m) return [+m[1], +m[2]];
  return [4, 5];
}

// ── Layout styles ──────────────────────────────────────────────────────────
export const LAYOUT_STYLES = [
  { value: 'single-list',      label: 'Single List — semua item vertikal' },
  { value: 'two-col-grid',     label: '2-Column Grid — item dalam 2 kolom' },
  { value: 'hero-grid',        label: 'Hero + Grid — 1 featured besar + grid kecil' },
  { value: 'categorized',      label: 'Categorized Sections — divider tebal per kategori' },
  { value: 'compact-list',     label: 'Compact List — list padat tanpa kotak' },
];

export const DEFAULT_LAYOUT = 'single-list';

// ── Business types (food vertical) ──────────────────────────────────────────
export const BUSINESS_TYPES = [
  'Patisserie / Bakery',
  'Cafe / Coffee Shop',
  'Restaurant — Indonesian Heritage',
  'Restaurant — Korean Street Food',
  'Restaurant — Japanese',
  'Restaurant — Western',
  'Healthy Food / Diet Catering',
  'Rice Bowl / Quick Bite',
  'Snack & Cemilan',
  'Dessert Shop',
  'Beverage / Juice Bar',
  'Custom (free input)',
];

// ── Design themes (visual DNA) ──────────────────────────────────────────────
export const DESIGN_THEMES = [
  'Parisian Luxury — feminine elegant',
  'Editorial Modern — clean minimal',
  'Bold Viral — high contrast street food',
  'Indonesian Heritage Ornate — classic batik',
  'Japanese Premium — dark navy red accents',
  'Retro Marketplace — vintage poster style',
  'Warm Artisanal — cream homemade cozy',
  'Festive Traditional — bold red gold',
  'Modern Casual — earthy contemporary',
];

// ── Color palette presets ──────────────────────────────────────────────────
export const PALETTE_PRESETS = [
  { value: 'wine-cherry-cream',    label: 'Wine · Cherry · Cream',    primary: '#7c1d2e', secondary: '#fdf2e9' },
  { value: 'sage-cream-charcoal',  label: 'Sage · Cream · Charcoal',  primary: '#84a98c', secondary: '#fdf6ec' },
  { value: 'red-cream-bold',       label: 'Red · Cream Bold',         primary: '#dc2626', secondary: '#fef9e7' },
  { value: 'batik-brown-gold',     label: 'Batik Brown · Gold',       primary: '#6f4e37', secondary: '#f4e7c5' },
  { value: 'navy-red-cream',       label: 'Navy · Red · Cream',       primary: '#1e2a4a', secondary: '#fef3e2' },
  { value: 'navy-marketplace',     label: 'Navy Marketplace',         primary: '#1c3a5e', secondary: '#fff5d6' },
  { value: 'cream-tan-warm',       label: 'Cream · Tan · Warm',       primary: '#c89b7b', secondary: '#fdf3e3' },
  { value: 'red-gold-festive',     label: 'Red · Gold Festive',       primary: '#b91c1c', secondary: '#fde68a' },
  { value: 'terracotta-cream',     label: 'Terracotta · Cream',       primary: '#c44d35', secondary: '#faeacf' },
];

// ── Typography styles ──────────────────────────────────────────────────────
export const TYPOGRAPHY_STYLES = [
  'Elegant Serif (Playfair / Cormorant)',
  'Modern Sans (Inter / Manrope)',
  'Bold Display (Anton / Bebas Neue)',
  'Classic Script (Pinyon / Great Vibes)',
  'Vintage Slab (Roboto Slab / Zilla)',
  'Handwritten (Caveat / Kalam)',
  'Editorial Mix (Serif headline + Sans body)',
];

// ── Mood / atmosphere ──────────────────────────────────────────────────────
export const MOODS = [
  'Elegant & Refined',
  'Bold & Energetic',
  'Cozy & Homemade',
  'Modern & Clean',
  'Traditional & Heritage',
  'Playful & Casual',
  'Premium & Luxurious',
];

// ── Photography style (for backdrop / hero image) ──────────────────────────
export const PHOTO_STYLES = [
  'Flat-lay overhead — top-down editorial',
  'Hero close-up — single dish focus',
  'Lifestyle scene — table with people',
  'Studio isolated — clean background',
  'Rustic wood / linen backdrop',
  'Marble / stone surface',
  'Dark moody chiaroscuro',
  'No photo — illustration / pattern only',
];

// ── Multi-page (carousel) ──────────────────────────────────────────────────
export const PAGE_COUNTS = [
  { value: 1, label: '1 Halaman (Single Poster)' },
  { value: 2, label: '2 Halaman (Carousel)' },
  { value: 3, label: '3 Halaman (Carousel)' },
  { value: 4, label: '4 Halaman (Carousel)' },
  { value: 5, label: '5 Halaman (Carousel)' },
  { value: 6, label: '6 Halaman (Carousel — Mashisseo style)' },
];

// ── Build-time helpers used by buildMenuFB ─────────────────────────────────
export const LAYOUT_DESC = {
  'single-list':   'Single-column vertical menu list. Each item gets a horizontal row with name on the left and price on the right. Used for elegant boutique menus.',
  'two-col-grid':  'Two-column grid layout. Items distributed evenly across two vertical columns. Used for medium-length menus to maximize space efficiency.',
  'hero-grid':     'One large featured/signature item at the top occupying ~40% of canvas, followed by a smaller grid of supporting items below. Used to highlight a bestseller.',
  'categorized':   'Strong category dividers with bold section headers separating menu groups. Each category gets its own visual block with consistent spacing. Used for restaurants with multiple distinct food groups.',
  'compact-list':  'Dense compact list with minimal padding and no enclosing boxes. Item name + price on single line. Used for booklet-style menus or large item counts.',
};

export const MOOD_DESC = {
  'Elegant & Refined':       'Refined elegant atmosphere, ample negative space, serif typography hints, soft lighting, premium boutique feel',
  'Bold & Energetic':        'High-contrast bold composition, large display type, vibrant color punch, dynamic visual energy',
  'Cozy & Homemade':         'Warm cozy atmosphere, soft handcrafted feel, cream/beige palette dominance, intimate scale',
  'Modern & Clean':          'Clean modern editorial layout, generous whitespace, geometric structure, minimal ornaments',
  'Traditional & Heritage':  'Heritage motifs, batik or ornament patterns, rich warm tones, classical typography ornamentation',
  'Playful & Casual':        'Playful casual mood, friendly approachable typography, rounded shapes, bright accent colors',
  'Premium & Luxurious':     'Luxurious premium feel, dark or jewel-tone backgrounds, gold accents, refined material textures',
};
