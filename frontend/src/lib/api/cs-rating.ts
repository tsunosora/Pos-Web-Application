import api from './client';

export interface CsRatingInvite {
    id: number;
    token: string;
    salesOrderId: number | null;
    designerName: string | null;
    assignedCsName: string | null;
}

export interface CsRatingPersonStat {
    name: string;
    count: number;
    avgStars: number;
    yesPercent: number;
}

export interface CsRatingSummary {
    total: number;
    avgStars: number;
    yesPercent: number;
    perPerson: CsRatingPersonStat[];
}

export interface CsRatingConfig {
    id: number;
    branchId: number | null;
    question: string;
    thankYouText: string;
    isActive: boolean;
}

/** Buat undangan penilaian dari sebuah SO. Kembalikan token untuk link publik. */
export async function createRatingInviteFromSO(salesOrderId: number): Promise<CsRatingInvite> {
    const { data } = await api.post('/cs-rating/invite', { salesOrderId });
    return data;
}

export async function getRatingSummary(params?: {
    branchId?: number;
    from?: string;
    to?: string;
}): Promise<CsRatingSummary> {
    const { data } = await api.get('/cs-rating/summary', { params });
    return data;
}

export async function getRatingConfig(branchId?: number): Promise<CsRatingConfig | null> {
    const { data } = await api.get('/cs-rating/config', { params: { branchId } });
    return data;
}

export async function updateRatingConfig(payload: {
    branchId?: number | null;
    question?: string;
    thankYouText?: string;
    isActive?: boolean;
}): Promise<CsRatingConfig> {
    const { data } = await api.patch('/cs-rating/config', payload);
    return data;
}

/** Rakit link penilaian publik untuk dibuka pelanggan. */
export function buildRatingUrl(token: string): string {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/nilai/${token}`;
}
