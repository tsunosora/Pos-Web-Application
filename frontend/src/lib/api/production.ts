// Production Queue — all endpoints use raw fetch (no JWT, public access)
const API_BASE = () => process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface PublicBranch { id: number; name: string; code: string | null; phone: string | null }

/**
 * Helper: parse response, throw informative Error kalau status tidak OK.
 * Jangan biarkan response error di-coerce jadi data — bisa nyebabkan error misleading
 * di tempat jauh (mis. "PIN salah" padahal endpoint 404).
 */
async function parseResponse<T>(res: Response, action: string): Promise<T> {
    if (!res.ok) {
        let serverMessage = '';
        try {
            const body = await res.json();
            serverMessage = body?.message || body?.error || '';
        } catch {
            // Body bukan JSON (mis. HTML 404 page) — abaikan
        }
        throw new Error(
            `${action} gagal (HTTP ${res.status})${serverMessage ? ': ' + serverMessage : ''}`,
        );
    }
    return res.json();
}

export const getPublicBranches = async (): Promise<PublicBranch[]> => {
    const res = await fetch(`${API_BASE()}/company-branches/public-active`);
    return parseResponse<PublicBranch[]>(res, 'Memuat daftar cabang');
};

/** Helper: build query string dengan optional branchId */
function qs(params: Record<string, string | number | undefined>): string {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v != null && v !== '') sp.append(k, String(v));
    }
    const s = sp.toString();
    return s ? `?${s}` : '';
}

export const verifyOperatorPin = async (pin: string, branchId?: number): Promise<{ valid: boolean; message?: string }> => {
    const res = await fetch(`${API_BASE()}/production/pin/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, branchId }),
    });
    return parseResponse<{ valid: boolean; message?: string }>(res, 'Verifikasi PIN');
};

export const getProductionJobs = async (status?: string, branchId?: number): Promise<any[]> => {
    const url = `${API_BASE()}/production/jobs${qs({ status, branchId })}`;
    const res = await fetch(url);
    return parseResponse<any[]>(res, 'Memuat antrian produksi');
};

export const getProductionRolls = async (branchId?: number): Promise<any[]> => {
    const res = await fetch(`${API_BASE()}/production/rolls${qs({ branchId })}`);
    return parseResponse<any[]>(res, 'Memuat daftar bahan roll');
};

export const getProductionStats = async (branchId?: number): Promise<{ antrian: number; proses: number; menungguPasang: number; pasang: number; selesai: number }> => {
    const res = await fetch(`${API_BASE()}/production/stats${qs({ branchId })}`);
    return parseResponse(res, 'Memuat statistik produksi');
};

export const startProductionJob = async (id: number, data: {
    rollVariantId?: number;
    usedWaste: boolean;
    rollAreaM2?: number;
    operatorNote?: string;
}): Promise<any> => {
    const res = await fetch(`${API_BASE()}/production/jobs/${id}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error((await res.json()).message || 'Gagal memulai job');
    return res.json();
};

export const completeProductionJob = async (id: number, operatorNote?: string): Promise<any> => {
    const res = await fetch(`${API_BASE()}/production/jobs/${id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatorNote }),
    });
    if (!res.ok) throw new Error((await res.json()).message || 'Gagal menyelesaikan job');
    return res.json();
};

export const pickupProductionJob = async (id: number): Promise<any> => {
    const res = await fetch(`${API_BASE()}/production/jobs/${id}/pickup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error((await res.json()).message || 'Gagal pickup job');
    return res.json();
};

export interface BulkPickupResult {
    updated: number;
    skipped: { id: number; reason: string }[];
}

export const bulkPickupProductionJobs = async (ids: number[], branchId?: number): Promise<BulkPickupResult> => {
    const res = await fetch(`${API_BASE()}/production/jobs/bulk-pickup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, branchId }),
    });
    if (!res.ok) throw new Error((await res.json()).message || 'Gagal bulk pickup');
    return res.json();
};

// ─── Meter Reading (Rekonsiliasi Operator) — public endpoints ───────────────
// NOTE: nama-nama prefix `Operator` supaya tidak bentrok dengan
// `MeterReading`/`upsertMeterReading`/`getMeterReadings` di `./click-counting`
// (admin /click-counting page pakai versi click-counting via barrel `@/lib/api`).
// /cetak page pakai versi operator ini lewat import langsung.

export interface OperatorMeterReading {
    id: number;
    branchId: number | null;
    readingDate: string;
    totalCount: number;
    fullColorCount: number;
    blackCount: number;
    singleColorCount: number;
    photoUrl: string | null;
    notes: string | null;
    createdAt: string;
}

/** Upload foto counter — return path URL untuk dipakai sebagai photoUrl di reading. */
export const uploadOperatorMeterPhoto = async (file: File): Promise<string> => {
    const fd = new FormData();
    fd.append('image', file);
    const res = await fetch(`${API_BASE()}/production/meter/upload-photo`, {
        method: 'POST',
        body: fd,
    });
    if (!res.ok) throw new Error((await res.json()).message || 'Gagal upload foto');
    const data = await res.json();
    // Backend return path relatif (mis. "/uploads/meter_xxx.jpg"). Prefix dengan
    // base API supaya browser fetch dari domain backend, bukan domain frontend.
    const url = data.url as string;
    if (url && url.startsWith('/')) return `${API_BASE()}${url}`;
    return url;
};

export const upsertOperatorMeterReading = async (data: {
    branchId: number;
    readingDate: string;
    totalCount: number;
    fullColorCount: number;
    blackCount: number;
    singleColorCount?: number;
    photoUrl?: string;
    notes?: string;
}): Promise<OperatorMeterReading> => {
    const res = await fetch(`${API_BASE()}/production/meter/reading`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error((await res.json()).message || 'Gagal simpan pembacaan');
    return res.json();
};

/** Resolve photoUrl relatif → absolute (backend serve uploads di domain API). */
const resolvePhotoUrl = (url: string | null | undefined): string | null => {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    if (url.startsWith('/')) return `${API_BASE()}${url}`;
    return url;
};

export const getOperatorMeterReadings = async (branchId: number, startDate?: string, endDate?: string): Promise<OperatorMeterReading[]> => {
    const params = new URLSearchParams();
    params.append('branchId', String(branchId));
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const res = await fetch(`${API_BASE()}/production/meter/readings?${params.toString()}`);
    if (!res.ok) return [];
    const list = await res.json();
    return (list as OperatorMeterReading[]).map(r => ({ ...r, photoUrl: resolvePhotoUrl(r.photoUrl) }));
};

// ─── Machine Reject (operator reject input) ─────────────────────────────────

// NOTE: Symbol-symbol di bawah pakai prefix `Operator` supaya tidak bentrok
// dengan `MachineReject`/`createMachineReject`/`getMachineRejects`/`RejectType`
// yang sudah di-export dari `./click-counting` (barrel `@/lib/api` akan ambigu
// kalau nama-nama identik di-export dari dua tempat). /cetak hanya pakai
// nama-nama operator ini lewat import langsung dari `@/lib/api/production`.

export type OperatorRejectType = 'MACHINE_ERROR' | 'TEST_PRINT' | 'CALIBRATION' | 'HUMAN_ERROR';
export type OperatorRejectCause = 'MACHINE' | 'HUMAN';
export type OperatorCounterType = 'FULL_COLOR' | 'BLACK' | 'SINGLE_COLOR';

export interface OperatorMachineReject {
    id: number;
    branchId: number | null;
    rejectType: OperatorRejectType;
    cause: OperatorRejectCause;
    counterType: OperatorCounterType;
    quantity: number;
    pricePerClick: string | number;
    totalCost: string | number;
    photoUrl: string | null;
    notes: string | null;
    date: string;
    createdAt: string;
}

export const createOperatorMachineReject = async (data: {
    branchId: number;
    rejectType: OperatorRejectType;
    cause?: OperatorRejectCause;
    counterType?: OperatorCounterType;
    quantity: number;
    pricePerClick?: number;
    notes?: string;
    photoUrl?: string;
    date?: string;
}): Promise<OperatorMachineReject> => {
    const res = await fetch(`${API_BASE()}/production/meter/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error((await res.json()).message || 'Gagal simpan reject');
    return res.json();
};

export const getOperatorMachineRejects = async (branchId: number, month?: number, year?: number): Promise<OperatorMachineReject[]> => {
    const params = new URLSearchParams();
    params.append('branchId', String(branchId));
    if (month) params.append('month', String(month));
    if (year) params.append('year', String(year));
    const res = await fetch(`${API_BASE()}/production/meter/rejects?${params.toString()}`);
    if (!res.ok) return [];
    const list = await res.json();
    return (list as OperatorMachineReject[]).map(r => ({ ...r, photoUrl: resolvePhotoUrl(r.photoUrl) }));
};

export const startAssemblyJob = async (id: number, assemblyNote?: string): Promise<any> => {
    const res = await fetch(`${API_BASE()}/production/jobs/${id}/start-assembly`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assemblyNote }),
    });
    if (!res.ok) throw new Error((await res.json()).message || 'Gagal memulai pemasangan');
    return res.json();
};

export const completeAssemblyJob = async (id: number, assemblyNote?: string): Promise<any> => {
    const res = await fetch(`${API_BASE()}/production/jobs/${id}/complete-assembly`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assemblyNote }),
    });
    if (!res.ok) throw new Error((await res.json()).message || 'Gagal menyelesaikan pemasangan');
    return res.json();
};

export const createProductionBatch = async (data: {
    jobIds: number[];
    rollVariantId?: number;
    usedWaste: boolean;
    totalAreaM2?: number;
}): Promise<any> => {
    const res = await fetch(`${API_BASE()}/production/batches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error((await res.json()).message || 'Gagal membuat batch');
    return res.json();
};

export const completeProductionBatch = async (id: number): Promise<any> => {
    const res = await fetch(`${API_BASE()}/production/batches/${id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error((await res.json()).message || 'Gagal menyelesaikan batch');
    return res.json();
};
