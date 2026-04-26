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

        // Enrich movements dengan transaction info supaya kolom Keterangan di /reports/stock
        // bisa render link ke nota + nama customer + badge titipan.
        // Sumber referenceId yang kita resolve:
        //   "tx-<invoiceNumber>"     → checkout / edit / hapus dari transactions.service
        //   "JOB-<date>-<seq>"       → Mulai Job di production.service (lookup via ProductionJob → transactionItem → transaction)
        //   "BATCH-<seq>"            → Gabung Cetak (batch) — lookup pertama job di batch
        const refs = Array.from(new Set(
            movements
                .map(m => (m as any).referenceId)
                .filter((r: any) => typeof r === 'string' && r.length > 0),
        ));
        const txInvoices = refs.filter(r => r.startsWith('tx-')).map(r => r.slice(3));
        const jobNumbers = refs.filter(r => r.startsWith('JOB-'));
        // Lookup transaction by invoiceNumber
        const txByInvoice = new Map<string, any>();
        if (txInvoices.length) {
            const txs = await (this.prisma as any).transaction.findMany({
                where: { invoiceNumber: { in: txInvoices } },
                select: {
                    id: true, invoiceNumber: true, checkoutNumber: true, customerName: true,
                    branchId: true, productionBranchId: true,
                    branch: { select: { id: true, name: true, code: true } },
                    productionBranch: { select: { id: true, name: true, code: true } },
                },
            });
            for (const t of txs) txByInvoice.set(t.invoiceNumber, t);
        }
        // Lookup transaction by job number
        const txByJob = new Map<string, any>();
        if (jobNumbers.length) {
            const jobs: any[] = await (this.prisma as any).productionJob.findMany({
                where: { jobNumber: { in: jobNumbers } },
                select: {
                    jobNumber: true,
                    transaction: {
                        select: {
                            id: true, invoiceNumber: true, checkoutNumber: true, customerName: true,
                            branchId: true, productionBranchId: true,
                            branch: { select: { id: true, name: true, code: true } },
                            productionBranch: { select: { id: true, name: true, code: true } },
                        },
                    },
                },
            });
            for (const j of jobs) {
                if (j.transaction) txByJob.set(j.jobNumber, j.transaction);
            }
        }
        const enriched = movements.map((m: any) => {
            const ref: string | null = m.referenceId ?? null;
            let tx: any = null;
            let deletedTxInvoice: string | null = null;
            if (ref) {
                if (ref.startsWith('tx-')) {
                    const inv = ref.slice(3);
                    tx = txByInvoice.get(inv) ?? null;
                    if (!tx) deletedTxInvoice = inv; // transaksi sudah dihapus — info ada di reason text
                } else if (ref.startsWith('JOB-')) {
                    tx = txByJob.get(ref) ?? null;
                }
            }
            if (tx) {
                const isTitipan = tx.productionBranchId != null && tx.productionBranchId !== tx.branchId;
                tx = { ...tx, isTitipan };
            }
            return { ...m, transaction: tx, deletedTxInvoice };
        });

        const summary = {
            totalIn:     movements.filter(m => m.type === 'IN').reduce((s, m) => s + Number(m.quantity), 0),
            totalOut:    movements.filter(m => m.type === 'OUT').reduce((s, m) => s + Number(m.quantity), 0),
            totalAdjust: movements.filter(m => m.type === 'ADJUST').length,
            count:       movements.length,
        };

        return { movements: enriched, summary };
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
