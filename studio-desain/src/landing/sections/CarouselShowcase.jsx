import { useState, useEffect, useRef } from 'react';
import { GalleryHorizontalEnd, ArrowRight, Layers, Sparkles, Newspaper, Hand } from 'lucide-react';
import GlowOrb from '../primitives/GlowOrb.jsx';
import ScanlineGrid from '../primitives/ScanlineGrid.jsx';
import SafeImage from '../primitives/SafeImage.jsx';

const SLIDES = [
  { src: '/landing/carousel/1.jpg', label: '1/3' },
  { src: '/landing/carousel/2.jpg', label: '2/3' },
  { src: '/landing/carousel/3.jpg', label: '3/3' },
];

const BULLETS = [
  '12+ tipe template — Product, Promo, Testimonial, Tips, Story, News, dll',
  '3–7 slide, alur cerita tersusun otomatis (hook → value → CTA)',
  'Layout tiap slide beda tapi tetap satu campaign yang konsisten',
  'Atur letak gambar, teks & warna di slide pertama',
];

function SlideFallback({ label }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-accent-sm to-bg-elev text-center px-3">
      <GalleryHorizontalEnd className="w-8 h-8 text-accent/50" />
      <div className="text-[10px] mono uppercase tracking-widest text-text-dim mt-2">Carousel {label}</div>
    </div>
  );
}

// Stack carousel interaktif: bisa di-geser (swipe), klik, dot, + auto-advance.
function StackCarousel({ slides }) {
  const n = slides.length;
  const [active, setActive] = useState(0);
  const pausedRef = useRef(false);
  const startX = useRef(null);

  const go = (i) => setActive(((i % n) + n) % n);
  const next = () => setActive((a) => (a + 1) % n);
  const prev = () => setActive((a) => (a - 1 + n) % n);

  // Auto-advance, berhenti saat di-hover / disentuh.
  useEffect(() => {
    const id = setInterval(() => { if (!pausedRef.current) setActive((a) => (a + 1) % n); }, 3500);
    return () => clearInterval(id);
  }, [n]);

  const onDown = (x) => { startX.current = x; pausedRef.current = true; };
  const onUp = (x) => {
    if (startX.current == null) return;
    const dx = x - startX.current;
    if (Math.abs(dx) < 8) next();        // tap
    else if (dx < -40) next();           // swipe kiri
    else if (dx > 40) prev();            // swipe kanan
    startX.current = null;
    pausedRef.current = false;
  };

  const cardStyle = (i) => {
    const pos = (i - active + n) % n; // 0 = depan
    const base = { transition: 'transform 0.5s cubic-bezier(0.4,0,0.2,1), opacity 0.5s', cursor: 'grab' };
    if (pos === 0) return { ...base, transform: 'translate(0,0) rotate(0deg) scale(1)', zIndex: 30, opacity: 1, boxShadow: '0 30px 70px -18px rgba(var(--accent-rgb),0.5)' };
    if (pos === 1) return { ...base, transform: 'translate(30px,14px) rotate(9deg) scale(0.95)', zIndex: 20, opacity: 0.9, boxShadow: '0 18px 40px -12px rgba(0,0,0,0.6)' };
    return { ...base, transform: 'translate(-28px,7px) rotate(-7deg) scale(0.95)', zIndex: 10, opacity: 0.9, boxShadow: '0 18px 40px -12px rgba(0,0,0,0.6)' };
  };

  return (
    <div className="flex flex-col items-center gap-5">
      <div
        className="relative w-[260px] sm:w-[300px] aspect-[4/5] select-none touch-pan-y"
        onMouseEnter={() => { pausedRef.current = true; }}
        onMouseLeave={() => { pausedRef.current = false; startX.current = null; }}
        onMouseDown={(e) => onDown(e.clientX)}
        onMouseUp={(e) => onUp(e.clientX)}
        onTouchStart={(e) => onDown(e.touches[0].clientX)}
        onTouchEnd={(e) => onUp(e.changedTouches[0].clientX)}
      >
        {slides.map((s, i) => (
          <div
            key={i}
            className="absolute inset-0 rounded-2xl overflow-hidden border-2 border-bg-panel bg-bg-deep"
            style={cardStyle(i)}
          >
            <SafeImage
              src={s.src}
              alt={`Carousel slide ${i + 1}`}
              className="w-full h-full object-cover pointer-events-none"
              fallback={<SlideFallback label={s.label} />}
            />
          </div>
        ))}
      </div>

      {/* Dots + hint — di luar area swipe */}
      <div className="flex items-center gap-3 mt-4">
        <div className="flex items-center gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => go(i)}
              aria-label={`Slide ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${i === active ? 'w-5 bg-accent' : 'w-1.5 bg-border hover:bg-accent/50'}`}
            />
          ))}
        </div>
        <span className="text-[10px] mono uppercase tracking-widest text-text-dim inline-flex items-center gap-1">
          <Hand className="w-3 h-3 text-accent" /> Geser / klik
        </span>
      </div>
    </div>
  );
}

export default function CarouselShowcase() {
  return (
    <section id="carousel" className="relative py-24 overflow-hidden">
      <GlowOrb size={520} color="rgba(var(--accent-rgb),0.16)" className="-top-24 left-[-160px]" />
      <ScanlineGrid />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid lg:grid-cols-[1.05fr_1fr] gap-12 lg:gap-16 items-center">
          {/* Copy */}
          <div className="reveal">
            <span className="eyebrow">
              <span className="dot" /> baru · carousel feeds
            </span>
            <h2 className="h-section mt-4">
              Carousel feed yang <span className="text-grad-red">nyambung</span> —
              satu cerita, banyak slide.
            </h2>
            <p className="mt-4 text-text-mut leading-relaxed">
              Pilih tipe template & jumlah slide, lalu sistem menyusun
              <span className="text-text"> alur cerita, objective tiap slide, variasi layout</span>,
              sampai komposisi visual yang konsisten — dari hook sampai CTA. Termasuk
              template <span className="text-text">News</span> untuk konten berita.
            </p>

            <ul className="mt-6 space-y-2.5">
              {BULLETS.map((b) => (
                <li key={b} className="flex items-start gap-2.5 text-sm text-text-mut">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                  {b}
                </li>
              ))}
            </ul>

            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-text-dim">
              <span className="flex items-center gap-1.5"><Layers className="w-3.5 h-3.5 text-accent" /> Slide otomatis tersusun</span>
              <span className="flex items-center gap-1.5"><Newspaper className="w-3.5 h-3.5 text-accent" /> Template News</span>
              <span className="flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-accent" /> Layout variatif</span>
            </div>

            <div className="mt-7">
              <a href="#harga" className="btn-cta !text-sm">
                <GalleryHorizontalEnd className="w-4 h-4" />
                Coba Carousel Feeds
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Stacked carousel — bisa di-geser */}
          <div className="reveal reveal-d2 flex justify-center py-6">
            <StackCarousel slides={SLIDES} />
          </div>
        </div>
      </div>
    </section>
  );
}
