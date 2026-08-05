import {
  COMPOSITION_BY_COUNT, PLACEMENT_BY_POSITION,
  LIGHTING_DESC, AESTHETIC_BY_STYLE, STRICT_RULES,
} from '../data/bannerOptions.js';

/**
 * Builds the Banner Ads commercial banner JSON prompt (matches reference exactly).
 * @param {object} s — banner mode state
 * @returns {object} ready to JSON.stringify(_, null, 2)
 */
export function buildBanner(s = {}) {
  return {
    task_type: 'commercial_banner_generation',
    system_directive:
      'You are an elite Commercial Art Director and Graphic Designer. Create a premium product promotional banner based on the exact specifications below. Ensure the provided product image(s) are seamlessly integrated.',
    model_parameters: {
      aspect_ratio: s.ratio || '16:9',
      style_preset: s.style || 'Minimal Clean',
      quality: 'high',
      photorealism: 'ultra-realistic, 8k resolution',
    },
    prompt_structure: {
      subject: `A professional promotional banner for ${s.brand || 'YourBrand'}`,
      branding_elements: {
        brand_name:    s.brand || '',
        headline:      s.headline || '',
        subheadline:   s.tagline || '',
        description:   s.description || '',
        call_to_action:s.cta || '',
      },
      product_visual_layout: {
        expected_images_count: s.imageCount || 1,
        composition_style:     COMPOSITION_BY_COUNT[s.imageCount] || COMPOSITION_BY_COUNT[1],
        placement_rule:        PLACEMENT_BY_POSITION[s.position] || PLACEMENT_BY_POSITION.center,
        integration_and_blending:
          'Blend the product(s) seamlessly into the environment with accurate shadows and reflections matching the lighting style.',
        strict_multi_image_rules: STRICT_RULES(s.imageCount || 1),
      },
      information_layout: {
        features_to_highlight: Array.isArray(s.features) ? s.features.filter(Boolean) : [],
        ui_elements:
          `Incorporate minimalist floating UI cards, feature icons, or glassmorphism panels to display the features around the product.\n` +
          (s.cta
            ? `IMPORTANT: Add a premium modern CTA (Call-to-Action) button displaying: '${s.cta}'. Make it prominent to encourage user interaction.`
            : `Keep the layout free of CTA buttons unless explicitly required.`),
      },
      visual_style_details: {
        color_palette: {
          primary_accent:        s.primaryColor || '#2dd4bf',
          secondary_background:  s.secondaryColor || '#ffffff',
          harmony: 'Create a cohesive color grading using these specific hex colors as the dominant palette.',
        },
        lighting_setup:   LIGHTING_DESC[s.lighting] || s.lighting || 'Diffused softbox lighting, gentle shadows, even illumination',
        aesthetic_keywords: AESTHETIC_BY_STYLE[s.style] || 'Modern, clean, premium product presentation',
      },
      typography_instructions:
        'Leave clear negative space for typography. The generated image should either include sleek modern typography for the headline/features, or provide clean areas where text can be overlaid perfectly later.',
      composition_rules: [
        'Rule of thirds for balanced layout',
        'Clear visual hierarchy focusing on the product(s) first, then headline',
        'Ensure background does not overpower the product(s)',
      ],
      negative_prompt:
        'ugly, deformed, noisy, blurry, distorted, out of focus, bad anatomy, bad typography, warped products, misspelled words, cluttered background, watermarks, signatures, text artifacts, low resolution',
    },
  };
}

export const INITIAL_BANNER = {
  brand: '', headline: '', tagline: '', description: '', cta: '',
  features: [],
  imageCount: 1, position: 'center',
  style: 'Minimal Clean', lighting: 'Soft Lighting',
  primaryColor: '#2dd4bf', secondaryColor: '#ffffff',
  ratio: '4:5 (Portrait Feed)',
};
