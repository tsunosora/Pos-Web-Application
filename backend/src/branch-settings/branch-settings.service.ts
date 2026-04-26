import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { BranchContext } from '../common/branch-context.decorator';
import { assertBranchAccess } from '../common/branch-where.helper';

export interface BranchSettingsPayload {
    operatorPin?: string | null;
    waReportGroupId?: string | null;
    waBroadcastGroups?: string[] | null;
    waDesignGroupId?: string | null;
    storeName?: string | null;
    storeAddress?: string | null;
    storePhone?: string | null;
    notaHeader?: string | null;
    notaFooter?: string | null;
    logoUrl?: string | null;
    titipanFeePercent?: number | null;
}

@Injectable()
export class BranchSettingsService {
    constructor(private prisma: PrismaService) { }

    async getOne(branchId: number, branchCtx: BranchContext) {
        assertBranchAccess(branchCtx, branchId);
        const branch = await this.prisma.companyBranch.findUnique({ where: { id: branchId } });
        if (!branch) throw new NotFoundException('Cabang tidak ditemukan');

        const settings = await (this.prisma as any).branchSettings.findUnique({
            where: { branchId },
        });
        return {
            branchId,
            branchName: branch.name,
            branchCode: (branch as any).code ?? null,
            settings: settings ?? null,
        };
    }

    async upsert(branchId: number, payload: BranchSettingsPayload, branchCtx: BranchContext) {
        assertBranchAccess(branchCtx, branchId);
        const branch = await this.prisma.companyBranch.findUnique({ where: { id: branchId } });
        if (!branch) throw new NotFoundException('Cabang tidak ditemukan');

        const data: any = {};
        for (const [k, v] of Object.entries(payload)) {
            if (v !== undefined) data[k] = v;
        }

        const result = await (this.prisma as any).branchSettings.upsert({
            where: { branchId },
            create: { branchId, ...data },
            update: data,
        });
        return result;
    }
}
