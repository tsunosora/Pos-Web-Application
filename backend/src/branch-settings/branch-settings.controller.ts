import { Controller, Get, Put, Param, ParseIntPipe, Body, Req, UseGuards } from '@nestjs/common';
import { BranchSettingsService } from './branch-settings.service';
import type { BranchSettingsPayload } from './branch-settings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ManagerGuard, isManagerLevelRole } from '../auth/role-groups';
import { CurrentBranch } from '../common/branch-context.decorator';
import type { BranchContext } from '../common/branch-context.decorator';

@UseGuards(JwtAuthGuard)
@Controller('branch-settings')
export class BranchSettingsController {
    constructor(private readonly service: BranchSettingsService) { }

    // GET dipakai POS (kop & kaki nota) oleh semua staf — tapi PIN papan kerja
    // cabang hanya untuk setingkat manajer.
    @Get(':branchId')
    async getOne(
        @Param('branchId', ParseIntPipe) branchId: number,
        @CurrentBranch() branchCtx: BranchContext,
        @Req() req: any,
    ) {
        const r: any = await this.service.getOne(branchId, branchCtx);
        if (r?.settings && !isManagerLevelRole(req.user?.roleName)) {
            return { ...r, settings: { ...r.settings, operatorPin: null } };
        }
        return r;
    }

    // PIN papan kerja & tarif titipan antar cabang: setingkat manajer (T-43).
    @Put(':branchId')
    @UseGuards(ManagerGuard)
    upsert(
        @Param('branchId', ParseIntPipe) branchId: number,
        @Body() body: BranchSettingsPayload,
        @CurrentBranch() branchCtx: BranchContext,
    ) {
        return this.service.upsert(branchId, body, branchCtx);
    }
}
