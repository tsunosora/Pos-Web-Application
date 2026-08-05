import { Sparkles, Shirt, Star, Clapperboard, ArrowRight, Upload } from 'lucide-react';
import { CONFIG } from '../../config.js';
import GlowOrb from '../primitives/GlowOrb.jsx';
import ScanlineGrid from '../primitives/ScanlineGrid.jsx';
import SafeImage from '../primitives/SafeImage.jsx';

const SRC = (p) => `/landing/affiliate-demos/${p}.jpg?v=3`;

const TOOLS = [
  {
    icon: Sparkles,
    badge: 'Logo + Mockup',
    title: 'Logo Produk',
    desc: 'Generate logo brand affiliate-ready, lalu tempel logo kamu ke 21 media merchandise & brand mockup. Custom HEX palette — hasil langsung jadi logo & mockup produk.',
    bullets: ['Logo studio + Brand Mockup', 'Custom HEX palette override', '21 media (kaos, tote, banner, dll)'],
    layout: '2x2',
    imgs: ['logoaffiliate/logo-saas-tech', 'logoaffiliate/logo-skincare-premium', 'logoaffiliate/logo-streetwear-bold', 'logoaffiliate/logo-coffee-warm'],
  },
  {
    icon: Shirt,
    badge: 'Try-On / Wear-Test',
    title: 'Try-On Produk',
    desc: 'Sediakan foto produk → model langsung pakai produknya. Visual try-on & wear-test konversi tinggi: 15 mode, persona, pose, lighting, optimasi per platform.',
    bullets: ['Foto produk → langsung dipakai', '15 mode try-on', 'Aspect ratio auto per platform'],
    layout: '2x2',
    imgs: ['tryonaffiliate/tryon-skincare-apply', 'tryonaffiliate/tryon-sneakers', 'tryonaffiliate/tryon-handbag', 'tryonaffiliate/tryon-streetwear-tee'],
  },
  {
    icon: Star,
    badge: 'Banner High-Converting',
    title: 'Review Produk',
    desc: 'Banner review produk yang bikin stop-scroll. 10 review framework, custom warna + badge, dan wireframe preview live yang update sesuai pilihanmu.',
    bullets: ['10 review framework', 'Custom warna + conversion badge', 'Wireframe preview live'],
    layout: '2x2',
    imgs: ['reviewaffiliate/review-fashion-bag', 'reviewaffiliate/review-skincare-serum', 'reviewaffiliate/review-tech-gadget', 'reviewaffiliate/review-coffee-beans'],
  },
  {
    icon: Clapperboard,
    badge: 'Storyboard Board',
    title: 'Video Storyboard',
    desc: 'Storyboard board landscape 16:9 yang dibuat otomatis. Scene cepat 1.5–3 detik, jumlah scene auto menyesuaikan durasi video.',
    bullets: ['Board 16:9 landscape', 'Scene auto per durasi (10–60s)', 'VO + text overlay + visual tiap scene'],
    layout: 'stack2',
    imgs: ['storyboardaffiliate/sb-saas-30s', 'storyboardaffiliate/sb-skincare-30s'],
  },
];

export default function AffiliateShowcase() {
  return (
    <section id="affiliate" className="relative py-24 overflow-hidden">
      <GlowOrb size={520} color="rgba(var(--accent-rgb),0.16)" className="-top-24 right-[-160px]" />
      <ScanlineGrid />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
        <div className="max-w-3xl reveal">
          <span className="eyebrow">
            <span className="dot" /> ★ baru · affiliate tools
          </span>
          <h2 className="h-section mt-4">
            Affiliate Tools — <span className="text-grad-red">Logo, Try-On, Review &amp; Storyboard</span>
          </h2>
          <p className="mt-4 text-text-mut leading-relaxed">
            Empat tool khusus buat affiliate marketer & seller. Isi form, sediakan foto produkmu,
            dan dapat <span className="text-text">visual jualan yang konsisten</span> — produk
            dijaga sama persis dengan fotomu.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-text-dim">
            <span className="flex items-center gap-1.5"><Upload className="w-3.5 h-3.5 text-accent" /> Pakai foto produk → konsisten</span>
            <span className="flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-accent" /> Tiap tool logic sendiri</span>
            <span className="flex items-center gap-1.5">Demo template siap pakai</span>
          </div>
        </div>

        <div className="mt-12 grid md:grid-cols-2 gap-5">
          {TOOLS.map((t, i) => {
            const Icon = t.icon;
            return (
              <div
                key={t.title}
                className="soft-border card-lift overflow-hidden reveal flex flex-col"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                {/* Collage frame — 4 gambar (2x2) atau 2 gambar (stack) */}
                <div className="relative bg-border border-b border-border overflow-hidden">
                  <div className={`grid gap-0.5 ${t.layout === '2x2' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    {t.imgs.map((p) => (
                      <div
                        key={p}
                        className={`bg-bg-deep overflow-hidden ${t.layout === '2x2' ? 'aspect-square' : 'aspect-video'}`}
                      >
                        <SafeImage
                          src={SRC(p)}
                          alt={`${t.title} preview`}
                          className="w-full h-full object-cover"
                          fallback={
                            <div className="w-full h-full flex items-center justify-center">
                              <Icon className="w-8 h-8 text-accent/30" />
                            </div>
                          }
                        />
                      </div>
                    ))}
                  </div>
                  <div className="absolute top-2.5 left-2.5 inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-accent text-white text-[9px] mono uppercase tracking-widest font-bold z-10">
                    ★ {t.badge}
                  </div>
                </div>

                <div className="p-5 sm:p-6 flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex w-9 h-9 rounded-lg items-center justify-center bg-accent-sm border border-border">
                      <Icon className="w-4.5 h-4.5 text-accent" />
                    </span>
                    <h3 className="text-lg font-bold text-text">{t.title}</h3>
                  </div>
                  <p className="text-xs text-text-mut leading-relaxed">{t.desc}</p>
                  <ul className="mt-3 space-y-1">
                    {t.bullets.map((b) => (
                      <li key={b} className="text-[11px] text-text-mut flex items-center gap-2">
                        <span className="w-1 h-1 rounded-full bg-accent" />{b}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-10 reveal reveal-d2">
          <div className="soft-border p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-center sm:text-left">
              <div className="text-base font-bold text-text">Jualan affiliate? Generate visual produknya sekarang.</div>
              <div className="text-xs text-text-mut mt-1">
                Akses 4 affiliate tools (Logo · Try-On · Review · Storyboard) + 7 mode kreatif lainnya dengan Early Access Rp {CONFIG.price}.
              </div>
            </div>
            <a href="#harga" className="btn-cta !text-sm shrink-0">
              <Sparkles className="w-4 h-4" />
              Lihat Harga
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
