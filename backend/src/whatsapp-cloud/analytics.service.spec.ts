import { AnalyticsService, pivotSeries } from './analytics.service';

describe('pivotSeries', () => {
    it('mengisi hari kosong dengan 0 & memisah inbound/outbound', () => {
        const from = new Date('2026-07-01T00:00:00Z');
        const to = new Date('2026-07-03T23:59:59Z');
        const rows = [
            { d: '2026-07-01', direction: 'INBOUND', c: 5 },
            { d: '2026-07-01', direction: 'OUTBOUND', c: 3 },
            { d: '2026-07-03', direction: 'INBOUND', c: 2 },
        ];
        const series = pivotSeries(rows, from, to);
        expect(series).toEqual([
            { date: '2026-07-01', inbound: 5, outbound: 3 },
            { date: '2026-07-02', inbound: 0, outbound: 0 },
            { date: '2026-07-03', inbound: 2, outbound: 0 },
        ]);
    });

    it('menangani COUNT BigInt (via Number)', () => {
        const from = new Date('2026-07-01T00:00:00Z');
        const to = new Date('2026-07-01T23:59:59Z');
        const series = pivotSeries([{ d: '2026-07-01', direction: 'OUTBOUND', c: BigInt(7) }], from, to);
        expect(series[0].outbound).toBe(7);
    });
});

describe('AnalyticsService.summary', () => {
    it('mengagregasi pesan/percakapan/kontak/lead/broadcast', async () => {
        const prisma = {
            waMessage: { count: jest.fn().mockResolvedValue(4) },
            waConversation: { count: jest.fn().mockResolvedValue(2) },
            waContact: { count: jest.fn().mockResolvedValue(10) },
            lead: { count: jest.fn().mockResolvedValue(3) },
            waBroadcast: { aggregate: jest.fn().mockResolvedValue({ _count: { _all: 1 }, _sum: { sentCount: 50, failedCount: 2 } }) },
        };
        const svc = new AnalyticsService(prisma as any);
        const res = await svc.summary({ channelId: 3 });

        expect(res.messages.inbound).toBe(4);
        expect(res.broadcasts).toEqual({ count: 1, sent: 50, failed: 2 });
        expect(res.leadsFromWa).toBe(3);
        // channel filter diteruskan ke count pesan
        expect(prisma.waMessage.count.mock.calls[0][0].where.channelId).toBe(3);
    });

    it('broadcast sum null → 0', async () => {
        const prisma = {
            waMessage: { count: jest.fn().mockResolvedValue(0) },
            waConversation: { count: jest.fn().mockResolvedValue(0) },
            waContact: { count: jest.fn().mockResolvedValue(0) },
            lead: { count: jest.fn().mockResolvedValue(0) },
            waBroadcast: { aggregate: jest.fn().mockResolvedValue({ _count: { _all: 0 }, _sum: { sentCount: null, failedCount: null } }) },
        };
        const svc = new AnalyticsService(prisma as any);
        const res = await svc.summary({});
        expect(res.broadcasts).toEqual({ count: 0, sent: 0, failed: 0 });
    });
});

describe('AnalyticsService.csBenchmark — Desainer dipisah & tak mengklaim burst CS', () => {
    it('balasan desainer di tengah tidak mereset pending CS', async () => {
        // 1 percakapan: masuk t0 → desainer balas +10s → CS balas +30s.
        const T = (s: number) => new Date(2026, 6, 1, 0, 0, s);
        const msgs = [
            { conversationId: 1, direction: 'INBOUND', sentById: null, createdAt: T(0) },
            { conversationId: 1, direction: 'OUTBOUND', sentById: 2, createdAt: T(10) }, // desainer
            { conversationId: 1, direction: 'OUTBOUND', sentById: 1, createdAt: T(30) }, // CS
        ];
        const users = [
            { id: 1, name: 'Sinta', role: { name: 'CS' } },
            { id: 2, name: 'Dedi', role: { name: 'Desainer' } },
        ];
        const prisma = {
            waMessage: { findMany: jest.fn().mockResolvedValue(msgs) },
            user: { findMany: jest.fn().mockResolvedValue(users) },
        };
        const svc = new AnalyticsService(prisma as any);
        const res = await svc.csBenchmark({});

        // CS diukur dari burst (t0), BUKAN dari balasan desainer (t10) → 30 detik.
        expect(res.csAgents).toHaveLength(1);
        expect(res.csAgents[0]).toMatchObject({ userId: 1, name: 'Sinta', avgSec: 30, responses: 1 });
        // Desainer punya benchmark sendiri: 10 detik.
        expect(res.designerAgents).toHaveLength(1);
        expect(res.designerAgents[0]).toMatchObject({ userId: 2, name: 'Dedi', avgSec: 10, isDesigner: true });
        // Overall CS murni (tak tercampur desainer).
        expect(res.overall.avgSec).toBe(30);
        expect(res.overallDesigner.avgSec).toBe(10);
    });
});
