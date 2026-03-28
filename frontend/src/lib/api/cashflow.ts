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
