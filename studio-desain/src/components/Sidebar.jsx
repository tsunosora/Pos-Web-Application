import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Image, Youtube, Megaphone, PencilLine, ScanFace, UtensilsCrossed,
  Wand2, Settings, PlayCircle, Sparkles, DollarSign, GalleryHorizontalEnd, HandCoins,
  Sparkles as LogoIcon, Shirt, Star, Film, Video, ChevronRight, Store, Grid3x3,
} from 'lucide-react';
import ThemeToggle from './ThemeToggle.jsx';
import { CONFIG } from '../config.js';

const MODES = [
  { id: 'banner',      icon: Image,            label: 'Design Feeds' },
  { id: 'carousel',    icon: GalleryHorizontalEnd, label: 'Carousel Feeds' },
  { id: 'gridfeed',    icon: Grid3x3,          label: '9 Feed Konsisten' },
  { id: 'thumbnail',   icon: Youtube,          label: 'Youtube' },
  { id: 'typography',  icon: Megaphone,        label: 'Ads' },
  { id: 'copywriting', icon: PencilLine,       label: 'Copy Writing' },
  { id: 'facecard',    icon: ScanFace,         label: 'Face Card' },
  { id: 'menufb',      icon: UtensilsCrossed,  label: 'Menu F&B' },
];

const AFFILIATE_MODES = [
  { id: 'logoaffiliate',       icon: LogoIcon, label: 'Logo',               desc: 'Logo brand + brand mockup' },
  { id: 'tryonaffiliate',      icon: Shirt,    label: 'Try-On Produk',      desc: 'Try-on / wear-test image' },
  { id: 'reviewaffiliate',     icon: Star,     label: 'Review Produk',      desc: 'Banner review high-converting' },
  { id: 'storyboardaffiliate', icon: Film,     label: 'Storyboard Affiliate', desc: 'Storyboard board scene-by-scene' },
];

const AFFILIATE_IDS = AFFILIATE_MODES.map((m) => m.id);

export default function Sidebar({ mode, onChangeMode, onOpenDemo, onOpenTutorial, onOpenSettings, onOpenAffiliateProgram, onOpenReseller }) {
  const [affiliateOpen, setAffiliateOpen] = useState(false);
  const [flyoutPos, setFlyoutPos] = useState({ top: 0, left: 0 });
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const affiliateRef = useRef(null);
  const buttonRef = useRef(null);
  const flyoutRef = useRef(null);

  // Track layar kecil → flyout jadi modal tengah (cegah ketutupan/kepotong di HP)
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Recompute flyout position when opened
  useEffect(() => {
    if (affiliateOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setFlyoutPos({
        top: Math.max(8, Math.min(rect.top, window.innerHeight - 300)),
        left: Math.max(8, Math.min(rect.right + 6, window.innerWidth - 288)),
      });
    }
  }, [affiliateOpen]);

  // Close flyout when clicking outside (button OR flyout)
  useEffect(() => {
    if (!affiliateOpen) return;
    const onDoc = (e) => {
      const inButton = affiliateRef.current && affiliateRef.current.contains(e.target);
      const inFlyout = flyoutRef.current && flyoutRef.current.contains(e.target);
      if (!inButton && !inFlyout) setAffiliateOpen(false);
    };
    const onScroll = () => {
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        setFlyoutPos({
        top: Math.max(8, Math.min(rect.top, window.innerHeight - 300)),
        left: Math.max(8, Math.min(rect.right + 6, window.innerWidth - 288)),
      });
      }
    };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [affiliateOpen]);

  const isAffiliateActive = AFFILIATE_IDS.includes(mode);

  // Konten menu affiliate (dipakai di flyout desktop & modal mobile)
  const affiliateMenuInner = (
    <>
      <div className="px-3 py-2.5 border-b border-border bg-bg-elev/60">
        <div className="text-[10px] mono uppercase tracking-widest text-accent flex items-center gap-1.5">
          <Sparkles className="w-3 h-3" />
          Mode Affiliate Generator
        </div>
        <div className="text-[10px] text-text-dim mt-0.5">{AFFILIATE_MODES.length} tools untuk affiliate marketer</div>
      </div>
      <div className="py-1.5">
        {AFFILIATE_MODES.map((a) => {
          const Icon = a.icon;
          const active = mode === a.id;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => { onChangeMode(a.id); setAffiliateOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-bg-elev transition text-left ${
                active ? 'bg-accent-sm border-l-2 border-l-accent' : ''
              }`}
            >
              <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${active ? 'bg-accent text-white' : 'bg-bg-elev border border-border text-text-mut'}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-xs font-semibold leading-tight ${active ? 'text-accent' : 'text-text'}`}>{a.label}</div>
                <div className="text-[10px] text-text-dim mt-0.5 truncate">{a.desc}</div>
              </div>
              <ChevronRight className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-accent' : 'text-text-dim'}`} />
            </button>
          );
        })}
      </div>
      <div className="px-3 py-2 border-t border-border bg-bg-elev/40 text-[9px] mono uppercase tracking-widest text-text-dim text-center">
        v2.1 super customizable
      </div>
    </>
  );

  return (
    <aside
      className="surface rounded-none border-y-0 border-l-0 w-[60px] lg:w-[58px] shrink-0 flex flex-col items-center pt-4 pb-5 lg:pb-4 gap-3 lg:gap-2 sticky top-14 self-start z-20 lg:top-0 overflow-y-auto hide-scrollbar"
      style={{ height: 'calc(100dvh - 3.5rem)', paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
    >
      {/* Logo */}
      <div className="w-10 h-10 mb-2 shadow-[0_0_18px_rgba(var(--accent-rgb),0.5)] rounded-lg flex items-center justify-center">
        <img
          src={CONFIG.logoUrl}
          alt={CONFIG.brandName}
          className="w-full h-full object-contain"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
            const parent = e.currentTarget.parentElement;
            if (parent && !parent.querySelector('.logo-fallback')) {
              const fb = document.createElement('span');
              fb.className = 'logo-fallback w-full h-full bg-accent flex items-center justify-center text-white font-black text-sm rounded-lg';
              fb.textContent = 'F';
              parent.appendChild(fb);
            }
          }}
        />
      </div>

      {/* Mode icons */}
      {MODES.map((m) => {
        const Icon = m.icon;
        const active = mode === m.id;
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => { onChangeMode(m.id); setAffiliateOpen(false); }}
            data-active={active}
            className="side-btn group"
            title={m.label}
          >
            <Icon className="w-5 h-5" />
            <span className="absolute left-[52px] top-1/2 -translate-y-1/2 px-2 py-1 rounded-md text-[10px] uppercase tracking-widest bg-bg-panel border border-border text-text opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition mono z-50">
              {m.label}
            </span>
          </button>
        );
      })}

      {/* Divider */}
      <div className="w-7 h-px bg-border my-2" />

      {/* Affiliate parent menu — clickable to open flyout */}
      <div className="relative w-full flex justify-center" ref={affiliateRef}>
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setAffiliateOpen((v) => !v)}
          data-active={isAffiliateActive || affiliateOpen}
          className="side-btn group"
          title="Affiliate"
        >
          <DollarSign className="w-5 h-5" />
          <span className="absolute left-[52px] top-1/2 -translate-y-1/2 px-2 py-1 rounded-md text-[10px] uppercase tracking-widest bg-bg-panel border border-border text-text opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition mono z-50">
            Affiliate
          </span>
          {/* Active dot indicator */}
          {isAffiliateActive && (
            <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_6px_rgba(var(--accent-rgb),0.8)]" />
          )}
        </button>

        {/* Submenu affiliate — di-PORTAL ke body biar lepas dari containing-block sidebar.
            HP = modal tengah (cegah ketutupan/kosong), desktop = flyout samping. */}
        {affiliateOpen && createPortal(
          isMobile ? (
            <>
              <div className="fixed inset-0 z-[9998] bg-black/55 backdrop-blur-sm animate-fade-in" onClick={() => setAffiliateOpen(false)} />
              {/* Flex wrapper buat centering (animasi transform gak bisa ganggu posisi) */}
              <div className="fixed inset-0 z-[9999] flex items-start justify-center px-4 pt-16 pointer-events-none">
                <div
                  ref={flyoutRef}
                  className="w-full max-w-[340px] max-h-[80vh] overflow-y-auto surface shadow-panel rounded-xl animate-slide-up pointer-events-auto"
                >
                  {affiliateMenuInner}
                </div>
              </div>
            </>
          ) : (
            <div
              ref={flyoutRef}
              className="fixed z-[9999] w-[280px] surface shadow-panel rounded-lg overflow-hidden animate-fade-in"
              style={{ top: flyoutPos.top, left: flyoutPos.left, animation: 'fade-in 0.15s ease-out' }}
            >
              {affiliateMenuInner}
            </div>
          ),
          document.body
        )}
      </div>

      {/* Divider */}
      <div className="w-7 h-px bg-border my-2" />

      {/* Demo trigger */}
      <button onClick={onOpenDemo} className="side-btn group" title="Randomize Demo">
        <Wand2 className="w-5 h-5" />
        <span className="absolute left-[52px] top-1/2 -translate-y-1/2 px-2 py-1 rounded-md text-[10px] uppercase tracking-widest bg-bg-panel border border-border text-text opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition mono z-50">
          Randomize Demo
        </span>
      </button>

      <div className="flex-1" />

      {/* Bottom: affiliate + settings + theme */}
      <button onClick={onOpenAffiliateProgram} className="side-btn group relative ring-1 ring-accent/40" title="Jadi Affiliate AI">
        <HandCoins className="w-5 h-5 text-accent" />
        <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-accent animate-pulse shadow-[0_0_6px_rgba(var(--accent-rgb),0.8)]" />
        <span className="absolute left-[52px] top-1/2 -translate-y-1/2 px-2 py-1 rounded-md text-[10px] uppercase tracking-widest bg-bg-panel border border-border text-text opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition mono z-50">
          Jadi Affiliate
        </span>
      </button>
      {/* Hak Jual Kembali (lisensi reseller) — tampil hanya bila diaktifkan di config */}
      {CONFIG.showResellerTier && CONFIG.resellerPaymentUrl && (
        <button
          onClick={onOpenReseller}
          className="side-btn group relative ring-1 ring-amber-400/50"
          title="Hak Jual Kembali"
        >
          <Store className="w-5 h-5 text-amber-400" />
          <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shadow-[0_0_6px_rgba(234,179,8,0.8)]" />
          <span className="absolute left-[52px] top-1/2 -translate-y-1/2 px-2 py-1 rounded-md text-[10px] uppercase tracking-widest bg-bg-panel border border-border text-text opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition mono z-50">
            Hak Jual Kembali
          </span>
        </button>
      )}
      <button onClick={onOpenSettings} className="side-btn group" title="Pengaturan">
        <Settings className="w-5 h-5" />
        <span className="absolute left-[52px] top-1/2 -translate-y-1/2 px-2 py-1 rounded-md text-[10px] uppercase tracking-widest bg-bg-panel border border-border text-text opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition mono z-50">
          Pengaturan
        </span>
      </button>
      <ThemeToggle />
    </aside>
  );
}
