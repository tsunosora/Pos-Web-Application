import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { MetaAdsService } from './meta-ads.service';

// Data biaya iklan bersifat sensitif → owner/admin saja (samakan dgn endpoint token WA).
const ADMIN_ROLES = ['OWNER', 'SUPERADMIN', 'SUPER_ADMIN', 'ADMIN'] as const;

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ADMIN_ROLES)
@Controller('meta-ads')
export class MetaAdsController {
    constructor(private readonly ads: MetaAdsService) {}

    /** Daftar ad account yang bisa diakses token WA (scope ads_read). */
    @Get('accounts')
    accounts() {
        return this.ads.listAccounts();
    }

    /**
     * Ringkasan performa iklan + lead CRM per campaign.
     * @query since,until = YYYY-MM-DD (opsional, default 30 hari terakhir)
     * @query accountId = act_xxx (opsional, default akun terkonfigurasi)
     */
    @Get('overview')
    overview(
        @Query('since') since?: string,
        @Query('until') until?: string,
        @Query('accountId') accountId?: string,
    ) {
        return this.ads.overview({ since, until, accountId });
    }

    /** Pilih ad account default (disimpan ke WaConfig). */
    @Post('account')
    setAccount(@Body() body: { accountId: string | null }) {
        return this.ads.setAccount(body?.accountId ?? null);
    }
}
