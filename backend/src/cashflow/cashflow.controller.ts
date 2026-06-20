import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { CashflowService } from './cashflow.service';
import { Prisma } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentBranch } from '../common/branch-context.decorator';
import type { BranchContext } from '../common/branch-context.decorator';

/** Parse query param numerik (bankAccountId/categoryId) → number | undefined (kosong = semua). */
function parseIntParam(v?: string): number | undefined {
    if (v == null || v === '') return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
}

@UseGuards(JwtAuthGuard)
@Controller('cashflow')
export class CashflowController {
    constructor(private readonly cashflowService: CashflowService) { }

    @Post()
    create(
        @Body() createData: Prisma.CashflowCreateInput,
        @Request() req: any,
        @CurrentBranch() branchCtx: BranchContext,
    ) {
        return this.cashflowService.create({
            ...createData,
            user: { connect: { id: req.user.userId } },
        }, branchCtx);
    }

    @Get()
    findAll(
        @CurrentBranch() branchCtx: BranchContext,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Query('bankAccountId') bankAccountId?: string,
        @Query('paymentMethod') paymentMethod?: string,
        @Query('categoryId') categoryId?: string,
    ) {
        return this.cashflowService.findAll(branchCtx, startDate, endDate, parseIntParam(bankAccountId), paymentMethod, parseIntParam(categoryId));
    }

    @Get('monthly-trend')
    getMonthlyTrend(@CurrentBranch() branchCtx: BranchContext) {
        return this.cashflowService.getMonthlyTrend(branchCtx);
    }

    // Ringkasan per rekening: saldo tercatat + total masuk/keluar pada periode.
    @Get('bank-accounts-summary')
    getBankAccountsSummary(
        @CurrentBranch() branchCtx: BranchContext,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        return this.cashflowService.getBankAccountsSummary(branchCtx, startDate, endDate);
    }

    @Get('category-breakdown')
    getCategoryBreakdown(
        @CurrentBranch() branchCtx: BranchContext,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Query('bankAccountId') bankAccountId?: string,
        @Query('paymentMethod') paymentMethod?: string,
    ) {
        return this.cashflowService.getCategoryBreakdown(branchCtx, startDate, endDate, parseIntParam(bankAccountId), paymentMethod);
    }

    @Get('platform-breakdown')
    getPlatformBreakdown(
        @CurrentBranch() branchCtx: BranchContext,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        return this.cashflowService.getPlatformBreakdown(branchCtx, startDate, endDate);
    }

    @Patch(':id')
    update(
        @Param('id') id: string,
        @Body() data: {
            category?: string;
            amount?: number;
            note?: string;
            platformSource?: string | null;
            paymentMethod?: string | null;
            bankAccountId?: number | null;
        },
        @CurrentBranch() branchCtx: BranchContext,
    ) {
        return this.cashflowService.update(+id, data, branchCtx);
    }

    @Delete(':id')
    remove(@Param('id') id: string, @CurrentBranch() branchCtx: BranchContext) {
        return this.cashflowService.remove(+id, branchCtx);
    }
}
