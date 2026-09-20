import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StaffKpiController } from './staff-kpi.controller';
import { StaffKpiService } from './staff-kpi.service';
import { StaffPinService } from './staff-pin.service';
import { StaffDailyService } from './staff-daily.service';
import { HrSummaryController } from './hr-summary.controller';
import { HrPinController } from './hr-pin.controller';
import { HrSummaryService } from './hr-summary.service';

/**
 * Dua arah integrasi dengan RateMyStaff:
 * - masuk : StaffKpiController (server-ke-server, dijaga x-api-key)
 * - keluar: HrSummaryController (dipakai browser owner, menarik ringkasan HR)
 */
@Module({
    imports: [PrismaModule],
    controllers: [StaffKpiController, HrSummaryController, HrPinController],
    providers: [StaffKpiService, StaffPinService, StaffDailyService, HrSummaryService],
})
export class IntegrationsModule { }
