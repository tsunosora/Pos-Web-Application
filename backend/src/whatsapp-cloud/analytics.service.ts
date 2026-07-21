import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AnalyticsQuery {
    from?: string;
    to?: string;
    channelId?: number;
}

export interface DailyPoint {
    date: string; // YYYY-MM-DD
    inbound: number;
    outbound: number;
}

/** Pivot hasil raw {d, direction, c} → deret harian penuh (isi 0 utk hari kosong). */
export function pivotSeries(rows: Array<{ d: any; direction: string; c: any }>, fromDate: Date, toDate: Date): DailyPoint[] {
    const fmt = (dt: Date) => dt.toISOString().slice(0, 10);
    const map = new Map<string, DailyPoint>();
    // isi semua tanggal dalam rentang dengan 0
    for (let t = new Date(fmt(fromDate)); t <= toDate; t = new Date(t.getTime() + 86400000)) {
        const key = fmt(t);
        map.set(key, { date: key, inbound: 0, outbound: 0 });
    }
    for (const r of rows) {
        const key = typeof r.d === 'string' ? r.d.slice(0, 10) : fmt(new Date(r.d));
        const pt = map.get(key) ?? { date: key, inbound: 0, outbound: 0 };
        const n = Number(r.c);
        if (r.direction === 'INBOUND') pt.inbound = n;
        else if (r.direction === 'OUTBOUND') pt.outbound = n;
        map.set(key, pt);
    }
    return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

@Injectable()
export class AnalyticsService {
    constructor(private readonly prisma: PrismaService) {}

    private range(from?: string, to?: string) {
        const toDate = to ? new Date(to) : new Date();
        const fromDate = from ? new Date(from) : new Date(toDate.getTime() - 30 * 86400000);
        return { fromDate, toDate };
    }

    async summary(opts: AnalyticsQuery) {
        const { fromDate, toDate } = this.range(opts.from, opts.to);
        const ch = opts.channelId ? { channelId: opts.channelId } : {};
        const inRange = { createdAt: { gte: fromDate, lte: toDate } };

        const [inbound, outbound, delivered, read, failed, newConversations, openConversations, contactsTotal, optedOut, leadsFromWa, broadcastAgg] =
            await Promise.all([
                this.prisma.waMessage.count({ where: { direction: 'INBOUND', ...inRange, ...ch } }),
                this.prisma.waMessage.count({ where: { direction: 'OUTBOUND', ...inRange, ...ch } }),
                this.prisma.waMessage.count({ where: { direction: 'OUTBOUND', status: { in: ['DELIVERED', 'READ'] }, ...inRange, ...ch } }),
                this.prisma.waMessage.count({ where: { direction: 'OUTBOUND', status: 'READ', ...inRange, ...ch } }),
                this.prisma.waMessage.count({ where: { direction: 'OUTBOUND', status: 'FAILED', ...inRange, ...ch } }),
                this.prisma.waConversation.count({ where: { ...inRange, ...ch } }),
                this.prisma.waConversation.count({ where: { status: 'OPEN', ...ch } }),
                this.prisma.waContact.count(),
                this.prisma.waContact.count({ where: { optedOut: true } }),
                this.prisma.lead.count({ where: { source: 'WHATSAPP', createdAt: { gte: fromDate, lte: toDate } } }),
                this.prisma.waBroadcast.aggregate({ _count: { _all: true }, _sum: { sentCount: true, failedCount: true }, where: { ...inRange } }),
            ]);

        return {
            range: { from: fromDate, to: toDate },
            messages: { inbound, outbound, delivered, read, failed },
            conversations: { new: newConversations, open: openConversations },
            contacts: { total: contactsTotal, optedOut },
            leadsFromWa,
            broadcasts: { count: broadcastAgg._count._all, sent: broadcastAgg._sum.sentCount ?? 0, failed: broadcastAgg._sum.failedCount ?? 0 },
        };
    }

    async dailySeries(opts: AnalyticsQuery): Promise<DailyPoint[]> {
        const { fromDate, toDate } = this.range(opts.from, opts.to);
        const chFilter = opts.channelId ? `AND channel_id = ${Number(opts.channelId)}` : '';
        const rows: any[] = await this.prisma.$queryRawUnsafe(
            `SELECT DATE(created_at) d, direction, COUNT(*) c
             FROM wa_messages
             WHERE created_at BETWEEN ? AND ? ${chFilter}
             GROUP BY d, direction
             ORDER BY d`,
            fromDate,
            toDate,
        );
        return pivotSeries(rows, fromDate, toDate);
    }

    async overview(opts: AnalyticsQuery) {
        const [summary, series] = await Promise.all([this.summary(opts), this.dailySeries(opts)]);
        return { summary, series };
    }
}
