import { Controller, Get, Post, Patch, Body, UseInterceptors, UploadedFiles, Query, Param, ParseIntPipe, BadRequestException, UseGuards, Req } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ReportsService } from './reports.service';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { compressImage } from '../common/utils/compress-image.util';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ManagerGuard, Menu, MenuGuard, OwnerGuard } from '../auth/role-groups';
import { CurrentBranch } from '../common/branch-context.decorator';
import type { BranchContext } from '../common/branch-context.decorator';
import type { FinanceTimeframe } from './reports.service';
import { ymdLokal } from '../common/utils/tanggal.util';

export type StructuredExpenseItem = { name: string; amount: number };
export type StructuredExpenses = Record<string, StructuredExpenseItem[]>;
// e.g. { "CASH": [{name: "Beli gula", amount: 28000}], "BCA": [{...}] }

export type AdditionalIncomeItem = { bankName: string; amount: number; description: string };
export type PaymentExchangeItem = { from: string; to: string; amount: number; description: string };

// Define the payload for closing a shift
export class CloseShiftDto {
    adminName: string;
    shiftName: string;
    reportDate?: string;        // tanggal laporan WA (YYYY-MM-DD), opsional
    openedAt: Date | string;
    closedAt: Date | string;

    actualCash: number;
    actualQris: number;
    actualTransfer: number;
    expensesTotal: number;
    notes?: string;

    // Expected totals passed by the client
    expectedCash: number;
    expectedQris: number;
    expectedTransfer: number;
    // Angka dasar dari server yang dipakai halaman (sebelum penyesuaian setor/tarik/pengeluaran).
    // Server menghitung ulang dasar saat kirim & hanya memakai SELISIH penyesuaiannya.
    baseExpectedCash?: number;
    baseExpectedQris?: number;
    baseExpectedTransfer?: number;

    expectedBankBalances?: Record<string, number>;
    actualBankBalances?: Record<string, number>;   // Saldo Laporan mBanking
    realBankBalances?: Record<string, number>;     // Saldo Real di Bank
    shiftExpenses?: any[];
    structuredExpenses?: StructuredExpenses;       // Pengeluaran terstruktur per metode
    kasbon?: { name: string; amount: number; source?: string }[];  // Kasbon karyawan
    setorKas?: { bankName: string; amount: number }[];  // Setor kas ke rekening
    tarikTunai?: { bankName: string; amount: number }[]; // Tarik tunai dari rekening ke kas
    tukarTransferKeCash?: number; // Konversi transfer masuk menjadi kas fisik
    additionalIncomes?: AdditionalIncomeItem[]; // Pemasukan eksternal langsung ke rekening
    paymentExchanges?: PaymentExchangeItem[]; // Pertukaran antar metode (QRIS↔Tunai, titip transfer, dll)
}

// Izin per laporan (T-02, T-44):
// - current-shift, staff-list, close-shift, finance/daily-target-status: semua staf (alur tutup shift & banner target).
// - profit & shift-history: peran yang diberi menunya (Akses Menu Role).
// - laporan keuangan owner, tutup buku, koreksi shift: setingkat manajer; pindah dana antar cabang: owner.
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
    constructor(private readonly reportsService: ReportsService) { }

    @Get('current-shift')
    async getCurrentShift(@CurrentBranch() branchCtx: BranchContext) {
        return this.reportsService.calculateCurrentShiftExpectations(branchCtx);
    }

    @Get('profit')
    @Menu('/reports/profit')
    @UseGuards(MenuGuard)
    async getProfitReport(
        @CurrentBranch() branchCtx: BranchContext,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        return this.reportsService.getProfitReport(branchCtx, startDate, endDate);
    }

    @Get('orders-by-hour')
    @UseGuards(ManagerGuard)
    async getOrdersByHour(
        @CurrentBranch() branchCtx: BranchContext,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        return this.reportsService.getOrdersByHour(branchCtx, startDate, endDate);
    }

    @Get('closing')
    @UseGuards(ManagerGuard)
    async getMonthlyClosing(
        @CurrentBranch() branchCtx: BranchContext,
        @Query('year') year?: string,
        @Query('month') month?: string,
    ) {
        const now = new Date();
        const y = Number(year) || now.getFullYear();
        const m = Number(month) || (now.getMonth() + 1);
        return this.reportsService.monthlyClosing(branchCtx, y, m);
    }

    // ==================== ANALISA KEUANGAN (owner-only) ====================

    @Get('finance/candles')
    @UseGuards(ManagerGuard)
    async getFinanceCandles(
        @CurrentBranch() branchCtx: BranchContext,
        @Query('timeframe') timeframe: FinanceTimeframe = 'day',
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Query('includeFixed') includeFixed?: string,
    ) {
        const now = new Date();
        const iso = ymdLokal; // tanggal WIB — toISOString() menjadikan tgl 1 (00.00 WIB) = akhir bulan lalu
        const s = startDate || iso(new Date(now.getFullYear(), now.getMonth(), 1));
        const e = endDate || iso(now);
        const tf: FinanceTimeframe = (['day', 'week', 'month', 'year'] as const).includes(timeframe as any) ? timeframe : 'day';
        return this.reportsService.getFinanceCandles(branchCtx, tf, s, e, includeFixed !== 'false');
    }

    @Get('finance/heatmap')
    @UseGuards(ManagerGuard)
    async getFinanceHeatmap(
        @CurrentBranch() branchCtx: BranchContext,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        const now = new Date();
        const iso = ymdLokal; // tanggal WIB — toISOString() menjadikan tgl 1 (00.00 WIB) = akhir bulan lalu
        const s = startDate || iso(new Date(now.getFullYear(), now.getMonth(), 1));
        const e = endDate || iso(now);
        return this.reportsService.getFinanceHeatmap(branchCtx, s, e);
    }

    @Get('finance/journal')
    @UseGuards(ManagerGuard)
    async getFinanceJournal(
        @CurrentBranch() branchCtx: BranchContext,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Query('includeFixed') includeFixed?: string,
    ) {
        const now = new Date();
        const iso = ymdLokal; // tanggal WIB — toISOString() menjadikan tgl 1 (00.00 WIB) = akhir bulan lalu
        const s = startDate || iso(now);
        const e = endDate || iso(now);
        return this.reportsService.getFinanceJournal(branchCtx, s, e, includeFixed !== 'false');
    }

    @Get('finance/anomalies')
    @UseGuards(ManagerGuard)
    async getFinanceAnomalies(
        @CurrentBranch() branchCtx: BranchContext,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        const now = new Date();
        const iso = ymdLokal; // tanggal WIB — toISOString() menjadikan tgl 1 (00.00 WIB) = akhir bulan lalu
        const s = startDate || iso(new Date(now.getFullYear(), now.getMonth(), 1));
        const e = endDate || iso(now);
        return this.reportsService.getFinanceAnomalies(branchCtx, s, e);
    }

    @Get('finance/expense-breakdown')
    @UseGuards(ManagerGuard)
    async getFinanceExpenseBreakdown(
        @CurrentBranch() branchCtx: BranchContext,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Query('includeFixed') includeFixed?: string,
    ) {
        const now = new Date();
        const iso = ymdLokal; // tanggal WIB — toISOString() menjadikan tgl 1 (00.00 WIB) = akhir bulan lalu
        const s = startDate || iso(new Date(now.getFullYear(), now.getMonth(), 1));
        const e = endDate || iso(now);
        return this.reportsService.getFinanceExpenseBreakdown(branchCtx, s, e, includeFixed !== 'false');
    }

    @Get('finance/comparison')
    @UseGuards(ManagerGuard)
    async getFinanceComparison(
        @CurrentBranch() branchCtx: BranchContext,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Query('includeFixed') includeFixed?: string,
    ) {
        const now = new Date();
        const iso = ymdLokal; // tanggal WIB — toISOString() menjadikan tgl 1 (00.00 WIB) = akhir bulan lalu
        const s = startDate || iso(new Date(now.getFullYear(), now.getMonth(), 1));
        const e = endDate || iso(now);
        return this.reportsService.getFinanceComparison(branchCtx, s, e, includeFixed !== 'false');
    }

    @Get('finance/reconciliation')
    @UseGuards(ManagerGuard)
    async getFinanceReconciliation(
        @CurrentBranch() branchCtx: BranchContext,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        const now = new Date();
        const iso = ymdLokal; // tanggal WIB — toISOString() menjadikan tgl 1 (00.00 WIB) = akhir bulan lalu
        const s = startDate || iso(new Date(now.getFullYear(), now.getMonth(), 1));
        const e = endDate || iso(now);
        return this.reportsService.getFinanceReconciliation(branchCtx, s, e);
    }

    @Get('finance/consolidation')
    @UseGuards(ManagerGuard)
    async getFinanceConsolidation(
        @CurrentBranch() branchCtx: BranchContext,
        @Query('year') year?: string,
        @Query('month') month?: string,
    ) {
        const now = new Date();
        const y = Number(year) || now.getFullYear();
        const m = Number(month) || (now.getMonth() + 1);
        return this.reportsService.getFinanceConsolidation(branchCtx, y, m);
    }

    @Get('finance/monthly-report')
    @UseGuards(ManagerGuard)
    async getFinanceMonthlyReport(
        @CurrentBranch() branchCtx: BranchContext,
        @Query('year') year?: string,
        @Query('month') month?: string,
        @Query('includeFixed') includeFixed?: string,
    ) {
        const now = new Date();
        const y = Number(year) || now.getFullYear();
        const m = Number(month) || (now.getMonth() + 1);
        return this.reportsService.getFinanceMonthlyReport(branchCtx, y, m, includeFixed !== 'false');
    }

    @Get('finance/daily-target-status')
    getDailyTargetStatus(@CurrentBranch() branchCtx: BranchContext) {
        return this.reportsService.getDailyTargetStatus(branchCtx);
    }

    @Post('finance/close-branch')
    @UseGuards(OwnerGuard)
    async closeBranchBalance(
        @CurrentBranch() branchCtx: BranchContext,
        @Body() body: { year: number; month: number; branchId: number },
    ) {
        return this.reportsService.closeBranchBalance(branchCtx, Number(body.year), Number(body.month), Number(body.branchId));
    }

    @Post('finance/fund-branch')
    @UseGuards(OwnerGuard)
    async fundBranchBalance(
        @CurrentBranch() branchCtx: BranchContext,
        @Body() body: { year: number; month: number; branchId: number; allocations: { bankAccountId: number; amount: number }[] },
    ) {
        return this.reportsService.fundBranchBalance(branchCtx, Number(body.year), Number(body.month), Number(body.branchId), body.allocations || []);
    }

    @Get('finance/central-treasury')
    @UseGuards(ManagerGuard)
    async getCentralTreasury(
        @CurrentBranch() branchCtx: BranchContext,
        @Query('year') year?: string,
        @Query('month') month?: string,
    ) {
        const now = new Date();
        const y = Number(year) || now.getFullYear();
        const m = Number(month) || (now.getMonth() + 1);
        return this.reportsService.getCentralTreasury(branchCtx, y, m);
    }

    @Post('finance/central-expense')
    @UseGuards(OwnerGuard)
    async addCentralExpense(
        @CurrentBranch() branchCtx: BranchContext,
        @Body() body: { category: string; amount: number; note?: string; date?: string },
    ) {
        return this.reportsService.addCentralExpense(branchCtx, body.category, Number(body.amount), body.note, body.date);
    }

    // Endpoint untuk dropdown daftar staff/kasir
    @Get('staff-list')
    async getStaffList() {
        return this.reportsService.getStaffList();
    }

    @Post('close-shift')
    @UseInterceptors(
        FilesInterceptor('proofImages', 20, {
            storage: diskStorage({
                destination: './uploads/proofs',
                filename: (req, file, cb) => {
                    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
                    cb(null, `${file.fieldname}-${uniqueSuffix}${extname(file.originalname)}`);
                },
            }),
        }),
    )
    async closeShift(
        @Body() body: any,
        @UploadedFiles() files: Express.Multer.File[],
        @CurrentBranch() branchCtx: BranchContext,
    ) {
        const dto: CloseShiftDto = {
            adminName: body.adminName,
            shiftName: body.shiftName,
            reportDate: body.reportDate || undefined,
            openedAt: new Date(body.openedAt),
            closedAt: new Date(body.closedAt),
            actualCash: Number(body.actualCash),
            actualQris: Number(body.actualQris),
            actualTransfer: Number(body.actualTransfer),
            expensesTotal: Number(body.expensesTotal),
            notes: body.notes,
            expectedCash: Number(body.expectedCash),
            expectedQris: Number(body.expectedQris),
            expectedTransfer: Number(body.expectedTransfer),
            baseExpectedCash: body.baseExpectedCash != null && body.baseExpectedCash !== '' ? Number(body.baseExpectedCash) : undefined,
            baseExpectedQris: body.baseExpectedQris != null && body.baseExpectedQris !== '' ? Number(body.baseExpectedQris) : undefined,
            baseExpectedTransfer: body.baseExpectedTransfer != null && body.baseExpectedTransfer !== '' ? Number(body.baseExpectedTransfer) : undefined,
            expectedBankBalances: body.expectedBankBalances ? JSON.parse(body.expectedBankBalances) : undefined,
            actualBankBalances: body.actualBankBalances ? JSON.parse(body.actualBankBalances) : undefined,
            realBankBalances: body.realBankBalances ? JSON.parse(body.realBankBalances) : undefined,
            shiftExpenses: body.shiftExpenses ? JSON.parse(body.shiftExpenses) : undefined,
            structuredExpenses: body.structuredExpenses ? JSON.parse(body.structuredExpenses) : undefined,
            kasbon: body.kasbon ? JSON.parse(body.kasbon) : [],
            setorKas: body.setorKas ? JSON.parse(body.setorKas) : [],
            tarikTunai: body.tarikTunai ? JSON.parse(body.tarikTunai) : [],
            tukarTransferKeCash: Number(body.tukarTransferKeCash || 0),
            additionalIncomes: body.additionalIncomes ? JSON.parse(body.additionalIncomes) : [],
            paymentExchanges: body.paymentExchanges ? JSON.parse(body.paymentExchanges) : [],
        };

        const uploadedPaths = files ? files.map((f) => f.path) : [];

        if (files && files.length > 0) {
            await Promise.all(files.map(f => compressImage(f.path)));
        }

        return this.reportsService.closeShift(dto, uploadedPaths, branchCtx);
    }

    @Get('shift-history')
    @Menu('/reports/shift-history')
    @UseGuards(MenuGuard)
    async getShiftHistory(
        @CurrentBranch() branchCtx: BranchContext,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        return this.reportsService.getShiftHistory(branchCtx, Number(page || 1), Number(limit || 20));
    }

    @Post('shift/:id/resend')
    @Menu('/reports/shift-history')
    @UseGuards(MenuGuard)
    async resendShiftReport(@Param('id', ParseIntPipe) id: number) {
        return this.reportsService.resendShiftReport(id);
    }

    @Patch('shift/:id/amend')
    @UseGuards(ManagerGuard)
    async amendShiftReport(
        @Param('id', ParseIntPipe) id: number,
        @Req() req: any,
        @Body() body: {
            actualCash?: number;
            actualQris?: number;
            actualTransfer?: number;
            structuredExpenses?: any;
            kasbon?: any;
            setorKas?: any;
            tarikTunai?: any;
            additionalIncomes?: any;
            notes?: string;
            amendNote: string;
        },
    ) {
        if (!body.amendNote || !body.amendNote.trim()) {
            throw new BadRequestException('Catatan alasan koreksi wajib diisi.');
        }
        return this.reportsService.amendShiftReport(id, body, req.user?.userId ?? null);
    }
}
