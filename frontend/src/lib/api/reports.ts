import api from './client';

// Dashboard & Sales
export const getDashboardMetrics = async () => (await api.get('/transactions/dashboard/metrics')).data;
export const getSalesChart = async (period: string) => (await api.get(`/transactions/dashboard/chart?period=${period}`)).data;
export const getSalesSummary = async (startDate?: string, endDate?: string) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
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
