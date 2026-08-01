'use client';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, Palette, Printer, Building2 } from 'lucide-react';
import { getTvLeaderboard, type TvPeriod } from '@/lib/api/leaderboard-tv';
import { getPublicBranches } from '@/lib/api/production';
import TvHeader from './TvHeader';
import DivisionPanel, { type TvColumn } from './DivisionPanel';

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

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-gradient-to-br from-background to-muted">
      <TvHeader
        period={period} onPeriod={setPeriod}
        branches={branches} branchId={branchId} onBranch={setBranchId}
        lastUpdated={dataUpdatedAt ? new Date(dataUpdatedAt) : null}
      />
      <main className="flex-1 min-h-0 grid grid-cols-2 grid-rows-2 gap-3 p-3">
        <DivisionPanel title="Tim / Cabang" icon={<Building2 className="w-4 h-4" />}
          rows={data?.team.leaderboard ?? []} columns={teamCols} sortKey="omzet" topN={5} />
        <DivisionPanel title="CS / Sales" icon={<Users className="w-4 h-4" />}
          rows={data?.cs.leaderboard ?? []} columns={csCols} sortKey="wonValue" topN={5} />
        <DivisionPanel title="Designer" icon={<Palette className="w-4 h-4" />}
          rows={data?.designer.leaderboard ?? []} columns={designerCols} sortKey="omzetShare" topN={5} />
        <DivisionPanel title="Operator" icon={<Printer className="w-4 h-4" />}
          rows={data?.operator.leaderboard ?? []} columns={operatorCols} sortKey="total" topN={5} />
      </main>
    </div>
  );
}
