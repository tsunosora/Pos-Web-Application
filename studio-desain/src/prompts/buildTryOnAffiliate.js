/**
 * Try-On Produk Affiliate — output STRING siap paste ke ChatGPT/Sora.
 * User upload foto produk + paste prompt → ChatGPT generate try-on visual.
 */

export const INITIAL_TRYON_AFFILIATE = {
  product_name: '',
  product_category: 'fashion',
  product_type: '',
  target_audience: 'wanita 18-30',
  gender_preference: 'female',
  platform: 'TikTok',
  try_on_mode: 'realistic fashion try-on',
  character_persona: 'Indonesian young woman',
  body_shot: 'half body shot',
  pose: 'standing 45 degree pose',
  background: 'minimal studio',
  camera_angle: '45 degree angle',
  lighting: 'soft natural daylight',
  visual_style: 'ugc raw realistic',
  selling_angle: 'looks expensive but affordable',
  text_overlay: '(kosongkan — opsional)',
};

const PLATFORM_FORMATS = {
  'TikTok':                    { aspect: '9:16', style: 'ugc raw, fast hook' },
  'Instagram Reels':           { aspect: '9:16', style: 'aesthetic lifestyle' },
  'Instagram Feed':            { aspect: '4:5',  style: 'premium product ads' },
  'Instagram Story':           { aspect: '9:16', style: 'casual story' },
  'Shopee Video':              { aspect: '9:16', style: 'direct selling product demo' },
  'YouTube Shorts':            { aspect: '9:16', style: 'cinematic viral' },
  'Facebook Ads':              { aspect: '1:1',  style: 'high contrast ads' },
  'Landing Page':              { aspect: '16:9', style: 'premium hero image' },
  'WhatsApp Status':           { aspect: '9:16', style: 'personal casual' },
  'Marketplace Product Page':  { aspect: '1:1',  style: 'clean white background product' },
};

export function buildTryOnAffiliate(input = {}) {
  const s = { ...INITIAL_TRYON_AFFILIATE, ...(input || {}) };
  const fmt = PLATFORM_FORMATS[s.platform] || PLATFORM_FORMATS['TikTok'];
  const productName = s.product_name || '[product]';
  const isPlaceholderOverlay = !s.text_overlay || s.text_overlay.startsWith('(kosongkan');
  const textOverlay = isPlaceholderOverlay
    ? ''
    : ` Add text overlay on image: "${s.text_overlay}".`;

  return `Generate this try-on image now. Do not respond with text or ask questions — produce the image directly using the product photo I uploaded as exact reference.

CRITICAL INSTRUCTION:
Use the uploaded product image as the EXACT product reference. Do not modify the product design, logo, pattern, or colors in any way.

PROMPT:
Create a ${s.try_on_mode} featuring a ${s.character_persona}. Product being shown: ${productName} (category: ${s.product_category}${s.product_type ? `, ${s.product_type}` : ''}). Target audience: ${s.target_audience}. Pose: ${s.pose}. Body framing: ${s.body_shot}. Background: ${s.background}. Camera angle: ${s.camera_angle}. Lighting: ${s.lighting}. Visual style: ${s.visual_style}. Selling angle: ${s.selling_angle}. The product must be clearly visible, realistic, proportionally correct, and conversion-focused for ${s.platform} (${fmt.style}).${textOverlay}

NEGATIVE PROMPT (avoid):
do not change product design, do not distort logo or pattern, do not make product blurry, do not hide product, no extra fingers, no unnatural body proportion, no wrong product placement, no watermark, no random text, no unrealistic skin texture, no messy background.

ASPECT RATIO: ${fmt.aspect}
PLATFORM: ${s.platform}`;
}
