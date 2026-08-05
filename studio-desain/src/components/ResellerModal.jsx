import { useEffect } from 'react';
import { X, Store, Check, ExternalLink, Zap } from 'lucide-react';
import { CONFIG } from '../config.js';

const FEATURES = [
  'File website lengkap + sistem login & akses tools member — siap upload (tanpa coding)',
  'Jual ulang sepuasnya — 100% keuntungan jadi milikmu, tanpa bagi hasil',
  'Panduan setup lengkap + tool ganti password (tanpa coding)',
  'Rebrand bebas: nama, logo, warna, harga, link pembayaran sendiri',
  'Login pelanggan pakai Google Spreadsheet — tanpa biaya bulanan / server / API',
  '12 mode (termasuk Carousel & 9 Feed Konsisten) + 4 Affiliate Tools + update fitur ke depan ikut',
];

/**
 * Popup Lisensi Reseller (Hak Jual Kembali) — info penawaran 100% profit
 * + CTA ke link checkout. Dibuka dari tombol emas di sidebar /app.
 */
export default function ResellerModal({ open, onClose }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-md flex items-end sm:items-center justify-center px-3 sm:px-6 py-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="surface w-full max-w-lg max-h-[92vh] overflow-y-auto animate-slide-up rounded-t-2xl sm:rounded-2xl shadow-panel"
        onClick={(e) => e.stopPropagation()}
        style={{ boxShadow: '0 24px 80px -20px rgba(0,0,0,0.7), 0 0 0 1px rgba(234,179,8,0.30)' }}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-border bg-bg-elev/40 flex items-center justify-between gap-3 sticky top-0 z-10 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br from-amber-400 to-amber-600 shadow-[0_0_18px_rgba(234,179,8,0.5)]">
              <Store className="w-5 h-5 text-white" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-bold">Hak Jual Kembali</div>
              <div className="text-[10px] mono uppercase tracking-widest text-amber-400">Lisensi Whitelabel · Profit 100%</div>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-md hover:bg-bg-elev flex items-center justify-center text-text-mut">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Hook + harga */}
          <div className="text-center">
            <div className="inline-flex items-center gap-1.5 text-[10px] mono uppercase tracking-widest text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-full border border-amber-400/30">
              <Zap className="w-3 h-3" /> Jual ulang, untung penuh
            </div>
            <div className="mt-4 flex flex-col items-center gap-1">
              {CONFIG.resellerStrike && (
                <span className="text-text-dim text-base line-through mono">Rp {CONFIG.resellerStrike}</span>
              )}
              <span className="text-4xl sm:text-5xl font-black leading-none text-amber-400">
                Rp {CONFIG.resellerPrice}
              </span>
            </div>
            <p className="text-[10px] mono uppercase tracking-widest text-text-dim mt-2">
              Sekali bayar · File + panduan lengkap · Keuntungan 100% milikmu
            </p>
          </div>

          {/* Fitur */}
          <div className="surface-elev p-4 space-y-2.5">
            {FEATURES.map((f, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="w-4 h-4 rounded-full bg-amber-400/15 border border-amber-400/40 flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-2.5 h-2.5 text-amber-400" />
                </span>
                <span className="text-xs text-text-mut leading-snug">{f}</span>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div>
            <a
              href={CONFIG.resellerPaymentUrl || '#'}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => { if (!CONFIG.resellerPaymentUrl) return; }}
              className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl font-bold text-white bg-gradient-to-b from-amber-400 to-amber-600 hover:brightness-110 transition shadow-[0_12px_28px_-8px_rgba(234,179,8,0.55)]"
            >
              <Zap className="w-4 h-4" /> Ambil Lisensi Reseller <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <p className="text-[9px] mono uppercase tracking-widest text-text-dim text-center mt-3">
              Cocok untuk yang mau punya produk digital sendiri
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
