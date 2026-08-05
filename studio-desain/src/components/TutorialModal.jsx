import { X, PlayCircle, Sparkles, Copy, Send } from 'lucide-react';
import AnimatedTutorial from './AnimatedTutorial.jsx';
import { CONFIG } from '../config.js';

const QUICK_STEPS = [
  { icon: Sparkles, title: 'Pilih Mode',         desc: 'Klik salah satu dari 5 generator di sidebar kiri: Banner, Youtube, Ads, Copy Writing, atau Face Card.' },
  { icon: PlayCircle, title: 'Isi Form / Pakai Demo', desc: 'Klik Randomize Demo untuk auto-isi dari 48 template industri, atau isi manual semua field.' },
  { icon: Copy,      title: 'Generate & Copy',    desc: 'Klik tombol Generate di panel kanan untuk build prompt, lalu klik Copy.' },
  { icon: Send,      title: 'Paste ke ChatGPT',   desc: 'Buka ChatGPT, klik ikon + → Buat gambar → paste prompt, upload foto kalau perlu. Hasil keluar dalam hitungan detik.' },
];

export default function TutorialModal({ open, onClose }) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[55] bg-black/85 sm:bg-black/70 backdrop-blur-sm flex items-stretch sm:items-center justify-center px-0 py-0 sm:px-4 sm:py-6 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="surface shadow-panel w-full max-w-2xl h-full sm:h-auto sm:max-h-[90vh] overflow-y-auto animate-slide-up sm:rounded-xl rounded-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-3 sm:px-5 py-3 sm:py-4 border-b border-border flex items-center justify-between sticky top-0 bg-bg-panel z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-accent-sm flex items-center justify-center">
              <PlayCircle className="w-4 h-4 text-accent" />
            </div>
            <h2 className="text-sm sm:text-base font-semibold">Tutorial {CONFIG.brandName}</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-md hover:bg-bg-elev flex items-center justify-center text-text-mut">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-2 sm:p-5">
          {/* Animated tutorial — 4 scenes loop */}
          <AnimatedTutorial />

          {/* Quick steps reference */}
          <div className="mt-5">
            <div className="text-[10px] mono uppercase tracking-widest text-accent mb-3">Quick Steps</div>
            <ol className="space-y-3">
              {QUICK_STEPS.map((s, i) => {
                const Icon = s.icon;
                return (
                  <li key={i} className="flex gap-3">
                    <div className="w-8 h-8 rounded-md bg-accent-sm flex items-center justify-center shrink-0">
                      <Icon className="w-3.5 h-3.5 text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold flex items-center gap-2">
                        <span className="mono text-text-dim text-[10px]">{String(i + 1).padStart(2, '0')}.</span>
                        {s.title}
                      </div>
                      <p className="text-xs text-text-mut mt-0.5 leading-relaxed">{s.desc}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
