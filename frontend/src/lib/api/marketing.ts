import axios from 'axios';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface PublicLeadItem {
    description: string;
    quantity: number;
    unitPrice: number;
    note: string | null;
    dimension: string | null;
}
export interface PublicLead {
    id: number;
    name: string;
    phone: string | null;
    source: string;
    sourceDetail: string | null;
    status: string;
    level: string;
    value: number;
    hasNota: boolean;
    needs: string | null;
    city: string | null;
    csName: string | null;
    branchName: string | null;
    createdAt: string;
    items: PublicLeadItem[];
}
export interface AdSpendEntry {
    id: number;
    date: string;
    source: string;
    amount: number;
    note: string | null;
}
export interface AdSpend {
    total: number;
    bySource: { source: string; amount: number }[];
    entries: AdSpendEntry[];
}
export interface PublicMarketingDashboard {
    report: any;
    leads: PublicLead[];
    adSpend: AdSpend;
}

export const verifyMarketingPin = async (pin: string): Promise<{ valid: boolean }> =>
    (await axios.post(`${BASE}/crm/public/verify-pin`, { pin })).data;

export const getPublicMarketingDashboard = async (
    pin: string,
    params: { period?: string; start?: string; end?: string },
): Promise<PublicMarketingDashboard> =>
    (await axios.post(`${BASE}/crm/public/dashboard`, { pin, ...params })).data;

export const addMarketingSpend = async (
    pin: string,
    data: { date?: string; source: string; amount: number; note?: string },
): Promise<any> =>
    (await axios.post(`${BASE}/crm/public/spend`, { pin, ...data })).data;

export const deleteMarketingSpend = async (pin: string, id: number): Promise<any> =>
    (await axios.post(`${BASE}/crm/public/spend/delete`, { pin, id })).data;
