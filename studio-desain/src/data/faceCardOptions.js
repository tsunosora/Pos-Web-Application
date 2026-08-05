// Face Card Analysis — dropdown options + helper lookup tables

export const SUB_TYPES = [
  { value: 'face-feature', label: 'Face Features',  title: 'Face Features Analysis' },
  { value: 'spectacles',   label: 'Spectacles',     title: 'Spectacles Guide' },
  { value: 'style',        label: 'Style',          title: 'Style Analysis Board' },
  { value: 'color',        label: 'Color',          title: 'Color Analysis Board' },
  { value: 'makeup',       label: 'Makeup',         title: 'Makeup Analysis Board' },
];

// ───────── Section B: Style Direction (common) ─────────
export const AESTHETICS = [
  'Editorial Magazine',
  'Aesthetic Minimal',
  'Luxury Premium',
  'Soft Feminine',
  'Modern Clean',
  'Beauty Magazine',
];

export const BACKGROUND_TONES = [
  'Beige Ivory',
  'Soft Cream',
  'White Clean',
  'Warm Gradient',
  'Cool Pastel',
  'Dark Premium',
];

export const TYPOGRAPHY_STYLES = [
  'Serif Elegant',
  'Sans Modern',
  'Serif + Sans Hybrid',
  'Display Editorial',
];

export const COLOR_MOODS = [
  'Warm Tones',
  'Cool Tones',
  'Neutral Earth',
  'Monochrome',
  'Pastel Soft',
];

export const LIGHTINGS = [
  'Soft Diffused',
  'Natural Window',
  'Studio Beauty',
  'Editorial Spot',
  'Golden Hour',
];

export const LAYOUT_DENSITIES = [
  'Minimal Spacious',
  'Balanced Grid',
  'Rich Editorial',
  'Dense Magazine',
];

export const ASPECT_RATIOS = [
  '4:5 Portrait',
  '3:4 Standard',
  '2:3 Magazine',
  '1:1 Square',
];

export const DECORATIVE_ACCENTS = [
  'None',
  'Thin Gold Lines',
  'Sparkle Stars',
  'Rounded Cards',
  'Diamond Markers',
];

// ───────── Section D: Subject Hints (optional) ─────────
export const GENDER_HINTS    = ['None', 'Female', 'Male', 'Non-specified'];
export const AGE_RANGES      = ['None', 'Teen', 'Early 20s', 'Late 20s', '30s', '40s+'];
export const ETHNICITY_HINTS = ['None', 'Indonesian', 'Southeast Asian', 'East Asian', 'Middle Eastern', 'Latin', 'European', 'African', 'Universal'];
export const HIJAB_STYLES    = ['None', 'Modest Hijab', 'Modern Hijab', 'Pashmina', 'Sport Hijab'];
export const EXPRESSIONS     = ['None', 'Soft Smile', 'Neutral', 'Confident', 'Looking Away', 'Editorial Pose'];

// ───────── Sub-type specific ─────────

// Face Features
export const FEATURE_LABELS = [
  'Face Shape', 'Eyes', 'Eyebrows', 'Nose', 'Cheeks', 'Lips', 'Jawline', 'Forehead',
];
export const ICON_STYLES   = ['Line Drawing', 'Filled Outline', 'Detailed Illustration'];
export const CARD_STYLES   = ['Rounded', 'Sharp', 'Glass Effect', 'Paper Texture'];
export const BULLET_COUNTS = [{ value: 2, label: '2 bullet' }, { value: 3, label: '3 bullet' }, { value: 4, label: '4 bullet' }];

// Spectacles
export const FRAME_STYLES = [
  'Round', 'Oval', 'Square', 'Cat-Eye', 'Aviator', 'Rectangle', 'Wayfarer', 'Browline', 'Geometric',
];
export const RECOMMEND_COUNTS = [{ value: 3, label: '3 rekomendasi' }, { value: 5, label: '5 rekomendasi' }, { value: 7, label: '7 rekomendasi' }];
export const AVOID_COUNTS     = [{ value: 1, label: '1 avoid' }, { value: 2, label: '2 avoid' }, { value: 3, label: '3 avoid' }];

// Style Analysis
export const STYLE_CATEGORIES = [
  'Old Money', 'Quiet Luxury', 'Boho Chic', 'Glamour', 'Minimalist',
  'Classic Elegant', 'Romantic', 'Feminine Chic', 'Street Style', 'Sport Chic',
  'Casual Effortless', 'Business Chic', 'Vamp', 'Rock Chic',
  'Edgy Avant-garde', 'Soft Girl Coquette',
];
export const HIGHLIGHT_COUNTS = [{ value: 3, label: '3 best' }, { value: 4, label: '4 best' }, { value: 5, label: '5 best' }];

// Color Analysis
export const UNDERTONES        = ['Warm', 'Neutral', 'Cool', 'Warm Neutral', 'Cool Neutral'];
export const SEASON_TYPES      = ['Spring Light', 'Spring True', 'Spring Bright', 'Summer Soft', 'Summer True', 'Summer Light', 'Autumn Soft', 'Autumn True', 'Autumn Deep', 'Winter Bright', 'Winter True', 'Winter Deep'];
export const BEST_COLOR_COUNTS = [{ value: 16, label: '16 warna' }, { value: 20, label: '20 warna' }, { value: 24, label: '24 warna' }, { value: 30, label: '30 warna' }];
export const AVOID_COLOR_COUNTS= [{ value: 4, label: '4 warna' }, { value: 6, label: '6 warna' }, { value: 8, label: '8 warna' }];
export const JEWELRY_OPTIONS   = ['Gold', 'Silver', 'Rose Gold', 'Pearl', 'Champagne', 'Mixed Metal'];

// Makeup
export const SKIN_TONES       = ['Light', 'Light-Medium', 'Medium', 'Medium-Tan', 'Tan', 'Deep'];
export const MAKEUP_UNDERTONES= ['Warm', 'Neutral', 'Cool', 'Warm Neutral'];
export const CONTRAST_LEVELS  = ['Low', 'Low-Medium', 'Medium', 'Medium-High', 'High'];
export const EYESHADOW_COUNTS = [{ value: 3, label: '3 looks' }, { value: 4, label: '4 looks' }, { value: 5, label: '5 looks' }];
export const EYELINER_STYLES  = ['Tightline', 'Soft Wing', 'Smoky', 'Glam Wing', 'Smudged', 'Cat-Eye'];
export const MASCARA_STYLES   = ['Lengthening', 'Volumizing', 'Curl & Lift', 'Doll-Eye', 'Wispy'];
export const LIP_COLOR_COUNTS = [{ value: 4, label: '4 shades' }, { value: 6, label: '6 shades' }, { value: 8, label: '8 shades' }];

// ───────── Aesthetic auto-default per sub-type ─────────
export const AESTHETIC_DEFAULT_BY_SUBTYPE = {
  'face-feature': { aesthetic: 'Editorial Magazine', background: 'Beige Ivory',  typography: 'Serif + Sans Hybrid', colorMood: 'Warm Tones',   lighting: 'Soft Diffused' },
  'spectacles':   { aesthetic: 'Aesthetic Minimal',  background: 'Soft Cream',   typography: 'Sans Modern',          colorMood: 'Neutral Earth', lighting: 'Natural Window' },
  'style':        { aesthetic: 'Luxury Premium',     background: 'Beige Ivory',  typography: 'Serif Elegant',        colorMood: 'Warm Tones',   lighting: 'Studio Beauty' },
  'color':        { aesthetic: 'Beauty Magazine',    background: 'Soft Cream',   typography: 'Serif + Sans Hybrid', colorMood: 'Warm Tones',   lighting: 'Soft Diffused' },
  'makeup':       { aesthetic: 'Beauty Magazine',    background: 'Warm Gradient',typography: 'Serif Elegant',        colorMood: 'Warm Tones',   lighting: 'Studio Beauty' },
};

// ───────── helper text per sub-type ─────────
export const SUBTYPE_DESC = {
  'face-feature': 'Infographic analisis fitur wajah dengan label panah ke face shape, eyes, eyebrows, nose, cheeks, lips.',
  'spectacles':   'Panduan rekomendasi kacamata berdasarkan bentuk wajah, dengan try-on side-by-side berbagai frame.',
  'style':        'Board fashion analysis lengkap: style categories, vibe, color palette, silhouettes, capsule wardrobe.',
  'color':        'Color season analysis dengan best colors, makeup guide, hair, jewelry, dan outfit recommendations.',
  'makeup':       'Beauty board lengkap: skin analysis, eyeshadow looks, eyeliner, mascara, lip shades, final looks.',
};
