import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, WaConversationStatus, WaDirection, WaMessageStatus, WaMessageType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CloudApiService } from './cloud-api.service';
import { toWaPhone, toLeadKey } from '../common/utils/phone.util';

export interface ListConversationsOpts {
    status?: WaConversationStatus;
    assignedToId?: number;
    channelId?: number;
    branchId?: number;
    q?: string;
    cursor?: number;
    take?: number;
}

const WINDOW_MS = 24 * 60 * 60 * 1000; // jendela layanan 24 jam Meta

// Peta tipe pesan Meta → enum WaMessageType.
const TYPE_MAP: Record<string, WaMessageType> = {
    text: WaMessageType.TEXT,
    image: WaMessageType.IMAGE,
    document: WaMessageType.DOCUMENT,
    audio: WaMessageType.AUDIO,
    video: WaMessageType.VIDEO,
    sticker: WaMessageType.STICKER,
    location: WaMessageType.LOCATION,
    contacts: WaMessageType.CONTACT,
    interactive: WaMessageType.INTERACTIVE,
    button: WaMessageType.INTERACTIVE,
    template: WaMessageType.TEMPLATE,
};

// Peta status Meta → enum WaMessageStatus.
const STATUS_MAP: Record<string, WaMessageStatus> = {
    sent: WaMessageStatus.SENT,
    delivered: WaMessageStatus.DELIVERED,
    read: WaMessageStatus.READ,
    failed: WaMessageStatus.FAILED,
};

/**
 * Materialisasi webhook Meta → domain WhatsApp CRM (Fase 3).
 * Idempoten: pesan di-dedup via WaMessage.waMessageId (unik).
 */
@Injectable()
export class InboxService {
    private readonly logger = new Logger(InboxService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly cloud: CloudApiService,
    ) {}

    /** Titik masuk: iterasi entry/changes payload webhook. Tak pernah melempar
     *  (webhook wajib balas 200) — error di-log & disimpan di WaWebhookEvent. */
    async ingestWebhook(body: any): Promise<void> {
        for (const entry of body?.entry ?? []) {
            for (const change of entry?.changes ?? []) {
                const value = change?.value;
                if (!value) continue;
                const phoneNumberId = value?.metadata?.phone_number_id;
                const channel = phoneNumberId
                    ? await this.prisma.waChannel.findUnique({ where: { phoneNumberId } })
                    : null;

                for (const msg of value?.messages ?? []) {
                    try {
                        await this.handleInbound(channel, value, msg);
                    } catch (e) {
                        await this.logEvent('message', msg?.id, msg, (e as Error).message);
                        this.logger.error(`Gagal proses pesan masuk ${msg?.id}: ${(e as Error).message}`);
                    }
                }
                for (const st of value?.statuses ?? []) {
                    try {
                        await this.handleStatus(st);
                    } catch (e) {
                        await this.logEvent('status', st?.id, st, (e as Error).message);
                        this.logger.error(`Gagal proses status ${st?.id}: ${(e as Error).message}`);
                    }
                }
            }
        }
    }

    /** Simpan log mentah event (audit + jejak error). */
    private async logEvent(eventType: string, waMessageId: string | undefined, payload: any, error?: string) {
        await this.prisma.waWebhookEvent.create({
            data: {
                eventType,
                waMessageId: waMessageId ?? null,
                payloadJson: payload ?? {},
                processed: !error,
                error: error ?? null,
            },
        });
    }

    private extractBody(msg: any): string | null {
        switch (msg?.type) {
            case 'text':
                return msg?.text?.body ?? null;
            case 'image':
            case 'document':
            case 'video':
                return msg?.[msg.type]?.caption ?? null;
            case 'button':
                return msg?.button?.text ?? null;
            case 'interactive':
                return (
                    msg?.interactive?.button_reply?.title ??
                    msg?.interactive?.list_reply?.title ??
                    null
                );
            default:
                return null;
        }
    }

    private async handleInbound(channel: any, value: any, msg: any): Promise<void> {
        const waMessageId: string | undefined = msg?.id;

        // Idempotensi: kalau pesan ini sudah pernah tersimpan, lewati.
        if (waMessageId) {
            const existing = await this.prisma.waMessage.findUnique({ where: { waMessageId } });
            if (existing) return;
        }

        // Channel tak dikenal → catat error, jangan buat data liar.
        if (!channel) {
            await this.logEvent(
                'message',
                waMessageId,
                msg,
                `channel tak dikenal (phone_number_id=${value?.metadata?.phone_number_id})`,
            );
            return;
        }

        const from: string | undefined = msg?.from;
        const waId = toWaPhone(from);
        if (!waId) {
            await this.logEvent('message', waMessageId, msg, `nomor pengirim tak valid: ${from}`);
            return;
        }
        const phoneNormalized = toLeadKey(from) ?? waId.replace(/^62/, '');
        const profileName: string | null = value?.contacts?.[0]?.profile?.name ?? null;
        const now = new Date();

        // 1) Upsert kontak + tautan CRM (cari Lead by phoneNormalized).
        const lead = await this.prisma.lead.findFirst({
            where: { phoneNormalized },
            orderBy: { updatedAt: 'desc' },
            select: { id: true, convertedCustomerId: true },
        });

        const contact = await this.prisma.waContact.upsert({
            where: { waId },
            create: {
                waId,
                phoneNormalized,
                profileName,
                lastInboundAt: now,
                leadId: lead?.id ?? null,
                customerId: lead?.convertedCustomerId ?? null,
            },
            update: {
                profileName: profileName ?? undefined,
                lastInboundAt: now,
                // Isi tautan CRM bila belum ada (jangan timpa yang sudah terset manual).
                ...(lead?.id ? { leadId: lead.id } : {}),
                ...(lead?.convertedCustomerId ? { customerId: lead.convertedCustomerId } : {}),
            },
        });

        // 2) Percakapan OPEN untuk (channel, contact) — refresh jendela 24 jam.
        const windowExpiresAt = new Date(now.getTime() + WINDOW_MS);
        const openConv = await this.prisma.waConversation.findFirst({
            where: { channelId: channel.id, contactId: contact.id, status: { not: 'CLOSED' } },
            orderBy: { createdAt: 'desc' },
        });
        const conversation = openConv
            ? await this.prisma.waConversation.update({
                  where: { id: openConv.id },
                  data: {
                      status: 'OPEN',
                      lastMessageAt: now,
                      windowExpiresAt,
                      unreadCount: { increment: 1 },
                  },
              })
            : await this.prisma.waConversation.create({
                  data: {
                      channelId: channel.id,
                      contactId: contact.id,
                      status: 'OPEN',
                      lastMessageAt: now,
                      windowExpiresAt,
                      unreadCount: 1,
                  },
              });

        // 3) Simpan pesan masuk.
        await this.prisma.waMessage.create({
            data: {
                channelId: channel.id,
                conversationId: conversation.id,
                contactId: contact.id,
                waMessageId: waMessageId ?? null,
                direction: WaDirection.INBOUND,
                type: TYPE_MAP[msg?.type] ?? WaMessageType.UNKNOWN,
                status: WaMessageStatus.DELIVERED,
                body: this.extractBody(msg),
                payloadJson: msg ?? {},
            },
        });

        // 4) Jejak aktivitas CRM (timeline lead/customer).
        if (contact.leadId || contact.customerId) {
            await this.prisma.leadActivity.create({
                data: {
                    leadId: contact.leadId ?? null,
                    customerId: contact.customerId ?? null,
                    kind: 'MESSAGE',
                    text: this.extractBody(msg) ?? `[${msg?.type ?? 'pesan'}] via WhatsApp`,
                    meta: { source: 'whatsapp', waMessageId },
                },
            });
        }

        await this.logEvent('message', waMessageId, msg);
    }

    private async handleStatus(st: any): Promise<void> {
        const waMessageId: string | undefined = st?.id;
        const mapped = STATUS_MAP[st?.status];
        if (!waMessageId || !mapped) {
            await this.logEvent('status', waMessageId, st, `status tak dikenal: ${st?.status}`);
            return;
        }
        const existing = await this.prisma.waMessage.findUnique({ where: { waMessageId } });
        if (!existing) {
            // Pesan broadcast tidak menyimpan WaMessage — update status recipient by waMessageId.
            const upd = await this.prisma.waBroadcastRecipient.updateMany({
                where: { waMessageId },
                data: { status: mapped as any },
            });
            await this.logEvent('status', waMessageId, st, upd.count ? undefined : 'pesan tak ditemukan utk status ini');
            return;
        }

        // Jangan mundurkan status (read → delivered). Urutan: SENT<DELIVERED<READ.
        const rank: Record<string, number> = { QUEUED: 0, SENT: 1, DELIVERED: 2, READ: 3, FAILED: 1 };
        if (mapped !== 'FAILED' && rank[existing.status] >= rank[mapped]) {
            await this.logEvent('status', waMessageId, st);
            return;
        }

        const err = st?.errors?.[0];
        await this.prisma.waMessage.update({
            where: { waMessageId },
            data: {
                status: mapped,
                errorCode: err?.code != null ? String(err.code) : undefined,
                errorMessage: err?.title ?? err?.message ?? undefined,
            },
        });
        await this.logEvent('status', waMessageId, st);
    }

    // ─── Query & aksi inbox (Fase 4) ─────────────────────────────────────────

    private static readonly CONTACT_SELECT = {
        id: true, waId: true, profileName: true, phoneNormalized: true,
        leadId: true, customerId: true, optedOut: true,
    };

    /** Daftar percakapan dgn filter + paginasi cursor (lastMessageAt desc). */
    async listConversations(opts: ListConversationsOpts) {
        const take = Math.min(Math.max(opts.take ?? 30, 1), 100);
        const where: Prisma.WaConversationWhereInput = {};
        if (opts.status) where.status = opts.status;
        if (opts.assignedToId !== undefined) where.assignedToId = opts.assignedToId;
        if (opts.channelId) where.channelId = opts.channelId;
        if (opts.branchId) where.channel = { branchId: opts.branchId };
        if (opts.q) {
            where.contact = {
                OR: [
                    { profileName: { contains: opts.q } },
                    { waId: { contains: opts.q } },
                    { phoneNormalized: { contains: opts.q } },
                ],
            };
        }
        const rows = await this.prisma.waConversation.findMany({
            where,
            take: take + 1,
            ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
            orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
            include: {
                contact: { select: InboxService.CONTACT_SELECT },
                assignedTo: { select: { id: true, name: true } },
                channel: { select: { id: true, label: true, branchId: true } },
            },
        });
        const hasMore = rows.length > take;
        const items = hasMore ? rows.slice(0, take) : rows;
        return { items, nextCursor: hasMore ? items[items.length - 1].id : null };
    }

    async getConversation(id: number) {
        const conv = await this.prisma.waConversation.findUnique({
            where: { id },
            include: {
                contact: { select: InboxService.CONTACT_SELECT },
                assignedTo: { select: { id: true, name: true } },
                channel: { select: { id: true, label: true, branchId: true } },
            },
        });
        if (!conv) throw new NotFoundException('Percakapan tidak ditemukan');
        return conv;
    }

    /** Pesan sebuah percakapan (asc) + reset unread. Cursor = id pesan tertua. */
    async getMessages(conversationId: number, opts: { cursor?: number; take?: number } = {}) {
        const take = Math.min(Math.max(opts.take ?? 50, 1), 100);
        await this.prisma.waConversation.update({
            where: { id: conversationId },
            data: { unreadCount: 0 },
        });
        const rows = await this.prisma.waMessage.findMany({
            where: { conversationId },
            take: take + 1,
            ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
            orderBy: { id: 'desc' },
            include: { sentBy: { select: { id: true, name: true } } },
        });
        const hasMore = rows.length > take;
        const slice = hasMore ? rows.slice(0, take) : rows;
        return { items: slice.reverse(), nextCursor: hasMore ? slice[0].id : null };
    }

    /** Assign agen dan/atau ubah status percakapan. */
    async updateConversation(
        id: number,
        data: { assignedToId?: number | null; status?: WaConversationStatus; snoozedUntil?: Date | null },
    ) {
        await this.getConversation(id); // 404 bila tak ada
        return this.prisma.waConversation.update({
            where: { id },
            data: {
                ...(data.assignedToId !== undefined ? { assignedToId: data.assignedToId } : {}),
                ...(data.status ? { status: data.status } : {}),
                ...(data.snoozedUntil !== undefined ? { snoozedUntil: data.snoozedUntil } : {}),
            },
        });
    }

    /** Balas teks — HANYA sah di dalam jendela layanan 24 jam. */
    async replyText(conversationId: number, userId: number, text: string) {
        const conv = await this.prisma.waConversation.findUnique({
            where: { id: conversationId },
            include: { channel: true, contact: true },
        });
        if (!conv) throw new NotFoundException('Percakapan tidak ditemukan');
        if (conv.contact.optedOut) throw new ConflictException('Kontak sudah opt-out (berhenti berlangganan)');
        const expired = !conv.windowExpiresAt || conv.windowExpiresAt.getTime() < Date.now();
        if (expired) {
            throw new ConflictException('Di luar jendela 24 jam — gunakan pesan template');
        }
        const { waMessageId } = await this.cloud.sendText(conv.channel.phoneNumberId, conv.contact.waId, text);
        return this.persistOutbound(conv, userId, {
            waMessageId,
            type: WaMessageType.TEXT,
            body: text,
        });
    }

    /** Balas via template pra-approve Meta — sah kapan pun (termasuk luar 24 jam). */
    async replyTemplate(
        conversationId: number,
        userId: number,
        input: { name: string; language?: string; components?: any[]; previewText?: string },
    ) {
        const conv = await this.prisma.waConversation.findUnique({
            where: { id: conversationId },
            include: { channel: true, contact: true },
        });
        if (!conv) throw new NotFoundException('Percakapan tidak ditemukan');
        if (conv.contact.optedOut) throw new ConflictException('Kontak sudah opt-out (berhenti berlangganan)');
        const { waMessageId } = await this.cloud.sendTemplate(
            conv.channel.phoneNumberId,
            conv.contact.waId,
            input.name,
            input.language ?? 'id',
            input.components ?? [],
        );
        return this.persistOutbound(conv, userId, {
            waMessageId,
            type: WaMessageType.TEMPLATE,
            body: input.previewText ?? `[template: ${input.name}]`,
            templateName: input.name,
        });
    }

    private async persistOutbound(
        conv: { id: number; channelId: number; contactId: number },
        userId: number,
        m: { waMessageId: string | null; type: WaMessageType; body: string; templateName?: string },
    ) {
        const msg = await this.prisma.waMessage.create({
            data: {
                channelId: conv.channelId,
                conversationId: conv.id,
                contactId: conv.contactId,
                waMessageId: m.waMessageId,
                direction: WaDirection.OUTBOUND,
                type: m.type,
                status: WaMessageStatus.SENT,
                body: m.body,
                templateName: m.templateName ?? null,
                sentById: userId,
            },
        });
        await this.prisma.waConversation.update({
            where: { id: conv.id },
            data: { lastMessageAt: new Date() },
        });
        return msg;
    }
}
