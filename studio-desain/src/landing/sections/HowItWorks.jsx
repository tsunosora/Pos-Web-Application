import { PenLine, Cpu, Wand2 } from 'lucide-react';
import GlowOrb from '../primitives/GlowOrb.jsx';
import { CONFIG } from '../../config.js';

const STEPS = [
  {
    n: '01',
    icon: PenLine,
    title: 'Isi brief 30 detik',
    body: 'Pilih kategori industri, isi nama produk, headline, dan warna brand. Tidak ada form panjang yang bikin males.',
  },
  {
    n: '02',
    icon: Cpu,
    title: 'Engine racik visualnya',
    body: `${CONFIG.brandName} otomatis menyusun komposisi, lighting, typography, dan color grading — semua dipetakan presisi.`,
  },
  {
    n: '03',
    icon: Wand2,
    title: 'Design jadi, tinggal upload',
    body: 'Visualmu lahir dalam hitungan detik — siap pasang ke feed, story, thumbnail, atau bahan iklan.',
  },
];

export default function HowItWorks() {
  return (
    <section id="cara" className="relative py-24 overflow-hidden">
      <GlowOrb size={500} color="rgba(var(--accent-rgb),0.10)" className="right-[-180px] top-20" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
        <div className="max-w-2xl reveal">
          <span className="eyebrow"><span className="dot" /> alurnya simpel</span>
          <h2 className="h-section mt-4">
            Tiga langkah, <span className="text-grad-red">tanpa skill desain</span>.
          </h2>
          <p className="mt-4 text-text-mut">
            Dari kotak kosong ke visual siap upload — semua dalam satu sesi browser.
          </p>
        </div>

        <div className="mt-14 relative grid md:grid-cols-3 gap-6">
          {/* Connecting line (desktop) */}
          <div className="hidden md:block absolute top-12 left-[16%] right-[16%] h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent" />

          {STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <div
                key={s.n}
                className="relative reveal"
                style={{ animationDelay: `${i * 120}ms` }}
              >
                <div className="relative z-10 mx-auto w-24 h-24 rounded-2xl bg-bg-panel border border-border-strong shadow-[0_0_32px_rgba(var(--accent-rgb),0.25)] flex items-center justify-center mb-6">
                  <Icon className="w-9 h-9 text-accent" />
                  <span className="absolute -top-2 -right-2 px-1.5 py-0.5 rounded bg-accent text-white mono text-[10px] font-bold tracking-widest">
                    {s.n}
                  </span>
                </div>
                <div className="soft-border p-5 text-center">
                  <h3 className="text-base font-bold text-text">{s.title}</h3>
                  <p className="mt-2 text-xs text-text-mut leading-relaxed">{s.body}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
