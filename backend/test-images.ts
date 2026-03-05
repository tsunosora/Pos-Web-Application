import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const products = await prisma.product.findMany({
        select: { id: true, name: true, imageUrl: true }
    });
    console.log(JSON.stringify(products, null, 2));
}

main().finally(() => prisma.$disconnect());
