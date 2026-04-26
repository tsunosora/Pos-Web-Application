import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { BranchContext } from '../common/branch-context.decorator';

/**
 * BranchStockService — sumber kebenaran stok per (cabang × variant).
 *
 * Strategi: BranchStock authoritative, ProductVariant.stock = cache agregat (sum semua cabang).
 * Helper di sini dipanggil dari transactions/stock-purchase/transfer untuk menjaga konsistensi.
 */
@Injectable()
export class BranchStockService {
    constructor(private prisma: PrismaService) {}

    /**
     * Get stok 1 variant di 1 cabang. Return 0 kalau row belum ada.
     */
    async getStock(branchId: number, productVariantId: number): Promise<number> {
        const row = await (this.prisma as any).branchStock.findUnique({
            where: { branchId_productVariantId: { branchId, productVariantId } },
        });
        return row ? Number(row.stock) : 0;
    }

    /**
     * List stok untuk 1 cabang (semua variant). Owner mode "Semua Cabang" → list semua.
     */
    async listForBranch(ctx: BranchContext) {
        const where = ctx.branchId != null ? { branchId: ctx.branchId } : {};
        return (this.prisma as any).branchStock.findMany({
            where,
            include: {
                productVariant: {
                    include: {
                        product: { select: { id: true, name: true, pricingMode: true, trackStock: true } },
                    },
                },
                branch: { select: { id: true, name: true, code: true } },
            },
            orderBy: { id: 'desc' },
        });
    }

    /**
     * List stok semua variant di semua cabang (matrix view) — Owner only.
     */
    async matrixView() {
        const branches = await (this.prisma as any).companyBranch.findMany({
            where: { isActive: true },
            select: { id: true, name: true, code: true },
            orderBy: { name: 'asc' },
        });
        const variants = await (this.prisma as any).productVariant.findMany({
            include: {
                product: { select: { id: true, name: true, trackStock: true, pricingMode: true } },
            },
            orderBy: { id: 'asc' },
        });
        const stocks = await (this.prisma as any).branchStock.findMany();
        const stockMap = new Map<string, number>();
        for (const s of stocks) {
            stockMap.set(`${s.branchId}_${s.productVariantId}`, Number(s.stock));
        }
        return {
            branches,
            variants: variants.map((v: any) => ({
                id: v.id,
                sku: v.sku,
                name: v.product?.name,
                variantName: v.variantName,
                pricingMode: v.product?.pricingMode,
                aggregateStock: Number(v.stock),
                perBranch: branches.map((b: any) => ({
                    branchId: b.id,
                    stock: stockMap.get(`${b.id}_${v.id}`) ?? 0,
                })),
            })),
        };
    }

    /**
     * Set absolute stock value (untuk opname / adjust manual).
     * Wajib dipanggil di dalam transaksi Prisma kalau perlu konsistensi.
     */
    async setStockTx(tx: any, branchId: number, productVariantId: number, newStock: number) {
        return tx.branchStock.upsert({
            where: { branchId_productVariantId: { branchId, productVariantId } },
            update: { stock: newStock },
            create: { branchId, productVariantId, stock: newStock },
        });
    }

    /**
     * Increment stok cabang. Bikin row baru kalau belum ada.
     */
    async incrementTx(tx: any, branchId: number, productVariantId: number, qty: number) {
        if (qty <= 0) return;
        return tx.branchStock.upsert({
            where: { branchId_productVariantId: { branchId, productVariantId } },
            update: { stock: { increment: qty } },
            create: { branchId, productVariantId, stock: qty },
        });
    }

    /**
     * Decrement stok cabang. Validasi: stok tidak boleh minus.
     * Kalau row belum ada → error karena artinya cabang ini tidak punya stok.
     */
    async decrementTx(
        tx: any,
        branchId: number,
        productVariantId: number,
        qty: number,
        opts: { allowNegative?: boolean } = {},
    ) {
        if (qty <= 0) return;
        const existing = await tx.branchStock.findUnique({
            where: { branchId_productVariantId: { branchId, productVariantId } },
        });
        const current = existing ? Number(existing.stock) : 0;
        if (!opts.allowNegative && current < qty) {
            throw new BadRequestException(
                `Stok cabang tidak cukup (tersedia: ${current}, dibutuhkan: ${qty}). Lakukan transfer stok dari cabang lain dulu.`,
            );
        }
        if (existing) {
            return tx.branchStock.update({
                where: { id: existing.id },
                data: { stock: current - qty },
            });
        }
        return tx.branchStock.create({
            data: { branchId, productVariantId, stock: -qty },
        });
    }

    /**
     * Manual adjust (untuk admin) — set absolute value, bikin StockMovement.
     */
    async adjustStock(branchId: number, productVariantId: number, newStock: number, reason?: string) {
        if (newStock < 0) throw new BadRequestException('Stok tidak boleh negatif');
        const variant = await (this.prisma as any).productVariant.findUnique({
            where: { id: productVariantId },
        });
        if (!variant) throw new NotFoundException('Variant tidak ditemukan');

        return this.prisma.$transaction(async (tx: any) => {
            const before = await tx.branchStock.findUnique({
                where: { branchId_productVariantId: { branchId, productVariantId } },
            });
            const previous = before ? Number(before.stock) : 0;
            const delta = newStock - previous;
            await this.setStockTx(tx, branchId, productVariantId, newStock);
            // Update aggregate cache
            await tx.productVariant.update({
                where: { id: productVariantId },
                data: { stock: { increment: delta } },
            });
            await tx.stockMovement.create({
                data: {
                    productVariantId,
                    type: 'ADJUST',
                    quantity: Math.abs(delta),
                    reason: reason || 'Adjust manual',
                    balanceAfter: newStock,
                    branchId,
                },
            });
            return { previous, current: newStock, delta };
        });
    }
}
