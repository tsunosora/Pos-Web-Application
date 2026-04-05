import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StockPurchasesService {
    constructor(private prisma: PrismaService) { }

    async create(data: {
        invoiceNumber?: string;
        supplierId?: number;
        notes?: string;
        items: { productVariantId: number; quantity: number; unitPrice?: number }[];
    }) {
        if (!data.items || data.items.length === 0) {
            throw new BadRequestException('Minimal satu item pembelian diperlukan');
        }

        return this.prisma.$transaction(async (tx) => {
            // Buat header pembelian
            const purchase = await (tx as any).stockPurchase.create({
                data: {
                    invoiceNumber: data.invoiceNumber || null,
                    supplierId: data.supplierId || null,
                    notes: data.notes || null,
                },
            });

            // Ambil info supplier untuk reason
            let supplierName: string | null = null;
            if (data.supplierId) {
                const supplier = await tx.supplier.findUnique({ where: { id: data.supplierId }, select: { name: true } });
                supplierName = supplier?.name ?? null;
            }

            const reasonBase = data.invoiceNumber
                ? `Pembelian #${data.invoiceNumber}${supplierName ? ` dari ${supplierName}` : ''}`
                : `Pembelian${supplierName ? ` dari ${supplierName}` : ''}`;

            for (const item of data.items) {
                const variant = await tx.productVariant.findUnique({
                    where: { id: item.productVariantId },
                    select: { stock: true },
                });
                if (!variant) throw new NotFoundException(`Varian ID ${item.productVariantId} tidak ditemukan`);

                const newStock = Number(variant.stock) + item.quantity;

                await tx.productVariant.update({
                    where: { id: item.productVariantId },
                    data: { stock: newStock },
                });

                await (tx as any).stockPurchaseItem.create({
                    data: {
                        purchaseId: purchase.id,
                        productVariantId: item.productVariantId,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice ?? null,
                    },
                });

                await tx.stockMovement.create({
                    data: {
                        productVariantId: item.productVariantId,
                        type: 'IN',
                        quantity: item.quantity,
                        reason: reasonBase,
                        balanceAfter: newStock,
                        referenceId: `purchase-${purchase.id}`,
                    } as any,
                });
            }

            return (tx as any).stockPurchase.findUnique({
                where: { id: purchase.id },
                include: {
                    supplier: true,
                    items: {
                        include: {
                            productVariant: { include: { product: { select: { name: true } } } },
                        },
                    },
                },
            });
        });
    }

    async findAll() {
        return (this.prisma as any).stockPurchase.findMany({
            include: {
                supplier: { select: { id: true, name: true } },
                items: {
                    include: {
                        productVariant: {
                            select: { id: true, sku: true, variantName: true, product: { select: { name: true } } },
                        },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
}
