import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BranchWorkOrdersService } from './branch-work-orders.service';
import { BranchWorkOrdersController } from './branch-work-orders.controller';

@Module({
    imports: [PrismaModule],
    controllers: [BranchWorkOrdersController],
    providers: [BranchWorkOrdersService],
    exports: [BranchWorkOrdersService],
})
export class BranchWorkOrdersModule {}
