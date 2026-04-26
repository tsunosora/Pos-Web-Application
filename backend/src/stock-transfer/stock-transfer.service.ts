import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BranchStockService } from '../branch-stock/branch-stock.service';
import type { BranchContext } from '../common/branch-context.decorator';

interface TransferItemInput {
    productVariantId: number;
    quantity: number;
    note?: string | null;
}

interface CreateTransferInput {
    fromBranchId: number;
    toBranchId: number;
    notes?: string | null;
    items: TransferItemInput[];
}

@Injectable()
export class StockTransferService {
    constructor(
        private prisma: PrismaService,
        private branchStock: BranchStockService,
    ) {}

    private async generateNumber(tx: any): Promise<string> {
        const today = new Date();
        const yyyymmdd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
        const prefix = `TRF-${yyyymmdd}-`;
        const lastToday = await tx.stockTransfer.findFirst({
            where: { transferNumber: { startsWith: prefix } },
            orderBy: { transferNumber: 'desc' },
            select: { transferNumber: true },
        });
        let nextSeq = 1;
        if (lastToday) {
            const lastSeq = parseInt(lastToday.transferNumber.split('-').pop() || '0', 10);
            nextSeq = (Number.isFinite(lastSeq) ? lastSeq : 0) + 1;
        }
        return `${prefix}${String(nextSeq).padStart(4, '0')}`;
    }

    async create(input: CreateTransferInput, ctx: BranchContext) {
        if (input.fromBranchId === input.toBranchId) {
            throw new BadRequestException('Cabang asal dan tujuan tidak boleh sama.');
        }
        if (!input.items?.length) {
            throw new BadRequestException('Minimal 1 item.');
        }
        // Validasi akses: staff hanya boleh transfer dari cabangnya sendiri.
        if (!ctx.isOwner && input.fromBranchId !== ctx.userBranchId) {
            throw new BadRequestException('Anda hanya bisa transfer stok dari cabang Anda sendiri.');
        }

        // Validasi cabang ada & aktif
        const [fromBranch, toBranch] = await Promise.all([
            (this.prisma as any).companyBranch.findUnique({ where: { id: input.fromBranchId } }),
            (this.prisma as any).companyBranch.findUnique({ where: { id: input.toBranchId } }),
        ]);
        if (!fromBranch) throw new NotFoundException('Cabang asal tidak ditemukan');
        if (!toBranch) throw new NotFoundException('Cabang tujuan tidak ditemukan');

        // Validasi tiap item: variant ada, stok cukup
        for (const it of input.items) {
            if (!it.productVariantId || !it.quantity || it.quantity <= 0) {
                throw new BadRequestException('Item tidak valid (variant & quantity > 0 wajib).');
            }
            const variant = await (this.prisma as any).productVariant.findUnique({
                where: { id: it.productVariantId },
                select: { id: true, sku: true, variantName: true, product: { select: { name: true, trackStock: true } } },
            });
            if (!variant) throw new NotFoundException(`Variant ID ${it.productVariantId} tidak ditemukan`);
            const available = await this.branchStock.getStock(input.fromBranchId, it.productVariantId);
            if (available < it.quantity) {
                throw new BadRequestException(
                    `Stok ${variant.product?.name} (${variant.sku}) di cabang ${fromBranch.name} hanya ${available}, tidak cukup untuk transfer ${it.quantity}.`,
                );
            }
        }

        return this.prisma.$transaction(async (tx: any) => {
            const transferNumber = await this.generateNumber(tx);
            const transfer = await tx.stockTransfer.create({
                data: {
                    transferNumber,
                    fromBranchId: input.fromBranchId,
                    toBranchId: input.toBranchId,
                    notes: input.notes?.trim() || null,
                    createdById: ctx.userBranchId != null ? null : null, // optional, bisa di-pass dari user nanti
                    items: {
                        create: input.items.map((it) => ({
                            productVariantId: it.productVariantId,
                            quantity: it.quantity,
                            note: it.note?.trim() || null,
                        })),
                    },
                },
                include: {
                    items: { include: { productVariant: { include: { product: true } } } },
                    fromBranch: true,
                    toBranch: true,
                },
            });

            for (const it of input.items) {
                await this.branchStock.decrementTx(tx, input.fromBranchId, it.productVariantId, it.quantity);
                await this.branchStock.incrementTx(tx, input.toBranchId, it.productVariantId, it.quantity);
                await tx.stockMovement.create({
                    data: {
                        productVariantId: it.productVariantId,
                        type: 'OUT',
                        quantity: it.quantity,
                        reason: `Transfer ke ${toBranch.name} (${transferNumber})`,
                        referenceId: transferNumber,
                        branchId: input.fromBranchId,
                    },
                });
                await tx.stockMovement.create({
                    data: {
                        productVariantId: it.productVariantId,
                        type: 'IN',
                        quantity: it.quantity,
                        reason: `Transfer dari ${fromBranch.name} (${transferNumber})`,
                        referenceId: transferNumber,
                        branchId: input.toBranchId,
                    },
                });
                // Aggregate cache (ProductVariant.stock) tidak berubah — total tetap sama setelah transfer.
            }

            return transfer;
        });
    }

    async list(ctx: BranchContext, opts: { limit?: number } = {}) {
        const limit = opts.limit ?? 50;
        // Staff: list semua transfer yang menyangkut cabangnya (in atau out).
        // Owner Semua Cabang: list semua. Owner pilih cabang: filter.
        let where: any = {};
        if (!ctx.isOwner && ctx.userBranchId != null) {
            where = { OR: [{ fromBranchId: ctx.userBranchId }, { toBranchId: ctx.userBranchId }] };
        } else if (ctx.branchId != null) {
            where = { OR: [{ fromBranchId: ctx.branchId }, { toBranchId: ctx.branchId }] };
        }
        return (this.prisma as any).stockTransfer.findMany({
            where,
            include: {
                fromBranch: { select: { id: true, name: true, code: true } },
                toBranch: { select: { id: true, name: true, code: true } },
                items: { include: { productVariant: { include: { product: { select: { name: true } } } } } },
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
    }

    async getById(id: number) {
        const transfer = await (this.prisma as any).stockTransfer.findUnique({
            where: { id },
            include: {
                fromBranch: true,
                toBranch: true,
                items: { include: { productVariant: { include: { product: true } } } },
            },
        });
        if (!transfer) throw new NotFoundException('Transfer tidak ditemukan');
        return transfer;
    }
}
