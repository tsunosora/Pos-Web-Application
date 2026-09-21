import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { WaAutoReplyTrigger, WaDirection, WaMessageStatus, WaMessageType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CloudApiService } from './cloud-api.service';

const OPT_OUT_WORDS = ['stop', 'berhenti', 'unsubscribe', 'unsub'];
const OPT_IN_WORDS = ['mulai', 'start', 'langganan', 'subscribe'];
const HUMAN_HANDLING_MS = 30 * 60 * 1000; // jgn auto-reply bila agen manusia baru membalas < 30 mnt

/**
 * Perintah berhenti/mulai: pesan PENDEK (≤ 3 kata) yang kata pertamanya kata kunci, tanpa tanda
 * baca/emoji. Dulu hanya "stop" persis — "STOP.", "stop kak", "Berhenti ya 🙏", tombol
 * "Stop promotions" tak tercatat padahal footer template menjanjikan "Balas STOP".
 */
export function perintahLangganan(body: string, kata: string[]): boolean {
    const bersih = String(body || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').trim();
    if (!bersih) return false;
    const kataKata = bersih.split(/\s+/);
    return kataKata.length <= 3 && kata.includes(kataKata[0]);
}

export interface AutoReplyContext {
    channel: { id: number; phoneNumberId: string };
    contact: { id: number; waId: string; optedOut: boolean };
    conversationId: number;
    body: string | null;
    isNew: boolean;
}

export interface CreateRuleInput {
    channelId?: number | null;
    trigger: WaAutoReplyTrigger;
    keywords?: string[] | null;
    replyText: string;
    priority?: number;
    isActive?: boolean;
}

@Injectable()
export class AutoReplyService {
    private readonly logger = new Logger(AutoReplyService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly cloud: CloudApiService,
    ) {}

    // ─── CRUD aturan ─────────────────────────────────────────────────────────

    listRules() {
        return this.prisma.waAutoReplyRule.findMany({ orderBy: [{ priority: 'desc' }, { id: 'asc' }] });
    }

    createRule(input: CreateRuleInput) {
        if (!input.replyText?.trim()) throw new BadRequestException('Teks balasan wajib diisi');
        if (input.trigger === 'KEYWORD' && !(input.keywords?.length)) {
            throw new BadRequestException('Trigger KEYWORD wajib punya minimal 1 kata kunci');
        }
        return this.prisma.waAutoReplyRule.create({
            data: {
                channelId: input.channelId ?? null,
                trigger: input.trigger,
                keywords: input.keywords?.length ? input.keywords : undefined,
                replyText: input.replyText,
                priority: input.priority ?? 0,
                isActive: input.isActive ?? true,
            },
        });
    }

    async updateRule(id: number, input: Partial<CreateRuleInput>) {
        await this.getOrThrow(id);
        return this.prisma.waAutoReplyRule.update({
            where: { id },
            data: {
                ...(input.channelId !== undefined ? { channelId: input.channelId ?? null } : {}),
                ...(input.trigger !== undefined ? { trigger: input.trigger } : {}),
                ...(input.keywords !== undefined ? { keywords: input.keywords?.length ? input.keywords : undefined } : {}),
                ...(input.replyText !== undefined ? { replyText: input.replyText } : {}),
                ...(input.priority !== undefined ? { priority: input.priority } : {}),
                ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
            },
        });
    }

    async removeRule(id: number) {
        await this.getOrThrow(id);
        await this.prisma.waAutoReplyRule.delete({ where: { id } });
        return { ok: true };
    }

    private async getOrThrow(id: number) {
        const r = await this.prisma.waAutoReplyRule.findUnique({ where: { id } });
        if (!r) throw new NotFoundException('Aturan tidak ditemukan');
        return r;
    }

    // ─── Mesin evaluasi (dipanggil dari alur pesan masuk) ────────────────────

    async handleInbound(ctx: AutoReplyContext): Promise<void> {
        const text = (ctx.body || '').trim();
        const lower = text.toLowerCase();

        // 1) Opt-out
        if (perintahLangganan(text, OPT_OUT_WORDS)) {
            if (!ctx.contact.optedOut) {
                await this.prisma.waContact.update({
                    where: { id: ctx.contact.id },
                    data: { optedOut: true, optedOutAt: new Date() },
                });
                await this.send(ctx, 'Anda telah berhenti menerima pesan dari kami. Balas MULAI untuk berlangganan lagi.');
            }
            return;
        }
        // 1b) Opt-in kembali
        if (perintahLangganan(text, OPT_IN_WORDS)) {
            if (ctx.contact.optedOut) {
                await this.prisma.waContact.update({
                    where: { id: ctx.contact.id },
                    data: { optedOut: false, optedOutAt: null },
                });
                await this.send(ctx, 'Anda berlangganan kembali. Terima kasih! 🙏');
            }
            return;
        }
        if (ctx.contact.optedOut) return;

        // 1c) Jangan membalas nomor kita sendiri (kanal lain) — dua kanal bisa saling balas tanpa akhir.
        const nomorKanal = await this.prisma.waChannel.findMany({ select: { displayNumber: true, phoneNumberId: true } });
        const pengirim = String(ctx.contact.waId || '').replace(/\D/g, '');
        if (pengirim && nomorKanal.some((k) => String(k.displayNumber || '').replace(/\D/g, '').replace(/^0/, '62') === pengirim)) return;

        // 1d) Paling banyak satu balasan otomatis per percakapan per jam (selain sapaan pertama):
        // pelanggan yang mengirim 5 foto dulu menerima 5 balasan sama; bot lain bisa memicu balasan beruntun.
        const botBaru = await this.prisma.waMessage.findFirst({
            where: {
                conversationId: ctx.conversationId,
                direction: 'OUTBOUND',
                sentById: null,
                broadcastId: null,
                createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
            },
            select: { id: true },
        });
        if (botBaru && !ctx.isNew) return;

        // 2) Jangan ganggu bila agen manusia sedang menangani.
        const recentHuman = await this.prisma.waMessage.findFirst({
            where: {
                conversationId: ctx.conversationId,
                direction: 'OUTBOUND',
                sentById: { not: null },
                createdAt: { gte: new Date(Date.now() - HUMAN_HANDLING_MS) },
            },
            select: { id: true },
        });
        if (recentHuman) return;

        // 3) Aturan aktif utk channel ini (atau global).
        const rules = await this.prisma.waAutoReplyRule.findMany({
            where: { isActive: true, OR: [{ channelId: null }, { channelId: ctx.channel.id }] },
            orderBy: { priority: 'desc' },
        });
        if (!rules.length) return;

        // 3a) KEYWORD
        for (const r of rules.filter((x) => x.trigger === 'KEYWORD')) {
            const kws = Array.isArray(r.keywords) ? (r.keywords as string[]) : [];
            if (kws.some((k) => lower.includes(String(k).toLowerCase()))) {
                await this.send(ctx, r.replyText);
                return;
            }
        }
        // 3b) GREETING (percakapan baru)
        if (ctx.isNew) {
            const g = rules.find((x) => x.trigger === 'GREETING');
            if (g) {
                await this.send(ctx, g.replyText);
                return;
            }
        }
        // 3c) Fallback DEFAULT / AWAY
        const fb = rules.find((x) => x.trigger === 'DEFAULT') || rules.find((x) => x.trigger === 'AWAY');
        if (fb) await this.send(ctx, fb.replyText);
    }

    /** Kirim balasan otomatis (sistem, sentById null) — aman karena masih dlm 24 jam. */
    private async send(ctx: AutoReplyContext, text: string): Promise<void> {
        try {
            const { waMessageId } = await this.cloud.sendText(ctx.channel.phoneNumberId, ctx.contact.waId, text);
            await this.prisma.waMessage.create({
                data: {
                    channelId: ctx.channel.id,
                    conversationId: ctx.conversationId,
                    contactId: ctx.contact.id,
                    waMessageId,
                    direction: WaDirection.OUTBOUND,
                    type: WaMessageType.TEXT,
                    status: WaMessageStatus.SENT,
                    body: text,
                    sentById: null, // sistem/bot
                },
            });
            await this.prisma.waConversation.update({
                where: { id: ctx.conversationId },
                data: { lastMessageAt: new Date() },
            });
        } catch (e) {
            this.logger.warn(`Auto-reply gagal: ${(e as Error).message}`);
        }
    }
}
