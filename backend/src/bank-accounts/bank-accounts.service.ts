import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BranchContext } from '../common/branch-context.decorator';
import { branchWhere, requireBranch, assertBranchAccess } from '../common/branch-where.helper';

@Injectable()
export class BankAccountsService {
    constructor(private prisma: PrismaService) { }

    async findAll(branchCtx: BranchContext) {
        return this.prisma.bankAccount.findMany({
            where: { ...branchWhere(branchCtx) } as any,
            orderBy: { createdAt: 'asc' },
        });
    }

    async create(
        data: { bankName: string; accountNumber: string; accountOwner: string; isActive?: boolean },
        branchCtx: BranchContext,
    ) {
        const branchId = requireBranch(branchCtx);
        return this.prisma.bankAccount.create({ data: { ...data, branchId } as any });
    }

    async update(
        id: number,
        data: { bankName?: string; accountNumber?: string; accountOwner?: string; isActive?: boolean },
        branchCtx: BranchContext,
    ) {
        const existing = await this.prisma.bankAccount.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException('Rekening tidak ditemukan');
        assertBranchAccess(branchCtx, (existing as any).branchId ?? null);
        return this.prisma.bankAccount.update({ where: { id }, data });
    }

    async resetBalance(id: number, newBalance: number, branchCtx: BranchContext) {
        const existing = await this.prisma.bankAccount.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException('Rekening tidak ditemukan');
        assertBranchAccess(branchCtx, (existing as any).branchId ?? null);
        return this.prisma.bankAccount.update({
            where: { id },
            data: { currentBalance: newBalance },
        });
    }

    async remove(id: number, branchCtx: BranchContext) {
        const existing = await this.prisma.bankAccount.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException('Rekening tidak ditemukan');
        assertBranchAccess(branchCtx, (existing as any).branchId ?? null);
        return this.prisma.bankAccount.delete({ where: { id } });
    }
}
