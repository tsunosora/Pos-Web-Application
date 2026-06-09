// Work Order Jersey API client
import api from './client';

export interface WoItem { size: string; qty: number }
export interface WoPrintPattern { name: string; qty: number; ok?: boolean }
export interface WoQcRow { criteria: string; ok?: boolean; note?: string; inspector?: string }

export interface JerseyWorkOrder {
    id: number;
    productionJobId: number;
    woNumber: string | null;
    orderDate: string | null;
    source: string | null;
    designerName: string | null;
    deadline: string | null;
    customerName: string | null;
    collarType: string | null;
    fabricType: string | null;
    mockupImageUrl: string | null;
    printLayoutImageUrl: string | null;
    mockupImages: string[] | null;
    printLayoutImages: string[] | null;
    shortSleeveItems: WoItem[] | null;
    longSleeveItems: WoItem[] | null;
    pantsItems: WoItem[] | null;
    printPatterns: WoPrintPattern[] | null;
    qcChecklist: WoQcRow[] | null;
    tglPrint: string | null;
    tglPress: string | null;
    tglJahit: string | null;
    printInspector: string | null;
    jahitInspector: string | null;
    notes: string | null;
    branchId: number | null;
    createdById: number | null;
    createdAt: string;
    updatedAt: string;
}

export interface UpsertWorkOrderInput {
    productionJobId: number;
    woNumber?: string;
    orderDate?: string;
    source?: string;
    designerName?: string;
    deadline?: string;
    customerName?: string;
    collarType?: string;
    fabricType?: string;
    mockupImageUrl?: string;
    printLayoutImageUrl?: string;
    mockupImages?: string[];
    printLayoutImages?: string[];
    shortSleeveItems?: WoItem[];
    longSleeveItems?: WoItem[];
    pantsItems?: WoItem[];
    printPatterns?: WoPrintPattern[];
    qcChecklist?: WoQcRow[];
    tglPrint?: string | null;
    tglPress?: string | null;
    tglJahit?: string | null;
    printInspector?: string;
    jahitInspector?: string;
    notes?: string;
}

// Opsi dropdown jersey
export const COLLAR_OPTIONS = ['O-Neck', 'V-Neck', 'Shanghai', 'Polo', 'Lainnya'];
export const FABRIC_OPTIONS = ['Milano', 'Dryfit', 'Hyget', 'Paragon', 'Serena', 'Lotto', 'Lainnya'];

export interface WorkOrderOptions { collarTypes: string[]; fabricTypes: string[] }

/** Opsi dropdown kerah & bahan: default + nilai custom yang pernah disimpan di WO. */
export const getWorkOrderOptions = async (): Promise<WorkOrderOptions> =>
    (await api.get('/work-orders/options')).data;

export const getWorkOrderByJob = async (jobId: number): Promise<JerseyWorkOrder | null> =>
    (await api.get(`/work-orders/job/${jobId}`)).data;

export const getWorkOrder = async (id: number): Promise<JerseyWorkOrder> =>
    (await api.get(`/work-orders/${id}`)).data;

export const createWorkOrder = async (data: UpsertWorkOrderInput): Promise<JerseyWorkOrder> =>
    (await api.post('/work-orders', data)).data;

export const updateWorkOrder = async (id: number, data: Partial<UpsertWorkOrderInput>): Promise<JerseyWorkOrder> =>
    (await api.patch(`/work-orders/${id}`, data)).data;

export const deleteWorkOrder = async (id: number): Promise<{ ok: boolean }> =>
    (await api.delete(`/work-orders/${id}`)).data;

/** Upload gambar WO (mockup / pola print) — return URL relatif. */
export const uploadWorkOrderImage = async (file: File): Promise<string> => {
    const fd = new FormData();
    fd.append('image', file);
    const res = await api.post('/work-orders/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.url as string;
};
