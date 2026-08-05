import { useEffect, useState } from 'react';
import { Check, Zap, ArrowRight, Sparkles, Infinity as InfinityIcon, Palette } from 'lucide-react';
import GlowOrb from '../primitives/GlowOrb.jsx';
import Counter from '../primitives/Counter.jsx';

import { CONFIG } from '../../config.js';
const CTA_HREF = CONFIG.paymentUrl;

// Kuota dinamis per user (cookie/localStorage):
//   - Visit pertama: 68/100
//   - Tiap hari naik +1 (cap 98, gak pernah 100)
//   - Saat countdown timer cycle reset, lompat ke nilai random 88..98
function useKuota() {
  const [value, setValue] = useState(68);
  useEffect(() => {
    try {
      const KEY_VAL = 'af_kuota_value';
      const KEY_DAY = 'af_kuota_last_day';
      const KEY_DL  = 'af_kuota_last_deadline';
      const today   = new Date().toISOString().slice(0, 10);
      const deadline= window.sessionStorage?.getItem('af_deadline');

      let v = parseInt(localStorage.getItem(KEY_VAL) || '68', 10);
      const lastDay = localStorage.getItem(KEY_DAY);
      const lastDl  = localStorage.getItem(KEY_DL);

      // Countdown cycle berubah → reset ke 88..98
      if (deadline && lastDl && deadline !== lastDl) {
        v = 88 + Math.floor(Math.random() * 11);
      }
      if (deadline) localStorage.setItem(KEY_DL, deadline);

      // Hari berbeda → increment +1 (cap 98)
      if (lastDay !== today) {
        v = Math.min(v + 1, 98);
        localStorage.setItem(KEY_DAY, today);
      }

      localStorage.setItem(KEY_VAL, String(v));
      setValue(v);
    } catch {}
  }, []);
  return value;
}

const INCLUDED = [
  '12 mode kreatif (Banner / Carousel / 9 Feed Konsisten / Thumbnail / Ads / Copy / Face Card ★ / Menu F&B ★)',
  '4 Affiliate Tools ★ (Logo · Try-On · Review · Storyboard)',
  '48+ kategori preset + 9 template Menu F&B siap pakai',
  'Unlimited render — tanpa kuota harian',
  'Multi-format output (1:1 · 9:16 · 16:9 · 4:5 · A4)',
  'Update mode & kategori baru — selamanya',
  'Akses dashboard via email kamu',
];

const toNum = (s) => parseInt(String(s).replace(/\D/g, ''), 10) || 0;

export default function Pricing() {
  const kuota = useKuota();
  // Harga dari config; badge diskon dihitung otomatis dari harga coret.
  const priceMain = CONFIG.price.split('.')[0];
  const priceRest = CONFIG.price.includes('.') ? '.' + CONFIG.price.split('.').slice(1).join('.') : '';
  const strikeNum = toNum(CONFIG.priceStrike);
  const priceNum = toNum(CONFIG.price);
  const discount = strikeNum > 0 && priceNum > 0 && priceNum < strikeNum
    ? Math.round((1 - priceNum / strikeNum) * 100)
    : null;
  return (
    <section id="harga" className="relative py-24 overflow-hidden">
      <GlowOrb size={580} color="rgba(var(--accent-rgb),0.18)" className="left-1/2 -translate-x-1/2 top-10" />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6">
        <div className="text-center reveal">
          <span className="eyebrow"><span className="dot" /> early access · batch 1</span>
          <h2 className="h-section mt-4">
            Akses penuh, <span className="text-grad-red">satu kali bayar</span>.
            <br />Selamanya.
          </h2>
          <p className="mt-4 text-text-mut max-w-xl mx-auto">
            Harga naik tiap batch. Begitu kuota batch ini <span className="text-text font-semibold">penuh</span>,
            harga langsung naik ke <span className="text-text font-semibold">Rp {CONFIG.priceStrike}</span> dan
            <span className="text-accent font-semibold"> tidak turun lagi</span>. Yang telat, bayar penuh.
          </p>
        </div>

        {/* Countdown */}
        <div className="mt-8 flex flex-col items-center gap-3 reveal reveal-d1">
          <span className="text-[10px] mono uppercase tracking-widest text-accent font-semibold">
            ⚡ Harga naik dalam
          </span>
          <Counter durationDays={7} storageKey="af_deadline" />
        </div>

        {/* Card */}
        <div className="mt-10 reveal reveal-d2">
          <div className="neon-border p-1.5 shadow-[0_30px_80px_-20px_rgba(var(--accent-rgb),0.5)]">
            <div className="rounded-[14px] bg-bg-panel p-7 sm:p-10 relative overflow-hidden">
              <div className="text-center">
                {discount !== null && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent text-white text-[10px] mono uppercase tracking-widest font-bold mb-3">
                    <Zap className="w-3 h-3" />
                    HEMAT {discount}%
                  </div>
                )}
                <div className="text-[10px] mono uppercase tracking-[0.25em] text-accent">
                  {CONFIG.brandName} · EARLY ACCESS
                </div>
                <h3 className="mt-2 text-xl font-bold">Early Access</h3>

                <div className="mt-6 flex flex-col items-center gap-1">
                  <span className="text-text-dim text-base sm:text-lg line-through mono">Rp {CONFIG.priceStrike}</span>
                  <span className="text-5xl sm:text-6xl font-black text-text whitespace-nowrap leading-none">
                    Rp {priceMain}<span className="text-3xl text-accent">{priceRest}</span>
                  </span>
                </div>

                {/* HIGHLIGHTED: Sekali bayar selamanya badge */}
                <div className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent-sm border border-border-strong shadow-[0_0_24px_rgba(var(--accent-rgb),0.25)]">
                  <InfinityIcon className="w-4 h-4 text-accent" strokeWidth={2.5} />
                  <span className="text-sm font-bold tracking-wide text-text">
                    Sekali Bayar · <span className="text-accent">Selamanya</span>
                  </span>
                </div>
                <div className="mt-2 text-[10px] mono uppercase tracking-widest text-text-dim">
                  Tanpa langganan · tanpa biaya tersembunyi
                </div>
              </div>

              {/* High-class explainer */}
              <div className="mt-7 p-4 rounded-lg bg-bg-deep border border-border flex items-start gap-3">
                <span className="inline-flex w-9 h-9 rounded-lg items-center justify-center bg-accent-sm border border-border shrink-0 mt-0.5">
                  <Palette className="w-4.5 h-4.5 text-accent" />
                </span>
                <div className="leading-relaxed">
                  <div className="text-sm font-bold text-text">Ribuan gaya visual, satu studio.</div>
                  <p className="text-xs text-text-mut mt-1">
                    {CONFIG.brandName} bisa mencetak <span className="text-text font-semibold">ribuan variasi style</span> yang
                    disesuaikan langsung dengan karakter produkmu — minimalis, luxury, edgy, playful, premium —
                    semua hasilnya <span className="text-accent font-semibold">setara karya designer profesional kelas studio</span>.
                  </p>
                </div>
              </div>

              {/* Includes */}
              <ul className="mt-7 grid sm:grid-cols-2 gap-2.5">
                {INCLUDED.map((i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-text">
                    <span className="inline-flex w-5 h-5 rounded-full bg-accent-sm border border-border items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-3 h-3 text-accent" />
                    </span>
                    {i}
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <div className="mt-8 flex flex-col items-center gap-3">
                <a href={CTA_HREF} target="_blank" rel="noreferrer" className="btn-cta !text-base !px-8 !py-4">
                  <Sparkles className="w-4.5 h-4.5" />
                  Klaim Early Access Sekarang
                  <ArrowRight className="w-4.5 h-4.5" />
                </a>
                <div className="text-[10px] mono uppercase tracking-widest text-text-dim">
                  Transfer · QRIS · OVO · Gopay · Dana
                </div>
              </div>

              {/* scarcity bar — dinamis per user */}
              <div className="mt-7 pt-6 border-t border-border">
                <div className="flex items-center justify-between text-[10px] mono uppercase tracking-widest text-text-dim mb-2">
                  <span>kuota batch 1</span>
                  <span className="text-accent">{kuota} / 100 terisi</span>
                </div>
                <div className="h-1.5 rounded-full bg-bg-deep overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent-deep)] transition-all duration-700" style={{ width: `${kuota}%` }} />
                </div>
                <div className="mt-2.5 text-[10px] mono uppercase tracking-widest text-accent font-semibold text-center">
                  ⚡ Sisa {Math.max(100 - kuota, 0)} slot · harga naik begitu penuh
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── TIER 2: Lisensi Reseller (hak jual kembali, profit 100%) ── */}
        {CONFIG.showResellerTier && (
          <div className="mt-6 reveal reveal-d3">
            <div className="soft-border rounded-2xl p-6 sm:p-8 relative overflow-hidden bg-bg-panel"
                 style={{ borderColor: 'rgba(234,179,8,0.45)' }}>
              <div className="text-center">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] mono uppercase tracking-widest font-bold mb-3"
                     style={{ background: 'linear-gradient(135deg,#eab308,#b45309)', color: '#fff' }}>
                  <Zap className="w-3 h-3" /> PROFIT 100%
                </div>
                <div className="text-[10px] mono uppercase tracking-[0.25em] leading-relaxed" style={{ color: '#eab308' }}>
                  LISENSI WHITELABEL · HAK JUAL KEMBALI
                </div>
                <h3 className="mt-2 text-xl font-bold">Jual Ulang, Untung Penuh</h3>

                <div className="mt-4 flex flex-col items-center gap-0.5">
                  <span className="text-text-dim text-base line-through mono">Rp {CONFIG.resellerStrike}</span>
                  <span className="text-4xl sm:text-5xl font-black text-text leading-none whitespace-nowrap">Rp {CONFIG.resellerPrice}</span>
                </div>
                <div className="mt-2 text-[10px] mono uppercase tracking-widest text-text-dim">
                  Sekali bayar · file + panduan lengkap · keuntungan 100% milikmu
                </div>
              </div>

              <ul className="mt-6 grid sm:grid-cols-2 gap-2.5">
                {[
                  'File website lengkap + sistem login & akses tools member — siap upload (tanpa coding)',
                  'Rebrand bebas: nama, logo, warna, harga, link pembayaran sendiri',
                  'Jual ulang sepuasnya — 100% keuntungan jadi milikmu, tanpa bagi hasil',
                  'Login pelanggan pakai Google Spreadsheet — tanpa biaya bulanan / server / API',
                  'Panduan setup lengkap + tool ganti password (tanpa coding)',
                  '12 mode (termasuk Carousel & 9 Feed Konsisten) + 4 Affiliate Tools + update fitur ke depan ikut',
                ].map((i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-text">
                    <span className="inline-flex w-5 h-5 rounded-full items-center justify-center shrink-0 mt-0.5"
                          style={{ background: 'rgba(234,179,8,0.15)', border: '1px solid rgba(234,179,8,0.4)' }}>
                      <Check className="w-3 h-3" style={{ color: '#eab308' }} />
                    </span>
                    {i}
                  </li>
                ))}
              </ul>

              <div className="mt-7 flex flex-col items-center gap-2">
                <a href={CONFIG.resellerPaymentUrl} target="_blank" rel="noreferrer"
                   className="btn-cta !text-base !px-8 !py-4"
                   style={{ background: 'linear-gradient(135deg,#eab308,#b45309)' }}>
                  <Sparkles className="w-4.5 h-4.5" />
                  Ambil Lisensi Reseller
                  <ArrowRight className="w-4.5 h-4.5" />
                </a>
                <div className="text-[10px] mono uppercase tracking-widest text-text-dim">
                  Cocok untuk yang mau punya produk digital sendiri
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
