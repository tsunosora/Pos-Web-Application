import { useState, useMemo } from 'react';
import { X, Search } from 'lucide-react';
import { getDemoIcon } from './demoIcons.js';
import { CATEGORIES } from '../data/categories.js';

export default function DemoCategoryModal({ open, onClose, onPick }) {
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return CATEGORIES;
    return CATEGORIES.filter((c) => c.label.toLowerCase().includes(s));
  }, [q]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="surface shadow-panel w-full max-w-4xl max-h-[88vh] flex flex-col animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-base font-semibold">Pilih Inspirasi Demo</h2>
            <p className="text-xs text-text-mut mt-0.5">Pilih industri untuk mengisi data demo secara otomatis ke semua mode.</p>
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
              placeholder="Cari kategori (misal: Skincare, Travel, Event)..."
              className="input"
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {filtered.length === 0 ? (
            <div className="text-center text-sm text-text-mut py-10">Tidak ada kategori yang cocok.</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {filtered.map((c) => {
                const Icon = getDemoIcon(c.icon);
                return (
                  <button
                    key={c.id}
                    onClick={() => { onPick(c); onClose(); }}
                    className="surface-elev p-3.5 text-left flex items-center gap-3 hover:bg-accent-sm hover:border-accent transition group"
                  >
                    <div className="w-9 h-9 rounded-md bg-bg-deep border border-border flex items-center justify-center group-hover:border-accent">
                      <Icon className="w-4 h-4 text-text-mut group-hover:text-accent" />
                    </div>
                    <span className="text-sm font-medium leading-tight">{c.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-border text-[10px] text-text-dim mono uppercase tracking-widest">
          {CATEGORIES.length} kategori tersedia · klik untuk auto-fill semua mode
        </div>
      </div>
    </div>
  );
}
