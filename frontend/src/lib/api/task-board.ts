import api from './client';

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
  assignee?: { id: number; name: string | null } | null;
  group?: { id: number; name: string } | null;
}

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
