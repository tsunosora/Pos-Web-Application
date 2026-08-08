import api from './client';

export const getBackupGroups = async () => (await api.get('/backup/groups')).data;
export const previewBackupFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return (await api.post('/backup/preview', formData, { headers: { 'Content-Type': 'multipart/form-data' } })).data;
};
export const exportBackup = async (groups: string[], includeImages = true): Promise<{ blob: Blob; filename: string }> => {
    const res = await api.post('/backup/export', { groups, includeImages }, { responseType: 'blob' });
    const cd: string = (res.headers?.['content-disposition'] as string) || '';
    const m = /filename="?([^"]+)"?/.exec(cd);
    return { blob: res.data, filename: m ? m[1] : '' };
};
export const restoreBackup = async (file: File, mode: 'skip' | 'overwrite', tables?: string[]) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('mode', mode);
    if (tables && tables.length > 0) formData.append('tables', tables.join(','));
    return (await api.post('/backup/restore', formData, { headers: { 'Content-Type': 'multipart/form-data' } })).data;
};

// ── Rclone ────────────────────────────────────────────────────────────────────
export const getRcloneStatus = async () => (await api.get('/backup/rclone/status')).data;
export const saveRcloneSettings = async (data: {
    enabled: boolean;
    remote?: string;
    schedule?: string;
    keepCount?: number;
}) => (await api.post('/backup/rclone/settings', data)).data;
export const triggerRcloneBackup = async () => (await api.post('/backup/rclone/trigger')).data;

export interface RcloneProgress {
    running: boolean;
    phase: string;
    percent: number;
    detail: string;
    startedAt: string | null;
    finishedAt: string | null;
    ok: boolean | null;
    error: string | null;
}
export const getRcloneProgress = async (): Promise<RcloneProgress> => (await api.get('/backup/rclone/progress')).data;
