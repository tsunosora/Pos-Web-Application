import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SocialDirection, SocialPlatform } from '@prisma/client';
import type { SocialChannel } from '@prisma/client';
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

/**
 * Pesan otomatis Meta saat ada komentar di postingan ("Facebook membuat obrolan ini
 * karena X mengomentari postingan Anda…"). Meta mencatatnya seolah dikirim si
 * pengomentar, padahal bukan tulisan pelanggan (pelanggan bahkan belum melihatnya)
 * → disimpan bertipe SYSTEM dan tidak dihitung "belum dibaca" (komentarnya sudah
 * dihitung di tab Komentar).
 */
const PLATFORM_NOTICE_RE = /^(Facebook|Instagram|Meta) (membuat obrolan ini|created this (chat|conversation))\b/i;
export const isPlatformNotice = (text?: string | null) => !!text && PLATFORM_NOTICE_RE.test(text.trim());

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
                ...(input.accessToken !== undefined && this.cleanToken(input.accessToken) ? { accessToken: this.cleanToken(input.accessToken) } : {}),
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
    private lastWebhook: { at: string; object: string | null; entries: number; fields: string; signatureOk: boolean | null } | null = null;
    recordWebhookHit(info: { object: string | null; entries: number; fields: string; signatureOk: boolean | null }) {
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
        const notice = isPlatformNotice(msg?.text);
        const type = notice ? 'SYSTEM' : att ? (att.type || 'IMAGE').toUpperCase() : 'TEXT';
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
            ? await this.prisma.socialConversation.update({ where: { id: openConv.id }, data: { status: 'OPEN', lastMessageAt: now, ...(notice ? {} : { unreadCount: { increment: 1 } }) } })
            : await this.prisma.socialConversation.create({ data: { channelId: channel.id, contactId: contact.id, status: 'OPEN', lastMessageAt: now, unreadCount: notice ? 0 : 1 } });

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
        // Channel tanpa cabang = milik semua cabang, jadi tetap tampil untuk staf cabang.
        if (opts.branchId) where.channel = { ...(where.channel || {}), OR: [{ branchId: opts.branchId }, { branchId: null }] };
        if (opts.q) where.contact = { OR: [{ name: { contains: opts.q } }, { externalId: { contains: opts.q } }] };
        const rows = await this.prisma.socialConversation.findMany({
            where,
            take: take + 1,
            ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
            orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
            include: {
                contact: { select: CONTACT_SELECT },
                assignedTo: { select: { id: true, name: true } },
                channel: { select: { id: true, label: true, platform: true, branchId: true, pageId: true } },
            },
        });
        const hasMore = rows.length > take;
        const page = hasMore ? rows.slice(0, take) : rows;
        // Pesan terakhir PELANGGAN (bukan catatan sistem) → jendela balas 24 jam Meta.
        const last = page.length
            ? await this.prisma.socialMessage.groupBy({
                by: ['conversationId'],
                where: { conversationId: { in: page.map((c) => c.id) }, direction: SocialDirection.INBOUND, type: { not: 'SYSTEM' } },
                _max: { createdAt: true },
            })
            : [];
        const lastIn = new Map(last.map((r) => [r.conversationId, r._max.createdAt]));
        const items = page.map((c) => ({ ...c, lastInboundAt: lastIn.get(c.id) ?? null }));
        return { items, nextCursor: hasMore ? items[items.length - 1].id : null };
    }

    async getMessages(conversationId: number, opts: { take?: number; cursor?: number } = {}) {
        const take = Math.min(Math.max(opts.take ?? 40, 1), 100);
        // Reset unread saat dibuka.
        await this.prisma.socialConversation.update({ where: { id: conversationId }, data: { unreadCount: 0 } }).catch(() => {});
        // Urut waktu pesan (bukan id): pesan lama hasil sinkron bisa tersimpan
        // SETELAH pesan baru dari webhook.
        const rows = await this.prisma.socialMessage.findMany({
            where: { conversationId },
            ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
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
            const msg = (e as Error).message;
            if (/luar jendela|outside (of )?(the )?allowed window|24[- ]?(hour|jam)/i.test(msg)) {
                const app = conv.channel.platform === 'INSTAGRAM' ? 'aplikasi Instagram' : 'Messenger / Meta Business Suite';
                throw new ConflictException(`Jendela balas 24 jam sudah lewat — Meta hanya mengizinkan balasan lewat PosPro dalam 24 jam sejak pesan terakhir pelanggan. Balas langsung dari ${app}. (${msg})`);
            }
            throw new ConflictException(`Gagal kirim: ${msg}`);
        }
        // Pesan SUDAH terkirim ke pelanggan. Kalau menyimpannya gagal, jangan balas "gagal
        // kirim" — staf akan mengirim ulang dan pelanggan menerima pesan dobel.
        const data = {
            channelId: conv.channelId,
            conversationId: conv.id,
            contactId: conv.contactId,
            externalId: messageId,
            direction: SocialDirection.OUTBOUND,
            type: 'TEXT',
            body: text.trim(),
            sentById: userId,
        };
        const msg = await this.prisma.socialMessage.create({ data }).catch(async (e) => {
            // Sinkron DM sempat menyimpan pesan yang sama lebih dulu → pakai baris itu.
            if (e?.code === 'P2002' && messageId) {
                const ada = await this.prisma.socialMessage.findUnique({ where: { externalId: messageId } });
                if (ada) return ada;
            }
            this.logger.error(`Balasan percakapan ${conv.id} terkirim tapi gagal disimpan (mid ${String(messageId).length} karakter): ${(e as Error).message}`);
            return this.prisma.socialMessage.create({ data: { ...data, externalId: null } });
        });
        await this.prisma.socialConversation.update({ where: { id: conv.id }, data: { lastMessageAt: new Date() } });
        await this.prisma.socialConversation.updateMany({ where: { id: conv.id, assignedToId: null }, data: { assignedToId: userId } });
        return msg;
    }

    // ─── Sinkron DM (cadangan webhook + tarik percakapan lama) ───────────────
    /**
     * Tarik percakapan 1-lawan-1 terbaru lewat Graph API. Grup/saluran siaran
     * dilewati (Meta tidak membuka pesannya); percakapan yang tidak berubah sejak
     * sinkron terakhir tidak diambil ulang. Idempoten per id pesan (mid).
     */
    // Percakapan yang sudah pernah diambil penuh sejak server hidup. Percakapan yang
    // lahir dari webhook (lastMessageAt = sekarang) tetap diambil sekali supaya
    // riwayat lamanya ikut masuk; setelah itu hanya bila ada aktivitas baru.
    private readonly syncedConvs = new Set<string>();
    private noticesTagged = false;

    async syncDms(channel: SocialChannel): Promise<{ conversations: number; added: number }> {
        if (!this.noticesTagged) {
            // Pesan otomatis Meta yang tersimpan sebelum aturan SYSTEM ada.
            await this.prisma.socialMessage.updateMany({
                where: { type: { not: 'SYSTEM' }, OR: [{ body: { startsWith: 'Facebook membuat obrolan ini' } }, { body: { startsWith: 'Facebook created this' } }] },
                data: { type: 'SYSTEM' },
            });
            this.noticesTagged = true;
        }
        const ownIds = new Set([channel.igId, channel.pageId].filter(Boolean) as string[]);
        const accountId = channel.platform === 'INSTAGRAM' ? (channel.igId || channel.pageId) : channel.pageId;
        const convs = await this.meta.listConversations(channel.platform, accountId, channel.accessToken, 25);
        // Pesan masuk yang segar (≤3 hari) & belum dibalas dihitung belum dibaca.
        const freshSince = Date.now() - 3 * 24 * 3600 * 1000;
        let conversations = 0;
        let added = 0;
        for (const c of convs) {
            const others = c.participants.filter((p) => !ownIds.has(p.id));
            if (c.participants.length !== 2 || others.length !== 1) continue;
            const cust = others[0];
            conversations++;

            let contact = await this.prisma.socialContact.findUnique({ where: { channelId_externalId: { channelId: channel.id, externalId: cust.id } } });
            let conv = contact
                ? await this.prisma.socialConversation.findFirst({ where: { channelId: channel.id, contactId: contact.id, status: { not: 'CLOSED' } }, orderBy: { createdAt: 'desc' } })
                : null;
            const key = `${channel.id}:${c.id}`;
            if (this.syncedConvs.has(key) && conv?.lastMessageAt && c.updatedAt <= conv.lastMessageAt) continue; // tak ada yang baru

            // Satu id pesan dihitung sekali walau terkirim ganda dari API.
            const msgs = [...new Map((await this.meta.listConversationMessages(channel.platform, c.id, channel.accessToken, 20)).map((m) => [m.id, m])).values()];
            this.syncedConvs.add(key);
            if (!msgs.length) continue;
            if (!contact) {
                contact = await this.prisma.socialContact.upsert({
                    where: { channelId_externalId: { channelId: channel.id, externalId: cust.id } },
                    create: { channelId: channel.id, platform: channel.platform, externalId: cust.id, name: cust.name },
                    update: {},
                });
            } else if (!contact.name && cust.name) {
                await this.prisma.socialContact.update({ where: { id: contact.id }, data: { name: cust.name } });
            }
            const known = new Set(
                (await this.prisma.socialMessage.findMany({ where: { externalId: { in: msgs.map((m) => m.id) } }, select: { externalId: true } }))
                    .map((m) => m.externalId),
            );
            const fresh = msgs.filter((m) => !known.has(m.id)).sort((a, b) => a.at.getTime() - b.at.getTime());
            const lastAt = msgs.reduce((t, m) => (m.at > t ? m.at : t), new Date(0));
            if (!conv) {
                conv = await this.prisma.socialConversation.create({
                    data: { channelId: channel.id, contactId: contact.id, status: 'OPEN', lastMessageAt: lastAt, unreadCount: 0 },
                });
            }
            if (!fresh.length) {
                await this.prisma.socialConversation.update({ where: { id: conv.id }, data: { lastMessageAt: lastAt > (conv.lastMessageAt ?? new Date(0)) ? lastAt : conv.lastMessageAt } });
                continue;
            }
            const outbound = (m: { fromId: string | null }) => !!m.fromId && ownIds.has(m.fromId);
            const r = await this.prisma.socialMessage.createMany({
                data: fresh.map((m) => ({
                    channelId: channel.id,
                    conversationId: conv!.id,
                    contactId: contact!.id,
                    externalId: m.id,
                    direction: outbound(m) ? SocialDirection.OUTBOUND : SocialDirection.INBOUND,
                    type: isPlatformNotice(m.text) ? 'SYSTEM' : m.type,
                    body: m.text ?? (m.type === 'UNSUPPORTED'
                        ? `[Pesan tidak didukung API — buka di ${channel.platform === 'INSTAGRAM' ? 'Instagram' : 'Messenger'}]`
                        : m.mediaUrl ? null : '[lampiran]'),
                    mediaUrl: m.mediaUrl,
                    createdAt: m.at,
                })),
                skipDuplicates: true, // webhook bisa menyimpan pesan yang sama berbarengan
            });
            added += r.count;
            // Belum dibaca = pesan masuk baru & segar setelah balasan terakhir tim.
            const lastOut = msgs.filter(outbound).reduce((t, m) => (m.at > t ? m.at : t), new Date(0));
            const unread = fresh.filter((m) => !outbound(m) && !isPlatformNotice(m.text) && m.at > lastOut && m.at.getTime() >= freshSince).length;
            await this.prisma.socialConversation.update({
                where: { id: conv.id },
                data: {
                    status: 'OPEN',
                    lastMessageAt: lastAt > (conv.lastMessageAt ?? new Date(0)) ? lastAt : conv.lastMessageAt,
                    ...(unread ? { unreadCount: { increment: unread } } : {}),
                },
            });
        }
        return { conversations, added };
    }
}
