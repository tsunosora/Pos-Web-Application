import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
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
    async findAll() {
        const list = await this.cashflowService.findAll();
        const summary = await this.cashflowService.getSummary();

        return {
            list,
            summary,
        };
    }
}
