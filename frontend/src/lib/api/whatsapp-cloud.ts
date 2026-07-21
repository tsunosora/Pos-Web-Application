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

/** Apakah percakapan masih dalam jendela layanan 24 jam (boleh kirim teks bebas). */
export function isWindowOpen(conv: Pick<WaConversation, 'windowExpiresAt'>): boolean {
    return !!conv.windowExpiresAt && new Date(conv.windowExpiresAt).getTime() > Date.now();
}
