import { Controller, Get, Put, Param, ParseIntPipe, Body, UseGuards } from '@nestjs/common';
import { BranchSettingsService } from './branch-settings.service';
import type { BranchSettingsPayload } from './branch-settings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentBranch } from '../common/branch-context.decorator';
import type { BranchContext } from '../common/branch-context.decorator';

@UseGuards(JwtAuthGuard)
@Controller('branch-settings')
export class BranchSettingsController {
    constructor(private readonly service: BranchSettingsService) { }

    @Get(':branchId')
    getOne(
        @Param('branchId', ParseIntPipe) branchId: number,
        @CurrentBranch() branchCtx: BranchContext,
    ) {
        return this.service.getOne(branchId, branchCtx);
    }

    @Put(':branchId')
    upsert(
        @Param('branchId', ParseIntPipe) branchId: number,
        @Body() body: BranchSettingsPayload,
        @CurrentBranch() branchCtx: BranchContext,
    ) {
        return this.service.upsert(branchId, body, branchCtx);
    }
}
