import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { LeadsService } from './leads.service';
import { LeadsController } from './leads.controller';
import { PublicOrdersController } from './public-orders.controller';
import { TransactionsModule } from '../../transactions/transactions.module';

@Module({
    imports: [PrismaModule, TransactionsModule],
    controllers: [LeadsController, PublicOrdersController],
    providers: [LeadsService],
    exports: [LeadsService],
})
export class LeadsModule {}
