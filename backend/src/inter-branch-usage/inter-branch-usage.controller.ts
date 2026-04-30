import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentBranch } from '../common/branch-context.decorator';
import type { BranchContext } from '../common/branch-context.decorator';
import { InterBranchUsageService } from './inter-branch-usage.service';

@UseGuards(JwtAuthGuard)
@Controller('reports/inter-branch-usage')
export class InterBranchUsageController {
    constructor(private readonly service: InterBranchUsageService) { }

    @Get()
    report(
        @CurrentBranch() ctx: BranchContext,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Query('productionBranchId') productionBranchIdParam?: string,
    ) {
        const productionBranchId = productionBranchIdParam
            ? parseInt(productionBranchIdParam, 10)
            : undefined;
        return this.service.report(ctx, {
            startDate: startDate || undefined,
            endDate: endDate || undefined,
            productionBranchId: Number.isFinite(productionBranchId as number) ? productionBranchId : undefined,
        });
    }
}
