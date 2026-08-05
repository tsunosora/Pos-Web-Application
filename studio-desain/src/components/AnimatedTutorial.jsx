import { useEffect, useState } from 'react';
import { CONFIG } from '../config.js';
import {
  MousePointer2, Sparkles, Copy, Send, Plus, Mic,
  Image as ImageIcon, FolderOpen, Wand2, Beaker, Globe, MoreHorizontal,
  ChevronRight, ChevronDown, FileImage, Check, PartyPopper,
} from 'lucide-react';

const DEMOS = [
  { brand: 'UrbanCraft',  headline: 'Streetwear Drop SS26',     image: '/landing/ads-1x1/ig-04.jpg', accent: '#f59e0b' },
  { brand: 'AuraSkin',    headline: 'Premium Sunscreen SPF 50', image: '/landing/ads-1x1/ig-01.jpg', accent: '#f472b6' },
  { brand: 'GoldHeritage',headline: '24K Pendant — Eid Edition',image: '/landing/ads-1x1/ig-10.jpg', accent: '#ca8a04' },
];

const STEPS = [
  { num: 1, title: 'Pilih Mode & Isi Form' },
  { num: 2, title: 'Generate & Copy' },
  { num: 3, title: 'Buka ChatGPT → Upload Foto Produk' },
  { num: 4, title: 'Paste Prompt → Hasil Muncul' },
];

const PHASES = [
  { name: 'studio-idle',       at:     0, step: 1 },
  { name: 'cursor-to-gen',     at:   900, step: 1 },
  { name: 'click-gen',         at:  2300, step: 2 },
  { name: 'cursor-to-copy',    at:  2900, step: 2 },
  { name: 'click-copy',        at:  3800, step: 2 },
  { name: 'browser-switch',    at:  4700, step: 3 },
  { name: 'chatgpt-idle',      at:  5800, step: 3 },
  { name: 'cursor-to-plus',    at:  6300, step: 3 },
  { name: 'click-plus',        at:  7100, step: 3 },
  { name: 'cursor-to-image',   at:  7600, step: 3 },   // klik "Buat gambar" dulu
  { name: 'click-image',       at:  8400, step: 3 },
  { name: 'cursor-to-attach',  at:  9000, step: 3 },   // baru klik "Tambah foto & file"
  { name: 'click-attach',      at:  9800, step: 3 },
  { name: 'file-picker-open',  at: 10300, step: 3 },
  { name: 'cursor-to-file',    at: 11000, step: 3 },
  { name: 'click-file',        at: 11800, step: 3 },
  { name: 'file-attached',     at: 12400, step: 3 },
  { name: 'paste-prompt',      at: 13300, step: 4 },
  { name: 'click-send',        at: 14600, step: 4 },
  { name: 'chatgpt-thinking',  at: 15200, step: 4 },
  { name: 'chatgpt-result',    at: 16600, step: 4 },
];
const CYCLE_MS = 22500;

export default function AnimatedTutorial() {
  const [idx, setIdx]     = useState(0);
  const [phase, setPhase] = useState('studio-idle');

  useEffect(() => {
    setPhase('studio-idle');
    const timers = PHASES.map((p) => setTimeout(() => setPhase(p.name), p.at));
    const next   = setTimeout(() => setIdx((i) => (i + 1) % DEMOS.length), CYCLE_MS);
    return () => { timers.forEach(clearTimeout); clearTimeout(next); };
  }, [idx]);

  const d = DEMOS[idx];
  const currentStep = PHASES.find((p) => p.name === phase)?.step || 1;
  const progress    = Math.min(100, ((PHASES.findIndex((p) => p.name === phase) + 1) / PHASES.length) * 100);

  const inStudio     = ['studio-idle', 'cursor-to-gen', 'click-gen', 'cursor-to-copy', 'click-copy'].includes(phase);
  const inTransition = phase === 'browser-switch';
  const inChatgpt    = !inStudio && !inTransition;

  return (
    <div
      className="relative w-full overflow-hidden rounded-lg border border-border bg-bg-deep"
      style={{ aspectRatio: '720 / 405', containerType: 'inline-size' }}
    >
      <div
        className="absolute top-0 left-0 origin-top-left"
        style={{
          width: '720px',
          height: '405px',
          transform: 'scale(calc(100cqi / 720px))',
        }}
      >
       <div className="relative w-full h-full bg-bg-deep overflow-hidden">
      {/* Top progress bar */}
      <div className="absolute top-0 inset-x-0 z-50 px-3 py-2 bg-black/70 backdrop-blur-sm flex items-center gap-2 border-b border-border">
        <div className="flex items-center gap-1.5 shrink-0">
          {STEPS.map((s) => {
            const active = currentStep === s.num;
            const passed = currentStep > s.num;
            return (
              <div key={s.num} className={`flex items-center gap-1 transition-all ${active ? 'scale-110' : ''}`}>
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold ${
                  active ? 'bg-accent text-white shadow-[0_0_10px_rgba(var(--accent-rgb),0.6)]' :
                  passed ? 'bg-accent/50 text-white' : 'bg-bg-deep border border-border text-text-dim'
                }`}>{s.num}</span>
                {s.num < 4 && <span className={`w-3 h-px ${passed ? 'bg-accent/50' : 'bg-border'}`} />}
              </div>
            );
          })}
        </div>
        <div className="flex-1 text-[10px] mono uppercase tracking-widest text-text-mut truncate">
          STEP {currentStep} · {STEPS[currentStep - 1]?.title}
        </div>
        <div className="w-16 h-1 bg-bg-deep rounded-full overflow-hidden shrink-0">
          <div className="h-full bg-accent transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Scene container */}
      <div className="absolute inset-0 pt-9">
        {inStudio     && <StudioScene  demo={d} phase={phase} />}
        {inTransition && <BrowserSwitchScene demo={d} />}
        {inChatgpt    && <ChatGPTScene demo={d} phase={phase} />}
      </div>

      {/* Scene flash overlay during transitions */}
      {(phase === 'browser-switch' || phase === 'click-copy' || phase === 'chatgpt-result') && (
        <div key={phase} className="absolute inset-0 z-40 pointer-events-none tutorial-scene-flash" />
      )}
       </div>
      </div>
    </div>
  );
}

// ═══════════════════════ SCENE 1: STUDIO ═══════════════════════
function StudioScene({ demo: d, phase }) {
  const cursor =
    phase === 'studio-idle'    ? { x: 22, y: 30 } :
    phase === 'cursor-to-gen'  ? { x: 75, y: 89 } :
    phase === 'click-gen'      ? { x: 75, y: 89 } :
    phase === 'cursor-to-copy' ? { x: 93, y: 89 } :
    phase === 'click-copy'     ? { x: 93, y: 89 } :
                                 { x: 50, y: 50 };
  const clicking    = phase === 'click-gen' || phase === 'click-copy';
  const showToast   = phase === 'click-copy';
  const hlGen       = phase === 'cursor-to-gen' || phase === 'click-gen';
  const hlCopy      = phase === 'cursor-to-copy' || phase === 'click-copy';

  return (
    <div className="absolute inset-0 bg-[#0a0405] flex flex-col">
      <BrowserChrome url="app.brandmu.id/studio" live />

      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <div className="w-8 bg-[#150506] border-r border-border flex flex-col items-center py-1.5 gap-1 shrink-0">
          <div className="w-5 h-5 rounded-md bg-accent flex items-center justify-center text-white font-black text-[8px] shadow-[0_0_8px_rgba(var(--accent-rgb),0.55)]">F</div>
          <div className="w-4 h-px bg-border my-0.5" />
          {[true, false, false, false, false].map((active, i) => (
            <div key={i} className={`w-5 h-5 rounded ${active ? 'bg-accent-sm border border-border-strong' : ''}`} />
          ))}
        </div>

        <div className="flex-1 flex min-w-0 relative">
          {/* Form column */}
          <div className="flex-1 p-3 border-r border-border min-w-0">
            <div className="text-[8px] mono uppercase tracking-widest text-text-dim mb-1">/ Banner Generator</div>
            <div className="text-xs font-bold mb-2 truncate">{d.headline}</div>
            <div className="space-y-1.5">
              <MiniRow label="BRAND" value={d.brand} />
              <MiniRow label="STYLE" value="Minimal Clean" dropdown />
              <MiniRow label="RATIO" value="4:5 Portrait" dropdown />
            </div>
          </div>

          {/* Preview + Generate column */}
          <div className="w-[42%] p-3 flex flex-col gap-1.5 bg-bg-deep/50">
            <div className="text-[8px] mono uppercase tracking-widest text-text-dim flex items-center justify-between">
              <span>PROMPT TERMINAL</span>
              <span className="text-accent">● READY</span>
            </div>
            <div className="flex-1 rounded border border-border bg-bg-deep p-1.5 text-[7px] mono leading-tight overflow-hidden">
              <div className="text-accent">$ feeds build --mode=banner</div>
              <div className="text-text-mut">{'> form input :'} <span className="text-accent">connected</span></div>
              <div className="text-text-mut">{'> template :'} <span className="text-accent">ready</span></div>
              <div className="text-text-mut">{'> output :'} <span className="text-text-dim">awaiting trigger</span></div>
              <div className="mt-1 text-text-dim">{'> klik tombol'} <span className="text-accent font-bold">Generate</span> {'untuk build'}</div>
              {(phase === 'click-gen' || phase === 'cursor-to-copy' || phase === 'click-copy') && (
                <div className="mt-1 text-text tutorial-fade-in">
                  <div className="text-accent">{'> output : ready ✓'}</div>
                  <div className="text-text-mut">{'> prompt size : 2.4 KB'}</div>
                </div>
              )}
            </div>
            {/* Action buttons */}
            <div className="flex gap-1.5">
              <button className={`flex-1 px-2 py-1.5 rounded text-[10px] font-bold flex items-center justify-center gap-1 bg-gradient-to-b from-[var(--accent)] to-[var(--accent-deep)] text-white border border-white/20 transition-all ${
                hlGen ? 'shadow-[0_0_18px_rgba(var(--accent-rgb),0.7)] scale-105' : ''
              } ${phase === 'click-gen' ? 'scale-95' : ''}`}>
                <Sparkles className="w-3 h-3" strokeWidth={2.5} />
                Generate
              </button>
              <button className={`px-2 py-1.5 rounded text-[10px] font-bold flex items-center gap-1 border transition-all ${
                hlCopy ? 'bg-accent text-white border-accent shadow-[0_0_18px_rgba(var(--accent-rgb),0.7)] scale-105' :
                'bg-bg-deep text-text-mut border-border'
              } ${phase === 'click-copy' ? 'scale-95' : ''}`}>
                <Copy className="w-3 h-3" />
                Copy
              </button>
            </div>
          </div>

          {/* Cursor */}
          <Cursor x={cursor.x} y={cursor.y} clicking={clicking} accent={d.accent} />

          {/* Callouts */}
          {hlGen && (
            <Callout x={62} y={70} accent={d.accent}>
              <Sparkles className="w-3 h-3" />
              Klik <b>Generate</b> untuk build prompt
            </Callout>
          )}
          {hlCopy && (
            <Callout x={66} y={70} accent={d.accent}>
              <Copy className="w-3 h-3" />
              Lalu klik <b>Copy</b> untuk salin prompt
            </Callout>
          )}

          {/* Toast */}
          {showToast && (
            <div className="absolute left-1/2 top-4 z-40 tutorial-toast-in px-3 py-1.5 rounded-full bg-accent text-white text-[10px] font-bold flex items-center gap-1.5 shadow-[0_0_20px_rgba(var(--accent-rgb),0.6)]">
              <Copy className="w-3 h-3" />
              Prompt copied to clipboard ✓
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════ SCENE 2: BROWSER SWITCH ═══════════════════════
function BrowserSwitchScene({ demo: d }) {
  return (
    <div className="absolute inset-0 bg-[#0a0405] flex flex-col items-center justify-center gap-4 overflow-hidden">
      <div className="absolute inset-x-0 h-20 dissolve-scanline pointer-events-none"
           style={{
             background: `linear-gradient(180deg, transparent, ${d.accent}80, transparent)`,
             boxShadow: `0 0 40px ${d.accent}`,
           }}
      />
      <div className="text-[10px] mono opacity-30 line-through text-text-dim">
        app.brandmu.id/studio
      </div>
      <div className="flex items-center gap-3">
        <span className="text-2xl text-text-dim">↓</span>
      </div>
      <div className="text-sm mono font-bold text-accent flex items-center gap-2 tutorial-fade-in">
        <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
        chatgpt.com
      </div>
      <div className="text-[9px] mono uppercase tracking-widest text-text-mut tutorial-fade-in" style={{ animationDelay: '0.3s' }}>
        switching to chatgpt...
      </div>
    </div>
  );
}

// ═══════════════════════ SCENE 3 & 4: CHATGPT ═══════════════════════
function ChatGPTScene({ demo: d, phase }) {
  const cursor =
    phase === 'chatgpt-idle'      ? { x: 35, y: 30 } :
    phase === 'cursor-to-plus'    ? { x: 6,  y: 92 } :
    phase === 'click-plus'        ? { x: 6,  y: 92 } :
    phase === 'cursor-to-image'   ? { x: 17, y: 61 } :   // "Buat gambar" (3rd in dropdown)
    phase === 'click-image'       ? { x: 17, y: 61 } :
    phase === 'cursor-to-attach'  ? { x: 17, y: 46 } :   // "Tambah foto & file" (1st in dropdown)
    phase === 'click-attach'      ? { x: 17, y: 46 } :
    phase === 'file-picker-open'  ? { x: 50, y: 50 } :   // travel toward file picker
    phase === 'cursor-to-file'    ? { x: 38, y: 58 } :   // "sendal-lucu.jpg" thumb
    phase === 'click-file'        ? { x: 38, y: 58 } :
    phase === 'file-attached'     ? { x: 18, y: 80 } :   // back near attached chip
    phase === 'paste-prompt'      ? { x: 45, y: 92 } :
    phase === 'click-send'        ? { x: 94, y: 92 } :
                                    { x: 50, y: 50 };
  const clicking = ['click-plus', 'click-image', 'click-attach', 'click-file', 'click-send'].includes(phase);

  const dropdownOpen     = ['click-plus', 'cursor-to-image', 'click-image', 'cursor-to-attach', 'click-attach'].includes(phase);
  const filePickerOpen   = ['file-picker-open', 'cursor-to-file', 'click-file'].includes(phase);
  const fileAttached     = ['file-attached', 'paste-prompt', 'click-send', 'chatgpt-thinking', 'chatgpt-result'].includes(phase);
  const imageModeActive  = ['click-image', 'cursor-to-attach', 'click-attach', 'file-picker-open', 'cursor-to-file', 'click-file', 'file-attached', 'paste-prompt', 'click-send', 'chatgpt-thinking', 'chatgpt-result'].includes(phase);
  const promptInInput    = ['paste-prompt', 'click-send'].includes(phase);
  const messageSent      = ['chatgpt-thinking', 'chatgpt-result'].includes(phase);
  const showThinking     = phase === 'chatgpt-thinking';
  const showResult       = phase === 'chatgpt-result';

  return (
    <div className="absolute inset-0 bg-[#212121] flex flex-col">
      <BrowserChrome url="chatgpt.com" theme="chatgpt" />

      <div className="flex-1 flex flex-col relative min-h-0">
        {/* Chat messages area */}
        <div className="flex-1 px-4 py-3 overflow-hidden flex flex-col">
          {/* User message (after paste+send) */}
          {messageSent && (
            <div className="self-end max-w-[60%] tutorial-fade-in">
              {/* attached file thumb above bubble */}
              <div className="flex justify-end mb-1">
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#2f2f2f] border border-zinc-700">
                  <div className="w-5 h-5 rounded bg-amber-500/30 border border-amber-400/40 flex items-center justify-center">
                    <FileImage className="w-2.5 h-2.5 text-amber-300" />
                  </div>
                  <span className="text-[8px] text-zinc-300 mono">sendal-lucu.jpg</span>
                </div>
              </div>
              <div className="bg-[#2f2f2f] text-white text-[8px] mono px-3 py-2 rounded-2xl rounded-br-sm">
                <div className="opacity-90 leading-tight">
                  {'{ "task_type": "commercial_banner_generation",'}<br/>
                  {'  "model_parameters": { "aspect_ratio": "4:5"... }'}
                </div>
                <div className="text-blue-400 text-[8px] mt-1">▸ Show more</div>
              </div>
            </div>
          )}

          {/* Thinking */}
          {showThinking && (
            <div className="mt-3 flex items-center gap-2 text-zinc-300 text-[10px] tutorial-fade-in">
              <span className="font-semibold">Berpikir</span>
              <div className="flex gap-0.5">
                <span className="tutorial-dot w-1 h-1 rounded-full bg-zinc-400 inline-block" />
                <span className="tutorial-dot w-1 h-1 rounded-full bg-zinc-400 inline-block" />
                <span className="tutorial-dot w-1 h-1 rounded-full bg-zinc-400 inline-block" />
              </div>
              <span className="ml-2 text-zinc-500">Sedang membuat gambar...</span>
            </div>
          )}

          {/* Result image */}
          {showResult && (
            <div className="mt-2 self-start max-w-[55%] tutorial-result-reveal relative">
              <div className="text-zinc-400 text-[10px] mb-1">Gambar siap! ✨</div>
              <div className="relative rounded-xl overflow-hidden border border-zinc-700 bg-zinc-900 aspect-[4/5]">
                <img src={d.image} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 ring-1 ring-inset rounded-xl pointer-events-none" style={{ boxShadow: `inset 0 0 0 1px ${d.accent}` }} />
                {/* Sparkle burst */}
                <SparkleBurst accent={d.accent} />
              </div>
              {/* Success badge */}
              <div className="absolute -top-1 -right-1 tutorial-success-badge px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[8px] mono font-bold flex items-center gap-1 shadow-[0_0_14px_rgba(16,185,129,0.7)]">
                <Check className="w-2.5 h-2.5" strokeWidth={3} />
                SUKSES
              </div>
            </div>
          )}

          {/* Confetti overlay on success */}
          {showResult && <Confetti />}
        </div>

        {/* Bottom input */}
        <div className="px-4 pb-3 shrink-0">
          {/* Dropdown menu when + clicked */}
          {dropdownOpen && (
            <div className="absolute left-3 bottom-12 z-30 bg-[#2f2f2f] border border-zinc-700 rounded-xl shadow-2xl py-1 w-44 tutorial-fade-in">
              {[
                { icon: ImageIcon,       label: 'Tambah foto & file', highlight: phase === 'cursor-to-attach' || phase === 'click-attach' },
                { icon: FolderOpen,      label: 'File terkini',         arrow: true },
                { icon: Wand2,           label: 'Buat gambar',          highlight: phase === 'cursor-to-image' || phase === 'click-image', active: imageModeActive },
                { icon: Beaker,          label: 'Riset dalam' },
                { icon: Globe,           label: 'Pencarian web' },
                { icon: MoreHorizontal,  label: 'Lainnya',              arrow: true },
              ].map((item, i) => {
                const Icon = item.icon;
                return (
                  <div key={i} className={`flex items-center gap-2 px-3 py-1.5 text-[10px] cursor-pointer ${
                    item.highlight ? 'bg-zinc-700/80 ring-1 ring-zinc-500' : ''
                  } ${item.active ? 'text-blue-300' : 'text-zinc-200'}`}>
                    <Icon className={`w-3 h-3 ${item.active ? 'text-blue-300' : 'text-zinc-400'}`} />
                    <span className="flex-1">{item.label}</span>
                    {item.active && <Check className="w-2.5 h-2.5 text-blue-300" strokeWidth={3} />}
                    {item.arrow && !item.active && <ChevronRight className="w-2.5 h-2.5 text-zinc-500" />}
                  </div>
                );
              })}
            </div>
          )}

          {/* Attached file chip ABOVE input (visible after file selected) */}
          {fileAttached && !messageSent && (
            <div className="absolute left-4 right-4 bottom-12 z-20 tutorial-fade-in">
              <div className="inline-flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[#2f2f2f] border border-zinc-600 shadow-lg">
                <div className="w-6 h-6 rounded bg-gradient-to-br from-amber-400/40 to-amber-600/40 border border-amber-400/50 flex items-center justify-center">
                  <FileImage className="w-3 h-3 text-amber-200" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] text-zinc-200 mono font-semibold">sendal-lucu.jpg</span>
                  <span className="text-[7px] text-zinc-500 mono">240 KB · siap dikirim</span>
                </div>
                <Check className="w-3 h-3 text-emerald-400 ml-1" strokeWidth={3} />
              </div>
            </div>
          )}

          {/* Input bar */}
          <div className={`relative flex items-center gap-2 px-3 py-2 rounded-3xl bg-[#2f2f2f] border transition-all ${
            phase === 'click-send' ? 'border-accent' : 'border-zinc-700'
          }`}>
            {/* + button */}
            <button className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
              phase === 'cursor-to-plus' || phase === 'click-plus'
                ? 'bg-white text-black scale-110 shadow-[0_0_10px_rgba(255,255,255,0.4)]'
                : 'text-zinc-300'
            } ${phase === 'click-plus' ? 'scale-95' : ''}`}>
              <Plus className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
            {/* Gambar mode chip (after click "Buat gambar") */}
            {imageModeActive && !messageSent && (
              <div className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-500/15 border border-blue-400/40 text-blue-300 text-[8px] mono tutorial-fade-in">
                <Wand2 className="w-2.5 h-2.5" />
                Gambar
              </div>
            )}
            {/* Input text */}
            <div className="flex-1 text-[10px] mono text-zinc-300 truncate">
              {promptInInput ? (
                <span className="tutorial-fade-in">{'{ "task_type": "commercial_banner_generation", "branding_elements": { "brand_name": "'}<span className="text-white font-semibold">{d.brand}</span>{'" }... }'}</span>
              ) : (
                <span className="text-zinc-500">Tanyakan apa saja</span>
              )}
            </div>
            {/* Send / Mic */}
            <button className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
              phase === 'click-send' ? 'bg-accent text-white scale-95 shadow-[0_0_14px_rgba(var(--accent-rgb),0.7)]' :
              promptInInput        ? 'bg-white text-black scale-110' :
              'text-zinc-400'
            }`}>
              {promptInInput ? <Send className="w-3 h-3" strokeWidth={2.5} /> : <Mic className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* File Picker modal */}
        {filePickerOpen && <FilePicker phase={phase} />}

        {/* Captions */}
        {(phase === 'cursor-to-plus' || phase === 'click-plus') && (
          <Callout x={26} y={75} accent={d.accent}>
            <Plus className="w-3 h-3" />
            Klik tombol <b>+</b> di ChatGPT
          </Callout>
        )}
        {(phase === 'cursor-to-image' || phase === 'click-image') && (
          <Callout x={42} y={56} accent={d.accent}>
            <Wand2 className="w-3 h-3" />
            Pilih <b>Buat gambar</b> dulu — aktifkan mode generate
          </Callout>
        )}
        {(phase === 'cursor-to-attach' || phase === 'click-attach') && (
          <Callout x={42} y={40} accent={d.accent}>
            <ImageIcon className="w-3 h-3" />
            Lalu klik <b>Tambah foto & file</b>
          </Callout>
        )}
        {filePickerOpen && (
          <Callout x={70} y={28} accent={d.accent}>
            <FileImage className="w-3 h-3" />
            Pilih foto produkmu (<b>sendal-lucu.jpg</b>)
          </Callout>
        )}
        {phase === 'file-attached' && (
          <Callout x={48} y={62} accent="#10b981">
            <Check className="w-3 h-3" strokeWidth={3} />
            Foto produk berhasil diupload ✓
          </Callout>
        )}
        {(phase === 'paste-prompt') && (
          <Callout x={48} y={70} accent={d.accent}>
            <Copy className="w-3 h-3" />
            Paste prompt dari {CONFIG.brandName} di sini
          </Callout>
        )}
        {phase === 'click-send' && (
          <Callout x={70} y={70} accent={d.accent}>
            <Send className="w-3 h-3" />
            Tekan <b>Send</b> & tunggu hasilnya
          </Callout>
        )}
        {showResult && (
          <Callout x={62} y={26} accent="#10b981" big>
            <PartyPopper className="w-3.5 h-3.5" />
            Selesai! Visual siap kamu posting 🎉
          </Callout>
        )}

        {/* Cursor */}
        <Cursor x={cursor.x} y={cursor.y} clicking={clicking} accent={d.accent} />
      </div>
    </div>
  );
}

// ═══════════════════════ FILE PICKER MODAL ═══════════════════════
function FilePicker({ phase }) {
  const files = [
    { name: 'logo-brand.png',    size: '18 KB',  color: 'from-rose-500/30 to-rose-700/30' },
    { name: 'sendal-lucu.jpg',   size: '240 KB', color: 'from-amber-400/40 to-amber-600/40', selected: true },
    { name: 'moodboard.jpg',     size: '512 KB', color: 'from-sky-500/30 to-sky-700/30' },
    { name: 'referensi-ad.png',  size: '88 KB',  color: 'from-violet-500/30 to-violet-700/30' },
  ];
  const isHovered  = phase === 'cursor-to-file' || phase === 'click-file';
  const isClicking = phase === 'click-file';

  return (
    <div className="absolute inset-0 z-20 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 tutorial-fade-in">
      <div className="w-[78%] max-h-[78%] bg-[#1f1f1f] border border-zinc-700 rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Title bar */}
        <div className="px-3 py-2 border-b border-zinc-700 flex items-center gap-2 bg-[#161616]">
          <FolderOpen className="w-3 h-3 text-zinc-400" />
          <span className="text-[9px] mono text-zinc-300 flex-1 truncate">~/Pictures/Produk</span>
          <span className="text-[8px] mono text-zinc-500">JPG · PNG · WEBP</span>
        </div>
        {/* File grid */}
        <div className="grid grid-cols-4 gap-2 p-3 flex-1">
          {files.map((f, i) => {
            const active = f.selected && isHovered;
            return (
              <div
                key={i}
                className={`relative rounded-lg border p-1.5 flex flex-col gap-1 transition-all ${
                  active
                    ? 'border-amber-400 bg-amber-500/10 ring-2 ring-amber-400/60 shadow-[0_0_18px_rgba(251,191,36,0.5)] scale-105'
                    : 'border-zinc-700 bg-zinc-900/50'
                } ${isClicking && f.selected ? 'scale-95' : ''}`}
              >
                <div className={`aspect-square rounded bg-gradient-to-br ${f.color} flex items-center justify-center`}>
                  <FileImage className="w-4 h-4 text-white/70" />
                </div>
                <div className="text-[7px] mono text-zinc-300 truncate">{f.name}</div>
                <div className="text-[6px] mono text-zinc-500">{f.size}</div>
                {active && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-400 flex items-center justify-center shadow-[0_0_8px_rgba(251,191,36,0.8)]">
                    <Check className="w-2 h-2 text-zinc-900" strokeWidth={3} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {/* Footer */}
        <div className="px-3 py-1.5 border-t border-zinc-700 flex items-center justify-end gap-1.5 bg-[#161616]">
          <button className="px-2 py-0.5 rounded text-[8px] mono text-zinc-400 border border-zinc-700">Cancel</button>
          <button className={`px-2 py-0.5 rounded text-[8px] mono font-bold ${
            isHovered ? 'bg-amber-400 text-zinc-900' : 'bg-zinc-700 text-zinc-300'
          }`}>Open</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════ CONFETTI & SPARKLES ═══════════════════════
function Confetti() {
  const pieces = Array.from({ length: 18 }, (_, i) => i);
  const colors = ['#f59e0b', '#ec4899', '#10b981', '#3b82f6', '#ef4444', '#a855f7'];
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-30">
      {pieces.map((i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 0.4;
        const duration = 1.2 + Math.random() * 0.8;
        const color = colors[i % colors.length];
        const size = 4 + Math.random() * 4;
        return (
          <span
            key={i}
            className="tutorial-confetti absolute top-0 block"
            style={{
              left: `${left}%`,
              width: `${size}px`,
              height: `${size * 1.4}px`,
              background: color,
              animationDelay: `${delay}s`,
              animationDuration: `${duration}s`,
              transform: `rotate(${Math.random() * 360}deg)`,
            }}
          />
        );
      })}
    </div>
  );
}

function SparkleBurst({ accent }) {
  const sparkles = Array.from({ length: 8 }, (_, i) => i);
  return (
    <div className="absolute inset-0 pointer-events-none">
      {sparkles.map((i) => {
        const angle = (i / sparkles.length) * 360;
        const delay = i * 0.05;
        return (
          <span
            key={i}
            className="tutorial-sparkle absolute top-1/2 left-1/2"
            style={{
              '--angle': `${angle}deg`,
              animationDelay: `${delay}s`,
              color: accent,
            }}
          >
            <Sparkles className="w-3 h-3" />
          </span>
        );
      })}
    </div>
  );
}

// ═══════════════════════ CALLOUT (explanation tooltip) ═══════════════════════
function Callout({ x, y, accent, children, big }) {
  return (
    <div
      key={`${x}-${y}-${children?.toString?.()}`}
      className="absolute z-40 pointer-events-none tutorial-callout-pop"
      style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}
    >
      <div
        className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 ${big ? 'text-[11px]' : 'text-[9px]'} font-semibold whitespace-nowrap`}
        style={{
          background: 'rgba(15, 15, 18, 0.92)',
          backdropFilter: 'blur(6px)',
          color: '#fff',
          border: `1px solid ${accent}`,
          boxShadow: `0 0 16px ${accent}66, 0 4px 12px rgba(0,0,0,0.4)`,
        }}
      >
        {children}
      </div>
      {/* tail */}
      <div
        className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-2 h-2 rotate-45"
        style={{ background: 'rgba(15, 15, 18, 0.92)', borderRight: `1px solid ${accent}`, borderBottom: `1px solid ${accent}` }}
      />
    </div>
  );
}

// ═══════════════════════ SHARED ELEMENTS ═══════════════════════
function BrowserChrome({ url, live, theme }) {
  const isChat = theme === 'chatgpt';
  return (
    <div className={`flex items-center gap-2 px-2 py-1.5 shrink-0 border-b ${
      isChat ? 'bg-[#171717] border-zinc-800' : 'bg-[#1a0d0e] border-border'
    }`}>
      <div className="flex gap-1">
        <span className="w-2 h-2 rounded-full bg-red-500" />
        <span className="w-2 h-2 rounded-full bg-yellow-500" />
        <span className="w-2 h-2 rounded-full bg-green-500" />
      </div>
      <div className={`flex-1 mx-2 px-2 py-0.5 rounded text-[9px] mono text-center truncate ${
        isChat ? 'bg-zinc-800 text-zinc-300 border border-zinc-700' : 'bg-bg-deep text-text-mut border border-border'
      }`}>
        🔒 {url}
      </div>
      {live && <span className="text-[8px] mono text-accent uppercase tracking-widest">● LIVE</span>}
    </div>
  );
}

function MiniRow({ label, value, dropdown }) {
  return (
    <div>
      <div className="text-[7px] mono uppercase tracking-widest text-text-dim mb-0.5">{label}</div>
      <div className="flex items-center gap-1 px-1.5 py-1 rounded bg-bg-deep border border-border text-[9px]">
        <span className="flex-1 truncate text-text">{value}</span>
        {dropdown && <ChevronDown className="w-2.5 h-2.5 text-text-dim" />}
      </div>
    </div>
  );
}

function Cursor({ x, y, clicking, accent }) {
  return (
    <div
      className="absolute z-40 pointer-events-none"
      style={{
        left: `${x}%`,
        top:  `${y}%`,
        transform: 'translate(-3px, -3px)',
        transition: 'left 0.6s cubic-bezier(0.4, 0, 0.2, 1), top 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <MousePointer2 className="w-4 h-4 text-white drop-shadow-[0_2px_3px_rgba(0,0,0,0.7)]" strokeWidth={2.2} fill="white" />
      {clicking && (
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full cursor-click-pulse"
          style={{ background: `radial-gradient(circle, ${accent || '#ef4444'} 0%, transparent 70%)` }}
        />
      )}
    </div>
  );
}
