/**
 * Affiliate Prompt Generator - Options Library
 * Source: master affiliate prompt builder JSON structure.
 * Single source of truth untuk 5 affiliate modes.
 */

// ───────────────────────────────────────────────────────────────
// SHARED OPTIONS (dipakai > 1 mode)
// ───────────────────────────────────────────────────────────────
export const PLATFORMS = [
  'TikTok',
  'Instagram Reels',
  'Instagram Feed',
  'Instagram Story',
  'Facebook Ads',
  'Shopee Video',
  'YouTube Shorts',
  'WhatsApp Status',
  'Landing Page',
  'Marketplace Product Page',
];

export const TARGET_AUDIENCES = [
  'Gen Z female',
  'Gen Z male',
  'millennial women',
  'millennial men',
  'young professionals',
  'mothers',
  'students',
  'business owners',
  'content creators',
  'beauty enthusiast',
  'fashion lovers',
  'fitness audience',
  'luxury buyers',
  'budget-conscious buyers',
  'online shoppers',
  'affiliate marketers',
  'wanita 18-30',
  'pria 18-35',
];

export const SELLING_INTENSITIES = [
  'very soft',
  'soft selling',
  'medium / balanced',
  'strong recommendation',
  'hard selling',
  'urgent promo / flash sale',
  'FOMO selling',
  'trust building',
  'educational selling',
  'premium recommendation',
];

export const LANGUAGES = [
  'Bahasa Indonesia casual',
  'Bahasa Indonesia formal',
  'Bahasa Indonesia Gen Z',
  'Bahasa Indonesia premium',
  'English',
  'Mixed Indonesia-English',
];

export const TONES = [
  'natural', 'friendly', 'premium', 'luxury', 'funny',
  'dramatic', 'emotional', 'urgent', 'expert', 'soft selling',
  'hard selling', 'viral', 'educational', 'trustworthy',
];

export const VISUAL_STYLES = [
  'ugc raw', 'premium commercial', 'clean modern', 'luxury editorial',
  'bright fresh', 'korean aesthetic', 'minimalist', 'dark elegant',
  'bold ads', 'natural lifestyle', 'high contrast viral',
  'soft feminine', 'tech futuristic', 'organic natural',
];

// ───────────────────────────────────────────────────────────────
// 1. LOGO AFFILIATE
// ───────────────────────────────────────────────────────────────
export const LOGO_BRAND_CATEGORIES = [
  'skincare', 'beauty', 'fashion', 'coffee', 'food and beverage',
  'herbal', 'fitness', 'digital product', 'AI tools', 'property',
  'automotive', 'travel', 'education', 'finance', 'crypto',
  'gadget', 'home living', 'baby product', 'pet product',
  'luxury product', 'local UMKM brand',
];

export const LOGO_TYPES = [
  'wordmark logo', 'lettermark logo', 'monogram logo', 'icon based logo',
  'symbol logo', 'mascot logo', 'badge emblem logo', 'minimal abstract logo',
  'luxury crest logo', 'handwritten signature logo', 'retro stamp logo',
  'modern startup logo', 'organic handmade logo', 'futuristic tech logo',
];

export const LOGO_PERSONALITIES = [
  'premium', 'luxury', 'clean', 'minimalist', 'friendly', 'playful',
  'feminine', 'masculine', 'bold', 'trustworthy', 'natural', 'organic',
  'techy', 'futuristic', 'elegant', 'youthful', 'professional',
  'exclusive', 'viral', 'affordable premium',
];

export const LOGO_COLOR_PALETTES = [
  { name: 'Luxury Black Gold', colors: ['black', 'gold', 'cream'], desc: 'black + gold + cream — luxury/fashion/beauty/premium' },
  { name: 'Soft Beauty Pink', colors: ['soft pink', 'white', 'rose gold'], desc: 'soft pink + white + rose gold — skincare/makeup/beauty' },
  { name: 'Organic Natural', colors: ['sage green', 'cream', 'earth brown'], desc: 'sage green + cream + earth brown — herbal/organic/healthy' },
  { name: 'Bold Viral Red', colors: ['red', 'white', 'black'], desc: 'red + white + black — ads/promo/affiliate hard selling' },
  { name: 'Tech Blue Modern', colors: ['electric blue', 'white', 'dark navy'], desc: 'electric blue + white + dark navy — AI/software/digital' },
  { name: 'Coffee Warm', colors: ['espresso brown', 'cream', 'caramel'], desc: 'espresso brown + cream + caramel — coffee/bakery/cafe' },
  { name: 'Fresh Tropical', colors: ['turquoise', 'orange', 'white'], desc: 'turquoise + orange + white — travel/drink/summer product' },
  { name: 'Elegant Neutral', colors: ['beige', 'charcoal', 'white'], desc: 'beige + charcoal + white — premium/home/fashion' },
];

export const LOGO_TYPOGRAPHY = [
  'bold sans serif', 'luxury serif', 'modern geometric sans', 'rounded friendly font',
  'handwritten script', 'retro vintage font', 'thin elegant serif',
  'high contrast editorial serif', 'minimal uppercase typography',
  'playful bubble font', 'futuristic angular font', 'artisan handmade font',
];

export const LOGO_ICON_CONCEPTS = [
  'initial letter symbol', 'abstract brand symbol', 'product silhouette',
  'shopping bag icon', 'sparkle icon', 'leaf icon', 'crown icon', 'star icon',
  'face beauty icon', 'flame viral icon', 'cart icon', 'shield trust icon',
  'circle premium badge', 'mascot character', 'line art product icon', 'geometric shape',
];

export const LOGO_LAYOUTS = [
  'icon above brand name', 'icon beside brand name', 'centered stacked logo',
  'horizontal logo', 'circle badge logo', 'square badge logo', 'minimal icon only',
  'brand name only', 'monogram inside circle', 'crest layout', 'stamp layout', 'social profile layout',
];

export const LOGO_BACKGROUNDS = [
  'plain white background', 'transparent background', 'cream background',
  'black premium background', 'gradient background', 'paper texture background',
  'minimal shadow background', 'luxury marble background',
];

export const LOGO_USAGES = [
  'Instagram profile picture', 'TikTok profile picture', 'product packaging',
  'affiliate landing page', 'Facebook ads', 'Shopee store logo',
  'watermark content', 'website header', 'business card', 'label sticker',
];

// ───────────────────────────────────────────────────────────────
// 1b. LOGO MOCKUP — tempel logo ke merchandise / banner / office / digital / stationery
// ───────────────────────────────────────────────────────────────
export const MOCKUP_TYPES = [
  { value: 'merchandise',     label: '👕 Merch' },
  { value: 'standing_banner', label: '🚩 Banner' },
  { value: 'office_branding', label: '🏢 Office' },
  { value: 'digital_mockup',  label: '💻 Digital' },
  { value: 'stationery',      label: '📇 Stationery' },
];

// Setiap item bawa metadata default: placement, scene, + field khusus per kategori.
// Build function ambil dari sini; user bisa override scene/placement/headline/cta.
export const MOCKUP_ITEMS = {
  merchandise: [
    { value: 'premium t-shirt', placement: 'center chest', size: 'medium', material: 'soft cotton fabric', scene: 'folded shirt on a clean desk with laptop and notebook' },
    { value: 'hoodie', placement: 'small logo on left chest + large icon on the back', size: 'small front, large back', material: 'premium fleece', scene: 'model wearing the hoodie in a modern coworking space' },
    { value: 'business cap', placement: 'front embroidered', size: 'small', material: 'matte fabric embroidery', scene: 'cap displayed on a minimalist product pedestal' },
    { value: 'tote bag', placement: 'center front', size: 'large', material: 'premium canvas', scene: 'tote bag beside a laptop and coffee cup' },
    { value: 'ceramic mug', placement: 'center wrap', size: 'medium', material: 'glossy ceramic', scene: 'mug on a wooden office desk with soft morning light' },
    { value: 'sticker sheet', placement: 'centered die-cut sticker', size: 'small', material: 'glossy vinyl', scene: 'sticker sheet flatlay on a clean white surface' },
    { value: 'water tumbler', placement: 'center front', size: 'medium', material: 'matte stainless steel', scene: 'tumbler on a gym bench / desk with natural light' },
    { value: 'enamel pin', placement: 'centered', size: 'small', material: 'hard enamel metal', scene: 'pin attached to a denim jacket lapel close-up' },
  ],
  standing_banner: [
    { value: 'roll-up banner 85x200 cm', placement: 'logo at top center', layout: 'logo at top, headline in center, product/dashboard mockup below, CTA button at bottom', headline: 'Headline Utama Di Sini', subheadline: 'Satu baris subheadline pendukung.', cta: 'Coba Gratis Sekarang', style: 'corporate event booth', scene: 'standing roll-up banner placed in a modern conference booth' },
    { value: 'x-banner 60x160 cm', placement: 'logo at top center', layout: 'logo at top, big headline, key benefits list, CTA at bottom', headline: 'Headline Utama Di Sini', subheadline: 'Satu baris subheadline pendukung.', cta: 'Kunjungi Booth Kami', style: 'minimalist expo booth', scene: 'x-banner standing at a bright exhibition hall entrance' },
  ],
  office_branding: [
    { value: 'glass wall logo', placement: 'centered on transparent office glass', style: 'frosted vinyl decal', scene: 'modern startup office entrance' },
    { value: 'reception wall sign', placement: 'center wall behind the reception desk', style: '3D acrylic signage with subtle backlit glow', scene: 'premium company lobby with reception desk' },
    { value: 'meeting room signage', placement: 'beside the meeting room door', style: 'brushed metal plate', scene: 'modern office corridor' },
  ],
  digital_mockup: [
    { value: 'website header', placement: 'top-left navbar', screen: 'landing page with hero section and dashboard preview', scene: 'MacBook on a clean minimal desk' },
    { value: 'mobile app splash screen', placement: 'center of the screen', screen: 'app splash screen, clean white background with subtle brand-color gradient', scene: 'smartphone held in hand, blurred background' },
    { value: 'social media profile', placement: 'profile picture + banner header', screen: 'Instagram/LinkedIn style profile page', scene: 'laptop screen showing the brand social profile' },
    { value: 'laptop sticker', placement: 'centered on laptop lid', screen: '', scene: 'MacBook lid in a cafe, soft bokeh background' },
  ],
  stationery: [
    { value: 'business card', placement: 'front center', design: 'clean white card with subtle brand-color accent line', scene: 'premium business card pair on a textured desk' },
    { value: 'letterhead', placement: 'top-left', design: 'minimal corporate document layout', scene: 'printed letterhead paper beside a laptop and pen' },
    { value: 'employee ID card', placement: 'top center', design: 'modern company ID card layout', scene: 'ID card on a lanyard, soft studio background' },
    { value: 'envelope', placement: 'top-left + back flap seal', design: 'minimal corporate envelope', scene: 'envelope flatlay on a marble surface' },
  ],
};

// ───────────────────────────────────────────────────────────────
// 2. TRY-ON AFFILIATE
// ───────────────────────────────────────────────────────────────
export const TRYON_PRODUCT_CATEGORIES = [
  'fashion', 'hijab', 'shoes', 'bag', 'watch', 'jewelry', 'glasses', 'hat',
  'skincare', 'makeup', 'perfume', 'fitness outfit', 'baby product',
  'gadget accessory', 'home product', 'automotive accessory',
];

export const TRYON_MODES = [
  'realistic fashion try-on', 'ugc mirror selfie try-on', 'premium editorial try-on',
  'before-after try-on', 'streetwear outfit try-on', 'office outfit try-on',
  'daily casual try-on', 'luxury lifestyle try-on', 'beauty product application',
  'makeup transformation', 'skincare routine visual', 'accessory close-up try-on',
  'product in hand lifestyle shot', 'unboxing then try-on', 'comparison old vs new look',
];

export const TRYON_CHARACTER_PERSONAS = [
  'Indonesian young woman', 'Indonesian young man', 'Korean aesthetic female model',
  'premium lifestyle woman', 'office worker', 'college student', 'young mother',
  'fitness enthusiast', 'fashion influencer', 'beauty creator', 'ordinary customer',
  'Gen Z TikTok creator', 'modest fashion model', 'luxury shopper', 'casual daily user',
];

export const TRYON_BODY_SHOTS = [
  'full body shot', 'half body shot', 'medium close-up', 'close-up product detail',
  'face close-up', 'hand close-up', 'outfit detail shot', 'mirror reflection shot',
];

export const TRYON_POSES = [
  'standing front pose', 'standing 45 degree pose', 'walking pose', 'mirror selfie pose',
  'sitting on sofa', 'holding product near face', 'applying product',
  'showing before-after result', 'looking at camera', 'looking away candid',
  'turning back pose', 'one hand holding bag', 'pointing to product',
  'casual candid laugh', 'premium editorial pose',
];

export const TRYON_BACKGROUNDS = [
  'minimal studio', 'bedroom mirror', 'modern apartment', 'luxury mall',
  'coffee shop', 'city street', 'office room', 'beauty vanity table',
  'bathroom skincare setup', 'gym room', 'car interior', 'outdoor sunny street',
  'neutral beige backdrop', 'luxury hotel room', 'boutique store',
];

export const TRYON_CAMERA_ANGLES = [
  'front view', '45 degree angle', 'low angle fashion shot', 'high angle selfie',
  'close-up macro shot', 'phone camera selfie angle', 'mirror reflection angle',
  'over the shoulder shot', 'side profile', 'dynamic candid angle',
];

export const TRYON_LIGHTING = [
  'soft natural daylight', 'bright studio lighting', 'golden hour lighting',
  'premium cinematic lighting', 'bathroom mirror lighting', 'phone camera natural lighting',
  'clean beauty lighting', 'warm indoor light', 'soft shadow editorial lighting',
  'high contrast luxury light',
];

// Visual style KHUSUS try-on (sesuai JSON try_on_affiliate_prompt_builder).
// Beda dari VISUAL_STYLES generic — ini list resmi untuk mode Try-On.
export const TRYON_VISUAL_STYLES = [
  'ugc raw realistic',
  'premium commercial',
  'clean aesthetic',
  'korean lifestyle',
  'luxury editorial',
  'bright fresh',
  'minimalist',
  'bold TikTok ads style',
  'natural daily life',
  'high-end fashion campaign',
  'soft feminine',
  'dark elegant',
];

export const TRYON_SELLING_ANGLES = [
  'looks expensive but affordable', 'instant confidence boost', 'perfect for daily use',
  'premium quality detail', 'viral product feel', 'before-after transformation',
  'easy to style', 'suitable for many occasions', 'giftable product',
  'makes outfit look complete', 'simple but noticeable', 'natural result',
  'comfortable to use',
];

export const TRYON_TEXT_OVERLAYS = [
  '(kosongkan — opsional)',
  'Kelihatan mahal padahal affordable',
  'Outfit langsung naik level',
  'Simple tapi bikin look beda',
  'Before vs after pakai produk ini',
  'Produk viral yang ternyata worth it',
  'Cocok buat daily outfit',
  'Look premium dalam sekali pakai',
  'Wajib punya kalau suka tampil rapi',
];

// ───────────────────────────────────────────────────────────────
// 3. REVIEW BANNER AFFILIATE — generate BANNER IMAGE review produk.
//    (role: E-Commerce Banner Designer + Affiliate Conversion Designer)
// ───────────────────────────────────────────────────────────────
export const RVB_CATEGORIES = [
  'fashion', 'hijab', 'shoes', 'bag', 'watch', 'jewelry', 'accessories', 'glasses',
  'skincare', 'beauty', 'makeup', 'perfume', 'haircare', 'body care',
  'food and beverage', 'food', 'drink', 'coffee', 'snack', 'supplement',
  'gadget', 'electronics', 'home appliance', 'home decor', 'kitchenware',
  'baby product', 'kids product', 'pet product', 'fitness', 'sports gear',
  'automotive accessory', 'stationery', 'digital product', 'local UMKM product',
];
export const RVB_TARGET_AUDIENCES = [
  'Gen Z female', 'Gen Z male', 'millennial women', 'millennial men',
  'young professionals', 'students', 'office workers', 'parents', 'moms', 'dads',
  'premium buyers', 'budget buyers', 'luxury buyers', 'beauty lovers',
  'fashion lovers', 'fitness enthusiast', 'tech enthusiast', 'content creators',
  'homemakers', 'travelers', 'online shoppers',
];
export const RVB_PRICE_POSITIONING = [
  'cheap but valuable', 'budget friendly', 'affordable premium', 'mid-range',
  'best value', 'worth the price', 'premium', 'luxury', 'exclusive limited',
  'promo price', 'flash sale price',
];
export const RVB_MAIN_PLATFORMS = [
  'Instagram Feed', 'Instagram Story', 'TikTok Shop Affiliate', 'TikTok Feed',
  'Shopee Affiliate', 'Meta Ads', 'Facebook Ads', 'Marketplace Banner', 'WhatsApp Status',
];

// REVIEW FRAMEWORK SELECTOR — pilih SATU framework terkuat sesuai produk.
export const RVB_FRAMEWORKS = [
  { value: 'before_after_review',          label: 'Before–After',           goal: 'Tunjukkan transformasi terlihat dari kondisi masalah ke hasil lebih baik.', best: 'skincare, beauty, hair care, fitness, cleaning, home' },
  { value: 'problem_solution_review',      label: 'Problem–Solution',       goal: 'Mulai dari pain point customer, posisikan produk sebagai solusi simpel.', best: 'semua kategori' },
  { value: 'expectation_vs_reality',       label: 'Ekspektasi vs Realita',  goal: 'Bangun rasa penasaran: ekspektasi rendah vs realita yang ternyata bagus.', best: 'fashion, skincare, gadget, viral, affordable premium' },
  { value: 'pros_cons_review',             label: 'Pros & Cons',            goal: 'Buat banner terasa jujur & terpercaya lewat review seimbang (3 pros, 2 cons ringan).', best: 'gadget, fashion, skincare, home appliance, digital' },
  { value: 'rating_breakdown_review',      label: 'Rating Breakdown',       goal: 'Tunjukkan kualitas lewat skor per kategori (quality, price, design, dll).', best: 'marketplace, Shopee, TikTok Shop, beauty, gadget' },
  { value: 'feature_breakdown_review',     label: 'Feature Breakdown',      goal: 'Jelaskan kenapa produk berguna lewat highlight fitur (max 5, callout).', best: 'gadget, skincare, bag, home appliance, digital' },
  { value: 'first_impression_review',      label: 'First Impression',       goal: 'Tunjukkan reaksi & kesan pertama yang relatable (unboxing/packaging).', best: 'new product, viral, packaging, F&B' },
  { value: 'premium_vs_cheap_comparison',  label: 'Premium vs Cheap',       goal: 'Tunjukkan produk terlihat/terasa mahal tapi harga reasonable.', best: 'fashion, bag, watch, beauty, home decor' },
  { value: 'social_proof_review',          label: 'Social Proof',           goal: 'Bangun trust & FOMO lewat review count, sold count, testimonial.', best: 'viral, marketplace, TikTok Shop, Shopee' },
  { value: 'creator_quote_review',         label: 'Creator Quote',          goal: 'Buat banner terasa seperti rekomendasi personal dari creator.', best: 'semua kategori' },
];

export const RVB_HEADLINE_STYLES = [
  'curiosity hook', 'problem hook', 'benefit hook', 'price hook', 'comparison hook',
  'viral hook', 'honest review hook', 'shock hook', 'question hook', 'testimonial hook',
  'number/list hook', 'FOMO hook', 'secret hook', 'before-after hook',
];
export const RVB_HEADLINE_EXAMPLES = [
  'Aku kira biasa aja...', 'Nyesel baru coba sekarang', 'Produk murah rasa premium',
  'Worth it atau cuma hype?', 'Ini alasan banyak yang pindah', 'Sekali coba langsung cinta',
  'Kenapa baru tau sekarang?', 'Viral bukan tanpa alasan', 'Hasilnya bikin kaget',
  'Yang ini beda dari yang lain', 'Rahasia yang jarang orang tau', '7 hari langsung kelihatan',
];
export const RVB_HEADLINE_PLACEMENTS = [
  'top center', 'top left', 'top right', 'beside product',
  'bottom center', 'center overlay', 'large center headline', 'diagonal accent',
];
export const RVB_SUBHEADLINE_EXAMPLES = [
  'Bikin tampilan lebih premium tanpa harga branded',
  'Teksturnya ringan dan nyaman dipakai harian',
  'Solusi simpel buat masalah yang sering kejadian',
  'Kualitasnya terasa lebih mahal dari harganya',
  'Sekali coba langsung jadi andalan',
  'Hasilnya kelihatan tanpa ribet',
];

// Format teks review di banner (max 3 poin)
export const RVB_REVIEW_FORMATS = [
  '3 bullet points', 'short testimonial quote', 'pros and cons',
  'rating breakdown', 'mini review card', 'checklist', 'creator quote',
];
// Trust element (rating / social proof) — teks di banner
export const RVB_TRUST_OPTIONS = [
  '4.9/5 ⭐', '5.0 ⭐ (2.3k review)', '1000+ review', '10rb+ terjual',
  'Best Seller', 'Verified Review', 'Creator Favorite', 'Dipakai 30 hari',
  'Repeat order tinggi', '#1 Pilihan Pembeli',
];

export const RVB_CTA_STYLES = [
  'soft CTA', 'discount CTA', 'urgency CTA', 'curiosity CTA', 'marketplace CTA',
  'benefit CTA', 'scarcity CTA', 'free shipping CTA', 'limited stock CTA',
];
export const RVB_CTA_EXAMPLES = [
  'Cek detail produknya', 'Cobain sebelum sold out', 'Klik untuk lihat harga',
  'Checkout sebelum promo habis', 'Stok terbatas, ambil sekarang', 'Klik keranjang kuning',
  'Lihat review lengkapnya', 'Gratis ongkir hari ini',
];
export const RVB_CTA_PLACEMENTS = [
  'bottom center button', 'bottom right button', 'floating CTA sticker',
  'clean small CTA text', 'below product', 'button style',
];

export const RVB_BANNER_STYLES = [
  'premium editorial', 'clean minimalist', 'luxury product ads', 'TikTok viral style',
  'UGC aesthetic', 'Japanese clean design', 'Korean beauty ads', 'modern ecommerce',
  'bold colorful', 'dark luxury', 'soft feminine', 'cinematic ads',
  'flat lay aesthetic', '3D render style', 'gradient modern', 'magazine cover style',
];
export const RVB_LAYOUT_TYPES = [
  { value: 'Hero Product Layout',    label: 'Hero Product — produk besar di tengah, teks mengelilingi' },
  { value: 'Creator Review Layout',  label: 'Creator Review — orang pegang produk + bubble review' },
  { value: 'Magazine Review Layout', label: 'Magazine Review — editorial premium, tipografi besar' },
  { value: 'Comparison Layout',      label: 'Comparison — masalah lama vs solusi baru' },
  { value: 'Feature Callout Layout', label: 'Feature Callout — panah ke benefit produk' },
  { value: 'Marketplace Review Layout', label: 'Marketplace Review — produk + rating + review count + badge + CTA' },
  { value: 'Split Screen Layout',    label: 'Split Screen — 2 sisi (produk vs teks/before-after)' },
  { value: 'Spotlight Layout',       label: 'Spotlight — produk disorot dengan latar gelap/glow' },
  { value: 'Grid Collage Layout',    label: 'Grid Collage — beberapa foto/angle produk' },
];
export const RVB_PRODUCT_POSITIONS = [
  'center hero', 'right side large', 'left side large', 'floating product',
  'hand holding product', 'product with packaging', 'top center', 'bottom center',
  'tilted angle', 'flat lay top-down', 'multiple angles',
];
export const RVB_CHARACTER_TYPES = [
  'beauty influencer', 'fashion creator', 'premium lifestyle woman', 'Gen Z creator',
  'young professional', 'daily user', 'expert reviewer', 'parent reviewer',
  'male model', 'fitness model', 'skincare expert',
];
export const RVB_CHARACTER_POSES = [
  'holding product', 'using product', 'pointing at review card', 'smiling with product',
  'showing first impression', 'before after reaction', 'happy reaction',
  'thumbs up', 'applying product', 'looking at product',
];
export const RVB_CHARACTER_FRAMINGS = [
  'close-up', 'half body', 'upper body', 'hands only', 'lifestyle scene',
];
export const RVB_HUMAN_POSITIONS = [
  'right side', 'left side', 'center', 'behind product', 'beside product',
];
export const RVB_BACKGROUNDS = [
  'premium studio', 'minimal studio white', 'clean gradient', 'luxury room',
  'bedroom lifestyle', 'bathroom aesthetic', 'vanity table', 'desk setup',
  'kitchen lifestyle', 'marble surface', 'wooden table', 'cafe interior',
  'outdoor natural light', 'product environment', 'marketplace clean background',
  'solid color block', 'neon gradient',
];
export const RVB_LIGHTING = [
  'soft commercial lighting', 'clean beauty lighting', 'premium cinematic lighting',
  'natural daylight', 'bright e-commerce lighting', 'luxury soft shadow',
  'warm golden lighting', 'high-key bright',
];
export const RVB_HEADLINE_FONTS = [
  'bold modern sans serif', 'luxury serif', 'playful rounded', 'clean minimal',
  'editorial bold', 'marketplace bold', 'elegant script', 'condensed bold', 'handwritten',
];
// colors: [] artinya ngikut warna brand produk
export const RVB_COLOR_PALETTES = [
  { name: 'Luxury Black Gold',            colors: ['black', 'gold', 'cream'] },
  { name: 'Clean White Beige',            colors: ['white', 'beige', 'soft grey'] },
  { name: 'Soft Pastel',                  colors: ['pastel pink', 'baby blue', 'cream'] },
  { name: 'Premium Neutral',              colors: ['greige', 'charcoal', 'white'] },
  { name: 'Bright Ecommerce',             colors: ['red', 'yellow', 'white'] },
  { name: 'Rose Gold Elegant',            colors: ['rose gold', 'blush pink', 'white'] },
  { name: 'Fresh Green Natural',          colors: ['sage green', 'cream', 'white'] },
  { name: 'Ocean Blue Modern',            colors: ['ocean blue', 'white', 'navy'] },
  { name: 'Earthy Warm',                  colors: ['terracotta', 'cream', 'brown'] },
  { name: 'Bold Red White',               colors: ['red', 'white', 'black'] },
  { name: 'Monochrome',                   colors: ['black', 'white', 'grey'] },
  { name: 'Vibrant Gradient',             colors: ['purple', 'pink', 'orange'] },
  { name: 'Brand Color Matching Product', colors: [] },
];
// Badge konversi (max 2) — opsional
export const RVB_BADGES = [
  'Best Seller', 'Worth It', 'Hidden Gem', '4.9/5', 'Creator Pick',
  'Affordable Premium', 'Review Jujur', 'Viral Product', 'Limited Promo',
];
export const RVB_IMAGE_RATIOS = [
  { value: '4:5',    label: '4:5 — portrait Instagram Feed' },
  { value: '1:1',    label: '1:1 — square marketplace' },
  { value: '9:16',   label: '9:16 — story / reels / TikTok ads' },
  { value: '16:9',   label: '16:9 — website banner / landscape' },
  { value: '3:4',    label: '3:4 — portrait' },
  { value: '2:3',    label: '2:3 — Pinterest / poster' },
  { value: '1.91:1', label: '1.91:1 — Meta feed ads' },
  { value: '4:3',    label: '4:3 — classic' },
];

// ───────────────────────────────────────────────────────────────
// 3b. REVIEW AFFILIATE (legacy script builder — tidak dipakai mode aktif)
// ───────────────────────────────────────────────────────────────
export const REVIEW_TYPES = [
  'honest review', 'hard selling review', 'soft selling review', 'comparison review',
  'before-after review', 'problem-solution review', 'first impression review',
  'one week usage review', 'unboxing review', 'viral TikTok review',
  'expert style review', 'ordinary customer review', 'premium recommendation',
  'budget product review', 'hidden gem review', 'regret not buying sooner review',
];

export const REVIEW_HOOK_STYLES = [
  'curiosity hook', 'problem hook', 'shock hook', 'regret hook', 'comparison hook',
  'price hook', 'viral hook', 'testimonial hook', 'challenge hook',
  'myth-busting hook', 'honest confession hook', 'before-after hook',
];

export const REVIEW_HOOKS = [
  'Awalnya aku kira produk ini biasa aja, ternyata...',
  'Aku nyesel baru tahu produk ini sekarang.',
  'Kalau kamu punya masalah ini, coba lihat dulu.',
  'Jangan checkout sebelum lihat review jujur ini.',
  'Produk ini murah, tapi hasilnya nggak murahan.',
  'Aku pikir ini cuma viral doang, ternyata kepake banget.',
  'Ini salah satu produk yang menurutku paling worth it.',
  'Satu produk kecil yang ternyata ngaruh banget.',
  'Aku coba selama beberapa hari, dan ini hasilnya.',
  'Kalau kamu sering ngalamin ini, produk ini bisa jadi solusi.',
  'Produk ini bikin rutinitasku jauh lebih praktis.',
  'Aku biasanya skeptis, tapi yang ini beda.',
];

export const REVIEW_STRUCTURES = [
  'short_review_15s',
  'medium_review_30s',
  'long_review_60s',
  'carousel_review',
  'caption_review',
];

export const REVIEW_PAIN_POINTS = [
  'produk lama kurang efektif', 'hasil tidak kelihatan', 'harga mahal tapi kualitas biasa',
  'ribet dipakai', 'butuh solusi cepat', 'bingung pilih produk',
  'takut produk tidak cocok', 'kurang percaya diri', 'aktivitas jadi tidak praktis',
  'butuh produk yang lebih simple', 'produk cepat habis', 'kualitas tidak sesuai ekspektasi',
];

export const REVIEW_BENEFITS = [
  'hemat waktu', 'lebih praktis', 'hasil lebih cepat terlihat', 'lebih nyaman dipakai',
  'tampilan jadi lebih premium', 'bikin percaya diri', 'harga lebih worth it',
  'mudah digunakan pemula', 'cocok untuk daily use', 'kualitas terasa lebih bagus',
  'desain lebih estetik', 'lebih tahan lama', 'multifungsi', 'cocok untuk hadiah',
  'mudah dibawa', 'solusi masalah harian',
];

export const REVIEW_PROOF_TYPES = [
  'before-after visual', 'close-up product detail', 'usage demo', 'texture shot',
  'side-by-side comparison', 'daily use clip', 'unboxing proof',
  'customer testimonial style', 'rating screenshot style', 'real result after use',
  'try-on result', 'problem solved visual',
];

// Selling intensity KHUSUS review (sesuai JSON product_review_affiliate_prompt_builder).
// Beda dari SELLING_INTENSITIES generic (yang dipakai UGC).
export const REVIEW_SELLING_INTENSITIES = [
  'soft selling',
  'balanced persuasive',
  'hard selling',
  'urgent promo',
  'trust building',
  'educational selling',
  'emotional selling',
  'premium selling',
  'viral FOMO selling',
];

export const REVIEW_PRICE_POSITIONS = [
  'super affordable', 'budget friendly', 'worth the price',
  'premium but still reasonable', 'luxury product', 'promo limited',
  'best value', 'cheaper alternative', 'expensive but worth it',
];

export const REVIEW_CAPTION_STYLES = [
  'short punchy caption', 'storytelling caption', 'hard selling caption',
  'soft selling caption', 'bullet point caption', 'emoji-friendly caption',
  'premium clean caption', 'TikTok casual caption', 'Facebook Ads caption',
];

export const CTAS = [
  'Cek keranjang kuning sekarang', 'Klik link di bio', 'Checkout sebelum promo habis',
  'Jangan tunggu stok habis', 'Aku taruh link produknya di bio',
  'Cobain sendiri biar tahu bedanya',
  'Kalau masih ada promo, mending ambil sekarang',
  'DM untuk order', 'Klik tombol beli sekarang', 'Simpan dulu kalau belum mau checkout',
];

// ───────────────────────────────────────────────────────────────
// 4. STORYBOARD AFFILIATE v2 — form → prompt yang nyuruh ChatGPT bikin
//    storyboard otomatis (sesuai JSON Storyboard Prompt Generator).
// ───────────────────────────────────────────────────────────────
export const SB_CATEGORIES = [
  'fashion', 'skincare', 'beauty', 'gadget', 'gaming', 'food and beverage',
  'home living', 'digital product', 'course', 'service', 'health product',
  'baby product', 'sports', 'other',
];
export const SB_TARGET_AUDIENCES = [
  'Gen Z female', 'Gen Z male', 'millennial women', 'millennial men',
  'young professionals', 'students', 'office workers', 'beauty lovers',
  'fashion lovers', 'tech users', 'gamers', 'coffee lovers', 'general audience',
];
export const SB_PLATFORMS = [
  'TikTok', 'Instagram Reels', 'YouTube Shorts', 'TikTok Shop', 'Shopee Video', 'Facebook Ads',
];
export const SB_DURATIONS = [
  { value: '10', label: '10 detik' }, { value: '15', label: '15 detik' },
  { value: '20', label: '20 detik' }, { value: '30', label: '30 detik' },
  { value: '45', label: '45 detik' }, { value: '60', label: '60 detik' },
];
export const SB_TYPES = [
  'UGC Review', 'Product Demo', 'Problem Solution', 'Before After', 'Try On',
  'Hidden Gem Review', 'Pros and Cons', 'Comparison', 'Routine Video', 'Unboxing',
  'Hard Selling Promo', 'Soft Selling Recommendation',
];
export const SB_HOOK_STYLES = [
  'curiosity hook', 'problem hook', 'price hook', 'FOMO hook', 'honest review hook',
  'before after hook', 'mistake hook', 'hidden gem hook', 'result hook', 'confession hook',
];
export const SB_SELLING_INTENSITY = ['soft selling', 'medium selling', 'hard selling'];
export const SB_VISUAL_STYLES = [
  'UGC native', 'premium editorial', 'clean aesthetic', 'modern ecommerce',
  'cinematic lifestyle', 'Korean beauty ads', 'luxury product ads', 'TikTok raw style',
  'minimal studio', 'high-energy commercial',
];
export const SB_CREATOR_PERSONAS = [
  'daily user', 'beauty creator', 'fashion creator', 'tech reviewer',
  'premium lifestyle creator', 'mom creator', 'student creator', 'office worker',
  'fitness creator', 'coffee lover', 'gamer', 'expert reviewer',
];
export const SB_LANGUAGE_STYLES = [
  'Indonesian casual persuasive', 'Indonesian premium clean', 'Indonesian Gen Z casual',
  'Indonesian hard selling', 'English casual', 'English premium',
];
export const SB_CTAS = [
  'Cek detail produknya', 'Klik keranjang kuning', 'Klik link di bio',
  'Cobain sendiri biar tahu bedanya', 'Cek promo hari ini', 'Simpan dulu sebelum lupa',
  'Lihat detailnya sekarang', 'Pesan sekarang', 'Order sekarang',
];

// ───────────────────────────────────────────────────────────────
// 4b. STORYBOARD (legacy production-doc builder — tidak dipakai mode aktif)
// ───────────────────────────────────────────────────────────────
export const STORYBOARD_DURATIONS = [
  '6 seconds', '10 seconds', '15 seconds', '20 seconds',
  '30 seconds', '45 seconds', '60 seconds', '90 seconds',
];

export const STORYBOARD_CAMPAIGN_GOALS = [
  'awareness', 'conversion', 'retargeting', 'educational selling',
  'trust building', 'viral engagement', 'promo launch', 'flash sale',
  'product explanation', 'brand introduction',
];

export const STORYBOARD_TYPES = [
  'problem-solution', 'before-after transformation', 'day in the life',
  'unboxing to result', 'testimonial journey', 'comparison story',
  'mini drama', 'educational selling', 'viral trend adaptation',
  'POV content', 'mistake-to-solution', 'myth vs fact', '3 reasons why',
  'things I wish I knew', 'routine upgrade', 'premium lifestyle story',
];

export const STORYBOARD_SCENE_COUNTS = ['3', '4', '5', '6', '7', '8', '9', '10'];

export const STORYBOARD_OPENING_SCENES = [
  'show painful problem immediately', 'show final result first',
  'creator shocked by result', 'before-after split screen',
  'POV target audience', 'question hook on screen', 'fast product close-up',
  'dramatic wrong product comparison', 'text overlay only with strong hook',
  'creator talking directly to camera',
];

export const STORYBOARD_VISUAL_DIRECTIONS = [
  'close-up face expression', 'product close-up', 'hand holding product',
  'mirror selfie', 'unboxing shot', 'before-after split screen',
  'lifestyle use scene', 'desk setup scene', 'bathroom routine scene',
  'outdoor casual scene', 'premium flatlay', 'fast montage',
  'slow cinematic movement', 'screen recording', 'creator pointing to text', 'reaction shot',
];

export const STORYBOARD_CAMERA_MOVEMENTS = [
  'static shot', 'handheld phone movement', 'slow zoom in', 'quick zoom cut',
  'pan left to right', 'top-down shot', 'close-up macro movement',
  'mirror selfie movement', 'walk and talk vlog style', 'fast jump cuts',
  'cinematic push-in', 'product spin shot',
];

export const STORYBOARD_VOICE_OVER_STYLES = [
  'casual talking', 'excited creator voice', 'honest review voice',
  'dramatic storytelling', 'soft premium narration', 'fast TikTok style',
  'educational explanation', 'friendly recommendation', 'hard selling promo voice',
  'calm aesthetic voice',
];

export const STORYBOARD_EMOTION_FLOWS = [
  'frustrated → curious → surprised → happy',
  'skeptical → trying → impressed → recommending',
  'confused → discovering → testing → satisfied',
  'problem aware → hopeful → confident → urgent to buy',
  'bored → excited → amazed → converted',
];

export const STORYBOARD_CTA_SCENES = [
  'creator pointing to keranjang kuning', 'product close-up with CTA text',
  'before-after final with CTA', 'promo price appears on screen',
  'link in bio visual', 'limited stock text', 'checkout button animation',
  'creator says recommendation directly', 'screenshot style promo ending',
];

// ───────────────────────────────────────────────────────────────
// 5. UGC AFFILIATE
// ───────────────────────────────────────────────────────────────
export const UGC_STYLES = [
  'raw phone camera review', 'mirror selfie review', 'talking head review',
  'day in my life', 'unboxing casual', 'before-after proof', 'story time',
  'POV problem solution', 'testimonial natural', 'viral TikTok style',
  'get ready with me', 'desk setup recommendation', 'morning routine',
  'night routine', 'mini vlog', 'first impression', 'one week update',
  'things I bought and loved', 'Amazon/Shopee finds style', 'hidden gem product',
];

export const UGC_CREATOR_PERSONAS = [
  'Gen Z female casual creator', 'Gen Z male casual creator', 'millennial woman',
  'young mother', 'office worker', 'college student', 'beauty enthusiast',
  'fashion creator', 'gadget reviewer', 'fitness lifestyle creator',
  'home living creator', 'UMKM owner', 'ordinary customer',
  'premium lifestyle creator', 'budget shopping creator', 'skincare beginner',
  'busy worker', 'newly married woman', 'travel creator', 'food reviewer',
];

export const UGC_ENERGIES = [
  'calm and honest', 'excited and expressive', 'soft spoken',
  'funny and relatable', 'serious expert', 'premium elegant',
  'chaotic TikTok style', 'friendly big sister', 'confident seller',
  'skeptical then impressed',
];

export const UGC_HOOKS = [
  'Aku nyesel baru tahu produk ini sekarang.',
  'Jujur aku kira ini bakal biasa aja.',
  'Kalau kamu sering ngalamin ini, coba lihat dulu.',
  'POV: kamu nemu produk yang ternyata kepake banget.',
  'Ini bukan produk yang aku expect bakal sebagus ini.',
  'Aku biasanya nggak gampang percaya produk viral, tapi ini beda.',
  'Satu barang kecil yang ternyata bikin hidup lebih praktis.',
  'Aku beli ini iseng, sekarang malah kepake tiap hari.',
  'Kalau kamu mau hasil yang kelihatan lebih rapi, ini bisa dicoba.',
  'Aku coba sendiri, dan ternyata worth it.',
  'Produk ini murah, tapi feel-nya nggak murahan.',
  'Ini solusi simple buat masalah yang sering banget kejadian.',
];

export const UGC_DURATIONS = ['15_seconds', '30_seconds', '45_seconds', '60_seconds'];

export const UGC_CAMERA_STYLES = [
  'front camera selfie', 'handheld phone camera', 'mirror selfie',
  'bedroom casual setup', 'bathroom mirror setup', 'desk setup',
  'kitchen counter setup', 'car selfie', 'walking vlog',
  'store/mall casual shot', 'top-down product shot', 'close-up hand demo',
  'ugc messy room but natural', 'clean aesthetic room', 'window natural light',
];

export const UGC_LOCATIONS = [
  'bedroom', 'bathroom', 'living room', 'office desk', 'car', 'coffee shop',
  'gym', 'kitchen', 'mall', 'campus', 'outdoor street', 'home studio',
  'vanity table', 'closet room',
];

export const UGC_PRODUCT_DEMOS = [
  'unboxing product', 'holding product close to camera', 'applying product',
  'wearing product', 'showing product texture', 'showing product detail',
  'before-after demo', 'comparing old vs new', 'using product in daily activity',
  'showing result after use', 'pointing to product benefit', 'showing package and price',
];

export const UGC_EMOTIONS = [
  'surprised', 'relieved', 'happy', 'confident', 'curious', 'excited',
  'honest', 'skeptical then impressed', 'calm but convinced',
  'funny and relatable', 'slightly dramatic', 'premium satisfied',
];

export const UGC_TEXT_OVERLAYS = [
  '(kosongkan — opsional)',
  'Aku kira biasa aja...',
  'Ternyata sebagus ini',
  'Worth it banget',
  'Produk yang kepake tiap hari',
  'Before vs after',
  'Simple tapi ngaruh',
  'Jangan checkout sebelum lihat ini',
  'Cek keranjang kuning',
  'Promo masih ada',
  'Beli sebelum viral',
];

export const UGC_LANGUAGE_STYLES = [
  'casual Indonesian', 'Jakarta casual style', 'soft feminine Indonesian',
  'Gen Z slang light', 'premium clean Indonesian', 'friendly big sister tone',
  'honest customer tone', 'direct selling tone', 'storytelling tone',
  'short punchy tone',
];
