import { useState, useEffect } from 'react';
import { X, HandCoins, Users, Mail, Share2, ExternalLink, Sparkles, TrendingUp, Clock } from 'lucide-react';

import { CONFIG } from '../config.js';
const REFERRAL_URL = CONFIG.affiliateUrl;
const PER_SIGNUP = CONFIG.affiliatePerSignup; // komisi per pendaftaran (diatur di config)

const rupiah = (n) => 'Rp' + new Intl.NumberFormat('id-ID').format(Math.round(n));

const PRESETS = [10, 50, 100, 500, 1000];

/**
 * Modal Program Affiliate AI — "Jadi Affiliate".
 * Setiap orang yang daftar dari link kamu = komisi (CONFIG.affiliatePerSignup).
 * Kalkulator interaktif untuk brainstorming potensi penghasilan + CTA daftar.
 */
export default function AffiliateProgramModal({ open, onClose }) {
  const [count, setCount] = useState(100);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  const total = count * PER_SIGNUP;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-md flex items-end sm:items-center justify-center px-3 sm:px-6 py-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="surface w-full max-w-lg max-h-[92vh] overflow-y-auto animate-slide-up rounded-t-2xl sm:rounded-2xl shadow-panel"
        onClick={(e) => e.stopPropagation()}
        style={{ boxShadow: '0 24px 80px -20px rgba(0,0,0,0.7), 0 0 0 1px var(--border)' }}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-border bg-bg-elev/40 flex items-center justify-between gap-3 sticky top-0 z-10 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center shadow-[0_0_18px_rgba(var(--accent-rgb),0.5)]">
              <HandCoins className="w-5 h-5 text-white" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-bold">Jadi Affiliate AI</div>
              <div className="text-[10px] mono uppercase tracking-widest text-text-dim">{CONFIG.brandName} Affiliate Program</div>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-md hover:bg-bg-elev flex items-center justify-center text-text-mut">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Hook */}
          <div className="text-center">
            <div className="inline-flex items-center gap-1.5 text-[10px] mono uppercase tracking-widest text-accent bg-accent-sm px-2.5 py-1 rounded-full">
              <Sparkles className="w-3 h-3" /> Passive income dari sharing
            </div>
            <h3 className="text-xl font-bold mt-3 leading-snug">
              Setiap orang yang daftar dari link kamu,
              <br className="hidden sm:block" /> kamu dapat <span className="text-grad-red">{rupiah(PER_SIGNUP)}</span>
            </h3>
            <p className="text-xs text-text-mut mt-2">
              Bagikan link affiliate-mu. Tiap pendaftaran berhasil = komisi masuk. Makin banyak yang join, makin besar penghasilanmu.
            </p>
          </div>

          {/* Kalkulator brainstorming */}
          <div className="surface-elev p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2 text-xs font-semibold">
                <Users className="w-4 h-4 text-accent" /> Kalau <span className="text-accent">{count}</span> orang join
              </div>
              <div className="text-[10px] mono text-text-dim">× {rupiah(PER_SIGNUP)}</div>
            </div>

            {/* Total earning */}
            <div className="text-center py-3 rounded-lg bg-bg-deep border border-border">
              <div className="text-[10px] mono uppercase tracking-widest text-text-dim">Potensi penghasilan</div>
              <div className="text-3xl sm:text-4xl font-black text-grad-red mt-1 tabular-nums">{rupiah(total)}</div>
            </div>

            {/* Slider */}
            <input
              type="range"
              min={1}
              max={1000}
              step={1}
              value={count}
              onChange={(e) => setCount(+e.target.value)}
              className="w-full mt-4 accent-accent cursor-pointer"
            />
            <div className="flex justify-between text-[9px] mono text-text-dim mt-1">
              <span>1</span><span>1000 orang</span>
            </div>

            {/* Presets */}
            <div className="flex flex-wrap gap-2 mt-3">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  onClick={() => setCount(p)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition ${
                    count === p
                      ? 'bg-accent text-white border-accent'
                      : 'border-border text-text-mut hover:border-accent hover:text-accent'
                  }`}
                >
                  {p} orang
                </button>
              ))}
            </div>
          </div>

          {/* Tier visual cepat */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { n: 10,  label: '10 orang' },
              { n: 100, label: '100 orang' },
              { n: 500, label: '500 orang' },
            ].map((t) => (
              <button
                key={t.n}
                onClick={() => setCount(t.n)}
                className="surface-elev p-2.5 text-center hover:border-accent transition group"
              >
                <div className="text-[9px] mono uppercase tracking-widest text-text-dim group-hover:text-accent">{t.label}</div>
                <div className="text-sm font-bold text-text mt-0.5 tabular-nums">{rupiah(t.n * PER_SIGNUP)}</div>
              </button>
            ))}
          </div>

          {/* Cara kerja */}
          <div>
            <div className="text-[10px] mono uppercase tracking-widest text-text-dim mb-2 flex items-center gap-1.5">
              <TrendingUp className="w-3 h-3 text-accent" /> Cara mulai
            </div>
            <ol className="space-y-2.5">
              <Step icon={ExternalLink} num={1} title="Daftar di link affiliate"
                desc="Klik tombol di bawah, daftar akun affiliate (gratis)." />
              <Step icon={Clock} num={2} title="Tunggu 1–24 jam, cek email"
                desc="Kamu akan menerima email berisi link pembayaran khusus untukmu." />
              <Step icon={Share2} num={3} title="Share link-mu"
                desc={`Sebarkan ke teman / sosial media. Tiap orang yang daftar = ${rupiah(PER_SIGNUP)} buatmu.`} />
            </ol>
          </div>

          {/* Catatan email */}
          <div className="flex items-start gap-2.5 rounded-lg border border-accent/30 bg-accent-sm/50 p-3">
            <Mail className="w-4 h-4 text-accent shrink-0 mt-0.5" />
            <p className="text-[11px] text-text leading-relaxed">
              Setelah daftar, dalam <strong>1–24 jam</strong> kamu akan dapat <strong>email berisi link pembayaran khusus</strong> untuk kamu bagikan. Pastikan cek inbox & folder spam.
            </p>
          </div>
        </div>

        {/* Footer CTA */}
        <div className="px-5 py-4 border-t border-border bg-bg-deep/40 flex items-center justify-between gap-3 sticky bottom-0 backdrop-blur-md">
          <button onClick={onClose} className="text-[10px] mono uppercase tracking-widest text-text-mut hover:text-text transition">
            Nanti dulu
          </button>
          <a
            href={REFERRAL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary !py-2.5 !px-5"
          >
            <HandCoins className="w-4 h-4" /> Daftar Jadi Affiliate <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}

function Step({ icon: Icon, num, title, desc }) {
  return (
    <li className="flex items-start gap-3">
      <div className="relative shrink-0">
        <div className="w-8 h-8 rounded-lg bg-accent-sm border border-accent/30 flex items-center justify-center">
          <Icon className="w-4 h-4 text-accent" />
        </div>
        <span className="absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full bg-accent text-white text-[9px] font-bold flex items-center justify-center">{num}</span>
      </div>
      <div className="min-w-0">
        <div className="text-xs font-semibold text-text">{title}</div>
        <div className="text-[11px] text-text-mut mt-0.5">{desc}</div>
      </div>
    </li>
  );
}
