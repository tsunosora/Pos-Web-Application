import api from './client';
import axios from 'axios';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export type TaskFrequency = 'ONCE' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';
export type TaskPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export interface TaskItem {
  id: number;
  scheduleId: number | null;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  index: number;
  dueDate: string | null;
  note: string | null;
  assigneeId: number | null;
  assignee?: { id: number; name: string | null } | null;
  completedAt: string | null;
  verifiedByOwnerAt: string | null;
  imageUrls?: string[]; // lampiran gambar brief (URL relatif)
}

export interface TaskSchedule {
  id: number;
  title: string;
  description: string | null;
  frequency: TaskFrequency;
  daysOfWeek: string | null;
  dayOfMonth: number | null;
  skipWeekends: boolean;
  timeOfDay: string | null;
  priority: TaskPriority;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
  assigneeId: number | null;
  groupId: number | null;
  targetRole: string | null;
  targetAll: boolean;
  shiftSlot?: 'PAGI' | 'KEDUA' | null; // piket: hanya utk yang memilih shift ini
  rotationUserIds?: string | null; // giliran harian "18,19,24,9"
  assignee?: { id: number; name: string | null } | null;
  group?: { id: number; name: string } | null;
}

// ---- Piket: pilih shift, teguran, pemantauan ----
export type ShiftChoice = 'PAGI' | 'KEDUA' | 'LIBUR';
export const SHIFT_LABEL: Record<ShiftChoice, string> = {
  PAGI: 'Shift Pagi',
  KEDUA: 'Shift Kedua',
  LIBUR: 'Libur / Izin',
};

export interface PiketMyDay {
  dateKey: string;
  needsCheckin: boolean;
  slots: string[];
  tasksBySlot: Record<string, string[]>;
  startsOn?: string | null; // belum ada piket hari ini → tanggal jadwal piket mulai
  trialUntil?: string | null; // hari ini masa uji coba (tanpa teguran) sampai tanggal ini
  checkin: { shift: ShiftChoice; at: string } | null;
}

export interface MyTaskWarning {
  id: number;
  kind: 'AUTO' | 'MANUAL';
  message: string;
  createdAt: string;
  createdByName: string | null;
  item: { id: number; title: string; status: TaskStatus; dueDate: string | null } | null;
}

export interface MonitorItem {
  id: number;
  title: string;
  status: TaskStatus;
  dueDate: string | null;
  completedAt: string | null;
  verifiedByOwnerAt: string | null;
  note: string | null;
  late: boolean;
  overdue: boolean;
  warned: boolean;
}
export interface MonitorWarning {
  id: number;
  kind: 'AUTO' | 'MANUAL';
  message: string;
  taskItemId: number | null;
  createdAt: string;
  acknowledgedAt: string | null;
  createdByName: string | null;
}
export interface MonitorRow {
  userId: number;
  name: string | null;
  shiftSlots: string[];
  checkin: { shift: ShiftChoice; at: string } | null;
  counts: { total: number; done: number; doneLate: number; open: number; overdue: number };
  items: MonitorItem[];
  warnings: MonitorWarning[];
}
/** Rencana tugas satu tanggal (dari jadwal; kartu belum dibuat). */
export interface PiketPlan {
  dateKey: string;
  trialUntil: string | null;
  shiftOptions: Partial<Record<'PAGI' | 'KEDUA', { title: string; timeOfDay: string | null }[]>>;
  rows: { userId: number; name: string; needsShift: boolean; tasks: { title: string; timeOfDay: string | null; rotation: boolean }[] }[];
}

export interface TaskMonitor {
  dateKey: string;
  graceMinutes: number;
  trialUntil?: string | null;
  trial?: boolean;
  plan?: PiketPlan | null; // tanggal yang akan datang
  rows: MonitorRow[];
}
export interface TaskRecapRow {
  userId: number;
  name: string;
  total: number;
  doneOnTime: number;
  doneLate: number;
  missed: number;
  pending: number;
  workDays: number;
  liburDays: number;
  warnAuto: number;
  warnManual: number;
  warnUnread: number;
  compliancePct: number | null;
}

export interface UpcomingTasks {
  serverNow: string;
  remindBeforeMinutes: number;
  graceMinutes: number;
  items: { id: number; title: string; status: TaskStatus; dueDate: string | null }[];
}

/** Checklist hari ini milik user login (untuk kartu "Piket hari ini" di dashboard). */
export const getMyTodayTasks = async () =>
  (await api.get('/task-board/today/mine')).data as PinTodayTask[];
export const getMyUpcomingTasks = async () =>
  (await api.get('/task-board/reminders/mine')).data as UpcomingTasks;
// ---- Piket lewat PIN (halaman /so-designer, /produksi, /cetak — tanpa login akun) ----
export type PinPiketState =
  | { linked: false; name: string }
  | { linked: true; name: string; day: PiketMyDay; warnings: MyTaskWarning[]; upcoming: UpcomingTasks; today: PinTodayTask[] };

/** Checklist hari ini milik pengguna PIN (dicentang langsung dari halaman kerjanya). */
export interface PinTodayTask {
  id: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  dueDate: string | null;
  completedAt: string | null;
}

// axios polos (bukan client JWT) supaya PIN salah (401) tidak memicu auto-logout.
const pinPost = async <T>(path: string, body: Record<string, unknown>): Promise<T> =>
  (await axios.post(`${BASE}/task-board/pin/${path}`, body)).data as T;

export const getPinPiketState = (designerId: number, pin: string) =>
  pinPost<PinPiketState>('state', { designerId, pin });
export const pinPiketCheckin = (designerId: number, pin: string, shift: ShiftChoice) =>
  pinPost<{ created: number; removed: number }>('checkin', { designerId, pin, shift });
export const pinAckTaskWarnings = (designerId: number, pin: string, ids: number[]) =>
  pinPost<{ acknowledged: number }>('warnings/ack', { designerId, pin, ids });
export const pinCompleteTask = (designerId: number, pin: string, itemId: number) =>
  pinPost<{ id: number; status: string }>(`items/${itemId}/done`, { designerId, pin });

// ---- Papan piket (semua karyawan) & masa uji coba ----
export interface PiketBoardTask {
  id: number;
  title: string;
  description: string | null;
  timeOfDay: string | null;
  frequency: TaskFrequency;
  daysOfWeek: string | null;
}
export interface PiketBoard {
  dateKey: string;
  trialUntil: string | null;
  shiftTasks: (PiketBoardTask & { slot: 'PAGI' | 'KEDUA' })[];
  shiftMembers: string[];
  groupTasks: (PiketBoardTask & { members: string[] })[];
  rotationTasks: PiketBoardTask[];
  rotation: {
    order: string[];
    weeks: { start: string; days: { date: string; iso: number; name: string | null; isToday: boolean; active: boolean }[] }[];
  } | null;
  today: {
    userId: number;
    name: string;
    needsShift: boolean;
    shift: ShiftChoice | null;
    tasks: { id: number; title: string; status: TaskStatus; dueDate: string | null; completedAt: string | null }[];
  }[];
  upcoming?: PiketPlan[]; // rencana 7 hari ke depan
  jadwalPdf?: { auto: true } | null; // PDF jadwal piket dibuat otomatis dari data papan ini
}
/** Simpan blob sebagai berkas unduhan di perangkat. */
function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
const PIKET_PDF_NAME = 'Jadwal-Piket-Pusat.pdf';

/** Unduh PDF jadwal piket (login akun). */
export const downloadPiketPdf = async () => {
  const res = await api.get('/task-board/board/pdf', { responseType: 'blob' });
  saveBlob(res.data as Blob, PIKET_PDF_NAME);
};
/** Unduh PDF jadwal piket (halaman PIN). */
export const downloadPinPiketPdf = async (designerId: number, pin: string) => {
  const res = await axios.post(`${BASE}/task-board/pin/board/pdf`, { designerId, pin }, { responseType: 'blob' });
  saveBlob(res.data as Blob, PIKET_PDF_NAME);
};

export const getPiketBoard = async () =>
  (await api.get('/task-board/board')).data as PiketBoard;
export const getPinPiketBoard = (designerId: number, pin: string) =>
  pinPost<PiketBoard>('board', { designerId, pin });
/** Tanda tangan PDF jadwal piket — diatur owner/manajer di Pengaturan → Umum. */
export interface PiketSignSlot {
  label: string;
  userId: number | null;
  roleId: number | null;
}
export const getPiketSignatures = async () =>
  (await api.get('/task-board/sign')).data as { signatures: PiketSignSlot[] };
export const setPiketSignatures = async (signatures: PiketSignSlot[]) =>
  (await api.patch('/task-board/sign', { signatures })).data as { signatures: PiketSignSlot[] };

export const getPiketTrial = async () =>
  (await api.get('/task-board/trial')).data as { trialUntil: string | null };
export const setPiketTrial = async (until: string | null) =>
  (await api.patch('/task-board/trial', { until })).data as { trialUntil: string | null };

export const getPiketMyDay = async () =>
  (await api.get('/task-board/my-day')).data as PiketMyDay;
export const piketCheckin = async (shift: ShiftChoice) =>
  (await api.post('/task-board/checkin', { shift })).data as { created: number; removed: number };
export const getMyTaskWarnings = async () =>
  (await api.get('/task-board/warnings/mine')).data as MyTaskWarning[];
export const ackMyTaskWarnings = async (ids?: number[]) =>
  (await api.post('/task-board/warnings/ack', ids?.length ? { ids } : {})).data as { acknowledged: number };
export const sendTaskWarning = async (userId: number, message: string) =>
  (await api.post('/task-board/warnings', { userId, message })).data;
export const getTaskMonitor = async (date?: string) =>
  (await api.get('/task-board/monitor', { params: { date } })).data as TaskMonitor;
export const getTaskRecap = async (month?: string) =>
  (await api.get('/task-board/monitor/recap', { params: { month } })).data as { month: string; rows: TaskRecapRow[]; trialUntil?: string | null };

export interface TaskGroupMember {
  id: number;
  userId: number;
  user?: { id: number; name: string | null } | null;
}
export interface TaskGroup {
  id: number;
  name: string;
  branchId: number | null;
  members: TaskGroupMember[];
}

export interface TaskSummaryRow {
  assigneeId: number | null;
  name: string;
  todo: number;
  inProgress: number;
  done: number;
  overdue: number;
}

// ---- Board items ----
export const getTaskItems = async (params?: { mine?: boolean; assigneeId?: number }) =>
  (
    await api.get('/task-board/items', {
      params: { mine: params?.mine ? 1 : undefined, assigneeId: params?.assigneeId },
    })
  ).data as TaskItem[];

export const createTaskItem = async (data: Partial<TaskItem>) =>
  (await api.post('/task-board/items', data)).data;

// Upload lampiran gambar tugas (multi) → daftar URL relatif.
export const uploadTaskImages = async (files: File[]) => {
  const fd = new FormData();
  files.forEach((f) => fd.append('images', f));
  return (
    await api.post('/task-board/upload-images', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  ).data as { urls: string[] };
};

export const updateTaskItem = async (id: number, data: Record<string, unknown>) =>
  (await api.patch(`/task-board/items/${id}`, data)).data;

export const moveTaskItem = async (id: number, data: { status: TaskStatus; index: number }) =>
  (await api.patch(`/task-board/items/${id}/move`, data)).data;

export const deleteTaskItem = async (id: number) =>
  (await api.delete(`/task-board/items/${id}`)).data;

export const getTaskSummary = async () =>
  (await api.get('/task-board/summary')).data as TaskSummaryRow[];

// ---- Schedules (jadwal berulang) ----
export const getTaskSchedules = async () =>
  (await api.get('/task-board/schedules')).data as TaskSchedule[];

export const createTaskSchedule = async (data: Record<string, unknown>) =>
  (await api.post('/task-board/schedules', data)).data;

export const updateTaskSchedule = async (id: number, data: Record<string, unknown>) =>
  (await api.patch(`/task-board/schedules/${id}`, data)).data;

export const deleteTaskSchedule = async (id: number) =>
  (await api.delete(`/task-board/schedules/${id}`)).data;

export const generateTasksNow = async () =>
  (await api.post('/task-board/schedules/generate-now')).data as { created: number; scanned: number };

// ---- Grup tim kustom ----
export const getTaskGroups = async () =>
  (await api.get('/task-board/groups')).data as TaskGroup[];
export const createTaskGroup = async (data: { name: string; memberIds?: number[] }) =>
  (await api.post('/task-board/groups', data)).data;
export const updateTaskGroup = async (id: number, data: { name?: string; memberIds?: number[] }) =>
  (await api.patch(`/task-board/groups/${id}`, data)).data;
export const deleteTaskGroup = async (id: number) =>
  (await api.delete(`/task-board/groups/${id}`)).data;
