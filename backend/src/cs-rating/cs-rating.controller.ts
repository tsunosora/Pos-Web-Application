import { Controller, Get, Post, Patch, Body, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ManagerGuard } from '../auth/role-groups';
import { CsRatingService } from './cs-rating.service';
import type { CreateInviteDto, UpdateConfigDto } from './cs-rating.service';

@UseGuards(JwtAuthGuard)
@Controller('cs-rating')
export class CsRatingController {
    constructor(private readonly svc: CsRatingService) {}

    @Post('invite')
    invite(@Body() dto: CreateInviteDto) {
        return this.svc.createInvite(dto);
    }

    @Get('summary')
    summary(
        @Query('branchId') branchId?: string,
        @Query('from') from?: string,
        @Query('to') to?: string,
    ) {
        return this.svc.summary({
            branchId: branchId ? Number(branchId) : undefined,
            from,
            to,
        });
    }

    @Get('config')
    config(@Query('branchId') branchId?: string) {
        return this.svc.getConfigRow(branchId ? Number(branchId) : null);
    }

    // Pertanyaan penilaian (per cabang / global) = setingkat manajer (dulu cukup login).
    @Patch('config')
    @UseGuards(ManagerGuard)
    upsertConfig(@Body() dto: UpdateConfigDto) {
        return this.svc.upsertConfig(dto);
    }
}
