import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CloseShiftDto, StructuredExpenses, AdditionalIncomeItem, PaymentExchangeItem } from './reports.controller';

@Injectable()
export class ReportsService {
    private readonly logger = new Logger(ReportsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly whatsappService: WhatsappService,
        private readonly notificationsService: NotificationsService,
    ) { }

    async getStaffList() {
        const users = await this.prisma.user.findMany({
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
        });
        return users.filter(u => u.name); // hanya yang punya nama
    }

    async getProfitReport(startDate?: string, endDate?: string) {
        const whereClause: any = { status: 'PAID' }; // TransactionStatus.PAID
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
                                        unit: true
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
                let displayQty = qty;

                if (isArea) {
                    // Area based: HPP is per m2
                    const areaM2 = Number(item.areaCm2) / 10000;
                    itemHpp = hpp * areaM2;
                    // priceAtTime acts as the lineTotal for area based
                    itemRevenue = Number(item.priceAtTime) * qty;
                } else {
                    // Unit based
                    itemHpp = hpp * qty;
                    // priceAtTime is unit price for unit based
                    itemRevenue = Number(item.priceAtTime) * qty;
                }

                trxHpp += itemHpp;

                // Group by variant
                if (!itemMap[item.productVariantId]) {
                    const pv = (item as any).productVariant;
                    const p = pv?.product;
                    itemMap[item.productVariantId] = {
                        productVariantId: item.productVariantId,
                        sku: pv?.sku || 'Unknown',
                        name: pv?.variantName ? `${p?.name} - ${pv?.variantName}` : (p?.name || 'Unknown Product'),
                        qty: 0,
                        unit: p?.unit?.name || 'pcs',
                        revenue: 0,
                        totalHpp: 0,
                        grossProfit: 0
                    };
                }

                itemMap[item.productVariantId].qty += displayQty;
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

        return {
            totalRevenue,
            totalHpp,
            grossProfit,
            profitMargin: Number(profitMargin.toFixed(2)),
            transactionCount: transactions.length,
            items
        };
    }

    async calculateCurrentShiftExpectations() {
        const lastShift = await (this.prisma as any).shiftReport.findFirst({
            orderBy: { closedAt: 'desc' },
        });

        let openedAt = lastShift?.closedAt;
        if (!openedAt) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            openedAt = today;
        }

        const cashflows: any[] = await this.prisma.cashflow.findMany({
            where: { createdAt: { gte: openedAt } },
            include: { bankAccount: true } as any,
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
            where: { isActive: true }
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

    async closeShift(dto: CloseShiftDto, proofImages: string[]) {
        const cashDifference = dto.actualCash - dto.expectedCash;
        const qrisDifference = dto.actualQris - dto.expectedQris;
        const transferDifference = dto.actualTransfer - dto.expectedTransfer;

        const activeBanks: any[] = await this.prisma.bankAccount.findMany({
            where: { isActive: true }
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
        const expectedData = await this.calculateCurrentShiftExpectations();

        const shift: any = await (this.prisma as any).shiftReport.create({
            data: {
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
            },
        });

        // Buat Cashflow INCOME untuk pemasukan tambahan eksternal
        if (dto.additionalIncomes && dto.additionalIncomes.length > 0) {
            for (const income of dto.additionalIncomes) {
                if (!income.bankName || !income.amount || income.amount <= 0) continue;
                const bank = activeBanks.find((b: any) => b.bankName === income.bankName);
                if (!bank) continue;
                await this.prisma.cashflow.create({
                    data: {
                        type: 'INCOME',
                        category: 'Pemasukan Tambahan',
                        amount: income.amount,
                        note: income.description || 'Pemasukan Eksternal',
                        paymentMethod: 'BANK_TRANSFER',
                        bankAccountId: bank.id,
                        date: new Date(dto.closedAt),
                    } as any,
                });
            }
        }

        // Buat Cashflow EXPENSE dari pengeluaran shift (structuredExpenses)
        if (dto.structuredExpenses) {
            for (const [method, items] of Object.entries(dto.structuredExpenses)) {
                if (!items || items.length === 0) continue;
                const isCash = method === 'CASH';
                const bank = isCash ? null : activeBanks.find((b: any) => b.bankName === method);
                for (const item of items) {
                    if (!item.name || !item.amount || Number(item.amount) <= 0) continue;
                    await this.prisma.cashflow.create({
                        data: {
                            type: 'EXPENSE',
                            category: item.name,
                            amount: Number(item.amount),
                            note: `Pengeluaran shift ${dto.shiftName || ''} — ${item.name}`,
                            paymentMethod: isCash ? 'CASH' : 'BANK_TRANSFER',
                            bankAccountId: bank?.id || null,
                            date: new Date(dto.closedAt),
                        } as any,
                    });
                }
            }
        }

        // Buat Cashflow EXPENSE untuk kasbon dari Kas Toko
        if (dto.kasbon && dto.kasbon.length > 0) {
            for (const k of dto.kasbon) {
                if (!k.name || !k.amount || Number(k.amount) <= 0) continue;
                if (k.source && k.source !== 'Kas Toko') continue;
                await this.prisma.cashflow.create({
                    data: {
                        type: 'EXPENSE',
                        category: 'Kasbon Karyawan',
                        amount: Number(k.amount),
                        note: `Kasbon: ${k.name} — shift ${dto.shiftName || ''}`,
                        paymentMethod: 'CASH',
                        bankAccountId: null,
                        date: new Date(dto.closedAt),
                    } as any,
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

        this.whatsappService.sendReport(reportMsg, proofImages).catch((err) => {
            this.logger.error('Background WhatsApp send failed', err);
        });

        // Kirim ringkasan ke Discord jika dikonfigurasi
        const discordUrl = (settings as any)?.discordWebhookUrl;
        if (discordUrl) {
            const totalCash = dto.actualCash + dto.actualQris + dto.actualTransfer;
            const shiftName = dto.shiftName || 'Shift';
            const adminName = dto.adminName || 'Kasir';
            const discordMsg = [
                `📊 **Laporan Tutup Shift — ${shiftName}**`,
                `👤 Kasir: ${adminName}`,
                `💰 Total Penerimaan: Rp ${totalCash.toLocaleString('id-ID')}`,
                `   • Tunai: Rp ${dto.actualCash.toLocaleString('id-ID')}`,
                `   • QRIS: Rp ${dto.actualQris.toLocaleString('id-ID')}`,
                `   • Transfer: Rp ${dto.actualTransfer.toLocaleString('id-ID')}`,
                dto.notes ? `📝 Catatan: ${dto.notes}` : '',
            ].filter(Boolean).join('\n');
            this.notificationsService.sendToDiscord(discordUrl, discordMsg).catch(() => { });
        }

        return { success: true, message: 'Shift closed successfully.', data: shift };
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

        // Hitung Saldo Kas Bersih
        const totalCashExpenses = structuredExpenses?.['CASH']
            ? structuredExpenses['CASH'].reduce((s, i) => s + Number(i.amount), 0)
            : (exp.shiftExpenses || []).filter((e: any) => e.method === 'CASH').reduce((s: number, e: any) => s + e.amount, 0);
        const totalSetorKas = setorKas.reduce((s, k) => s + Number(k.amount), 0);
        const totalTarikTunai = tarikTunai.reduce((s, k) => s + Number(k.amount), 0);
        const totalKasbonToko = kasbon
            .filter(k => !k.source || k.source === 'Kas Toko')
            .reduce((s, k) => s + Number(k.amount), 0);
        const exchangeCashEffect = paymentExchanges.reduce((sum, ex) => {
            if (ex.to === 'CASH') return sum + ex.amount;
            if (ex.from === 'CASH') return sum - ex.amount;
            return sum;
        }, 0);
        const saldoKasBersih = Number(shift.actualCash)
            - totalCashExpenses
            - totalSetorKas
            + totalTarikTunai
            + tukarTransferKeCash
            - totalKasbonToko
            + exchangeCashEffect;

        msg += `\nCash real : ${formatRp(Number(shift.actualCash))}\n`;
        msg += `Saldo Kas Bersih : ${formatRp(saldoKasBersih)}\n`;
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
}
