import axios from './client';

export interface StockTransferItem {
    id: number;
    transferId: number;
    productVariantId: number;
    quantity: number;
    note: string | null;
    productVariant: {
        id: number;
        sku: string;
        variantName: string | null;
        product: { id: number; name: string };
    };
}

export interface StockTransfer {
    id: number;
    transferNumber: string;
    fromBranchId: number;
    toBranchId: number;
    notes: string | null;
    createdById: number | null;
    createdAt: string;
    fromBranch: { id: number; name: string; code: string | null };
    toBranch: { id: number; name: string; code: string | null };
    items: StockTransferItem[];
}

export interface CreateStockTransferInput {
    fromBranchId: number;
    toBranchId: number;
    notes?: string | null;
    items: { productVariantId: number; quantity: number; note?: string | null }[];
}

export const listStockTransfers = () =>
    axios.get<StockTransfer[]>('/stock-transfers').then((r) => r.data);

export const getStockTransfer = (id: number) =>
    axios.get<StockTransfer>(`/stock-transfers/${id}`).then((r) => r.data);

export const createStockTransfer = (payload: CreateStockTransferInput) =>
    axios.post<StockTransfer>('/stock-transfers', payload).then((r) => r.data);
