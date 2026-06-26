import api from './client';

export interface CustomerRow {
    id: number;
    name: string;
    phone: string | null;
    address: string | null;
    totalOrders: number;
    totalRevenue: number;
    lastOrderDate: string | null;
    [k: string]: any;
}
export interface PagedCustomers {
    rows: CustomerRow[];
    total: number;
    page: number;
    pageSize: number;
}

export const getCustomers = async () => (await api.get('/customers')).data;

export const getCustomersWithStats = async (params?: { page?: number; pageSize?: number; search?: string }): Promise<PagedCustomers> => {
    const qs = new URLSearchParams();
    if (params?.page != null) qs.append('page', String(params.page));
    if (params?.pageSize != null) qs.append('pageSize', String(params.pageSize));
    if (params?.search) qs.append('search', params.search);
    const s = qs.toString();
    return (await api.get(`/customers/with-stats${s ? `?${s}` : ''}`)).data;
};

export const getCustomersSummary = async (): Promise<{ totalCustomers: number; totalRevenue: number; activeCustomers: number }> =>
    (await api.get('/customers/summary')).data;

export const dedupeCustomers = async (): Promise<{ customerPhonesFixed: number; txPhonesFixed: number; duplicateGroups: number; customersMerged: number }> =>
    (await api.post('/customers/dedupe')).data;
export const getCustomerAnalytics = async (id: number) => (await api.get(`/customers/${id}/analytics`)).data;
export const getCustomersExportData = async () => (await api.get('/customers/export-data')).data;
export const createCustomer = async (data: { name: string, phone?: string, address?: string }) =>
    (await api.post('/customers', data)).data;
export const updateCustomer = async (id: number, data: { name?: string, phone?: string, address?: string }) =>
    (await api.patch(`/customers/${id}`, data)).data;
export const deleteCustomer = async (id: number) => (await api.delete(`/customers/${id}`)).data;

// CRM timeline (activities + follow-ups + assigned CS)
export const getCustomerCrmTimeline = async (id: number): Promise<{
    customer: {
        id: number;
        name: string;
        phone: string | null;
        leadSource: string | null;
        assignedCs: { id: number; name: string | null; email: string } | null;
        tags: any;
    };
    activities: any[];
    followUps: any[];
}> => (await api.get(`/customers/${id}/crm-timeline`)).data;

export const updateCustomerCrm = async (
    id: number,
    data: { assignedCsId?: number | null; tags?: any; name?: string; phone?: string; address?: string },
) => (await api.patch(`/customers/${id}`, data)).data;
