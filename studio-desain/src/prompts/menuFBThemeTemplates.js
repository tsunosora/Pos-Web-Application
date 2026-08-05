/**
 * Per-theme PROSE prompt builders for Menu F&B mode.
 *
 * Each template is a function: (state) => fullProsePromptString
 * The prose follows the EXACT style/structure of user's 7 reference prompts
 * (Design 1-5 + La Bella + Cemilan Bunya).
 *
 * Key patterns from user's prompts (all templates honor these):
 *  - STRICT PHOTO PRESERVATION mode (99% similarity, no recreate/redraw)
 *  - Detailed visual direction in plain prose paragraphs
 *  - Specific color hex codes
 *  - Layout style: "luxury editorial menu" NOT poster, NOT collage
 *  - Photo treatment: selective placement, not every item has photo
 *  - Typography hierarchy with specific color recommendations
 *  - "STRICT" / "IMPORTANT" / "AVOID" warning blocks
 *  - Negative prompt at end
 *  - Brand-specific decorative elements
 */

// ─── Shared utility: format menu items into user's prose style ──────────
function formatMenuItems(categories, showPrices) {
  if (!categories || categories.length === 0) return '(no menu items provided)';

  return categories
    .filter((c) => c && c.name && (c.items || []).some((it) => it && it.name))
    .map((cat) => {
      const items = (cat.items || []).filter((it) => it && it.name);
      const itemLines = items.map((it) => {
        const parts = [it.name.toUpperCase()];
        if (it.desc) parts.push(it.desc);
        const left = parts.join('  •  ');
        const right = (showPrices && it.price) ? `  —  ${it.price}` : '';
        return `${left}${right}`;
      });
      return `\n${cat.name.toUpperCase()}\n${itemLines.join('\n')}`;
    })
    .join('\n');
}

function formatMenuBulleted(categories, showPrices) {
  if (!categories || categories.length === 0) return '(no menu items provided)';
  return categories
    .filter((c) => c && c.name && (c.items || []).some((it) => it && it.name))
    .map((cat) => {
      const items = (cat.items || []).filter((it) => it && it.name);
      const itemLines = items.map((it) => {
        const name = it.name;
        const desc = it.desc ? ` (${it.desc})` : '';
        const price = (showPrices && it.price) ? ` — ${it.price}` : '';
        return `• ${name}${desc}${price}`;
      });
      return `\n[${cat.name.toUpperCase()}]\n${itemLines.join('\n')}`;
    })
    .join('\n');
}

function resolveRatioText(ratio) {
  if (!ratio) return 'vertical 4:5';
  if (ratio.startsWith('9:16')) return 'vertical 9:16';
  if (ratio.startsWith('1:1')) return 'square 1:1';
  if (ratio.startsWith('4:5')) return 'vertical 4:5';
  if (ratio.startsWith('3:4')) return 'vertical 3:4';
  if (ratio.startsWith('2:3')) return 'vertical 2:3';
  if (ratio.startsWith('A4')) return 'vertical A4 print';
  if (ratio.startsWith('A5')) return 'vertical A5 print';
  return ratio;
}

// ═════════════════════════════════════════════════════════════════════
//   TEMPLATE 1 — CHERRYELLE (based on Design No. 1)
// ═════════════════════════════════════════════════════════════════════
function buildCherryelleProse(s) {
  const ratio = resolveRatioText(s.ratio);
  const menu = formatMenuItems(s.categories, s.showPrices !== false);
  return `Create an elegant cute luxury menu poster in ${ratio} format using the uploaded pastry photos as subtle editorial visual elements.

IMPORTANT:
This is NOT a full product catalog design.
The pastries should function as aesthetic editorial accents that enhance the branding and composition while maintaining a clean luxury layout.

BRAND NAME: ${s.brand || 'Cherryelle Patisserie'}
SUBTITLE: ${s.tagline || 'pâtisserie artisanale • baked fresh daily'}

STYLE DIRECTION:
Blend premium Parisian patisserie aesthetics with modern Korean luxury cafe branding.
The overall atmosphere should feel:
- elegant
- soft
- feminine
- expensive
- minimal
- airy
- cute but refined
- editorial and artistic

COLOR PALETTE:
- Snow White background (#FAFAF8)
- Bitter Cocoa typography (#3A2B24)
- Wine Cherry accents (${s.primaryColor || '#7c1d2e'})
- Truffle Dust shadows and textures

DESIGN STRUCTURE:
- ${ratio} poster ratio
- Large clean negative space
- Editorial luxury composition
- Thin dotted border in wine cherry color
- Soft realistic paper grain texture
- Subtle noise overlay
- Soft natural window-light shadows
- Floating paper aesthetic
- Delicate layered composition

TYPOGRAPHY:
Bakery name: elegant luxury serif or script typography, centered at the top, stylish, feminine, high-end.
Subtitle: clean modern serif, centered, italic accent.
Menu text: clean modern serif or sans-serif, bitter cocoa or wine cherry color, elegant spacing, centered composition.

MENU LAYOUT STYLE:
Each menu item should appear line-by-line with luxury spacing.
Use tiny cherry icons or minimal decorative separators between sections.

MENU CONTENT (render every item below as clearly legible typeset text):
${menu}

DECORATIVE ELEMENTS:
- tiny kawaii cherry illustrations
- subtle ribbon doodles
- tiny stars or sparkles
- translucent cherry overlays
- delicate luxury line-art details
- minimal feminine embellishments

PHOTO USAGE RULES:
Use the uploaded pastry photos ONLY as:
- close-up editorial crops
- layered corner visuals
- partial pastry compositions
- realistic pastry plates
- soft overlapping decorative placements
- airy luxury framing elements

The pastries MUST remain visible and recognizable.
Do NOT crop them too aggressively. Avoid cutting off most of the pastry body.
Place pastries mostly around corners, edges, lower sections, side framing areas — keeping the center area clean for typography.

VISUAL DETAILS:
- flaky pastry texture highly visible
- glossy fruit highlights
- airy cream texture
- soft powdered sugar details
- warm bakery lighting
- luxury editorial photography feel

BOTTOM SECTION (CONTACT):
${s.contactInfo || 'Instagram · WhatsApp · Email'}
${s.cta ? `Call-to-action: ${s.cta}` : ''}
Add elegant thin line-art contact icons arranged horizontally in a refined editorial style.

FINAL LOOK:
The final result should feel like a premium boutique bakery branding poster seen on Pinterest, luxury Korean cafe branding, or a high-end Parisian patisserie advertisement.

NEGATIVE PROMPT:
cheap design, cluttered layout, blurry image, low quality, dark exposure, harsh shadows, poor typography, pixelated, excessive decoration, oversaturated colors, distorted food, low realism, flat lighting, busy composition, watermark, marketplace flyer aesthetic, cream dominance, yellow undertone, beige background.`;
}

// ═════════════════════════════════════════════════════════════════════
//   TEMPLATE 2 — SUPERFOOD / GENERAL LUXURY EDITORIAL (Design 2)
// ═════════════════════════════════════════════════════════════════════
function buildSuperfoodProse(s) {
  const ratio = resolveRatioText(s.ratio);
  const menu = formatMenuBulleted(s.categories, s.showPrices !== false);
  return `Create an elegant premium menu design inspired by a luxury restaurant/café editorial layout in ${ratio} format.

IMPORTANT:
This is a DESIGN COMPOSITION + PHOTO PLACEMENT task.
NOT a product regeneration task.
STRICT PHOTO PRESERVATION MODE ENABLED.

Use ONLY the uploaded original product photos as the visual source.
The uploaded images may be in GRID FORMAT.

IMPORTANT:
DO NOT display the original grid.
Extract, crop, and selectively use the uploaded product photos elegantly throughout the composition.
The uploaded product photos are ONLY for visual placement and branding aesthetics.
DO NOT place one product image for every menu item.
Product photos are decorative editorial visuals only.

PRESERVE PRODUCT — 99% SIMILARITY:
DO NOT recreate, redraw, repaint, reinterpret, replace, redesign, stylize, or alter the actual product.
Preserve: original product shape, texture, color, realism, composition, natural lighting, product details, proportions, natural imperfections.
Products must remain highly realistic and nearly identical to the uploaded images.

BRAND NAME: ${s.brand || 'Superfood'}
TAGLINE: ${s.tagline || 'clean eating · powered by nature'}

DESIGN DIRECTION:
Create a premium menu inspired by:
- luxury café menu
- premium restaurant website
- editorial food catalog
- boutique food brand
- upscale modern eatery
- premium lifestyle café

The final design should feel: premium, clean, modern, minimalist, expensive, editorial, airy, elegant, sophisticated, refined.

Avoid: cheap flyer aesthetic, crowded poster look, marketplace design, overdecorated composition, promotional banner style, cluttered layout, busy marketing aesthetic.

LAYOUT STYLE — VERY IMPORTANT:
Follow a luxury editorial restaurant menu layout.
Use horizontal menu sections, alternating image placement, refined text composition, luxury whitespace, premium hierarchy, clean editorial alignment.
The layout should feel like a luxury restaurant website or premium printed café menu.
NOT poster style. NOT collage style.

MENU SECTIONS (render every item below as clearly legible typeset text):
${menu}

SECTION STRUCTURE:
- SECTION 1 — HERO: large elegant brand title, minimal premium subtitle, first category, menu list. Use one selected uploaded image as hero editorial visual.
- SECTION 2: second category, menu list. Use selected uploaded image placement as editorial visual.
- SECTION 3: third category, menu list, additional menu if needed. Use selected uploaded image elegantly as editorial visual.

PHOTO SELECTION & CROPPING:
Select only the BEST editorial photos from the uploaded images. DO NOT use all photos equally.
Recommended: hero product as dominant visual, supporting products smaller, accent product used subtly.
Maintain premium visual balance. Product images must support the layout, NOT dominate it.
Use natural editorial cropping. Keep generous whitespace.
Avoid: awkward crop, distorted food, stretched composition, oversized product placement, crowded image arrangement.

BACKGROUND — VERY IMPORTANT:
Use TRUE SNOW WHITE background.
Dominant color: #FAFAF8
Background should feel: clean, luxury, premium, airy, editorial.
Add minimalist soft shadow aesthetic, subtle window-light shadow, delicate premium depth, subtle marble texture or premium paper texture.

IMPORTANT:
DO NOT use: cream, ivory, beige, yellow undertone, sepia tone, warm brown paper.
Avoid warm cream dominance. The background must remain CLEAN SNOW WHITE.

TYPOGRAPHY:
Use premium modern typography.
- elegant serif for headings
- clean modern font for descriptions
- luxury editorial spacing
Text color: deep espresso brown (#3A2B24).
Typography should feel: premium, expensive, clean, refined, timeless.

PHOTO TREATMENT:
Product photos should feel editorial and luxurious.
Use elegant cropping, soft blending, natural composition, subtle realistic shadow.
Avoid thick frames, photo collage look, cluttered placement, oversized images, messy visual hierarchy.

ACCENT COLOR (optional):
${s.primaryColor || '#84a98c'} used subtly for category dividers and price highlight.

STORE INFORMATION:
${s.contactInfo || 'Instagram · WhatsApp · Email · Address'}
${s.cta ? `Call-to-action: ${s.cta}` : ''}
Add elegant minimal section. Design should remain subtle and premium.

FINAL MOOD:
The final result should look like a premium luxury menu from an expensive modern food brand, elegant enough to belong in a boutique café, premium restaurant, luxury deli, or high-end lifestyle brand.

NEGATIVE PROMPT:
AI-generated product look, fake textures, oversaturated colors, unrealistic food, cluttered composition, cheap flyer style, marketplace aesthetic, warm beige dominance, busy layout, excessive decoration, cartoonish details, promotional poster vibes, cream/ivory background, yellow undertone.`;
}

// ═════════════════════════════════════════════════════════════════════
//   TEMPLATE 3 — MASHISSEO (custom — Korean street food bold viral)
// ═════════════════════════════════════════════════════════════════════
function buildMashisseoProse(s) {
  const ratio = resolveRatioText(s.ratio);
  const menu = formatMenuItems(s.categories, s.showPrices !== false);
  return `Create a bold viral Korean street food menu poster in ${ratio} format using the uploaded food photos as the main hero visual elements.

IMPORTANT:
STRICT PHOTO PRESERVATION MODE ENABLED.
Preserve uploaded product photos with 99% similarity. DO NOT recreate, redraw, or alter actual food appearance.
Maintain original product shape, texture, color, realism, and natural appetizing details.

BRAND NAME: ${s.brand || 'Mashisseo 마시써'}
TAGLINE: ${s.tagline || 'korean street food · authentic taste'}

STYLE DIRECTION:
Bold viral Korean street food poster aesthetic.
Inspired by Korean food TikTok thumbnails, Mashisseo Instagram, viral Bangkok street food signage.
The overall atmosphere should feel:
- bold
- punchy
- appetite-driving
- viral social media-ready
- high contrast
- energetic
- playful
- street food chic

COLOR PALETTE:
- Cream background (${s.secondaryColor || '#fef9e7'})
- HUGE bold red headlines and accents (${s.primaryColor || '#dc2626'})
- White cards for menu items
- Korean hangul subtle decoration

DESIGN STRUCTURE:
- ${ratio} poster ratio
- HUGE bold brand wordmark at top (slightly tilted or chunky)
- Hero food photo dominating upper 40%
- Bold red price tag stickers (circular/badge style)
- Bold red borders around item cards
- Diagonal stripe accents in corners
- Korean kanji watermark element

TYPOGRAPHY:
Brand: Anton or Bebas Neue UPPERCASE Bold, chunky and loud (48-56pt equivalent).
Tagline: Inter Medium UPPERCASE, letter-spaced wide.
Category headers: Anton UPPERCASE Bold, confident.
Item names: Inter SemiBold, readable.
Prices: Bebas Neue inside RED CIRCLE TAG — like a sticker.
CTA: Anton UPPERCASE white on red banner.

MENU LAYOUT (render every item below as clearly legible typeset text):
${menu}

PHOTO USAGE:
Hero close-up shot of signature dish (tteokbokki, korean fried chicken, kimbap) dominates top.
Steam visible, vibrant colors, appetite-driving.
Shot at 30-45° angle or top-down. Bright punchy lighting with deep red sauce reflections.
Smaller items in grid below with white card backgrounds + red borders.

DECORATIVE ELEMENTS:
- Bold red circular price tags (sticker style)
- Korean hangul 마시써 as decorative element
- Bold red diagonal stripe accents in corners
- Bold red borders (2-3pt) around item cards
- Optional: chili pepper or fire emoji-style icons

BOTTOM SECTION (CONTACT):
${s.contactInfo || 'Instagram · GoFood · GrabFood'}
${s.cta ? `Call-to-action: ${s.cta}` : 'Order Now'}
Bold red CTA banner full-width across bottom.

FINAL LOOK:
The final result should feel like a viral Korean street food poster — bold, loud, appetite-driving, Pinterest-pinnable, TikTok-shareable. Like Mashisseo Instagram aesthetic with HUGE bold typography and steam-visible food close-ups.

NEGATIVE PROMPT:
refined serif typography, pastel colors, whitespace minimalism, elegant ornaments, soft photography, Parisian aesthetic, blurry, low quality, cluttered, low realism, watermark, generic stock photo, cheap design.`;
}

// ═════════════════════════════════════════════════════════════════════
//   TEMPLATE 4 — KAYU MANIS HERITAGE (based on Design No. 4)
// ═════════════════════════════════════════════════════════════════════
function buildKayuManisProse(s) {
  const ratio = resolveRatioText(s.ratio);
  const menu = formatMenuBulleted(s.categories, s.showPrices !== false);
  return `Create an elegant premium menu / pricelist design in ${ratio} format using the uploaded original product photos as the ONLY visual source.

IMPORTANT — STRICT PHOTO PRESERVATION MODE ENABLED:
Use ONLY the uploaded original photos.
DO NOT recreate, redraw, repaint, reinterpret, regenerate, replace, redesign, stylize, or alter the actual product.

Preserve with 99% visual similarity:
- original product shape
- texture
- color
- details
- realism
- proportions
- lighting authenticity
- composition
- natural imperfections

The uploaded product(s) MUST remain highly realistic and nearly identical to the original images.

BRAND NAME: ${s.brand || 'Kayu Manis'}
TAGLINE: ${s.tagline || 'warisan rasa nusantara · resep turun temurun'}

DESIGN DIRECTION:
Create a luxury premium menu / pricelist design inspired by:
- boutique luxury brands
- premium pastry houses
- five-star hotel menus
- heritage tea houses
- editorial luxury catalog
- upscale restaurant menu books

The design should feel: premium, clean, elegant, timeless, soft luxury, heritage-inspired, expensive looking, minimalist, refined, warm but modern.

Avoid: marketplace flyer aesthetic, crowded poster look, cheap promotional banner, overdecorated layout, cluttered composition, busy marketing design, loud visual hierarchy, cheap UMKM flyer style.

LAYOUT STYLE:
Create a luxury restaurant-style menu layout.
NOT poster style. NOT collage style.
The composition must feel: editorial, spacious, balanced, elegant, premium.
Use premium white space, asymmetrical arrangement, refined visual hierarchy, clean alignment, minimalist luxury composition.
Food/product images should NOT dominate the layout. Product photos must be small to medium sized only.
NOT every menu item needs a photo. Place selected featured photos elegantly throughout the design.
Allow generous breathing space between sections.

BACKGROUND — IMPORTANT:
Use TRUE SNOW WHITE background.
Dominant color: snow white (#FAFAF8).
Background must feel: airy, luxury, premium, clean, editorial.
Add minimalist soft shadow aesthetic, subtle luxury paper texture, delicate natural depth, soft window-light shadow effect.

IMPORTANT:
DO NOT use: ivory, cream, yellowish white, beige, sepia tone, vintage brown paper.
Avoid warm yellow undertone. The background should stay clean snow white.

HERITAGE ELEMENTS:
Add subtle luxury heritage atmosphere using:
- delicate ornamental linework
- refined carved details
- minimal elegant flourishes
- understated heritage accents
- premium decorative touches
Keep ornaments minimal, refined, sophisticated. Avoid excessive decorations.
The heritage feeling should be expensive, clean, subtle, luxurious.

BORDER DESIGN:
Use asymmetrical minimalist doodle border.
Style: organic elegant curves, hand-drawn luxury doodles, refined imperfect lines, subtle artistic frame.
Border color: deep brown / bitter cocoa (${s.primaryColor || '#6f4e37'}).
Avoid rigid symmetrical borders, thick frames, overpowering decorations.

TYPOGRAPHY:
Use elegant premium typography.
- luxury serif font for title
- clean modern serif for menu text
- subtle italic accent for subtitle
Typography must feel: expensive, timeless, refined, editorial.
Font color: deep brown / bitter cocoa aesthetic (#3A2B24).

Text hierarchy:
- brand name elegant and dominant
- category titles balanced
- menu/product list clean
- prices readable
- information minimal and sophisticated

MENU LIST (render every item below as clearly legible typeset text):
${menu}

PHOTO TREATMENT:
Product photos should feel naturally integrated into the layout.
Use soft rounded luxury frames, elegant curved corners, subtle heritage frame accents, delicate soft shadow.
Avoid harsh square boxes, thick borders, oversized product photos, crowded image placement.

STORE INFORMATION:
${s.contactInfo || 'Instagram · WhatsApp · Email · Address'}
${s.cta ? `Call-to-action: ${s.cta}` : ''}
Icons should feel minimal, premium, clean, luxury.

FINAL MOOD:
The final design should look like a premium luxury menu/pricelist from an expensive boutique heritage brand, elegant enough to belong in a luxury tea house, premium bakery, boutique restaurant, or five-star hotel café.

NEGATIVE PROMPT:
AI-generated look, fake texture, oversaturated colors, unrealistic products, altered shapes, cluttered composition, cheap flyer aesthetic, excessive gold, warm beige background, cartoonish details, oversized images, noisy design, promotional marketplace vibes, cream dominance, yellow undertone.`;
}

// ═════════════════════════════════════════════════════════════════════
//   TEMPLATE 5 — TAKOMI (custom — Japanese premium minimal navy)
// ═════════════════════════════════════════════════════════════════════
function buildTakomiProse(s) {
  const ratio = resolveRatioText(s.ratio);
  const menu = formatMenuItems(s.categories, s.showPrices !== false);
  return `Create an elegant premium Japanese street food menu poster in ${ratio} format using the uploaded food photos as hero editorial visual elements.

IMPORTANT — STRICT PHOTO PRESERVATION MODE ENABLED:
Preserve uploaded photos with 99% similarity.
DO NOT recreate, redraw, or alter actual food.
Preserve original product shape, texture, color, realism, and natural imperfections.

BRAND NAME: ${s.brand || 'Takomi たこ実'}
TAGLINE: ${s.tagline || 'authentic takoyaki · osaka style'}

STYLE DIRECTION:
Premium Japanese street food aesthetic — Muji-meets-izakaya.
Inspired by Tokyo street food editorial, Japanese izakaya menu boards, contemporary Japanese food photography.
The overall atmosphere should feel:
- premium
- minimal Japanese design DNA
- dark moody premium
- clean
- editorial
- expensive
- sophisticated

COLOR PALETTE:
- Dark navy background (${s.primaryColor || '#1e2a4a'}) as dominant 65%
- Cream/off-white menu cards (${s.secondaryColor || '#fef3e2'})
- Red accents (#c41e3a) for category pills and price
- Optional: kanji decorative elements

DESIGN STRUCTURE:
- ${ratio} poster ratio
- Centered cream wordmark on navy at top
- Japanese kanji たこ実 subtitle below brand
- Hero takoyaki/yakisoba photo (35% of canvas) with steam visible
- Cream menu cards stacked below with red category header pills
- Red CTA pill on navy footer

TYPOGRAPHY:
Brand: Inter Black or Noto Sans JP Bold, cream on navy.
Kanji accent: Noto Serif JP, red color — used decoratively.
Tagline: Inter Regular UPPERCASE, cream, letterspaced wide.
Category headers: Inter Bold UPPERCASE on red background pill, white text.
Item names: Inter SemiBold, navy color (on cream card).
Prices: JetBrains Mono Bold, red color.

MENU LAYOUT (render every item below as clearly legible typeset text):
${menu}

PHOTO USAGE:
Hero close-up of takoyaki on traditional wooden boat (funaori) or square plate.
Steam visible, bonito flakes dancing. Dark moody background to match navy.
Place hero photo at top 35-40% of canvas. Smaller secondary items as cream cards below (no photos needed for every item).

DECORATIVE ELEMENTS:
- Red horizontal accent lines under brand wordmark
- Japanese kanji watermark in light navy at 8% opacity in corners
- Rectangular cream menu cards with subtle drop shadow on navy
- Optional: noren-style hanging divider element

BOTTOM SECTION (CONTACT):
${s.contactInfo || 'Instagram · WhatsApp · Pre-Order Online'}
${s.cta ? `Call-to-action: ${s.cta}` : ''}
Red CTA pill on navy footer with small handle text.

FINAL LOOK:
The final result should feel like a premium Tokyo izakaya menu board — dark, premium, clean, with hero food photography and crisp Japanese typography. Muji food packaging aesthetic meets street food editorial.

NEGATIVE PROMPT:
bright pastel, Western diner aesthetic, ornate Victorian decoration, playful illustrations, grungy textures, cheap flyer, cluttered, low realism, cartoonish, blurry, oversaturated, watermark.`;
}

// ═════════════════════════════════════════════════════════════════════
//   TEMPLATE 6 — LA BELLA (based on La Bella Patisserie prompt)
// ═════════════════════════════════════════════════════════════════════
function buildLaBellaProse(s) {
  const ratio = resolveRatioText(s.ratio);
  const menu = formatMenuBulleted(s.categories, s.showPrices !== false);
  return `Create a commercial retro aesthetic product infographic menu poster for dessert and beverage products from the brand "${s.brand || 'La Bella Patisserie'}", in ${ratio} format, using the uploaded product photos as the main visual reference.

POSTER STYLE:
Retro yet modern aesthetic marketplace food catalog, premium commercial branding, retro editorial composition, organized layout, visually rich, elegant, sophisticated, and highly appetizing.

IMPORTANT — STRICT PHOTO PRESERVATION:
Preserve uploaded product photos with 99% similarity. Use them as hero product imagery throughout the design.
DO NOT recreate or alter the actual product appearance.

COLOR PALETTE:
Dominant blue and white palette with premium neutral accents.
Use soft navy blue (${s.primaryColor || '#1c3a5e'}), pastel blue, icy blue, white, cream (${s.secondaryColor || '#fff5d6'}), silver-gray, and subtle shadows to create a clean retro premium dessert café aesthetic.

VISUAL DIRECTION:
- Premium dessert and beverage photography style
- Structured catalog layout with modern marketplace aesthetic
- Organized sections for each category
- Bright, fresh, realistic lighting
- Soft highlights and clean shadows
- High-end commercial food styling
- Minimal yet elegant background
- Layered composition with floating cards, rounded panels, premium borders, and soft gradients
- Modern catalog UI elements such as labels, tags, separators, subtle icons, or category badges
- White space must feel intentional and luxurious
- Showcase freshness, creamy textures, drink transparency, rich dessert layers, and artisan quality
- Balanced composition between photography and text information

MAIN TITLE: ${s.brand || 'LA BELLA PATISSERIE'}
SUBTITLE: ${s.tagline || 'Premium Dessert & Beverage Menu'}

MENU CONTENT (render every item below as clearly legible typeset text):
${menu}

CTA SECTION:
${s.cta || 'Pemesanan hubungi WA 0812-345-6789'}
${s.contactInfo ? `Contact: ${s.contactInfo}` : ''}

LAYOUT RECOMMENDATION:
- Large hero product collage at upper section
- Elegant dessert showcase section
- Dedicated beverage section with bottle lineup (if applicable)
- Product card structure for each menu item
- Use premium spacing and alignment
- Include subtle shadows and clean layering
- Add premium marketplace-inspired labels like: "Best Seller", "Fresh Daily", "Signature Menu"
- Typography hierarchy should be clean, bold, and luxury
- Price should stand out clearly
- Create polished commercial food advertisement feel

PHOTOGRAPHY STYLE:
- Ultra realistic food photography
- Sharp texture detail
- Creamy cheesecake texture visible
- Soft lighting
- High-end café branding style
- Clean shadows
- Minimal props
- Premium packaging visibility
- Editorial commercial food styling

BACKGROUND ELEMENTS:
- Minimal blue gradient background
- Soft marble texture
- Glass reflections
- White ceramic plate accents
- Linen cloth texture
- Premium café tabletop aesthetic
- Clean marketplace layout framing

NEGATIVE PROMPT:
cheap design, cluttered layout, blurry image, low quality, dark exposure, harsh shadows, poor typography, pixelated, excessive decoration, messy catalog, oversaturated colors, distorted food, low realism, flat lighting, busy composition, watermark, duplicated objects, low-end menu design.`;
}

// ═════════════════════════════════════════════════════════════════════
//   TEMPLATE 7 — CEMILAN BUNYA (based on Cemilan Bunya prompt)
// ═════════════════════════════════════════════════════════════════════
function buildCemilanBunyaProse(s) {
  const ratio = resolveRatioText(s.ratio);
  const menu = formatMenuBulleted(s.categories, s.showPrices !== false);
  return `Create a premium commercial product infographic menu poster for dessert and baked products from the brand "${s.brand || 'Cemilan Bunya'}", in ${ratio} format. Use the uploaded food photos as the main visual reference.

DESIGN STYLE:
Premium, elegant, modern marketplace food catalog, visually rich, clean, organized, and highly appetizing.
Combine premium food photography aesthetics with structured catalog layout.
Emphasize freshness, authenticity, homemade quality, and product variety.

IMPORTANT — STRICT PHOTO PRESERVATION:
Preserve uploaded photos with 99% similarity. Use them as hero product imagery.
DO NOT recreate or alter actual food appearance.

VISUAL DIRECTION:
- Premium bakery and dessert catalog aesthetic
- Clean editorial composition with luxury marketplace feel
- Soft warm lighting, realistic shadows, crisp food texture
- Minimal but premium background in cream (${s.secondaryColor || '#fdf3e3'}), beige, warm white, soft brown, or muted pastel tones
- Organized grid layout or modular catalog sections
- Elegant spacing and hierarchy for readability
- Include decorative premium accents such as subtle lines, rounded cards, soft shadows, organic shapes, or fine texture overlays
- Make food products the hero element with sharp, realistic, mouthwatering presentation
- Maintain clean whitespace for premium appearance
- Modern typography with bold title and refined pricing layout
- Add subtle bakery-themed decorative elements (crumb textures, flour dust effect, soft linen fabric, wooden serving board, dried flowers, or minimal kitchen props)

MAIN TITLE: ${s.brand || 'CEMILAN BUNYA'}
SUBTITLE: ${s.tagline || 'Premium Dessert & Bake House Menu'}

MENU LIST SECTION (render every item below as clearly legible typeset text):
${menu}

CTA SECTION:
${s.cta || 'Pemesanan hubungi WA 0812-345-6789'}
${s.contactInfo ? `Contact: ${s.contactInfo}` : ''}

LAYOUT RECOMMENDATION:
- Large premium hero image at top
- Structured product grid or stacked product cards
- Each product displayed with elegant label and pricing
- Strong visual hierarchy between title, product images, menu list, and CTA
- Include premium badges such as "Fresh Homemade", "Best Seller", or "Daily Made" if suitable
- Ensure menu readability while maintaining aesthetic elegance
- High-end commercial food catalog presentation similar to modern bakery marketplace posters

TYPOGRAPHY:
Brand: bold elegant title (handwritten script accent allowed: Sacramento/Pacifico/Caveat).
Category headers: Roboto Slab Bold UPPERCASE, warm brown.
Item names: Inter Medium, warm brown.
Item descriptions: Caveat Italic for handwritten personal note feel.
Prices: Inter Bold with dotted leader connecting name to price.
Accent color: warm tan (${s.primaryColor || '#c89b7b'}).

PHOTOGRAPHY STYLE:
- Ultra realistic
- Premium food commercial photography
- Sharp focus
- Natural highlights
- Rich texture detail
- Soft shadow depth
- High-end bakery branding aesthetic

DECORATIVE ELEMENTS:
- Handwritten arrows pointing to favorite items
- Small hand-drawn doodles (tiny flowers, hearts, stars) sprinkled throughout
- Dotted leader lines between item name and price
- Paper grain texture overlay at 8% opacity

NEGATIVE PROMPT:
low quality, blurry, overexposed, cluttered layout, poor typography, random colors, low contrast, cheap design, messy composition, distorted food, unrealistic textures, watermark, pixelated, excessive decoration, dark lighting, unorganized catalog, flat food appearance.`;
}

// ═════════════════════════════════════════════════════════════════════
//   TEMPLATE 8 — CING ANI (custom — Indonesian bold festive red gold)
// ═════════════════════════════════════════════════════════════════════
function buildCingAniProse(s) {
  const ratio = resolveRatioText(s.ratio);
  const menu = formatMenuItems(s.categories, s.showPrices !== false);
  return `Create a bold festive traditional Indonesian restaurant menu poster in ${ratio} format using the uploaded food photos as hero visual elements.

IMPORTANT — STRICT PHOTO PRESERVATION:
Preserve uploaded photos with 99% similarity.
DO NOT recreate, redraw, or alter actual food appearance.
Maintain original product shape, texture, color, realism, appetizing details.

BRAND NAME: ${s.brand || 'Cing Ani Resto'}
TAGLINE: ${s.tagline || 'masakan betawi asli · sejak 1985'}

STYLE DIRECTION:
Bold festive traditional Indonesian restaurant aesthetic.
Like a celebratory wedding menu or Imlek dinner card.
Inspired by Cing Ani Resto signage, festive Indonesian restaurant menus, Chinese-Indonesian restaurant red-gold aesthetic, traditional Betawi restaurant branding.
The overall atmosphere should feel:
- bold
- festive
- celebratory
- traditional
- confident
- premium heritage
- appetite-driving
- richly colored

COLOR PALETTE:
- Dominant red background (${s.primaryColor || '#b91c1c'}) — 70% of canvas
- Gold accents (${s.secondaryColor || '#fde68a'}) for all typography, dividers, ornaments
- Optional cream highlights for menu item cards

DESIGN STRUCTURE:
- ${ratio} poster ratio
- Bold gold wordmark on red at top (18%)
- Small caps tagline + "Sejak [year]" gold circular badge
- Categorized sections with bold gold dividers
- Hero Indonesian dish photo prominent
- Item: name + price in 2-line layout
- Reservation phone in bold gold pill at bottom

TYPOGRAPHY:
Brand: Anton or Bebas Neue UPPERCASE Bold, gold on red (44pt equivalent).
Tagline: Inter Medium UPPERCASE Italic, cream, letter-spaced wide.
Category headers: Anton UPPERCASE, gold on red with bottom gold bar.
Item names: Inter SemiBold, cream.
Prices: Bebas Neue UPPERCASE, gold.

MENU LAYOUT (render every item below as clearly legible typeset text):
${menu}

PHOTO USAGE:
Hero Indonesian food photography on white plates with rich red sauce reflections.
Studio lighting with dramatic shadows. Festive appetite-driving compositions.
Place hero photo prominent in body section.

DECORATIVE ELEMENTS:
- Bold gold horizontal dividers (2pt) between categories
- Gold ornamental corner flourishes (festive Asian-inspired)
- "Sejak 1985" gold circular badge stamp
- Optional: subtle gold pattern overlay (small dots or geometric) at 5% opacity

BOTTOM SECTION (CONTACT):
${s.contactInfo || 'Reservasi · 021-555-1234'}
${s.cta ? `Call-to-action: ${s.cta}` : ''}
Bold gold reservation pill prominent at bottom.

FINAL LOOK:
The final result should feel like a festive Indonesian heritage restaurant menu — bold, celebratory, premium, with rich red dominance and gold accents. Like Cing Ani signage or festive Chinese-Indonesian restaurant branding.

NEGATIVE PROMPT:
pastel colors, minimalist whitespace, handwritten fonts, Western diner aesthetic, refined boutique feel, blurry, low quality, cluttered, cheap design, distorted food, watermark, oversaturated.`;
}

// ═════════════════════════════════════════════════════════════════════
//   TEMPLATE 9 — BUNYA KITCHEN (based on Design 5 — luxury snow white)
// ═════════════════════════════════════════════════════════════════════
function buildBunyaKitchenProse(s) {
  const ratio = resolveRatioText(s.ratio);
  const menu = formatMenuBulleted(s.categories, s.showPrices !== false);
  return `Create an elegant premium menu design in ${ratio} format inspired by a luxury restaurant/café editorial layout.

IMPORTANT:
This is a DESIGN COMPOSITION + PHOTO PLACEMENT task.
NOT a product regeneration task.
STRICT PHOTO PRESERVATION MODE ENABLED.

Use ONLY the uploaded original product photos as the visual source.
The uploaded images may be in GRID FORMAT.

IMPORTANT:
DO NOT display the original grid.
Extract, crop, and selectively use the uploaded product photos elegantly throughout the composition.

PRESERVE PRODUCT — 99% SIMILARITY:
DO NOT recreate, redraw, repaint, reinterpret, replace, redesign, stylize, or alter the actual product.
Preserve original product shape, texture, color, realism, composition, natural lighting, product details, proportions, natural imperfections.
Products must remain highly realistic and nearly identical to the uploaded images.

BRAND NAME: ${s.brand || 'Bunya Kitchen'}
TAGLINE: ${s.tagline || 'rice bowl · ready in 7 mins'}

DESIGN DIRECTION:
Create a premium menu inspired by luxury café menu, premium restaurant website, editorial food catalog, boutique food brand, upscale modern eatery, premium lifestyle café.

The final design should feel: premium, clean, modern, minimalist, expensive, editorial, airy, elegant, sophisticated, refined.

LAYOUT STYLE — VERY IMPORTANT:
Follow a luxury editorial restaurant menu layout.
Use horizontal editorial sections, alternating image placement, luxury whitespace, refined menu hierarchy, premium restaurant website layout, elegant text composition.
The layout should feel like a luxury restaurant website or premium printed café menu.
NOT poster style. NOT collage style.

MENU SECTIONS (render every item below as clearly legible typeset text):
${menu}

SECTION STRUCTURE:
- SECTION 1 — HERO: large elegant brand title, minimal premium subtitle, first category. Use one selected uploaded image as hero editorial visual.
- SECTION 2: second category, menu list. Use selected uploaded image placement.
- SECTION 3: third category, menu list, additional menu if needed.

PHOTO SELECTION & CROPPING:
Select only the BEST editorial photos from uploaded images. DO NOT use all photos equally.
Hero product as dominant visual, supporting products smaller, accent products used subtly.
Use natural editorial cropping. Keep generous whitespace.

BACKGROUND — VERY IMPORTANT:
Use TRUE SNOW WHITE background.
Dominant color: #FAFAF8
Background should feel clean, luxury, premium, airy, editorial.
Add minimalist soft shadow aesthetic, subtle window-light shadow, delicate premium depth.

IMPORTANT:
DO NOT use cream, ivory, beige, yellow undertone, sepia tone, warm brown paper.
Background must remain CLEAN SNOW WHITE.

TYPOGRAPHY:
Premium modern typography.
- elegant serif for headings
- clean modern font for descriptions
Text color: deep espresso brown (#3A2B24).
Optional accent: terracotta (${s.primaryColor || '#c44d35'}) for category dividers and price highlight.

PHOTO TREATMENT:
Product photos should feel editorial and luxurious.
Use elegant cropping, soft blending, natural composition, subtle realistic shadow.
Avoid thick frames, photo collage look, cluttered placement, oversized images.

STORE INFORMATION:
${s.contactInfo || 'Instagram · WhatsApp · Email · Address'}
${s.cta ? `Call-to-action: ${s.cta}` : ''}
Add elegant minimal section. Design should remain subtle and premium.

FINAL MOOD:
The final result should look like a premium luxury menu from an expensive modern food brand, elegant enough to belong in a boutique café, premium restaurant, luxury deli, or high-end lifestyle brand.

NEGATIVE PROMPT:
AI-generated product look, fake textures, oversaturated colors, unrealistic food, cluttered composition, cheap flyer style, marketplace aesthetic, warm beige dominance, busy layout, excessive decoration, cartoonish details, promotional poster vibes, cream/ivory background, yellow undertone.`;
}

// ═════════════════════════════════════════════════════════════════════
//   THEME → PROSE BUILDER LOOKUP
// ═════════════════════════════════════════════════════════════════════
export const MENU_FB_THEME_TEMPLATES = {
  'Parisian Luxury — feminine elegant':       { build: buildCherryelleProse,   source: 'Design No. 1 (Cherryelle)' },
  'Editorial Modern — clean minimal':         { build: buildSuperfoodProse,    source: 'Design No. 2 (Snow White Luxury)' },
  'Bold Viral — high contrast street food':   { build: buildMashisseoProse,    source: 'Custom — Korean street food bold viral' },
  'Indonesian Heritage Ornate — classic batik': { build: buildKayuManisProse,  source: 'Design No. 4 (Snow White Heritage Doodle)' },
  'Japanese Premium — dark navy red accents': { build: buildTakomiProse,       source: 'Custom — Japanese premium minimal' },
  'Retro Marketplace — vintage poster style': { build: buildLaBellaProse,      source: 'La Bella original prompt' },
  'Warm Artisanal — cream homemade cozy':     { build: buildCemilanBunyaProse, source: 'Cemilan Bunya original prompt' },
  'Festive Traditional — bold red gold':      { build: buildCingAniProse,      source: 'Custom — Indonesian festive' },
  'Modern Casual — earthy contemporary':      { build: buildBunyaKitchenProse, source: 'Design No. 5 (Snow White Luxury alt)' },
};

/**
 * Build the full prose prompt for a given theme + state.
 * Returns the prose string ready to send directly to image-generation API.
 */
export function buildThemePrompt(designTheme, state) {
  const tpl = MENU_FB_THEME_TEMPLATES[designTheme];
  if (!tpl) return null;
  return tpl.build(state);
}

/**
 * Get source attribution for a theme (which original user prompt it derives from).
 */
export function getThemeSource(designTheme) {
  const tpl = MENU_FB_THEME_TEMPLATES[designTheme];
  return tpl ? tpl.source : null;
}
