"use client";

import { useState } from "react";
import { X, Plus, Minus, ArrowDownToLine, ArrowUpFromLine, SlidersHorizontal } from "lucide-react";

export type StockVariant = {
    id: number;
    sku?: string;
    variantName?: string | null;
    stock?: number | null;
    isRollMaterial?: boolean;
};

export type StockSubmit = (p: {
    productVariantId: number;
    type: "IN" | "OUT" | "ADJUST";
    quantity: number;
    reason?: string;
}) => Promise<any>;

/**
 * Modal pintar untuk input stok: tab Masuk / Keluar / Setel (default Masuk).
 * Perubahan stok hanya lewat modal ini (deliberate) — tidak ada edit inline yang
 * rawan ke-pencet. Tap target besar, pratinjau hasil live, bottom-sheet di mobile.
 */
export function SmartStockModal({
    variant, productName, onClose, onSubmit,
}: {
    variant: StockVariant;
    productName?: string;
    onClose: () => void;
    onSubmit: StockSubmit;
}) {
    const current = Number(variant.stock ?? 0);
    const [tab, setTab] = useState<"IN" | "OUT" | "ADJUST">("IN");
    const [qty, setQty] = useState<string>("");
    const [reason, setReason] = useState("");
    const [saving, setSaving] = useState(false);

    const n = Number(qty) || 0;
    const projected = tab === "IN" ? current + n : tab === "OUT" ? current - n : n;
    const outTooMuch = tab === "OUT" && n > current;
    const canSubmit = tab === "ADJUST" ? qty !== "" : n > 0 && !outTooMuch;

    const switchTab = (t: "IN" | "OUT" | "ADJUST") => {
        setTab(t);
        // Setel: pra-isi dengan stok saat ini supaya tinggal koreksi.
        setQty(t === "ADJUST" ? String(current) : "");
    };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSubmit || saving) return;
        setSaving(true);
        try {
            await onSubmit({ productVariantId: variant.id, type: tab, quantity: n, reason });
            onClose();
        } finally {
            setSaving(false);
        }
    };

    const tabs = [
        { key: "IN" as const, label: "Masuk", icon: ArrowDownToLine, active: "bg-emerald-500 text-white border-emerald-500", btn: "bg-emerald-600 hover:bg-emerald-700" },
        { key: "OUT" as const, label: "Keluar", icon: ArrowUpFromLine, active: "bg-rose-500 text-white border-rose-500", btn: "bg-rose-600 hover:bg-rose-700" },
        { key: "ADJUST" as const, label: "Setel", icon: SlidersHorizontal, active: "bg-blue-500 text-white border-blue-500", btn: "bg-blue-600 hover:bg-blue-700" },
    ];
    const activeTab = tabs.find((t) => t.key === tab)!;

    const step = (d: number) => setQty((q) => String(Math.max(0, (Number(q) || 0) + d)));

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-background/88 backdrop-blur-3xl" onClick={onClose}>
            <div
                className="glass-strong w-full sm:max-w-md rounded-t-2xl sm:rounded-xl border border-border shadow-lg max-h-[92vh] overflow-y-auto animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-4 border-b border-border">
                    <div className="min-w-0">
                        <h3 className="font-semibold text-lg leading-tight">Kelola Stok</h3>
                        <p className="text-xs text-muted-foreground truncate">
                            {productName ? `${productName} · ` : ""}{variant.sku}{variant.variantName ? ` — ${variant.variantName}` : ""}
                        </p>
                    </div>
                    <button onClick={onClose} className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground"><X className="w-5 h-5" /></button>
                </div>

                <form onSubmit={submit} className="p-4 space-y-4">
                    {/* Stok saat ini */}
                    <div className="flex items-baseline justify-between bg-muted/50 rounded-lg px-3 py-2 border border-border/50">
                        <span className="text-sm text-muted-foreground">Stok saat ini</span>
                        <span className="text-xl font-bold tabular-nums">{current}</span>
                    </div>

                    {/* Tab Masuk / Keluar / Setel */}
                    <div className="grid grid-cols-3 gap-2">
                        {tabs.map((t) => (
                            <button
                                key={t.key}
                                type="button"
                                onClick={() => switchTab(t.key)}
                                className={`flex flex-col items-center gap-1 py-2.5 rounded-lg border text-sm font-medium transition ${tab === t.key ? t.active : "bg-background border-border text-muted-foreground hover:bg-muted"}`}
                            >
                                <t.icon className="h-4 w-4" />
                                {t.label}
                            </button>
                        ))}
                    </div>

                    {/* Kuantitas dengan stepper besar */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">{tab === "ADJUST" ? "Jumlah stok baru" : "Jumlah"}</label>
                        <div className="flex items-center gap-2">
                            <button type="button" onClick={() => step(-1)} className="h-12 w-12 shrink-0 flex items-center justify-center rounded-xl border border-border bg-background hover:bg-muted active:scale-95 transition">
                                <Minus className="h-5 w-5" />
                            </button>
                            <input
                                autoFocus
                                type="number"
                                inputMode="numeric"
                                min={0}
                                value={qty}
                                onChange={(e) => setQty(e.target.value)}
                                onFocus={(e) => e.target.select()}
                                placeholder="0"
                                className="flex-1 h-12 text-center text-2xl font-bold rounded-xl border border-border bg-background outline-none focus:border-primary tabular-nums"
                            />
                            <button type="button" onClick={() => step(1)} className="h-12 w-12 shrink-0 flex items-center justify-center rounded-xl border border-border bg-background hover:bg-muted active:scale-95 transition">
                                <Plus className="h-5 w-5" />
                            </button>
                        </div>
                    </div>

                    {/* Pratinjau hasil */}
                    <div className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${outTooMuch ? "bg-rose-500/10 text-rose-600" : "bg-muted/50 text-muted-foreground"}`}>
                        {outTooMuch ? (
                            <span>Stok tidak cukup untuk dikeluarkan.</span>
                        ) : (
                            <>
                                <span>Setelah disimpan</span>
                                <span className="font-bold text-foreground tabular-nums">{current} → {projected}</span>
                            </>
                        )}
                    </div>

                    {/* Catatan */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Catatan / Alasan <span className="text-muted-foreground font-normal">(opsional)</span></label>
                        <input
                            type="text"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder={tab === "IN" ? "Misal: Barang masuk / Stok awal" : tab === "OUT" ? "Misal: Barang rusak" : "Misal: Hasil opname"}
                            className="w-full px-3 py-2.5 bg-background border border-border rounded-lg outline-none focus:border-primary text-sm"
                        />
                    </div>

                    <div className="flex gap-2 pt-1">
                        <button type="button" onClick={onClose} className="px-4 py-3 sm:py-2.5 rounded-lg border border-border hover:bg-muted font-medium text-sm">Batal</button>
                        <button
                            type="submit"
                            disabled={!canSubmit || saving}
                            className={`flex-1 py-3 sm:py-2.5 rounded-lg text-white font-semibold text-sm transition disabled:opacity-50 ${activeTab.btn}`}
                        >
                            {saving ? "Menyimpan..." : `${activeTab.label} Stok`}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
