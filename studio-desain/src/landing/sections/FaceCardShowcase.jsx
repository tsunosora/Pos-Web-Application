import { ScanFace, Sparkles, ArrowRight } from 'lucide-react';
import { CONFIG } from '../../config.js';
import GlowOrb from '../primitives/GlowOrb.jsx';
import ScanlineGrid from '../primitives/ScanlineGrid.jsx';
import NeonBorder from '../primitives/NeonBorder.jsx';
import SafeImage from '../primitives/SafeImage.jsx';
import { FACE_CARD_PREVIEWS } from '../data/galleryManifest.js';

const CARDS = [
  {
    key: 'style',
    title: 'Style Analysis Board',
    desc: 'Luxury fashion magazine: style categories, vibe, palette, silhouettes, capsule wardrobe.',
    badge: 'Editorial · Luxury',
    src: FACE_CARD_PREVIEWS.style,
    hero: true,
  },
  {
    key: 'face-features',
    title: 'Face Features Analysis',
    desc: 'Label face shape, mata, alis, hidung, pipi, bibir dengan bullet point analisis.',
    badge: 'Infographic',
    src: FACE_CARD_PREVIEWS.faceFeatures,
  },
  {
    key: 'spectacles',
    title: 'Spectacles Guide',
    desc: 'Rekomendasi & avoid frame kacamata berdasarkan bentuk wajah dengan try-on.',
    badge: 'Try-On Guide',
    src: FACE_CARD_PREVIEWS.spectacles,
  },
  {
    key: 'color',
    title: 'Color Analysis Board',
    desc: 'Personal color season: best colors, makeup palette, hair, jewelry, outfit grid.',
    badge: 'Personal Color',
    src: FACE_CARD_PREVIEWS.color,
  },
  {
    key: 'makeup',
    title: 'Makeup Analysis Board',
    desc: 'Skin tone, undertone, eyeshadow looks, eyeliner, lip shades, final looks lengkap.',
    badge: 'Beauty Board',
    src: FACE_CARD_PREVIEWS.makeup,
  },
];

export default function FaceCardShowcase() {
  const hero = CARDS.find((c) => c.hero);
  const rest = CARDS.filter((c) => !c.hero);

  return (
    <section className="relative py-24 overflow-hidden">
      <GlowOrb size={560} color="rgba(var(--accent-rgb),0.18)" className="-top-32 right-[-160px]" />
      <ScanlineGrid />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
        {/* Heading */}
        <div className="max-w-3xl reveal">
          <span className="eyebrow">
            <span className="dot" /> ★ fitur baru · premium
          </span>
          <h2 className="h-section mt-4">
            Face Card Analysis — <span className="text-grad-red">Personal Branding</span> dalam 1 Klik
          </h2>
          <p className="mt-4 text-text-mut leading-relaxed">
            Cukup satu portrait, langsung dapat <span className="text-text font-semibold">5 board analisa premium</span> ala
            personal stylist: face features, spectacles guide, style direction, personal color, dan makeup recommendation.
            Cocok untuk creator, brand personal, dan siapapun yang mau elevate self-presentation.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-text-dim">
            <span className="flex items-center gap-1.5"><ScanFace className="w-3.5 h-3.5 text-accent" /> 5 sub-type analysis</span>
            <span className="flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-accent" /> Editorial magazine quality</span>
            <span className="flex items-center gap-1.5">Male & female friendly</span>
          </div>
        </div>

        {/* Hero + Grid Layout */}
        <div className="mt-12 grid lg:grid-cols-[1.15fr_1fr] gap-5">
          {/* Hero card (left) */}
          <HeroCard card={hero} />

          {/* 4 cards (right, 2x2) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {rest.map((c) => (
              <MiniCard key={c.key} card={c} />
            ))}
          </div>
        </div>

        {/* CTA strip */}
        <div className="mt-10 reveal reveal-d2">
          <div className="soft-border p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-center sm:text-left">
              <div className="text-base font-bold text-text">Mau coba Face Card sekarang?</div>
              <div className="text-xs text-text-mut mt-1">
                Akses semua 12 mode kreatif termasuk 9 Feed Konsisten, Carousel Feeds, Face Card ★, Menu F&B ★ & 4 Affiliate Tools dengan Early Access Rp {CONFIG.price}.
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
      <NeonBorder className="p-2 h-full">
        <div className="relative rounded-xl overflow-hidden bg-bg-deep scanlines flex flex-col h-full">
          <div className="relative flex-1 min-h-[420px] max-h-[640px] bg-bg-deep flex items-center justify-center">
            <SafeImage
              src={card.src}
              alt={card.title}
              className="max-w-full max-h-full w-auto h-auto object-contain"
              fallback={<FallbackPlaceholder label={card.title} />}
            />
            <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-accent text-white text-[9px] mono uppercase tracking-widest font-bold">
              ★ Featured
            </div>
          </div>
          <div className="p-5 border-t border-border">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[9px] mono uppercase tracking-widest text-accent">{card.badge}</span>
            </div>
            <h3 className="text-lg font-bold text-text">{card.title}</h3>
            <p className="mt-1 text-xs text-text-mut leading-relaxed">{card.desc}</p>
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
      <div className="p-4">
        <div className="text-[9px] mono uppercase tracking-widest text-accent mb-1">{card.badge}</div>
        <h3 className="text-sm font-bold text-text">{card.title}</h3>
        <p className="mt-1 text-[11px] text-text-mut leading-relaxed line-clamp-2">{card.desc}</p>
      </div>
    </div>
  );
}

function FallbackPlaceholder({ label }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-4">
      <ScanFace className="w-12 h-12 text-accent/40" />
      <span className="text-[10px] mono uppercase tracking-widest text-text-dim text-center">{label}</span>
    </div>
  );
}
