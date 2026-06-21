import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { branchWhere } from '../../common/branch-where.helper';
import type { BranchContext } from '../../common/branch-context.decorator';
import { DiscordService } from '../../discord/discord.service';

export type KpiPeriod = 'today' | 'week' | 'month' | 'custom';

export interface KpiParams {
    period: KpiPeriod;
    start?: string;
    end?: string;
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
    ) {}

    private periodLabel(p: KpiParams): string {
        if (p.period === 'today') return 'Hari Ini';
        if (p.period === 'week') return 'Minggu Ini';
        if (p.period === 'month') return 'Bulan Ini';
        return 'Periode';
    }

    /**
     * Hitung leaderboard lalu kirim pengumuman juara (gamifikasi) ke Discord
     * channel #leaderboard. Sultan Cuan = omzet (lead + walk-in), Raja Lead =
     * lead terbanyak, Sniper Closing = closing rate tertinggi (min 3 lead).
     */
    async sendChampionRecap(ctx: BranchContext, params: KpiParams) {
        const rep = await this.report(ctx, params);
        const lb = rep.leaderboard as any[];
        const rp = (n: number) => 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID');
        if (!lb.length) {
            await this.discord.notifyChampion({ period: this.periodLabel(params), lines: ['Belum ada aktivitas CS di periode ini.'] });
            return { sent: true, champions: null };
        }
        const byMoney = [...lb].sort((a, b) => (b.wonValue + b.walkinValue) - (a.wonValue + a.walkinValue))[0];
        const byLead = [...lb].sort((a, b) => b.leadsHandled - a.leadsHandled)[0];
        const byRate = [...lb].filter(r => r.leadsHandled >= 3).sort((a, b) => b.closingRate - a.closingRate)[0] || null;
        const lines = [
            `👑 **Sultan Cuan**: ${byMoney.name} — ${rp(byMoney.wonValue + byMoney.walkinValue)}`,
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
     * barang terpisah. Item custom tanpa varian katalog tetap dihitung.
     * Penentu add-on: flag Category.countsAsPcs=false (di-set dari halaman
     * Manajemen Kategori). Nama 'Additional' tetap dikecualikan sebagai
     * fallback untuk DB yang belum sempat toggle flag-nya.
     */
    private async computeTxPcsMap(txIds: number[]): Promise<Map<number, number>> {
        const map = new Map<number, number>();
        if (txIds.length === 0) return map;
        const groups: any[] = await (this.prisma as any).transactionItem.groupBy({
            by: ['transactionId'],
            where: {
                transactionId: { in: txIds },
                OR: [
                    { productVariantId: null },
                    { productVariant: { product: { category: { countsAsPcs: true, name: { not: 'Additional' } } } } },
                ],
            },
            _sum: { quantity: true },
        });
        for (const g of groups) map.set(g.transactionId, Number(g._sum?.quantity) || 0);
        return map;
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
                // (countsAsPcs=false / 'Additional' — kerah, lengan, rib) adalah
                // komponen produk utama, bukan barang terpisah → tidak dihitung.
                // Tanpa ini, total pcs Tren Produk lebih besar dari panel lain.
                const cat = it.productVariant?.product?.category;
                if (cat && (cat.countsAsPcs === false || cat.name === 'Additional')) continue;
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
    async designerLeaderboard(ctx: BranchContext, params: KpiParams) {
        const { start, end } = resolvePeriod(params);
        const branchScope: any = branchWhere(ctx);

        const FORWARD = new Set(['PRINT', 'ANTRIAN_PRESS', 'JAHIT', 'QC_PACKING', 'KIRIM', 'SELESAI']);
        const DONE = new Set(['KIRIM', 'SELESAI']);

        const jobs: any[] = await (this.prisma as any).productionJob.findMany({
            where: {
                ...branchScope,
                createdAt: { gte: start, lte: end },
                designerName: { not: null },
            },
            select: {
                designerName: true, pipelineStage: true, cancelledAt: true,
                isExpress: true, createdAt: true, designEnteredAt: true,
            },
        });

        type Stat = {
            assignment: number; acc: number; wip: number; retur: number;
            selesai: number; batal: number; express: number;
            designSumMs: number; designCount: number;
        };
        const byDesigner = new Map<string, Stat>();
        for (const j of jobs) {
            const name = (j.designerName || '').trim();
            if (!name) continue;
            const s = byDesigner.get(name) || {
                assignment: 0, acc: 0, wip: 0, retur: 0, selesai: 0, batal: 0,
                express: 0, designSumMs: 0, designCount: 0,
            };
            s.assignment++;
            if (j.cancelledAt) {
                s.batal++;
            } else {
                const stage = j.pipelineStage || 'DESIGN';
                if (stage === 'DESIGN') s.wip++;
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
        for (const so of invoicedSos) {
            const name = (so.designerName || '').trim();
            if (!name) continue;
            const st = soNotaByDesigner.get(name) || { invoiced: 0, omzet: 0, pcs: 0 };
            st.invoiced++;
            st.omzet += Number(so.transaction?.grandTotal || 0);
            st.pcs += soTxPcsMap.get(Number(so.transactionId)) ?? 0;
            soNotaByDesigner.set(name, st);
        }

        // Union nama: designer dari production job + designer yang hanya punya SO
        const allNames = new Set<string>([...byDesigner.keys(), ...soByDesigner.keys(), ...soNotaByDesigner.keys()]);
        const ZERO: Stat = { assignment: 0, acc: 0, wip: 0, retur: 0, selesai: 0, batal: 0, express: 0, designSumMs: 0, designCount: 0 };
        const ZSO: SoStat = { invoiced: 0, omzet: 0, pcs: 0 };

        const leaderboard = Array.from(allNames)
            .map((name) => {
                const s = byDesigner.get(name) || ZERO;
                const so = soNotaByDesigner.get(name) || ZSO;
                const soCreated = soByDesigner.get(name) || 0;
                const denom = s.assignment - s.batal;
                return {
                    name,
                    assignment: s.assignment,
                    acc: s.acc,
                    accRate: denom > 0 ? s.acc / denom : 0,
                    wip: s.wip,
                    retur: s.retur,
                    selesai: s.selesai,
                    batal: s.batal,
                    express: s.express,
                    soCreated,
                    soInvoiced: so.invoiced,                                   // SO yang jadi nota
                    soConvRate: soCreated > 0 ? so.invoiced / soCreated : 0,   // rasio SO → nota
                    omzet: so.omzet,                                           // omzet dari SO yang jadi nota
                    pcs: so.pcs,
                    avgDesignHrs: s.designCount > 0 ? s.designSumMs / s.designCount / 3_600_000 : null,
                };
            })
            .sort((a, b) => b.omzet - a.omzet || b.acc - a.acc || b.soCreated - a.soCreated);

        const totals = leaderboard.reduce((t, r) => ({
            assignment: t.assignment + r.assignment,
            acc: t.acc + r.acc,
            wip: t.wip + r.wip,
            retur: t.retur + r.retur,
            selesai: t.selesai + r.selesai,
            batal: t.batal + r.batal,
            express: t.express + r.express,
            soCreated: t.soCreated + r.soCreated,
            soInvoiced: t.soInvoiced + r.soInvoiced,
            omzet: t.omzet + r.omzet,
            pcs: t.pcs + r.pcs,
        }), { assignment: 0, acc: 0, wip: 0, retur: 0, selesai: 0, batal: 0, express: 0, soCreated: 0, soInvoiced: 0, omzet: 0, pcs: 0 });

        return {
            period: { start: start.toISOString(), end: end.toISOString() },
            leaderboard,
            totals,
        };
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
                add('wonValue', bk, person, Number(l.estimatedValue) || 0);
                if (l.convertedTransactionId) add('pcs', bk, person, txPcsMap.get(Number(l.convertedTransactionId)) ?? 0);
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

        const SUM_METRICS = ['assignment', 'soCreated', 'acc', 'wip', 'retur', 'selesai', 'batal', 'express'];
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

        // ── Response time avg ──────────────────────────────────────────────
        // Ambil leads in period + first non-FIRST_CONTACT activity per lead.
        // Tanpa `distinct` (kadang flaky di MySQL pakai Prisma) — kita pakai
        // sort + ambil first di JS.
        const leadsInPeriod: any[] = await this.lead.findMany({
            where: { ...branchScope, ...csScope, createdAt: { gte: start, lte: end } },
            select: { id: true, createdAt: true, status: true, source: true, sourceDetail: true, assignedToId: true, estimatedValue: true, convertedTransactionId: true },
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
        const wonValue = leadsInPeriod
            .filter(l => l.status === 'CLOSED_WON')
            .reduce((s, l) => s + (Number(l.estimatedValue) || 0), 0);

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

        // Fee platform per transaksi hasil convert → untuk pendapatan BERSIH
        // (cuan setelah dipotong biaya platform) di leaderboard CS.
        const txFeeMap = new Map<number, number>();
        if (convertedTxIds.length > 0) {
            const feeTxs: any[] = await this.tx.findMany({
                where: { id: { in: convertedTxIds } },
                select: { id: true, marketplaceFee: true } as any,
            });
            for (const t of feeTxs) txFeeMap.set(t.id, Number((t as any).marketplaceFee) || 0);
        }

        // Peta lead → saldo pending (0 kalau sudah lunas / tidak punya tx)
        const leadPendingMap = new Map<number, number>();
        for (const l of leadsInPeriod) {
            if (l.status !== 'CLOSED_WON' || !l.convertedTransactionId) continue;
            const pending = txPendingMap.get(Number(l.convertedTransactionId)) ?? 0;
            leadPendingMap.set(l.id, pending);
        }
        const totalPendingValue = Array.from(leadPendingMap.values()).reduce((s, v) => s + v, 0);

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
        // Customer with >=2 transactions in period / customer with >=1.
        // Pakai raw SQL supaya tidak gagal kalau Prisma client belum re-generate
        // pasca extension Customer (assigned_cs_id, dll).
        let customersWithOrder = 0;
        let customersRepeat = 0;
        try {
            const branchFilter = ctx.branchId != null ? `AND branch_id = ${Number(ctx.branchId)}` : '';
            const rows: any[] = await this.prisma.$queryRawUnsafe(`
                SELECT customer_id, COUNT(*) AS cnt
                FROM transactions
                WHERE customer_id IS NOT NULL
                  AND created_at BETWEEN ? AND ?
                  ${branchFilter}
                GROUP BY customer_id
            `, start, end);
            customersWithOrder = rows.length;
            customersRepeat = rows.filter((r: any) => Number(r.cnt) >= 2).length;
        } catch (e) {
            // Tabel transactions atau kolom branch_id mungkin beda di setup user
            // — fallback ke 0 supaya endpoint tidak crash.
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
        };
        const zeroStat = (): CsStat => ({
            leadsHandled: 0, dealsClosed: 0, dealsLost: 0, invalidLeads: 0,
            pcsOrdered: 0, wonValue: 0, lostValue: 0, pendingValue: 0,
            walkinTx: 0, walkinPcs: 0, walkinValue: 0, respSum: 0, respCount: 0,
        });
        const byAssignee = new Map<number, CsStat>();
        for (const l of leadsInPeriod) {
            if (!l.assignedToId) continue;
            const entry = byAssignee.get(l.assignedToId) || zeroStat();
            entry.leadsHandled++;
            if (l.status === 'CLOSED_WON') {
                entry.dealsClosed++;
                // Pendapatan bersih: estimasi deal dikurangi biaya platform tx convert.
                const wonFee = l.convertedTransactionId ? (txFeeMap.get(Number(l.convertedTransactionId)) || 0) : 0;
                entry.wonValue += Math.max(0, (Number(l.estimatedValue) || 0) - wonFee);
                entry.pendingValue += leadPendingMap.get(l.id) ?? 0;
                if (l.convertedTransactionId) {
                    entry.pcsOrdered += txPcsMap.get(Number(l.convertedTransactionId)) ?? 0;
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
            select: { id: true, name: true, email: true },
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
            // Pendapatan bersih: harga jual dikurangi biaya platform.
            entry.walkinValue += Math.max(0, (Number(t.grandTotal) || 0) - (Number((t as any).marketplaceFee) || 0));
            // Sisa piutang tx PENDING/PARTIAL → Nilai Akan Datang (gabung dgn pending lead)
            if (t.status === 'PENDING' || t.status === 'PARTIAL') {
                entry.pendingValue += Math.max(0, Number(t.grandTotal) - Number(t.downPayment));
            }
            byAssignee.set(u.id, entry);
        }

        const leaderboard = Array.from(byAssignee.entries())
            .map(([userId, stat]) => {
                const u = userMap.get(userId);
                return {
                    userId,
                    name: u?.name || u?.email || `User #${userId}`,
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
                    closingRate: stat.leadsHandled > 0 ? stat.dealsClosed / stat.leadsHandled : 0,
                    avgResponseHrs: stat.respCount > 0
                        ? stat.respSum / stat.respCount / (1000 * 60 * 60)
                        : null,
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

        return {
            period: { start: start.toISOString(), end: end.toISOString() },
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
            leaderboard,
        };
    }
}
