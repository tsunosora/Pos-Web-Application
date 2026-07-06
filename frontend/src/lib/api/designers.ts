import api from './client';
import axios from 'axios';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface Designer {
    id: number;
    name: string;
    pin: string;
    isActive: boolean;
    branchName?: string | null;
    branchId?: number | null;
    createdAt: string;
}

export interface DesignerPublic {
    id: number;
    name: string;
}

// ---- Admin (JWT) endpoints ----
export const getDesigners = async (): Promise<Designer[]> =>
    (await api.get('/designers')).data;

export const createDesigner = async (data: { name: string; pin: string; branchName?: string | null; branchId?: number | null }): Promise<Designer> =>
    (await api.post('/designers', data)).data;

export const updateDesigner = async (id: number, data: { name?: string; pin?: string; isActive?: boolean; branchName?: string | null; branchId?: number | null }): Promise<Designer> =>
    (await api.patch(`/designers/${id}`, data)).data;

export const deleteDesigner = async (id: number): Promise<{ success: boolean }> =>
    (await api.delete(`/designers/${id}`)).data;

// ---- Public endpoints (no JWT) ----
/** Daftar desainer aktif — nama saja, untuk dropdown login */
export const getPublicDesigners = async (): Promise<DesignerPublic[]> =>
    (await axios.get(`${BASE}/designers/public`)).data;

/** Verifikasi PIN — return { valid, id, name } */
export const verifyDesignerPin = async (id: number, pin: string): Promise<{ valid: boolean; id?: number; name?: string; branchName?: string | null }> =>
    (await axios.post(`${BASE}/designers/public/verify`, { id, pin })).data;

// ---- Public SO endpoints untuk desainer ----
/** Buat SO baru (verifikasi PIN inline) */
export const designerCreateSO = async (
    designerId: number,
    pin: string,
    soData: {
        customerName: string;
        customerPhone?: string | null;
        customerAddress?: string | null;
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
) => (await axios.post(`${BASE}/sales-orders/designer`, { designerId, pin, ...soData })).data;

/** Edit SO (public) — perbaiki customer/catatan/item selama belum invoiced/cancelled */
export const designerUpdateSO = async (
    soId: number,
    designerId: number,
    pin: string,
    soData: {
        customerName?: string;
        customerPhone?: string | null;
        customerAddress?: string | null;
        notes?: string | null;
        deadline?: string | null;
        items?: {
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
) => (await axios.post(`${BASE}/sales-orders/designer/${soId}/update`, { designerId, pin, ...soData })).data;

/**
 * "Lead Order" (public) — buat Lead CRM tertaut dari SO ini, CS yang follow-up.
 * Idempoten: kalau lead untuk SO ini sudah ada & masih aktif, data lead
 * disinkronkan dari SO terbaru dan return { existing: true, revised: true }.
 */
export const designerCreateLeadFromSO = async (
    soId: number,
    designerId: number,
    pin: string,
    opts?: { targetLeadId?: number; forceNewLead?: boolean },
): Promise<{ lead: { id: number; name: string; status: string }; existing: boolean; revised?: boolean; merged?: boolean }> =>
    (await axios.post(`${BASE}/sales-orders/designer/${soId}/create-lead`, { designerId, pin, ...(opts || {}) })).data;

/** Upload proof gambar (public) */
export const designerUploadProofs = async (
    soId: number,
    designerId: number,
    pin: string,
    files: File[],
): Promise<any> => {
    const fd = new FormData();
    files.forEach(f => fd.append('files', f));
    fd.append('designerId', String(designerId));
    fd.append('pin', pin);
    return (await axios.post(`${BASE}/sales-orders/designer/${soId}/proofs`, fd)).data;
};

/** Kirim ke WA group (public) */
export const designerSendWA = async (soId: number, designerId: number, pin: string, message?: string) =>
    (await axios.post(`${BASE}/sales-orders/designer/${soId}/send-wa`, { designerId, pin, message })).data;

/** Batalkan SO (public) */
export const designerCancelSO = async (soId: number, designerId: number, pin: string, reason: string) =>
    (await axios.post(`${BASE}/sales-orders/designer/${soId}/cancel`, { designerId, pin, reason })).data;

/** Hapus proof (public) */
export const designerDeleteProof = async (soId: number, proofId: number, designerId: number, pin: string) =>
    (await axios.delete(`${BASE}/sales-orders/designer/${soId}/proofs/${proofId}`, { data: { designerId, pin } })).data;

/** Detail SO (public, read only) */
export const designerGetSO = async (soId: number) =>
    (await axios.get(`${BASE}/sales-orders/designer/detail/${soId}`)).data;

/** Preview lead aktif untuk satu nomor HP (cek apakah customer sudah punya lead). */
export interface ActiveLeadPreview {
    id: number;
    name: string;
    phone: string | null;
    status: string;
    level: string;
    source: string;
    sourceDetail: string | null;
    needs: string | null;
    estimatedValue: number | null;
    assignedToName: string | null;
    createdByName: string | null;
    designerName: string | null;
    branchName: string | null;
    hasSO: boolean;
    soNumber: string | null;
    itemCount: number;
    followUpDate: string | null;
    createdAt: string;
    origin: 'CS' | 'DESIGNER';
}

export const designerLookupLeadsByPhone = async (
    designerId: number,
    pin: string,
    phone: string,
): Promise<ActiveLeadPreview[]> =>
    (await axios.post(`${BASE}/sales-orders/designer/lead-by-phone`, { designerId, pin, phone })).data;

/** Daftar lead aktif dari CS (belum punya SO) — kartu pilihan di halaman buat SO. */
export const designerListActiveCsLeads = async (
    designerId: number,
    pin: string,
): Promise<ActiveLeadPreview[]> =>
    (await axios.post(`${BASE}/sales-orders/designer/cs-leads`, { designerId, pin })).data;

/** Daftar SO milik desainer (paginasi) */
export const designerListSOs = async (
    designerId: number,
    pin: string,
    page = 1,
    pageSize = 20,
): Promise<import('./sales-orders').PagedSalesOrders> =>
    (await axios.post(`${BASE}/sales-orders/designer/my-list`, { designerId, pin, page, pageSize })).data;

/** Daftar customer terdaftar (public, nama+HP saja) */
export const getPublicCustomers = async (): Promise<{ id: number; name: string; phone: string | null; address: string | null }[]> =>
    (await axios.get(`${BASE}/customers/public`)).data;
