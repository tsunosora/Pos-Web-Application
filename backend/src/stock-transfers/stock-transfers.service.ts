import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BranchContext } from '../common/branch-context.decorator';
import { branchWhere } from '../common/branch-where.helper';

@Injectable()
export class StockTransfersService {
    constructor(private readonly prisma: PrismaService) {}

    /**
     * Transfer stok antar cabang.
     * - Mengurangi BranchStock(fromBranchId) dan menambah BranchStock(toBranchId)
     * - Mencatat 2 StockMovement (OUT di cabang asal, IN di cabang tujuan)
     * - ProductVariant.stock (agregat global) TIDAK berubah karena totalnya sama.
     */
    async createTransfer(
        data: {
            fromBranchId: number;
            toBranchId: number;
            items: { productVariantId: number; quantity: number }[];
            notes?: string;
        },
        branchCtx: BranchContext,
    ) {
        if (!data.items || data.items.length === 0) {
            throw new BadRequestException('Minimal satu item transfer diperlukan');
        }
        if (data.fromBranchId === data.toBranchId) {
            throw new BadRequestException('Cabang asal dan tujuan tidak boleh sama');
        }

        // Guard untuk staff: hanya boleh transfer keluar dari cabangnya sendiri
        if (!branchCtx.isOwner) {
            if (branchCtx.branchId !== data.fromBranchId) {
                throw new BadRequestException('Anda hanya bisa transfer dari cabang Anda sendiri.');
            }
        }

        // Validasi cabang ada
        const [fromBranch, toBranch] = await Promise.all([
            this.prisma.companyBranch.findUnique({ where: { id: data.fromBranchId } }),
            this.prisma.companyBranch.findUnique({ where: { id: data.toBranchId } }),
        ]);
        if (!fromBranch) throw new NotFoundException('Cabang asal tidak ditemukan');
        if (!toBranch) throw new NotFoundException('Cabang tujuan tidak ditemukan');

        const refId = `transfer-${Date.now()}`;
        const reasonOut = `Transfer ke ${toBranch.name}${data.notes ? ` — ${data.notes}` : ''}`;
        const reasonIn = `Transfer dari ${fromBranch.name}${data.notes ? ` — ${data.notes}` : ''}`;

        return this.prisma.$transaction(async (tx) => {
            const results: any[] = [];

            for (const item of data.items) {
                if (item.quantity <= 0) {
                    throw new BadRequestException(`Jumlah transfer untuk variant ${item.productVariantId} harus > 0`);
                }

                const variant = await tx.productVariant.findUnique({
                    where: { id: item.productVariantId },
                    select: { id: true, variantName: true, sku: true },
                });
                if (!variant) throw new NotFoundException(`Varian ID ${item.productVariantId} tidak ditemukan`);

                // Cek stok cabang asal
                const fromBs = await (tx as any).branchStock.findUnique({
                    where: { branchId_productVariantId: { branchId: data.fromBranchId, productVariantId: item.productVariantId } },
                    select: { stock: true },
                });
                const fromStock = Number(fromBs?.stock ?? 0);
                if (fromStock < item.quantity) {
                    throw new BadRequestException(
                        `Stok ${variant.sku} di cabang ${fromBranch.name} tidak cukup. Tersedia: ${fromStock}, dibutuhkan: ${item.quantity}`,
                    );
                }

                // Kurangi cabang asal
                const updatedFrom = await (tx as any).branchStock.update({
                    where: { branchId_productVariantId: { branchId: data.fromBranchId, productVariantId: item.productVariantId } },
                    data: { stock: { decrement: item.quantity } },
                });

                // Tambah cabang tujuan (upsert)
                const updatedTo = await (tx as any).branchStock.upsert({
                    where: { branchId_productVariantId: { branchId: data.toBranchId, productVariantId: item.productVariantId } },
                    update: { stock: { increment: item.quantity } },
                    create: { branchId: data.toBranchId, productVariantId: item.productVariantId, stock: item.quantity },
                });

                // Log movement OUT (cabang asal)
                await tx.stockMovement.create({
                    data: {
                        productVariantId: item.productVariantId,
                        type: 'OUT',
                        quantity: item.quantity,
                        reason: reasonOut,
                        balanceAfter: Number(updatedFrom.stock),
                        referenceId: refId,
                        branchId: data.fromBranchId,
                    } as any,
                });

                // Log movement IN (cabang tujuan)
                await tx.stockMovement.create({
                    data: {
                        productVariantId: item.productVariantId,
                        type: 'IN',
                        quantity: item.quantity,
                        reason: reasonIn,
                        balanceAfter: Number(updatedTo.stock),
                        referenceId: refId,
                        branchId: data.toBranchId,
                    } as any,
                });

                results.push({
                    productVariantId: item.productVariantId,
                    quantity: item.quantity,
                    fromBalance: Number(updatedFrom.stock),
                    toBalance: Number(updatedTo.stock),
                });
            }

            return {
                referenceId: refId,
                fromBranch: { id: fromBranch.id, name: fromBranch.name },
                toBranch: { id: toBranch.id, name: toBranch.name },
                notes: data.notes ?? null,
                items: results,
                createdAt: new Date(),
            };
        });
    }

    /**
     * List transfer history — join StockMovement rows yang reasonnya starts with "Transfer".
     * Owner: semua cabang. Staff: hanya yang menyentuh cabangnya (asal atau tujuan).
     */
    async listTransfers(branchCtx: BranchContext) {
        const where: any = {
            referenceId: { startsWith: 'transfer-' },
        };
        // Staff scope: hanya movement di cabangnya
        if (!branchCtx.isOwner && branchCtx.branchId != null) {
            where.branchId = branchCtx.branchId;
        }

        const movements = await this.prisma.stockMovement.findMany({
            where,
            include: {
                productVariant: {
                    select: { id: true, sku: true, variantName: true, product: { select: { name: true } } },
                },
            },
            orderBy: { date: 'desc' },
            take: 500,
        });

        // Group by referenceId
        const grouped = new Map<string, any>();
        for (const m of movements) {
            const key = m.referenceId!;
            if (!grouped.has(key)) {
                grouped.set(key, { referenceId: key, date: m.date, items: [] as any[] });
            }
            grouped.get(key).items.push({
                type: m.type,
                productVariantId: m.productVariantId,
                variant: (m as any).productVariant,
                branchId: (m as any).branchId,
                quantity: m.quantity,
                reason: m.reason,
            });
        }
        return Array.from(grouped.values());
    }
}
