import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { KpiService } from './kpi.service';
import { KpiController } from './kpi.controller';

@Module({
    imports: [PrismaModule],
    controllers: [KpiController],
    providers: [KpiService],
})
export class KpiModule {}
