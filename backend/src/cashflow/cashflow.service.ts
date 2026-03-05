import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CashflowType, Prisma } from '@prisma/client';

@Injectable()
export class CashflowService {
    constructor(private prisma: PrismaService) { }

    async create(data: Prisma.CashflowCreateInput) {
        return this.prisma.cashflow.create({
            data,
        });
    }

    async findAll() {
        return this.prisma.cashflow.findMany({
            orderBy: { date: 'desc' },
            include: {
                user: {
                    select: {
                        email: true,
                    }
                }
            }
        });
    }

    async getSummary() {
        const cashflows = await this.prisma.cashflow.findMany();

        let totalIncome = 0;
        let totalExpense = 0;

        for (const cf of cashflows) {
            const amountStr = cf.amount.toString();
            const amount = parseFloat(amountStr);
            if (cf.type === CashflowType.INCOME) {
                totalIncome += amount;
            } else if (cf.type === CashflowType.EXPENSE) {
                totalExpense += amount;
            }
        }

        return {
            totalIncome,
            totalExpense,
            balance: totalIncome - totalExpense,
        };
    }
}
