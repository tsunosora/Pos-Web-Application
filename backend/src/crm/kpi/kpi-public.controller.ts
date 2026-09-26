/**
 * Dashboard Marketing PUBLIK — tanpa login, hanya dengan PIN.
 * Tim marketing memantau lead (sumber, status, pendapatan, produk yang diorder)
 * lintas cabang. PIN diverifikasi inline tiap request (tidak ada JWT guard).
 *
 * TIDAK dijaga `@ButuhFitur`: tanpa sesi pengguna (PIN saja), dan dipakai papan TV yang
 * menyala terus. Dasbor KPI yang pakai login (`/crm/kpi`) SUDAH dijaga sejak 26 Sep 2026 —
 * tapi dengan `@ButuhSalahSatuFitur('crm.leads', 'team.leaderboard', 'cs.rating')`, karena
 * isinya campur tiga fitur. Papan ini tetap dibiarkan terbuka: 403 di layar TV yang menyala
 * terus tidak ada yang membacanya, dan PIN-nya bukan sesi yang bisa dihubungkan ke paket.
 */
import { Controller, Post, Body, BadRequestException, UseInterceptors } from '@nestjs/common';
import { KpiPeriod, KpiService } from './kpi.service';
import { PinThrottleInterceptor } from '../../auth/pin-throttle.interceptor';

@UseInterceptors(PinThrottleInterceptor)
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

    /** Data leaderboard PUBLIK untuk display TV (PIN-only, satu request agregat). */
    @Post('leaderboard')
    async leaderboard(@Body() body: { pin?: string; period?: string; start?: string; end?: string; branchId?: number | null }) {
        const ok = await this.kpi.verifyMarketingPin(body?.pin || '');
        if (!ok) throw new BadRequestException('PIN tidak valid');
        return this.kpi.publicLeaderboard({
            period: (body.period as KpiPeriod) || 'today',
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
