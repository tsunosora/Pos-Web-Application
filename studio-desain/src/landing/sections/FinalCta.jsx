import { ArrowRight, Sparkles } from 'lucide-react';
import GlowOrb from '../primitives/GlowOrb.jsx';
import ScanlineGrid from '../primitives/ScanlineGrid.jsx';

import { CONFIG } from '../../config.js';
const CTA_HREF = CONFIG.paymentUrl;

export default function FinalCta() {
  return (
    <section className="relative py-28 overflow-hidden">
      <GlowOrb size={720} color="rgba(var(--accent-rgb),0.22)" className="left-1/2 -translate-x-1/2 top-0" />
      <ScanlineGrid dots />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 text-center reveal">
        <span className="eyebrow"><span className="dot" /> waktunya pindah</span>
        <h2 className="h-display mt-5">
          Berhenti nungguin designer.
          <br />
          <span className="text-grad-red">Mulai render hari ini.</span>
        </h2>
        <p className="mt-5 text-text-mut max-w-2xl mx-auto text-base">
          Visual brand kamu udah ketinggalan satu minggu. {CONFIG.brandName} bisa mengembalikannya
          dalam satu jam pertama akses. Ambil early access sebelum kuota batch 1 habis.
        </p>

        <div className="mt-9 flex flex-col sm:flex-row gap-3 items-center justify-center">
          <a href={CTA_HREF} target="_blank" rel="noreferrer" className="btn-cta !text-base !px-8 !py-4">
            <Sparkles className="w-5 h-5" />
            Bayar Rp {CONFIG.price} — Akses Selamanya
            <ArrowRight className="w-5 h-5" />
          </a>
        </div>

        <div className="mt-6 text-[10px] mono uppercase tracking-widest text-text-dim">
          Akses instan setelah pembayaran · selamanya
        </div>
      </div>
    </section>
  );
}
