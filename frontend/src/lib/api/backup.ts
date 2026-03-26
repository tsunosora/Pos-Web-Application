import api from './client';

export const getBackupGroups = async () => (await api.get('/backup/groups')).data;
export const previewBackupFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return (await api.post('/backup/preview', formData, { headers: { 'Content-Type': 'multipart/form-data' } })).data;
};
export const exportBackup = async (groups: string[], includeImages = true): Promise<Blob> => {
    const res = await api.post('/backup/export', { groups, includeImages }, { responseType: 'blob' });
    return res.data;
};
export const restoreBackup = async (file: File, mode: 'skip' | 'overwrite', tables?: string[]) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('mode', mode);
    if (tables && tables.length > 0) formData.append('tables', tables.join(','));
    return (await api.post('/backup/restore', formData, { headers: { 'Content-Type': 'multipart/form-data' } })).data;
};
