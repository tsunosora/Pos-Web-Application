import api from './client';

export const getHppWorksheets = async (variantId?: number) =>
    (await api.get('/hpp', { params: variantId ? { variantId } : undefined })).data;
export const getHppWorksheetById = async (id: number) => (await api.get(`/hpp/${id}`)).data;
export const getHppWorksheetsByVariant = async (variantId: number) => (await api.get(`/hpp/by-variant/${variantId}`)).data;
export const createHppWorksheet = async (data: any) => (await api.post('/hpp', data)).data;
export const updateHppWorksheet = async (id: number, data: any) => (await api.patch(`/hpp/${id}`, data)).data;
export const applyHppToVariant = async (worksheetId: number, hppPerUnit: number) =>
    (await api.post(`/hpp/${worksheetId}/apply-to-variant`, { hppPerUnit })).data;
export const applyHppToVariants = async (worksheetId: number, variantIds: number[], hppPerUnit: number) =>
    (await api.post(`/hpp/${worksheetId}/apply-to-variants`, { variantIds, hppPerUnit })).data;
export const applyHppVariantsCustom = async (
    worksheetId: number,
    variants: { variantId: number; hppPerUnit: number; scaleFactor: number }[]
) => (await api.post(`/hpp/${worksheetId}/apply-variants-custom`, { variants })).data;
export const deleteHppWorksheet = async (id: number) => (await api.delete(`/hpp/${id}`)).data;
export const getHppWorksheetByProduct = async (productId: number) => (await api.get(`/hpp/by-product/${productId}`)).data;
