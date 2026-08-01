'use client';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, Palette, Printer, Building2 } from 'lucide-react';
import { getTvLeaderboard, type TvPeriod } from '@/lib/api/leaderboard-tv';
import { getPublicBranches } from '@/lib/api/production';
import TvHeader from './TvHeader';
import DivisionPanel, { type TvColumn } from './DivisionPanel';
import DailyTargetBar from './DailyTargetBar';

const fmtRp = (n: number) => `Rp ${Math.round(Number(n) || 0).toLocaleString('id-ID')}`;
const REFRESH_MS = 30_000;

export default function TvLeaderboardView({ pin, onLogout }: { pin: string; onLogout: () => void }) {
  const [period, setPeriod] = useState<TvPeriod>('today');
  const [branchId, setBranchId] = useState<number | null>(null);
  const [branches, setBranches] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    getPublicBranches().then(bs => setBranches(bs.map(b => ({ id: b.id, name: b.name })))).catch(() => {});
  }, []);

  const { data, dataUpdatedAt, error } = useQuery({
    queryKey: ['tv-leaderboard', pin, period, branchId],
    queryFn: () => getTvLeaderboard(pin, { period, branchId }),
    refetchInterval: REFRESH_MS,
    refetchOnWindowFocus: false,
  });

  // PIN dicabut owner → paksa logout
  useEffect(() => {
    const status = (error as { response?: { status?: number } } | null)?.response?.status;
    if (status === 400) onLogout();
  }, [error, onLogout]);

  const csCols: TvColumn[] = useMemo(() => [
    { key: 'wonValue', label: 'Cuan', primary: true, fmt: fmtRp },
    { key: 'dealsClosed', label: 'Closing' },
    { key: 'leadsHandled', label: 'Leads' },
  ], []);
  const teamCols: TvColumn[] = useMemo(() => [{ key: 'omzet', label: 'Omzet', primary: true, fmt: fmtRp }], []);
  const designerCols: TvColumn[] = useMemo(() => [
    { key: 'omzetShare', label: 'Omzet', primary: true, fmt: fmtRp },
    { key: 'selesai', label: 'Selesai' },
    { key: 'acc', label: 'ACC' },
  ], []);
  const operatorCols: TvColumn[] = useMemo(() => [
    { key: 'total', label: 'Job', primary: true },
    { key: 'printJobs', label: 'Cetak' },
    { key: 'prodJobs', label: 'Produksi' },
  ], []);

  const panels = [
    { title: 'Tim / Cabang', icon: <Building2 className="w-4 h-4" />, rows: data?.team.leaderboard ?? [], columns: teamCols, sortKey: 'omzet' },
    { title: 'CS / Sales', icon: <Users className="w-4 h-4" />, rows: data?.cs.leaderboard ?? [], columns: csCols, sortKey: 'wonValue' },
    { title: 'Designer', icon: <Palette className="w-4 h-4" />, rows: data?.designer.leaderboard ?? [], columns: designerCols, sortKey: 'omzetShare' },
    { title: 'Operator', icon: <Printer className="w-4 h-4" />, rows: data?.operator.leaderboard ?? [], columns: operatorCols, sortKey: 'total' },
  ];

  // Ringkasan juara tiap divisi untuk ticker berjalan di bawah.
  const highlights = panels.map(p => {
    const col = p.columns.find(c => (c as TvColumn).primary) ?? p.columns[0];
    const top = [...p.rows].sort((a, b) => (Number(b[p.sortKey]) || 0) - (Number(a[p.sortKey]) || 0))[0];
    if (!top) return null;
    const val = col.fmt ? col.fmt(top[col.key], top) : top[col.key];
    return { label: p.title, name: top.name as string, metric: col.label, val };
  }).filter(Boolean) as { label: string; name: string; metric: string; val: ReactNode }[];

  return (
    <div className="relative h-screen w-screen flex flex-col overflow-hidden bg-gradient-to-br from-background via-background to-muted">
      {/* Aurora bergerak di latar — bikin layar tidak terlihat diam */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="tv-aurora absolute -top-40 -left-32 h-[32rem] w-[32rem] rounded-full bg-primary/20 blur-[130px]" />
        <div className="tv-aurora absolute top-1/4 -right-32 h-[30rem] w-[30rem] rounded-full bg-blue-500/15 blur-[130px]" style={{ animationDelay: '3s' }} />
        <div className="tv-aurora absolute -bottom-44 left-1/3 h-[30rem] w-[30rem] rounded-full bg-fuchsia-500/12 blur-[140px]" style={{ animationDelay: '6s' }} />
        <div className="tv-aurora absolute top-1/2 left-[-6rem] h-96 w-96 rounded-full bg-emerald-400/12 blur-[120px]" style={{ animationDelay: '9s' }} />
      </div>

      <div className="relative z-10 flex flex-col h-full min-h-0">
        <TvHeader
          period={period} onPeriod={setPeriod}
          branches={branches} branchId={branchId} onBranch={setBranchId}
          lastUpdated={dataUpdatedAt ? new Date(dataUpdatedAt) : null}
        />
        <DailyTargetBar data={data?.dailyTarget ?? null} branchId={branchId} />
        <main className="flex-1 min-h-0 grid grid-cols-2 grid-rows-2 gap-3 p-3">
          {panels.map((p, i) => (
            <div key={p.title} className="min-h-0 flex animate-in fade-in zoom-in-95 slide-in-from-bottom-4"
              style={{ animationDelay: `${i * 120}ms`, animationDuration: '600ms' }}>
              <div className="flex-1 flex min-w-0">
                <DivisionPanel title={p.title} icon={p.icon} rows={p.rows} columns={p.columns}
                  sortKey={p.sortKey} topN={5} refreshKey={dataUpdatedAt} />
              </div>
            </div>
          ))}
        </main>

        {/* Ticker berjalan — highlight juara tiap divisi, gerakan konstan */}
        {highlights.length > 0 && (
          <div className="relative z-10 overflow-hidden border-t border-border bg-card/70 backdrop-blur py-2">
            <div className="tv-marquee-track flex w-max gap-10 whitespace-nowrap px-4">
              {[...highlights, ...highlights].map((h, i) => (
                <span key={i} className="inline-flex items-center gap-2 text-sm font-semibold">
                  <span className="text-amber-500">🥇</span>
                  <span className="text-muted-foreground uppercase text-xs tracking-wider">{h.label}</span>
                  <span className="font-extrabold">{h.name}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-primary font-bold">{h.metric}: {h.val}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
