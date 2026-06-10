import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { BranchContext } from '../common/branch-context.decorator';
import { branchWhere, requireBranch, assertBranchAccess } from '../common/branch-where.helper';

@Injectable()
export class BatchesService {
    constructor(private prisma: PrismaService) { }

    async create(data: any, branchCtx?: BranchContext) {
        // Stempel cabang pembuat. Owner mode "Semua Cabang" wajib pilih cabang dulu.
        const branchId = branchCtx ? requireBranch(branchCtx) : (data.branchId ?? null);
        return this.prisma.batch.create({ data: { ...data, branchId } });
    }

    async findAll(branchCtx?: BranchContext) {
        return this.prisma.batch.findMany({
            where: { ...(branchCtx ? branchWhere(branchCtx) : {}) },
            include: { productVariant: { include: { product: true } } },
        });
    }

    async findOne(id: number, branchCtx?: BranchContext) {
        const batch = await this.prisma.batch.findUnique({
            where: { id },
            include: { productVariant: { include: { product: true } } }
        });
        if (!batch) throw new NotFoundException('Batch not found');
        if (branchCtx) assertBranchAccess(branchCtx, (batch as any).branchId ?? null);
        return batch;
    }

    async update(id: number, data: any, branchCtx?: BranchContext) {
        await this.findOne(id, branchCtx);
        // Jangan biarkan branchId dipindah lewat update biasa
        const { branchId: _ignore, ...rest } = data ?? {};
        return this.prisma.batch.update({ where: { id }, data: rest });
    }

    async remove(id: number, branchCtx?: BranchContext) {
        await this.findOne(id, branchCtx);
        return this.prisma.batch.delete({ where: { id } });
    }
}
