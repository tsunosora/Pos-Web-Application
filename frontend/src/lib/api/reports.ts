import api from './client';

// Dashboard & Sales
export const getDashboardMetrics = async () => (await api.get('/transactions/dashboard/metrics')).data;
export const getSalesChart = async (period: string) => (await api.get(`/transactions/dashboard/chart?period=${period}`)).data;
export const getSalesSummary = async (startDate?: string, endDate?: string, sortBy: 'qty' | 'revenue' = 'qty', limit: number = 20) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    params.append('sortBy', sortBy);
    params.append('limit', String(limit));
    return (await api.get(`/transactions/reports/summary?${params.toString()}`)).data;
};
export const getProfitReport = async (startDate?: string, endDate?: string) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return (await api.get(`/reports/profit?${params.toString()}`)).data;
};

// Shift Close
export const getShiftExpectations = async () => (await api.get('/reports/current-shift')).data;
export const getStaffList = async () => (await api.get('/reports/staff-list')).data;
export const closeShift = async (formData: FormData) => (await api.post('/reports/close-shift', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
})).data;

// Shift History & Resend
export const getShiftHistory = async (page = 1, limit = 20) =>
    (await api.get(`/reports/shift-history?page=${page}&limit=${limit}`)).data;
export const resendShiftReport = async (id: number) =>
    (await api.post(`/reports/shift/${id}/resend`)).data;
