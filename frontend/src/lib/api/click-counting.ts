import api from './client';

// ─── Photo Upload ─────────────────────────────────────────────────────────────

export const uploadCounterPhoto = async (file: File): Promise<string> => {
  const form = new FormData();
  form.append('image', file);
  const res = await api.post('/click-counting/upload-photo', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.url as string;
};

// ─── Types ───────────────────────────────────────────────────────────────────

export type RejectCause = 'MACHINE' | 'HUMAN';
export type CounterType = 'FULL_COLOR' | 'BLACK' | 'SINGLE_COLOR';
export type RejectType = 'MACHINE_ERROR' | 'TEST_PRINT' | 'CALIBRATION' | 'HUMAN_ERROR';

export interface ClickRate {
  id: number;
  name: string;
  paperSize: 'A3_PLUS' | 'A4';
  colorMode: 'COLOR' | 'BW';
  sideMode: 'SIMPLEX' | 'DUPLEX';
  pricePerClick: number;
  isActive: boolean;
  createdAt: string;
}

export interface ClickLog {
  id: number;
  clickRateId: number;
  quantity: number;
  pricePerClick: number;
  totalCost: number;
  date: string;
  transactionItemId: number | null;
  clickRate: ClickRate;
  transactionItem?: {
    id: number;
    transaction: {
      id: number;
      invoiceNumber: string;
      customerName: string | null;
    };
  } | null;
}

export interface MachineReject {
  id: number;
  rejectType: 'MACHINE_ERROR' | 'TEST_PRINT' | 'CALIBRATION' | 'HUMAN_ERROR';
  cause: RejectCause;
  counterType: CounterType;
  quantity: number;
  pricePerClick: number;
  totalCost: number;
  photoUrl: string | null;
  notes: string | null;
  date: string;
}

export interface MeterReading {
  id: number;
  readingDate: string;
  totalCount: number;
  fullColorCount: number;
  blackCount: number;
  singleColorCount: number;
  photoUrl: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VendorBill {
  period: {
    requestedStart: string;
    requestedEnd: string;
    actualStart: string;
    actualEnd: string;
  };
  meterStart: MeterReading;
  meterEnd: MeterReading;
  deltas: { total: number; fullColor: number; black: number; singleColor: number };
  machineRejects: { fullColor: number; black: number; singleColor: number };
  humanRejects: { fullColor: number; black: number; singleColor: number };
  billableClicks: { fullColor: number; black: number };
  rates: { fullColor: number; black: number };
  costs: { fullColor: number; black: number; grandTotal: number };
  sanityCheck: { expected: number; actual: number; mismatch: boolean };
  rejectDetails: MachineReject[];
}

export interface Reconciliation {
  month: number;
  year: number;
  meterStart: MeterReading | null;
  meterEnd: MeterReading | null;
  totalMachineClicks: number | null;
  totalLoggedClicks: number;
  totalRejectClicks: number;
  totalLoggedCost: number;
  totalRejectCost: number;
  unrecordedClicks: number | null;
  amountToPay: number;
  byRate: { name: string; quantity: number; totalCost: number }[];
  clickLogs: ClickLog[];
  machineRejects: MachineReject[];
}

export interface ClickDashboard {
  month: number;
  year: number;
  totalClicks: number;
  totalCost: number;
  totalRejects: number;
  totalRejectCost: number;
  meterReading: MeterReading | null;
  byRate: { name: string; quantity: number; totalCost: number }[];
}

// ─── Click Rates ─────────────────────────────────────────────────────────────

export const getClickRates = async (): Promise<ClickRate[]> =>
  (await api.get('/click-counting/rates')).data;

export const createClickRate = async (data: {
  name: string;
  paperSize: string;
  colorMode: string;
  sideMode: string;
  pricePerClick: number;
}): Promise<ClickRate> => (await api.post('/click-counting/rates', data)).data;

export const seedClickRates = async (): Promise<{ created: number; skipped: number; message: string }> =>
  (await api.post('/click-counting/rates/seed')).data;

export const updateClickRate = async (
  id: number,
  data: { name?: string; pricePerClick?: number; isActive?: boolean },
): Promise<ClickRate> => (await api.put(`/click-counting/rates/${id}`, data)).data;

export const deleteClickRate = async (id: number): Promise<void> =>
  (await api.delete(`/click-counting/rates/${id}`)).data;

// ─── Click Logs ──────────────────────────────────────────────────────────────

export const getClickLogs = async (month?: number, year?: number): Promise<ClickLog[]> => {
  const params = new URLSearchParams();
  if (month) params.append('month', String(month));
  if (year) params.append('year', String(year));
  return (await api.get(`/click-counting/logs?${params.toString()}`)).data;
};

export const createClickLog = async (data: {
  clickRateId: number;
  quantity: number;
  date?: string;
  transactionItemId?: number;
}): Promise<ClickLog> => (await api.post('/click-counting/logs', data)).data;

export const deleteClickLog = async (id: number): Promise<void> =>
  (await api.delete(`/click-counting/logs/${id}`)).data;

// ─── Machine Rejects ─────────────────────────────────────────────────────────

export const getMachineRejects = async (month?: number, year?: number): Promise<MachineReject[]> => {
  const params = new URLSearchParams();
  if (month) params.append('month', String(month));
  if (year) params.append('year', String(year));
  return (await api.get(`/click-counting/rejects?${params.toString()}`)).data;
};

export const createMachineReject = async (data: {
  rejectType: string;
  cause?: RejectCause;
  counterType?: CounterType;
  quantity: number;
  pricePerClick?: number;
  notes?: string;
  photoUrl?: string;
  date?: string;
}): Promise<MachineReject> => (await api.post('/click-counting/rejects', data)).data;

export const deleteMachineReject = async (id: number): Promise<void> =>
  (await api.delete(`/click-counting/rejects/${id}`)).data;

// ─── Meter Readings (harian) ─────────────────────────────────────────────────

export const getMeterReadings = async (startDate?: string, endDate?: string): Promise<MeterReading[]> => {
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  return (await api.get(`/click-counting/meter?${params.toString()}`)).data;
};

export const getMeterReadingByDate = async (date: string): Promise<MeterReading | null> =>
  (await api.get(`/click-counting/meter/by-date?date=${date}`)).data;

export const upsertMeterReading = async (data: {
  readingDate: string;
  totalCount: number;
  fullColorCount: number;
  blackCount: number;
  singleColorCount?: number;
  photoUrl?: string;
  notes?: string;
}): Promise<MeterReading> => (await api.post('/click-counting/meter', data)).data;

export const deleteMeterReading = async (id: number): Promise<void> =>
  (await api.delete(`/click-counting/meter/${id}`)).data;

// LEGACY alias — kompatibilitas kode lama yang pakai getMeterReading(month,year)
export const getMeterReading = async (_month: number, _year: number): Promise<MeterReading | null> => {
  // Deprecated: mapping ke readings terbaru di periode bulan tsb
  const params = new URLSearchParams();
  const start = new Date(_year, _month - 1, 1).toISOString().slice(0, 10);
  const end = new Date(_year, _month, 0).toISOString().slice(0, 10);
  params.append('startDate', start);
  params.append('endDate', end);
  const list: MeterReading[] = (await api.get(`/click-counting/meter?${params.toString()}`)).data;
  return list.length > 0 ? list[0] : null;
};

// ─── Vendor Bill ─────────────────────────────────────────────────────────────

export const getVendorBill = async (startDate: string, endDate: string): Promise<VendorBill> =>
  (await api.get(`/click-counting/vendor-bill?startDate=${startDate}&endDate=${endDate}`)).data;

// ─── Reconciliation & Dashboard ───────────────────────────────────────────────

export const getClickReconciliation = async (month: number, year: number): Promise<Reconciliation> =>
  (await api.get(`/click-counting/reconciliation?month=${month}&year=${year}`)).data;

export const getClickDashboard = async (month: number, year: number): Promise<ClickDashboard> =>
  (await api.get(`/click-counting/dashboard?month=${month}&year=${year}`)).data;
