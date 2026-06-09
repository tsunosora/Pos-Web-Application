// Discord notification config API
import api from './client';

export type DiscordChannelKey =
    | 'sales' | 'production' | 'finance' | 'inventory' | 'leaderboard' | 'system';
export type DiscordEventKey =
    | 'shiftRecap' | 'newLead' | 'dealClosing' | 'jobReady' | 'lowStock' | 'backup' | 'error' | 'champion';

export interface DiscordConfig {
    enabled: boolean;
    webhooks: Partial<Record<DiscordChannelKey, string>>;
    events: Partial<Record<DiscordEventKey, boolean>>;
}

export const getDiscordConfig = async (): Promise<DiscordConfig> =>
    (await api.get('/discord/config')).data;

export const updateDiscordConfig = async (data: Partial<DiscordConfig>): Promise<DiscordConfig> =>
    (await api.patch('/discord/config', data)).data;

export const testDiscordChannel = async (
    channel: DiscordChannelKey,
): Promise<{ ok: boolean; message: string }> =>
    (await api.post(`/discord/test/${channel}`)).data;
