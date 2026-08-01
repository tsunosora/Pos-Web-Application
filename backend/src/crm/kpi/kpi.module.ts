import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { KpiService } from './kpi.service';
import { KpiController } from './kpi.controller';
import { KpiPublicController } from './kpi-public.controller';
import { KpiCron } from './kpi.cron';
import { ReportsModule } from '../../reports/reports.module';

@Module({
    imports: [PrismaModule, ReportsModule],
    controllers: [KpiController, KpiPublicController],
    providers: [KpiService, KpiCron],
    exports: [KpiService],
})
export class KpiModule {}
