import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { WorkOrdersService } from './work-orders.service';
import { WorkOrdersController } from './work-orders.controller';

@Module({
    imports: [PrismaModule],
    controllers: [WorkOrdersController],
    providers: [WorkOrdersService],
    exports: [WorkOrdersService],
})
export class WorkOrdersModule {}
