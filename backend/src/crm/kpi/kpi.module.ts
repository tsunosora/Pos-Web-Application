import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { KpiService } from './kpi.service';
import { KpiController } from './kpi.controller';
import { KpiCron } from './kpi.cron';

@Module({
    imports: [PrismaModule],
    controllers: [KpiController],
    providers: [KpiService, KpiCron],
})
export class KpiModule {}
