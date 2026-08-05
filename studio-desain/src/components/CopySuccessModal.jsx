import { Check, ExternalLink, ImagePlus, Upload, Send, Sparkles, FileText, Clipboard, X, Layers } from 'lucide-react';
import { CONFIG } from '../config.js';

/**
 * 3 variants:
 * - "image"    → Banner / Youtube / Ads (mentions upload + activate image mode)
 * - "copy"     → Copy Writing (text only)
 * - "carousel" → Carousel Feeds (alur per-slide: slide 1 upload produk, slide 2+ upload hasil slide sebelumnya)
 *
 * Layout is intentionally different from a centered modal with vertical list:
 * - slides UP from bottom
 * - horizontal numbered step strip with icons
 * - 2-column detail (mockup left, steps right) on desktop
 * - dark gradient frame, neutral palette
 */
export default function CopySuccessModal({ open, onClose, kind = 'image' }) {
  if (!open) return null;
  const isCopy = kind === 'copy';
  const isCarousel = kind === 'carousel';

  const steps = isCarousel ? STEPS_CAROUSEL : isCopy ? STEPS_COPY : STEPS_IMAGE;
  const detailLines = isCarousel ? DETAIL_CAROUSEL : isCopy ? DETAIL_COPY : DETAIL_IMAGE;
  const ctaLabel = isCopy ? 'Lanjut ke ChatGPT' : 'Buka ChatGPT';
  const title = isCarousel
    ? 'Prompt carousel siap dieksekusi'
    : isCopy
      ? 'Prompt copywriting siap pakai'
      : 'Prompt visual siap dieksekusi';

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-md flex items-end sm:items-center justify-center px-4 sm:px-6 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="surface w-full max-w-2xl animate-slide-up max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-panel"
        onClick={(e) => e.stopPropagation()}
        style={{ boxShadow: '0 24px 80px -20px rgba(0,0,0,0.7), 0 0 0 1px var(--border)' }}
      >
        {/* Top bar: status + close */}
        <div className="px-5 py-3.5 flex items-center justify-between border-b border-border bg-bg-elev/40">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-8 h-8 rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center">
                <Check className="w-4 h-4 text-emerald-400" strokeWidth={3} />
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 animate-ping opacity-70" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-bold text-text">
                {title}
              </div>
              <div className="text-[10px] uppercase tracking-widest mono text-text-dim">
                copied to clipboard · ready to paste
              </div>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-md hover:bg-bg-elev flex items-center justify-center text-text-mut">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Horizontal step strip */}
        <div className="px-5 pt-5 pb-2">
          <div className={`grid gap-2 grid-cols-2 ${steps.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-4'}`}>
            {steps.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={i} className="relative">
                  <div className="surface-elev p-3 text-center h-full flex flex-col items-center">
                    <div className="w-10 h-10 rounded-xl bg-accent-sm border border-accent/30 flex items-center justify-center mb-2">
                      <Icon className="w-4 h-4 text-accent" />
                    </div>
                    <div className="text-[9px] mono uppercase tracking-widest text-text-dim">
                      {String(i + 1).padStart(2, '0')}
                    </div>
                    <div className="text-[11px] font-semibold leading-tight mt-0.5">{s.label}</div>
                  </div>
                  {i < steps.length - 1 && (
                    <div className="hidden sm:block absolute top-1/2 -right-1.5 -translate-y-1/2 z-10">
                      <svg className="w-3 h-3 text-accent/50" viewBox="0 0 12 12" fill="none">
                        <path d="M3 1L9 6L3 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Detail panel */}
        <div className="px-5 py-4 mx-5 mb-4 mt-2 surface-elev">
          <div className="flex items-center gap-2 mb-2.5">
            <span className="text-accent text-[10px]">▸</span>
            <span className="text-[10px] mono uppercase tracking-widest text-text">Detail alur</span>
          </div>
          <ol className="space-y-1.5 text-xs text-text-mut">
            {detailLines.map((line, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="mono text-text-dim shrink-0 w-4">{i + 1}.</span>
                <span dangerouslySetInnerHTML={{ __html: line }} />
              </li>
            ))}
          </ol>
        </div>

        {/* Footer actions */}
        <div className="px-5 py-4 border-t border-border bg-bg-deep/40 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="text-[10px] mono uppercase tracking-widest text-text-mut hover:text-text transition self-center sm:self-auto"
          >
            Selesai
          </button>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <a
              href={CONFIG.chatgptUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost !py-2.5 !px-4 flex-1 sm:flex-none justify-center"
            >
              Buka ChatGPT <ExternalLink className="w-3.5 h-3.5" />
            </a>
            {CONFIG.gptUrl && (
              <a
                href={CONFIG.gptUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary !py-2.5 !px-4 flex-1 sm:flex-none justify-center whitespace-nowrap"
              >
                Buka Auto Feeds AI <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──────────── Step definitions ──────────── */

const STEPS_IMAGE = [
  { icon: ExternalLink, label: 'Open Chat' },
  { icon: ImagePlus,    label: 'Mode Visual' },
  { icon: Upload,       label: 'Upload Foto' },
  { icon: Send,         label: 'Eksekusi' },
];

const STEPS_COPY = [
  { icon: ExternalLink, label: 'Open Chat' },
  { icon: Clipboard,    label: 'Paste' },
  { icon: Sparkles,     label: 'Generate' },
];

const STEPS_CAROUSEL = [
  { icon: ExternalLink, label: 'Open Chat' },
  { icon: ImagePlus,    label: 'Mode Visual' },
  { icon: Upload,       label: 'Slide 1: Produk' },
  { icon: Layers,       label: 'Slide 2+: Hasil' },
];

const DETAIL_IMAGE = [
  'Klik tombol <strong class="text-text">Buka ChatGPT</strong> di kanan bawah.',
  'Aktifkan mode <strong class="text-text">image generation</strong> di ChatGPT (icon gambar).',
  'Upload foto produk yang ingin diolah AI.',
  'Tekan <kbd class="px-1 py-0.5 rounded bg-bg-deep border border-border mono text-[10px]">Ctrl+V</kbd> — prompt sudah otomatis tersalin.',
  'Kirim pesan, biarkan AI render desainmu.',
];

const DETAIL_COPY = [
  'Klik tombol <strong class="text-text">Lanjut ke ChatGPT</strong> di kanan bawah.',
  'Tekan <kbd class="px-1 py-0.5 rounded bg-bg-deep border border-border mono text-[10px]">Ctrl+V</kbd> — prompt copywriting sudah otomatis tersalin.',
  'Kirim — kamu akan dapat puluhan variasi copy siap A/B test.',
];

const DETAIL_CAROUSEL = [
  'Klik tombol <strong class="text-text">Buka ChatGPT</strong> di kanan bawah.',
  'Aktifkan mode <strong class="text-text">image generation</strong> di ChatGPT (icon gambar).',
  '<strong class="text-text">Prompt 1:</strong> upload gambar utama / produk asli, lalu <kbd class="px-1 py-0.5 rounded bg-bg-deep border border-border mono text-[10px]">Ctrl+V</kbd> & kirim.',
  '<strong class="text-text">Prompt 2 dan seterusnya:</strong> upload gambar <strong class="text-text">hasil slide sebelumnya</strong>, lalu paste prompt slide itu & kirim.',
  'Ulangi tiap slide berurutan sampai carousel lengkap jadi satu kesatuan.',
];
