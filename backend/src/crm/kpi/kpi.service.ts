import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { branchWhere } from '../../common/branch-where.helper';
import type { BranchContext } from '../../common/branch-context.decorator';

export type KpiPeriod = 'today' | 'week' | 'month' | 'custom';

export interface KpiParams {
    period: KpiPeriod;
    start?: string;
    end?: string;
}

function resolvePeriod(p: KpiParams): { start: Date; end: Date } {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    let start = new Date();
    if (p.period === 'today') {
        start.setHours(0, 0, 0, 0);
    } else if (p.period === 'week') {
        start.setDate(start.getDate() - 6);
        start.setHours(0, 0, 0, 0);
    } else if (p.period === 'month') {
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
    } else {
        if (p.start) start = new Date(p.start);
        if (p.end) {
            const e = new Date(p.end);
            e.setHours(23, 59, 59, 999);
            return { start, end: e };
        }
    }
    return { start, end };
}

@Injectable()
export class KpiService {
    constructor(private readonly prisma: PrismaService) {}

    private get lead(): any { return (this.prisma as any).lead; }
    private get activity(): any { return (this.prisma as any).leadActivity; }
    private get fu(): any { return (this.prisma as any).followUp; }
    private get tx(): any { return (this.prisma as any).transaction; }

    async report(ctx: BranchContext, params: KpiParams) {
        try {
            return await this._report(ctx, params);
        } catch (err: any) {
            // eslint-disable-next-line no-console
            console.error('[kpi.report] failed:', err?.message, err?.stack);
            throw err;
        }
    }

    private async _report(ctx: BranchContext, params: KpiParams) {
        const { start, end } = resolvePeriod(params);
        const branchScope: any = branchWhere(ctx);

        // ── Response time avg ──────────────────────────────────────────────
        // Ambil leads in period + first non-FIRST_CONTACT activity per lead.
        // Tanpa `distinct` (kadang flaky di MySQL pakai Prisma) — kita pakai
        // sort + ambil first di JS.
        const leadsInPeriod: any[] = await this.lead.findMany({
            where: { ...branchScope, createdAt: { gte: start, lte: end } },
            select: { id: true, createdAt: true, status: true, source: true, sourceDetail: true, assignedToId: true, estimatedValue: true, convertedTransactionId: true },
        });
        const leadIds = leadsInPeriod.map(l => l.id);
        const allActivities: any[] = leadIds.length === 0 ? [] : await this.activity.findMany({
            where: {
                leadId: { in: leadIds },
                kind: { notIn: ['FIRST_CONTACT'] },
            },
            orderBy: { createdAt: 'asc' },
            select: { leadId: true, createdAt: true },
        });
        const firstActMap = new Map<number, Date>();
        for (const a of allActivities) {
            if (a.leadId == null) continue;
            if (!firstActMap.has(a.leadId)) firstActMap.set(a.leadId, a.createdAt);
        }

        let respSum = 0, respCount = 0;
        for (const l of leadsInPeriod) {
            const first = firstActMap.get(l.id);
            if (!first) continue;
            const diffMs = new Date(first).getTime() - new Date(l.createdAt).getTime();
            if (diffMs > 0) { respSum += diffMs; respCount++; }
        }
        const responseTimeAvgMs = respCount > 0 ? respSum / respCount : 0;
        const responseTimeAvgHrs = responseTimeAvgMs / (1000 * 60 * 60);

        // ── Closing rate & nilai lead ──────────────────────────────────────
        const totalLeads = leadsInPeriod.length;
        const closedWon = leadsInPeriod.filter(l => l.status === 'CLOSED_WON').length;
        const closedLost = leadsInPeriod.filter(l => l.status === 'CLOSED_LOST').length;
        const closingRate = totalLeads > 0 ? closedWon / totalLeads : 0;

        // Nilai estimasi yang lost & yang won (berdasarkan estimatedValue lead)
        const lostValue = leadsInPeriod
            .filter(l => l.status === 'CLOSED_LOST')
            .reduce((s, l) => s + (Number(l.estimatedValue) || 0), 0);
        const wonValue = leadsInPeriod
            .filter(l => l.status === 'CLOSED_WON')
            .reduce((s, l) => s + (Number(l.estimatedValue) || 0), 0);

        // ── Nilai akan datang (saldo outstanding dari tx PENDING/PARTIAL) ──
        // Lead CLOSED_WON yang punya convertedTransactionId → cek status tx-nya.
        // PENDING  : grandTotal full belum dibayar (COD / bayar nanti)
        // PARTIAL  : ada DP, sisanya (grandTotal - downPayment) masih piutang
        // PAID     : lunas → tidak masuk hitungan pending
        const convertedTxIds = leadsInPeriod
            .filter(l => l.status === 'CLOSED_WON' && l.convertedTransactionId)
            .map(l => Number(l.convertedTransactionId));

        const txPendingMap = new Map<number, number>(); // txId → saldo outstanding
        if (convertedTxIds.length > 0) {
            const txs: any[] = await this.tx.findMany({
                where: { id: { in: convertedTxIds }, status: { in: ['PENDING', 'PARTIAL'] } },
                select: { id: true, grandTotal: true, downPayment: true, status: true },
            });
            for (const t of txs) {
                const outstanding = Number(t.grandTotal) - Number(t.downPayment);
                txPendingMap.set(t.id, Math.max(0, outstanding));
            }
        }

        // Peta lead → saldo pending (0 kalau sudah lunas / tidak punya tx)
        const leadPendingMap = new Map<number, number>();
        for (const l of leadsInPeriod) {
            if (l.status !== 'CLOSED_WON' || !l.convertedTransactionId) continue;
            const pending = txPendingMap.get(Number(l.convertedTransactionId)) ?? 0;
            leadPendingMap.set(l.id, pending);
        }
        const totalPendingValue = Array.from(leadPendingMap.values()).reduce((s, v) => s + v, 0);

        // ── FU compliance ──────────────────────────────────────────────────
        // FU due in period: total = pending+done+skipped that dueDate in period.
        // compliance = done where doneAt <= dueDate + 1 day / total
        const fusInPeriod: any[] = await this.fu.findMany({
            where: { ...branchScope, dueDate: { gte: start, lte: end } },
            select: { id: true, status: true, dueDate: true, doneAt: true },
        });
        const totalFu = fusInPeriod.length;
        const compliant = fusInPeriod.filter(f => {
            if (f.status !== 'DONE' || !f.doneAt) return false;
            const grace = new Date(f.dueDate);
            grace.setDate(grace.getDate() + 1);
            return new Date(f.doneAt).getTime() <= grace.getTime();
        }).length;
        const fuComplianceRate = totalFu > 0 ? compliant / totalFu : 0;

        // ── Repeat order rate ──────────────────────────────────────────────
        // Customer with >=2 transactions in period / customer with >=1.
        // Pakai raw SQL supaya tidak gagal kalau Prisma client belum re-generate
        // pasca extension Customer (assigned_cs_id, dll).
        let customersWithOrder = 0;
        let customersRepeat = 0;
        try {
            const branchFilter = ctx.branchId != null ? `AND branch_id = ${Number(ctx.branchId)}` : '';
            const rows: any[] = await this.prisma.$queryRawUnsafe(`
                SELECT customer_id, COUNT(*) AS cnt
                FROM transactions
                WHERE customer_id IS NOT NULL
                  AND created_at BETWEEN ? AND ?
                  ${branchFilter}
                GROUP BY customer_id
            `, start, end);
            customersWithOrder = rows.length;
            customersRepeat = rows.filter((r: any) => Number(r.cnt) >= 2).length;
        } catch (e) {
            // Tabel transactions atau kolom branch_id mungkin beda di setup user
            // — fallback ke 0 supaya endpoint tidak crash.
            // eslint-disable-next-line no-console
            console.warn('[kpi] repeat-order calc fallback:', (e as Error).message);
        }
        const repeatOrderRate = customersWithOrder > 0 ? customersRepeat / customersWithOrder : 0;

        // ── Leads by source ───────────────────────────────────────────────
        // Untuk sumber CUSTOM, gunakan sourceDetail sebagai key supaya
        // setiap nama custom tampil terpisah di chart (bukan semua digabung jadi "Custom").
        const bySourceMap: Record<string, number> = {};
        for (const l of leadsInPeriod) {
            const key = l.source === 'CUSTOM' && l.sourceDetail
                ? l.sourceDetail
                : l.source;
            bySourceMap[key] = (bySourceMap[key] || 0) + 1;
        }
        const leadsBySource = Object.entries(bySourceMap).map(([source, count]) => ({ source, count }));

        // ── Leaderboard CS ────────────────────────────────────────────────
        // GROUP BY assignedToId untuk leadsInPeriod + match closed
        const byAssignee = new Map<number, { leadsHandled: number; dealsClosed: number; dealsLost: number; wonValue: number; lostValue: number; pendingValue: number; respSum: number; respCount: number }>();
        for (const l of leadsInPeriod) {
            if (!l.assignedToId) continue;
            const entry = byAssignee.get(l.assignedToId) || { leadsHandled: 0, dealsClosed: 0, dealsLost: 0, wonValue: 0, lostValue: 0, pendingValue: 0, respSum: 0, respCount: 0 };
            entry.leadsHandled++;
            if (l.status === 'CLOSED_WON') {
                entry.dealsClosed++;
                entry.wonValue += Number(l.estimatedValue) || 0;
                entry.pendingValue += leadPendingMap.get(l.id) ?? 0;
            }
            if (l.status === 'CLOSED_LOST') {
                entry.dealsLost++;
                entry.lostValue += Number(l.estimatedValue) || 0;
            }
            const first = firstActMap.get(l.id);
            if (first) {
                const diff = new Date(first).getTime() - new Date(l.createdAt).getTime();
                if (diff > 0) { entry.respSum += diff; entry.respCount++; }
            }
            byAssignee.set(l.assignedToId, entry);
        }
        const userIds = Array.from(byAssignee.keys());
        const users: any[] = userIds.length === 0 ? [] : await this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, email: true },
        });
        const userMap = new Map(users.map(u => [u.id, u]));
        const leaderboard = Array.from(byAssignee.entries())
            .map(([userId, stat]) => {
                const u = userMap.get(userId);
                return {
                    userId,
                    name: u?.name || u?.email || `User #${userId}`,
                    leadsHandled: stat.leadsHandled,
                    dealsClosed: stat.dealsClosed,
                    dealsLost: stat.dealsLost,
                    wonValue: stat.wonValue,
                    lostValue: stat.lostValue,
                    pendingValue: stat.pendingValue,
                    closingRate: stat.leadsHandled > 0 ? stat.dealsClosed / stat.leadsHandled : 0,
                    avgResponseHrs: stat.respCount > 0
                        ? stat.respSum / stat.respCount / (1000 * 60 * 60)
                        : null,
                };
            })
            .sort((a, b) => b.dealsClosed - a.dealsClosed || b.leadsHandled - a.leadsHandled);

        return {
            period: { start: start.toISOString(), end: end.toISOString() },
            totals: {
                totalLeads,
                closedWon,
                closedLost,
                wonValue,
                lostValue,
                pendingValue: totalPendingValue,
                customersWithOrder,
                customersRepeat,
                totalFu,
                compliant,
            },
            metrics: {
                responseTimeAvgHrs: Number(responseTimeAvgHrs.toFixed(2)),
                closingRate: Number(closingRate.toFixed(4)),
                fuComplianceRate: Number(fuComplianceRate.toFixed(4)),
                repeatOrderRate: Number(repeatOrderRate.toFixed(4)),
            },
            leadsBySource,
            leaderboard,
        };
    }
}
