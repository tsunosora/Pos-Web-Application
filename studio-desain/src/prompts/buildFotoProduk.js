/**
 * Merakit prompt fotografi produk (foto produk display) untuk model image
 * (Midjourney / Flux / DALL·E / Nano-Banana / ChatGPT image).
 * @param {object} s — state mode fotoproduk
 * @returns {string}
 */
export function buildFotoProduk(s = {}) {
  const productName = s.productName?.trim() || 'the product';
  const brand       = s.brand?.trim();
  const kategori    = s.kategori || 'Produk Lainnya';
  const deskripsi   = s.description?.trim();

  const lines = [
    `Professional product photography for e-commerce display of "${productName}"` +
      (brand ? ` by ${brand}` : '') + `.`,
    `Product category: ${kategori}.`,
    deskripsi ? `Product details: ${deskripsi}.` : null,
    ``,
    `PHOTOGRAPHY DIRECTION`,
    `- Style: ${s.gaya || 'Clean studio product shot, seamless background'}.`,
    `- Background: ${s.background || 'pure clean white studio background'}.`,
    `- Camera angle: ${s.sudut || 'three-quarter 45-degree angle'}.`,
    `- Lighting: ${s.pencahayaan || 'soft diffused softbox lighting'}.`,
    `- Styling / props: ${s.props || 'no props, product only, clean isolation'}.`,
    `- Overall mood: ${s.mood || 'clean minimalist feel'}.`,
    s.platform ? `- Optimized for: ${s.platform}.` : null,
    s.copySpace ? `- Leave deliberate empty negative space for text/copy overlay.` : null,
    ``,
    `COLOR & GRADING`,
    `- Primary accent color: ${s.primaryColor || '#2dd4bf'}, secondary: ${s.secondaryColor || '#ffffff'}.`,
    `- Accurate true-to-life product colors, tasteful color grading, no oversaturation.`,
    ``,
    `QUALITY REQUIREMENTS`,
    `- The product is the sharp, unmistakable focal point, rendered in ultra-fine detail.`,
    `- Photorealistic, high-resolution, commercial-grade e-commerce quality.`,
    `- Realistic reflections, soft natural shadows, and correct material texture.`,
    `- Clean, polished, ready for online store / catalog / social feed display.`,
    `- Aspect ratio: ${s.rasio || '1:1 square'}.`,
    ``,
    `AVOID`,
    `- blurry, low-res, distorted or warped product shape, wrong proportions.`,
    `- watermark, logo, text, or caption overlays; cluttered or distracting background.`,
    `- unnatural lighting, plastic/fake look, oversaturated or inaccurate colors.`,
  ];

  return lines.filter((l) => l !== null).join('\n');
}

export const INITIAL_FOTO_PRODUK = {
  productName:    '',
  brand:          '',
  kategori:       'Skincare / Beauty',
  description:    '',
  gaya:           'Clean studio product shot, seamless background',
  background:     'pure clean white studio background',
  sudut:          'three-quarter 45-degree angle',
  pencahayaan:    'soft diffused softbox lighting',
  props:          'no props, product only, clean isolation',
  mood:           'clean minimalist feel',
  platform:       'e-commerce marketplace listing (Shopee/Tokopedia), lots of clean negative space',
  rasio:          '1:1 square',
  copySpace:      false,
  primaryColor:   '#2dd4bf',
  secondaryColor: '#ffffff',
};
