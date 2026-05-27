'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { getPublicSettings } from '@/lib/api';

const CACHE_KEY = '__vl_login_cfg';

/* ---------- All keyframes prefixed vl- to avoid global conflicts ---------- */
const VL_STYLES = `
  @keyframes vl-ringOut {
    0%  { transform:scale(.95); opacity:.65; }
    100%{ transform:scale(1.8); opacity:0; }
  }
  @keyframes vl-iconPop {
    0%  { transform:scale(0) rotate(-18deg); opacity:0; }
    65% { transform:scale(1.1) rotate(3deg); opacity:1; }
    82% { transform:scale(.97) rotate(-1deg); }
    100%{ transform:scale(1) rotate(0); opacity:1; }
  }
  @keyframes vl-iconBob {
    0%,100%{ transform:translateY(0) rotate(0); }
    30%    { transform:translateY(-8px) rotate(1.5deg); }
    65%    { transform:translateY(-4px) rotate(-.8deg); }
  }
  @keyframes vl-glowPulse {
    0%,100% { opacity:.5; transform:scale(1); }
    50%     { opacity:1;  transform:scale(1.15); }
  }
  @keyframes vl-spPop {
    0%,100%{ transform:scale(0) rotate(0);       opacity:0; }
    22%    { transform:scale(1.7) rotate(45deg);  opacity:1; }
    55%    { transform:scale(.9)  rotate(120deg); opacity:.6; }
    80%    { transform:scale(.3)  rotate(200deg); opacity:.1; }
  }
  @keyframes vl-kenBurns {
    0%   { transform: scale(1)    translate(0%,     0%);    }
    50%  { transform: scale(1.09) translate(-1.2%,  0.8%);  }
    100% { transform: scale(1.06) translate( 0.8%, -1.2%);  }
  }
  @keyframes vl-fadeIn {
    0%  { opacity:0; transform:scale(.97); }
    100%{ opacity:1; transform:scale(1); }
  }
  /* ── Responsive logo scaling for small/landscape viewports ── */
  .vl-scene { transform-origin: center top; }
  @media (max-height: 560px) { .vl-scene { transform: scale(0.72); } }
  @media (max-height: 440px) { .vl-scene { transform: scale(0.54); } }
  @media (max-width: 340px)  { .vl-scene { transform: scale(0.82); } }
`;


const SPARKLES = [
    { w: 9, h: 9, bg: '#e61b4d', pos: { top: '8%',    right: '4%'    }, anim: 'vl-spPop 2.5s ease-in-out 2.0s infinite' },
    { w: 6, h: 6, bg: '#30a0da', pos: { top: '20%',   left:  '0%'    }, anim: 'vl-spPop 2.1s ease-in-out 2.5s infinite' },
    { w: 8, h: 8, bg: '#e6b022', pos: { bottom:'20%', right: '2%'    }, anim: 'vl-spPop 2.8s ease-in-out 1.9s infinite' },
    { w: 5, h: 5, bg: '#fff',    pos: { top: '50%',   left:  '-2%'   }, anim: 'vl-spPop 3.0s ease-in-out 2.7s infinite' },
    { w: 7, h: 7, bg: '#e61b4d', pos: { bottom:'30%', left:  '3%'    }, anim: 'vl-spPop 2.3s ease-in-out 3.1s infinite' },
    { w: 5, h: 5, bg: '#30a0da', pos: { top: '3%',    left:  '14%'   }, anim: 'vl-spPop 2.0s ease-in-out 2.2s infinite' },
];


type PublicSettings = {
    storeName: string;
    logoImageUrl: string | null;
    loginLogoUrl: string | null;
    loginBgImages: string[];
    loginTaglines: string[];
    theme?: {
        mode: 'SOLID' | 'GRADIENT';
        primaryColor: string;
        secondaryColor: string;
        gradientDirection: string;
    };
};

export function AnimatedBackground() {
    const [settings, setSettings] = useState<PublicSettings>({
        storeName: 'PosPro',
        logoImageUrl: null,
        loginLogoUrl: null,
        loginBgImages: [],
        loginTaglines: [],
    });
    const [activeSlide, setActiveSlide] = useState(0);
    const [taglineIdx, setTaglineIdx] = useState(0);
    // logoKey: berubah setiap kali loginLogoUrl berganti → trigger fade-in ulang
    const [logoKey, setLogoKey] = useState(0);
    const prevLoginLogoRef = useRef<string | null>(undefined as unknown as null);
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    // ① Baca cache SEBELUM browser paint — eliminasi flash logo pada kunjungan ulang
    useLayoutEffect(() => {
        try {
            const raw = localStorage.getItem(CACHE_KEY);
            if (raw) setSettings(JSON.parse(raw));
        } catch {}
    }, []);

    // ② Fetch fresh dari API, lalu perbarui cache
    useEffect(() => {
        getPublicSettings().then(fresh => {
            setSettings(fresh);
            try { localStorage.setItem(CACHE_KEY, JSON.stringify(fresh)); } catch {}
        }).catch(() => {});
    }, []);

    /* Deteksi perubahan loginLogoUrl → increment logoKey untuk re-trigger fade-in */
    useEffect(() => {
        if (prevLoginLogoRef.current !== settings.loginLogoUrl) {
            prevLoginLogoRef.current = settings.loginLogoUrl;
            setLogoKey(k => k + 1);
        }
    }, [settings.loginLogoUrl]);

    /* Background slideshow */
    useEffect(() => {
        if (settings.loginBgImages.length < 2) return;
        const id = setInterval(
            () => setActiveSlide(i => (i + 1) % settings.loginBgImages.length),
            6000,
        );
        return () => clearInterval(id);
    }, [settings.loginBgImages.length]);

    /* Tagline cycling */
    useEffect(() => {
        if (settings.loginTaglines.length < 2) return;
        const id = setInterval(
            () => setTaglineIdx(i => (i + 1) % settings.loginTaglines.length),
            5000,
        );
        return () => clearInterval(id);
    }, [settings.loginTaglines.length]);

    const taglines = settings.loginTaglines.length > 0
        ? settings.loginTaglines
        : ['Solusi POS Terpadu untuk Bisnis Anda'];

    return (
        <>
            <style>{VL_STYLES}</style>

            {/* ── Background images with Ken Burns zoom ── */}
            <div className="absolute inset-0 overflow-hidden">
                {settings.loginBgImages.length > 0 ? (
                    settings.loginBgImages.map((img, i) => (
                        <div
                            key={i}
                            className="absolute inset-0 transition-opacity duration-1000"
                            style={{ opacity: i === activeSlide ? 1 : 0 }}
                        >
                            <div
                                className="absolute inset-0 bg-cover bg-center"
                                style={{
                                    backgroundImage: `url(${base}${img})`,
                                    animation: i === activeSlide ? 'vl-kenBurns 6s ease-in-out forwards' : 'none',
                                    willChange: i === activeSlide ? 'transform' : 'auto',
                                }}
                            />
                        </div>
                    ))
                ) : (
                    // Theme-aware background — pakai gradient/solid dari StoreSettings.theme,
                    // fallback ke default dark gradient kalau belum di-load.
                    <div
                        className="absolute inset-0"
                        style={{
                            background: settings.theme
                                ? (settings.theme.mode === 'GRADIENT'
                                    ? `linear-gradient(${settings.theme.gradientDirection}, ${settings.theme.primaryColor}, ${settings.theme.secondaryColor})`
                                    : settings.theme.primaryColor)
                                : 'linear-gradient(to bottom right, #1a0510, #2d0818, #08152a)',
                        }}
                    />
                )}
                {/* Dim overlay: hanya untuk bg images supaya teks/logo putih kebaca.
                    Kalau pakai theme color saja, overlay di-skip — warna tampil murni. */}
                {settings.loginBgImages.length > 0 && (
                    <div className="absolute inset-0 bg-black/55" />
                )}
            </div>

            {/* ── Ambient glow ── */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    background: 'radial-gradient(ellipse 55% 45% at 50% 46%, rgba(230,27,77,0.10) 0%, transparent 68%)',
                    animation: 'vl-glowPulse 4s ease-in-out infinite',
                }}
            />

            {/* ── Store logo / name ── */}
            <div className="relative z-20 flex items-center gap-2.5">
                {settings.logoImageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={`${base}${settings.logoImageUrl}`}
                        alt="logo"
                        className="h-8 w-8 object-contain rounded"
                    />
                )}
                <span className="text-lg font-semibold text-white/90 tracking-wide">
                    {settings.storeName}
                </span>
            </div>

            {/* ── Centerpiece: custom login logo (kalau di-set) ── */}
            <div className="relative z-20 flex flex-1 items-center justify-center">
                {settings.loginLogoUrl ? (
                    // Key prefix "c-" supaya React unmount+remount saat logoKey berubah.
                    <div
                        key={`c-${logoKey}`}
                        className="vl-scene relative flex flex-col items-center"
                        style={{ animation: 'vl-fadeIn .4s ease-out both' }}
                    >
                        <div className="absolute pointer-events-none" style={{ inset: '-60px', zIndex: 0 }}>
                            {SPARKLES.map((sp, i) => (
                                <div
                                    key={i}
                                    className="absolute rounded-full opacity-0"
                                    style={{ width: sp.w, height: sp.h, background: sp.bg, ...sp.pos, animation: sp.anim }}
                                />
                            ))}
                        </div>
                        <div className="relative flex items-center justify-center" style={{ width: 280, height: 280 }}>
                            <div className="absolute inset-0 rounded-full border-2 opacity-0"
                                style={{ borderColor: 'rgba(230,27,77,.45)', animation: 'vl-ringOut 2.6s ease-out 1.3s infinite' }} />
                            <div className="absolute inset-0 rounded-full border-2 opacity-0"
                                style={{ borderColor: 'rgba(48,160,218,.35)', animation: 'vl-ringOut 2.6s ease-out 1.9s infinite' }} />
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={`${base}${settings.loginLogoUrl}`}
                                alt="Login Logo"
                                className="relative z-10 max-w-full max-h-full object-contain"
                                style={{
                                    animation: 'vl-iconPop .85s cubic-bezier(.34,1.56,.64,1) .1s both, vl-iconBob 4s ease-in-out 1.8s infinite',
                                    filter: 'drop-shadow(0 10px 32px rgba(0,0,0,.4)) drop-shadow(0 2px 10px rgba(0,0,0,.5))',
                                }}
                            />
                        </div>
                    </div>
                ) : null}
            </div>

            {/* ── Taglines ── */}
            <div className="relative z-20 h-8 mt-auto">
                {taglines.map((t, i) => (
                    <p
                        key={i}
                        className="absolute inset-x-0 text-center text-sm text-white/75 transition-all duration-500"
                        style={{
                            opacity: i === taglineIdx ? 1 : 0,
                            transform: i === taglineIdx ? 'translateY(0)' : 'translateY(8px)',
                        }}
                    >
                        {t}
                    </p>
                ))}
            </div>
        </>
    );
}
