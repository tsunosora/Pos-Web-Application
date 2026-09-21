/**
 * Satuan item AREA_BASED yang SUDAH tersimpan di nota — cermin dari
 * backend/src/transactions/area-unit.util.ts (ubah keduanya bersamaan).
 *
 *   'cm'    → ukuran cm, harga per m²   ← default
 *   'm'     → ukuran m,  harga per m²
 *   'cm2'   → ukuran cm, harga per cm²
 *   'menit' → durasi di widthCm
 *
 * Label satuan di data lama bisa salah ('m' padahal isinya cm), jadi total baris
 * dihitung dari areaCm2 (luas yang benar-benar dipakai saat nota dibuat) — T-08.
 */
export type AreaUnit = 'm' | 'cm' | 'cm2' | 'menit';

type StoredItem = { unitType?: string | null; widthCm?: unknown; heightCm?: unknown; areaCm2?: unknown };

export function normalizeUnit(u?: string | null): AreaUnit {
    return u === 'm' || u === 'cm2' || u === 'menit' || u === 'cm' ? u : 'cm';
}

/** Satuan item tersimpan yang sebenarnya, disimpulkan dari datanya. */
export function storedUnit(item: StoredItem): AreaUnit {
    if (item.unitType === 'menit' || item.unitType === 'cm2') return item.unitType;
    const w = Number(item.widthCm) || 0;
    const h = item.heightCm == null ? 1 : Number(item.heightCm) || 0;
    const area = Number(item.areaCm2) || 0;
    if (w > 0 && h > 0 && area > 0) {
        if (Math.abs(area - w * h) / area < 0.001) return 'cm';
        if (Math.abs(area - w * h * 10000) / area < 0.001) return 'm';
    }
    return normalizeUnit(item.unitType);
}

/** Pengali harga dari ukuran yang diketik. */
export function priceMultiplier(unit: AreaUnit, w: number, h: number): number {
    if (unit === 'm' || unit === 'cm2') return w * h;
    if (unit === 'menit') return w;
    return (w * h) / 10000;
}

/** Pengali harga item tersimpan (dari areaCm2). total = priceAtTime × pengali × pcs. */
export function storedPriceMultiplier(item: { unitType?: string | null; areaCm2?: unknown }): number {
    const area = Number(item.areaCm2) || 0;
    return item.unitType === 'cm2' ? area : area / 10000;
}

/** Label ukuran untuk tampilan (cm2 = ukurannya tetap cm). */
export function sizeLabel(unit: AreaUnit): string {
    return unit === 'm' ? 'm' : unit === 'menit' ? 'menit' : 'cm';
}
