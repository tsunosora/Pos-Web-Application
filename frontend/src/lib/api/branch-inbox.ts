import axios from './client';

export type HandoverStatus = 'BARU' | 'DIPROSES' | 'SIAP_AMBIL' | 'DISERAHKAN';

export interface BranchInboxItem {
    id: number;
    productName: string;
    variantName?: string | null;
    pricingMode: 'UNIT' | 'AREA_BASED';
    requiresProduction: boolean;
    quantity: number;
    widthCm: number | null;
    heightCm: number | null;
    pcs: number | null;
    note: string | null;
    productionJob?: { id: number; jobNumber: string; status: string } | null;
    printJob?: { id: number; jobNumber: string; status: string } | null;
}

export interface BranchInboxEntry {
    id: number;
    invoiceNumber: string;
    customerName: string | null;
    customerPhone: string | null;
    grandTotal: number;
    productionPriority: string;
    productionDeadline: string | null;
    productionNotes: string | null;
    handoverStatus: HandoverStatus;
    handoverAckAt: string | null;
    handoverReadyAt: string | null;
    handoverDoneAt: string | null;
    sourceBranch: { id: number; name: string; code: string | null } | null;
    createdAt: string;
    itemCount: number;
    items: BranchInboxItem[];
}

export interface UnreadCountResponse {
    count: number;
    latest: Array<{
        id: number;
        invoiceNumber: string;
        customerName: string | null;
        productionPriority: string;
        productionDeadline: string | null;
        branch: { id: number; name: string; code: string | null } | null;
        items: Array<{
            quantity: number;
            productVariant: { product: { name: string; pricingMode: string } };
        }>;
    }>;
}

export const listBranchInbox = async (status?: string): Promise<BranchInboxEntry[]> => {
    const r = await axios.get('/branch-inbox', { params: status ? { status } : undefined });
    return r.data;
};

export const getBranchInboxDetail = async (id: number): Promise<any> => {
    const r = await axios.get(`/branch-inbox/${id}`);
    return r.data;
};

export const getBranchInboxUnread = async (): Promise<UnreadCountResponse> => {
    const r = await axios.get('/branch-inbox/unread-count');
    return r.data;
};

export const acknowledgeBranchInbox = async (id: number) => {
    const r = await axios.post(`/branch-inbox/${id}/acknowledge`);
    return r.data;
};

export const markBranchInboxReady = async (id: number) => {
    const r = await axios.post(`/branch-inbox/${id}/ready`);
    return r.data;
};

export const markBranchInboxHandover = async (id: number) => {
    const r = await axios.post(`/branch-inbox/${id}/handover`);
    return r.data;
};

export interface ReadyOutboxResponse {
    count: number;
    latest: Array<{
        id: number;
        invoiceNumber: string;
        customerName: string | null;
        productionPriority: string;
        handoverReadyAt: string | null;
        productionBranch: { id: number; name: string; code: string | null } | null;
        items: Array<{
            quantity: number;
            productVariant: { product: { name: string; pricingMode: string } };
        }>;
    }>;
}

export const getBranchOutboxReady = async (): Promise<ReadyOutboxResponse> => {
    const r = await axios.get('/branch-inbox/ready-outbox');
    return r.data;
};

export interface BranchOutboxItem {
    id: number;
    productName: string;
    variantName?: string | null;
    pricingMode: 'UNIT' | 'AREA_BASED';
    requiresProduction: boolean;
    quantity: number;
    widthCm: number | null;
    heightCm: number | null;
    pcs: number | null;
    note: string | null;
}

export interface BranchOutboxEntry {
    id: number;
    invoiceNumber: string;
    customerName: string | null;
    customerPhone: string | null;
    grandTotal: number;
    productionPriority: string;
    productionDeadline: string | null;
    productionNotes: string | null;
    handoverStatus: HandoverStatus;
    handoverAckAt: string | null;
    handoverReadyAt: string | null;
    handoverDoneAt: string | null;
    targetBranch: { id: number; name: string; code: string | null } | null;
    createdAt: string;
    itemCount: number;
    items: BranchOutboxItem[];
}

export const listBranchOutbox = async (status?: string): Promise<BranchOutboxEntry[]> => {
    const r = await axios.get('/branch-inbox/outbox', { params: status ? { status } : undefined });
    return r.data;
};

export const confirmBranchOutboxPickup = async (id: number) => {
    const r = await axios.post(`/branch-inbox/${id}/confirm-pickup`);
    return r.data;
};
