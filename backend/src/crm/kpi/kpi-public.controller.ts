/**
 * Dashboard Marketing PUBLIK — tanpa login, hanya dengan PIN.
 * Tim marketing memantau lead (sumber, status, pendapatan, produk yang diorder)
 * lintas cabang. PIN diverifikasi inline tiap request (tidak ada JWT guard).
 */
import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { KpiPeriod, KpiService } from './kpi.service';

@Controller('crm/public')
export class KpiPublicController {
    constructor(private readonly kpi: KpiService) {}

    @Post('verify-pin')
    async verifyPin(@Body() body: { pin?: string }) {
        return { valid: await this.kpi.verifyMarketingPin(body?.pin || '') };
    }

    @Post('dashboard')
    async dashboard(@Body() body: { pin?: string; period?: string; start?: string; end?: string; branchId?: number | null }) {
        const ok = await this.kpi.verifyMarketingPin(body?.pin || '');
        if (!ok) throw new BadRequestException('PIN tidak valid');
        return this.kpi.publicDashboard({
            period: (body.period as KpiPeriod) || 'month',
            start: body.start,
            end: body.end,
        }, body.branchId ?? null);
    }

    /** Tim marketing input biaya iklan (PIN-gated). */
    @Post('spend')
    async addSpend(@Body() body: { pin?: string; date?: string; source: string; amount: number; note?: string; branchId?: number | null }) {
        const ok = await this.kpi.verifyMarketingPin(body?.pin || '');
        if (!ok) throw new BadRequestException('PIN tidak valid');
        return this.kpi.addMarketingSpend(body);
    }

    @Post('spend/delete')
    async deleteSpend(@Body() body: { pin?: string; id: number }) {
        const ok = await this.kpi.verifyMarketingPin(body?.pin || '');
        if (!ok) throw new BadRequestException('PIN tidak valid');
        return this.kpi.deleteMarketingSpend(Number(body.id));
    }
}
