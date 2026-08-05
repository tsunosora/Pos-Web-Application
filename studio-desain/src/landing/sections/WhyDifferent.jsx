import { Gauge, Boxes, Lock, Infinity as InfIcon, Cpu, Crown } from 'lucide-react';
import { CONFIG } from '../../config.js';
import ScanlineGrid from '../primitives/ScanlineGrid.jsx';

const REASONS = [
  { icon: Gauge,   title: 'Output presisi',     body: 'Bukan template generik — tiap field dipetakan ke karakter visual commercial-grade.' },
  { icon: Boxes,   title: '48+ kategori siap',  body: 'F&B, fashion, beauty, otomotif, edukasi, finance, sampai niche gaming — preset on click.' },
  { icon: Cpu,     title: 'Multi-format output',body: 'Banner, thumbnail, typography, story, reels — semua format lahir dari satu studio.' },
  { icon: Lock,    title: 'Sekali bayar',       body: 'Tanpa langganan bulanan. Tanpa kredit per render. Akses penuh selamanya begitu lunas.' },
  { icon: InfIcon, title: 'Render unlimited',   body: 'Sebanyak apapun visual yang kamu butuh — gak ada batas, gak ada throttle.' },
  { icon: Crown,   title: 'Update lifetime',    body: 'Mode baru, kategori baru, opsi gaya baru — semua di-push otomatis ke akunmu.' },
];

export default function WhyDifferent() {
  return (
    <section className="relative py-24 overflow-hidden">
      <ScanlineGrid />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
        <div className="max-w-2xl reveal">
          <span className="eyebrow"><span className="dot" /> yang bikin beda</span>
          <h2 className="h-section mt-4">
            Bukan sekedar template generator — <span className="text-grad-red">studio yang serius</span>.
          </h2>
          <p className="mt-4 text-text-mut">
            Setiap mode di {CONFIG.brandName} dirancang dari hasil reverse-engineering brief
            studio kreatif beneran, lalu disederhanakan jadi form yang siapapun bisa isi.
          </p>
        </div>

        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {REASONS.map((r, i) => {
            const Icon = r.icon;
            return (
              <div
                key={r.title}
                className="soft-border card-lift p-5 reveal relative"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="inline-flex w-10 h-10 rounded-lg items-center justify-center bg-accent-sm border border-border">
                    <Icon className="w-5 h-5 text-accent" />
                  </span>
                  <h3 className="text-sm font-bold text-text">{r.title}</h3>
                </div>
                <p className="text-xs text-text-mut leading-relaxed">{r.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
