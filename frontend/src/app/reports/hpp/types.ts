// Shared types for the HPP calculator feature

export interface VariableCost {
    id: string; // Tmp ui ID
    productVariantId?: number; // DB Link
    name: string;
    usageAmount: number;
    usageUnit: string;
    price: number;
    priceUnit: string; // Stored just for UI display info
    isCustom?: boolean; // true = manually typed name, false = from stock
    isAcuanStok?: boolean; // Menentukan stok awal produk dari bahan ini
    isAreaBased?: boolean; // mode lebar x tinggi (m²)
    widthM?: number;
    heightM?: number;
    widthMStr?: string;  // raw string input untuk widthM (agar bisa ketik "0,6")
    heightMStr?: string; // raw string input untuk heightM
}

export interface FixedCost {
    id: string; // Tmp ui id
    name: string;
    amount: number;
}

// Bahan KHUSUS per varian (mis. jenis banner berbeda tiap varian).
// Berbeda dari VariableCost (bahan BERSAMA) — ini melekat ke satu baris varian.
export interface VariantCustomItem {
    id: string; // tmp ui id
    name: string;
    quantity: number;
    unit: string;
    price: number; // harga per unit bahan
    isServiceCost?: boolean; // true = biaya jasa (tidak potong stok)
    rawMaterialVariantId?: number | null; // link bahan baku utk potong stok
    isCustom?: boolean; // true = nama diketik manual, false = dipilih dari stok
}
