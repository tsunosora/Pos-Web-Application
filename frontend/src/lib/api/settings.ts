import api from './client';

// Store Settings
export const getSettings = async () => (await api.get('/settings')).data;
export const updateSettings = async (data: any) => (await api.patch('/settings', data)).data;
export const getPublicSettings = async () => {
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const res = await fetch(`${base}/settings/public`, { cache: 'no-store' });
    return res.json();
};
export const uploadLoginBgImage = async (file: File) => {
    const fd = new FormData();
    fd.append('image', file);
    return (await api.post('/settings/upload-login-bg', fd, { headers: { 'Content-Type': 'multipart/form-data' } })).data;
};
export const uploadQrisImage = async (file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    return (await api.post('/settings/upload-qris', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    })).data;
};
export const uploadLogoImage = async (file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    return (await api.post('/settings/upload-logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    })).data;
};

// Users & Roles
export const getUsers = async () => (await api.get('/users')).data;
export const createUser = async (data: any) => (await api.post('/users', data)).data;
export const updateUser = async (id: number, data: { name?: string, roleId?: number, phone?: string, password?: string, branchId?: number | null }) =>
    (await api.patch(`/users/${id}`, data)).data;
export const deleteUser = async (id: number) => (await api.delete(`/users/${id}`)).data;
export const getRoles = async () => (await api.get('/users/roles')).data;
export const createRole = async (data: { name: string }) => (await api.post('/users/roles', data)).data;
export const updateRole = async (id: number, data: { name: string }) => (await api.patch(`/users/roles/${id}`, data)).data;
export const deleteRole = async (id: number) => (await api.delete(`/users/roles/${id}`)).data;

// Branch Settings (per cabang)
export const getBranchSettings = async (branchId: number) =>
    (await api.get(`/branch-settings/${branchId}`)).data;
export const updateBranchSettings = async (branchId: number, data: any) =>
    (await api.put(`/branch-settings/${branchId}`, data)).data;

// Branches
export const getBranches = async () => (await api.get('/branches')).data;
export const createBranch = async (data: any) => (await api.post('/branches', data)).data;
export const updateBranch = async (id: number, data: any) => (await api.patch(`/branches/${id}`, data)).data;
export const deleteBranch = async (id: number) => (await api.delete(`/branches/${id}`)).data;

// Competitors
export const getCompetitors = async () => (await api.get('/competitors')).data;
export const createCompetitor = async (data: any) => (await api.post('/competitors', data)).data;
export const updateCompetitor = async (id: number, data: any) => (await api.patch(`/competitors/${id}`, data)).data;
export const deleteCompetitor = async (id: number) => (await api.delete(`/competitors/${id}`)).data;
