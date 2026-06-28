import { Controller, Get, Post, Patch, Delete, Body, Param, ParseIntPipe, UseGuards, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentBranch } from '../common/branch-context.decorator';
import type { BranchContext } from '../common/branch-context.decorator';
import { FixedExpensesService } from './fixed-expenses.service';

/**
 * Beban tetap bulanan — OWNER ONLY. Hanya pemilik yang boleh lihat & atur
 * (gaji, sewa, angsuran, supplier). Dipakai di Dashboard Owner.
 */
@UseGuards(JwtAuthGuard)
@Controller('fixed-expenses')
export class FixedExpensesController {
    constructor(private readonly svc: FixedExpensesService) {}

    private assertOwner(ctx: BranchContext) {
        if (!ctx.isOwner) throw new ForbiddenException('Hanya owner yang boleh mengakses beban tetap.');
    }

    @Get()
    findAll(@CurrentBranch() ctx: BranchContext) {
        this.assertOwner(ctx);
        return this.svc.findAll();
    }

    @Post()
    create(@CurrentBranch() ctx: BranchContext, @Body() body: any) {
        this.assertOwner(ctx);
        return this.svc.create(body);
    }

    @Patch(':id')
    update(@CurrentBranch() ctx: BranchContext, @Param('id', ParseIntPipe) id: number, @Body() body: any) {
        this.assertOwner(ctx);
        return this.svc.update(id, body);
    }

    @Delete(':id')
    remove(@CurrentBranch() ctx: BranchContext, @Param('id', ParseIntPipe) id: number) {
        this.assertOwner(ctx);
        return this.svc.remove(id);
    }
}
