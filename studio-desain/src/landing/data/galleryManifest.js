const pad = (n) => String(n).padStart(2, '0');
const seq = (n, fn) => Array.from({ length: n }, (_, i) => fn(i + 1));

export const HERO_MOCKUP = '/landing/hero/mockup-main.jpg';

export const ADS_1x1 = seq(20, (i) => ({
  src: `/landing/ads-1x1/ig-${pad(i)}.jpg`,
  alt: `Design grafis 1:1 #${i}`,
  ratio: '1/1',
  variant: i,
}));

export const ADS_9x16 = seq(20, (i) => ({
  src: `/landing/ads-9x16/vert-${pad(i)}.jpg`,
  alt: `Story / Reels / Shorts 9:16 #${i}`,
  ratio: '9/16',
  variant: i + 20,
}));

export const ADS_16x9 = seq(20, (i) => ({
  src: `/landing/ads-16x9/yt-${pad(i)}.jpg`,
  alt: `YouTube thumbnail 16:9 #${i}`,
  ratio: '16/9',
  variant: i + 40,
}));

export const ADS_TYPO = seq(20, (i) => ({
  src: `/landing/ads-typography/typo-${pad(i)}.jpg`,
  alt: `Typography ad #${i}`,
  ratio: '4/5',
  variant: i + 60,
}));

// 20 kategori marketplace style — 4:5 portrait, beda style/palette per kategori
const CATEGORY_LABELS = [
  'Elektronik', 'Komputer & Aksesoris', 'Handphone & Aksesoris', 'Pakaian Pria',
  'Sepatu Pria', 'Tas Pria', 'Aksesoris Fashion', 'Jam Tangan',
  'Properti', 'Hobi & Koleksi', 'Makanan & Minuman', 'Perawatan & Kecantikan',
  'Perlengkapan Rumah', 'Pakaian Wanita', 'Fashion Muslim', 'Fashion Bayi & Anak',
  'Ibu & Bayi', 'Sepatu Wanita', 'Tas Wanita', 'Otomotif',
];
export const ADS_CATEGORIES = CATEGORY_LABELS.map((label, idx) => ({
  src: `/landing/ads-categories/cat-${pad(idx + 1)}.jpg`,
  alt: `Kategori ${label}`,
  ratio: '4/5',
  variant: idx + 80,
}));

export const TESTI_AVATARS = seq(8, (i) => `/landing/testimonials/avatars/user-${pad(i)}.jpg`);

export const MODE_PREVIEWS = {
  banner:     '/landing/modes/banner-preview.jpg',
  thumbnail:  '/landing/modes/thumbnail-preview.jpg',
  typography: '/landing/modes/typography-preview.jpg',
  copy:       '/landing/modes/copy-preview.jpg',
};

export const FACE_CARD_PREVIEWS = {
  faceFeatures: '/landing/face-card/face-features.jpg',
  spectacles:   '/landing/face-card/spectacles-guide.jpg',
  style:        '/landing/face-card/style-analysis.jpg',
  color:        '/landing/face-card/color-analysis.jpg',
  makeup:       '/landing/face-card/makeup-analysis.jpg',
};

// Menu F&B template previews — 9 demos generated via fal.ai gpt-image-2
// matching user-provided reference designs (Cherryelle, Superfood, etc).
export const MENU_FB_PREVIEWS = {
  cherryelle:    '/landing/menu-fb/patisserie-luxury.jpg',
  superfood:     '/landing/menu-fb/healthy-editorial.jpg',
  mashisseo:     '/landing/menu-fb/korean-street.jpg',
  kayuManis:     '/landing/menu-fb/indo-heritage.jpg',
  takomi:        '/landing/menu-fb/japanese-premium.jpg',
  laBella:       '/landing/menu-fb/retro-marketplace.jpg',
  cemilanBunya:  '/landing/menu-fb/homemade-cozy.jpg',
  cingAni:       '/landing/menu-fb/betawi-festive.jpg',
  bunyaKitchen:  '/landing/menu-fb/rice-bowl-modern.jpg',
};

export const BRAND_LOGO    = '/landing/brand/logo.png';
