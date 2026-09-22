import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { CashflowService } from './cashflow.service';
import { Prisma } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ManagerGuard, Menu, MenuGuard } from '../auth/role-groups';
import { CurrentBranch } from '../common/branch-context.decorator';
import type { BranchContext } from '../common/branch-context.decorator';

/** Parse query param numerik (bankAccountId/categoryId) → number | undefined (kosong = semua). */
function parseIntParam(v?: string): number | undefined {
    if (v == null || v === '') return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
}

// Halaman Kas saja (kasir & setingkat manajer; owner juga lewat dasbor). Dulu cukup login:
// akun desainer/operator bisa mencatat pengeluaran → ekspektasi kas laci shift terbuka berubah.
@UseGuards(JwtAuthGuard, MenuGuard)
@Menu('/cashflow')
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

    // Ubah/hapus entri langsung hanya setingkat manajer. Staf lain lewat
    // "Ajukan perubahan" (/cashflow-requests) yang harus disetujui (T-13).
    @Patch(':id')
    @UseGuards(ManagerGuard)
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
    @UseGuards(ManagerGuard)
    remove(@Param('id') id: string, @CurrentBranch() branchCtx: BranchContext, @Request() req: any) {
        return this.cashflowService.remove(+id, branchCtx, { userId: req.user?.userId, email: req.user?.email });
    }
}
