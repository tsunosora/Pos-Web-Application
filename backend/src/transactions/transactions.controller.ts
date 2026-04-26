import { Controller, Get, Post, Patch, Delete, Body, Param, ParseIntPipe, UseGuards, Query, Request } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { PaymentMethod } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentBranch } from '../common/branch-context.decorator';
import type { BranchContext } from '../common/branch-context.decorator';
import { requireBranch } from '../common/branch-where.helper';

@UseGuards(JwtAuthGuard)
@Controller('transactions')
export class TransactionsController {
    constructor(private readonly transactionsService: TransactionsService) { }

    @Post()
    create(@Body() createTransactionDto: {
        items: { productVariantId: number; quantity: number; widthCm?: number; heightCm?: number; unitType?: string; pcs?: number; note?: string; customPrice?: number }[];
        paymentMethod: PaymentMethod;
        discount?: number;
        shippingCost?: number;
        customerName?: string;
        customerPhone?: string;
        customerAddress?: string;
        dueDate?: string;
        downPayment?: number;
        cashierName?: string;
        employeeName?: string;
        bankAccountId?: number;
        productionPriority?: string;
        productionDeadline?: string;
        productionNotes?: string;
        transactionDate?: string;  // backdate: "YYYY-MM-DD"
        cashflowDate?: string;     // cashflow date override (untuk masuk shift hari ini)
        saveOnly?: boolean;        // true = simpan invoice tanpa pembayaran (PENDING)
        salesOrderId?: number;     // jika transaksi dibuat dari SO
        branchName?: string;       // cabang sumber order (auto-inherit dari SO jika ada)
        productionBranchId?: number | null; // Titip cetak ke cabang lain (null = cetak di cabang transaksi)
    }, @CurrentBranch() branchCtx: BranchContext) {
        // Owner harus pilih cabang eksplisit sebelum membuat transaksi
        const branchId = requireBranch(branchCtx);
        // Validasi: kalau ada productionBranchId & berbeda, pastikan cabang tujuan valid & aktif.
        // Cek detail di service supaya bisa akses Prisma.
        return this.transactionsService.create({ ...createTransactionDto, branchId });
    }

    @Get()
    findAll(
        @CurrentBranch() branchCtx: BranchContext,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Query('search') search?: string,
    ) {
        return this.transactionsService.findAll(branchCtx, startDate, endDate, search);
    }

    @Get('dashboard/metrics')
    getDashboardMetrics(@CurrentBranch() branchCtx: BranchContext) {
        return this.transactionsService.getDashboardMetrics(branchCtx);
    }

    @Get('dashboard/cashier-stats')
    getCashierStats(
        @CurrentBranch() branchCtx: BranchContext,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        return this.transactionsService.getCashierStats(branchCtx, startDate, endDate);
    }

    @Get('dashboard/chart')
    getChartData(
        @CurrentBranch() branchCtx: BranchContext,
        @Query('period') period: string = 'daily',
    ) {
        return this.transactionsService.getChartData(period, branchCtx);
    }

    @Get('reports/summary')
    getSummaryReport(
        @CurrentBranch() branchCtx: BranchContext,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Query('sortBy') sortBy: 'qty' | 'revenue' = 'qty',
        @Query('limit') limit?: string,
    ) {
        return this.transactionsService.getSummaryReport(branchCtx, startDate, endDate, sortBy, limit ? parseInt(limit) : 20);
    }

    // Static routes MUST come before :id to avoid NestJS swallowing them
    @Get('edit-requests')
    getEditRequests(@Query('status') status?: string) {
        return this.transactionsService.getEditRequests(status);
    }

    @Patch('edit-requests/:requestId/review')
    reviewEditRequest(
        @Param('requestId', ParseIntPipe) requestId: number,
        @Request() req: any,
        @Body() body: { approved: boolean; reviewNote?: string },
    ) {
        return this.transactionsService.reviewEditRequest(
            requestId,
            req.user.userId,
            req.user.role,
            body.approved,
            body.reviewNote,
        );
    }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.transactionsService.findOne(id);
    }

    @Post(':id/add-dp')
    addPartialPayment(@Param('id', ParseIntPipe) id: number, @Body() body: { amount: number; paymentMethod: PaymentMethod; bankAccountId?: number }) {
        return this.transactionsService.addPartialPayment(id, body);
    }

    @Post(':id/pay-off')
    payOff(@Param('id', ParseIntPipe) id: number, @Body() body: { paymentMethod: PaymentMethod, bankAccountId?: number, checkoutCashierName?: string, paidAt?: string }) {
        return this.transactionsService.payOff(id, body);
    }

    @Patch(':id/payment-method')
    updatePaymentMethod(@Param('id', ParseIntPipe) id: number, @Body() body: { paymentMethod: PaymentMethod; bankAccountId?: number }) {
        return this.transactionsService.updatePaymentMethod(id, body);
    }

    @Patch(':id')
    editTransactionDirect(
        @Param('id', ParseIntPipe) id: number,
        @Request() req: any,
        @Body() body: {
            items: {
                id?: number;
                newVariantId?: number;
                quantity?: number;
                pcs?: number;
                widthCm?: number;
                heightCm?: number;
                unitType?: string;
                priceOverride?: number;
                remove?: boolean;
            }[];
            discount?: number;
            customerName?: string;
            customerPhone?: string;
            customerAddress?: string;
        },
    ) {
        return this.transactionsService.editTransactionDirect(id, req.user.role, body);
    }

    @Post(':id/edit-request')
    createEditRequest(
        @Param('id', ParseIntPipe) id: number,
        @Request() req: any,
        @Body() body: {
            reason: string;
            items: {
                id?: number;
                newVariantId?: number;
                quantity?: number;
                pcs?: number;
                widthCm?: number;
                heightCm?: number;
                unitType?: string;
                priceOverride?: number;
                remove?: boolean;
            }[];
            discount?: number;
            customerName?: string;
            customerPhone?: string;
            customerAddress?: string;
        },
    ) {
        const { reason, ...editData } = body;
        return this.transactionsService.createEditRequest(id, req.user.userId, reason, editData);
    }

    @Delete(':id')
    deleteTransaction(
        @Param('id', ParseIntPipe) id: number,
        @Request() req: any,
    ) {
        return this.transactionsService.deleteTransaction(id, req.user.role);
    }
}
