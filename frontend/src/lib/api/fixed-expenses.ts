import api from './client';

export type FixedExpenseCategory = 'GAJI' | 'SEWA' | 'ANGSURAN' | 'SUPPLIER' | 'LAINNYA';

export interface FixedExpense {
    id: number;
    name: string;
    category: FixedExpenseCategory;
    amount: number;
    branchId: number | null;   // null = pusat / semua cabang
    dueDay: number | null;     // tanggal jatuh tempo 1-31 (opsional)
    note: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface FixedExpenseInput {
    name: string;
    category: FixedExpenseCategory;
    amount: number;
    branchId?: number | null;
    dueDay?: number | null;
    note?: string | null;
    isActive?: boolean;
}

export const getFixedExpenses = async (): Promise<FixedExpense[]> =>
    (await api.get('/fixed-expenses')).data;

export const createFixedExpense = async (data: FixedExpenseInput): Promise<FixedExpense> =>
    (await api.post('/fixed-expenses', data)).data;

export const updateFixedExpense = async (id: number, data: Partial<FixedExpenseInput>): Promise<FixedExpense> =>
    (await api.patch(`/fixed-expenses/${id}`, data)).data;

export const deleteFixedExpense = async (id: number): Promise<{ id: number }> =>
    (await api.delete(`/fixed-expenses/${id}`)).data;
