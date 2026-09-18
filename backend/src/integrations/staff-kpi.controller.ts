import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { StaffKpiService } from './staff-kpi.service';

const YMD = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Endpoint integrasi untuk aplikasi HR (RateMyStaff) — dipanggil server-ke-server
 * dengan header `x-api-key`, bukan oleh browser pengguna.
 */
@UseGuards(ApiKeyGuard)
@Controller('integrations')
export class StaffKpiController {
    constructor(private readonly service: StaffKpiService) { }

    /** Daftar staf (untuk memetakan karyawan HR ↔ user PosPro). */
    @Get('staff-list')
    staffList() {
        return this.service.staffList();
    }

    /** KPI per staf dalam rentang tanggal. */
    @Get('staff-kpi')
    kpi(
        @Query('from') from?: string,
        @Query('to') to?: string,
        @Query('branchId') branchId?: string,
    ) {
        if (!from || !YMD.test(from) || !to || !YMD.test(to)) {
            throw new BadRequestException('Parameter `from` & `to` wajib, format YYYY-MM-DD.');
        }
        if (to < from) {
            throw new BadRequestException('`to` mendahului `from`.');
        }
        const branch = branchId ? Number(branchId) : null;
        if (branchId && !Number.isInteger(branch)) {
            throw new BadRequestException('`branchId` harus angka.');
        }
        return this.service.kpi({ from, to, branchId: branch });
    }
}
