import SafeImage from '../primitives/SafeImage.jsx';
import SampleAdCard from '../primitives/SampleAdCard.jsx';
import { CONFIG } from '../../config.js';
import { ADS_1x1, ADS_9x16, ADS_16x9 } from '../data/galleryManifest.js';

function Row({ items, speed, reverse = false, sizeClass, ratio }) {
  const doubled = [...items, ...items];
  const speedClass = reverse
    ? speed === 'fast' ? 'marquee-reverse-medium' : 'marquee-reverse-slow'
    : speed === 'fast' ? 'marquee-fast' : speed === 'medium' ? 'marquee-medium' : 'marquee-slow';

  return (
    <div className="marquee-mask marquee-pause overflow-hidden">
      <div className={`marquee-track ${speedClass}`}>
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

export default function DesignMarquee() {
  return (
    <section id="contoh" className="relative py-24 overflow-hidden">
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 mb-12">
        <div className="text-center max-w-2xl mx-auto reveal">
          <span className="eyebrow"><span className="dot" /> showcase output</span>
          <h2 className="h-section mt-4">
            <span className="text-grad-red">Hasil real</span> dari user batch awal,
            <br className="hidden sm:block" />
            digenerate dalam hitungan detik.
          </h2>
          <p className="mt-4 text-text-mut">
            Semua visual di bawah lahir dari {CONFIG.brandName} — tanpa Canva, tanpa
            Photoshop, tanpa edit manual. Brief masuk, design keluar.
          </p>
        </div>
      </div>

      {/* Row 1 — 1:1 (slice 10..20 = NEW set, beda dari TopShowcase) */}
      <div className="space-y-4">
        <div className="px-4 sm:px-6 max-w-7xl mx-auto flex items-center justify-between">
          <span className="text-[10px] mono uppercase tracking-widest text-text-dim">/01 · feed instagram · 1:1</span>
          <span className="text-[10px] mono uppercase tracking-widest text-accent">{ADS_1x1.length} variant</span>
        </div>
        <Row items={ADS_1x1.slice(10, 20)} speed="slow" sizeClass="w-56 h-56" ratio="1/1" />

        {/* Row 2 — 9:16 (first 10) */}
        <div className="px-4 sm:px-6 max-w-7xl mx-auto flex items-center justify-between mt-6">
          <span className="text-[10px] mono uppercase tracking-widest text-text-dim">/02 · story · reels · tiktok · shorts · 9:16</span>
          <span className="text-[10px] mono uppercase tracking-widest text-accent">{ADS_9x16.length} variant</span>
        </div>
        <Row items={ADS_9x16.slice(0, 10)} speed="medium" reverse sizeClass="w-44 h-[19.5rem]" ratio="9/16" />

        {/* Row 3 — 16:9 thumbnail (first 10) */}
        <div className="px-4 sm:px-6 max-w-7xl mx-auto flex items-center justify-between mt-6">
          <span className="text-[10px] mono uppercase tracking-widest text-text-dim">/03 · youtube thumbnail · 16:9</span>
          <span className="text-[10px] mono uppercase tracking-widest text-accent">{ADS_16x9.length} variant</span>
        </div>
        <Row items={ADS_16x9.slice(0, 10)} speed="fast" sizeClass="w-72 h-40" ratio="16/9" />
      </div>
    </section>
  );
}
