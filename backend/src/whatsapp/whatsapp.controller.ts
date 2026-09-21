import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ManagerGuard } from '../auth/role-groups';

/**
 * Bot WhatsApp lama (sesi QR). Masih dipakai karena Cloud API resmi tidak bisa
 * mengirim ke GRUP, sementara rekap shift dikirim ke grup pemilik.
 *
 * Seluruh endpoint di sini wajib login: modul ini bisa mengirim pesan dan
 * mengubah konfigurasi bot, jadi tidak boleh terbuka seperti sisa versi awal
 * aplikasi. Frontend memanggilnya lewat klien API yang sudah membawa token.
 */
// Controller WhatsApp lama (whatsapp-web.js): kirim/siaran/logout sesi toko.
// Hanya dipakai halaman Pengaturan → setingkat manajer (T-29). Controller
// WhatsApp Cloud memakai prefix yang sama tapi kelas terpisah — tidak terpengaruh.
@UseGuards(JwtAuthGuard, ManagerGuard)
@Controller('whatsapp')
export class WhatsappController {
    constructor(private readonly whatsappService: WhatsappService) { }

    @Get('status')
    getStatus() {
        return this.whatsappService.getConnectionStatus();
    }

    @Get('config')
    getConfig() {
        return this.whatsappService.getConfig();
    }

    @Get('groups')
    async getGroups() {
        return this.whatsappService.getJoinedGroups();
    }

    @Post('logout')
    async logout() {
        await this.whatsappService.logout();
        return { success: true, message: 'WhatsApp client is restarting...' };
    }

    @Post('send')
    async sendToGroup(@Body() body: { groupId: string; message: string }) {
        const ok = await this.whatsappService.sendToGroup(body.groupId, body.message);
        return { success: ok };
    }

    @Post('broadcast')
    async broadcast(@Body() body: { message: string }) {
        const result = await this.whatsappService.broadcastToGroups(body.message);
        return result;
    }

    @Post('announce')
    async announce(@Body() body: { message: string }) {
        const ok = await this.whatsappService.sendToAnnouncement(body.message);
        return { success: ok };
    }

    @Post('config/broadcast-groups')
    async updateBroadcastGroups(@Body() body: { add?: string; remove?: string }) {
        await this.whatsappService.updateBroadcastGroups(body.add, body.remove);
        return { success: true };
    }

    @Post('config/announcement')
    async setAnnouncement(@Body() body: { channelId: string | null }) {
        await this.whatsappService.setAnnouncementChannel(body.channelId);
        return { success: true };
    }

    @Post('config/design-group')
    async setDesignGroup(@Body() body: { groupId: string | null }) {
        await this.whatsappService.setDesignGroup(body.groupId);
        return { success: true };
    }
}
