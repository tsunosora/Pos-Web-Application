import { Module } from '@nestjs/common';
import { ProductionService } from './production.service';
import { ProductionController } from './production.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ClickCountingModule } from '../click-counting/click-counting.module';
import { FollowUpsModule } from '../crm/follow-ups/follow-ups.module';

@Module({
    imports: [PrismaModule, ClickCountingModule, FollowUpsModule],
    controllers: [ProductionController],
    providers: [ProductionService],
    exports: [ProductionService],
})
export class ProductionModule {}
