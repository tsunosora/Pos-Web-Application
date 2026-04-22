import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { Client, LocalAuth, MessageMedia } from 'whatsapp-web.js';
import * as qrcode from 'qrcode-terminal';
import * as path from 'path';
import * as fs from 'fs';

export type ConnectionStatus = 'INITIALIZING' | 'WAITING_QR' | 'AUTHENTICATED' | 'CONNECTED' | 'DISCONNECTED';

const CONFIG_PATH = path.join(process.cwd(), 'whatsapp_bot_config.json');

interface BotConfig {
    allowedGroups: string[];
    reportGroupId: string | null;
    feedbackGroupId: string | null;
    announcementChannelId: string | null;
    broadcastGroupIds: string[];
    designGroupId: string | null;        // Group internal untuk Surat Order (desain -> kasir/operator)
}

@Injectable()
export class WhatsappService implements OnModuleInit {
    private client: Client;
    private readonly logger = new Logger(WhatsappService.name);

    private qrCodeUrl: string | null = null;
    private connectionStatus: ConnectionStatus = 'INITIALIZING';
    private isReady = false;

    private botConfig: BotConfig = {
        allowedGroups: [],
        reportGroupId: process.env.WHATSAPP_REPORT_GROUP_ID || null,
        feedbackGroupId: null,
        announcementChannelId: null,
        broadcastGroupIds: [],
        designGroupId: null,
    };

    onModuleInit() {
        this.loadConfig();
        this.initializeClient();
    }

    private loadConfig() {
        try {
            if (fs.existsSync(CONFIG_PATH)) {
                const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
                this.botConfig = { ...this.botConfig, ...JSON.parse(data) };
                this.logger.log('Bot configuration loaded from file.');
            }
        } catch (error) {
            this.logger.error('Failed to load bot config:', error);
        }
    }

    private saveConfig() {
        try {
            fs.writeFileSync(CONFIG_PATH, JSON.stringify(this.botConfig, null, 2));
            this.logger.log('Bot configuration saved to file.');
        } catch (error) {
            this.logger.error('Failed to save bot config:', error);
        }
    }

    private initializeClient() {
        this.logger.log('Initializing WhatsApp Client...');
        this.connectionStatus = 'INITIALIZING';
        this.qrCodeUrl = null;
        this.isReady = false;

        this.client = new Client({
            authStrategy: new LocalAuth({ dataPath: './whatsapp-auth' }),
            puppeteer: {
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
            },
        });

        this.client.on('qr', (qr) => {
            this.logger.log('Please scan the QR code to connect WhatsApp Bot');
            qrcode.generate(qr, { small: true });
            this.qrCodeUrl = qr;
            this.connectionStatus = 'WAITING_QR';
        });

        this.client.on('ready', () => {
            this.isReady = true;
            this.connectionStatus = 'CONNECTED';
            this.qrCodeUrl = null;
            this.logger.log('WhatsApp Bot is ready and connected!');
        });

        this.client.on('authenticated', () => {
            this.connectionStatus = 'AUTHENTICATED';
            this.qrCodeUrl = null;
            this.logger.log('WhatsApp Bot authenticated successfully.');
        });

        this.client.on('auth_failure', (msg) => {
            this.connectionStatus = 'DISCONNECTED';
            this.qrCodeUrl = null;
            this.logger.error(`WhatsApp Bot authentication failed: ${msg}`);
        });

        this.client.on('disconnected', (reason) => {
            this.isReady = false;
            this.connectionStatus = 'DISCONNECTED';
            this.qrCodeUrl = null;
            this.logger.warn(`WhatsApp was disconnected: ${reason}`);
        });

        this.client.on('message', async (msg) => {
            try {
                const chat = await msg.getChat();
                const text = msg.body.trim();
                const args = text.split(' ');
                const command = args[0] + (args[1] ? ' ' + args[1] : '');

                // Public Commands (Group only)
                if (text === '!getgroupid' && chat.isGroup) {
                    msg.reply(`ID grup ini adalah: ${chat.id._serialized}\nNama Grup: ${chat.name}`);
                }

                // Admin Commands (Only process if it starts with !botadmin)
                if (text.startsWith('!botadmin')) {
                    if (command === '!botadmin status') {
                        let response = `*🌐 STATUS BOT SERVER POS*\n`;
                        response += `━━━━━━━━━━━━━━━━━━\n`;
                        response += `✅ *Bot Aktif & Online*\n`;
                        response += `📡 *Sistem Terkoneksi*: NestJS Backend\n`;
                        response += `⏰ *Waktu Server*: ${new Date().toLocaleString('id-ID')}\n\n`;
                        response += `_Bot POS ini siap menerima perintah Laporan Shift Harian dari aplikasi Web._`;
                        msg.reply(response);
                    }
                    else if (command === '!botadmin addgroup') {
                        const groupId = args[2];
                        if (groupId && !this.botConfig.allowedGroups.includes(groupId)) {
                            this.botConfig.allowedGroups.push(groupId);
                            this.saveConfig();
                            msg.reply(`✅ Grup ${groupId} berhasil ditambahkan ke whitelist.`);
                        } else {
                            msg.reply(`Format salah atau grup sudah ada.\nGunakan: !botadmin addgroup [GROUP_ID]`);
                        }
                    }
                    else if (command === '!botadmin removegroup') {
                        const groupId = args[2];
                        if (groupId) {
                            this.botConfig.allowedGroups = this.botConfig.allowedGroups.filter(id => id !== groupId);
                            this.saveConfig();
                            msg.reply(`✅ Grup ${groupId} berhasil dihapus dari whitelist.`);
                        } else {
                            msg.reply(`Format salah.\nGunakan: !botadmin removegroup [GROUP_ID]`);
                        }
                    }
                    else if (command === '!botadmin listgroups') {
                        let res = `*Daftar Grup Whitelist:*\n\n`;
                        if (this.botConfig.allowedGroups.length === 0) res += `- Belum ada grup yang diizinkan.\n`;
                        else this.botConfig.allowedGroups.forEach((g, i) => res += `${i + 1}. ${g}\n`);
                        msg.reply(res);
                    }
                    else if (command === '!botadmin setreportgroup') {
                        const groupId = args[2];
                        if (groupId) {
                            this.botConfig.reportGroupId = groupId;
                            this.saveConfig();
                            msg.reply(`✅ Grup Laporan Shift berhasil diatur ke: ${groupId}`);
                        } else {
                            msg.reply(`Format salah.\nGunakan: !botadmin setreportgroup [GROUP_ID]`);
                        }
                    }
                    else if (command === '!botadmin setfeedbackgroup') {
                        const groupId = args[2];
                        if (groupId) {
                            this.botConfig.feedbackGroupId = groupId;
                            this.saveConfig();
                            msg.reply(`✅ Grup Feedback berhasil diatur ke: ${groupId}`);
                        } else {
                            msg.reply(`Format salah.\nGunakan: !botadmin setfeedbackgroup [GROUP_ID]`);
                        }
                    }
                    else if (command === '!botadmin listmygroups') {
                        try {
                            const chats = await this.client.getChats();
                            const groups = chats.filter(c => c.isGroup);
                            let res = `*📋 Grup yang Diikuti Bot (${groups.length}):*\n\n`;
                            if (groups.length === 0) res += `- Bot belum bergabung di grup manapun.\n`;
                            else groups.slice(0, 20).forEach((g, i) => res += `${i + 1}. *${g.name}*\n   ID: \`${g.id._serialized}\`\n`);
                            if (groups.length > 20) res += `\n_...dan ${groups.length - 20} grup lainnya_`;
                            msg.reply(res);
                        } catch (e) {
                            msg.reply('❌ Gagal mendapatkan daftar grup.');
                        }
                    }
                    else if (command === '!botadmin addbroadcast') {
                        const groupId = args[2];
                        if (groupId && !this.botConfig.broadcastGroupIds.includes(groupId)) {
                            this.botConfig.broadcastGroupIds.push(groupId);
                            this.saveConfig();
                            msg.reply(`✅ Grup ${groupId} ditambahkan ke daftar broadcast.`);
                        } else {
                            msg.reply(`Format salah atau grup sudah ada.\nGunakan: !botadmin addbroadcast [GROUP_ID]`);
                        }
                    }
                    else if (command === '!botadmin removebroadcast') {
                        const groupId = args[2];
                        if (groupId) {
                            this.botConfig.broadcastGroupIds = this.botConfig.broadcastGroupIds.filter(id => id !== groupId);
                            this.saveConfig();
                            msg.reply(`✅ Grup ${groupId} dihapus dari daftar broadcast.`);
                        } else {
                            msg.reply(`Format salah.\nGunakan: !botadmin removebroadcast [GROUP_ID]`);
                        }
                    }
                    else if (command === '!botadmin listbroadcast') {
                        let res = `*📢 Daftar Grup Broadcast:*\n\n`;
                        if (this.botConfig.broadcastGroupIds.length === 0) res += `- Belum ada grup broadcast.\n`;
                        else this.botConfig.broadcastGroupIds.forEach((g, i) => res += `${i + 1}. ${g}\n`);
                        res += `\n*📣 Channel Pengumuman:*\n${this.botConfig.announcementChannelId || '(belum diatur)'}`;
                        msg.reply(res);
                    }
                    else if (command === '!botadmin setannouncement') {
                        const channelId = args[2];
                        if (channelId) {
                            this.botConfig.announcementChannelId = channelId;
                            this.saveConfig();
                            msg.reply(`✅ Channel Pengumuman berhasil diatur ke: ${channelId}`);
                        } else {
                            msg.reply(`Format salah.\nGunakan: !botadmin setannouncement [CHANNEL_ID]`);
                        }
                    }
                    else if (text.startsWith('!botadmin broadcast ')) {
                        const message = text.replace('!botadmin broadcast ', '').trim();
                        if (!message) { msg.reply('Format salah.\nGunakan: !botadmin broadcast [pesan]'); return; }
                        if (this.botConfig.broadcastGroupIds.length === 0) { msg.reply('❌ Belum ada grup broadcast. Tambah dulu dengan !botadmin addbroadcast [ID]'); return; }
                        msg.reply(`📢 Mengirim broadcast ke ${this.botConfig.broadcastGroupIds.length} grup...`);
                        const results = await this.broadcastToGroups(message);
                        msg.reply(`✅ Broadcast selesai.\nBerhasil: ${results.success}/${results.total} grup.`);
                    }
                    else if (text.startsWith('!botadmin announce ')) {
                        const message = text.replace('!botadmin announce ', '').trim();
                        if (!message) { msg.reply('Format salah.\nGunakan: !botadmin announce [pesan]'); return; }
                        if (!this.botConfig.announcementChannelId) { msg.reply('❌ Channel pengumuman belum diatur. Gunakan !botadmin setannouncement [ID]'); return; }
                        const ok = await this.sendToGroup(this.botConfig.announcementChannelId, message);
                        msg.reply(ok ? '✅ Pesan pengumuman berhasil dikirim!' : '❌ Gagal mengirim pesan pengumuman.');
                    }
                    else if (text.startsWith('!botadmin sendgroup ')) {
                        const parts = text.replace('!botadmin sendgroup ', '').trim().split(' ');
                        const groupId = parts[0];
                        const message = parts.slice(1).join(' ');
                        if (!groupId || !message) { msg.reply('Format salah.\nGunakan: !botadmin sendgroup [GROUP_ID] [pesan]'); return; }
                        const ok = await this.sendToGroup(groupId, message);
                        msg.reply(ok ? `✅ Pesan berhasil dikirim ke ${groupId}` : `❌ Gagal mengirim pesan ke ${groupId}`);
                    }
                }
            } catch (err) {
                this.logger.error('Error handling message', err);
            }
        });

        this.client.initialize().catch(err => {
            this.logger.error('Failed to initialize client', err);
            this.connectionStatus = 'DISCONNECTED';
        });
    }

    async logout() {
        this.logger.log('Manual restart/logout requested...');
        try {
            if (this.connectionStatus === 'CONNECTED' || this.connectionStatus === 'AUTHENTICATED') {
                await this.client.logout();
            } else {
                await this.client.destroy();
            }
        } catch (error) {
            this.logger.log('Error destroying old client, forcing reinitialization...', error);
        } finally {
            // Re-initialize a fresh client
            setTimeout(() => {
                this.initializeClient();
            }, 2000);
        }
    }

    getConnectionStatus() {
        return {
            status: this.connectionStatus,
            qrCode: this.qrCodeUrl,
            isReady: this.isReady
        };
    }

    async getJoinedGroups(): Promise<{ id: string; name: string; isBroadcast: boolean; isAnnouncement: boolean }[]> {
        if (!this.isReady) return [];
        try {
            // Beri batas waktu 15 detik — jika WA Web belum selesai load, kembalikan array kosong
            const timeout = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('getChats timed out after 15s')), 15_000)
            );
            const chats = await Promise.race([this.client.getChats(), timeout]);
            return chats
                .filter((c: any) => c.isGroup)
                .map((c: any) => ({
                    id: c.id._serialized,
                    name: c.name,
                    isBroadcast: this.botConfig.broadcastGroupIds.includes(c.id._serialized),
                    isAnnouncement: this.botConfig.announcementChannelId === c.id._serialized,
                }));
        } catch (error: any) {
            // Timeout / WA belum siap — bukan error kritis, bot tetap bisa kirim pesan
            this.logger.warn(`getJoinedGroups: ${error?.message ?? error} — daftar grup belum tersedia, coba refresh.`);
            return [];
        }
    }

    async sendToGroup(groupId: string, message: string, images: string[] = []): Promise<boolean> {
        if (!this.isReady) {
            this.logger.warn('Cannot send message: WhatsApp bot is not ready.');
            return false;
        }
        try {
            await this.client.sendMessage(groupId, message);
            if (images && images.length > 0) {
                let i = 1;
                for (const relativePath of images) {
                    const absolutePath = path.join(process.cwd(), relativePath);
                    if (fs.existsSync(absolutePath)) {
                        const media = MessageMedia.fromFilePath(absolutePath);
                        await this.client.sendMessage(groupId, media, { caption: `Lampiran ${i}/${images.length}` });
                        i++;
                    }
                }
            }
            this.logger.log(`Message sent to ${groupId}`);
            return true;
        } catch (error: any) {
            this.logger.error(`Failed to send message to ${groupId}: ${error.message}`);
            return false;
        }
    }

    async broadcastToGroups(message: string, images: string[] = []): Promise<{ success: number; failed: number; total: number }> {
        const targets = this.botConfig.broadcastGroupIds;
        let success = 0;
        let failed = 0;
        for (const groupId of targets) {
            const ok = await this.sendToGroup(groupId, message, images);
            if (ok) success++; else failed++;
            // Delay antar pesan untuk menghindari rate limit WhatsApp
            if (targets.indexOf(groupId) < targets.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1500));
            }
        }
        return { success, failed, total: targets.length };
    }

    async sendToAnnouncement(message: string, images: string[] = []): Promise<boolean> {
        const target = this.botConfig.announcementChannelId;
        if (!target) {
            this.logger.warn('Cannot send announcement: announcementChannelId not configured.');
            return false;
        }
        return this.sendToGroup(target, message, images);
    }

    getConfig() {
        return {
            broadcastGroupIds: this.botConfig.broadcastGroupIds,
            announcementChannelId: this.botConfig.announcementChannelId,
            designGroupId: this.botConfig.designGroupId,
        };
    }

    async setDesignGroup(groupId: string | null): Promise<void> {
        this.botConfig.designGroupId = groupId;
        this.saveConfig();
    }

    getDesignGroupId(): string | null {
        return this.botConfig.designGroupId;
    }

    async sendToDesignGroup(message: string, images: string[] = []): Promise<boolean> {
        const target = this.botConfig.designGroupId;
        if (!target) {
            this.logger.warn('Cannot send to design group: designGroupId is not configured.');
            return false;
        }
        return this.sendToGroup(target, message, images);
    }

    async updateBroadcastGroups(add?: string, remove?: string): Promise<void> {
        if (add && !this.botConfig.broadcastGroupIds.includes(add)) {
            this.botConfig.broadcastGroupIds.push(add);
        }
        if (remove) {
            this.botConfig.broadcastGroupIds = this.botConfig.broadcastGroupIds.filter(id => id !== remove);
        }
        this.saveConfig();
    }

    async setAnnouncementChannel(channelId: string | null): Promise<void> {
        this.botConfig.announcementChannelId = channelId;
        this.saveConfig();
    }

    async sendReport(reportMsg: string, proofImages: string[] = []): Promise<boolean> {
        if (!this.isReady) {
            this.logger.warn('Cannot send report: WhatsApp bot is not ready yet.');
            return false;
        }

        const target = this.botConfig.reportGroupId;
        if (!target) {
            this.logger.warn('Cannot send report: WHATSAPP_REPORT_GROUP_ID is not configured and !botadmin setreportgroup has not been run.');
            return false;
        }

        try {
            this.logger.log(`Sending financial report to ${target}...`);
            await this.client.sendMessage(target, reportMsg);

            // Sending proof images if any
            if (proofImages && proofImages.length > 0) {
                let i = 1;
                for (const relativePath of proofImages) {
                    const absolutePath = path.join(process.cwd(), relativePath);
                    if (fs.existsSync(absolutePath)) {
                        const media = MessageMedia.fromFilePath(absolutePath);
                        await this.client.sendMessage(target, media, {
                            caption: `Bukti Lampiran ${i}/${proofImages.length}`
                        });
                        i++;
                    } else {
                        this.logger.warn(`Proof image not found at path: ${absolutePath}`);
                    }
                }
            }

            this.logger.log('Financial report text sent to WhatsApp successfully!');
            return true;
        } catch (error: any) {
            this.logger.error(`Failed to send WhatsApp report: ${error.message}`, error.stack);
            return false;
        }
    }
}
