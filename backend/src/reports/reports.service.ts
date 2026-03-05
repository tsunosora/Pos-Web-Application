import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { CloseShiftDto, StructuredExpenses } from './reports.controller';

@Injectable()
export class ReportsService {
    private readonly logger = new Logger(ReportsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly whatsappService: WhatsappService,
    ) { }

    // Ambil daftar staff/kasir untuk dropdown
    async getStaffList() {
        const users = await this.prisma.user.findMany({
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
        });
        return users.filter(u => u.name); // hanya yang punya nama
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
            },
        });

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

        const settings = await this.prisma.storeSettings.findFirst();
        const expectedData = await this.calculateCurrentShiftExpectations();

        const reportMsg = this.formatWhatsappMessage(
            shift,
            expectedData,
            dto.actualBankBalances || {},
            dto.realBankBalances || {},
            dto.actualQris,
            dto.structuredExpenses,
            settings
        );

        this.whatsappService.sendReport(reportMsg, proofImages).catch((err) => {
            this.logger.error('Background WhatsApp send failed', err);
        });

        return { success: true, message: 'Shift closed successfully.', data: shift };
    }

    private formatWhatsappMessage(
        shift: any,
        exp: any,
        actualBankBalances: Record<string, number>,  // Saldo Laporan mBanking
        realBankBalances: Record<string, number>,    // Saldo Real di Bank
        actualQris: number,
        structuredExpenses: StructuredExpenses | undefined,
        settings?: any
    ): string {
        const formatRp = (val: number) => {
            return 'Rp ' + new Intl.NumberFormat('id-ID', {
                minimumFractionDigits: 0
            }).format(val || 0);
        };

        const storeName = settings?.storeName || 'TOKO';
        const dateStr = new Date(shift.openedAt).toLocaleDateString('id-ID', {
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

        msg += `QRIS : ${formatRp(exp.grossQris)}\n\n`;
        msg += `Total : ${formatRp(totalIncome)}\n\n`;

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

        msg += `\nCash real : ${formatRp(shift.actualCash)}\n`;
        msg += `===============================\n\n`;

        // Saldo Laporan mBanking (yang kasir lihat di layar)
        for (const bank of Object.keys(exp.systemBankBalances)) {
            const laporan = actualBankBalances[bank] || 0;
            msg += `Saldo ${bank.toUpperCase()} pada saat laporan : ${formatRp(laporan)}\n`;
        }
        msg += `Saldo QRIS pada saat laporan : ${formatRp(actualQris)}\n\n`;

        // Saldo Real di Bank (yang benar-benar tercatat)
        const hasRealBalances = Object.keys(realBankBalances).length > 0;
        for (const bank of Object.keys(exp.systemBankBalances)) {
            const real = hasRealBalances
                ? (realBankBalances[bank] || 0)
                : (actualBankBalances[bank] || 0);
            msg += `${bank.toUpperCase()} : ${formatRp(real)}\n`;
        }
        msg += `QRIS : ${formatRp(actualQris)}\n`;

        return msg;
    }
}
