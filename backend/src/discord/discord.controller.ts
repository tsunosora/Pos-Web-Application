import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ManagerGuard } from '../auth/role-groups';
import { CurrentBranch } from '../common/branch-context.decorator';
import type { BranchContext } from '../common/branch-context.decorator';
import {
    DiscordService, DiscordChannel, DISCORD_CHANNELS, DiscordConfigShape,
} from './discord.service';

// URL webhook Discord = kunci kirim ke kanal toko → hanya setingkat manajer (T-49).
@UseGuards(JwtAuthGuard, ManagerGuard)
@Controller('discord')
export class DiscordController {
    constructor(private readonly discord: DiscordService) {}

    @Get('config')
    getConfig() {
        return this.discord.getConfig();
    }

    @Patch('config')
    update(@Body() body: Partial<DiscordConfigShape>, @CurrentBranch() ctx: BranchContext) {
        return this.discord.updateConfig(body, { isOwner: ctx.isOwner, branchId: ctx.userBranchId });
    }

    /** Kirim pesan test ke salah satu channel (branchId opsional di body — null = global). */
    @Post('test/:channel')
    test(@Param('channel') channel: string, @Body() body?: { branchId?: number | null }) {
        const ch = (DISCORD_CHANNELS as string[]).includes(channel)
            ? (channel as DiscordChannel)
            : null;
        if (!ch) return { ok: false, message: 'Channel tidak valid.' };
        return this.discord.sendTest(ch, body?.branchId ?? null);
    }
}
