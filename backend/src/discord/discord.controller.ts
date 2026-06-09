import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
    DiscordService, DiscordChannel, DISCORD_CHANNELS, DiscordConfigShape,
} from './discord.service';

@UseGuards(JwtAuthGuard)
@Controller('discord')
export class DiscordController {
    constructor(private readonly discord: DiscordService) {}

    @Get('config')
    getConfig() {
        return this.discord.getConfig();
    }

    @Patch('config')
    update(@Body() body: Partial<DiscordConfigShape>) {
        return this.discord.updateConfig(body);
    }

    /** Kirim pesan test ke salah satu channel. */
    @Post('test/:channel')
    test(@Param('channel') channel: string) {
        const ch = (DISCORD_CHANNELS as string[]).includes(channel)
            ? (channel as DiscordChannel)
            : null;
        if (!ch) return { ok: false, message: 'Channel tidak valid.' };
        return this.discord.sendTest(ch);
    }
}
