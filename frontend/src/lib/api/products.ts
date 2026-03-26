import api from './client';

// Categories
export const getCategories = async () => (await api.get('/categories')).data;
export const createCategory = async (data: { name: string }) => (await api.post('/categories', data)).data;
export const updateCategory = async (id: number, data: { name: string }) => (await api.patch(`/categories/${id}`, data)).data;
export const deleteCategory = async (id: number) => (await api.delete(`/categories/${id}`)).data;

// Units
export const getUnits = async () => (await api.get('/units')).data;
export const createUnit = async (data: { name: string }) => (await api.post('/units', data)).data;
export const updateUnit = async (id: number, data: { name: string }) => (await api.patch(`/units/${id}`, data)).data;
export const deleteUnit = async (id: number) => (await api.delete(`/units/${id}`)).data;

// Products
export const getProducts = async () => (await api.get('/products')).data;
export const getProduct = async (id: number) => (await api.get(`/products/${id}`)).data;
export const createProduct = async (data: any) => (await api.post('/products', data)).data;
export const updateProduct = async (id: number, data: any) => (await api.patch(`/products/${id}`, data)).data;
export const deleteProduct = async (id: number) => (await api.delete(`/products/${id}`)).data;
export const bulkDeleteProducts = async (ids: number[]) => (await api.delete('/products/bulk', { data: { ids } })).data;

export const uploadProductImage = async (id: number, file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    return (await api.post(`/products/${id}/upload-image`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    })).data;
};

export const uploadProductImages = async (id: number, files: File[]) => {
    const formData = new FormData();
    files.forEach(f => formData.append('images', f));
    return (await api.post(`/products/${id}/upload-images`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    })).data;
};

// Variants
export const addProductVariant = async (productId: number, data: any) => (await api.post(`/products/${productId}/variants`, data)).data;
export const updateProductVariant = async (variantId: number, data: any) => (await api.patch(`/products/variants/${variantId}`, data)).data;
export const deleteProductVariant = async (variantId: number) => (await api.delete(`/products/variants/${variantId}`)).data;

export const uploadVariantImage = async (variantId: number, file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    return (await api.post(`/products/variants/${variantId}/upload-image`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    })).data;
};

// Ingredients (product-level)
export const addIngredient = async (productId: number, data: { name: string; quantity: number; unit: string }) =>
    (await api.post(`/products/${productId}/ingredients`, data)).data;
export const updateIngredient = async (productId: number, ingId: number, data: any) =>
    (await api.patch(`/products/${productId}/ingredients/${ingId}`, data)).data;
export const deleteIngredient = async (productId: number, ingId: number) =>
    (await api.delete(`/products/${productId}/ingredients/${ingId}`)).data;

// Variant Price Tiers
export const getVariantPriceTiers = async (variantId: number) =>
    (await api.get(`/products/variants/${variantId}/price-tiers`)).data;
export const replaceVariantPriceTiers = async (variantId: number, tiers: any[]) =>
    (await api.put(`/products/variants/${variantId}/price-tiers`, { tiers })).data;
export const deleteVariantPriceTier = async (variantId: number, tierId: number) =>
    (await api.delete(`/products/variants/${variantId}/price-tiers/${tierId}`)).data;

// Variant Ingredients (variant-level BOM)
export const getVariantIngredients = async (variantId: number) =>
    (await api.get(`/products/variants/${variantId}/variant-ingredients`)).data;
export const replaceVariantIngredients = async (variantId: number, ingredients: any[]) =>
    (await api.put(`/products/variants/${variantId}/variant-ingredients`, { ingredients })).data;
export const deleteVariantIngredient = async (variantId: number, ingId: number) =>
    (await api.delete(`/products/variants/${variantId}/variant-ingredients/${ingId}`)).data;

// Stock Movements
export const getStockMovements = async () => (await api.get('/stock-movements')).data;
export const logStockMovement = async (data: { productVariantId: number; type: 'IN' | 'OUT' | 'ADJUST'; quantity: number; reason?: string }) => {
    return (await api.post('/stock-movements', data)).data;
};

// Batches
export const getBatches = async () => (await api.get('/batches')).data;
export const createBatch = async (data: any) => (await api.post('/batches', data)).data;

// Bulk Import
export const bulkImportProducts = async (data: { products: any[] }) =>
    (await api.post('/products/bulk-import', data)).data;
