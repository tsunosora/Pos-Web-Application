import { useEffect, useState } from 'react';
import { Zap, ArrowRight } from 'lucide-react';
import SafeImage from '../primitives/SafeImage.jsx';
import { CONFIG, brandParts } from '../../config.js';

const NAV_LINKS = [
  { href: '#fitur',   label: 'Fitur'     },
  { href: '#cara',    label: 'Cara Kerja'},
  { href: '#contoh',  label: 'Showcase'  },
  { href: '#harga',   label: 'Harga'     },
  { href: '#faq',     label: 'FAQ'       },
];

const CTA_HREF = CONFIG.paymentUrl;

export default function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 transition-all duration-300 ${
        scrolled
          ? 'backdrop-blur-md bg-bg/85 border-b border-border'
          : 'bg-transparent border-b border-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <a href="#top" className="flex items-center gap-2.5 group">
          <span className="relative inline-flex w-10 h-10 items-center justify-center shadow-[0_0_24px_rgba(var(--accent-rgb),0.45)] rounded-xl">
            <SafeImage
              src={CONFIG.logoUrl}
              alt={CONFIG.brandName}
              className="w-full h-full object-contain"
              fallback={
                <span className="w-full h-full bg-accent flex items-center justify-center text-white font-black rounded-xl">
                  <Zap className="w-4.5 h-4.5" strokeWidth={2.5} />
                </span>
              }
            />
            <span className="ping-ring rounded-xl" />
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-base font-bold">
              {brandParts().lead && <>{brandParts().lead} </>}<span className="text-accent">{brandParts().accent}</span>
            </span>
            <span className="text-[8px] mono uppercase tracking-[0.18em] text-text-dim">
              instant design studio
            </span>
          </span>
        </a>

        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="px-3 py-1.5 text-sm text-text-mut hover:text-accent transition-colors rounded-md"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <a
          href="#harga"
          className="btn-cta !py-2 !px-4 !text-xs sm:!text-sm"
        >
          Klaim Early Access
          <ArrowRight className="w-3.5 h-3.5" />
        </a>
      </div>
    </header>
  );
}
