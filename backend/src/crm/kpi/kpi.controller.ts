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

    @Get('product-trend')
    productTrend(
        @CurrentBranch() ctx: BranchContext,
        @Query('period') period?: string,
        @Query('start') start?: string,
        @Query('end') end?: string,
        @Query('csId') csId?: string,
    ) {
        const parsedCsId = csId ? parseInt(csId, 10) : undefined;
        return this.kpi.productTrend(
            ctx,
            { period: (period as KpiPeriod) || 'month', start, end },
            Number.isFinite(parsedCsId) ? parsedCsId : undefined,
        );
    }

    @Get('designer-leaderboard')
    designerLeaderboard(
        @CurrentBranch() ctx: BranchContext,
        @Query('period') period?: string,
        @Query('start') start?: string,
        @Query('end') end?: string,
    ) {
        return this.kpi.designerLeaderboard(ctx, {
            period: (period as KpiPeriod) || 'month',
            start,
            end,
        });
    }

    @Get('cs-trend')
    csTrend(
        @CurrentBranch() ctx: BranchContext,
        @Query('period') period?: string,
        @Query('start') start?: string,
        @Query('end') end?: string,
    ) {
        return this.kpi.csTrend(ctx, { period: (period as KpiPeriod) || 'month', start, end });
    }

    @Get('designer-trend')
    designerTrend(
        @CurrentBranch() ctx: BranchContext,
        @Query('period') period?: string,
        @Query('start') start?: string,
        @Query('end') end?: string,
    ) {
        return this.kpi.designerTrend(ctx, { period: (period as KpiPeriod) || 'month', start, end });
    }

    @Get('source-breakdown')
    sourceBreakdown(
        @CurrentBranch() ctx: BranchContext,
        @Query('period') period?: string,
        @Query('start') start?: string,
        @Query('end') end?: string,
        @Query('csId') csId?: string,
        @Query('status') status?: string,
    ) {
        const parsedCsId = csId ? parseInt(csId, 10) : undefined;
        const statuses = status ? status.split(',').map(s => s.trim()).filter(Boolean) : undefined;
        return this.kpi.sourceBreakdown(
            ctx,
            { period: (period as KpiPeriod) || 'month', start, end },
            {
                csId: Number.isFinite(parsedCsId) ? parsedCsId : undefined,
                statuses,
            },
        );
    }
}
