import { useEffect } from 'react';
import { X, Sparkles, ChevronRight } from 'lucide-react';
import { DEMOS_BY_MODE, MODE_TITLES } from '../data/affiliateDemos.js';

/**
 * Affiliate Demo Picker — image-grid modal yang muncul saat user click Demo
 * sambil di mode affiliate (logo/tryon/review/storyboard/ugc).
 */
export default function AffiliateDemoModal({ open, onClose, mode, onPick }) {
  const demos = DEMOS_BY_MODE[mode] || [];
  const title = MODE_TITLES[mode] || 'Affiliate Demos';

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm flex items-center justify-center px-4 py-6 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="surface shadow-panel max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="px-5 py-4 border-b border-border flex items-center justify-between gap-3 shrink-0 bg-bg-elev/40">
          <div>
            <div className="text-[10px] mono uppercase tracking-widest text-accent flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" />
              Demo Template
            </div>
            <h2 className="text-base font-bold mt-0.5">{title}</h2>
            <p className="text-[11px] text-text-dim mt-0.5">{demos.length} template siap pakai · klik kartu untuk auto-fill form</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-md hover:bg-bg-elev flex items-center justify-center text-text-mut">
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-5">
          {demos.length === 0 ? (
            <div className="text-center text-text-mut text-sm py-12">
              Belum ada demo template untuk mode ini.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {demos.map((demo) => (
                <DemoCard
                  key={demo.id}
                  demo={demo}
                  aspectClass={ASPECT_BY_MODE[mode] || 'aspect-[4/3]'}
                  onClick={() => { onPick(demo); onClose(); }}
                />
              ))}
            </div>
          )}
        </div>

        <footer className="px-5 py-3 border-t border-border bg-bg-elev/40 text-[10px] mono uppercase tracking-widest text-text-dim shrink-0 flex items-center justify-between">
          <span>Tekan ESC untuk tutup</span>
          <span className="text-accent">5 demo · ready to customize</span>
        </footer>
      </div>
    </div>
  );
}

// Rasio kartu mengikuti rasio gambar tiap mode (cegah crop):
// review & logo = 1:1, try-on = 4:5 portrait, storyboard = 16:9 landscape.
const ASPECT_BY_MODE = {
  reviewaffiliate: 'aspect-square',
  logoaffiliate: 'aspect-square',
  tryonaffiliate: 'aspect-[4/5]',
  storyboardaffiliate: 'aspect-video',
};

function DemoCard({ demo, onClick, aspectClass = 'aspect-[4/3]' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="surface-elev overflow-hidden text-left flex flex-col hover:border-accent transition group"
    >
      <div className={`relative ${aspectClass} bg-bg-deep overflow-hidden`}>
        <img
          src={demo.image}
          alt={demo.label}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
            const parent = e.currentTarget.parentElement;
            if (parent && !parent.querySelector('.img-fallback')) {
              const fb = document.createElement('div');
              fb.className = 'img-fallback absolute inset-0 flex items-center justify-center bg-gradient-to-br from-accent-sm to-bg-elev text-accent text-2xl font-black';
              fb.textContent = demo.tag || '✨';
              parent.appendChild(fb);
            }
          }}
        />
        {demo.tag && (
          <span className="absolute top-2 left-2 chip bg-black/70 text-white border-white/20 text-[9px]">
            {demo.tag}
          </span>
        )}
      </div>
      <div className="p-3 flex-1 flex items-center justify-between gap-2 border-t border-border">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-text truncate">{demo.label}</div>
          <div className="text-[10px] text-text-dim mt-0.5 truncate">
            {demo.preset.brand_name || demo.preset.product_name || demo.preset.target_audience || 'Click to load'}
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-text-dim group-hover:text-accent shrink-0" />
      </div>
    </button>
  );
}
