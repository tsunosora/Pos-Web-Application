// Pure helper functions and types for the produksi (production) feature

export type Tab = 'ANTRIAN' | 'PROSES' | 'MENUNGGU_PASANG' | 'PASANG' | 'SELESAI' | 'DIAMBIL';

export const PIN_KEY = 'produksi_pin_session';
export const PIN_TTL = 24 * 60 * 60 * 1000; // 24 jam

export function getStoredSession(): boolean {
    try {
        const raw = localStorage.getItem(PIN_KEY);
        if (!raw) return false;
        const { expires } = JSON.parse(raw);
        return Date.now() < expires;
    } catch {
        return false;
    }
}

export function saveSession() {
    localStorage.setItem(PIN_KEY, JSON.stringify({ expires: Date.now() + PIN_TTL }));
}

export function clearSession() {
    localStorage.removeItem(PIN_KEY);
}

export function formatDeadline(dt: string | null | undefined): { label: string; urgent: boolean } {
    if (!dt) return { label: '—', urgent: false };
    const diff = new Date(dt).getTime() - Date.now();
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    if (diff < 0) return { label: 'TERLAMBAT', urgent: true };
    if (hours < 2) return { label: `${hours}j ${mins}m lagi`, urgent: true };
    if (hours < 24) return { label: `${hours} jam lagi`, urgent: false };
    const d = new Date(dt);
    return {
        label: d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
        urgent: false,
    };
}

export function getDimLabel(item: any): string {
    const ti = item.transactionItem;
    if (!ti) return '';
    const w = ti.widthCm ? Number(ti.widthCm) : null;
    const h = ti.heightCm ? Number(ti.heightCm) : null;
    if (w && h) return `${w} × ${h} m`;
    return '';
}

export function getAreaM2(item: any): number {
    const ti = item.transactionItem;
    if (!ti) return 0;
    if (ti.areaCm2) return Number(ti.areaCm2) / 10000;
    const w = ti.widthCm ? Number(ti.widthCm) : 0;
    const h = ti.heightCm ? Number(ti.heightCm) : 0;
    return w * h;
}

// Suggest rolls that can fit the shorter dimension
export function suggestRolls(rolls: any[], widthCm: number | null, heightCm: number | null): { roll: any; suggested: boolean }[] {
    if (!widthCm || !heightCm) return rolls.map(r => ({ roll: r, suggested: false }));
    const shorter = Math.min(widthCm, heightCm);
    return rolls.map(r => ({
        roll: r,
        suggested: Number(r.rollEffectivePrintWidth ?? r.rollPhysicalWidth ?? 0) >= shorter,
    }));
}

export function getLongerDim(widthCm: number | null, heightCm: number | null): number {
    if (!widthCm && !heightCm) return 0;
    return Math.max(widthCm ?? 0, heightCm ?? 0);
}

// Sambung detection: when shorter dim > roll effective width, needs multiple print passes
export function getSambungInfo(widthCm: number | null, heightCm: number | null, rollEffectiveWidth: number): {
    needsSambung: boolean; strips: number; stripWidth: number;
} {
    if (!widthCm || !heightCm || rollEffectiveWidth <= 0) return { needsSambung: false, strips: 1, stripWidth: 0 };
    const shorter = Math.min(widthCm, heightCm);
    if (shorter <= rollEffectiveWidth) return { needsSambung: false, strips: 1, stripWidth: shorter };
    const strips = Math.ceil(shorter / rollEffectiveWidth);
    return { needsSambung: true, strips, stripWidth: Math.round((shorter / strips) * 100) / 100 };
}
