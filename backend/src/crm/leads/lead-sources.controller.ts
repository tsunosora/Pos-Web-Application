import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { LeadSourcesService } from './lead-sources.service';

@UseGuards(JwtAuthGuard)
@Controller('crm/lead-sources')
export class LeadSourcesController {
    constructor(private readonly sources: LeadSourcesService) {}

    /** Daftar sumber lead tersimpan (untuk dropdown). */
    @Get()
    list() {
        return this.sources.list();
    }

    /** Simpan/pakai sumber lead (dedup case-insensitive). */
    @Post()
    upsert(@Body() body: { name: string }) {
        return this.sources.upsert(body?.name);
    }
}
