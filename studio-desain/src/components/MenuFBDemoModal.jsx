import { useState, useMemo } from 'react';
import { X, Search, Image as ImageIcon, UtensilsCrossed } from 'lucide-react';
import { getDemoIcon } from './demoIcons.js';
import { MENU_FB_DEMOS } from '../data/menuFBDemos.js';

/**
 * Demo picker khusus untuk Menu F&B mode.
 * Each card shows a real AI-generated thumbnail preview (from /landing/menu-fb/<id>.jpg)
 * so users can see what each template will produce before picking.
 * Graceful fallback to themed placeholder if image not yet generated.
 */
export default function MenuFBDemoModal({ open, onClose, onPick }) {
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return MENU_FB_DEMOS;
    return MENU_FB_DEMOS.filter(
      (d) =>
        d.label.toLowerCase().includes(s) ||
        d.theme.toLowerCase().includes(s) ||
        (d.preset.brand || '').toLowerCase().includes(s),
    );
  }, [q]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="surface shadow-panel w-full max-w-5xl max-h-[90vh] flex flex-col animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-base font-semibold">Pilih Demo Menu F&B</h2>
            <p className="text-xs text-text-mut mt-0.5">
              9 template siap pakai — preview hasil AI di atas, klik untuk auto-fill form.
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-md hover:bg-bg-elev flex items-center justify-center text-text-mut">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim pointer-events-none z-10" />
            <input
              type="text"
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari demo (misal: patisserie, korean, indo heritage)..."
              className="input"
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {filtered.length === 0 ? (
            <div className="text-center text-sm text-text-mut py-10">Tidak ada demo yang cocok.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((d) => (
                <DemoCard key={d.id} demo={d} onPick={() => { onPick(d); onClose(); }} />
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-border text-[10px] text-text-dim mono uppercase tracking-widest">
          {MENU_FB_DEMOS.length} demo tersedia · klik untuk auto-fill Menu F&B · prompt baru per-theme (visual DNA + force-render text)
        </div>
      </div>
    </div>
  );
}

// ─── Demo card with thumbnail preview ─────────────────────────────────────
function DemoCard({ demo, onPick }) {
  const Icon = getDemoIcon(demo.icon, UtensilsCrossed);
  const [imgFailed, setImgFailed] = useState(false);
  const catCount = (demo.preset.categories || []).length;
  const itemCount = (demo.preset.categories || []).reduce(
    (a, c) => a + ((c.items || []).length),
    0,
  );
  const thumbnailSrc = `/landing/menu-fb/${demo.id}.jpg`;

  return (
    <button
      onClick={onPick}
      className="surface-elev p-2 text-left flex flex-col gap-2 hover:border-accent transition group overflow-hidden"
    >
      {/* Thumbnail preview — AI generated demo image OR themed placeholder */}
      <div
        className="aspect-[4/5] w-full rounded-md overflow-hidden border border-border relative"
        style={{
          background: demo.preset.secondaryColor || '#fdf2e9',
        }}
      >
        {!imgFailed ? (
          <img
            src={thumbnailSrc}
            alt={demo.label}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <ThemedPlaceholder demo={demo} Icon={Icon} />
        )}

        {/* Theme badge overlay */}
        <div
          className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[8px] mono uppercase tracking-widest font-bold"
          style={{
            background: 'rgba(0,0,0,0.65)',
            color: '#fff',
            backdropFilter: 'blur(4px)',
          }}
        >
          {demo.theme}
        </div>
      </div>

      {/* Info row */}
      <div className="px-1.5 pb-1 flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 border"
            style={{
              background: demo.preset.secondaryColor || '#fdf2e9',
              borderColor: demo.preset.primaryColor || '#7c1d2e',
            }}
          >
            <Icon className="w-3.5 h-3.5" style={{ color: demo.preset.primaryColor || '#7c1d2e' }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold leading-tight truncate">{demo.label}</div>
            <div className="text-[10px] text-text-dim truncate">{demo.preset.brand}</div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1.5 text-[9px] mono uppercase tracking-widest text-text-dim">
            <span>{catCount} kat</span>
            <span>·</span>
            <span>{itemCount} item</span>
            {demo.preset.pageCount > 1 && (
              <>
                <span>·</span>
                <span>{demo.preset.pageCount}p</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1">
            <div
              className="w-3 h-3 rounded-full border border-border"
              style={{ background: demo.preset.primaryColor }}
              title="Primary"
            />
            <div
              className="w-3 h-3 rounded-full border border-border"
              style={{ background: demo.preset.secondaryColor }}
              title="Secondary"
            />
          </div>
        </div>
      </div>
    </button>
  );
}

// ─── Themed placeholder (when thumbnail not generated yet) ────────────────
function ThemedPlaceholder({ demo, Icon }) {
  const primary = demo.preset.primaryColor || '#7c1d2e';
  const secondary = demo.preset.secondaryColor || '#fdf2e9';

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center gap-2 px-3 text-center"
      style={{ background: `linear-gradient(135deg, ${secondary} 0%, ${primary}15 100%)` }}
    >
      <Icon className="w-10 h-10" style={{ color: primary, opacity: 0.5 }} />
      <div className="text-[10px] mono uppercase tracking-widest opacity-60" style={{ color: primary }}>
        Preview segera hadir
      </div>
    </div>
  );
}
