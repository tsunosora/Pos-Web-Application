import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { CloseShiftDto } from './reports.controller';

@Injectable()
export class ReportsService {
    private readonly logger = new Logger(ReportsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly whatsappService: WhatsappService,
    ) { }

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

        // System expected absolute cash in drawer:
        // usually we don't track absolute cash in drawer across days, just net shift cash.
        const expectedCash = grossCash - cashExpenseTotal;
        const expectedQris = grossQris; // typically Qris has no direct expenses from app
        const expectedTransfer = grossTransfer - (expensesTotal - cashExpenseTotal); // approx

        return {
            openedAt,
            expectedCash,    // net
            expectedQris,    // net
            expectedTransfer, // net
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

        const shift: any = await (this.prisma as any).shiftReport.create({
            data: {
                adminName: dto.adminName || 'Admin',
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

                expensesTotal: dto.expensesTotal,
                notes: dto.notes,
                proofImages: proofImages,

                expectedBankBalances: dto.expectedBankBalances || {},
                actualBankBalances: dto.actualBankBalances || {},
                shiftExpenses: dto.shiftExpenses || [],
            },
        });

        // Update active banks with the ACTUAL balances given by the cashier!
        if (dto.actualBankBalances) {
            for (const bank of activeBanks) {
                const actual = dto.actualBankBalances[bank.bankName];
                if (actual !== undefined && actual !== null) {
                    await (this.prisma as any).bankAccount.update({
                        where: { id: bank.id },
                        data: { currentBalance: Number(actual) }
                    });
                }
            }
        }

        const settings = await this.prisma.storeSettings.findFirst();

        // Regenerate the expectations for standard formatting
        const expectedData = await this.calculateCurrentShiftExpectations();

        const reportMsg = this.formatWhatsappMessage(shift, expectedData, dto.actualBankBalances || {}, dto.actualQris, settings);

        this.whatsappService.sendReport(reportMsg, proofImages).catch((err) => {
            this.logger.error('Background WhatsApp send failed', err);
        });

        return { success: true, message: 'Shift closed successfully.', data: shift };
    }

    private formatWhatsappMessage(shift: any, exp: any, actualBankBalances: any, actualQris: number, settings?: any): string {
        const formatRp = (val: number) => {
            return new Intl.NumberFormat('id-ID', {
                style: 'currency',
                currency: 'IDR',
                minimumFractionDigits: 0
            }).format(val || 0).replace('Rp', 'Rp.');
        };

        const formatNb = (val: number) => {
            return new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0 }).format(val || 0);
        };

        const storeName = settings?.storeName || 'VOLIKO';
        const dateString = new Date(shift.openedAt).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

        let msg = `${storeName.toUpperCase()}\n`;
        msg += `CS: ${shift.adminName}\n\n`;

        msg += `Penerimaan ${dateString} || ${shift.shiftName}\n\n`;

        msg += `Cash : ${formatRp(exp.grossCash)}\n`;

        let totalIncome = exp.grossCash + exp.grossQris;
        for (const [bank, amount] of Object.entries(exp.grossBankIncomes)) {
            msg += `${bank.toUpperCase()} : ${formatRp(amount as number)}\n`;
            totalIncome += (amount as number);
        }

        msg += `QRIS : ${formatNb(exp.grossQris)}\n\n`;
        msg += `Total : ${formatRp(totalIncome)}\n\n`;

        msg += `========================================\n`;
        msg += `Pengeluaran Cash :\n`;
        const cashExps = exp.shiftExpenses.filter((e: any) => e.method === 'CASH');
        if (cashExps.length > 0) {
            cashExps.forEach((e: any, idx: number) => {
                msg += `${idx + 1}. ${e.note} : ${formatNb(e.amount)}\n`;
            });
        } else {
            msg += `-\n`;
        }
        msg += `\ncash real = ${formatNb(shift.actualCash)}\n\n`; // using cashier physical cash input here

        // Other bank expenses
        const nonCashExps = exp.shiftExpenses.filter((e: any) => e.method !== 'CASH');
        const groupedNonCash: Record<string, any[]> = {};
        nonCashExps.forEach((e: any) => {
            const key = e.method === 'QRIS' ? 'QRIS' : (e.bankName || 'TRANSFER');
            if (!groupedNonCash[key]) groupedNonCash[key] = [];
            groupedNonCash[key].push(e);
        });

        for (const [key, exps] of Object.entries(groupedNonCash)) {
            msg += `Pengeluaran ${key.toUpperCase()} :\n`;
            (exps as any[]).forEach((e, idx) => {
                msg += `${idx + 1}. ${e.note} : ${formatNb(e.amount)}\n`;
            });
            msg += `\n`;
        }

        msg += `========================================\n\n`;

        // Saldo Actuals (Cashier Inputted)
        for (const bank of Object.keys(exp.systemBankBalances)) {
            const act = actualBankBalances[bank] || 0;
            msg += `Saldo ${bank.toUpperCase()} pada saat laporan : ${formatRp(act)}\n`;
        }
        msg += `Saldo QRIS pada saat laporan : ${formatNb(actualQris)}\n\n`;

        // Saldo Systems
        for (const [bank, sysAmt] of Object.entries(exp.systemBankBalances)) {
            msg += `${bank.toUpperCase()} : ${formatRp(sysAmt as number)}\n`;
        }
        msg += `QRIS : ${formatNb(exp.expectedQris)}\n`; // Since QRIS has no baseline we just show shift net

        return msg;
    }
}
