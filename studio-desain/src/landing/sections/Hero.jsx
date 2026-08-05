import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowRight, Sparkles, Play, Layers, ShieldCheck, Image as ImageIcon, Youtube, Megaphone, PencilLine, ScanFace, UtensilsCrossed, MousePointer2, Wand2 } from 'lucide-react';
import GlowOrb from '../primitives/GlowOrb.jsx';
import ScanlineGrid from '../primitives/ScanlineGrid.jsx';
import NeonBorder from '../primitives/NeonBorder.jsx';
import SafeImage from '../primitives/SafeImage.jsx';
import SampleAdCard from '../primitives/SampleAdCard.jsx';

import { CONFIG } from '../../config.js';
const CTA_HREF = CONFIG.paymentUrl;

export default function Hero() {
  return (
    <section id="top" className="relative pt-32 pb-20 sm:pt-40 sm:pb-28 overflow-hidden">
      <GlowOrb size={600} className="-top-40 -left-40" color="rgba(var(--accent-rgb),0.18)" />
      <GlowOrb size={520} className="top-20 right-[-160px]" color="rgba(var(--accent-rgb),0.18)" />
      <ScanlineGrid />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 grid lg:grid-cols-[1.05fr_1fr] gap-12 lg:gap-14 items-center">
        {/* Copy column — TANPA .reveal: konten hero harus langsung tampil,
            tidak boleh menunggu animasi (di iOS/HP animasi kadang tak jalan
            di first paint → headline tak pernah muncul). */}
        <div>
          <span className="eyebrow">
            <span className="dot" /> EARLY ACCESS · BATCH PERTAMA
          </span>

          <h1 className="h-display mt-5">
            Tanpa Designer, Buat Konten Ala <span className="text-grad-red">Desain Grafis Profesional</span>
            <br className="hidden sm:block" />
            {' '}dalam Hitungan Detik
          </h1>

          <p className="mt-5 text-base sm:text-lg text-text-mut leading-relaxed max-w-xl">
            Generate <span className="text-text">desain iklan profesional</span> untuk
            feed, ads, dan branding hanya dalam beberapa detik. Tanpa belajar desain,
            tanpa langganan tool mahal, tanpa nunggu revisi tiga hari.
          </p>

          <div className="mt-7 flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <a href="#harga" className="btn-cta">
              <Sparkles className="w-4 h-4" />
              Ambil Early Access — Rp {CONFIG.price}
              <ArrowRight className="w-4 h-4" />
            </a>
            <a href="#contoh" className="btn-cta-ghost">
              <Play className="w-4 h-4" />
              Lihat Hasil Generate
            </a>
          </div>

          {/* Mini trust strip */}
          <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-text-dim">
            <span className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-accent" /> Sekali bayar — seumur hidup</span>
            <span className="flex items-center gap-1.5"><Layers className="w-3.5 h-3.5 text-accent" /> 12 mode kreatif</span>
            <span className="flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-accent" /> 48+ kategori siap pakai</span>
          </div>
        </div>

        {/* Visual column — juga tanpa .reveal (above the fold) */}
        <div className="relative">
          <NeonBorder className="p-2 shadow-[0_30px_80px_-20px_rgba(var(--accent-rgb),0.45)]">
            <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-bg-deep scanlines">
              <AutoFeedsMockup />
              {/* HUD overlay */}
              <div className="absolute top-3 right-3 mono text-[10px] text-text-dim uppercase tracking-widest z-20">
                af-studio · v2.1
              </div>
            </div>
          </NeonBorder>

          {/* Floating stats */}
          <div className="absolute -bottom-6 -left-4 sm:-left-8 soft-border px-4 py-3 bg-bg-panel/95 backdrop-blur shadow-panel hidden sm:block float-slow">
            <div className="text-[9px] mono uppercase tracking-widest text-text-dim">Rata-rata</div>
            <div className="stat-num text-lg text-accent">{`< 30 detik`}</div>
            <div className="text-[10px] text-text-mut">brief → visual</div>
          </div>

          <div className="absolute -top-5 -right-3 sm:-right-6 soft-border px-4 py-3 bg-bg-panel/95 backdrop-blur shadow-panel hidden sm:block float-slow" style={{ animationDelay: '1.5s' }}>
            <div className="text-[9px] mono uppercase tracking-widest text-text-dim">Format</div>
            <div className="stat-num text-lg text-accent">Multi-rasio</div>
            <div className="text-[10px] text-text-mut">IG · TT · YT · Story</div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════
//   AUTO FEEDS STUDIO MOCKUP — multi-phase animated demo
//   Phases: cursor moves through fields → click generate →
//   studio dissolves with futuristic effect →
//   floating result collage appears (no render-in-platform).
// ═══════════════════════════════════════════════════════
const DEMOS = [
  { brand: 'AuraSkin',     headline: 'Premium Sunscreen SPF 50',     style: 'Minimal Clean',    accent: '#f472b6',
    results: ['/landing/ads-1x1/ig-01.jpg', '/landing/ads-1x1/ig-13.jpg', '/landing/ads-9x16/vert-02.jpg', '/landing/ads-typography/typo-11.jpg', '/landing/ads-1x1/ig-08.jpg'] },
  { brand: 'GoldHeritage', headline: '24K Pendant — Eid Edition',    style: 'Luxury Premium',   accent: '#ca8a04',
    results: ['/landing/ads-1x1/ig-10.jpg', '/landing/ads-typography/typo-12.jpg', '/landing/ads-1x1/ig-04.jpg', '/landing/ads-9x16/vert-06.jpg', '/landing/ads-1x1/ig-08.jpg'] },
  { brand: 'AutoLux',      headline: 'Sedan 2026 — Hybrid Engine',   style: 'Dark Neon',        accent: '#3b82f6',
    results: ['/landing/ads-1x1/ig-19.jpg', '/landing/ads-1x1/ig-20.jpg', '/landing/ads-16x9/yt-14.jpg', '/landing/ads-typography/typo-07.jpg', '/landing/ads-9x16/vert-19.jpg'] },
  { brand: 'ModeKita',     headline: 'Drop SS26 — Editorial Series', style: 'Dark Editorial',   accent: '#dc2626',
    results: ['/landing/ads-1x1/ig-04.jpg', '/landing/ads-typography/typo-13.jpg', '/landing/ads-1x1/ig-10.jpg', '/landing/ads-9x16/vert-01.jpg', '/landing/ads-1x1/ig-17.jpg'] },
  { brand: 'HomeNest',     headline: 'Walnut Dining Table',          style: 'Warm & Cozy',      accent: '#92400e',
    results: ['/landing/ads-1x1/ig-11.jpg', '/landing/ads-1x1/ig-12.jpg', '/landing/ads-9x16/vert-08.jpg', '/landing/ads-typography/typo-06.jpg', '/landing/ads-1x1/ig-13.jpg'] },
];

// Phase timing (ms from start of cycle)
const PHASES = [
  { name: 'cursor-brand',  at:    0 },
  { name: 'cursor-style',  at: 1500 },
  { name: 'cursor-ratio',  at: 3000 },
  { name: 'cursor-gen',    at: 4400 },
  { name: 'clicking',      at: 5400 },
  { name: 'dissolving',    at: 5800 },
  { name: 'results',       at: 6700 },
  { name: 'reset',         at:12500 },
];
const CYCLE_MS = 13500;

// Cursor mengikuti posisi elemen sebenarnya (diukur via ref di StudioUI),
// bukan koordinat persen hardcoded — supaya selalu pas di field/tombol di
// semua ukuran layar (termasuk HP, di mana ukuran field bergeser).
const PHASE_TARGET = {
  'cursor-brand': 'brand',
  'cursor-style': 'style',
  'cursor-ratio': 'ratio',
  'cursor-gen':   'gen',
  'clicking':     'gen',
  'dissolving':   'gen',
};

function AutoFeedsMockup() {
  const [idx, setIdx]     = useState(0);
  const [phase, setPhase] = useState('cursor-brand');

  // Drive phase timeline + cycle
  useEffect(() => {
    setPhase('cursor-brand');
    const timers = PHASES.map((p) =>
      setTimeout(() => setPhase(p.name), p.at)
    );
    const nextDemo = setTimeout(() => setIdx((i) => (i + 1) % DEMOS.length), CYCLE_MS);
    return () => { timers.forEach(clearTimeout); clearTimeout(nextDemo); };
  }, [idx]);

  const d = DEMOS[idx];
  const inStudio = ['cursor-brand', 'cursor-style', 'cursor-ratio', 'cursor-gen', 'clicking'].includes(phase);
  const isDissolving = phase === 'dissolving';
  const inResults = phase === 'results' || phase === 'reset';

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Layer 1: Studio (visible during cursor/click/dissolve phases) */}
      {(inStudio || isDissolving) && (
        <div
          key={`studio-${idx}`}
          className={`absolute inset-0 studio-reveal ${isDissolving ? 'pixel-shatter' : ''}`}
        >
          <StudioUI demo={d} phase={phase} />
        </div>
      )}

      {/* Layer 2: Holographic dissolve scanline */}
      {isDissolving && (
        <div className="absolute inset-x-0 top-0 h-16 dissolve-scanline pointer-events-none z-30"
             style={{
               background: 'linear-gradient(180deg, transparent, rgba(var(--accent-rgb),0.6), transparent)',
               boxShadow: '0 0 40px rgba(var(--accent-rgb),0.8)',
             }}
        />
      )}

      {/* Layer 3: Generate burst */}
      {isDissolving && (
        <div className="absolute z-30 pointer-events-none gen-burst rounded-full"
             style={{
               left: '80%', top: '92%', width: 40, height: 40,
               transform: 'translate(-50%, -50%)',
               background: `radial-gradient(circle, ${d.accent} 0%, transparent 70%)`,
             }}
        />
      )}

      {/* Layer 4: Results collage */}
      {inResults && (
        <ResultCollage key={`res-${idx}`} demo={d} />
      )}

      {/* Background grid */}
      <div className="absolute inset-0 grid-bg grid-bg-fade opacity-20 pointer-events-none" />
    </div>
  );
}

// ────────────── STUDIO UI (cursor + highlighted fields) ──────────────
function StudioUI({ demo: d, phase }) {
  const mainRef  = useRef(null);
  const brandRef = useRef(null);
  const styleRef = useRef(null);
  const ratioRef = useRef(null);
  const genRef   = useRef(null);
  const [cursor, setCursor] = useState(null); // {x,y} px relatif ke main, atau null (belum diukur)

  const hl = {
    brand: phase === 'cursor-brand',
    style: phase === 'cursor-style',
    ratio: phase === 'cursor-ratio',
    gen:   phase === 'cursor-gen' || phase === 'clicking',
  };

  // Ukur posisi target sebenarnya → cursor selalu pas di semua ukuran layar.
  useLayoutEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    const key = PHASE_TARGET[phase] || 'brand';
    const targetEl = { brand: brandRef, style: styleRef, ratio: ratioRef, gen: genRef }[key]?.current;
    if (!targetEl) return;
    const compute = () => {
      const c = main.getBoundingClientRect();
      const r = targetEl.getBoundingClientRect();
      if (!c.width || !r.width) return;
      const isBtn = key === 'gen';
      // Tombol: bidik tengah. Field input: bidik agak ke kiri (seperti hover di teks).
      const x = r.left - c.left + (isBtn ? r.width / 2 : Math.min(r.width * 0.22, 38));
      const y = r.top - c.top + r.height / 2;
      setCursor({ x, y });
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, [phase, d]);

  return (
    <div className="absolute inset-0 flex flex-col bg-[#0a0405]">
      {/* Browser chrome */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[#1a0d0e] border-b border-border shrink-0">
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
        </div>
        <div className="flex-1 mx-3 px-2.5 py-0.5 rounded-md bg-bg-deep border border-border text-[9px] mono text-text-mut text-center">
          🔒 app.brandmu.id/studio
        </div>
        <span className="text-[9px] mono text-accent uppercase tracking-widest">● LIVE</span>
      </div>

      {/* App body */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <div className="w-9 sm:w-11 bg-[#150506] border-r border-border flex flex-col items-center py-2 gap-1.5 shrink-0">
          <div className="w-7 h-7 rounded-md bg-accent flex items-center justify-center text-white font-black text-[10px] shadow-[0_0_10px_rgba(var(--accent-rgb),0.55)]">F</div>
          <div className="w-7 h-px bg-border my-0.5" />
          <SideIcon icon={ImageIcon} active />
          <SideIcon icon={Youtube} />
          <SideIcon icon={Megaphone} />
          <SideIcon icon={PencilLine} />
          <SideIcon icon={ScanFace} />
          <SideIcon icon={UtensilsCrossed} />
        </div>

        {/* Main content (positioning ref for cursor) */}
        <div ref={mainRef} className="flex-1 relative">
          {/* Form */}
          <div className="absolute inset-0 p-3 sm:p-4">
            <div className="text-[10px] mono uppercase tracking-widest text-text-dim mb-1">/ Banner Generator</div>
            <div className="text-sm font-bold mb-3">{d.headline}</div>

            <div className="space-y-2">
              <FormRow label="BRAND"    value={d.brand}        active={hl.brand} fieldRef={brandRef} />
              <FormRow label="HEADLINE" value={d.headline} />
              <FormRow label="STYLE"    value={d.style}        dropdown active={hl.style} accent={d.accent} fieldRef={styleRef} />
              <FormRow label="RATIO"    value="1:1 Instagram"  dropdown active={hl.ratio} accent={d.accent} fieldRef={ratioRef} />
            </div>

            <div className="mt-3 flex items-center gap-2">
              <div className="text-[8px] mono uppercase tracking-widest text-text-dim">COLOR</div>
              <span className="w-4 h-4 rounded border border-border" style={{ background: d.accent }} />
              <span className="w-4 h-4 rounded border border-border bg-white" />
            </div>

            {/* Generate button — bottom right */}
            <button
              ref={genRef}
              className={`absolute bottom-3 sm:bottom-4 right-3 sm:right-4 px-5 py-2 rounded-md bg-gradient-to-b from-[var(--accent)] to-[var(--accent-deep)] text-white text-xs font-bold flex items-center gap-1.5 border border-white/20 transition-all duration-200 ${
                hl.gen ? 'shadow-[0_0_24px_rgba(var(--accent-rgb),0.7)] scale-105' : 'shadow-md'
              } ${phase === 'clicking' ? 'scale-95' : ''}`}
            >
              <Sparkles className="w-3.5 h-3.5" strokeWidth={2.5} />
              Generate
            </button>
          </div>

          {/* Animated cursor — mengikuti posisi elemen yang diukur (px) */}
          <div
            className="absolute z-40 pointer-events-none"
            style={{
              left: cursor ? `${cursor.x}px` : '22%',
              top:  cursor ? `${cursor.y}px` : '22%',
              transform: 'translate(-2px, -2px)',
              opacity: cursor ? 1 : 0,
              transition: 'left 0.7s cubic-bezier(0.4, 0, 0.2, 1), top 0.7s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease',
            }}
          >
            <MousePointer2 className="w-4 h-4 text-white drop-shadow-[0_2px_3px_rgba(0,0,0,0.7)]" strokeWidth={2.2} fill="white" />
            {phase === 'clicking' && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full cursor-click-pulse"
                   style={{ background: `radial-gradient(circle, ${d.accent} 0%, transparent 70%)` }} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SideIcon({ icon: Icon, active }) {
  return (
    <div className={`w-7 h-7 rounded-md flex items-center justify-center ${
      active ? 'bg-accent-sm text-accent border border-border-strong' : 'text-text-dim'
    }`}>
      <Icon className="w-3.5 h-3.5" strokeWidth={2} />
    </div>
  );
}

function FormRow({ label, value, dropdown, active, accent, fieldRef }) {
  return (
    <div>
      <div className="text-[8px] mono uppercase tracking-widest text-text-dim mb-0.5">{label}</div>
      <div
        ref={fieldRef}
        className={`flex items-center gap-1 px-2 py-1.5 rounded-md bg-bg-deep text-[10px] transition-all duration-200 ${
          active ? 'border ring-2' : 'border border-border'
        }`}
        style={active ? { borderColor: accent || '#ef4444', '--tw-ring-color': (accent || '#ef4444') + '40' } : {}}
      >
        <span className="flex-1 truncate text-text">{value}</span>
        {dropdown && <span className="text-text-dim">▾</span>}
      </div>
    </div>
  );
}

// ────────────── RESULT COLLAGE (after dissolve) ──────────────
function ResultCollage({ demo }) {
  // 5 cards in scattered floating composition
  const cards = [
    { src: demo.results[0], pos: { left: '50%', top: '50%' }, rot: '-2deg',  w: '52%', z: 30, delay: 0,    accent: true },
    { src: demo.results[1], pos: { left: '18%', top: '28%' }, rot: '-10deg', w: '24%', z: 20, delay: 0.15 },
    { src: demo.results[2], pos: { left: '82%', top: '32%' }, rot: '8deg',   w: '20%', z: 20, delay: 0.25 },
    { src: demo.results[3], pos: { left: '22%', top: '78%' }, rot: '6deg',   w: '22%', z: 20, delay: 0.35 },
    { src: demo.results[4], pos: { left: '80%', top: '78%' }, rot: '-7deg',  w: '24%', z: 20, delay: 0.45 },
  ];

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center overflow-hidden">
      {/* Holo grid backdrop */}
      <div className="absolute inset-0 grid-bg opacity-40 pointer-events-none" />

      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none"
           style={{ background: `radial-gradient(ellipse at center, ${demo.accent}30 0%, transparent 60%)` }}
      />

      {/* Holographic sweeping grid */}
      <div className="absolute inset-x-0 h-32 holo-grid-sweep pointer-events-none"
           style={{
             background: `linear-gradient(180deg, transparent, ${demo.accent}40 50%, transparent)`,
             backgroundSize: '100% 8px',
             backgroundImage: `repeating-linear-gradient(180deg, transparent 0 6px, ${demo.accent}30 6px 7px)`,
           }}
      />

      {/* Cards */}
      {cards.map((c, i) => (
        <div
          key={i}
          className="absolute result-float-in rounded-xl overflow-hidden border-2 border-bg-panel shadow-2xl"
          style={{
            left: c.pos.left,
            top:  c.pos.top,
            width: c.w,
            zIndex: c.z,
            animationDelay: `${c.delay}s`,
            '--rest': `translate(-50%, -50%) rotate(${c.rot})`,
            boxShadow: c.accent
              ? `0 25px 60px -10px ${demo.accent}80, 0 0 30px ${demo.accent}40, inset 0 0 0 1px rgba(255,255,255,0.1)`
              : '0 18px 40px -8px rgba(0,0,0,0.7), 0 0 1px rgba(255,255,255,0.1)',
          }}
        >
          <div className="aspect-square bg-bg-deep">
            <SafeImage
              src={c.src}
              alt={`Contoh hasil ${CONFIG.brandName} variant ${i + 1}`}
              className="w-full h-full object-cover"
              fallback={<SampleAdCard ratio="1/1" variant={i + 1} />}
              priority={i < 3}
            />
          </div>
        </div>
      ))}

      {/* Floating brand label */}
      <div
        className="absolute top-3 left-1/2 -translate-x-1/2 result-float-in px-3 py-1 rounded-full backdrop-blur-md border z-40"
        style={{
          animationDelay: '0.6s',
          background: `${demo.accent}25`,
          borderColor: `${demo.accent}80`,
          '--rest': 'translate(-50%, 0) rotate(0)',
        }}
      >
        <span className="text-[10px] mono uppercase tracking-widest font-bold" style={{ color: demo.accent }}>
          ✨ {demo.brand} · ready
        </span>
      </div>
    </div>
  );
}
