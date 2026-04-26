import api from './client';
import axios from 'axios';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface Designer {
    id: number;
    name: string;
    pin: string;
    isActive: boolean;
    branchName?: string | null;
    createdAt: string;
}

export interface DesignerPublic {
    id: number;
    name: string;
}

// ---- Admin (JWT) endpoints ----
export const getDesigners = async (): Promise<Designer[]> =>
    (await api.get('/designers')).data;

export const createDesigner = async (data: { name: string; pin: string; branchName?: string | null }): Promise<Designer> =>
    (await api.post('/designers', data)).data;

export const updateDesigner = async (id: number, data: { name?: string; pin?: string; isActive?: boolean; branchName?: string | null }): Promise<Designer> =>
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

/** Daftar SO milik desainer */
export const designerListSOs = async (designerId: number, pin: string) =>
    (await axios.post(`${BASE}/sales-orders/designer/my-list`, { designerId, pin })).data;

/** Daftar customer terdaftar (public, nama+HP saja) */
export const getPublicCustomers = async (): Promise<{ id: number; name: string; phone: string | null; address: string | null }[]> =>
    (await axios.get(`${BASE}/customers/public`)).data;
