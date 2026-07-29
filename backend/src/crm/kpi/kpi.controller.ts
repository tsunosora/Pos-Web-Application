import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentBranch } from '../../common/branch-context.decorator';
import type { BranchContext } from '../../common/branch-context.decorator';
import { KpiPeriod, KpiService } from './kpi.service';
import type { KpiDivision } from './kpi.service';

/**
 * Override cabang dari query (?branchId=) — HANYA untuk Owner/SuperAdmin;
 * staff tetap terkunci di cabang miliknya (query diabaikan).
 * `branchId=all` → mode semua cabang.
 */
function scopeBranch(ctx: BranchContext, branchId?: string): BranchContext {
    if (!ctx.isOwner || branchId === undefined || branchId === '') return ctx;
    if (branchId.toLowerCase() === 'all') return { ...ctx, branchId: null };
    const n = parseInt(branchId, 10);
    return Number.isFinite(n) ? { ...ctx, branchId: n } : ctx;
}

function parseId(raw?: string): number | undefined {
    const n = raw ? parseInt(raw, 10) : undefined;
    return Number.isFinite(n) ? n : undefined;
}

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
        @Query('branchId') branchId?: string,
        @Query('csId') csId?: string,
    ) {
        return this.kpi.report(scopeBranch(ctx, branchId), {
            period: (period as KpiPeriod) || 'month',
            start,
            end,
        }, parseId(csId));
    }

    @Get('product-trend')
    productTrend(
        @CurrentBranch() ctx: BranchContext,
        @Query('period') period?: string,
        @Query('start') start?: string,
        @Query('end') end?: string,
        @Query('csId') csId?: string,
        @Query('branchId') branchId?: string,
    ) {
        return this.kpi.productTrend(
            scopeBranch(ctx, branchId),
            { period: (period as KpiPeriod) || 'month', start, end },
            parseId(csId),
        );
    }

    @Get('designer-leaderboard')
    designerLeaderboard(
        @CurrentBranch() ctx: BranchContext,
        @Query('period') period?: string,
        @Query('start') start?: string,
        @Query('end') end?: string,
        @Query('branchId') branchId?: string,
    ) {
        return this.kpi.designerLeaderboard(scopeBranch(ctx, branchId), {
            period: (period as KpiPeriod) || 'month',
            start,
            end,
        });
    }

    @Get('operator-leaderboard')
    operatorLeaderboard(
        @CurrentBranch() ctx: BranchContext,
        @Query('period') period?: string,
        @Query('start') start?: string,
        @Query('end') end?: string,
        @Query('branchId') branchId?: string,
    ) {
        return this.kpi.operatorLeaderboard(scopeBranch(ctx, branchId), {
            period: (period as KpiPeriod) || 'month',
            start,
            end,
        });
    }

    @Get('team-leaderboard')
    teamLeaderboard(
        @CurrentBranch() ctx: BranchContext,
        @Query('period') period?: string,
        @Query('start') start?: string,
        @Query('end') end?: string,
        @Query('branchId') branchId?: string,
    ) {
        return this.kpi.teamLeaderboard(scopeBranch(ctx, branchId), {
            period: (period as KpiPeriod) || 'month',
            start,
            end,
        });
    }

    @Get('design-output')
    designOutput(
        @CurrentBranch() ctx: BranchContext,
        @Query('period') period?: string,
        @Query('start') start?: string,
        @Query('end') end?: string,
        @Query('branchId') branchId?: string,
    ) {
        return this.kpi.designOutput(scopeBranch(ctx, branchId), {
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
        @Query('branchId') branchId?: string,
    ) {
        return this.kpi.csTrend(scopeBranch(ctx, branchId), { period: (period as KpiPeriod) || 'month', start, end });
    }

    @Get('designer-trend')
    designerTrend(
        @CurrentBranch() ctx: BranchContext,
        @Query('period') period?: string,
        @Query('start') start?: string,
        @Query('end') end?: string,
        @Query('branchId') branchId?: string,
    ) {
        return this.kpi.designerTrend(scopeBranch(ctx, branchId), { period: (period as KpiPeriod) || 'month', start, end });
    }

    /** Kirim pengumuman juara leaderboard ke Discord (manual / dipanggil terjadwal). */
    @Post('discord-recap')
    discordRecap(
        @CurrentBranch() ctx: BranchContext,
        @Query('period') period?: string,
        @Query('start') start?: string,
        @Query('end') end?: string,
    ) {
        return this.kpi.sendChampionRecap(ctx, {
            period: (period as KpiPeriod) || 'week',
            start,
            end,
        });
    }

    @Get('source-breakdown')
    sourceBreakdown(
        @CurrentBranch() ctx: BranchContext,
        @Query('period') period?: string,
        @Query('start') start?: string,
        @Query('end') end?: string,
        @Query('csId') csId?: string,
        @Query('status') status?: string,
        @Query('branchId') branchId?: string,
    ) {
        const statuses = status ? status.split(',').map(s => s.trim()).filter(Boolean) : undefined;
        return this.kpi.sourceBreakdown(
            scopeBranch(ctx, branchId),
            { period: (period as KpiPeriod) || 'month', start, end },
            {
                csId: parseId(csId),
                statuses,
            },
        );
    }

    /** Drill-down rincian satu angka leaderboard (untuk modal detail). */
    @Get('detail')
    detail(
        @CurrentBranch() ctx: BranchContext,
        @Query('division') division?: string,
        @Query('metric') metric?: string,
        @Query('userId') userId?: string,
        @Query('metricId') metricId?: string,
        @Query('period') period?: string,
        @Query('start') start?: string,
        @Query('end') end?: string,
        @Query('branchId') branchId?: string,
    ) {
        return this.kpi.detail(
            scopeBranch(ctx, branchId),
            { period: (period as KpiPeriod) || 'month', start, end },
            {
                division: (division as KpiDivision) || 'cs',
                metric: metric || 'leads',
                userId: parseId(userId) ?? 0,
                metricId: parseId(metricId),
            },
        );
    }
}
