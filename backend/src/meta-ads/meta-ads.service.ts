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
    async overview(opts: { since?: string; until?: string; accountId?: string }): Promise<AdsOverview> {
        const until = opts.until || this.ymd(new Date());
        const since = opts.since || this.ymd(new Date(Date.now() - 29 * 86_400_000));
        const account = await this.resolveAccount(opts.accountId);
        if (!account) {
            return {
                account: null, since, until, currency: null,
                totals: { spend: 0, impressions: 0, clicks: 0, results: 0, leadsCaptured: 0, costPerLead: null },
                campaigns: [], unattributedLeads: 0,
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

        // 5) Gabung: metadata + insight + lead per campaign.
        const insightById = new Map<string, any>();
        for (const ins of insights) if (ins?.campaign_id) insightById.set(String(ins.campaign_id), ins);

        const rows: CampaignRow[] = campaigns.map((c) => {
            const id = String(c.id);
            const ins = insightById.get(id);
            const spend = this.num(ins?.spend);
            const impressions = this.num(ins?.impressions);
            const clicks = this.num(ins?.clicks);
            const ctr = this.num(ins?.ctr);
            const results = this.extractResults(ins?.actions);
            const leadsCaptured = leadsByCampaign.get(id) || 0;
            return {
                id,
                name: c.name ?? '(tanpa nama)',
                status: c.status ?? null,
                effectiveStatus: c.effective_status ?? null,
                objective: c.objective ?? null,
                spend, impressions, clicks, ctr, results,
                costPerResult: results > 0 ? spend / results : null,
                leadsCaptured,
                costPerLead: leadsCaptured > 0 ? spend / leadsCaptured : null,
            };
        });
        // Campaign yg punya insight tapi metadata-nya tak ada (mis. dihapus) — tetap tampilkan.
        for (const ins of insights) {
            const id = String(ins.campaign_id);
            if (rows.some((r) => r.id === id)) continue;
            const spend = this.num(ins?.spend);
            const results = this.extractResults(ins?.actions);
            const leadsCaptured = leadsByCampaign.get(id) || 0;
            rows.push({
                id, name: ins.campaign_name ?? `(campaign ${id})`, status: null, effectiveStatus: null,
                objective: null, spend, impressions: this.num(ins?.impressions), clicks: this.num(ins?.clicks),
                ctr: this.num(ins?.ctr), results, costPerResult: results > 0 ? spend / results : null,
                leadsCaptured, costPerLead: leadsCaptured > 0 ? spend / leadsCaptured : null,
            });
        }
        rows.sort((a, b) => b.spend - a.spend);

        const totals = rows.reduce(
            (t, r) => {
                t.spend += r.spend; t.impressions += r.impressions; t.clicks += r.clicks;
                t.results += r.results; t.leadsCaptured += r.leadsCaptured;
                return t;
            },
            { spend: 0, impressions: 0, clicks: 0, results: 0, leadsCaptured: 0 },
        );

        return {
            account, since, until, currency: account.currency,
            totals: {
                ...totals,
                costPerLead: totals.leadsCaptured > 0 ? totals.spend / totals.leadsCaptured : null,
            },
            campaigns: rows,
            unattributedLeads,
        };
    }
}
