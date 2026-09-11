/**
 * Platform marketplace untuk "Order Marketplace" di SO / POS. Pembeli marketplace
 * sering tidak memberikan nomor HP, jadi order marketplace boleh tanpa HP — pelanggan
 * dikenali dari platform + nama/username (sama dengan KPI backend).
 * "Lainnya" = isian bebas untuk platform di luar daftar.
 */
export const MARKETPLACE_OPTIONS = ["Shopee", "Tokopedia", "TikTok Shop", "Lazada"];
export const MARKETPLACE_OTHER = "Lainnya";

/** Rapikan nama platform (spasi, maks 40 karakter); kosong → null. Sama dengan backend. */
export function cleanMarketplace(v?: string | null): string | null {
    const t = String(v ?? "").replace(/\s+/g, " ").trim();
    return t ? t.slice(0, 40) : null;
}
