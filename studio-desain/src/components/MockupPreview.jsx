import { LayoutGrid } from 'lucide-react';

function parseRatio(label) {
  if (!label) return [16, 9];
  const m = label.match(/(\d+(?:\.\d+)?)\s*[:x]\s*(\d+(?:\.\d+)?)/i);
  if (!m) return [4, 5]; // carousel slide → 4:5
  return [parseFloat(m[1]), parseFloat(m[2])];
}

// Label ringkas cover slide 1 untuk metadata mockup.
const COVER_LABELS = {
  'auto': 'Hero (Auto)',
  'image-top': 'Img Atas',
  'image-bottom': 'Img Bawah',
  'image-right': 'Img Kanan',
  'image-left': 'Img Kiri',
  'image-full': 'Full Bleed',
  'text-focus': 'Teks Hero',
};

/**
 * Live SVG mockup wireframe. Adapts to:
 * - aspect ratio
 * - color theme (primary + secondary)
 * - mode-specific layout (banner position + image count, thumbnail, typography)
 */
export default function MockupPreview({ mode, state }) {
  const isReview = mode === 'reviewaffiliate';
  const isCarousel = mode === 'carousel'; // semua template carousel → cover wireframe slide 1
  const [w, h] = parseRatio(state.ratio || state.image_ratio || state.aspectRatio);
  // Normalize to a sensible viewBox (preserve ratio, scale to ~400 width)
  const targetW = 400;
  const targetH = Math.round((targetW * h) / w);

  let primary, secondary;
  if (isReview) {
    [primary, secondary] = reviewColors(state);
  } else if (isCarousel) {
    if (state.templateType === 'news') {
      // News: pakai warna suasana + background teks pilihan user
      primary = state.newsMoodColor || '#dc2626';
      secondary = state.newsTextBgAuto ? '#0f172a' : (state.newsTextBg || '#0f172a');
    } else if (state.colorMoodCustom) {
      // Override: pakai warna custom user (Tema Warna)
      primary = state.colorPrimary || '#ef4444';
      secondary = state.colorSecondary || '#0f172a';
    } else {
      primary = '#ef4444';   // aksen brand
      secondary = '#0f172a'; // dark
    }
  } else {
    primary = state.primaryColor || '#2dd4bf';
    secondary = state.secondaryColor || '#ffffff';
  }

  // Universal max-height — width fills parent, height stays <= 240 (auto for tall ratios)
  // Reduced from 320 to leave more room for PromptPanel below in side panel layout
  const CONTAINER_MAX_H = 240;
  // For ratios where width-driven would exceed maxHeight, compute the explicit maxWidth
  const wouldExceedHeight = (CONTAINER_MAX_H * w) / h;   // pixel width if height-driven
  const computedMaxWidth  = h >= w ? `${wouldExceedHeight}px` : '100%';

  return (
    <div className="surface p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-text-mut">
          <LayoutGrid className="w-3.5 h-3.5 text-accent" />
          <span className="text-[10px] uppercase tracking-widest mono">Mockup Wireframe</span>
        </div>
        <span className="text-[10px] mono text-text-dim uppercase tracking-widest">{w}:{h}</span>
      </div>
      {/* Container uses aspect-ratio so the SVG fills exactly the visual ratio (no empty gaps) */}
      <div
        className="rounded-lg flex items-center justify-center mx-auto w-full overflow-hidden border border-border"
        style={{
          aspectRatio: `${w} / ${h}`,
          maxHeight: CONTAINER_MAX_H,
          maxWidth: computedMaxWidth,
          background: `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`,
        }}
      >
        <svg viewBox={`0 0 ${targetW} ${targetH}`} className="w-full h-full block"
             preserveAspectRatio="xMidYMid meet">
          <defs>
            <filter id="softShadow"><feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.18"/></filter>
          </defs>
          {mode === 'banner' && renderBanner(targetW, targetH, state)}
          {mode === 'thumbnail' && renderThumbnail(targetW, targetH, state)}
          {mode === 'typography' && renderTypography(targetW, targetH, state)}
          {isReview && renderReviewBanner(targetW, targetH, state)}
          {isCarousel && renderCarouselCover(targetW, targetH, state)}
        </svg>
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-3 gap-1.5 text-[10px] mt-1">
        {isCarousel ? (
          <>
            <Meta label="Cover" value={(COVER_LABELS[state.coverLayout] || '—')} />
            <Meta label="Slides" value={state.totalSlides || '—'} />
            <Meta label="Ratio" value={`${w}:${h}`} />
          </>
        ) : isReview ? (
          <>
            <Meta label="Framework" value={(state.review_framework || '—').replace(/_review$/, '').replace(/_/g, ' ')} />
            <Meta label="Layout"   value={(state.layout_type || '—').replace(/ Layout$/, '')} />
            <Meta label="Product"  value={state.product_position || '—'} />
          </>
        ) : (
          <>
            <Meta label="Style"  value={state.style || state.designStyle || state.dna || '—'} />
            <Meta label="Images"  value={state.imageCount || 1} />
            <Meta label="Position" value={state.position || (mode === 'typography' ? 'center' : 'right')} />
            {mode === 'thumbnail' && <Meta label="Mood" value={state.mood || '—'} />}
            {mode === 'thumbnail' && <Meta label="Lighting" value={state.lighting || '—'} />}
            {mode === 'typography' && <Meta label="Layout" value={state.layout || '—'} />}
            {mode === 'typography' && <Meta label="Energy" value={state.energy || '—'} />}
          </>
        )}
      </div>
    </div>
  );
}

function Meta({ label, value }) {
  return (
    <div className="surface-elev px-2.5 py-1.5">
      <div className="uppercase tracking-widest text-text-dim mono text-[9px]">{label}</div>
      <div className="text-text font-medium mono text-[11px] truncate">{value}</div>
    </div>
  );
}

// ═══ POSITION → ZONE HELPERS (konsisten utk semua mode) ═══
// Subject zone = area dimana product/character placeholder taruh
function subjectZone(W, H, pos) {
  switch (pos) {
    case 'right':     return { x: W*0.55, y: H*0.15, w: W*0.38, h: H*0.7  };
    case 'left':      return { x: W*0.07, y: H*0.15, w: W*0.38, h: H*0.7  };
    case 'center':    return { x: W*0.25, y: H*0.42, w: W*0.5,  h: H*0.5  };
    case 'isometric': return { x: W*0.42, y: H*0.12, w: W*0.5,  h: H*0.55 };
    case 'dynamic':   return { x: W*0.05, y: H*0.45, w: W*0.9,  h: H*0.48 };
    default:          return { x: W*0.55, y: H*0.15, w: W*0.38, h: H*0.7  };
  }
}

// Text zone = area dimana headline + supporting text taruh (OPPOSITE side dari subject)
function textZone(W, H, pos) {
  switch (pos) {
    case 'right':     return { x: 22,      y: H*0.3,  w: W*0.46 }; // text left, subject right
    case 'left':      return { x: W*0.52,  y: H*0.3,  w: W*0.46 }; // text right, subject left
    case 'center':    return { x: 22,      y: H*0.08, w: W*0.96 }; // text top, subject bottom-center
    case 'isometric': return { x: 22,      y: H*0.7,  w: W*0.5  }; // text bottom-left, subject top-right floating
    case 'dynamic':   return { x: 22,      y: H*0.08, w: W*0.55 }; // text top-left, subject big bottom
    default:          return { x: 22,      y: H*0.3,  w: W*0.46 };
  }
}

function renderBanner(W, H, s) {
  const pos   = s.position || 'center';
  const count = Math.max(1, Math.min(5, s.imageCount || 1));
  const t     = textZone(W, H, pos);

  return (
    <g>
      {/* Image placeholders react to position + count */}
      {renderImagePlaceholders(W, H, count, pos)}
      {/* Text lines (headline · sub · description) */}
      <rect x={t.x} y={t.y}        width={Math.min(t.w, 140)} height={10} rx={3} fill="white" fillOpacity="0.95" filter="url(#softShadow)" />
      <rect x={t.x} y={t.y + 18}   width={Math.min(t.w * 0.7, 90)} height={6}  rx={2} fill="white" fillOpacity="0.7" />
      <rect x={t.x} y={t.y + 30}   width={Math.min(t.w * 0.5, 70)} height={6}  rx={2} fill="white" fillOpacity="0.55" />
      {s.cta && (
        <rect x={t.x} y={t.y + 50} width={70} height={18} rx={9} fill="white" fillOpacity="0.95" filter="url(#softShadow)" />
      )}
    </g>
  );
}

function renderImagePlaceholders(W, H, count, pos) {
  const boxFill = 'rgba(255,255,255,0.35)';
  const boxStroke = 'rgba(0,0,0,0.15)';
  const boxBase = { rx: 6, fill: boxFill, stroke: boxStroke, strokeWidth: 1 };
  const items = [];
  const z = subjectZone(W, H, pos);
  const { x: zoneX, y: zoneY, w: zoneW, h: zoneH } = z;

  if (count === 1) {
    items.push(<rect key="i0" x={zoneX} y={zoneY} width={zoneW} height={zoneH} {...boxBase} />);
  } else if (count === 2) {
    // Stack arah: dynamic/horizontal → side by side; vertical position → stack
    if (pos === 'dynamic' || pos === 'center') {
      const w2 = (zoneW - 8) / 2;
      items.push(<rect key="i0" x={zoneX}        y={zoneY} width={w2} height={zoneH} {...boxBase} />);
      items.push(<rect key="i1" x={zoneX + w2 + 8} y={zoneY} width={w2} height={zoneH} {...boxBase} />);
    } else {
      const w2 = (zoneW - 8) / 2;
      items.push(<rect key="i0" x={zoneX}        y={zoneY} width={w2} height={zoneH} {...boxBase} />);
      items.push(<rect key="i1" x={zoneX + w2 + 8} y={zoneY} width={w2} height={zoneH} {...boxBase} />);
    }
  } else if (count === 3) {
    const main = zoneW * 0.6;
    const stack = zoneW - main - 8;
    items.push(<rect key="i0" x={zoneX} y={zoneY} width={main} height={zoneH} {...boxBase} />);
    const h2 = (zoneH - 8) / 2;
    items.push(<rect key="i1" x={zoneX + main + 8} y={zoneY} width={stack} height={h2} {...boxBase} />);
    items.push(<rect key="i2" x={zoneX + main + 8} y={zoneY + h2 + 8} width={stack} height={h2} {...boxBase} />);
  } else if (count === 4) {
    const w2 = (zoneW - 8) / 2;
    const h2 = (zoneH - 8) / 2;
    for (let i = 0; i < 4; i++) {
      items.push(<rect key={'i'+i} x={zoneX + (i%2)*(w2+8)} y={zoneY + Math.floor(i/2)*(h2+8)} width={w2} height={h2} {...boxBase} />);
    }
  } else if (count === 5) {
    const w2 = (zoneW - 8) / 2;
    const h2 = (zoneH - 8) / 2;
    items.push(<rect key="i0" x={zoneX} y={zoneY} width={w2} height={h2} {...boxBase} />);
    items.push(<rect key="i1" x={zoneX + w2 + 8} y={zoneY} width={w2} height={h2} {...boxBase} />);
    items.push(<rect key="i2" x={zoneX} y={zoneY + h2 + 8} width={w2} height={h2} {...boxBase} />);
    items.push(<rect key="i3" x={zoneX + w2 + 8} y={zoneY + h2 + 8} width={w2} height={h2} {...boxBase} />);
    items.push(<rect key="i4" x={zoneX + zoneW/4} y={zoneY + zoneH/3} width={zoneW/2} height={zoneH/3} {...boxBase} fill="rgba(255,255,255,0.55)" />);
  }
  return items;
}

function renderThumbnail(W, H, s) {
  const pos   = s.position   || 'right';
  const count = Math.max(1, Math.min(5, s.imageCount || 1));
  const t     = textZone(W, H, pos);

  return (
    <g>
      {/* Image/subject placeholders react to position + count */}
      {renderImagePlaceholders(W, H, count, pos)}
      {/* Big title block — uses textZone (selalu opposite dari subject) */}
      <rect x={t.x} y={t.y}        width={Math.min(t.w, W*0.5)} height={16} rx={3} fill="white" filter="url(#softShadow)" />
      <rect x={t.x} y={t.y + 22}   width={Math.min(t.w * 0.78, W*0.4)} height={10} rx={2} fill="white" fillOpacity="0.85" />
      <rect x={t.x} y={t.y + 38}   width={Math.min(t.w * 0.6, W*0.3)}  height={8}  rx={2} fill="white" fillOpacity="0.65" />
    </g>
  );
}

// ═══ REVIEW BANNER WIREFRAME (layout-aware, ink-adaptive) ═══
// Palette name → [primary, secondary] hex untuk background mock.
const RV_PALETTE_HEX = {
  'Luxury Black Gold':            ['#1a1408', '#d4af37'],
  'Clean White Beige':           ['#efe7d8', '#cdbfa6'],
  'Soft Pastel':                 ['#f6cfe0', '#cfe5f7'],
  'Premium Neutral':             ['#b9b1a3', '#3a3c40'],
  'Bright Ecommerce':            ['#e23b3b', '#f4d03f'],
  'Rose Gold Elegant':           ['#e3b7a8', '#f3d3d0'],
  'Fresh Green Natural':         ['#b7c9a8', '#eef2e6'],
  'Ocean Blue Modern':           ['#2f6fb0', '#1f2a44'],
  'Earthy Warm':                 ['#c1663f', '#e8d6bf'],
  'Bold Red White':              ['#e23b3b', '#f5f5f5'],
  'Monochrome':                  ['#2b2b2b', '#cfcfcf'],
  'Vibrant Gradient':            ['#8b5cf6', '#f97316'],
  'Brand Color Matching Product':['#9aa0a6', '#e5e7eb'],
};
function reviewColors(s) {
  const p = s.primary_color, sec = s.secondary_color;
  if (p || sec) return [p || '#cccccc', sec || '#f1f1f1'];
  return RV_PALETTE_HEX[s.color_palette] || ['#e5e7eb', '#cbd5e1'];
}
function luminance(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return 0.6;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.299*r + 0.587*g + 0.114*b) / 255;
}

function renderReviewBanner(W, H, s) {
  const [bg] = reviewColors(s);
  const ink = luminance(bg) > 0.55 ? '#1f2937' : '#ffffff'; // dark ink on light bg, light on dark
  const ACC = '#ef4444';
  const rvProduct = (k, x, y, w, h) => ([
    <rect key={k} x={x} y={y} width={w} height={h} rx={8} fill={ink} fillOpacity={0.08} stroke={ink} strokeOpacity={0.32} strokeWidth={1} filter="url(#softShadow)" />,
    <circle key={k + 'c'} cx={x + w/2} cy={y + h/2} r={Math.min(w, h)*0.16} fill={ink} fillOpacity={0.16} />,
  ]);
  const rvHeadline = (k, x, y, w, big) => ([
    <rect key={k} x={x} y={y} width={w} height={big ? 20 : 12} rx={4} fill={ink} fillOpacity={0.9} />,
    <rect key={k + '2'} x={x} y={y + (big ? 26 : 17)} width={w*0.62} height={big ? 11 : 7} rx={3} fill={ink} fillOpacity={0.5} />,
  ]);
  const rvReview = (k, x, y, barW, rows = 3) => {
    const a = [];
    for (let i = 0; i < rows; i++) {
      a.push(<rect key={k + 'c' + i} x={x} y={y + i*13} width={7} height={7} rx={2} fill={ACC} fillOpacity={0.85} />);
      a.push(<rect key={k + 'b' + i} x={x + 12} y={y + i*13 + 1} width={barW} height={5} rx={2} fill={ink} fillOpacity={0.45} />);
    }
    return a;
  };
  const rvCTA = (k, x, y, w) => <rect key={k} x={x} y={y} width={w} height={17} rx={8.5} fill={ACC} filter="url(#softShadow)" />;
  const rvTrust = (k, x, y, w = 56) => <rect key={k} x={x} y={y} width={w} height={12} rx={6} fill={ink} fillOpacity={0.14} stroke={ink} strokeOpacity={0.3} />;
  const rvHuman = (k, x, y, w, h) => <rect key={k} x={x} y={y} width={w} height={h} rx={10} fill={ink} fillOpacity={0.12} stroke={ink} strokeOpacity={0.28} />;
  const rvBadges = (list, cx, cy) => (list || []).slice(0, 2).map((b, i) =>
    <circle key={'bg' + b + i} cx={cx} cy={cy + i*22} r={9} fill={ACC} fillOpacity={0.9} filter="url(#softShadow)" />);

  const L = s.layout_type || '';
  const human = !!s.human_enable;
  const trust = !!s.trust_enable;
  const big = s.headline_placement === 'large center headline';
  const ctaRight = /bottom right/.test(s.cta_placement || '');
  const ctaW = W*0.36, ctaY = H*0.87;
  const ctaX = ctaRight ? W*0.56 : W*0.5 - ctaW/2;
  const e = [];

  // Archetype digerakkan layout_type ATAU review_framework (dua-duanya bikin wireframe berubah)
  const key = `${L} ${s.review_framework || ''}`;
  const arch =
    /Comparison|Split|before_after|expectation|problem_solution|premium_vs_cheap|pros_cons/.test(key) ? 'comparison' :
    /Creator|creator_quote|first_impression/.test(key) ? 'creator' :
    /Marketplace|rating_breakdown|social_proof/.test(key)  ? 'marketplace' :
    /Feature|feature_breakdown/.test(key) ? 'feature' :
    /Grid/.test(key) ? 'grid' :
    'hero';

  // Headline koordinat ← headline_placement
  const hpl = s.headline_placement || 'top center';
  const hW = big ? W*0.84 : W*0.58;
  const headP =
    hpl === 'top left' || hpl === 'diagonal accent' ? { x: W*0.06, y: H*0.06, w: hW } :
    hpl === 'top right'                             ? { x: W*0.94 - hW, y: H*0.06, w: hW } :
    hpl === 'beside product'                        ? { x: W*0.06, y: H*0.36, w: W*0.42 } :
    hpl === 'bottom center'                         ? { x: W*0.5 - hW/2, y: H*0.76, w: hW } :
    hpl === 'center overlay'                        ? { x: W*0.12, y: H*0.44, w: W*0.76 } :
    hpl === 'large center headline'                 ? { x: W*0.08, y: H*0.34, w: W*0.84 } :
                                                      { x: W*0.5 - hW/2, y: H*0.06, w: hW }; // top center
  const head = () => rvHeadline('h', headP.x, headP.y, headP.w, big);

  // Human position
  const hpos = s.human_position || 'right side';
  const humanLeft = /left/.test(hpos);
  const humanCenter = /center|behind/.test(hpos);

  if (arch === 'comparison') {
    e.push(...head());
    const py = H*0.28, ph = H*0.38;
    e.push(<rect key="lblA" x={W*0.1}  y={py - 12} width={42} height={9} rx={3} fill={ink} fillOpacity={0.7} />);
    e.push(<rect key="lblB" x={W*0.56} y={py - 12} width={42} height={9} rx={3} fill={ink} fillOpacity={0.7} />);
    e.push(...rvProduct('pa', W*0.08, py, W*0.38, ph));
    e.push(...rvProduct('pb', W*0.54, py, W*0.38, ph));
    e.push(<line key="div" x1={W*0.5} y1={py - 4} x2={W*0.5} y2={py + ph + 4} stroke={ink} strokeOpacity={0.4} strokeWidth={1} strokeDasharray="4 4" />);
    if (trust) e.push(rvTrust('t', W*0.5 - 28, H*0.7, 56));
    e.push(rvCTA('cta', ctaX, ctaY, ctaW));
  } else if (arch === 'creator') {
    const hux = humanLeft || !(/right|beside/.test(hpos)) ? W*0.06 : W*0.54;
    const pux = hux < W*0.3 ? W*0.58 : W*0.1;
    e.push(...head());
    e.push(rvHuman('hu', hux, H*0.26, W*0.4, H*0.64));
    e.push(...rvProduct('p', pux, H*0.52, W*0.32, H*0.3));
    e.push(<rect key="q" x={pux - W*0.04} y={H*0.26} width={W*0.4} height={H*0.18} rx={10} fill={ink} fillOpacity={0.12} stroke={ink} strokeOpacity={0.3} filter="url(#softShadow)" />);
    e.push(...rvReview('r', pux, H*0.3, W*0.3, 2));
    if (trust) e.push(rvTrust('t', pux, H*0.47, 50));
    e.push(...rvBadges(s.badges, pux + W*0.28, H*0.55));
    e.push(rvCTA('cta', ctaRight ? W*0.56 : W*0.54, ctaY, ctaW));
  } else if (arch === 'marketplace') {
    e.push(...head());
    e.push(...rvProduct('p', W*0.06, H*0.26, W*0.4, H*0.46));
    e.push(...rvBadges(s.badges, W*0.12, H*0.32));
    const rx = W*0.52;
    for (let i = 0; i < 5; i++) e.push(<circle key={'st' + i} cx={rx + 6 + i*14} cy={H*0.3} r={4} fill={ACC} fillOpacity={0.9} />);
    for (let i = 0; i < 3; i++) {
      e.push(<rect key={'sb0' + i} x={rx} y={H*0.4 + i*15} width={W*0.4} height={6} rx={3} fill={ink} fillOpacity={0.14} />);
      e.push(<rect key={'sb1' + i} x={rx} y={H*0.4 + i*15} width={W*0.4*(0.6 + 0.13*i)} height={6} rx={3} fill={ink} fillOpacity={0.55} />);
    }
    if (trust) e.push(rvTrust('t', rx, H*0.62, 72));
    e.push(rvCTA('cta', W*0.52, ctaY, W*0.4));
  } else if (arch === 'feature') {
    e.push(...head());
    const cx = W*0.5, cy = H*0.5, pw = W*0.28, ph = H*0.3;
    e.push(...rvProduct('p', cx - pw/2, cy - ph/2, pw, ph));
    const calls = [[W*0.1, H*0.3], [W*0.76, H*0.32], [W*0.1, H*0.64], [W*0.76, H*0.66]];
    calls.forEach(([bx, by], i) => {
      e.push(<line key={'fl' + i} x1={cx} y1={cy} x2={bx + W*0.06} y2={by + 7} stroke={ink} strokeOpacity={0.4} strokeWidth={1} />);
      e.push(<rect key={'fb' + i} x={bx} y={by} width={W*0.14} height={14} rx={7} fill={ink} fillOpacity={0.14} stroke={ink} strokeOpacity={0.3} filter="url(#softShadow)" />);
    });
    e.push(rvCTA('cta', ctaX, ctaY, ctaW));
  } else if (arch === 'grid') {
    e.push(...head());
    const gx = W*0.19, gy = H*0.24, gw = W*0.29, gh = H*0.26, gap = 10;
    for (let i = 0; i < 4; i++) {
      e.push(...rvProduct('g' + i, gx + (i%2)*(gw + gap), gy + Math.floor(i/2)*(gh + gap), gw, gh));
    }
    if (trust) e.push(rvTrust('t', W*0.5 - 28, H*0.78, 56));
    e.push(rvCTA('cta', ctaX, ctaY, ctaW));
  } else {
    // HERO / MAGAZINE / SPOTLIGHT — produk ← product_position, human ← human_position (anti-tabrakan)
    const pzy = H*0.25, pzh = H*0.32;
    const pp = s.product_position || '';
    let prodSide = /left/.test(pp) ? 'L' : /right/.test(pp) ? 'R' : 'C';
    let humSide = !human ? null : humanLeft ? 'L' : (/right|beside/.test(hpos) ? 'R' : (humanCenter ? 'C' : 'R'));
    // hindari produk & human di sisi sama (non-center)
    if (humSide && humSide === prodSide && prodSide !== 'C') humSide = prodSide === 'L' ? 'R' : 'L';
    // produk center + human di sisi → dorong produk ke sisi berlawanan
    if (prodSide === 'C' && humSide === 'L') prodSide = 'R';
    else if (prodSide === 'C' && humSide === 'R') prodSide = 'L';
    let pzx = prodSide === 'L' ? W*0.07 : prodSide === 'R' ? W*0.51 : W*0.30;
    let pzw = (humSide && humSide !== 'C') ? W*0.42 : W*0.40;
    if (humSide === 'C') { pzx = W*0.34; pzw = W*0.32; } // human di belakang produk
    if (human) {
      const hx = humSide === 'L' ? W*0.05 : humSide === 'C' ? W*0.34 : W*0.63;
      const hw = humSide === 'C' ? W*0.32 : W*0.3;
      e.push(rvHuman('hu', hx, H*0.22, hw, H*0.62)); // di-push duluan → di belakang produk
    }
    e.push(...head());
    e.push(...rvProduct('p', pzx, pzy, pzw, pzh));
    if (trust) e.push(rvTrust('t', pzx, pzy - 15, 56));
    e.push(...rvBadges(s.badges, pzx + pzw - 6, pzy + 12));
    e.push(...rvReview('r', W*0.08, H*0.66, W*0.34));
    e.push(rvCTA('cta', ctaX, ctaY, ctaW));
  }

  // Human element selalu muncul/hilang di SEMUA layout (hero & creator sudah handle)
  if (human && arch !== 'hero' && arch !== 'creator') {
    e.push(rvHuman('huX', humanLeft ? W*0.03 : W*0.79, H*0.48, W*0.18, H*0.42));
  }

  return <g>{e}</g>;
}

// ═══ CAROUSEL COVER WIREFRAME (slide 1) — letak gambar & teks dari dropdown ═══
function newsImageBox(x, y, w, h, key) {
  const r = [];
  r.push(<rect key={key} x={x} y={y} width={w} height={h} rx={6} fill="rgba(255,255,255,0.30)" stroke="rgba(0,0,0,0.18)" strokeWidth={1} filter="url(#softShadow)" />);
  const cx = x + w * 0.3, cy = y + h * 0.34, rad = Math.min(w, h) * 0.09;
  r.push(<circle key={key + 's'} cx={cx} cy={cy} r={rad} fill="rgba(255,255,255,0.6)" />);
  r.push(<path key={key + 'm'} d={`M${x + 5} ${y + h - 5} L${x + w * 0.4} ${y + h * 0.52} L${x + w * 0.62} ${y + h - 5} Z`} fill="rgba(255,255,255,0.45)" />);
  r.push(<path key={key + 'm2'} d={`M${x + w * 0.46} ${y + h - 5} L${x + w * 0.72} ${y + h * 0.46} L${x + w - 5} ${y + h - 5} Z`} fill="rgba(255,255,255,0.32)" />);
  return r;
}
function newsHeadline(x, y, w, key, big, ink = 'white') {
  const hh = big ? 16 : 11, gap = 6;
  return [
    <rect key={key}        x={x} y={y}                width={w}       height={hh}        rx={3} fill={ink} filter="url(#softShadow)" />,
    <rect key={key + '2'}  x={x} y={y + hh + gap}     width={w * 0.82} height={hh}        rx={3} fill={ink} fillOpacity="0.9" />,
    <rect key={key + '3'}  x={x} y={y + (hh + gap) * 2} width={w * 0.5} height={big ? 9 : 7} rx={2} fill={ink} fillOpacity="0.6" />,
  ];
}
function renderCarouselCover(W, H, s) {
  const layout = s.coverLayout || 'auto';
  const ink = (s.templateType === 'news' && s.newsTextColor) ? s.newsTextColor : 'white';
  const e = [];
  // Category tag (kiri atas) + slide indicator (kanan atas) + source bar (bawah)
  e.push(<rect key="cat" x={14} y={12} width={54} height={15} rx={4} fill="#ef4444" filter="url(#softShadow)" />);
  e.push(<rect key="cat2" x={20} y={17} width={32} height={5} rx={2} fill="white" fillOpacity={0.95} />);
  e.push(<rect key="ind" x={W - 44} y={12} width={30} height={14} rx={7} fill="rgba(255,255,255,0.22)" stroke="rgba(255,255,255,0.4)" strokeWidth={1} />);
  e.push(<rect key="src" x={14} y={H - 22} width={W - 28} height={10} rx={5} fill="rgba(255,255,255,0.16)" />);
  e.push(<circle key="srcd" cx={23} cy={H - 17} r={3} fill="#ef4444" />);

  const top = 40, bottom = H - 32, ch = bottom - top;
  if (layout === 'image-top') {
    e.push(...newsImageBox(W * 0.06, top, W * 0.88, ch * 0.52, 'img'));
    e.push(...newsHeadline(W * 0.06, top + ch * 0.6, W * 0.74, 'h', true, ink));
  } else if (layout === 'image-bottom') {
    e.push(...newsHeadline(W * 0.06, top, W * 0.74, 'h', true, ink));
    e.push(...newsImageBox(W * 0.06, top + ch * 0.46, W * 0.88, ch * 0.54, 'img'));
  } else if (layout === 'image-right') {
    e.push(...newsImageBox(W * 0.52, top, W * 0.42, ch, 'img'));
    e.push(...newsHeadline(W * 0.06, top + ch * 0.22, W * 0.4, 'h', false, ink));
  } else if (layout === 'image-left') {
    e.push(...newsImageBox(W * 0.06, top, W * 0.42, ch, 'img'));
    e.push(...newsHeadline(W * 0.52, top + ch * 0.22, W * 0.4, 'h', false, ink));
  } else if (layout === 'image-full') {
    e.push(...newsImageBox(W * 0.04, top - 4, W * 0.92, ch + 8, 'img'));
    e.push(<rect key="ov" x={W * 0.04} y={top + ch * 0.48} width={W * 0.92} height={ch * 0.52 + 4} rx={6} fill="rgba(0,0,0,0.45)" />);
    e.push(...newsHeadline(W * 0.1, top + ch * 0.62, W * 0.72, 'h', true, ink));
  } else if (layout === 'text-focus') {
    e.push(...newsImageBox(W * 0.06, top, W * 0.34, ch * 0.28, 'img'));
    e.push(...newsHeadline(W * 0.06, top + ch * 0.42, W * 0.86, 'h', true, ink));
  } else { // auto / hero (default) — gambar kanan-tengah, headline kiri-atas
    e.push(...newsImageBox(W * 0.52, top + ch * 0.12, W * 0.42, ch * 0.72, 'img'));
    e.push(...newsHeadline(W * 0.06, top + ch * 0.12, W * 0.4, 'h', true, ink));
  }
  return <g>{e}</g>;
}

function renderTypography(W, H, s) {
  const pos   = s.position || 'center';
  const count = Math.max(1, Math.min(5, s.imageCount || 1));
  const t     = textZone(W, H, pos);

  // Typography mode = headline dominan; subject placeholder optional
  // Aturan: kalau count=1 + position=center, headline mega-besar tanpa subject (typography hero)
  const headlineOnly = count === 1 && pos === 'center';
  const headlineW = headlineOnly ? W*0.85 : t.w;
  const headlineX = headlineOnly ? (W - headlineW) / 2 : t.x;
  const headlineY = headlineOnly ? H*0.32 : t.y;

  return (
    <g>
      {/* Subject placeholders kecuali headlineOnly */}
      {!headlineOnly && renderImagePlaceholders(W, H, count, pos)}

      {/* Headline block */}
      <rect x={headlineX} y={headlineY}        width={headlineW}        height={20} rx={4} fill="white" filter="url(#softShadow)" />
      <rect x={headlineX} y={headlineY + 26}   width={headlineW * 0.75} height={14} rx={3} fill="white" fillOpacity="0.85" />
      <rect x={headlineX} y={headlineY + 50}   width={headlineW * 0.4}  height={10} rx={2} fill="white" fillOpacity="0.7" />

      {/* Character placeholder kalau ada Character pilihan + headlineOnly */}
      {headlineOnly && s.character && s.character !== 'No Human' && s.character !== 'Auto Character' && (
        <rect x={W*0.68} y={H*0.55} width={W*0.25} height={H*0.4} rx={8} fill="rgba(255,255,255,0.25)" stroke="rgba(0,0,0,0.1)" />
      )}
    </g>
  );
}
