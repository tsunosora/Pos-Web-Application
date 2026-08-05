const INDUSTRIES = [
  'SKINCARE', 'FASHION', 'F&B', 'KOPI SPECIALTY', 'OTOMOTIF', 'EDUKASI',
  'FINANCE', 'CRYPTO', 'GAMING', 'TECH', 'COURSE', 'COACHING',
  'PROPERTY', 'TRAVEL', 'HEALTH', 'FITNESS', 'BABY & KIDS', 'JEWELRY',
  'CAFE', 'RESTORAN', 'EVENT', 'KECANTIKAN', 'AGENCY', 'KONSULTAN',
];

export default function MarqueeLogos() {
  const items = [...INDUSTRIES, ...INDUSTRIES];
  return (
    <section className="relative py-12 border-y border-border bg-bg-deep/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-7">
          <span className="text-[10px] mono uppercase tracking-[0.25em] text-text-dim">
            dipakai brand & creator dari berbagai industri
          </span>
        </div>

        <div className="marquee-mask marquee-pause overflow-hidden">
          <div className="marquee-track marquee-slow">
            {items.map((label, i) => (
              <IndustryCell key={i} label={label} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function IndustryCell({ label }) {
  return (
    <div className="shrink-0 px-3 flex items-center justify-center h-12">
      <span className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-border bg-bg-panel/60 mono text-xs uppercase tracking-[0.18em] text-text-mut hover:text-accent hover:border-border-strong transition-colors">
        <span className="w-1 h-1 rounded-full bg-accent" />
        {label}
      </span>
    </div>
  );
}
