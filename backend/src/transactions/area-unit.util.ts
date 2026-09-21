import { BadRequestException } from '@nestjs/common';

/**
 * Satuan item AREA_BASED — SATU sumber aturan untuk buat nota, tambah item saat
 * edit, dan edit item lama (T-08).
 *
 * Kolom `width_cm`/`height_cm` menyimpan angka yang diketik kasir; artinya
 * ditentukan `unit_type`:
 *   'cm'    → ukuran cm, harga per m²   (pengali harga = w×h/10.000)   ← DEFAULT
 *   'm'     → ukuran m,  harga per m²   (pengali harga = w×h)
 *   'cm2'   → ukuran cm, harga per cm²  (pengali harga = w×h, luas fisik ÷10.000)
 *   'menit' → durasi di width_cm        (pengali harga = w)
 *
 * Dulu default-nya 'm' saat MENYIMPAN tetapi 'cm' saat MENGHITUNG, sehingga nota
 * tanpa satuan tersimpan berlabel 'm' walau isinya cm — dan sekali diedit,
 * totalnya meledak ×10.000 (atau edit ditolak "stok tidak cukup").
 */
export type AreaUnit = 'm' | 'cm' | 'cm2' | 'menit';

export function normalizeUnit(u?: string | null): AreaUnit {
    return u === 'm' || u === 'cm2' || u === 'menit' || u === 'cm' ? u : 'cm';
}

/** Pengali harga & luas fisik (m², untuk stok) dari ukuran yang diketik. */
export function areaFactors(unit: AreaUnit, w: number, h: number): { priceMultiplier: number; areaM2: number } {
    switch (unit) {
        case 'm': return { priceMultiplier: w * h, areaM2: w * h };
        case 'cm2': return { priceMultiplier: w * h, areaM2: (w * h) / 10000 };
        case 'menit': return { priceMultiplier: w, areaM2: w };
        default: return { priceMultiplier: (w * h) / 10000, areaM2: (w * h) / 10000 };
    }
}

/**
 * Pengali harga item yang SUDAH tersimpan, dari `area_cm2` (luas yang benar-benar
 * dipakai saat nota dibuat) — bukan dari label satuan, yang pada data lama bisa salah.
 * total baris = priceAtTime × pengali × pcs.
 */
export function storedPriceMultiplier(item: { unitType?: string | null; areaCm2?: unknown }): number {
    const area = Number(item.areaCm2) || 0;
    return item.unitType === 'cm2' ? area : area / 10000;
}

/** Satuan item tersimpan yang sebenarnya, disimpulkan dari data (label lama bisa salah). */
export function storedUnit(item: { unitType?: string | null; widthCm?: unknown; heightCm?: unknown; areaCm2?: unknown }): AreaUnit {
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

/** Basis harga: satuan yang harganya sebanding (m & cm sama-sama per m²). */
export function priceBasis(unit: AreaUnit): 'm2' | 'cm2' | 'menit' {
    return unit === 'cm2' ? 'cm2' : unit === 'menit' ? 'menit' : 'm2';
}

/** Batas wajar luas SATU lembar cetak. 1.000 m² ≈ spanduk 10 m × 100 m. */
export const MAX_AREA_M2_PER_PCS = 1000;

/** Tolak ukuran yang jelas salah satuan (mis. 300×100 dengan satuan m = 30.000 m²). */
export function assertSaneArea(unit: AreaUnit, w: number, h: number, areaM2: number, productName: string): void {
    if (unit === 'menit') return;
    if (areaM2 > MAX_AREA_M2_PER_PCS) {
        const fmt = (n: number) => n.toLocaleString('id-ID', { maximumFractionDigits: 2 });
        const label = unit === 'm' ? 'm' : 'cm';
        throw new BadRequestException(
            `Ukuran ${fmt(w)}×${fmt(h)} ${label} untuk ${productName} = ${fmt(areaM2)} m² per lembar — tidak masuk akal. ` +
            `Periksa satuannya (cm atau m).`,
        );
    }
}

/**
 * Total satu baris nota dari data tersimpan — dipakai laporan, KPI, kas, HR.
 * Item area: priceAtTime × pengali tersimpan × pcs (per cm² dihitung dari area_cm2);
 * item unit: priceAtTime × quantity. Butuh kolom priceAtTime, quantity, pcs, areaCm2, unitType.
 */
export function lineTotalOf(item: { priceAtTime?: unknown; quantity?: unknown; pcs?: unknown; areaCm2?: unknown; unitType?: string | null }): number {
    const price = Number(item.priceAtTime) || 0;
    const mult = storedPriceMultiplier(item);
    if (mult > 0) return price * mult * Math.max(1, Number(item.pcs) || 1);
    return price * (Number(item.quantity) || 1);
}
