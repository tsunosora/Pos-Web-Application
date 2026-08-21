import { create } from 'zustand';

// A unique line key is used so AREA_BASED products can have multiple lines (different sizes/finishing)
// UNIT items: lineId = String(productVariantId)  → merges on re-click
// AREA_BASED: lineId = `${productVariantId}_${Date.now()}` → always a new line
export interface PriceTier {
    minQty: number;
    maxQty: number | null;
    price: number;
    tierName?: string | null;
}

export interface CartItem {
    lineId: string;
    id: number;                  // product id
    productVariantId: number;
    name: string;
    sku: string;
    price: number;               // computed total price (for AREA_BASED: pricePerM2 × area)
    pricePerUnit: number;        // base rate (price/unit or price/m²)
    qty: number;                 // for AREA_BASED always 1; dimensions define the amount
    stock: number;
    trackStock: boolean;         // false = unlimited stock, no deduction
    pricingMode: 'UNIT' | 'AREA_BASED' | 'COMPOSITE';
    priceTiers: PriceTier[];     // [] = no tiering, price is always pricePerUnit
    note?: string;               // operator note: design name, finishing type, custom text, etc.
    customPrice?: number | null; // admin-overridden price; when set, replaces computed price
    // Sub Order: item dicetak di printing luar. Harga jual tetap normal, tapi
    // subPrice = biaya printing luar (per m²/satuan, basis sama dgn pricePerUnit).
    // Item sub TIDAK memotong stok bahan/tinta di backend.
    isSubOrder?: boolean;
    subPrice?: number | null;
    subVendor?: string;
    // AREA_BASED only
    unitType?: 'm' | 'cm' | 'cm2' | 'menit';
    widthCm?: number;
    heightCm?: number;
    areaCm2?: number;
    areaM2?: number;
    pcs?: number;  // jumlah kopi/PCS. price = singleAreaPrice × pcs
    // COMPOSITE only — harga & HPP dihitung ulang di server saat checkout.
    // price/pricePerUnit = total per 1 unit composite (display saja); server yang otoritatif.
    compositeProductId?: number;
    compositeOptions?: Record<string, any>;
    breakdown?: { name: string; qty: number; lineTotal: number }[];
}

interface CartState {
    items: CartItem[];
    taxRate: number;
    discount: number;

    addItem: (product: any, variant: any, areaDimensions?: { widthCm: number; heightCm: number; unitType: 'm' | 'cm' | 'cm2' | 'menit'; note?: string; pcs?: number }, opts?: { forceNewLine?: boolean }) => void;
    addCompositeItem: (args: { productId: number; name: string; price: number; compositeOptions: Record<string, any>; breakdown?: { name: string; qty: number; lineTotal: number }[]; note?: string }) => void;
    removeItem: (lineId: string) => void;
    updateQuantity: (lineId: string, delta: number) => void;
    setQuantityDirect: (lineId: string, qty: number) => void;
    updateAreaDimensions: (lineId: string, widthCm: number, heightCm: number, unitType: 'm' | 'cm' | 'cm2' | 'menit', pricePerUnitM2: number, note?: string, pcs?: number) => void;
    updateNote: (lineId: string, note: string) => void;
    updateCustomPrice: (lineId: string, customPrice: number | null) => void;
    updateSubOrder: (lineId: string, patch: { isSubOrder?: boolean; subPrice?: number | null; subVendor?: string }) => void;
    clearCart: () => void;
    setDiscount: (amount: number) => void;

    subtotal: () => number;
    taxAmount: () => number;
    grandTotal: () => number;
}

/** Returns the unit price that applies for a given qty based on price tiers. Falls back to basePrice. */
function applyTierPrice(qty: number, basePrice: number, tiers: PriceTier[]): number {
    if (!tiers || tiers.length === 0) return basePrice;
    const sorted = [...tiers].sort((a, b) => b.minQty - a.minQty); // descending
    const matched = sorted.find(t => qty >= t.minQty && (t.maxQty === null || qty <= t.maxQty));
    return matched ? matched.price : basePrice;
}

function computeAreaPrice(width: number, height: number, unitPrice: number, unitType: 'm' | 'cm' | 'cm2' | 'menit') {
    // Basis harga tergantung produk (Product.areaUnit → unitType saat add):
    //   m    → harga/m², input meter:  pengali = w × h ;            luas fisik = w × h (m²)
    //   cm   → harga/m², input cm:      pengali = (w × h) / 10000 ;  luas fisik = (w × h)/10000
    //   cm2  → harga/cm², input cm:     pengali = w × h (cm²) ;      luas fisik = (w × h)/10000 (m²)
    //   menit→ durasi:                  pengali = w ;                luas fisik = w
    let priceMul = 0, areaM2 = 0;
    if (unitType === 'm') { priceMul = width * height; areaM2 = width * height; }
    else if (unitType === 'cm2') { priceMul = width * height; areaM2 = (width * height) / 10000; }
    else if (unitType === 'menit') { priceMul = width; areaM2 = width; }
    else { priceMul = (width * height) / 10000; areaM2 = (width * height) / 10000; } // cm / default

    const price = priceMul * unitPrice;
    return { areaM2, price };
}

export const useCartStore = create<CartState>((set, get) => ({
    items: [],
    taxRate: 0.10,
    discount: 0,

    addItem: (product, variant, areaDimensions, opts) => {
        const pricingMode: 'UNIT' | 'AREA_BASED' = product.pricingMode || 'UNIT';
        const pricePerUnit = Number(variant.price || 0);
        const tiers: PriceTier[] = (variant.priceTiers || []).map((t: any) => ({
            minQty: Number(t.minQty),
            maxQty: t.maxQty !== null && t.maxQty !== undefined ? Number(t.maxQty) : null,
            price: Number(t.price),
            tierName: t.tierName ?? null,
        }));

        set((state) => {
            if (pricingMode === 'AREA_BASED') {
                if (!areaDimensions) return state; // must have dimensions from modal

                const { widthCm, heightCm, unitType, note, pcs: pcsRaw } = areaDimensions;
                const pcs = Math.max(1, Math.round(Number(pcsRaw) || 1));
                const { areaM2, price: singlePrice } = computeAreaPrice(widthCm, heightCm, pricePerUnit, unitType);
                const price = singlePrice * pcs;

                // Each call ALWAYS creates a NEW line item (different sizes per job).
                // Suffix acak supaya tidak tabrakan saat dipanggil beruntun (mis. prefill SO).
                const lineId = `${variant.id}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
                return {
                    items: [...state.items, {
                        lineId,
                        id: product.id,
                        productVariantId: variant.id,
                        name: product.name + (variant.variantName ? ` — ${variant.variantName}` : '') + (variant.size ? ` (${variant.size})` : ''),
                        sku: variant.sku,
                        price,
                        pricePerUnit,
                        qty: 1,
                        stock: Number(variant.stock),
                        trackStock: product.trackStock !== false,
                        pricingMode: 'AREA_BASED',
                        priceTiers: tiers,
                        note,
                        unitType,
                        widthCm,
                        heightCm,
                        areaM2,
                        pcs
                    }]
                };
            }

            // UNIT mode — normalnya merge by productVariantId (klik/scan ulang nambah qty).
            // forceNewLine: selalu baris baru — dipakai prefill SO supaya produk sama
            // yang diinput >1x oleh desainer tetap tampil sebagai baris terpisah.
            const trackStock = product.trackStock !== false;
            const lineId = opts?.forceNewLine
                ? `${variant.id}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`
                : String(variant.id);
            if (!opts?.forceNewLine) {
                const existing = state.items.find(i => i.lineId === lineId);
                if (existing) {
                    if (trackStock && existing.qty >= Number(variant.stock)) return state;
                    const newQty = existing.qty + 1;
                    const newPrice = existing.customPrice != null
                        ? existing.customPrice
                        : applyTierPrice(newQty, existing.pricePerUnit, existing.priceTiers);
                    return {
                        items: state.items.map(i =>
                            i.lineId === lineId ? { ...i, qty: newQty, price: newPrice } : i
                        )
                    };
                }
            }
            const initPrice = applyTierPrice(1, pricePerUnit, tiers);
            return {
                items: [...state.items, {
                    lineId,
                    id: product.id,
                    productVariantId: variant.id,
                    name: product.name + (variant.variantName ? ` — ${variant.variantName}` : '') + (variant.size ? ` — ${variant.size}` : ''),
                    sku: variant.sku,
                    price: initPrice,
                    pricePerUnit,
                    qty: 1,
                    stock: Number(variant.stock),
                    trackStock,
                    pricingMode: 'UNIT',
                    priceTiers: tiers,
                }]
            };
        });
    },

    // COMPOSITE (produk konfigurasi): SELALU baris baru. price = total per 1 unit
    // dari server (display); server hitung ulang saat checkout (jangan percaya client).
    addCompositeItem: ({ productId, name, price, compositeOptions, breakdown, note }) => {
        set((state) => {
            const lineId = `${productId}_comp_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
            return {
                items: [...state.items, {
                    lineId,
                    id: productId,
                    productVariantId: 0,        // tak dipakai; server resolve anchor variant
                    name,
                    sku: '',
                    price,
                    pricePerUnit: price,
                    qty: 1,
                    stock: Number.MAX_SAFE_INTEGER,
                    trackStock: false,
                    pricingMode: 'COMPOSITE',
                    priceTiers: [],
                    note,
                    compositeProductId: productId,
                    compositeOptions,
                    breakdown,
                }]
            };
        });
    },

    removeItem: (lineId) => {
        set((state) => ({ items: state.items.filter(i => i.lineId !== lineId) }));
    },

    updateQuantity: (lineId, delta) => {
        set((state) => ({
            items: state.items.map(i => {
                if (i.lineId !== lineId || i.pricingMode === 'AREA_BASED') return i;
                const newQty = i.qty + delta;
                if (newQty <= 0 || (i.trackStock !== false && newQty > i.stock)) return i;
                if (i.customPrice != null) return { ...i, qty: newQty };
                const newPrice = applyTierPrice(newQty, i.pricePerUnit, i.priceTiers);
                return { ...i, qty: newQty, price: newPrice };
            })
        }));
    },

    setQuantityDirect: (lineId, qty) => {
        set((state) => ({
            items: state.items.map(i => {
                if (i.lineId !== lineId || i.pricingMode === 'AREA_BASED') return i;
                const clampedQty = i.trackStock !== false ? Math.min(qty, i.stock) : qty;
                if (clampedQty <= 0) return i;
                if (i.customPrice != null) return { ...i, qty: clampedQty };
                const newPrice = applyTierPrice(clampedQty, i.pricePerUnit, i.priceTiers);
                return { ...i, qty: clampedQty, price: newPrice };
            })
        }));
    },

    updateAreaDimensions: (lineId, widthCm, heightCm, unitType, pricePerUnitM2, note, pcs) => {
        set((state) => ({
            items: state.items.map(i => {
                if (i.lineId !== lineId || i.pricingMode !== 'AREA_BASED') return i;
                const resolvedPcs = Math.max(1, Math.round(Number(pcs) || 1));
                const { areaM2, price: singlePrice } = computeAreaPrice(widthCm, heightCm, pricePerUnitM2, unitType);
                const price = singlePrice * resolvedPcs;
                return { ...i, unitType, widthCm, heightCm, areaM2, price, pcs: resolvedPcs, note: note ?? i.note };
            })
        }));
    },

    updateNote: (lineId, note) => {
        set((state) => ({
            items: state.items.map(i => i.lineId === lineId ? { ...i, note } : i)
        }));
    },

    updateCustomPrice: (lineId, customPrice) => {
        set((state) => ({
            items: state.items.map(i => {
                if (i.lineId !== lineId) return i;
                if (customPrice === null) {
                    const { customPrice: _removed, ...rest } = i;
                    if (i.pricingMode === 'UNIT') {
                        return { ...rest, price: applyTierPrice(i.qty, i.pricePerUnit, i.priceTiers) };
                    } else {
                        const { price: singlePrice } = computeAreaPrice(i.widthCm!, i.heightCm!, i.pricePerUnit, i.unitType!);
                        const price = singlePrice * (i.pcs || 1);
                        return { ...rest, price };
                    }
                }
                return { ...i, customPrice, price: customPrice };
            })
        }));
    },

    updateSubOrder: (lineId, patch) => {
        set((state) => ({
            items: state.items.map(i => {
                if (i.lineId !== lineId) return i;
                const next = { ...i, ...patch };
                // Matikan sub → bersihkan harga sub & vendor.
                if (patch.isSubOrder === false) {
                    next.subPrice = null;
                    next.subVendor = '';
                }
                return next;
            })
        }));
    },

    clearCart: () => set({ items: [], discount: 0 }),
    setDiscount: (amount) => set({ discount: amount }),

    subtotal: () => {
        const { items } = get();
        return items.reduce((acc, item) => {
            if (item.pricingMode === 'AREA_BASED') return acc + item.price;
            return acc + (item.price * item.qty);
        }, 0);
    },

    taxAmount: () => {
        const { subtotal, discount, taxRate } = get();
        return Math.max(0, (subtotal() - discount) * taxRate);
    },

    grandTotal: () => {
        const { subtotal, discount, taxAmount } = get();
        return Math.max(0, subtotal() - discount) + taxAmount();
    }
}));
