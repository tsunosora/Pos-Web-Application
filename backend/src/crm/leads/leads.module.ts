import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { LeadsService } from './leads.service';
import { LeadsController } from './leads.controller';
import { PublicOrdersController } from './public-orders.controller';
import { LeadSourcesController } from './lead-sources.controller';
import { LeadSourcesService } from './lead-sources.service';
import { TransactionsModule } from '../../transactions/transactions.module';

@Module({
    imports: [PrismaModule, TransactionsModule],
    controllers: [LeadsController, PublicOrdersController, LeadSourcesController],
    providers: [LeadsService, LeadSourcesService],
    exports: [LeadsService],
})
export class LeadsModule {}
