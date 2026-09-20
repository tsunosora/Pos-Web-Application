import api from './client';

/**
 * Ringkasan HR harian dari RateMyStaff.
 *
 * Browser TIDAK boleh memanggil RateMyStaff langsung: kuncinya hanya ada di
 * server dan endpoint sana menolak pemanggil non-loopback. Jalurnya selalu
 * browser → backend PosPro (/hr/summary) → RateMyStaff.
 */
export interface HrSummary {
    available: boolean;
    reason?: string;
    date?: string;
    generatedAt?: string;
    attendance?: {
        employees: number;
        present: number;
        onTime: number;
        late: number;
        leave: number;
        notYetIn: number;
        rate: number;
    };
    lateToday?: { name: string; clockIn: string; lateMinutes: number }[];
    onLeaveToday?: { name: string; reason?: string | null }[];
    pendingLeave?: number;
    points?: {
        enabled: boolean;
        periodLabel?: string;
        top?: { name: string; points: number }[];
    };
}

export const getHrSummary = async (): Promise<HrSummary> =>
    (await api.get('/hr/summary')).data;

/** Tautan portal absensi pribadi milik pengguna yang sedang login. */
export interface HrMyPortal {
    found: boolean;
    name?: string;
    portalUrl?: string;
    /** false = karyawan belum pernah membuat PIN portal. */
    hasPin?: boolean;
}

export const getMyHrPortal = async (): Promise<HrMyPortal> =>
    (await api.get('/hr/my-portal')).data;

/**
 * Versi untuk halaman kerja ber-PIN (/so-designer, /produksi, /cetak): di sana
 * tidak ada login email, jadi identitas dibuktikan dengan PIN yang sama seperti
 * pop-up piket. Backend memverifikasi PIN sebelum mengembalikan tautan.
 */
export const getMyHrPortalByPin = async (designerId: number, pin: string): Promise<HrMyPortal> =>
    (await api.post('/hr/pin/my-portal', { designerId, pin })).data;
