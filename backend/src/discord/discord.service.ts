import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

// ── Channel & event keys ────────────────────────────────────────────────────
export type DiscordChannel =
    | 'sales' | 'production' | 'finance' | 'inventory' | 'leaderboard' | 'system';
export type DiscordEvent =
    | 'shiftRecap' | 'newLead' | 'dealClosing' | 'jobReady' | 'lowStock' | 'backup' | 'error' | 'champion' | 'suratOrder' | 'newTransaction';

export const DISCORD_CHANNELS: DiscordChannel[] =
    ['sales', 'production', 'finance', 'inventory', 'leaderboard', 'system'];
export const DISCORD_EVENTS: DiscordEvent[] =
    ['shiftRecap', 'newLead', 'dealClosing', 'jobReady', 'lowStock', 'backup', 'error', 'champion', 'suratOrder', 'newTransaction'];

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
    suratOrder: 'production',
    newTransaction: 'sales',
};

// Event lintas-cabang: SELALU pakai webhook global/sistem (tidak per cabang).
const SYSTEM_EVENTS: DiscordEvent[] = ['champion', 'backup', 'error'];

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

export type BranchWebhooks = Partial<Record<DiscordChannel, string>>;
export interface DiscordConfigShape {
    enabled: boolean;
    webhooks: BranchWebhooks; // global/sistem
    events: Partial<Record<DiscordEvent, boolean>>;
    branchConfigs: Record<string, { webhooks: BranchWebhooks }>; // keyed by branchId (string)
}

const rupiah = (n: number) => 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID');

@Injectable()
export class DiscordService implements OnModuleInit {
    private readonly logger = new Logger('DiscordService');
    constructor(private readonly prisma: PrismaService) {}

    private get model(): any { return (this.prisma as any).discordConfig; }

    // Cache config singkat agar event beruntun tidak hammer DB
    private cache: { data: DiscordConfigShape; at: number } | null = null;
    private readonly CACHE_TTL = 5_000;

    /**
     * Migrasi sekali jalan: kalau webhook per-cabang belum ada tapi webhook global
     * sudah diisi, salin global → semua cabang aktif supaya notifikasi tidak putus
     * setelah pindah ke mode per-cabang. Owner lalu bisa re-arahkan tiap cabang.
     */
    async onModuleInit() {
        try {
            const row = await this.model.findFirst({ orderBy: { id: 'asc' } });
            if (!row) return;
            const cfg = this.normalize(row);
            const hasGlobal = Object.values(cfg.webhooks).some(Boolean);
            const hasBranch = Object.keys(cfg.branchConfigs).length > 0;
            if (!hasGlobal || hasBranch) return; // tidak ada yg disalin / sudah pernah di-set
            const branches: any[] = await (this.prisma as any).companyBranch.findMany({
                where: { isActive: true }, select: { id: true },
            });
            if (!branches.length) return;
            const branchConfigs: Record<string, { webhooks: BranchWebhooks }> = {};
            for (const b of branches) branchConfigs[String(b.id)] = { webhooks: { ...cfg.webhooks } };
            await this.model.update({ where: { id: row.id }, data: { branchConfigs } });
            this.cache = null;
            this.logger.log(`Migrasi webhook Discord: global disalin ke ${branches.length} cabang.`);
        } catch (e: any) {
            this.logger.warn(`Migrasi webhook per-cabang dilewati: ${e?.message || e}`);
        }
    }

    private normalize(row: any): DiscordConfigShape {
        return {
            enabled: !!row?.enabled,
            webhooks: (row?.webhooks as any) ?? {},
            events: (row?.events as any) ?? {},
            branchConfigs: (row?.branchConfigs as any) ?? {},
        };
    }

    /** Ambil config singleton (buat default kalau belum ada). */
    async getConfig(): Promise<DiscordConfigShape> {
        if (this.cache && Date.now() - this.cache.at < this.CACHE_TTL) return this.cache.data;
        let row = await this.model.findFirst({ orderBy: { id: 'asc' } });
        if (!row) {
            row = await this.model.create({ data: { enabled: false, webhooks: {}, events: {}, branchConfigs: {} } });
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
        if (patch.branchConfigs !== undefined) data.branchConfigs = patch.branchConfigs;
        row = row
            ? await this.model.update({ where: { id: row.id }, data })
            : await this.model.create({ data: { enabled: false, webhooks: {}, events: {}, branchConfigs: {}, ...data } });
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

    /** POST multipart dengan lampiran file lokal (limit Discord: 10 file per pesan). */
    private async postWithFiles(url: string, payload: any, filePaths: string[]): Promise<boolean> {
        if (!url) return false;
        const form = new FormData();
        form.append('payload_json', JSON.stringify(payload));
        let n = 0;
        for (const rel of filePaths.slice(0, 10)) {
            try {
                const abs = path.isAbsolute(rel) ? rel : path.join(process.cwd(), rel);
                if (!fs.existsSync(abs)) continue;
                const buf = fs.readFileSync(abs);
                form.append(`files[${n}]`, new Blob([new Uint8Array(buf)]), path.basename(abs));
                n++;
            } catch { /* file rusak/tak terbaca — lewati */ }
        }
        if (n === 0) return this.post(url, payload);
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 20_000); // upload butuh waktu lebih lama
        try {
            const res = await fetch(url, { method: 'POST', body: form, signal: ctrl.signal });
            return res.ok;
        } catch (e: any) {
            this.logger.warn(`Gagal upload lampiran webhook: ${e?.message || e}`);
            return false;
        } finally {
            clearTimeout(t);
        }
    }

    /** Konversi markdown gaya WhatsApp (*tebal*) ke gaya Discord (**tebal**).
     *  Asterisk ganda yang sudah format Discord dibiarkan (lookaround). */
    private toDiscordMarkdown(text: string): string {
        return (text || '').replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '**$1**');
    }

    /** Pecah teks panjang per baris, maks `max` char per pesan (limit konten Discord 2000). */
    private chunkText(text: string, max = 1900): string[] {
        const chunks: string[] = [];
        let buf = '';
        for (const line of (text || '').split('\n')) {
            const piece = line.length > max ? line.slice(0, max) : line;
            if (buf.length + piece.length + 1 > max) {
                if (buf) chunks.push(buf);
                buf = piece;
            } else {
                buf = buf ? buf + '\n' + piece : piece;
            }
        }
        if (buf) chunks.push(buf);
        return chunks;
    }

    /**
     * Webhook URL untuk sebuah event — null kalau master off / event off / URL kosong.
     * Routing per cabang:
     *  - Event sistem (champion/backup/error): selalu webhook global.
     *  - Event cabang DENGAN branchId: pakai webhook cabang itu. TANPA fallback global
     *    (kalau cabang belum di-set → tidak terkirim).
     *  - Event cabang TANPA branchId (data tak punya cabang, mis. order WEBSITE):
     *    pakai webhook global sebagai sistem default.
     */
    private async resolveUrl(event: DiscordEvent, branchId?: number | null): Promise<string | null> {
        const cfg = await this.getConfig();
        if (!cfg.enabled) return null;
        if (cfg.events[event] === false) return null; // default ON kalau undefined
        const channel = EVENT_CHANNEL[event];
        if (SYSTEM_EVENTS.includes(event)) return cfg.webhooks[channel] || null;
        if (branchId != null) {
            return cfg.branchConfigs[String(branchId)]?.webhooks?.[channel] || null;
        }
        return cfg.webhooks[channel] || null;
    }

    /**
     * Kirim laporan teks panjang + lampiran gambar untuk sebuah event.
     * Teks dipecah per ±1900 char; lampiran ikut di pesan terakhir agar urut.
     * Return true bila semua pesan terkirim (false juga bila event nonaktif/URL kosong).
     */
    async sendLongReport(event: DiscordEvent, text: string, imagePaths: string[] = [], branchId?: number | null): Promise<boolean> {
        try {
            const url = await this.resolveUrl(event, branchId);
            if (!url) return false;
            const chunks = this.chunkText(this.toDiscordMarkdown(text));
            let ok = true;
            for (let i = 0; i < chunks.length; i++) {
                const isLast = i === chunks.length - 1;
                ok = (isLast && imagePaths.length
                    ? await this.postWithFiles(url, { content: chunks[i] }, imagePaths)
                    : await this.post(url, { content: chunks[i] })) && ok;
            }
            if (chunks.length === 0 && imagePaths.length) {
                ok = await this.postWithFiles(url, {}, imagePaths) && ok;
            }
            return ok;
        } catch (e: any) {
            this.logger.warn(`sendLongReport(${event}) error: ${e?.message || e}`);
            return false;
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
    async send(event: DiscordEvent, embed: DiscordEmbed, branchId?: number | null, imagePaths: string[] = []): Promise<void> {
        try {
            const url = await this.resolveUrl(event, branchId);
            if (!url) return;
            const payload = this.toPayload(embed);
            if (imagePaths.length) await this.postWithFiles(url, payload, imagePaths);
            else await this.post(url, payload);
        } catch (e: any) {
            this.logger.warn(`send(${event}) error: ${e?.message || e}`);
        }
    }

    /**
     * Test kirim ke salah satu channel (tombol Test di Settings).
     * `branchId` null/undefined → uji webhook global; angka → uji webhook cabang itu.
     */
    async sendTest(channel: DiscordChannel, branchId?: number | null): Promise<{ ok: boolean; message: string }> {
        const cfg = await this.getConfig();
        const url = branchId != null
            ? cfg.branchConfigs[String(branchId)]?.webhooks?.[channel]
            : cfg.webhooks[channel];
        const scope = branchId != null ? `cabang #${branchId}` : 'global';
        if (!url) return { ok: false, message: `Webhook channel "${channel}" (${scope}) belum diisi.` };
        const ok = await this.post(url, this.toPayload({
            title: '✅ Test Notifikasi PosPro',
            description: `Webhook channel **${channel}** (${scope}) berhasil terhubung.`,
            color: COLOR.green,
            footer: 'PosPro · Discord Integration',
        }));
        return ok
            ? { ok: true, message: 'Pesan test terkirim ke Discord.' }
            : { ok: false, message: 'Gagal kirim ke Discord. Cek URL webhook.' };
    }

    // ── Helper per-event (dipanggil dari service lain) ──────────────────────

    notifyShiftRecap(d: {
        cashierName?: string; branchLabel?: string; branchId?: number | null; shiftName?: string;
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
        }, d.branchId);
    }

    /**
     * Laporan tutup shift LENGKAP (teks laporan + foto bukti) ke channel #keuangan cabang.
     * Pengganti laporan harian WhatsApp — dipakai closeShift & resend.
     */
    notifyShiftReport(fullText: string, imagePaths: string[] = [], branchId?: number | null): Promise<boolean> {
        return this.sendLongReport('shiftRecap', fullText, imagePaths, branchId);
    }

    /** Surat Order (desain → kasir/operator) ke channel #produksi cabang. */
    notifySuratOrder(caption: string, imagePaths: string[] = [], branchId?: number | null): Promise<boolean> {
        return this.sendLongReport('suratOrder', caption, imagePaths, branchId);
    }

    notifyNewLead(d: {
        name: string; phone?: string; source?: string; csName?: string; estimatedValue?: number;
        soNumber?: string; branchId?: number | null; imagePaths?: string[];
    }) {
        const fields: DiscordEmbedField[] = [];
        if (d.source) fields.push({ name: 'Sumber', value: d.source, inline: true });
        if (d.csName) fields.push({ name: 'CS', value: d.csName, inline: true });
        if (d.estimatedValue != null) fields.push({ name: 'Estimasi', value: rupiah(d.estimatedValue), inline: true });
        if (d.soNumber) fields.push({ name: 'Surat Order', value: `\`${d.soNumber}\``, inline: true });
        return this.send('newLead', {
            title: '🆕 Lead Baru',
            description: `**${d.name}**${d.phone ? ` (${d.phone})` : ''}`,
            color: COLOR.blue,
            fields: fields.length ? fields : undefined,
        }, d.branchId, d.imagePaths ?? []);
    }

    notifyDealClosing(d: { csName?: string; customerName?: string; value: number; pcs?: number; source?: string; branchId?: number | null }) {
        const fields: DiscordEmbedField[] = [{ name: 'Nilai', value: rupiah(d.value), inline: true }];
        if (d.pcs != null) fields.push({ name: 'Pcs', value: `${d.pcs}`, inline: true });
        if (d.source) fields.push({ name: 'Sumber', value: d.source, inline: true });
        return this.send('dealClosing', {
            title: '🎉 Closing Baru!',
            description: [d.csName ? `**${d.csName}**` : 'CS', 'closing', d.customerName ? `**${d.customerName}**` : 'customer'].join(' '),
            color: COLOR.green,
            fields,
        }, d.branchId);
    }

    notifyJobReady(d: { jobNumber?: string; customerName?: string; branchLabel?: string; branchId?: number | null; isExpress?: boolean }) {
        return this.send('jobReady', {
            title: `${d.isExpress ? '⚡ ' : '📦 '}Pesanan Siap Diambil`,
            description: [
                d.jobNumber ? `\`${d.jobNumber}\`` : null,
                d.customerName ? `— ${d.customerName}` : null,
                d.branchLabel ? `\n${d.branchLabel}` : null,
            ].filter(Boolean).join(' '),
            color: COLOR.green,
        }, d.branchId);
    }

    notifyLowStock(d: { name: string; sku?: string; stock: number; threshold: number; branchLabel?: string; branchId?: number | null }) {
        return this.send('lowStock', {
            title: '⚠️ Stok Menipis',
            description: `**${d.name}**${d.sku ? ` (\`${d.sku}\`)` : ''}`,
            color: COLOR.amber,
            fields: [
                { name: 'Sisa', value: `${d.stock}`, inline: true },
                { name: 'Minimum', value: `${d.threshold}`, inline: true },
                ...(d.branchLabel ? [{ name: 'Cabang', value: d.branchLabel, inline: true }] : []),
            ],
        }, d.branchId);
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
