export const IMAGE_COUNTS = [
  { value: 1, label: '1 Gambar Utama (Hero Focus)' },
  { value: 2, label: '2 Gambar (Comparison/Dual)' },
  { value: 3, label: '3 Gambar (Showcase Composition)' },
  { value: 4, label: '4 Gambar (Grid Layout)' },
  { value: 5, label: '5 Gambar (Collage Style)' },
];

export const POSITIONS = [
  { value: 'center',   label: 'Center / Tengah (Fokus Utama)' },
  { value: 'right',    label: 'Di Kanan (Teks di Kiri)' },
  { value: 'left',     label: 'Di Kiri (Teks di Kanan)' },
  { value: 'isometric',label: 'Isometric / Melayang' },
  { value: 'dynamic',  label: 'Dynamic Multiple Layout' },
];

export const STYLES = [
  'Futuristic Tech', 'Minimal Clean', 'Luxury Premium', 'Dark Neon',
  'Corporate Professional', 'Bright & Fresh', 'Warm & Cozy',
];

export const LIGHTINGS = [
  'Soft Lighting', 'Neon Glow', 'Dramatic Shadow', 'Studio Light', 'Natural Sunlight',
];

export const RATIOS = [
  '16:9 (Landing Page / Web Banner)',
  '1:1 (Instagram Feed)',
  '4:5 (Portrait Feed)',
  '9:16 (Story / Reels / TikTok)',
  '21:9 (Ultrawide Hero)',
];

// Helper lookup tables consumed by buildBanner
export const COMPOSITION_BY_COUNT = {
  1: 'Single hero product, dominant focal point composition.',
  2: 'Dual-product comparison layout with balanced symmetry.',
  3: 'Triple product showcase, layered product arrangement, modern composition.',
  4: 'Quad grid layout with editorial alignment and consistent spacing.',
  5: 'Multi-product collage style with dynamic overlapping arrangement.',
};

export const PLACEMENT_BY_POSITION = {
  center:    'Place the main product composition at the visual CENTER as the dominant focal point. Surround with negative space and balance typography above/below or in subtle overlay zones.',
  right:     'Place the main product composition clearly on the RIGHT side. Keep enough negative space on the LEFT for headline and CTA. Create an advertising layout with left-aligned typography. Maintain visual balance between text and product. Avoid centered composition.',
  left:      'Place the main product composition clearly on the LEFT side. Reserve the RIGHT for headline, features list and CTA. Use right-aligned typography. Maintain balance and rhythm.',
  isometric: 'Float the product(s) in an isometric / 3D perspective. Use levitating composition with soft shadows beneath. Surround with floating UI elements.',
  dynamic:   'Use dynamic multi-zone layout: products distributed across multiple visual zones with diagonal flow. Mix scales and depths for editorial energy.',
};

export const LIGHTING_DESC = {
  'Soft Lighting':    'Diffused softbox lighting, gentle shadows, even illumination',
  'Neon Glow':        'Cinematic neon rim-lighting, glowing accents, color-saturated highlights',
  'Dramatic Shadow':  'High-contrast directional lighting with deep dramatic shadows and selective highlights',
  'Studio Light':     'Professional studio lighting setup with key/fill/rim configuration',
  'Natural Sunlight': 'Warm natural daylight with soft directional rays and organic shadow falloff',
};

export const AESTHETIC_BY_STYLE = {
  'Futuristic Tech':       'Cyber-grid environments, holographic accents, neon depth, ultra-modern HUD detailing',
  'Minimal Clean':         'Ample negative space, very clean background, Apple-like product presentation, modern sans-serif typography feel, uncluttered',
  'Luxury Premium':        'Refined editorial composition, gold/marble surfaces, deep contrast, expensive material feel',
  'Dark Neon':             'Dark moody atmosphere with vibrant neon accents, cinematic glow, cyberpunk influence',
  'Corporate Professional':'Polished corporate aesthetic, balanced layout, trustworthy color grading, business-grade clarity',
  'Bright & Fresh':        'Bright pastel palette, soft daylight, friendly approachable vibe, modern lifestyle feel',
  'Warm & Cozy':           'Warm earthy tones, soft natural lighting, intimate cozy atmosphere',
};

export const STRICT_RULES = (count) => count >= 2 ? [
  `Use ALL ${count} uploaded product images in the final composition.`,
  'Create a cohesive multi-product arrangement.',
  'Every uploaded image must appear clearly in the design.',
  'Do NOT merge them into one product.',
  'Do NOT generate a single hero product only.',
  'CRITICAL INSTRUCTION: You will receive multiple product images. You MUST incorporate every single one of them into this single banner layout without leaving any out.',
  'POSITION LOCK: The composition MUST strictly follow the requested visual positioning. Do not place the product in the center unless explicitly requested.',
] : [
  'Use the uploaded product image as the single hero subject.',
  'POSITION LOCK: The composition MUST strictly follow the requested visual positioning.',
];
