/**
 * Logo Affiliate — output STRING siap paste ke ChatGPT (DALL-E)/Midjourney/Sora.
 * ChatGPT akan langsung generate image, BUKAN return prompt lagi.
 *
 * 2 output mode:
 *  - 'logo'   → generate logo baru dari nol (buildLogoStudio)
 *  - 'mockup' → tempel logo yang sudah ada ke merchandise/banner/dll (buildLogoMockup)
 */

import { MOCKUP_ITEMS, LOGO_COLOR_PALETTES } from '../data/affiliateOptions.js';

export const INITIAL_LOGO_AFFILIATE = {
  // shared brand identity
  brand_name: '',
  brand_category: 'skincare',
  product_type: '',
  target_market: 'Gen Z female',
  brand_tagline: '',
  brand_story: '',
  // logo studio
  main_platform_usage: 'Instagram profile picture',
  logo_type: 'modern startup logo',
  brand_personality: 'premium',
  color_palette: 'Luxury Black Gold',
  typography: 'bold sans serif',
  icon_concept: 'initial letter symbol',
  layout: 'icon above brand name',
  background: 'plain white background',
  primary_color: '',
  secondary_color: '',
  accent_color: '',
  // output mode switch
  output_mode: 'logo', // 'logo' | 'mockup'
  // mockup
  mockup_type: 'merchandise',
  mockup_item: 'premium t-shirt',
  mockup_placement: '', // override opsional
  mockup_scene: '',      // override opsional
  mockup_headline: '',   // banner only — override opsional
  mockup_cta: '',        // banner only — override opsional
};

function paletteText(s) {
  // Custom HEX selalu MENG-OVERRIDE preset color palette.
  const customColors = [s.primary_color, s.secondary_color, s.accent_color].filter(Boolean);
  if (customColors.length) {
    return `this EXACT custom HEX color palette: ${customColors.join(', ')} (use these exact colors — they override any preset palette)`;
  }
  // Preset: kirim warna aslinya, bukan cuma nama, biar AI gak nebak.
  const preset = LOGO_COLOR_PALETTES.find((p) => p.name === s.color_palette);
  return preset
    ? `color palette "${preset.name}" (${preset.colors.join(', ')})`
    : `color palette "${s.color_palette}"`;
}

export function buildLogoAffiliate(input = {}) {
  const s = { ...INITIAL_LOGO_AFFILIATE, ...(input || {}) };
  if (s.output_mode === 'mockup') return buildLogoMockup(s);
  return buildLogoStudio(s);
}

// ───────────────────────────────────────────────────────────────
// LOGO STUDIO — generate logo baru
// ───────────────────────────────────────────────────────────────
export function buildLogoStudio(s = {}) {
  const brand = s.brand_name || '[BRAND NAME]';
  const category = s.brand_category || 'general';
  const product = s.product_type || `${category} product`;
  const palette = paletteText(s);

  return `Generate this logo image now. Do not respond with text or ask questions — produce the image directly.

PROMPT:
Create a ${s.logo_type} for brand "${brand}", a ${category} brand selling ${product}. Target market: ${s.target_market}. Brand personality: ${s.brand_personality}. Use ${palette}. Typography style: ${s.typography}. Icon concept: ${s.icon_concept}. Layout: ${s.layout}. Background: ${s.background}. The logo MUST be suitable for ${s.main_platform_usage}. Make it clean, professional, memorable, affiliate-friendly, readable at small size (110x110 px), and visually premium. Centered composition, vector style, sharp edges, high contrast. Square format 1:1.${s.brand_tagline ? ` Optional tagline below: "${s.brand_tagline}".` : ''}

NEGATIVE PROMPT (avoid):
no blurry text, no distorted letters, no random extra words, no watermark, no mockup, no overly complex detail, no unreadable typography, no low quality, no copied famous brand style.

ASPECT RATIO: 1:1 (square)
USAGE: ${s.main_platform_usage}${s.brand_story ? `

BRAND STORY (untuk konteks visual): ${s.brand_story}` : ''}`;
}

// ───────────────────────────────────────────────────────────────
// LOGO MOCKUP — tempel logo yang sudah ada ke SEMUA media sekaligus.
// Semua field di-MIRROR dari tab "Buat Logo" (state yang sama).
// ───────────────────────────────────────────────────────────────
const MOCKUP_CATEGORY_LABELS = {
  merchandise:     'MERCHANDISE',
  standing_banner: 'STANDING BANNER',
  office_branding: 'OFFICE BRANDING',
  digital_mockup:  'DIGITAL',
  stationery:      'STATIONERY',
};

function mockupItemLine(item) {
  const parts = [`logo ${item.placement || 'centered'}`];
  if (item.material) parts.push(item.material);
  if (item.size)     parts.push(`logo size ${item.size}`);
  if (item.style)    parts.push(item.style);
  if (item.design)   parts.push(item.design);
  if (item.layout)   parts.push(item.layout);
  if (item.screen)   parts.push(`screen: ${item.screen}`);
  if (item.headline)    parts.push(`headline "${item.headline}"`);
  if (item.subheadline) parts.push(`subheadline "${item.subheadline}"`);
  if (item.cta)         parts.push(`CTA "${item.cta}"`);
  if (item.scene)    parts.push(`scene: ${item.scene}`);
  return `- ${item.value} — ${parts.join('; ')}.`;
}

export function buildLogoMockup(s = {}) {
  const brand = s.brand_name || '[BRAND NAME]';
  const category = s.brand_category || 'general';
  const brandType = s.product_type
    ? `${category} brand — ${s.product_type}`
    : `${category} brand`;
  const palette = paletteText(s);

  const blocks = Object.keys(MOCKUP_ITEMS).map((cat) => {
    const label = MOCKUP_CATEGORY_LABELS[cat] || cat.toUpperCase();
    const lines = MOCKUP_ITEMS[cat].map(mockupItemLine).join('\n');
    return `${label}:\n${lines}`;
  }).join('\n\n');

  return `Generate these brand mockups now. Do not respond with text or ask questions — produce the images directly. Use the UPLOADED LOGO as the EXACT reference (I will attach it).

BRAND: "${brand}" — ${brandType}. Personality: ${s.brand_personality}. Use ${palette}.${s.brand_tagline ? ` Tagline: "${s.brand_tagline}".` : ''}

TASK:
Create a COMPLETE premium brand mockup set, applying the uploaded logo across ALL items below. Generate each item as a clean, realistic, photographic mockup (you may output multiple images / a presentation board). Keep the logo UNCHANGED on every single item — exact same design, same colors, same text, sharp and readable, no redesign, no color shift. Consistent premium brand look across the whole set, soft commercial lighting, modern business environment, high resolution.

${blocks}

NEGATIVE PROMPT (avoid):
do not change the logo design, do not distort the text, do not alter the colors, no blurry logo, no wrong logo text, no random extra words, no watermark, no messy composition, no cheap mockup look, no low quality, no copied famous brand style.

LOGO REFERENCE: use the uploaded logo exactly as-is (no redesign, no color shift, no altered icon) on every mockup.${s.brand_story ? `

BRAND STORY (untuk konteks visual): ${s.brand_story}` : ''}`;
}
