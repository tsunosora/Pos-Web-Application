// Opsi form untuk mode "Foto Produk" (foto produk display: katalog, marketplace, feed).
// Nilai = label (dipakai apa adanya di prompt). UI Bahasa Indonesia, arahan prompt Inggris.

export const KATEGORI_PRODUK = [
  'Skincare / Beauty',
  'Fashion / Apparel',
  'Makanan (F&B)',
  'Minuman',
  'Elektronik / Gadget',
  'Perhiasan / Aksesoris',
  'Furnitur / Home Living',
  'Produk Lainnya',
];

// value = frasa Inggris utk prompt; label = Bahasa Indonesia utk UI.
export const GAYA_FOTO = [
  { value: 'Clean studio product shot, seamless background',        label: 'Studio Minimalis (bersih)' },
  { value: 'Lifestyle in-context shot, real-world setting',         label: 'Lifestyle (konteks nyata)' },
  { value: 'Top-down flat lay arrangement',                         label: 'Flat Lay (tampak atas)' },
  { value: 'Dramatic hero shot, single product spotlight',          label: 'Hero Shot (produk utama)' },
  { value: 'Floating / levitation product shot',                    label: 'Levitasi (produk melayang)' },
  { value: 'Dynamic splash / motion shot',                          label: 'Splash / Dynamic' },
  { value: 'Macro close-up detail shot',                            label: 'Makro (detail dekat)' },
];

export const BACKGROUND = [
  { value: 'pure clean white studio background',        label: 'Putih Bersih (studio)' },
  { value: 'soft neutral gray gradient background',     label: 'Abu Lembut / Gradasi Netral' },
  { value: 'elegant marble surface',                    label: 'Marmer Elegan' },
  { value: 'warm natural wood surface',                 label: 'Kayu Natural' },
  { value: 'raw concrete / stone surface',              label: 'Beton / Batu' },
  { value: 'soft draped fabric / textile backdrop',     label: 'Kain / Tekstil' },
  { value: 'solid vibrant color studio backdrop',       label: 'Studio Warna Solid' },
  { value: 'natural outdoor / greenery setting',        label: 'Alam / Outdoor' },
  { value: 'cozy lifestyle interior scene',             label: 'Interior Lifestyle' },
];

export const SUDUT_KAMERA = [
  { value: 'straight-on eye-level front angle',   label: 'Depan Sejajar Mata' },
  { value: 'three-quarter 45-degree angle',       label: 'Tiga-perempat (45°)' },
  { value: 'side profile angle',                  label: 'Samping (profil)' },
  { value: 'top-down flat lay angle',             label: 'Atas (flat lay)' },
  { value: 'low dramatic hero angle',             label: 'Bawah (low, dramatis)' },
  { value: 'extreme macro close-up angle',        label: 'Makro (close-up)' },
];

export const PENCAHAYAAN = [
  { value: 'soft diffused softbox lighting',          label: 'Softbox Lembut' },
  { value: 'natural window daylight',                 label: 'Cahaya Jendela Natural' },
  { value: 'professional 3-point studio lighting',    label: 'Studio 3-Titik' },
  { value: 'dramatic rim / edge lighting',            label: 'Rim Light Dramatis' },
  { value: 'hard directional high-contrast light',    label: 'Hard Light Kontras' },
  { value: 'warm golden-hour lighting',               label: 'Golden Hour Hangat' },
];

export const PROPS = [
  { value: 'no props, product only, clean isolation',           label: 'Tanpa Props (produk saja)' },
  { value: 'subtle complementary props',                        label: 'Props Pelengkap Halus' },
  { value: 'rich lifestyle context props',                      label: 'Props Konteks Lifestyle' },
  { value: 'luxury premium styling props',                      label: 'Props Mewah / Premium' },
  { value: 'natural / eco elements (leaves, stone, water)',     label: 'Elemen Natural / Eco' },
  { value: 'raw ingredients around the product',                label: 'Bahan Baku / Ingredients' },
];

export const RASIO = [
  { value: '1:1 square',       label: '1:1 Square (Feed)' },
  { value: '4:5 portrait',     label: '4:5 Portrait (Feed)' },
  { value: '9:16 vertical',    label: '9:16 Story / Reels' },
  { value: '16:9 landscape',   label: '16:9 Landscape' },
  { value: '3:4 portrait',     label: '3:4 Katalog' },
];

export const MOOD = [
  { value: 'premium luxurious feel',        label: 'Premium / Mewah' },
  { value: 'clean minimalist feel',         label: 'Minimalis Bersih' },
  { value: 'warm cozy feel',                label: 'Hangat / Cozy' },
  { value: 'fresh natural feel',            label: 'Fresh / Natural' },
  { value: 'bold vibrant energetic feel',   label: 'Bold / Vibrant' },
  { value: 'elegant sophisticated feel',    label: 'Elegan' },
];

export const PLATFORM = [
  { value: 'e-commerce marketplace listing (Shopee/Tokopedia), lots of clean negative space',
    label: 'Marketplace (Shopee/Tokopedia)' },
  { value: 'Instagram feed post, scroll-stopping and aesthetic',
    label: 'Instagram Feed' },
  { value: 'website / catalog display, professional and consistent',
    label: 'Website / Katalog' },
  { value: 'poster / menu display, eye-catching',
    label: 'Poster / Menu' },
];
