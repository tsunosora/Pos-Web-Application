import { useEffect, useState } from 'react';

const DAY_MS = 86_400_000;

function getTimeUntil(targetMs) {
  const now = Date.now();
  let diff = Math.max(0, targetMs - now);
  const days  = Math.floor(diff / DAY_MS);     diff -= days * DAY_MS;
  const hours = Math.floor(diff / 3_600_000);  diff -= hours * 3_600_000;
  const mins  = Math.floor(diff / 60_000);     diff -= mins * 60_000;
  const secs  = Math.floor(diff / 1000);
  return { days, hours, mins, secs };
}

function readOrCreateTarget(key, durationMs) {
  try {
    const stored = window.sessionStorage?.getItem(key);
    if (stored) {
      const ms = Number(stored);
      if (ms > Date.now()) return ms;
    }
  } catch {}
  const t = Date.now() + durationMs;
  try { window.sessionStorage?.setItem(key, String(t)); } catch {}
  return t;
}

export default function Counter({ durationDays = 7, storageKey = 'af_deadline' }) {
  const durationMs = durationDays * DAY_MS;
  const [target, setTarget] = useState(() => readOrCreateTarget(storageKey, durationMs));
  const [t, setT] = useState(() => getTimeUntil(target));

  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      if (now >= target) {
        // Loop: reset countdown ke periode baru
        const next = now + durationMs;
        try { window.sessionStorage?.setItem(storageKey, String(next)); } catch {}
        setTarget(next);
        setT(getTimeUntil(next));
      } else {
        setT(getTimeUntil(target));
      }
    }, 1000);
    return () => clearInterval(id);
  }, [target, durationMs, storageKey]);

  const cells = [
    { v: t.days,  l: 'HARI' },
    { v: t.hours, l: 'JAM'  },
    { v: t.mins,  l: 'MIN'  },
    { v: t.secs,  l: 'DET'  },
  ];

  return (
    <div className="inline-flex items-center gap-2">
      {cells.map((c, i) => (
        <div key={c.l} className="flex items-center gap-2">
          <div className="relative w-16 h-16 rounded-lg bg-bg-deep border border-border flex flex-col items-center justify-center overflow-hidden">
            <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
            <div className="stat-num text-2xl text-accent leading-none">{String(c.v).padStart(2, '0')}</div>
            <div className="text-[8px] mono uppercase tracking-widest text-text-dim mt-1">{c.l}</div>
          </div>
          {i < cells.length - 1 && <span className="text-accent text-xl font-bold opacity-50">:</span>}
        </div>
      ))}
    </div>
  );
}
