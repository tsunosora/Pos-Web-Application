import api from './client';

export type FinanceTimeframe = 'day' | 'week' | 'month' | 'year';

export interface FinanceCandle {
    time: string;
    open: number; high: number; low: number; close: number;
    income: number; expense: number; net: number;
    volume: number; txCount: number;
}
export interface FinanceCandlesResponse {
    timeframe: FinanceTimeframe;
    period: { startDate: string; endDate: string };
    summary: { openingBalance: number; closingBalance: number; totalIncome: number; totalExpense: number; net: number; changePct: number; trend: 'bullish' | 'bearish' | 'flat' };
    candles: FinanceCandle[];
}
export interface FinanceHeatmap {
    period: { startDate: string; endDate: string };
    byDayOfWeek: { dow: number; label: string; count: number; revenue: number }[];
    byHour: { hour: number; count: number; revenue: number }[];
    grid: { dow: number; hour: number; count: number; revenue: number }[];
    busiestDay: { dow: number; label: string; count: number; revenue: number };
    quietestDay: { dow: number; label: string; count: number; revenue: number } | null;
}
export interface FinanceJournalEntry {
    date: string;
    type: 'INCOME' | 'EXPENSE';
    source: 'cashflow' | 'fixed';
    category: string;
    label: string;
    amount: number;
    paymentMethod: string | null;
    refId: number | null;
    runningBalance: number;
}
export interface FinanceJournal {
    period: { startDate: string; endDate: string };
    openingBalance: number;
    closingBalance: number;
    days: { date: string; openingBalance: number; closingBalance: number; income: number; expense: number; entries: FinanceJournalEntry[] }[];
}
export interface FinanceAnomaly {
    date: string;
    type: string;
    severity: 'low' | 'med' | 'high';
    reason: string;
    amount: number;
    refId: number | null;
}

export interface FinanceExpenseBreakdown {
    period: { startDate: string; endDate: string };
    total: number;
    totalIncome: number;
    categories: { category: string; amount: number; pct: number }[];
}
export interface FinanceComparison {
    current: { income: number; expense: number; net: number; period: { startDate: string; endDate: string } };
    previous: { income: number; expense: number; net: number; period: { startDate: string; endDate: string } };
    delta: { income: number; expense: number; net: number; incomePct: number; expensePct: number; netPct: number };
    topExpenseChanges: { category: string; current: number; previous: number; delta: number }[];
    insights: string[];
}
export interface FinanceReconciliation {
    period: { startDate: string; endDate: string };
    bankAccounts: { name: string; balance: number }[];
    totalBankBalance: number;
    shiftReconciliation: { netDifference: number; absDifference: number; shiftsWithDiff: number; totalShifts: number };
    hasIssue: boolean;
}

export interface ConsolidationBranch {
    branchId: number;
    branchName: string;
    code: string | null;
    accounts: { id: number; bankName: string; accountNumber: string; balance: number }[];
    bankTotal: number;
    cash: number;
    cashAsOf: string | null;
    total: number;
    suggestedModal: number;
    closing: { status: "CLOSED" | "FUNDED"; modalTotal: number; closedAt: string | null; fundedAt: string | null } | null;
}
export interface FinanceConsolidation {
    period: { year: number; month: number; monthLabel: string };
    branches: ConsolidationBranch[];
    grandTotal: { bank: number; cash: number; total: number; suggestedModal: number };
}

export interface FinanceMonthlyReport {
    period: { year: number; month: number; monthLabel: string; startDate: string; endDate: string };
    branchName: string | null;
    summary: {
        income: number; expense: number; net: number; margin: number;
        incomeChannels: { channel: string; total: number }[];
        expenseCategories: { category: string; amount: number; pct: number }[];
        receivables: { gross: number; dp: number; sisa: number; count: number };
    };
    comparison: {
        previous: { income: number; expense: number; net: number; monthLabel: string };
        delta: { income: number; expense: number; net: number; incomePct: number; expensePct: number; netPct: number };
        topExpenseChanges: { category: string; current: number; previous: number; delta: number }[];
    };
    trend: {
        months: { year: number; month: number; label: string; income: number; expense: number; net: number; margin: number }[];
        direction: 'naik' | 'turun' | 'datar';
        avgMonthlyGrowthPct: number;
        bestMonth: { label: string; net: number } | null;
        worstMonth: { label: string; net: number } | null;
    };
    activity: {
        busiestDay: { label: string; count: number; revenue: number } | null;
        quietestDay: { label: string; count: number; revenue: number } | null;
    };
    anomalies: { count: number; items: { date: string; severity: 'low' | 'med' | 'high'; reason: string; amount: number }[] };
    analysis: {
        executive: string[];
        growth: string[];
        efficiency: string[];
        cashHealth: string[];
        warnings: string[];
        recommendations: string[];
    };
}

const qs = (o: Record<string, string | boolean | undefined>) => {
    const p = new URLSearchParams();
    Object.entries(o).forEach(([k, v]) => { if (v !== undefined) p.append(k, String(v)); });
    return p.toString();
};

export const getFinanceCandles = async (timeframe: FinanceTimeframe, startDate: string, endDate: string, includeFixed = true): Promise<FinanceCandlesResponse> =>
    (await api.get(`/reports/finance/candles?${qs({ timeframe, startDate, endDate, includeFixed })}`)).data;
export const getFinanceHeatmap = async (startDate: string, endDate: string): Promise<FinanceHeatmap> =>
    (await api.get(`/reports/finance/heatmap?${qs({ startDate, endDate })}`)).data;
export const getFinanceJournal = async (startDate: string, endDate: string, includeFixed = true): Promise<FinanceJournal> =>
    (await api.get(`/reports/finance/journal?${qs({ startDate, endDate, includeFixed })}`)).data;
export const getFinanceAnomalies = async (startDate: string, endDate: string): Promise<{ period: { startDate: string; endDate: string }; count: number; anomalies: FinanceAnomaly[] }> =>
    (await api.get(`/reports/finance/anomalies?${qs({ startDate, endDate })}`)).data;
export const getFinanceExpenseBreakdown = async (startDate: string, endDate: string, includeFixed = true): Promise<FinanceExpenseBreakdown> =>
    (await api.get(`/reports/finance/expense-breakdown?${qs({ startDate, endDate, includeFixed })}`)).data;
export const getFinanceComparison = async (startDate: string, endDate: string, includeFixed = true): Promise<FinanceComparison> =>
    (await api.get(`/reports/finance/comparison?${qs({ startDate, endDate, includeFixed })}`)).data;
export const getFinanceReconciliation = async (startDate: string, endDate: string): Promise<FinanceReconciliation> =>
    (await api.get(`/reports/finance/reconciliation?${qs({ startDate, endDate })}`)).data;
export const getFinanceConsolidation = async (year: number, month: number): Promise<FinanceConsolidation> =>
    (await api.get(`/reports/finance/consolidation`, { params: { year, month } })).data;
export const getFinanceMonthlyReport = async (year: number, month: number, includeFixed = true): Promise<FinanceMonthlyReport> =>
    (await api.get(`/reports/finance/monthly-report`, { params: { year, month, includeFixed } })).data;
export const closeBranchBalance = async (year: number, month: number, branchId: number): Promise<{ ok: boolean; collectedBank: number; collectedCash: number; total: number }> =>
    (await api.post(`/reports/finance/close-branch`, { year, month, branchId })).data;
export const fundBranchBalance = async (year: number, month: number, branchId: number, allocations: { bankAccountId: number; amount: number }[]): Promise<{ ok: boolean; modalTotal: number }> =>
    (await api.post(`/reports/finance/fund-branch`, { year, month, branchId, allocations })).data;
