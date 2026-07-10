import { computeDailyTargets } from './daily-target.util';

describe('computeDailyTargets', () => {
  it('derive target dari beban bulanan + alokasi pusat / hari', () => {
    const [r] = computeDailyTargets(
      [{ branchId: 1, branchName: 'A', branchFixedTotal: 3000, override: null, todayOmzet: 50 }],
      3000, // pusat, dibagi 1 cabang
      30,
    );
    expect(r.monthlyFixedExpense).toBe(6000);
    expect(r.dailyTarget).toBe(200); // 6000/30
    expect(r.met).toBe(false);
    expect(r.shortfall).toBe(150);
  });

  it('pakai override kalau diisi', () => {
    const [r] = computeDailyTargets(
      [{ branchId: 1, branchName: 'A', branchFixedTotal: 3000, override: 500, todayOmzet: 500 }],
      0,
      30,
    );
    expect(r.isOverride).toBe(true);
    expect(r.dailyTarget).toBe(500);
    expect(r.met).toBe(true);
  });

  it('alokasi pusat dibagi rata ke jumlah cabang', () => {
    const res = computeDailyTargets(
      [
        { branchId: 1, branchName: 'A', branchFixedTotal: 0, override: null, todayOmzet: 0 },
        { branchId: 2, branchName: 'B', branchFixedTotal: 0, override: null, todayOmzet: 0 },
      ],
      6000, // dibagi 2 cabang => 3000 tiap cabang
      30,
    );
    expect(res[0].monthlyFixedExpense).toBe(3000);
    expect(res[0].dailyTarget).toBe(100); // 3000/30
  });
});
