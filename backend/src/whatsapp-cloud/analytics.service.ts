import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { isDesignerRole } from './wa-roles.util';

export interface AnalyticsQuery {
    from?: string;
    to?: string;
    channelId?: number;
    slaMinutes?: number;
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

    /**
     * Benchmark kecepatan balas CS. First Response Time = jarak dari pesan MASUK
     * (awal burst) ke balasan MANUSIA pertama (WaMessage.sentById != null) di
     * percakapan yang sama. Auto-reply (sentById null) diabaikan.
     * Atribusi ke agen pengirim balasan.
     */
    /**
     * Inti FRT: kembalikan per-userId (WaMessage.sentById) daftar detik respon
     * (jarak awal burst pesan masuk → balasan manusia pertama). Dipakai bersama
     * oleh csBenchmark & waCsMetricsByUser (leaderboard).
     */
    /** Peta userId → apakah role desainer (untuk pending FRT terpisah CS vs Desainer). */
    private async isDesignerByUserId(senderIds: number[]): Promise<Map<number, boolean>> {
        const ids = [...new Set(senderIds)];
        const users = ids.length
            ? await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, role: { select: { name: true } } } })
            : [];
        return new Map(users.map((u) => [u.id, isDesignerRole(u.role?.name)]));
    }

    private async frtByAgent(fromDate: Date, toDate: Date, channelId?: number): Promise<Map<number, number[]>> {
        const inRange = { createdAt: { gte: fromDate, lte: toDate } };
        const ch = channelId ? { channelId } : {};
        const msgs = await this.prisma.waMessage.findMany({
            where: { ...inRange, ...ch },
            select: { conversationId: true, direction: true, sentById: true, createdAt: true },
            orderBy: [{ conversationId: 'asc' }, { id: 'asc' }],
        });
        const desById = await this.isDesignerByUserId(msgs.filter((m) => m.sentById != null).map((m) => m.sentById!));

        const perAgent = new Map<number, number[]>();
        let curConv = -1;
        // Pending burst DIPISAH per grup: balasan desainer tak "mengklaim" burst CS (dan sebaliknya).
        let pendingCs: Date | null = null;
        let pendingDes: Date | null = null;
        for (const m of msgs) {
            if (m.conversationId !== curConv) {
                curConv = m.conversationId;
                pendingCs = null;
                pendingDes = null;
            }
            if (m.direction === 'INBOUND') {
                if (!pendingCs) pendingCs = m.createdAt;
                if (!pendingDes) pendingDes = m.createdAt;
            } else {
                if (m.sentById == null) continue; // auto-reply/sistem → tak dinilai
                const des = desById.get(m.sentById) ?? false;
                const pending = des ? pendingDes : pendingCs;
                if (pending) {
                    const sec = (m.createdAt.getTime() - pending.getTime()) / 1000;
                    if (sec >= 0) {
                        const arr = perAgent.get(m.sentById) ?? [];
                        arr.push(sec);
                        perAgent.set(m.sentById, arr);
                    }
                    if (des) pendingDes = null;
                    else pendingCs = null;
                }
            }
        }
        return perAgent;
    }

    /**
     * Metrik balas WA ringkas per userId untuk leaderboard CS (semua channel).
     * Atribusi ke WaMessage.sentById (yang benar-benar membalas).
     */
    async waCsMetricsByUser(
        fromDate: Date,
        toDate: Date,
        slaMinutes = 5,
    ): Promise<Map<number, { avgSec: number | null; responses: number; withinSlaPct: number | null; chatsHandled: number }>> {
        const slaSec = Math.max(1, slaMinutes) * 60;
        const perAgent = await this.frtByAgent(fromDate, toDate);

        // Jumlah percakapan berbeda yang dibalas tiap agen dalam periode ("chat ditangani").
        const convGroups = await this.prisma.waMessage.groupBy({
            by: ['sentById', 'conversationId'],
            where: { direction: 'OUTBOUND', sentById: { not: null }, createdAt: { gte: fromDate, lte: toDate } },
        });
        const chatsByUser = new Map<number, number>();
        for (const g of convGroups) {
            if (g.sentById != null) chatsByUser.set(g.sentById, (chatsByUser.get(g.sentById) ?? 0) + 1);
        }

        const out = new Map<number, { avgSec: number | null; responses: number; withinSlaPct: number | null; chatsHandled: number }>();
        const userIds = new Set<number>([...perAgent.keys(), ...chatsByUser.keys()]);
        for (const uid of userIds) {
            const arr = perAgent.get(uid) ?? [];
            const withinSla = arr.filter((s) => s <= slaSec).length;
            out.set(uid, {
                avgSec: arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null,
                responses: arr.length,
                withinSlaPct: arr.length ? Math.round((withinSla / arr.length) * 100) : null,
                chatsHandled: chatsByUser.get(uid) ?? 0,
            });
        }
        return out;
    }

    /** Rincian balasan pertama sebuah CS (drill-down leaderboard "Balas WA"). */
    async waCsDetail(
        userId: number,
        fromDate: Date,
        toDate: Date,
    ): Promise<Array<{ conversationId: number; contactName: string | null; waId: string; replyAt: Date; responseSec: number }>> {
        const msgs = await this.prisma.waMessage.findMany({
            where: { createdAt: { gte: fromDate, lte: toDate } },
            select: { conversationId: true, direction: true, sentById: true, createdAt: true },
            orderBy: [{ conversationId: 'asc' }, { id: 'asc' }],
        });
        // Konsisten dgn frtByAgent: hanya balasan dari GRUP yang sama (CS vs Desainer)
        // yang mengonsumsi pending. Balasan grup lain diabaikan (tak mereset).
        const desById = await this.isDesignerByUserId([userId, ...msgs.filter((m) => m.sentById != null).map((m) => m.sentById!)]);
        const targetIsDesigner = desById.get(userId) ?? false;

        const responses: Array<{ conversationId: number; replyAt: Date; responseSec: number }> = [];
        let curConv = -1;
        let pending: Date | null = null;
        for (const m of msgs) {
            if (m.conversationId !== curConv) {
                curConv = m.conversationId;
                pending = null;
            }
            if (m.direction === 'INBOUND') {
                if (!pending) pending = m.createdAt;
            } else {
                if (m.sentById == null) continue;
                if ((desById.get(m.sentById) ?? false) !== targetIsDesigner) continue; // grup beda → abaikan
                if (pending) {
                    if (m.sentById === userId) {
                        responses.push({
                            conversationId: m.conversationId,
                            replyAt: m.createdAt,
                            responseSec: Math.round((m.createdAt.getTime() - pending.getTime()) / 1000),
                        });
                    }
                    pending = null;
                }
            }
        }
        const convIds = [...new Set(responses.map((r) => r.conversationId))];
        const convs = convIds.length
            ? await this.prisma.waConversation.findMany({
                  where: { id: { in: convIds } },
                  select: { id: true, contact: { select: { profileName: true, waId: true } } },
              })
            : [];
        const byId = new Map(convs.map((c) => [c.id, c.contact]));
        return responses
            .map((r) => ({
                ...r,
                contactName: byId.get(r.conversationId)?.profileName ?? null,
                waId: byId.get(r.conversationId)?.waId ?? '',
            }))
            .sort((a, b) => b.replyAt.getTime() - a.replyAt.getTime());
    }

    async csBenchmark(opts: AnalyticsQuery) {
        const { fromDate, toDate } = this.range(opts.from, opts.to);
        const slaMinutes = Math.max(1, opts.slaMinutes ?? 5);
        const slaSec = slaMinutes * 60;
        const perAgent = await this.frtByAgent(fromDate, toDate, opts.channelId);

        const userIds = [...perAgent.keys()];
        const users = userIds.length
            ? await this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, role: { select: { name: true } } } })
            : [];
        const infoById = new Map(users.map((u) => [u.id, { name: u.name, roleName: u.role?.name ?? null }]));

        const median = (a: number[]) => {
            if (!a.length) return 0;
            const s = [...a].sort((x, y) => x - y);
            const mid = Math.floor(s.length / 2);
            return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
        };

        const agents = userIds
            .map((id) => {
                const arr = perAgent.get(id)!;
                const withinSla = arr.filter((s) => s <= slaSec).length;
                const info = infoById.get(id);
                return {
                    userId: id,
                    name: info?.name ?? `User ${id}`,
                    roleName: info?.roleName ?? null,
                    isDesigner: isDesignerRole(info?.roleName),
                    responses: arr.length,
                    avgSec: Math.round(arr.reduce((a, b) => a + b, 0) / arr.length),
                    medianSec: Math.round(median(arr)),
                    fastestSec: Math.round(Math.min(...arr)),
                    withinSlaPct: Math.round((withinSla / arr.length) * 100),
                };
            })
            .sort((a, b) => a.avgSec - b.avgSec); // tercepat di atas

        const overallFor = (ids: number[]) => {
            const arr = ids.flatMap((id) => perAgent.get(id) ?? []);
            return {
                responses: arr.length,
                avgSec: arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0,
                medianSec: Math.round(median(arr)),
            };
        };

        // Opsi 2: benchmark desainer DIPISAH dari CS (metrik CS tetap murni).
        const csAgents = agents.filter((a) => !a.isDesigner);
        const designerAgents = agents.filter((a) => a.isDesigner);
        return {
            agents, // semua (kompat lama)
            csAgents,
            designerAgents,
            overall: overallFor(csAgents.map((a) => a.userId)), // CS saja
            overallDesigner: overallFor(designerAgents.map((a) => a.userId)),
            slaMinutes,
        };
    }
}
