import { Zap, Facebook } from 'lucide-react';
import SafeImage from '../primitives/SafeImage.jsx';
import { CONFIG, brandParts } from '../../config.js';

export default function LandingFooter() {
  return (
    <footer className="relative border-t border-border bg-bg-deep/70">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid sm:grid-cols-[2fr_1fr_1fr] gap-10">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="inline-flex w-10 h-10 items-center justify-center shadow-[0_0_20px_rgba(var(--accent-rgb),0.4)] rounded-xl">
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
              </span>
              <span className="text-base font-bold">
                {brandParts().lead && <>{brandParts().lead} </>}<span className="text-accent">{brandParts().accent}</span>
              </span>
            </div>
            <p className="mt-4 text-xs text-text-mut max-w-sm leading-relaxed">
              Studio visual otomatis untuk banner, thumbnail, typography ads, copy writing,
              face card analysis, dan menu F&B. Dibangun di Indonesia untuk creator
              dan brand yang lelah nunggu designer.
            </p>
          </div>

          <div>
            <div className="text-[10px] mono uppercase tracking-widest text-text-dim mb-3">Studio</div>
            <ul className="space-y-2 text-xs">
              <li><a href="#fitur"  className="text-text-mut hover:text-accent transition-colors">Fitur</a></li>
              <li><a href="#cara"   className="text-text-mut hover:text-accent transition-colors">Cara Kerja</a></li>
              <li><a href="#contoh" className="text-text-mut hover:text-accent transition-colors">Showcase</a></li>
              <li><a href="#harga"  className="text-text-mut hover:text-accent transition-colors">Harga</a></li>
              <li><a href="#faq"    className="text-text-mut hover:text-accent transition-colors">FAQ</a></li>
            </ul>
          </div>

          <div>
            <div className="text-[10px] mono uppercase tracking-widest text-text-dim mb-3">Social</div>
            <ul className="space-y-2 text-xs">
              <li>
                <a
                  href={CONFIG.facebookUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-text-mut hover:text-accent transition-colors"
                >
                  <Facebook className="w-3.5 h-3.5" /> {CONFIG.facebookHandle}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-[10px] mono uppercase tracking-widest text-text-dim">
            © {new Date().getFullYear()} {CONFIG.brandName} · All rights reserved
          </div>
          <div className="text-[10px] mono uppercase tracking-widest text-text-dim">
            v2.1 · early access build
          </div>
        </div>
      </div>
    </footer>
  );
}
