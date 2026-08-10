import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SocialDirection, SocialPlatform } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MetaApiService } from './meta-api.service';

export interface CreateSocialChannelInput {
    label: string;
    platform: SocialPlatform;
    pageId: string;
    igId?: string | null;
    accessToken: string;
    branchId?: number | null;
}

const CONTACT_SELECT = {
    id: true, externalId: true, name: true, platform: true, leadId: true, customerId: true,
    lead: { select: { id: true, name: true, status: true } },
};

@Injectable()
export class SocialInboxService {
    private readonly logger = new Logger(SocialInboxService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly meta: MetaApiService,
    ) {}

    // ─── Channel ─────────────────────────────────────────────────────────────
    listChannels() {
        return this.prisma.socialChannel.findMany({
            orderBy: { id: 'asc' },
            select: { id: true, label: true, platform: true, pageId: true, igId: true, branchId: true, isActive: true, branch: { select: { id: true, name: true } } },
        });
    }
    async createChannel(input: CreateSocialChannelInput) {
        if (!input.label?.trim() || !input.accessToken?.trim()) throw new BadRequestException('Label dan Access Token wajib diisi');
        // Instagram Login: cukup IG User ID (tanpa Page). Messenger: butuh Page ID.
        if (input.platform === 'INSTAGRAM') {
            if (!input.igId?.trim()) throw new BadRequestException('IG User ID wajib diisi (dari halaman Instagram API)');
        } else if (!input.pageId?.trim()) {
            throw new BadRequestException('Page ID wajib diisi untuk Messenger');
        }
        const pageId = (input.pageId?.trim() || input.igId?.trim() || '') as string;
        return this.prisma.socialChannel.create({
            data: {
                label: input.label.trim(),
                platform: input.platform,
                pageId,
                igId: input.igId?.trim() || null,
                accessToken: this.cleanToken(input.accessToken),
                branchId: input.branchId ?? null,
            },
            select: { id: true, label: true, platform: true },
        });
    }
    async updateChannel(id: number, input: Partial<CreateSocialChannelInput> & { isActive?: boolean }) {
        await this.prisma.socialChannel.findUniqueOrThrow({ where: { id } }).catch(() => { throw new NotFoundException('Channel tidak ditemukan'); });
        return this.prisma.socialChannel.update({
            where: { id },
            data: {
                ...(input.label !== undefined ? { label: input.label.trim() } : {}),
                ...(input.igId !== undefined ? { igId: input.igId?.trim() || null } : {}),
                ...(input.accessToken !== undefined && input.accessToken.trim() ? { accessToken: input.accessToken.trim() } : {}),
                ...(input.branchId !== undefined ? { branchId: input.branchId ?? null } : {}),
                ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
            },
            select: { id: true },
        });
    }
    async removeChannel(id: number) {
        await this.prisma.socialChannel.delete({ where: { id } });
        return { ok: true };
    }

    /** Bersihkan token dari spasi/baris baru (penyebab "cannot parse access token"). */
    private cleanToken(t?: string): string {
        return (t || '').replace(/\s+/g, '');
    }

    /** Tes token + akses akun (sebelum simpan). Surface error Meta yang terbaca. */
    async testConnection(input: { platform: SocialPlatform; pageId?: string; igId?: string; accessToken: string }) {
        const token = this.cleanToken(input.accessToken);
        if (!token) throw new BadRequestException('Access Token wajib diisi');
        const id = input.platform === 'INSTAGRAM' ? (input.igId?.trim() || '') : (input.pageId?.trim() || '');
        if (input.platform === 'MESSENGER' && !id) throw new BadRequestException('Page ID wajib diisi');
        try {
            const r = await this.meta.whoami(input.platform, id, token);
            return { ok: true, id: r.id, name: r.name };
        } catch (e) {
            throw new BadRequestException(`Token/koneksi bermasalah: ${(e as Error).message}`);
        }
    }

    /** Daftar Page + Page token dari token login (User/System User). */
    async listPagesFromToken(rawToken: string) {
        const token = this.cleanToken(rawToken);
        if (!token) throw new BadRequestException('Token wajib diisi');
        try {
            const pages = await this.meta.listPages(token);
            if (!pages.length) throw new BadRequestException('Tak ada Page. Pastikan token punya izin pages_show_list & akun mengelola Page.');
            return pages;
        } catch (e) {
            if (e instanceof BadRequestException) throw e;
            throw new BadRequestException(`Gagal ambil Page: ${(e as Error).message}`);
        }
    }

    /** Deteksi akun IG business yang terhubung ke Page (isi otomatis IG ID). */
    async detectInstagram(pageId: string, accessToken: string) {
        const token = this.cleanToken(accessToken);
        if (!pageId?.trim() || !token) throw new BadRequestException('Page ID & Access Token wajib diisi dulu');
        let ig: { id: string; username: string | null; name: string | null } | null;
        try {
            ig = await this.meta.getPageInstagram(pageId.trim(), token);
        } catch (e) {
            throw new BadRequestException(`Gagal deteksi IG: ${(e as Error).message}`);
        }
        if (!ig) throw new BadRequestException('Tak ada akun Instagram business terhubung ke Page ini (cek koneksi IG↔Page & izin instagram).');
        return ig;
    }

    // ─── Diagnostik webhook (apakah Meta menghubungi server kita?) ───────────
    private lastWebhook: { at: string; object: string | null; entries: number; signatureOk: boolean | null } | null = null;
    recordWebhookHit(info: { object: string | null; entries: number; signatureOk: boolean | null }) {
        this.lastWebhook = { at: new Date().toISOString(), ...info };
    }
    webhookDebug() {
        return { lastWebhook: this.lastWebhook };
    }

    // ─── Webhook ingest ──────────────────────────────────────────────────────
    /** Titik masuk webhook Messenger/Instagram. Tak pernah melempar. */
    async ingestWebhook(body: any): Promise<void> {
        const platform: SocialPlatform | null =
            body?.object === 'page' ? 'MESSENGER' : body?.object === 'instagram' ? 'INSTAGRAM' : null;
        if (!platform) return;
        for (const entry of body?.entry ?? []) {
            const entryId = String(entry?.id ?? '');
            const channel = await this.resolveChannel(platform, entryId);
            for (const ev of entry?.messaging ?? []) {
                try {
                    await this.handleEvent(channel, platform, ev);
                } catch (e) {
                    this.logger.error(`Gagal proses event ${platform}: ${(e as Error).message}`);
                }
            }
        }
    }

    private resolveChannel(platform: SocialPlatform, entryId: string) {
        return platform === 'INSTAGRAM'
            ? this.prisma.socialChannel.findFirst({ where: { platform, OR: [{ igId: entryId }, { pageId: entryId }] } })
            : this.prisma.socialChannel.findFirst({ where: { platform, pageId: entryId } });
    }

    private async handleEvent(channel: any, platform: SocialPlatform, ev: any): Promise<void> {
        const msg = ev?.message;
        if (!msg || ev?.message?.is_echo) return; // hanya pesan masuk; abaikan echo (kiriman page)
        if (!channel) {
            this.logger.warn(`Channel ${platform} tak dikenal untuk event`);
            return;
        }
        const senderId: string | undefined = ev?.sender?.id;
        if (!senderId) return;
        const mid: string | null = msg?.mid ?? null;
        if (mid) {
            const dup = await this.prisma.socialMessage.findUnique({ where: { externalId: mid } });
            if (dup) return; // idempoten
        }

        const att = Array.isArray(msg?.attachments) ? msg.attachments[0] : null;
        const type = att ? (att.type || 'IMAGE').toUpperCase() : 'TEXT';
        const body: string | null = msg?.text ?? (att ? `[${(att.type || 'lampiran')}]` : null);
        const mediaUrl: string | null = att?.payload?.url ?? null;
        const now = new Date();

        // Kontak + tautan CRM (best-effort profile name).
        let contact = await this.prisma.socialContact.findUnique({ where: { channelId_externalId: { channelId: channel.id, externalId: senderId } } });
        if (!contact) {
            const name = await this.meta.getProfileName(platform, senderId, channel.accessToken);
            contact = await this.prisma.socialContact.create({
                data: { channelId: channel.id, platform, externalId: senderId, name },
            });
        }

        const openConv = await this.prisma.socialConversation.findFirst({
            where: { channelId: channel.id, contactId: contact.id, status: { not: 'CLOSED' } },
            orderBy: { createdAt: 'desc' },
        });
        const conv = openConv
            ? await this.prisma.socialConversation.update({ where: { id: openConv.id }, data: { status: 'OPEN', lastMessageAt: now, unreadCount: { increment: 1 } } })
            : await this.prisma.socialConversation.create({ data: { channelId: channel.id, contactId: contact.id, status: 'OPEN', lastMessageAt: now, unreadCount: 1 } });

        await this.prisma.socialMessage.create({
            data: {
                channelId: channel.id,
                conversationId: conv.id,
                contactId: contact.id,
                externalId: mid,
                direction: SocialDirection.INBOUND,
                type,
                body,
                mediaUrl,
            },
        });
    }

    // ─── Inbox ───────────────────────────────────────────────────────────────
    async listConversations(opts: { platform?: SocialPlatform; branchId?: number; q?: string; take?: number; cursor?: number }) {
        const take = Math.min(Math.max(opts.take ?? 30, 1), 100);
        const where: any = {};
        if (opts.platform) where.channel = { platform: opts.platform };
        if (opts.branchId) where.channel = { ...(where.channel || {}), branchId: opts.branchId };
        if (opts.q) where.contact = { OR: [{ name: { contains: opts.q } }, { externalId: { contains: opts.q } }] };
        const rows = await this.prisma.socialConversation.findMany({
            where,
            take: take + 1,
            ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
            orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
            include: {
                contact: { select: CONTACT_SELECT },
                assignedTo: { select: { id: true, name: true } },
                channel: { select: { id: true, label: true, platform: true, branchId: true } },
            },
        });
        const hasMore = rows.length > take;
        const items = hasMore ? rows.slice(0, take) : rows;
        return { items, nextCursor: hasMore ? items[items.length - 1].id : null };
    }

    async getMessages(conversationId: number, opts: { take?: number; cursor?: number } = {}) {
        const take = Math.min(Math.max(opts.take ?? 40, 1), 100);
        // Reset unread saat dibuka.
        await this.prisma.socialConversation.update({ where: { id: conversationId }, data: { unreadCount: 0 } }).catch(() => {});
        const rows = await this.prisma.socialMessage.findMany({
            where: { conversationId, ...(opts.cursor ? { id: { lt: opts.cursor } } : {}) },
            orderBy: { id: 'desc' },
            take,
            select: { id: true, direction: true, type: true, body: true, mediaUrl: true, createdAt: true, sentBy: { select: { id: true, name: true } } },
        });
        return { items: rows.reverse(), nextCursor: rows.length === take ? rows[0].id : null };
    }

    async reply(conversationId: number, userId: number, text: string) {
        if (!text?.trim()) throw new BadRequestException('Pesan kosong');
        const conv = await this.prisma.socialConversation.findUnique({ where: { id: conversationId }, include: { channel: true, contact: true } });
        if (!conv) throw new NotFoundException('Percakapan tidak ditemukan');
        let messageId: string | null = null;
        // Instagram Login kirim via igId; Messenger via pageId.
        const sendId = conv.channel.platform === 'INSTAGRAM' ? (conv.channel.igId || conv.channel.pageId) : conv.channel.pageId;
        try {
            ({ messageId } = await this.meta.sendText(conv.channel.platform, sendId, conv.channel.accessToken, conv.contact.externalId, text.trim()));
        } catch (e) {
            throw new ConflictException(`Gagal kirim: ${(e as Error).message}`);
        }
        const msg = await this.prisma.socialMessage.create({
            data: {
                channelId: conv.channelId,
                conversationId: conv.id,
                contactId: conv.contactId,
                externalId: messageId,
                direction: SocialDirection.OUTBOUND,
                type: 'TEXT',
                body: text.trim(),
                sentById: userId,
            },
        });
        await this.prisma.socialConversation.update({ where: { id: conv.id }, data: { lastMessageAt: new Date() } });
        await this.prisma.socialConversation.updateMany({ where: { id: conv.id, assignedToId: null }, data: { assignedToId: userId } });
        return msg;
    }
}
