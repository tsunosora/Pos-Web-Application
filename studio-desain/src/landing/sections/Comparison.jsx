import { X, Check } from 'lucide-react';
import { CONFIG } from '../../config.js';

const ROWS = [
  { aspect: 'Waktu produksi 1 banner', old: '4–24 jam',         neo: 'Di bawah 1 menit' },
  { aspect: 'Biaya per banner',         old: 'Rp 50–500 ribu',   neo: 'Termasuk paket'   },
  { aspect: 'Konsistensi gaya',         old: 'Tergantung mood',  neo: 'Brand-locked'     },
  { aspect: 'Skill teknis dibutuhkan',  old: 'Photoshop / Illu', neo: 'Cuma isi form'    },
  { aspect: 'Revisi & iterasi',         old: 'Antri designer',   neo: 'Re-generate instan'},
  { aspect: 'Skala output',             old: 'Bottleneck',       neo: 'Unlimited'        },
];

export default function Comparison() {
  return (
    <section className="relative py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="max-w-2xl reveal">
          <span className="eyebrow"><span className="dot" /> before / after</span>
          <h2 className="h-section mt-4">
            Designer vs <span className="text-grad-red">{CONFIG.brandName}</span>.
          </h2>
        </div>

        <div className="mt-10 grid md:grid-cols-2 gap-5">
          {/* OLD WAY */}
          <div className="soft-border p-6 reveal">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-extrabold text-text mono uppercase tracking-widest">
                /01 · Pakai Designer
              </h3>
              <span className="text-[10px] mono px-2 py-0.5 rounded bg-bg-deep border border-border text-text-dim">
                LAMBAT
              </span>
            </div>
            <ul className="space-y-3">
              {ROWS.map((r) => (
                <li key={r.aspect} className="flex items-start gap-3 pb-3 border-b border-border last:border-0 last:pb-0">
                  <span className="inline-flex w-5 h-5 rounded-full bg-red-950/40 border border-red-900/60 items-center justify-center shrink-0 mt-0.5">
                    <X className="w-3 h-3 text-red-400" />
                  </span>
                  <div className="flex-1 grid sm:grid-cols-[1fr_auto] gap-x-3 items-baseline">
                    <span className="text-sm font-bold text-text">{r.aspect}</span>
                    <span className="text-xs text-text-mut mono font-semibold">{r.old}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* NEW WAY */}
          <div className="neon-border p-6 reveal reveal-d2 relative">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-extrabold text-accent mono uppercase tracking-widest">
                /02 · {CONFIG.brandName}
              </h3>
              <span className="text-[10px] mono px-2 py-0.5 rounded bg-accent text-white font-bold tracking-widest">
                INSTAN
              </span>
            </div>
            <ul className="space-y-3">
              {ROWS.map((r) => (
                <li key={r.aspect} className="flex items-start gap-3 pb-3 border-b border-border last:border-0 last:pb-0">
                  <span className="inline-flex w-5 h-5 rounded-full bg-accent-sm border border-border-strong items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3 h-3 text-accent" />
                  </span>
                  <div className="flex-1 grid sm:grid-cols-[1fr_auto] gap-x-3 items-baseline">
                    <span className="text-sm font-bold text-text">{r.aspect}</span>
                    <span className="text-xs text-accent mono font-bold">{r.neo}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
