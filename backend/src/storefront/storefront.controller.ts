import { Controller, Get, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { StorefrontReadGuard } from './storefront-read.guard';
import { StorefrontService } from './storefront.service';

/**
 * API baca-lead untuk website toko (volikoprint.com). Tanpa akun PosPro: cukup header
 * `X-Storefront-Read-Token` (lihat StorefrontReadGuard). HANYA GET, dan hanya lead
 * `source = WEBSITE` — order dari WhatsApp/iklan/walk-in tidak pernah ikut.
 *
 * SENGAJA TIDAK dijaga `@ButuhFitur('crm.leads')` walau isinya lead: otentikasinya token
 * tersendiri, bukan sesi pengguna, dan pemakainya situs toko klien yang sedang hidup.
 * Menjaganya = situs itu mati begitu kode fiturnya tidak ada di kunci.
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
