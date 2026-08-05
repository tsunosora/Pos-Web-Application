export const TYPO_DNA = [
  'Apple Minimal', 'Neo Brutalist', 'Swiss Editorial', 'Luxury Fashion',
  'Cyberpunk Neon', 'Startup SaaS', 'Retro Futuristic', 'Japanese Minimal',
  'Hyper Commercial', 'Street Poster', 'Y2K Energy', 'Viral TikTok Ads',
  'Luxury Black Gold', 'Modern Tech', 'Glassmorphism Premium',
];

export const TYPO_ENERGY = [
  'Calm', 'Premium', 'Elegant', 'Emotional', 'Aggressive', 'Viral',
  'Loud', 'Energetic', 'Futuristic', 'Clean', 'Luxury', 'Explosive',
];

export const CHARACTERS = [
  'Auto Character', 'Male Model', 'Female Model', 'Muslim Male', 'Muslimah',
  'Kid / Child', 'Teenager', 'Gen-Z Creator', 'Businessman', 'Office Worker',
  'Gamer', 'Athlete', 'Fashion Model', 'Couple', 'No Human',
];

// Pose karakter — biar gak selalu "menunjuk". Bisa custom juga.
export const TYPO_POSES = [
  'Auto (AI pilih)',
  'Pointing toward headline',
  'Holding product',
  'Presenting / open hand gesture',
  'Arms crossed confident',
  'Hands on hips',
  'Looking at camera',
  'Looking at product',
  'Thumbs up',
  'Showing result / before-after',
  'Walking toward camera',
  'Sitting relaxed',
  'Leaning casual',
  'Hands in pockets',
  'Surprised reaction',
  'Thinking pose',
  'Candid laugh',
  'Reaching out of frame',
];

export const LAYOUTS = [
  'Centered Hero', 'Asymmetrical', 'Editorial Split', 'Left Heavy', 'Right Heavy',
  'Dynamic Stack', 'Floating Composition', 'Diagonal Flow', 'Magazine Layout',
  'Poster Composition', 'Hero Typography', 'Cinematic Layout',
];

export const INTENSITIES = [
  'Minimal', 'Balanced', 'Dynamic', 'High Energy', 'Cinematic',
  'Hyper Dynamic', 'Explosive', 'Premium Luxury',
];

export const WEIGHTS = [
  'Thin Elegant', 'Modern Sans', 'Ultra Bold', 'Heavy Condensed',
  'Luxury Serif', 'Experimental', 'Wide Typography', 'Futuristic Geometric',
  'Brutalist Bold',
];

export const BACKGROUNDS = [
  'Solid Premium', 'Gradient Glow', 'Abstract Shape', 'Glass Blur',
  'Futuristic Grid', 'Neon Depth', 'Metallic Texture', 'Liquid Motion',
  'Soft Noise', 'Editorial Texture', 'Luxury Matte', 'Holographic', 'Dark Cinematic',
];

export const RATIOS = [
  '1:1 (Instagram Square)', '4:5 (Feed)', '16:9 (Landscape)',
  '9:16 (Story)', 'Carousel Slide',
];

// Maps Typography Energy → campaign_style
export const CAMPAIGN_STYLE_BY_ENERGY = {
  Calm:       'Editorial Calm Campaign',
  Premium:    'Cinematic Social Ads Campaign',
  Elegant:    'Luxury Editorial Campaign',
  Emotional:  'Emotional Storytelling Campaign',
  Aggressive: 'Aggressive Hype Campaign',
  Viral:      'Viral Social Hook Campaign',
  Loud:       'Loud Streetwear Campaign',
  Energetic:  'Energetic Lifestyle Campaign',
  Futuristic: 'Futuristic Tech Campaign',
  Clean:      'Clean SaaS Campaign',
  Luxury:     'Luxury Black-Gold Campaign',
  Explosive:  'Explosive Drop Campaign',
};
