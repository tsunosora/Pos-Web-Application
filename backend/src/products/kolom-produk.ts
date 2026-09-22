/**
 * Kolom yang boleh diisi dari formulir produk (dan turunannya). Dulu isi permintaan diteruskan
 * utuh ke basis data: `isActive:false` mengarsipkan produk tanpa hak hapus manajer, `productId`
 * memindah varian (beserta stok & riwayat jualnya) atau bahan resep ke produk lain.
 * Semua kolom yang memang dikirim formulir tetap ada di daftar ini.
 */
const ambil = (d: any, kunci: readonly string[]) => {
    const out: Record<string, unknown> = {};
    if (!d || typeof d !== 'object') return out;
    for (const k of kunci) if (d[k] !== undefined) out[k] = d[k];
    return out;
};

const KOLOM_PRODUK = [
    'name', 'description', 'categoryId', 'unitId', 'imageUrl', 'imageUrls', 'pricingMode', 'areaUnit',
    'productType', 'compositeConfig', 'pricePerUnit', 'requiresProduction', 'hasAssemblyStage', 'trackStock',
    'clickRateId', 'clicksPerUnit',
] as const;
const KOLOM_VARIAN = [
    'sku', 'variantName', 'price', 'hpp', 'stock', 'size', 'color', 'variantImageUrl', 'isRollMaterial',
    'rollPhysicalWidth', 'rollEffectivePrintWidth', 'clickRateId', 'clicksPerUnit',
] as const;
const KOLOM_BAHAN = ['name', 'quantity', 'unit', 'price', 'subtotal', 'rawMaterialVariantId'] as const;
const KOLOM_TIER = ['tierName', 'minQty', 'maxQty', 'price'] as const;
const KOLOM_BAHAN_VARIAN = ['name', 'quantity', 'unit', 'price', 'isServiceCost', 'isShared', 'rawMaterialVariantId'] as const;

export const kolomProduk = (d: any): any => ambil(d, KOLOM_PRODUK);
/** Varian; `denganStok=false` untuk varian yang sudah ada (stok hanya lewat Stok Cabang/Opname). */
export const kolomVarian = (d: any, denganStok = true): any => {
    const v = ambil(d, KOLOM_VARIAN);
    if (!denganStok) delete v.stock;
    return v;
};
export const kolomBahan = (d: any): any => ambil(d, KOLOM_BAHAN);
export const kolomTier = (d: any): any => ambil(d, KOLOM_TIER);
export const kolomBahanVarian = (d: any): any => ambil(d, KOLOM_BAHAN_VARIAN);
