import api from './client';

// Transactions
export const getTransactions = async (startDate?: string, endDate?: string) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const query = params.toString();
    return (await api.get(`/transactions${query ? `?${query}` : ''}`)).data;
};
export const getTransactionById = async (id: number) => (await api.get(`/transactions/${id}`)).data;
export const createTransaction = async (data: {
    items: {
        productVariantId: number;
        quantity: number;
        widthCm?: number;
        heightCm?: number;
        unitType?: string;
        note?: string;
        customPrice?: number;
    }[];
    paymentMethod: 'CASH' | 'QRIS' | 'BANK_TRANSFER';
    discount?: number;
    customerName?: string;
    customerPhone?: string;
    customerAddress?: string;
    dueDate?: string;
    downPayment?: number;
    cashierName?: string;
    employeeName?: string;
    bankAccountId?: number;
    productionPriority?: 'NORMAL' | 'EXPRESS';
    productionDeadline?: string;
    productionNotes?: string;
}) => (await api.post('/transactions', data)).data;
export const payOffTransaction = async (id: number, data: { paymentMethod: string, bankAccountId?: number }) =>
    (await api.post(`/transactions/${id}/pay-off`, data)).data;
export const updateTransactionPaymentMethod = async (id: number, data: { paymentMethod: string; bankAccountId?: number }) =>
    (await api.patch(`/transactions/${id}/payment-method`, data)).data;

// Edit Transaction
type EditItemPayload = {
    id: number;
    quantity?: number;
    widthCm?: number;
    heightCm?: number;
    unitType?: string;
};
type EditTransactionPayload = {
    items: EditItemPayload[];
    discount?: number;
    customerName?: string;
    customerPhone?: string;
    customerAddress?: string;
};
export const editTransaction = async (id: number, data: EditTransactionPayload) =>
    (await api.patch(`/transactions/${id}`, data)).data;
export const submitEditRequest = async (id: number, data: EditTransactionPayload & { reason: string }) =>
    (await api.post(`/transactions/${id}/edit-request`, data)).data;

export type TransactionEditRequest = {
    id: number;
    transactionId: number;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    reason: string;
    editData: EditTransactionPayload;
    reviewNote: string | null;
    createdAt: string;
    updatedAt: string;
    transaction: { id: number; invoiceNumber: string; grandTotal: string; status: string; items: any[] };
    requestedBy: { id: number; name: string | null; email: string };
    reviewedBy: { id: number; name: string | null; email: string } | null;
};
export const getTransactionEditRequests = async (status?: string) => {
    const query = status ? `?status=${status}` : '';
    return (await api.get(`/transactions/edit-requests${query}`)).data as TransactionEditRequest[];
};
export const reviewTransactionEditRequest = async (requestId: number, data: { approved: boolean; reviewNote?: string }) =>
    (await api.patch(`/transactions/edit-requests/${requestId}/review`, data)).data;

// Bank Accounts
export const getBankAccounts = async () => (await api.get('/bank-accounts')).data;
export const createBankAccount = async (data: any) => (await api.post('/bank-accounts', data)).data;
export const updateBankAccount = async (id: number, data: any) => (await api.patch(`/bank-accounts/${id}`, data)).data;
export const deleteBankAccount = async (id: number) => (await api.delete(`/bank-accounts/${id}`)).data;
export const resetBankBalance = async (id: number, newBalance: number) =>
    (await api.patch(`/bank-accounts/${id}/reset-balance`, { newBalance })).data;
