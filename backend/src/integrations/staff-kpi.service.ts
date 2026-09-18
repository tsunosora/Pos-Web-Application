import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
    aggregateCsRatings,
    aggregateSales,
    aggregateTasks,
    normalizeName,
    type CsRatingKpi,
    type SalesKpi,
    type TaskKpi,
} from './staff-kpi.aggregate';

export type StaffKpiRow = {
    userId: number;
    name: string;
    branchId: number | null;
    isActive: boolean;
    csRating: CsRatingKpi;
    tasks: TaskKpi;
    /** Penjualan dicocokkan lewat NAMA kasir (tabel transaksi tak menyimpan userId). */
    sales: SalesKpi;
};

export type StaffKpiResponse = {
    from: string;
    to: string;
    branchId: number | null;
    staff: StaffKpiRow[];
    /**
     * Nama kasir di transaksi yang tak cocok dengan satu pun user — supaya pemanggil
     * tahu ada penjualan yang belum terhitung (mis. nama berubah / karyawan lama).
     */
    unmatchedCashierNames: string[];
};

const EMPTY_CS: CsRatingKpi = { count: 0, avgStars: 0, satisfiedCount: 0, satisfactionRate: 0 };
const EMPTY_TASK: TaskKpi = { assigned: 0, done: 0, late: 0, completionRate: 0 };
const EMPTY_SALES: SalesKpi = { transactions: 0, grandTotal: 0, averageTicket: 0 };

/** 'YYYY-MM-DD' → awal hari; string ISO penuh dipakai apa adanya. */
function dayStart(s: string): Date {
    return new Date(s.length <= 10 ? `${s}T00:00:00` : s);
}
/** 'YYYY-MM-DD' → akhir hari (23:59:59.999). */
function dayEnd(s: string): Date {
    return new Date(s.length <= 10 ? `${s}T23:59:59.999` : s);
}

/**
 * KPI karyawan untuk konsumsi aplikasi HR (RateMyStaff).
 *
 * Catatan identitas: rating pelanggan & papan tugas punya FK ke `User`, sedangkan
 * transaksi hanya menyimpan NAMA kasir. Karena itu penjualan dicocokkan lewat nama
 * yang dinormalisasi, dan nama yang tak cocok ikut dilaporkan.
 */
@Injectable()
export class StaffKpiService {
    constructor(private readonly prisma: PrismaService) { }

    /** Daftar staf untuk dropdown pemetaan di aplikasi pemanggil. */
    async staffList() {
        const users = await this.prisma.user.findMany({
            select: { id: true, name: true, email: true, branchId: true, isActive: true },
            orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
        });
        return users
            .filter((u) => u.name)
            .map((u) => ({
                userId: u.id,
                name: u.name as string,
                email: u.email,
                branchId: u.branchId,
                isActive: u.isActive,
            }));
    }

    async kpi(params: { from: string; to: string; branchId?: number | null }): Promise<StaffKpiResponse> {
        const from = dayStart(params.from);
        const to = dayEnd(params.to);
        const branchId = params.branchId ?? null;
        const branchFilter = branchId ? { branchId } : {};

        const [users, ratingRows, taskRows, salesGroups] = await Promise.all([
            this.prisma.user.findMany({
                select: { id: true, name: true, branchId: true, isActive: true },
                orderBy: { name: 'asc' },
            }),
            this.prisma.csRatingResponse.findMany({
                where: { submittedAt: { not: null, gte: from, lte: to }, ...branchFilter },
                select: { assignedCsId: true, stars: true, answer: true },
            }),
            this.prisma.taskItem.findMany({
                where: {
                    ...branchFilter,
                    // Tugas dihitung berdasarkan tenggatnya; tugas tanpa tenggat pakai tanggal dibuat.
                    OR: [
                        { dueDate: { gte: from, lte: to } },
                        { dueDate: null, createdAt: { gte: from, lte: to } },
                    ],
                },
                select: { assigneeId: true, status: true, dueDate: true, completedAt: true },
            }),
            this.prisma.transaction.groupBy({
                by: ['cashierName', 'checkoutCashierName'],
                where: { status: 'PAID', createdAt: { gte: from, lte: to }, ...branchFilter },
                _count: { _all: true },
                _sum: { grandTotal: true },
            }),
        ]);

        const csByUser = aggregateCsRatings(ratingRows);
        const taskByUser = aggregateTasks(taskRows, new Date());
        const salesByName = aggregateSales(
            salesGroups.map((g) => ({
                cashierName: g.cashierName,
                checkoutCashierName: g.checkoutCashierName,
                count: g._count._all,
                grandTotal: Number(g._sum.grandTotal ?? 0),
            })),
        );

        const named = users.filter((u) => u.name);
        const matchedNames = new Set<string>();

        const staff: StaffKpiRow[] = named.map((u) => {
            const key = normalizeName(u.name);
            const sales = salesByName.get(key);
            if (sales) matchedNames.add(key);
            return {
                userId: u.id,
                name: u.name as string,
                branchId: u.branchId,
                isActive: u.isActive,
                csRating: csByUser.get(u.id) ?? EMPTY_CS,
                tasks: taskByUser.get(u.id) ?? EMPTY_TASK,
                sales: sales ?? EMPTY_SALES,
            };
        });

        const unmatchedCashierNames = [...salesByName.keys()].filter((k) => !matchedNames.has(k));

        return {
            from: params.from,
            to: params.to,
            branchId,
            staff,
            unmatchedCashierNames,
        };
    }
}
