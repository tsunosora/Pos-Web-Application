import { Module } from '@nestjs/common';
import { StockTransferService } from './stock-transfer.service';
import { StockTransferController } from './stock-transfer.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { BranchStockModule } from '../branch-stock/branch-stock.module';

@Module({
    imports: [PrismaModule, BranchStockModule],
    controllers: [StockTransferController],
    providers: [StockTransferService],
    exports: [StockTransferService],
})
export class StockTransferModule {}
