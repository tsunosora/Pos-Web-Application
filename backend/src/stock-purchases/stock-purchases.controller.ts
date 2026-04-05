import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { StockPurchasesService } from './stock-purchases.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('stock-purchases')
export class StockPurchasesController {
    constructor(private readonly stockPurchasesService: StockPurchasesService) { }

    @Post()
    create(@Body() body: any) {
        return this.stockPurchasesService.create(body);
    }

    @Get()
    findAll() {
        return this.stockPurchasesService.findAll();
    }
}
