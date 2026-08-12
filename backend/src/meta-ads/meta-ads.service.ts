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
    costPerResult: number | null; // biaya Meta / hasil Meta
    leadsCaptured: number; // lead nyata di CRM (adId → campaign)
    costPerLead: number | null; // spend / leadsCaptured (biaya per lead riil)
    labelId: number | null; // label custom (cabang/perusahaan) untuk campaign ini
    labelName: string | null;
    labelBranchId: number | null;
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
        costPerLead: number | null;
    };
    campaigns: CampaignRow[];
    byLabel: LabelSummary[]; // ringkasan biaya/lead per label (cabang/perusahaan)
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
                totals: { spend: 0, impressions: 0, clicks: 0, results: 0, leadsCaptured: 0, costPerLead: null },
                campaigns: [], byLabel: [], unattributedLeads: 0,
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
        // Segarkan cache MetaAdMap (dipakai webhook utk resolve label lead cepat).
        await this.upsertAdMap(adToCampaign, act);

        // 4) Lead CRM dari iklan pada rentang tsb, dikelompokkan per adId.
        const grouped = await this.prisma.lead.groupBy({
            by: ['adId'],
            where: {
                adId: { not: null },
                createdAt: { gte: new Date(`${since}T00:00:00`), lte: new Date(`${until}T23:59:59`) },
            },
            _count: { _all: true },
        });
        const leadsByCampaign = new Map<string, number>();
        let unattributedLeads = 0;
        for (const g of grouped) {
            const adId = String(g.adId);
            const cnt = g._count._all;
            const camp = adToCampaign.get(adId);
            if (camp) leadsByCampaign.set(camp, (leadsByCampaign.get(camp) || 0) + cnt);
            else unattributedLeads += cnt;
        }

        // 5) Label per campaign (dari DB penautan).
        const allCampaignIds = new Set<string>([
            ...campaigns.map((c) => String(c.id)),
            ...insights.map((i) => String(i.campaign_id)),
        ]);
        const links = await this.prisma.metaCampaignLabel.findMany({
            where: { campaignId: { in: [...allCampaignIds] } },
            include: { label: { select: { id: true, name: true, branchId: true } } },
        });
        const labelByCampaign = new Map<string, { id: number; name: string; branchId: number | null }>();
        for (const l of links) labelByCampaign.set(l.campaignId, { id: l.label.id, name: l.label.name, branchId: l.label.branchId });

        // 6) Gabung: metadata + insight + lead + label per campaign.
        const insightById = new Map<string, any>();
        for (const ins of insights) if (ins?.campaign_id) insightById.set(String(ins.campaign_id), ins);

        const buildRow = (id: string, meta: any, ins: any): CampaignRow => {
            const spend = this.num(ins?.spend);
            const results = this.extractResults(ins?.actions);
            const leadsCaptured = leadsByCampaign.get(id) || 0;
            const lbl = labelByCampaign.get(id) || null;
            return {
                id,
                name: meta?.name ?? ins?.campaign_name ?? `(campaign ${id})`,
                status: meta?.status ?? null,
                effectiveStatus: meta?.effective_status ?? null,
                objective: meta?.objective ?? null,
                spend, impressions: this.num(ins?.impressions), clicks: this.num(ins?.clicks),
                ctr: this.num(ins?.ctr), results,
                costPerResult: results > 0 ? spend / results : null,
                leadsCaptured,
                costPerLead: leadsCaptured > 0 ? spend / leadsCaptured : null,
                labelId: lbl?.id ?? null,
                labelName: lbl?.name ?? null,
                labelBranchId: lbl?.branchId ?? null,
            };
        };

        let rows: CampaignRow[] = campaigns.map((c) => buildRow(String(c.id), c, insightById.get(String(c.id))));
        // Campaign yg punya insight tapi metadata-nya tak ada (mis. dihapus) — tetap tampilkan.
        for (const ins of insights) {
            const id = String(ins.campaign_id);
            if (rows.some((r) => r.id === id)) continue;
            rows.push(buildRow(id, null, ins));
        }
        rows.sort((a, b) => b.spend - a.spend);

        // Filter per label (opsional).
        if (opts.labelId != null) rows = rows.filter((r) => r.labelId === opts.labelId);

        const totals = rows.reduce(
            (t, r) => {
                t.spend += r.spend; t.impressions += r.impressions; t.clicks += r.clicks;
                t.results += r.results; t.leadsCaptured += r.leadsCaptured;
                return t;
            },
            { spend: 0, impressions: 0, clicks: 0, results: 0, leadsCaptured: 0 },
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

        return {
            account, since, until, currency: account.currency,
            totals: {
                ...totals,
                costPerLead: totals.leadsCaptured > 0 ? totals.spend / totals.leadsCaptured : null,
            },
            campaigns: rows,
            byLabel,
            unattributedLeads,
        };
    }

    /** Upsert cache MetaAdMap (best-effort, jangan gagalkan overview). */
    private async upsertAdMap(adToCampaign: Map<string, string>, adAccountId: string): Promise<void> {
        try {
            const entries = [...adToCampaign.entries()];
            for (const [adId, campaignId] of entries) {
                await this.prisma.metaAdMap.upsert({
                    where: { adId },
                    create: { adId, campaignId, adAccountId },
                    update: { campaignId, adAccountId },
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
            await this.prisma.metaCampaignLabel.deleteMany({ where: { campaignId: cid } });
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
}
