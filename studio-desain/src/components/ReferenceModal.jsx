import { useEffect } from 'react';
import { X, Check } from 'lucide-react';

/**
 * Per-option reference modal — shows a grid of dropdown options,
 * each with its own preview image. Click an option to select & close.
 *
 * @param open        boolean
 * @param onClose     fn
 * @param title       string
 * @param subtitle    string (optional)
 * @param options     array of strings or {value,label}
 * @param getImageSrc fn(value) -> image path
 * @param aspect      '1/1' | '16/9' | '4/5'
 * @param currentValue string (highlight active option)
 * @param onSelect    fn(value) — optional, picks value & closes
 */
export default function ReferenceModal({
  open, onClose, title, subtitle,
  options, getImageSrc,
  aspect = '1/1', currentValue, onSelect,
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const aspectClass =
    aspect === '16/9' ? 'aspect-video' :
    aspect === '4/5'  ? 'aspect-[4/5]' :
                        'aspect-square';

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="surface w-full max-w-5xl max-h-[90vh] flex flex-col shadow-panel"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-border flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-text truncate">{title}</h3>
            {subtitle && <p className="text-xs text-text-mut mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 w-9 h-9 rounded-md hover:bg-bg-elev flex items-center justify-center text-text-mut hover:text-text transition-colors"
            aria-label="Tutup"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Grid body */}
        <div className="overflow-y-auto p-5 sm:p-6">
          <div className={`grid gap-4 ${
            aspect === '16/9'
              ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
              : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
          }`}>
            {options.map((opt) => {
              const value = typeof opt === 'object' ? opt.value : opt;
              const label = typeof opt === 'object' ? opt.label : opt;
              const src = getImageSrc(value);
              const isActive = value === currentValue;
              return (
                <button
                  key={String(value)}
                  type="button"
                  onClick={() => { onSelect?.(value); onClose(); }}
                  className={`group relative text-left soft-border overflow-hidden transition-all ${
                    isActive
                      ? '!border-accent shadow-[0_0_24px_rgba(var(--accent-rgb),0.4)]'
                      : 'hover:border-border-strong hover:-translate-y-0.5'
                  }`}
                >
                  <div className={`relative ${aspectClass} bg-bg-deep overflow-hidden`}>
                    <img
                      src={src}
                      alt={label}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      onError={(e) => {
                        const div = e.currentTarget.parentElement;
                        if (div && !div.querySelector('.ref-fallback')) {
                          e.currentTarget.style.display = 'none';
                          const fb = document.createElement('div');
                          fb.className = 'ref-fallback absolute inset-0 flex flex-col items-center justify-center gap-2 p-3 text-center';
                          // textContent (bukan innerHTML) → label tidak bisa menyuntik HTML
                          const s1 = document.createElement('span');
                          s1.className = 'text-[9px] mono uppercase tracking-widest text-text-dim';
                          s1.textContent = 'coming soon';
                          const s2 = document.createElement('span');
                          s2.className = 'text-xs font-semibold text-text-mut';
                          s2.textContent = label;
                          fb.append(s1, s2);
                          div.appendChild(fb);
                        }
                      }}
                    />
                    {isActive && (
                      <span className="absolute top-2 right-2 inline-flex w-6 h-6 rounded-full bg-accent text-white items-center justify-center shadow-lg">
                        <Check className="w-3.5 h-3.5" strokeWidth={3} />
                      </span>
                    )}
                    <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/85 via-black/40 to-transparent">
                      <div className="text-xs font-semibold text-white truncate drop-shadow">{label}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-3 border-t border-border text-[10px] mono uppercase tracking-widest text-text-dim flex items-center justify-between bg-bg-deep/40 shrink-0">
          <span>Klik gambar untuk pilih · ESC untuk tutup</span>
          <span>{options.length} pilihan</span>
        </div>
      </div>
    </div>
  );
}
