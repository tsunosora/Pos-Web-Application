import { Controller, Get, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { StorefrontReadGuard } from './storefront-read.guard';
import { StorefrontService } from './storefront.service';

/**
 * API baca-lead untuk website toko milik klien. Tanpa akun PosPro: cukup header
 * `X-Storefront-Read-Token` (lihat StorefrontReadGuard). HANYA GET, dan hanya lead
 * `source = WEBSITE` — order dari WhatsApp/iklan/walk-in tidak pernah ikut.
 */
@UseGuards(StorefrontReadGuard)
@Controller('storefront')
export class StorefrontController {
    constructor(private readonly svc: StorefrontService) {}

    @Get('leads')
    daftar(@Query('limit') limit?: string, @Query('status') status?: string) {
        return this.svc.daftar({ limit: limit ? Number(limit) : undefined, status });
    }

    /** HARUS di atas :id supaya "status-summary" tidak dibaca sebagai id. */
    @Get('leads/status-summary')
    ringkasan() {
        return this.svc.ringkasanStatus();
    }

    @Get('leads/:id')
    detail(@Param('id', ParseIntPipe) id: number) {
        return this.svc.detail(id);
    }
}
