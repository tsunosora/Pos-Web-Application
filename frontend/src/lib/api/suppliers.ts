import api from './client';

export const getSuppliers = async () => (await api.get('/suppliers')).data;
export const getSupplier = async (id: number) => (await api.get(`/suppliers/${id}`)).data;
export const createSupplier = async (data: any) => (await api.post('/suppliers', data)).data;
export const updateSupplier = async (id: number, data: any) => (await api.patch(`/suppliers/${id}`, data)).data;
export const deleteSupplier = async (id: number) => (await api.delete(`/suppliers/${id}`)).data;
export const addSupplierItem = async (supplierId: number, data: any) => (await api.post(`/suppliers/${supplierId}/items`, data)).data;
export const updateSupplierItem = async (itemId: number, data: any) => (await api.patch(`/suppliers/items/${itemId}`, data)).data;
export const deleteSupplierItem = async (itemId: number) => (await api.delete(`/suppliers/items/${itemId}`)).data;
