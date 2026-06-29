import { Module } from '@nestjs/common';
import { BonusService } from './bonus.service';
import { BonusController } from './bonus.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { KpiModule } from '../crm/kpi/kpi.module';

@Module({
    imports: [PrismaModule, KpiModule],
    controllers: [BonusController],
    providers: [BonusService],
})
export class BonusModule {}
