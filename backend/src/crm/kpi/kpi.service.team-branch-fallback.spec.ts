import { KpiService } from './kpi.service';

/**
 * Leaderboard TIM: kalau cabang ORANGNYA kosong (mis. akun owner yang boleh
 * input orderan lintas cabang), bagiannya harus masuk ke cabang NOTA — bukan ke
 * baris 'Tak diketahui'.
 *
 * Kasus nyata 18 Sep 2026: nota SO-PST-20260902-0001 (Rp 2.202.810, cabang
 * Pusat) di-input akun owner tanpa branchId → muncul baris "Tak diketahui".
 */

const BRANCHES = [
  { id: 1, name: 'Voliko Imogiri', code: 'PST', isActive: true },
  { id: 2, name: 'Voliko Sewon', code: 'CAB', isActive: true },
];

type Nota = {
  id: number;
  grandTotal: number;
  cashierName: string | null;
  branchId: number | null;
  salesOrder: { designerName: string | null; branchName: string | null } | null;
};

function makeSvc(opts: {
  txs: Nota[];
  users: { id: number; name: string; branchId: number | null }[];
  leads?: { convertedTransactionId: number; assignedToId: number | null }[];
  designers?: { name: string; branchId: number | null }[];
}) {
  const svc = Object.create(KpiService.prototype) as KpiService;
  const list = <T>(rows: T[]) => jest.fn(() => Promise.resolve(rows));
  (svc as any).prisma = {
    transaction: { findMany: list(opts.txs) },
    lead: { findMany: list(opts.leads ?? []) },
    user: { findMany: list(opts.users) },
    designer: { findMany: list(opts.designers ?? []) },
    companyBranch: { findMany: list(BRANCHES) },
    printJob: { findMany: list([]) },
    productionJob: { findMany: list([]) },
    productionJobActivity: { findMany: list([]) },
  };
  return svc;
}

const nota = (over: Partial<Nota> = {}): Nota => ({
  id: 6121,
  grandTotal: 2202810,
  cashierName: 'Muhammad Faisal',
  branchId: 1,
  salesOrder: { designerName: 'Muhammad Faisal', branchName: 'Voliko Imogiri' },
  ...over,
});

const ctx: any = { branchId: null, isOwner: true };

describe('KpiService.teamLeaderboard — cadangan cabang = cabang nota', () => {
  it('CS/desainer tanpa cabang ikut cabang nota, bukan "Tak diketahui"', async () => {
    const svc = makeSvc({
      txs: [nota()],
      users: [{ id: 9, name: 'Muhammad Faisal', branchId: null }],
      leads: [{ convertedTransactionId: 6121, assignedToId: 9 }],
    });

    const res = await svc.teamLeaderboard(ctx, { period: 'month' } as any);
    const pusat = res.leaderboard.find((r) => r.branchId === 1);
    const unknown = res.leaderboard.find((r) => r.branchId === null);

    expect(unknown).toBeUndefined();
    expect(pusat?.csShare).toBe(2202810);
    expect(pusat?.designerShare).toBe(2202810);
    // 2 peran (CS + desainer) → omzet cabang = 2 × (2.202.810 / 2) = utuh.
    expect(pusat?.omzet).toBe(2202810);
    expect(res.totals.omzet).toBe(2202810);
  });

  it('cabang orang yang sudah ter-set tetap menang atas cabang nota', async () => {
    const svc = makeSvc({
      txs: [nota({ cashierName: 'Karyawan Sewon', salesOrder: null })],
      users: [{ id: 30, name: 'Karyawan Sewon', branchId: 2 }],
      leads: [{ convertedTransactionId: 6121, assignedToId: 30 }],
    });

    const res = await svc.teamLeaderboard(ctx, { period: 'month' } as any);

    expect(res.leaderboard.find((r) => r.branchId === 2)?.csShare).toBe(
      2202810,
    );
    expect(res.leaderboard.find((r) => r.branchId === 1)).toBeUndefined();
  });

  it('nota tanpa cabang tetap masuk baris "Tak diketahui"', async () => {
    const svc = makeSvc({
      txs: [
        nota({
          branchId: null,
          salesOrder: { designerName: null, branchName: null },
        }),
      ],
      users: [{ id: 9, name: 'Muhammad Faisal', branchId: null }],
      leads: [{ convertedTransactionId: 6121, assignedToId: 9 }],
    });

    const res = await svc.teamLeaderboard(ctx, { period: 'month' } as any);
    const unknown = res.leaderboard.find((r) => r.branchId === null);

    expect(unknown?.name).toBe('Tak diketahui');
    expect(unknown?.csShare).toBe(2202810);
  });
});
