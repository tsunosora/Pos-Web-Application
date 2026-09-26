import { Injectable, Logger, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { CloudApiService } from './cloud-api.service';
import { PenjagaTerjadwal, lewatiKarenaLisensi } from '../lisensi/penjaga-terjadwal.service';
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
        // Opsional dengan sengaja — lihat catatan di `penjaga-terjadwal.service.ts`.
        @Optional() private readonly penjagaTerjadwal?: PenjagaTerjadwal,
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

        // RESERVASI sebelum kirim: dua pemicu bersamaan (klik ganda "siap ambil", endpoint manual,
        // sapuan cron yang tumpang tindih) dulu sama-sama lolos cek → template berbayar terkirim dua kali.
        try {
            await this.prisma.waReminderLog.create({ data: { eventType, refId, status: 'SENDING' } });
        } catch (e: any) {
            if (e?.code !== 'P2002') throw e;
            const ambil = await this.prisma.waReminderLog.updateMany({
                where: { eventType, refId, status: { in: ['FAILED', 'SKIPPED'] } },
                data: { status: 'SENDING' },
            });
            if (ambil.count !== 1) return; // sudah terkirim / sedang dikirim proses lain
        }

        let waMessageId: string | null = null;
        try {
            ({ waMessageId } = await this.cloud.sendTemplate(
                channel.phoneNumberId, waId, template.name, template.language, this.buildComponents(variables),
            ));
        } catch (e) {
            await log('FAILED', (e as Error).message, contact?.id ?? null).catch(() => undefined);
            this.logger.warn(`Reminder ${eventType}#${refId} gagal: ${(e as Error).message}`);
            return;
        }
        // Terkirim: catat SENT (diulang bila DB sibuk). Bila tetap gagal, baris dibiarkan SENDING —
        // dulu jatuh ke FAILED lalu bisa diklaim ulang & template berbayar terkirim lagi.
        for (let coba = 1; coba <= 3; coba++) {
            try {
                await log('SENT', undefined, contact?.id ?? null, waMessageId);
                return;
            } catch (e) {
                if (coba === 3) this.logger.error(`Reminder ${eventType}#${refId} TERKIRIM tapi gagal dicatat: ${(e as Error).message}`);
                else await new Promise((r) => setTimeout(r, 1000 * coba));
            }
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
    private menyapu = false;

    @Cron('0 */15 * * * *')
    async sweepFollowUps() {
        // Lisensi dulu, sebelum `send()` pernah dipanggil: `send()` menulis WaReminderLog sebagai
        // penanda dedup, dan penanda itu membuat FU yang sama TIDAK PERNAH diingatkan lagi. Jadi
        // melewati di sini = FU tetap PENDING tanpa catatan, dan sapuan setelah paketnya dipulihkan
        // mengirimnya seperti tidak terjadi apa-apa.
        if (lewatiKarenaLisensi(this.penjagaTerjadwal, 'wa.reminder')) return;
        // Satu sapuan pada satu waktu (Meta lambat → sapuan berikutnya bisa mulai sebelum yang lama selesai).
        if (this.menyapu) return;
        this.menyapu = true;
        try {
            await this.sapuFollowUps();
        } finally {
            this.menyapu = false;
        }
    }

    private async sapuFollowUps() {
        // Hanya jatuh tempo 7 hari terakhir, terbaru dulu. Dulu 200 FU tertua tanpa kursor:
        // begitu 200 FU lama menumpuk, FU baru tak pernah dapat pengingat.
        const now = new Date();
        const due = await this.prisma.followUp.findMany({
            where: {
                status: 'PENDING',
                dueDate: { lte: now, gte: new Date(now.getTime() - 7 * 24 * 3600 * 1000) },
                // Lead yang sudah menang/gagal/tidak valid tak diingatkan (pesan template berbayar).
                OR: [{ leadId: null }, { lead: { status: { notIn: ['CLOSED_WON', 'CLOSED_LOST', 'INVALID'] } } }],
            },
            include: { customer: { select: { name: true, phone: true } }, lead: { select: { name: true, phone: true } } },
            orderBy: { dueDate: 'desc' },
            take: 200,
        });
        // Satu percobaan per FU: yang pernah dicatat (terkirim/gagal/dilewati) tidak dikirim ulang
        // tiap 15 menit — timeout setelah Meta menerima dulu berarti pesan dobel ke pelanggan.
        const sudah = new Set(
            (await this.prisma.waReminderLog.findMany({
                where: { eventType: { in: ['FOLLOWUP_DUE', 'PAYMENT_DUE'] }, refId: { in: due.map((f) => f.id) } },
                select: { refId: true },
            })).map((l) => l.refId),
        );
        for (const fu of due) {
            if (sudah.has(fu.id)) continue;
            const phone = fu.customer?.phone ?? fu.lead?.phone ?? null;
            const name = fu.customer?.name ?? fu.lead?.name ?? 'Pelanggan';
            if (!phone) continue;
            const eventType: ReminderEvent = fu.type === 'PAYMENT_REMINDER' ? 'PAYMENT_DUE' : 'FOLLOWUP_DUE';
            // Variabel ke-2 = tanggal jatuh tempo, BUKAN catatan FU (catatan internal tim).
            const jatuhTempo = fu.dueDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
            try {
                await this.send(eventType, fu.id, phone, [name, jatuhTempo]);
            } catch (e) {
                // Satu baris gagal (mis. DB sesaat sibuk) tidak menghentikan sapuan FU lainnya.
                this.logger.warn(`Pengingat FU#${fu.id} dilewati: ${(e as Error).message}`);
            }
        }
    }
}
