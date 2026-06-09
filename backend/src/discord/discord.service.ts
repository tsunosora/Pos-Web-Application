import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// ── Channel & event keys ────────────────────────────────────────────────────
export type DiscordChannel =
    | 'sales' | 'production' | 'finance' | 'inventory' | 'leaderboard' | 'system';
export type DiscordEvent =
    | 'shiftRecap' | 'newLead' | 'dealClosing' | 'jobReady' | 'lowStock' | 'backup' | 'error' | 'champion';

export const DISCORD_CHANNELS: DiscordChannel[] =
    ['sales', 'production', 'finance', 'inventory', 'leaderboard', 'system'];
export const DISCORD_EVENTS: DiscordEvent[] =
    ['shiftRecap', 'newLead', 'dealClosing', 'jobReady', 'lowStock', 'backup', 'error', 'champion'];

// Event → channel default routing
const EVENT_CHANNEL: Record<DiscordEvent, DiscordChannel> = {
    shiftRecap: 'finance',
    newLead: 'sales',
    dealClosing: 'sales',
    jobReady: 'production',
    lowStock: 'inventory',
    backup: 'system',
    error: 'system',
    champion: 'leaderboard',
};

// Warna embed (decimal) per tipe
const COLOR = {
    green: 0x22c55e,
    blue: 0x3b82f6,
    amber: 0xf59e0b,
    red: 0xef4444,
    gray: 0x6b7280,
    gold: 0xeab308,
};

export interface DiscordEmbedField { name: string; value: string; inline?: boolean }
export interface DiscordEmbed {
    title?: string;
    description?: string;
    color?: number;
    fields?: DiscordEmbedField[];
    footer?: string;
}

export interface DiscordConfigShape {
    enabled: boolean;
    webhooks: Partial<Record<DiscordChannel, string>>;
    events: Partial<Record<DiscordEvent, boolean>>;
}

const rupiah = (n: number) => 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID');

@Injectable()
export class DiscordService {
    private readonly logger = new Logger('DiscordService');
    constructor(private readonly prisma: PrismaService) {}

    private get model(): any { return (this.prisma as any).discordConfig; }

    // Cache config singkat agar event beruntun tidak hammer DB
    private cache: { data: DiscordConfigShape; at: number } | null = null;
    private readonly CACHE_TTL = 5_000;

    private normalize(row: any): DiscordConfigShape {
        return {
            enabled: !!row?.enabled,
            webhooks: (row?.webhooks as any) ?? {},
            events: (row?.events as any) ?? {},
        };
    }

    /** Ambil config singleton (buat default kalau belum ada). */
    async getConfig(): Promise<DiscordConfigShape> {
        if (this.cache && Date.now() - this.cache.at < this.CACHE_TTL) return this.cache.data;
        let row = await this.model.findFirst({ orderBy: { id: 'asc' } });
        if (!row) {
            row = await this.model.create({ data: { enabled: false, webhooks: {}, events: {} } });
        }
        const data = this.normalize(row);
        this.cache = { data, at: Date.now() };
        return data;
    }

    async updateConfig(patch: Partial<DiscordConfigShape>): Promise<DiscordConfigShape> {
        let row = await this.model.findFirst({ orderBy: { id: 'asc' } });
        const data: any = {};
        if (patch.enabled !== undefined) data.enabled = !!patch.enabled;
        if (patch.webhooks !== undefined) data.webhooks = patch.webhooks;
        if (patch.events !== undefined) data.events = patch.events;
        row = row
            ? await this.model.update({ where: { id: row.id }, data })
            : await this.model.create({ data: { enabled: false, webhooks: {}, events: {}, ...data } });
        this.cache = null; // invalidate
        return this.normalize(row);
    }

    /** POST mentah ke sebuah webhook URL (non-blocking, timeout 5s). */
    private async post(url: string, body: any): Promise<boolean> {
        if (!url) return false;
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 5_000);
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                signal: ctrl.signal,
            });
            return res.ok;
        } catch (e: any) {
            this.logger.warn(`Gagal kirim webhook: ${e?.message || e}`);
            return false;
        } finally {
            clearTimeout(t);
        }
    }

    private toPayload(embed: DiscordEmbed) {
        return {
            embeds: [{
                title: embed.title,
                description: embed.description,
                color: embed.color ?? COLOR.gray,
                fields: embed.fields,
                timestamp: new Date().toISOString(),
                footer: embed.footer ? { text: embed.footer } : undefined,
            }],
        };
    }

    /**
     * Kirim embed untuk sebuah event bila: master enabled, toggle event != false,
     * dan channel tujuan punya webhook URL. Dipanggil fire-and-forget oleh service lain.
     */
    async send(event: DiscordEvent, embed: DiscordEmbed): Promise<void> {
        try {
            const cfg = await this.getConfig();
            if (!cfg.enabled) return;
            if (cfg.events[event] === false) return; // default ON kalau undefined
            const channel = EVENT_CHANNEL[event];
            const url = cfg.webhooks[channel];
            if (!url) return;
            await this.post(url, this.toPayload(embed));
        } catch (e: any) {
            this.logger.warn(`send(${event}) error: ${e?.message || e}`);
        }
    }

    /** Test kirim ke salah satu channel (dipakai tombol Test di Settings). */
    async sendTest(channel: DiscordChannel): Promise<{ ok: boolean; message: string }> {
        const cfg = await this.getConfig();
        const url = cfg.webhooks[channel];
        if (!url) return { ok: false, message: `Webhook channel "${channel}" belum diisi.` };
        const ok = await this.post(url, this.toPayload({
            title: '✅ Test Notifikasi PosPro',
            description: `Webhook channel **${channel}** berhasil terhubung.`,
            color: COLOR.green,
            footer: 'PosPro · Discord Integration',
        }));
        return ok
            ? { ok: true, message: 'Pesan test terkirim ke Discord.' }
            : { ok: false, message: 'Gagal kirim ke Discord. Cek URL webhook.' };
    }

    // ── Helper per-event (dipanggil dari service lain) ──────────────────────

    notifyShiftRecap(d: {
        cashierName?: string; branchLabel?: string; shiftName?: string;
        omzet: number; txCount?: number;
        cash?: number; qris?: number; transfer?: number; notes?: string;
    }) {
        const fields: DiscordEmbedField[] = [
            { name: 'Total Penerimaan', value: rupiah(d.omzet), inline: true },
        ];
        if (d.txCount != null) fields.push({ name: 'Transaksi', value: `${d.txCount}`, inline: true });
        if (d.cash != null) fields.push({ name: 'Tunai', value: rupiah(d.cash), inline: true });
        if (d.qris != null) fields.push({ name: 'QRIS', value: rupiah(d.qris), inline: true });
        if (d.transfer != null) fields.push({ name: 'Transfer', value: rupiah(d.transfer), inline: true });
        return this.send('shiftRecap', {
            title: `🧾 Tutup Shift${d.shiftName ? ` — ${d.shiftName}` : ''}`,
            description: [d.branchLabel, d.cashierName ? `Kasir: ${d.cashierName}` : null, d.notes ? `📝 ${d.notes}` : null]
                .filter(Boolean).join(' · ') || undefined,
            color: COLOR.blue,
            fields,
        });
    }

    notifyNewLead(d: { name: string; phone?: string; source?: string; csName?: string; estimatedValue?: number }) {
        const fields: DiscordEmbedField[] = [];
        if (d.source) fields.push({ name: 'Sumber', value: d.source, inline: true });
        if (d.csName) fields.push({ name: 'CS', value: d.csName, inline: true });
        if (d.estimatedValue != null) fields.push({ name: 'Estimasi', value: rupiah(d.estimatedValue), inline: true });
        return this.send('newLead', {
            title: '🆕 Lead Baru',
            description: `**${d.name}**${d.phone ? ` (${d.phone})` : ''}`,
            color: COLOR.blue,
            fields: fields.length ? fields : undefined,
        });
    }

    notifyDealClosing(d: { csName?: string; customerName?: string; value: number; pcs?: number; source?: string }) {
        const fields: DiscordEmbedField[] = [{ name: 'Nilai', value: rupiah(d.value), inline: true }];
        if (d.pcs != null) fields.push({ name: 'Pcs', value: `${d.pcs}`, inline: true });
        if (d.source) fields.push({ name: 'Sumber', value: d.source, inline: true });
        return this.send('dealClosing', {
            title: '🎉 Closing Baru!',
            description: [d.csName ? `**${d.csName}**` : 'CS', 'closing', d.customerName ? `**${d.customerName}**` : 'customer'].join(' '),
            color: COLOR.green,
            fields,
        });
    }

    notifyJobReady(d: { jobNumber?: string; customerName?: string; branchLabel?: string; isExpress?: boolean }) {
        return this.send('jobReady', {
            title: `${d.isExpress ? '⚡ ' : '📦 '}Pesanan Siap Diambil`,
            description: [
                d.jobNumber ? `\`${d.jobNumber}\`` : null,
                d.customerName ? `— ${d.customerName}` : null,
                d.branchLabel ? `\n${d.branchLabel}` : null,
            ].filter(Boolean).join(' '),
            color: COLOR.green,
        });
    }

    notifyLowStock(d: { name: string; sku?: string; stock: number; threshold: number; branchLabel?: string }) {
        return this.send('lowStock', {
            title: '⚠️ Stok Menipis',
            description: `**${d.name}**${d.sku ? ` (\`${d.sku}\`)` : ''}`,
            color: COLOR.amber,
            fields: [
                { name: 'Sisa', value: `${d.stock}`, inline: true },
                { name: 'Minimum', value: `${d.threshold}`, inline: true },
                ...(d.branchLabel ? [{ name: 'Cabang', value: d.branchLabel, inline: true }] : []),
            ],
        });
    }

    notifyBackup(d: { ok: boolean; detail?: string }) {
        return this.send('backup', {
            title: d.ok ? '💾 Backup Berhasil' : '❌ Backup Gagal',
            description: d.detail || undefined,
            color: d.ok ? COLOR.green : COLOR.red,
        });
    }

    notifyError(d: { context: string; message: string }) {
        return this.send('error', {
            title: '🚨 Error Sistem',
            description: `**${d.context}**\n\`\`\`${(d.message || '').slice(0, 1500)}\`\`\``,
            color: COLOR.red,
        });
    }

    notifyChampion(d: { period: string; lines: string[] }) {
        return this.send('champion', {
            title: `🏆 Juara ${d.period}`,
            description: d.lines.join('\n') || 'Belum ada data.',
            color: COLOR.gold,
            footer: 'PosPro · Leaderboard CS',
        });
    }
}
