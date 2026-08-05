// Opsi untuk mode "Banner Cetak" — desain siap cetak percetakan
// (spanduk, x-banner, roll-up, baliho, poster, brosur).

export const PRODUCT_TYPES = [
  'Spanduk (Horizontal)',
  'X-Banner (Vertikal)',
  'Roll-Up Banner',
  'Baliho / Billboard',
  'Poster',
  'Flyer / Brosur',
  'Backdrop / Backwall',
  'Umbul-umbul',
  'Standing Banner',
];

// Ukuran umum percetakan (opsi pertama = manual). cm.
export const SIZES = [
  'Custom (ukuran manual)',
  'Spanduk 300 x 100 cm',
  'Spanduk 400 x 100 cm',
  'Spanduk 500 x 100 cm',
  'Spanduk 600 x 150 cm',
  'X-Banner 60 x 160 cm',
  'Roll-Up 85 x 200 cm',
  'Baliho 400 x 600 cm',
  'Baliho 500 x 800 cm',
  'Poster A3 (29,7 x 42 cm)',
  'Poster A2 (42 x 59,4 cm)',
  'Poster A1 (59,4 x 84,1 cm)',
  'Flyer A5 (14,8 x 21 cm)',
  'Brosur A4 (21 x 29,7 cm)',
  'Umbul-umbul 90 x 400 cm',
];

export const ORIENTATIONS = [
  'Landscape (Horizontal)',
  'Portrait (Vertikal)',
  'Square (Persegi)',
];

export const MATERIALS = [
  'Flexi China 280gr (indoor/outdoor ekonomis)',
  'Flexi Korea 440gr (outdoor premium)',
  'Albatros (indoor, warna tajam)',
  'Luster / Photo Paper',
  'Vinyl / Sticker',
  'Art Paper 260gr',
  'Kanvas',
  'One-Way Vision',
];

export const STYLES = [
  'Bold Promo',
  'Elegan Premium',
  'Minimalis Bersih',
  'Korporat Profesional',
  'Ceria & Festive',
  'Kuliner Menggugah',
  'Grand Opening',
  'Diskon / Sale Besar',
  'Islami / Ramadhan',
  'Retro / Vintage',
];

// style → kata kunci estetika untuk prompt
export const STYLE_AESTHETIC = {
  'Bold Promo':            'bold high-impact promotional look, loud typography, energetic contrast, attention-grabbing',
  'Elegan Premium':        'elegant premium look, refined gold/dark accents, generous spacing, sophisticated typography',
  'Minimalis Bersih':      'clean minimalist layout, lots of white space, simple flat shapes, modern sans-serif',
  'Korporat Profesional':  'corporate professional, trustworthy, structured grid, blue/neutral palette, clean icons',
  'Ceria & Festive':       'cheerful festive, vibrant colors, playful shapes, celebratory mood',
  'Kuliner Menggugah':     'appetizing food & beverage look, warm tones, mouth-watering product photography emphasis',
  'Grand Opening':         'grand opening theme, ribbon/confetti/spotlight motifs, celebratory premium feel',
  'Diskon / Sale Besar':   'big sale theme, large price/discount badges, urgent red/yellow accents, burst shapes',
  'Islami / Ramadhan':     'islamic/ramadhan theme, crescent, mosque silhouette, lantern, ornamental arabesque, green/gold',
  'Retro / Vintage':       'retro vintage aesthetic, muted palette, classic typography, textured background',
};
