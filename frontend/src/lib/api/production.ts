// Production Queue — all endpoints use raw fetch (no JWT, public access)
const API_BASE = () => process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface PublicBranch { id: number; name: string; code: string | null; phone: string | null }

export const getPublicBranches = async (): Promise<PublicBranch[]> => {
    const res = await fetch(`${API_BASE()}/company-branches/public-active`);
    return res.json();
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
    return res.json();
};

export const getProductionJobs = async (status?: string, branchId?: number): Promise<any[]> => {
    const url = `${API_BASE()}/production/jobs${qs({ status, branchId })}`;
    const res = await fetch(url);
    return res.json();
};

export const getProductionRolls = async (branchId?: number): Promise<any[]> => {
    const res = await fetch(`${API_BASE()}/production/rolls${qs({ branchId })}`);
    return res.json();
};

export const getProductionStats = async (branchId?: number): Promise<{ antrian: number; proses: number; menungguPasang: number; pasang: number; selesai: number }> => {
    const res = await fetch(`${API_BASE()}/production/stats${qs({ branchId })}`);
    return res.json();
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
