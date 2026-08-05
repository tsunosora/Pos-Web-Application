import { useEffect, useState, useMemo } from 'react';
import { X, Sparkles, ChevronRight, Search, Layers } from 'lucide-react';
import { getDemoIcon } from './demoIcons.js';
import { CAROUSEL_DEMOS } from '../data/carouselDemos.js';

/**
 * Demo Picker khusus Carousel Feeds. Muncul saat user klik Demo sambil di
 * mode carousel. Klik kartu → auto-fill form carousel (template type + konten).
 */
export default function CarouselDemoModal({ open, onClose, onPick }) {
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return CAROUSEL_DEMOS;
    return CAROUSEL_DEMOS.filter(
      (d) => d.label.toLowerCase().includes(s) || (d.tag || '').toLowerCase().includes(s)
    );
  }, [q]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm flex items-center justify-center px-4 py-6 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="surface shadow-panel max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="px-5 py-4 border-b border-border flex items-center justify-between gap-3 shrink-0 bg-bg-elev/40">
          <div>
            <div className="text-[10px] mono uppercase tracking-widest text-accent flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" /> Demo Carousel
            </div>
            <h2 className="text-base font-bold mt-0.5">Pilih Template Carousel</h2>
            <p className="text-[11px] text-text-dim mt-0.5">{CAROUSEL_DEMOS.length} demo siap pakai · klik kartu untuk auto-fill form</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-md hover:bg-bg-elev flex items-center justify-center text-text-mut">
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* Search */}
        <div className="px-5 py-3 border-b border-border shrink-0">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim pointer-events-none z-10" />
            <input
              type="text"
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari demo (misal: Product, Promo, Testimonial)..."
              className="input"
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-5">
          {filtered.length === 0 ? (
            <div className="text-center text-text-mut text-sm py-12">Tidak ada demo yang cocok.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((demo) => {
                const Icon = getDemoIcon(demo.icon);
                return (
                  <button
                    key={demo.id}
                    type="button"
                    onClick={() => { onPick(demo); onClose(); }}
                    className="surface-elev p-4 text-left flex flex-col gap-3 hover:border-accent hover:bg-accent-sm/40 transition group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 rounded-lg bg-bg-deep border border-border flex items-center justify-center group-hover:border-accent">
                        <Icon className="w-5 h-5 text-text-mut group-hover:text-accent" />
                      </div>
                      <ChevronRight className="w-4 h-4 text-text-dim group-hover:text-accent" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-text leading-tight">{demo.label}</div>
                      <div className="text-[10px] text-text-dim mt-1 flex items-center gap-1 mono uppercase tracking-widest">
                        <Layers className="w-2.5 h-2.5 shrink-0" /> {demo.tag}
                      </div>
                      <div className="text-[11px] text-text-mut mt-1.5 line-clamp-2">
                        “{(demo.preset.slide1Headline || demo.preset.newsContent || '').slice(0, 90)}”
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <footer className="px-5 py-3 border-t border-border bg-bg-elev/40 text-[10px] mono uppercase tracking-widest text-text-dim shrink-0 flex items-center justify-between">
          <span>Tekan ESC untuk tutup</span>
          <span className="text-accent">{CAROUSEL_DEMOS.length} demo · ready to customize</span>
        </footer>
      </div>
    </div>
  );
}
