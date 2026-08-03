import { KpiService } from './kpi.service';

describe('KpiService.publicLeaderboard', () => {
  it('menggabungkan 5 leaderboard dengan ctx owner sesuai branchId', async () => {
    const calls: Record<string, any> = {};
    const svc = Object.create(KpiService.prototype) as KpiService;
    (svc as any).report = jest.fn(async (ctx: any) => { calls.report = ctx; return { period: { start: 's', end: 'e' }, totals: {}, metrics: {}, leaderboard: [{ name: 'A' }], designCheckLeaderboard: [] }; });
    (svc as any).designerLeaderboard = jest.fn(async (ctx: any) => { calls.designer = ctx; return { leaderboard: [], totals: {} }; });
    (svc as any).operatorLeaderboard = jest.fn(async (ctx: any) => { calls.operator = ctx; return { leaderboard: [] }; });
    (svc as any).teamOmzetCashflow = jest.fn(async (ctx: any) => { calls.team = ctx; return { leaderboard: [], totals: {} }; });
    (svc as any).designOutput = jest.fn(async (ctx: any) => { calls.designOutput = ctx; return { leaderboard: [] }; });
    (svc as any).reports = { getDailyTargetStatus: jest.fn(async (ctx: any) => { calls.dailyTarget = ctx; return { today: '2026-08-01', daysInMonth: 31, branches: [] }; }) };

    const res = await svc.publicLeaderboard({ period: 'today' }, 3);

    expect(calls.report).toEqual({ branchId: 3, isOwner: true });
    expect(calls.team).toEqual({ branchId: 3, isOwner: true });
    expect(res.period).toEqual({ start: 's', end: 'e' });
    expect(res.cs.leaderboard).toEqual([{ name: 'A' }]);
    expect(res).toHaveProperty('designer');
    expect(res).toHaveProperty('operator');
    expect(res).toHaveProperty('team');
    expect(res).toHaveProperty('designOutput');
    expect(res).toHaveProperty('dailyTarget');
    expect(calls.dailyTarget).toEqual({ branchId: 3, isOwner: true });
  });

  it('branchId null = semua cabang', async () => {
    const svc = Object.create(KpiService.prototype) as KpiService;
    let seen: any;
    (svc as any).report = jest.fn(async (ctx: any) => { seen = ctx; return { period: { start: 's', end: 'e' }, totals: {}, metrics: {}, leaderboard: [], designCheckLeaderboard: [] }; });
    (svc as any).designerLeaderboard = jest.fn(async () => ({ leaderboard: [], totals: {} }));
    (svc as any).operatorLeaderboard = jest.fn(async () => ({ leaderboard: [] }));
    (svc as any).teamOmzetCashflow = jest.fn(async () => ({ leaderboard: [], totals: {} }));
    (svc as any).designOutput = jest.fn(async () => ({ leaderboard: [] }));
    (svc as any).reports = { getDailyTargetStatus: jest.fn(async () => ({ today: '2026-08-01', daysInMonth: 31, branches: [] })) };
    await svc.publicLeaderboard({ period: 'month' }, null);
    expect(seen).toEqual({ branchId: null, isOwner: true });
  });

  it('dailyTarget null bila reports gagal (tidak menggagalkan seluruh response)', async () => {
    const svc = Object.create(KpiService.prototype) as KpiService;
    (svc as any).report = jest.fn(async () => ({ period: { start: 's', end: 'e' }, totals: {}, metrics: {}, leaderboard: [], designCheckLeaderboard: [] }));
    (svc as any).designerLeaderboard = jest.fn(async () => ({ leaderboard: [], totals: {} }));
    (svc as any).operatorLeaderboard = jest.fn(async () => ({ leaderboard: [] }));
    (svc as any).teamOmzetCashflow = jest.fn(async () => ({ leaderboard: [], totals: {} }));
    (svc as any).designOutput = jest.fn(async () => ({ leaderboard: [] }));
    (svc as any).reports = { getDailyTargetStatus: jest.fn(async () => { throw new Error('boom'); }) };
    const res = await svc.publicLeaderboard({ period: 'today' }, 1);
    expect(res.dailyTarget).toBeNull();
  });
});
