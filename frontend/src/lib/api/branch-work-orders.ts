import axios from './client';

export type BranchWOStatus = 'ANTRIAN' | 'PROSES' | 'SELESAI' | 'DIBATALKAN';

export interface BranchWOItem {
    id: number;
    workOrderId: number;
    productVariantId: number;
    quantity: number;
    widthCm: number | null;
    heightCm: number | null;
    unitType: string | null;
    pcs: number | null;
    note: string | null;
    isDone: boolean;
    productVariant: {
        id: number;
        name: string;
        product: { id: number; name: string; pricingMode: string };
    };
}

export interface BranchWorkOrder {
    id: number;
    woNumber: string;
    branchId: number;
    referenceNumber: string | null;
    notes: string | null;
    proofFilename: string | null;
    status: BranchWOStatus;
    receivedBy: string | null;
    cancelReason: string | null;
    completedAt: string | null;
    createdAt: string;
    updatedAt: string;
    branch: { id: number; name: string; phone: string | null };
    items: BranchWOItem[];
}

export interface BranchWOSummary {
    period: string;
    totalOrders: number;
    byBranch: {
        branchId: number;
        branchName: string;
        totalOrders: number;
        totalItems: number;
        selesai: number;
        proses: number;
        antrian: number;
    }[];
}

export interface CreateBranchWOPayload {
    branchId: number;
    referenceNumber?: string;
    notes?: string;
    receivedBy?: string;
    items: {
        productVariantId: number;
        quantity: number;
        widthCm?: number | null;
        heightCm?: number | null;
        unitType?: string | null;
        pcs?: number | null;
        note?: string | null;
    }[];
}

export const listBranchWorkOrders = (params?: {
    branchId?: number;
    status?: string;
    month?: string;
}) =>
    axios
        .get<BranchWorkOrder[]>('/branch-work-orders', { params })
        .then(r => r.data);

export const getBranchWorkOrder = (id: number) =>
    axios.get<BranchWorkOrder>(`/branch-work-orders/${id}`).then(r => r.data);

export const createBranchWorkOrder = (data: CreateBranchWOPayload) =>
    axios.post<BranchWorkOrder>('/branch-work-orders', data).then(r => r.data);

export const uploadBranchWOProof = (id: number, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return axios
        .post<BranchWorkOrder>(`/branch-work-orders/${id}/proof`, form, {
            headers: { 'Content-Type': 'multipart/form-data' },
        })
        .then(r => r.data);
};

export const updateBranchWOStatus = (
    id: number,
    status: BranchWOStatus,
    cancelReason?: string,
) =>
    axios
        .patch<BranchWorkOrder>(`/branch-work-orders/${id}/status`, {
            status,
            cancelReason,
        })
        .then(r => r.data);

export const toggleBranchWOItem = (id: number, itemId: number) =>
    axios
        .patch(`/branch-work-orders/${id}/items/${itemId}/toggle`, {})
        .then(r => r.data);

export const getBranchWOSummary = (params: {
    branchId?: number;
    year?: number;
    month?: number;
}) =>
    axios
        .get<BranchWOSummary>('/branch-work-orders/summary', { params })
        .then(r => r.data);
