const pad = (n) => String(n).padStart(2, '0');
const seq = (n, fn) => Array.from({ length: n }, (_, i) => fn(i + 1));

export const HERO_MOCKUP = '/studio-desain/landing/hero/mockup-main.jpg';

export const ADS_1x1 = seq(20, (i) => ({
  src: `/studio-desain/landing/ads-1x1/ig-${pad(i)}.jpg`,
  alt: `Design grafis 1:1 #${i}`,
  ratio: '1/1',
  variant: i,
}));

export const ADS_9x16 = seq(20, (i) => ({
  src: `/studio-desain/landing/ads-9x16/vert-${pad(i)}.jpg`,
  alt: `Story / Reels / Shorts 9:16 #${i}`,
  ratio: '9/16',
  variant: i + 20,
}));

export const ADS_16x9 = seq(20, (i) => ({
  src: `/studio-desain/landing/ads-16x9/yt-${pad(i)}.jpg`,
  alt: `YouTube thumbnail 16:9 #${i}`,
  ratio: '16/9',
  variant: i + 40,
}));

export const ADS_TYPO = seq(20, (i) => ({
  src: `/studio-desain/landing/ads-typography/typo-${pad(i)}.jpg`,
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
  src: `/studio-desain/landing/ads-categories/cat-${pad(idx + 1)}.jpg`,
  alt: `Kategori ${label}`,
  ratio: '4/5',
  variant: idx + 80,
}));

export const TESTI_AVATARS = seq(8, (i) => `/studio-desain/landing/testimonials/avatars/user-${pad(i)}.jpg`);

export const MODE_PREVIEWS = {
  banner:     '/studio-desain/landing/modes/banner-preview.jpg',
  thumbnail:  '/studio-desain/landing/modes/thumbnail-preview.jpg',
  typography: '/studio-desain/landing/modes/typography-preview.jpg',
  copy:       '/studio-desain/landing/modes/copy-preview.jpg',
};

export const FACE_CARD_PREVIEWS = {
  faceFeatures: '/studio-desain/landing/face-card/face-features.jpg',
  spectacles:   '/studio-desain/landing/face-card/spectacles-guide.jpg',
  style:        '/studio-desain/landing/face-card/style-analysis.jpg',
  color:        '/studio-desain/landing/face-card/color-analysis.jpg',
  makeup:       '/studio-desain/landing/face-card/makeup-analysis.jpg',
};

// Menu F&B template previews — 9 demos generated via fal.ai gpt-image-2
// matching user-provided reference designs (Cherryelle, Superfood, etc).
export const MENU_FB_PREVIEWS = {
  cherryelle:    '/studio-desain/landing/menu-fb/patisserie-luxury.jpg',
  superfood:     '/studio-desain/landing/menu-fb/healthy-editorial.jpg',
  mashisseo:     '/studio-desain/landing/menu-fb/korean-street.jpg',
  kayuManis:     '/studio-desain/landing/menu-fb/indo-heritage.jpg',
  takomi:        '/studio-desain/landing/menu-fb/japanese-premium.jpg',
  laBella:       '/studio-desain/landing/menu-fb/retro-marketplace.jpg',
  cemilanBunya:  '/studio-desain/landing/menu-fb/homemade-cozy.jpg',
  cingAni:       '/studio-desain/landing/menu-fb/betawi-festive.jpg',
  bunyaKitchen:  '/studio-desain/landing/menu-fb/rice-bowl-modern.jpg',
};

export const BRAND_LOGO    = '/studio-desain/landing/brand/logo.png';
