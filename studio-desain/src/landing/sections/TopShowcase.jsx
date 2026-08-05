import SafeImage from '../primitives/SafeImage.jsx';
import SampleAdCard from '../primitives/SampleAdCard.jsx';
import { ADS_1x1, ADS_CATEGORIES } from '../data/galleryManifest.js';

function Row({ items, sizeClass, ratio, reverse = false, speed = 'fast' }) {
  const doubled = [...items, ...items];
  const cls = reverse
    ? (speed === 'fast' ? 'marquee-reverse-medium' : 'marquee-reverse-slow')
    : (speed === 'fast' ? 'marquee-fast' : 'marquee-medium');
  return (
    <div className="marquee-mask marquee-pause overflow-hidden">
      <div className={`marquee-track ${cls}`}>
        {doubled.map((item, i) => (
          <div key={i} className={`shrink-0 px-2 ${sizeClass}`}>
            <div className="relative h-full w-full rounded-xl overflow-hidden soft-border bg-bg-deep">
              <SafeImage
                src={item.src}
                alt={item.alt}
                className="w-full h-full object-cover"
                fallback={<SampleAdCard ratio={ratio} variant={item.variant} />}
              />
              <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/5 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TopShowcase() {
  // Row 1 = 1:1 (existing — keep as-is)
  const row1 = ADS_1x1.slice(0, 10);
  // Row 2 = 4:5 kategori marketplace (NEW — 20 kategori, beda style per slot)
  const row2 = ADS_CATEGORIES;

  return (
    <section className="relative py-16 overflow-hidden border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 mb-8">
        <div className="text-center max-w-2xl mx-auto">
          <span className="eyebrow"><span className="dot" /> showcase</span>
          <h2 className="text-2xl sm:text-3xl font-bold mt-3">
            Segala Jenis <span className="text-grad-red">Produk Brand Dan Jasa</span>
          </h2>
          <p className="mt-2 text-sm text-text-mut">
            Geser pelan — semua design di bawah ini dibuat tanpa designer, tanpa Canva, tanpa Photoshop.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <Row items={row1} sizeClass="w-52 h-52" ratio="1/1" speed="fast" />
        <Row items={row2} sizeClass="w-44 h-[14rem]" ratio="4/5" reverse speed="fast" />
      </div>
    </section>
  );
}
