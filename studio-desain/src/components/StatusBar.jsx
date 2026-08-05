import { CATEGORIES } from '../data/categories.js';

const VERSION = 'v2.1';

const MODE_LABEL = {
  banner:      'Design Feeds',
  carousel:    'Carousel Feeds',
  gridfeed:    '9 Feed Konsisten',
  thumbnail:   'Youtube Thumbnail',
  typography:  'Ads Typography',
  copywriting: 'Copy Writing',
  facecard:    'Face Card Analysis',
  menufb:      'Menu F&B',
  logoaffiliate:       'Logo Affiliate',
  tryonaffiliate:      'Try-On Produk',
  reviewaffiliate:     'Review Produk',
  storyboardaffiliate: 'Storyboard Affiliate',
};

export default function StatusBar({ mode }) {
  return (
    <footer className="h-9 px-4 border-t border-border bg-bg-panel/70 backdrop-blur-md flex items-center justify-between text-[10px] mono uppercase tracking-widest text-text-dim">
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-60 animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
          </span>
          Connected
        </span>
        <span className="text-text-dim">·</span>
        <span>{MODE_LABEL[mode]}</span>
        <span className="text-text-dim hidden sm:inline">·</span>
        <span className="hidden sm:inline">{CATEGORIES.length} templates</span>
      </div>
      <div className="flex items-center gap-3">
        <a
          href="https://app.faicando.com"
          target="_blank"
          rel="noopener noreferrer"
          className="normal-case tracking-normal text-text-mut hover:text-accent transition-colors"
          title="Dibuat oleh faicando — app.faicando.com"
        >
          <span className="hidden sm:inline">Dibuat oleh </span>
          <span className="font-semibold text-accent">faicando</span>
          <span className="hidden md:inline text-text-dim"> · app.faicando.com</span>
        </a>
        <span>{VERSION}</span>
      </div>
    </footer>
  );
}
