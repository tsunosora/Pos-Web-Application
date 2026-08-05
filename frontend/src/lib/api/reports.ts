import api from './client';

// Target omzet harian per cabang (vs beban tetap bulanan)
export interface DailyTargetBranch {
    branchId: number;
    branchName: string;
    monthlyFixedExpense: number;
    dailyTarget: number;
    isOverride: boolean;
    todayOmzet: number;
    pct: number;
    met: boolean;
    shortfall: number;
}
export interface DailyTargetStatusResponse {
    today: string;
    daysInMonth: number;
    branches: DailyTargetBranch[];
}
export const getDailyTargetStatus = async (): Promise<DailyTargetStatusResponse> =>
    (await api.get('/reports/finance/daily-target-status')).data;

// Dashboard & Sales
export const getDashboardMetrics = async () => (await api.get('/transactions/dashboard/metrics')).data;
export const getSalesChart = async (period: string) => (await api.get(`/transactions/dashboard/chart?period=${period}`)).data;
export const getCashierStats = async (startDate?: string, endDate?: string) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return (await api.get(`/transactions/dashboard/cashier-stats?${params.toString()}`)).data;
};
export const getSalesSummary = async (startDate?: string, endDate?: string, sortBy: 'qty' | 'revenue' = 'qty', limit: number = 20) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    params.append('sortBy', sortBy);
    params.append('limit', String(limit));
    return (await api.get(`/transactions/reports/summary?${params.toString()}`)).data;
};
export const getProfitReport = async (startDate?: string, endDate?: string) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return (await api.get(`/reports/profit?${params.toString()}`)).data;
};

// Distribusi orderan (LUNAS) per jam mulai — untuk memantau kapan ramai/sepi.
export type OrderHourLevel = 'ramai' | 'normal' | 'sepi' | 'tutup';
export type OrdersByHourReport = {
    period: { startDate: string | null; endDate: string | null };
    totalOrders: number;
    byHour: { hour: number; count: number; revenue: number; level: OrderHourLevel }[];
    operating: { from: number; to: number } | null;
    avgPerHour: number;
    peakHour: number | null;
    quietHour: number | null;
    busyRange: { from: number; to: number } | null;
    quietRange: { from: number; to: number } | null;
};
export const getOrdersByHour = async (
    startDate?: string,
    endDate?: string,
): Promise<OrdersByHourReport> => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return (await api.get(`/reports/orders-by-hour?${params.toString()}`)).data;
};

// Laporan Tutup Buku bulanan (basis kas) — pendapatan per kanal, pengeluaran
// per kategori, laba, piutang. Cabang mengikuti header X-Branch-Id (branch store).
export interface MonthlyClosing {
    period: { year: number; month: number; monthLabel: string; start: string; end: string; weekLabels: string[] };
    branchName: string | null;
    income: { channels: { channel: string; weeks: number[]; total: number }[]; total: number };
    expense: { categories: { category: string; weeks: number[]; total: number; details: { date: string; keterangan: string; channel: string; amount: number }[] }[]; total: number };
    profit: number;
    receivables: { rows: { name: string; keterangan: string; jumlah: number; dp: number; sisa: number; status: string; invoice: string }[]; gross: number; dp: number; sisa: number };
}
export const getMonthlyClosing = async (year: number, month: number): Promise<MonthlyClosing> =>
    (await api.get(`/reports/closing`, { params: { year, month } })).data;

// Shift Close
export const getShiftExpectations = async () => (await api.get('/reports/current-shift')).data;
export const getStaffList = async () => (await api.get('/reports/staff-list')).data;
export const closeShift = async (formData: FormData) => (await api.post('/reports/close-shift', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
})).data;

// Shift History & Resend
export const getShiftHistory = async (page = 1, limit = 20) =>
    (await api.get(`/reports/shift-history?page=${page}&limit=${limit}`)).data;
export const resendShiftReport = async (id: number) =>
    (await api.post(`/reports/shift/${id}/resend`)).data;
export const amendShiftReport = async (id: number, data: {
    actualCash?: number;
    actualQris?: number;
    actualTransfer?: number;
    structuredExpenses?: any;
    kasbon?: any;
    setorKas?: any;
    tarikTunai?: any;
    additionalIncomes?: any;
    tukarTransferKeCash?: number;
    paymentExchanges?: any;
    actualBankBalances?: any;
    realBankBalances?: any;
    notes?: string;
    amendNote: string;
}) => (await api.patch(`/reports/shift/${id}/amend`, data)).data;
