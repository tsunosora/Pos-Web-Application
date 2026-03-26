import api from './client';

export const getInvoices = async (type?: 'INVOICE' | 'QUOTATION') =>
    (await api.get(type ? `/invoices?type=${type}` : '/invoices')).data;
export const getInvoiceById = async (id: number) => (await api.get(`/invoices/${id}`)).data;
export const createInvoice = async (data: any) => (await api.post('/invoices', data)).data;
export const updateInvoice = async (id: number, data: any) => (await api.patch(`/invoices/${id}`, data)).data;
export const updateInvoiceStatus = async (id: number, status: string) =>
    (await api.patch(`/invoices/${id}/status`, { status })).data;
export const convertQuotationToInvoice = async (id: number) =>
    (await api.post(`/invoices/${id}/convert-to-invoice`, {})).data;
export const deleteInvoice = async (id: number) => (await api.delete(`/invoices/${id}`)).data;
