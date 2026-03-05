import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const cashflows = await prisma.cashflow.findMany({
        orderBy: { id: 'desc' },
        take: 10
    });
    console.log("Last 10 Cashflows:", JSON.stringify(cashflows, null, 2));

    const transactions = await prisma.transaction.findMany({
        orderBy: { id: 'desc' },
        take: 3
    });
    console.log("\nLast 3 Transactions:", JSON.stringify(transactions, null, 2));
}

main().finally(() => prisma.$disconnect());
