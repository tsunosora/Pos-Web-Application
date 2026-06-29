import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { KpiService } from '../crm/kpi/kpi.service';
import type { BranchContext } from '../common/branch-context.decorator';

const ROLES = ['CS', 'DESIGNER', 'OPERATOR'] as const;
type Role = typeof ROLES[number];
const METRIC_OF: Record<Role, string> = { CS: 'OMZET', DESIGNER: 'DESIGN_ACC', OPERATOR: 'NOTA' };

function monthRange(month: string): { startYmd: string; endYmd: string } {
    // month = 'YYYY-MM'
    if (!/^\d{4}-\d{2}$/.test(month || '')) throw new BadRequestException('Bulan tidak valid (format YYYY-MM)');
    const [y, m] = month.split('-').map(Number);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0); // hari terakhir bulan
    const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { startYmd: ymd(start), endYmd: ymd(end) };
}

@Injectable()
export class BonusService {
    constructor(private prisma: PrismaService, private kpi: KpiService) {}

    // ── Target (per cabang × posisi) ──────────────────────────────────────────
    listTargets(branchId?: number) {
        return (this.prisma as any).bonusTarget.findMany({
            where: branchId != null ? { branchId } : {},
            orderBy: [{ branchId: 'asc' }, { role: 'asc' }],
        });
    }

    async upsertTarget(data: any) {
        const branchId = Number(data.branchId);
        const role = String(data.role || '').toUpperCase();
        if (!Number.isFinite(branchId)) throw new BadRequestException('Cabang wajib diisi');
        if (!ROLES.includes(role as Role)) throw new BadRequestException('Posisi tidak valid');
        const num = (v: any, def = 0) => { const n = Number(v); return Number.isFinite(n) ? n : def; };
        const payload = {
            metric: METRIC_OF[role as Role],
            gajiPokok: num(data.gajiPokok, 1800000),
            bonusKualitas: num(data.bonusKualitas, 300000),
            bonusTim: num(data.bonusTim, 300000),
            bonusPribadi: num(data.bonusPribadi, 300000),
            targetTim: num(data.targetTim, 0),
            targetPribadi: num(data.targetPribadi, 0),
            periodTim: data.periodTim === 'HARIAN' ? 'HARIAN' : 'BULANAN',
            periodPribadi: data.periodPribadi === 'BULANAN' ? 'BULANAN' : 'HARIAN',
        };
        return (this.prisma as any).bonusTarget.upsert({
            where: { branchId_role: { branchId, role } },
            create: { branchId, role, ...payload },
            update: payload,
        });
    }

    // ── Adjustment (per karyawan × bulan) ─────────────────────────────────────
    async upsertAdjustment(data: any) {
        const branchId = Number(data.branchId);
        const role = String(data.role || '').toUpperCase();
        const employeeName = String(data.employeeName || '').trim();
        const periodMonth = String(data.periodMonth || '');
        if (!Number.isFinite(branchId) || !ROLES.includes(role as Role) || !employeeName || !/^\d{4}-\d{2}$/.test(periodMonth)) {
            throw new BadRequestException('Data penyesuaian tidak lengkap/valid');
        }
        const payload = {
            qualityEligible: data.qualityEligible === undefined ? true : !!data.qualityEligible,
            forfeited: !!data.forfeited,
            note: data.note?.trim() || null,
        };
        return (this.prisma as any).bonusAdjustment.upsert({
            where: { branchId_role_employeeName_periodMonth: { branchId, role, employeeName, periodMonth } },
            create: { branchId, role, employeeName, periodMonth, ...payload },
            update: payload,
        });
    }

    // ── Pencapaian + bonus (bulanan) ──────────────────────────────────────────
    async achievement(branchId: number, month: string) {
        if (!Number.isFinite(branchId)) throw new BadRequestException('Cabang wajib dipilih');
        const { startYmd, endYmd } = monthRange(month);
        const ctx: BranchContext = { branchId, isOwner: true, userBranchId: branchId, roleName: 'OWNER' } as any;
        const params: any = { period: 'custom', start: startYmd, end: endYmd };

        const [targetsRaw, adjRaw, report, designer] = await Promise.all([
            (this.prisma as any).bonusTarget.findMany({ where: { branchId } }),
            (this.prisma as any).bonusAdjustment.findMany({ where: { branchId, periodMonth: month } }),
            this.kpi.report(ctx, params),
            this.kpi.designerLeaderboard(ctx, params),
        ]);
        const targets = new Map<string, any>(targetsRaw.map((t: any) => [t.role, t]));
        const adjs = new Map<string, any>(adjRaw.map((a: any) => [`${a.role}|${a.employeeName}`, a]));

        // CS — omzet (nota lead closing + walk-in)
        const csEmp = (report.leaderboard || []).map((r: any) => ({ name: r.name, actual: Number(r.wonValue || 0) + Number(r.walkinValue || 0) }));
        // Designer — DesignAcc
        const dzEmp = (designer.leaderboard || []).map((r: any) => ({ name: r.name, actual: Number(r.acc || 0) }));
        // Operator — NOTA cabang (per kasir yang memproses nota)
        const start = new Date(`${startYmd}T00:00:00`);
        const end = new Date(`${endYmd}T23:59:59`);
        const txs: any[] = await (this.prisma as any).transaction.findMany({
            where: { branchId, createdAt: { gte: start, lte: end }, status: { not: 'FAILED' } },
            select: { cashierName: true },
        });
        const notaByOp = new Map<string, number>();
        for (const t of txs) { const n = (t.cashierName || '').trim(); if (!n) continue; notaByOp.set(n, (notaByOp.get(n) || 0) + 1); }
        // Reward lintas divisi by kerja nyata: operator = siapa pun yang memproses
        // nota cabang ini (dari cashierName). Tidak terikat daftar role tetap.
        const opEmp = Array.from(notaByOp, ([name, actual]) => ({ name, actual }));

        const buildRole = (role: Role, employees: { name: string; actual: number }[], teamActual: number) => {
            const t = targets.get(role) || null;
            const tTim = t ? Number(t.targetTim) : 0;
            const teamAchieved = !!t && tTim > 0 && teamActual >= tTim;
            const emps = employees
                .sort((a, b) => b.actual - a.actual)
                .map(e => {
                    const adj = adjs.get(`${role}|${e.name}`);
                    const qualityEligible = adj ? !!adj.qualityEligible : true;
                    const forfeited = adj ? !!adj.forfeited : false;
                    const tPribadi = t ? Number(t.targetPribadi) : 0;
                    const personalAchieved = !!t && tPribadi > 0 && e.actual >= tPribadi;
                    const bTim = (t && teamAchieved && !forfeited) ? Number(t.bonusTim) : 0;
                    const bPribadi = (t && personalAchieved && !forfeited) ? Number(t.bonusPribadi) : 0;
                    const bKualitas = (t && qualityEligible && !forfeited) ? Number(t.bonusKualitas) : 0;
                    return {
                        name: e.name, actual: e.actual, personalAchieved, qualityEligible, forfeited,
                        bonusTim: bTim, bonusPribadi: bPribadi, bonusKualitas: bKualitas,
                        total: bTim + bPribadi + bKualitas,
                        note: adj?.note ?? null,
                    };
                });
            return {
                role, metric: METRIC_OF[role], target: t, teamActual, teamAchieved,
                targetTim: tTim, targetPribadi: t ? Number(t.targetPribadi) : 0,
                employees: emps,
            };
        };

        return {
            branchId, month,
            roles: {
                CS: buildRole('CS', csEmp, csEmp.reduce((s, e) => s + e.actual, 0)),
                DESIGNER: buildRole('DESIGNER', dzEmp, dzEmp.reduce((s, e) => s + e.actual, 0)),
                OPERATOR: buildRole('OPERATOR', opEmp, txs.length),
            },
        };
    }
}
