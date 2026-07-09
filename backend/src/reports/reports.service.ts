import { Injectable, Logger, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DiscordService } from '../discord/discord.service';
import { CloseShiftDto, StructuredExpenses, AdditionalIncomeItem, PaymentExchangeItem } from './reports.controller';
import { BranchContext } from '../common/branch-context.decorator';
import { branchWhere, requireBranch } from '../common/branch-where.helper';

export type FinanceTimeframe = 'day' | 'week' | 'month' | 'year';

export interface FinanceCandle {
    time: string;           // 'YYYY-MM-DD'
    open: number; high: number; low: number; close: number;
    income: number; expense: number; net: number;
    volume: number; txCount: number;
}

/**
 * Kategori cashflow non-operasional (mutasi treasury/internal) yang DIKECUALIKAN dari
 * semua agregasi laba/operasional (tutup buku, candlestick, breakdown, anomali, jurnal).
 * - INTER_BRANCH_SETTLEMENT: settlement cetak titipan antar cabang.
 * - PENGOSONGAN_SALDO: setor saldo tutup buku ke pusat.
 * - MODAL_MASUK: pemberian modal awal dari pusat.
 */
const NON_OPERATIONAL_CATS = ['INTER_BRANCH_SETTLEMENT', 'PENGOSONGAN_SALDO', 'MODAL_MASUK'];

@Injectable()
export class ReportsService {
    private readonly logger = new Logger(ReportsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly discord: DiscordService,
    ) { }

    async getStaffList() {
        const users = await this.prisma.user.findMany({
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
        });
        return users.filter(u => u.name); // hanya yang punya nama
    }

    async getProfitReport(branchCtx: BranchContext, startDate?: string, endDate?: string) {
        const whereClause: any = { status: 'PAID', ...branchWhere(branchCtx) }; // TransactionStatus.PAID
        if (startDate && endDate) {
            whereClause.createdAt = {
                gte: new Date(startDate),
                lte: new Date(endDate + 'T23:59:59.999Z')
            };
        }

        const transactions = await this.prisma.transaction.findMany({
            where: whereClause,
            include: {
                items: {
                    include: {
                        productVariant: {
                            include: {
                                product: {
                                    include: {
                                        unit: true,
                                        category: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        let totalRevenue = 0; // grandTotal or just subtotal after discount
        let totalHpp = 0;
        const itemMap: Record<number, any> = {};

        for (const t of transactions) {
            // Net revenue from products (totalAmount - discount). Ignore tax in profit calculation.
            const netRevenue = Number(t.totalAmount) - Number(t.discount || 0);
            totalRevenue += netRevenue;

            // Calculate HPP from items
            let trxHpp = 0;
            for (const item of t.items) {
                const hpp = Number(item.hppAtTime || 0);
                const isArea = !!item.areaCm2;
                const qty = item.quantity;

                let itemHpp = 0;
                let itemRevenue = 0;
                let areaM2 = 0;

                if (isArea) {
                    // Area based: priceAtTime & HPP are both per-m², multiply by area.
                    // areaCm2 tersimpan PER-SATU-KEPING → kalikan pcs utk luas total,
                    // supaya revenue/HPP per-item tidak undercount saat pcs > 1.
                    const pcs = Math.max(1, Number(item.pcs) || 1);
                    areaM2 = Number(item.areaCm2) / 10000 * pcs;
                    itemHpp = hpp * areaM2;
                    itemRevenue = Number(item.priceAtTime) * areaM2;
                } else {
                    // Unit based
                    itemHpp = hpp * qty;
                    itemRevenue = Number(item.priceAtTime) * qty;
                }

                trxHpp += itemHpp;

                // Group by variant — skip custom items (no productVariantId)
                if (!item.productVariantId) continue;
                if (!itemMap[item.productVariantId]) {
                    const pv = (item as any).productVariant;
                    const p = pv?.product;
                    itemMap[item.productVariantId] = {
                        productVariantId: item.productVariantId,
                        sku: pv?.sku || 'Unknown',
                        name: pv?.variantName ? `${p?.name} - ${pv?.variantName}` : (p?.name || 'Unknown Product'),
                        // Kategori produk = "mesin" (Cetak A3+, Outdoor, dll) untuk
                        // pengelompokan laba per mesin. Produk tanpa kategori → "Tanpa Kategori".
                        categoryId: p?.categoryId ?? null,
                        categoryName: p?.category?.name || 'Tanpa Kategori',
                        qty: 0,           // jumlah unit terjual (UNIT) atau jumlah pesanan (AREA)
                        totalAreaM2: 0,  // total luas dalam m² (AREA_BASED saja)
                        isAreaBased: isArea,
                        unit: p?.unit?.name || 'pcs',
                        revenue: 0,
                        totalHpp: 0,
                        grossProfit: 0
                    };
                }

                if (isArea) {
                    itemMap[item.productVariantId].qty += 1;          // hitung jumlah pesanan
                    itemMap[item.productVariantId].totalAreaM2 += areaM2; // akumulasi total m²
                } else {
                    itemMap[item.productVariantId].qty += qty;
                }
                itemMap[item.productVariantId].revenue += itemRevenue;
                itemMap[item.productVariantId].totalHpp += itemHpp;
            }
            totalHpp += trxHpp;
        }

        const grossProfit = totalRevenue - totalHpp;
        const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

        // Calculate gross profit per item
        const items = Object.values(itemMap).map((it: any) => ({
            ...it,
            grossProfit: it.revenue - it.totalHpp
        }));

        // Sort items by highest revenue
        items.sort((a, b) => b.revenue - a.revenue);

        // Agregasi laba per "mesin" (kategori produk). Owner bisa lihat tiap
        // mesin (Cetak A3+, Outdoor, dll) sudah menghasilkan berapa.
        const catMap: Record<string, any> = {};
        for (const it of items) {
            const key = String(it.categoryId ?? 'none');
            if (!catMap[key]) {
                catMap[key] = {
                    categoryId: it.categoryId ?? null,
                    categoryName: it.categoryName,
                    productCount: 0,
                    revenue: 0,
                    totalHpp: 0,
                    grossProfit: 0,
                };
            }
            catMap[key].productCount += 1;
            catMap[key].revenue += it.revenue;
            catMap[key].totalHpp += it.totalHpp;
            catMap[key].grossProfit += it.grossProfit;
        }
        const categories = Object.values(catMap).map((c: any) => ({
            ...c,
            profitMargin: c.revenue > 0 ? Number(((c.grossProfit / c.revenue) * 100).toFixed(2)) : 0,
        }));
        categories.sort((a, b) => b.grossProfit - a.grossProfit);

        return {
            totalRevenue,
            totalHpp,
            grossProfit,
            profitMargin: Number(profitMargin.toFixed(2)),
            transactionCount: transactions.length,
            items,
            categories
        };
    }

    /**
     * Laporan TUTUP BUKU bulanan (basis kas) — meniru format manual Voliko:
     * pendapatan per kanal (Cash/QRIS/Bank) × pekan, pengeluaran per kategori ×
     * pekan + rincian, laba (uang masuk − uang keluar), dan piutang outstanding.
     * Sumber: Cashflow (INCOME/EXPENSE) + Transaction (PENDING/PARTIAL).
     */
    async monthlyClosing(branchCtx: BranchContext, year: number, month: number) {
        const bw = branchWhere(branchCtx);
        const start = new Date(year, month - 1, 1, 0, 0, 0);
        const end = new Date(year, month, 0, 23, 59, 59, 999); // hari terakhir bulan
        const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        const monthLabel = MONTHS[month - 1] || String(month);

        let branchName: string | null = null;
        if (branchCtx.branchId != null) {
            const b = await this.prisma.companyBranch.findUnique({ where: { id: branchCtx.branchId }, select: { name: true } });
            branchName = b?.name ?? null;
        }
        const banks = await this.prisma.bankAccount.findMany({ select: { id: true, bankName: true } });
        const bankNameById = new Map(banks.map(b => [b.id, b.bankName]));

        // Pekan 7-harian penuh: 1–7, 8–14, 15–21, 22–28, 29–akhir (lebih enak dibaca).
        const lastDay = end.getDate();
        const pad = (n: number) => String(n).padStart(2, '0');
        const weekRanges: number[][] = [];
        for (let s = 1; s <= lastDay; s += 7) weekRanges.push([s, Math.min(s + 6, lastDay)]);
        const weekCount = weekRanges.length;
        const weekOf = (d: Date) => Math.min(weekCount - 1, Math.floor((d.getDate() - 1) / 7));
        const weekLabels = weekRanges.map(([a, b]) => `${pad(a)}–${pad(b)} ${monthLabel} ${year}`);

        const cfs: any[] = await this.prisma.cashflow.findMany({
            where: { ...bw, category: { notIn: NON_OPERATIONAL_CATS }, date: { gte: start, lte: end } } as any,
            select: { type: true, category: true, amount: true, date: true, paymentMethod: true, bankAccountId: true, note: true },
            orderBy: { date: 'asc' },
        });
        const channelOf = (cf: any): string => {
            if (cf.paymentMethod === 'CASH') return 'Cash';
            if (cf.paymentMethod === 'QRIS') return 'QRIS';
            if (cf.bankAccountId) return bankNameById.get(cf.bankAccountId) || 'Transfer';
            if (cf.paymentMethod === 'BANK_TRANSFER') return 'Transfer';
            return 'Lainnya';
        };

        // Pendapatan per kanal × pekan
        const incomeMap = new Map<string, number[]>();
        let incomeTotal = 0;
        // Pengeluaran per kategori × pekan + rincian
        const expenseMap = new Map<string, number[]>();
        const detailMap = new Map<string, any[]>();
        let expenseTotal = 0;
        for (const cf of cfs) {
            const amt = Number(cf.amount) || 0;
            const wi = weekOf(cf.date);
            if (cf.type === 'INCOME') {
                const ch = channelOf(cf);
                if (!incomeMap.has(ch)) incomeMap.set(ch, new Array(weekCount).fill(0));
                incomeMap.get(ch)![wi] += amt;
                incomeTotal += amt;
            } else {
                const cat = cf.category || 'Lainnya';
                if (!expenseMap.has(cat)) { expenseMap.set(cat, new Array(weekCount).fill(0)); detailMap.set(cat, []); }
                expenseMap.get(cat)![wi] += amt;
                expenseTotal += amt;
                detailMap.get(cat)!.push({ date: cf.date, keterangan: cf.note || cf.category, channel: channelOf(cf), amount: amt });
            }
        }
        const chRank = (c: string) => (c === 'Cash' ? 0 : c === 'QRIS' ? 2 : c === 'Lainnya' ? 3 : 1);
        const incomeChannels = Array.from(incomeMap.entries())
            .map(([channel, weeks]) => ({ channel, weeks, total: weeks.reduce((s, x) => s + x, 0) }))
            .sort((a, b) => chRank(a.channel) - chRank(b.channel) || b.total - a.total);
        const expenseCategories = Array.from(expenseMap.entries())
            .map(([category, weeks]) => ({ category, weeks, total: weeks.reduce((s, x) => s + x, 0), details: detailMap.get(category) || [] }))
            .sort((a, b) => b.total - a.total);

        // Piutang outstanding (PENDING/PARTIAL) per akhir bulan
        const txs: any[] = await this.prisma.transaction.findMany({
            where: { ...bw, status: { in: ['PENDING', 'PARTIAL'] as any }, createdAt: { lte: end } } as any,
            select: {
                invoiceNumber: true, customerName: true, grandTotal: true, downPayment: true, status: true, createdAt: true,
                items: { select: { customName: true, productVariant: { select: { product: { select: { name: true } } } } } },
            },
            orderBy: { createdAt: 'asc' },
        });
        const receivables = txs.map(t => {
            const names = Array.from(new Set((t.items || []).map((it: any) => it.productVariant?.product?.name || it.customName).filter(Boolean)));
            const jumlah = Number(t.grandTotal) || 0;
            const dp = Number(t.downPayment) || 0;
            return { name: t.customerName || '-', keterangan: names.join(', ') || '-', jumlah, dp, sisa: Math.max(0, jumlah - dp), status: 'Blm Lunas', invoice: t.invoiceNumber };
        }).filter(r => r.sisa > 0);

        return {
            period: { year, month, monthLabel, start: start.toISOString(), end: end.toISOString(), weekLabels },
            branchName,
            income: { channels: incomeChannels, total: incomeTotal },
            expense: { categories: expenseCategories, total: expenseTotal },
            profit: incomeTotal - expenseTotal,
            receivables: {
                rows: receivables,
                gross: receivables.reduce((s, r) => s + r.jumlah, 0),
                dp: receivables.reduce((s, r) => s + r.dp, 0),
                sisa: receivables.reduce((s, r) => s + r.sisa, 0),
            },
        };
    }

    async calculateCurrentShiftExpectations(branchCtx?: BranchContext) {
        const bw = branchCtx ? branchWhere(branchCtx) : {};
        const lastShift = await (this.prisma as any).shiftReport.findFirst({
            where: { ...bw },
            orderBy: { closedAt: 'desc' },
        });

        // Gunakan openedAt hanya untuk display, bukan untuk filter cashflow
        let openedAt = lastShift?.closedAt;
        if (!openedAt) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            openedAt = today;
        }

        // Filter berdasarkan shiftReportId = null (belum di-tag ke shift manapun)
        // dan excludeFromShift = false (cashflow retroaktif/lupa tidak ikut dihitung)
        const cashflows: any[] = await (this.prisma as any).cashflow.findMany({
            where: { shiftReportId: null, excludeFromShift: false, ...bw },
            include: { bankAccount: true },
        });

        // Gross Incomes
        let grossCash = 0;
        let grossQris = 0;
        let grossTransfer = 0;
        const grossBankIncomes: Record<string, number> = {};

        // Expenses
        let expensesTotal = 0;
        const shiftExpenses: any[] = [];
        const expenseTotalsByBank: Record<string, number> = {};
        let cashExpenseTotal = 0;

        for (const cf of cashflows) {
            const amount = Number(cf.amount);

            if (cf.type === 'INCOME') {
                if (cf.paymentMethod === 'CASH') grossCash += amount;
                else if (cf.paymentMethod === 'QRIS') grossQris += amount;
                else if (cf.paymentMethod === 'BANK_TRANSFER') {
                    grossTransfer += amount;
                    if (cf.bankAccount) {
                        const bName = cf.bankAccount.bankName;
                        grossBankIncomes[bName] = (grossBankIncomes[bName] || 0) + amount;
                    }
                }
            } else if (cf.type === 'EXPENSE') {
                expensesTotal += amount;

                const bName = cf.bankAccount?.bankName || '';

                shiftExpenses.push({
                    method: cf.paymentMethod,
                    bankName: bName,
                    note: cf.note || cf.category || 'Pengeluaran',
                    amount: amount
                });

                if (cf.paymentMethod === 'CASH') {
                    cashExpenseTotal += amount;
                } else if (cf.paymentMethod === 'BANK_TRANSFER' && bName) {
                    expenseTotalsByBank[bName] = (expenseTotalsByBank[bName] || 0) + amount;
                }
            }
        }

        const activeBanks: any[] = await this.prisma.bankAccount.findMany({
            where: { isActive: true, ...bw } as any,
        });

        const systemBankBalances: Record<string, number> = {};

        for (const b of activeBanks) {
            const bName = b.bankName;
            const startBalance = Number(b.currentBalance || 0);
            const income = grossBankIncomes[bName] || 0;
            const expense = expenseTotalsByBank[bName] || 0;
            systemBankBalances[bName] = startBalance + income - expense;
        }

        const expectedCash = grossCash - cashExpenseTotal;
        const expectedQris = grossQris;
        const expectedTransfer = grossTransfer - (expensesTotal - cashExpenseTotal);

        return {
            openedAt,
            expectedCash,
            expectedQris,
            expectedTransfer,
            grossCash,
            grossQris,
            grossTransfer,
            grossBankIncomes,
            expensesTotal,
            shiftExpenses,
            systemBankBalances,
        };
    }

    async closeShift(dto: CloseShiftDto, proofImages: string[], branchCtx: BranchContext) {
        const branchId = requireBranch(branchCtx);
        const bw = { branchId };
        const cashDifference = dto.actualCash - dto.expectedCash;
        const qrisDifference = dto.actualQris - dto.expectedQris;
        const transferDifference = dto.actualTransfer - dto.expectedTransfer;

        const activeBanks: any[] = await this.prisma.bankAccount.findMany({
            where: { isActive: true, ...bw } as any,
        });

        // Hitung total pengeluaran dari structuredExpenses jika ada
        let expensesTotalCalc = dto.expensesTotal;
        if (dto.structuredExpenses) {
            let total = 0;
            for (const items of Object.values(dto.structuredExpenses)) {
                for (const item of items) {
                    total += Number(item.amount);
                }
            }
            expensesTotalCalc = total;
        }

        // Hitung data shift SEBELUM menyimpan, agar lastShift.closedAt belum berubah
        const settings = await this.prisma.storeSettings.findFirst();
        const expectedData = await this.calculateCurrentShiftExpectations(branchCtx);

        const shift: any = await (this.prisma as any).shiftReport.create({
            data: {
                branchId,
                adminName: dto.adminName || 'Kasir',
                shiftName: dto.shiftName || 'Shift Siang',
                openedAt: dto.openedAt,
                closedAt: dto.closedAt,

                expectedCash: dto.expectedCash,
                actualCash: dto.actualCash,
                cashDifference,

                expectedQris: dto.expectedQris,
                actualQris: dto.actualQris,
                qrisDifference,

                expectedTransfer: dto.expectedTransfer,
                actualTransfer: dto.actualTransfer,
                transferDifference,

                expensesTotal: expensesTotalCalc,
                notes: dto.notes,
                proofImages: proofImages,

                expectedBankBalances: dto.expectedBankBalances || {},
                actualBankBalances: dto.actualBankBalances || {},
                realBankBalances: dto.realBankBalances || {},
                shiftExpenses: dto.shiftExpenses || [],
                structuredExpenses: dto.structuredExpenses || {},
                kasbon: dto.kasbon || [],
                setorKas: dto.setorKas || [],
                tarikTunai: dto.tarikTunai || [],
                tukarTransferKeCash: dto.tukarTransferKeCash || 0,
                additionalIncomes: dto.additionalIncomes || [],
                paymentExchanges: dto.paymentExchanges || [],
            },
        });

        const shiftId: number = shift.id;

        // Tag semua cashflow yang belum di-assign ke shift manapun (shiftReportId = null)
        // ke shift ini — mencegah data shift ini bocor ke shift berikutnya
        // excludeFromShift = true → biarkan, tidak di-tag ke shift manapun
        await this.prisma.cashflow.updateMany({
            where: { shiftReportId: null, excludeFromShift: false, ...bw } as any,
            data: { shiftReportId: shiftId },
        });

        // Buat Cashflow INCOME untuk pemasukan tambahan eksternal
        // → di-tag shiftReportId agar tidak masuk shift berikutnya
        if (dto.additionalIncomes && dto.additionalIncomes.length > 0) {
            for (const income of dto.additionalIncomes) {
                if (!income.bankName || !income.amount || income.amount <= 0) continue;
                const bank = activeBanks.find((b: any) => b.bankName === income.bankName);
                if (!bank) continue;
                await (this.prisma as any).cashflow.create({
                    data: {
                        type: 'INCOME',
                        category: 'Pemasukan Tambahan',
                        amount: income.amount,
                        note: income.description || 'Pemasukan Eksternal',
                        paymentMethod: 'BANK_TRANSFER',
                        bankAccountId: bank.id,
                        date: new Date(dto.closedAt),
                        shiftReportId: shiftId,
                        branchId,
                    },
                });
            }
        }

        // Buat Cashflow EXPENSE dari pengeluaran shift (structuredExpenses)
        // → di-tag shiftReportId agar tidak masuk shift berikutnya
        if (dto.structuredExpenses) {
            for (const [method, items] of Object.entries(dto.structuredExpenses)) {
                if (!items || (items as any[]).length === 0) continue;
                const isCash = method === 'CASH';
                const isQris = method === 'QRIS';
                const bank = (isCash || isQris) ? null : activeBanks.find((b: any) => b.bankName === method);
                for (const item of items as any[]) {
                    if (!item.name || !item.amount || Number(item.amount) <= 0) continue;
                    await (this.prisma as any).cashflow.create({
                        data: {
                            type: 'EXPENSE',
                            category: item.name,
                            amount: Number(item.amount),
                            note: `Pengeluaran shift ${dto.shiftName || ''} — ${item.name}`,
                            paymentMethod: isCash ? 'CASH' : isQris ? 'QRIS' : 'BANK_TRANSFER',
                            bankAccountId: bank?.id || null,
                            date: new Date(dto.closedAt),
                            shiftReportId: shiftId,
                            branchId,
                        },
                    });
                }
            }
        }

        // Buat Cashflow EXPENSE untuk kasbon dari Kas Toko
        // → di-tag shiftReportId agar tidak masuk shift berikutnya
        if (dto.kasbon && dto.kasbon.length > 0) {
            for (const k of dto.kasbon) {
                if (!k.name || !k.amount || Number(k.amount) <= 0) continue;
                if (k.source && k.source !== 'Kas Toko') continue;
                await (this.prisma as any).cashflow.create({
                    data: {
                        type: 'EXPENSE',
                        category: 'Kasbon Karyawan',
                        amount: Number(k.amount),
                        note: `Kasbon: ${k.name} — shift ${dto.shiftName || ''}`,
                        paymentMethod: 'CASH',
                        bankAccountId: null,
                        date: new Date(dto.closedAt),
                        shiftReportId: shiftId,
                        branchId,
                    },
                });
            }
        }

        // Update saldo bank dengan SALDO REAL yang diinput kasir
        const balancesToUpdate = dto.realBankBalances && Object.keys(dto.realBankBalances).length > 0
            ? dto.realBankBalances
            : dto.actualBankBalances;

        if (balancesToUpdate) {
            for (const bank of activeBanks) {
                const actual = balancesToUpdate[bank.bankName];
                if (actual !== undefined && actual !== null) {
                    await (this.prisma as any).bankAccount.update({
                        where: { id: bank.id },
                        data: { currentBalance: Number(actual) }
                    });
                }
            }
        }

        const reportMsg = this.formatWhatsappMessage(
            shift,
            expectedData,
            dto.actualBankBalances || {},
            dto.realBankBalances || {},
            dto.actualQris,
            dto.structuredExpenses,
            settings,
            dto.kasbon || [],
            dto.setorKas || [],
            dto.tarikTunai || [],
            dto.reportDate,
            dto.tukarTransferKeCash || 0,
            dto.additionalIncomes || [],
            dto.paymentExchanges || [],
        );

        // Simpan pesan laporan sebagai backup log agar bisa di-resend jika gagal
        await (this.prisma as any).shiftReport.update({
            where: { id: shiftId },
            data: { whatsappMessage: reportMsg },
        });

        // Laporan harian via Discord (#keuangan): embed ringkasan → laporan lengkap + foto bukti.
        // Berurutan dalam satu rantai supaya ringkasan selalu tampil duluan.
        (async () => {
            await this.discord.notifyShiftRecap({
                shiftName: dto.shiftName || undefined,
                cashierName: dto.adminName || undefined,
                branchLabel: (settings as any)?.storeName || undefined,
                branchId,
                omzet: dto.actualCash + dto.actualQris + dto.actualTransfer,
                cash: dto.actualCash,
                qris: dto.actualQris,
                transfer: dto.actualTransfer,
                notes: dto.notes || undefined,
            });
            await this.discord.notifyShiftReport(reportMsg, proofImages, branchId);
        })().catch((err) => {
            this.logger.error('Background Discord report send failed', err);
        });

        return { success: true, message: 'Shift closed successfully.', data: shift };
    }

    async getShiftHistory(branchCtx: BranchContext, page = 1, limit = 20) {
        const bw = branchWhere(branchCtx);
        const skip = (page - 1) * limit;
        const [list, total] = await Promise.all([
            (this.prisma as any).shiftReport.findMany({
                where: { ...bw } as any,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
                select: {
                    id: true,
                    adminName: true,
                    shiftName: true,
                    openedAt: true,
                    closedAt: true,
                    expectedCash: true,
                    actualCash: true,
                    cashDifference: true,
                    expectedQris: true,
                    actualQris: true,
                    qrisDifference: true,
                    expectedTransfer: true,
                    actualTransfer: true,
                    transferDifference: true,
                    expensesTotal: true,
                    notes: true,
                    proofImages: true,
                    whatsappMessage: true,
                    structuredExpenses: true,
                    kasbon: true,
                    additionalIncomes: true,
                    setorKas: true,
                    tarikTunai: true,
                    tukarTransferKeCash: true,
                    paymentExchanges: true,
                    actualBankBalances: true,
                    realBankBalances: true,
                    amendedAt: true,
                    amendNote: true,
                    createdAt: true,
                },
            }),
            (this.prisma as any).shiftReport.count({ where: { ...bw } as any }),
        ]);
        return { list, total, page, limit };
    }

    async resendShiftReport(id: number, proofImages?: string[]) {
        const shift: any = await (this.prisma as any).shiftReport.findUnique({ where: { id } });
        if (!shift) throw new Error(`Shift report #${id} tidak ditemukan`);

        const msg = shift.whatsappMessage;
        if (!msg) throw new Error(`Backup pesan laporan untuk shift #${id} belum tersedia`);

        const images: string[] = proofImages ?? (Array.isArray(shift.proofImages) ? shift.proofImages : []);
        const ok = await this.discord.notifyShiftReport(msg, images, (shift as any).branchId ?? null);
        if (!ok) {
            throw new Error('Gagal kirim ke Discord. Pastikan notifikasi Discord aktif dan webhook channel Keuangan terisi (Settings → Discord).');
        }
        return { success: true, message: 'Laporan shift berhasil dikirim ulang ke Discord.' };
    }

    async amendShiftReport(id: number, dto: {
        actualCash?: number;
        actualQris?: number;
        actualTransfer?: number;
        structuredExpenses?: any;
        kasbon?: any;
        setorKas?: any;
        tarikTunai?: any;
        additionalIncomes?: any;
        tukarTransferKeCash?: number;
        paymentExchanges?: any;
        actualBankBalances?: any;
        realBankBalances?: any;
        notes?: string;
        amendNote: string; // wajib — catatan alasan koreksi
    }) {
        const shift: any = await (this.prisma as any).shiftReport.findUnique({ where: { id } });
        if (!shift) throw new Error(`Shift report #${id} tidak ditemukan`);

        const actualCash = dto.actualCash !== undefined ? dto.actualCash : Number(shift.actualCash);
        const actualQris = dto.actualQris !== undefined ? dto.actualQris : Number(shift.actualQris);
        const actualTransfer = dto.actualTransfer !== undefined ? dto.actualTransfer : Number(shift.actualTransfer);

        const cashDifference = actualCash - Number(shift.expectedCash);
        const qrisDifference = actualQris - Number(shift.expectedQris);
        const transferDifference = actualTransfer - Number(shift.expectedTransfer);

        // Rekalkulasi expensesTotal dari structuredExpenses jika diberikan
        let expensesTotal: number | undefined;
        if (dto.structuredExpenses !== undefined) {
            const expenses = dto.structuredExpenses as Record<string, { name: string; amount: number }[]>;
            expensesTotal = Object.values(expenses).flat().reduce((s, e) => s + Number(e.amount || 0), 0);
        }

        // Resolve nilai final: dto menang atas data tersimpan
        const finalStructuredExpenses = dto.structuredExpenses !== undefined ? dto.structuredExpenses : shift.structuredExpenses;
        const finalKasbon = dto.kasbon !== undefined ? dto.kasbon : (shift.kasbon || []);
        const finalSetorKas = dto.setorKas !== undefined ? dto.setorKas : (shift.setorKas || []);
        const finalTarikTunai = dto.tarikTunai !== undefined ? dto.tarikTunai : (shift.tarikTunai || []);
        const finalAdditionalIncomes = dto.additionalIncomes !== undefined ? dto.additionalIncomes : (shift.additionalIncomes || []);
        const finalPaymentExchanges = dto.paymentExchanges !== undefined ? dto.paymentExchanges : (shift.paymentExchanges || []);
        const finalTukarTransfer = dto.tukarTransferKeCash !== undefined ? dto.tukarTransferKeCash : Number(shift.tukarTransferKeCash || 0);
        const finalActualBankBalances = dto.actualBankBalances !== undefined ? dto.actualBankBalances : (shift.actualBankBalances || {});
        const finalRealBankBalances = dto.realBankBalances !== undefined ? dto.realBankBalances : (shift.realBankBalances || {});

        // Rekonstruksi grossCash dari data ASLI yang tersimpan sebelum amendment.
        // expectedCash yang tersimpan adalah adjustedExpectedCash:
        //   adjustedExpected = grossCash - structuredCashExp - setorKas + tarikTunai + tukarTransfer - kasbonToko + exchangeCashEffect
        // Sehingga: grossCash = expectedCash + cashExp + setorKas - tarikTunai - tukarTransfer + kasbonToko - exchangeCashEffect
        const origCashExp = ((shift.structuredExpenses as any)?.['CASH'] || []).reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
        const origSetorKasTotal = (shift.setorKas || []).reduce((s: number, k: any) => s + Number(k.amount || 0), 0);
        const origTarikTunaiTotal = (shift.tarikTunai || []).reduce((s: number, k: any) => s + Number(k.amount || 0), 0);
        const origTukarTransfer = Number(shift.tukarTransferKeCash || 0);
        const origKasbonToko = (shift.kasbon || [])
            .filter((k: any) => !k.source || k.source === 'Kas Toko')
            .reduce((s: number, k: any) => s + Number(k.amount || 0), 0);
        const origExchangeCashEffect = (shift.paymentExchanges || []).reduce((sum: number, ex: any) => {
            if (ex.to === 'CASH') return sum + Number(ex.amount || 0);
            if (ex.from === 'CASH') return sum - Number(ex.amount || 0);
            return sum;
        }, 0);
        const reconstructedGrossCash = Number(shift.expectedCash)
            + origCashExp + origSetorKasTotal - origTarikTunaiTotal
            - origTukarTransfer + origKasbonToko - origExchangeCashEffect;

        // Bangun objek exp yang dibutuhkan formatWhatsappMessage dari data tersimpan
        const reconstructedExp = {
            grossCash: Math.max(0, reconstructedGrossCash),
            grossQris: Number(shift.expectedQris || 0),
            grossBankIncomes: shift.expectedBankBalances || {},
            systemBankBalances: shift.expectedBankBalances || {},
            shiftExpenses: Array.isArray(shift.shiftExpenses) ? shift.shiftExpenses : [],
        };

        // Shift object dengan actual terbaru untuk dipakai formatWhatsappMessage
        const shiftForMsg = { ...shift, actualCash, actualQris, actualTransfer };

        // Generate ulang pesan WhatsApp dengan semua data yang sudah dikoreksi
        const settings = await this.prisma.storeSettings.findFirst();
        let newWhatsappMessage = this.formatWhatsappMessage(
            shiftForMsg,
            reconstructedExp,
            finalActualBankBalances,
            finalRealBankBalances,
            actualQris,
            finalStructuredExpenses,
            settings,
            finalKasbon,
            finalSetorKas,
            finalTarikTunai,
            undefined, // reportDate — gunakan closedAt dari shift
            finalTukarTransfer,
            finalAdditionalIncomes,
            finalPaymentExchanges,
        );

        // Tambahkan tanda bahwa laporan sudah dikoreksi di akhir pesan
        const amendedAtStr = new Date().toLocaleString('id-ID', {
            day: 'numeric', month: 'long', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });
        newWhatsappMessage += `\n\n⚠️ *LAPORAN DIKOREKSI*\nDikoreksi pada: ${amendedAtStr}\nAlasan: ${dto.amendNote}`;

        const updated = await (this.prisma as any).shiftReport.update({
            where: { id },
            data: {
                actualCash,
                actualQris,
                actualTransfer,
                cashDifference,
                qrisDifference,
                transferDifference,
                whatsappMessage: newWhatsappMessage,
                ...(expensesTotal !== undefined && { expensesTotal }),
                ...(dto.structuredExpenses !== undefined && { structuredExpenses: dto.structuredExpenses }),
                ...(dto.kasbon !== undefined && { kasbon: dto.kasbon }),
                ...(dto.setorKas !== undefined && { setorKas: dto.setorKas }),
                ...(dto.tarikTunai !== undefined && { tarikTunai: dto.tarikTunai }),
                ...(dto.additionalIncomes !== undefined && { additionalIncomes: dto.additionalIncomes }),
                ...(dto.tukarTransferKeCash !== undefined && { tukarTransferKeCash: dto.tukarTransferKeCash }),
                ...(dto.paymentExchanges !== undefined && { paymentExchanges: dto.paymentExchanges }),
                ...(dto.actualBankBalances !== undefined && { actualBankBalances: dto.actualBankBalances }),
                ...(dto.realBankBalances !== undefined && { realBankBalances: dto.realBankBalances }),
                ...(dto.notes !== undefined && { notes: dto.notes }),
                amendedAt: new Date(),
                amendNote: dto.amendNote,
            },
        });

        return { success: true, message: 'Laporan shift berhasil dikoreksi.', data: updated };
    }

    private formatWhatsappMessage(
        shift: any,
        exp: any,
        actualBankBalances: Record<string, number>,  // Saldo Laporan mBanking
        realBankBalances: Record<string, number>,    // Saldo Real di Bank
        actualQris: number,
        structuredExpenses: StructuredExpenses | undefined,
        settings?: any,
        kasbon: { name: string; amount: number; source?: string }[] = [],
        setorKas: { bankName: string; amount: number }[] = [],
        tarikTunai: { bankName: string; amount: number }[] = [],
        reportDate?: string,
        tukarTransferKeCash: number = 0,
        additionalIncomes: AdditionalIncomeItem[] = [],
        paymentExchanges: PaymentExchangeItem[] = [],
    ): string {
        const formatRp = (val: number) => {
            return 'Rp ' + new Intl.NumberFormat('id-ID', {
                minimumFractionDigits: 0
            }).format(val || 0);
        };

        const storeName = settings?.storeName || 'TOKO';
        const dateBase = reportDate ? new Date(reportDate + 'T12:00:00') : new Date(shift.closedAt || shift.openedAt);
        const dateStr = dateBase.toLocaleDateString('id-ID', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        });

        let msg = `${storeName.toUpperCase()}\n`;
        msg += `CS: ${shift.adminName}\n\n`;
        msg += `Penerimaan ${dateStr} || ${shift.shiftName}\n\n`;

        // Pendapatan: Cash dulu, lalu Bank Transfer per rekening, lalu QRIS, lalu Total
        msg += `Cash : ${formatRp(exp.grossCash)}\n`;

        let totalIncome = exp.grossCash + exp.grossQris;
        for (const [bank, amount] of Object.entries(exp.grossBankIncomes as Record<string, number>)) {
            msg += `${bank.toUpperCase()} : ${formatRp(amount)}\n`;
            totalIncome += amount;
        }

        msg += `QRIS : ${formatRp(exp.grossQris)}\n`;

        // Pemasukan Tambahan Eksternal
        if (additionalIncomes && additionalIncomes.length > 0) {
            msg += `\nPemasukan Tambahan :\n`;
            additionalIncomes.forEach((inc, idx) => {
                const label = inc.description ? `${inc.bankName.toUpperCase()} (${inc.description})` : inc.bankName.toUpperCase();
                msg += `${idx + 1}. ${label} : ${formatRp(inc.amount)}\n`;
                totalIncome += inc.amount;
            });
        }

        msg += `\nTotal : ${formatRp(totalIncome)}\n\n`;

        msg += `===============================\n`;

        // Pengeluaran Terstruktur
        if (structuredExpenses && Object.keys(structuredExpenses).length > 0) {
            // Pengeluaran per bank terlebih dahulu
            for (const [method, items] of Object.entries(structuredExpenses)) {
                if (method === 'CASH') continue; // cash belakangan
                if (!items || items.length === 0) continue;
                msg += `\nPengeluaran ${method.toUpperCase()} :\n`;
                items.forEach((item, idx) => {
                    msg += `${idx + 1}. ${item.name} : ${formatRp(item.amount)}\n`;
                });
            }
            // Pengeluaran Cash
            const cashItems = structuredExpenses['CASH'];
            if (cashItems && cashItems.length > 0) {
                msg += `\nPengeluaran Cash :\n`;
                cashItems.forEach((item, idx) => {
                    msg += `${idx + 1}. ${item.name} : ${formatRp(item.amount)}\n`;
                });
            }
        } else {
            // Fallback ke shiftExpenses lama (dari cashflow sistem)
            const cashExps = (exp.shiftExpenses || []).filter((e: any) => e.method === 'CASH');
            if (cashExps.length > 0) {
                msg += `\nPengeluaran Cash :\n`;
                cashExps.forEach((e: any, idx: number) => {
                    msg += `${idx + 1}. ${e.note} : ${formatRp(e.amount)}\n`;
                });
            }
        }

        // Setor Kas ke Rekening
        if (setorKas && setorKas.length > 0) {
            msg += `\n💸 Setor Kas ke Rekening :\n`;
            setorKas.forEach(s => {
                msg += `  ${s.bankName.toUpperCase()} : ${formatRp(s.amount)}\n`;
            });
        }

        // Tarik Tunai dari Rekening
        if (tarikTunai && tarikTunai.length > 0) {
            msg += `\n🏧 Tarik Tunai dari Rekening :\n`;
            tarikTunai.forEach(s => {
                msg += `  ${s.bankName.toUpperCase()} : ${formatRp(s.amount)}\n`;
            });
        }

        // Tukar Transfer ke Cash
        if (tukarTransferKeCash > 0) {
            msg += `\n💱 Tukar Transfer ke Cash : ${formatRp(tukarTransferKeCash)}\n`;
        }

        // Pertukaran Metode Pembayaran & Titip Transfer
        if (paymentExchanges && paymentExchanges.length > 0) {
            msg += `\n🔄 Pertukaran Metode Pembayaran :\n`;
            paymentExchanges.forEach((ex, idx) => {
                const label = ex.description ? ` (${ex.description})` : '';
                msg += `  ${idx + 1}. ${ex.from} → ${ex.to}${label} : ${formatRp(ex.amount)}\n`;
            });
        }

        // Kasbon Karyawan
        if (kasbon && kasbon.length > 0) {
            const kasbonToko = kasbon.filter(k => !k.source || k.source === 'Kas Toko');
            const kasbonLuar = kasbon.filter(k => k.source && k.source !== 'Kas Toko');

            if (kasbonToko.length > 0) {
                msg += `\n👤 Kasbon Karyawan (Kas Toko) :\n`;
                kasbonToko.forEach((k, i) => {
                    msg += `  ${i + 1}. ${k.name} : ${formatRp(k.amount)}\n`;
                });
                if (kasbonToko.length > 1) {
                    const total = kasbonToko.reduce((sum, k) => sum + k.amount, 0);
                    msg += `  Total : ${formatRp(total)}\n`;
                }
            }

            if (kasbonLuar.length > 0) {
                msg += `\n👤 Kasbon Karyawan (Di luar kas toko) :\n`;
                kasbonLuar.forEach((k, i) => {
                    msg += `  ${i + 1}. ${k.name} : ${formatRp(k.amount)} [${k.source}]\n`;
                });
                if (kasbonLuar.length > 1) {
                    const total = kasbonLuar.reduce((sum, k) => sum + k.amount, 0);
                    msg += `  Total : ${formatRp(total)}\n`;
                }
            }
        }

        const totalQrisExpenses = structuredExpenses?.['QRIS']
            ? structuredExpenses['QRIS'].reduce((s, i) => s + Number(i.amount), 0)
            : 0;
        const exchangeQrisEffect = paymentExchanges.reduce((sum, ex) => {
            if (ex.to === 'QRIS') return sum + ex.amount;
            if (ex.from === 'QRIS') return sum - ex.amount;
            return sum;
        }, 0);
        const saldoQrisBersih = Number(shift.actualQris) - totalQrisExpenses + exchangeQrisEffect;

        msg += `\nCash real : ${formatRp(Number(shift.actualCash))}\n`;
        if (totalQrisExpenses > 0 || exchangeQrisEffect !== 0) {
            msg += `QRIS real : ${formatRp(Number(shift.actualQris))}\n`;
            msg += `Saldo QRIS Bersih : ${formatRp(saldoQrisBersih)}\n`;
        }
        msg += `===============================\n\n`;

        // Adjust target saldo rekening dengan pemasukan tambahan + pertukaran metode
        const adjustedSystemBankBalances: Record<string, number> = { ...exp.systemBankBalances };
        for (const inc of additionalIncomes) {
            if (inc.bankName && inc.amount > 0) {
                adjustedSystemBankBalances[inc.bankName] =
                    (adjustedSystemBankBalances[inc.bankName] || 0) + inc.amount;
            }
        }
        for (const ex of paymentExchanges) {
            if (ex.amount > 0) {
                if (adjustedSystemBankBalances[ex.from] !== undefined) {
                    adjustedSystemBankBalances[ex.from] -= ex.amount;
                }
                if (adjustedSystemBankBalances[ex.to] !== undefined) {
                    adjustedSystemBankBalances[ex.to] += ex.amount;
                }
            }
        }

        // Saldo Laporan mBanking (yang kasir lihat di layar)
        for (const bank of Object.keys(adjustedSystemBankBalances)) {
            const laporan = actualBankBalances[bank] || 0;
            msg += `Saldo ${bank.toUpperCase()} pada saat laporan : ${formatRp(laporan)}\n`;
        }
        msg += `Saldo QRIS pada saat laporan : ${formatRp(actualQris)}\n\n`;

        // Saldo Real di Bank (yang benar-benar tercatat)
        const hasRealBalances = Object.keys(realBankBalances).length > 0;
        for (const bank of Object.keys(adjustedSystemBankBalances)) {
            const real = hasRealBalances
                ? (realBankBalances[bank] || 0)
                : (actualBankBalances[bank] || 0);
            msg += `${bank.toUpperCase()} : ${formatRp(real)}\n`;
        }
        msg += `QRIS : ${formatRp(actualQris)}\n`;

        return msg;
    }

    // ==================== ANALISA KEUANGAN (candlestick / equity curve) ====================

    /** Key bucket per timeframe (string 'YYYY-MM-DD'). week = Senin minggu itu. */
    private financeBucketKey(d: Date, tf: FinanceTimeframe): string {
        const pad = (n: number) => String(n).padStart(2, '0');
        const y = d.getFullYear();
        if (tf === 'year') return `${y}-01-01`;
        if (tf === 'month') return `${y}-${pad(d.getMonth() + 1)}-01`;
        if (tf === 'week') {
            const dt = new Date(y, d.getMonth(), d.getDate());
            const dow = (dt.getDay() + 6) % 7; // 0 = Senin
            dt.setDate(dt.getDate() - dow);
            return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
        }
        return `${y}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }

    /** Jam dinding — dipisah agar bisa di-mock di test (proyeksi beban tetap bergantung "hari ini"). */
    protected now(): Date {
        return new Date();
    }

    /**
     * Proyeksi Beban Tetap sebagai event pengeluaran, HANYA untuk tanggal jatuh tempo
     * yang belum lewat (hari kalender > hari ini).
     *
     * Alasan (basis KAS): gaji/angsuran/sewa yang sudah dibayar SUDAH tercatat sebagai
     * Cashflow EXPENSE nyata. Kalau disuntik lagi dari FixedExpense untuk bulan yang sudah
     * berjalan → (1) double-count saldo, (2) menulis ulang riwayat dengan beban TERBARU
     * (mis. beban 10 karyawan menimpa bulan lalu yang cuma 5 karyawan). FixedExpense murni
     * template/anggaran ke depan, jadi hanya sah untuk memproyeksikan tanggal yang belum tiba.
     */
    private async projectedFixedExpenses(bw: any, start: Date, end: Date) {
        const now = this.now();
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        const fes: any[] = await this.prisma.fixedExpense.findMany({ where: { ...bw, isActive: true } as any });
        const out: { date: Date; amount: number; category: string; name: string; id: number }[] = [];
        const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
        while (cursor <= end) {
            const y = cursor.getFullYear(), m = cursor.getMonth();
            const lastDay = new Date(y, m + 1, 0).getDate();
            for (const fe of fes) {
                const day = Math.min(Math.max(1, fe.dueDay || 1), lastDay);
                const d = new Date(y, m, day, 12, 0, 0);
                if (d >= start && d <= end && d > todayEnd) {
                    out.push({ date: d, amount: Number(fe.amount || 0), category: fe.category || 'LAINNYA', name: fe.name, id: fe.id });
                }
            }
            cursor.setMonth(cursor.getMonth() + 1);
        }
        return out;
    }

    /**
     * Candlestick equity-curve: "harga" = saldo kas berjalan (running sum INCOME-EXPENSE).
     * Basis KAS NYATA (Cashflow) untuk periode yang sudah berjalan; FixedExpense hanya
     * memproyeksikan tanggal jatuh tempo yang belum tiba. Exclude INTER_BRANCH_SETTLEMENT.
     */
    async getFinanceCandles(
        branchCtx: BranchContext,
        timeframe: FinanceTimeframe,
        startDate: string,
        endDate: string,
        includeFixed = true,
    ) {
        if (!branchCtx.isOwner) throw new ForbiddenException('Analisa keuangan hanya untuk owner.');
        const bw = branchWhere(branchCtx);
        const start = new Date(`${startDate}T00:00:00`);
        const end = new Date(`${endDate}T23:59:59.999`);
        const num = (v: any) => Number(v || 0);

        // 1) Opening balance = net cashflow sebelum start
        const priorGroups: any[] = await (this.prisma.cashflow.groupBy as any)({
            by: ['type'],
            _sum: { amount: true },
            where: { ...bw, category: { notIn: NON_OPERATIONAL_CATS }, date: { lt: start } } as any,
        });
        let opening = 0;
        for (const g of priorGroups) opening += g.type === 'INCOME' ? num(g._sum.amount) : -num(g._sum.amount);

        // 2) Event dalam range
        type Ev = { date: Date; income: number; expense: number; isTx: boolean };
        const events: Ev[] = [];
        const rows: any[] = await this.prisma.cashflow.findMany({
            where: { ...bw, category: { notIn: NON_OPERATIONAL_CATS }, date: { gte: start, lte: end } } as any,
            select: { type: true, amount: true, date: true },
            orderBy: { date: 'asc' },
        });
        for (const r of rows) {
            const amt = num(r.amount);
            events.push({ date: r.date, income: r.type === 'INCOME' ? amt : 0, expense: r.type === 'EXPENSE' ? amt : 0, isTx: true });
        }

        // 3) FixedExpense — HANYA proyeksi tanggal jatuh tempo yang belum tiba (masa lalu = kas nyata)
        if (includeFixed) {
            for (const fe of await this.projectedFixedExpenses(bw, start, end)) {
                events.push({ date: fe.date, income: 0, expense: fe.amount, isTx: false });
            }
        }

        // 4) Urut kronologis lalu bucket → OHLC equity
        events.sort((a, b) => a.date.getTime() - b.date.getTime());
        const buckets = new Map<string, FinanceCandle>();
        let running = opening;
        for (const ev of events) {
            const key = this.financeBucketKey(ev.date, timeframe);
            let c = buckets.get(key);
            if (!c) {
                c = { time: key, open: running, high: running, low: running, close: running, income: 0, expense: 0, net: 0, volume: 0, txCount: 0 };
                buckets.set(key, c);
            }
            running += ev.income - ev.expense;
            c.close = running;
            c.high = Math.max(c.high, running);
            c.low = Math.min(c.low, running);
            c.income += ev.income;
            c.expense += ev.expense;
            c.volume += ev.income;
            if (ev.isTx && ev.income > 0) c.txCount += 1;
        }
        const round2 = (n: number) => Math.round(n * 100) / 100;
        const candles = Array.from(buckets.values())
            .sort((a, b) => (a.time < b.time ? -1 : 1))
            .map((c) => ({
                ...c,
                open: round2(c.open), high: round2(c.high), low: round2(c.low), close: round2(c.close),
                income: round2(c.income), expense: round2(c.expense), net: round2(c.income - c.expense), volume: round2(c.volume),
            }));

        const totalIncome = candles.reduce((s, c) => s + c.income, 0);
        const totalExpense = candles.reduce((s, c) => s + c.expense, 0);
        const closingBalance = round2(running);
        const changePct = opening !== 0 ? round2(((closingBalance - opening) / Math.abs(opening)) * 100) : 0;
        const trend = closingBalance > opening ? 'bullish' : closingBalance < opening ? 'bearish' : 'flat';

        return {
            timeframe,
            period: { startDate, endDate },
            summary: {
                openingBalance: round2(opening),
                closingBalance,
                totalIncome: round2(totalIncome),
                totalExpense: round2(totalExpense),
                net: round2(totalIncome - totalExpense),
                changePct,
                trend,
            },
            candles,
        };
    }

    /** Heatmap traffic: hari & jam paling sepi/rame (basis Transaction PAID). */
    async getFinanceHeatmap(branchCtx: BranchContext, startDate: string, endDate: string) {
        if (!branchCtx.isOwner) throw new ForbiddenException('Analisa keuangan hanya untuk owner.');
        const bw = branchWhere(branchCtx);
        const start = new Date(`${startDate}T00:00:00`);
        const end = new Date(`${endDate}T23:59:59.999`);
        const txs: any[] = await this.prisma.transaction.findMany({
            where: { ...bw, status: 'PAID', createdAt: { gte: start, lte: end } } as any,
            select: { grandTotal: true, createdAt: true },
        });
        const DOW = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const byDay = DOW.map((label, dow) => ({ dow, label, count: 0, revenue: 0 }));
        const byHour = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0, revenue: 0 }));
        const grid: Record<string, { count: number; revenue: number }> = {};
        for (const t of txs) {
            const d: Date = t.createdAt;
            const dow = d.getDay(); const hour = d.getHours(); const amt = Number(t.grandTotal || 0);
            byDay[dow].count++; byDay[dow].revenue += amt;
            byHour[hour].count++; byHour[hour].revenue += amt;
            const k = `${dow}-${hour}`;
            grid[k] = grid[k] || { count: 0, revenue: 0 };
            grid[k].count++; grid[k].revenue += amt;
        }
        const activeDays = byDay.filter((d) => d.count > 0);
        const busiestDay = activeDays.reduce((a, b) => (b.count > a.count ? b : a), byDay[0]);
        const quietestDay = activeDays.length ? activeDays.reduce((a, b) => (b.count < a.count ? b : a)) : null;
        return {
            period: { startDate, endDate },
            byDayOfWeek: byDay,
            byHour,
            grid: Object.entries(grid).map(([k, v]) => { const [dow, hour] = k.split('-').map(Number); return { dow, hour, ...v }; }),
            busiestDay,
            quietestDay,
        };
    }

    /** Jurnal harian keuangan: event uang terurut waktu + running balance, dikelompokkan per hari. */
    async getFinanceJournal(branchCtx: BranchContext, startDate: string, endDate: string, includeFixed = true) {
        if (!branchCtx.isOwner) throw new ForbiddenException('Analisa keuangan hanya untuk owner.');
        const bw = branchWhere(branchCtx);
        const start = new Date(`${startDate}T00:00:00`);
        const end = new Date(`${endDate}T23:59:59.999`);
        const num = (v: any) => Number(v || 0);
        const round2 = (n: number) => Math.round(n * 100) / 100;

        const prior: any[] = await (this.prisma.cashflow.groupBy as any)({
            by: ['type'], _sum: { amount: true },
            where: { ...bw, category: { notIn: NON_OPERATIONAL_CATS }, date: { lt: start } } as any,
        });
        let running = 0;
        for (const g of prior) running += g.type === 'INCOME' ? num(g._sum.amount) : -num(g._sum.amount);
        const openingBalance = running;

        type Entry = { date: Date; type: 'INCOME' | 'EXPENSE'; source: 'cashflow' | 'fixed'; category: string; label: string; amount: number; paymentMethod: string | null; refId: number | null };
        const raw: Entry[] = [];
        const rows: any[] = await this.prisma.cashflow.findMany({
            where: { ...bw, category: { notIn: NON_OPERATIONAL_CATS }, date: { gte: start, lte: end } } as any,
            select: { id: true, type: true, category: true, amount: true, date: true, paymentMethod: true, note: true },
            orderBy: { date: 'asc' },
        });
        for (const r of rows) raw.push({ date: r.date, type: r.type, source: 'cashflow', category: r.category, label: r.note || r.category, amount: num(r.amount), paymentMethod: r.paymentMethod || null, refId: r.id });
        if (includeFixed) {
            for (const fe of await this.projectedFixedExpenses(bw, start, end)) {
                raw.push({ date: fe.date, type: 'EXPENSE', source: 'fixed', category: fe.category, label: `Proyeksi beban tetap: ${fe.name}`, amount: fe.amount, paymentMethod: null, refId: fe.id });
            }
        }
        raw.sort((a, b) => a.date.getTime() - b.date.getTime());

        const pad = (n: number) => String(n).padStart(2, '0');
        const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        const daysMap = new Map<string, { date: string; openingBalance: number; closingBalance: number; income: number; expense: number; entries: (Entry & { runningBalance: number })[] }>();
        for (const e of raw) {
            const before = running;
            running += e.type === 'INCOME' ? e.amount : -e.amount;
            const entry = { ...e, runningBalance: round2(running) };
            const k = dayKey(e.date);
            let day = daysMap.get(k);
            if (!day) { day = { date: k, openingBalance: round2(before), closingBalance: 0, income: 0, expense: 0, entries: [] }; daysMap.set(k, day); }
            day.entries.push(entry);
            day.closingBalance = entry.runningBalance;
            if (e.type === 'INCOME') day.income += e.amount; else day.expense += e.amount;
        }
        const days = Array.from(daysMap.values()).map((d) => ({ ...d, income: round2(d.income), expense: round2(d.expense) }));
        return { period: { startDate, endDate }, openingBalance: round2(openingBalance), closingBalance: round2(running), days };
    }

    /** Laporan anomali "pergerakan uang tidak jelas" (rule-based). */
    async getFinanceAnomalies(branchCtx: BranchContext, startDate: string, endDate: string) {
        if (!branchCtx.isOwner) throw new ForbiddenException('Analisa keuangan hanya untuk owner.');
        const bw = branchWhere(branchCtx);
        const start = new Date(`${startDate}T00:00:00`);
        const end = new Date(`${endDate}T23:59:59.999`);
        const num = (v: any) => Number(v || 0);
        const sev = (v: number, med: number, high: number): 'low' | 'med' | 'high' => (v >= high ? 'high' : v >= med ? 'med' : 'low');
        const anomalies: { date: string; type: string; severity: 'low' | 'med' | 'high'; reason: string; amount: number; refId: number | null }[] = [];
        const iso = (d: Date) => d.toISOString().slice(0, 10);

        // 1) Selisih kas shift
        const shifts: any[] = await this.prisma.shiftReport.findMany({
            where: { ...bw, closedAt: { gte: start, lte: end } } as any,
            select: { id: true, closedAt: true, cashDifference: true, qrisDifference: true, transferDifference: true },
        });
        for (const s of shifts) {
            for (const [k, label] of [['cashDifference', 'Selisih kas'], ['qrisDifference', 'Selisih QRIS'], ['transferDifference', 'Selisih transfer']] as const) {
                const diff = num(s[k]);
                if (Math.abs(diff) > 0) anomalies.push({ date: s.closedAt ? iso(s.closedAt) : startDate, type: 'SHIFT_DIFF', severity: sev(Math.abs(diff), 50000, 200000), reason: `${label} Rp ${Math.abs(diff).toLocaleString('id-ID')} (${diff < 0 ? 'kurang' : 'lebih'})`, amount: diff, refId: s.id });
            }
        }

        // 2) Outlier nominal + 3) pengeluaran tanpa keterangan
        const cfs: any[] = await this.prisma.cashflow.findMany({
            where: { ...bw, category: { notIn: NON_OPERATIONAL_CATS }, date: { gte: start, lte: end } } as any,
            select: { id: true, type: true, category: true, amount: true, date: true, note: true },
        });
        const byType: Record<string, number[]> = { INCOME: [], EXPENSE: [] };
        for (const c of cfs) byType[c.type]?.push(num(c.amount));
        const stats = (arr: number[]) => { if (!arr.length) return { mean: 0, std: 0 }; const mean = arr.reduce((a, b) => a + b, 0) / arr.length; const std = Math.sqrt(arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length); return { mean, std }; };
        const st = { INCOME: stats(byType.INCOME), EXPENSE: stats(byType.EXPENSE) };
        for (const c of cfs) {
            const amt = num(c.amount);
            const s = st[c.type as 'INCOME' | 'EXPENSE'];
            if (s && s.std > 0 && amt > s.mean + 3 * s.std) anomalies.push({ date: iso(c.date), type: 'OUTLIER', severity: 'high', reason: `${c.type === 'INCOME' ? 'Pemasukan' : 'Pengeluaran'} janggal besar (Rp ${amt.toLocaleString('id-ID')}) jauh di atas rata-rata`, amount: amt, refId: c.id });
            if (c.type === 'EXPENSE' && amt >= 500000 && (!c.note || !c.note.trim()) && (!c.category || c.category.toUpperCase() === 'LAINNYA')) anomalies.push({ date: iso(c.date), type: 'UNEXPLAINED', severity: sev(amt, 1000000, 5000000), reason: `Pengeluaran Rp ${amt.toLocaleString('id-ID')} tanpa keterangan/kategori`, amount: amt, refId: c.id });
        }

        // 4) Hari net anjlok (outlier bawah)
        const netByDay: Record<string, number> = {};
        for (const c of cfs) { const k = iso(c.date); netByDay[k] = (netByDay[k] || 0) + (c.type === 'INCOME' ? num(c.amount) : -num(c.amount)); }
        const nets = Object.values(netByDay);
        const ns = stats(nets);
        if (ns.std > 0) for (const [k, v] of Object.entries(netByDay)) if (v < ns.mean - 2 * ns.std) anomalies.push({ date: k, type: 'DIP', severity: 'med', reason: `Arus kas harian anjlok (net Rp ${Math.round(v).toLocaleString('id-ID')}) jauh di bawah tren`, amount: v, refId: null });

        const order = { high: 0, med: 1, low: 2 } as const;
        anomalies.sort((a, b) => order[a.severity] - order[b.severity] || (a.date < b.date ? 1 : -1));
        return { period: { startDate, endDate }, count: anomalies.length, anomalies };
    }

    /** Helper: total pemasukan/pengeluaran + pengeluaran per kategori (Cashflow nyata + proyeksi FixedExpense masa depan). */
    private async financeTotals(bw: any, start: Date, end: Date, includeFixed: boolean) {
        const num = (v: any) => Number(v || 0);
        const cfs: any[] = await this.prisma.cashflow.findMany({
            where: { ...bw, category: { notIn: NON_OPERATIONAL_CATS }, date: { gte: start, lte: end } } as any,
            select: { type: true, category: true, amount: true },
        });
        let income = 0, expense = 0;
        const expByCat: Record<string, number> = {};
        for (const c of cfs) {
            const amt = num(c.amount);
            if (c.type === 'INCOME') income += amt;
            else { expense += amt; const cat = c.category || 'LAINNYA'; expByCat[cat] = (expByCat[cat] || 0) + amt; }
        }
        if (includeFixed) {
            for (const fe of await this.projectedFixedExpenses(bw, start, end)) {
                expense += fe.amount; expByCat[fe.category] = (expByCat[fe.category] || 0) + fe.amount;
            }
        }
        return { income, expense, net: income - expense, expByCat };
    }

    /** Tren keuangan N bulan ke belakang (termasuk bulan target), terurut lama→baru. Basis kas. */
    private async financeMultiMonthTrend(bw: any, year: number, month: number, monthsBack = 6, includeFixed = true) {
        const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        const round2 = (n: number) => Math.round(n * 100) / 100;
        const months: { year: number; month: number; label: string; income: number; expense: number; net: number; margin: number }[] = [];
        for (let i = monthsBack - 1; i >= 0; i--) {
            const d = new Date(year, month - 1 - i, 1);
            const y = d.getFullYear(), m = d.getMonth() + 1;
            const start = new Date(y, m - 1, 1, 0, 0, 0);
            const end = new Date(y, m, 0, 23, 59, 59, 999);
            const t = await this.financeTotals(bw, start, end, includeFixed);
            months.push({ year: y, month: m, label: `${MONTHS[m - 1]} ${y}`, income: round2(t.income), expense: round2(t.expense), net: round2(t.net), margin: t.income > 0 ? round2((t.net / t.income) * 100) : 0 });
        }
        // Arah tren & pertumbuhan net rata-rata MoM
        const growths: number[] = [];
        for (let i = 1; i < months.length; i++) {
            const p = months[i - 1].net, c = months[i].net;
            if (p !== 0) growths.push(((c - p) / Math.abs(p)) * 100);
        }
        const avgMonthlyGrowthPct = growths.length ? round2(growths.reduce((a, b) => a + b, 0) / growths.length) : 0;
        const direction: 'naik' | 'turun' | 'datar' = avgMonthlyGrowthPct > 3 ? 'naik' : avgMonthlyGrowthPct < -3 ? 'turun' : 'datar';
        const withData = months.filter((m) => m.income !== 0 || m.expense !== 0);
        const bestMonth = withData.length ? withData.reduce((a, b) => (b.net > a.net ? b : a)) : null;
        const worstMonth = withData.length ? withData.reduce((a, b) => (b.net < a.net ? b : a)) : null;
        return {
            months,
            direction,
            avgMonthlyGrowthPct,
            bestMonth: bestMonth ? { label: bestMonth.label, net: bestMonth.net } : null,
            worstMonth: worstMonth ? { label: worstMonth.label, net: worstMonth.net } : null,
        };
    }

    /** Susun analisa naratif bulanan (bahasa Indonesia, ramah owner). Fungsi murni (tanpa DB). */
    private buildMonthlyNarrative(x: {
        monthLabel: string;
        summary: { income: number; expense: number; net: number; margin: number; receivables: { sisa: number; count: number }; topExpenseCategory: { category: string; pct: number } | null };
        comparison: { delta: { netPct: number; incomePct: number; expensePct: number }; previousLabel: string; biggestExpenseUp: { category: string; delta: number } | null };
        trend: { direction: 'naik' | 'turun' | 'datar'; avgMonthlyGrowthPct: number; bestMonth: { label: string; net: number } | null; worstMonth: { label: string; net: number } | null };
        activity: { busiestDay: string | null; quietestDay: string | null };
        anomalies: { count: number; high: number };
    }) {
        const rp = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID');
        const s = x.summary, c = x.comparison, t = x.trend;
        const executive: string[] = [];
        const untung = s.net >= 0;
        executive.push(`Pada ${x.monthLabel}, perusahaan ${untung ? 'membukukan LABA' : 'mengalami RUGI'} ${rp(Math.abs(s.net))} dari omzet ${rp(s.income)} (margin ${s.margin}%).`);
        if (s.income > 0) executive.push(`Total pengeluaran ${rp(s.expense)} atau ${Math.round((s.expense / s.income) * 100)}% dari omzet.`);
        if (Math.abs(c.delta.netPct) > 0) executive.push(`Dibanding ${c.previousLabel}, laba bersih ${c.delta.netPct >= 0 ? 'naik' : 'turun'} ${Math.abs(c.delta.netPct)}%.`);

        const growth: string[] = [];
        growth.push(`Tren keuangan beberapa bulan terakhir cenderung ${t.direction}${t.avgMonthlyGrowthPct ? ` (rata-rata ${t.avgMonthlyGrowthPct >= 0 ? '+' : ''}${t.avgMonthlyGrowthPct}% laba per bulan)` : ''}.`);
        if (t.bestMonth) growth.push(`Bulan terbaik: ${t.bestMonth.label} dengan laba ${rp(t.bestMonth.net)}.`);
        if (t.worstMonth && t.worstMonth.label !== t.bestMonth?.label) growth.push(`Bulan terlemah: ${t.worstMonth.label} dengan laba ${rp(t.worstMonth.net)}.`);
        if (Math.abs(c.delta.incomePct) > 0) growth.push(`Omzet ${c.delta.incomePct >= 0 ? 'tumbuh' : 'menyusut'} ${Math.abs(c.delta.incomePct)}% vs bulan lalu.`);

        const efficiency: string[] = [];
        if (s.topExpenseCategory) efficiency.push(`Pos biaya terbesar: ${s.topExpenseCategory.category} (${s.topExpenseCategory.pct}% dari total pengeluaran).`);
        if (c.biggestExpenseUp && c.biggestExpenseUp.delta > 0) efficiency.push(`Kenaikan biaya terbesar bulan ini: ${c.biggestExpenseUp.category} +${rp(c.biggestExpenseUp.delta)} — cek apakah wajar.`);
        if (c.delta.expensePct > 10) efficiency.push(`Total pengeluaran naik ${c.delta.expensePct}% — perhatikan agar tidak menggerus laba.`);

        const cashHealth: string[] = [];
        if (s.receivables.sisa > 0) cashHealth.push(`Ada piutang belum tertagih ${rp(s.receivables.sisa)} dari ${s.receivables.count} nota — tagih untuk memperkuat kas.`);
        else cashHealth.push('Tidak ada piutang menggantung signifikan bulan ini.');
        if (x.activity.busiestDay) cashHealth.push(`Hari paling ramai: ${x.activity.busiestDay}${x.activity.quietestDay ? `, paling sepi: ${x.activity.quietestDay}` : ''}.`);

        const warnings: string[] = [];
        if (x.anomalies.count > 0) warnings.push(`Terdeteksi ${x.anomalies.count} pergerakan uang tidak jelas${x.anomalies.high ? ` (${x.anomalies.high} berprioritas tinggi)` : ''} — tinjau di menu Analisa Keuangan.`);
        if (!untung) warnings.push('Bulan ini rugi — evaluasi pos biaya terbesar & dorong omzet.');
        if (s.margin > 0 && s.margin < 10) warnings.push(`Margin tipis (${s.margin}%) — sedikit guncangan biaya bisa membuat rugi.`);

        const recommendations: string[] = [];
        if (s.receivables.sisa > 0) recommendations.push('Tagih piutang yang jatuh tempo minggu ini.');
        if (c.biggestExpenseUp && c.biggestExpenseUp.delta > 0) recommendations.push(`Audit kenaikan biaya ${c.biggestExpenseUp.category}.`);
        if (t.direction === 'turun') recommendations.push('Tren laba menurun — susun program promosi / efisiensi bulan depan.');
        if (x.activity.quietestDay) recommendations.push(`Buat promo khusus hari ${x.activity.quietestDay} untuk mengangkat hari sepi.`);
        if (!recommendations.length) recommendations.push('Pertahankan pola operasi saat ini; kondisi keuangan sehat.');

        return { executive, growth, efficiency, cashHealth, warnings, recommendations };
    }

    /** Breakdown pengeluaran per kategori (untuk analisa 'uang lari ke mana'). */
    async getFinanceExpenseBreakdown(branchCtx: BranchContext, startDate: string, endDate: string, includeFixed = true) {
        if (!branchCtx.isOwner) throw new ForbiddenException('Analisa keuangan hanya untuk owner.');
        const bw = branchWhere(branchCtx);
        const start = new Date(`${startDate}T00:00:00`);
        const end = new Date(`${endDate}T23:59:59.999`);
        const round2 = (n: number) => Math.round(n * 100) / 100;
        const t = await this.financeTotals(bw, start, end, includeFixed);
        const categories = Object.entries(t.expByCat)
            .map(([category, amount]) => ({ category, amount: round2(amount), pct: t.expense > 0 ? round2((amount / t.expense) * 100) : 0 }))
            .sort((a, b) => b.amount - a.amount);
        return { period: { startDate, endDate }, total: round2(t.expense), totalIncome: round2(t.income), categories };
    }

    /** Perbandingan periode ini vs periode sebelumnya (panjang sama) + narasi otomatis. */
    async getFinanceComparison(branchCtx: BranchContext, startDate: string, endDate: string, includeFixed = true) {
        if (!branchCtx.isOwner) throw new ForbiddenException('Analisa keuangan hanya untuk owner.');
        const bw = branchWhere(branchCtx);
        const start = new Date(`${startDate}T00:00:00`);
        const end = new Date(`${endDate}T23:59:59.999`);
        const round2 = (n: number) => Math.round(n * 100) / 100;
        const pad = (n: number) => String(n).padStart(2, '0');
        const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        const fmt = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID');
        const pct = (c: number, p: number) => (p !== 0 ? round2(((c - p) / Math.abs(p)) * 100) : (c !== 0 ? 100 : 0));

        const prevEnd = new Date(start.getTime() - 1);
        const prevStart = new Date(prevEnd.getTime() - (end.getTime() - start.getTime()));
        const cur = await this.financeTotals(bw, start, end, includeFixed);
        const prev = await this.financeTotals(bw, prevStart, prevEnd, includeFixed);

        const cats = new Set([...Object.keys(cur.expByCat), ...Object.keys(prev.expByCat)]);
        const topExpenseChanges = Array.from(cats)
            .map((cat) => ({ category: cat, current: round2(cur.expByCat[cat] || 0), previous: round2(prev.expByCat[cat] || 0), delta: round2((cur.expByCat[cat] || 0) - (prev.expByCat[cat] || 0)) }))
            .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
            .slice(0, 5);

        const insights: string[] = [];
        if (prev.income === 0 && prev.expense === 0) {
            insights.push('Tidak ada data periode pembanding sebelumnya untuk dibandingkan.');
        } else {
            const netDelta = cur.net - prev.net;
            if (netDelta < 0) insights.push(`Laba bersih turun ${Math.abs(pct(cur.net, prev.net))}% (${fmt(cur.net)} vs ${fmt(prev.net)} periode sebelumnya).`);
            else if (netDelta > 0) insights.push(`Laba bersih naik ${pct(cur.net, prev.net)}% (${fmt(cur.net)} vs ${fmt(prev.net)} periode sebelumnya).`);
            else insights.push('Laba bersih relatif sama dengan periode sebelumnya.');
            const incDelta = cur.income - prev.income;
            if (Math.abs(incDelta) > 0) insights.push(`Omzet ${incDelta < 0 ? 'turun' : 'naik'} ${fmt(Math.abs(incDelta))} (${incDelta < 0 ? '-' : '+'}${Math.abs(pct(cur.income, prev.income))}%).`);
            const expDelta = cur.expense - prev.expense;
            if (Math.abs(expDelta) > 0) insights.push(`Total pengeluaran ${expDelta < 0 ? 'turun' : 'naik'} ${fmt(Math.abs(expDelta))}.`);
            const biggestUp = topExpenseChanges.find((c) => c.delta > 0);
            if (biggestUp) insights.push(`Kenaikan pengeluaran terbesar: ${biggestUp.category} +${fmt(biggestUp.delta)}.`);
        }

        return {
            current: { income: round2(cur.income), expense: round2(cur.expense), net: round2(cur.net), period: { startDate, endDate } },
            previous: { income: round2(prev.income), expense: round2(prev.expense), net: round2(prev.net), period: { startDate: ymd(prevStart), endDate: ymd(prevEnd) } },
            delta: { income: round2(cur.income - prev.income), expense: round2(cur.expense - prev.expense), net: round2(cur.net - prev.net), incomePct: pct(cur.income, prev.income), expensePct: pct(cur.expense, prev.expense), netPct: pct(cur.net, prev.net) },
            topExpenseChanges,
            insights,
        };
    }

    /** Rekonsiliasi: saldo bank riil (BankAccount) + selisih kas terakumulasi dari ShiftReport. */
    async getFinanceReconciliation(branchCtx: BranchContext, startDate: string, endDate: string) {
        if (!branchCtx.isOwner) throw new ForbiddenException('Analisa keuangan hanya untuk owner.');
        const bw = branchWhere(branchCtx);
        const start = new Date(`${startDate}T00:00:00`);
        const end = new Date(`${endDate}T23:59:59.999`);
        const num = (v: any) => Number(v || 0);
        const round2 = (n: number) => Math.round(n * 100) / 100;

        const banks: any[] = await this.prisma.bankAccount.findMany({ select: { bankName: true, currentBalance: true, isActive: true } });
        const bankAccounts = banks.filter((b) => b.isActive !== false).map((b) => ({ name: b.bankName, balance: num(b.currentBalance) }));
        const totalBankBalance = bankAccounts.reduce((s, b) => s + b.balance, 0);

        const shifts: any[] = await this.prisma.shiftReport.findMany({
            where: { ...bw, closedAt: { gte: start, lte: end } } as any,
            select: { cashDifference: true, qrisDifference: true, transferDifference: true },
        });
        let netDifference = 0, absDifference = 0, shiftsWithDiff = 0;
        for (const s of shifts) {
            const d = num(s.cashDifference) + num(s.qrisDifference) + num(s.transferDifference);
            netDifference += d;
            absDifference += Math.abs(num(s.cashDifference)) + Math.abs(num(s.qrisDifference)) + Math.abs(num(s.transferDifference));
            if (d !== 0) shiftsWithDiff++;
        }
        return {
            period: { startDate, endDate },
            bankAccounts,
            totalBankBalance: round2(totalBankBalance),
            shiftReconciliation: { netDifference: round2(netDifference), absDifference: round2(absDifference), shiftsWithDiff, totalShifts: shifts.length },
            hasIssue: Math.round(netDifference) !== 0,
        };
    }

    /**
     * Konsolidasi saldo tutup buku (owner, semua cabang): saldo bank per rekening + kas tunai
     * (dari shift terakhir) per cabang, plus saran modal awal = rata-rata biaya operasional 3 bulan.
     */
    async getFinanceConsolidation(branchCtx: BranchContext, year: number, month: number) {
        if (!branchCtx.isOwner) throw new ForbiddenException('Konsolidasi saldo hanya untuk owner.');
        const num = (v: any) => Number(v || 0);
        const round2 = (n: number) => Math.round(n * 100) / 100;
        const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        const monthLabel = MONTHS[month - 1] || String(month);

        const branches: any[] = await this.prisma.companyBranch.findMany({ where: { isActive: true }, select: { id: true, name: true, code: true }, orderBy: { id: 'asc' } });
        const banks: any[] = await this.prisma.bankAccount.findMany({ where: { isActive: true }, select: { id: true, bankName: true, accountNumber: true, currentBalance: true, branchId: true } });
        const shifts: any[] = await this.prisma.shiftReport.findMany({ distinct: ['branchId'], orderBy: { closedAt: 'desc' }, select: { branchId: true, actualCash: true, closedAt: true } });
        const cashByBranch = new Map<number, { cash: number; asOf: Date | null }>();
        for (const s of shifts) if (s.branchId != null) cashByBranch.set(s.branchId, { cash: num(s.actualCash), asOf: s.closedAt ?? null });

        const closings: any[] = await this.prisma.branchMonthlyClosing.findMany({ where: { year, month } });
        const closingByBranch = new Map<number, any>(closings.map((c) => [c.branchId, c]));

        // Saran modal: rata-rata biaya operasional 3 bulan terakhir per cabang.
        const winEnd = new Date(year, month - 1, 1, 0, 0, 0);
        const winStart = new Date(year, month - 1 - 3, 1, 0, 0, 0);
        const expGroups: any[] = await (this.prisma.cashflow.groupBy as any)({
            by: ['branchId'], _sum: { amount: true },
            where: { type: 'EXPENSE', category: { notIn: NON_OPERATIONAL_CATS }, date: { gte: winStart, lt: winEnd } },
        });
        const suggByBranch = new Map<number, number>();
        for (const g of expGroups) if (g.branchId != null) suggByBranch.set(g.branchId, num(g._sum.amount) / 3);

        const branchRows = branches.map((b) => {
            const accounts = banks.filter((k) => k.branchId === b.id).map((k) => ({ id: k.id, bankName: k.bankName, accountNumber: k.accountNumber, balance: round2(num(k.currentBalance)) }));
            const bankTotal = round2(accounts.reduce((s, a) => s + a.balance, 0));
            const c = cashByBranch.get(b.id);
            const cash = round2(c?.cash || 0);
            const suggestedModal = round2(suggByBranch.get(b.id) || 0);
            const cl = closingByBranch.get(b.id);
            const closing = cl ? { status: cl.status, modalTotal: round2(num(cl.modalTotal)), closedAt: cl.closedAt ?? null, fundedAt: cl.fundedAt ?? null } : null;
            return { branchId: b.id, branchName: b.name, code: b.code, accounts, bankTotal, cash, cashAsOf: c?.asOf ?? null, total: round2(bankTotal + cash), suggestedModal, closing };
        });
        const orphan = banks.filter((k) => k.branchId == null);
        if (orphan.length) {
            const accounts = orphan.map((k) => ({ id: k.id, bankName: k.bankName, accountNumber: k.accountNumber, balance: round2(num(k.currentBalance)) }));
            const bankTotal = round2(accounts.reduce((s, a) => s + a.balance, 0));
            branchRows.push({ branchId: 0, branchName: 'Tanpa Cabang', code: null, accounts, bankTotal, cash: 0, cashAsOf: null, total: bankTotal, suggestedModal: 0, closing: null });
        }

        const grandTotal = {
            bank: round2(branchRows.reduce((s, r) => s + r.bankTotal, 0)),
            cash: round2(branchRows.reduce((s, r) => s + r.cash, 0)),
            total: round2(branchRows.reduce((s, r) => s + r.total, 0)),
            suggestedModal: round2(branchRows.reduce((s, r) => s + r.suggestedModal, 0)),
        };
        return { period: { year, month, monthLabel }, branches: branchRows, grandTotal };
    }

    /** Laporan jurnal keuangan bulanan lengkap + analisa naratif (owner-only). Basis kas. */
    async getFinanceMonthlyReport(branchCtx: BranchContext, year: number, month: number, includeFixed = true) {
        if (!branchCtx.isOwner) throw new ForbiddenException('Laporan keuangan bulanan hanya untuk owner.');
        const bw = branchWhere(branchCtx);
        const round2 = (n: number) => Math.round(n * 100) / 100;
        const pad = (n: number) => String(n).padStart(2, '0');
        const startDate = `${year}-${pad(month)}-01`;
        const endDate = `${year}-${pad(month)}-${pad(new Date(year, month, 0).getDate())}`;

        // Panggil ulang method yang sudah ada (semua sudah guard owner & scoping cabang).
        const [closing, breakdown, comparison, heatmap, anomaliesRes, trend] = await Promise.all([
            this.monthlyClosing(branchCtx, year, month),
            this.getFinanceExpenseBreakdown(branchCtx, startDate, endDate, includeFixed),
            this.getFinanceComparison(branchCtx, startDate, endDate, includeFixed),
            this.getFinanceHeatmap(branchCtx, startDate, endDate),
            this.getFinanceAnomalies(branchCtx, startDate, endDate),
            this.financeMultiMonthTrend(bw, year, month, 6, includeFixed),
        ]);

        const income = round2(breakdown.totalIncome);
        const expense = round2(breakdown.total);
        const net = round2(income - expense);
        const margin = income > 0 ? round2((net / income) * 100) : 0;
        const topExpenseCategory = breakdown.categories[0] ? { category: breakdown.categories[0].category, pct: breakdown.categories[0].pct } : null;
        const biggestExpenseUp = comparison.topExpenseChanges.find((c) => c.delta > 0) || null;
        const highAnoms = anomaliesRes.anomalies.filter((a) => a.severity === 'high').length;

        const analysis = this.buildMonthlyNarrative({
            monthLabel: `${closing.period.monthLabel} ${year}`,
            summary: { income, expense, net, margin, receivables: { sisa: closing.receivables.sisa, count: closing.receivables.rows.length }, topExpenseCategory },
            comparison: { delta: comparison.delta, previousLabel: 'bulan sebelumnya', biggestExpenseUp: biggestExpenseUp ? { category: biggestExpenseUp.category, delta: biggestExpenseUp.delta } : null },
            trend: { direction: trend.direction, avgMonthlyGrowthPct: trend.avgMonthlyGrowthPct, bestMonth: trend.bestMonth, worstMonth: trend.worstMonth },
            activity: { busiestDay: heatmap.busiestDay?.count ? heatmap.busiestDay.label : null, quietestDay: heatmap.quietestDay?.label || null },
            anomalies: { count: anomaliesRes.count, high: highAnoms },
        });

        return {
            period: { year, month, monthLabel: closing.period.monthLabel, startDate, endDate },
            branchName: closing.branchName,
            summary: {
                income, expense, net, margin,
                incomeChannels: closing.income.channels.map((c) => ({ channel: c.channel, total: round2(c.total) })),
                expenseCategories: breakdown.categories,
                receivables: { gross: closing.receivables.gross, dp: closing.receivables.dp, sisa: closing.receivables.sisa, count: closing.receivables.rows.length },
            },
            comparison: {
                previous: { income: comparison.previous.income, expense: comparison.previous.expense, net: comparison.previous.net, monthLabel: 'bulan sebelumnya' },
                delta: comparison.delta,
                topExpenseChanges: comparison.topExpenseChanges,
            },
            trend,
            activity: {
                busiestDay: heatmap.busiestDay?.count ? { label: heatmap.busiestDay.label, count: heatmap.busiestDay.count, revenue: heatmap.busiestDay.revenue } : null,
                quietestDay: heatmap.quietestDay ? { label: heatmap.quietestDay.label, count: heatmap.quietestDay.count, revenue: heatmap.quietestDay.revenue } : null,
            },
            anomalies: { count: anomaliesRes.count, items: anomaliesRes.anomalies.slice(0, 15).map((a) => ({ date: a.date, severity: a.severity, reason: a.reason, amount: a.amount })) },
            analysis,
        };
    }

    /** Pengosongan saldo cabang (setor ke pusat) — catat cashflow EXPENSE + reset saldo. Idempoten. */
    async closeBranchBalance(branchCtx: BranchContext, year: number, month: number, branchId: number) {
        if (!branchCtx.isOwner) throw new ForbiddenException('Aksi tutup buku hanya untuk owner.');
        if (!branchId) throw new BadRequestException('Cabang wajib dipilih.');
        const num = (v: any) => Number(v || 0);
        const round2 = (n: number) => Math.round(n * 100) / 100;

        const existing = await this.prisma.branchMonthlyClosing.findUnique({ where: { year_month_branchId: { year, month, branchId } } });
        if (existing) throw new BadRequestException(`Cabang ini sudah ditutup buku untuk ${month}/${year}.`);
        const branch = await this.prisma.companyBranch.findUnique({ where: { id: branchId }, select: { name: true } });
        if (!branch) throw new BadRequestException('Cabang tidak ditemukan.');

        const accounts = await this.prisma.bankAccount.findMany({ where: { branchId, isActive: true }, select: { id: true, bankName: true, currentBalance: true } });
        const shift = await this.prisma.shiftReport.findFirst({ where: { branchId }, orderBy: { closedAt: 'desc' }, select: { actualCash: true } });
        const cash = round2(num(shift?.actualCash));
        const date = new Date(year, month, 0, 23, 59, 59); // hari terakhir bulan ybs
        const snapshotAccounts = accounts.map((a) => ({ bankAccountId: a.id, bankName: a.bankName, balance: round2(num(a.currentBalance)) }));
        const collectedBank = round2(snapshotAccounts.reduce((s, a) => s + a.balance, 0));

        await this.prisma.$transaction(async (tx) => {
            for (const a of snapshotAccounts) {
                if (a.balance !== 0) {
                    await tx.cashflow.create({ data: { type: 'EXPENSE', category: 'PENGOSONGAN_SALDO', amount: a.balance, bankAccountId: a.bankAccountId, branchId, paymentMethod: 'BANK_TRANSFER', date, note: `Setor saldo tutup buku ${month}/${year} (${a.bankName}) ke pusat`, excludeFromShift: true } as any });
                    await tx.bankAccount.update({ where: { id: a.bankAccountId }, data: { currentBalance: 0 } });
                }
            }
            if (cash > 0) {
                await tx.cashflow.create({ data: { type: 'EXPENSE', category: 'PENGOSONGAN_SALDO', amount: cash, branchId, paymentMethod: 'CASH', date, note: `Setor kas tunai tutup buku ${month}/${year} ke pusat`, excludeFromShift: true } as any });
            }
            await tx.branchMonthlyClosing.create({ data: { year, month, branchId, status: 'CLOSED', collectedBank, collectedCash: cash, snapshot: snapshotAccounts as any, closedBy: branchCtx.roleName ?? null } });
            // Uang masuk ke Kas Pusat (dompet owner)
            const collectedTotal = round2(collectedBank + cash);
            if (collectedTotal > 0) {
                await tx.centralTreasuryEntry.create({ data: { direction: 'IN', category: 'SETORAN_CABANG', amount: collectedTotal, branchId, date, note: `Setoran tutup buku ${month}/${year} dari ${branch.name}`, createdBy: branchCtx.roleName ?? null } });
            }
        });
        return { ok: true, branchId, collectedBank, collectedCash: cash, total: round2(collectedBank + cash) };
    }

    /** Pemberian modal awal per rekening — catat cashflow INCOME + tambah saldo. Butuh sudah ditutup. */
    async fundBranchBalance(branchCtx: BranchContext, year: number, month: number, branchId: number, allocations: { bankAccountId: number; amount: number }[]) {
        if (!branchCtx.isOwner) throw new ForbiddenException('Aksi beri modal hanya untuk owner.');
        if (!branchId) throw new BadRequestException('Cabang wajib dipilih.');
        const num = (v: any) => Number(v || 0);
        const round2 = (n: number) => Math.round(n * 100) / 100;

        const closing = await this.prisma.branchMonthlyClosing.findUnique({ where: { year_month_branchId: { year, month, branchId } } });
        if (!closing) throw new BadRequestException('Cabang belum ditutup buku. Kosongkan saldo dulu.');
        if (closing.status === 'FUNDED') throw new BadRequestException('Cabang ini sudah diberi modal.');

        const clean = (allocations || []).filter((a) => a && a.bankAccountId && num(a.amount) > 0);
        if (!clean.length) throw new BadRequestException('Alokasi modal kosong.');
        const date = new Date(year, month, 1, 8, 0, 0); // awal bulan berikutnya (month 1-based → bulan depan)
        let modalTotal = 0;

        await this.prisma.$transaction(async (tx) => {
            for (const a of clean) {
                const amt = round2(num(a.amount));
                modalTotal += amt;
                const acc = await tx.bankAccount.findUnique({ where: { id: a.bankAccountId }, select: { bankName: true, branchId: true } });
                if (!acc || acc.branchId !== branchId) throw new BadRequestException('Rekening tidak cocok dengan cabang.');
                await tx.cashflow.create({ data: { type: 'INCOME', category: 'MODAL_MASUK', amount: amt, bankAccountId: a.bankAccountId, branchId, paymentMethod: 'BANK_TRANSFER', date, note: `Modal awal dari pusat (${acc.bankName})`, excludeFromShift: true } as any });
                await tx.bankAccount.update({ where: { id: a.bankAccountId }, data: { currentBalance: { increment: amt } } });
            }
            await tx.branchMonthlyClosing.update({ where: { id: closing.id }, data: { status: 'FUNDED', modalTotal: round2(modalTotal), fundedAt: new Date() } });
            // Uang keluar dari Kas Pusat untuk modal cabang
            await tx.centralTreasuryEntry.create({ data: { direction: 'OUT', category: 'MODAL_CABANG', amount: round2(modalTotal), branchId, date, note: `Modal awal untuk cabang`, createdBy: branchCtx.roleName ?? null } });
        });
        return { ok: true, branchId, modalTotal: round2(modalTotal) };
    }

    /** Ringkasan Kas Pusat (dompet owner): saldo all-time + rincian bulan + entri terbaru. */
    async getCentralTreasury(branchCtx: BranchContext, year: number, month: number) {
        if (!branchCtx.isOwner) throw new ForbiddenException('Kas pusat hanya untuk owner.');
        const num = (v: any) => Number(v || 0);
        const round2 = (n: number) => Math.round(n * 100) / 100;

        // Saldo kumulatif (all-time)
        const allGroups: any[] = await (this.prisma.centralTreasuryEntry.groupBy as any)({ by: ['direction'], _sum: { amount: true } });
        let totalIn = 0, totalOut = 0;
        for (const g of allGroups) { if (g.direction === 'IN') totalIn = num(g._sum.amount); else totalOut = num(g._sum.amount); }
        const balance = round2(totalIn - totalOut);

        // Rincian bulan terpilih
        const start = new Date(year, month - 1, 1, 0, 0, 0);
        const end = new Date(year, month, 0, 23, 59, 59, 999);
        const monthEntries: any[] = await this.prisma.centralTreasuryEntry.findMany({ where: { date: { gte: start, lte: end } }, orderBy: { date: 'desc' } });
        const sumBy = (dir: string, cat?: string) => round2(monthEntries.filter((e) => e.direction === dir && (!cat || e.category === cat)).reduce((s, e) => s + num(e.amount), 0));
        const period = {
            collected: sumBy('IN', 'SETORAN_CABANG'),
            otherIn: sumBy('IN') - sumBy('IN', 'SETORAN_CABANG'),
            modalOut: sumBy('OUT', 'MODAL_CABANG'),
            bahanOut: sumBy('OUT', 'BELI_BAHAN'),
            otherOut: sumBy('OUT', 'LAINNYA'),
        };
        const entries = monthEntries.slice(0, 100).map((e) => ({ id: e.id, direction: e.direction, category: e.category, amount: round2(num(e.amount)), branchId: e.branchId, note: e.note, date: e.date }));
        return { period: { year, month }, balance, totalIn: round2(totalIn), totalOut: round2(totalOut), monthSummary: period, entries };
    }

    /** Catat pengeluaran Kas Pusat (beli bahan / lainnya). */
    async addCentralExpense(branchCtx: BranchContext, category: string, amount: number, note?: string, date?: string) {
        if (!branchCtx.isOwner) throw new ForbiddenException('Kas pusat hanya untuk owner.');
        const amt = Number(amount || 0);
        if (amt <= 0) throw new BadRequestException('Nominal harus lebih dari 0.');
        const cat = category === 'BELI_BAHAN' ? 'BELI_BAHAN' : 'LAINNYA';
        const when = date ? new Date(`${date}T12:00:00`) : new Date();
        const entry = await this.prisma.centralTreasuryEntry.create({ data: { direction: 'OUT', category: cat, amount: amt, note: note || null, date: when, createdBy: branchCtx.roleName ?? null } });
        return { ok: true, id: entry.id };
    }
}
