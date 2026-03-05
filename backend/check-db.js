const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const trxs = await prisma.transaction.findMany({ orderBy: { id: 'desc' }, take: 2 });
    console.log(JSON.stringify(trxs, null, 2));
}

main().finally(() => prisma.$disconnect());
