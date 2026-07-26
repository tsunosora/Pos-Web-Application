import api from './client';

export type CustomMetricCountMode = 'PCS' | 'QTY' | 'OMZET' | 'NOTA';
export type CustomMetricRole = 'CS' | 'DESIGNER' | 'OPERATOR';

export interface CustomProductMetric {
    id: number;
    name: string;
    label: string;
    isActive: boolean;
    displayOrder: number;
    productVariantIds: number[];
    categoryIds: number[];
    nameKeywords: string[];
    countMode: CustomMetricCountMode;
    roles: CustomMetricRole[];
}

export type UpsertCustomProductMetric = {
    name: string;
    label: string;
    isActive?: boolean;
    displayOrder?: number;
    productVariantIds?: number[];
    categoryIds?: number[];
    nameKeywords?: string[];
    countMode: CustomMetricCountMode;
    roles: CustomMetricRole[];
};

export const getCustomProductMetrics = async (): Promise<CustomProductMetric[]> =>
    (await api.get('/crm/custom-product-metrics')).data;

export const createCustomProductMetric = async (
    body: UpsertCustomProductMetric,
): Promise<CustomProductMetric> => (await api.post('/crm/custom-product-metrics', body)).data;

export const updateCustomProductMetric = async (
    id: number,
    body: UpsertCustomProductMetric,
): Promise<CustomProductMetric> =>
    (await api.patch(`/crm/custom-product-metrics/${id}`, body)).data;

export const deleteCustomProductMetric = async (id: number) =>
    (await api.delete(`/crm/custom-product-metrics/${id}`)).data;
