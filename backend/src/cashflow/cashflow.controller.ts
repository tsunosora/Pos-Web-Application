import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { CashflowService } from './cashflow.service';
import { Prisma } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('cashflow')
export class CashflowController {
    constructor(private readonly cashflowService: CashflowService) { }

    @Post()
    create(@Body() createData: Prisma.CashflowCreateInput) {
        return this.cashflowService.create(createData);
    }

    @Get()
    findAll(@Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
        return this.cashflowService.findAll(startDate, endDate);
    }

    @Get('monthly-trend')
    getMonthlyTrend() {
        return this.cashflowService.getMonthlyTrend();
    }

    @Get('category-breakdown')
    getCategoryBreakdown(@Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
        return this.cashflowService.getCategoryBreakdown(startDate, endDate);
    }

    @Get('platform-breakdown')
    getPlatformBreakdown(@Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
        return this.cashflowService.getPlatformBreakdown(startDate, endDate);
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() data: { category?: string; amount?: number; note?: string; platformSource?: string | null }) {
        return this.cashflowService.update(+id, data);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.cashflowService.remove(+id);
    }
}
