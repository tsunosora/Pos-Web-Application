import api from './client';

export interface InterBranchUsageMovement {
    movementId: number;
    txInvoiceNumber: string | null;
    txCheckoutNumber: string | null;
    customerName: string | null;
    qty: number;
    valueRupiah: number;
    date: string;
    transactionId: number | null;
}

export interface InterBranchUsageItem {
    variantId: number;
    sku: string;
    productName: string;
    variantName: string | null;
    pricingMode: string | null;
    productType: string | null;
    totalQty: number;
    totalValue: number;
    movements: InterBranchUsageMovement[];
}

export interface InterBranchUsagePerBranch {
    branchId: number;
    branchName: string;
    branchCode: string | null;
    txCount: number;
    items: InterBranchUsageItem[];
    totalValue: number;
}

export interface InterBranchUsageReport {
    period: { start: string | null; end: string | null };
    productionBranchId: number | null;
    productionBranchName: string | null;
    perBranch: InterBranchUsagePerBranch[];
    grandTotal: number;
    grandQty: number;
    grandTxCount: number;
}

export const getInterBranchUsage = async (params: {
    startDate?: string;
    endDate?: string;
    productionBranchId?: number;
}): Promise<InterBranchUsageReport> => {
    const qs = new URLSearchParams();
    if (params.startDate) qs.append('startDate', params.startDate);
    if (params.endDate) qs.append('endDate', params.endDate);
    if (params.productionBranchId != null) qs.append('productionBranchId', String(params.productionBranchId));
    const s = qs.toString();
    return (await api.get(`/reports/inter-branch-usage${s ? `?${s}` : ''}`)).data;
};
