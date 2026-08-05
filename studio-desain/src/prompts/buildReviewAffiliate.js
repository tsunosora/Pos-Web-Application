/**
 * Review Produk Affiliate v2 — generate PROMPT BANNER IMAGE review produk.
 * Role: Senior Affiliate Banner Designer + E-Commerce Review Creative Director.
 * Output = static banner image prompt (flowing, siap paste). User upload foto
 * produk DI CHATGPT sebagai exact reference.
 */

import { RVB_COLOR_PALETTES, RVB_FRAMEWORKS, RVB_IMAGE_RATIOS } from '../data/affiliateOptions.js';

export const INITIAL_REVIEW_AFFILIATE = {
  // product input
  product_name: '',
  product_category: 'skincare',
  product_type: '',
  product_description: '',
  main_benefit: '',
  secondary_benefits: '',
  problem_solved: '',
  pain_point_customer: '',
  unique_selling_point: '',
  price_positioning: 'worth the price',
  target_audience: 'Gen Z female',
  // platform & output
  main_platform: 'Instagram Feed',
  image_ratio: '4:5',
  // review framework
  review_framework: 'creator_quote_review',
  // copywriting
  headline_style: 'curiosity hook',
  headline_text: '',
  headline_placement: 'top center',
  subheadline: '',
  review_format: '3 bullet points',
  review_points: '',
  trust_enable: true,
  trust_text: '4.9/5 ⭐',
  cta_style: 'curiosity CTA',
  cta_text: 'Cek detail produknya',
  cta_placement: 'bottom center button',
  // visual direction
  banner_style: 'premium editorial',
  layout_type: 'Hero Product Layout',
  product_position: 'center hero',
  background: 'clean gradient',
  lighting: 'soft commercial lighting',
  human_enable: true,
  character_type: 'daily user',
  character_pose: 'holding product',
  character_framing: 'half body',
  human_position: 'right side',
  // design
  headline_font: 'bold modern sans serif',
  color_palette: 'Clean White Beige',
  primary_color: '',
  secondary_color: '',
  accent_color: '',
  badges: [],
};

function paletteText(s) {
  const custom = [s.primary_color, s.secondary_color, s.accent_color].filter(Boolean);
  if (custom.length) return `an EXACT custom HEX palette ${custom.join(', ')} (use these exact colors, override any preset)`;
  const p = RVB_COLOR_PALETTES.find((x) => x.name === s.color_palette);
  if (p && p.colors.length) return `a ${p.colors.join(', ')} color palette`;
  if (p) return `a color palette that naturally matches the product's own brand colors`;
  return `a ${s.color_palette} color palette`;
}

const ratioLabel = (v) => (RVB_IMAGE_RATIOS.find((r) => r.value === v)?.label) || v;

export function buildReviewAffiliate(input = {}) {
  // Defensive: pastikan semua field punya default (cegah "undefined" kalau state parsial)
  const s = { ...INITIAL_REVIEW_AFFILIATE, ...(input || {}) };
  const name = s.product_name || '[product name]';
  const type = s.product_type || `${s.product_category} product`;
  const category = s.product_category || 'product';
  const fw = RVB_FRAMEWORKS.find((f) => f.value === s.review_framework);
  const frameworkLine = fw ? `${fw.label} — ${fw.goal}` : (s.review_framework || 'honest review');
  const palette = paletteText(s);
  const isSkincare = /skincare|beauty|makeup|hair|body care/i.test(category);

  // Headline / subheadline / review points
  const headline = (s.headline_text || '').trim()
    ? `"${s.headline_text.trim()}"`
    : `(write a strong ${s.headline_style}, max 8 words, casual Indonesian)`;
  const subheadline = (s.subheadline || '').trim()
    ? `"${s.subheadline.trim()}"`
    : `(write one short sentence, max 14 words, explaining the main benefit${s.main_benefit ? `: ${s.main_benefit}` : ''})`;
  const points = (s.review_points || '').trim()
    ? s.review_points.trim().split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 3)
        .map((l) => (/^[✔✓•-]/.test(l) ? l : `✔ ${l}`)).join('\n')
    : `(generate max 3 short ${s.review_format} points based on the benefits)`;

  // Product context (for copywriting — not all printed)
  const ctx = [
    s.product_description && `description: ${s.product_description}`,
    s.main_benefit && `main benefit: ${s.main_benefit}`,
    s.secondary_benefits && `other benefits: ${s.secondary_benefits.replace(/\n/g, ', ')}`,
    s.problem_solved && `problem solved: ${s.problem_solved}`,
    s.pain_point_customer && `customer pain point: ${s.pain_point_customer}`,
    s.unique_selling_point && `unique selling point: ${s.unique_selling_point}`,
  ].filter(Boolean).join('; ');

  // Optional lines
  const trustLine = s.trust_enable && s.trust_text
    ? `\n\nTrust element:\n"${s.trust_text}"`
    : '';
  const humanSentence = s.human_enable
    ? ` featuring a ${s.character_type} (${s.character_framing}) ${s.character_pose}, placed on the ${s.human_position} of the banner`
    : ', product-only (no human)';
  const badges = (s.badges && s.badges.length)
    ? ` Add up to 2 conversion badges: ${s.badges.slice(0, 2).join(', ')}.`
    : '';
  const skincareNote = isSkincare
    ? ' For skincare/beauty use soft cosmetic language (e.g. "terlihat lebih fresh", "nyaman dipakai") — no medical or guaranteed-cure claims.'
    : '';

  return `Create a high-converting static product review banner for ${name}, a ${type} in the ${category} category. Use the uploaded product image as the exact product reference. Keep the product design, logo, label, color, material texture, and shape unchanged. The product must be the hero — clearly visible, sharp, and at least 25% of the banner area.

Banner ratio: ${ratioLabel(s.image_ratio)}.

Review framework: ${frameworkLine}
Visual style: ${s.banner_style}.
Layout: ${s.layout_type}.
Product position: ${s.product_position}.
Background: ${s.background}.
Lighting: ${s.lighting}.
Target audience: ${s.target_audience}.
Price positioning: ${s.price_positioning}.
Platform: ${s.main_platform}.${ctx ? `
Product context (for copy, not all printed): ${ctx}.` : ''}

Main headline (${s.headline_placement}):
${headline}

Subheadline:
${subheadline}

Review points (${s.review_format}, max 3):
${points}${trustLine}

CTA button (${s.cta_placement}):
${s.cta_text ? `"${s.cta_text}"` : `(write a short ${s.cta_style})`}

Create a ${s.banner_style} review banner${humanSentence}. The product must be clearly visible, sharp, realistic, and proportionally correct. Use ${s.headline_font} typography with strong hierarchy (headline largest → product name → review points → clear CTA), ${palette}, and tasteful supporting graphic elements (review cards, rating badge, callouts, shadows) added by you as fit — keep it clean, max ~5 text blocks, readable on mobile.${badges} Make the banner feel like an honest creator recommendation, not a cheap marketplace ad.${skincareNote}

Avoid: distorted product, changed/wrong logo, wrong product color, blurry or too-small product, product hidden behind text, too much text, messy/overcrowded layout, cheap template look, fake or guaranteed/medical claims, extra random words, watermark, wrong brand name.

Output: aspect ratio ${s.image_ratio}, high-resolution commercial e-commerce ad quality.`;
}
