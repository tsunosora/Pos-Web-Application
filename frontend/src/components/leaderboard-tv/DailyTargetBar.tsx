'use client';
import { Target } from 'lucide-react';
import type { TvLeaderboard } from '@/lib/api/leaderboard-tv';

const fmtRp = (n: number) => `Rp ${Math.round(Number(n) || 0).toLocaleString('id-ID')}`;

type DT = NonNullable<TvLeaderboard['dailyTarget']>;

export default function DailyTargetBar({ data, branchId }: { data: DT | null; branchId: number | null }) {
  if (!data || !data.branches.length) return null;

  // Cabang tertentu → satu cabang; semua → agregat total.
  const scoped = branchId != null ? data.branches.filter(b => b.branchId === branchId) : data.branches;
  const withTarget = scoped.filter(b => b.dailyTarget > 0);
  if (!withTarget.length) return null;

  const totalTarget = withTarget.reduce((s, b) => s + b.dailyTarget, 0);
  const totalOmzet = withTarget.reduce((s, b) => s + b.todayOmzet, 0);
  const pct = totalTarget > 0 ? Math.round((totalOmzet / totalTarget) * 100) : 0;
  const met = totalOmzet >= totalTarget;
  const clamped = Math.min(100, Math.max(0, pct));

  const barColor = met
    ? 'from-emerald-500 to-green-400'
    : pct >= 60 ? 'from-amber-500 to-yellow-400' : 'from-rose-500 to-red-400';

  return (
    <div className="flex items-center gap-3 px-5 py-1.5 border-b border-border bg-card/50 backdrop-blur">
      <div className="flex items-center gap-1.5 shrink-0">
        <Target className={`w-5 h-5 ${met ? 'text-emerald-500' : 'text-amber-500'} ${met ? '' : 'tv-float'}`} />
        <span className="text-sm font-black uppercase tracking-wide">Target Harian</span>
      </div>

      {/* Bar progres beranimasi */}
      <div className="relative flex-1 h-6 rounded-full bg-muted overflow-hidden border border-border">
        <div
          className={`tv-shine relative h-full rounded-full bg-gradient-to-r ${barColor} transition-[width] duration-1000 ease-out overflow-hidden ${met ? 'tv-glow' : ''}`}
          style={{ width: `${clamped}%` }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-black text-foreground drop-shadow tabular-nums">
            {fmtRp(totalOmzet)} / {fmtRp(totalTarget)} · {pct}%
          </span>
        </div>
      </div>

      {/* Chip per-cabang (inline) saat mode semua cabang */}
      {branchId == null && withTarget.length > 1 && (
        <div className="hidden xl:flex items-center gap-1.5 shrink-0 max-w-[38%] overflow-hidden">
          {withTarget.slice(0, 4).map(b => (
            <span key={b.branchId}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${b.met ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'border-border bg-background text-muted-foreground'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${b.met ? 'bg-emerald-500' : b.pct >= 60 ? 'bg-amber-500' : 'bg-rose-500'} ${b.met ? '' : 'animate-pulse'}`} />
              {b.branchName}<span className="tabular-nums">{b.pct}%</span>
            </span>
          ))}
        </div>
      )}

      <div className="shrink-0 text-right min-w-[110px]">
        {met ? (
          <span className="text-sm font-black text-emerald-500 tv-float inline-block">🎉 TERCAPAI</span>
        ) : (
          <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
            Kurang {fmtRp(totalTarget - totalOmzet)}
          </span>
        )}
      </div>
    </div>
  );
}
