// Discord notification config API
import api from './client';

export type DiscordChannelKey =
    | 'sales' | 'production' | 'finance' | 'inventory' | 'leaderboard' | 'system';
export type DiscordEventKey =
    | 'shiftRecap' | 'newLead' | 'dealClosing' | 'jobReady' | 'lowStock' | 'backup' | 'error' | 'champion' | 'suratOrder' | 'newTransaction';

export type DiscordWebhooks = Partial<Record<DiscordChannelKey, string>>;

export interface DiscordConfig {
    enabled: boolean;
    webhooks: DiscordWebhooks; // global / sistem
    events: Partial<Record<DiscordEventKey, boolean>>;
    branchConfigs: Record<string, { webhooks: DiscordWebhooks }>; // keyed by branchId
}

export const getDiscordConfig = async (): Promise<DiscordConfig> =>
    (await api.get('/discord/config')).data;

export const updateDiscordConfig = async (data: Partial<DiscordConfig>): Promise<DiscordConfig> =>
    (await api.patch('/discord/config', data)).data;

/** Test webhook satu channel. branchId null/undefined → uji webhook global. */
export const testDiscordChannel = async (
    channel: DiscordChannelKey,
    branchId?: number | null,
): Promise<{ ok: boolean; message: string }> =>
    (await api.post(`/discord/test/${channel}`, { branchId: branchId ?? null })).data;

export interface CompanyBranchLite { id: number; name: string; code?: string | null }

export const getActiveCompanyBranches = async (): Promise<CompanyBranchLite[]> =>
    (await api.get('/company-branches/active')).data;
