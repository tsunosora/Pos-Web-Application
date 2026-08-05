import { CAMPAIGN_STYLE_BY_ENERGY } from '../data/typographyOptions.js';

/**
 * Builds Hyper Ads / Typography campaign JSON prompt + the 8 sectioned views.
 * @param {object} s — typography mode state
 * @returns {{ json: object, sections: Array<{key: string, label: string, text: string}> }}
 */
export function buildTypography(s = {}) {
  const hookUpper = (s.hook || '').toUpperCase();
  const words = hookUpper.split(/\s+/).filter(Boolean);
  const half = Math.ceil(words.length / 2);
  const primaryWords  = words.slice(0, half);
  const secondaryWords= words.slice(half);

  const json = {
    creative_mode:   'Typography Ads',
    campaign_style:  CAMPAIGN_STYLE_BY_ENERGY[s.energy] || 'Cinematic Social Ads Campaign',
    aspect_ratio:    extractRatioLabel(s.ratio),
    aspect_ratio_value: extractRatioValue(s.ratio),
    camera_system: {
      lens:           '24mm commercial wide lens',
      perspective:    'dynamic foreground distortion',
      depth:          'cinematic layered depth',
      camera_behavior:'immersive social ads perspective',
    },
    visual_dna: {
      style:     s.dna || 'Apple Minimal',
      energy:    s.energy || 'Premium',
      layout:    s.layout || 'Cinematic Layout',
      background:s.background || 'Solid Premium',
    },
    character_system: {
      type:         s.character || 'Auto Character',
      expression:   'Energetic and expressive',
      pose:         (!s.pose || /^auto/i.test(s.pose))
        ? 'natural expressive pose that fits the layout — vary it, do NOT always point'
        : s.pose,
      camera_angle: 'Wide lens perspective',
    },
    subject_behavior: {
      interaction:      'actively reacting to typography and UI',
      motion:           'mid-action cinematic movement',
      expression_style: 'authentic commercial excitement',
    },
    typography_system: {
      headline:    s.hook || '',
      subheadline: s.subheadline || '',
      cta:         s.cta || '',
      hierarchy:   s.weight || 'Modern Sans',
      composition: 'Oversized headline ~70% canvas; aggressive hierarchy; partial crop allowed; mobile-readable',
      integration: 'Typography integrated with scene lighting/shadows and interacts with subject/product',
    },
    headline_structure: {
      primary_focus_words: primaryWords,
      secondary_words:     secondaryWords,
      scale_contrast:      'dramatic',
      reading_flow:        'staggered cinematic hierarchy',
    },
    typography_tension: {
      cropping:  'intentional',
      overlap:   'controlled',
      alignment: 'optically balanced, not perfectly symmetrical',
    },
    visual_direction: {
      lighting:    'High-key commercial lighting',
      depth:       'Strong foreground/background separation',
      effects: [
        'Clean UI panels', 'Soft shadows', 'Glossy minimal reflections',
        'Subtle depth gradient', 'Subtle particles',
      ],
      environment: 'bright commercial environment (premium SaaS bright aesthetic): clean white/soft gradient background, high-key lighting, soft shadows, glossy minimal reflections',
    },
    lighting_system: {
      style:            'high-end bright commercial lighting',
      rim_light:        true,
      environment_glow: 'none',
      contrast:         'high-key lighting with soft shadows',
    },
    composition_energy: {
      layout_motion: 'dynamic',
      visual_flow:   'eye guided through typography -> character -> CTA',
      depth_layers:  'foreground midground background separation',
    },
    environment_system: {
      scene_type:           'realistic bright commercial environment',
      background_behavior:  'supports typography without distraction',
      anchor: 'bright commercial environment (premium SaaS bright aesthetic): clean white/soft gradient background, high-key lighting, soft shadows, glossy minimal reflections',
    },
    background_system: {
      base_tone:               'auto-detect from selected background color',
      brightness_behavior:     'adaptive',
      environment_style:       'bright commercial environment (Apple/Stripe/Linear-like) with clean gradients',
      lighting_behavior:       'high-key commercial lighting + soft shadows',
      contrast_strategy:       'dark clean typography on bright background',
      avoid_background_conflict: true,
    },
    environment_rules: {
      prefer_light_environment_when_bg_is_bright: true,
      prefer_dark_environment_when_bg_is_dark:    true,
      avoid_conflicting_lighting:                 true,
      match_ui_panels_to_theme:                   true,
    },
    product_system: (() => {
      const count = s.imageCount || 1;
      const position = s.position || 'center';
      // Pure typography mode: imageCount=1 + no character → skip product injection
      const isPureType = count === 1 && (s.character === 'No Human' || !s.character);
      if (isPureType) {
        return {
          type:        'pure typography composition',
          integration: 'typography is the hero — no product visual required',
          priority:    'typography is the sole focal point',
          expected_count:     0,
          placement_position: 'n/a (typography-only)',
          multi_image_rule:   'No product/subject — pure typographic poster composition',
        };
      }
      return {
        type:        'floating product/UI card',
        integration: 'interacts naturally with typography and character',
        priority:    'secondary focal point',
        expected_count:     count,
        placement_position: position,
        multi_image_rule:
          count === 1 ? 'Single hero subject — typography wraps around it' :
          count === 2 ? 'Two subjects in dual/comparison composition with typography between or framing them' :
          count === 3 ? 'Three subjects: one hero + two supporting; typography weaves through hierarchy' :
          count === 4 ? 'Four subjects in 2×2 grid with typography overlaid or anchoring the composition' :
                        'Five subjects in dynamic collage — one hero + four supporting; typography as connective tissue',
      };
    })(),
    color_palette: {
      primary:   s.primaryColor || '#2dd4bf',
      secondary: s.secondaryColor || '#ffffff',
    },
    campaign_feel: [
      'premium startup campaign', 'viral meta ads', 'modern SaaS advertising',
      'high CTR social creative', 'commercial ad photography',
    ],
    quality_target: [
      'premium startup campaign creative', 'viral Meta/TikTok ads',
      'modern SaaS/gaming ecommerce ads', 'agency-level social campaign poster',
    ],
    negative_rules: [
      'Flat poster look', 'Generic AI poster', 'Unreadable typography',
      'Weak focal hierarchy', 'Clutter',
    ],
    avoid: [
      'flat poster look', 'template canva feel', 'equal text sizing',
      'floating disconnected typography', 'generic influencer pose',
      'random glow clutter', 'centered boring composition', 'empty dead background',
      'weak focal hierarchy', 'black cinematic background', 'dark matte background',
      'neon tunnel look', 'heavy volumetric darkness', 'cyberpunk night environment',
    ],
  };

  // Build the 8 sectioned views for per-section copy
  const sections = [
    {
      key: 'title', label: '1) TITLE SECTION',
      text: stringifySection({
        creative_mode:      json.creative_mode,
        campaign_style:     json.campaign_style,
        aspect_ratio:       json.aspect_ratio,
        aspect_ratio_value: json.aspect_ratio_value,
        camera_system:      json.camera_system,
      }),
    },
    {
      key: 'art-direction', label: '2) ART DIRECTION',
      text: stringifySection({
        visual_direction:   json.visual_direction,
        lighting_system:    json.lighting_system,
        environment_system: json.environment_system,
      }),
    },
    {
      key: 'typography-system', label: '3) TYPOGRAPHY SYSTEM',
      text: stringifySection({
        typography_system:  json.typography_system,
        headline_structure: json.headline_structure,
        typography_tension: json.typography_tension,
      }),
    },
    {
      key: 'visual-style', label: '4) VISUAL STYLE',
      text: stringifySection({
        visual_dna:         json.visual_dna,
        composition_energy: json.composition_energy,
      }),
    },
    {
      key: 'subject', label: '5) SUBJECT & OBJECT DIRECTION',
      text: stringifySection({
        character_system:  json.character_system,
        subject_behavior:  json.subject_behavior,
        product_system:    json.product_system,
      }),
    },
    {
      key: 'color', label: '6) COLOR SYSTEM',
      text: stringifySection({
        color_palette:      json.color_palette,
        background_system:  json.background_system,
        environment_rules:  json.environment_rules,
      }),
    },
    {
      key: 'conversion', label: '7) CONVERSION FOCUS',
      text: stringifySection({
        campaign_feel:  json.campaign_feel,
        quality_target: json.quality_target,
      }),
    },
    {
      key: 'render', label: '8) FINAL RENDER STYLE',
      text: stringifySection({
        negative_rules: json.negative_rules,
        avoid:          json.avoid,
      }),
    },
  ];

  return { json, sections };
}

function stringifySection(obj) {
  return JSON.stringify(obj, null, 2);
}

function extractRatioLabel(r) {
  return r || '1:1 (Instagram Square)';
}
function extractRatioValue(r) {
  if (!r) return '1:1';
  const m = r.match(/^(\d+:\d+)/);
  return m ? m[1] : 'Carousel';
}

export const INITIAL_TYPOGRAPHY = {
  hook: '', subheadline: '', cta: '',
  dna: 'Apple Minimal', energy: 'Premium',
  character: 'Auto Character', pose: 'Auto (AI pilih)', layout: 'Cinematic Layout',
  intensity: 'Balanced', weight: 'Modern Sans', background: 'Solid Premium',
  primaryColor: '#2dd4bf', secondaryColor: '#ffffff',
  ratio: '4:5 (Feed)',
  imageCount: 1, position: 'center',
};
