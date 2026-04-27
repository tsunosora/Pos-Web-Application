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
//
// MASALAH: default unitType di UI POS lama = 'm', tapi kasir sering input nilai cm
// tanpa ganti satuan (mis. ketik "200" maksudnya 200cm tapi tersimpan unitType='m').
// Akibatnya 200m × 100m = 20000 m² → sambung ×60+ padahal banner kecil.
//
// SOLUSI: pakai `areaCm2` (selalu authoritative dari backend) untuk sanity check.
// Kalau widthCm × heightCm raw cocok dengan areaCm2 → values dalam cm, no convert.
// Kalau ×10000 cocok → values dalam meter, convert ×100.

/** Konversi nilai mentah ke cm berdasarkan unitType (fallback heuristik). */
function toCm(rawValue: number, unitType: string | null | undefined): number {
    const u = (unitType || 'cm').toLowerCase();
    if (u === 'cm') return rawValue;
    if (u === 'm') return rawValue * 100;
    return rawValue;
}

/**
 * Ambil dimensi item dalam cm (selalu) — untuk perbandingan dengan roll width
 * yang juga dalam cm. Return null kalau item bukan AREA_BASED atau dimensi tidak ada.
 *
 * Strategi penentuan unit:
 * 1. Kalau ada `areaCm2`: cek konsistensi
 *    - w*h ≈ areaCm2 → values dalam cm
 *    - w*h*10000 ≈ areaCm2 → values dalam m, convert ×100
 *    - Tidak match → fallback heuristik (lihat #3)
 * 2. Kalau tidak ada areaCm2 → pakai unitType
 * 3. Heuristik: kalau unitType='m' tapi value > 30 (banner 30m+ sangat tidak realistis,
 *    biasanya data corrupt karena salah default) → treat sebagai cm.
 */
export function getDimsInCm(item: any): { widthCm: number; heightCm: number; unitType: string } | null {
    const ti = item?.transactionItem;
    if (!ti) return null;
    const u = (ti.unitType || 'cm').toLowerCase();
    if (u === 'menit') return null; // produk durasi
    const w = ti.widthCm != null ? Number(ti.widthCm) : null;
    const h = ti.heightCm != null ? Number(ti.heightCm) : null;
    if (w == null || h == null) return null;
    if (w <= 0 || h <= 0) return null;

    const areaCm2 = ti.areaCm2 != null ? Number(ti.areaCm2) : null;

    // SAFETY: areaCm2 lebih dari 10 juta cm² = 1.000 m² = 1 hektar.
    // Banner sebesar itu mustahil di-cetak — jelas data corrupt (backend lama treat
    // input cm sebagai meter, jadi areaCm2-nya ikut salah hitung). Raw widthCm/heightCm
    // sebenarnya nilai cm yang benar — pakai langsung tanpa conversion.
    const IMPOSSIBLE_AREA_CM2 = 10_000_000; // 1000 m²
    if (areaCm2 && areaCm2 > IMPOSSIBLE_AREA_CM2) {
        return { widthCm: w, heightCm: h, unitType: 'cm' };
    }

    // SAFETY: heuristik untuk data lama tanpa areaCm2 valid.
    // Kalau unitType='m' tapi value > 30 (banner 30m+ sangat tidak realistis),
    // ini hampir pasti data corrupt karena kasir input cm value tapi unitType
    // tersimpan default 'm'. Treat as cm supaya sambung waras.
    if (u === 'm' && (w > 30 || h > 30)) {
        return { widthCm: w, heightCm: h, unitType: 'cm' };
    }

    // Strategi normal: pakai areaCm2 sebagai authoritative kalau ada & nilainya wajar
    if (areaCm2 && areaCm2 > 0 && areaCm2 <= IMPOSSIBLE_AREA_CM2) {
        const productRaw = w * h;
        const pcs = Number(ti.pcs ?? 1) || 1;
        const tol = 0.01; // toleransi 1% floating point
        // Cek treat as cm
        if (Math.abs(productRaw * pcs - areaCm2) / areaCm2 < tol) {
            return { widthCm: w, heightCm: h, unitType: 'cm' };
        }
        // Cek treat as m (×10000 untuk konversi m² ke cm²)
        if (Math.abs(productRaw * 10000 * pcs - areaCm2) / areaCm2 < tol) {
            return { widthCm: w * 100, heightCm: h * 100, unitType: 'm' };
        }
        // Tidak konsisten — fallback ke unitType
    }

    // Fallback terakhir: pakai unitType apa adanya
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
 * Get roll effective width DALAM CM. Field `rollEffectivePrintWidth` & `rollPhysicalWidth`
 * di-input UI dalam METER (label "Lebar Cetak Efektif (m)") tapi semua perhitungan
 * sambung pakai cm — jadi convert ×100.
 */
export function getRollEffectiveCm(roll: any): number {
    const raw = Number(roll?.rollEffectivePrintWidth ?? roll?.rollPhysicalWidth ?? 0);
    if (raw <= 0) return 0;
    // Heuristik: kalau value > 30 (mustahil ada roll lebar 30m), values sudah dalam cm.
    // Kalau ≤ 30 (typical 1-3m), convert ×100 ke cm.
    return raw > 30 ? raw : raw * 100;
}

/**
 * Suggest rolls yang muat dimensi pendek.
 * Parameter `widthCm` & `heightCm` WAJIB sudah dalam cm (caller via `getDimsInCm`).
 */
export function suggestRolls(rolls: any[], widthCm: number | null, heightCm: number | null): { roll: any; suggested: boolean }[] {
    if (!widthCm || !heightCm) return rolls.map(r => ({ roll: r, suggested: false }));
    const shorter = Math.min(widthCm, heightCm);
    return rolls.map(r => ({
        roll: r,
        suggested: getRollEffectiveCm(r) >= shorter,
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
 * Parameter widthCm/heightCm & rollEffectiveWidthCm WAJIB dalam cm.
 */
export function getSambungInfo(widthCm: number | null, heightCm: number | null, rollEffectiveWidthCm: number): {
    needsSambung: boolean; strips: number; stripWidth: number;
} {
    if (!widthCm || !heightCm || rollEffectiveWidthCm <= 0) return { needsSambung: false, strips: 1, stripWidth: 0 };
    const shorter = Math.min(widthCm, heightCm);
    if (shorter <= rollEffectiveWidthCm) return { needsSambung: false, strips: 1, stripWidth: shorter };
    const strips = Math.ceil(shorter / rollEffectiveWidthCm);
    return { needsSambung: true, strips, stripWidth: Math.round((shorter / strips) * 100) / 100 };
}
