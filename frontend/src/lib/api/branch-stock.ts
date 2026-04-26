import axios from './client';

export interface BranchStockRow {
    id: number;
    branchId: number;
    productVariantId: number;
    stock: number;
    updatedAt: string;
    productVariant: {
        id: number;
        sku: string;
        variantName: string | null;
        product: { id: number; name: string; pricingMode: string; trackStock: boolean };
    };
    branch: { id: number; name: string; code: string | null };
}

export interface BranchStockMatrixRow {
    id: number;
    sku: string;
    name: string;
    variantName: string | null;
    pricingMode: 'UNIT' | 'AREA_BASED';
    aggregateStock: number;
    perBranch: { branchId: number; stock: number }[];
}

export interface BranchStockMatrix {
    branches: { id: number; name: string; code: string | null }[];
    variants: BranchStockMatrixRow[];
}

export const listBranchStocks = () =>
    axios.get<BranchStockRow[]>('/branch-stock/list').then((r) => r.data);

export const getBranchStockMatrix = () =>
    axios.get<BranchStockMatrix>('/branch-stock/matrix').then((r) => r.data);

export const getBranchStockForVariant = (variantId: number, branchId?: number) =>
    axios
        .get<{ branchId: number; productVariantId: number; stock: number }>(
            `/branch-stock/variant/${variantId}`,
            { params: branchId ? { branchId } : undefined },
        )
        .then((r) => r.data);

export const adjustBranchStock = (payload: {
    branchId: number;
    productVariantId: number;
    newStock: number;
    reason?: string;
}) => axios.post('/branch-stock/adjust', payload).then((r) => r.data);
