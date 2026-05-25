// CRM API client — Leads + Activities + Templates
// Pakai axios instance `api` yang sudah punya JWT interceptor + X-Branch-Id header.
import api from './client';

// ─── Types ───────────────────────────────────────────────────────────────────

export type LeadSource =
    | 'WHATSAPP' | 'INSTAGRAM' | 'FACEBOOK' | 'TIKTOK'
    | 'MARKETPLACE' | 'REFERRAL' | 'WEBSITE' | 'WALK_IN'
    | 'REPEAT_ORDER' | 'OTHER';

export type LeadStatus =
    | 'NEW' | 'FOLLOW_UP' | 'NEGOTIATION' | 'CLOSED_WON' | 'CLOSED_LOST';

export type LeadLevel = 'HOT' | 'WARM' | 'COLD';

export const LEAD_SOURCE_LABEL: Record<LeadSource, string> = {
    WHATSAPP: 'WhatsApp',
    INSTAGRAM: 'Instagram',
    FACEBOOK: 'Facebook',
    TIKTOK: 'TikTok',
    MARKETPLACE: 'Marketplace',
    REFERRAL: 'Referral',
    WEBSITE: 'Website',
    WALK_IN: 'Walk-in',
    REPEAT_ORDER: 'Repeat Order',
    OTHER: 'Lainnya',
};

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
    NEW: 'Baru',
    FOLLOW_UP: 'Follow Up',
    NEGOTIATION: 'Negosiasi',
    CLOSED_WON: 'Closing ✓',
    CLOSED_LOST: 'Hilang ✗',
};

export const LEAD_LEVEL_LABEL: Record<LeadLevel, string> = {
    HOT: '🔥 Hot',
    WARM: '🌤️ Warm',
    COLD: '❄️ Cold',
};

export interface LeadItem {
    id?: number;
    productVariantId?: number | null;
    description: string;
    quantity: number;
    unitPrice: number;
    widthCm?: number | null;
    heightCm?: number | null;
    unitType?: string | null;
    note?: string | null;
    // Include info untuk display (read-only)
    productVariant?: {
        id: number;
        sku: string;
        variantName: string | null;
        price: string | number;
        product: { id: number; name: string; pricingMode: string };
    } | null;
}

export interface LeadImage {
    id: number;
    filename: string;
    caption: string | null;
    position: number;
}

export interface Lead {
    id: number;
    name: string;
    phone: string | null;
    phoneNormalized: string | null;
    source: LeadSource;
    sourceDetail: string | null;
    status: LeadStatus;
    level: LeadLevel;
    needs: string | null;
    estimatedValue: string | number | null;
    city: string | null;
    assignedToId: number | null;
    followUpDate: string | null;
    deliveryDeadline: string | null;
    firstResponseAt: string | null;
    convertedCustomerId: number | null;
    convertedSalesOrderId: number | null;
    closeLostReason: string | null;
    imageUrl: string | null;       // DEPRECATED — first image dari images array
    images?: LeadImage[];           // multi-image (urutan = posisi slider)
    branchId: number | null;
    createdById: number | null;
    createdAt: string;
    updatedAt: string;
    closedAt: string | null;
    // Includes
    assignedTo?: { id: number; name: string | null; email: string } | null;
    createdBy?: { id: number; name: string | null } | null;
    branch?: { id: number; name: string; code: string | null } | null;
    convertedCustomer?: { id: number; name: string; phone: string | null } | null;
    convertedSO?: { id: number; soNumber: string } | null;
    activities?: LeadActivity[];
    items?: LeadItem[];
    _count?: { activities: number };
}

export interface LeadActivity {
    id: number;
    leadId: number | null;
    customerId: number | null;
    kind: string;
    text: string | null;
    meta: Record<string, unknown> | null;
    createdById: number | null;
    createdAt: string;
    createdBy?: { id: number; name: string | null } | null;
}

export interface LeadListResponse {
    items: Lead[];
    total: number;
    page: number;
    limit: number;
}

export interface CreateLeadInput {
    name: string;
    phone?: string;
    source: LeadSource;
    sourceDetail?: string;
    level?: LeadLevel;
    needs?: string;
    estimatedValue?: number;
    city?: string;
    assignedToId?: number;
    followUpDate?: string;
    deliveryDeadline?: string;
    status?: LeadStatus;
    imageUrl?: string;
    imageUrls?: string[];
    items?: LeadItem[];
}

export interface UpdateLeadInput {
    name?: string;
    phone?: string;
    source?: LeadSource;
    sourceDetail?: string;
    level?: LeadLevel;
    needs?: string;
    estimatedValue?: number;
    city?: string;
    assignedToId?: number | null;
    followUpDate?: string | null;
    deliveryDeadline?: string | null;
    firstResponseAt?: string | null;
    status?: LeadStatus;
    imageUrl?: string | null;
    imageUrls?: string[];
    items?: LeadItem[];
}

export interface ConvertLeadInput {
    customerId?: number;
    createCustomer?: boolean;
    createSalesOrderDraft?: boolean;       // SPK (Sales Order production-bound) — UI: di-hide, default false
    designerName?: string;
    createInvoiceDraft?: boolean;          // Nota tagihan
    invoiceType?: 'INVOICE' | 'QUOTATION'; // default INVOICE
    notes?: string;
    createProductionTransaction?: boolean; // Auto-create Transaction PENDING → spawn production jobs (default true)
    // Payment options
    paymentMode?: 'NONE' | 'DP' | 'LUNAS';
    paymentMethod?: 'CASH' | 'TRANSFER' | 'QRIS';
    paymentAmount?: number;                // hanya untuk DP
    bankAccountId?: number;                // wajib untuk TRANSFER
}

export interface LeadConvertResult extends Lead {
    _convertResult?: {
        customerId: number;
        salesOrderId: number | null;
        invoiceId: number | null;
        invoiceNumber: string | null;
    };
}

// ─── Templates ───────────────────────────────────────────────────────────────

export type TemplateCategory =
    | 'GREETING' | 'FU_LEAD' | 'PROGRESS_UPDATE' | 'AFTER_SALES' | 'REPEAT_ORDER' | 'CUSTOM';

export const TEMPLATE_CATEGORY_LABEL: Record<TemplateCategory, string> = {
    GREETING: 'Sambutan',
    FU_LEAD: 'Follow Up Lead',
    PROGRESS_UPDATE: 'Update Progress',
    AFTER_SALES: 'After Sales',
    REPEAT_ORDER: 'Repeat Order',
    CUSTOM: 'Custom',
};

export interface MessageTemplate {
    id: number;
    name: string;
    category: string;
    bodyTemplate: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface RenderedTemplate {
    template: MessageTemplate;
    rendered: string;
    placeholders: Record<string, string>;
}

// ─── Lead endpoints ──────────────────────────────────────────────────────────

export const getLeads = async (params?: {
    status?: LeadStatus;
    source?: LeadSource;
    assignedToId?: number;
    search?: string;
    page?: number;
    limit?: number;
}): Promise<LeadListResponse> =>
    (await api.get('/crm/leads', { params })).data;

export const getLeadStatusSummary = async (): Promise<Record<LeadStatus, number>> =>
    (await api.get('/crm/leads/status-summary')).data;

export const getLead = async (id: number): Promise<Lead> =>
    (await api.get(`/crm/leads/${id}`)).data;

export const createLead = async (data: CreateLeadInput): Promise<Lead> =>
    (await api.post('/crm/leads', data)).data;

export const updateLead = async (id: number, data: UpdateLeadInput): Promise<Lead> =>
    (await api.patch(`/crm/leads/${id}`, data)).data;

export const addLeadActivity = async (
    leadId: number,
    data: { kind: string; text?: string; meta?: Record<string, unknown> },
): Promise<LeadActivity> =>
    (await api.post(`/crm/leads/${leadId}/activities`, data)).data;

export const convertLead = async (leadId: number, data: ConvertLeadInput): Promise<Lead> =>
    (await api.post(`/crm/leads/${leadId}/convert`, data)).data;

export const closeLeadLost = async (leadId: number, reason: string): Promise<Lead> =>
    (await api.post(`/crm/leads/${leadId}/close-lost`, { reason })).data;

export const deleteLead = async (id: number): Promise<{ ok: boolean }> =>
    (await api.delete(`/crm/leads/${id}`)).data;

/** Upload gambar untuk lead. Return URL relatif `/uploads/lead_xxx.jpg`. */
export const uploadLeadImage = async (file: File): Promise<string> => {
    const fd = new FormData();
    fd.append('image', file);
    const res = await api.post('/crm/leads/upload-image', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.url as string;
};

/** Resolve URL gambar lead — handle relative path & API_BASE fallback. */
export const resolveLeadImageUrl = (url: string | null | undefined): string | null => {
    if (!url) return null;
    if (typeof window === 'undefined') return url;
    if (url.startsWith('http://') || url.startsWith('https://')) {
        try {
            const u = new URL(url);
            if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
                if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
                    return `${window.location.origin}${u.pathname}${u.search}`;
                }
            }
            return url;
        } catch { return url; }
    }
    if (!url.startsWith('/')) return url;
    const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
    const apiIsLocal = !apiBase || apiBase.includes('localhost') || apiBase.includes('127.0.0.1');
    const browserIsLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (apiIsLocal && !browserIsLocal) return `${window.location.origin}${url}`;
    return `${apiBase || window.location.origin}${url}`;
};

/** Lookup customer berdasarkan nomor HP — untuk dedup di create lead. */
export interface CustomerLookupResult {
    id: number;
    name: string;
    phone: string | null;
    address: string | null;
}
export const lookupCustomerByPhone = async (phone: string): Promise<CustomerLookupResult[]> => {
    if (!phone || phone.replace(/\D/g, '').length < 4) return [];
    return (await api.get('/customers/lookup', { params: { phone } })).data;
};

// ─── Template endpoints ──────────────────────────────────────────────────────

export const getMessageTemplates = async (params?: {
    category?: string;
    activeOnly?: boolean;
}): Promise<MessageTemplate[]> =>
    (await api.get('/crm/templates', { params })).data;

export const getMessageTemplate = async (id: number): Promise<MessageTemplate> =>
    (await api.get(`/crm/templates/${id}`)).data;

export const createMessageTemplate = async (data: {
    name: string;
    category: string;
    bodyTemplate: string;
    isActive?: boolean;
}): Promise<MessageTemplate> =>
    (await api.post('/crm/templates', data)).data;

export const updateMessageTemplate = async (
    id: number,
    data: { name?: string; category?: string; bodyTemplate?: string; isActive?: boolean },
): Promise<MessageTemplate> =>
    (await api.patch(`/crm/templates/${id}`, data)).data;

export const deleteMessageTemplate = async (id: number): Promise<{ ok: boolean }> =>
    (await api.delete(`/crm/templates/${id}`)).data;

export const renderTemplate = async (
    id: number,
    ctx: { leadId?: number; customerId?: number; salesOrderId?: number },
): Promise<RenderedTemplate> =>
    (await api.get(`/crm/templates/${id}/render`, { params: ctx })).data;

export const seedDefaultTemplates = async (): Promise<{ inserted: number; total: number }> =>
    (await api.post('/crm/templates/seed-defaults')).data;

// ─── Follow-ups ──────────────────────────────────────────────────────────────

export type FollowUpType = 'LEAD_FU' | 'AFTER_SALES' | 'REPEAT_ORDER' | 'PAYMENT_REMINDER';
export type FollowUpStatus = 'PENDING' | 'DONE' | 'SKIPPED';

export const FOLLOW_UP_TYPE_LABEL: Record<FollowUpType, string> = {
    LEAD_FU: 'FU Lead',
    AFTER_SALES: 'After Sales',
    REPEAT_ORDER: 'Repeat Order',
    PAYMENT_REMINDER: 'Reminder Bayar',
};

export const FOLLOW_UP_STATUS_LABEL: Record<FollowUpStatus, string> = {
    PENDING: 'Pending',
    DONE: 'Selesai',
    SKIPPED: 'Dilewati',
};

export interface FollowUp {
    id: number;
    type: FollowUpType;
    status: FollowUpStatus;
    dueDate: string;
    doneAt: string | null;
    leadId: number | null;
    customerId: number | null;
    assignedToId: number | null;
    branchId: number | null;
    notes: string | null;
    doneNotes: string | null;
    templateId: number | null;
    sourceRef: string | null;
    createdById: number | null;
    createdAt: string;
    updatedAt: string;
    lead?: { id: number; name: string; phone: string | null; status: LeadStatus } | null;
    customer?: { id: number; name: string; phone: string | null } | null;
    assignedTo?: { id: number; name: string | null; email: string } | null;
    template?: { id: number; name: string; category: string } | null;
}

export interface FollowUpListResponse {
    items: FollowUp[];
    total: number;
    page: number;
    limit: number;
}

export const getFollowUps = async (params?: {
    status?: FollowUpStatus;
    type?: FollowUpType;
    assignedToId?: number;
    dueBefore?: string;
    page?: number;
    limit?: number;
}): Promise<FollowUpListResponse> =>
    (await api.get('/crm/follow-ups', { params })).data;

export const getFollowUpBadgeCount = async (mineOnly = true): Promise<{ count: number }> =>
    (await api.get('/crm/follow-ups/badge-count', { params: { mine: mineOnly ? 'true' : undefined } })).data;

export const createFollowUp = async (data: {
    type: FollowUpType;
    dueDate: string;
    leadId?: number;
    customerId?: number;
    assignedToId?: number;
    notes?: string;
    templateId?: number;
}): Promise<FollowUp> =>
    (await api.post('/crm/follow-ups', data)).data;

export const markFollowUpDone = async (id: number, notes?: string): Promise<FollowUp> =>
    (await api.patch(`/crm/follow-ups/${id}/done`, { notes })).data;

export const skipFollowUp = async (id: number): Promise<FollowUp> =>
    (await api.patch(`/crm/follow-ups/${id}/skip`)).data;

export const deleteFollowUp = async (id: number): Promise<{ ok: boolean }> =>
    (await api.delete(`/crm/follow-ups/${id}`)).data;

// ─── KPI ────────────────────────────────────────────────────────────────────

export type KpiPeriod = 'today' | 'week' | 'month' | 'custom';

export interface KpiLeaderboardEntry {
    userId: number;
    name: string;
    leadsHandled: number;
    dealsClosed: number;
    closingRate: number;
    avgResponseHrs: number | null;
}

export interface KpiReport {
    period: { start: string; end: string };
    totals: {
        totalLeads: number;
        closedWon: number;
        closedLost: number;
        customersWithOrder: number;
        customersRepeat: number;
        totalFu: number;
        compliant: number;
    };
    metrics: {
        responseTimeAvgHrs: number;
        closingRate: number;
        fuComplianceRate: number;
        repeatOrderRate: number;
    };
    leadsBySource: { source: LeadSource; count: number }[];
    leaderboard: KpiLeaderboardEntry[];
}

export const getKpiReport = async (params: {
    period: KpiPeriod;
    start?: string;
    end?: string;
}): Promise<KpiReport> =>
    (await api.get('/crm/kpi', { params })).data;
