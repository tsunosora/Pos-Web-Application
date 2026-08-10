/**
 * Spesifikasi field per-mode untuk fitur "AI Isi Otomatis".
 *
 * Dikirim ke backend (/studio-ai/fill) agar AI mengisi tiap field, lalu dipakai
 * untuk memvalidasi/mengoersi jawaban ke opsi valid sebelum di-dispatch ke state.
 *
 * type: 'text' | 'enum' | 'array' | (color/boolean/number dibiarkan default — tak diisi AI)
 * core: true = konten inti (headline, nama produk, dst) yang paling penting.
 * options: untuk enum, daftar nilai PERSIS yang tersimpan di state (bukan label UI).
 *
 * CATATAN: nilai enum sengaja di-inline (bukan import) agar file ini self-contained
 * dan tak rapuh terhadap perubahan nama export di *Options.js. Kalau opsi mode
 * berubah signifikan, samakan daftar di sini.
 */

export const AI_MODES = {
  fotoproduk: {
    label: 'Foto Produk',
    fields: [
      { key: 'productName', type: 'text', core: true, hint: 'nama produk' },
      { key: 'brand', type: 'text', hint: 'nama brand (boleh kosong)' },
      { key: 'description', type: 'text', core: true, hint: 'deskripsi visual produk singkat' },
      { key: 'kategori', type: 'enum', options: [
        'Skincare / Beauty', 'Fashion / Apparel', 'Makanan (F&B)', 'Minuman',
        'Elektronik / Gadget', 'Perhiasan / Aksesoris', 'Furnitur / Home Living', 'Produk Lainnya',
      ] },
      { key: 'gaya', type: 'enum', options: [
        'Clean studio product shot, seamless background',
        'Lifestyle in-context shot, real-world setting',
        'Top-down flat lay arrangement',
        'Dramatic hero shot, single product spotlight',
        'Floating / levitation product shot',
        'Dynamic splash / motion shot',
        'Macro close-up detail shot',
      ] },
      { key: 'background', type: 'enum', options: [
        'pure clean white studio background', 'soft neutral gray gradient background',
        'elegant marble surface', 'warm natural wood surface', 'raw concrete / stone surface',
        'soft draped fabric / textile backdrop', 'solid vibrant color studio backdrop',
        'natural outdoor / greenery setting', 'cozy lifestyle interior scene',
      ] },
      { key: 'sudut', type: 'enum', options: [
        'straight-on eye-level front angle', 'three-quarter 45-degree angle', 'side profile angle',
        'top-down flat lay angle', 'low dramatic hero angle', 'extreme macro close-up angle',
      ] },
      { key: 'pencahayaan', type: 'enum', options: [
        'soft diffused softbox lighting', 'natural window daylight', 'professional 3-point studio lighting',
        'dramatic rim / edge lighting', 'hard directional high-contrast light', 'warm golden-hour lighting',
      ] },
      { key: 'props', type: 'enum', options: [
        'no props, product only, clean isolation', 'subtle complementary props',
        'rich lifestyle context props', 'luxury premium styling props',
        'natural / eco elements (leaves, stone, water)', 'raw ingredients around the product',
      ] },
      { key: 'mood', type: 'enum', options: [
        'premium luxurious feel', 'clean minimalist feel', 'warm cozy feel',
        'fresh natural feel', 'bold vibrant energetic feel', 'elegant sophisticated feel',
      ] },
    ],
  },

  banner: {
    label: 'Design Feeds',
    fields: [
      { key: 'brand', type: 'text', core: true, hint: 'nama brand' },
      { key: 'headline', type: 'text', core: true, hint: 'headline utama, kuat & pendek' },
      { key: 'tagline', type: 'text', core: true, hint: 'sub-headline/tagline' },
      { key: 'description', type: 'text', core: true, hint: 'deskripsi singkat produk' },
      { key: 'cta', type: 'text', core: true, hint: 'teks tombol call-to-action' },
      { key: 'features', type: 'array', core: true, hint: '3-5 keunggulan singkat' },
      { key: 'style', type: 'enum', options: [
        'Futuristic Tech', 'Minimal Clean', 'Luxury Premium', 'Dark Neon',
        'Corporate Professional', 'Bright & Fresh', 'Warm & Cozy',
      ] },
      { key: 'lighting', type: 'enum', options: [
        'Soft Lighting', 'Neon Glow', 'Dramatic Shadow', 'Studio Light', 'Natural Sunlight',
      ] },
      { key: 'ratio', type: 'enum', options: [
        '16:9 (Landing Page / Web Banner)', '1:1 (Instagram Feed)', '4:5 (Portrait Feed)',
        '9:16 (Story / Reels / TikTok)', '21:9 (Ultrawide Hero)',
      ] },
    ],
  },

  carousel: {
    label: 'Carousel Feeds',
    fields: [
      { key: 'brandName', type: 'text', core: true, hint: 'nama brand' },
      { key: 'productName', type: 'text', core: true, hint: 'nama produk/konten' },
      { key: 'productCategory', type: 'text', hint: 'kategori produk' },
      { key: 'productDescription', type: 'text', core: true, hint: 'deskripsi produk' },
      { key: 'mainBenefit', type: 'text', core: true, hint: 'benefit utama' },
      { key: 'problemSolved', type: 'text', core: true, hint: 'masalah yang diselesaikan' },
      { key: 'targetAudience', type: 'text', hint: 'target audiens' },
      { key: 'slide1Headline', type: 'text', core: true, hint: 'headline cover/slide 1' },
      { key: 'ctaText', type: 'text', core: true, hint: 'teks CTA penutup' },
      { key: 'templateType', type: 'enum', options: [
        'product', 'service', 'motivation', 'educational', 'personal', 'promo', 'testimonial',
        'problemsolution', 'mythfact', 'tipshowto', 'beforeafter', 'storytelling',
      ] },
      { key: 'totalSlides', type: 'enum', options: ['3', '4', '5', '6', '7'] },
      { key: 'platform', type: 'enum', options: ['Instagram', 'TikTok', 'LinkedIn', 'Facebook'] },
      { key: 'aspectRatio', type: 'enum', options: ['1:1 (Square)', '4:5 (Portrait)', '9:16 (Story / Reels)'] },
      { key: 'visualStyle', type: 'enum', options: [
        'Minimal Clean', 'Luxury Premium', 'Bold Modern', 'Soft Pastel', 'Dark Cinematic',
        'Vibrant Gradient', 'Editorial Magazine', '3D Render', 'Flat Illustration', 'Natural Lifestyle',
      ] },
      { key: 'colorMood', type: 'enum', options: [
        'Warm', 'Cool', 'Monochrome', 'Vibrant', 'Pastel', 'Earthy', 'Dark / Moody', 'Bright / Airy',
      ] },
      { key: 'toneCopywriting', type: 'enum', options: [
        'Persuasive', 'Friendly / Casual', 'Professional', 'Bold / Punchy', 'Emotional',
        'Educative', 'Luxury / Premium', 'Fun / Playful',
      ] },
    ],
  },

  thumbnail: {
    label: 'Youtube Thumbnail',
    fields: [
      { key: 'title', type: 'text', core: true, hint: 'judul video (jadi teks thumbnail)' },
      { key: 'hook', type: 'text', core: true, hint: 'hook pendukung' },
      { key: 'topic', type: 'text', hint: 'topik/konteks video' },
      { key: 'channel', type: 'text', hint: 'nama channel/brand' },
      { key: 'keyPoints', type: 'text', hint: 'poin kunci, pisahkan dengan ·' },
      { key: 'style', type: 'enum', options: [
        'MrBeast', 'Horror Story', 'Documentary', 'Podcast Viral', 'Gaming',
        'Dakwah', 'Luxury', 'Anime', 'Cinematic', 'Breaking News',
      ] },
      { key: 'mood', type: 'enum', options: [
        'Shock', 'Curiosity', 'Fear', 'Mystery', 'Urgency', 'Emotional', 'Epic',
      ] },
      { key: 'designStyle', type: 'enum', options: [
        'Futuristic Tech', 'Minimal Clean', 'Luxury Premium', 'Dark Neon',
        'Corporate Professional', 'Bright & Fresh', 'Warm & Cozy',
      ] },
      { key: 'lighting', type: 'enum', options: [
        'Soft Lighting', 'Neon Glow', 'Dramatic Shadow', 'Studio Light', 'Natural Sunlight',
      ] },
      { key: 'ratio', type: 'enum', options: ['16:9 (YouTube Thumbnail)', '9:16 (YouTube Shorts)'] },
    ],
  },
};

/** Daftar mode yang didukung AI (untuk endpoint /ideas: id + label + desc). */
export const AI_MODE_LIST = [
  { id: 'fotoproduk', label: 'Foto Produk', desc: 'foto produk profesional untuk display/katalog/marketplace' },
  { id: 'banner', label: 'Design Feeds', desc: 'desain feed/banner promosi 1 gambar' },
  { id: 'carousel', label: 'Carousel Feeds', desc: 'konten carousel multi-slide (edukasi/promo/story)' },
  { id: 'thumbnail', label: 'Youtube Thumbnail', desc: 'thumbnail video YouTube yang clickable' },
];

export const isAiMode = (mode) => Object.prototype.hasOwnProperty.call(AI_MODES, mode);
