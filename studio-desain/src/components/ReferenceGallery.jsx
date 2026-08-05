import { Image as ImageIcon } from 'lucide-react';
import { MODE_REFERENCES } from '../data/affiliateDemos.js';

/**
 * Reference image gallery — tampil di atas form affiliate mode
 * Inspirasi visual: 4 gambar contoh output sesuai mode.
 */
export default function ReferenceGallery({ mode }) {
  const refs = MODE_REFERENCES[mode] || [];
  if (refs.length === 0) return null;

  const LABELS = {
    logoaffiliate: 'Contoh Visual Output — Logo Style Reference',
    tryonaffiliate: 'Contoh Visual Output — Try-On Style Reference',
    reviewaffiliate: 'Contoh Visual Output — Review Style Reference',
    storyboardaffiliate: 'Contoh Visual Output — Storyboard Moodboard',
    ugcaffiliate: 'Contoh Visual Output — UGC Style Reference',
  };
  const title = LABELS[mode] || 'Visual Reference';

  return (
    <div className="surface overflow-hidden mb-4">
      <header className="px-4 py-2.5 border-b border-border bg-bg-elev/40 flex items-center gap-2">
        <ImageIcon className="w-3.5 h-3.5 text-accent" />
        <div className="flex-1 min-w-0">
          <div className="text-[10px] mono uppercase tracking-widest text-text-mut truncate">{title}</div>
          <div className="text-[10px] text-text-dim mt-0.5">Inspirasi look & feel — bukan output langsung, melainkan style yang prompt akan hasilkan</div>
        </div>
      </header>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3">
        {refs.map((ref, i) => (
          <div key={i} className="surface-elev overflow-hidden group">
            <div className="aspect-[3/2] bg-bg-deep overflow-hidden relative">
              <img
                src={ref.image}
                alt={ref.label}
                loading="lazy"
                className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const parent = e.currentTarget.parentElement;
                  if (parent && !parent.querySelector('.img-fb')) {
                    const fb = document.createElement('div');
                    fb.className = 'img-fb absolute inset-0 flex items-center justify-center bg-gradient-to-br from-accent-sm to-bg-elev text-accent text-xl';
                    fb.textContent = '✨';
                    parent.appendChild(fb);
                  }
                }}
              />
            </div>
            <div className="px-2 py-1.5 text-[10px] text-text-mut truncate border-t border-border bg-bg-elev/40">
              {ref.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
