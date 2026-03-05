import { Controller, Get, Post } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';

@Controller('whatsapp')
export class WhatsappController {
    constructor(private readonly whatsappService: WhatsappService) { }

    @Get('status')
    getStatus() {
        return this.whatsappService.getConnectionStatus();
    }

    @Post('logout')
    async logout() {
        await this.whatsappService.logout();
        return { success: true, message: 'WhatsApp client is restarting...' };
    }
}
