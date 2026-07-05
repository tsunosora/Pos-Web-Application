import api from './client';

// Jenis produksi yang bisa di-CRUD user (Banner, Stiker, Laser Cut, dst).
// Dipakai untuk breakdown produksi per kategori di leaderboard operator.
export type ProductionSource = 'CETAK' | 'PRODUKSI';
export type ProductionMeasure = 'AREA' | 'PCS';

export interface ProductionCategory {
    id: number;
    name: string;
    source: ProductionSource;   // CETAK = dari bahan cetak; PRODUKSI = dari antrian produksi
    measureBy: ProductionMeasure; // AREA = luas m²; PCS = pcs/lembar
    isActive: boolean;
    sortOrder: number;
}

export type ProductionCategoryInput = {
    name?: string;
    source?: ProductionSource;
    measureBy?: ProductionMeasure;
    isActive?: boolean;
    sortOrder?: number;
};

export const getProductionCategories = async (): Promise<ProductionCategory[]> =>
    (await api.get('/production-categories')).data;

export const createProductionCategory = async (data: ProductionCategoryInput): Promise<ProductionCategory> =>
    (await api.post('/production-categories', data)).data;

export const updateProductionCategory = async (id: number, data: ProductionCategoryInput): Promise<ProductionCategory> =>
    (await api.patch(`/production-categories/${id}`, data)).data;

export const deleteProductionCategory = async (id: number) =>
    (await api.delete(`/production-categories/${id}`)).data;
