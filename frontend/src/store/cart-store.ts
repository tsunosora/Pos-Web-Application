import { create } from 'zustand';

// A unique line key is used so AREA_BASED products can have multiple lines (different sizes/finishing)
// UNIT items: lineId = String(productVariantId)  → merges on re-click
// AREA_BASED: lineId = `${productVariantId}_${Date.now()}` → always a new line
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
    pricingMode: 'UNIT' | 'AREA_BASED';
    note?: string;               // operator note: design name, finishing type, custom text, etc.
    // AREA_BASED only
    unitType?: 'm' | 'cm' | 'menit';
    widthCm?: number;
    heightCm?: number;
    areaCm2?: number;
    areaM2?: number;
}

interface CartState {
    items: CartItem[];
    taxRate: number;
    discount: number;

    addItem: (product: any, variant: any, areaDimensions?: { widthCm: number; heightCm: number; unitType: 'm' | 'cm' | 'menit'; note?: string }) => void;
    removeItem: (lineId: string) => void;
    updateQuantity: (lineId: string, delta: number) => void;
    updateAreaDimensions: (lineId: string, widthCm: number, heightCm: number, unitType: 'm' | 'cm' | 'menit', pricePerUnitM2: number, note?: string) => void;
    updateNote: (lineId: string, note: string) => void;
    clearCart: () => void;
    setDiscount: (amount: number) => void;

    subtotal: () => number;
    taxAmount: () => number;
    grandTotal: () => number;
}

function computeAreaPrice(width: number, height: number, pricePerUnit: number, unitType: 'm' | 'cm' | 'menit') {
    let multiplier = 0;
    if (unitType === 'm') multiplier = width * height;           // p x l in meters
    else if (unitType === 'cm') multiplier = (width * height) / 10000; // p x l in cm -> convert to m2
    else if (unitType === 'menit') multiplier = width;           // 1D (duration or amount)

    const price = multiplier * pricePerUnit;
    return { areaM2: multiplier, price }; // We store the 'multiplier' in areaM2 for convenience
}

export const useCartStore = create<CartState>((set, get) => ({
    items: [],
    taxRate: 0.10,
    discount: 0,

    addItem: (product, variant, areaDimensions) => {
        const pricingMode: 'UNIT' | 'AREA_BASED' = product.pricingMode || 'UNIT';
        const pricePerUnit = Number(variant.price || 0);

        set((state) => {
            if (pricingMode === 'AREA_BASED') {
                if (!areaDimensions) return state; // must have dimensions from modal

                const { widthCm, heightCm, unitType, note } = areaDimensions;
                const { areaM2, price } = computeAreaPrice(widthCm, heightCm, pricePerUnit, unitType);

                // Each call ALWAYS creates a NEW line item (different sizes per job)
                const lineId = `${variant.id}_${Date.now()}`;
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
                        pricingMode: 'AREA_BASED',
                        note,
                        unitType,
                        widthCm,
                        heightCm,
                        areaM2
                    }]
                };
            }

            // UNIT mode — merge by productVariantId
            const lineId = String(variant.id);
            const existing = state.items.find(i => i.lineId === lineId);
            if (existing) {
                if (existing.qty >= Number(variant.stock)) return state;
                return {
                    items: state.items.map(i =>
                        i.lineId === lineId ? { ...i, qty: i.qty + 1 } : i
                    )
                };
            }
            return {
                items: [...state.items, {
                    lineId,
                    id: product.id,
                    productVariantId: variant.id,
                    name: product.name + (variant.variantName ? ` — ${variant.variantName}` : '') + (variant.size ? ` — ${variant.size}` : ''),
                    sku: variant.sku,
                    price: pricePerUnit,
                    pricePerUnit,
                    qty: 1,
                    stock: Number(variant.stock),
                    pricingMode: 'UNIT'
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
                if (newQty <= 0 || newQty > i.stock) return i;
                return { ...i, qty: newQty };
            })
        }));
    },

    updateAreaDimensions: (lineId, widthCm, heightCm, unitType, pricePerUnitM2, note) => {
        set((state) => ({
            items: state.items.map(i => {
                if (i.lineId !== lineId || i.pricingMode !== 'AREA_BASED') return i;
                const { areaM2, price } = computeAreaPrice(widthCm, heightCm, pricePerUnitM2, unitType);
                return { ...i, unitType, widthCm, heightCm, areaM2, price, note: note ?? i.note };
            })
        }));
    },

    updateNote: (lineId, note) => {
        set((state) => ({
            items: state.items.map(i => i.lineId === lineId ? { ...i, note } : i)
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
