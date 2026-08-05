import { STYLE_DIRECTION } from '../data/thumbnailOptions.js';

/**
 * Builds the YouTube Thumbnail brief (multi-line text, matches reference).
 * @param {object} s — thumbnail mode state
 * @returns {string}
 */
const POSITION_DIRECTIVE = {
  center:    'subject CENTERED with text framing above/below for symmetry',
  right:     'subject on the RIGHT side, text block on the LEFT with safe margin',
  left:      'subject on the LEFT side, text block on the RIGHT with safe margin',
  isometric: 'subject floating in ISOMETRIC tilt, text wrapping around with depth perspective',
  dynamic:   'DYNAMIC multi-layer composition: hero subject + secondary props arranged with motion lines',
};

const IMAGE_COUNT_DIRECTIVE = {
  1: 'single hero subject focus (1 image)',
  2: 'TWO subjects side-by-side comparison composition (2 images / dual focus)',
  3: 'THREE-element showcase composition (hero + 2 supporting elements arranged with hierarchy)',
  4: 'FOUR-element grid layout (2x2 quadrant composition)',
  5: 'FIVE-element collage composition (1 hero + 4 supporting elements scattered cleanly)',
};

export function buildThumbnail(s = {}) {
  const styleDir = STYLE_DIRECTION[s.style] || 'Modern YouTube thumbnail with high readability and strong focal subject';
  const positionDir   = POSITION_DIRECTIVE[s.position] || POSITION_DIRECTIVE.right;
  const imageCountDir = IMAGE_COUNT_DIRECTIVE[s.imageCount] || IMAGE_COUNT_DIRECTIVE[1];

  return `YOUTUBE THUMBNAIL BRIEF (TEXT MUST BE VISIBLE IN THE IMAGE)

THUMBNAIL CONTEXT:
- Video Title: ${s.title || '—'}
- Supporting Hook: ${s.hook || '—'}
- Topic Context: ${s.topic || s.hook || '—'}
- Channel/Brand: ${s.channel || '—'}
- Aspect Ratio: ${s.ratio || '16:9 (YouTube Thumbnail)'}
- Style Direction: ${styleDir}
- Mood/Emotion: ${s.mood || 'Curiosity'}
- Key Points: ${s.keyPoints || '—'}
- Lighting: ${s.lighting || 'Soft Lighting'}
- Color Grading: ${s.primaryColor || '#2dd4bf'} + ${s.secondaryColor || '#ffffff'}

VISUAL PROMPT:
- Cinematic YouTube thumbnail in the chosen style.
- Strong single focal point (face/eyes + one key object) that sells the story instantly.
- Clean background separation, ultra sharp details, strong contrast, mobile readable composition.
- Realistic lighting (${s.lighting || 'Soft Lighting'}), modern color grading using ${s.primaryColor || '#2dd4bf'} and ${s.secondaryColor || '#ffffff'}.
- Add subtle story props that match the title, but keep the scene uncluttered.
- Composition: ${positionDir}.
- Subject count: ${imageCountDir}.

TEXT OVERLAY INSTRUCTION (MUST BE RENDERED AS REAL READABLE TEXT IN THE IMAGE):
- Large bold readable thumbnail title (exact words, do not paraphrase, do not omit):
  "${s.title || ''}"
- Supporting hook text (smaller than title but still bold + readable):
  "${s.hook || ''}"
- Typography requirements: bold condensed sans-serif, very thick weight, high-contrast fill, thick outline/stroke, subtle drop shadow for separation.
- Readability requirements: text must be BIG, crisp, not blurry, not tiny, not hidden behind the subject, readable on mobile at small sizes.
- Placement requirements: keep text inside safe margins; avoid edges; keep headline dominant and hook secondary.
- Critical rules: DO NOT use placeholders like 'text overlay area' or 'space for title'. DO NOT leave the overlay blank. The text must be clearly visible.

MODEL OPTIMIZATION (ChatGPT Image / Flux / Ideogram / Leonardo):
- Render the overlay text exactly as written above, with correct spelling and clear letterforms.
- Prioritize legibility over decorative effects; avoid warping letters.

NEGATIVE:
- blurry, low-res, cluttered background, unreadable text, missing headline, blank text, distorted face, extra fingers, watermark, logo artifacts`;
}

export const INITIAL_THUMBNAIL = {
  title: '', hook: '', topic: '', channel: '', keyPoints: '',
  style: 'MrBeast', mood: 'Shock',
  designStyle: 'Minimal Clean', lighting: 'Soft Lighting',
  primaryColor: '#2dd4bf', secondaryColor: '#ffffff',
  ratio: '16:9 (YouTube Thumbnail)',
  imageCount: 1, position: 'right',
};
