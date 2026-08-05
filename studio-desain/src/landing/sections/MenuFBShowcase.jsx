import { UtensilsCrossed, Sparkles, ArrowRight } from 'lucide-react';
import { CONFIG } from '../../config.js';
import GlowOrb from '../primitives/GlowOrb.jsx';
import ScanlineGrid from '../primitives/ScanlineGrid.jsx';
import NeonBorder from '../primitives/NeonBorder.jsx';
import SafeImage from '../primitives/SafeImage.jsx';
import { MENU_FB_PREVIEWS } from '../data/galleryManifest.js';

const CARDS = [
  {
    key: 'cherryelle',
    title: 'Patisserie Luxury',
    brand: 'Cherryelle Patisserie',
    desc: 'Snow white luxury · wine cherry accents · centered serif italic. Cocok untuk patisserie premium, kafe Korean luxury.',
    badge: 'Parisian Luxury',
    src: MENU_FB_PREVIEWS.cherryelle,
    hero: true,
  },
  {
    key: 'superfood',
    title: 'Editorial Modern',
    brand: 'Superfood',
    desc: 'Snow white editorial · espresso brown typography · hero+sections.',
    badge: 'Clean Minimal',
    src: MENU_FB_PREVIEWS.superfood,
  },
  {
    key: 'mashisseo',
    title: 'Korean Street Food',
    brand: 'Mashisseo 마시써',
    desc: 'Bold viral · red headlines · hero+grid · sticker prices.',
    badge: 'Bold Viral',
    src: MENU_FB_PREVIEWS.mashisseo,
  },
  {
    key: 'kayuManis',
    title: 'Indonesian Heritage',
    brand: 'Kayu Manis',
    desc: 'Snow white heritage · doodle border · bitter cocoa typography.',
    badge: 'Heritage Ornate',
    src: MENU_FB_PREVIEWS.kayuManis,
  },
  {
    key: 'takomi',
    title: 'Japanese Premium',
    brand: 'Takomi たこ実',
    desc: 'Dark navy + cream cards · red accents · kanji decorative.',
    badge: 'Japanese Premium',
    src: MENU_FB_PREVIEWS.takomi,
  },
  {
    key: 'laBella',
    title: 'Retro Marketplace',
    brand: 'La Bella',
    desc: 'Blue + white marketplace · dessert/beverage catalog · "Best Seller" badges.',
    badge: 'Marketplace Retro',
    src: MENU_FB_PREVIEWS.laBella,
  },
  {
    key: 'cemilanBunya',
    title: 'Bakery Homemade',
    brand: 'Cemilan Bunya',
    desc: 'Cream warm bakery · premium catalog · "Fresh Homemade" badges.',
    badge: 'Warm Artisanal',
    src: MENU_FB_PREVIEWS.cemilanBunya,
  },
  {
    key: 'cingAni',
    title: 'Festive Betawi',
    brand: 'Cing Ani Resto',
    desc: 'Bold red + gold festive · "Sejak [year]" badge · heritage Indonesian.',
    badge: 'Festive Traditional',
    src: MENU_FB_PREVIEWS.cingAni,
  },
  {
    key: 'bunyaKitchen',
    title: 'Modern Rice Bowl',
    brand: 'Bunya Kitchen',
    desc: 'Snow white modern · terracotta accent · hero+sections luxury.',
    badge: 'Modern Casual',
    src: MENU_FB_PREVIEWS.bunyaKitchen,
  },
];

export default function MenuFBShowcase() {
  const hero = CARDS.find((c) => c.hero);
  const rest = CARDS.filter((c) => !c.hero);

  return (
    <section className="relative py-24 overflow-hidden">
      <GlowOrb size={520} color="rgba(var(--accent-rgb),0.18)" className="-top-32 left-[-160px]" />
      <ScanlineGrid />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
        {/* Heading */}
        <div className="max-w-3xl reveal">
          <span className="eyebrow">
            <span className="dot" /> ★ fitur baru · F&B brands
          </span>
          <h2 className="h-section mt-4">
            Menu F&B — <span className="text-grad-red">9 Template Premium</span> untuk Resto & Patisserie
          </h2>
          <p className="mt-4 text-text-mut leading-relaxed">
            Tinggal pilih template, isi menu items dan harga, klik Generate.
            Tiap template punya <span className="text-text font-semibold">formula visual khusus</span> yang menghasilkan
            poster menu sesuai brand DNA: patisserie luxury, Korean street food viral, Indonesian heritage,
            Japanese premium izakaya, marketplace catalog, sampai homemade bakery cozy.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-text-dim">
            <span className="flex items-center gap-1.5"><UtensilsCrossed className="w-3.5 h-3.5 text-accent" /> 9 template siap pakai</span>
            <span className="flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-accent" /> Formula visual per-brand</span>
            <span className="flex items-center gap-1.5">Live thumbnail preview</span>
            <span className="flex items-center gap-1.5">5 layout style + 7 rasio</span>
          </div>
        </div>

        {/* Hero (top, full width) + 8 mini cards (4-col grid below) */}
        <div className="mt-12 space-y-5">
          <HeroCard card={hero} />

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {rest.map((c) => (
              <MiniCard key={c.key} card={c} />
            ))}
          </div>
        </div>

        {/* CTA strip */}
        <div className="mt-10 reveal reveal-d2">
          <div className="soft-border p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-center sm:text-left">
              <div className="text-base font-bold text-text">Punya brand F&B? Generate menu poster premium sekarang.</div>
              <div className="text-xs text-text-mut mt-1">
                Akses 9 template Menu F&B + 9 mode kreatif lainnya (Banner · YT · Ads · Copy · Face Card ★ + 4 Affiliate Tools) dengan Early Access Rp {CONFIG.price}.
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

function HeroCard({ card }) {
  return (
    <div className="reveal">
      <NeonBorder className="p-2">
        <div className="relative rounded-xl overflow-hidden bg-bg-deep scanlines grid md:grid-cols-[minmax(0,420px)_1fr]">
          {/* Image (left on md+, top on mobile) — natural 4:5 aspect, no stretching */}
          <div className="relative bg-bg-deep flex items-center justify-center aspect-[4/5]">
            <SafeImage
              src={card.src}
              alt={card.title}
              className="absolute inset-0 w-full h-full object-cover"
              fallback={<FallbackPlaceholder label={card.title} />}
            />
            <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-accent text-white text-[9px] mono uppercase tracking-widest font-bold z-10">
              ★ Featured
            </div>
          </div>

          {/* Info (right on md+, bottom on mobile) */}
          <div className="p-6 lg:p-8 flex flex-col justify-center border-t md:border-t-0 md:border-l border-border bg-bg-deep">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[9px] mono uppercase tracking-widest text-accent">{card.badge}</span>
              <span className="text-[9px] mono uppercase tracking-widest text-text-dim">· {card.brand}</span>
            </div>
            <h3 className="text-xl lg:text-2xl font-bold text-text leading-tight">{card.title}</h3>
            <p className="mt-3 text-sm text-text-mut leading-relaxed">{card.desc}</p>

            {/* Small extra context strip */}
            <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-text-dim">
              <span className="flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-accent" /> Formula visual per-brand
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-accent" /> AI-generated preview
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-accent" /> Editable form
              </span>
            </div>
          </div>
        </div>
      </NeonBorder>
    </div>
  );
}

function MiniCard({ card }) {
  return (
    <div className="soft-border card-lift overflow-hidden reveal">
      <div className="relative aspect-[4/5] bg-bg-deep overflow-hidden flex items-center justify-center">
        <SafeImage
          src={card.src}
          alt={card.title}
          className="max-w-full max-h-full w-auto h-auto object-contain"
          fallback={<FallbackPlaceholder label={card.title} />}
        />
      </div>
      <div className="p-3">
        <div className="text-[9px] mono uppercase tracking-widest text-accent mb-1 truncate">{card.badge}</div>
        <h3 className="text-xs font-bold text-text leading-tight">{card.title}</h3>
        <p className="mt-0.5 text-[10px] text-text-dim leading-tight truncate">{card.brand}</p>
      </div>
    </div>
  );
}

function FallbackPlaceholder({ label }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-4">
      <UtensilsCrossed className="w-12 h-12 text-accent/40" />
      <span className="text-[10px] mono uppercase tracking-widest text-text-dim text-center">{label}</span>
    </div>
  );
}
