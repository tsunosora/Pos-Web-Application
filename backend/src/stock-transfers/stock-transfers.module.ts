import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StockTransfersController } from './stock-transfers.controller';
import { StockTransfersService } from './stock-transfers.service';

@Module({
    imports: [PrismaModule],
    controllers: [StockTransfersController],
    providers: [StockTransfersService],
})
export class StockTransfersModule {}
