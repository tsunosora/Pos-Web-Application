import {
  TEMPLATE_LABELS, getStoryFlow, assignLayouts, layoutDirection, getCoverLayout, makeSeed,
} from '../data/carouselOptions.js';

/**
 * Carousel Feeds prompt generator.
 *
 * Website ini HANYA prompt logic generator:
 *  - Tidak generate gambar.
 *  - Tidak memakai AI di sisi web (murni string templating deterministik).
 *  - User pilih template type + total slide (preset / manual).
 *
 * Slide 1 diisi user. Slide 2..akhir diisi instruksi auto-generate (oleh AI image
 * tool tujuan, mis. ChatGPT/Sora), saling nyambung jadi satu cerita. Tiap slide
 * tetap 1 gambar saja, dengan layout yang berbeda-beda.
 */

const fallback = (v, d) => {
  const s = (v ?? '').toString().trim();
  return s || d;
};

function slide1Prompt(ctx, objective, layout) {
  const { total } = ctx;
  return `Create ONLY carousel slide 1/${total}.

This is the first slide of a connected ${ctx.templateType} carousel campaign.

PRODUCT / CONTENT CONTEXT:
Brand: ${ctx.brandName}
Name: ${ctx.productName}
Category: ${ctx.productCategory}
Description: ${ctx.productDescription}
Main Benefit: ${ctx.mainBenefit}
Problem Solved: ${ctx.problemSolved}
Target Audience: ${ctx.targetAudience}
Platform: ${ctx.platform}
Aspect Ratio: ${ctx.aspectRatio}
Visual Style: ${ctx.visualStyle}
Color Mood: ${ctx.colorMood}
Copywriting Tone: ${ctx.toneCopywriting}

SLIDE 1 OBJECTIVE:
${objective}

USER INPUT:
Headline: "${ctx.slide1Headline}"
Subheadline: "${ctx.slide1Subheadline}"

LAYOUT DIRECTION:
Use this layout for slide 1:
${layoutDirection(layout)}

INSTRUCTION:
Create a premium scroll-stopping opening carousel slide.
Use the uploaded image as the main visual reference if provided.
If product image is uploaded, keep product design, color, logo, label, shape, and material unchanged.
Make the headline the strongest visual focus.
Make this slide create curiosity to swipe next.

STORY CONTINUITY:
This slide must start a connected story that will continue to the next slide.
Do not explain everything in slide 1.
Leave curiosity for slide 2.

STRICT OUTPUT RULES:
Generate ONLY slide 1.
One image only.
Do not create slide 2.
Do not create full carousel.
Do not create grid.
Do not create collage.
Do not create storyboard board.
Do not combine multiple slides in one image.
Output must be one standalone ${ctx.aspectRatio} carousel image.

NEGATIVE PROMPT:
carousel grid, collage, storyboard board, multiple slides in one canvas, bad typography, unreadable text, wrong product, distorted product, changed logo, blurry visual, messy layout, watermark, low quality.`;
}

function midPrompt(ctx, slideNumber, objective, layout) {
  const { total } = ctx;
  return `Create ONLY carousel slide ${slideNumber}/${total}.

This is a continuation slide from the previous carousel image.

REQUIRED UPLOADS:
1. Upload the original image / product image / main visual reference.
2. Upload the previously generated slide image.

CAMPAIGN CONTEXT:
Template Type: ${ctx.templateType}
Brand: ${ctx.brandName}
Name: ${ctx.productName}
Category: ${ctx.productCategory}
Description: ${ctx.productDescription}
Main Benefit: ${ctx.mainBenefit}
Problem Solved: ${ctx.problemSolved}
Target Audience: ${ctx.targetAudience}
Visual Style: ${ctx.visualStyle}
Color Mood: ${ctx.colorMood}
Copywriting Tone: ${ctx.toneCopywriting}

CURRENT SLIDE OBJECTIVE:
${objective}

LAYOUT DIRECTION:
Use this layout for slide ${slideNumber}:
${layoutDirection(layout)}

STORY INSTRUCTION:
Continue the story from the previous slide.
Automatically generate the headline, subheadline, and visual idea for this slide based on the objective.
The message must connect naturally to the previous slide.
Do not repeat the same copy from previous slide.
Make this slide create curiosity for the next slide.

REFERENCE IMAGE RULES:
Use the original image as the main identity reference.
Use the previous slide image only as style reference.
Match previous slide color palette, typography style, lighting mood, spacing system, and campaign feeling.
Do not copy the exact previous layout.
Create a fresh composition using the layout direction above.

DESIGN REQUIREMENTS:
The image/main visual must appear clearly.
Typography must be readable.
Use clean premium layout.
Keep strong visual hierarchy.
Add small slide indicator: ${slideNumber}/${total}.
Make the image position and text position different from the previous slide.

STRICT OUTPUT RULES:
Generate ONLY slide ${slideNumber}.
One image only.
Do not show other slide numbers.
Do not create full carousel.
Do not create grid.
Do not create collage.
Do not create storyboard board.
Do not combine multiple slides in one image.
Output must be one standalone ${ctx.aspectRatio} carousel image.

NEGATIVE PROMPT:
carousel grid, collage, storyboard board, multiple slides in one canvas, duplicated previous slide, repeated layout, different branding, different product, wrong logo, bad typography, unreadable text, blurry visual, distorted product, messy layout, watermark, low quality.`;
}

function finalPrompt(ctx, slideNumber, objective, layout) {
  const { total } = ctx;
  return `Create ONLY carousel slide ${slideNumber}/${total}.

This is the final conversion slide of the ${ctx.templateType} carousel campaign.

REQUIRED UPLOADS:
1. Upload the original image / product image / main visual reference.
2. Upload the previously generated slide image.

CAMPAIGN CONTEXT:
Template Type: ${ctx.templateType}
Brand: ${ctx.brandName}
Name: ${ctx.productName}
Category: ${ctx.productCategory}
Description: ${ctx.productDescription}
Main Benefit: ${ctx.mainBenefit}
Problem Solved: ${ctx.problemSolved}
Target Audience: ${ctx.targetAudience}
Visual Style: ${ctx.visualStyle}
Color Mood: ${ctx.colorMood}
Copywriting Tone: ${ctx.toneCopywriting}

FINAL SLIDE OBJECTIVE:
${objective}

CTA TEXT:
${ctx.ctaText}

LAYOUT DIRECTION:
Use this final slide layout:
${layoutDirection(layout)}

STORY INSTRUCTION:
Finish the carousel story with a strong closing message.
Summarize the main value clearly.
Make the audience feel ready to take action.
Create a strong CTA button using the CTA text.

REFERENCE IMAGE RULES:
Use the original image as the main identity reference.
Use the previous slide image only as style reference.
Match the same campaign identity, colors, typography, lighting, and premium mood.
Do not copy the previous layout exactly.

DESIGN REQUIREMENTS:
Show the main visual clearly.
Use a clean conversion-focused layout.
Add CTA button: "${ctx.ctaText}"
Add small slide indicator: ${slideNumber}/${total}.
Make this slide feel like the final closing page of the carousel.

STRICT OUTPUT RULES:
Generate ONLY slide ${slideNumber}.
One image only.
Do not create full carousel.
Do not create grid.
Do not create collage.
Do not create storyboard board.
Do not combine multiple slides in one image.
Output must be one standalone ${ctx.aspectRatio} carousel image.

NEGATIVE PROMPT:
carousel grid, collage, storyboard board, multiple slides in one canvas, repeated layout, different branding, different product, wrong logo, bad typography, unreadable text, blurry visual, distorted visual, messy layout, watermark, low quality.`;
}

// ── NEWS TEMPLATE ──────────────────────────────────────────────────────────
// Khusus news: user cukup menempel teks berita. AI yang memecah jadi slide.
function newsPrompt(ctx, slideNumber, objective, layout, kind) {
  const { total } = ctx;
  const hasMedia = !!ctx.mediaName;
  // Kalau media kosong → JANGAN suruh AI bikin handle/source (biar tidak ngarang @yournews).
  const sourceLine = hasMedia
    ? `- Bottom source bar showing the account handle exactly: "${ctx.mediaName}". Use ONLY this handle, do not invent another.`
    : `- Do NOT add any media handle, account name, source bar, brand name, logo, or "@username" anywhere. Leave the bottom area clean. Never invent a media/source identity.`;
  const noFakeSource = hasMedia ? '' : ' invented media handle, fake account name, @username, fake source name, fake brand name,';

  // Warna khusus SLIDE 1 (cover) — slide 2+ tetap auto/random (match palette slide 1).
  const coverColor = kind === 'cover'
    ? `\nCOVER COLOR DIRECTION (slide 1 only):
- Headline / text color: ${ctx.newsTextColor}.
- Text background: ${ctx.newsTextBgAuto
        ? 'OPTIONAL — let the AI decide whether to place the headline on a solid/gradient background panel/bar or directly over the image, choosing whatever is most readable.'
        : `place the headline text on a background panel/bar colored ${ctx.newsTextBg}.`}
- Overall mood / atmosphere color: ${ctx.newsMoodColor} (use as the dominant accent / ambiance of the slide).\n`
    : '';

  const roleLine =
    kind === 'cover' ? `This is the COVER slide of a news/update carousel.`
    : kind === 'final' ? `This is the CLOSING slide of the news carousel.`
    : `This is a continuation slide of the news carousel.`;

  const objectiveBlock =
    kind === 'cover'
      ? `SLIDE 1 OBJECTIVE: Headline / Cover
From the news content above, extract the SINGLE most important headline and write it as a short, bold, accurate headline (max ~10 words). Add a one-line subheadline if helpful. Do not exaggerate or invent facts.`
      : kind === 'final'
      ? `FINAL SLIDE OBJECTIVE: ${objective}
Summarize the key takeaway of the news in 1-2 short lines${hasMedia ? `, show the source/credit "${ctx.mediaName}"` : ' (do NOT invent any source, credit, media name, or handle)'}, and add a clear call-to-action.
CTA TEXT: ${ctx.ctaText}`
      : `CURRENT SLIDE OBJECTIVE: ${objective}
From the full news content above, extract ONLY the part relevant to this objective and rewrite it as concise, readable on-image text: one short bold sub-headline + 2-3 supporting lines max. Continue naturally from the previous slide. Do not repeat previous slides.`;

  return `Create ONLY news carousel slide ${slideNumber}/${total}.

${roleLine}

NEWS CONTENT (full story — use as the single source of truth, do NOT add facts that are not here):
"""
${ctx.newsContent}
"""

${objectiveBlock}

NEWS DESIGN SYSTEM (keep IDENTICAL across all slides):
A modern, credible social-media news/update carousel — like a trusted news Instagram account.
- Clean editorial layout, strong readable typography, clear visual hierarchy.
- Top label/category bar (generic, e.g. NEWS / UPDATE — not a brand).
${sourceLine}
- Small slide indicator: ${slideNumber}/${total}.
- Visual Style: ${ctx.visualStyle}. Color Mood: ${ctx.colorMood}. Tone: ${ctx.toneCopywriting}.
- Same template, colors, and fonts on every slide.
${kind === 'cover' ? '- COVER extras: oversized bold headline, hero visual area, optional category tag (e.g. NEWS / UPDATE), date placeholder.' : ''}
${coverColor}
LAYOUT DIRECTION:
Use this layout for slide ${slideNumber}:
${layoutDirection(layout)}
Make the image position and text position different from the previous slide.

IMAGE / REFERENCE RULES:
If a relevant photo is uploaded, use it as the main visual and keep it unchanged.
If no photo is uploaded, generate a tasteful, neutral editorial visual that fits the news.
Do NOT fabricate misleading specifics, fake logos, fake screenshots, or real identifiable faces/quotes that are not in the news content.

STRICT OUTPUT RULES:
Generate ONLY slide ${slideNumber}.
One image only.
Do not create full carousel, grid, collage, or storyboard board.
Do not combine multiple slides in one image.
Output must be one standalone ${ctx.aspectRatio} carousel image.

NEGATIVE PROMPT:
carousel grid, collage, storyboard board, multiple slides in one canvas, repeated layout, unreadable text, bad typography, fake logo,${noFakeSource} misleading fabricated facts, distorted faces, watermark, low quality.`;
}

/**
 * @param {object} formData — carousel mode state
 * @returns {Array<{slideNumber:number, slideTitle:string, objective:string, layout:string, prompt:string}>}
 */
export function generateCarouselPrompts(formData = {}) {
  // 1. & 2. baca templateType + totalSlides
  const templateKey = formData.templateType || 'product';
  let total = parseInt(formData.totalSlides, 10);
  if (!Number.isFinite(total)) total = 5;
  total = Math.max(3, Math.min(7, total)); // clamp: 3–7 slide (maks 7)

  const isNews = templateKey === 'news';

  // 3. pilih story flow sesuai templateType + totalSlides
  const flow = getStoryFlow(templateKey, total);
  // 4. assign layout variation tiap slide. Slide 1 = cover pilihan user; slide
  //    2+ = OTOMATIS & RANDOM (seed dari konten → beda per berita/produk).
  const seed = makeSeed(
    `${templateKey}|${total}|${formData.coverLayout}|${formData.brandName || ''}${formData.productName || ''}` +
    `${(formData.newsContent || '').slice(0, 60)}${formData.slide1Headline || ''}`
  );
  const layouts = assignLayouts(total, seed);
  const coverLayout = getCoverLayout(formData.coverLayout);

  const ctx = {
    total,
    templateType:       TEMPLATE_LABELS[templateKey] || templateKey,
    newsContent:        fallback(formData.newsContent, '(tempel teks berita di sini)'),
    mediaName:          (formData.mediaName || '').toString().trim(),
    newsTextColor:      formData.newsTextColor || '#ffffff',
    newsMoodColor:      formData.newsMoodColor || '#dc2626',
    newsTextBgAuto:     formData.newsTextBgAuto !== false,
    newsTextBg:         formData.newsTextBg || '#0a0a0a',
    brandName:          fallback(formData.brandName, 'YourBrand'),
    productName:        fallback(formData.productName, 'Your Product'),
    productCategory:    fallback(formData.productCategory, '-'),
    productDescription: fallback(formData.productDescription, '-'),
    mainBenefit:        fallback(formData.mainBenefit, '-'),
    problemSolved:      fallback(formData.problemSolved, '-'),
    targetAudience:     fallback(formData.targetAudience, 'General audience'),
    platform:           fallback(formData.platform, 'Instagram'),
    aspectRatio:        fallback(formData.aspectRatio, '4:5 (Portrait)'),
    visualStyle:        fallback(formData.visualStyle, 'Minimal Clean'),
    colorMood:          formData.colorMoodCustom
      ? `Custom palette — primary ${formData.colorPrimary || '#2dd4bf'}, secondary ${formData.colorSecondary || '#ffffff'} (gunakan kedua warna ini sebagai dominan & aksen di semua slide)`
      : fallback(formData.colorMood, 'Warm'),
    toneCopywriting:    fallback(formData.toneCopywriting, 'Persuasive'),
    ctaText:            fallback(formData.ctaText, isNews ? 'Follow untuk update' : 'Order Now'),
    slide1Headline:     fallback(formData.slide1Headline, '(isi headline slide 1)'),
    slide1Subheadline:  fallback(formData.slide1Subheadline, ''),
  };

  // 5..9 generate prompt per slide
  const out = [];
  for (let i = 0; i < total; i++) {
    const slideNumber = i + 1;
    const objective = flow[i] || 'Value';
    // Slide 1 = cover pilihan user; slide 2+ = layout otomatis & random.
    let lay = i === 0 ? coverLayout : layouts[i];
    let prompt;
    if (isNews) {
      // News: cukup isi berita → AI memecah jadi slide otomatis.
      const kind = i === 0 ? 'cover' : i === total - 1 ? 'final' : 'mid';
      prompt = newsPrompt(ctx, slideNumber, objective, lay, kind);
    } else if (i === 0) prompt = slide1Prompt(ctx, objective, lay);          // slide 1 = cover pilihan user
    else if (i === total - 1) prompt = finalPrompt(ctx, slideNumber, objective, lay); // final = CTA
    else prompt = midPrompt(ctx, slideNumber, objective, lay);              // tengah = auto

    out.push({
      slideNumber,
      slideTitle: `Prompt Slide ${slideNumber}/${total} - ${objective}`,
      objective,
      layout: lay.name,
      prompt,
    });
  }
  return out;
}

export const INITIAL_CAROUSEL = {
  templateType: 'product',
  totalSlides: '5',
  brandName: '',
  productName: '',
  productCategory: '',
  productDescription: '',
  mainBenefit: '',
  problemSolved: '',
  targetAudience: '',
  platform: 'Instagram',
  aspectRatio: '4:5 (Portrait)',
  visualStyle: 'Minimal Clean',
  colorMood: 'Warm',
  colorMoodCustom: false,
  colorPrimary: '#2dd4bf',
  colorSecondary: '#ffffff',
  toneCopywriting: 'Persuasive',
  ctaText: '',
  slide1Headline: '',
  slide1Subheadline: '',
  // Layout slide 1 (cover) — default 'auto' = Hero (seperti sebelum ada opsi letak).
  coverLayout: 'auto',
  // Khusus template News
  newsContent: '',
  mediaName: '',
  // Warna khusus slide 1 (cover) News
  newsTextColor: '#ffffff',
  newsMoodColor: '#dc2626',
  newsTextBgAuto: true,
  newsTextBg: '#0a0a0a',
};
