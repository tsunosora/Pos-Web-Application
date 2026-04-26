// Pure helper functions and types for the produksi (production) feature

export type Tab = 'ANTRIAN' | 'PROSES' | 'MENUNGGU_PASANG' | 'PASANG' | 'SELESAI' | 'DIAMBIL';

export const PIN_KEY = 'produksi_pin_session';
export const PIN_TTL = 24 * 60 * 60 * 1000; // 24 jam

export interface ProduksiSession {
    expires: number;
    branchId: number | null;
    branchName: string | null;
    branchCode: string | null;
}

export function getStoredSession(): ProduksiSession | null {
    try {
        const raw = localStorage.getItem(PIN_KEY);
        if (!raw) return null;
        const s = JSON.parse(raw) as ProduksiSession;
        if (Date.now() >= s.expires) return null;
        return s;
    } catch {
        return null;
    }
}

export function saveSession(branchId: number | null = null, branchName: string | null = null, branchCode: string | null = null) {
    const session: ProduksiSession = {
        expires: Date.now() + PIN_TTL,
        branchId,
        branchName,
        branchCode,
    };
    localStorage.setItem(PIN_KEY, JSON.stringify(session));
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

// ─── Unit normalization ────────────────────────────────────────────────────
// Field `widthCm` / `heightCm` di DB menyimpan RAW INPUT VALUE — bukan selalu cm.
// Tergantung `unitType`:
//   unitType='m'    → value dalam meter (mis. 2 = 2 m)
//   unitType='cm'   → value dalam cm    (mis. 200 = 200 cm = 2 m)
//   unitType='menit'→ value dalam menit (untuk produk berbasis durasi, tidak punya area)
// Helper ini normalisasi ke cm supaya semua perhitungan sambung & roll-fit konsisten.

/** Konversi nilai mentah ke cm berdasarkan unitType. */
function toCm(rawValue: number, unitType: string | null | undefined): number {
    const u = (unitType || 'm').toLowerCase();
    if (u === 'cm') return rawValue;
    if (u === 'm') return rawValue * 100;
    // 'menit' tidak punya dimensi area
    return rawValue;
}

/**
 * Ambil dimensi item dalam cm (selalu) — untuk perbandingan dengan roll width
 * yang juga dalam cm. Return null kalau item bukan AREA_BASED atau dimensi tidak ada.
 */
export function getDimsInCm(item: any): { widthCm: number; heightCm: number; unitType: string } | null {
    const ti = item?.transactionItem;
    if (!ti) return null;
    const u = ti.unitType || 'm';
    if (u === 'menit') return null; // produk durasi
    const w = ti.widthCm != null ? Number(ti.widthCm) : null;
    const h = ti.heightCm != null ? Number(ti.heightCm) : null;
    if (w == null || h == null) return null;
    return { widthCm: toCm(w, u), heightCm: toCm(h, u), unitType: u };
}

/** Label dimensi dengan suffix unit yang BENAR berdasarkan unitType. */
export function getDimLabel(item: any): string {
    const ti = item?.transactionItem;
    if (!ti) return '';
    const w = ti.widthCm != null ? Number(ti.widthCm) : null;
    const h = ti.heightCm != null ? Number(ti.heightCm) : null;
    if (w == null || h == null) return '';
    const u = (ti.unitType || 'm').toLowerCase();
    if (u === 'menit') return `${w} menit`;
    return `${w} × ${h} ${u}`;
}

export function getAreaM2(item: any): number {
    const ti = item?.transactionItem;
    if (!ti) return 0;
    if (ti.areaCm2) return Number(ti.areaCm2) / 10000;
    // Fallback: hitung dari raw width × height berdasarkan unitType
    const dims = getDimsInCm(item);
    if (!dims) return 0;
    return (dims.widthCm * dims.heightCm) / 10000;
}

/**
 * Suggest rolls yang muat dimensi pendek.
 * NOTE: parameter `widthCm` & `heightCm` di sini WAJIB sudah dalam cm
 * (caller harus normalisasi via `getDimsInCm` dulu untuk item yang unitType='m').
 * `rollEffectivePrintWidth` & `rollPhysicalWidth` selalu dalam cm.
 */
export function suggestRolls(rolls: any[], widthCm: number | null, heightCm: number | null): { roll: any; suggested: boolean }[] {
    if (!widthCm || !heightCm) return rolls.map(r => ({ roll: r, suggested: false }));
    const shorter = Math.min(widthCm, heightCm);
    return rolls.map(r => ({
        roll: r,
        suggested: Number(r.rollEffectivePrintWidth ?? r.rollPhysicalWidth ?? 0) >= shorter,
    }));
}

/**
 * Get dimensi terpanjang (cm). Caller wajib pass nilai sudah dalam cm.
 */
export function getLongerDim(widthCm: number | null, heightCm: number | null): number {
    if (!widthCm && !heightCm) return 0;
    return Math.max(widthCm ?? 0, heightCm ?? 0);
}

/**
 * Sambung detection: kalau dimensi pendek > roll effective width, butuh beberapa strip.
 * Parameter widthCm/heightCm WAJIB dalam cm (caller normalisasi via getDimsInCm).
 * rollEffectiveWidth juga dalam cm.
 */
export function getSambungInfo(widthCm: number | null, heightCm: number | null, rollEffectiveWidth: number): {
    needsSambung: boolean; strips: number; stripWidth: number;
} {
    if (!widthCm || !heightCm || rollEffectiveWidth <= 0) return { needsSambung: false, strips: 1, stripWidth: 0 };
    const shorter = Math.min(widthCm, heightCm);
    if (shorter <= rollEffectiveWidth) return { needsSambung: false, strips: 1, stripWidth: shorter };
    const strips = Math.ceil(shorter / rollEffectiveWidth);
    return { needsSambung: true, strips, stripWidth: Math.round((shorter / strips) * 100) / 100 };
}
