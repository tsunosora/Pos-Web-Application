import { STYLE_AESTHETIC } from '../data/bannerCetakOptions.js';

/**
 * Membangun prompt JSON desain banner SIAP CETAK (percetakan).
 * @param {object} s — state mode bannercetak
 * @returns {object} siap JSON.stringify(_, null, 2)
 */
export function buildBannerCetak(s = {}) {
  const size = s.size === 'Custom (ukuran manual)'
    ? `${s.customWidth || '?'} x ${s.customHeight || '?'} cm`
    : (s.size || '');

  const orientation = s.orientation || 'Landscape (Horizontal)';
  const aspect = orientation.startsWith('Portrait') ? '9:16'
    : orientation.startsWith('Square') ? '1:1'
    : '16:9';

  const contacts = [
    s.phone   && `Telp/WA: ${s.phone}`,
    s.address && `Alamat: ${s.address}`,
    s.social  && `Sosial media: ${s.social}`,
    s.website && `Website: ${s.website}`,
  ].filter(Boolean);

  return {
    task_type: 'print_banner_design_generation',
    system_directive:
      'You are an elite Print Graphic Designer specialized in large-format promotional print (spanduk, banner, baliho, roll-up, poster). Produce a PRINT-READY, high-resolution promotional design based on the EXACT specifications below. All text must be perfectly spelled, crisp, and legible from a distance.',
    print_product: {
      type:        s.productType || 'Spanduk (Horizontal)',
      size:        size,
      orientation: orientation,
      material:    s.material || 'Flexi China 280gr',
    },
    model_parameters: {
      aspect_ratio: aspect,
      style_preset: s.style || 'Bold Promo',
      quality: 'high',
      render: 'ultra-sharp, high resolution, print quality',
    },
    content: {
      brand_name:     s.brand || '',
      headline:       s.headline || '',
      subheadline:    s.subheadline || '',
      promo_offer:    s.offer || '',
      price:          s.price || '',
      description:    s.description || '',
      features_to_highlight: Array.isArray(s.features) ? s.features.filter(Boolean) : [],
      call_to_action: s.cta || '',
      contact_info:   contacts,
      logo_instruction: s.brand
        ? `Reserve a clear, prominent area for the "${s.brand}" logo (top or a corner).`
        : 'Reserve a clear area for the brand logo (top or a corner).',
    },
    visual_style: {
      aesthetic_keywords: STYLE_AESTHETIC[s.style] || 'clean, bold, high-impact promotional design',
      color_palette: {
        primary_accent: s.primaryColor || '#2563EB',
        secondary:      s.secondaryColor || '#ffffff',
        harmony: 'Cohesive, high-contrast palette for maximum readability from a distance.',
      },
    },
    typography_instructions:
      'Use large, bold, highly legible typography. The headline must dominate and be readable from far away (critical for spanduk/baliho). Maintain a strong visual hierarchy: headline > offer/price > details > contact info. Perfect spelling, no gibberish or fake letters.',
    print_specifications: {
      resolution: '300 DPI',
      color_mode: 'CMYK (use print-safe colors; avoid pure-RGB neon that cannot be printed accurately)',
      bleed: 'Add 2 cm bleed on every side',
      safe_margin: 'Keep all text and the logo inside a safe margin (min ~5 cm from edges on large formats)',
      output: 'Vector-sharp, ready to send to a large-format printer.',
    },
    composition_rules: [
      'One strong focal point (headline / main offer)',
      'Balanced layout with generous contrast',
      'Leave breathing space; avoid clutter so it reads at a glance',
    ],
    negative_prompt:
      'blurry, low resolution, pixelated, misspelled words, gibberish text, distorted or fake logo, cluttered, watermark, signature, unreadable tiny text, RGB-only neon that cannot print, jpeg artifacts',
  };
}

export const INITIAL_BANNERCETAK = {
  productType: 'Spanduk (Horizontal)',
  size: 'Spanduk 400 x 100 cm',
  customWidth: '', customHeight: '',
  orientation: 'Landscape (Horizontal)',
  material: 'Flexi China 280gr (indoor/outdoor ekonomis)',
  brand: '', headline: '', subheadline: '', offer: '', price: '', description: '',
  features: [],
  cta: '', phone: '', address: '', social: '', website: '',
  style: 'Bold Promo',
  primaryColor: '#2563EB', secondaryColor: '#ffffff',
};
