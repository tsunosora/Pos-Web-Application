import { CheckCircle2, Cpu, Wand2, Layers3 } from 'lucide-react';
import { CONFIG } from '../../config.js';
import NeonBorder from '../primitives/NeonBorder.jsx';
import GlowOrb from '../primitives/GlowOrb.jsx';
import SafeImage from '../primitives/SafeImage.jsx';
import SampleAdCard from '../primitives/SampleAdCard.jsx';

const POINTS = [
  { icon: Cpu,     text: 'Engine kreatif yang ngerti karakter visual komersial' },
  { icon: Layers3, text: '12 mode kerja: Banner · Carousel · 9 Feed Konsisten · Thumbnail · Typography · Copy · Face Card · Menu F&B + Logo · Try-On · Review · Storyboard' },
  { icon: Wand2,   text: 'Output siap upload — tanpa edit manual, tanpa retouch' },
  { icon: CheckCircle2, text: 'Tanpa Canva, tanpa Photoshop, tanpa desainer freelance' },
];

export default function SolutionIntro() {
  return (
    <section id="fitur" className="relative py-24 overflow-hidden">
      <GlowOrb size={520} color="rgba(var(--accent-rgb),0.12)" className="-left-40 top-10" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        {/* Visual */}
        <div className="reveal order-2 lg:order-1 relative">
          <NeonBorder className="p-2">
            <div className="relative grid grid-cols-2 gap-2 p-2 rounded-xl bg-bg-deep scanlines">
              {[
                { src:'/landing/ads-1x1/ig-01.jpg', v:4 },
                { src:'/landing/ads-1x1/ig-10.jpg', v:9 },
                { src:'/landing/ads-1x1/ig-19.jpg', v:6 },
                { src:'/landing/ads-1x1/ig-08.jpg', v:12 },
              ].map((it, i) => (
                <div key={i} className="aspect-square rounded-md overflow-hidden bg-bg-deep">
                  <SafeImage
                    src={it.src}
                    alt={`${CONFIG.brandName} visual #${i + 1}`}
                    className="w-full h-full object-cover"
                    fallback={<SampleAdCard ratio="1/1" variant={it.v} />}
                  />
                </div>
              ))}
            </div>
          </NeonBorder>

          <div className="absolute -bottom-5 -right-3 sm:-right-6 soft-border bg-bg-panel/95 backdrop-blur px-4 py-2.5 shadow-panel hidden sm:flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            <span className="text-[10px] mono uppercase tracking-widest text-text-mut">render ready</span>
          </div>
        </div>

        {/* Copy */}
        <div className="reveal reveal-d2 order-1 lg:order-2">
          <span className="eyebrow"><span className="dot" /> jawabannya satu</span>
          <h2 className="h-section mt-4">
            Satu studio untuk <span className="text-grad-red">semua kebutuhan visual</span> brand kamu.
          </h2>
          <p className="mt-4 text-text-mut leading-relaxed">
            {CONFIG.brandName} adalah <span className="text-text font-semibold">studio visual otomatis</span> — engine yang
            sudah dilatih membaca karakter desain commercial-grade, sehingga hasilnya
            konsisten, sesuai brand, dan layak naik di feed.
          </p>

          <ul className="mt-6 space-y-3">
            {POINTS.map((p, i) => {
              const Icon = p.icon;
              return (
                <li key={i} className="flex items-start gap-3 reveal" style={{ animationDelay: `${i * 80 + 200}ms` }}>
                  <span className="mt-0.5 inline-flex w-7 h-7 rounded-md items-center justify-center bg-accent-sm border border-border shrink-0">
                    <Icon className="w-3.5 h-3.5 text-accent" />
                  </span>
                  <span className="text-sm text-text leading-relaxed">{p.text}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
