import axios from 'axios';
import { getActiveBranchId } from '@/store/branch-store';

// Di aplikasi desktop, main process menyuntik base URL API lewat preload
// (window.electron.apiBaseUrl). Mode "100% offline" → backend LOKAL. Fallback ke
// env build-time (web) lalu localhost.
const desktopApiBase =
    typeof window !== 'undefined'
        ? (window as unknown as { electron?: { apiBaseUrl?: string } }).electron?.apiBaseUrl
        : undefined;

const api = axios.create({
    baseURL: desktopApiBase || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
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

// Auto-logout jika token expired atau tidak valid (401).
// 403 tidak auto-logout (izin resource spesifik), tapi token bisa kadaluarsa
// permission-nya — user perlu re-login untuk dapat token baru.
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (typeof window !== 'undefined') {
            if (error?.response?.status === 401) {
                // Halaman Studio Desain (/desainer) mengelola auth-nya SENDIRI
                // (login sendiri pakai akun POS). Jangan auto-logout/redirect global
                // dari sini — kalau tidak, 401 background (SyncManager dll) melempar
                // user ke /login POS.
                if (window.location.pathname.startsWith('/desainer')) {
                    return Promise.reject(error);
                }
                localStorage.removeItem('token');
                sessionStorage.removeItem('token');
                // Hapus juga cookie token. Middleware (server) mengizinkan akses
                // berdasarkan cookie ini; kalau cuma storage yang dibersihkan,
                // middleware masih lihat cookie → pantul /login → / → 401 lagi →
                // loop redirect tak henti (flicker). Format samakan dgn logout.
                document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
                if (!window.location.pathname.startsWith('/login')) {
                    window.location.href = '/login';
                }
            }
        }
        return Promise.reject(error);
    }
);

export default api;
