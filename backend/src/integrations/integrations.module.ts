import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StaffKpiController } from './staff-kpi.controller';
import { StaffKpiService } from './staff-kpi.service';
import { StaffPinService } from './staff-pin.service';

/** Endpoint server-ke-server untuk aplikasi luar (saat ini: RateMyStaff / HR). */
@Module({
    imports: [PrismaModule],
    controllers: [StaffKpiController],
    providers: [StaffKpiService, StaffPinService],
})
export class IntegrationsModule { }
