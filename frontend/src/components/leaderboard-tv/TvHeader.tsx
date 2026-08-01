'use client';
import { useEffect, useState } from 'react';
import { Maximize2, Moon, Sun, RefreshCw } from 'lucide-react';
import { useDarkMode } from '@/hooks/useDarkMode';
import type { TvPeriod } from '@/lib/api/leaderboard-tv';

const PERIODS: { key: TvPeriod; label: string }[] = [
  { key: 'today', label: 'Hari Ini' },
  { key: 'week', label: '7 Hari' },
  { key: 'month', label: 'Bulan Ini' },
];

export default function TvHeader(props: {
  period: TvPeriod;
  onPeriod: (p: TvPeriod) => void;
  branches: { id: number; name: string }[];
  branchId: number | null;
  onBranch: (id: number | null) => void;
  lastUpdated: Date | null;
}) {
  const { isDark, toggle } = useDarkMode();
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const goFullscreen = () => {
    const el = document.documentElement;
    if (!document.fullscreenElement) el.requestFullscreen?.();
    else document.exitFullscreen?.();
  };

  return (
    <header className="flex items-center justify-between gap-4 px-6 py-3 border-b border-border bg-card/60 backdrop-blur">
      <div className="flex items-center gap-3">
        <span className="text-2xl font-black tracking-tight text-primary">🏆 Papan Juara</span>
        <span className="text-sm text-muted-foreground hidden xl:inline">
          {props.branchId == null ? 'Semua Cabang' : props.branches.find(b => b.id === props.branchId)?.name}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {/* Periode */}
        <div className="flex rounded-lg overflow-hidden border border-border">
          {PERIODS.map(p => (
            <button key={p.key} onClick={() => props.onPeriod(p.key)}
              className={`px-3 py-1.5 text-sm font-semibold ${props.period === p.key ? 'bg-primary text-primary-foreground' : 'bg-transparent text-muted-foreground'}`}>
              {p.label}
            </button>
          ))}
        </div>
        {/* Cabang */}
        {props.branches.length > 1 && (
          <select value={props.branchId ?? ''} onChange={e => props.onBranch(e.target.value === '' ? null : Number(e.target.value))}
            className="px-2 py-1.5 text-sm rounded-lg border border-border bg-background">
            <option value="">Semua Cabang</option>
            {props.branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
        <button onClick={toggle} className="p-2 rounded-lg border border-border" title="Mode gelap/terang">
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
        <button onClick={goFullscreen} className="p-2 rounded-lg border border-border" title="Layar penuh">
          <Maximize2 className="w-4 h-4" />
        </button>
        <div className="text-right tabular-nums ml-2 min-w-[92px]">
          <div className="text-lg font-bold leading-none">{now ? now.toLocaleTimeString('id-ID') : '--:--:--'}</div>
          <div className="text-[11px] text-muted-foreground flex items-center gap-1 justify-end">
            <RefreshCw className="w-3 h-3" />
            {props.lastUpdated ? props.lastUpdated.toLocaleTimeString('id-ID') : '—'}
          </div>
        </div>
      </div>
    </header>
  );
}
