import { Controller, Get, Post, Body, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { PaymentMethod } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('transactions')
export class TransactionsController {
    constructor(private readonly transactionsService: TransactionsService) { }

    @Post()
    create(@Body() createTransactionDto: {
        items: { productVariantId: number; quantity: number; widthCm?: number; heightCm?: number; note?: string }[];
        paymentMethod: PaymentMethod;
        discount?: number;
        customerName?: string;
        customerPhone?: string;
        customerAddress?: string;
        dueDate?: string;
        downPayment?: number;
        cashierName?: string;
        employeeName?: string;
        bankAccountId?: number;
    }) {
        return this.transactionsService.create(createTransactionDto);
    }

    @Get()
    findAll() {
        return this.transactionsService.findAll();
    }

    @Get('dashboard/metrics')
    getDashboardMetrics() {
        return this.transactionsService.getDashboardMetrics();
    }

    @Get('reports/summary')
    getSummaryReport() {
        // Todo: accept startDate/endDate query parameters later if needed
        return this.transactionsService.getSummaryReport();
    }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.transactionsService.findOne(id);
    }

    @Post(':id/pay-off')
    payOff(@Param('id', ParseIntPipe) id: number, @Body() body: { paymentMethod: PaymentMethod, bankAccountId?: number }) {
        return this.transactionsService.payOff(id, body);
    }
}
