import { Module } from '@nestjs/common';
import { StockPurchasesController } from './stock-purchases.controller';
import { StockPurchasesService } from './stock-purchases.service';

@Module({
    controllers: [StockPurchasesController],
    providers: [StockPurchasesService],
})
export class StockPurchasesModule { }
