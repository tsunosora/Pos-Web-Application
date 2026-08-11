import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, WaConversationStatus, WaDirection, WaMessageStatus, WaMessageType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CloudApiService } from './cloud-api.service';
import { MediaStorageService } from './media-storage.service';
import { AutoReplyService } from './auto-reply.service';
import { TemplatesService } from './templates.service';
import { WaEventsService } from './wa-events.service';
import { roleCanInbox } from './wa-roles.util';
import { toWaPhone, toLeadKey } from '../common/utils/phone.util';

export interface ListConversationsOpts {
    status?: WaConversationStatus;
    assignedToId?: number | null; // null = hanya yang belum di-assign
    mineOrUnassigned?: number; // userId — batasi ke (di-assign ke saya ATAU belum di-assign)
    phoneIn?: string[]; // batasi ke kontak dgn phoneNormalized ∈ daftar (mis. pelanggan SO desainer)
    channelId?: number;
    branchId?: number;
    q?: string;
    cursor?: number;
    take?: number;
}

export interface StartConversationInput {
    channelId: number;
    phone: string;
    name?: string;
    createLead?: boolean; // default true — daftarkan juga sebagai Lead CRM (dedup by phone)
    template: { name: string; language?: string; components?: any[]; previewText?: string };
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

// Tipe MIME yang didukung WhatsApp Cloud API untuk unggah media (per error #100 Meta).
const WA_SUPPORTED_MEDIA = new Set<string>([
    'image/jpeg', 'image/png', 'image/webp',
    'video/mp4', 'video/3gpp',
    'audio/aac', 'audio/mp4', 'audio/mpeg', 'audio/amr', 'audio/ogg', 'audio/opus',
    'application/pdf', 'text/plain', 'application/msword', 'application/vnd.ms-excel',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);
const WA_SUPPORTED_HINT = 'gambar (jpg/png/webp), video mp4/3gp, audio, PDF, Word, Excel, PowerPoint, atau teks (.txt)';

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
        private readonly autoReply: AutoReplyService,
        private readonly mediaStore: MediaStorageService,
        private readonly templates: TemplatesService,
        private readonly waEvents: WaEventsService,
    ) {}

    /** Daftar agen yang bisa ditugaskan menangani percakapan (untuk dropdown assign).
     *  Cocokkan role by kata kunci karena nama role dinamis (mis. "Desainer"). */
    async listAgents(): Promise<Array<{ id: number; name: string | null; roleName: string | null; branchId: number | null }>> {
        const users = await this.prisma.user.findMany({
            where: { isActive: true },
            select: { id: true, name: true, branchId: true, role: { select: { name: true } } },
            orderBy: { name: 'asc' },
        });
        return users
            .filter((u) => roleCanInbox(u.role?.name))
            .map((u) => ({ id: u.id, name: u.name, roleName: u.role?.name ?? null, branchId: u.branchId }));
    }

    /** Normalisasi 1 nomor ke bentuk phoneNormalized (mis. 0812/6281 → 812…). */
    private normalizePhoneKey(raw?: string | null): string | null {
        if (!raw) return null;
        return toLeadKey(raw) ?? toWaPhone(raw)?.replace(/^62/, '') ?? null;
    }

    /** Kumpulan phoneNormalized pelanggan dari SO milik seorang desainer (User).
     *  Basis penautan chat↔SO: cocok by designerName (nama User) + nomor pelanggan. */
    async designerSoPhonesByUser(userId: number): Promise<string[]> {
        const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
        if (!u?.name) return [];
        const sos = await this.prisma.salesOrder.findMany({
            where: { designerName: { equals: u.name }, status: { not: 'CANCELLED' } },
            select: { customerPhone: true },
            take: 3000,
        });
        const set = new Set<string>();
        for (const so of sos) {
            const key = this.normalizePhoneKey(so.customerPhone);
            if (key) set.add(key);
        }
        return [...set];
    }

    /** Cari percakapan WA untuk pelanggan sebuah SO (deep-link "Buka chat WA" dari SO). */
    async resolveConversationBySalesOrder(soId: number): Promise<{ conversationId: number | null; phone: string | null }> {
        const so = await this.prisma.salesOrder.findUnique({
            where: { id: soId },
            select: { customerPhone: true, customerId: true },
        });
        if (!so) throw new NotFoundException('SO tidak ditemukan');
        const phoneKey = this.normalizePhoneKey(so.customerPhone);
        const or: Prisma.WaContactWhereInput[] = [];
        if (so.customerId) or.push({ customerId: so.customerId });
        if (phoneKey) or.push({ phoneNormalized: phoneKey });
        if (!or.length) return { conversationId: null, phone: so.customerPhone ?? null };

        const contact = await this.prisma.waContact.findFirst({ where: { OR: or }, select: { id: true } });
        if (!contact) return { conversationId: null, phone: so.customerPhone ?? null };
        const conv = await this.prisma.waConversation.findFirst({
            where: { contactId: contact.id },
            orderBy: { lastMessageAt: 'desc' },
            select: { id: true },
        });
        return { conversationId: conv?.id ?? null, phone: so.customerPhone ?? null };
    }

    /** SO yang terkait sebuah percakapan (via nomor HP pelanggan / customerId). */
    async salesOrdersForConversation(conversationId: number) {
        const conv = await this.prisma.waConversation.findUnique({
            where: { id: conversationId },
            select: { contact: { select: { phoneNormalized: true, customerId: true } } },
        });
        if (!conv) throw new NotFoundException('Percakapan tidak ditemukan');
        const phone = conv.contact?.phoneNormalized || null;
        const or: Prisma.SalesOrderWhereInput[] = [];
        if (conv.contact?.customerId) or.push({ customerId: conv.contact.customerId });
        if (phone) or.push({ customerPhone: { contains: phone } });
        if (!or.length) return [];
        return this.prisma.salesOrder.findMany({
            where: { OR: or, status: { not: 'CANCELLED' } },
            select: { id: true, soNumber: true, status: true, designerName: true, customerName: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
            take: 20,
        });
    }

    /** Auto-create Lead dari chat WA baru (default aktif; matikan via env). */
    private get autoCreateLead(): boolean {
        return (process.env.WA_AUTO_CREATE_LEAD || 'true').toLowerCase() !== 'false';
    }

    /** Titik masuk: iterasi entry/changes payload webhook. Tak pernah melempar
     *  (webhook wajib balas 200) — error di-log & disimpan di WaWebhookEvent. */
    async ingestWebhook(body: any): Promise<void> {
        for (const entry of body?.entry ?? []) {
            for (const change of entry?.changes ?? []) {
                const value = change?.value;
                if (!value) continue;

                // Status template (APPROVED/REJECTED/…) — update near-real-time,
                // tak perlu tunggu cron/klik Sinkron. Perlu langganan field
                // `message_template_status_update` di webhook Meta.
                if (change?.field === 'message_template_status_update') {
                    try {
                        await this.templates.applyStatusFromWebhook(value);
                    } catch (e) {
                        await this.logEvent('template_status', undefined, value, (e as Error).message);
                        this.logger.error(`Gagal proses status template: ${(e as Error).message}`);
                    }
                    continue;
                }

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

    /**
     * Baca marker #kode di pesan masuk → cocokkan ke WaQrLink → set sumber lead
     * + naikkan scanCount. Lead baru selalu di-set; lead lama hanya bila sumbernya
     * masih generik (WHATSAPP) agar tak menimpa atribusi manual/lain.
     */
    private async applyQrAttribution(
        leadId: number,
        body: string | null,
        createdLead: boolean,
        branchId: number | null,
    ): Promise<void> {
        if (!body) return;
        const m = body.match(/#([a-z0-9_]+)/i);
        if (!m) return;
        const code = m[1].toLowerCase();
        try {
            const qr = await this.prisma.waQrLink.findUnique({ where: { code } });
            if (!qr || !qr.isActive) return;
            const lead = await this.prisma.lead.findUnique({ where: { id: leadId }, select: { source: true } });
            const canOverride = createdLead || lead?.source === 'WHATSAPP' || lead?.source == null;
            if (canOverride) {
                await this.prisma.lead.update({
                    where: { id: leadId },
                    data: {
                        source: qr.source as any,
                        sourceDetail: qr.sourceDetail || qr.name,
                        ...(branchId != null ? { branchId } : {}),
                    },
                });
                await this.prisma.leadActivity.create({
                    data: {
                        leadId,
                        kind: 'MESSAGE',
                        text: `Masuk via QR "${qr.name}" (sumber: ${qr.source})`,
                        meta: { source: 'whatsapp-qr', qrCode: code },
                    },
                });
            }
            await this.prisma.waQrLink.update({ where: { id: qr.id }, data: { scanCount: { increment: 1 } } });
        } catch (e) {
            // Atribusi bersifat best-effort; jangan gagalkan pemrosesan webhook.
            this.logger?.warn?.(`applyQrAttribution gagal untuk #${code}: ${e}`);
        }
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

    /** MIME media inbound (image/document/…) dari payload Meta, bila ada. */
    private extractMediaMime(msg: any): string | null {
        const t = (msg?.type || '').toLowerCase();
        return msg?.[t]?.mime_type ?? null;
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

        // Reaksi emoji dari pelanggan → bukan pesan baru; update reactionsJson pesan target.
        if (msg?.type === 'reaction') {
            await this.handleReaction(msg);
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
        const prior = await this.prisma.lead.findFirst({
            where: { phoneNormalized },
            orderBy: { updatedAt: 'desc' },
            select: { id: true, status: true, convertedCustomerId: true },
        });
        // Siklus selesai (Closing/Hilang) → chat berikutnya adalah INQUIRY BARU, bukan
        // menampilkan status closing lama. Buat lead baru (pelanggan lama = Repeat Order).
        // INVALID sengaja TIDAK di-resurrect (ditandai buruk manual). Selama siklus aktif
        // (NEW/FOLLOW_UP/NEGOTIATION) tetap pakai lead yang sama (anti-spam).
        const DONE_STATUSES = ['CLOSED_WON', 'CLOSED_LOST'];
        const startFresh = !prior || DONE_STATUSES.includes(String(prior.status));
        // Pelanggan lama yang sudah pernah closing → simpan tautan customer utk kontak.
        const linkCustomerId = prior?.convertedCustomerId ?? null;

        let lead = prior;
        let createdLead = false;
        if (startFresh && this.autoCreateLead) {
            lead = await this.prisma.lead.create({
                data: {
                    name: profileName || `WA ${waId}`,
                    phone: from ?? waId,
                    phoneNormalized,
                    // Pelanggan lama (pernah jadi customer) → Repeat Order; selain itu WhatsApp.
                    source: prior?.convertedCustomerId ? 'REPEAT_ORDER' : 'WHATSAPP',
                    status: 'NEW',
                    branchId: channel.branchId ?? null,
                },
                select: { id: true, status: true, convertedCustomerId: true },
            });
            createdLead = true;
        }

        // 1b) Atribusi sumber via QR klik-untuk-chat: pesan memuat marker #kode.
        //     Set sumber lead sesuai QR (mis. Walk-in) + hitung scan. Berlaku utk
        //     lead baru; utk lead lama hanya bila sumbernya masih generik (WHATSAPP).
        if (lead?.id) {
            await this.applyQrAttribution(lead.id, this.extractBody(msg), createdLead, channel.branchId ?? null);
        }

        // Tautan customer: dari lead aktif, atau dari pelanggan lama (lead lama yg sudah closing).
        const contactCustomerId = lead?.convertedCustomerId ?? linkCustomerId;
        const contact = await this.prisma.waContact.upsert({
            where: { waId },
            create: {
                waId,
                phoneNormalized,
                profileName,
                lastInboundAt: now,
                leadId: lead?.id ?? null,
                customerId: contactCustomerId,
            },
            update: {
                profileName: profileName ?? undefined,
                lastInboundAt: now,
                // Lead: selalu arahkan ke lead aktif terbaru (termasuk lead baru repeat-order).
                ...(lead?.id ? { leadId: lead.id } : {}),
                ...(contactCustomerId ? { customerId: contactCustomerId } : {}),
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

        // 3) Simpan pesan masuk (dengan relasi reply bila membalas pesan tertentu).
        const replyToId = await this.resolveReplyToId(msg?.context?.id);
        const savedMsg = await this.prisma.waMessage.create({
            data: {
                channelId: channel.id,
                conversationId: conversation.id,
                contactId: contact.id,
                waMessageId: waMessageId ?? null,
                direction: WaDirection.INBOUND,
                type: TYPE_MAP[msg?.type] ?? WaMessageType.UNKNOWN,
                status: WaMessageStatus.DELIVERED,
                body: this.extractBody(msg),
                mediaMimeType: this.extractMediaMime(msg),
                replyToId,
                payloadJson: msg ?? {},
            },
        });

        // 3b) Arsipkan media ke disk homelab (best-effort, tak blok respons webhook).
        const mt = (msg?.type || '').toLowerCase();
        const mediaObj = msg?.[mt];
        if (mediaObj?.id && ['image', 'document', 'audio', 'video', 'sticker'].includes(mt)) {
            void this.mediaStore.persistFromMeta(
                savedMsg.id,
                savedMsg.createdAt,
                mediaObj.id,
                mediaObj.mime_type,
                mediaObj.filename,
            );
        }

        // 3c) Push real-time ke agen yang sedang membuka inbox (SSE) → hilangkan polling agresif.
        this.waEvents.emitMessage(conversation.id, channel.branchId ?? null);

        // 4) Jejak aktivitas CRM (timeline lead/customer).
        if (createdLead && lead) {
            await this.prisma.leadActivity.create({
                data: { leadId: lead.id, kind: 'FIRST_CONTACT', text: 'Prospek baru via WhatsApp', meta: { source: 'whatsapp' } },
            });
        }
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

        // 5) Balasan otomatis (rule-based) — aman: masih dalam jendela 24 jam.
        await this.autoReply.handleInbound({
            channel: { id: channel.id, phoneNumberId: channel.phoneNumberId },
            contact: { id: contact.id, waId: contact.waId, optedOut: contact.optedOut },
            conversationId: conversation.id,
            body: this.extractBody(msg),
            isNew: !openConv,
        });
    }

    /** Reaksi emoji dari pelanggan → simpan di reactionsJson.customer pesan target. */
    private async handleReaction(msg: any): Promise<void> {
        const targetWamid: string | undefined = msg?.reaction?.message_id;
        const emoji: string = msg?.reaction?.emoji ?? '';
        if (!targetWamid) return;
        const target = await this.prisma.waMessage.findUnique({
            where: { waMessageId: targetWamid },
            select: { id: true, reactionsJson: true, conversationId: true },
        });
        if (!target) {
            await this.logEvent('reaction', msg?.id, msg, 'target reaksi tak ditemukan');
            return;
        }
        const reactions: any = (target.reactionsJson as any) || {};
        if (emoji) reactions.customer = emoji;
        else delete reactions.customer;
        await this.prisma.waMessage.update({
            where: { id: target.id },
            data: { reactionsJson: reactions },
        });
        await this.logEvent('reaction', msg?.id, msg);
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
        id: true, waId: true, profileName: true, customName: true, phoneNormalized: true,
        leadId: true, customerId: true, optedOut: true,
        // Lead tertaut → tampilkan tahap pipeline + tautan di inbox (koherensi CRM).
        lead: { select: { id: true, name: true, status: true } },
        // Customer tertaut → prefill alamat saat "Buat SO" dari chat.
        customer: { select: { id: true, name: true, address: true } },
    };

    /** Daftar percakapan dgn filter + paginasi cursor (lastMessageAt desc). */
    async listConversations(opts: ListConversationsOpts) {
        const take = Math.min(Math.max(opts.take ?? 30, 1), 100);
        const where: Prisma.WaConversationWhereInput = {};
        if (opts.status) where.status = opts.status;
        // Scope penugasan: "milik saya atau belum di-assign" (desainer) menang atas filter eksplisit.
        if (opts.mineOrUnassigned !== undefined) {
            where.OR = [{ assignedToId: opts.mineOrUnassigned }, { assignedToId: null }];
        } else if (opts.assignedToId !== undefined) {
            where.assignedToId = opts.assignedToId;
        }
        if (opts.channelId) where.channelId = opts.channelId;
        if (opts.branchId) where.channel = { branchId: opts.branchId };
        // Filter kontak: gabungan pencarian teks + pembatasan daftar nomor (SO desainer).
        const contactAnd: Prisma.WaContactWhereInput[] = [];
        if (opts.q) {
            contactAnd.push({
                OR: [
                    { profileName: { contains: opts.q } },
                    { waId: { contains: opts.q } },
                    { phoneNormalized: { contains: opts.q } },
                ],
            });
        }
        if (opts.phoneIn !== undefined) {
            // Daftar kosong → tak ada yang cocok (sentinel agar hasil kosong, bukan semua).
            contactAnd.push({ phoneNormalized: { in: opts.phoneIn.length ? opts.phoneIn : [' __none__'] } });
        }
        if (contactAnd.length) where.contact = contactAnd.length === 1 ? contactAnd[0] : { AND: contactAnd };
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

    /** Cari percakapan WA dari leadId (deep-link "Buka chat WA" dari pipeline). */
    async resolveConversation(leadId: number): Promise<{ conversationId: number | null }> {
        const contact = await this.prisma.waContact.findFirst({
            where: { leadId },
            orderBy: { lastInboundAt: 'desc' },
            select: { id: true },
        });
        if (!contact) return { conversationId: null };
        const conv = await this.prisma.waConversation.findFirst({
            where: { contactId: contact.id },
            orderBy: { lastMessageAt: 'desc' },
            select: { id: true },
        });
        return { conversationId: conv?.id ?? null };
    }

    /** Pesan sebuah percakapan (asc) + reset unread. Cursor = id pesan tertua. */
    async getMessages(conversationId: number, opts: { cursor?: number; take?: number } = {}) {
        const take = Math.min(Math.max(opts.take ?? 50, 1), 100);

        // Tandai dibaca di WhatsApp (centang biru) — hanya bila ada pesan belum dibaca,
        // agar tak spam mark-read tiap polling. Cukup tandai pesan masuk terakhir.
        const conv = await this.prisma.waConversation.findUnique({
            where: { id: conversationId },
            include: { channel: true },
        });
        if (conv && conv.unreadCount > 0) {
            const lastInbound = await this.prisma.waMessage.findFirst({
                where: { conversationId, direction: WaDirection.INBOUND, waMessageId: { not: null } },
                orderBy: { id: 'desc' },
                select: { waMessageId: true },
            });
            if (lastInbound?.waMessageId) {
                void this.cloud.markAsRead(conv.channel.phoneNumberId, lastInbound.waMessageId);
            }
            // Reset unread HANYA bila memang ada yang belum dibaca → hindari tulis DB
            // tiap polling (3 dtk) yang mubazir.
            await this.prisma.waConversation.update({
                where: { id: conversationId },
                data: { unreadCount: 0 },
            });
        }
        const rows = await this.prisma.waMessage.findMany({
            where: { conversationId },
            take: take + 1,
            ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
            orderBy: { id: 'desc' },
            include: {
                sentBy: { select: { id: true, name: true } },
                replyTo: { select: { id: true, direction: true, type: true, body: true } },
            },
        });
        const hasMore = rows.length > take;
        const slice = hasMore ? rows.slice(0, take) : rows;
        return { items: slice.reverse(), nextCursor: hasMore ? slice[0].id : null };
    }

    /**
     * Unduh biner media sebuah pesan (proxy Meta). media_id diambil dari
     * payload webhook tersimpan; backend yang pegang token, jadi frontend
     * tak pernah menyentuh kredensial Meta.
     */
    async getMessageMedia(
        messageId: number,
    ): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
        const m = await this.prisma.waMessage.findUnique({ where: { id: messageId } });
        if (!m) throw new NotFoundException('pesan tak ditemukan');
        const pj: any = m.payloadJson ?? {};
        const t = (pj?.type || m.type?.toLowerCase() || '').toLowerCase();
        const mediaObj = pj?.[t];
        const mime0 = mediaObj?.mime_type || m.mediaMimeType || 'application/octet-stream';
        const ext = (mime0.split(';')[0].split('/')[1] || 'bin').trim();
        const filename: string = mediaObj?.filename || `${t || 'media'}-${messageId}.${ext}`;

        // 1) Sajikan dari disk lokal bila sudah diarsipkan (tak bergantung retensi Meta).
        if (this.mediaStore.isLocal(m.mediaUrl)) {
            const local = await this.mediaStore.readLocal(m.mediaUrl as string);
            if (local) return { buffer: local, contentType: mime0, filename };
        }

        // 2) Fallback: unduh dari Meta (media lama/belum terarsip) sekaligus backfill ke disk.
        const mediaId: string | undefined = mediaObj?.id;
        if (!mediaId) throw new NotFoundException('pesan ini tidak memiliki media');
        const { buffer, contentType } = await this.cloud.getMediaBinary(mediaId);
        const finalMime = mediaObj?.mime_type || m.mediaMimeType || contentType;
        void this.mediaStore.persistBuffer(m.id, m.createdAt, buffer, finalMime, filename);
        return { buffer, contentType: finalMime, filename };
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
    /** Cari WaMessage.id lokal dari waMessageId Meta (untuk relasi reply). */
    private async resolveReplyToId(replyToWaMessageId?: string | null): Promise<number | null> {
        if (!replyToWaMessageId) return null;
        const ref = await this.prisma.waMessage.findUnique({
            where: { waMessageId: replyToWaMessageId },
            select: { id: true },
        });
        return ref?.id ?? null;
    }

    async replyText(conversationId: number, userId: number, text: string, replyToWaMessageId?: string) {
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
        const { waMessageId } = await this.cloud.sendText(
            conv.channel.phoneNumberId,
            conv.contact.waId,
            text,
            replyToWaMessageId,
        );
        return this.persistOutbound(conv, userId, {
            waMessageId,
            type: WaMessageType.TEXT,
            body: text,
            replyToId: await this.resolveReplyToId(replyToWaMessageId),
        });
    }

    /** Kirim reaksi emoji ke sebuah pesan (emoji kosong = hapus reaksi agen). */
    async reactToMessage(messageId: number, _userId: number, emoji: string) {
        const m = await this.prisma.waMessage.findUnique({
            where: { id: messageId },
            include: { channel: true, contact: true },
        });
        if (!m) throw new NotFoundException('Pesan tidak ditemukan');
        if (!m.waMessageId) throw new ConflictException('Pesan ini belum punya ID WhatsApp (tak bisa direaksi)');
        await this.cloud.sendReaction(m.channel.phoneNumberId, m.contact.waId, m.waMessageId, emoji || '');
        const reactions: any = (m.reactionsJson as any) || {};
        if (emoji) reactions.agent = emoji;
        else delete reactions.agent;
        return this.prisma.waMessage.update({
            where: { id: messageId },
            data: { reactionsJson: reactions },
        });
    }

    /** Balas dengan lampiran media (gambar/dokumen/audio/video) — sah hanya di jendela 24 jam. */
    async replyMedia(
        conversationId: number,
        userId: number,
        file: { buffer: Buffer; mimetype: string; originalname: string },
        caption?: string,
        replyToWaMessageId?: string,
    ) {
        if (!file?.buffer?.length) throw new ConflictException('Berkas kosong / gagal diunggah');
        const conv = await this.prisma.waConversation.findUnique({
            where: { id: conversationId },
            include: { channel: true, contact: true },
        });
        if (!conv) throw new NotFoundException('Percakapan tidak ditemukan');
        if (conv.contact.optedOut) throw new ConflictException('Kontak sudah opt-out (berhenti berlangganan)');
        const expired = !conv.windowExpiresAt || conv.windowExpiresAt.getTime() < Date.now();
        if (expired) throw new ConflictException('Di luar jendela 24 jam — gunakan pesan template');

        const mime = file.mimetype || 'application/octet-stream';
        // Tolak lebih awal tipe yang tak didukung Meta → pesan ramah (bukan 500).
        if (!WA_SUPPORTED_MEDIA.has(mime)) {
            throw new BadRequestException(
                `Tipe berkas "${mime || 'tidak dikenal'}" tidak didukung WhatsApp. Kirim: ${WA_SUPPORTED_HINT}.`,
            );
        }
        const kind: 'image' | 'document' | 'audio' | 'video' = mime.startsWith('image/')
            ? 'image'
            : mime.startsWith('video/')
              ? 'video'
              : mime.startsWith('audio/')
                ? 'audio'
                : 'document';
        const filename = file.originalname || `berkas.${mime.split('/')[1] || 'bin'}`;

        let mediaId: string;
        let waMessageId: string | null;
        try {
            mediaId = await this.cloud.uploadMedia(conv.channel.phoneNumberId, file.buffer, mime, filename);
            ({ waMessageId } = await this.cloud.sendMedia(
                conv.channel.phoneNumberId,
                conv.contact.waId,
                kind,
                mediaId,
                { caption: caption || undefined, filename, contextMessageId: replyToWaMessageId },
            ));
        } catch (e) {
            // Error dari Meta (tipe/ukuran/kebijakan) → 400 dgn pesan terbaca, bukan 500.
            throw new BadRequestException(`Gagal mengirim lampiran: ${(e as Error).message}`);
        }

        const TYPE_BY_KIND: Record<typeof kind, WaMessageType> = {
            image: WaMessageType.IMAGE,
            document: WaMessageType.DOCUMENT,
            audio: WaMessageType.AUDIO,
            video: WaMessageType.VIDEO,
        };
        const saved = await this.persistOutbound(conv, userId, {
            waMessageId,
            type: TYPE_BY_KIND[kind],
            body: caption || filename,
            mediaMimeType: mime,
            replyToId: await this.resolveReplyToId(replyToWaMessageId),
            // Simpan referensi agar proxy getMessageMedia bisa menayangkan media OUTBOUND juga.
            payloadJson: { type: kind, [kind]: { id: mediaId, mime_type: mime, filename } },
        });
        // Arsipkan berkas ke disk homelab (buffer sudah di tangan → langsung simpan).
        await this.mediaStore.persistBuffer(saved.id, saved.createdAt, file.buffer, mime, filename);
        return saved;
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

    /**
     * "Chat Baru": CS menyimpan nomor baru & memulai percakapan dari inbox.
     * Simpan kontak (WaContact + opsional Lead CRM, dedup by phone), kirim template
     * pembuka (wajib — nomor baru belum punya jendela 24 jam), lalu kembalikan
     * conversationId agar UI langsung membuka chat.
     */
    async startConversation(userId: number, input: StartConversationInput): Promise<{ conversationId: number }> {
        const channel = await this.prisma.waChannel.findUnique({ where: { id: input.channelId } });
        if (!channel || !channel.isActive) throw new BadRequestException('Channel tidak ditemukan / nonaktif');
        if (!input.template?.name) throw new BadRequestException('Template pembuka wajib dipilih');

        const waId = toWaPhone(input.phone);
        if (!waId) throw new BadRequestException('Nomor WhatsApp tidak valid');
        const phoneNormalized = toLeadKey(input.phone) ?? waId.replace(/^62/, '');
        const name = input.name?.trim() || null;

        const existingContact = await this.prisma.waContact.findUnique({ where: { waId } });
        if (existingContact?.optedOut) throw new ConflictException('Kontak sudah opt-out (berhenti berlangganan)');

        // Tautkan / buat Lead CRM (dedup by phone) supaya kontak tersimpan & terlacak.
        let lead = await this.prisma.lead.findFirst({
            where: { phoneNormalized },
            orderBy: { updatedAt: 'desc' },
            select: { id: true, convertedCustomerId: true },
        });
        if (!lead && (input.createLead ?? true)) {
            lead = await this.prisma.lead.create({
                data: {
                    name: name || `WA ${waId}`,
                    phone: input.phone,
                    phoneNormalized,
                    source: 'WHATSAPP',
                    status: 'NEW',
                    branchId: channel.branchId ?? null,
                },
                select: { id: true, convertedCustomerId: true },
            });
            await this.prisma.leadActivity.create({
                data: { leadId: lead.id, kind: 'FIRST_CONTACT', text: 'Kontak ditambahkan manual via WhatsApp', meta: { source: 'whatsapp-manual' } },
            });
        }

        const now = new Date();
        const contact = await this.prisma.waContact.upsert({
            where: { waId },
            create: {
                waId,
                phoneNormalized,
                profileName: name,
                leadId: lead?.id ?? null,
                customerId: lead?.convertedCustomerId ?? null,
            },
            update: {
                ...(name ? { profileName: name } : {}),
                ...(lead?.id ? { leadId: lead.id } : {}),
                ...(lead?.convertedCustomerId ? { customerId: lead.convertedCustomerId } : {}),
            },
        });

        // Pakai percakapan yang belum ditutup bila ada; kalau tidak, buat baru.
        // Catatan: kirim template TIDAK membuka jendela 24 jam (baru terbuka saat
        // pelanggan membalas) → windowExpiresAt sengaja dibiarkan kosong.
        let conv = await this.prisma.waConversation.findFirst({
            where: { channelId: channel.id, contactId: contact.id, status: { not: 'CLOSED' } },
            orderBy: { createdAt: 'desc' },
        });
        if (!conv) {
            conv = await this.prisma.waConversation.create({
                data: {
                    channelId: channel.id,
                    contactId: contact.id,
                    status: 'OPEN',
                    lastMessageAt: now,
                    assignedToId: userId,
                },
            });
        }

        const { waMessageId } = await this.cloud.sendTemplate(
            channel.phoneNumberId,
            contact.waId,
            input.template.name,
            input.template.language ?? 'id',
            input.template.components ?? [],
        );
        await this.persistOutbound(conv, userId, {
            waMessageId,
            type: WaMessageType.TEMPLATE,
            body: input.template.previewText ?? `[template: ${input.template.name}]`,
            templateName: input.template.name,
        });

        return { conversationId: conv.id };
    }

    /** Kirim 1 produk katalog ke percakapan (interactive product message). */
    async sendProduct(
        conversationId: number,
        userId: number,
        input: { productRetailerId: string; productName?: string; bodyText?: string },
    ) {
        if (!input.productRetailerId?.trim()) throw new BadRequestException('Produk belum dipilih');
        const conv = await this.prisma.waConversation.findUnique({
            where: { id: conversationId },
            include: { channel: true, contact: true },
        });
        if (!conv) throw new NotFoundException('Percakapan tidak ditemukan');
        if (conv.contact.optedOut) throw new ConflictException('Kontak sudah opt-out (berhenti berlangganan)');
        const expired = !conv.windowExpiresAt || conv.windowExpiresAt.getTime() < Date.now();
        if (expired) throw new ConflictException('Di luar jendela 24 jam — pesan produk hanya bisa dikirim saat percakapan aktif');

        // Resolusi catalog_id (manual di channel / auto dari WABA lalu di-cache).
        let catalogId = conv.channel.catalogId;
        if (!catalogId) {
            catalogId = await this.cloud.getWabaCatalogId(conv.channel.wabaId);
            if (!catalogId) throw new BadRequestException('Katalog belum terhubung ke WABA ini (cek Commerce Manager & izin catalog_management).');
            await this.prisma.waChannel.update({ where: { id: conv.channel.id }, data: { catalogId } });
        }

        const { waMessageId } = await this.cloud.sendProduct(
            conv.channel.phoneNumberId,
            conv.contact.waId,
            catalogId,
            input.productRetailerId.trim(),
            input.bodyText?.trim() || undefined,
        );
        return this.persistOutbound(conv, userId, {
            waMessageId,
            type: WaMessageType.INTERACTIVE,
            body: input.bodyText?.trim() || `🛍️ ${input.productName || 'Produk katalog'}`,
        });
    }

    private async persistOutbound(
        conv: { id: number; channelId: number; contactId: number },
        userId: number,
        m: {
            waMessageId: string | null;
            type: WaMessageType;
            body: string;
            templateName?: string;
            mediaMimeType?: string | null;
            payloadJson?: Prisma.InputJsonValue;
            replyToId?: number | null;
        },
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
                mediaMimeType: m.mediaMimeType ?? null,
                replyToId: m.replyToId ?? null,
                ...(m.payloadJson !== undefined ? { payloadJson: m.payloadJson } : {}),
                sentById: userId,
            },
        });
        await this.prisma.waConversation.update({
            where: { id: conv.id },
            data: { lastMessageAt: new Date() },
        });
        // Auto-assign percakapan ke pengirim bila belum ada pemilik (atomik via where null).
        await this.prisma.waConversation.updateMany({
            where: { id: conv.id, assignedToId: null },
            data: { assignedToId: userId },
        });
        // Push real-time (SSE) → agen lain yang membuka percakapan ini langsung lihat balasan.
        this.waEvents.emitMessage(conv.id);
        // Otomatisasi pipeline: balasan manusia → lead Baru maju ke Follow-up.
        await this.advanceLeadOnReply(conv.contactId);
        return msg;
    }

    /** CS set nama kustom kontak (prioritas tampil). Sinkron ke nama lead bila tertaut. */
    async setContactName(contactId: number, name: string | null | undefined) {
        const custom = (name ?? '').trim() || null;
        const contact = await this.prisma.waContact.findUnique({
            where: { id: contactId },
            select: { id: true, leadId: true, lead: { select: { convertedCustomerId: true } } },
        });
        if (!contact) throw new NotFoundException('Kontak tidak ditemukan');
        await this.prisma.waContact.update({ where: { id: contactId }, data: { customName: custom } });
        // Selaraskan nama lead (bila tertaut & belum jadi pelanggan) agar pipeline konsisten.
        if (custom && contact.leadId && !contact.lead?.convertedCustomerId) {
            await this.prisma.lead.update({ where: { id: contact.leadId }, data: { name: custom } });
        }
        return this.prisma.waContact.findUnique({ where: { id: contactId }, select: InboxService.CONTACT_SELECT });
    }

    /** Balasan manusia pertama → dorong lead NEW → FOLLOW_UP (hanya maju, best-effort). */
    private async advanceLeadOnReply(contactId: number): Promise<void> {
        try {
            const contact = await this.prisma.waContact.findUnique({ where: { id: contactId }, select: { leadId: true } });
            if (!contact?.leadId) return;
            const res = await this.prisma.lead.updateMany({
                where: { id: contact.leadId, status: 'NEW' },
                data: { status: 'FOLLOW_UP' },
            });
            if (res.count > 0) {
                await this.prisma.leadActivity.create({
                    data: { leadId: contact.leadId, kind: 'STATUS_CHANGE', text: 'Pindah ke Follow-up (dibalas via WhatsApp)', meta: { source: 'whatsapp-reply' } },
                });
            }
        } catch (e) {
            this.logger?.warn?.(`advanceLeadOnReply gagal: ${e}`);
        }
    }
}
