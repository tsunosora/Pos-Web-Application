import { useState, useRef } from 'react';
import { Grid3x3, ChevronLeft, ChevronRight, Play, Tag } from 'lucide-react';
import { CONFIG } from '../../config.js';
import GlowOrb from '../primitives/GlowOrb.jsx';
import SafeImage from '../primitives/SafeImage.jsx';
import SampleAdCard from '../primitives/SampleAdCard.jsx';

// Gambar hasil ChatGPT (rasio 4:5). Tiap gambar = 1 campaign 9 feed.
// Taruh file asli di public/landing/gridfeed/1..4.jpg — kalau belum ada,
// otomatis tampil placeholder (tidak error).
const SHOTS = [
  { src: '/landing/gridfeed/1.jpg', label: 'Coffee Shop' },
  { src: '/landing/gridfeed/2.jpg', label: 'Food' },
  { src: '/landing/gridfeed/3.jpg', label: 'Fashion' },
  { src: '/landing/gridfeed/4.jpg', label: 'Laundry' },
  { src: '/landing/gridfeed/5.jpg', label: 'Franchise' },
  { src: '/landing/gridfeed/6.jpg', label: 'Daycare' },
];

const BULLETS = [
  '9 feed otomatis dari 1 brief — alur yang nyambung',
  'Tiap feed beda peran: hero, fitur, harga, testimoni, CTA',
  'Warna, font & produk konsisten — terlihat satu campaign',
  'Hasil rasio 4:5 siap langsung posting ke Instagram',
];

export default function GridFeedShowcase() {
  const [i, setI] = useState(0);
  const n = SHOTS.length;
  const go = (d) => setI((p) => (p + d + n) % n);
  const startX = useRef(null);
  const onStart = (e) => { startX.current = e.touches ? e.touches[0].clientX : e.clientX; };
  const onEnd = (e) => {
    if (startX.current == null) return;
    const x = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
    const dx = x - startX.current;
    if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
    startX.current = null;
  };

  return (
    <section className="relative py-24 overflow-hidden">
      <GlowOrb size={560} color="rgba(var(--accent-rgb),0.16)" className="right-[-160px] top-10" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">

        {/* TEXT */}
        <div className="reveal order-1 lg:order-1">
          <span className="eyebrow"><span className="dot" /> baru · 9 feed konsisten</span>
          <h2 className="h-section mt-4">
            Satu brief jadi <span className="text-grad-red">9 feed</span> yang konsisten.
          </h2>
          <p className="mt-4 text-text-mut max-w-lg">
            Pilih produk &amp; gaya, sistem menyusun konsep <span className="text-text">9 feed</span> jadi
            satu campaign — tiap feed beda peran tapi tetap serasi. Geser mockup di samping
            untuk lihat tampilan di profil Instagram.
          </p>
          <ul className="mt-6 space-y-2.5">
            {BULLETS.map((b) => (
              <li key={b} className="flex items-start gap-2.5 text-sm text-text">
                <span className="inline-flex w-5 h-5 rounded-full bg-accent-sm border border-border items-center justify-center shrink-0 mt-0.5">
                  <Grid3x3 className="w-3 h-3 text-accent" />
                </span>
                {b}
              </li>
            ))}
          </ul>
        </div>

        {/* PHONE MOCKUP — view profil Instagram, swipeable */}
        <div className="reveal reveal-d2 order-2 lg:order-2 flex justify-center">
          <div className="relative w-[272px] sm:w-[300px]">
            <div
              className="relative rounded-[2.4rem] border-[9px] border-bg-elev bg-bg-deep shadow-2xl overflow-hidden flex flex-col"
              style={{ aspectRatio: '9 / 17', boxShadow: '0 30px 70px -18px rgba(var(--accent-rgb),0.4)' }}
            >
              {/* notch */}
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-5 bg-black rounded-full z-30" />

              {/* top bar (username) */}
              <div className="pt-8 px-3 pb-1.5 flex items-center gap-1.5 border-b border-border bg-bg-deep/95 shrink-0">
                <span className="text-[11px] font-bold text-text">brand.kamu</span>
                <span className="text-[8px] text-text-dim">▾</span>
                <span className="ml-auto text-[9px] mono text-text-dim">{i + 1}/{n}</span>
              </div>

              {/* profil info */}
              <div className="px-3 py-2 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-accent/40 shrink-0 bg-white">
                    <SafeImage src={CONFIG.logoUrl} alt="logo" className="w-full h-full object-cover"
                      fallback={<div className="w-full h-full bg-gradient-to-br from-accent to-accent-deep" />} />
                  </div>
                  <div className="flex-1 flex justify-around text-center">
                    <div><div className="text-[12px] font-bold text-text leading-none">9</div><div className="text-[8px] text-text-dim mt-0.5">Postingan</div></div>
                    <div><div className="text-[12px] font-bold text-text leading-none">12,4rb</div><div className="text-[8px] text-text-dim mt-0.5">Pengikut</div></div>
                    <div><div className="text-[12px] font-bold text-text leading-none">128</div><div className="text-[8px] text-text-dim mt-0.5">Mengikuti</div></div>
                  </div>
                </div>
                <div className="mt-1.5 leading-tight">
                  <div className="text-[11px] font-bold text-text">Brand Kamu · {SHOTS[i].label}</div>
                  <div className="text-[9px] text-text-mut">Campaign 9 feed by Auto Feeds ✨</div>
                </div>
                <div className="mt-1.5 flex gap-1.5">
                  <span className="flex-1 text-center text-[9px] font-semibold text-white bg-accent rounded py-1">Mengikuti</span>
                  <span className="flex-1 text-center text-[9px] font-semibold text-text bg-bg-elev border border-border rounded py-1">Pesan</span>
                </div>
              </div>

              {/* tabs */}
              <div className="flex border-t border-border shrink-0">
                <div className="flex-1 flex justify-center py-1.5 border-b-2 border-accent"><Grid3x3 className="w-4 h-4 text-accent" /></div>
                <div className="flex-1 flex justify-center py-1.5"><Play className="w-4 h-4 text-text-dim" /></div>
                <div className="flex-1 flex justify-center py-1.5"><Tag className="w-4 h-4 text-text-dim" /></div>
              </div>

              {/* FEED 4:5 (swipeable) */}
              <div
                className="relative aspect-[4/5] shrink-0 select-none cursor-grab active:cursor-grabbing bg-bg-deep"
                onTouchStart={onStart} onTouchEnd={onEnd} onMouseDown={onStart} onMouseUp={onEnd}
              >
                {SHOTS.map((s, k) => (
                  <div key={k} className="absolute inset-0 transition-opacity duration-500" style={{ opacity: k === i ? 1 : 0 }}>
                    <SafeImage
                      src={s.src}
                      alt={`Feed ${k + 1}`}
                      className="w-full h-full object-cover"
                      fallback={<SampleAdCard ratio="4/5" variant={k + 4} />}
                      draggable={false}
                    />
                  </div>
                ))}
                <button onClick={() => go(-1)} aria-label="Sebelumnya" className="absolute left-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/45 backdrop-blur flex items-center justify-center text-white hover:bg-black/65 transition z-10"><ChevronLeft className="w-4 h-4" /></button>
                <button onClick={() => go(1)} aria-label="Berikutnya" className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/45 backdrop-blur flex items-center justify-center text-white hover:bg-black/65 transition z-10"><ChevronRight className="w-4 h-4" /></button>
              </div>

              {/* home indicator */}
              <div className="flex-1 flex items-end justify-center pb-2"><div className="w-24 h-1 rounded-full bg-text-dim/40" /></div>
            </div>

            {/* dots + hint di luar HP */}
            <div className="flex items-center justify-center gap-1.5 mt-4">
              {SHOTS.map((_, k) => (
                <button key={k} onClick={() => setI(k)} aria-label={`Lihat profil ${k + 1}`}
                  className={`h-1.5 rounded-full transition-all ${k === i ? 'w-6 bg-accent' : 'w-1.5 bg-border hover:bg-text-dim'}`} />
              ))}
            </div>
            <div className="text-center text-[11px] text-text-dim mt-2">← geser / klik panah untuk profil lain →</div>
          </div>
        </div>

      </div>
    </section>
  );
}
