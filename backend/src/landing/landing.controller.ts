import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Menu, MenuGuard } from '../auth/role-groups';
import { LandingService, type LandingConfigPatch } from './landing.service';

// Mengubah/menerbitkan halaman depan publik hanya untuk peran yang diberi menu
// Landing Page (owner/admin/manajer selalu boleh) — T-47.
@Menu('/landing-page')
@Controller('landing')
export class LandingController {
    constructor(private readonly landing: LandingService) {}

    /** Publik (tanpa auth) — dipakai halaman landing untuk render. */
    @Get('public')
    getPublic() {
        return this.landing.getPublic();
    }

    @UseGuards(JwtAuthGuard)
    @Get()
    getAdmin() {
        return this.landing.getAdmin();
    }

    @UseGuards(JwtAuthGuard, MenuGuard)
    @Put()
    update(@Body() body: LandingConfigPatch) {
        return this.landing.update(body);
    }

    @UseGuards(JwtAuthGuard, MenuGuard)
    @Post('publish')
    publish() {
        return this.landing.publish();
    }

    @UseGuards(JwtAuthGuard, MenuGuard)
    @Post('unpublish')
    unpublish() {
        return this.landing.unpublish();
    }

    /** Kembalikan halaman depan ke versi sebelum terbit/ubah terakhir (T-47). */
    @UseGuards(JwtAuthGuard, MenuGuard)
    @Post('restore-previous')
    restorePrevious() {
        return this.landing.restorePrevious();
    }
}
