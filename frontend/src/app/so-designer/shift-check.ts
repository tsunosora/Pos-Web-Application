/** Jam pergantian shift desainer (WIB). */
export const SHIFT_CHANGE_HOUR_WIB = 13;

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000; // WIB = UTC+7, tanpa DST
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Batas shift terakhir yang sudah lewat (ms epoch), dihitung dalam WIB apa pun zona waktu
 * perangkatnya: 13.00 WIB bila sudah lewat, selain itu 00.00 WIB hari ini (hari baru —
 * menangkap browser yang dibiarkan terbuka semalaman dengan sesi desainer kemarin).
 */
export function lastShiftBoundary(nowMs: number, hour = SHIFT_CHANGE_HOUR_WIB): { at: number; kind: "shift" | "day" } {
    const wibNow = nowMs + WIB_OFFSET_MS;
    const wibDayStart = Math.floor(wibNow / DAY_MS) * DAY_MS;
    const wibShift = wibDayStart + hour * 60 * 60 * 1000;
    return wibNow >= wibShift
        ? { at: wibShift - WIB_OFFSET_MS, kind: "shift" }
        : { at: wibDayStart - WIB_OFFSET_MS, kind: "day" };
}

/** Sesi perlu dikonfirmasi ulang bila terakhir dipastikan sebelum batas shift terakhir. */
export function needsShiftCheck(confirmedAt: number | null | undefined, nowMs: number, hour = SHIFT_CHANGE_HOUR_WIB): boolean {
    return !(typeof confirmedAt === "number" && confirmedAt >= lastShiftBoundary(nowMs, hour).at);
}

// Form SO yang sedang diisi (belum disimpan) — supaya "Ganti desainer" memperingatkan dulu.
let formDirty = false;
export const setDesignerFormDirty = (dirty: boolean) => { formDirty = dirty; };
export const isDesignerFormDirty = () => formDirty;
