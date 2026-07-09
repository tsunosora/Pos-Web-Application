import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { PrismaService } from '../prisma/prisma.service';
import { DiscordService } from '../discord/discord.service';
import type { BranchContext } from '../common/branch-context.decorator';

const OWNER: BranchContext = { branchId: null, isOwner: true, userBranchId: null, roleName: 'OWNER' };
const STAFF: BranchContext = { branchId: 1, isOwner: false, userBranchId: 1, roleName: 'CS' };

function makePrisma(overrides: any = {}) {
    return {
        cashflow: {
            groupBy: jest.fn().mockResolvedValue([]),
            findMany: jest.fn().mockResolvedValue([]),
        },
        fixedExpense: { findMany: jest.fn().mockResolvedValue([]) },
        transaction: { findMany: jest.fn().mockResolvedValue([]) },
        shiftReport: { findMany: jest.fn().mockResolvedValue([]) },
        companyBranch: { findUnique: jest.fn().mockResolvedValue(null) },
        branchMonthlyClosing: { findMany: jest.fn().mockResolvedValue([]) },
        centralTreasuryEntry: { groupBy: jest.fn().mockResolvedValue([]), findMany: jest.fn().mockResolvedValue([]), create: jest.fn().mockResolvedValue({ id: 1 }) },
        ...overrides,
    };
}

async function build(prisma: any) {
    const mod: TestingModule = await Test.createTestingModule({
        providers: [
            ReportsService,
            { provide: PrismaService, useValue: prisma },
            { provide: DiscordService, useValue: { sendMessage: jest.fn() } },
        ],
    }).compile();
    return mod.get<ReportsService>(ReportsService);
}

describe('ReportsService.getFinanceCandles', () => {
    it('tolak non-owner', async () => {
        const svc = await build(makePrisma());
        await expect(
            svc.getFinanceCandles(STAFF, 'day', '2026-07-01', '2026-07-07'),
        ).rejects.toThrow(/owner/i);
    });

    it('bangun OHLC equity dari opening + income/expense harian', async () => {
        const prisma = makePrisma({
            cashflow: {
                groupBy: jest.fn().mockResolvedValue([{ type: 'INCOME', _sum: { amount: 1000 } }]),
                findMany: jest.fn().mockResolvedValue([
                    { type: 'INCOME', amount: 500, date: new Date('2026-07-01T09:00:00') },
                    { type: 'EXPENSE', amount: 200, date: new Date('2026-07-01T15:00:00') },
                    { type: 'INCOME', amount: 300, date: new Date('2026-07-02T10:00:00') },
                ]),
            },
        });
        const svc = await build(prisma);
        const res = await svc.getFinanceCandles(OWNER, 'day', '2026-07-01', '2026-07-02', false);

        expect(res.candles).toHaveLength(2);
        const d1 = res.candles[0];
        expect(d1.time).toBe('2026-07-01');
        expect(d1.open).toBe(1000);
        expect(d1.high).toBe(1500);
        expect(d1.low).toBe(1000);
        expect(d1.close).toBe(1300);
        expect(d1.income).toBe(500);
        expect(d1.expense).toBe(200);
        expect(d1.net).toBe(300);

        const d2 = res.candles[1];
        expect(d2.open).toBe(1300);
        expect(d2.close).toBe(1600);
        expect(res.summary.closingBalance).toBe(1600);
        expect(res.summary.trend).toBe('bullish');
    });

    it('proyeksikan FixedExpense pada dueDay yang BELUM tiba (masa depan)', async () => {
        const prisma = makePrisma({
            cashflow: {
                groupBy: jest.fn().mockResolvedValue([]),
                findMany: jest.fn().mockResolvedValue([]),
            },
            fixedExpense: { findMany: jest.fn().mockResolvedValue([{ id: 1, name: 'Sewa', category: 'SEWA', amount: 400, dueDay: 5, isActive: true }]) },
        });
        const svc = await build(prisma);
        // "Hari ini" = 1 Juli 2026 → jatuh tempo 5 Juli masih di depan, jadi diproyeksikan.
        jest.spyOn(svc as any, 'now').mockReturnValue(new Date('2026-07-01T08:00:00'));
        const res = await svc.getFinanceCandles(OWNER, 'day', '2026-07-01', '2026-07-31', true);
        expect(res.candles).toHaveLength(1);
        expect(res.candles[0].time).toBe('2026-07-05');
        expect(res.candles[0].expense).toBe(400);
        expect(res.summary.closingBalance).toBe(-400);
        expect(res.summary.trend).toBe('bearish');
    });

    it('JANGAN suntik FixedExpense untuk dueDay yang sudah lewat (riwayat = kas nyata saja)', async () => {
        const prisma = makePrisma({
            cashflow: {
                groupBy: jest.fn().mockResolvedValue([]),
                findMany: jest.fn().mockResolvedValue([]),
            },
            fixedExpense: { findMany: jest.fn().mockResolvedValue([{ id: 1, name: 'Sewa', category: 'SEWA', amount: 400, dueDay: 5, isActive: true }]) },
        });
        const svc = await build(prisma);
        // "Hari ini" = 20 Juli 2026 → jatuh tempo 5 Juli sudah lewat: TIDAK diproyeksikan (dianggap sudah ada di Cashflow).
        jest.spyOn(svc as any, 'now').mockReturnValue(new Date('2026-07-20T08:00:00'));
        const res = await svc.getFinanceCandles(OWNER, 'day', '2026-07-01', '2026-07-31', true);
        expect(res.candles).toHaveLength(0);
        expect(res.summary.closingBalance).toBe(0);
    });
});

describe('ReportsService.getFinanceHeatmap', () => {
    it('agregasi count & revenue per hari & jam', async () => {
        const prisma = makePrisma({
            transaction: {
                findMany: jest.fn().mockResolvedValue([
                    { grandTotal: 100, createdAt: new Date('2026-07-06T09:30:00') }, // Senin 09
                    { grandTotal: 200, createdAt: new Date('2026-07-06T09:45:00') }, // Senin 09
                    { grandTotal: 50, createdAt: new Date('2026-07-07T14:00:00') },  // Selasa 14
                ]),
            },
        });
        const svc = await build(prisma);
        const res = await svc.getFinanceHeatmap(OWNER, '2026-07-06', '2026-07-07');
        const mon = res.byDayOfWeek.find((d: any) => d.dow === 1)!;
        expect(mon.count).toBe(2);
        expect(mon.revenue).toBe(300);
        const h9 = res.byHour.find((h: any) => h.hour === 9)!;
        expect(h9.count).toBe(2);
        expect(res.busiestDay.dow).toBe(1);
    });
});

describe('ReportsService.getFinanceJournal', () => {
    it('gabung entri + running balance per hari', async () => {
        const prisma = makePrisma({
            cashflow: {
                groupBy: jest.fn().mockResolvedValue([{ type: 'INCOME', _sum: { amount: 100 } }]), // opening 100
                findMany: jest.fn().mockResolvedValue([
                    { id: 1, type: 'INCOME', category: 'Penjualan', amount: 500, date: new Date('2026-07-01T09:00:00'), paymentMethod: 'CASH', note: 'nota A' },
                    { id: 2, type: 'EXPENSE', category: 'Stok', amount: 200, date: new Date('2026-07-01T15:00:00'), paymentMethod: 'CASH', note: 'beli tinta' },
                ]),
            },
        });
        const svc = await build(prisma);
        const res = await svc.getFinanceJournal(OWNER, '2026-07-01', '2026-07-01', false);
        expect(res.openingBalance).toBe(100);
        expect(res.days).toHaveLength(1);
        const day = res.days[0];
        expect(day.openingBalance).toBe(100);
        expect(day.entries).toHaveLength(2);
        expect(day.entries[0].runningBalance).toBe(600); // 100 + 500
        expect(day.entries[1].runningBalance).toBe(400); // 600 - 200
        expect(day.closingBalance).toBe(400);
        expect(day.income).toBe(500);
        expect(day.expense).toBe(200);
    });
});

describe('ReportsService.getFinanceExpenseBreakdown', () => {
    it('agregasi pengeluaran per kategori + persen', async () => {
        const prisma = makePrisma({
            cashflow: {
                groupBy: jest.fn().mockResolvedValue([]),
                findMany: jest.fn().mockResolvedValue([
                    { type: 'EXPENSE', category: 'Stok', amount: 600 },
                    { type: 'EXPENSE', category: 'Stok', amount: 100 },
                    { type: 'EXPENSE', category: 'Listrik', amount: 300 },
                    { type: 'INCOME', category: 'Penjualan', amount: 999 },
                ]),
            },
        });
        const svc = await build(prisma);
        const res = await svc.getFinanceExpenseBreakdown(OWNER, '2026-07-01', '2026-07-31', false);
        expect(res.total).toBe(1000);
        expect(res.categories[0]).toEqual({ category: 'Stok', amount: 700, pct: 70 });
        expect(res.categories[1]).toEqual({ category: 'Listrik', amount: 300, pct: 30 });
    });
});

describe('ReportsService.getFinanceComparison', () => {
    it('bandingkan periode + narasi turun', async () => {
        // Periode kini 08-14 Juli, pembanding 01-07 Juli.
        const prisma = makePrisma({
            cashflow: {
                groupBy: jest.fn().mockResolvedValue([]),
                findMany: jest.fn().mockImplementation(({ where }: any) => {
                    const gte: Date = where.date.gte;
                    // periode kini mulai 08 Juli → income kecil; pembanding mulai 01 Juli → income besar
                    if (gte.getDate() >= 8) return Promise.resolve([{ type: 'INCOME', category: 'Penjualan', amount: 800 }, { type: 'EXPENSE', category: 'Stok', amount: 300 }]);
                    return Promise.resolve([{ type: 'INCOME', category: 'Penjualan', amount: 1000 }, { type: 'EXPENSE', category: 'Stok', amount: 200 }]);
                }),
            },
        });
        const svc = await build(prisma);
        const res = await svc.getFinanceComparison(OWNER, '2026-07-08', '2026-07-14', false);
        expect(res.current.net).toBe(500);   // 800 - 300
        expect(res.previous.net).toBe(800);  // 1000 - 200
        expect(res.delta.net).toBe(-300);
        expect(res.insights.some((s: string) => /turun/i.test(s))).toBe(true);
        expect(res.topExpenseChanges[0].category).toBe('Stok');
    });
});

describe('ReportsService.getFinanceConsolidation', () => {
    it('konsolidasi saldo bank + kas per cabang + grand total', async () => {
        const prisma = makePrisma({
            companyBranch: { findMany: jest.fn().mockResolvedValue([{ id: 1, name: 'Pusat', code: 'PST' }, { id: 2, name: 'Cabang B', code: 'CBG' }]) },
            bankAccount: {
                findMany: jest.fn().mockResolvedValue([
                    { id: 10, bankName: 'BCA', accountNumber: '111', currentBalance: 500, branchId: 1 },
                    { id: 11, bankName: 'BRI', accountNumber: '222', currentBalance: 300, branchId: 1 },
                    { id: 12, bankName: 'BCA', accountNumber: '333', currentBalance: 200, branchId: 2 },
                ]),
            },
            shiftReport: { findMany: jest.fn().mockResolvedValue([{ branchId: 1, actualCash: 150, closedAt: new Date('2026-07-31T20:00:00') }]) },
            cashflow: { groupBy: jest.fn().mockResolvedValue([{ branchId: 1, _sum: { amount: 900 } }]), findMany: jest.fn().mockResolvedValue([]) },
        });
        const svc = await build(prisma);
        const res = await svc.getFinanceConsolidation(OWNER, 2026, 7);
        const pusat = res.branches.find((b: any) => b.branchId === 1)!;
        expect(pusat.bankTotal).toBe(800);
        expect(pusat.cash).toBe(150);
        expect(pusat.total).toBe(950);
        expect(pusat.suggestedModal).toBe(300); // 900 / 3
        const cbg = res.branches.find((b: any) => b.branchId === 2)!;
        expect(cbg.total).toBe(200); // 200 bank, 0 kas
        expect(res.grandTotal.bank).toBe(1000);
        expect(res.grandTotal.cash).toBe(150);
        expect(res.grandTotal.total).toBe(1150);
    });
});

describe('ReportsService.closeBranchBalance', () => {
    function txMock(prisma: any) {
        // $transaction menerima callback(tx); pakai prisma sbg tx
        prisma.$transaction = jest.fn(async (cb: any) => cb(prisma));
        return prisma;
    }
    it('tolak kalau sudah ditutup', async () => {
        const prisma = txMock(makePrisma({ branchMonthlyClosing: { findUnique: jest.fn().mockResolvedValue({ id: 1 }) } }));
        const svc = await build(prisma);
        await expect(svc.closeBranchBalance(OWNER, 2026, 7, 1)).rejects.toThrow(/sudah ditutup/i);
    });
    it('buat cashflow pengosongan + reset saldo + record', async () => {
        const prisma = txMock(makePrisma({
            branchMonthlyClosing: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 5 }) },
            companyBranch: { findUnique: jest.fn().mockResolvedValue({ name: 'Pusat' }) },
            bankAccount: { findMany: jest.fn().mockResolvedValue([{ id: 10, bankName: 'BCA', currentBalance: 800 }]), update: jest.fn().mockResolvedValue({}) },
            shiftReport: { findFirst: jest.fn().mockResolvedValue({ actualCash: 150 }) },
            cashflow: { groupBy: jest.fn(), findMany: jest.fn(), create: jest.fn().mockResolvedValue({}) },
        }));
        const svc = await build(prisma);
        const res = await svc.closeBranchBalance(OWNER, 2026, 7, 1);
        expect(res.collectedBank).toBe(800);
        expect(res.collectedCash).toBe(150);
        expect(res.total).toBe(950);
        expect(prisma.cashflow.create).toHaveBeenCalledTimes(2); // 1 bank + 1 kas
        expect(prisma.bankAccount.update).toHaveBeenCalledWith(expect.objectContaining({ data: { currentBalance: 0 } }));
        expect(prisma.branchMonthlyClosing.create).toHaveBeenCalled();
    });
});

describe('ReportsService.fundBranchBalance', () => {
    function txMock(prisma: any) { prisma.$transaction = jest.fn(async (cb: any) => cb(prisma)); return prisma; }
    it('tolak kalau belum ditutup', async () => {
        const prisma = txMock(makePrisma({ branchMonthlyClosing: { findUnique: jest.fn().mockResolvedValue(null) } }));
        const svc = await build(prisma);
        await expect(svc.fundBranchBalance(OWNER, 2026, 7, 1, [{ bankAccountId: 10, amount: 500 }])).rejects.toThrow(/belum ditutup/i);
    });
    it('tolak dobel modal', async () => {
        const prisma = txMock(makePrisma({ branchMonthlyClosing: { findUnique: jest.fn().mockResolvedValue({ id: 5, status: 'FUNDED' }) } }));
        const svc = await build(prisma);
        await expect(svc.fundBranchBalance(OWNER, 2026, 7, 1, [{ bankAccountId: 10, amount: 500 }])).rejects.toThrow(/sudah diberi modal/i);
    });
    it('tambah saldo + cashflow modal + status FUNDED', async () => {
        const prisma = txMock(makePrisma({
            branchMonthlyClosing: { findUnique: jest.fn().mockResolvedValue({ id: 5, status: 'CLOSED' }), update: jest.fn().mockResolvedValue({}) },
            bankAccount: { findUnique: jest.fn().mockResolvedValue({ bankName: 'BCA', branchId: 1 }), update: jest.fn().mockResolvedValue({}) },
            cashflow: { groupBy: jest.fn(), findMany: jest.fn(), create: jest.fn().mockResolvedValue({}) },
        }));
        const svc = await build(prisma);
        const res = await svc.fundBranchBalance(OWNER, 2026, 7, 1, [{ bankAccountId: 10, amount: 500 }]);
        expect(res.modalTotal).toBe(500);
        expect(prisma.cashflow.create).toHaveBeenCalledTimes(1);
        expect(prisma.bankAccount.update).toHaveBeenCalledWith(expect.objectContaining({ data: { currentBalance: { increment: 500 } } }));
        expect(prisma.branchMonthlyClosing.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'FUNDED', modalTotal: 500 }) }));
    });
});

describe('ReportsService.getCentralTreasury', () => {
    it('hitung saldo pusat = IN - OUT + rincian bulan', async () => {
        const prisma = makePrisma({
            centralTreasuryEntry: {
                groupBy: jest.fn().mockResolvedValue([{ direction: 'IN', _sum: { amount: 10000 } }, { direction: 'OUT', _sum: { amount: 4000 } }]),
                findMany: jest.fn().mockResolvedValue([
                    { id: 1, direction: 'IN', category: 'SETORAN_CABANG', amount: 10000, branchId: 1, note: 'x', date: new Date('2026-07-31') },
                    { id: 2, direction: 'OUT', category: 'MODAL_CABANG', amount: 3000, branchId: 1, note: 'y', date: new Date('2026-08-01') },
                    { id: 3, direction: 'OUT', category: 'BELI_BAHAN', amount: 1000, branchId: null, note: 'tinta', date: new Date('2026-07-20') },
                ]),
                create: jest.fn(),
            },
        });
        const svc = await build(prisma);
        const res = await svc.getCentralTreasury(OWNER, 2026, 7);
        expect(res.balance).toBe(6000); // 10000 - 4000
        expect(res.monthSummary.collected).toBe(10000);
        expect(res.monthSummary.modalOut).toBe(3000);
        expect(res.monthSummary.bahanOut).toBe(1000);
        expect(res.entries).toHaveLength(3);
    });
    it('addCentralExpense tolak nominal <= 0', async () => {
        const svc = await build(makePrisma());
        await expect(svc.addCentralExpense(OWNER, 'BELI_BAHAN', 0)).rejects.toThrow(/lebih dari 0/i);
    });
});

describe('ReportsService.getFinanceAnomalies', () => {
    it('deteksi selisih kas shift & pengeluaran tanpa keterangan', async () => {
        const prisma = makePrisma({
            shiftReport: {
                findMany: jest.fn().mockResolvedValue([
                    { id: 7, closedAt: new Date('2026-07-03T20:00:00'), cashDifference: -60000, qrisDifference: 0, transferDifference: 0 },
                ]),
            },
            cashflow: {
                groupBy: jest.fn().mockResolvedValue([]),
                findMany: jest.fn().mockResolvedValue([
                    { id: 10, type: 'EXPENSE', category: 'LAINNYA', amount: 750000, date: new Date('2026-07-04T10:00:00'), note: '' },
                ]),
            },
        });
        const svc = await build(prisma);
        const res = await svc.getFinanceAnomalies(OWNER, '2026-07-01', '2026-07-31');
        const shiftDiff = res.anomalies.find((a: any) => a.type === 'SHIFT_DIFF');
        const unexplained = res.anomalies.find((a: any) => a.type === 'UNEXPLAINED');
        expect(shiftDiff).toBeDefined();
        expect(shiftDiff!.severity).toBe('med'); // 60000 >= 50000
        expect(unexplained).toBeDefined();
        expect(unexplained!.amount).toBe(750000);
        expect(res.count).toBeGreaterThanOrEqual(2);
    });
});
