import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { branchWhere } from '../../common/branch-where.helper';
import { matchBranchId } from '../../common/branch-name.util';
import type { BranchContext } from '../../common/branch-context.decorator';
import { DiscordService } from '../../discord/discord.service';
import { ReportsService } from '../../reports/reports.service';
import { AnalyticsService } from '../../whatsapp-cloud/analytics.service';
import {
    aggregateByTx,
    buildMatchWhere,
    valueByItemId,
    type CountMode,
    type RawItem,
} from './custom-metric.util';

export type KpiPeriod = 'today' | 'week' | 'month' | 'custom';

export interface KpiParams {
    period: KpiPeriod;
    start?: string;
    end?: string;
}

export type KpiDivision = 'cs' | 'designer' | 'operator';

export interface KpiDetailOpts {
    division: KpiDivision;
    metric: string;
    userId: number;
    name?: string;        // dipakai divisi designer/operator (di-key per nama, bukan userId)
    metricId?: number;
}

export interface KpiDetailRow {
    kind: 'lead' | 'walkin' | 'job' | 'wa';
    refId: number;
    invoiceNumber: string | null;
    customerName: string | null;
    customerPhone: string | null;
    sourceLabel: string;
    sourceDetail: string | null;
    status: string | null;
    date: string | null;
    value: number;
    pcs: number;
    items: Array<{ name: string; qty: number; pcs: number; price: number }>;
}

const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function ymd(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function startOfDay(d: Date): Date {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}

// Senin sebagai awal minggu (konsisten dengan kebiasaan operasional toko)
function startOfWeekMon(d: Date): Date {
    const x = startOfDay(d);
    const diff = (x.getDay() + 6) % 7; // jumlah hari sejak Senin
    x.setDate(x.getDate() - diff);
    return x;
}

function labelDdMmm(d: Date): string {
    return `${d.getDate()} ${MONTHS_ID[d.getMonth()]}`;
}

function resolvePeriod(p: KpiParams): { start: Date; end: Date } {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    let start = new Date();
    if (p.period === 'today') {
        start.setHours(0, 0, 0, 0);
    } else if (p.period === 'week') {
        start.setDate(start.getDate() - 6);
        start.setHours(0, 0, 0, 0);
    } else if (p.period === 'month') {
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
    } else {
        if (p.start) start = new Date(p.start);
        if (p.end) {
            const e = new Date(p.end);
            e.setHours(23, 59, 59, 999);
            return { start, end: e };
        }
    }
    return { start, end };
}

@Injectable()
export class KpiService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly discord: DiscordService,
        private readonly reports: ReportsService,
        private readonly waAnalytics: AnalyticsService,
    ) {}

    private periodLabel(p: KpiParams): string {
        if (p.period === 'today') return 'Hari Ini';
        if (p.period === 'week') return 'Minggu Ini';
        if (p.period === 'month') return 'Bulan Ini';
        return 'Periode';
    }

    /**
     * Hitung leaderboard lalu kirim pengumuman juara (gamifikasi) ke Discord
     * channel #leaderboard. Sultan Cuan = Omzet (uang lunas masuk) + Akan Datang
     * (piutang), Raja Lead = lead terbanyak, Sniper Closing = closing rate tertinggi (min 3 lead).
     */
    async sendChampionRecap(ctx: BranchContext, params: KpiParams) {
        const rep = await this.report(ctx, params);
        const lb = rep.leaderboard as any[];
        const rp = (n: number) => 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID');
        if (!lb.length) {
            await this.discord.notifyChampion({ period: this.periodLabel(params), lines: ['Belum ada aktivitas CS di periode ini.'] });
            return { sent: true, champions: null };
        }
        const byMoney = [...lb].sort((a, b) => (b.omzetShare + b.pendingValue) - (a.omzetShare + a.pendingValue))[0];
        const byLead = [...lb].sort((a, b) => b.leadsHandled - a.leadsHandled)[0];
        const byRate = [...lb].filter(r => r.leadsHandled >= 3).sort((a, b) => b.closingRate - a.closingRate)[0] || null;
        const lines = [
            `👑 **Sultan Cuan**: ${byMoney.name} — ${rp(byMoney.omzetShare + byMoney.pendingValue)}`,
            `🔥 **Raja Lead**: ${byLead.name} — ${byLead.leadsHandled} lead`,
            byRate ? `🎯 **Sniper Closing**: ${byRate.name} — ${(byRate.closingRate * 100).toFixed(0)}%` : null,
        ].filter(Boolean) as string[];
        await this.discord.notifyChampion({ period: this.periodLabel(params), lines });
        return { sent: true };
    }

    private get lead(): any { return (this.prisma as any).lead; }
    private get activity(): any { return (this.prisma as any).leadActivity; }
    private get fu(): any { return (this.prisma as any).followUp; }
    private get tx(): any { return (this.prisma as any).transaction; }

    /**
     * Nama/kode cabang aktif untuk filter SO (SalesOrder simpan `branchName` string,
     * tidak punya FK cabang). null = mode semua cabang (tanpa filter).
     */
    private async soBranchNames(ctx: BranchContext): Promise<string[] | null> {
        if (ctx.branchId == null) return null;
        try {
            const b = await (this.prisma as any).companyBranch.findUnique({
                where: { id: ctx.branchId }, select: { name: true, code: true },
            });
            return b ? [b.name, b.code].filter(Boolean) : [];
        } catch { return []; }
    }

    /** Cocokkan SO.branchName dengan cabang aktif (logika sama dgn SalesOrdersService). */
    private soMatchesBranch(soBranchName: string | null | undefined, names: string[] | null): boolean {
        if (names == null) return true;          // semua cabang
        if (names.length === 0) return false;    // cabang tak dikenal → jangan bocorkan
        const s = (soBranchName || '').toLowerCase();
        return names.some(n => s === n.toLowerCase() || s.includes(n.toLowerCase()));
    }

    /**
     * Hitung total pcs per transaksi — KECUALI item dari kategori add-on
     * (kerah, lengan, rib, dll) yang merupakan komponen produk utama, bukan
     * barang terpisah. Penentu add-on: SATU-SATUNYA flag Category.countsAsPcs=false
     * (di-toggle dari halaman Manajemen Kategori). Item custom tanpa varian, serta
     * produk tanpa kategori, tetap dihitung. (Pakai filter negatif supaya toggle
     * kategori — termasuk 'Additional' — sepenuhnya menentukan, tanpa hardcode.)
     */
    private async computeTxPcsMap(txIds: number[]): Promise<Map<number, number>> {
        const map = new Map<number, number>();
        if (txIds.length === 0) return map;
        const groups: any[] = await (this.prisma as any).transactionItem.groupBy({
            by: ['transactionId'],
            where: {
                transactionId: { in: txIds },
                NOT: { productVariant: { product: { category: { countsAsPcs: false } } } },
            },
            _sum: { quantity: true },
        });
        for (const g of groups) map.set(g.transactionId, Number(g._sum?.quantity) || 0);
        return map;
    }

    // ── Metrik produk custom (owner-defined) ───────────────────────────────
    /** Ambil metrik custom aktif untuk sebuah peran (CS/DESIGNER/OPERATOR). */
    private async getActiveCustomMetrics(role: string): Promise<any[]> {
        const all: any[] = await (this.prisma as any).customProductMetric.findMany({
            where: { isActive: true },
            orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
        });
        return all.filter((m) => Array.isArray(m.roles) && m.roles.includes(role));
    }

    /** Map<txId, nilai> untuk satu metrik atas himpunan txIds (atribusi level-transaksi). */
    private async computeCustomMetricByTx(txIds: number[], metric: any): Promise<Map<number, number>> {
        const empty = new Map<number, number>();
        if (txIds.length === 0) return empty;
        const where = buildMatchWhere({
            productIds: metric.productIds ?? [],
            productVariantIds: metric.productVariantIds ?? [],
            categoryIds: metric.categoryIds ?? [],
            nameKeywords: metric.nameKeywords ?? [],
        });
        if (!where) return empty; // metrik tanpa aturan → nol (defensif)
        const items: RawItem[] = await (this.prisma as any).transactionItem.findMany({
            where: { transactionId: { in: txIds }, ...where },
            select: { transactionId: true, quantity: true, pcs: true, priceAtTime: true },
        });
        return aggregateByTx(items, (metric.countMode as CountMode) || 'PCS');
    }

    /** Map<itemId, nilai> untuk satu metrik atas himpunan TransactionItem.id (atribusi level-item). */
    private async computeCustomMetricByItemIds(itemIds: number[], metric: any): Promise<Map<number, number>> {
        const empty = new Map<number, number>();
        if (itemIds.length === 0) return empty;
        const where = buildMatchWhere({
            productIds: metric.productIds ?? [],
            productVariantIds: metric.productVariantIds ?? [],
            categoryIds: metric.categoryIds ?? [],
            nameKeywords: metric.nameKeywords ?? [],
        });
        if (!where) return empty;
        const items: any[] = await (this.prisma as any).transactionItem.findMany({
            where: { id: { in: itemIds }, ...where },
            select: { id: true, transactionId: true, quantity: true, pcs: true, priceAtTime: true },
        });
        return valueByItemId(items, (metric.countMode as CountMode) || 'PCS');
    }

    async report(ctx: BranchContext, params: KpiParams, csId?: number) {
        try {
            return await this._report(ctx, params, csId);
        } catch (err: any) {
            // eslint-disable-next-line no-console
            console.error('[kpi.report] failed:', err?.message, err?.stack);
            throw err;
        }
    }

    // ════════════════════════════════════════════════════════════════════════
    // Drill-down detail: rincian nota/lead penyusun satu angka leaderboard.
    // Angka (jumlah baris / total nilai / pcs) HARUS sama dengan sel leaderboard
    // → memakai where & helper yang sama dengan _report()/operatorLeaderboard().
    // ════════════════════════════════════════════════════════════════════════

    /** Label sumber lead yang manusiawi (mirror leadsBySource di _report). */
    private sourceLabel(source: string | null, sourceDetail: string | null): string {
        if (source === 'CUSTOM') return sourceDetail || 'Custom';
        const map: Record<string, string> = {
            WHATSAPP: 'WhatsApp', INSTAGRAM: 'Instagram', FACEBOOK: 'Facebook',
            TIKTOK: 'TikTok', MARKETPLACE: 'Marketplace', REFERRAL: 'Referral',
            WEBSITE: 'Website', WALK_IN: 'Walk-in', REPEAT_ORDER: 'Repeat Order',
            OTHER: 'Lainnya',
        };
        return (source && map[source]) || source || 'Tidak diketahui';
    }

    /**
     * pcs kolom leaderboard sebuah nota dari item-nya — HARUS identik dengan
     * computeTxPcsMap: jumlah `quantity` item non-add-on (countsAsPcs=false → 0),
     * TANPA ×pcs (beda dgn pcs pengiriman yang pakai quantity×pcs).
     */
    private txItemsPcs(items: any[]): number {
        return (items ?? []).reduce((s: number, it: any) => {
            const addon = it.productVariant?.product?.category?.countsAsPcs === false;
            return s + (addon ? 0 : (Number(it.quantity) || 0));
        }, 0);
    }

    private mapTxItems(items: any[]): Array<{ name: string; qty: number; pcs: number; price: number }> {
        return (items ?? []).map((it: any) => ({
            name: it.customName || it.productVariant?.product?.name || 'Item',
            qty: Number(it.quantity) || 0,
            pcs: Number(it.pcs) || 1,
            price: Number(it.priceAtTime) || 0,
        }));
    }

    private readonly txDetailSelect = {
        id: true, invoiceNumber: true, grandTotal: true, marketplaceFee: true,
        status: true, customerName: true, customerPhone: true, cashierName: true, createdAt: true,
        items: {
            select: {
                customName: true, quantity: true, pcs: true, priceAtTime: true,
                productVariant: { select: { product: { select: { name: true, category: { select: { countsAsPcs: true } } } } } },
            },
        },
    } as any;

    /** Ubah daftar lead (dengan nota converted) → baris detail. */
    private async buildLeadRows(leads: any[]): Promise<KpiDetailRow[]> {
        const txIds = leads.map(l => l.convertedTransactionId).filter(Boolean).map(Number);
        const txMap = new Map<number, any>();
        if (txIds.length) {
            const txs: any[] = await this.tx.findMany({ where: { id: { in: txIds } }, select: this.txDetailSelect });
            for (const t of txs) txMap.set(t.id, t);
        }
        return leads.map((l): KpiDetailRow => {
            const t = l.convertedTransactionId ? txMap.get(Number(l.convertedTransactionId)) : null;
            const gross = t ? Number(t.grandTotal) || 0 : (Number(l.estimatedValue) || 0);
            const fee = t ? Number(t.marketplaceFee) || 0 : 0;
            return {
                kind: 'lead',
                refId: l.id,
                invoiceNumber: t?.invoiceNumber ?? null,
                customerName: t?.customerName || l.name || null,
                customerPhone: t?.customerPhone || l.phone || null,
                sourceLabel: this.sourceLabel(l.source, l.sourceDetail),
                sourceDetail: l.sourceDetail ?? null,
                status: l.status ?? null,
                date: l.createdAt ? new Date(l.createdAt).toISOString() : null,
                value: Math.max(0, gross - fee),
                pcs: t ? this.txItemsPcs(t.items) : 0,
                items: t ? this.mapTxItems(t.items) : [],
            };
        });
    }

    /** Baris walk-in POS (non-lead) yang ditangani user — mirror _report 1870-1918. */
    private async buildWalkinRows(ctx: BranchContext, params: KpiParams, uid: number): Promise<KpiDetailRow[]> {
        const { start, end } = resolvePeriod(params);
        const branchScope: any = branchWhere(ctx);
        const user = await this.prisma.user.findUnique({ where: { id: uid }, select: { name: true } });
        const uname = (user?.name || '').trim().toLowerCase();
        if (!uname) return [];

        const leadTxIds: number[] = (await this.lead.findMany({
            where: { ...branchScope, convertedTransactionId: { not: null } },
            select: { convertedTransactionId: true },
        })).map((l: any) => Number(l.convertedTransactionId));
        const leadTxSet = new Set<number>(leadTxIds);

        const txs: any[] = await this.tx.findMany({
            where: { ...branchScope, status: { not: 'FAILED' }, createdAt: { gte: start, lte: end }, cashierName: { not: null } },
            select: this.txDetailSelect,
        });
        return txs
            .filter(t => !leadTxSet.has(t.id) && (t.cashierName || '').trim().toLowerCase() === uname)
            .map((t): KpiDetailRow => ({
                kind: 'walkin',
                refId: t.id,
                invoiceNumber: t.invoiceNumber ?? null,
                customerName: t.customerName ?? null,
                customerPhone: t.customerPhone ?? null,
                sourceLabel: 'Walk-in (POS)',
                sourceDetail: t.cashierName ?? null,
                status: t.status ?? null,
                date: t.createdAt ? new Date(t.createdAt).toISOString() : null,
                value: Math.max(0, (Number(t.grandTotal) || 0) - (Number(t.marketplaceFee) || 0)),
                pcs: this.txItemsPcs(t.items),
                items: this.mapTxItems(t.items),
            }));
    }

    /**
     * Baris "Akan Datang" (piutang) untuk user — nota PENDING/PARTIAL, value =
     * sisa tagihan (grandTotal − downPayment). Mirror _report: won-lead pending
     * (leadPendingMap) + walk-in pending. Satu nota = lead XOR walk-in (tak dobel).
     */
    private async buildPendingRows(ctx: BranchContext, params: KpiParams, uid: number): Promise<KpiDetailRow[]> {
        const { start, end } = resolvePeriod(params);
        const branchScope: any = branchWhere(ctx);
        const pendSelect = {
            id: true, invoiceNumber: true, grandTotal: true, downPayment: true, status: true,
            customerName: true, customerPhone: true, cashierName: true, createdAt: true,
            items: {
                select: {
                    customName: true, quantity: true, pcs: true, priceAtTime: true,
                    productVariant: { select: { product: { select: { name: true, category: { select: { countsAsPcs: true } } } } } },
                },
            },
        } as any;
        const rows: KpiDetailRow[] = [];

        // 1) Nota dari lead CLOSED_WON milik user yang tx-nya PENDING/PARTIAL.
        const wonLeads: any[] = await this.lead.findMany({
            where: { ...branchScope, assignedToId: uid, status: 'CLOSED_WON', createdAt: { gte: start, lte: end }, convertedTransactionId: { not: null } },
            select: { id: true, name: true, phone: true, source: true, sourceDetail: true, convertedTransactionId: true, createdAt: true } as any,
            orderBy: { createdAt: 'desc' },
        });
        const wonTxIds = wonLeads.map(l => Number(l.convertedTransactionId));
        const pendTxMap = new Map<number, any>();
        if (wonTxIds.length) {
            const txs: any[] = await this.tx.findMany({ where: { id: { in: wonTxIds }, status: { in: ['PENDING', 'PARTIAL'] } }, select: pendSelect });
            for (const t of txs) pendTxMap.set(t.id, t);
        }
        for (const l of wonLeads) {
            const t = pendTxMap.get(Number(l.convertedTransactionId));
            if (!t) continue;
            const outstanding = Math.max(0, (Number(t.grandTotal) || 0) - (Number(t.downPayment) || 0));
            if (outstanding <= 0) continue;
            rows.push({
                kind: 'lead', refId: l.id,
                invoiceNumber: t.invoiceNumber ?? null,
                customerName: t.customerName || l.name || null,
                customerPhone: t.customerPhone || l.phone || null,
                sourceLabel: this.sourceLabel(l.source, l.sourceDetail),
                sourceDetail: l.sourceDetail ?? null,
                status: t.status ?? null,
                date: t.createdAt ? new Date(t.createdAt).toISOString() : null,
                value: outstanding, pcs: 0, items: this.mapTxItems(t.items),
            });
        }

        // 2) Nota walk-in (non-lead) yang ia tangani & PENDING/PARTIAL.
        const user = await this.prisma.user.findUnique({ where: { id: uid }, select: { name: true } });
        const uname = (user?.name || '').trim().toLowerCase();
        if (uname) {
            const leadTxSet = new Set<number>((await this.lead.findMany({
                where: { ...branchScope, convertedTransactionId: { not: null } },
                select: { convertedTransactionId: true },
            })).map((l: any) => Number(l.convertedTransactionId)));
            const wtxs: any[] = await this.tx.findMany({
                where: { ...branchScope, status: { in: ['PENDING', 'PARTIAL'] }, createdAt: { gte: start, lte: end }, cashierName: { not: null } },
                select: pendSelect,
            });
            for (const t of wtxs) {
                if (leadTxSet.has(t.id)) continue;
                if ((t.cashierName || '').trim().toLowerCase() !== uname) continue;
                const outstanding = Math.max(0, (Number(t.grandTotal) || 0) - (Number(t.downPayment) || 0));
                if (outstanding <= 0) continue;
                rows.push({
                    kind: 'walkin', refId: t.id,
                    invoiceNumber: t.invoiceNumber ?? null,
                    customerName: t.customerName ?? null,
                    customerPhone: t.customerPhone ?? null,
                    sourceLabel: 'Walk-in (POS)', sourceDetail: t.cashierName ?? null,
                    status: t.status ?? null,
                    date: t.createdAt ? new Date(t.createdAt).toISOString() : null,
                    value: outstanding, pcs: 0, items: this.mapTxItems(t.items),
                });
            }
        }
        return rows;
    }

    /** Baris pengiriman (Dikirim/Terkirim) untuk user — mirror _report 1937-2009. */
    private async buildShipmentRows(ctx: BranchContext, params: KpiParams, uid: number, deliveredOnly: boolean): Promise<KpiDetailRow[]> {
        const { start, end } = resolvePeriod(params);
        const branchScope: any = branchWhere(ctx);
        const shippedJobs: any[] = await (this.prisma as any).productionJob.findMany({
            where: { ...branchScope, shippedAt: { gte: start, lte: end }, returnedAt: null },
            select: {
                transactionId: true, pipelineStage: true,
                transactionItem: {
                    select: {
                        quantity: true, pcs: true,
                        productVariant: { select: { product: { select: { category: { select: { countsAsPcs: true } } } } } },
                    },
                },
            },
        });
        const stagesByTx = new Map<number, string[]>();
        const pcsByTx = new Map<number, { inTransit: number; delivered: number }>();
        for (const j of shippedJobs) {
            const txId = Number(j.transactionId);
            if (!Number.isFinite(txId)) continue;
            const stage = j.pipelineStage || 'KIRIM';
            const arr = stagesByTx.get(txId) ?? [];
            arr.push(stage);
            stagesByTx.set(txId, arr);
            const isAddon = j.transactionItem?.productVariant?.product?.category?.countsAsPcs === false;
            const itemQty = (Number(j.transactionItem?.quantity) || 0) * (Number(j.transactionItem?.pcs) || 1);
            const qty = isAddon ? 0 : itemQty;
            const p = pcsByTx.get(txId) ?? { inTransit: 0, delivered: 0 };
            if (stage === 'SELESAI') p.delivered += qty; else p.inTransit += qty;
            pcsByTx.set(txId, p);
        }
        const shippedTxIds = Array.from(stagesByTx.keys());
        if (shippedTxIds.length === 0) return [];

        // Atribusi txId → CS: lead.assignedToId (utama), fallback cashierName walk-in.
        const shippedLeads: any[] = await this.lead.findMany({
            where: { convertedTransactionId: { in: shippedTxIds } },
            select: { convertedTransactionId: true, assignedToId: true },
        });
        const csByTx = new Map<number, number>();
        for (const l of shippedLeads) if (l.assignedToId) csByTx.set(Number(l.convertedTransactionId), l.assignedToId);
        const missing = shippedTxIds.filter(id => !csByTx.has(id));
        const user = await this.prisma.user.findUnique({ where: { id: uid }, select: { name: true } });
        const uname = (user?.name || '').trim().toLowerCase();
        if (missing.length && uname) {
            const missTxs: any[] = await this.tx.findMany({ where: { id: { in: missing } }, select: { id: true, cashierName: true } });
            for (const t of missTxs) {
                if ((t.cashierName || '').trim().toLowerCase() === uname) csByTx.set(Number(t.id), uid);
            }
        }

        // txId milik user & sesuai flag (delivered = semua stage SELESAI).
        const mine = shippedTxIds.filter(txId => {
            if (csByTx.get(txId) !== uid) return false;
            const stages = stagesByTx.get(txId) ?? [];
            const delivered = stages.length > 0 && stages.every(s => s === 'SELESAI');
            return deliveredOnly ? delivered : !delivered;
        });
        if (mine.length === 0) return [];

        const txs: any[] = await this.tx.findMany({ where: { id: { in: mine } }, select: this.txDetailSelect });
        const txById = new Map<number, any>(txs.map(t => [t.id, t]));
        // Sumber: dari lead → pakai source lead; walk-in → "Walk-in (POS)".
        const leadByTx = new Map<number, any>();
        const srcLeads: any[] = await this.lead.findMany({
            where: { convertedTransactionId: { in: mine } },
            select: { convertedTransactionId: true, source: true, sourceDetail: true, name: true, phone: true },
        });
        for (const l of srcLeads) leadByTx.set(Number(l.convertedTransactionId), l);

        return mine.map((txId): KpiDetailRow => {
            const t = txById.get(txId);
            const lead = leadByTx.get(txId);
            const p = pcsByTx.get(txId) ?? { inTransit: 0, delivered: 0 };
            return {
                kind: lead ? 'lead' : 'walkin',
                refId: txId,
                invoiceNumber: t?.invoiceNumber ?? null,
                customerName: t?.customerName || lead?.name || null,
                customerPhone: t?.customerPhone || lead?.phone || null,
                sourceLabel: lead ? this.sourceLabel(lead.source, lead.sourceDetail) : 'Walk-in (POS)',
                sourceDetail: lead ? lead.sourceDetail ?? null : (t?.cashierName ?? null),
                status: deliveredOnly ? 'Terkirim' : 'Sedang dikirim',
                date: t?.createdAt ? new Date(t.createdAt).toISOString() : null,
                value: t ? Math.max(0, (Number(t.grandTotal) || 0) - (Number(t.marketplaceFee) || 0)) : 0,
                pcs: deliveredOnly ? p.delivered : p.inTransit,
                items: t ? this.mapTxItems(t.items) : [],
            };
        });
    }

    /** Kumpulkan txId milik user (won-converted lead + walk-in) — utk metrik custom. */
    private async collectUserTxIds(ctx: BranchContext, params: KpiParams, uid: number): Promise<number[]> {
        const { start, end } = resolvePeriod(params);
        const branchScope: any = branchWhere(ctx);
        const wonLeads: any[] = await this.lead.findMany({
            where: { ...branchScope, assignedToId: uid, status: 'CLOSED_WON', createdAt: { gte: start, lte: end }, convertedTransactionId: { not: null } },
            select: { convertedTransactionId: true },
        });
        const ids = new Set<number>(wonLeads.map(l => Number(l.convertedTransactionId)));
        const walkin = await this.buildWalkinRows(ctx, params, uid);
        for (const r of walkin) ids.add(r.refId);
        return Array.from(ids);
    }

    /** Baris dari daftar txId murni (tanpa lead), value dioverride dari peta. `asPcs` → nilai juga dianggap pcs. */
    private async buildTxRows(txIds: number[], valueByTx: Map<number, number>, asPcs = false): Promise<KpiDetailRow[]> {
        if (txIds.length === 0) return [];
        const txs: any[] = await this.tx.findMany({ where: { id: { in: txIds } }, select: this.txDetailSelect });
        // Sumber: cari lead untuk nota ini bila ada, else walk-in.
        const leads: any[] = await this.lead.findMany({
            where: { convertedTransactionId: { in: txIds } },
            select: { convertedTransactionId: true, source: true, sourceDetail: true },
        });
        const leadByTx = new Map<number, any>();
        for (const l of leads) leadByTx.set(Number(l.convertedTransactionId), l);
        return txs.map((t): KpiDetailRow => {
            const lead = leadByTx.get(t.id);
            return {
                kind: lead ? 'lead' : 'walkin',
                refId: t.id,
                invoiceNumber: t.invoiceNumber ?? null,
                customerName: t.customerName ?? null,
                customerPhone: t.customerPhone ?? null,
                sourceLabel: lead ? this.sourceLabel(lead.source, lead.sourceDetail) : 'Walk-in (POS)',
                sourceDetail: lead ? lead.sourceDetail ?? null : (t.cashierName ?? null),
                status: t.status ?? null,
                date: t.createdAt ? new Date(t.createdAt).toISOString() : null,
                value: valueByTx.get(t.id) ?? 0,
                pcs: asPcs ? (valueByTx.get(t.id) ?? 0) : 0,
                items: this.mapTxItems(t.items),
            };
        });
    }

    private finishDetail(base: any, metricLabel: string, valueMode: string, rows: KpiDetailRow[]) {
        const totals = {
            rows: rows.length,
            value: rows.reduce((s, r) => s + (r.value || 0), 0),
            pcs: rows.reduce((s, r) => s + (r.pcs || 0), 0),
        };
        return { ...base, metricLabel, valueMode, totals, rows };
    }

    async detail(ctx: BranchContext, params: KpiParams, opts: KpiDetailOpts) {
        const { start, end } = resolvePeriod(params);
        const user = await this.prisma.user.findUnique({
            where: { id: opts.userId },
            select: { id: true, name: true, email: true, role: { select: { name: true } } },
        });
        const person = {
            userId: opts.userId,
            name: user?.name || user?.email || `User #${opts.userId}`,
            roleName: user?.role?.name ?? null,
        };
        // Divisi designer/operator di-key per NAMA (bukan userId).
        const personByName = { userId: 0, name: opts.name || '', roleName: opts.division === 'operator' ? 'Operator' : 'Designer' };
        const base = {
            person: opts.division === 'cs' ? person : personByName,
            division: opts.division,
            metric: opts.metric,
            period: { start: start.toISOString(), end: end.toISOString() },
        };
        if (opts.division === 'cs') return this.csDetail(ctx, params, opts, base);
        if (opts.division === 'designer') return this.designerDetail(ctx, params, opts, base);
        if (opts.division === 'operator') return this.operatorDetail(ctx, params, opts, base);
        return this.finishDetail(base, opts.metric, 'count', []);
    }

    private async csDetail(ctx: BranchContext, params: KpiParams, opts: KpiDetailOpts, base: any) {
        const { start, end } = resolvePeriod(params);
        const branchScope: any = branchWhere(ctx);
        const uid = opts.userId;
        const metric = opts.metric;
        const leadSelect = { id: true, name: true, phone: true, source: true, sourceDetail: true, status: true, estimatedValue: true, convertedTransactionId: true, createdAt: true } as any;

        // ── Metrik berbasis lead ──────────────────────────────────────────
        if (['leads', 'closing', 'lost', 'rate', 'pcs'].includes(metric)) {
            const leadWhere: any = { ...branchScope, assignedToId: uid, createdAt: { gte: start, lte: end } };
            if (metric === 'closing' || metric === 'pcs') leadWhere.status = 'CLOSED_WON';
            else if (metric === 'lost') leadWhere.status = 'CLOSED_LOST';
            // 'leads' & 'rate' → semua status (rate: frontend kelompokkan by status).

            const leads: any[] = await this.lead.findMany({ where: leadWhere, select: leadSelect, orderBy: { createdAt: 'desc' } });
            let rows = await this.buildLeadRows(leads);

            if (metric === 'pcs') {
                const walkin = await this.buildWalkinRows(ctx, params, uid);
                rows = [...rows, ...walkin];
            }
            const label: Record<string, string> = {
                leads: 'Leads', closing: 'Closing', lost: 'Lost', rate: 'Closing Rate', pcs: 'Pcs Diorder',
            };
            const valueMode = metric === 'pcs' ? 'pcs' : metric === 'rate' ? 'percent' : 'count';
            return this.finishDetail(base, label[metric], valueMode, rows);
        }

        // ── Cuan = Omzet (nota lunas) + Akan Datang (piutang) ─────────────
        // Definisi baru: Cuan = uang lunas masuk + piutang. Rincian = daftar nota
        // omzet (basis paidAt) digabung daftar piutang PENDING/PARTIAL. Dua populasi
        // disjoint (PAID vs belum) → tak dobel; total = nilai Cuan di leaderboard.
        if (metric === 'cuan') {
            const { csRows } = await this.computeNotaSplits(params, { collectCsRowsFor: uid });
            const shareByTx = new Map<number, number>(csRows.map(r => [r.txId, r.share]));
            const omzetRows = await this.buildTxRows(csRows.map(r => r.txId), shareByTx);
            const pendingRows = await this.buildPendingRows(ctx, params, uid);
            return this.finishDetail(base, 'Cuan (Omzet + Piutang)', 'money', [...omzetRows, ...pendingRows]);
        }

        // ── Pengiriman ────────────────────────────────────────────────────
        if (metric === 'shipped' || metric === 'delivered') {
            const rows = await this.buildShipmentRows(ctx, params, uid, metric === 'delivered');
            return this.finishDetail(base, metric === 'delivered' ? 'Terkirim (sampai)' : 'Sedang Dikirim', 'pcs', rows);
        }

        // ── Omzet — omzet nota PENUH yang melibatkan CS ini (tak dibagi) ───
        if (metric === 'omzet') {
            const { csRows } = await this.computeNotaSplits(params, { collectCsRowsFor: uid });
            const txIds = csRows.map(r => r.txId);
            const shareByTx = new Map<number, number>(csRows.map(r => [r.txId, r.share]));
            const rows = await this.buildTxRows(txIds, shareByTx);
            return this.finishDetail(base, 'Omzet', 'money', rows);
        }

        // ── Akan Datang (piutang tx PENDING/PARTIAL) ──────────────────────
        if (metric === 'pending') {
            const rows = await this.buildPendingRows(ctx, params, uid);
            return this.finishDetail(base, 'Akan Datang (piutang)', 'money', rows);
        }

        // ── Metrik produk custom ──────────────────────────────────────────
        if (metric === 'custom' && opts.metricId) {
            const defs = await this.getActiveCustomMetrics('CS');
            const def = defs.find(d => d.id === opts.metricId);
            if (!def) return this.finishDetail(base, 'Metrik Custom', 'count', []);
            const txIds = await this.collectUserTxIds(ctx, params, uid);
            const byTx = await this.computeCustomMetricByTx(txIds, def);
            const contributing = txIds.filter(id => (byTx.get(id) ?? 0) > 0);
            const rows = await this.buildTxRows(contributing, byTx, def.countMode === 'PCS');
            const modeToValueMode: Record<string, string> = { OMZET: 'money', PCS: 'pcs', QTY: 'count', NOTA: 'count' };
            return this.finishDetail(base, `Metrik Custom: ${def.label}`, modeToValueMode[def.countMode] || 'count', rows);
        }

        // ── Kecepatan balas WhatsApp (drill-down "Balas WA" / "Chat WA") ──────
        if (metric === 'wa' || metric === 'wachats') {
            const detail = await this.waAnalytics.waCsDetail(uid, start, end);
            const rows: KpiDetailRow[] = detail.map((d) => ({
                kind: 'wa' as const,
                refId: d.conversationId,
                invoiceNumber: null,
                customerName: d.contactName,
                customerPhone: d.waId ? `+${d.waId}` : null,
                sourceLabel: 'WhatsApp',
                sourceDetail: null,
                status: null,
                date: d.replyAt.toISOString(),
                value: d.responseSec,
                pcs: 0,
                items: [],
            }));
            return this.finishDetail(base, 'Kecepatan Balas WA', 'duration', rows);
        }

        return this.finishDetail(base, metric, 'count', []);
    }

    // ── Detail Designer (Cek Desain — berbasis lead, di-key designerName) ──────
    private async designerDetail(ctx: BranchContext, params: KpiParams, opts: KpiDetailOpts, base: any) {
        const { start, end } = resolvePeriod(params);
        const branchScope: any = branchWhere(ctx);
        const target = (opts.name || '').trim().toLowerCase();
        if (!target) return this.finishDetail(base, opts.metric, 'count', []);

        if (opts.metric === 'dicek' || opts.metric === 'designClosing') {
            const where: any = { ...branchScope, designerName: { not: null }, createdAt: { gte: start, lte: end } };
            if (opts.metric === 'designClosing') where.status = 'CLOSED_WON';
            const leads: any[] = await this.lead.findMany({
                where,
                select: { id: true, name: true, phone: true, source: true, sourceDetail: true, status: true, estimatedValue: true, convertedTransactionId: true, createdAt: true, designerName: true } as any,
                orderBy: { createdAt: 'desc' },
            });
            const mine = leads.filter(l => (l.designerName || '').trim().toLowerCase() === target);
            const rows = await this.buildLeadRows(mine);
            return this.finishDetail(base, opts.metric === 'dicek' ? 'Desain Dicek' : 'Closing (desain)', 'count', rows);
        }
        return this.finishDetail(base, opts.metric, 'count', []);
    }

    // ── Detail Operator (antrian cetak & produksi, di-key nama operator) ───────
    private lineOmzetOf(ti: any): number {
        const areaM2 = (Number(ti?.areaCm2) || 0) / 10000 * (Number(ti?.pcs) || 1);
        return areaM2 > 0
            ? Number(ti?.priceAtTime || 0) * areaM2
            : Number(ti?.priceAtTime || 0) * (Number(ti?.quantity) || 1);
    }

    /** Baris nota dari transaksi terkait job; sumber = lead bila ada, else walk-in. */
    private async enrichJobRows(rows: Array<KpiDetailRow & { _txId: number | null }>): Promise<KpiDetailRow[]> {
        const txIds = Array.from(new Set(rows.map(r => r._txId).filter((x): x is number => x != null)));
        const leadByTx = new Map<number, any>();
        if (txIds.length) {
            const leads: any[] = await this.lead.findMany({
                where: { convertedTransactionId: { in: txIds } },
                select: { convertedTransactionId: true, source: true, sourceDetail: true },
            });
            for (const l of leads) leadByTx.set(Number(l.convertedTransactionId), l);
        }
        return rows.map(({ _txId, ...r }) => {
            const lead = _txId != null ? leadByTx.get(_txId) : null;
            return {
                ...r,
                sourceLabel: lead ? this.sourceLabel(lead.source, lead.sourceDetail) : r.sourceLabel,
                sourceDetail: lead ? lead.sourceDetail ?? null : r.sourceDetail,
            };
        });
    }

    private async operatorDetail(ctx: BranchContext, params: KpiParams, opts: KpiDetailOpts, base: any) {
        const { start, end } = resolvePeriod(params);
        const branchScope: any = branchWhere(ctx);
        const target = (opts.name || '').trim().toLowerCase();
        if (!target) return this.finishDetail(base, opts.metric, 'count', []);
        const metric = opts.metric;

        const tiSelect = {
            priceAtTime: true, quantity: true, pcs: true, areaCm2: true,
            transaction: { select: { id: true, invoiceNumber: true, customerName: true, customerPhone: true, status: true, createdAt: true } },
        };

        // ── Antrian CETAK (PrintJob) ──────────────────────────────────────
        if (metric === 'printJobs' || metric === 'printPcs') {
            const printJobs: any[] = await (this.prisma as any).printJob.findMany({
                where: { ...branchScope, status: { in: ['SELESAI', 'DIAMBIL'] }, operatorName: { not: null }, finishedAt: { gte: start, lte: end } },
                select: { id: true, operatorName: true, coOperators: true, quantity: true, finishedAt: true, transactionItem: { select: tiSelect } },
            });
            const rows: Array<KpiDetailRow & { _txId: number | null }> = [];
            for (const p of printJobs) {
                const primary = (p.operatorName || '').trim();
                const partners = (Array.isArray(p.coOperators) ? p.coOperators : []).map((n: any) => String(n || '').trim()).filter((n: string) => n && n !== primary);
                const all = Array.from(new Set([primary, ...partners]));
                const allLower = all.map(n => n.toLowerCase());
                if (!allLower.includes(target)) continue;
                const w = 1 / all.length;
                const ti = p.transactionItem;
                const tx = ti?.transaction;
                const qty = Number(p.quantity) || 0;
                rows.push({
                    kind: 'job', refId: p.id,
                    invoiceNumber: tx?.invoiceNumber ?? null,
                    customerName: tx?.customerName ?? null,
                    customerPhone: tx?.customerPhone ?? null,
                    sourceLabel: 'Cetak (paper)', sourceDetail: partners.length ? `1/${all.length} (kerja sama)` : null,
                    status: tx?.status ?? null,
                    date: p.finishedAt ? new Date(p.finishedAt).toISOString() : null,
                    value: ti ? this.lineOmzetOf(ti) * w : 0,
                    pcs: qty * w, // fractional bila kerja sama; total = round2(Σ qty×w) = kolom Lembar
                    items: [],
                    _txId: tx?.id != null ? Number(tx.id) : null,
                });
            }
            const enriched = await this.enrichJobRows(rows);
            return this.finishDetail(base, metric === 'printPcs' ? 'Lembar Cetak' : 'Cetak (job)', metric === 'printPcs' ? 'pcs' : 'count', enriched);
        }

        // ── Antrian PRODUKSI (ProductionJobActivity STAGE_CHANGE oleh OPERATOR) ──
        // prodJobs = distinct job yang operator ini geser tahapannya (keterlibatan,
        // tak dibagi) → rows.length == kolom "Produksi (job)". (prodDone/"Selesai" =
        // job-share berbobot Σw, tak dipetakan ke baris → sel itu non-clickable.)
        if (metric === 'prodJobs') {
            const acts: any[] = await (this.prisma as any).productionJobActivity.findMany({
                where: { action: 'STAGE_CHANGE', actorRole: 'OPERATOR', actorName: { not: null }, createdAt: { gte: start, lte: end } },
                select: { jobId: true, actorName: true, toStage: true },
            });
            const DONE = new Set(['KIRIM', 'SELESAI']);
            const jobIsDone = new Set<number>();
            const myJobIds = new Set<number>();
            for (const a of acts) {
                if ((a.actorName || '').trim().toLowerCase() !== target) continue;
                const jid = Number(a.jobId);
                myJobIds.add(jid);
                if (DONE.has(a.toStage)) jobIsDone.add(jid);
            }
            const jobIds = Array.from(myJobIds);
            if (jobIds.length === 0) return this.finishDetail(base, 'Produksi (job)', 'count', []);
            const jobs: any[] = await (this.prisma as any).productionJob.findMany({
                where: { id: { in: jobIds }, ...branchScope },
                select: { id: true, transactionId: true, transactionItem: { select: tiSelect } },
            });
            const rows: Array<KpiDetailRow & { _txId: number | null }> = jobs.map(j => {
                const ti = j.transactionItem;
                const tx = ti?.transaction;
                const qty = Number(ti?.quantity) || (Number(ti?.pcs) || 1);
                return {
                    kind: 'job' as const, refId: j.id,
                    invoiceNumber: tx?.invoiceNumber ?? null,
                    customerName: tx?.customerName ?? null,
                    customerPhone: tx?.customerPhone ?? null,
                    sourceLabel: 'Produksi', sourceDetail: null,
                    status: jobIsDone.has(j.id) ? 'Selesai' : (tx?.status ?? null),
                    date: null,
                    value: ti ? this.lineOmzetOf(ti) : 0,
                    pcs: qty,
                    items: [],
                    _txId: tx?.id != null ? Number(tx.id) : (j.transactionId != null ? Number(j.transactionId) : null),
                };
            });
            const enriched = await this.enrichJobRows(rows);
            return this.finishDetail(base, 'Produksi (job)', 'count', enriched);
        }

        return this.finishDetail(base, opts.metric, 'count', []);
    }

    // ── Dashboard Marketing PUBLIK (PIN-only, semua cabang) ────────────────────
    async verifyMarketingPin(pin: string): Promise<boolean> {
        if (!pin) return false;
        const s: any = await this.prisma.storeSettings.findFirst({ select: { marketingPin: true } as any });
        const real = s?.marketingPin;
        return !!real && String(real) === String(pin);
    }

    /** Data dashboard publik: report KPI semua cabang + daftar lead beserta produknya. */
    async publicDashboard(params: KpiParams, branchId?: number | null) {
        const bid = branchId != null ? Number(branchId) : null;
        const ctx: any = { branchId: bid, isOwner: true }; // null = semua cabang
        const report = await this.report(ctx, params);
        const start = new Date(report.period.start);
        const end = new Date(report.period.end);

        const leadsRaw: any[] = await this.lead.findMany({
            where: { createdAt: { gte: start, lte: end }, ...(bid != null ? { branchId: bid } : {}) },
            orderBy: { createdAt: 'desc' },
            take: 800,
            select: {
                id: true, name: true, phone: true, source: true, sourceDetail: true,
                status: true, level: true, estimatedValue: true, needs: true, city: true,
                createdAt: true, convertedTransactionId: true,
                firstResponseAt: true, closeLostReason: true, intakeAt: true,
                assignedTo: { select: { name: true } },
                branch: { select: { name: true } },
                items: { select: { description: true, quantity: true, unitPrice: true, widthCm: true, heightCm: true, unitType: true, note: true } },
            },
        });

        // Transaksi hasil convert (untuk nilai nota asli & DETAIL PRODUK).
        // Lead yang closing lewat nota/SO menyimpan produk di TransactionItem,
        // bukan di lead.items — jadi ambil dari sana supaya detail produk muncul.
        const convertedTxIds = Array.from(new Set(
            leadsRaw.filter(l => l.convertedTransactionId).map(l => Number(l.convertedTransactionId)),
        ));
        const grossMap = new Map<number, number>();
        const pendingMap = new Map<number, number>(); // txId → saldo outstanding (PENDING/PARTIAL)
        const txItemsMap = new Map<number, any[]>();
        if (convertedTxIds.length) {
            const txs: any[] = await this.tx.findMany({
                where: { id: { in: convertedTxIds } },
                select: { id: true, grandTotal: true, downPayment: true, status: true } as any,
            });
            for (const t of txs) {
                if (t.status !== 'FAILED' && t.status !== 'CANCELLED') grossMap.set(t.id, Number(t.grandTotal) || 0);
                // Saldo "akan datang": tx belum lunas (PENDING penuh / PARTIAL sisa DP).
                if (t.status === 'PENDING' || t.status === 'PARTIAL') {
                    pendingMap.set(t.id, Math.max(0, Number(t.grandTotal) - Number(t.downPayment || 0)));
                }
            }
            const txItems: any[] = await (this.prisma as any).transactionItem.findMany({
                where: { transactionId: { in: convertedTxIds } },
                select: {
                    transactionId: true, quantity: true, priceAtTime: true, customName: true,
                    widthCm: true, heightCm: true, unitType: true, note: true,
                    productVariant: { select: { variantName: true, product: { select: { name: true } } } },
                },
            });
            for (const it of txItems) {
                if (!txItemsMap.has(it.transactionId)) txItemsMap.set(it.transactionId, []);
                const vn = it.productVariant?.variantName ? ` — ${it.productVariant.variantName}` : '';
                const name = it.productVariant?.product?.name
                    ? `${it.productVariant.product.name}${vn}`
                    : (it.customName || 'Item');
                txItemsMap.get(it.transactionId)!.push({
                    description: name,
                    quantity: it.quantity,
                    unitPrice: Number(it.priceAtTime) || 0,
                    note: it.note ?? null,
                    dimension: it.widthCm && it.heightCm ? `${it.widthCm}×${it.heightCm} ${it.unitType || 'cm'}` : null,
                });
            }
        }

        const leads = leadsRaw.map(l => {
            const txId = l.convertedTransactionId ? Number(l.convertedTransactionId) : null;
            const hasNota = txId != null && grossMap.has(txId);
            const value = hasNota ? grossMap.get(txId!)! : (Number(l.estimatedValue) || 0);
            return {
                id: l.id,
                name: l.name,
                phone: l.phone,
                source: l.source,
                sourceDetail: l.sourceDetail,
                status: l.status,
                level: l.level,
                value,
                hasNota,
                needs: l.needs,
                city: l.city,
                csName: l.assignedTo?.name ?? null,
                branchName: l.branch?.name ?? null,
                createdAt: l.createdAt,
                // Sinyal perilaku: kapan CS pertama membalas (null = belum dibalas),
                // alasan lost (diisi CS saat menutup), & jam lead benar-benar masuk.
                firstResponseAt: l.firstResponseAt ?? null,
                closeLostReason: l.closeLostReason ?? null,
                intakeAt: l.intakeAt ?? null,
                // Saldo "akan datang" lead ini (0 kalau lunas/belum jadi nota) — untuk
                // kartu ringkasan yang ikut filter (CS/sumber/status) di sisi client.
                pendingValue: (hasNota && txId != null && pendingMap.has(txId)) ? pendingMap.get(txId)! : 0,
                // Detail produk: utamakan item dari NOTA (transaksi) bila lead sudah
                // jadi nota; kalau belum, pakai item yang diinput di lead.
                items: (txId != null && (txItemsMap.get(txId)?.length))
                    ? txItemsMap.get(txId)!
                    : (l.items || []).map((it: any) => ({
                        description: it.description,
                        quantity: it.quantity,
                        unitPrice: Number(it.unitPrice) || 0,
                        note: it.note ?? null,
                        dimension: it.widthCm && it.heightCm ? `${it.widthCm}×${it.heightCm} ${it.unitType || 'cm'}` : null,
                    })),
            };
        });

        // ── Biaya iklan dalam periode (untuk benchmark ROAS/CPL/CAC) ───────────
        // Per cabang: hanya spend cabang itu. "Semua cabang": semua spend (termasuk pusat/null).
        const spendRows: any[] = await (this.prisma as any).marketingSpend.findMany({
            where: { date: { gte: start, lte: end }, ...(bid != null ? { branchId: bid } : {}) },
            orderBy: { date: 'desc' },
        });
        const spendBySource: Record<string, number> = {};
        let spendTotal = 0;
        for (const s of spendRows) {
            const amt = Number(s.amount) || 0;
            spendBySource[s.source] = (spendBySource[s.source] || 0) + amt;
            spendTotal += amt;
        }
        const adSpend = {
            total: spendTotal,
            bySource: Object.entries(spendBySource).map(([source, amount]) => ({ source, amount })),
            entries: spendRows.map(s => ({
                id: s.id, date: s.date, source: s.source, amount: Number(s.amount) || 0, note: s.note ?? null, branchId: s.branchId ?? null,
            })),
        };

        return { report, leads, adSpend };
    }

    /**
     * Data leaderboard PUBLIK untuk display TV (PIN-only). Menggabungkan seluruh
     * leaderboard (CS/team/designer/operator/design-output) dalam SATU response
     * agar halaman TV cukup 1 request. branchId null = semua cabang.
     */
    async publicLeaderboard(params: KpiParams, branchId?: number | null) {
        const bid = branchId != null ? Number(branchId) : null;
        const ctx: any = { branchId: bid, isOwner: true };
        const [cs, designer, operator, team, designOutput, dailyTarget] = await Promise.all([
            this.report(ctx, params),
            this.designerLeaderboard(ctx, params),
            this.operatorLeaderboard(ctx, params),
            this.teamOmzetCashflow(ctx, params), // omzet TV = cashflow, sama persis dashboard
            this.designOutput(ctx, params),
            this.reports.getDailyTargetStatus(ctx).catch(() => null),
        ]);
        return {
            period: cs.period,
            branchId: bid,
            cs,                     // { totals, metrics, leaderboard, designCheckLeaderboard, customMetricDefs? }
            designer,               // { leaderboard, totals, customMetricDefs? }
            operator,               // { leaderboard, customMetricDefs? }
            team,                   // { leaderboard, totals }
            designOutput,           // { leaderboard }
            dailyTarget,            // { today, daysInMonth, branches:[{branchName,dailyTarget,todayOmzet,pct,met,...}] } | null
        };
    }

    async addMarketingSpend(data: { date?: string; source: string; amount: number; note?: string; branchId?: number | null }) {
        if (!data.source) throw new BadRequestException('Sumber wajib diisi');
        const amount = Number(data.amount);
        if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('Nominal tidak valid');
        return (this.prisma as any).marketingSpend.create({
            data: {
                date: data.date ? new Date(data.date) : new Date(),
                source: String(data.source).trim(),
                amount,
                note: data.note?.trim() || null,
                branchId: data.branchId != null ? Number(data.branchId) : null,
            },
        });
    }

    async deleteMarketingSpend(id: number) {
        return (this.prisma as any).marketingSpend.delete({ where: { id: Number(id) } });
    }

    // ── Tren Produk ─────────────────────────────────────────────────────────
    // Trend volume order (pcs) per kategori & per produk. Default dari SEMUA
    // transaksi (POS walk-in maupun hasil convert lead). Kalau `csId` diisi,
    // dibatasi hanya transaksi hasil convert lead yang di-handle CS tsb.
    // Bucket harian (range <=31 hari) atau mingguan (lebih panjang).
    async productTrend(ctx: BranchContext, params: KpiParams, csId?: number) {
        const { start, end } = resolvePeriod(params);
        const branchScope: any = branchWhere(ctx);

        // Filter CS: gabungkan transaksi dari 2 sumber, lalu pisahkan kontribusinya.
        //  - "lead"   : transaksi hasil convert lead yang di-assign ke CS (Lead.assignedToId)
        //  - "walkin" : transaksi POS di mana CS dipilih sebagai Kasir/Staff (cashierName)
        // cashierName menyimpan nama user (dropdown di POS), jadi pencocokan by-name andal.
        let leadTxIdSet: Set<number> | null = null;
        let csTxWhere: any = null; // klausa filter CS untuk findMany; null = tanpa filter
        if (csId) {
            const [csLeads, csUser] = await Promise.all([
                this.lead.findMany({
                    where: { ...branchScope, assignedToId: csId, convertedTransactionId: { not: null } },
                    select: { convertedTransactionId: true },
                }),
                this.prisma.user.findUnique({ where: { id: csId }, select: { name: true } }),
            ]);
            leadTxIdSet = new Set<number>(csLeads.map((l: any) => Number(l.convertedTransactionId)));
            const csName = csUser?.name ?? null;

            const or: any[] = [];
            if (leadTxIdSet.size > 0) or.push({ id: { in: Array.from(leadTxIdSet) } });
            if (csName) or.push({ cashierName: csName });
            // Tidak ada sumber sama sekali → paksa match kosong
            csTxWhere = or.length > 0 ? { OR: or } : { id: { in: [-1] } };
        }

        const rangeDays = Math.ceil((end.getTime() - start.getTime()) / 86_400_000);
        const bucketBy: 'day' | 'week' = rangeDays > 31 ? 'week' : 'day';
        const bucketStart = (d: Date) => (bucketBy === 'week' ? startOfWeekMon(d) : startOfDay(d));

        // Daftar bucket berurutan supaya sumbu-X kontinu walau ada hari kosong
        const buckets: { key: string; label: string }[] = [];
        let cursor = bucketStart(start);
        const endTime = end.getTime();
        while (cursor.getTime() <= endTime) {
            buckets.push({ key: ymd(cursor), label: labelDdMmm(cursor) });
            const nextC = new Date(cursor);
            nextC.setDate(nextC.getDate() + (bucketBy === 'week' ? 7 : 1));
            cursor = nextC;
        }

        const txs: any[] = await this.tx.findMany({
            where: {
                ...branchScope,
                status: { not: 'FAILED' },
                createdAt: { gte: start, lte: end },
                ...(csTxWhere || {}),
            },
            select: {
                id: true,
                createdAt: true,
                items: {
                    select: {
                        quantity: true,
                        customName: true,
                        productVariant: {
                            select: {
                                variantName: true,
                                product: {
                                    select: {
                                        name: true,
                                        category: { select: { name: true, countsAsPcs: true } },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });

        const catTotals = new Map<string, number>();
        const prodTotals = new Map<string, number>();
        const catByBucket = new Map<string, Map<string, number>>();
        const prodByBucket = new Map<string, Map<string, number>>();
        // Pisahkan kontribusi pcs: dari lead vs dari walk-in (hanya saat filter CS aktif).
        // Lead diprioritaskan — transaksi yang sekaligus lead-converted & cashierName CS
        // dihitung sebagai "lead" supaya tidak dobel.
        const sourceSplit = { lead: 0, walkin: 0 };

        for (const tx of txs) {
            const bk = ymd(bucketStart(new Date(tx.createdAt)));
            const fromLead = leadTxIdSet ? leadTxIdSet.has(tx.id) : false;
            for (const it of tx.items) {
                const qty = Number(it.quantity) || 0;
                if (qty <= 0) continue;
                // Aturan pcs SAMA dengan computeTxPcsMap: item kategori add-on
                // (countsAsPcs=false — kerah, lengan, rib) adalah komponen produk
                // utama, bukan barang terpisah → tidak dihitung. Penentu tunggal =
                // flag toggle kategori (tanpa hardcode 'Additional').
                const cat = it.productVariant?.product?.category;
                if (cat && cat.countsAsPcs === false) continue;
                const prodName = it.productVariant?.product?.name
                    || it.productVariant?.variantName
                    || it.customName
                    || 'Lainnya';
                const catName = it.productVariant?.product?.category?.name
                    || (it.customName ? 'Custom' : 'Lainnya');

                if (csId) {
                    if (fromLead) sourceSplit.lead += qty;
                    else sourceSplit.walkin += qty;
                }

                catTotals.set(catName, (catTotals.get(catName) || 0) + qty);
                prodTotals.set(prodName, (prodTotals.get(prodName) || 0) + qty);

                if (!catByBucket.has(bk)) catByBucket.set(bk, new Map());
                const cb = catByBucket.get(bk)!;
                cb.set(catName, (cb.get(catName) || 0) + qty);

                if (!prodByBucket.has(bk)) prodByBucket.set(bk, new Map());
                const pb = prodByBucket.get(bk)!;
                pb.set(prodName, (pb.get(prodName) || 0) + qty);
            }
        }

        // Kategori: tampil semua, urut dari total terbesar
        const catSeries = Array.from(catTotals.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([name]) => name);

        // Produk: top 8, sisanya digabung jadi "Lainnya" agar chart tetap terbaca
        const TOP_N = 8;
        const sortedProds = Array.from(prodTotals.entries()).sort((a, b) => b[1] - a[1]);
        const topProds = sortedProds.slice(0, TOP_N).map(([name]) => name);
        const hasOther = sortedProds.length > TOP_N;
        const topProdSet = new Set(topProds);
        const prodSeries = hasOther ? [...topProds, 'Lainnya'] : topProds;

        const buildData = (
            byBucket: Map<string, Map<string, number>>,
            series: string[],
            topSet?: Set<string>,
        ) => buckets.map(({ key, label }) => {
            const row: any = { bucket: key, label };
            for (const s of series) row[s] = 0;
            const m = byBucket.get(key);
            if (m) {
                for (const [name, qty] of m.entries()) {
                    if (topSet) {
                        if (topSet.has(name)) row[name] = qty;
                        else row['Lainnya'] = (row['Lainnya'] || 0) + qty;
                    } else {
                        row[name] = qty;
                    }
                }
            }
            return row;
        });

        return {
            period: { start: start.toISOString(), end: end.toISOString() },
            bucketBy,
            // Pisahan sumber pcs — hanya saat filter CS aktif (null kalau "Semua CS")
            sourceSplit: csId ? sourceSplit : null,
            category: {
                series: catSeries,
                totals: catSeries.map(name => ({ name, pcs: catTotals.get(name) || 0 })),
                data: buildData(catByBucket, catSeries),
            },
            product: {
                series: prodSeries,
                totals: prodSeries.map(name => ({
                    name,
                    pcs: name === 'Lainnya' && hasOther
                        ? sortedProds.slice(TOP_N).reduce((s, [, q]) => s + q, 0)
                        : (prodTotals.get(name) || 0),
                })),
                data: buildData(prodByBucket, prodSeries, hasOther ? topProdSet : undefined),
            },
        };
    }

    // ── Breakdown per Sumber (gaya dashboard Shopee) ────────────────────────
    // Kotak per sumber (Meta/Shopee/RO/Lazada/...) yang bisa di-toggle ke chart.
    // Dua metrik: pcs (jumlah barang diorder) & nilai uang (Rp). Filter: CS + status.
    // Berbasis LEAD (closing/lost/invalid) — bukan transaksi walk-in tanpa lead.
    //  - pcs   : hanya dari lead CLOSED_WON yang punya transaksi (lost/invalid = 0 pcs)
    //  - value : estimatedValue lead (tersedia untuk semua status)
    // Periode & bucket pakai lead.createdAt (konsisten dgn panel lain di dashboard).
    async sourceBreakdown(
        ctx: BranchContext,
        params: KpiParams,
        opts: { csId?: number; statuses?: string[] } = {},
    ) {
        const { start, end } = resolvePeriod(params);
        const branchScope: any = branchWhere(ctx);
        const validStatuses = ['CLOSED_WON', 'CLOSED_LOST', 'INVALID'];
        const statuses = (opts.statuses || []).filter(s => validStatuses.includes(s));
        const statusFilter = statuses.length > 0 ? statuses : ['CLOSED_WON'];

        const rangeDays = Math.ceil((end.getTime() - start.getTime()) / 86_400_000);
        const bucketBy: 'day' | 'week' = rangeDays > 31 ? 'week' : 'day';
        const bucketStart = (d: Date) => (bucketBy === 'week' ? startOfWeekMon(d) : startOfDay(d));

        const buckets: { key: string; label: string }[] = [];
        let cursor = bucketStart(start);
        const endTime = end.getTime();
        while (cursor.getTime() <= endTime) {
            buckets.push({ key: ymd(cursor), label: labelDdMmm(cursor) });
            const nextC = new Date(cursor);
            nextC.setDate(nextC.getDate() + (bucketBy === 'week' ? 7 : 1));
            cursor = nextC;
        }

        // Ambil SEMUA lead di periode+CS (tanpa filter status) — perlu untuk
        // hitung closing rate per sumber (won / total valid, lepas dari filter status).
        // Box & chart pcs/value tetap dibatasi statusFilter di loop di bawah.
        const statusSet = new Set(statusFilter);
        const leads: any[] = await this.lead.findMany({
            where: {
                ...branchScope,
                createdAt: { gte: start, lte: end },
                ...(opts.csId ? { assignedToId: opts.csId } : {}),
            },
            select: {
                createdAt: true, status: true, source: true, sourceDetail: true,
                estimatedValue: true, convertedTransactionId: true,
            },
        });

        // pcs hanya untuk lead CLOSED_WON yang punya transaksi (dan Closing dipilih)
        const wonTxIds = statusSet.has('CLOSED_WON')
            ? leads.filter(l => l.status === 'CLOSED_WON' && l.convertedTransactionId).map(l => Number(l.convertedTransactionId))
            : [];
        const txPcsMap = await this.computeTxPcsMap(wonTxIds);

        // Key sumber: pakai sourceDetail untuk MARKETPLACE/CUSTOM/OTHER (mis. Shopee, Lazada),
        // selain itu pakai enum source (mis. WHATSAPP, REPEAT_ORDER).
        const sourceKey = (source: string, detail: string | null): string => {
            if ((source === 'MARKETPLACE' || source === 'CUSTOM' || source === 'OTHER') && detail?.trim()) {
                return detail.trim();
            }
            return source;
        };

        const sourceTotals = new Map<string, { pcs: number; value: number }>();
        const pcsByBucket = new Map<string, Map<string, number>>();
        const valueByBucket = new Map<string, Map<string, number>>();
        // Closing rate per sumber: won / total valid (INVALID dikecualikan dari denominator,
        // karena lead invalid = salah target, bukan peluang nyata). Lepas dari filter status.
        const rateBySource = new Map<string, { won: number; valid: number }>();

        for (const l of leads) {
            const key = sourceKey(l.source, l.sourceDetail);

            // Closing rate dihitung dari SEMUA lead (kecuali INVALID di denominator)
            if (l.status !== 'INVALID') {
                const r = rateBySource.get(key) || { won: 0, valid: 0 };
                r.valid++;
                if (l.status === 'CLOSED_WON') r.won++;
                rateBySource.set(key, r);
            }

            // Box & chart pcs/value: hanya lead yang lolos filter status
            if (!statusSet.has(l.status)) continue;

            const bk = ymd(bucketStart(new Date(l.createdAt)));
            const pcs = (l.status === 'CLOSED_WON' && l.convertedTransactionId)
                ? (txPcsMap.get(Number(l.convertedTransactionId)) ?? 0)
                : 0;
            const value = Number(l.estimatedValue) || 0;

            const st = sourceTotals.get(key) || { pcs: 0, value: 0 };
            st.pcs += pcs; st.value += value;
            sourceTotals.set(key, st);

            if (!pcsByBucket.has(bk)) pcsByBucket.set(bk, new Map());
            const pb = pcsByBucket.get(bk)!;
            pb.set(key, (pb.get(key) || 0) + pcs);

            if (!valueByBucket.has(bk)) valueByBucket.set(bk, new Map());
            const vb = valueByBucket.get(bk)!;
            vb.set(key, (vb.get(key) || 0) + value);
        }

        const sources = Array.from(sourceTotals.entries())
            .map(([key, t]) => ({ key, pcs: t.pcs, value: t.value }))
            .sort((a, b) => b.value - a.value || b.pcs - a.pcs);
        const sourceKeys = sources.map(s => s.key);

        // Distribusi closing rate per sumber — urut dari rate tertinggi
        const closingRateBySource = Array.from(rateBySource.entries())
            .map(([key, r]) => ({
                key,
                closedWon: r.won,
                leadsValid: r.valid,
                rate: r.valid > 0 ? r.won / r.valid : 0,
            }))
            .sort((a, b) => b.rate - a.rate || b.leadsValid - a.leadsValid);

        const buildData = (byBucket: Map<string, Map<string, number>>) =>
            buckets.map(({ key, label }) => {
                const row: any = { bucket: key, label };
                for (const s of sourceKeys) row[s] = 0;
                const m = byBucket.get(key);
                if (m) for (const [k, v] of m.entries()) row[k] = v;
                return row;
            });

        return {
            period: { start: start.toISOString(), end: end.toISOString() },
            bucketBy,
            statuses: statusFilter,
            sources,                       // kotak: { key, pcs, value }
            closingRateBySource,           // distribusi closing rate per sumber (lepas filter status)
            pcs: { data: buildData(pcsByBucket) },
            value: { data: buildData(valueByBucket) },
        };
    }

    // ── Leaderboard Designer ────────────────────────────────────────────────
    // Performa designer dari ProductionJob (grouped by designerName) dalam periode.
    //  - assignment : total job yang di-assign ke designer
    //  - acc        : job yang sudah LEWAT stage DESIGN (disetujui & lanjut produksi)
    //  - wip        : masih di stage DESIGN (belum ACC)
    //  - retur      : job di stage RETUR
    //  - selesai    : job di KIRIM/SELESAI (terkirim)
    //  - batal      : job ditandai batal (klien tidak jadi order)
    //  - express    : job Express yang ditangani
    //  - avgDesignHrs: rata-rata jam dari job dibuat sampai proof pertama (designEnteredAt)
    // accRate = acc / (assignment - batal). Bucket/periode pakai job.createdAt.
    /**
     * Produktivitas jasa desain per designer — berbasis ITEM NOTA (TransactionItem),
     * BUKAN ProductionJob. Alasan: produk "Jasa Desain" di master ber-
     * `requiresProduction=false`, jadi penjualannya TIDAK pernah membuat ProductionJob
     * (lih. transactions.service.ts). Deteksi lama yang berbasis job → panel selalu
     * kosong total. Sekarang: hitung langsung item produk bernama "desain" di nota.
     *
     * Atribusi designer diambil dari SalesOrder.designerName (via transaction.salesOrder).
     * Nota walk-in tanpa SO → dikelompokkan sbg "Belum di-assign" supaya tidak hilang.
     * "Berapa desain dikerjakan" tiap designer di periode, dipecah per tier (nama varian)
     * + omzet jasa desainnya. Basis tanggal = transaction.createdAt (tgl nota).
     */
    async designOutput(ctx: BranchContext, params: KpiParams) {
        const { start, end } = resolvePeriod(params);
        const branchScope: any = branchWhere(ctx);

        const items: any[] = await (this.prisma as any).transactionItem.findMany({
            where: {
                productVariant: { product: { name: { contains: 'desain' } } },
                transaction: { ...branchScope, createdAt: { gte: start, lte: end } },
            },
            select: {
                quantity: true, priceAtTime: true,
                productVariant: { select: { variantName: true } },
                transaction: {
                    select: {
                        invoiceNumber: true,
                        salesOrder: { select: { designerName: true } },
                    },
                },
            },
        });

        // Sebagian nota lama punya SalesOrder yang FK `transactionId`-nya tidak konsisten
        // (relasi reverse `transaction.salesOrder` = null) padahal `soNumber == invoiceNumber`.
        // Selamatkan atribusi designer via pencocokan soNumber = invoiceNumber, dibatch
        // (bukan N+1). Nota yang benar-benar tanpa SO (walk-in, mis. INV-*) tetap "Belum di-assign".
        const unlinkedInvoices = Array.from(new Set(
            items
                .filter((it) => !((it.transaction?.salesOrder?.designerName || '').trim()) && it.transaction?.invoiceNumber)
                .map((it) => it.transaction.invoiceNumber as string),
        ));
        const soByNumber = new Map<string, string>();
        if (unlinkedInvoices.length) {
            const sos: any[] = await (this.prisma as any).salesOrder.findMany({
                where: { soNumber: { in: unlinkedInvoices } },
                select: { soNumber: true, designerName: true },
            });
            for (const so of sos) {
                const dn = (so.designerName || '').trim();
                if (dn) soByNumber.set(so.soNumber, dn);
            }
        }

        type Stat = { total: number; omzet: number; byTier: Map<string, number> };
        const byDesigner = new Map<string, Stat>();
        for (const it of items) {
            const fromRel = (it.transaction?.salesOrder?.designerName || '').trim();
            const fromNum = soByNumber.get(it.transaction?.invoiceNumber || '') || '';
            const name = fromRel || fromNum || 'Belum di-assign';
            const qty = Number(it.quantity) || 1;
            const tier = ((it.productVariant?.variantName || 'Standar').trim()) || 'Standar';
            const e = byDesigner.get(name) || { total: 0, omzet: 0, byTier: new Map<string, number>() };
            e.total += qty;
            e.omzet += Number(it.priceAtTime || 0) * qty;
            e.byTier.set(tier, (e.byTier.get(tier) || 0) + qty);
            byDesigner.set(name, e);
        }

        return Array.from(byDesigner.entries())
            .map(([name, s]) => ({
                name,
                total: s.total,
                omzet: s.omzet,
                byTier: Array.from(s.byTier.entries())
                    .map(([tier, count]) => ({ tier, count }))
                    .sort((a, b) => b.count - a.count),
            }))
            .sort((a, b) => b.total - a.total);
    }

    /**
     * Omzet OPERATOR basis TANGGAL PENGERJAAN (bukan tanggal bayar). Beda dari
     * computeNotaSplits (yg basis paidAt utk selaras cashflow): divisi operator
     * dinilai dari OUTPUT produksi, jadi omzet diakui pada hari ia mencetak/
     * memproduksi — asalkan notanya sudah LUNAS (status PAID, kapan pun bayarnya).
     * Ini menyelesaikan "operator banyak cetak hari ini tapi omzet 0" yang muncul
     * karena order dibayar di hari berbeda dari saat dikerjakan.
     *
     * Kredit PENUH per nota (tak dibagi lintas peran); antar operator pada nota
     * yang sama TETAP dibagi bobot keterlibatan (kerja sama 1/N).
     */
    private async computeOperatorOmzetByWork(params: KpiParams): Promise<Map<string, number>> {
        const { start, end } = resolvePeriod(params);
        const result = new Map<string, number>();

        // Kerja CETAK di periode (basis finishedAt) — sama dgn kolom "Cetak".
        const printJobs: any[] = await (this.prisma as any).printJob.findMany({
            where: { status: { in: ['SELESAI', 'DIAMBIL'] }, operatorName: { not: null }, finishedAt: { gte: start, lte: end } },
            select: { transactionId: true, operatorName: true, coOperators: true },
        });
        // Kerja PRODUKSI di periode (basis activity.createdAt), tahap DONE.
        const acts: any[] = await (this.prisma as any).productionJobActivity.findMany({
            where: {
                action: 'STAGE_CHANGE', actorRole: 'OPERATOR', actorName: { not: null },
                toStage: { in: ['KIRIM', 'SELESAI'] }, createdAt: { gte: start, lte: end },
            },
            select: { jobId: true, actorName: true, actorWeight: true },
        });
        const prodJobIds = Array.from(new Set(acts.map(a => a.jobId)));
        const prodJobs: any[] = prodJobIds.length ? await (this.prisma as any).productionJob.findMany({
            where: { id: { in: prodJobIds } }, select: { id: true, transactionId: true },
        }) : [];
        const jobTx = new Map<number, number>(prodJobs.map(j => [j.id, j.transactionId]));

        // Kandidat nota dari kedua sumber → saring HANYA yang sudah LUNAS (PAID).
        const txIds = Array.from(new Set<number>([
            ...printJobs.map(p => p.transactionId),
            ...prodJobs.map(j => j.transactionId),
        ]));
        if (!txIds.length) return result;
        const txs: any[] = await (this.prisma as any).transaction.findMany({
            where: { id: { in: txIds }, status: 'PAID' },
            select: { id: true, grandTotal: true },
        });
        const grossByTx = new Map<number, number>(txs.map(t => [t.id, Number(t.grandTotal) || 0]));
        if (!grossByTx.size) return result;

        // Peta bobot operator per nota (hanya kerja DI PERIODE ini).
        const opByTx = new Map<number, Map<string, number>>();
        const addOp = (txId: number, name: string, w: number) => {
            if (!name || !grossByTx.has(txId)) return;
            let m = opByTx.get(txId); if (!m) { m = new Map(); opByTx.set(txId, m); }
            m.set(name, (m.get(name) || 0) + w);
        };
        for (const p of printJobs) {
            const primary = (p.operatorName || '').trim();
            const partners = (Array.isArray(p.coOperators) ? p.coOperators : [])
                .map((n: any) => String(n || '').trim()).filter((n: string) => n && n !== primary);
            const all = Array.from(new Set([primary, ...partners])).filter(Boolean);
            if (!all.length) continue;
            const w = 1 / all.length;
            for (const name of all) addOp(p.transactionId, name as string, w);
        }
        const jobNameWeight = new Map<string, number>();
        for (const a of acts) {
            const name = (a.actorName || '').trim(); if (!name) continue;
            const key = `${a.jobId}|${name}`;
            jobNameWeight.set(key, Math.max(jobNameWeight.get(key) ?? 0, Number(a.actorWeight) || 1));
        }
        for (const [key, w] of jobNameWeight) {
            const sep = key.indexOf('|');
            const jobId = Number(key.slice(0, sep));
            const name = key.slice(sep + 1);
            const txId = jobTx.get(jobId); if (txId == null) continue;
            addOp(txId, name, w);
        }

        // Kredit penuh grandTotal per nota, dibagi bobot antar operator (kerja sama).
        for (const [txId, opMap] of opByTx) {
            const gross = grossByTx.get(txId) || 0;
            if (gross <= 0 || !opMap.size) continue;
            const totalW = Array.from(opMap.values()).reduce((s, w) => s + w, 0) || 1;
            for (const [name, w] of opMap) result.set(name, (result.get(name) || 0) + gross * (w / totalW));
        }
        return result;
    }

    /**
     * Leaderboard OPERATOR produksi & cetak — gabungan output dua antrian yang
     * dikerjakan operator, di-key per NAMA operator:
     *  - Antrian CETAK paper (PrintJob): job yang sudah dicetak (SELESAI/DIAMBIL),
     *    `operatorName` tersimpan langsung; basis tanggal = `finishedAt`.
     *  - Antrian PRODUKSI (ProductionJob via ProductionJobActivity): operator yang
     *    memindahkan kartu di kanban (STAGE_CHANGE oleh actorRole=OPERATOR);
     *    basis tanggal = `activity.createdAt`. "Selesai" = toStage KIRIM/SELESAI.
     * (Catatan: board /produksi lama berbasis-status tidak menyimpan nama operator,
     *  jadi attribusi produksi mengandalkan kanban /produksi/board yang mencatat nama.)
     */
    async operatorLeaderboard(ctx: BranchContext, params: KpiParams) {
        const { start, end } = resolvePeriod(params);
        const branchScope: any = branchWhere(ctx);
        // Omzet operator basis TANGGAL PENGERJAAN (cetak/produksi) + nota LUNAS —
        // bukan paidAt. Biar "cetak hari ini → omzet hari ini". Lihat helper.
        const operatorShareByName = await this.computeOperatorOmzetByWork(params);

        // ── CETAK (PrintJob) ──────────────────────────────────────────────
        // Omzet cetak = nilai line item yang dicetak (priceAtTime × qty item).
        const printJobs: any[] = await (this.prisma as any).printJob.findMany({
            where: {
                ...branchScope,
                status: { in: ['SELESAI', 'DIAMBIL'] },
                operatorName: { not: null },
                finishedAt: { gte: start, lte: end },
            },
            select: {
                operatorName: true, coOperators: true, quantity: true,
                transactionItemId: true,
                transactionItem: {
                    select: {
                        priceAtTime: true, quantity: true, pcs: true, areaCm2: true,
                        productVariant: { select: { product: { select: { category: { select: { productionCategoryId: true } } } } } },
                    },
                },
            },
        });

        // ── PRODUKSI (ProductionJobActivity: STAGE_CHANGE oleh OPERATOR) ───
        const acts: any[] = await (this.prisma as any).productionJobActivity.findMany({
            where: {
                action: 'STAGE_CHANGE',
                actorRole: 'OPERATOR',
                actorName: { not: null },
                createdAt: { gte: start, lte: end },
            },
            select: { jobId: true, actorName: true, toStage: true, actorWeight: true },
        });
        // Activity tak punya branchId → kalau di-scope ke cabang, filter via job.
        let allowedJobIds: Set<number> | null = null;
        if (branchScope && branchScope.branchId !== undefined) {
            const jobIds = Array.from(new Set(acts.map(a => a.jobId)));
            const jobs: any[] = jobIds.length === 0 ? [] : await (this.prisma as any).productionJob.findMany({
                where: { id: { in: jobIds }, ...branchScope },
                select: { id: true },
            });
            allowedJobIds = new Set(jobs.map(j => j.id));
        }

        // Nilai item per production job — untuk omzet produksi (hanya job yang
        // dibawa sampai KIRIM/SELESAI, dihitung sekali per job per operator).
        const DONE_STAGES = new Set(['KIRIM', 'SELESAI']);
        const doneJobIds = Array.from(new Set(
            acts.filter(a => DONE_STAGES.has(a.toStage) && (!allowedJobIds || allowedJobIds.has(a.jobId)))
                .map(a => a.jobId),
        ));
        // Kategori produksi (dinamis, bisa di-CRUD user) untuk breakdown per kategori.
        // Tiap kategori punya `source` (CETAK vs PRODUKSI) yang menentukan dari antrian
        // mana ia dihitung — sehingga tidak ada dobel (satu kategori = satu sumber).
        const prodCatRows: any[] = await (this.prisma as any).productionCategory.findMany({
            where: { isActive: true },
            select: { id: true, source: true },
        });
        const prodCatSource = new Map<number, string>(prodCatRows.map(c => [c.id, c.source]));
        type CatMetric = { jobs: number; pcs: number; areaM2: number; omzet: number };
        // id ProductionCategory dari transactionItem (null jika bukan kategori produksi aktif).
        const catIdOf = (ti: any): number | null => {
            const id = ti?.productVariant?.product?.category?.productionCategoryId;
            return (id && prodCatSource.has(id)) ? id : null;
        };
        // Luas total item (m²) = luas per-unit (areaCm2) × jumlah kopi (pcs).
        const areaM2Of = (ti: any) => (Number(ti?.areaCm2) || 0) / 10000 * (Number(ti?.pcs) || 1);
        // Omzet per line: item AREA = harga/m² × luas total (area × pcs); item UNIT = harga × qty.
        // Tanpa cabang area, item AREA (quantity=1, priceAtTime per-m²) akan undercount besar.
        const lineOmzet = (ti: any) => {
            const areaM2 = areaM2Of(ti);
            return areaM2 > 0
                ? Number(ti?.priceAtTime || 0) * areaM2
                : Number(ti?.priceAtTime || 0) * (Number(ti?.quantity) || 1);
        };
        const bump = (cats: Map<number, CatMetric>, id: number, m: CatMetric) => {
            const c = cats.get(id) || { jobs: 0, pcs: 0, areaM2: 0, omzet: 0 };
            c.jobs += m.jobs; c.pcs += m.pcs; c.areaM2 += m.areaM2; c.omzet += m.omzet;
            cats.set(id, c);
        };

        // Info per production job selesai (omzet + kategori + pcs + luas) untuk breakdown.
        const prodJobInfo = new Map<number, { omzet: number; catId: number | null; pcs: number; areaM2: number; itemId: number | null }>();
        if (doneJobIds.length) {
            const pj: any[] = await (this.prisma as any).productionJob.findMany({
                where: { id: { in: doneJobIds } },
                select: {
                    id: true,
                    transactionItemId: true,
                    transactionItem: {
                        select: {
                            priceAtTime: true, quantity: true, pcs: true, areaCm2: true,
                            productVariant: { select: { product: { select: { category: { select: { productionCategoryId: true } } } } } },
                        },
                    },
                },
            });
            for (const j of pj) {
                const ti = j.transactionItem;
                prodJobInfo.set(j.id, {
                    omzet: ti ? lineOmzet(ti) : 0,
                    catId: catIdOf(ti),
                    pcs: Number(ti?.quantity) || (Number(ti?.pcs) || 1),
                    areaM2: areaM2Of(ti),
                    itemId: j.transactionItemId != null ? Number(j.transactionItemId) : null,
                });
            }
        }

        // prodDoneJobs: jobId → bobot kredit (1/N bila kerja sama). Keterlibatan (prodJobs)
        // TIDAK dibagi; metrik kredit (omzet/pcs/kategori/prodDone) dibagi via bobot.
        type Row = { name: string; printJobs: number; printPcs: number; printOmzet: number; prodJobs: Set<number>; prodDoneJobs: Map<number, number>; cats: Map<number, CatMetric>; items: Set<number> };
        const map = new Map<string, Row>();
        const ensure = (n: string) => {
            if (!map.has(n)) map.set(n, { name: n, printJobs: 0, printPcs: 0, printOmzet: 0, prodJobs: new Set(), prodDoneJobs: new Map(), cats: new Map(), items: new Set() });
            return map.get(n)!;
        };

        for (const p of printJobs) {
            const primary = (p.operatorName || '').trim();
            if (!primary) continue;
            // Kerja sama: bagi rata 1/N ke primary + rekan (coOperators = Json array nama).
            const partners = (Array.isArray(p.coOperators) ? p.coOperators : [])
                .map((n: any) => String(n || '').trim())
                .filter((n: string) => n && n !== primary);
            const all = Array.from(new Set([primary, ...partners]));
            const w = 1 / all.length;
            const ti = p.transactionItem;
            const qty = Number(p.quantity) || 0;
            const cid = catIdOf(ti);
            const isCetakCat = cid && prodCatSource.get(cid) === 'CETAK';
            const itemId = p.transactionItemId != null ? Number(p.transactionItemId) : null;
            for (const name of all) {
                const e = ensure(name);
                e.printJobs++;                       // keterlibatan: tak dibagi
                e.printPcs += qty * w;               // kredit: bagi 1/N
                if (itemId != null) e.items.add(itemId); // utk metrik produk custom
                if (ti) e.printOmzet += lineOmzet(ti) * w;
                if (isCetakCat) {
                    bump(e.cats, cid!, { jobs: w, pcs: qty * w, areaM2: areaM2Of(ti) * w, omzet: lineOmzet(ti) * w });
                }
            }
        }
        for (const a of acts) {
            if (allowedJobIds && !allowedJobIds.has(a.jobId)) continue;
            const name = (a.actorName || '').trim();
            if (!name) continue;
            const e = ensure(name);
            e.prodJobs.add(a.jobId); // keterlibatan: tak dibagi
            if (DONE_STAGES.has(a.toStage)) {
                const w = Number(a.actorWeight) || 1;
                // Kalau operator sama punya >1 baris done utk job yg sama, ambil bobot terbesar.
                e.prodDoneJobs.set(a.jobId, Math.max(e.prodDoneJobs.get(a.jobId) ?? 0, w));
            }
        }

        // ── Metrik produk custom (owner-defined) per operator (level-item) ──
        // Item yang dikreditkan ke operator: item PrintJob + item ProductionJob yang
        // ia bawa sampai DONE (konsisten dgn kredit prodDone). Kredit penuh (tanpa 1/N).
        for (const e of map.values()) {
            for (const jid of e.prodDoneJobs.keys()) {
                const itemId = prodJobInfo.get(jid)?.itemId;
                if (itemId != null) e.items.add(itemId);
            }
        }
        const opCustomMetrics = await this.getActiveCustomMetrics('OPERATOR');
        const customMetricDefs = opCustomMetrics.map((m) => ({ id: m.id, label: m.label, countMode: m.countMode }));
        const customByOperator = new Map<string, Record<string, number>>();
        if (opCustomMetrics.length > 0) {
            const allItemIds = Array.from(new Set(
                Array.from(map.values()).flatMap((e) => Array.from(e.items)),
            ));
            for (const metric of opCustomMetrics) {
                const byItem = await this.computeCustomMetricByItemIds(allItemIds, metric);
                for (const e of map.values()) {
                    let sum = 0;
                    for (const itemId of e.items) sum += byItem.get(itemId) ?? 0;
                    if (sum === 0 && metric.countMode !== 'NOTA') continue;
                    const rec = customByOperator.get(e.name) ?? {};
                    rec[String(metric.id)] = Math.round(sum);
                    customByOperator.set(e.name, rec);
                }
            }
        }

        const round2 = (v: number) => Math.round(v * 100) / 100;
        const leaderboard = Array.from(map.values())
            .map(e => {
                let prodOmzet = 0, prodDone = 0;
                for (const [id, w] of e.prodDoneJobs) {
                    prodDone += w; // share job selesai (bagi 1/N bila kerja sama)
                    const info = prodJobInfo.get(id);
                    if (!info) continue;
                    prodOmzet += info.omzet * w;
                    // Breakdown: kategori bersumber PRODUKSI dihitung dari antrian produksi.
                    if (info.catId && prodCatSource.get(info.catId) === 'PRODUKSI') {
                        bump(e.cats, info.catId, { jobs: w, pcs: info.pcs * w, areaM2: info.areaM2 * w, omzet: info.omzet * w });
                    }
                }
                // Breakdown per kategori → objek keyed by id ProductionCategory.
                const production: Record<string, CatMetric> = {};
                for (const [id, c] of e.cats) production[id] = { jobs: round2(c.jobs), pcs: round2(c.pcs), areaM2: round2(c.areaM2), omzet: round2(c.omzet) };
                const printPcs = round2(e.printPcs);
                const printOmzet = round2(e.printOmzet);
                prodOmzet = round2(prodOmzet);
                return {
                    name: e.name,
                    customMetrics: customByOperator.get(e.name) ?? {},
                    printJobs: e.printJobs,
                    printPcs,
                    printOmzet,
                    prodJobs: e.prodJobs.size,
                    prodDone: round2(prodDone),
                    prodOmzet,
                    omzet: round2(printOmzet + prodOmzet),
                    // Bagian omzet nota utk operator ini (nota dibagi per peran) → kolom leaderboard.
                    omzetShare: Math.round(operatorShareByName.get(e.name) || 0),
                    total: e.printJobs + e.prodJobs.size,
                    production,
                };
            })
            .sort((a, b) => b.omzet - a.omzet || b.total - a.total || b.printPcs - a.printPcs);

        return { leaderboard, customMetricDefs };
    }

    async designerLeaderboard(ctx: BranchContext, params: KpiParams) {
        const { start, end } = resolvePeriod(params);
        const branchScope: any = branchWhere(ctx);
        // Bagian omzet desainer (nota dibagi per peran) — kolom "omzet (bagian)".
        const { designerShareByName } = await this.computeNotaSplits(params);

        const FORWARD = new Set(['PRINT', 'ANTRIAN_PRESS', 'JAHIT', 'QC_PACKING', 'KIRIM', 'SELESAI']);
        const DONE = new Set(['KIRIM', 'SELESAI']);

        const jobs: any[] = await (this.prisma as any).productionJob.findMany({
            where: {
                ...branchScope,
                // Atribusi kredit desainer ke WAKTU DESAIN DIUPLOAD (designEnteredAt),
                // bukan tanggal nota dibuat (createdAt). Kalau pakai createdAt, desainer
                // yang upload gambar di periode ini untuk job yang notanya dibuat di
                // periode lain TIDAK muncul di leaderboard periode ini.
                designEnteredAt: { gte: start, lte: end },
                designerName: { not: null },
            },
            select: {
                designerName: true, pipelineStage: true, cancelledAt: true,
                isExpress: true, createdAt: true, designEnteredAt: true,
            },
        });

        type Stat = {
            assignment: number; acc: number; nungguAcc: number; wip: number; retur: number;
            selesai: number; batal: number; express: number;
            designSumMs: number; designCount: number;
        };
        const byDesigner = new Map<string, Stat>();
        for (const j of jobs) {
            const name = (j.designerName || '').trim();
            if (!name) continue;
            const s = byDesigner.get(name) || {
                assignment: 0, acc: 0, nungguAcc: 0, wip: 0, retur: 0, selesai: 0, batal: 0,
                express: 0, designSumMs: 0, designCount: 0,
            };
            s.assignment++;
            if (j.cancelledAt) {
                s.batal++;
            } else {
                const stage = j.pipelineStage || 'DESIGN';
                if (stage === 'DESIGN') s.wip++;
                else if (stage === 'ACC') s.nungguAcc++;
                else if (stage === 'RETUR') s.retur++;
                else if (FORWARD.has(stage)) s.acc++;
                if (DONE.has(stage)) s.selesai++;
            }
            if (j.isExpress) s.express++;
            if (j.designEnteredAt && j.createdAt) {
                const diff = new Date(j.designEnteredAt).getTime() - new Date(j.createdAt).getTime();
                if (diff > 0) { s.designSumMs += diff; s.designCount++; }
            }
            byDesigner.set(name, s);
        }

        // SO Dibuat: jumlah Sales Order (kecuali CANCELLED) yang dibuat designer di periode.
        // Menutup celah designer yang kerjanya tidak menghasilkan production job (mis. produk
        // non-AREA_BASED). Kolom terpisah dari assignment → tidak dobel hitung.
        // SO di-scope per cabang via branchName (SalesOrder tidak punya FK cabang).
        const soBranches = await this.soBranchNames(ctx);
        const sosRaw: any[] = await (this.prisma as any).salesOrder.findMany({
            where: { createdAt: { gte: start, lte: end }, status: { not: 'CANCELLED' } },
            select: { designerName: true, branchName: true },
        });
        const sos = sosRaw.filter(so => this.soMatchesBranch(so.branchName, soBranches));
        const soByDesigner = new Map<string, number>();
        for (const so of sos) {
            const name = (so.designerName || '').trim();
            if (!name) continue;
            soByDesigner.set(name, (soByDesigner.get(name) || 0) + 1);
        }

        // SO yang JADI NOTA di periode (invoicedAt) → omzet & pcs per designer.
        // Sumber kebenaran: SalesOrder.transactionId → transaction.grandTotal.
        // Satu nota dihitung sekali di sini (dedup natural: 1 SO = 1 transaksi).
        const invoicedSosRaw: any[] = await (this.prisma as any).salesOrder.findMany({
            where: { invoicedAt: { gte: start, lte: end }, status: 'INVOICED', transactionId: { not: null } },
            select: {
                designerName: true,
                branchName: true,
                transactionId: true,
                transaction: { select: { grandTotal: true } },
            },
        });
        const invoicedSos = invoicedSosRaw.filter(so => this.soMatchesBranch(so.branchName, soBranches));
        // pcs konsisten dgn panel lain: kategori add-on (countsAsPcs=false) dikecualikan
        const soTxPcsMap = await this.computeTxPcsMap(invoicedSos.map(so => Number(so.transactionId)));
        type SoStat = { invoiced: number; omzet: number; pcs: number };
        const soNotaByDesigner = new Map<string, SoStat>();
        // txId nota per desainer → utk metrik produk custom (atribusi level-transaksi).
        const txByDesigner = new Map<string, Set<number>>();
        for (const so of invoicedSos) {
            const name = (so.designerName || '').trim();
            if (!name) continue;
            const st = soNotaByDesigner.get(name) || { invoiced: 0, omzet: 0, pcs: 0 };
            st.invoiced++;
            st.omzet += Number(so.transaction?.grandTotal || 0);
            st.pcs += soTxPcsMap.get(Number(so.transactionId)) ?? 0;
            soNotaByDesigner.set(name, st);
            const txId = Number(so.transactionId);
            if (Number.isFinite(txId)) {
                const set = txByDesigner.get(name) ?? new Set<number>();
                set.add(txId);
                txByDesigner.set(name, set);
            }
        }

        // ── Metrik produk custom (owner-defined) per designer ──────────────
        const dgCustomMetrics = await this.getActiveCustomMetrics('DESIGNER');
        const customMetricDefs = dgCustomMetrics.map((m) => ({ id: m.id, label: m.label, countMode: m.countMode }));
        const customByDesigner = new Map<string, Record<string, number>>();
        if (dgCustomMetrics.length > 0) {
            const allTxIds = Array.from(new Set(
                Array.from(txByDesigner.values()).flatMap((s) => Array.from(s)),
            ));
            for (const metric of dgCustomMetrics) {
                const byTx = await this.computeCustomMetricByTx(allTxIds, metric);
                for (const [name, txs] of txByDesigner) {
                    let sum = 0;
                    for (const txId of txs) sum += byTx.get(txId) ?? 0;
                    if (sum === 0 && metric.countMode !== 'NOTA') continue;
                    const rec = customByDesigner.get(name) ?? {};
                    rec[String(metric.id)] = Math.round(sum);
                    customByDesigner.set(name, rec);
                }
            }
        }

        // Union nama: designer dari production job + designer yang hanya punya SO
        const allNames = new Set<string>([...byDesigner.keys(), ...soByDesigner.keys(), ...soNotaByDesigner.keys()]);
        const ZERO: Stat = { assignment: 0, acc: 0, nungguAcc: 0, wip: 0, retur: 0, selesai: 0, batal: 0, express: 0, designSumMs: 0, designCount: 0 };
        const ZSO: SoStat = { invoiced: 0, omzet: 0, pcs: 0 };

        const leaderboard = Array.from(allNames)
            .map((name) => {
                const s = byDesigner.get(name) || ZERO;
                const so = soNotaByDesigner.get(name) || ZSO;
                const soCreated = soByDesigner.get(name) || 0;
                const denom = s.assignment - s.batal;
                return {
                    name,
                    customMetrics: customByDesigner.get(name) ?? {},
                    assignment: s.assignment,
                    acc: s.acc,
                    accRate: denom > 0 ? s.acc / denom : 0,
                    nungguAcc: s.nungguAcc,
                    wip: s.wip,
                    retur: s.retur,
                    selesai: s.selesai,
                    batal: s.batal,
                    express: s.express,
                    soCreated,
                    soInvoiced: so.invoiced,                                   // SO yang jadi nota
                    soConvRate: soCreated > 0 ? so.invoiced / soCreated : 0,   // rasio SO → nota
                    omzet: so.omzet,                                           // omzet dari SO yang jadi nota
                    // Bagian omzet nota utk desainer ini (nota dibagi per peran) → kolom leaderboard.
                    omzetShare: Math.round(designerShareByName.get(name) || 0),
                    pcs: so.pcs,
                    avgDesignHrs: s.designCount > 0 ? s.designSumMs / s.designCount / 3_600_000 : null,
                };
            })
            .sort((a, b) => b.omzet - a.omzet || b.acc - a.acc || b.soCreated - a.soCreated);

        const totals = leaderboard.reduce((t, r) => ({
            assignment: t.assignment + r.assignment,
            acc: t.acc + r.acc,
            nungguAcc: t.nungguAcc + r.nungguAcc,
            wip: t.wip + r.wip,
            retur: t.retur + r.retur,
            selesai: t.selesai + r.selesai,
            batal: t.batal + r.batal,
            express: t.express + r.express,
            soCreated: t.soCreated + r.soCreated,
            soInvoiced: t.soInvoiced + r.soInvoiced,
            omzet: t.omzet + r.omzet,
            pcs: t.pcs + r.pcs,
        }), { assignment: 0, acc: 0, nungguAcc: 0, wip: 0, retur: 0, selesai: 0, batal: 0, express: 0, soCreated: 0, soInvoiced: 0, omzet: 0, pcs: 0 });

        return {
            period: { start: start.toISOString(), end: end.toISOString() },
            customMetricDefs,
            leaderboard,
            totals,
        };
    }

    /**
     * INTI atribusi omzet. Untuk tiap nota (Transaction) di periode, kreditkan
     * grandTotal PENUH ke tiap peran yang HADIR pada nota itu — TIDAK dibagi
     * lintas peran (permintaan owner: pembagian 1/n bikin bingung). Jadi nota
     * 500rb → CS 500rb, desainer 500rb, operator 500rb (bukan ~167rb masing2).
     *   CS (pembuat lead) · desainer (pembuat SO) · operator (yang produksi).
     * Tiap bagian dikreditkan ke cabang HOME orang tsb (bukan cabang produksi).
     *   - CS       → User.branchId (assignedTo lead, fallback kasir walk-in).
     *   - desainer → Designer.branchId (fallback resolve SalesOrder.branchName).
     *   - operator → cabang PIN saat aksi (PrintJob.operatorBranchId /
     *                ProductionJobActivity.branchId, fallback cabang job).
     * PENGECUALIAN: antar operator pada nota yang sama TETAP dibagi bobot
     * keterlibatan (kerja sama 1/N dari coOperators/actorWeight) — 2 operator
     * di nota 500rb → 250rb/250rb.
     *
     * `team.omzet` (kolom Total Omzet cabang) dihitung TERPISAH memakai porsi
     * adil (grandTotal / jumlahPeran) supaya Σ omzet semua cabang = omzet nota
     * asli; kolom csShare/designerShare/operatorShare memakai kredit PENUH.
     * TIDAK di-scope cabang (board Tim membandingkan semua cabang; peta per-orang
     * di-lookup by id/nama oleh leaderboard peran masing-masing).
     */
    private async computeNotaSplits(params: KpiParams, opts?: { collectCsRowsFor?: number }): Promise<{
        team: Map<number | 'none', { csShare: number; designerShare: number; operatorShare: number; omzet: number }>;
        csShareByUser: Map<number, number>;
        designerShareByName: Map<string, number>;
        operatorShareByName: Map<string, number>;
        csRows: Array<{ txId: number; share: number }>;
    }> {
        const { start, end } = resolvePeriod(params);
        const empty = {
            team: new Map<number | 'none', { csShare: number; designerShare: number; operatorShare: number; omzet: number }>(),
            csShareByUser: new Map<number, number>(),
            designerShareByName: new Map<string, number>(),
            operatorShareByName: new Map<string, number>(),
            csRows: [] as Array<{ txId: number; share: number }>,
        };

        const txs: any[] = await (this.prisma as any).transaction.findMany({
            // Omzet papan = pendapatan LUNAS saja, diakui berdasarkan TANGGAL BAYAR
            // (paidAt) — bukan tanggal nota dibuat — agar cocok dgn "Penjualan Hari
            // Ini" dashboard yg berbasis cashflow nota PAID. Nota PENDING/PARTIAL
            // (belum lunas) TIDAK dihitung; FAILED juga otomatis tereksklusi.
            where: { paidAt: { gte: start, lte: end }, status: 'PAID' },
            select: {
                id: true, grandTotal: true, cashierName: true, branchId: true,
                salesOrder: { select: { designerName: true, branchName: true } },
            },
        });
        if (txs.length === 0) return empty;
        const txIds = txs.map(t => t.id);

        // ── CS per nota: lead.assignedToId (fallback kasir walk-in by nama) ──
        const leads: any[] = await this.lead.findMany({
            where: { convertedTransactionId: { in: txIds } },
            select: { convertedTransactionId: true, assignedToId: true },
        });
        const csUserByTx = new Map<number, number>();
        for (const l of leads) if (l.assignedToId) csUserByTx.set(Number(l.convertedTransactionId), l.assignedToId);

        const users: any[] = await this.prisma.user.findMany({ select: { id: true, name: true, branchId: true } });
        const userBranch = new Map<number, number | null>(users.map(u => [u.id, u.branchId ?? null]));
        const nameToUser = new Map<string, any>();
        for (const u of users) if (u.name) nameToUser.set(u.name.trim().toLowerCase(), u);

        // ── Cabang desainer: nama → Designer.branchId (fallback branchName SO) ──
        const designers: any[] = await (this.prisma as any).designer.findMany({ select: { name: true, branchId: true } });
        const designerBranchByName = new Map<string, number | null>();
        for (const d of designers) if (d.name) designerBranchByName.set(d.name.trim().toLowerCase(), d.branchId ?? null);
        const branches: any[] = await (this.prisma as any).companyBranch.findMany({
            where: { isActive: true }, select: { id: true, name: true, code: true },
        });

        // ── Operator per nota: printjob (done) + activity produksi (done) ──
        const printJobs: any[] = await (this.prisma as any).printJob.findMany({
            where: { transactionId: { in: txIds }, status: { in: ['SELESAI', 'DIAMBIL'] }, operatorName: { not: null } },
            select: { transactionId: true, operatorName: true, coOperators: true, operatorBranchId: true, branchId: true },
        });
        const prodJobs: any[] = await (this.prisma as any).productionJob.findMany({
            where: { transactionId: { in: txIds } },
            select: { id: true, transactionId: true, branchId: true },
        });
        const jobTx = new Map<number, number>(prodJobs.map(j => [j.id, j.transactionId]));
        const jobBranch = new Map<number, number | null>(prodJobs.map(j => [j.id, j.branchId ?? null]));
        const jobIds = prodJobs.map(j => j.id);
        const acts: any[] = jobIds.length ? await (this.prisma as any).productionJobActivity.findMany({
            where: {
                jobId: { in: jobIds }, action: 'STAGE_CHANGE', actorRole: 'OPERATOR',
                actorName: { not: null }, toStage: { in: ['KIRIM', 'SELESAI'] },
            },
            select: { jobId: true, actorName: true, actorWeight: true, branchId: true },
        }) : [];

        type OpAgg = { weight: number; branchId: number | null };
        const opByTx = new Map<number, Map<string, OpAgg>>();
        const addOp = (txId: number, name: string, w: number, branchId: number | null) => {
            if (!name) return;
            let m = opByTx.get(txId); if (!m) { m = new Map(); opByTx.set(txId, m); }
            const cur = m.get(name) || { weight: 0, branchId: null };
            cur.weight += w;
            if (cur.branchId == null && branchId != null) cur.branchId = branchId;
            m.set(name, cur);
        };
        for (const p of printJobs) {
            const primary = (p.operatorName || '').trim();
            const partners = (Array.isArray(p.coOperators) ? p.coOperators : [])
                .map((n: any) => String(n || '').trim()).filter((n: string) => n && n !== primary);
            const all = Array.from(new Set([primary, ...partners])).filter(Boolean);
            if (!all.length) continue;
            const w = 1 / all.length;
            const br = p.operatorBranchId ?? p.branchId ?? null;
            for (const name of all) addOp(p.transactionId, name as string, w, br);
        }
        // Produksi: bobot per (job,nama) ambil terbesar (konsisten operatorLeaderboard).
        const jobNameWeight = new Map<string, number>();
        const jobNameBranch = new Map<string, number | null>();
        for (const a of acts) {
            const name = (a.actorName || '').trim(); if (!name) continue;
            const key = `${a.jobId}|${name}`;
            jobNameWeight.set(key, Math.max(jobNameWeight.get(key) ?? 0, Number(a.actorWeight) || 1));
            const br = a.branchId ?? jobBranch.get(a.jobId) ?? null;
            if (jobNameBranch.get(key) == null && br != null) jobNameBranch.set(key, br);
        }
        for (const [key, w] of jobNameWeight) {
            const sep = key.indexOf('|');
            const jobId = Number(key.slice(0, sep));
            const name = key.slice(sep + 1);
            const txId = jobTx.get(jobId); if (!txId) continue;
            addOp(txId, name, w, jobNameBranch.get(key) ?? null);
        }

        // ── Split per nota ──
        const team = empty.team;
        const bump = (branchId: number | null, role: 'cs' | 'designer' | 'operator', v: number) => {
            const key: number | 'none' = branchId == null ? 'none' : branchId;
            const e = team.get(key) || { csShare: 0, designerShare: 0, operatorShare: 0, omzet: 0 };
            if (role === 'cs') e.csShare += v; else if (role === 'designer') e.designerShare += v; else e.operatorShare += v;
            team.set(key, e);
        };
        // Total Omzet cabang dihitung TERPISAH dari kolom "Bagian": pakai porsi ADIL
        // (grandTotal / jumlahPeran) agar Σ omzet semua cabang = omzet nota asli,
        // sementara bagian peran memakai kredit PENUH (tak dibagi lintas peran).
        const addOmzet = (branchId: number | null, v: number) => {
            const key: number | 'none' = branchId == null ? 'none' : branchId;
            const e = team.get(key) || { csShare: 0, designerShare: 0, operatorShare: 0, omzet: 0 };
            e.omzet += v;
            team.set(key, e);
        };
        const csShareByUser = empty.csShareByUser;
        const designerShareByName = empty.designerShareByName;
        const operatorShareByName = empty.operatorShareByName;
        const csRows = empty.csRows;

        for (const t of txs) {
            const gross = Number(t.grandTotal) || 0;
            if (gross <= 0) continue;

            let csUser: number | null = csUserByTx.get(t.id) ?? null;
            let csBranch: number | null = null;
            if (csUser != null) csBranch = userBranch.get(csUser) ?? null;
            else {
                const u = nameToUser.get((t.cashierName || '').trim().toLowerCase());
                if (u) { csUser = u.id; csBranch = u.branchId ?? null; }
            }
            const hasCs = csUser != null;

            const dName = (t.salesOrder?.designerName || '').trim();
            const hasDesigner = !!dName;
            let dBranch: number | null = null;
            if (hasDesigner) {
                dBranch = designerBranchByName.get(dName.toLowerCase()) ?? null;
                if (dBranch == null) dBranch = matchBranchId(t.salesOrder?.branchName, branches);
            }

            const opMap = opByTx.get(t.id);
            const hasOperator = !!opMap && opMap.size > 0;

            const rolesCount = (hasCs ? 1 : 0) + (hasDesigner ? 1 : 0) + (hasOperator ? 1 : 0);
            if (rolesCount === 0) continue; // nota tak bisa diatribusikan ke siapa pun
            // Kredit PENUH per peran: omzet TIDAK dibagi lintas peran (CS = desainer
            // = operator = grandTotal penuh). `realShare` = porsi adil, HANYA dipakai
            // untuk kolom Total Omzet cabang agar totalnya = omzet nota asli.
            const fullShare = gross;
            const realShare = gross / rolesCount;

            if (hasCs) {
                csShareByUser.set(csUser!, (csShareByUser.get(csUser!) || 0) + fullShare);
                bump(csBranch, 'cs', fullShare);
                addOmzet(csBranch, realShare);
                if (opts?.collectCsRowsFor != null && csUser === opts.collectCsRowsFor) {
                    csRows.push({ txId: t.id, share: fullShare });
                }
            }
            if (hasDesigner) {
                designerShareByName.set(dName, (designerShareByName.get(dName) || 0) + fullShare);
                bump(dBranch, 'designer', fullShare);
                addOmzet(dBranch, realShare);
            }
            if (hasOperator) {
                const totalW = Array.from(opMap!.values()).reduce((s, o) => s + o.weight, 0) || 1;
                for (const [name, agg] of opMap!) {
                    const w = agg.weight / totalW;
                    // Antar operator TETAP dibagi bobot (kerja sama): 500rb + 2 op = 250/250.
                    operatorShareByName.set(name, (operatorShareByName.get(name) || 0) + fullShare * w);
                    bump(agg.branchId, 'operator', fullShare * w);
                    addOmzet(agg.branchId, realShare * w);
                }
            }
        }

        return { team, csShareByUser, designerShareByName, operatorShareByName, csRows };
    }

    /**
     * Leaderboard TIM/cabang — omzet nota dibagi per peran lalu dijumlah per
     * cabang HOME anggota. Selalu tampilkan SEMUA cabang (perbandingan antar tim);
     * baris 'Tak diketahui' = bagian yang cabang orangnya belum ter-set (data lama).
     */
    async teamLeaderboard(ctx: BranchContext, params: KpiParams) {
        const { start, end } = resolvePeriod(params);
        const { team } = await this.computeNotaSplits(params);
        const branches: any[] = await (this.prisma as any).companyBranch.findMany({
            select: { id: true, name: true, code: true },
        });
        const bMap = new Map<number, any>(branches.map(b => [b.id, b]));
        const r0 = (v: number) => Math.round(v);
        // Scope: cabang spesifik (staf non-owner / owner filter) → hanya cabangnya.
        // ctx.branchId null (owner "Semua Cabang") → semua cabang (perbandingan tim).
        const entries = ctx.branchId != null
            ? Array.from(team.entries()).filter(([key]) => key === ctx.branchId)
            : Array.from(team.entries());
        const rows = entries.map(([key, v]) => {
            const b = typeof key === 'number' ? bMap.get(key) : null;
            return {
                branchId: typeof key === 'number' ? key : null,
                name: b ? (b.code ? `[${b.code}] ${b.name}` : b.name) : 'Tak diketahui',
                csShare: r0(v.csShare),
                designerShare: r0(v.designerShare),
                operatorShare: r0(v.operatorShare),
                omzet: r0(v.omzet),
            };
        }).sort((a, b) => b.omzet - a.omzet);
        const totals = rows.reduce((t, r) => ({
            csShare: t.csShare + r.csShare,
            designerShare: t.designerShare + r.designerShare,
            operatorShare: t.operatorShare + r.operatorShare,
            omzet: t.omzet + r.omzet,
        }), { csShare: 0, designerShare: 0, operatorShare: 0, omzet: 0 });
        return { period: { start: start.toISOString(), end: end.toISOString() }, leaderboard: rows, totals };
    }

    /**
     * Omzet per cabang KHUSUS papan TV — diambil LANGSUNG dari cashflow auto-income
     * (userId null, type INCOME), sumber & query yang SAMA PERSIS dgn "Penjualan
     * Hari Ini" dashboard halaman utama. Sengaja TIDAK memakai atribusi per peran
     * (grandTotal dibagi CS/desainer/operator) — itu hanya untuk halaman web
     * /leaderboard. Tujuan: angka omzet TV === angka pendapatan dashboard.
     */
    private async teamOmzetCashflow(ctx: BranchContext, params: KpiParams) {
        const { start, end } = resolvePeriod(params);
        const bid = ctx.branchId != null ? Number(ctx.branchId) : null;
        const rowsAgg: { branchId: number | null; _sum: { amount: any } }[] =
            await (this.prisma as any).cashflow.groupBy({
                by: ['branchId'],
                where: {
                    createdAt: { gte: start, lte: end },
                    type: 'INCOME',
                    userId: null, // auto-entry sistem saat nota PAID = uang masuk nyata
                    ...(bid != null ? { branchId: bid } : {}),
                },
                _sum: { amount: true },
            });
        const branches: any[] = await (this.prisma as any).companyBranch.findMany({
            select: { id: true, name: true, code: true },
        });
        const bMap = new Map<number, any>(branches.map(b => [b.id, b]));
        const rows = rowsAgg.map((r) => {
            const b = r.branchId != null ? bMap.get(r.branchId) : null;
            return {
                branchId: r.branchId ?? null,
                name: b ? (b.code ? `[${b.code}] ${b.name}` : b.name) : 'Tak diketahui',
                csShare: 0, designerShare: 0, operatorShare: 0,
                omzet: Math.round(Number(r._sum.amount || 0)),
            };
        }).sort((a, b) => b.omzet - a.omzet);
        const totals = rows.reduce((t, r) => ({ ...t, omzet: t.omzet + r.omzet }),
            { csShare: 0, designerShare: 0, operatorShare: 0, omzet: 0 });
        return { period: { start: start.toISOString(), end: end.toISOString() }, leaderboard: rows, totals };
    }

    // ── Helper bucket (dipakai csTrend & designerTrend) ─────────────────────
    private buildBuckets(start: Date, end: Date) {
        const rangeDays = Math.ceil((end.getTime() - start.getTime()) / 86_400_000);
        const bucketBy: 'day' | 'week' = rangeDays > 31 ? 'week' : 'day';
        const bucketStart = (d: Date) => (bucketBy === 'week' ? startOfWeekMon(d) : startOfDay(d));
        const buckets: { key: string; label: string }[] = [];
        let cursor = bucketStart(start);
        while (cursor.getTime() <= end.getTime()) {
            buckets.push({ key: ymd(cursor), label: labelDdMmm(cursor) });
            const n = new Date(cursor);
            n.setDate(n.getDate() + (bucketBy === 'week' ? 7 : 1));
            cursor = n;
        }
        return { bucketBy, bucketStart, buckets };
    }

    // Pivot: metricKey → bucketKey → person → value  ==> flat rows per metric
    private pivotTrend(
        buckets: { key: string; label: string }[],
        persons: string[],
        acc: Record<string, Map<string, Map<string, number>>>,
        metricKeys: string[],
    ) {
        const out: Record<string, any[]> = {};
        for (const m of metricKeys) {
            out[m] = buckets.map(({ key, label }) => {
                const row: any = { bucket: key, label };
                for (const p of persons) row[p] = 0;
                const mp = acc[m]?.get(key);
                if (mp) for (const [p, v] of mp.entries()) row[p] = v;
                return row;
            });
        }
        return out;
    }

    // ── Tren CS (time-series per CS untuk modal grafik leaderboard) ─────────
    async csTrend(ctx: BranchContext, params: KpiParams) {
        const { start, end } = resolvePeriod(params);
        const branchScope: any = branchWhere(ctx);
        const { bucketBy, bucketStart, buckets } = this.buildBuckets(start, end);

        const leads: any[] = await this.lead.findMany({
            where: { ...branchScope, createdAt: { gte: start, lte: end }, assignedToId: { not: null } },
            select: { createdAt: true, status: true, estimatedValue: true, convertedTransactionId: true, assignedToId: true },
        });

        const userIds = Array.from(new Set(leads.map(l => l.assignedToId)));
        const users: any[] = userIds.length === 0 ? [] : await this.prisma.user.findMany({
            where: { id: { in: userIds } }, select: { id: true, name: true, email: true },
        });
        const nameOf = new Map(users.map(u => [u.id, u.name || u.email || `User #${u.id}`]));

        const wonTxIds = leads.filter(l => l.status === 'CLOSED_WON' && l.convertedTransactionId).map(l => Number(l.convertedTransactionId));
        const txPcsMap = await this.computeTxPcsMap(wonTxIds);
        // Nilai nota asli per tx (untuk wonValue, konsisten dgn leaderboard CS)
        const txGrossMap = new Map<number, number>();
        if (wonTxIds.length > 0) {
            const grossTxs: any[] = await this.tx.findMany({
                where: { id: { in: wonTxIds } },
                select: { id: true, grandTotal: true, status: true } as any,
            });
            for (const t of grossTxs) {
                if (t.status !== 'FAILED' && t.status !== 'CANCELLED') txGrossMap.set(t.id, Number(t.grandTotal) || 0);
            }
        }

        const SUM_METRICS = ['leads', 'closing', 'pcs', 'lost', 'invalid', 'wonValue', 'lostValue'];
        const acc: Record<string, Map<string, Map<string, number>>> = {};
        for (const m of SUM_METRICS) acc[m] = new Map();
        const personTotals = new Map<string, number>();

        const add = (m: string, bk: string, person: string, v: number) => {
            if (!acc[m].has(bk)) acc[m].set(bk, new Map());
            const mp = acc[m].get(bk)!;
            mp.set(person, (mp.get(person) || 0) + v);
        };

        for (const l of leads) {
            const person = nameOf.get(l.assignedToId);
            if (!person) continue;
            const bk = ymd(bucketStart(new Date(l.createdAt)));
            add('leads', bk, person, 1);
            personTotals.set(person, (personTotals.get(person) || 0) + 1);
            if (l.status === 'CLOSED_WON') {
                add('closing', bk, person, 1);
                const txId = l.convertedTransactionId ? Number(l.convertedTransactionId) : null;
                const gross = txId != null && txGrossMap.has(txId) ? txGrossMap.get(txId)! : (Number(l.estimatedValue) || 0);
                add('wonValue', bk, person, gross);
                if (txId != null) add('pcs', bk, person, txPcsMap.get(txId) ?? 0);
            } else if (l.status === 'CLOSED_LOST') {
                add('lost', bk, person, 1);
                add('lostValue', bk, person, Number(l.estimatedValue) || 0);
            } else if (l.status === 'INVALID') {
                add('invalid', bk, person, 1);
            }
        }

        const persons = Array.from(personTotals.entries()).sort((a, b) => b[1] - a[1]).map(([n]) => n);
        const metrics = this.pivotTrend(buckets, persons, acc, SUM_METRICS);
        // closingRate (%) per bucket per person = closing / leads
        metrics['closingRate'] = buckets.map(({ key, label }) => {
            const row: any = { bucket: key, label };
            const lm = acc['leads'].get(key);
            const cm = acc['closing'].get(key);
            for (const p of persons) {
                const lc = lm?.get(p) || 0;
                const cc = cm?.get(p) || 0;
                row[p] = lc > 0 ? Math.round((cc / lc) * 1000) / 10 : 0;
            }
            return row;
        });

        return { period: { start: start.toISOString(), end: end.toISOString() }, bucketBy, persons, metrics };
    }

    // ── Tren Designer (time-series per designer untuk modal grafik) ─────────
    async designerTrend(ctx: BranchContext, params: KpiParams) {
        const { start, end } = resolvePeriod(params);
        const branchScope: any = branchWhere(ctx);
        const { bucketBy, bucketStart, buckets } = this.buildBuckets(start, end);

        const FORWARD = new Set(['PRINT', 'ANTRIAN_PRESS', 'JAHIT', 'QC_PACKING', 'KIRIM', 'SELESAI']);
        const DONE = new Set(['KIRIM', 'SELESAI']);

        const jobs: any[] = await (this.prisma as any).productionJob.findMany({
            where: { ...branchScope, createdAt: { gte: start, lte: end }, designerName: { not: null } },
            select: { designerName: true, pipelineStage: true, cancelledAt: true, isExpress: true, createdAt: true },
        });

        const SUM_METRICS = ['assignment', 'soCreated', 'acc', 'nungguAcc', 'wip', 'retur', 'selesai', 'batal', 'express'];
        const acc: Record<string, Map<string, Map<string, number>>> = {};
        for (const m of SUM_METRICS) acc[m] = new Map();
        const personTotals = new Map<string, number>();

        const add = (m: string, bk: string, person: string, v: number) => {
            if (!acc[m].has(bk)) acc[m].set(bk, new Map());
            const mp = acc[m].get(bk)!;
            mp.set(person, (mp.get(person) || 0) + v);
        };

        for (const j of jobs) {
            const person = (j.designerName || '').trim();
            if (!person) continue;
            const bk = ymd(bucketStart(new Date(j.createdAt)));
            add('assignment', bk, person, 1);
            personTotals.set(person, (personTotals.get(person) || 0) + 1);
            if (j.cancelledAt) {
                add('batal', bk, person, 1);
            } else {
                const stage = j.pipelineStage || 'DESIGN';
                if (stage === 'DESIGN') add('wip', bk, person, 1);
                else if (stage === 'ACC') add('nungguAcc', bk, person, 1);
                else if (stage === 'RETUR') add('retur', bk, person, 1);
                else if (FORWARD.has(stage)) add('acc', bk, person, 1);
                if (DONE.has(stage)) add('selesai', bk, person, 1);
            }
            if (j.isExpress) add('express', bk, person, 1);
        }

        // SO Dibuat per bucket (kecuali CANCELLED) — scope cabang via branchName
        const soBranches = await this.soBranchNames(ctx);
        const sosRaw: any[] = await (this.prisma as any).salesOrder.findMany({
            where: { createdAt: { gte: start, lte: end }, status: { not: 'CANCELLED' } },
            select: { designerName: true, createdAt: true, branchName: true },
        });
        const sos = sosRaw.filter(so => this.soMatchesBranch(so.branchName, soBranches));
        for (const so of sos) {
            const person = (so.designerName || '').trim();
            if (!person) continue;
            const bk = ymd(bucketStart(new Date(so.createdAt)));
            add('soCreated', bk, person, 1);
            if (!personTotals.has(person)) personTotals.set(person, 0);
        }

        const persons = Array.from(personTotals.entries()).sort((a, b) => b[1] - a[1]).map(([n]) => n);
        const metrics = this.pivotTrend(buckets, persons, acc, SUM_METRICS);
        return { period: { start: start.toISOString(), end: end.toISOString() }, bucketBy, persons, metrics };
    }

    private async _report(ctx: BranchContext, params: KpiParams, csId?: number) {
        const { start, end } = resolvePeriod(params);
        const branchScope: any = branchWhere(ctx);
        // Filter staff (CS): batasi lead & FU ke assignedToId tsb; walk-in
        // dibatasi ke transaksi yang ditangani user tsb (match cashierName).
        const csScope: any = csId ? { assignedToId: csId } : {};
        // Bagian omzet CS (nota dibagi per peran) — kolom "omzet (bagian)".
        const { csShareByUser } = await this.computeNotaSplits(params);
        // Metrik balas WhatsApp per CS (atribusi WaMessage.sentById) — kolom WA leaderboard.
        const waMetrics = await this.waAnalytics.waCsMetricsByUser(start, end);

        // ── Response time avg ──────────────────────────────────────────────
        // Ambil leads in period + first non-FIRST_CONTACT activity per lead.
        // Tanpa `distinct` (kadang flaky di MySQL pakai Prisma) — kita pakai
        // sort + ambil first di JS.
        const leadsInPeriod: any[] = await this.lead.findMany({
            where: { ...branchScope, ...csScope, createdAt: { gte: start, lte: end } },
            select: { id: true, createdAt: true, status: true, source: true, sourceDetail: true, assignedToId: true, estimatedValue: true, convertedTransactionId: true, designerName: true, designVerdict: true } as any,
        });
        const leadIds = leadsInPeriod.map(l => l.id);
        const allActivities: any[] = leadIds.length === 0 ? [] : await this.activity.findMany({
            where: {
                leadId: { in: leadIds },
                kind: { notIn: ['FIRST_CONTACT'] },
            },
            orderBy: { createdAt: 'asc' },
            select: { leadId: true, createdAt: true },
        });
        const firstActMap = new Map<number, Date>();
        for (const a of allActivities) {
            if (a.leadId == null) continue;
            if (!firstActMap.has(a.leadId)) firstActMap.set(a.leadId, a.createdAt);
        }

        let respSum = 0, respCount = 0;
        for (const l of leadsInPeriod) {
            const first = firstActMap.get(l.id);
            if (!first) continue;
            const diffMs = new Date(first).getTime() - new Date(l.createdAt).getTime();
            if (diffMs > 0) { respSum += diffMs; respCount++; }
        }
        const responseTimeAvgMs = respCount > 0 ? respSum / respCount : 0;
        const responseTimeAvgHrs = responseTimeAvgMs / (1000 * 60 * 60);

        // ── Closing rate & nilai lead ──────────────────────────────────────
        const totalLeads = leadsInPeriod.length;
        const closedWon = leadsInPeriod.filter(l => l.status === 'CLOSED_WON').length;
        const closedLost = leadsInPeriod.filter(l => l.status === 'CLOSED_LOST').length;
        const totalInvalid = leadsInPeriod.filter(l => l.status === 'INVALID').length;
        const closingRate = totalLeads > 0 ? closedWon / totalLeads : 0;

        // Nilai estimasi yang lost & yang won (berdasarkan estimatedValue lead)
        const lostValue = leadsInPeriod
            .filter(l => l.status === 'CLOSED_LOST')
            .reduce((s, l) => s + (Number(l.estimatedValue) || 0), 0);
        // wonValue (agregat) dihitung setelah txGrossMap siap — pakai nilai nota asli.

        // ── Nilai akan datang (saldo outstanding dari tx PENDING/PARTIAL) ──
        // Lead CLOSED_WON yang punya convertedTransactionId → cek status tx-nya.
        // PENDING  : grandTotal full belum dibayar (COD / bayar nanti)
        // PARTIAL  : ada DP, sisanya (grandTotal - downPayment) masih piutang
        // PAID     : lunas → tidak masuk hitungan pending
        const convertedTxIds = leadsInPeriod
            .filter(l => l.status === 'CLOSED_WON' && l.convertedTransactionId)
            .map(l => Number(l.convertedTransactionId));

        const txPendingMap = new Map<number, number>(); // txId → saldo outstanding
        if (convertedTxIds.length > 0) {
            const txs: any[] = await this.tx.findMany({
                where: { id: { in: convertedTxIds }, status: { in: ['PENDING', 'PARTIAL'] } },
                select: { id: true, grandTotal: true, downPayment: true, status: true },
            });
            for (const t of txs) {
                const outstanding = Number(t.grandTotal) - Number(t.downPayment);
                txPendingMap.set(t.id, Math.max(0, outstanding));
            }
        }

        // Total pcs (jumlah barang) per transaksi — sumber tracking jumlah orderan
        // (jersey maupun produk lain). Item kategori "Additional" dikecualikan.
        const txPcsMap = await this.computeTxPcsMap(convertedTxIds); // txId → total pcs

        // Fee platform + NILAI NOTA ASLI per transaksi hasil convert. Cuan CS dihitung
        // dari grandTotal nota (dikurangi fee) — bukan estimatedValue lead — supaya
        // konsisten dengan pcs & walk-in yang juga pakai nilai asli. Lead closing
        // TANPA nota tetap pakai estimatedValue (lihat loop leaderboard).
        const txFeeMap = new Map<number, number>();
        const txGrossMap = new Map<number, number>(); // txId → grandTotal nota asli
        if (convertedTxIds.length > 0) {
            const feeTxs: any[] = await this.tx.findMany({
                where: { id: { in: convertedTxIds } },
                select: { id: true, marketplaceFee: true, grandTotal: true, status: true } as any,
            });
            for (const t of feeTxs) {
                txFeeMap.set(t.id, Number((t as any).marketplaceFee) || 0);
                // Nota gagal/batal tidak dipakai → fallback ke estimatedValue
                if (t.status !== 'FAILED' && t.status !== 'CANCELLED') {
                    txGrossMap.set(t.id, Number((t as any).grandTotal) || 0);
                }
            }
        }

        // Peta lead → saldo pending (0 kalau sudah lunas / tidak punya tx)
        const leadPendingMap = new Map<number, number>();
        for (const l of leadsInPeriod) {
            if (l.status !== 'CLOSED_WON' || !l.convertedTransactionId) continue;
            const pending = txPendingMap.get(Number(l.convertedTransactionId)) ?? 0;
            leadPendingMap.set(l.id, pending);
        }
        const totalPendingValue = Array.from(leadPendingMap.values()).reduce((s, v) => s + v, 0);

        // Agregat won value (GROSS, tanpa potong fee) — pakai nilai nota asli bila ada
        // nota, fallback estimatedValue untuk closing tanpa nota.
        const wonValue = leadsInPeriod
            .filter(l => l.status === 'CLOSED_WON')
            .reduce((s, l) => {
                const txId = l.convertedTransactionId ? Number(l.convertedTransactionId) : null;
                const gross = txId != null && txGrossMap.has(txId)
                    ? txGrossMap.get(txId)!
                    : (Number(l.estimatedValue) || 0);
                return s + gross;
            }, 0);

        // ── FU compliance ──────────────────────────────────────────────────
        // FU due in period: total = pending+done+skipped that dueDate in period.
        // compliance = done where doneAt <= dueDate + 1 day / total
        const fusInPeriod: any[] = await this.fu.findMany({
            where: { ...branchScope, ...csScope, dueDate: { gte: start, lte: end } },
            select: { id: true, status: true, dueDate: true, doneAt: true },
        });
        const totalFu = fusInPeriod.length;
        const compliant = fusInPeriod.filter(f => {
            if (f.status !== 'DONE' || !f.doneAt) return false;
            const grace = new Date(f.dueDate);
            grace.setDate(grace.getDate() + 1);
            return new Date(f.doneAt).getTime() <= grace.getTime();
        }).length;
        const fuComplianceRate = totalFu > 0 ? compliant / totalFu : 0;

        // ── Repeat order rate ──────────────────────────────────────────────
        // Customer dengan >=2 transaksi dalam periode / customer dengan >=1.
        // CATATAN: tabel transactions TIDAK punya customer_id — nama & HP customer
        // disimpan sebagai teks. Jadi identitas customer dikenali dari HP yang
        // dinormalisasi (buang non-digit, drop awalan 62/0); kalau HP kosong,
        // fallback ke nama. Transaksi tanpa identitas (mis. tunai walk-in tanpa
        // nama/HP) diabaikan — tidak bisa diatribusikan sebagai repeat.
        let customersWithOrder = 0;
        let customersRepeat = 0;
        try {
            const txRows: any[] = await this.tx.findMany({
                where: {
                    createdAt: { gte: start, lte: end },
                    ...(ctx.branchId != null ? { branchId: Number(ctx.branchId) } : {}),
                },
                select: { customerPhone: true, customerName: true },
            });
            const counts = new Map<string, number>();
            for (const t of txRows) {
                let phone = String(t.customerPhone || '').replace(/\D/g, '');
                if (phone.startsWith('62')) phone = phone.slice(2);
                if (phone.startsWith('0')) phone = phone.slice(1);
                const name = String(t.customerName || '').trim().toLowerCase();
                const key = phone.length >= 5 ? `p:${phone}` : (name ? `n:${name}` : '');
                if (!key) continue;
                counts.set(key, (counts.get(key) || 0) + 1);
            }
            customersWithOrder = counts.size;
            customersRepeat = Array.from(counts.values()).filter((c) => c >= 2).length;
        } catch (e) {
            // fallback ke 0 supaya endpoint tidak crash kalau skema beda
            // eslint-disable-next-line no-console
            console.warn('[kpi] repeat-order calc fallback:', (e as Error).message);
        }
        const repeatOrderRate = customersWithOrder > 0 ? customersRepeat / customersWithOrder : 0;

        // ── Leads by source ───────────────────────────────────────────────
        // Untuk sumber CUSTOM, gunakan sourceDetail sebagai key supaya
        // setiap nama custom tampil terpisah di chart (bukan semua digabung jadi "Custom").
        const bySourceMap: Record<string, number> = {};
        for (const l of leadsInPeriod) {
            const key = l.source === 'CUSTOM' && l.sourceDetail
                ? l.sourceDetail
                : l.source;
            bySourceMap[key] = (bySourceMap[key] || 0) + 1;
        }
        const leadsBySource = Object.entries(bySourceMap).map(([source, count]) => ({ source, count }));

        // ── Leaderboard CS ────────────────────────────────────────────────
        // Skor CS digabung dari 2 sumber:
        //  1. LEAD       — group by assignedToId (closing/lost/invalid + pcs/omzet hasil convert).
        //  2. POS walk-in — transaksi POS yang ditangani CS (cashierName == user.name) DAN
        //     TIDAK berasal dari lead (semua convertedTransactionId lead dikecualikan, anti
        //     dobel-hitung). Transaction tak punya FK user → cocokkan by-name (POS "Kasir/Staff"
        //     adalah dropdown nama user, jadi pencocokan andal).
        type CsStat = {
            leadsHandled: number; dealsClosed: number; dealsLost: number; invalidLeads: number;
            pcsOrdered: number; wonValue: number; lostValue: number; pendingValue: number;
            walkinTx: number; walkinPcs: number; walkinValue: number;
            respSum: number; respCount: number;
            notasShipped: number;
            notasInTransit: number; notasDelivered: number;
            pcsShipped: number; pcsInTransit: number; pcsDelivered: number;
        };
        const zeroStat = (): CsStat => ({
            leadsHandled: 0, dealsClosed: 0, dealsLost: 0, invalidLeads: 0,
            pcsOrdered: 0, wonValue: 0, lostValue: 0, pendingValue: 0,
            walkinTx: 0, walkinPcs: 0, walkinValue: 0, respSum: 0, respCount: 0,
            notasShipped: 0, notasInTransit: 0, notasDelivered: 0,
            pcsShipped: 0, pcsInTransit: 0, pcsDelivered: 0,
        });
        const byAssignee = new Map<number, CsStat>();
        // txId yang jadi milik tiap CS (won-converted + walk-in) → utk metrik produk custom.
        const txByUser = new Map<number, Set<number>>();
        const addTxToUser = (uid: number, txId: number | null | undefined) => {
            if (!uid || txId == null || !Number.isFinite(Number(txId))) return;
            const set = txByUser.get(uid) ?? new Set<number>();
            set.add(Number(txId));
            txByUser.set(uid, set);
        };
        for (const l of leadsInPeriod) {
            if (!l.assignedToId) continue;
            const entry = byAssignee.get(l.assignedToId) || zeroStat();
            entry.leadsHandled++;
            if (l.status === 'CLOSED_WON') {
                entry.dealsClosed++;
                // Pendapatan bersih: pakai NILAI NOTA ASLI (grandTotal) bila ada nota,
                // kalau tidak (closing langsung tanpa nota) pakai estimatedValue.
                // Lalu dikurangi biaya platform (fee marketplace).
                const txId = l.convertedTransactionId ? Number(l.convertedTransactionId) : null;
                const gross = txId != null && txGrossMap.has(txId)
                    ? txGrossMap.get(txId)!
                    : (Number(l.estimatedValue) || 0);
                const wonFee = txId != null ? (txFeeMap.get(txId) || 0) : 0;
                entry.wonValue += Math.max(0, gross - wonFee);
                entry.pendingValue += leadPendingMap.get(l.id) ?? 0;
                if (txId != null) {
                    entry.pcsOrdered += txPcsMap.get(txId) ?? 0;
                    addTxToUser(l.assignedToId, txId);
                }
            }
            if (l.status === 'CLOSED_LOST') {
                entry.dealsLost++;
                entry.lostValue += Number(l.estimatedValue) || 0;
            }
            if (l.status === 'INVALID') {
                entry.invalidLeads++;
            }
            const first = firstActMap.get(l.id);
            if (first) {
                const diff = new Date(first).getTime() - new Date(l.createdAt).getTime();
                if (diff > 0) { entry.respSum += diff; entry.respCount++; }
            }
            byAssignee.set(l.assignedToId, entry);
        }

        // ── Kontribusi POS walk-in (non-lead) ──────────────────────────────
        // Set tx yang berasal dari lead (semua periode, scope cabang) → dikecualikan.
        const leadTxIds: number[] = (await this.lead.findMany({
            where: { ...branchScope, convertedTransactionId: { not: null } },
            select: { convertedTransactionId: true },
        })).map((l: any) => Number(l.convertedTransactionId));
        const leadTxSet = new Set<number>(leadTxIds);

        const walkinTxsRaw: any[] = await this.tx.findMany({
            where: {
                ...branchScope,
                status: { not: 'FAILED' },
                createdAt: { gte: start, lte: end },
                cashierName: { not: null },
            },
            select: { id: true, cashierName: true, grandTotal: true, downPayment: true, status: true, marketplaceFee: true } as any,
        });
        const walkinTxs = walkinTxsRaw.filter(t => !leadTxSet.has(t.id) && (t.cashierName || '').trim());

        // pcs per transaksi walk-in (jumlah quantity item, tanpa kategori "Additional")
        const walkinPcsMap = await this.computeTxPcsMap(walkinTxs.map(t => t.id));

        // Semua user — untuk match cashierName→userId & resolve nama leaderboard
        // (CS yang hanya punya walk-in tanpa lead tetap muncul di leaderboard).
        const allUsers: any[] = await this.prisma.user.findMany({
            select: { id: true, name: true, email: true, branchId: true, role: { select: { name: true } } },
        });
        const userMap = new Map(allUsers.map(u => [u.id, u]));
        const nameToUser = new Map<string, any>();
        for (const u of allUsers) {
            if (u.name) nameToUser.set(u.name.trim().toLowerCase(), u);
        }

        for (const t of walkinTxs) {
            const u = nameToUser.get((t.cashierName || '').trim().toLowerCase());
            if (!u) continue; // cashierName tak cocok user mana pun → abaikan
            if (csId && u.id !== csId) continue; // filter staff aktif → hanya CS tsb
            const entry = byAssignee.get(u.id) || zeroStat();
            entry.walkinTx++;
            entry.walkinPcs += walkinPcsMap.get(t.id) ?? 0;
            addTxToUser(u.id, t.id);
            // Pendapatan bersih: harga jual dikurangi biaya platform.
            entry.walkinValue += Math.max(0, (Number(t.grandTotal) || 0) - (Number((t as any).marketplaceFee) || 0));
            // Sisa piutang tx PENDING/PARTIAL → Nilai Akan Datang (gabung dgn pending lead)
            if (t.status === 'PENDING' || t.status === 'PARTIAL') {
                entry.pendingValue += Math.max(0, Number(t.grandTotal) - Number(t.downPayment));
            }
            byAssignee.set(u.id, entry);
        }

        // ── Kontribusi pengiriman (pipeline KIRIM) → target CS ─────────────
        // Nota yang job produksinya mencapai tahap KIRIM (shippedAt terisi)
        // dalam periode = "pesanan berhasil terkirim". Dihitung PER NOTA
        // (distinct transactionId) — satu nota bisa punya banyak job, tapi
        // keberhasilan kirim dihitung sekali. Atribusi ke CS:
        //   1. Nota dari lead  → Lead.assignedToId
        //   2. Nota walk-in    → Transaction.cashierName == User.name
        // returnedAt: null → nota yang di-RETUR setelah kirim DIKECUALIKAN.
        //
        // Pecah per stage SEKARANG (pakai pipelineStage): job masih di KIRIM =
        // "sedang dikirim", job sudah di SELESAI = "sudah terkirim". Per nota:
        // dianggap SUDAH terkirim hanya jika SEMUA job shipped-nya berstatus
        // SELESAI; kalau masih ada yang di KIRIM → nota itu "sedang dikirim".
        // Jumlah PCS yang dikirim dihitung PER JOB (tiap job = 1 TransactionItem).
        // Basis waktu = shippedAt job (bukan tgl nota/lead), jadi nota Juni yang baru
        // dikirim Juli masuk hitungan Juli. pcs pakai `quantity` item & konsisten dgn
        // computeTxPcsMap: item kategori add-on (countsAsPcs=false) TIDAK dihitung.
        const shippedJobs: any[] = await (this.prisma as any).productionJob.findMany({
            where: { ...branchScope, shippedAt: { gte: start, lte: end }, returnedAt: null },
            select: {
                transactionId: true, pipelineStage: true,
                transactionItem: {
                    select: {
                        quantity: true, pcs: true,
                        productVariant: { select: { product: { select: { category: { select: { countsAsPcs: true } } } } } },
                    },
                },
            },
        });
        const stagesByTx = new Map<number, string[]>();
        // pcs kirim per nota, dipecah stage saat ini (SELESAI=terkirim, selain itu=sedang dikirim).
        const pcsByTx = new Map<number, { inTransit: number; delivered: number }>();
        for (const j of shippedJobs) {
            const txId = Number(j.transactionId);
            if (!Number.isFinite(txId)) continue;
            const stage = j.pipelineStage || 'KIRIM';
            const arr = stagesByTx.get(txId) ?? [];
            arr.push(stage);
            stagesByTx.set(txId, arr);

            // Item add-on (kerah/lengan/rib — countsAsPcs=false) bukan barang terpisah → 0 pcs.
            const isAddon = j.transactionItem?.productVariant?.product?.category?.countsAsPcs === false;
            // Jumlah fisik = quantity × pcs. Item AREA_BASED (banner) disimpan quantity=1,
            // pcs=jumlah kopi → tanpa ×pcs, banner 9 kopi salah terhitung 1. UNIT: pcs=1 (tak berubah).
            const itemQty = (Number(j.transactionItem?.quantity) || 0) * (Number(j.transactionItem?.pcs) || 1);
            const qty = isAddon ? 0 : itemQty;
            const p = pcsByTx.get(txId) ?? { inTransit: 0, delivered: 0 };
            if (stage === 'SELESAI') p.delivered += qty;
            else p.inTransit += qty;
            pcsByTx.set(txId, p);
        }
        const shippedTxIds = Array.from(stagesByTx.keys());
        if (shippedTxIds.length > 0) {
            // txId → CS: lead.assignedToId (utama), fallback cashierName walk-in.
            const shippedLeads: any[] = await this.lead.findMany({
                where: { convertedTransactionId: { in: shippedTxIds } },
                select: { convertedTransactionId: true, assignedToId: true },
            });
            const csByShippedTx = new Map<number, number>();
            for (const l of shippedLeads) {
                if (l.assignedToId) csByShippedTx.set(Number(l.convertedTransactionId), l.assignedToId);
            }
            // Fallback walk-in: nota shipped tanpa lead → cocokkan cashierName.
            const missing = shippedTxIds.filter(id => !csByShippedTx.has(id));
            if (missing.length > 0) {
                const shippedTxs: any[] = await this.tx.findMany({
                    where: { id: { in: missing } },
                    select: { id: true, cashierName: true },
                });
                for (const t of shippedTxs) {
                    const u = nameToUser.get((t.cashierName || '').trim().toLowerCase());
                    if (u) csByShippedTx.set(Number(t.id), u.id);
                }
            }
            for (const [txId, uid] of csByShippedTx) {
                if (csId && uid !== csId) continue; // hormati filter staff aktif
                const entry = byAssignee.get(uid) || zeroStat();
                entry.notasShipped++;
                const stages = stagesByTx.get(txId) ?? [];
                const delivered = stages.length > 0 && stages.every(s => s === 'SELESAI');
                if (delivered) entry.notasDelivered++;
                else entry.notasInTransit++;
                // pcs dikirim (per item, basis shippedAt) → atribusi ke CS yang sama.
                const p = pcsByTx.get(txId) ?? { inTransit: 0, delivered: 0 };
                entry.pcsInTransit += p.inTransit;
                entry.pcsDelivered += p.delivered;
                entry.pcsShipped += p.inTransit + p.delivered;
                byAssignee.set(uid, entry);
            }
        }

        // ── Metrik produk custom (owner-defined) per CS ────────────────────
        const csCustomMetrics = await this.getActiveCustomMetrics('CS');
        const customMetricDefs = csCustomMetrics.map((m) => ({ id: m.id, label: m.label, countMode: m.countMode }));
        // Map<userId, Record<metricId, nilai>>
        const customByUser = new Map<number, Record<string, number>>();
        if (csCustomMetrics.length > 0) {
            const allTxIds = Array.from(new Set(
                Array.from(txByUser.values()).flatMap((s) => Array.from(s)),
            ));
            for (const metric of csCustomMetrics) {
                const byTx = await this.computeCustomMetricByTx(allTxIds, metric);
                for (const [uid, txs] of txByUser) {
                    let sum = 0;
                    for (const txId of txs) sum += byTx.get(txId) ?? 0;
                    if (sum === 0 && metric.countMode !== 'NOTA') continue;
                    const rec = customByUser.get(uid) ?? {};
                    rec[String(metric.id)] = Math.round(sum);
                    customByUser.set(uid, rec);
                }
            }
        }

        // Pastikan CS yang punya OMZET di periode ini (nota lunas — walau lead-nya
        // LAMA / tak bikin lead/walk-in baru periode ini) TETAP muncul barisnya, biar
        // total "Omzet CS" di board Tim/Cabang == jumlah baris divisi CS. byAssignee
        // hanya di-seed dari lead (createdAt) + walk-in periode; csShareByUser (basis
        // paidAt) bisa memuat user yg belum punya baris → tanpa ini omzetnya "hilang".
        for (const uid of csShareByUser.keys()) {
            if (byAssignee.has(uid)) continue;
            if (csId && uid !== csId) continue; // hormati filter staf aktif
            const u = userMap.get(uid);
            // csShareByUser GLOBAL (tak ter-scope cabang) → guard cabang manual supaya
            // saat owner pilih 1 cabang, CS cabang lain tidak ikut keseret.
            if (ctx.branchId != null && (u?.branchId ?? null) !== ctx.branchId) continue;
            byAssignee.set(uid, zeroStat());
        }

        const leaderboard = Array.from(byAssignee.entries())
            .map(([userId, stat]) => {
                const u = userMap.get(userId);
                return {
                    userId,
                    name: u?.name || u?.email || `User #${userId}`,
                    customMetrics: customByUser.get(userId) ?? {},
                    roleName: u?.role?.name || null,
                    leadsHandled: stat.leadsHandled,
                    dealsClosed: stat.dealsClosed,
                    dealsLost: stat.dealsLost,
                    invalidLeads: stat.invalidLeads,
                    pcsOrdered: stat.pcsOrdered,
                    wonValue: stat.wonValue,
                    lostValue: stat.lostValue,
                    pendingValue: stat.pendingValue,
                    walkinTx: stat.walkinTx,
                    walkinPcs: stat.walkinPcs,
                    walkinValue: stat.walkinValue,
                    notasShipped: stat.notasShipped,
                    notasInTransit: stat.notasInTransit,
                    notasDelivered: stat.notasDelivered,
                    pcsShipped: stat.pcsShipped,
                    pcsInTransit: stat.pcsInTransit,
                    pcsDelivered: stat.pcsDelivered,
                    // Bagian omzet nota utk CS ini (nota dibagi per peran) → kolom leaderboard.
                    omzetShare: Math.round(csShareByUser.get(userId) || 0),
                    closingRate: stat.leadsHandled > 0 ? stat.dealsClosed / stat.leadsHandled : 0,
                    avgResponseHrs: stat.respCount > 0
                        ? stat.respSum / stat.respCount / (1000 * 60 * 60)
                        : null,
                    // ── Kecepatan balas WhatsApp (atribusi ke pengirim balasan) ──
                    waResponseSec: waMetrics.get(userId)?.avgSec ?? null,
                    waResponses: waMetrics.get(userId)?.responses ?? 0,
                    waWithinSlaPct: waMetrics.get(userId)?.withinSlaPct ?? null,
                    waChatsHandled: waMetrics.get(userId)?.chatsHandled ?? 0,
                };
            })
            .sort((a, b) =>
                b.dealsClosed - a.dealsClosed
                || b.leadsHandled - a.leadsHandled
                || b.walkinValue - a.walkinValue);

        const walkinTotals = leaderboard.reduce(
            (t, r) => ({ tx: t.tx + r.walkinTx, pcs: t.pcs + r.walkinPcs, value: t.value + r.walkinValue }),
            { tx: 0, pcs: 0, value: 0 },
        );

        // ── Leaderboard Designer (cek desain pra-jual, dari lead) ──────────
        // Kerja tim: outcome lead (closing/gagal) dibagi ke designer yg mengecek.
        // 'batalTeknis' = gagal yg verdict-nya TIDAK_BISA (murni soal desain).
        type DesStat = { dicek: number; closing: number; batal: number; open: number; batalTeknis: number };
        const byDesigner = new Map<string, DesStat>();
        for (const l of leadsInPeriod) {
            const name = (l.designerName || '').trim();
            if (!name) continue;
            const e = byDesigner.get(name) || { dicek: 0, closing: 0, batal: 0, open: 0, batalTeknis: 0 };
            e.dicek++;
            if (l.status === 'CLOSED_WON') e.closing++;
            else if (l.status === 'CLOSED_LOST') {
                e.batal++;
                if (l.designVerdict === 'TIDAK_BISA') e.batalTeknis++;
            } else if (l.status !== 'INVALID') e.open++;
            byDesigner.set(name, e);
        }
        const designCheckLeaderboard = Array.from(byDesigner.entries())
            .map(([name, s]) => ({
                name, dicek: s.dicek, closing: s.closing, batal: s.batal,
                open: s.open, batalTeknis: s.batalTeknis,
                closingRate: s.dicek > 0 ? s.closing / s.dicek : 0,
            }))
            .sort((a, b) => b.dicek - a.dicek || b.closing - a.closing);

        return {
            period: { start: start.toISOString(), end: end.toISOString() },
            customMetricDefs, // [{ id, label, countMode }] — kolom produk custom utk leaderboard CS
            totals: {
                totalLeads,
                closedWon,
                closedLost,
                totalInvalid,
                totalPcs: Array.from(txPcsMap.values()).reduce((s, n) => s + n, 0),
                totalWalkinTx: walkinTotals.tx,
                totalWalkinPcs: walkinTotals.pcs,
                totalWalkinValue: walkinTotals.value,
                wonValue,
                lostValue,
                pendingValue: totalPendingValue,
                customersWithOrder,
                customersRepeat,
                totalFu,
                compliant,
            },
            metrics: {
                responseTimeAvgHrs: Number(responseTimeAvgHrs.toFixed(2)),
                closingRate: Number(closingRate.toFixed(4)),
                fuComplianceRate: Number(fuComplianceRate.toFixed(4)),
                repeatOrderRate: Number(repeatOrderRate.toFixed(4)),
            },
            leadsBySource,
            designCheckLeaderboard,
            leaderboard,
        };
    }
}
