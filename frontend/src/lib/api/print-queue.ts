import api from './client';

export type PrintJobStatus = 'ANTRIAN' | 'PROSES' | 'SELESAI' | 'DIAMBIL';

export interface PrintJob {
    id: number;
    jobNumber: string;
    status: PrintJobStatus;
    quantity: number;
    notes: string | null;
    startedAt: string | null;
    finishedAt: string | null;
    pickedUpAt: string | null;
    operatorName: string | null;
    createdAt: string;
    updatedAt: string;
    transaction: {
        id: number;
        invoiceNumber: string;
        checkoutNumber: string | null;
        customerName: string | null;
        customerPhone: string | null;
        status: 'PENDING' | 'PARTIAL' | 'PAID' | 'FAILED';
        createdAt: string;
        branchId?: number | null;
        productionBranchId?: number | null;
        branch?: { id: number; name: string; code: string | null } | null;
        productionBranch?: { id: number; name: string; code: string | null } | null;
    };
    transactionItem: {
        id: number;
        quantity: number;
        note: string | null;
        clickType: string | null;
        widthCm: string | null;
        heightCm: string | null;
        pcs: number | null;
        productVariant: {
            id: number;
            variantName: string | null;
            sku: string;
            product: { id: number; name: string };
        };
    };
}

export interface PrintQueueStats {
    antrian: number;
    proses: number;
    selesai: number;
    diambil: number;
}

export const listPrintJobs = async (status?: PrintJobStatus, search?: string, branchId?: number): Promise<PrintJob[]> => {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (search) params.append('search', search);
    if (branchId) params.append('branchId', String(branchId));
    const qs = params.toString();
    return (await api.get(`/print-queue/jobs${qs ? `?${qs}` : ''}`)).data;
};

export const getPrintQueueStats = async (branchId?: number): Promise<PrintQueueStats> => {
    const qs = branchId ? `?branchId=${branchId}` : '';
    return (await api.get(`/print-queue/stats${qs}`)).data;
};

export const verifyPrintPin = async (pin: string, branchId?: number): Promise<{ valid: boolean; message?: string }> =>
    (await api.post('/print-queue/pin/verify', { pin, branchId })).data;

export const startPrintJob = async (id: number, operatorName?: string): Promise<PrintJob> =>
    (await api.post(`/print-queue/jobs/${id}/start`, { operatorName })).data;

export const finishPrintJob = async (id: number, operatorName?: string): Promise<PrintJob> =>
    (await api.post(`/print-queue/jobs/${id}/finish`, { operatorName })).data;

export const pickupPrintJob = async (id: number): Promise<PrintJob> =>
    (await api.post(`/print-queue/jobs/${id}/pickup`)).data;

export interface BulkPickupPrintResult {
    updated: number;
    skipped: { id: number; reason: string }[];
}

export const bulkPickupPrintJobs = async (ids: number[], branchId?: number): Promise<BulkPickupPrintResult> =>
    (await api.post('/print-queue/jobs/bulk-pickup', { ids, branchId })).data;

export const updatePrintJobNotes = async (id: number, notes: string): Promise<PrintJob> =>
    (await api.post(`/print-queue/jobs/${id}/notes`, { notes })).data;
