import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, MousePointer2, Sparkles, Copy, Plus, Image as ImageIcon, Send, Check, Globe } from 'lucide-react';

/**
 * Tutorial BERGERAK untuk mode Feed Grid 3x3.
 * 1) Auto Feeds: Generate → Copy
 * 2) chatgpt.com BIASA: Buat gambar → + Tambah foto → paste prompt → Kirim → jadi grid 3x3
 * 3) Buka link Auto Feeds AI → upload grid → Kirim
 * 4) Ketik "GENERATE FEEDS 1" → lanjut sampai 9
 * Kursor diarahkan ke posisi TOMBOL ASLI (diukur via ref) supaya selalu pas.
 */

const GPT_LINK = 'https://chatgpt.com/';

const STEPS = [
  { n: 1, t: 'Generate & Copy di Auto Feeds' },
  { n: 2, t: 'chatgpt.com: Buat gambar · +foto · paste · Kirim → 9 feed' },
  { n: 3, t: 'Buka Auto Feeds AI · upload grid · Kirim' },
  { n: 4, t: 'Ketik GENERATE FEEDS 1 → lanjut sampai 9' },
];

const PHASES = [
  { name: 'studio-idle',  at: 0,     step: 1 },
  { name: 'to-gen',       at: 1100,  step: 1 },
  { name: 'click-gen',    at: 2500,  step: 1 },
  { name: 'to-copy',      at: 3900,  step: 1 },
  { name: 'click-copy',   at: 5200,  step: 1 },
  { name: 'switch1',      at: 6500,  step: 2 },
  { name: 'cg-idle',      at: 8000,  step: 2 },
  { name: 'to-buat',      at: 9000,  step: 2 },
  { name: 'click-buat',   at: 10300, step: 2 },
  { name: 'to-plus',      at: 11500, step: 2 },
  { name: 'click-plus',   at: 12700, step: 2 },
  { name: 'click-attach', at: 14000, step: 2 },
  { name: 'photo1',       at: 15100, step: 2 },
  { name: 'paste1',       at: 16400, step: 2 },
  { name: 'to-sendb',     at: 18200, step: 2 },
  { name: 'click-sendb',  at: 19500, step: 2 },
  { name: 'grid-load',    at: 20400, step: 2 },
  { name: 'grid-done',    at: 22000, step: 2 },
  { name: 'switch2',      at: 23700, step: 3 },
  { name: 'gpt-idle',     at: 25600, step: 3 },
  { name: 'to-up2',       at: 26700, step: 3 },
  { name: 'click-up2',    at: 27900, step: 3 },
  { name: 'grid-att',     at: 29100, step: 3 },
  { name: 'to-sendc',     at: 30300, step: 3 },
  { name: 'click-sendc',  at: 31500, step: 3 },
  { name: 'concept',      at: 32800, step: 4 },
  { name: 'type-gen1',    at: 34000, step: 4 },
  { name: 'click-f1',     at: 35300, step: 4 },
  { name: 'feed1-load',   at: 36100, step: 4 },
  { name: 'feed1-done',   at: 37300, step: 4 },
  { name: 'type-gen2',    at: 38600, step: 4 },
  { name: 'click-f2',     at: 39900, step: 4 },
  { name: 'feed2-load',   at: 40700, step: 4 },
  { name: 'feed2-done',   at: 41900, step: 4 },
  { name: 'type-gen3',    at: 43200, step: 4 },
  { name: 'click-f3',     at: 44500, step: 4 },
  { name: 'feed3-load',   at: 45300, step: 4 },
  { name: 'feed3-done',   at: 46500, step: 4 },
  { name: 'all-done',     at: 48200, step: 4 },
];
const CYCLE = 51000;

// phase → data-tut target tombol yang dituju kursor
const TARGET = {
  'to-gen': 'gen', 'click-gen': 'gen',
  'to-copy': 'copy', 'click-copy': 'copy',
  'to-buat': 'buat', 'click-buat': 'buat',
  'to-plus': 'plusB', 'click-plus': 'plusB',
  'click-attach': 'attach',
  'paste1': 'inputB',
  'to-sendb': 'sendB', 'click-sendb': 'sendB',
  'to-up2': 'plusG', 'click-up2': 'plusG',
  'to-sendc': 'sendG', 'click-sendc': 'sendG',
  'type-gen1': 'inputG', 'click-f1': 'sendG',
  'type-gen2': 'inputG', 'click-f2': 'sendG',
  'type-gen3': 'inputG', 'click-f3': 'sendG',
};

export default function GridFeedTutorial({ open, onClose }) {
  const [phase, setPhase] = useState('studio-idle');
  const [tick, setTick] = useState(0);
  const [cursor, setCursor] = useState({ x: 50, y: 45 });
  const stageRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    setPhase('studio-idle');
    const timers = PHASES.map((p) => setTimeout(() => setPhase(p.name), p.at));
    const loop = setTimeout(() => setTick((t) => t + 1), CYCLE);
    return () => { timers.forEach(clearTimeout); clearTimeout(loop); };
  }, [open, tick]);

  // Ukur posisi tombol target → set kursor tepat di tengahnya.
  useEffect(() => {
    if (!open) return;
    const t = TARGET[phase];
    if (!t) return; // idle/loading: kursor tetap di posisi terakhir
    const raf = requestAnimationFrame(() => {
      const stage = stageRef.current;
      if (!stage) return;
      const el = stage.querySelector(`[data-tut="${t}"]`);
      if (!el) return;
      const sr = stage.getBoundingClientRect(), er = el.getBoundingClientRect();
      setCursor({
        x: ((er.left + er.width / 2 - sr.left) / sr.width) * 100,
        y: ((er.top + er.height / 2 - sr.top) / sr.height) * 100,
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [phase, open]);

  if (!open) return null;

  const i = PHASES.findIndex((p) => p.name === phase);
  const step = PHASES[i]?.step || 1;
  const progress = Math.min(100, ((i + 1) / PHASES.length) * 100);
  const studio = i <= 4;
  const sw1 = phase === 'switch1';
  const sw2 = phase === 'switch2';
  const chatgpt = !studio && !sw1 && !sw2 && step === 2;
  const clicking = phase.startsWith('click-');

  return createPortal(
    <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-md flex items-center justify-center px-3 sm:px-6 py-6 animate-fade-in" onClick={onClose}>
      <div className="surface w-full max-w-2xl rounded-2xl shadow-panel overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-3.5 border-b border-border bg-bg-elev/40 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-bold"><Sparkles className="w-4 h-4 text-accent" /> Tutorial: 9 Feed Konsisten</div>
          <button onClick={onClose} className="w-7 h-7 rounded-md hover:bg-bg-elev flex items-center justify-center text-text-mut"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-4 py-2.5 border-b border-border flex items-center gap-2 bg-black/30">
          <div className="flex items-center gap-1.5 shrink-0">
            {STEPS.map((s) => (
              <span key={s.n} className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold transition ${
                step === s.n ? 'bg-accent text-white shadow-[0_0_10px_rgba(var(--accent-rgb),0.6)]' :
                step > s.n ? 'bg-accent/40 text-white' : 'bg-bg-deep border border-border text-text-dim'}`}>{s.n}</span>
            ))}
          </div>
          <div className="flex-1 text-[10px] mono uppercase tracking-widest text-text-mut truncate">STEP {step} · {STEPS[step - 1].t}</div>
        </div>

        <div ref={stageRef} className="relative w-full bg-bg-deep" style={{ aspectRatio: '16 / 9' }}>
          <div className="absolute inset-0">
            {studio ? <Studio phase={phase} /> : sw1 ? <Switch label="Buka chatgpt.com…" /> : chatgpt ? <ChatGPT phase={phase} /> : sw2 ? <Switch label="Buka link Auto Feeds AI…" link={GPT_LINK} /> : <AutoFeedsAI phase={phase} />}
          </div>
          {/* Kursor tunggal — diposisikan dari hasil pengukuran tombol */}
          <div className="absolute z-50 transition-all duration-1000 ease-out pointer-events-none" style={{ left: cursor.x + '%', top: cursor.y + '%' }}>
            <MousePointer2 className="w-5 h-5 text-white drop-shadow-[0_2px_3px_rgba(0,0,0,0.85)]" fill="white" strokeWidth={1.5} />
            {clicking && <span className="absolute -top-1.5 -left-1.5 w-8 h-8 rounded-full border-2 border-accent animate-ping" />}
          </div>
          <div className="absolute bottom-0 inset-x-0 h-1 bg-bg-deep"><div className="h-full bg-accent transition-all duration-300" style={{ width: progress + '%' }} /></div>
        </div>
        <div className="px-5 py-3 text-[11px] text-text-mut bg-bg-elev/40 border-t border-border text-center">Animasi otomatis berulang. <b className="text-text">Esc</b> / klik luar untuk tutup.</div>
      </div>
    </div>,
    document.body
  );
}

function Switch({ label, link }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-bg-deep px-5">
      <div className="w-10 h-10 rounded-full border-2 border-accent border-t-transparent animate-spin" />
      <div className="text-[11px] text-text-mut">{label}</div>
      {link && (
        <div className="text-center max-w-[94%]">
          <div className="text-[9px] mono uppercase tracking-widest text-text-dim mb-1">Buka link ini di browser:</div>
          <div className="inline-flex items-center gap-1.5 bg-bg-elev border border-accent/50 rounded-lg px-3 py-1.5 text-[10px] text-accent break-all font-medium">
            <Globe className="w-3.5 h-3.5 shrink-0" /> {link}
          </div>
        </div>
      )}
    </div>
  );
}
function MiniGrid({ className = '' }) {
  return <div className={`grid grid-cols-3 gap-px bg-border ${className}`}>{Array.from({ length: 9 }).map((_, k) => <div key={k} className="bg-gradient-to-br from-accent/30 to-bg-deep" style={{ aspectRatio: '4/5' }} />)}</div>;
}

/* STEP 1 — Auto Feeds studio */
function Studio({ phase }) {
  const show = ['click-gen', 'to-copy', 'click-copy'].includes(phase);
  const copied = phase === 'click-copy';
  return (
    <div className="absolute inset-0 p-3 flex flex-col gap-2 text-[10px]">
      <div className="text-[9px] mono uppercase tracking-widest text-accent">Auto Feeds · 9 Feed Konsisten</div>
      <div className="flex-1 rounded-md border border-border bg-bg-panel p-2 overflow-hidden">
        <div className="text-text-dim text-[9px] mb-1">Output Prompt</div>
        <div className="rounded bg-black/40 border border-border h-full p-2 font-mono text-[8px] leading-relaxed text-text-mut overflow-hidden">
          {show ? <span>Buat campaign Instagram 9 feed…<br />FEED 1 — HERO …<br />FEED 2 — LIFESTYLE …<br />— 9 feed konsisten —</span> : <span className="text-text-dim">— prompt muncul setelah Generate —</span>}
        </div>
      </div>
      <div className="flex items-center justify-end gap-2">
        <Btn tut="gen" label="Generate" icon={Sparkles} active={phase === 'click-gen'} primary />
        <Btn tut="copy" label="Copy" icon={copied ? Check : Copy} active={copied} />
      </div>
      {copied && <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg bg-accent text-white text-[10px] font-bold shadow-lg">✓ Prompt disalin!</div>}
    </div>
  );
}

/* STEP 2 — chatgpt.com biasa → bikin grid */
function ChatGPT({ phase }) {
  const buatOn = ['click-buat', 'to-plus', 'click-plus', 'click-attach', 'photo1', 'paste1', 'to-sendb', 'click-sendb', 'grid-load', 'grid-done'].includes(phase);
  const photo = ['photo1', 'paste1', 'to-sendb', 'click-sendb', 'grid-load', 'grid-done'].includes(phase);
  const pasted = ['paste1', 'to-sendb', 'click-sendb'].includes(phase);
  const load = phase === 'grid-load';
  const done = phase === 'grid-done';
  return (
    <div className="absolute inset-0 p-3 flex flex-col text-[10px]">
      <div className="flex items-center gap-1.5 text-[10px] font-bold pb-1.5 border-b border-border"><Globe className="w-3.5 h-3.5 text-text-mut" /> ChatGPT <span className="text-text-dim font-normal">· chatgpt.com</span></div>
      <div className="flex-1 overflow-hidden py-2 flex flex-col items-center justify-center gap-1.5">
        {load && <div className="flex items-center gap-1.5 text-[9px] text-text-mut"><span className="w-3 h-3 rounded-full border-2 border-accent border-t-transparent animate-spin" /> Membuat 9 feed…</div>}
        {done && <div className="flex flex-col items-center gap-1"><MiniGrid className="w-28 rounded overflow-hidden border border-border" /><div className="text-[8px] text-emerald-400">✓ Gambar 9 feed jadi</div></div>}
      </div>
      <div className="rounded-xl border border-border bg-bg-elev p-1.5">
        {photo && <div className="mb-1.5 inline-flex items-center gap-1 bg-bg-deep border border-border rounded px-1 py-0.5"><ImageIcon className="w-3 h-3 text-accent" /><span className="text-[8px] text-text-mut">foto-produk.jpg</span></div>}
        <div className="flex items-center gap-1.5">
          <span data-tut="plusB" className="shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-bg-deep"><Plus className="w-4 h-4 text-text-mut" /></span>
          <div data-tut="inputB" className="flex-1 text-[9px] text-text-dim truncate">{pasted ? <span className="text-text">Buat campaign Instagram 9 feed…</span> : 'Tanyakan apa saja'}</div>
          <span data-tut="sendB" className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${phase === 'click-sendb' ? 'bg-accent scale-95' : 'bg-white'} transition`}><Send className="w-3 h-3 text-black" /></span>
        </div>
      </div>
      <div className="flex items-center justify-center gap-1.5 mt-1.5">
        <Pill tut="buat" label="Buat gambar" icon={ImageIcon} on={buatOn} />
        <Pill label="Tulis atau edit" />
        <Pill label="Cari sesuatu" />
      </div>
      {/* Label PASTE saat paste prompt */}
      {phase === 'paste1' && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-[4.2rem] px-3 py-1.5 rounded-lg bg-accent text-white text-[10px] font-bold shadow-lg flex items-center gap-1.5 animate-slide-up">
          📋 Paste prompt (Ctrl + V)
        </div>
      )}
      {(phase === 'click-plus' || phase === 'click-attach') && (
        <div className="absolute left-3 bottom-16 bg-bg-panel border border-border rounded-lg shadow-panel p-1 text-[9px] space-y-0.5">
          <div data-tut="attach" className={`flex items-center gap-1.5 px-2 py-1 rounded ${phase === 'click-attach' ? 'bg-accent-sm/50 text-text' : 'text-text-mut'}`}><ImageIcon className="w-3 h-3 text-accent" /> Tambah foto & file</div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded text-text-dim"><ImageIcon className="w-3 h-3" /> Buat gambar</div>
        </div>
      )}
    </div>
  );
}

/* STEP 3+4 — Auto Feeds AI (custom GPT) */
function FeedChip({ n }) {
  return (
    <span className="inline-flex flex-col items-center">
      <span className="w-7 h-9 rounded bg-gradient-to-br from-accent/30 to-bg-deep border border-border" />
      <span className="text-[7px] text-emerald-400 mt-0.5">✓ {n}</span>
    </span>
  );
}

function AutoFeedsAI({ phase }) {
  const gridAtt = ['grid-att', 'to-sendc', 'click-sendc'].includes(phase);
  const showConcept = phase === 'concept';
  const typingN = ['type-gen1', 'click-f1'].includes(phase) ? 1 : ['type-gen2', 'click-f2'].includes(phase) ? 2 : ['type-gen3', 'click-f3'].includes(phase) ? 3 : 0;
  const loadN = phase === 'feed1-load' ? 1 : phase === 'feed2-load' ? 2 : phase === 'feed3-load' ? 3 : 0;
  const f1done = ['feed1-done', 'type-gen2', 'click-f2', 'feed2-load', 'feed2-done', 'type-gen3', 'click-f3', 'feed3-load', 'feed3-done', 'all-done'].includes(phase);
  const f2done = ['feed2-done', 'type-gen3', 'click-f3', 'feed3-load', 'feed3-done', 'all-done'].includes(phase);
  const f3done = ['feed3-done', 'all-done'].includes(phase);
  const allDone = phase === 'all-done';
  const sendScale = ['click-sendc', 'click-f1', 'click-f2', 'click-f3'].includes(phase);
  const inputText = typingN ? `GENERATE FEEDS ${typingN}` : null;
  return (
    <div className="absolute inset-0 p-3 flex flex-col text-[10px]">
      <div className="flex items-center gap-1.5 rounded-md bg-bg-elev border border-accent/40 px-2 py-1 text-[8px] text-accent min-w-0"><Globe className="w-3 h-3 shrink-0" /> <span className="truncate">{GPT_LINK}</span></div>
      <div className="flex items-center gap-1.5 text-[10px] font-bold py-1.5"><span className="w-4 h-4 rounded bg-accent flex items-center justify-center text-white text-[8px] font-black">F</span> Auto Feeds AI</div>
      <div className="flex-1 overflow-hidden space-y-1.5 py-1">
        {showConcept && <div className="w-fit max-w-[85%] bg-bg-panel border border-border rounded-lg px-2 py-1.5 text-[9px] text-text-mut">Konsep feed 1–9 siap, style konsisten. <b className="text-text">Generate gambar FEED 1?</b> 🙂</div>}
        {(f1done || f2done || f3done) && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {f1done && <FeedChip n={1} />}
            {f2done && <FeedChip n={2} />}
            {f3done && <FeedChip n={3} />}
          </div>
        )}
        {typingN > 0 && <div className="ml-auto w-fit bg-bg-elev border border-border rounded-lg px-2 py-1 text-[9px] text-text">GENERATE FEEDS {typingN}</div>}
        {loadN > 0 && <div className="w-fit bg-bg-panel border border-border rounded-lg px-2 py-1.5 text-[9px] text-text-mut flex items-center gap-1.5"><span className="w-3 h-3 rounded-full border-2 border-accent border-t-transparent animate-spin" /> Membuat gambar FEED {loadN}…</div>}
        {allDone && <div className="w-fit max-w-[90%] bg-bg-panel border border-accent/40 rounded-lg px-2 py-1.5 text-[9px] text-text">✅ FEED 1–3 selesai! Lanjutkan FEED 4–9 dengan cara sama (ketik GENERATE FEEDS 4, dst).</div>}
      </div>
      <div className="rounded-xl border border-border bg-bg-elev p-1.5">
        {gridAtt && <div className="mb-1.5 inline-flex items-center gap-1 bg-bg-deep border border-border rounded px-1 py-0.5"><MiniGrid className="w-5 rounded overflow-hidden" /><span className="text-[8px] text-text-mut">9feed.png</span></div>}
        <div className="flex items-center gap-1.5">
          <span data-tut="plusG" className="shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-bg-deep"><Plus className="w-4 h-4 text-text-mut" /></span>
          <div data-tut="inputG" className="flex-1 text-[9px] text-text-dim truncate">{inputText ? <span className="text-text">{inputText}<span className="animate-pulse">|</span></span> : 'Tanyakan apa saja'}</div>
          <span data-tut="sendG" className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${sendScale ? 'bg-accent scale-95' : 'bg-white'} transition`}><Send className="w-3 h-3 text-black" /></span>
        </div>
      </div>
      {phase === 'click-up2' && (
        <div className="absolute left-3 bottom-12 bg-bg-panel border border-border rounded-lg shadow-panel p-1 text-[9px]">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-accent-sm/50 text-text"><ImageIcon className="w-3 h-3 text-accent" /> Upload gambar grid</div>
        </div>
      )}
    </div>
  );
}

function Btn({ tut, label, icon: Icon, active, primary }) {
  return <span data-tut={tut} className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[9px] font-semibold border transition ${primary ? 'bg-accent text-white border-accent' : 'bg-bg-elev text-text border-border'} ${active ? 'scale-95 brightness-110' : ''}`}><Icon className="w-3 h-3" /> {label}</span>;
}
function Pill({ tut, label, icon: Icon, on }) {
  return <span data-tut={tut} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[8px] border transition ${on ? 'bg-accent-sm/50 border-accent text-accent font-semibold' : 'bg-bg-elev border-border text-text-dim'}`}>{Icon && <Icon className="w-2.5 h-2.5" />} {label}</span>;
}
