import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CashflowType, Prisma } from '@prisma/client';
import { BranchContext } from '../common/branch-context.decorator';
import { branchWhere, requireBranch, assertBranchAccess } from '../common/branch-where.helper';

/**
 * Kategori internal untuk pembayaran antar cabang (Buku Titipan).
 * Di-exclude dari laporan konsolidasi "Semua Cabang" supaya tidak double-count
 * (INCOME & EXPENSE dicatat di dua cabang terpisah — kalau dijumlah bersama jadi noise).
 * Tetap dihitung kalau laporan difilter per-cabang, karena dari sudut pandang cabang
 * itu memang cashflow riil.
 */
const INTER_BRANCH_SETTLEMENT = 'INTER_BRANCH_SETTLEMENT';

/** Helper: kalau mode "Semua Cabang" (branchId null), tambahkan filter exclude kategori settlement. */
function consolidatedExclusion(ctx: BranchContext): Prisma.CashflowWhereInput {
    if (ctx.branchId == null) {
        return { NOT: { category: INTER_BRANCH_SETTLEMENT } } as any;
    }
    return {};
}

/** Terapkan filter rentang tanggal (inklusif sampai akhir hari endDate) ke where clause. */
function applyDateRange(where: Prisma.CashflowWhereInput, startDate?: string, endDate?: string) {
    if (!startDate && !endDate) return;
    where.date = {};
    if (startDate) (where.date as any).gte = new Date(startDate);
    if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        (where.date as any).lte = end;
    }
}

/**
 * Filter "rekening": bank tertentu (bankAccountId) ATAU metode pembayaran
 * (CASH/QRIS) yang tidak punya rekening bank. Dipakai untuk memantau saldo/arus
 * per kanal uang. bankAccountId menang bila keduanya terisi.
 */
function applyAccountFilter(where: Prisma.CashflowWhereInput, bankAccountId?: number, paymentMethod?: string) {
    if (bankAccountId != null) (where as any).bankAccountId = bankAccountId;
    else if (paymentMethod) (where as any).paymentMethod = paymentMethod;
}

/**
 * Ambil nomor invoice dari note cashflow. Cashflow hasil penjualan selalu ber-note
 * "...Invoice <nomor> ..." (lihat transactions.service). Nomor invoice unik & tanpa
 * spasi, jadi token setelah "Invoice " adalah kuncinya. null untuk entri non-order.
 */
function extractInvoice(note?: string | null): string | null {
    if (!note) return null;
    const m = note.match(/Invoice\s+(\S+)/);
    return m ? m[1] : null;
}

@Injectable()
export class CashflowService {
    constructor(private prisma: PrismaService) { }

    async create(
        data: Prisma.CashflowCreateInput & { bankAccountId?: number | null },
        branchCtx: BranchContext,
    ) {
        const branchId = requireBranch(branchCtx);
        const { bankAccountId, ...rest } = data as any;
        return this.prisma.cashflow.create({
            data: {
                ...rest,
                // Pakai relasi `branch: { connect }`, BUKAN `branchId` scalar. Controller
                // menyisipkan `user: { connect }` → Prisma masuk mode "checked" yang
                // menolak FK scalar (branchId), sehingga entry manual gagal 500.
                branch: { connect: { id: branchId } },
                ...(bankAccountId ? { bankAccount: { connect: { id: bankAccountId } } } : {}),
            } as any,
        });
    }

    async findAll(branchCtx: BranchContext, startDate?: string, endDate?: string, bankAccountId?: number, paymentMethod?: string, categoryId?: number) {
        const where: Prisma.CashflowWhereInput = { ...branchWhere(branchCtx), ...consolidatedExclusion(branchCtx) } as any;
        applyDateRange(where, startDate, endDate);
        applyAccountFilter(where, bankAccountId, paymentMethod);

        const rows = await this.prisma.cashflow.findMany({
            where,
            orderBy: { date: 'desc' },
            include: {
                user: { select: { email: true, name: true } },
                bankAccount: { select: { bankName: true, accountNumber: true } },
                branch: { select: { id: true, name: true, code: true } } as any,
            } as any,
        });

        // Lampirkan detail order (produk + kategori) untuk baris hasil penjualan.
        const orderMap = await this.buildOrderMap(rows);
        let list = rows.map((cf) => ({
            ...cf,
            order: orderMap.get(extractInvoice((cf as any).note) ?? '') ?? null,
        }));

        // Filter per kategori produk: hanya order yang memuat item kategori tsb.
        if (categoryId != null) {
            list = list.filter((cf) => cf.order?.items?.some((it: any) => it.categoryId === categoryId));
        }

        let totalIncome = 0;
        let totalExpense = 0;
        for (const cf of list) {
            const amount = parseFloat(cf.amount.toString());
            if (cf.type === CashflowType.INCOME) totalIncome += amount;
            else totalExpense += amount;
        }

        return {
            list,
            summary: { totalIncome, totalExpense, balance: totalIncome - totalExpense },
        };
    }

    /** Bangun peta invoiceNumber → detail order (item + kategori) untuk sekumpulan cashflow. */
    private async buildOrderMap(cashflows: { note?: string | null }[]) {
        const invoices = [...new Set(cashflows.map((cf) => extractInvoice(cf.note)).filter(Boolean))] as string[];
        const map = new Map<string, any>();
        if (!invoices.length) return map;

        const txs = await this.prisma.transaction.findMany({
            where: { invoiceNumber: { in: invoices } },
            select: {
                invoiceNumber: true,
                customerName: true,
                items: {
                    select: {
                        quantity: true,
                        priceAtTime: true,
                        areaCm2: true,
                        unitType: true,
                        note: true,
                        productVariant: {
                            select: {
                                variantName: true,
                                product: { select: { name: true, categoryId: true, category: { select: { name: true } } } },
                            },
                        },
                    },
                },
            },
        });

        for (const t of txs) {
            map.set(t.invoiceNumber, {
                invoiceNumber: t.invoiceNumber,
                customerName: t.customerName,
                items: t.items.map((it: any) => {
                    const price = Number(it.priceAtTime);
                    const areaM2 = it.areaCm2 ? Number(it.areaCm2) / 10000 : null;
                    const lineTotal = areaM2 != null ? price * areaM2 : price * it.quantity;
                    const p = it.productVariant?.product;
                    return {
                        name: it.productVariant?.variantName
                            ? `${p?.name} - ${it.productVariant.variantName}`
                            : (p?.name || it.note || 'Item custom'),
                        quantity: it.quantity,
                        unitType: it.unitType,
                        areaM2,
                        lineTotal,
                        categoryId: p?.categoryId ?? null,
                        categoryName: p?.category?.name ?? 'Tanpa Kategori',
                    };
                }),
            });
        }
        return map;
    }

    async getMonthlyTrend(branchCtx: BranchContext) {
        const now = new Date();
        const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

        const cashflows = await this.prisma.cashflow.findMany({
            where: { date: { gte: sixMonthsAgo }, ...branchWhere(branchCtx), ...consolidatedExclusion(branchCtx) } as any,
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

    async getCategoryBreakdown(branchCtx: BranchContext, startDate?: string, endDate?: string, bankAccountId?: number, paymentMethod?: string) {
        const where: Prisma.CashflowWhereInput = { ...branchWhere(branchCtx), ...consolidatedExclusion(branchCtx) } as any;
        applyDateRange(where, startDate, endDate);
        applyAccountFilter(where, bankAccountId, paymentMethod);

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

    async update(id: number, data: {
        category?: string;
        amount?: number;
        note?: string;
        platformSource?: string | null;
        paymentMethod?: string | null;
        bankAccountId?: number | null;
    }, branchCtx: BranchContext) {
        const entry = await this.prisma.cashflow.findUnique({ where: { id } });
        if (!entry) throw new NotFoundException('Cashflow entry not found');
        assertBranchAccess(branchCtx, (entry as any).branchId ?? null);
        return this.prisma.cashflow.update({ where: { id }, data: data as any });
    }

    /**
     * Ringkasan per "kanal uang" pada periode:
     *  - Rekening bank: saldo tercatat (currentBalance, hasil rekonsiliasi tutup
     *    shift) + masuk/keluar dari cashflow ber-rekening (umumnya BANK_TRANSFER).
     *  - Tunai (CASH) & QRIS: kanal tanpa rekening bank → tidak punya saldo
     *    tercatat (currentBalance null), hanya arus masuk/keluar periode dari
     *    cashflow ber-paymentMethod tsb. Memberi owner pantauan menyeluruh
     *    "BCA saldonya X; Tunai periode ini masuk Y keluar Z; QRIS ...".
     */
    async getBankAccountsSummary(branchCtx: BranchContext, startDate?: string, endDate?: string) {
        const accounts = await this.prisma.bankAccount.findMany({
            where: { isActive: true, ...branchWhere(branchCtx) } as any,
            orderBy: [{ bankName: 'asc' }, { id: 'asc' }],
        });

        const where: Prisma.CashflowWhereInput = {
            ...branchWhere(branchCtx),
            ...consolidatedExclusion(branchCtx),
        } as any;
        applyDateRange(where, startDate, endDate);

        const cashflows = await this.prisma.cashflow.findMany({
            where,
            select: { bankAccountId: true, paymentMethod: true, type: true, amount: true },
        });

        const blank = () => ({ in: 0, out: 0, count: 0 });
        const bankAgg: Record<number, { in: number; out: number; count: number }> = {};
        const methodAgg: Record<string, { in: number; out: number; count: number }> = { CASH: blank(), QRIS: blank() };
        for (const cf of cashflows) {
            const amount = parseFloat(cf.amount.toString());
            const isIncome = cf.type === CashflowType.INCOME;
            if (cf.bankAccountId != null) {
                const id = cf.bankAccountId;
                if (!bankAgg[id]) bankAgg[id] = blank();
                isIncome ? (bankAgg[id].in += amount) : (bankAgg[id].out += amount);
                bankAgg[id].count += 1;
            } else if (cf.paymentMethod && methodAgg[cf.paymentMethod]) {
                const m = methodAgg[cf.paymentMethod];
                isIncome ? (m.in += amount) : (m.out += amount);
                m.count += 1;
            }
        }

        const bankRows = accounts.map((a) => {
            const m = bankAgg[a.id] || blank();
            return {
                kind: 'BANK' as const,
                key: `bank:${a.id}`,
                id: a.id,
                bankName: a.bankName,
                accountNumber: a.accountNumber,
                accountOwner: a.accountOwner,
                currentBalance: parseFloat(a.currentBalance.toString()) as number | null,
                periodIn: m.in,
                periodOut: m.out,
                periodNet: m.in - m.out,
                movementCount: m.count,
            };
        });

        const methodRow = (kind: 'CASH' | 'QRIS', label: string) => {
            const m = methodAgg[kind];
            return {
                kind,
                key: kind.toLowerCase(),
                id: null,
                bankName: label,
                accountNumber: '',
                accountOwner: '',
                currentBalance: null as number | null, // tanpa saldo tercatat
                periodIn: m.in,
                periodOut: m.out,
                periodNet: m.in - m.out,
                movementCount: m.count,
            };
        };

        return [...bankRows, methodRow('CASH', 'Tunai'), methodRow('QRIS', 'QRIS')];
    }

    async getPlatformBreakdown(branchCtx: BranchContext, startDate?: string, endDate?: string) {
        const where: Prisma.CashflowWhereInput = { type: CashflowType.INCOME, ...branchWhere(branchCtx), ...consolidatedExclusion(branchCtx) } as any;
        applyDateRange(where, startDate, endDate);

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

    async remove(id: number, branchCtx: BranchContext) {
        const entry = await this.prisma.cashflow.findUnique({ where: { id } });
        if (!entry) throw new NotFoundException('Cashflow entry not found');
        assertBranchAccess(branchCtx, (entry as any).branchId ?? null);
        return this.prisma.cashflow.delete({ where: { id } });
    }
}
