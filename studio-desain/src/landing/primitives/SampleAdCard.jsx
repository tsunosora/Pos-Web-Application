const RATIOS = {
  '1/1':  { w: 400, h: 400, label: 'IG FEED'     },
  '9/16': { w: 270, h: 480, label: 'STORY · 9:16'},
  '16/9': { w: 480, h: 270, label: 'YT · 16:9'   },
  '4/5':  { w: 360, h: 450, label: 'TYPO · 4:5'  },
};

const PALETTES = [
  { bg: '#1a0506', accent: '#ef4444', glow: '#7f1d1d', text: '#fce8e8' },
  { bg: '#170b03', accent: '#f97316', glow: '#9a3412', text: '#ffedd5' },
  { bg: '#0b0612', accent: '#a855f7', glow: '#581c87', text: '#ede9fe' },
  { bg: '#01100a', accent: '#10b981', glow: '#064e3b', text: '#d1fae5' },
  { bg: '#0c0a02', accent: '#eab308', glow: '#713f12', text: '#fef3c7' },
  { bg: '#06121a', accent: '#0ea5e9', glow: '#075985', text: '#e0f2fe' },
];

const HEADLINES = [
  'FLASH SALE', 'NEW DROP', 'BEST DEAL', 'LIMITED', 'EXCLUSIVE', 'PREMIUM',
  'PRE-ORDER', 'COMING SOON', 'JUST IN', 'TODAY ONLY', 'MEGA DISKON', 'EARLY BIRD',
  'TRENDING', 'BUNDLE PACK', 'SOLD OUT?', 'RESTOCK', 'GO VIRAL', 'COLLAB',
];

const SUBS = [
  'KOLEKSI 2026', 'EDISI TERBATAS', 'STOK MENIPIS', 'SAMPAI HABIS',
  'KHUSUS HARI INI', 'SHIP NOW', 'MULAI 99K', 'DISKON 70%',
];

const CATEGORIES = [
  'SKIN', 'AUDIO', 'COFFEE', 'WEAR', 'TECH', 'FOOD', 'CRYPTO', 'GAMES', 'COURSE',
];

export default function SampleAdCard({ ratio = '1/1', variant = 1, label }) {
  const cfg = RATIOS[ratio] || RATIOS['1/1'];
  const p   = PALETTES[variant % PALETTES.length];
  const headline = HEADLINES[variant % HEADLINES.length];
  const sub      = SUBS[(variant * 3) % SUBS.length];
  const cat      = CATEGORIES[(variant * 7) % CATEGORIES.length];
  const num      = String((variant * 13) % 99 + 1).padStart(2, '0');

  return (
    <svg
      viewBox={`0 0 ${cfg.w} ${cfg.h}`}
      preserveAspectRatio="xMidYMid slice"
      width="100%"
      height="100%"
      role="img"
      aria-label={label || `${cfg.label} preview ${variant}`}
      style={{ display: 'block' }}
    >
      <defs>
        <radialGradient id={`g${variant}`} cx="20%" cy="0%" r="120%">
          <stop offset="0%"   stopColor={p.glow} stopOpacity="0.85" />
          <stop offset="55%"  stopColor={p.bg}   stopOpacity="1" />
          <stop offset="100%" stopColor="#000"    stopOpacity="1" />
        </radialGradient>
        <linearGradient id={`stripe${variant}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor={p.accent} stopOpacity="0" />
          <stop offset="50%"  stopColor={p.accent} stopOpacity=".35" />
          <stop offset="100%" stopColor={p.accent} stopOpacity="0" />
        </linearGradient>
        <pattern id={`grid${variant}`} width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke={p.accent} strokeOpacity=".08" strokeWidth="1"/>
        </pattern>
      </defs>

      {/* base */}
      <rect width={cfg.w} height={cfg.h} fill={`url(#g${variant})`} />
      <rect width={cfg.w} height={cfg.h} fill={`url(#grid${variant})`} />
      <rect width={cfg.w} height={cfg.h} fill={`url(#stripe${variant})`} />

      {/* corner ticks */}
      <g stroke={p.accent} strokeWidth="2" opacity=".7">
        <path d={`M 10 10 L 28 10`} />
        <path d={`M 10 10 L 10 28`} />
        <path d={`M ${cfg.w - 10} 10 L ${cfg.w - 28} 10`} />
        <path d={`M ${cfg.w - 10} 10 L ${cfg.w - 10} 28`} />
        <path d={`M 10 ${cfg.h - 10} L 28 ${cfg.h - 10}`} />
        <path d={`M 10 ${cfg.h - 10} L 10 ${cfg.h - 28}`} />
        <path d={`M ${cfg.w - 10} ${cfg.h - 10} L ${cfg.w - 28} ${cfg.h - 10}`} />
        <path d={`M ${cfg.w - 10} ${cfg.h - 10} L ${cfg.w - 10} ${cfg.h - 28}`} />
      </g>

      {/* top label */}
      <g fontFamily="'JetBrains Mono', monospace">
        <rect x="18" y="22" width="78" height="18" rx="4" fill={p.accent} fillOpacity=".15" stroke={p.accent} strokeOpacity=".5"/>
        <text x="57" y="34" fontSize="9" textAnchor="middle" fill={p.accent} letterSpacing="2">
          AF·{num}
        </text>
      </g>

      {/* abstract product shape */}
      <g opacity=".95">
        {ratio === '1/1' && (
          <>
            <circle cx={cfg.w / 2} cy={cfg.h / 2 - 10} r="68" fill={p.accent} fillOpacity=".18" />
            <circle cx={cfg.w / 2} cy={cfg.h / 2 - 10} r="44" fill={p.accent} fillOpacity=".35" />
            <rect x={cfg.w / 2 - 22} y={cfg.h / 2 - 32} width="44" height="44" rx="6" fill={p.accent} />
          </>
        )}
        {ratio === '9/16' && (
          <>
            <rect x="40" y="100" width={cfg.w - 80} height="180" rx="10" fill={p.accent} fillOpacity=".22" />
            <rect x="60" y="120" width={cfg.w - 120} height="140" rx="6" fill={p.accent} fillOpacity=".4" />
          </>
        )}
        {ratio === '16/9' && (
          <>
            <rect x="40" y="60" width="180" height="160" rx="10" fill={p.accent} fillOpacity=".22" />
            <circle cx="130" cy="140" r="42" fill={p.accent} fillOpacity=".55" />
            <polygon points="118,118 118,162 158,140" fill="#fff" />
          </>
        )}
        {ratio === '4/5' && (
          <>
            <rect x="30" y="80" width={cfg.w - 60} height="230" rx="14" fill={p.accent} fillOpacity=".14" stroke={p.accent} strokeOpacity=".4"/>
          </>
        )}
      </g>

      {/* headline */}
      <g fontFamily="Inter, system-ui, sans-serif">
        <text
          x={cfg.w / 2}
          y={cfg.h - (ratio === '9/16' ? 120 : 60)}
          fontSize={ratio === '9/16' ? 30 : ratio === '16/9' ? 36 : 32}
          fontWeight="900"
          textAnchor="middle"
          fill={p.text}
          letterSpacing="-0.5"
        >
          {headline}
        </text>
        <text
          x={cfg.w / 2}
          y={cfg.h - (ratio === '9/16' ? 92 : 36)}
          fontSize="10"
          textAnchor="middle"
          fill={p.accent}
          fontFamily="'JetBrains Mono', monospace"
          letterSpacing="3"
        >
          {sub} · {cat}
        </text>
      </g>

      {/* bottom bar */}
      <rect x="0" y={cfg.h - 4} width={cfg.w} height="4" fill={p.accent} />
    </svg>
  );
}
