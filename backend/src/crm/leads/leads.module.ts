import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { LeadsService } from './leads.service';
import { LeadsController } from './leads.controller';
import { TransactionsModule } from '../../transactions/transactions.module';

@Module({
    imports: [PrismaModule, TransactionsModule],
    controllers: [LeadsController],
    providers: [LeadsService],
    exports: [LeadsService],
})
export class LeadsModule {}
