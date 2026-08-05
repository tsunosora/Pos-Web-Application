import { LayoutPanelTop, GalleryHorizontalEnd, Youtube, Type, FileText, ScanFace, UtensilsCrossed, ArrowUpRight, Sparkles, Shirt, Star, Clapperboard, Grid3x3 } from 'lucide-react';
import SampleAdCard from '../primitives/SampleAdCard.jsx';
import SafeImage from '../primitives/SafeImage.jsx';
import { MODE_PREVIEWS, FACE_CARD_PREVIEWS, MENU_FB_PREVIEWS } from '../data/galleryManifest.js';

const MODES = [
  {
    icon: LayoutPanelTop,
    code: 'M1',
    name: 'Design Grafis',
    desc: 'Brief produk → banner komersial siap upload. Cocok buat feed IG, marketplace, hero website.',
    ratio: '1/1',
    variant: 5,
    img: MODE_PREVIEWS.banner,
    bullets: ['Komposisi commercial-grade', 'Aspect 1:1 / 4:5 / 16:9', 'Sesuai brand color'],
  },
  {
    icon: Grid3x3,
    code: 'M2',
    name: '9 Feed Konsisten ★',
    desc: 'Satu campaign, 9 feed konsisten. Brief produk → 9 feed beda peran (hero, fitur, harga, testimoni, CTA) tersusun otomatis, warna & font tetap serasi.',
    ratio: '1/1',
    variant: 7,
    img: '/landing/gridfeed/1.jpg',
    bullets: ['9 feed satu campaign', 'Tiap feed beda peran', 'Warna & font konsisten'],
  },
  {
    icon: GalleryHorizontalEnd,
    code: 'M3',
    name: 'Carousel Feeds',
    desc: 'Satu cerita, banyak slide. Pilih tipe template & jumlah slide → alur, layout, dan visual tiap slide tersusun otomatis. Termasuk template News.',
    ratio: '4/5',
    variant: 2,
    img: '/landing/carousel/1.jpg',
    stack: ['/landing/carousel/1.jpg', '/landing/carousel/2.jpg', '/landing/carousel/3.jpg'],
    bullets: ['12+ tipe template + News', '3–7 slide otomatis nyambung', 'Layout tiap slide variatif'],
  },
  {
    icon: Youtube,
    code: 'M4',
    name: 'YouTube Thumbnail',
    desc: 'Cetak thumbnail yang clickable: composition, ekspresi, dan teks overlay sudah diatur.',
    ratio: '16/9',
    variant: 17,
    img: MODE_PREVIEWS.thumbnail,
    bullets: ['CTR-oriented layout', 'Text overlay otomatis', 'Subject pose & emotion'],
  },
  {
    icon: Type,
    code: 'M5',
    name: 'Typography Ads',
    desc: 'Ads tipografi premium dengan 8 layer kreatif: title, art direction, palette, conversion, dst.',
    ratio: '4/5',
    variant: 22,
    img: MODE_PREVIEWS.typography,
    bullets: ['8 layer kreatif', 'Premium typography ads', 'Per-section copy button'],
  },
  {
    icon: FileText,
    code: 'M6',
    name: 'Copy Writing',
    desc: 'Auto-generate hook, body, dan CTA — formatnya match dengan visual yang lagi kamu kerjain.',
    ratio: '1/1',
    variant: 13,
    img: MODE_PREVIEWS.copy,
    bullets: ['Hook · Body · CTA', 'Tone selector', 'Match banner context'],
  },
  {
    icon: ScanFace,
    code: 'M7',
    name: 'Face Card Analysis ★',
    desc: 'Upload 1 portrait → 5 board analisa premium: face features, style, color, makeup, spectacles. Personal stylist dalam 1 klik.',
    ratio: '4/5',
    variant: 30,
    img: FACE_CARD_PREVIEWS.style,
    bullets: ['5 sub-type analysis', 'Editorial magazine quality', 'Male & female friendly'],
  },
  {
    icon: UtensilsCrossed,
    code: 'M8',
    name: 'Menu F&B ★',
    desc: '9 template premium untuk resto, patisserie, bakery — dari Parisian luxury sampai Korean street food viral. Formula visual per-brand.',
    ratio: '4/5',
    variant: 33,
    img: MENU_FB_PREVIEWS.cherryelle,
    bullets: ['9 template siap pakai', '5 layout style', 'Dynamic menu editor'],
  },
  {
    icon: Sparkles,
    code: 'M9',
    name: 'Logo Produk ★',
    desc: 'Logo brand affiliate-ready + tempel logo ke merchandise & brand mockup. Hasil langsung jadi logo & mockup produk.',
    ratio: '1/1',
    variant: 8,
    img: '/landing/affiliate-demos/logoaffiliate/logo-saas-tech.jpg?v=3',
    bullets: ['Logo + Brand Mockup', 'Custom HEX palette', '21 media mockup'],
  },
  {
    icon: Shirt,
    code: 'M10',
    name: 'Try-On Produk ★',
    desc: 'Upload foto produk → model pakai produknya. Visual try-on/wear-test konversi tinggi untuk affiliate.',
    ratio: '4/5',
    variant: 11,
    img: '/landing/affiliate-demos/tryonaffiliate/tryon-skincare-apply.jpg?v=3',
    bullets: ['Upload produk → try-on', '15 mode try-on', 'Optimasi per platform'],
  },
  {
    icon: Star,
    code: 'M11',
    name: 'Review Produk ★',
    desc: 'Banner review produk high-converting. 10 review framework + custom warna + wireframe preview live.',
    ratio: '1/1',
    variant: 14,
    img: '/landing/affiliate-demos/reviewaffiliate/review-fashion-bag.jpg?v=3',
    bullets: ['10 review framework', 'Custom warna + badge', 'Wireframe preview live'],
  },
  {
    icon: Clapperboard,
    code: 'M12',
    name: 'Video Storyboard ★',
    desc: 'Storyboard board scene-by-scene yang dibuat otomatis sesuai durasi — landscape 16:9, banyak scene cepat.',
    ratio: '16/9',
    variant: 19,
    img: '/landing/affiliate-demos/storyboardaffiliate/sb-saas-30s.jpg?v=3',
    bullets: ['Board 16:9 landscape', 'Scene auto per durasi', 'VO + overlay + visual'],
  },
];

export default function ModeShowcase() {
  return (
    <section className="relative py-24 overflow-hidden">
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
        <div className="max-w-2xl reveal">
          <span className="eyebrow"><span className="dot" /> 12 engine · 1 studio</span>
          <h2 className="h-section mt-4">
            Dua belas <span className="text-grad-red">engine kreatif</span> yang dirancang berbeda
            untuk setiap kebutuhan visual.
          </h2>
          <p className="mt-4 text-text-mut">
            Bukan satu generator yang dipakai untuk semua. Tiap mode punya logic
            sendiri agar output AI-nya konsisten sesuai format akhirnya — termasuk
            <span className="text-text"> Carousel Feeds</span> &amp;
            <span className="text-text"> 4 affiliate tools</span> baru.
          </p>
        </div>

        <div className="mt-12 grid md:grid-cols-2 gap-5">
          {MODES.map((m, i) => {
            const Icon = m.icon;
            return (
              <div
                key={m.code}
                className="soft-border card-lift p-5 sm:p-6 grid grid-cols-[1fr_120px] sm:grid-cols-[1fr_160px] gap-5 reveal relative overflow-hidden"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="inline-flex w-9 h-9 rounded-lg items-center justify-center bg-accent-sm border border-border">
                      <Icon className="w-4.5 h-4.5 text-accent" />
                    </span>
                    <span className="text-[9px] mono uppercase tracking-widest text-text-dim">/ENGINE · {m.code}</span>
                  </div>
                  <h3 className="text-lg font-bold text-text">{m.name}</h3>
                  <p className="mt-1.5 text-xs text-text-mut leading-relaxed">{m.desc}</p>
                  <ul className="mt-3 space-y-1">
                    {m.bullets.map((b) => (
                      <li key={b} className="text-[11px] text-text-mut flex items-center gap-2">
                        <span className="w-1 h-1 rounded-full bg-accent" />{b}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="relative rounded-lg overflow-hidden border border-border bg-bg-deep self-center aspect-square flex items-center justify-center">
                  {m.stack ? (
                    <MiniStack imgs={m.stack} />
                  ) : (
                    <SafeImage
                      src={m.img}
                      alt={`${m.name} preview`}
                      className="max-w-full max-h-full w-auto h-auto object-contain"
                      fallback={<SampleAdCard ratio={m.ratio} variant={m.variant} />}
                    />
                  )}
                  <div className="absolute top-1.5 right-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] mono uppercase tracking-widest bg-bg/80 backdrop-blur text-accent z-10">
                    <ArrowUpRight className="w-2.5 h-2.5" />
                    {m.ratio}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// Mini stack untuk card Carousel di grid — 3 gambar bertumpuk (seperti section Carousel Feeds).
function MiniStack({ imgs }) {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <div className="absolute w-[48%] aspect-[4/5] rounded-md overflow-hidden border border-border shadow-lg rotate-[10deg] translate-x-3 translate-y-1 bg-bg-deep">
        <SafeImage src={imgs[2]} alt="" className="w-full h-full object-cover opacity-90" fallback={<SampleAdCard ratio="4/5" variant={3} />} />
      </div>
      <div className="absolute w-[48%] aspect-[4/5] rounded-md overflow-hidden border border-border shadow-lg -rotate-[8deg] -translate-x-3 bg-bg-deep">
        <SafeImage src={imgs[1]} alt="" className="w-full h-full object-cover opacity-90" fallback={<SampleAdCard ratio="4/5" variant={2} />} />
      </div>
      <div className="absolute w-[50%] aspect-[4/5] rounded-md overflow-hidden border-2 border-bg-panel shadow-xl bg-bg-deep">
        <SafeImage src={imgs[0]} alt="Carousel Feeds preview" className="w-full h-full object-cover" fallback={<SampleAdCard ratio="4/5" variant={1} />} />
      </div>
    </div>
  );
}
