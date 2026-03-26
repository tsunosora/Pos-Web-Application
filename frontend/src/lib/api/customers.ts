import api from './client';

export const getCustomers = async () => (await api.get('/customers')).data;
export const getCustomersWithStats = async () => (await api.get('/customers/with-stats')).data;
export const getCustomerAnalytics = async (id: number) => (await api.get(`/customers/${id}/analytics`)).data;
export const getCustomersExportData = async () => (await api.get('/customers/export-data')).data;
export const createCustomer = async (data: { name: string, phone?: string, address?: string }) =>
    (await api.post('/customers', data)).data;
export const updateCustomer = async (id: number, data: { name?: string, phone?: string, address?: string }) =>
    (await api.patch(`/customers/${id}`, data)).data;
export const deleteCustomer = async (id: number) => (await api.delete(`/customers/${id}`)).data;
