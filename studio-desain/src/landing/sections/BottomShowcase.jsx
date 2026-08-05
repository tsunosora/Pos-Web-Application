import SafeImage from '../primitives/SafeImage.jsx';
import SampleAdCard from '../primitives/SampleAdCard.jsx';
import GlowOrb from '../primitives/GlowOrb.jsx';
import { ADS_TYPO, ADS_9x16, ADS_16x9 } from '../data/galleryManifest.js';

function Row({ items, reverse = false, sizeClass, ratio, speed = 'medium' }) {
  const doubled = [...items, ...items];
  const cls = reverse
    ? (speed === 'fast' ? 'marquee-reverse-medium' : 'marquee-reverse-slow')
    : (speed === 'fast' ? 'marquee-fast' : speed === 'slow' ? 'marquee-slow' : 'marquee-medium');

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

export default function BottomShowcase() {
  return (
    <section className="relative py-20 overflow-hidden">
      <GlowOrb size={500} color="rgba(var(--accent-rgb),0.10)" className="left-1/2 -translate-x-1/2 top-0" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 mb-10">
        <div className="text-center max-w-2xl mx-auto reveal">
          <span className="eyebrow"><span className="dot" /> showcase tambahan</span>
          <h2 className="h-section mt-4">
            Hasil yang <span className="text-grad-red">naik feed kemarin</span>.
          </h2>
          <p className="mt-3 text-sm text-text-mut">
            Setiap variant di bawah lahir dari satu studio — beda kategori, beda gaya, beda format.
            Semua tanpa edit manual.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Row 1 — 4:5 typography (first 10) */}
        <div className="px-4 sm:px-6 max-w-7xl mx-auto flex items-center justify-between">
          <span className="text-[10px] mono uppercase tracking-widest text-text-dim">/typography ads · 4:5</span>
          <span className="text-[10px] mono uppercase tracking-widest text-accent">{ADS_TYPO.length} variant</span>
        </div>
        <Row items={ADS_TYPO.slice(0, 10)} sizeClass="w-52 h-[16.25rem]" ratio="4/5" speed="medium" />

        {/* Row 2 — 9:16 (slice 10..20 = NEW set, beda dari DesignMarquee) */}
        <div className="px-4 sm:px-6 max-w-7xl mx-auto flex items-center justify-between mt-6">
          <span className="text-[10px] mono uppercase tracking-widest text-text-dim">/vertical content · 9:16</span>
          <span className="text-[10px] mono uppercase tracking-widest text-accent">{ADS_9x16.length} variant</span>
        </div>
        <Row items={ADS_9x16.slice(10, 20)} reverse sizeClass="w-44 h-[19.5rem]" ratio="9/16" speed="medium" />

        {/* Row 3 — 16:9 (slice 10..20 = NEW set, beda dari DesignMarquee) */}
        <div className="px-4 sm:px-6 max-w-7xl mx-auto flex items-center justify-between mt-6">
          <span className="text-[10px] mono uppercase tracking-widest text-text-dim">/landscape ads & thumbnail · 16:9</span>
          <span className="text-[10px] mono uppercase tracking-widest text-accent">{ADS_16x9.length} variant</span>
        </div>
        <Row items={ADS_16x9.slice(10, 20)} sizeClass="w-72 h-40" ratio="16/9" speed="fast" />
      </div>
    </section>
  );
}
