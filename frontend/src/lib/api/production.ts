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
