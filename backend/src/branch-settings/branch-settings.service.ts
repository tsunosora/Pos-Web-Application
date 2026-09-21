import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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

        // Hanya kolom formulir. Dulu isi body diteruskan mentah — termasuk `branchId` (menulis/memindah
        // pengaturan ke cabang lain) dan fee titipan tanpa batas (cabang pelaksana bisa menagih 10×).
        const KOLOM_TEKS = ['waReportGroupId', 'waDesignGroupId', 'storeName', 'storeAddress', 'storePhone', 'notaHeader', 'notaFooter', 'logoUrl'] as const;
        const data: any = {};
        for (const k of KOLOM_TEKS) {
            const v = (payload as any)?.[k];
            if (v !== undefined) data[k] = v == null ? null : String(v).slice(0, 2000);
        }
        if (payload?.operatorPin !== undefined) {
            const pin = payload.operatorPin == null ? null : String(payload.operatorPin).trim();
            if (pin && !/^\d{4,8}$/.test(pin)) throw new BadRequestException('PIN cabang harus 4–8 angka.');
            data.operatorPin = pin || null;
        }
        if (payload?.waBroadcastGroups !== undefined) {
            data.waBroadcastGroups = Array.isArray(payload.waBroadcastGroups)
                ? payload.waBroadcastGroups.map((g) => String(g).trim()).filter(Boolean).slice(0, 50)
                : null;
        }
        if (payload?.titipanFeePercent !== undefined) {
            const f = payload.titipanFeePercent == null ? null : Number(payload.titipanFeePercent);
            if (f != null && (!Number.isFinite(f) || f < 0 || f > 100)) throw new BadRequestException('Fee titipan harus 0–100%.');
            data.titipanFeePercent = f;
        }

        const result = await (this.prisma as any).branchSettings.upsert({
            where: { branchId },
            create: { branchId, ...data },
            update: data,
        });
        return result;
    }
}
