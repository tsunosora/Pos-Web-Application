import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { CsRatingService } from './cs-rating.service';
import type { SubmitRatingDto } from './cs-rating.service';

// Endpoint publik — hanya token URL, tanpa JWT (pola sama seperti stock-opname/public).
@Controller('cs-rating/public')
export class CsRatingPublicController {
    constructor(private readonly svc: CsRatingService) {}

    @Get(':token')
    verify(@Param('token') token: string) {
        return this.svc.verifyToken(token);
    }

    @Post(':token/submit')
    submit(@Param('token') token: string, @Body() dto: SubmitRatingDto) {
        return this.svc.submit(token, dto);
    }
}
