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
    costPerLead: number | null;
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
    unattributedLeads: number;
}

export const getAdAccounts = async (): Promise<AdAccount[]> =>
    (await api.get('/meta-ads/accounts')).data;

export const getAdsOverview = async (params: {
    since?: string;
    until?: string;
    accountId?: string;
}): Promise<AdsOverview> => {
    const q = new URLSearchParams();
    if (params.since) q.append('since', params.since);
    if (params.until) q.append('until', params.until);
    if (params.accountId) q.append('accountId', params.accountId);
    return (await api.get(`/meta-ads/overview?${q.toString()}`)).data;
};

export const setAdAccount = async (accountId: string | null): Promise<{ ok: true }> =>
    (await api.post('/meta-ads/account', { accountId })).data;
