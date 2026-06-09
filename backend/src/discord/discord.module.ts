import { Global, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { DiscordService } from './discord.service';
import { DiscordController } from './discord.controller';
import { DiscordExceptionFilter } from './discord-exception.filter';

// Global agar DiscordService bisa di-inject service mana pun tanpa import berulang.
@Global()
@Module({
    controllers: [DiscordController],
    providers: [
        DiscordService,
        { provide: APP_FILTER, useClass: DiscordExceptionFilter },
    ],
    exports: [DiscordService],
})
export class DiscordModule {}
