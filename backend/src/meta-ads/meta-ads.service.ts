import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudApiService } from '../whatsapp-cloud/cloud-api.service';

/**
 * Meta Ads (Marketing API) — baca campaign & insight iklan, lalu GABUNGKAN dengan
 * lead nyata di CRM (Lead.adId dari referral Click-to-WhatsApp) untuk menghitung
 * cost-per-lead riil. Memakai token WA yang sama (scope ads_read sudah ada).
 */
export interface AdAccount {
    id: string; // act_xxxx
    accountId: string;
    name: string;
    accountStatus: number | null;
    currency: string | null;
    amountSpent: string | null;
}

export interface CampaignRow {
    id: string;
    name: string;
    status: string | null;
    effectiveStatus: string | null;
    objective: string | null;
    spend: number; // mata uang akun (mis. IDR), major unit
    impressions: number;
    clicks: number;
    ctr: number; // %
    results: number; // "percakapan WA dimulai" (messaging_conversation_started)
    costPerResult: number | null; // biaya Meta / hasil Meta (CPR)
    leadsCaptured: number; // lead nyata di CRM (adId → campaign)
    closings: number; // lead closing (transaksi PAID) dari campaign ini
    omzet: number; // omzet realisasi (grandTotal transaksi PAID) dari lead campaign
    roas: number | null; // omzet ÷ spend (≥4x = bagus)
    productProfit: number | null; // profit produk (input owner)
    cprTarget: number | null; // patokan CPR = productProfit × 5%
    labelId: number | null; // label custom (cabang/perusahaan) untuk campaign ini
    labelName: string | null;
    labelBranchId: number | null;
}

export interface VideoMetrics {
    plays: number; // video plays (±3 detik)
    p25: number;
    p50: number;
    p75: number;
    p100: number;
}

export interface AdRow {
    id: string; // adId (= referral.source_id)
    name: string;
    effectiveStatus: string | null;
    spend: number;
    clicks: number;
    ctr: number;
    results: number;
    costPerResult: number | null;
    leadsCaptured: number;
    closings: number;
    omzet: number;
    roas: number | null;
    video: VideoMetrics;
}

export interface BranchSummary {
    branchId: number | null;
    branchName: string; // "(Tanpa Cabang)" bila null
    leadsCaptured: number;
    closings: number;
    omzet: number;
}

export interface LabelSummary {
    labelId: number | null;
    labelName: string; // "(Tanpa Label)" bila null
    spend: number;
    leadsCaptured: number;
    results: number;
    costPerLead: number | null;
}

export interface AdLabelRow {
    id: number;
    name: string;
    branchId: number | null;
    branchName: string | null;
    campaignCount: number;
}

export interface AdsOverview {
    account: AdAccount | null;
    since: string;
    until: string;
    currency: string | null;
    totals: {
        spend: number;
        impressions: number;
        clicks: number;
        results: number;
        leadsCaptured: number;
        closings: number;
        omzet: number;
        roas: number | null; // ROAS keseluruhan
        avgCtr: number; // CTR rata-rata tertimbang (klik ÷ impresi)
    };
    campaigns: CampaignRow[];
    byLabel: LabelSummary[]; // ringkasan biaya/lead per label (cabang/perusahaan)
    byBranch: BranchSummary[]; // pemisahan Imogiri vs Sewon dari cabang penerima lead
    unattributedLeads: number; // lead beriklan yg adId-nya tak ketemu di akun ini
}

@Injectable()
export class MetaAdsService {
    private readonly logger = new Logger(MetaAdsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly cloudApi: CloudApiService,
    ) {}

    private num(v: any): number {
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
    }

    private ymd(d: Date): string {
        return d.toISOString().slice(0, 10);
    }

    /** Normalisasi ke bentuk act_<id>. */
    private normAccount(id: string): string {
        const s = String(id || '').trim();
        return s.startsWith('act_') ? s : `act_${s.replace(/^act_/, '')}`;
    }

    /** GET dgn paginasi cursor (`after`), dibatasi maxPages agar aman. */
    private async graphGetAll(basePath: string, maxPages = 10): Promise<any[]> {
        const out: any[] = [];
        let after: string | undefined;
        for (let i = 0; i < maxPages; i++) {
            const sep = basePath.includes('?') ? '&' : '?';
            const path = after ? `${basePath}${sep}after=${encodeURIComponent(after)}` : basePath;
            const json = await this.cloudApi.graphGet(path);
            if (Array.isArray(json?.data)) out.push(...json.data);
            after = json?.paging?.cursors?.after;
            if (!json?.paging?.next || !after) break;
        }
        return out;
    }

    /** Daftar ad account yang bisa diakses token. */
    async listAccounts(): Promise<AdAccount[]> {
        const rows = await this.graphGetAll(
            'me/adaccounts?fields=name,account_id,account_status,currency,amount_spent&limit=100',
            3,
        );
        return rows.map((a) => ({
            id: a.id,
            accountId: a.account_id,
            name: a.name,
            accountStatus: a.account_status ?? null,
            currency: a.currency ?? null,
            amountSpent: a.amount_spent ?? null,
        }));
    }

    /** Ad account terpilih: WaConfig.adAccountId → env → akun pertama. */
    async resolveAccount(explicit?: string): Promise<AdAccount | null> {
        if (explicit) {
            const accounts = await this.listAccounts();
            const found = accounts.find((a) => a.id === this.normAccount(explicit));
            if (found) return found;
        }
        const cfg = await this.prisma.waConfig.findUnique({
            where: { id: 1 },
            select: { adAccountId: true },
        });
        const configured = cfg?.adAccountId || process.env.META_AD_ACCOUNT_ID || '';
        const accounts = await this.listAccounts();
        if (configured) {
            const found = accounts.find((a) => a.id === this.normAccount(configured));
            if (found) return found;
        }
        return accounts[0] ?? null;
    }

    /** Simpan ad account pilihan ke WaConfig (singleton). */
    async setAccount(accountId: string | null): Promise<{ ok: true }> {
        const val = accountId ? this.normAccount(accountId) : null;
        await this.prisma.waConfig.upsert({
            where: { id: 1 },
            create: { id: 1, adAccountId: val },
            update: { adAccountId: val },
        });
        return { ok: true };
    }

    /** Jumlah hasil "percakapan WA dimulai" dari array actions insight. */
    private extractResults(actions: any[]): number {
        if (!Array.isArray(actions)) return 0;
        let total = 0;
        for (const a of actions) {
            const t = String(a?.action_type || '');
            if (t.includes('messaging_conversation_started') || t === 'onsite_conversion.total_messaging_connection') {
                total += this.num(a?.value);
            }
        }
        return total;
    }

    /**
     * Overview: campaign + insight Meta digabung dgn lead CRM (adId → campaign).
     * @param since/until format YYYY-MM-DD (default 30 hari terakhir).
     */
    async overview(opts: { since?: string; until?: string; accountId?: string; labelId?: number }): Promise<AdsOverview> {
        const until = opts.until || this.ymd(new Date());
        const since = opts.since || this.ymd(new Date(Date.now() - 29 * 86_400_000));
        const account = await this.resolveAccount(opts.accountId);
        if (!account) {
            return {
                account: null, since, until, currency: null,
                totals: { spend: 0, impressions: 0, clicks: 0, results: 0, leadsCaptured: 0, closings: 0, omzet: 0, roas: null, avgCtr: 0 },
                campaigns: [], byLabel: [], byBranch: [], unattributedLeads: 0,
            };
        }
        const act = account.id;
        const timeRange = encodeURIComponent(JSON.stringify({ since, until }));

        // 1) Metadata campaign (nama/status/objective).
        const campaigns = await this.graphGetAll(
            `${act}/campaigns?fields=name,status,effective_status,objective&limit=200`,
            10,
        );
        // 2) Insight per campaign pada rentang tanggal.
        const insights = await this.graphGetAll(
            `${act}/insights?level=campaign&time_range=${timeRange}` +
                `&fields=campaign_id,campaign_name,spend,impressions,clicks,ctr,actions&limit=500`,
            10,
        );
        // 3) Peta ad → campaign (referral.source_id = id iklan) utk atribusi lead CRM.
        const ads = await this.graphGetAll(`${act}/ads?fields=id,campaign_id&limit=500`, 20);
        const adToCampaign = new Map<string, string>();
        for (const ad of ads) if (ad?.id && ad?.campaign_id) adToCampaign.set(String(ad.id), String(ad.campaign_id));
        // Nama campaign (id → name) utk di-cache ke MetaAdMap → dipakai label chat CTWA di inbox WA.
        const campaignNames = new Map<string, string>();
        for (const c of campaigns) if (c?.id && c?.name) campaignNames.set(String(c.id), String(c.name));
        for (const ins of insights)
            if (ins?.campaign_id && ins?.campaign_name && !campaignNames.has(String(ins.campaign_id)))
                campaignNames.set(String(ins.campaign_id), String(ins.campaign_name));
        // Segarkan cache MetaAdMap (dipakai webhook utk resolve label lead cepat).
        await this.upsertAdMap(adToCampaign, act, campaignNames);

        // 4) Statistik lead CRM (leads/closings/omzet) per adId + per cabang.
        const stats = await this.computeLeadStats(since, until);
        const leadsByCampaign = new Map<string, { leads: number; closings: number; omzet: number }>();
        let unattributedLeads = 0;
        for (const [adId, s] of stats.perAd) {
            const camp = adToCampaign.get(adId);
            if (!camp) { unattributedLeads += s.leads; continue; }
            const cur = leadsByCampaign.get(camp) || { leads: 0, closings: 0, omzet: 0 };
            cur.leads += s.leads; cur.closings += s.closings; cur.omzet += s.omzet;
            leadsByCampaign.set(camp, cur);
        }

        // 5) Config per campaign (label + profit produk) dari DB.
        const allCampaignIds = new Set<string>([
            ...campaigns.map((c) => String(c.id)),
            ...insights.map((i) => String(i.campaign_id)),
        ]);
        const links = await this.prisma.metaCampaignLabel.findMany({
            where: { campaignId: { in: [...allCampaignIds] } },
            include: { label: { select: { id: true, name: true, branchId: true } } },
        });
        const cfgByCampaign = new Map<string, { labelId: number | null; labelName: string | null; branchId: number | null; profit: number | null }>();
        for (const l of links) cfgByCampaign.set(l.campaignId, {
            labelId: l.label?.id ?? null,
            labelName: l.label?.name ?? null,
            branchId: l.label?.branchId ?? null,
            profit: l.productProfit != null ? this.num(l.productProfit) : null,
        });

        // 6) Gabung: metadata + insight + lead + config per campaign.
        const insightById = new Map<string, any>();
        for (const ins of insights) if (ins?.campaign_id) insightById.set(String(ins.campaign_id), ins);

        const buildRow = (id: string, meta: any, ins: any): CampaignRow => {
            const spend = this.num(ins?.spend);
            const results = this.extractResults(ins?.actions);
            const ls = leadsByCampaign.get(id) || { leads: 0, closings: 0, omzet: 0 };
            const cfg = cfgByCampaign.get(id) || null;
            const profit = cfg?.profit ?? null;
            return {
                id,
                name: meta?.name ?? ins?.campaign_name ?? `(campaign ${id})`,
                status: meta?.status ?? null,
                effectiveStatus: meta?.effective_status ?? null,
                objective: meta?.objective ?? null,
                spend, impressions: this.num(ins?.impressions), clicks: this.num(ins?.clicks),
                ctr: this.num(ins?.ctr), results,
                costPerResult: results > 0 ? spend / results : null,
                leadsCaptured: ls.leads,
                closings: ls.closings,
                omzet: ls.omzet,
                roas: spend > 0 ? ls.omzet / spend : null,
                productProfit: profit,
                cprTarget: profit != null ? profit * 0.05 : null,
                labelId: cfg?.labelId ?? null,
                labelName: cfg?.labelName ?? null,
                labelBranchId: cfg?.branchId ?? null,
            };
        };

        let rows: CampaignRow[] = campaigns.map((c) => buildRow(String(c.id), c, insightById.get(String(c.id))));
        for (const ins of insights) {
            const id = String(ins.campaign_id);
            if (rows.some((r) => r.id === id)) continue;
            rows.push(buildRow(id, null, ins));
        }
        rows.sort((a, b) => b.spend - a.spend);

        if (opts.labelId != null) rows = rows.filter((r) => r.labelId === opts.labelId);

        const totals = rows.reduce(
            (t, r) => {
                t.spend += r.spend; t.impressions += r.impressions; t.clicks += r.clicks;
                t.results += r.results; t.leadsCaptured += r.leadsCaptured;
                t.closings += r.closings; t.omzet += r.omzet;
                return t;
            },
            { spend: 0, impressions: 0, clicks: 0, results: 0, leadsCaptured: 0, closings: 0, omzet: 0 },
        );

        // Ringkasan per label (cabang/perusahaan).
        const byLabelMap = new Map<string, LabelSummary>();
        for (const r of rows) {
            const key = r.labelId != null ? String(r.labelId) : 'none';
            const cur = byLabelMap.get(key) || {
                labelId: r.labelId, labelName: r.labelName || '(Tanpa Label)',
                spend: 0, leadsCaptured: 0, results: 0, costPerLead: null,
            };
            cur.spend += r.spend; cur.leadsCaptured += r.leadsCaptured; cur.results += r.results;
            byLabelMap.set(key, cur);
        }
        const byLabel = [...byLabelMap.values()].map((s) => ({
            ...s, costPerLead: s.leadsCaptured > 0 ? s.spend / s.leadsCaptured : null,
        })).sort((a, b) => b.spend - a.spend);

        // Ringkasan per cabang (Imogiri vs Sewon) dari cabang penerima lead.
        const branchIds = [...stats.perBranch.values()].map((b) => b.branchId).filter((v): v is number => v != null);
        const branchNames = new Map<number, string>();
        if (branchIds.length) {
            const bs = await this.prisma.companyBranch.findMany({ where: { id: { in: branchIds } }, select: { id: true, name: true } });
            for (const b of bs) branchNames.set(b.id, b.name);
        }
        const byBranch: BranchSummary[] = [...stats.perBranch.values()].map((b) => ({
            branchId: b.branchId,
            branchName: b.branchId != null ? (branchNames.get(b.branchId) || `Cabang #${b.branchId}`) : '(Tanpa Cabang)',
            leadsCaptured: b.leads, closings: b.closings, omzet: b.omzet,
        })).sort((a, b) => b.omzet - a.omzet);

        return {
            account, since, until, currency: account.currency,
            totals: {
                ...totals,
                roas: totals.spend > 0 ? totals.omzet / totals.spend : null,
                avgCtr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
            },
            campaigns: rows,
            byLabel,
            byBranch,
            unattributedLeads,
        };
    }

    /**
     * Statistik lead CRM dari iklan: leads + closings (transaksi PAID) + omzet
     * (grandTotal transaksi PAID), dipecah per adId dan per cabang penerima lead.
     */
    private async computeLeadStats(since: string, until: string, restrictAdIds?: string[]): Promise<{
        perAd: Map<string, { leads: number; closings: number; omzet: number }>;
        perBranch: Map<string, { branchId: number | null; leads: number; closings: number; omzet: number }>;
    }> {
        const where: any = {
            adId: restrictAdIds ? { in: restrictAdIds } : { not: null },
            createdAt: { gte: new Date(`${since}T00:00:00`), lte: new Date(`${until}T23:59:59`) },
        };
        const leads = await this.prisma.lead.findMany({
            where,
            select: { adId: true, branchId: true, convertedTransactionId: true },
        });
        const txIds = [...new Set(leads.map((l) => l.convertedTransactionId).filter((v): v is number => v != null))];
        const paid = txIds.length
            ? await this.prisma.transaction.findMany({ where: { id: { in: txIds }, status: 'PAID' }, select: { id: true, grandTotal: true } })
            : [];
        const paidMap = new Map<number, number>();
        for (const t of paid) paidMap.set(t.id, this.num(t.grandTotal));

        const perAd = new Map<string, { leads: number; closings: number; omzet: number }>();
        const perBranch = new Map<string, { branchId: number | null; leads: number; closings: number; omzet: number }>();
        for (const l of leads) {
            if (!l.adId) continue;
            const txId = l.convertedTransactionId;
            const isClosing = txId != null && paidMap.has(txId);
            const omzet = isClosing ? paidMap.get(txId!)! : 0;
            const a = perAd.get(l.adId) || { leads: 0, closings: 0, omzet: 0 };
            a.leads++; if (isClosing) a.closings++; a.omzet += omzet;
            perAd.set(l.adId, a);
            const bkey = l.branchId != null ? String(l.branchId) : 'none';
            const b = perBranch.get(bkey) || { branchId: l.branchId ?? null, leads: 0, closings: 0, omzet: 0 };
            b.leads++; if (isClosing) b.closings++; b.omzet += omzet;
            perBranch.set(bkey, b);
        }
        return { perAd, perBranch };
    }

    /** Upsert cache MetaAdMap (best-effort, jangan gagalkan overview). */
    private async upsertAdMap(
        adToCampaign: Map<string, string>,
        adAccountId: string,
        campaignNames?: Map<string, string>,
    ): Promise<void> {
        try {
            const entries = [...adToCampaign.entries()];
            for (const [adId, campaignId] of entries) {
                const campaignName = campaignNames?.get(campaignId);
                await this.prisma.metaAdMap.upsert({
                    where: { adId },
                    create: { adId, campaignId, adAccountId, ...(campaignName ? { campaignName } : {}) },
                    update: { campaignId, adAccountId, ...(campaignName ? { campaignName } : {}) },
                });
            }
        } catch (e) {
            this.logger.warn(`upsertAdMap gagal: ${(e as Error).message}`);
        }
    }

    private normLabel(name: string): string {
        return String(name || '').trim().toLowerCase();
    }

    /** Daftar label + jumlah campaign tertaut. */
    async listLabels(): Promise<AdLabelRow[]> {
        const labels = await this.prisma.adLabel.findMany({
            orderBy: { name: 'asc' },
            include: { branch: { select: { name: true } }, _count: { select: { campaigns: true } } },
        });
        return labels.map((l) => ({
            id: l.id, name: l.name, branchId: l.branchId,
            branchName: l.branch?.name ?? null, campaignCount: l._count.campaigns,
        }));
    }

    /** Buat/ambil label (dedup case-insensitive); set/ubah tautan cabang bila diberikan. */
    async upsertLabel(name: string, branchId?: number | null): Promise<AdLabelRow> {
        const clean = String(name || '').trim();
        if (!clean) throw new Error('Nama label wajib diisi');
        const normalizedName = this.normLabel(clean);
        const label = await this.prisma.adLabel.upsert({
            where: { normalizedName },
            create: { name: clean, normalizedName, branchId: branchId ?? null },
            update: branchId === undefined ? {} : { branchId: branchId ?? null },
            include: { branch: { select: { name: true } }, _count: { select: { campaigns: true } } },
        });
        return {
            id: label.id, name: label.name, branchId: label.branchId,
            branchName: label.branch?.name ?? null, campaignCount: label._count.campaigns,
        };
    }

    async deleteLabel(id: number): Promise<{ ok: true }> {
        // Lead.adLabelId → SetNull; MetaCampaignLabel → Cascade (lihat schema).
        await this.prisma.adLabel.delete({ where: { id } });
        return { ok: true };
    }

    /**
     * Tautkan label ke campaign (per campaign). Segarkan cache ad→campaign untuk
     * campaign tsb, lalu backfill lead lama yg adId-nya milik campaign ini → set
     * adLabelId (+ branchId bila label tertaut cabang). labelId null = lepas tautan.
     */
    async assignCampaignLabel(campaignId: string, labelId: number | null, adAccountId?: string): Promise<{ ok: true; updatedLeads: number }> {
        const cid = String(campaignId || '').trim();
        if (!cid) throw new Error('campaignId wajib diisi');

        if (labelId == null) {
            // Lepas label. Pertahankan baris bila masih menyimpan profit produk.
            const existing = await this.prisma.metaCampaignLabel.findUnique({ where: { campaignId: cid }, select: { productProfit: true } });
            if (existing && existing.productProfit != null) {
                await this.prisma.metaCampaignLabel.update({ where: { campaignId: cid }, data: { adLabelId: null } });
            } else {
                await this.prisma.metaCampaignLabel.deleteMany({ where: { campaignId: cid } });
            }
            await this.prisma.lead.updateMany({ where: { adLabelId: { not: null }, adId: { in: (await this.prisma.metaAdMap.findMany({ where: { campaignId: cid }, select: { adId: true } })).map((a) => a.adId) } }, data: { adLabelId: null } });
            return { ok: true, updatedLeads: 0 };
        }
        const label = await this.prisma.adLabel.findUnique({ where: { id: labelId }, select: { id: true, branchId: true } });
        if (!label) throw new Error('Label tidak ditemukan');

        await this.prisma.metaCampaignLabel.upsert({
            where: { campaignId: cid },
            create: { campaignId: cid, adLabelId: label.id, adAccountId: adAccountId ?? null },
            update: { adLabelId: label.id, ...(adAccountId ? { adAccountId } : {}) },
        });

        // Segarkan peta ad→campaign untuk campaign ini (best-effort).
        let adIds: string[] = [];
        try {
            const adsOfCampaign = await this.graphGetAll(`${cid}/ads?fields=id&limit=500`, 10);
            adIds = adsOfCampaign.map((a) => String(a.id)).filter(Boolean);
            for (const adId of adIds) {
                await this.prisma.metaAdMap.upsert({
                    where: { adId },
                    create: { adId, campaignId: cid, adAccountId: adAccountId ?? null },
                    update: { campaignId: cid, ...(adAccountId ? { adAccountId } : {}) },
                });
            }
        } catch (e) {
            this.logger.warn(`refresh ad map campaign ${cid} gagal: ${(e as Error).message}`);
            // Fallback: pakai adId yg sudah ada di cache utk campaign ini.
            const cached = await this.prisma.metaAdMap.findMany({ where: { campaignId: cid }, select: { adId: true } });
            adIds = cached.map((c) => c.adId);
        }

        // Backfill lead lama milik campaign ini → set label (+ branch).
        let updatedLeads = 0;
        if (adIds.length) {
            const res = await this.prisma.lead.updateMany({
                where: { adId: { in: adIds } },
                data: { adLabelId: label.id, ...(label.branchId != null ? { branchId: label.branchId } : {}) },
            });
            updatedLeads = res.count;
        }
        return { ok: true, updatedLeads };
    }

    /** Set profit produk per campaign → patokan CPR = profit × 5%. profit null = hapus. */
    async setCampaignProfit(campaignId: string, profit: number | null, adAccountId?: string): Promise<{ ok: true }> {
        const cid = String(campaignId || '').trim();
        if (!cid) throw new Error('campaignId wajib diisi');
        const val = profit != null && Number.isFinite(profit) && profit > 0 ? profit : null;
        const existing = await this.prisma.metaCampaignLabel.findUnique({ where: { campaignId: cid }, select: { adLabelId: true } });
        if (!existing && val == null) return { ok: true };
        if (existing && val == null && existing.adLabelId == null) {
            await this.prisma.metaCampaignLabel.delete({ where: { campaignId: cid } });
            return { ok: true };
        }
        await this.prisma.metaCampaignLabel.upsert({
            where: { campaignId: cid },
            create: { campaignId: cid, productProfit: val, adAccountId: adAccountId ?? null },
            update: { productProfit: val, ...(adAccountId ? { adAccountId } : {}) },
        });
        return { ok: true };
    }

    /** Jumlah dari field insight video (array actions {value}). */
    private videoVal(field: any): number {
        if (Array.isArray(field)) return field.reduce((s, a) => s + this.num(a?.value), 0);
        return this.num(field);
    }

    /**
     * Drill-down per iklan/video dalam 1 campaign: spend, klik, CTR, hasil, metrik
     * video (plays/25/50/75/100%), + lead & closing nyata dari CRM (per adId).
     */
    async adBreakdown(opts: { campaignId: string; since?: string; until?: string }): Promise<{ campaignId: string; since: string; until: string; ads: AdRow[] }> {
        const cid = String(opts.campaignId || '').trim();
        const until = opts.until || this.ymd(new Date());
        const since = opts.since || this.ymd(new Date(Date.now() - 29 * 86_400_000));
        if (!cid) return { campaignId: cid, since, until, ads: [] };
        const timeRange = encodeURIComponent(JSON.stringify({ since, until }));

        // Metadata iklan (nama/status) + insight per-iklan (termasuk metrik video).
        const meta = await this.graphGetAll(`${cid}/ads?fields=id,name,effective_status&limit=500`, 10);
        const metaById = new Map<string, any>();
        for (const a of meta) metaById.set(String(a.id), a);
        const insights = await this.graphGetAll(
            `${cid}/insights?level=ad&time_range=${timeRange}` +
                `&fields=ad_id,ad_name,spend,clicks,ctr,actions,video_play_actions,` +
                `video_p25_watched_actions,video_p50_watched_actions,video_p75_watched_actions,video_p100_watched_actions&limit=500`,
            10,
        );
        const insById = new Map<string, any>();
        for (const i of insights) if (i?.ad_id) insById.set(String(i.ad_id), i);

        const adIds = [...new Set<string>([...metaById.keys(), ...insById.keys()])];
        const stats = await this.computeLeadStats(since, until, adIds);

        const ads: AdRow[] = adIds.map((id) => {
            const m = metaById.get(id);
            const ins = insById.get(id);
            const spend = this.num(ins?.spend);
            const results = this.extractResults(ins?.actions);
            const s = stats.perAd.get(id) || { leads: 0, closings: 0, omzet: 0 };
            return {
                id,
                name: m?.name ?? ins?.ad_name ?? `(iklan ${id})`,
                effectiveStatus: m?.effective_status ?? null,
                spend, clicks: this.num(ins?.clicks), ctr: this.num(ins?.ctr), results,
                costPerResult: results > 0 ? spend / results : null,
                leadsCaptured: s.leads, closings: s.closings, omzet: s.omzet,
                roas: spend > 0 ? s.omzet / spend : null,
                video: {
                    plays: this.videoVal(ins?.video_play_actions),
                    p25: this.videoVal(ins?.video_p25_watched_actions),
                    p50: this.videoVal(ins?.video_p50_watched_actions),
                    p75: this.videoVal(ins?.video_p75_watched_actions),
                    p100: this.videoVal(ins?.video_p100_watched_actions),
                },
            };
        }).sort((a, b) => b.spend - a.spend);

        return { campaignId: cid, since, until, ads };
    }
}
