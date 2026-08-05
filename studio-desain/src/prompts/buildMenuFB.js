import { ratioToWH, DEFAULT_RATIO, DEFAULT_LAYOUT } from '../data/menuFBOptions.js';
import { buildThemePrompt, getThemeSource } from './menuFBThemeTemplates.js';

/**
 * Builds the Menu F&B prompt for AI menu poster generation (fal.ai gpt-image-2).
 *
 * Output is a structured object with TWO parts:
 *   1. instructional_prompt — the FULL PROSE PROMPT (matches user's original 7 prompt patterns)
 *      This is the primary instruction the AI should follow.
 *   2. metadata — supporting context (brand, menu structure, ratio, etc) for completeness
 *
 * @param {object} s — menu F&B mode state
 * @returns {object} ready to JSON.stringify(_, null, 2)
 */
export function buildMenuFB(s = {}) {
  const ratio = s.ratio || DEFAULT_RATIO;
  const [w, h] = ratioToWH(ratio);
  const layout = s.layoutStyle || DEFAULT_LAYOUT;
  const pageCount = Math.max(1, Math.min(6, +s.pageCount || 1));
  const designTheme = s.designTheme || 'Parisian Luxury — feminine elegant';

  // ── Cleanup categories ──────────────────────────────────────────────────
  const categories = (s.categories || [])
    .filter((c) => c && c.name && Array.isArray(c.items) && c.items.length > 0)
    .map((c) => ({
      category_name: c.name,
      items: c.items
        .filter((it) => it && it.name)
        .map((it) => ({
          name: it.name,
          description: it.desc || '',
          price: it.price || '',
        })),
    }));

  const totalItems = categories.reduce((acc, c) => acc + c.items.length, 0);

  // ── Build the FULL PROSE PROMPT per theme (primary output) ──────────────
  const prosePrompt = buildThemePrompt(designTheme, s) ||
    `Create a premium menu poster for ${s.brand || 'YourBrand'} in ${w}:${h} format. (No theme template — using fallback.)`;

  const themeSource = getThemeSource(designTheme);

  return {
    task_type: 'fnb_menu_poster_generation',

    // ═══ PRIMARY: full prose prompt (this is what AI should follow) ═══
    instructional_prompt: prosePrompt,

    // ═══ METADATA: structured context for completeness ═══
    metadata: {
      theme: designTheme,
      theme_source: themeSource,
      aspect_ratio: `${w}:${h}`,
      page_count: pageCount,
      multi_page_note: pageCount > 1
        ? `Generate ${pageCount}-slide carousel with IDENTICAL visual identity across all pages.`
        : 'Single-page poster.',
      brand: s.brand || '',
      tagline: s.tagline || '',
      business_type: s.businessType || '',
      layout_style: layout,
      total_categories: categories.length,
      total_items: totalItems,
      show_prices: s.showPrices !== false,
      show_item_photos: !!s.showPhotos,
      structured_categories: categories,
      color_palette: {
        primary: s.primaryColor || '#7c1d2e',
        secondary: s.secondaryColor || '#fdf2e9',
        palette_preset: s.palettePreset || '',
      },
      typography: s.typography || '',
      mood: s.mood || '',
      photo_style: s.photoStyle || '',
      call_to_action: s.cta || '',
      contact_info: s.contactInfo || '',
    },

    // ═══ MODEL PARAMETERS ═══
    model_parameters: {
      aspect_ratio: `${w}:${h}`,
      quality: 'high',
      photorealism: 'ultra-realistic, 8k resolution, magazine-grade food photography',
    },
  };
}

export const INITIAL_MENU_FB = {
  brand: '',
  tagline: '',
  description: '',
  businessType: 'Patisserie / Bakery',
  layoutStyle: 'single-list',
  pageCount: 1,
  designTheme: 'Parisian Luxury — feminine elegant',
  palettePreset: 'wine-cherry-cream',
  primaryColor: '#7c1d2e',
  secondaryColor: '#fdf2e9',
  typography: 'Elegant Serif (Playfair / Cormorant)',
  mood: 'Elegant & Refined',
  photoStyle: 'Flat-lay overhead — top-down editorial',
  ratio: '4:5 (IG Feed Portrait — 1080×1350)',
  cta: '',
  contactInfo: '',
  showPrices: true,
  showPhotos: true,
  categories: [
    { name: '', items: [{ name: '', desc: '', price: '' }] },
  ],
};
