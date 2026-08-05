/**
 * 9 Menu F&B demo presets — based on 9 user-provided references.
 * Each demo is a full state snapshot (LOAD_DEMO compatible).
 *
 * Schema:
 *   { id, label, icon, theme, preset: { brand, tagline, businessType, categories[], ... } }
 *
 * categories[] shape:
 *   { name: string, items: [{ name, desc, price }] }
 */

const D = (id, label, icon, theme, preset) => ({ id, label, icon, theme, preset });

export const MENU_FB_DEMOS = [

  // ── 1. Cherryelle Patisserie ────────────────────────────────────────────
  D('patisserie-luxury', 'Patisserie Luxury', 'Cake', 'Parisian Luxury', {
    brand: 'Cherryelle Patisserie',
    tagline: 'pâtisserie artisanale · baked fresh daily',
    description: 'French-inspired patisserie serving handcrafted pastries with premium ingredients.',
    businessType: 'Patisserie / Bakery',
    layoutStyle: 'categorized',
    pageCount: 1,
    designTheme: 'Parisian Luxury — feminine elegant',
    palettePreset: 'wine-cherry-cream',
    primaryColor: '#7c1d2e',
    secondaryColor: '#fdf2e9',
    typography: 'Elegant Serif (Playfair / Cormorant)',
    mood: 'Elegant & Refined',
    photoStyle: 'Flat-lay overhead — top-down editorial',
    ratio: '4:5 (IG Feed Portrait — 1080×1350)',
    cta: 'Order via WhatsApp · 0812-3456-7890',
    contactInfo: '@cherryelle.patisserie · cherryelle.id',
    showPrices: true,
    showPhotos: true,
    categories: [
      { name: 'CROISSANT', items: [
        { name: 'Butter Croissant',     desc: 'flaky · french butter laminated', price: '28K' },
        { name: 'Almond Croissant',     desc: 'roasted almond cream filling',    price: '32K' },
        { name: 'Chocolate Croissant',  desc: 'dark valrhona chocolate batons',  price: '35K' },
      ]},
      { name: 'CHOUX', items: [
        { name: 'Choux au Craquelin',   desc: 'vanilla diplomat cream',          price: '30K' },
        { name: 'Paris-Brest',          desc: 'praline mousseline · hazelnut',   price: '38K' },
      ]},
      { name: 'ECLAIRS', items: [
        { name: 'Chocolate Eclair',     desc: 'glazed dark chocolate ganache',   price: '35K' },
        { name: 'Vanilla Eclair',       desc: 'madagascar vanilla pastry cream', price: '33K' },
        { name: 'Coffee Eclair',        desc: 'espresso crème · coffee fondant', price: '34K' },
      ]},
      { name: 'TARTS', items: [
        { name: 'Lemon Tart',           desc: 'meyer lemon curd · torched',      price: '40K' },
        { name: 'Strawberry Tart',      desc: 'seasonal fresh strawberry',       price: '42K' },
      ]},
    ],
  }),

  // ── 2. Superfood Healthy ────────────────────────────────────────────────
  D('healthy-editorial', 'Healthy Food Editorial', 'Salad', 'Editorial Modern', {
    brand: 'Superfood',
    tagline: 'clean eating · powered by nature',
    description: 'Healthy meal prep with organic ingredients and balanced macros.',
    businessType: 'Healthy Food / Diet Catering',
    layoutStyle: 'two-col-grid',
    pageCount: 1,
    designTheme: 'Editorial Modern — clean minimal',
    palettePreset: 'sage-cream-charcoal',
    primaryColor: '#84a98c',
    secondaryColor: '#fdf6ec',
    typography: 'Modern Sans (Inter / Manrope)',
    mood: 'Modern & Clean',
    photoStyle: 'Flat-lay overhead — top-down editorial',
    ratio: '4:5 (IG Feed Portrait — 1080×1350)',
    cta: 'Subscribe Weekly Plan',
    contactInfo: '@superfood.id · superfood.co',
    showPrices: true,
    showPhotos: true,
    categories: [
      { name: 'BOWLS', items: [
        { name: 'Quinoa Power Bowl',    desc: 'avocado · chickpea · kale',       price: '65K' },
        { name: 'Buddha Bowl',          desc: 'roasted veggies · tahini',        price: '58K' },
        { name: 'Salmon Poke Bowl',     desc: 'wild salmon · brown rice',        price: '78K' },
        { name: 'Tofu Teriyaki Bowl',   desc: 'organic tofu · edamame',          price: '55K' },
      ]},
      { name: 'SALADS', items: [
        { name: 'Caesar Greens',        desc: 'romaine · vegan caesar',          price: '48K' },
        { name: 'Mediterranean Bliss',  desc: 'feta · olives · hummus',          price: '52K' },
      ]},
      { name: 'SMOOTHIES', items: [
        { name: 'Green Detox',          desc: 'spinach · apple · ginger',        price: '35K' },
        { name: 'Berry Booster',        desc: 'mixed berries · chia · coconut',  price: '38K' },
      ]},
    ],
  }),

  // ── 3. Mashisseo Korean Street Food ─────────────────────────────────────
  D('korean-street', 'Korean Street Food', 'Flame', 'Bold Viral', {
    brand: 'Mashisseo 마시써',
    tagline: 'korean street food · authentic taste',
    description: 'Bold authentic Korean street eats made for sharing.',
    businessType: 'Restaurant — Korean Street Food',
    layoutStyle: 'hero-grid',
    pageCount: 6,
    designTheme: 'Bold Viral — high contrast street food',
    palettePreset: 'red-cream-bold',
    primaryColor: '#dc2626',
    secondaryColor: '#fef9e7',
    typography: 'Bold Display (Anton / Bebas Neue)',
    mood: 'Bold & Energetic',
    photoStyle: 'Hero close-up — single dish focus',
    ratio: '1:1 (IG Square / Carousel — 1080×1080)',
    cta: 'Order via GoFood / GrabFood',
    contactInfo: '@mashisseo.id · 0813-9999-1234',
    showPrices: true,
    showPhotos: true,
    categories: [
      { name: 'SIGNATURES', items: [
        { name: 'Tteokbokki Special',   desc: 'spicy chewy rice cake · cheese',  price: '25K' },
        { name: 'Korean Fried Chicken', desc: 'crispy double-fried · gochujang', price: '38K' },
      ]},
      { name: 'STREET BITES', items: [
        { name: 'Kimbap Roll',          desc: 'rice · veggies · bulgogi',        price: '18K' },
        { name: 'Hotteok Sweet',        desc: 'brown sugar · cinnamon · nuts',   price: '15K' },
        { name: 'Korean Corn Dog',      desc: 'mozzarella · ramyeon crust',      price: '22K' },
      ]},
      { name: 'SOUPS & STEW', items: [
        { name: 'Kimchi Jjigae',        desc: 'aged kimchi · pork · tofu',       price: '32K' },
        { name: 'Sundubu Jjigae',       desc: 'silken tofu stew · seafood',      price: '35K' },
      ]},
    ],
  }),

  // ── 4. Kayu Manis Indonesian Heritage ───────────────────────────────────
  D('indo-heritage', 'Indonesian Heritage', 'Wheat', 'Indonesian Heritage Ornate', {
    brand: 'Kayu Manis',
    tagline: 'warisan rasa nusantara · resep turun temurun',
    description: 'Authentic Indonesian heritage cuisine with traditional recipes.',
    businessType: 'Restaurant — Indonesian Heritage',
    layoutStyle: 'single-list',
    pageCount: 1,
    designTheme: 'Indonesian Heritage Ornate — classic batik',
    palettePreset: 'batik-brown-gold',
    primaryColor: '#6f4e37',
    secondaryColor: '#f4e7c5',
    typography: 'Vintage Slab (Roboto Slab / Zilla)',
    mood: 'Traditional & Heritage',
    photoStyle: 'Rustic wood / linen backdrop',
    ratio: '4:5 (IG Feed Portrait — 1080×1350)',
    cta: 'Reservasi Meja · 021-555-1234',
    contactInfo: '@kayumanis.resto · kayumanis.co.id',
    showPrices: true,
    showPhotos: false,
    categories: [
      { name: 'NASI & MAIN', items: [
        { name: 'Nasi Liwet Solo',      desc: 'nasi gurih · ayam suwir · tahu',  price: '45K' },
        { name: 'Nasi Tutug Oncom',     desc: 'oncom kemangi · sambal terasi',   price: '42K' },
        { name: 'Nasi Kuning Komplit',  desc: 'ayam goreng · perkedel · serundeng', price: '48K' },
      ]},
      { name: 'GULAI & SOTO', items: [
        { name: 'Soto Betawi',          desc: 'santan · daging sapi · emping',   price: '55K' },
        { name: 'Gulai Kambing',        desc: 'kambing muda · rempah pekat',     price: '65K' },
        { name: 'Rawon Surabaya',       desc: 'kluwek · daging sapi · tauge',    price: '52K' },
      ]},
      { name: 'JAJANAN PASAR', items: [
        { name: 'Klepon Pandan',        desc: 'gula merah · kelapa parut',       price: '15K' },
        { name: 'Es Cendol Bandung',    desc: 'cendol · santan · gula aren',     price: '20K' },
      ]},
    ],
  }),

  // ── 5. Takomi Takoyaki Japanese ─────────────────────────────────────────
  D('japanese-premium', 'Japanese Street Premium', 'Fish', 'Japanese Premium', {
    brand: 'Takomi たこ実',
    tagline: 'authentic takoyaki · osaka style',
    description: 'Premium Japanese street food specializing in takoyaki and yakisoba.',
    businessType: 'Restaurant — Japanese',
    layoutStyle: 'hero-grid',
    pageCount: 1,
    designTheme: 'Japanese Premium — dark navy red accents',
    palettePreset: 'navy-red-cream',
    primaryColor: '#1e2a4a',
    secondaryColor: '#fef3e2',
    typography: 'Modern Sans (Inter / Manrope)',
    mood: 'Premium & Luxurious',
    photoStyle: 'Hero close-up — single dish focus',
    ratio: '4:5 (IG Feed Portrait — 1080×1350)',
    cta: 'Pre-Order Online',
    contactInfo: '@takomi.jp · takomi.id',
    showPrices: true,
    showPhotos: true,
    categories: [
      { name: 'TAKOYAKI', items: [
        { name: 'Original Takoyaki (8pcs)',    desc: 'octopus · bonito · mayo',  price: '45K' },
        { name: 'Cheese Takoyaki (8pcs)',      desc: 'mozzarella · spicy mayo',  price: '52K' },
        { name: 'Premium Negi Takoyaki',       desc: 'green onion · ponzu',      price: '58K' },
      ]},
      { name: 'YAKISOBA', items: [
        { name: 'Chicken Yakisoba',            desc: 'stir-fried noodles · veg', price: '48K' },
        { name: 'Beef Yakisoba',               desc: 'wagyu beef · cabbage',     price: '65K' },
      ]},
      { name: 'SIDES', items: [
        { name: 'Edamame',                     desc: 'sea salt · steamed',       price: '22K' },
        { name: 'Gyoza (5pcs)',                desc: 'pork · pan-seared',        price: '35K' },
      ]},
    ],
  }),

  // ── 6. La Bella Patisserie Retro ────────────────────────────────────────
  D('retro-marketplace', 'Patisserie Retro Marketplace', 'IceCream', 'Retro Marketplace', {
    brand: 'La Bella',
    tagline: 'patisserie · since 2019',
    description: 'Vintage-inspired patisserie with handcrafted cakes and pastries.',
    businessType: 'Patisserie / Bakery',
    layoutStyle: 'two-col-grid',
    pageCount: 1,
    designTheme: 'Retro Marketplace — vintage poster style',
    palettePreset: 'navy-marketplace',
    primaryColor: '#1c3a5e',
    secondaryColor: '#fff5d6',
    typography: 'Editorial Mix (Serif headline + Sans body)',
    mood: 'Elegant & Refined',
    photoStyle: 'Studio isolated — clean background',
    ratio: '3:4 (Poster Vertikal — 1080×1440)',
    cta: 'Walk-in Welcome · 09:00–21:00',
    contactInfo: '@labella.patisserie · labella.id',
    showPrices: true,
    showPhotos: true,
    categories: [
      { name: 'CAKES', items: [
        { name: 'Tiramisu Slice',       desc: 'mascarpone · espresso · cocoa',   price: '45K' },
        { name: 'Red Velvet Slice',     desc: 'cream cheese frosting',           price: '42K' },
        { name: 'Opera Cake',           desc: 'almond · coffee · chocolate',     price: '48K' },
        { name: 'Black Forest',         desc: 'cherry · kirsch · cream',         price: '46K' },
      ]},
      { name: 'PASTRIES', items: [
        { name: 'Mille-Feuille',        desc: 'puff pastry · vanilla cream',     price: '38K' },
        { name: 'Macaron Box (6pcs)',   desc: 'assorted seasonal flavors',       price: '120K' },
        { name: 'Canelé Bordelais',     desc: 'rum · vanilla · caramelized',     price: '28K' },
      ]},
    ],
  }),

  // ── 7. Cemilan Bunya Homemade ───────────────────────────────────────────
  D('homemade-cozy', 'Bakery Homemade Cozy', 'Cookie', 'Warm Artisanal', {
    brand: 'Cemilan Bunya',
    tagline: 'cemilan rumahan · dibuat dengan cinta',
    description: 'Homemade snacks and cookies made fresh in small batches.',
    businessType: 'Snack & Cemilan',
    layoutStyle: 'compact-list',
    pageCount: 1,
    designTheme: 'Warm Artisanal — cream homemade cozy',
    palettePreset: 'cream-tan-warm',
    primaryColor: '#c89b7b',
    secondaryColor: '#fdf3e3',
    typography: 'Handwritten (Caveat / Kalam)',
    mood: 'Cozy & Homemade',
    photoStyle: 'Rustic wood / linen backdrop',
    ratio: 'A4 Portrait (Print Booklet — 2480×3508)',
    cta: 'PO H-3 · WA 0812-1111-2222',
    contactInfo: '@cemilan.bunya · bunya.shop',
    showPrices: true,
    showPhotos: false,
    categories: [
      { name: 'KUE KERING', items: [
        { name: 'Nastar Premium (250g)',  desc: 'isi selai nanas asli',          price: '85K' },
        { name: 'Kastengel Keju Edam',    desc: 'keju edam aged',                price: '95K' },
        { name: 'Putri Salju',            desc: 'almond · gula halus',           price: '75K' },
        { name: 'Choco Chip Cookies',     desc: 'dark chocolate chunks',         price: '65K' },
      ]},
      { name: 'BROWNIES & CAKE', items: [
        { name: 'Fudgy Brownies',         desc: 'rich dark chocolate',           price: '55K' },
        { name: 'Lapis Surabaya',         desc: 'butter cake · srikaya',         price: '120K' },
      ]},
      { name: 'SNACK BOX', items: [
        { name: 'Mini Pastry Box (6pcs)', desc: 'assorted savory · sweet',       price: '45K' },
      ]},
    ],
  }),

  // ── 8. Cing Ani Resto Betawi ────────────────────────────────────────────
  D('betawi-festive', 'Resto Betawi Festive', 'Soup', 'Festive Traditional', {
    brand: 'Cing Ani Resto',
    tagline: 'masakan betawi asli · sejak 1985',
    description: 'Authentic Betawi cuisine with festive traditional ambiance.',
    businessType: 'Restaurant — Indonesian Heritage',
    layoutStyle: 'categorized',
    pageCount: 1,
    designTheme: 'Festive Traditional — bold red gold',
    palettePreset: 'red-gold-festive',
    primaryColor: '#b91c1c',
    secondaryColor: '#fde68a',
    typography: 'Bold Display (Anton / Bebas Neue)',
    mood: 'Traditional & Heritage',
    photoStyle: 'Studio isolated — clean background',
    ratio: '4:5 (IG Feed Portrait — 1080×1350)',
    cta: 'Reservasi · 021-888-7777',
    contactInfo: '@cingani.resto · cingani.id',
    showPrices: true,
    showPhotos: true,
    categories: [
      { name: 'MAIN BETAWI', items: [
        { name: 'Soto Betawi Daging',     desc: 'santan · daging · paru',        price: '58K' },
        { name: 'Nasi Uduk Komplit',      desc: 'ayam · tahu tempe · sambal',    price: '52K' },
        { name: 'Gabus Pucung',           desc: 'ikan gabus · kuah hitam',       price: '85K' },
        { name: 'Sayur Asem Jakarta',     desc: 'asam jawa · sayur segar',       price: '32K' },
      ]},
      { name: 'SATE & GRILL', items: [
        { name: 'Sate Kambing Muda',      desc: '10 tusuk · bumbu kacang',       price: '75K' },
        { name: 'Ayam Bakar Taliwang',    desc: 'pedas manis · sambal terasi',   price: '62K' },
      ]},
      { name: 'CEMILAN & DESSERT', items: [
        { name: 'Kerak Telor',            desc: 'beras ketan · telur bebek',     price: '28K' },
        { name: 'Es Selendang Mayang',    desc: 'santan · gula merah',           price: '22K' },
      ]},
    ],
  }),

  // ── 9. Bunya Kitchen Modern Casual ──────────────────────────────────────
  D('rice-bowl-modern', 'Rice Bowl Modern Casual', 'UtensilsCrossed', 'Modern Casual', {
    brand: 'Bunya Kitchen',
    tagline: 'rice bowl · ready in 7 mins',
    description: 'Modern casual rice bowls with hearty portions and bold flavors.',
    businessType: 'Rice Bowl / Quick Bite',
    layoutStyle: 'hero-grid',
    pageCount: 1,
    designTheme: 'Modern Casual — earthy contemporary',
    palettePreset: 'terracotta-cream',
    primaryColor: '#c44d35',
    secondaryColor: '#faeacf',
    typography: 'Modern Sans (Inter / Manrope)',
    mood: 'Modern & Clean',
    photoStyle: 'Hero close-up — single dish focus',
    ratio: '1:1 (IG Square / Carousel — 1080×1080)',
    cta: 'Order on GrabFood',
    contactInfo: '@bunya.kitchen · bunyakitchen.com',
    showPrices: true,
    showPhotos: true,
    categories: [
      { name: 'SIGNATURE BOWLS', items: [
        { name: 'Beef Teriyaki Bowl',     desc: 'sliced beef · rice · veggies',  price: '42K' },
        { name: 'Chicken Katsu Bowl',     desc: 'crispy katsu · curry sauce',    price: '38K' },
        { name: 'Salmon Mentai Bowl',     desc: 'torched salmon · mentai mayo',  price: '55K' },
      ]},
      { name: 'SIDES', items: [
        { name: 'Karaage Bites',          desc: 'japanese fried chicken',        price: '28K' },
        { name: 'Spicy Edamame',          desc: 'chili · sea salt',              price: '18K' },
      ]},
      { name: 'DRINKS', items: [
        { name: 'Ocha Tea',               desc: 'green tea · hot/cold',          price: '12K' },
        { name: 'Yuzu Lemonade',          desc: 'yuzu · sparkling',              price: '22K' },
      ]},
    ],
  }),
];
