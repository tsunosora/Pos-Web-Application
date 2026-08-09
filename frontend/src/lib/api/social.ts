import api from './client';

export type SocialPlatform = 'MESSENGER' | 'INSTAGRAM';
export const PLATFORM_LABEL: Record<SocialPlatform, string> = { MESSENGER: 'Messenger', INSTAGRAM: 'Instagram' };

export interface SocialChannel {
    id: number;
    label: string;
    platform: SocialPlatform;
    pageId: string;
    igId: string | null;
    branchId: number | null;
    isActive: boolean;
    branch?: { id: number; name: string } | null;
}
export interface CreateSocialChannelBody {
    label: string;
    platform: SocialPlatform;
    pageId: string;
    igId?: string | null;
    accessToken: string;
    branchId?: number | null;
}

export interface SocialContactLite {
    id: number;
    externalId: string;
    name: string | null;
    platform: SocialPlatform;
    leadId: number | null;
    customerId: number | null;
    lead?: { id: number; name: string; status: string } | null;
}
export interface SocialConversation {
    id: number;
    status: string;
    unreadCount: number;
    lastMessageAt: string | null;
    assignedToId: number | null;
    assignedTo?: { id: number; name: string | null } | null;
    contact: SocialContactLite;
    channel: { id: number; label: string; platform: SocialPlatform; branchId: number | null };
}
export interface SocialMessage {
    id: number;
    direction: 'INBOUND' | 'OUTBOUND';
    type: string;
    body: string | null;
    mediaUrl: string | null;
    createdAt: string;
    sentBy?: { id: number; name: string | null } | null;
}
export interface Paged<T> { items: T[]; nextCursor: number | null }

export const listSocialChannels = async (): Promise<SocialChannel[]> => (await api.get('/social/channels')).data;
export const createSocialChannel = async (data: CreateSocialChannelBody): Promise<{ id: number }> =>
    (await api.post('/social/channels', data)).data;
export const updateSocialChannel = async (id: number, data: Partial<CreateSocialChannelBody> & { isActive?: boolean }) =>
    (await api.patch(`/social/channels/${id}`, data)).data;
export const deleteSocialChannel = async (id: number): Promise<{ ok: boolean }> =>
    (await api.delete(`/social/channels/${id}`)).data;

// Deteksi IG business account yang terhubung ke Page (isi otomatis IG ID).
export const detectSocialInstagram = async (pageId: string, accessToken: string): Promise<{ id: string; username: string | null; name: string | null }> =>
    (await api.post('/social/detect-ig', { pageId, accessToken })).data;

export const listSocialConversations = async (params: { platform?: SocialPlatform; q?: string; take?: number } = {}): Promise<Paged<SocialConversation>> =>
    (await api.get('/social/conversations', { params })).data;
export const getSocialMessages = async (id: number, params: { cursor?: number; take?: number } = {}): Promise<Paged<SocialMessage>> =>
    (await api.get(`/social/conversations/${id}/messages`, { params })).data;
export const replySocial = async (id: number, text: string): Promise<SocialMessage> =>
    (await api.post(`/social/conversations/${id}/reply`, { text })).data;
