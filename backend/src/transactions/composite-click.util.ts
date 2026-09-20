/**
 * Klik mesin untuk produk COMPOSITE (mis. "Buku Custom — Cetak + Jilid").
 *
 * Produk komposit dirakit dari varian kertas A3+ yang masing-masing sudah punya
 * tarif klik sendiri (isi = 2 sisi, cover = 1 sisi). Sebelum ini klik komposit
 * sengaja belum diemit ("Fase 1"), sehingga lembar yang dipakai buku TIDAK
 * tercatat di laporan klik dan notanya tidak pernah muncul di papan Cetak —
 * ikut menyumbang selisih antara tagihan KLIK vendor dan klik tercatat.
 *
 * Fungsi ini murni (tanpa DB) supaya gampang diuji: hitung berapa klik per
 * tarif dari rincian komposit yang sudah dihitung server.
 */

export type CompositeBreakdownLike = {
  variantId: number;
  qty: number;
  name?: string | null;
};

export type ClickRateLike = {
  id: number;
  isActive: boolean;
  pricePerClick: number | string;
};

export type VariantClickCfg = {
  id: number;
  clicksPerUnit?: number | null;
  clickRate?: ClickRateLike | null;
  product?: {
    clicksPerUnit?: number | null;
    clickRate?: ClickRateLike | null;
  } | null;
};

export type ClickBatchEntry = {
  rateId: number;
  pricePerClick: number;
  clicks: number;
  /** Keterangan untuk operator, mis. "Cetak Art Paper 100gr — 2 SISI ×12". */
  label: string | null;
};

/**
 * @param breakdown   rincian komponen dari `computeComposite` (qty = lembar per 1 unit komposit)
 * @param variants    konfigurasi klik varian komponen (varian → produk sebagai cadangan)
 * @param compositeQty jumlah unit komposit di baris nota (mis. 10 buku)
 */
export function buildCompositeClickBatch(
  breakdown: CompositeBreakdownLike[] | null | undefined,
  variants: VariantClickCfg[],
  compositeQty: number,
): ClickBatchEntry[] {
  const unit = Math.max(1, Math.round(Number(compositeQty) || 1));
  const byId = new Map<number, VariantClickCfg>(
    (variants ?? []).map((v) => [Number(v.id), v]),
  );

  const merged = new Map<number, ClickBatchEntry>();
  for (const row of breakdown ?? []) {
    const v = byId.get(Number(row?.variantId));
    if (!v) continue;

    // Tarif varian menang; kalau kosong pakai tarif produknya. Tarif nonaktif diabaikan.
    const rate = v.clickRate?.isActive
      ? v.clickRate
      : v.product?.clickRate?.isActive
        ? v.product.clickRate
        : null;
    if (!rate) continue;

    const perRaw = Number(v.clicksPerUnit ?? v.product?.clicksPerUnit ?? 1);
    const perUnit = Number.isFinite(perRaw) && perRaw > 0 ? perRaw : 1;
    const lembar = Number(row.qty);
    if (!Number.isFinite(lembar) || lembar <= 0) continue;

    const clicks = Math.round(lembar * perUnit * unit);
    const price = Number(rate.pricePerClick);
    if (clicks <= 0 || !Number.isFinite(price) || price <= 0) continue;

    const label = row.name ? `${row.name} ×${Math.round(lembar * unit)}` : null;
    const cur = merged.get(Number(rate.id));
    if (cur) {
      cur.clicks += clicks;
      cur.label = [cur.label, label].filter(Boolean).join(' + ') || null;
    } else {
      merged.set(Number(rate.id), {
        rateId: Number(rate.id),
        pricePerClick: price,
        clicks,
        label,
      });
    }
  }
  return [...merged.values()];
}
