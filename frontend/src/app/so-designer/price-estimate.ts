import { applyTierPrice, computeAreaPrice } from "@/store/cart-store";

export const formatRp = (n: number) => "Rp " + Math.round(n).toLocaleString("id-ID");

/** Satuan harga katalog: produk luas per m² (atau cm²), selain itu per satuan produk. */
export function unitBasis(product: any): string {
    if (product?.pricingMode === "AREA_BASED") return product?.areaUnit === "CM2" ? "/cm²" : "/m²";
    const unit = product?.unit && typeof product.unit === "object" ? product.unit.name : null;
    return unit ? `/${String(unit).toLowerCase()}` : "";
}

export interface LineEstimate {
    unitPrice: number;       // harga per satuan yang berlaku (sudah grosir / harga khusus)
    basis: string;           // "/m²", "/pcs", ...
    subtotal: number | null; // null = ukuran belum diisi
    detail: string | null;   // mis. "5×1 m = 5 m² × 2 pcs" atau "10 × Rp 2.000"
    tier: boolean;           // harga grosir aktif
    custom: boolean;         // harga khusus (customPrice) dari SO
}

export interface EstimableItem {
    pricingMode: "UNIT" | "AREA_BASED";
    quantity: number;
    widthCm?: number;
    heightCm?: number;
    unitType?: string;
    pcs?: number;
    customPrice?: number | null;
}

const fmtArea = (n: number) => n.toLocaleString("id-ID", { maximumFractionDigits: 4 });

/**
 * Estimasi harga 1 item SO. Rumusnya SAMA dengan keranjang POS saat SO dibuka kasir
 * (prefill: addItem → setQuantityDirect → updateCustomPrice), jadi angka yang dilihat
 * desainer = angka awal di kasir (sebelum diskon/ongkir/edit kasir).
 * null = varian tidak ada di katalog publik (mis. produk sudah diarsipkan).
 */
export function estimateLine(it: EstimableItem, entry?: { product: any; variant: any }): LineEstimate | null {
    if (!entry) return null;
    const base = Number(entry.variant?.price ?? 0);
    const custom = it.customPrice != null;

    if (it.pricingMode === "AREA_BASED") {
        const u = (it.unitType || "cm") as "m" | "cm" | "cm2" | "menit";
        const basis = u === "menit" ? "/menit" : u === "cm2" ? "/cm²" : "/m²";
        const w = Number(it.widthCm) || 0;
        const h = u === "menit" ? 1 : Number(it.heightCm) || 0;
        const pcs = Math.max(1, Math.round(Number(it.pcs) || 1));
        const filled = w > 0 && h > 0;
        const area = filled ? computeAreaPrice(w, h, base, u) : null;
        let detail = !area ? null
            : u === "menit" ? `${w} menit`
            : u === "cm2" ? `${w}×${h} cm = ${fmtArea(w * h)} cm²`
            : `${w}×${h} ${u === "m" ? "m" : "cm"} = ${fmtArea(area.areaM2)} m²`;
        if (detail && pcs > 1) detail += ` × ${pcs} pcs`;
        if (custom) return { unitPrice: base, basis, subtotal: Number(it.customPrice), detail, tier: false, custom: true };
        return { unitPrice: base, basis, subtotal: area ? area.price * pcs : null, detail, tier: false, custom: false };
    }

    const tiers = (entry.variant?.priceTiers ?? []).map((t: any) => ({
        minQty: Number(t.minQty),
        maxQty: t.maxQty == null ? null : Number(t.maxQty),
        price: Number(t.price),
    }));
    const qty = Math.max(0, Number(it.quantity) || 0);
    const unitPrice = custom ? Number(it.customPrice) : applyTierPrice(Math.max(1, qty), base, tiers);
    return {
        unitPrice,
        basis: unitBasis(entry.product),
        subtotal: unitPrice * qty,
        detail: `${qty} × ${formatRp(unitPrice)}`,
        tier: !custom && unitPrice !== base,
        custom,
    };
}
