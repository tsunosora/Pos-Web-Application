// WhatsApp CRM (Cloud API resmi Meta) — API client.
// TERPISAH dari `whatsapp.ts` (bot lama whatsapp-web.js). Pakai axios instance
// `api` (JWT + X-Branch-Id otomatis).
import api from './client';

export type WaConversationStatus = 'OPEN' | 'PENDING' | 'SNOOZED' | 'CLOSED';
export type WaDirection = 'INBOUND' | 'OUTBOUND';
export type WaMessageType =
    | 'TEXT' | 'IMAGE' | 'DOCUMENT' | 'AUDIO' | 'VIDEO' | 'STICKER'
    | 'TEMPLATE' | 'LOCATION' | 'CONTACT' | 'INTERACTIVE' | 'UNKNOWN';
export type WaMessageStatus = 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';

export interface WaContactLite {
    id: number;
    waId: string;
    profileName: string | null;
    phoneNormalized: string;
    leadId: number | null;
    customerId: number | null;
    optedOut: boolean;
}

export interface WaConversation {
    id: number;
    status: WaConversationStatus;
    assignedToId: number | null;
    assignedTo?: { id: number; name: string | null } | null;
    lastMessageAt: string | null;
    windowExpiresAt: string | null;
    unreadCount: number;
    contact: WaContactLite;
    channel: { id: number; label: string; branchId: number | null };
}

export interface WaMessage {
    id: number;
    direction: WaDirection;
    type: WaMessageType;
    status: WaMessageStatus;
    body: string | null;
    templateName: string | null;
    mediaUrl: string | null;
    waMessageId: string | null;
    createdAt: string;
    sentBy?: { id: number; name: string | null } | null;
}

export interface Paged<T> {
    items: T[];
    nextCursor: number | null;
}

export interface ListConversationsParams {
    status?: WaConversationStatus;
    assignedToId?: number;
    channelId?: number;
    branchId?: number;
    q?: string;
    cursor?: number;
    take?: number;
}

export const WA_STATUS_LABEL: Record<WaConversationStatus, string> = {
    OPEN: 'Terbuka',
    PENDING: 'Menunggu',
    SNOOZED: 'Ditunda',
    CLOSED: 'Selesai',
};

export const listWaConversations = async (params: ListConversationsParams = {}): Promise<Paged<WaConversation>> =>
    (await api.get('/whatsapp/conversations', { params })).data;

export const getWaConversation = async (id: number): Promise<WaConversation> =>
    (await api.get(`/whatsapp/conversations/${id}`)).data;

export const getWaMessages = async (id: number, params: { cursor?: number; take?: number } = {}): Promise<Paged<WaMessage>> =>
    (await api.get(`/whatsapp/conversations/${id}/messages`, { params })).data;

export const updateWaConversation = async (
    id: number,
    data: { assignedToId?: number | null; status?: WaConversationStatus; snoozedUntil?: string | null },
): Promise<WaConversation> => (await api.patch(`/whatsapp/conversations/${id}`, data)).data;

export const replyWaText = async (id: number, text: string): Promise<WaMessage> =>
    (await api.post(`/whatsapp/conversations/${id}/reply`, { text })).data;

export const replyWaTemplate = async (
    id: number,
    data: { name: string; language?: string; components?: unknown[]; previewText?: string },
): Promise<WaMessage> => (await api.post(`/whatsapp/conversations/${id}/reply-template`, data)).data;

export interface WaHealth {
    enabled: boolean;
    channelCount: number;
    channels: Array<{
        id: number;
        label: string;
        phoneNumberId: string;
        branchId: number | null;
        ok: boolean;
        verifiedName?: string;
        displayNumber?: string;
        error?: string;
    }>;
}

export const getWaHealth = async (): Promise<WaHealth> => (await api.get('/whatsapp/health')).data;

// ─── Channel (nomor per cabang) ────────────────────────────────────────────

export interface WaChannel {
    id: number;
    label: string;
    phoneNumberId: string;
    wabaId: string;
    displayNumber: string | null;
    branchId: number | null;
    isActive: boolean;
    branch?: { id: number; name: string } | null;
    _count?: { conversations: number };
}

export interface CreateChannelBody {
    label: string;
    phoneNumberId: string;
    wabaId: string;
    displayNumber?: string | null;
    branchId?: number | null;
}
export type UpdateChannelBody = Partial<Omit<CreateChannelBody, 'phoneNumberId'>> & { isActive?: boolean };

export const listWaChannels = async (): Promise<WaChannel[]> => (await api.get('/whatsapp/channels')).data;

export const createWaChannel = async (data: CreateChannelBody): Promise<WaChannel> =>
    (await api.post('/whatsapp/channels', data)).data;

export const updateWaChannel = async (id: number, data: UpdateChannelBody): Promise<WaChannel> =>
    (await api.patch(`/whatsapp/channels/${id}`, data)).data;

export const deleteWaChannel = async (id: number): Promise<{ ok: boolean }> =>
    (await api.delete(`/whatsapp/channels/${id}`)).data;

// ─── Template Meta ─────────────────────────────────────────────────────────

export type WaTemplateStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAUSED' | 'DISABLED';

export interface WaTemplate {
    id: number;
    name: string;
    language: string;
    category: string;
    status: WaTemplateStatus;
    bodyText: string;
    headerText: string | null;
    footerText: string | null;
    buttonsJson: unknown;
    variableSample: unknown;
    metaTemplateId: string | null;
    submittedWabaId: string | null;
    rejectedReason: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface TemplateBody {
    name: string;
    language?: string;
    category?: string;
    bodyText: string;
    headerText?: string | null;
    footerText?: string | null;
    variableSample?: string[] | null;
}

export const WA_TEMPLATE_STATUS_LABEL: Record<WaTemplateStatus, string> = {
    DRAFT: 'Draf', PENDING: 'Menunggu Review', APPROVED: 'Disetujui',
    REJECTED: 'Ditolak', PAUSED: 'Dijeda', DISABLED: 'Dinonaktifkan',
};

export const listWaTemplates = async (): Promise<WaTemplate[]> => (await api.get('/whatsapp/templates')).data;

export const createWaTemplate = async (data: TemplateBody): Promise<WaTemplate> =>
    (await api.post('/whatsapp/templates', data)).data;

export const updateWaTemplate = async (id: number, data: Partial<TemplateBody>): Promise<WaTemplate> =>
    (await api.patch(`/whatsapp/templates/${id}`, data)).data;

export const deleteWaTemplate = async (id: number): Promise<{ ok: boolean }> =>
    (await api.delete(`/whatsapp/templates/${id}`)).data;

export const submitWaTemplate = async (id: number, channelId: number): Promise<WaTemplate> =>
    (await api.post(`/whatsapp/templates/${id}/submit`, { channelId })).data;

export const syncWaTemplates = async (channelId: number): Promise<{ fetched: number; updated: number }> =>
    (await api.post('/whatsapp/templates/sync', { channelId })).data;

// ─── Broadcast ─────────────────────────────────────────────────────────────

export type WaBroadcastStatus = 'DRAFT' | 'SCHEDULED' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface SegmentDef {
    onlyLinked?: boolean;
    leadStatus?: string;
}
export interface VariableMapItem {
    source: 'profileName' | 'static';
    value?: string;
}
export interface WaBroadcast {
    id: number;
    name: string;
    channelId: number;
    templateId: number;
    status: WaBroadcastStatus;
    scheduledAt: string | null;
    startedAt: string | null;
    completedAt: string | null;
    totalCount: number;
    sentCount: number;
    failedCount: number;
    createdAt: string;
    channel?: { id: number; label: string };
    template?: { id: number; name: string; status: string };
}
export interface CreateBroadcastBody {
    name: string;
    channelId: number;
    templateId: number;
    segment?: SegmentDef;
    variableMap?: VariableMapItem[];
    scheduledAt?: string | null;
}

export const WA_BROADCAST_STATUS_LABEL: Record<WaBroadcastStatus, string> = {
    DRAFT: 'Draf', SCHEDULED: 'Terjadwal', RUNNING: 'Berjalan', PAUSED: 'Dijeda',
    COMPLETED: 'Selesai', FAILED: 'Gagal', CANCELLED: 'Dibatalkan',
};

export const listWaBroadcasts = async (): Promise<WaBroadcast[]> => (await api.get('/whatsapp/broadcasts')).data;

export const previewBroadcast = async (segment?: SegmentDef): Promise<{ count: number }> =>
    (await api.post('/whatsapp/broadcasts/preview', { segment })).data;

export const createWaBroadcast = async (data: CreateBroadcastBody): Promise<WaBroadcast> =>
    (await api.post('/whatsapp/broadcasts', data)).data;

export const getWaBroadcastReport = async (id: number): Promise<{ broadcast: WaBroadcast; counts: Record<string, number> }> =>
    (await api.get(`/whatsapp/broadcasts/${id}`)).data;

export const runWaBroadcast = async (id: number) => (await api.post(`/whatsapp/broadcasts/${id}/run`)).data;
export const pauseWaBroadcast = async (id: number) => (await api.post(`/whatsapp/broadcasts/${id}/pause`)).data;
export const resumeWaBroadcast = async (id: number) => (await api.post(`/whatsapp/broadcasts/${id}/resume`)).data;
export const cancelWaBroadcast = async (id: number) => (await api.post(`/whatsapp/broadcasts/${id}/cancel`)).data;

// ─── Auto-reply ────────────────────────────────────────────────────────────

export type WaAutoReplyTrigger = 'KEYWORD' | 'GREETING' | 'AWAY' | 'DEFAULT';

export interface WaAutoReplyRule {
    id: number;
    channelId: number | null;
    trigger: WaAutoReplyTrigger;
    keywords: string[] | null;
    replyText: string;
    isActive: boolean;
    priority: number;
}
export interface AutoReplyBody {
    channelId?: number | null;
    trigger: WaAutoReplyTrigger;
    keywords?: string[] | null;
    replyText: string;
    priority?: number;
    isActive?: boolean;
}

export const WA_TRIGGER_LABEL: Record<WaAutoReplyTrigger, string> = {
    KEYWORD: 'Kata kunci', GREETING: 'Salam pembuka', AWAY: 'Di luar jam', DEFAULT: 'Default',
};

export const listAutoReplies = async (): Promise<WaAutoReplyRule[]> => (await api.get('/whatsapp/auto-replies')).data;
export const createAutoReply = async (data: AutoReplyBody): Promise<WaAutoReplyRule> =>
    (await api.post('/whatsapp/auto-replies', data)).data;
export const updateAutoReply = async (id: number, data: Partial<AutoReplyBody>): Promise<WaAutoReplyRule> =>
    (await api.patch(`/whatsapp/auto-replies/${id}`, data)).data;
export const deleteAutoReply = async (id: number): Promise<{ ok: boolean }> =>
    (await api.delete(`/whatsapp/auto-replies/${id}`)).data;

/** Apakah percakapan masih dalam jendela layanan 24 jam (boleh kirim teks bebas). */
export function isWindowOpen(conv: Pick<WaConversation, 'windowExpiresAt'>): boolean {
    return !!conv.windowExpiresAt && new Date(conv.windowExpiresAt).getTime() > Date.now();
}
