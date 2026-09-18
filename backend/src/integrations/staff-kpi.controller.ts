import { BadRequestException, Body, Controller, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { StaffKpiService } from './staff-kpi.service';
import { StaffPinService } from './staff-pin.service';
import { StaffDailyService } from './staff-daily.service';

const YMD = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Endpoint integrasi untuk aplikasi HR (RateMyStaff) — dipanggil server-ke-server
 * dengan header `x-api-key`, bukan oleh browser pengguna.
 */
@UseGuards(ApiKeyGuard)
@Controller('integrations')
export class StaffKpiController {
    constructor(
        private readonly service: StaffKpiService,
        private readonly pins: StaffPinService,
        private readonly dailyService: StaffDailyService,
    ) { }

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

    /** Angka harian satu orang: omzet kasir, order desain, kartu produksi. */
    @Get('staff-daily')
    daily(
        @Query('userId') userId?: string,
        @Query('from') from?: string,
        @Query('to') to?: string,
    ) {
        if (!from || !YMD.test(from) || !to || !YMD.test(to)) {
            throw new BadRequestException('Parameter `from` & `to` wajib, format YYYY-MM-DD.');
        }
        if (to < from) throw new BadRequestException('`to` mendahului `from`.');
        return this.dailyService.daily({ userId: this.parseUserId(userId), from, to });
    }

    /** Apakah user ini punya PIN desainer yang bisa dipakai aplikasi HR? */
    @Get('staff-pin')
    hasPin(@Query('userId') userId?: string) {
        return this.pins.hasPin(this.parseUserId(userId));
    }

    /** Verifikasi PIN desainer. Jawabannya hanya benar/salah. */
    @Post('staff-pin/verify')
    @HttpCode(200)
    verifyPin(@Body() body: { userId?: number | string; pin?: string }) {
        const pin = typeof body?.pin === 'string' ? body.pin : '';
        if (!pin) throw new BadRequestException('`pin` wajib diisi.');
        return this.pins.verify(this.parseUserId(body?.userId), pin);
    }

    private parseUserId(raw: unknown): number {
        const id = Number(raw);
        if (!Number.isInteger(id) || id <= 0) {
            throw new BadRequestException('`userId` wajib berupa angka positif.');
        }
        return id;
    }
}
