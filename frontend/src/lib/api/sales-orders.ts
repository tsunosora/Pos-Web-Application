import api from './client';

export type SalesOrderStatus = 'DRAFT' | 'SENT' | 'INVOICED' | 'CANCELLED';

export interface SalesOrderItem {
    id: number;
    productVariantId: number;
    quantity: number;
    widthCm: number | null;
    heightCm: number | null;
    unitType: string | null;
    pcs: number | null;
    customPrice: number | null;
    note: string | null;
    productVariant: {
        id: number;
        sku: string;
        variantName: string | null;
        price: string | number;
        product: { id: number; name: string; pricingMode: 'UNIT' | 'AREA_BASED' };
    };
}

export interface SalesOrderProof {
    id: number;
    filename: string;
    caption: string | null;
    createdAt: string;
}

export interface SalesOrder {
    id: number;
    soNumber: string;
    status: SalesOrderStatus;
    customerId: number | null;
    customerName: string;
    customerPhone: string | null;
    customerAddress: string | null;
    designerName: string;
    notes: string | null;
    deadline: string | null;
    sentToWaAt: string | null;
    invoicedAt: string | null;
    cancelledAt: string | null;
    cancelReason: string | null;
    transactionId: number | null;
    createdAt: string;
    updatedAt: string;
    items: SalesOrderItem[];
    proofs: SalesOrderProof[];
    transaction?: {
        id: number;
        invoiceNumber: string;
        checkoutNumber: string | null;
        status: 'PENDING' | 'PARTIAL' | 'PAID' | 'FAILED';
        grandTotal: string | number;
    } | null;
    customer?: { id: number; name: string; phone: string | null; address: string | null } | null;
}

export interface CreateSalesOrderPayload {
    customerId?: number | null;
    customerName: string;
    customerPhone?: string | null;
    customerAddress?: string | null;
    designerName: string;
    notes?: string | null;
    deadline?: string | null;
    items: {
        productVariantId: number;
        quantity: number;
        widthCm?: number | null;
        heightCm?: number | null;
        unitType?: string | null;
        pcs?: number | null;
        customPrice?: number | null;
        note?: string | null;
    }[];
}

export const listSalesOrders = async (params?: {
    status?: SalesOrderStatus;
    search?: string;
    branchId?: number;
}): Promise<SalesOrder[]> => {
    const qs = new URLSearchParams();
    if (params?.status) qs.append('status', params.status);
    if (params?.search) qs.append('search', params.search);
    if (params?.branchId != null) qs.append('branchId', String(params.branchId));
    const s = qs.toString();
    return (await api.get(`/sales-orders${s ? `?${s}` : ''}`)).data;
};

export const getSalesOrder = async (id: number): Promise<SalesOrder> =>
    (await api.get(`/sales-orders/${id}`)).data;

export const getPendingInvoiceCount = async (): Promise<{ count: number }> =>
    (await api.get(`/sales-orders/pending-invoice-count`)).data;

export const createSalesOrder = async (
    data: CreateSalesOrderPayload,
): Promise<SalesOrder> => (await api.post(`/sales-orders`, data)).data;

export const updateSalesOrder = async (
    id: number,
    data: Partial<CreateSalesOrderPayload>,
): Promise<SalesOrder> => (await api.patch(`/sales-orders/${id}`, data)).data;

export const uploadProofs = async (
    id: number,
    files: File[],
    captions?: string[],
): Promise<SalesOrderProof[]> => {
    const fd = new FormData();
    files.forEach((f) => fd.append('files', f));
    if (captions && captions.length > 0) fd.append('captions', JSON.stringify(captions));
    return (await api.post(`/sales-orders/${id}/proofs`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
    })).data;
};

export const deleteProof = async (id: number, proofId: number): Promise<{ success: boolean }> =>
    (await api.delete(`/sales-orders/${id}/proofs/${proofId}`)).data;

export const sendSOWhatsapp = async (id: number, message?: string): Promise<SalesOrder> =>
    (await api.post(`/sales-orders/${id}/send-wa`, { message })).data;

export const cancelSO = async (id: number, reason: string): Promise<SalesOrder> =>
    (await api.post(`/sales-orders/${id}/cancel`, { reason })).data;
