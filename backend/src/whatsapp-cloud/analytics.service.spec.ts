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
