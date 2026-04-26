import axios from 'axios';
import { getActiveBranchId } from '@/store/branch-store';

const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
    headers: {
        'Content-Type': 'application/json',
    },
});

api.interceptors.request.use((config) => {
    // All mutating pages are "use client" — only localStorage matters
    let token: string | null = null;
    if (typeof window !== 'undefined') {
        token = localStorage.getItem('token') || sessionStorage.getItem('token');
    }
    if (token) {
        config.headers.set('Authorization', `Bearer ${token}`);
    }

    // Multi-cabang: Owner/SuperAdmin kirim X-Branch-Id dari store (bisa null = Semua Cabang).
    // Staff: backend pakai branchId dari JWT, header ini diabaikan — tetap kirim untuk konsistensi.
    if (typeof window !== 'undefined') {
        try {
            const activeBranchId = getActiveBranchId();
            if (activeBranchId != null) {
                config.headers.set('X-Branch-Id', String(activeBranchId));
            } else {
                // Jangan kirim header → backend treat as "Semua Cabang" untuk Owner.
                config.headers.delete('X-Branch-Id');
            }
        } catch {
            // ignore — store might not be hydrated
        }
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

// Auto-logout jika token expired atau tidak valid (401)
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (typeof window !== 'undefined' && error?.response?.status === 401) {
            localStorage.removeItem('token');
            sessionStorage.removeItem('token');
            // Redirect ke login hanya jika bukan sudah di halaman login
            if (!window.location.pathname.startsWith('/login')) {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default api;
