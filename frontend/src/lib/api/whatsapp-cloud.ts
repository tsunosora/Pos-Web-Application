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
    customName: string | null;
    phoneNormalized: string;
    leadId: number | null;
    customerId: number | null;
    optedOut: boolean;
    lead?: { id: number; name: string; status: string; source?: string; sourceDetail?: string | null; adId?: string | null; adLabel?: { id: number; name: string } | null } | null;
    customer?: { id: number; name: string; address: string | null } | null;
}

/** Nama tampilan kontak: kustom CS > nama profil WA > nomor. */
export function waContactName(c: { customName?: string | null; profileName?: string | null; waId: string }): string {
    return c.customName || c.profileName || `+${c.waId}`;
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
    mediaMimeType: string | null;
    waMessageId: string | null;
    reactionsJson: { customer?: string; agent?: string } | null;
    replyTo?: { id: number; direction: WaDirection; type: WaMessageType; body: string | null } | null;
    createdAt: string;
    sentBy?: { id: number; name: string | null } | null;
    // Payload interaktif mentah. Utk pesan produk katalog: { kind:'product', ... }
    // → dipakai render kartu produk di sisi agen (bukan cuma teks).
    payloadJson?: WaMessagePayload | null;
}
export interface WaMessagePayload {
    kind?: string;
    retailerId?: string;
    name?: string | null;
    image?: string | null;
    price?: string | null;
    description?: string | null;
    url?: string | null;
    [k: string]: unknown;
}

export interface Paged<T> {
    items: T[];
    nextCursor: number | null;
}

export interface ListConversationsParams {
    status?: WaConversationStatus;
    assignedToId?: number;
    assignee?: "me" | "unassigned" | "so"; // filter penugasan; "so" = chat pelanggan dari SO desainer
    channelId?: number;
    branchId?: number;
    q?: string;
    cursor?: number;
    take?: number;
}

export interface WaAgent {
    id: number;
    name: string | null;
    roleName: string | null;
    branchId: number | null;
}
export const listWaAgents = async (): Promise<WaAgent[]> =>
    (await api.get('/whatsapp/agents')).data;

// ─── Katalog produk Meta Commerce ────────────────────────────────────────────
export interface WaCatalogProduct {
    id: string;
    retailerId: string | null;
    name: string | null;
    description: string | null;
    price: string | null; // string terformat dari Meta (mis. "Rp250.000,00")
    currency: string | null;
    imageUrl: string | null;
    additionalImageUrls?: string[]; // galeri gambar tambahan
    url: string | null;
    availability: string | null;
    reviewStatus?: string | null; // status approval Meta: 'approved'|'pending'|'rejected'|'outdated'|'no_review'
    visibility?: string | null; // 'published'|'staging'|'hidden'
}
export interface CatalogProductBody {
    name?: string;
    description?: string | null;
    priceRupiah?: number;
    currency?: string;
    imageUrl?: string;
    additionalImageUrls?: string[];
    url?: string | null;
    availability?: string;
}
export const listWaCatalog = async (channelId: number): Promise<WaCatalogProduct[]> =>
    (await api.get('/whatsapp/catalog', { params: { channelId } })).data;

// Catalog ID manual per channel (lewati auto-deteksi #100).
export const getWaCatalogConfig = async (channelId: number): Promise<{ catalogId: string | null }> =>
    (await api.get('/whatsapp/catalog-config', { params: { channelId } })).data;
export const setWaCatalogConfig = async (channelId: number, catalogId: string | null): Promise<{ catalogId: string | null }> =>
    (await api.patch('/whatsapp/catalog-config', { channelId, catalogId })).data;

// Upload gambar produk → URL absolut (Content-Type multipart wajib agar file tak jadi JSON).
export const uploadWaCatalogImage = async (file: File): Promise<{ url: string; relative: string }> => {
    const fd = new FormData();
    fd.append('image', file);
    return (await api.post('/whatsapp/catalog/upload-image', fd, { headers: { 'Content-Type': 'multipart/form-data' } })).data;
};
export const createWaCatalogProduct = async (channelId: number, data: CatalogProductBody): Promise<{ id: string }> =>
    (await api.post('/whatsapp/catalog', { channelId, ...data })).data;
export const updateWaCatalogProduct = async (channelId: number, productId: string, data: CatalogProductBody): Promise<any> =>
    (await api.patch(`/whatsapp/catalog/${productId}`, { channelId, ...data })).data;
export const deleteWaCatalogProduct = async (channelId: number, productId: string): Promise<any> =>
    (await api.delete(`/whatsapp/catalog/${productId}`, { params: { channelId } })).data;

// Kirim 1 produk katalog ke percakapan (interactive product message).
export const sendWaProduct = async (
    conversationId: number,
    data: { productRetailerId: string; productName?: string; bodyText?: string; image?: string; price?: string; description?: string; url?: string },
): Promise<WaMessage> => (await api.post(`/whatsapp/conversations/${conversationId}/send-product`, data)).data;

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

// Deep-link "Buka chat WA" dari lead → resolve id percakapan.
export const resolveWaConversationByLead = async (leadId: number): Promise<{ conversationId: number | null }> =>
    (await api.get(`/whatsapp/leads/${leadId}/conversation`)).data;

export const getWaMessages = async (id: number, params: { cursor?: number; take?: number } = {}): Promise<Paged<WaMessage>> =>
    (await api.get(`/whatsapp/conversations/${id}/messages`, { params })).data;

// SO yang terkait sebuah percakapan (via nomor HP pelanggan) — badge "SO" di header.
export interface WaConversationSalesOrder {
    id: number;
    soNumber: string;
    status: string;
    designerName: string;
    customerName: string;
    createdAt: string;
}
export const getWaConversationSalesOrders = async (id: number): Promise<WaConversationSalesOrder[]> =>
    (await api.get(`/whatsapp/conversations/${id}/sales-orders`)).data;

// Resolve percakapan WA dari sebuah SO (tombol "Buka chat WA" di halaman SO).
export const resolveWaConversationBySalesOrder = async (soId: number): Promise<{ conversationId: number | null; phone: string | null }> =>
    (await api.get(`/whatsapp/sales-orders/${soId}/conversation`)).data;

// Ambil biner media (gambar/video/audio) sebagai object URL untuk <img>/<video>.
// Auth JWT ikut via axios; caller WAJIB URL.revokeObjectURL saat unmount.
export const getWaMessageMediaUrl = async (messageId: number): Promise<string> => {
    const res = await api.get(`/whatsapp/messages/${messageId}/media`, { responseType: 'blob' });
    return URL.createObjectURL(res.data as Blob);
};

// Unduh media apa pun (dokumen/gambar/dll) — memicu simpan berkas dgn nama asli.
export const downloadWaMessageMedia = async (messageId: number, fallbackName: string): Promise<void> => {
    const res = await api.get(`/whatsapp/messages/${messageId}/media`, { responseType: 'blob' });
    const cd = String(res.headers['content-disposition'] || '');
    const name = /filename="?([^"]+)"?/.exec(cd)?.[1] || fallbackName;
    const url = URL.createObjectURL(res.data as Blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
};

export const updateWaConversation = async (
    id: number,
    data: { assignedToId?: number | null; status?: WaConversationStatus; snoozedUntil?: string | null },
): Promise<WaConversation> => (await api.patch(`/whatsapp/conversations/${id}`, data)).data;

export const replyWaText = async (id: number, text: string, replyTo?: string): Promise<WaMessage> =>
    (await api.post(`/whatsapp/conversations/${id}/reply`, { text, replyTo })).data;

// CS set/ubah nama kontak (prioritas tampil). name kosong = reset ke nama profil WA.
export const setWaContactName = async (contactId: number, name: string | null): Promise<WaContactLite> =>
    (await api.patch(`/whatsapp/contacts/${contactId}/name`, { name })).data;

// Pesan cepat / canned message (BUKAN template Meta) — dipanggil "/" di composer.
export interface WaQuickReply {
    id: number;
    shortcut: string;
    title: string | null;
    body: string;
    isActive: boolean;
    sortOrder: number;
    createdAt: string;
    updatedAt: string;
}
export interface QuickReplyBody {
    shortcut: string;
    title?: string | null;
    body: string;
    sortOrder?: number;
}
export type UpdateQuickReplyBody = Partial<QuickReplyBody> & { isActive?: boolean };

export const listWaQuickReplies = async (): Promise<WaQuickReply[]> =>
    (await api.get('/whatsapp/quick-replies')).data;
export const createWaQuickReply = async (data: QuickReplyBody): Promise<WaQuickReply> =>
    (await api.post('/whatsapp/quick-replies', data)).data;
export const updateWaQuickReply = async (id: number, data: UpdateQuickReplyBody): Promise<WaQuickReply> =>
    (await api.patch(`/whatsapp/quick-replies/${id}`, data)).data;
export const deleteWaQuickReply = async (id: number): Promise<{ ok: boolean }> =>
    (await api.delete(`/whatsapp/quick-replies/${id}`)).data;

// Chat Baru: simpan nomor baru & kirim template pembuka → kembalikan conversationId.
export interface StartConversationBody {
    channelId: number;
    phone: string;
    name?: string;
    createLead?: boolean;
    template: { name: string; language?: string; components?: unknown[]; previewText?: string };
}
export const startWaConversation = async (body: StartConversationBody): Promise<{ conversationId: number }> =>
    (await api.post(`/whatsapp/conversations/start`, body)).data;

// Reaksi emoji ke sebuah pesan (emoji kosong = hapus reaksi agen).
export const reactWaMessage = async (messageId: number, emoji: string): Promise<WaMessage> =>
    (await api.post(`/whatsapp/messages/${messageId}/react`, { emoji })).data;

export const replyWaTemplate = async (
    id: number,
    data: { name: string; language?: string; components?: unknown[]; previewText?: string },
): Promise<WaMessage> => (await api.post(`/whatsapp/conversations/${id}/reply-template`, data)).data;

// Balas dengan lampiran (gambar/dokumen/file). caption opsional. Multipart via axios.
// WAJIB set Content-Type multipart: default client 'application/json' bikin axios
// mengubah FormData jadi JSON (file hilang → backend "berkas kosong").
export const replyWaMedia = async (id: number, file: File, caption?: string, replyTo?: string): Promise<WaMessage> => {
    const form = new FormData();
    form.append('file', file);
    if (caption) form.append('caption', caption);
    if (replyTo) form.append('replyTo', replyTo);
    return (await api.post(`/whatsapp/conversations/${id}/reply-media`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
    })).data;
};

// ─── Penyimpanan media (disk homelab) ────────────────────────────────────────
export interface WaMediaStats {
    baseDir: string;
    totalBytes: number;
    fileCount: number;
    diskFreeBytes: number;
    diskTotalBytes: number;
    byMonth: Array<{ month: string; bytes: number; files: number }>;
}
export const getWaMediaStats = async (): Promise<WaMediaStats> =>
    (await api.get('/whatsapp/media/storage/stats')).data;

export const cleanupWaMedia = async (before: string): Promise<{ deletedFiles: number; freedBytes: number }> =>
    (await api.post('/whatsapp/media/storage/cleanup', { before })).data;

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

export interface WaTokenStatus { configured: boolean; source: "db" | "env" | "none"; masked: string | null }
export const getWaAccessToken = async (): Promise<WaTokenStatus> => (await api.get('/whatsapp/access-token')).data;
export const setWaAccessToken = async (token: string | null): Promise<WaTokenStatus> =>
    (await api.post('/whatsapp/access-token', { token })).data;

export interface WaTokenDebug { valid: boolean; appId: string | null; type: string | null; scopes: string[]; expiresAt: number | null; error: string | null }
export const debugWaAccessToken = async (): Promise<WaTokenDebug> => (await api.get('/whatsapp/access-token/debug')).data;

export const listWaChannels = async (): Promise<WaChannel[]> => (await api.get('/whatsapp/channels')).data;

export const createWaChannel = async (data: CreateChannelBody): Promise<WaChannel> =>
    (await api.post('/whatsapp/channels', data)).data;

export const updateWaChannel = async (id: number, data: UpdateChannelBody): Promise<WaChannel> =>
    (await api.patch(`/whatsapp/channels/${id}`, data)).data;

export const deleteWaChannel = async (id: number): Promise<{ ok: boolean }> =>
    (await api.delete(`/whatsapp/channels/${id}`)).data;

// Profil bisnis WhatsApp (per nomor/channel) — dari Meta.
export interface WaBusinessProfile {
    about?: string;
    address?: string;
    description?: string;
    email?: string;
    vertical?: string;
    websites?: string[];
    profile_picture_url?: string;
}
export const getWaChannelProfile = async (id: number): Promise<WaBusinessProfile> =>
    (await api.get(`/whatsapp/channels/${id}/profile`)).data;
export const updateWaChannelProfile = async (id: number, data: Partial<WaBusinessProfile>): Promise<WaBusinessProfile> =>
    (await api.patch(`/whatsapp/channels/${id}/profile`, data)).data;
export const uploadWaChannelProfilePicture = async (id: number, file: File): Promise<WaBusinessProfile> => {
    const form = new FormData();
    form.append('file', file);
    return (await api.post(`/whatsapp/channels/${id}/profile-picture`, form, { headers: { 'Content-Type': 'multipart/form-data' } })).data;
};

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
    variableLabels: unknown;
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
    variableLabels?: string[] | null;
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
    source: 'profileName' | 'static' | 'column' | 'field';
    value?: string;
    columnIndex?: number;   // untuk source 'column' (impor CSV berkolom)
    field?: string;         // untuk source 'field' (otomatis dari data pelanggan): name|phone|address|city
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
    numbers?: string[];       // impor daftar nomor (CSV/paste) — alternatif segmen
    recipients?: Array<{ number: string; vars?: string[] }>; // CSV berkolom (personalisasi per-baris)
    customerIds?: number[];   // pilih pelanggan dari /customers (multi-select)
    variableMap?: VariableMapItem[];
    scheduledAt?: string | null;
}

export interface WaBroadcastContact {
    id: number;               // = customerId
    name: string;
    phone: string | null;
    address: string | null;
}
export const listBroadcastContacts = async (q?: string): Promise<WaBroadcastContact[]> =>
    (await api.get('/whatsapp/broadcast-contacts', { params: q ? { q } : {} })).data;

export const WA_BROADCAST_STATUS_LABEL: Record<WaBroadcastStatus, string> = {
    DRAFT: 'Draf', SCHEDULED: 'Terjadwal', RUNNING: 'Berjalan', PAUSED: 'Dijeda',
    COMPLETED: 'Selesai', FAILED: 'Gagal', CANCELLED: 'Dibatalkan',
};

export const listWaBroadcasts = async (): Promise<WaBroadcast[]> => (await api.get('/whatsapp/broadcasts')).data;

export const previewBroadcast = async (segment?: SegmentDef, numbers?: string[]): Promise<{ count: number; invalid?: number }> =>
    (await api.post('/whatsapp/broadcasts/preview', numbers?.length ? { numbers } : { segment })).data;

export const createWaBroadcast = async (data: CreateBroadcastBody): Promise<WaBroadcast> =>
    (await api.post('/whatsapp/broadcasts', data)).data;

export const getWaBroadcastReport = async (id: number): Promise<{ broadcast: WaBroadcast; counts: Record<string, number> }> =>
    (await api.get(`/whatsapp/broadcasts/${id}`)).data;

export type WaRecipientStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | 'SKIPPED';
export interface WaBroadcastRecipient {
    id: number;
    waId: string;
    name: string | null;
    status: WaRecipientStatus;
    errorMessage: string | null;
    sentAt: string | null;
}
export const getWaBroadcastRecipients = async (id: number, status?: string): Promise<WaBroadcastRecipient[]> =>
    (await api.get(`/whatsapp/broadcasts/${id}/recipients`, { params: status ? { status } : {} })).data;

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

// ─── Reminder POS ──────────────────────────────────────────────────────────

export type ReminderEvent = 'ORDER_READY' | 'PAYMENT_DUE' | 'FOLLOWUP_DUE';

export interface WaReminderConfig {
    eventType: ReminderEvent;
    enabled: boolean;
    channelId: number | null;
    templateId: number | null;
}

export const REMINDER_EVENT_LABEL: Record<ReminderEvent, string> = {
    ORDER_READY: 'Pesanan siap diambil',
    PAYMENT_DUE: 'Pengingat pembayaran',
    FOLLOWUP_DUE: 'Follow-up jatuh tempo',
};

export const getReminderConfigs = async (): Promise<WaReminderConfig[]> =>
    (await api.get('/whatsapp/reminders/config')).data;

export const setReminderConfig = async (
    eventType: ReminderEvent,
    data: { enabled?: boolean; channelId?: number | null; templateId?: number | null },
): Promise<WaReminderConfig> => (await api.patch(`/whatsapp/reminders/config/${eventType}`, data)).data;

// ─── Analitik ──────────────────────────────────────────────────────────────

export interface WaAnalytics {
    summary: {
        range: { from: string; to: string };
        messages: { inbound: number; outbound: number; delivered: number; read: number; failed: number };
        conversations: { new: number; open: number };
        contacts: { total: number; optedOut: number };
        leadsFromWa: number;
        broadcasts: { count: number; sent: number; failed: number };
    };
    series: Array<{ date: string; inbound: number; outbound: number }>;
    cost: {
        billable: { MARKETING: number; UTILITY: number; AUTHENTICATION: number };
        totalBillable: number;
        freeService: number;
    };
}

export interface WaBenchmarkAgent {
    userId: number; name: string; roleName?: string | null; isDesigner?: boolean;
    responses: number; avgSec: number; medianSec: number; fastestSec: number; withinSlaPct: number;
}
export interface WaBenchmarkOverall { responses: number; avgSec: number; medianSec: number }
export interface WaCsBenchmark {
    agents: WaBenchmarkAgent[];         // semua (kompat)
    csAgents?: WaBenchmarkAgent[];      // non-desainer (CS murni) — absen di backend lama
    designerAgents?: WaBenchmarkAgent[]; // desainer (dipisah) — absen di backend lama
    overall: WaBenchmarkOverall;        // CS saja (backend baru) / semua (backend lama)
    overallDesigner?: WaBenchmarkOverall;
    slaMinutes: number;
}
export const getWaCsBenchmark = async (params: { from?: string; to?: string; channelId?: number; slaMinutes?: number } = {}): Promise<WaCsBenchmark> =>
    (await api.get('/whatsapp/analytics/cs-benchmark', { params })).data;

export const getWaAnalytics = async (params: { from?: string; to?: string; channelId?: number } = {}): Promise<WaAnalytics> =>
    (await api.get('/whatsapp/analytics', { params })).data;

/** Apakah percakapan masih dalam jendela layanan 24 jam (boleh kirim teks bebas). */
export function isWindowOpen(conv: Pick<WaConversation, 'windowExpiresAt'>): boolean {
    return !!conv.windowExpiresAt && new Date(conv.windowExpiresAt).getTime() > Date.now();
}

// ─── QR klik-untuk-chat ──────────────────────────────────────────────────────

export interface WaQrLink {
    id: number;
    name: string;
    code: string;
    channelId: number | null;
    source: string;
    sourceDetail: string | null;
    prefillText: string;
    scanCount: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface CreateQrLinkBody {
    name: string;
    code?: string;
    channelId?: number | null;
    source?: string;
    sourceDetail?: string | null;
    prefillText?: string;
}
export type UpdateQrLinkBody = Partial<CreateQrLinkBody> & { isActive?: boolean };

export const listWaQrLinks = async (): Promise<WaQrLink[]> => (await api.get('/whatsapp/qr-links')).data;

export const createWaQrLink = async (data: CreateQrLinkBody): Promise<WaQrLink> =>
    (await api.post('/whatsapp/qr-links', data)).data;

export const updateWaQrLink = async (id: number, data: UpdateQrLinkBody): Promise<WaQrLink> =>
    (await api.patch(`/whatsapp/qr-links/${id}`, data)).data;

export const deleteWaQrLink = async (id: number): Promise<{ ok: boolean }> =>
    (await api.delete(`/whatsapp/qr-links/${id}`)).data;

/** Bangun URL wa.me klik-untuk-chat dari nomor tujuan + pesan prefill. */
export function buildWaMeLink(phone: string | null | undefined, text: string): string {
    const num = (phone || '').replace(/[^0-9]/g, '');
    const q = text ? `?text=${encodeURIComponent(text)}` : '';
    return `https://wa.me/${num}${q}`;
}
