"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getProducts, type LeadItem } from "@/lib/api";
import { Plus, X, Search, Package } from "lucide-react";

/**
 * Hitung subtotal item — AREA_BASED kalau widthCm & heightCm ter-isi (heuristic
 * sederhana, tidak perlu lookup pricingMode). Formula:
 *   AREA_BASED: qty × (w × h / 10000) × unitPrice (unitPrice = harga per m²)
 *   UNIT      : qty × unitPrice
 */
export function calcItemSubtotal(item: { quantity?: number; unitPrice?: number; widthCm?: number | null; heightCm?: number | null }): number {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unitPrice) || 0;
    const w = Number(item.widthCm) || 0;
    const h = Number(item.heightCm) || 0;
    if (w > 0 && h > 0) {
        const areaM2 = (w * h) / 10000;
        return qty * areaM2 * price;
    }
    return qty * price;
}

interface Props {
    items: LeadItem[];
    onChange: (items: LeadItem[]) => void;
}

interface PriceTier { minQty: number; maxQty: number | null; price: number }

interface VariantOption {
    id: number;
    sku: string;
    variantName: string | null;
    price: number;
    productName: string;
    pricingMode: string;
    priceTiers: PriceTier[];
}

/** Harga satuan sesuai tier qty (mode UNIT, sama dengan POS/manajemen stok) — fallback harga dasar. */
function tierPrice(qty: number, basePrice: number, tiers: PriceTier[]): number {
    const hit = (tiers || []).find(t => qty >= t.minQty && (t.maxQty == null || qty <= t.maxQty));
    return hit ? hit.price : basePrice;
}

export function LeadItemsEditor({ items, onChange }: Props) {
    const { data: products } = useQuery({
        queryKey: ["products-list-for-lead-picker"],
        queryFn: getProducts,
        staleTime: 5 * 60_000,
    });
    const [pickerOpen, setPickerOpen] = useState(false);
    const [customMode, setCustomMode] = useState(false);
    const [search, setSearch] = useState("");
    const [customName, setCustomName] = useState("");
    const [customPrice, setCustomPrice] = useState<number | "">("");
    const [customQty, setCustomQty] = useState<number>(1);

    // Flatten products → variants
    const variantOptions: VariantOption[] = useMemo(() => {
        if (!products) return [];
        const opts: VariantOption[] = [];
        for (const p of products as any[]) {
            for (const v of p.variants || []) {
                opts.push({
                    id: v.id,
                    sku: v.sku,
                    variantName: v.variantName,
                    price: Number(v.price),
                    productName: p.name,
                    pricingMode: p.pricingMode,
                    priceTiers: (v.priceTiers || []).map((t: any) => ({
                        minQty: Number(t.minQty),
                        maxQty: t.maxQty != null ? Number(t.maxQty) : null,
                        price: Number(t.price),
                    })),
                });
            }
        }
        return opts;
    }, [products]);

    const filtered = useMemo(() => {
        if (!search) return variantOptions.slice(0, 30);
        const q = search.toLowerCase();
        return variantOptions.filter(v =>
            v.productName.toLowerCase().includes(q) ||
            v.sku.toLowerCase().includes(q) ||
            (v.variantName || "").toLowerCase().includes(q),
        ).slice(0, 30);
    }, [variantOptions, search]);

    // Lookup varian per id — untuk resolve harga tier saat qty item berubah
    const variantById = useMemo(
        () => new Map(variantOptions.map(v => [v.id, v])),
        [variantOptions],
    );

    const addVariant = (v: VariantOption) => {
        const desc = v.variantName ? `${v.productName} - ${v.variantName}` : v.productName;
        onChange([
            ...items,
            {
                productVariantId: v.id,
                description: desc,
                quantity: 1,
                unitPrice: v.pricingMode === "AREA_BASED" ? v.price : tierPrice(1, v.price, v.priceTiers),
                productVariant: {
                    id: v.id, sku: v.sku, variantName: v.variantName, price: v.price,
                    product: { id: 0, name: v.productName, pricingMode: v.pricingMode },
                },
            } as any,
        ]);
        setPickerOpen(false);
        setSearch("");
    };

    const addCustomItem = () => {
        if (!customName.trim() || !customPrice || +customPrice <= 0) {
            alert("Nama produk + harga wajib diisi");
            return;
        }
        onChange([
            ...items,
            {
                productVariantId: null,
                description: customName.trim(),
                quantity: customQty || 1,
                unitPrice: Number(customPrice),
            },
        ]);
        setPickerOpen(false);
        setCustomMode(false);
        setCustomName("");
        setCustomPrice("");
        setCustomQty(1);
    };

    const updateItem = (idx: number, patch: Partial<LeadItem>) => {
        const next = items.map((it, i) => (i === idx ? { ...it, ...patch } : it));
        onChange(next);
    };

    /** Ubah qty + ikuti harga tier otomatis (mode UNIT), selama harga belum diedit manual. */
    const handleQtyChange = (idx: number, qty: number) => {
        const it = items[idx];
        const patch: Partial<LeadItem> = { quantity: qty };
        const v = it.productVariantId ? variantById.get(it.productVariantId) : undefined;
        if (v && v.pricingMode !== "AREA_BASED" && v.priceTiers.length > 0) {
            // Harga saat ini masih harga otomatis utk qty lama → resolve ulang utk qty baru.
            // Kalau CS sudah ketik harga manual (beda dari auto), jangan ditimpa.
            const autoPrev = tierPrice(Number(it.quantity) || 1, v.price, v.priceTiers);
            if (Number(it.unitPrice) === autoPrev) {
                patch.unitPrice = tierPrice(qty, v.price, v.priceTiers);
            }
        }
        updateItem(idx, patch);
    };

    const removeItem = (idx: number) => {
        onChange(items.filter((_, i) => i !== idx));
    };

    const total = items.reduce((s, it) => s + calcItemSubtotal(it), 0);

    return (
        <div className="border border-gray-200 rounded-lg p-3 bg-gray-50/50">
            <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                    <Package className="h-3.5 w-3.5" /> Daftar Produk Order
                    <span className="text-gray-400 font-normal ml-1">({items.length} item)</span>
                </label>
                <button
                    type="button"
                    onClick={() => { setPickerOpen(true); setCustomMode(false); }}
                    className="text-xs px-2.5 py-1 bg-indigo-600 text-white rounded font-semibold hover:bg-indigo-700 flex items-center gap-1"
                >
                    <Plus className="h-3 w-3" /> Tambah Produk
                </button>
            </div>

            {items.length === 0 ? (
                <p className="text-xs text-gray-500 italic text-center py-3">
                    Belum ada produk. Klik "+ Tambah Produk" untuk pick dari katalog atau input custom.
                </p>
            ) : (
                <div className="space-y-2">
                    {items.map((it, idx) => {
                        const subtotal = calcItemSubtotal(it);
                        const isCustom = !it.productVariantId;
                        const isArea = (Number(it.widthCm) || 0) > 0 && (Number(it.heightCm) || 0) > 0;
                        const areaM2 = isArea ? (Number(it.widthCm) * Number(it.heightCm)) / 10000 : 0;
                        // Tandai kalau harga item mengikuti tier varian (bukan harga dasar/manual)
                        const tv = it.productVariantId ? variantById.get(it.productVariantId) : undefined;
                        const autoNow = tv && tv.pricingMode !== "AREA_BASED" && tv.priceTiers.length > 0
                            ? tierPrice(Number(it.quantity) || 1, tv.price, tv.priceTiers) : null;
                        const tierApplied = autoNow != null && Number(it.unitPrice) === autoNow && autoNow !== tv!.price;
                        return (
                            <div key={idx} className="bg-white border border-gray-200 rounded p-2 text-xs">
                                <div className="flex items-start justify-between gap-2 mb-1.5">
                                    <div className="min-w-0 flex-1">
                                        <div className="font-semibold text-gray-800 truncate">{it.description}</div>
                                        {isCustom ? (
                                            <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">⚠ Custom (tidak akan masuk SPK — hanya Invoice)</span>
                                        ) : (
                                            <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">✓ Dari katalog</span>
                                        )}
                                    </div>
                                    <button type="button" onClick={() => removeItem(idx)}
                                        className="text-red-500 hover:text-red-700 shrink-0" title="Hapus">
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                                <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                                    <div>
                                        <label className="text-[10px] text-gray-500">Qty</label>
                                        <input type="number" min={1} value={it.quantity || ""}
                                            onChange={(e) => handleQtyChange(idx, +e.target.value || 1)}
                                            className="w-full border border-gray-300 rounded px-2 py-1 text-xs font-mono" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-gray-500">
                                            {isArea ? "Harga / m² (Rp)" : "Harga Satuan (Rp)"}
                                            {tierApplied && <span className="text-emerald-600 font-semibold"> · tier</span>}
                                        </label>
                                        <input type="number" min={0} value={it.unitPrice || ""}
                                            onChange={(e) => updateItem(idx, { unitPrice: +e.target.value || 0 })}
                                            className="w-full border border-gray-300 rounded px-2 py-1 text-xs font-mono" />
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[10px] text-gray-500">Subtotal</div>
                                        <div className="font-bold text-indigo-700 font-mono">
                                            Rp {subtotal.toLocaleString("id-ID", { maximumFractionDigits: 0 })}
                                        </div>
                                        {isArea && (
                                            <div className="text-[9px] text-gray-400 font-mono">
                                                {it.quantity}× {areaM2.toFixed(2)}m²
                                            </div>
                                        )}
                                    </div>
                                </div>
                                {/* Optional dimension for AREA_BASED */}
                                {it.productVariant?.product?.pricingMode === "AREA_BASED" && (
                                    <div className="grid grid-cols-2 gap-2 mt-1.5">
                                        <div>
                                            <label className="text-[10px] text-gray-500">Lebar (cm)</label>
                                            <input type="number" min={0} value={it.widthCm || ""}
                                                onChange={(e) => updateItem(idx, { widthCm: +e.target.value || null })}
                                                className="w-full border border-gray-300 rounded px-2 py-1 text-xs font-mono" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-gray-500">Tinggi (cm)</label>
                                            <input type="number" min={0} value={it.heightCm || ""}
                                                onChange={(e) => updateItem(idx, { heightCm: +e.target.value || null })}
                                                className="w-full border border-gray-300 rounded px-2 py-1 text-xs font-mono" />
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Total bar */}
            {items.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-200 flex items-center justify-between text-xs">
                    <span className="font-semibold text-gray-600">Total Estimasi</span>
                    <span className="font-bold text-indigo-700 font-mono">Rp {total.toLocaleString("id-ID")}</span>
                </div>
            )}

            {/* Picker modal */}
            {pickerOpen && (
                <div className="fixed inset-0 bg-black/50 z-[400] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl max-w-lg w-full max-h-[80vh] overflow-y-auto p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="font-bold text-base">Pilih Produk</h3>
                            <button onClick={() => setPickerOpen(false)} className="p-1 hover:bg-gray-100 rounded">
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Toggle: katalog vs custom */}
                        <div className="flex gap-2 mb-3">
                            <button type="button" onClick={() => setCustomMode(false)}
                                className={`flex-1 py-1.5 rounded text-xs font-semibold ${!customMode ? "bg-indigo-600 text-white" : "bg-gray-100"}`}>
                                📋 Dari Katalog
                            </button>
                            <button type="button" onClick={() => setCustomMode(true)}
                                className={`flex-1 py-1.5 rounded text-xs font-semibold ${customMode ? "bg-amber-600 text-white" : "bg-gray-100"}`}>
                                ✏️ Custom (free-text)
                            </button>
                        </div>

                        {!customMode ? (
                            <>
                                <div className="relative mb-2">
                                    <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-gray-400" />
                                    <input
                                        autoFocus
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        placeholder="Cari nama / SKU / variant..."
                                        className="w-full pl-7 pr-2 py-1.5 border border-gray-300 rounded text-sm"
                                    />
                                </div>
                                <div className="space-y-1 max-h-[50vh] overflow-y-auto">
                                    {filtered.length === 0 ? (
                                        <p className="text-xs text-gray-500 text-center py-4">Tidak ada produk.</p>
                                    ) : filtered.map((v) => (
                                        <button
                                            key={v.id}
                                            type="button"
                                            onClick={() => addVariant(v)}
                                            className="w-full text-left p-2 border border-gray-200 rounded hover:border-indigo-300 hover:bg-indigo-50 text-xs"
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="min-w-0 flex-1">
                                                    <div className="font-semibold text-gray-800 truncate">
                                                        {v.productName} {v.variantName && <span className="text-gray-500 font-normal">— {v.variantName}</span>}
                                                    </div>
                                                    <div className="text-[10px] text-gray-500">
                                                        {v.sku} · {v.pricingMode === "AREA_BASED" ? "per m²" : "per pcs"}
                                                    </div>
                                                </div>
                                                <div className="font-bold text-indigo-700 font-mono shrink-0">
                                                    Rp {v.price.toLocaleString("id-ID")}
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div className="space-y-2">
                                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                                    ⚠️ Custom item akan masuk Invoice tapi <strong>tidak masuk SPK (Sales Order)</strong> karena tidak terhubung produk katalog.
                                </p>
                                <div>
                                    <label className="text-xs font-semibold text-gray-600">Nama Produk</label>
                                    <input value={customName} onChange={(e) => setCustomName(e.target.value)}
                                        placeholder="mis. Jersey custom desain khusus" autoFocus
                                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm mt-0.5" />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-xs font-semibold text-gray-600">Qty</label>
                                        <input type="number" min={1} value={customQty || ""} onChange={(e) => setCustomQty(+e.target.value || 1)}
                                            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm mt-0.5 font-mono" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-gray-600">Harga Satuan (Rp)</label>
                                        <input type="number" min={0} value={customPrice} onChange={(e) => setCustomPrice(e.target.value as any)}
                                            placeholder="200000"
                                            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm mt-0.5 font-mono" />
                                    </div>
                                </div>
                                <button type="button" onClick={addCustomItem}
                                    className="w-full py-2 bg-amber-600 text-white rounded font-semibold text-sm hover:bg-amber-700">
                                    + Tambah Item Custom
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
