import api from './client';

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
    spend: number;
    impressions: number;
    clicks: number;
    ctr: number;
    results: number;
    costPerResult: number | null;
    leadsCaptured: number;
    closings: number;
    omzet: number;
    roas: number | null;
    productProfit: number | null;
    cprTarget: number | null;
    labelId: number | null;
    labelName: string | null;
    labelBranchId: number | null;
}

export interface VideoMetrics { plays: number; p25: number; p50: number; p75: number; p100: number; }

export interface AdRow {
    id: string;
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

export interface LabelSummary {
    labelId: number | null;
    labelName: string;
    spend: number;
    leadsCaptured: number;
    results: number;
    costPerLead: number | null;
}

export interface BranchSummary {
    branchId: number | null;
    branchName: string;
    leadsCaptured: number;
    closings: number;
    omzet: number;
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
        roas: number | null;
        avgCtr: number;
    };
    campaigns: CampaignRow[];
    byLabel: LabelSummary[];
    byBranch: BranchSummary[];
    unattributedLeads: number;
}

export interface AdLabelRow {
    id: number;
    name: string;
    branchId: number | null;
    branchName: string | null;
    campaignCount: number;
}

export const getAdAccounts = async (): Promise<AdAccount[]> =>
    (await api.get('/meta-ads/accounts')).data;

export const getAdsOverview = async (params: {
    since?: string;
    until?: string;
    accountId?: string;
    labelId?: number;
}): Promise<AdsOverview> => {
    const q = new URLSearchParams();
    if (params.since) q.append('since', params.since);
    if (params.until) q.append('until', params.until);
    if (params.accountId) q.append('accountId', params.accountId);
    if (params.labelId != null) q.append('labelId', String(params.labelId));
    return (await api.get(`/meta-ads/overview?${q.toString()}`)).data;
};

export const setAdAccount = async (accountId: string | null): Promise<{ ok: true }> =>
    (await api.post('/meta-ads/account', { accountId })).data;

// ─── Label custom iklan ──────────────────────────────────────────────────────
export const getAdLabels = async (): Promise<AdLabelRow[]> =>
    (await api.get('/meta-ads/labels')).data;

export const upsertAdLabel = async (name: string, branchId?: number | null): Promise<AdLabelRow> =>
    (await api.post('/meta-ads/labels', { name, branchId })).data;

export const deleteAdLabel = async (id: number): Promise<{ ok: true }> =>
    (await api.post('/meta-ads/labels/delete', { id })).data;

export const assignCampaignLabel = async (
    campaignId: string,
    labelId: number | null,
    accountId?: string,
): Promise<{ ok: true; updatedLeads: number }> =>
    (await api.post('/meta-ads/campaign-label', { campaignId, labelId, accountId })).data;

export const setCampaignProfit = async (
    campaignId: string,
    profit: number | null,
    accountId?: string,
): Promise<{ ok: true }> =>
    (await api.post('/meta-ads/campaign-profit', { campaignId, profit, accountId })).data;

export interface AdBreakdown { campaignId: string; since: string; until: string; ads: AdRow[]; }

export const getAdBreakdown = async (campaignId: string, since?: string, until?: string): Promise<AdBreakdown> => {
    const q = new URLSearchParams({ campaignId });
    if (since) q.append('since', since);
    if (until) q.append('until', until);
    return (await api.get(`/meta-ads/ads?${q.toString()}`)).data;
};
