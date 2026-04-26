import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MovementType } from '@prisma/client';
import { BranchContext } from '../common/branch-context.decorator';
import { branchWhere, requireBranch } from '../common/branch-where.helper';

@Injectable()
export class StockMovementsService {
    constructor(private prisma: PrismaService) { }

    async create(
        data: { productVariantId: number; type: MovementType; quantity: number; reason?: string },
        branchCtx: BranchContext,
    ) {
        const branchId = requireBranch(branchCtx);
        return this.prisma.$transaction(async (tx) => {
            const variant = await tx.productVariant.findUnique({ where: { id: data.productVariantId } });
            if (!variant) throw new NotFoundException('Product variant not found');

            // Ambil stok cabang (sumber kebenaran baru)
            const bs = await (tx as any).branchStock.findUnique({
                where: { branchId_productVariantId: { branchId, productVariantId: data.productVariantId } },
                select: { stock: true },
            });
            const currentBranchStock = Number(bs?.stock ?? 0);
            let newBranchStock = currentBranchStock;
            let globalDelta = 0; // untuk sync ProductVariant.stock cache

            if (data.type === 'IN') {
                newBranchStock = currentBranchStock + data.quantity;
                globalDelta = data.quantity;
            } else if (data.type === 'OUT') {
                if (currentBranchStock < data.quantity) {
                    throw new BadRequestException('Stok cabang ini tidak cukup untuk gerakan OUT.');
                }
                newBranchStock = currentBranchStock - data.quantity;
                globalDelta = -data.quantity;
            } else if (data.type === 'ADJUST') {
                newBranchStock = data.quantity;
                globalDelta = data.quantity - currentBranchStock;
            }

            // Upsert BranchStock
            await (tx as any).branchStock.upsert({
                where: { branchId_productVariantId: { branchId, productVariantId: data.productVariantId } },
                update: { stock: newBranchStock },
                create: { branchId, productVariantId: data.productVariantId, stock: newBranchStock },
            });

            // Sync ProductVariant.stock cache (agregat)
            await tx.productVariant.update({
                where: { id: data.productVariantId },
                data: { stock: { increment: globalDelta } },
            });

            return tx.stockMovement.create({
                data: { ...data, branchId, balanceAfter: newBranchStock } as any,
            });
        });
    }

    async findAll(
        params: { startDate?: string; endDate?: string; type?: MovementType; search?: string },
        branchCtx: BranchContext,
    ) {
        const where: any = { ...branchWhere(branchCtx) };

        if (params?.startDate || params?.endDate) {
            where.createdAt = {};
            if (params.startDate) where.createdAt.gte = new Date(params.startDate + 'T00:00:00');
            if (params.endDate)   where.createdAt.lte = new Date(params.endDate   + 'T23:59:59');
        }

        if (params?.type) where.type = params.type;

        if (params?.search) {
            where.productVariant = {
                OR: [
                    { sku: { contains: params.search } },
                    { variantName: { contains: params.search } },
                    { product: { name: { contains: params.search } } },
                ],
            };
        }

        const movements = await this.prisma.stockMovement.findMany({
            where,
            include: { productVariant: { include: { product: true } } },
            orderBy: { createdAt: 'desc' },
            take: 1000,
        });

        const summary = {
            totalIn:     movements.filter(m => m.type === 'IN').reduce((s, m) => s + Number(m.quantity), 0),
            totalOut:    movements.filter(m => m.type === 'OUT').reduce((s, m) => s + Number(m.quantity), 0),
            totalAdjust: movements.filter(m => m.type === 'ADJUST').length,
            count:       movements.length,
        };

        return { movements, summary };
    }

    async findOne(id: number) {
        const movement = await this.prisma.stockMovement.findUnique({
            where: { id },
            include: { productVariant: { include: { product: true } } }
        });
        if (!movement) throw new NotFoundException('Stock movement not found');
        return movement;
    }

    async findWasteByVariantSince(variantId: number, since: Date) {
        return this.prisma.stockMovement.findMany({
            where: {
                productVariantId: variantId,
                type: 'OUT',
                reason: { startsWith: 'Susut:' },
                date: { gte: since },
            },
            orderBy: { date: 'desc' },
            select: { id: true, quantity: true, reason: true, date: true },
        });
    }
}
