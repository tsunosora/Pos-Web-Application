import { Controller, Get, Post, Body, Query, UseGuards, ForbiddenException, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentBranch } from '../common/branch-context.decorator';
import type { BranchContext } from '../common/branch-context.decorator';
import { BonusService } from './bonus.service';

/** Bonus karyawan — OWNER ONLY (target, penyesuaian manual, pencapaian). */
@UseGuards(JwtAuthGuard)
@Controller('bonus')
export class BonusController {
    constructor(private readonly svc: BonusService) {}

    private assertOwner(ctx: BranchContext) {
        if (!ctx.isOwner) throw new ForbiddenException('Hanya owner yang boleh mengakses bonus.');
    }

    @Get('targets')
    listTargets(@CurrentBranch() ctx: BranchContext, @Query('branchId') branchId?: string) {
        this.assertOwner(ctx);
        const b = branchId ? Number(branchId) : undefined;
        return this.svc.listTargets(Number.isFinite(b) ? b : undefined);
    }

    @Post('targets')
    upsertTarget(@CurrentBranch() ctx: BranchContext, @Body() body: any) {
        this.assertOwner(ctx);
        return this.svc.upsertTarget(body);
    }

    @Post('adjustments')
    upsertAdjustment(@CurrentBranch() ctx: BranchContext, @Body() body: any) {
        this.assertOwner(ctx);
        return this.svc.upsertAdjustment(body);
    }

    @Get('achievement')
    achievement(@CurrentBranch() ctx: BranchContext, @Query('branchId') branchId?: string, @Query('month') month?: string) {
        this.assertOwner(ctx);
        const b = Number(branchId);
        if (!Number.isFinite(b)) throw new BadRequestException('branchId wajib diisi');
        return this.svc.achievement(b, month || '');
    }
}
