import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LandingService, type LandingConfigPatch } from './landing.service';

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

    @UseGuards(JwtAuthGuard)
    @Put()
    update(@Body() body: LandingConfigPatch) {
        return this.landing.update(body);
    }

    @UseGuards(JwtAuthGuard)
    @Post('publish')
    publish() {
        return this.landing.publish();
    }

    @UseGuards(JwtAuthGuard)
    @Post('unpublish')
    unpublish() {
        return this.landing.unpublish();
    }
}
