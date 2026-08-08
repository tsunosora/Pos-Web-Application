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

    /**
     * Estimasi VOLUME pesan berbayar per kategori (model harga per-pesan Meta sejak
     * Jul 2025). Sumber: balasan template (WaMessage), broadcast (WaBroadcast.sentCount),
     * reminder (WaReminderLog). Tarif dihitung di frontend (bisa disetel owner).
     */
    async costEstimate(opts: AnalyticsQuery) {
        const { fromDate, toDate } = this.range(opts.from, opts.to);
        const inRange = { createdAt: { gte: fromDate, lte: toDate } };
        const ch = opts.channelId ? { channelId: opts.channelId } : {};

        const norm = (c?: string | null): 'MARKETING' | 'UTILITY' | 'AUTHENTICATION' => {
            const u = (c || '').toUpperCase();
            return u === 'MARKETING' || u === 'AUTHENTICATION' ? u : 'UTILITY';
        };
        const billable: Record<'MARKETING' | 'UTILITY' | 'AUTHENTICATION', number> = {
            MARKETING: 0,
            UTILITY: 0,
            AUTHENTICATION: 0,
        };

        // 1) Balasan template via inbox (WaMessage type TEMPLATE, bukan broadcast).
        const templates = await this.prisma.waTemplate.findMany({ select: { id: true, name: true, category: true } });
        const catByName = new Map(templates.map((t) => [t.name, norm(t.category)]));
        const catById = new Map(templates.map((t) => [t.id, norm(t.category)]));
        const tmplGroups = await this.prisma.waMessage.groupBy({
            by: ['templateName'],
            where: { direction: 'OUTBOUND', type: 'TEMPLATE', broadcastId: null, templateName: { not: null }, ...inRange, ...ch },
            _count: { _all: true },
        });
        for (const g of tmplGroups) billable[catByName.get(g.templateName ?? '') ?? 'UTILITY'] += g._count._all;

        // 2) Broadcast (sentCount per kategori template).
        const bcasts = await this.prisma.waBroadcast.findMany({
            where: { ...inRange, ...ch },
            select: { sentCount: true, template: { select: { category: true } } },
        });
        for (const b of bcasts) billable[norm(b.template?.category)] += b.sentCount ?? 0;

        // 3) Reminder (WaReminderLog SENT, kategori dari config→template).
        const configs = await this.prisma.waReminderConfig.findMany({
            select: { eventType: true, templateId: true },
        });
        const catByEvent = new Map(
            configs.map((c) => [c.eventType, (c.templateId != null ? catById.get(c.templateId) : undefined) ?? 'UTILITY']),
        );
        const remGroups = await this.prisma.waReminderLog.groupBy({
            by: ['eventType'],
            where: { status: 'SENT', ...inRange },
            _count: { _all: true },
        });
        for (const g of remGroups) billable[catByEvent.get(g.eventType) ?? 'UTILITY'] += g._count._all;

        // Pesan layanan (session/non-template) — gratis di model baru.
        const freeService = await this.prisma.waMessage.count({
            where: { direction: 'OUTBOUND', type: { not: 'TEMPLATE' }, ...inRange, ...ch },
        });

        const totalBillable = billable.MARKETING + billable.UTILITY + billable.AUTHENTICATION;
        return { billable, totalBillable, freeService };
    }

    async overview(opts: AnalyticsQuery) {
        const [summary, series, cost] = await Promise.all([
            this.summary(opts),
            this.dailySeries(opts),
            this.costEstimate(opts),
        ]);
        return { summary, series, cost };
    }
}
