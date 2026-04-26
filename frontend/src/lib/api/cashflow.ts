import api from './client';

export const getCashflows = async (startDate?: string, endDate?: string) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return (await api.get(`/cashflow?${params.toString()}`)).data;
};
export const createCashflow = async (data: any) => (await api.post('/cashflow', data)).data;
export const updateCashflow = async (id: number, data: any) => (await api.patch(`/cashflow/${id}`, data)).data;
export const deleteCashflow = async (id: number) => (await api.delete(`/cashflow/${id}`)).data;
export const getCashflowMonthlyTrend = async () => (await api.get('/cashflow/monthly-trend')).data;
export const getCashflowCategoryBreakdown = async (startDate?: string, endDate?: string) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return (await api.get(`/cashflow/category-breakdown?${params.toString()}`)).data;
};
export const getCashflowPlatformBreakdown = async (startDate?: string, endDate?: string) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return (await api.get(`/cashflow/platform-breakdown?${params.toString()}`)).data;
};

// Auth
export const getMe = async () => (await api.get('/auth/me')).data as {
    id: number;
    name: string | null;
    email: string;
    branchId: number | null;
    role: { id: number; name: string } | null;
    branch: { id: number; name: string; code: string | null } | null;
};

// Cashflow Change Requests
export type CashflowChangeRequest = {
    id: number;
    cashflowId: number;
    type: 'EDIT' | 'DELETE';
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    payload: Record<string, any> | null;
    requesterNote: string | null;
    reviewerNote: string | null;
    createdAt: string;
    requester: { id: number; name: string | null; email: string };
    cashflow: { id: number; type: string; category: string; amount: string; note: string | null; date: string };
};

export const submitCashflowRequest = async (body: {
    cashflowId: number;
    type: 'EDIT' | 'DELETE';
    payload?: Record<string, any>;
    requesterNote?: string;
}) => (await api.post('/cashflow-requests', body)).data;

export const getPendingRequests = async () =>
    (await api.get('/cashflow-requests/pending')).data as CashflowChangeRequest[];

export const getMyRequests = async () =>
    (await api.get('/cashflow-requests/mine')).data as CashflowChangeRequest[];

export const approveRequest = async (id: number, reviewerNote?: string) =>
    (await api.patch(`/cashflow-requests/${id}/approve`, { reviewerNote })).data;

export const rejectRequest = async (id: number, reviewerNote: string) =>
    (await api.patch(`/cashflow-requests/${id}/reject`, { reviewerNote })).data;
