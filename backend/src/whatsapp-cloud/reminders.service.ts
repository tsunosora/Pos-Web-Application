import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { CloudApiService } from './cloud-api.service';
import { toWaPhone } from '../common/utils/phone.util';

export type ReminderEvent = 'ORDER_READY' | 'PAYMENT_DUE' | 'FOLLOWUP_DUE';
export const REMINDER_EVENTS: ReminderEvent[] = ['ORDER_READY', 'PAYMENT_DUE', 'FOLLOWUP_DUE'];

export interface SetReminderConfigInput {
    enabled?: boolean;
    channelId?: number | null;
    templateId?: number | null;
}

/**
 * Reminder otomatis terkait POS (Fase 8): pesanan siap ambil, tagihan, follow-up.
 * Kirim TEMPLATE (di luar 24 jam wajib template). Dedup via WaReminderLog.
 */
@Injectable()
export class RemindersService {
    private readonly logger = new Logger(RemindersService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly cloud: CloudApiService,
    ) {}

    // ─── Konfigurasi ─────────────────────────────────────────────────────────

    async getConfigs() {
        const rows = await this.prisma.waReminderConfig.findMany();
        const byType = new Map(rows.map((r) => [r.eventType, r]));
        return REMINDER_EVENTS.map(
            (eventType) =>
                byType.get(eventType) ?? { eventType, enabled: false, channelId: null, templateId: null },
        );
    }

    async setConfig(eventType: ReminderEvent, input: SetReminderConfigInput) {
        return this.prisma.waReminderConfig.upsert({
            where: { eventType },
            create: {
                eventType,
                enabled: input.enabled ?? false,
                channelId: input.channelId ?? null,
                templateId: input.templateId ?? null,
            },
            update: {
                ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
                ...(input.channelId !== undefined ? { channelId: input.channelId ?? null } : {}),
                ...(input.templateId !== undefined ? { templateId: input.templateId ?? null } : {}),
            },
        });
    }

    private buildComponents(variables: string[]): any[] {
        if (!variables.length) return [];
        return [{ type: 'body', parameters: variables.map((v) => ({ type: 'text', text: v || '-' })) }];
    }

    /** Inti pengiriman reminder — dedup, hormati config & opt-out. */
    private async send(eventType: ReminderEvent, refId: number, phone: string | null | undefined, variables: string[]) {
        // Dedup: sudah pernah terkirim utk (event, ref)?
        const existing = await this.prisma.waReminderLog.findUnique({ where: { eventType_refId: { eventType, refId } } });
        if (existing?.status === 'SENT') return;

        const log = (status: string, detail?: string, contactId?: number | null, waMessageId?: string | null) =>
            this.prisma.waReminderLog.upsert({
                where: { eventType_refId: { eventType, refId } },
                create: { eventType, refId, status, detail: detail ?? null, contactId: contactId ?? null, waMessageId: waMessageId ?? null },
                update: { status, detail: detail ?? null, contactId: contactId ?? null, waMessageId: waMessageId ?? null },
            });

        const cfg = await this.prisma.waReminderConfig.findUnique({ where: { eventType } });
        if (!cfg?.enabled || !cfg.channelId || !cfg.templateId) return this.skipQuiet();

        const [channel, template] = await Promise.all([
            this.prisma.waChannel.findUnique({ where: { id: cfg.channelId } }),
            this.prisma.waTemplate.findUnique({ where: { id: cfg.templateId } }),
        ]);
        if (!channel || !template) return log('SKIPPED', 'channel/template tak ada');
        if (template.status !== 'APPROVED') return log('SKIPPED', 'template belum APPROVED');

        const waId = toWaPhone(phone);
        if (!waId) return log('SKIPPED', `nomor tak valid: ${phone}`);

        const contact = await this.prisma.waContact.findUnique({ where: { waId } });
        if (contact?.optedOut) return log('SKIPPED', 'kontak opt-out', contact.id);

        try {
            const { waMessageId } = await this.cloud.sendTemplate(
                channel.phoneNumberId, waId, template.name, template.language, this.buildComponents(variables),
            );
            await log('SENT', undefined, contact?.id ?? null, waMessageId);
        } catch (e) {
            await log('FAILED', (e as Error).message, contact?.id ?? null);
            this.logger.warn(`Reminder ${eventType}#${refId} gagal: ${(e as Error).message}`);
        }
    }

    private skipQuiet() {
        // config nonaktif → tidak melakukan apa-apa (tanpa log spam)
        return undefined;
    }

    /** Dipanggil saat titipan/pesanan ditandai SIAP_AMBIL. */
    async sendOrderReady(transactionId: number) {
        const tx = await this.prisma.transaction.findUnique({
            where: { id: transactionId },
            select: { id: true, invoiceNumber: true, customerName: true, customerPhone: true },
        });
        if (!tx?.customerPhone) return;
        await this.send('ORDER_READY', transactionId, tx.customerPhone, [tx.customerName ?? 'Pelanggan', tx.invoiceNumber]);
    }

    /** Cron tiap 15 menit: kirim reminder untuk follow-up yang jatuh tempo. */
    @Cron('0 */15 * * * *')
    async sweepFollowUps() {
        const due = await this.prisma.followUp.findMany({
            where: { status: 'PENDING', dueDate: { lte: new Date() } },
            include: { customer: { select: { name: true, phone: true } }, lead: { select: { name: true, phone: true } } },
            take: 200,
        });
        for (const fu of due) {
            const phone = fu.customer?.phone ?? fu.lead?.phone ?? null;
            const name = fu.customer?.name ?? fu.lead?.name ?? 'Pelanggan';
            if (!phone) continue;
            const eventType: ReminderEvent = fu.type === 'PAYMENT_REMINDER' ? 'PAYMENT_DUE' : 'FOLLOWUP_DUE';
            await this.send(eventType, fu.id, phone, [name, fu.notes ?? '']);
        }
    }
}
