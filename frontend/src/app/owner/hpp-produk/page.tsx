"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Lock, Calculator, ChevronDown, ChevronRight } from "lucide-react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
    getHppOverview,
    type HppOverviewProduct,
    type HppOverviewVariant,
} from "@/lib/api/hpp";
import { StatusBadge, type BadgeTone } from "@/components/ui/status-badge";

const fmtRp = (n: number) => "Rp " + Math.round(Number(n) || 0).toLocaleString("id-ID");
const fmtPct = (n: number | null) => (n == null ? "—" : `${n.toFixed(1)}%`);

const sourceLabel: Record<HppOverviewVariant["source"], { text: string; tone: BadgeTone }> = {
    "variant-bom": { text: "BOM Varian", tone: "success" },
    flat: { text: "HPP Manual", tone: "info" },
    none: { text: "Belum diisi", tone: "warning" },
};

export default function HppProdukPage() {
    const { isOwner, currentUser } = useCurrentUser();
    const [q, setQ] = useState("");
    const [open, setOpen] = useState<Record<number, boolean>>({});

    const { data, isLoading } = useQuery({
        queryKey: ["owner-hpp-overview"],
        queryFn: () => getHppOverview(),
        enabled: isOwner,
        staleTime: 60_000,
    });

    const filtered = useMemo(() => {
        const list = (data as HppOverviewProduct[]) || [];
        const term = q.trim().toLowerCase();
        if (!term) return list;
        return list.filter(
            (p) =>
                p.productName.toLowerCase().includes(term) ||
                (p.category?.name || "").toLowerCase().includes(term),
        );
    }, [data, q]);

    if (currentUser === undefined) {
        return (
            <div className="min-h-screen grid place-items-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!isOwner) {
        return (
            <div className="min-h-screen grid place-items-center">
                <div className="text-center space-y-2">
                    <Lock className="h-7 w-7 mx-auto text-muted-foreground" />
                    <h1 className="text-lg font-semibold">Khusus Owner</h1>
                    <p className="text-sm text-muted-foreground">
                        Halaman rincian HPP hanya bisa diakses owner.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen p-4 sm:p-6 max-w-6xl mx-auto space-y-5">
            <header className="flex items-center gap-3">
                <div className="grid place-items-center h-10 w-10 rounded-xl bg-primary/15 text-primary">
                    <Calculator className="h-5 w-5" />
                </div>
                <div>
                    <h1 className="text-xl font-bold">Rumus HPP per Produk</h1>
                    <p className="text-sm text-muted-foreground">
                        Rincian perhitungan HPP tiap produk &amp; varian (sumber, breakdown bahan, worksheet).
                    </p>
                </div>
            </header>

            <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari produk / kategori…"
                className="w-full sm:max-w-xs rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />

            {isLoading ? (
                <div className="py-16 grid place-items-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map((p) => (
                        <ProductCard
                            key={p.productId}
                            p={p}
                            open={!!open[p.productId]}
                            onToggle={() =>
                                setOpen((s) => ({ ...s, [p.productId]: !s[p.productId] }))
                            }
                        />
                    ))}
                    {filtered.length === 0 && (
                        <p className="text-sm text-muted-foreground py-8 text-center">
                            Tidak ada produk.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}

function ProductCard({
    p,
    open,
    onToggle,
}: {
    p: HppOverviewProduct;
    open: boolean;
    onToggle: () => void;
}) {
    return (
        <section className="rounded-xl border border-border bg-card">
            <button
                onClick={onToggle}
                className="w-full flex items-center justify-between gap-3 p-4 text-left"
            >
                <div className="flex items-center gap-2 min-w-0">
                    {open ? (
                        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0">
                        <div className="font-semibold truncate">{p.productName}</div>
                        <div className="text-xs text-muted-foreground truncate">
                            {p.category?.name || "Tanpa kategori"} · {p.variants.length} varian
                        </div>
                    </div>
                </div>
            </button>
            {open && (
                <div className="px-4 pb-4 space-y-3">
                    {p.variants.length === 0 && (
                        <p className="text-xs text-muted-foreground">Produk tanpa varian.</p>
                    )}
                    {p.variants.map((v) => (
                        <VariantRow key={v.variantId} v={v} />
                    ))}
                </div>
            )}
        </section>
    );
}

function VariantRow({ v }: { v: HppOverviewVariant }) {
    const src = sourceLabel[v.source] ?? sourceLabel.none;
    return (
        <div className="rounded-lg border border-border/70 bg-background p-3 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-medium">{v.variantName}</div>
                <div className="flex items-center gap-2 text-sm">
                    <StatusBadge tone={src.tone}>{src.text}</StatusBadge>
                    <span className="text-muted-foreground">HPP efektif</span>
                    <span className="font-semibold">{fmtRp(v.effectiveHpp)}</span>
                </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Info label="Harga jual" value={fmtRp(v.price)} />
                <Info label="HPP tersimpan" value={fmtRp(v.storedHpp)} />
                <Info label="Margin" value={fmtPct(v.margin)} />
                <Info label="Laba/unit" value={fmtRp(v.price - v.effectiveHpp)} />
            </div>

            {v.variantBom.length > 0 && (
                <div>
                    <div className="text-xs font-semibold text-muted-foreground mb-1">
                        Rumus HPP = Σ (harga × qty) bahan:
                    </div>
                    <table className="w-full text-xs">
                        <thead className="text-muted-foreground">
                            <tr>
                                <th className="text-left font-normal">Bahan</th>
                                <th className="text-right font-normal">Harga</th>
                                <th className="text-right font-normal">Qty</th>
                                <th className="text-right font-normal">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(() => {
                                const showShared = v.variantBom.some(b => b.isShared) && v.variantBom.some(b => !b.isShared);
                                return v.variantBom.map((b, i) => (
                                <tr key={i}>
                                    <td className="py-0.5">
                                        {b.name}
                                        {b.isServiceCost ? " (jasa)" : ""}
                                        {showShared && (
                                            <span className={`ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold ${b.isShared ? "bg-muted text-muted-foreground" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"}`}>
                                                {b.isShared ? "Bersama" : "Khusus"}
                                            </span>
                                        )}
                                    </td>
                                    <td className="text-right">{fmtRp(b.price)}</td>
                                    <td className="text-right">
                                        {b.quantity} {b.unit || ""}
                                    </td>
                                    <td className="text-right font-medium">{fmtRp(b.subtotal)}</td>
                                </tr>
                            ));
                            })()}
                            <tr className="border-t border-border">
                                <td colSpan={3} className="py-0.5 text-right font-semibold">
                                    Total HPP
                                </td>
                                <td className="text-right font-semibold">
                                    {fmtRp(v.variantBomHpp || 0)}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            )}

            {v.worksheet && (
                <div className="rounded-md bg-muted/40 p-2 space-y-1 text-xs">
                    <div className="font-semibold">Lembar kerja HPP (worksheet)</div>
                    <div className="flex justify-between">
                        <span>Total biaya variabel / unit</span>
                        <span>{fmtRp(v.worksheet.totalVariable)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>
                            Biaya tetap {fmtRp(v.worksheet.totalFixedMonthly)}/bln ÷{" "}
                            {v.worksheet.targetVolume} unit
                        </span>
                        <span>{fmtRp(v.worksheet.allocatedFixed)}</span>
                    </div>
                    <div className="flex justify-between font-semibold border-t border-border pt-1">
                        <span>HPP/unit (worksheet)</span>
                        <span>{fmtRp(v.worksheet.hppPerUnit)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Target margin {v.worksheet.targetMargin}% → harga saran</span>
                        <span>{fmtRp(v.worksheet.suggestedPrice)}</span>
                    </div>
                    {v.worksheet.appliedAt && (
                        <div className="text-muted-foreground">
                            Diterapkan ke HPP varian:{" "}
                            {new Date(v.worksheet.appliedAt).toLocaleDateString("id-ID")}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function Info({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-md bg-muted/40 px-2 py-1">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
            <div className="font-medium">{value}</div>
        </div>
    );
}
