import api from './client';

export type LedgerStatus = 'PENDING' | 'PARTIAL' | 'SETTLED' | 'CANCELLED';
export type LedgerRole = 'outgoing' | 'incoming' | 'all';

export interface LedgerEntry {
    id: number;
    transactionId: number;
    fromBranchId: number;
    fromBranchName: string | null;
    fromBranchCode: string | null;
    toBranchId: number;
    toBranchName: string | null;
    toBranchCode: string | null;
    costAmount: number;
    serviceFee: number;
    totalAmount: number;
    settledAmount: number;
    outstandingAmount: number;
    status: LedgerStatus;
    notes: string | null;
    invoiceNumber: string;
    customerName: string | null;
    grandTotal: number | null;
    handoverStatus: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface LedgerItem {
    id: number;
    productName: string;
    variantName: string | null;
    sku: string;
    pricingMode: string;
    quantity: number;
    hppAtTime: number;
    variantHpp: number;
    effectiveHpp: number;
    widthCm: number | null;
    heightCm: number | null;
    pcs: number | null;
    note: string | null;
}

export interface LedgerSettlement {
    id: number;
    settlementType: 'CASH' | 'STOCK';
    amount: number;
    cashflowPayerId: number | null;
    cashflowPayeeId: number | null;
    stockMovementOutId: number | null;
    stockMovementInId: number | null;
    notes: string | null;
    createdAt: string;
}

export interface LedgerDetail extends LedgerEntry {
    items: LedgerItem[];
    settlements: LedgerSettlement[];
}

export interface LedgerSummarySingle {
    mode: 'single';
    branchId: number;
    outgoing: { count: number; outstanding: number; total: number };
    incoming: { count: number; outstanding: number; total: number };
    netPosition: number;
}

export interface LedgerSummaryPair {
    fromBranchId: number;
    fromBranchName: string | null;
    fromBranchCode: string | null;
    toBranchId: number;
    toBranchName: string | null;
    toBranchCode: string | null;
    totalCount: number;
    outstanding: number;
    grossTotal: number;
}

export interface LedgerSummaryAll {
    mode: 'all';
    pairs: LedgerSummaryPair[];
}

export type LedgerSummary = LedgerSummarySingle | LedgerSummaryAll;

export const listBranchLedger = async (
    role: LedgerRole = 'all',
    status?: LedgerStatus | 'ALL',
): Promise<LedgerEntry[]> => {
    const params = new URLSearchParams();
    params.append('role', role);
    if (status && status !== 'ALL') params.append('status', status);
    return (await api.get(`/branch-ledger?${params.toString()}`)).data;
};

export const getBranchLedgerSummary = async (): Promise<LedgerSummary> =>
    (await api.get('/branch-ledger/summary')).data;

export const getBranchLedgerDetail = async (id: number): Promise<LedgerDetail> =>
    (await api.get(`/branch-ledger/${id}`)).data;

export interface SettleCashPayload {
    amount: number;
    bankAccountAId?: number | null;
    bankAccountBId?: number | null;
    notes?: string | null;
}

export interface LedgerBankAccount {
    id: number;
    bankName: string;
    accountNumber: string;
    accountOwner: string;
    currentBalance: number | string;
    branchId: number | null;
    isActive: boolean;
}

export interface LedgerBankAccountsResponse {
    fromBranchId: number;
    toBranchId: number;
    fromAccounts: LedgerBankAccount[];
    toAccounts: LedgerBankAccount[];
}

export const getLedgerBankAccounts = async (id: number): Promise<LedgerBankAccountsResponse> =>
    (await api.get(`/branch-ledger/${id}/bank-accounts`)).data;

export const settleBranchLedgerCash = async (
    id: number,
    payload: SettleCashPayload,
): Promise<{ ok: boolean; settledAmount: number; status: LedgerStatus }> =>
    (await api.post(`/branch-ledger/${id}/settle-cash`, payload)).data;

export interface FromBranchStockItem {
    variantId: number;
    sku: string;
    variantName: string | null;
    productName: string;
    pricingMode: string;
    productType: string | null;
    hpp: number;                    // HPP variant di master
    lastPurchasePrice: number;      // Harga beli terakhir di cabang ini
    effectiveHpp: number;           // Yang DIPAKAI: variant.hpp > 0 ? hpp : lastPurchasePrice
    hppSource: 'variant' | 'lastPurchase' | 'none';
    stock: number;
}

export interface FromBranchStockResponse {
    fromBranchId: number;
    toBranchId: number;
    fromBranchName: string;
    fromBranchCode: string | null;
    items: FromBranchStockItem[];
    diagnostics: {
        totalBranchStockEntries: number;
        entriesWithStock: number;
        entriesWithHpp: number;
        entriesWithFallbackPrice: number;
    };
}

export const getFromBranchStock = async (id: number): Promise<FromBranchStockResponse> =>
    (await api.get(`/branch-ledger/${id}/from-branch-stock`)).data;

export interface SettleStockPayload {
    productVariantId: number;
    quantity: number;
    notes?: string | null;
}

export const settleBranchLedgerStock = async (
    id: number,
    payload: SettleStockPayload,
): Promise<{
    ok: boolean;
    settledAmount: number;
    status: LedgerStatus;
    valueCredited: number;
    fromStockAfter: number;
    toStockAfter: number;
}> => (await api.post(`/branch-ledger/${id}/settle-stock`, payload)).data;
