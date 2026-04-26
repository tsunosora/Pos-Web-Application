import { Module } from '@nestjs/common';
import { BranchStockService } from './branch-stock.service';
import { BranchStockController } from './branch-stock.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [BranchStockController],
    providers: [BranchStockService],
    exports: [BranchStockService],
})
export class BranchStockModule {}
