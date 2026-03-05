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
        feedbackGroupId: null
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
