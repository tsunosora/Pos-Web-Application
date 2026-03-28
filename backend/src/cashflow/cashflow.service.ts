import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CashflowType, Prisma } from '@prisma/client';

@Injectable()
export class CashflowService {
    constructor(private prisma: PrismaService) { }

    async create(data: Prisma.CashflowCreateInput) {
        return this.prisma.cashflow.create({ data });
    }

    async findAll(startDate?: string, endDate?: string) {
        const where: Prisma.CashflowWhereInput = {};
        if (startDate || endDate) {
            where.date = {};
            if (startDate) (where.date as any).gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                (where.date as any).lte = end;
            }
        }

        const [list, allForSummary] = await Promise.all([
            this.prisma.cashflow.findMany({
                where,
                orderBy: { date: 'desc' },
                include: { user: { select: { email: true, name: true } } },
            }),
            this.prisma.cashflow.findMany({ where }),
        ]);

        let totalIncome = 0;
        let totalExpense = 0;
        for (const cf of allForSummary) {
            const amount = parseFloat(cf.amount.toString());
            if (cf.type === CashflowType.INCOME) totalIncome += amount;
            else totalExpense += amount;
        }

        return {
            list,
            summary: { totalIncome, totalExpense, balance: totalIncome - totalExpense },
        };
    }

    async getMonthlyTrend() {
        const now = new Date();
        const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

        const cashflows = await this.prisma.cashflow.findMany({
            where: { date: { gte: sixMonthsAgo } },
            select: { type: true, amount: true, date: true },
        });

        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];
        return Array.from({ length: 6 }, (_, i) => {
            const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
            const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
            const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);

            const monthEntries = cashflows.filter(cf => cf.date >= monthStart && cf.date <= monthEnd);
            const income = monthEntries.filter(cf => cf.type === CashflowType.INCOME).reduce((s, cf) => s + parseFloat(cf.amount.toString()), 0);
            const expense = monthEntries.filter(cf => cf.type === CashflowType.EXPENSE).reduce((s, cf) => s + parseFloat(cf.amount.toString()), 0);

            return { month: monthNames[d.getMonth()], income, expense };
        });
    }

    async getCategoryBreakdown(startDate?: string, endDate?: string) {
        const where: Prisma.CashflowWhereInput = {};
        if (startDate || endDate) {
            where.date = {};
            if (startDate) (where.date as any).gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                (where.date as any).lte = end;
            }
        }

        const cashflows = await this.prisma.cashflow.findMany({
            where,
            select: { type: true, category: true, amount: true },
        });

        const incomeMap: Record<string, number> = {};
        const expenseMap: Record<string, number> = {};

        for (const cf of cashflows) {
            const amount = parseFloat(cf.amount.toString());
            if (cf.type === CashflowType.INCOME) {
                incomeMap[cf.category] = (incomeMap[cf.category] ?? 0) + amount;
            } else {
                expenseMap[cf.category] = (expenseMap[cf.category] ?? 0) + amount;
            }
        }

        return {
            income: Object.entries(incomeMap).map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total),
            expense: Object.entries(expenseMap).map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total),
        };
    }

    async update(id: number, data: { category?: string; amount?: number; note?: string; platformSource?: string | null }) {
        const entry = await this.prisma.cashflow.findUnique({ where: { id } });
        if (!entry) throw new NotFoundException('Cashflow entry not found');
        return this.prisma.cashflow.update({ where: { id }, data });
    }

    async getPlatformBreakdown(startDate?: string, endDate?: string) {
        const where: Prisma.CashflowWhereInput = { type: CashflowType.INCOME };
        if (startDate || endDate) {
            where.date = {};
            if (startDate) (where.date as any).gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                (where.date as any).lte = end;
            }
        }

        const cashflows = await (this.prisma as any).cashflow.findMany({
            where,
            select: { platformSource: true, amount: true },
        });

        const platformMap: Record<string, number> = {};
        for (const cf of cashflows) {
            const key = cf.platformSource ?? 'POS (Offline)';
            platformMap[key] = (platformMap[key] ?? 0) + parseFloat(cf.amount.toString());
        }

        return Object.entries(platformMap)
            .map(([platform, total]) => ({ platform, total }))
            .sort((a, b) => b.total - a.total);
    }

    async remove(id: number) {
        const entry = await this.prisma.cashflow.findUnique({ where: { id } });
        if (!entry) throw new NotFoundException('Cashflow entry not found');
        return this.prisma.cashflow.delete({ where: { id } });
    }
}
