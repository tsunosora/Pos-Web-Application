import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentBranch } from '../../common/branch-context.decorator';
import type { BranchContext } from '../../common/branch-context.decorator';
import { KpiPeriod, KpiService } from './kpi.service';

@UseGuards(JwtAuthGuard)
@Controller('crm/kpi')
export class KpiController {
    constructor(private readonly kpi: KpiService) {}

    @Get()
    report(
        @CurrentBranch() ctx: BranchContext,
        @Query('period') period?: string,
        @Query('start') start?: string,
        @Query('end') end?: string,
    ) {
        return this.kpi.report(ctx, {
            period: (period as KpiPeriod) || 'month',
            start,
            end,
        });
    }
}
