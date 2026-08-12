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
        @Query('labelId') labelId?: string,
    ) {
        const lid = labelId != null && labelId !== '' ? Number(labelId) : undefined;
        return this.ads.overview({ since, until, accountId, labelId: Number.isFinite(lid as number) ? lid : undefined });
    }

    /** Pilih ad account default (disimpan ke WaConfig). */
    @Post('account')
    setAccount(@Body() body: { accountId: string | null }) {
        return this.ads.setAccount(body?.accountId ?? null);
    }

    // ─── Label custom iklan (per campaign) ───────────────────────────────────

    /** Daftar label + jumlah campaign tertaut. */
    @Get('labels')
    labels() {
        return this.ads.listLabels();
    }

    /** Buat/ubah label (dedup nama; branchId opsional utk atribusi cabang otomatis). */
    @Post('labels')
    upsertLabel(@Body() body: { name: string; branchId?: number | null }) {
        return this.ads.upsertLabel(body?.name, body?.branchId);
    }

    /** Hapus label (lead → label dilepas, tautan campaign ikut terhapus). */
    @Post('labels/delete')
    deleteLabel(@Body() body: { id: number }) {
        return this.ads.deleteLabel(Number(body?.id));
    }

    /** Tautkan/lepas label ke sebuah campaign (labelId null = lepas). */
    @Post('campaign-label')
    assignCampaignLabel(@Body() body: { campaignId: string; labelId: number | null; accountId?: string }) {
        return this.ads.assignCampaignLabel(body?.campaignId, body?.labelId ?? null, body?.accountId);
    }

    /** Set profit produk per campaign → patokan CPR = profit × 5% (null = hapus). */
    @Post('campaign-profit')
    setCampaignProfit(@Body() body: { campaignId: string; profit: number | null; accountId?: string }) {
        return this.ads.setCampaignProfit(body?.campaignId, body?.profit ?? null, body?.accountId);
    }

    /** Drill-down per iklan/video dalam 1 campaign (metrik video + lead/closing). */
    @Get('ads')
    adBreakdown(
        @Query('campaignId') campaignId: string,
        @Query('since') since?: string,
        @Query('until') until?: string,
    ) {
        return this.ads.adBreakdown({ campaignId, since, until });
    }
}
