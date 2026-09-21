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

// Diagnostik: webhook terakhir yang diterima server dari Meta.
export interface SocialWebhookDebug { lastWebhook: { at: string; object: string | null; entries: number; fields?: string; signatureOk: boolean | null } | null }
export const getSocialWebhookDebug = async (): Promise<SocialWebhookDebug> => (await api.get('/social/webhook-debug')).data;

// Tes token + akses akun sebelum simpan.
export const testSocialConnection = async (body: { platform: SocialPlatform; pageId?: string; igId?: string; accessToken: string }): Promise<{ ok: boolean; id: string; name: string | null }> =>
    (await api.post('/social/test-connection', body)).data;

// Ambil daftar Page + Page token dari token login (User/System User).
export interface FbPage { id: string; name: string; accessToken: string; ig: { id: string; username: string | null } | null }
export const listPagesFromToken = async (token: string): Promise<FbPage[]> =>
    (await api.post('/social/pages-from-token', { token })).data;

export const listSocialConversations = async (params: { platform?: SocialPlatform; q?: string; take?: number } = {}): Promise<Paged<SocialConversation>> =>
    (await api.get('/social/conversations', { params })).data;
export const getSocialMessages = async (id: number, params: { cursor?: number; take?: number } = {}): Promise<Paged<SocialMessage>> =>
    (await api.get(`/social/conversations/${id}/messages`, { params })).data;
export const replySocial = async (id: number, text: string): Promise<SocialMessage> =>
    (await api.post(`/social/conversations/${id}/reply`, { text })).data;

// ─── Penghitung tab & prospek ────────────────────────────────────────────────
export interface SocialCounts {
    dm: Record<SocialPlatform, number>;       // percakapan DM belum dibaca
    comments: Record<SocialPlatform, number>; // utas komentar belum dibaca
}
export const getSocialCounts = async (): Promise<SocialCounts> => (await api.get('/social/counts')).data;
export const createLeadFromSocialContact = async (contactId: number): Promise<{ leadId: number; existed: boolean }> =>
    (await api.post(`/social/contacts/${contactId}/lead`)).data;
export const subscribeSocialChannel = async (id: number): Promise<{ ok: boolean; fields: string[] }> =>
    (await api.post(`/social/channels/${id}/subscribe`)).data;

// ─── Komentar postingan IG / FB ──────────────────────────────────────────────
export interface SocialPostLite {
    id: number;
    externalId: string;
    caption: string | null;
    permalink: string | null;
    mediaUrl: string | null;
    postedAt: string | null;
}
export interface SocialComment {
    id: number;
    rootId: number | null;
    externalId: string;
    authorExternalId: string | null;
    authorName: string | null;
    direction: 'INBOUND' | 'OUTBOUND';
    body: string | null;
    isHidden: boolean;
    privateReplyAt: string | null;
    commentedAt: string;
    sentBy?: { id: number; name: string | null } | null;
}
/** Komentar teratas = utas. `replies` di daftar hanya berisi 1 balasan terakhir. */
export interface SocialCommentThread extends SocialComment {
    isRead: boolean;
    needsReply: boolean;
    lastActivityAt: string | null;
    post: SocialPostLite;
    channel: { id: number; label: string; platform: SocialPlatform; branchId: number | null };
    lead: { id: number; name: string; status: string } | null;
    replies: SocialComment[];
    _count?: { replies: number };
    otherThreadsOnPost?: number;
}
export type CommentFilter = 'all' | 'unread' | 'needs_reply' | 'hidden';
export interface CommentSyncResult {
    results: Array<{ channelId: number; label: string; platform: SocialPlatform; posts: number; added: number; error: string | null }>;
}

export const listSocialComments = async (params: { platform?: SocialPlatform; filter?: CommentFilter; q?: string; take?: number } = {}): Promise<Paged<SocialCommentThread>> =>
    (await api.get('/social/comments', { params: { ...params, filter: params.filter === 'all' ? undefined : params.filter } })).data;
export const getSocialCommentThread = async (id: number): Promise<SocialCommentThread> => (await api.get(`/social/comments/${id}`)).data;
export const replySocialComment = async (id: number, body: { text: string; mode: 'public' | 'private'; targetId?: number }) =>
    (await api.post(`/social/comments/${id}/reply`, body)).data;
export const hideSocialComment = async (id: number, hidden: boolean): Promise<{ ok: boolean }> =>
    (await api.post(`/social/comments/${id}/hide`, { hidden })).data;
export const updateSocialCommentThread = async (id: number, body: { isRead?: boolean; needsReply?: boolean }): Promise<{ ok: boolean }> =>
    (await api.patch(`/social/comments/${id}`, body)).data;
export const createLeadFromSocialComment = async (id: number): Promise<{ leadId: number; existed: boolean }> =>
    (await api.post(`/social/comments/${id}/lead`)).data;
export const syncSocialComments = async (): Promise<CommentSyncResult> => (await api.post('/social/comments/sync')).data;
export interface CommentSyncStatus {
    intervalMinutes: number | null; // null = sinkron otomatis dimatikan
    lastSyncAt: string | null;
    auto: boolean | null;
    results: CommentSyncResult['results'];
    running: boolean;
}
export const getSocialSyncStatus = async (): Promise<CommentSyncStatus> => (await api.get('/social/comments/sync-status')).data;
