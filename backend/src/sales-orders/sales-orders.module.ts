import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { DesignersModule } from '../designers/designers.module';
import { SalesOrdersController } from './sales-orders.controller';
import { SalesOrdersPublicController } from './sales-orders-public.controller';
import { SalesOrdersService } from './sales-orders.service';

@Module({
    imports: [PrismaModule, WhatsappModule, DesignersModule],
    controllers: [SalesOrdersController, SalesOrdersPublicController],
    providers: [SalesOrdersService],
    exports: [SalesOrdersService],
})
export class SalesOrdersModule {}
