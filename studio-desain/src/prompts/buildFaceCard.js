import { SUB_TYPES, SUBTYPE_DESC, AESTHETIC_DEFAULT_BY_SUBTYPE } from '../data/faceCardOptions.js';

/**
 * Builds the Face Card Analysis prompt for the configured sub-type.
 * Output is a structured JSON prompt designed to be pasted into ChatGPT
 * along with the user's uploaded portrait photo.
 *
 * @param {object} s — facecard mode state
 * @returns {object} ready to JSON.stringify(_, null, 2)
 */
export function buildFaceCard(s = {}) {
  const sub = SUB_TYPES.find((t) => t.value === s.subType) || SUB_TYPES[0];

  const out = {
    task_type:    'face_card_analysis',
    sub_type:     sub.value,
    title_text:   sub.title,
    system_directive:
      `You are an elite editorial designer creating a high-end "${sub.title}" infographic poster. ` +
      `Use the user's uploaded portrait as the main subject. ` +
      `CRITICAL: 100% preserve uploaded subject identity. Do NOT modify facial features, skin tone, eye shape, or face structure. Same person, same identity. ` +
      `Style must be premium magazine quality: clean typography, rounded info cards, thin connection lines, subtle shadows, editorial sophistication.`,

    model_parameters: {
      aspect_ratio:    s.aspectRatio || '4:5 Portrait',
      quality:         'ultra-high editorial photorealistic',
      style_preset:    s.aesthetic   || 'Editorial Magazine',
    },

    uploaded_subject_directive: {
      identity_lock: '100% preserve uploaded portrait identity',
      face_treatment:'enhance natural beauty subtly — smooth skin, soft glow, realistic texture — but DO NOT change the face',
      note:          'User will provide their own portrait photo via upload',
    },

    style_direction: {
      aesthetic:          s.aesthetic       || 'Editorial Magazine',
      background_tone:    s.background      || 'Beige Ivory',
      typography_system:  s.typography      || 'Serif + Sans Hybrid',
      color_mood:         s.colorMood       || 'Warm Tones',
      lighting:           s.lighting        || 'Soft Diffused',
      layout_density:     s.layoutDensity   || 'Balanced Grid',
      decorative_accent:  s.decorativeAccent|| 'Rounded Cards',
    },

    subtype_config: buildSubtypeConfig(s),

    optional_subject_hints: collectOptionalHints(s),

    design_rules: [
      'Keep text short and clean, no paragraphs',
      'Use small rounded info cards with simple icons',
      'Thin connection lines and arrows pointing to features',
      'Subtle drop shadows for depth',
      'High-end editorial magazine aesthetic',
      'Minimal, aesthetic, and visual-first',
      'Consistent lighting across all panels',
      'Premium grid-based layout',
    ],

    negative_prompt:
      'ugly, deformed face, blurry, distorted, identity change, different person, paragraphs of text, cluttered layout, low quality, generic AI poster, watermark, fake logos, bad anatomy, warped face, low resolution',
  };

  return out;
}

// ───────── per sub-type config builder ─────────
function buildSubtypeConfig(s) {
  switch (s.subType) {
    case 'face-feature':
      return {
        type: 'Face Features Analysis',
        description: SUBTYPE_DESC['face-feature'],
        features_to_label: s.featuresToLabel || ['Face Shape', 'Eyes', 'Eyebrows', 'Nose', 'Cheeks', 'Lips'],
        show_arrows:       s.showArrows !== false,
        icon_style:        s.iconStyle  || 'Line Drawing',
        bullet_per_feature:s.bulletCount|| 3,
        card_style:        s.cardStyle  || 'Rounded',
        layout_pattern:    'Portrait in center, info cards distributed around with thin connection arrows to each feature.',
        label_instruction: 'For each labeled feature, include a short title (e.g. "Soft Oval", "Almond Eyes") and 2-3 short bullet points describing actual observed features.',
      };

    case 'spectacles':
      return {
        type: 'Spectacles Guide',
        description: SUBTYPE_DESC['spectacles'],
        face_analysis_panel: true,
        key_features_panel:  s.showKeyFeatures !== false,
        frame_styles_to_show:s.frameStyles    || ['Round', 'Oval', 'Square', 'Cat-Eye', 'Aviator', 'Rectangle'],
        recommended_count:   s.recommendCount || 5,
        avoid_count:         s.avoidCount     || 2,
        show_color_swatches: s.showColorSwatches !== false,
        show_quick_tips:     s.showQuickTips     !== false,
        try_on_instruction:  'Show side-by-side virtual try-on of recommended frames on the same face. Mark unsuitable frames with subtle X badge.',
      };

    case 'style':
      return {
        type: 'Style Analysis Board',
        description: SUBTYPE_DESC['style'],
        style_categories_to_feature: s.styleCategories || ['Old Money', 'Quiet Luxury', 'Classic Elegant', 'Minimalist', 'Feminine Chic', 'Business Chic'],
        best_styles_highlight_count: s.highlightCount   || 4,
        your_vibe_keywords:          s.vibeKeywords     || 'Confident · Elegant · Feminine',
        include_color_palette:       s.includeColorPalette  !== false,
        include_silhouettes_guide:   s.includeSilhouettes   !== false,
        include_you_in_styles_grid:  s.includeYouInStyles   !== false,
        include_accessories_panel:   s.includeAccessories   !== false,
        include_capsule_wardrobe:    s.includeCapsule       !== false,
        overall_identity_statement:  s.overallIdentity      || 'Soft Glam + Elegant + Confident Feminine Energy',
        layout_instruction:          'Editorial fashion magazine style (Dior / Ralph Lauren). Beige/ivory background, warm tones, soft diffused lighting, grid-based layout with multiple full-body looks.',
      };

    case 'color':
      return {
        type: 'Color Analysis Board',
        description: SUBTYPE_DESC['color'],
        undertone_result:        s.undertoneResult || 'Warm Neutral',
        season_type:             s.seasonType      || 'Autumn Soft',
        best_colors_count:       s.bestColorsCount || 24,
        avoid_colors_count:      s.avoidColorsCount|| 6,
        include_neutrals:        s.includeNeutrals     !== false,
        include_prints_flatter:  s.includePrints       !== false,
        include_makeup_guide:    s.includeMakeupGuide  !== false,
        include_hair_colors:     s.includeHairColors   !== false,
        jewelry_recommendations: s.jewelryRecs    || ['Gold', 'Rose Gold', 'Pearl'],
        include_you_in_colors:   s.includeYouInColors  !== false,
        include_capsule_wardrobe:s.includeCapsule      !== false,
        layout_instruction:      'Luxury fashion magazine style (Dior / Ralph Lauren). Beige/ivory background with fabric swatch panels, undertone marker, prints, makeup palette, hair colors, jewelry, and outfit grid.',
      };

    case 'makeup':
      return {
        type: 'Makeup Analysis Board',
        description: SUBTYPE_DESC['makeup'],
        skin_tone:               s.skinTone        || 'Medium',
        undertone:               s.makeupUndertone || 'Warm Neutral',
        contrast_level:          s.contrastLevel   || 'Medium',
        eyeshadow_looks_count:   s.eyeshadowCount  || 5,
        eyeliner_styles:         s.eyelinerStyles  || ['Tightline', 'Soft Wing', 'Smoky', 'Glam Wing', 'Smudged'],
        mascara_styles:          s.mascaraStyles   || ['Lengthening', 'Volumizing', 'Curl & Lift', 'Doll-Eye'],
        lip_colors_count:        s.lipColorsCount  || 6,
        include_cheek_contour:   s.includeCheekContour !== false,
        include_final_looks:     s.includeFinalLooks   !== false,
        include_recommended_products: s.includeProducts !== false,
        include_tools:           s.includeTools        !== false,
        include_tips:            s.includeTips         !== false,
        layout_instruction:      'Luxury beauty magazine style (Dior / Charlotte Tilbury). Beige/ivory background, soft diffused lighting, panels for skin analysis, eyeshadow looks, eyeliner styles, mascara, cheek+contour guide, lip shades, final looks (Natural Glow / Soft Glam / Evening Glam), products, and tools.',
      };

    default:
      return { type: 'Unknown' };
  }
}

// ───────── optional subject hints ─────────
function collectOptionalHints(s) {
  const hints = {};
  if (s.genderHint    && s.genderHint    !== 'None') hints.gender         = s.genderHint;
  if (s.ageRange      && s.ageRange      !== 'None') hints.age_range      = s.ageRange;
  if (s.ethnicityHint && s.ethnicityHint !== 'None') hints.cultural_context = s.ethnicityHint;
  if (s.hijabStyle    && s.hijabStyle    !== 'None') hints.hijab_style    = s.hijabStyle;
  if (s.expression    && s.expression    !== 'None') hints.expression     = s.expression;
  if (s.vibeKeywords  && s.vibeKeywords.trim())       hints.style_vibe    = s.vibeKeywords.trim();

  if (Object.keys(hints).length === 0) {
    return {
      note: 'No optional hints provided — AI will infer fully from the uploaded portrait.',
    };
  }

  return {
    note: 'Optional hints provided by user. Use as gentle direction only; the uploaded portrait remains source of truth.',
    ...hints,
  };
}

// ───────── INITIAL STATE ─────────
export const INITIAL_FACECARD = {
  // Section A
  subType: 'face-feature',

  // Section B — Style Direction (defaults from face-feature aesthetic)
  aesthetic:         AESTHETIC_DEFAULT_BY_SUBTYPE['face-feature'].aesthetic,
  background:        AESTHETIC_DEFAULT_BY_SUBTYPE['face-feature'].background,
  typography:        AESTHETIC_DEFAULT_BY_SUBTYPE['face-feature'].typography,
  colorMood:         AESTHETIC_DEFAULT_BY_SUBTYPE['face-feature'].colorMood,
  lighting:          AESTHETIC_DEFAULT_BY_SUBTYPE['face-feature'].lighting,
  layoutDensity:     'Balanced Grid',
  aspectRatio:       '4:5 Portrait',
  decorativeAccent:  'Rounded Cards',

  // Section D — Subject Hints (optional, default None)
  genderHint:    'None',
  ageRange:      'None',
  ethnicityHint: 'None',
  hijabStyle:    'None',
  expression:    'None',
  vibeKeywords:  '',

  // Sub-type specific defaults
  // Face Features
  featuresToLabel: ['Face Shape', 'Eyes', 'Eyebrows', 'Nose', 'Cheeks', 'Lips'],
  showArrows:      true,
  iconStyle:       'Line Drawing',
  bulletCount:     3,
  cardStyle:       'Rounded',

  // Spectacles
  showKeyFeatures:  true,
  frameStyles:      ['Round', 'Oval', 'Square', 'Cat-Eye', 'Aviator', 'Rectangle'],
  recommendCount:   5,
  avoidCount:       2,
  showColorSwatches:true,
  showQuickTips:    true,

  // Style Analysis
  styleCategories:    ['Old Money', 'Quiet Luxury', 'Classic Elegant', 'Minimalist', 'Feminine Chic', 'Business Chic'],
  highlightCount:     4,
  vibeKeywordsStyle:  'Confident · Elegant · Feminine',
  includeColorPalette:true,
  includeSilhouettes: true,
  includeYouInStyles: true,
  includeAccessories: true,
  includeCapsule:     true,
  overallIdentity:    'Soft Glam + Elegant + Confident Feminine Energy',

  // Color Analysis
  undertoneResult:   'Warm Neutral',
  seasonType:        'Autumn Soft',
  bestColorsCount:   24,
  avoidColorsCount:  6,
  includeNeutrals:   true,
  includePrints:     true,
  includeMakeupGuide:true,
  includeHairColors: true,
  jewelryRecs:       ['Gold', 'Rose Gold', 'Pearl'],
  includeYouInColors:true,

  // Makeup
  skinTone:         'Medium',
  makeupUndertone:  'Warm Neutral',
  contrastLevel:    'Medium',
  eyeshadowCount:   5,
  eyelinerStyles:   ['Tightline', 'Soft Wing', 'Smoky', 'Glam Wing', 'Smudged'],
  mascaraStyles:    ['Lengthening', 'Volumizing', 'Curl & Lift', 'Doll-Eye'],
  lipColorsCount:   6,
  includeCheekContour: true,
  includeFinalLooks:   true,
  includeProducts:     true,
  includeTools:        true,
  includeTips:         true,
};
