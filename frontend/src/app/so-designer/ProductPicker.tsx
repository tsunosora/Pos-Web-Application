"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, History, Loader2, Search, X } from "lucide-react";
import { formatRp, unitBasis } from "./price-estimate";

/** Varian yang dikirim ke form SO saat dipilih (bentuknya sama dgn FlatVariant di form). */
export interface PickerVariant {
    productVariantId: number;
    label: string;
    pricingMode: "UNIT" | "AREA_BASED";
    sku: string;
    outOfStock: boolean;
}

interface VariantRow {
    id: number;
    name: string;
    price: number;
    tierMin: number | null; // harga grosir termurah, bila lebih murah dari harga dasar
    hay: string;
    usage: number;
    pick: PickerVariant;
}

interface Group {
    id: number;
    name: string;
    nameN: string;
    category: string;
    basis: string;
    hay: string;
    variants: VariantRow[];
    minPrice: number;
    usage: number;
}

type Result = { g: Group; variants: VariantRow[] };

// Normalisasi pencarian: huruf kecil, tanpa aksen & tanda baca, "×" dianggap "x".
const norm = (s: unknown) =>
    String(s ?? "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/×/g, "x").replace(/[^a-z0-9]+/g, " ").trim();

const BROWSE_LIMIT = 40;
const SEARCH_LIMIT = 30;
const CHIP_LIMIT = 8;
const FREQUENT_LIMIT = 8;

function PriceText({ price, basis }: { price: number; basis: string }) {
    if (!(price > 0)) return <span className="text-slate-400 dark:text-slate-500">harga di kasir</span>;
    return (
        <span className="font-semibold text-indigo-700 dark:text-indigo-300 whitespace-nowrap">
            {formatRp(price)}<span className="font-normal text-slate-400 dark:text-slate-500">{basis}</span>
        </span>
    );
}

/**
 * Pemilih produk form SO desainer. Katalog ±560 varian dipecah supaya cepat ketemu:
 * kategori, "Sering kamu pakai" (riwayat SO desainer), cari per kata dengan urutan bebas
 * (nama/varian/SKU/kategori), hasil dikelompokkan per produk dengan varian sebagai chip + harga.
 */
export function ProductPicker({ products, loading, usage, onOpen, onPick }: {
    products: any[];
    loading: boolean;
    usage: Record<number, number>; // productVariantId → berapa kali dipakai di SO desainer ini
    onOpen?: () => void;
    onPick: (v: PickerVariant) => void;
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [category, setCategory] = useState<string | null>(null);
    const [expanded, setExpanded] = useState<Set<number>>(() => new Set());
    const [showAll, setShowAll] = useState(false);
    const [hi, setHi] = useState(0);
    const boxRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const navRef = useRef<(() => void)[]>([]);

    // Klik/sentuh di luar → tutup daftar.
    useEffect(() => {
        if (!open) return;
        const onDown = (e: Event) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
        document.addEventListener("mousedown", onDown);
        document.addEventListener("touchstart", onDown);
        return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("touchstart", onDown); };
    }, [open]);

    useEffect(() => {
        listRef.current?.querySelector<HTMLElement>(`[data-nav="${hi}"]`)?.scrollIntoView({ block: "nearest" });
    }, [hi]);

    const groups = useMemo<Group[]>(() => {
        const out: Group[] = [];
        for (const p of products) {
            const vs: any[] = p.variants ?? [];
            if (!vs.length) continue;
            const mode: "UNIT" | "AREA_BASED" = p.pricingMode === "AREA_BASED" ? "AREA_BASED" : "UNIT";
            const category = p.category?.name ?? "";
            const rows: VariantRow[] = vs.map(v => {
                const price = Number(v.price ?? 0);
                const tierPrices = (v.priceTiers ?? []).map((t: any) => Number(t.price)).filter((n: number) => Number.isFinite(n) && n > 0);
                const tierMin = tierPrices.length ? Math.min(...tierPrices) : null;
                return {
                    id: v.id,
                    name: v.variantName || "Standar",
                    price,
                    tierMin: tierMin != null && tierMin < price ? tierMin : null,
                    hay: norm(`${v.variantName ?? ""} ${v.size ?? ""} ${v.sku ?? ""}`),
                    usage: usage[v.id] ?? 0,
                    pick: {
                        productVariantId: v.id,
                        label: `${p.name}${v.variantName ? ` — ${v.variantName}` : ""}`,
                        pricingMode: mode,
                        sku: v.sku ?? "",
                        // Unlimited (trackStock=false) tak pernah habis; sisanya cek stok agregat.
                        outOfStock: p.trackStock !== false && Number(v.stock ?? 0) <= 0,
                    },
                };
            });
            const positive = rows.map(r => r.tierMin ?? r.price).filter(n => n > 0);
            out.push({
                id: p.id,
                name: p.name,
                nameN: norm(p.name),
                category,
                basis: unitBasis(p),
                hay: norm(`${p.name} ${category}`),
                variants: rows,
                minPrice: positive.length ? Math.min(...positive) : 0,
                usage: rows.reduce((s, r) => s + r.usage, 0),
            });
        }
        return out;
    }, [products, usage]);

    const categories = useMemo(() => {
        const count = new Map<string, number>();
        for (const g of groups) if (g.category) count.set(g.category, (count.get(g.category) ?? 0) + 1);
        return [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "id")).map(([name, n]) => ({ name, n }));
    }, [groups]);

    const frequent = useMemo(() => {
        const rows: { g: Group; r: VariantRow }[] = [];
        for (const g of groups) for (const r of g.variants) if (r.usage > 0) rows.push({ g, r });
        return rows.sort((a, b) => b.r.usage - a.r.usage).slice(0, FREQUENT_LIMIT);
    }, [groups]);

    const tokens = useMemo(() => norm(query).split(" ").filter(Boolean), [query]);

    const results = useMemo<Result[]>(() => {
        const pool = category ? groups.filter(g => g.category === category) : groups;
        if (!tokens.length) {
            return [...pool].sort((a, b) => b.usage - a.usage || a.name.localeCompare(b.name, "id")).map(g => ({ g, variants: g.variants }));
        }
        const scored: (Result & { score: number })[] = [];
        for (const g of pool) {
            // Semua kata ada di nama/kategori produk → semua varian relevan; selain itu
            // tiap kata boleh ada di produk ATAU varian (mis. "banner 280").
            const direct = tokens.every(t => g.hay.includes(t));
            const variants = direct ? g.variants : g.variants.filter(r => tokens.every(t => g.hay.includes(t) || r.hay.includes(t)));
            if (!variants.length) continue;
            let score = direct ? 20 : 0;
            if (g.nameN.startsWith(tokens[0])) score += 30;
            for (const t of tokens) score += (" " + g.nameN).includes(" " + t) ? 10 : g.nameN.includes(t) ? 4 : 0;
            score += Math.min(g.usage, 25);
            scored.push({ g, variants, score });
        }
        return scored.sort((a, b) => b.score - a.score || a.g.name.localeCompare(b.g.name, "id"));
    }, [groups, tokens, category]);

    const resetView = () => { setShowAll(false); setHi(0); setExpanded(new Set()); };
    const openPanel = () => { if (!open) { setOpen(true); onOpen?.(); } };
    const pick = (r: VariantRow) => {
        if (r.pick.outOfStock) return;
        onPick(r.pick);
        setQuery("");
        resetView();
        setOpen(false);
    };
    const toggle = (id: number) => {
        setExpanded(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
    };

    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Escape") { setOpen(false); return; }
        if (!open) { if (e.key === "ArrowDown") { e.preventDefault(); openPanel(); } return; }
        const n = navRef.current.length;
        if (e.key === "ArrowDown") { e.preventDefault(); setHi(h => Math.min(h + 1, Math.max(n - 1, 0))); }
        else if (e.key === "ArrowUp") { e.preventDefault(); setHi(h => Math.max(h - 1, 0)); }
        else if (e.key === "Enter") { e.preventDefault(); navRef.current[Math.min(hi, n - 1)]?.(); }
    };

    // Aksi keyboard disusun mengikuti urutan render; tiap tombol punya data-nav = indeksnya.
    const nav: (() => void)[] = [];
    navRef.current = nav;
    const addNav = (fn: () => void) => { nav.push(fn); return nav.length - 1; };

    const browse = tokens.length === 0;
    const visible = showAll ? results : results.slice(0, browse ? BROWSE_LIMIT : SEARCH_LIMIT);

    const chip = (g: Group, r: VariantRow, withProduct = false) => {
        const i = addNav(() => pick(r));
        return (
            <button key={r.id} type="button" data-nav={i} disabled={r.pick.outOfStock}
                onClick={() => pick(r)} onMouseEnter={() => setHi(i)}
                className={`text-left rounded-lg border px-2.5 py-1.5 transition-colors ${hi === i ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/50 ring-2 ring-indigo-500/25" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-indigo-400"} ${r.pick.outOfStock ? "opacity-50 cursor-not-allowed" : ""}`}>
                <div className="text-xs font-medium leading-tight text-slate-800 dark:text-slate-100">{withProduct ? r.pick.label : r.name}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px]">
                    <PriceText price={r.price} basis={g.basis} />
                    {r.tierMin != null && <span className="whitespace-nowrap text-emerald-600 dark:text-emerald-400">grosir {formatRp(r.tierMin)}</span>}
                    {r.pick.outOfStock && <span className="text-rose-600 dark:text-rose-400">stok habis</span>}
                </div>
            </button>
        );
    };

    const groupRow = ({ g, variants }: Result) => {
        const single = g.variants.length === 1;
        const isExp = expanded.has(g.id);
        const chips = isExp ? g.variants : variants.slice(0, CHIP_LIMIT);
        const soldOut = single && g.variants[0].pick.outOfStock;
        const onRow = single ? () => pick(g.variants[0]) : () => toggle(g.id);
        const rowIdx = addNav(onRow);
        return (
            <div key={g.id} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                <button type="button" data-nav={rowIdx} disabled={soldOut} onClick={onRow} onMouseEnter={() => setHi(rowIdx)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${hi === rowIdx ? "bg-indigo-50 dark:bg-indigo-950/40" : "hover:bg-slate-50 dark:hover:bg-slate-800/60"} ${soldOut ? "opacity-50 cursor-not-allowed" : ""}`}>
                    <span className="w-4 shrink-0 text-slate-400">
                        {!single && (isExp ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />)}
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-800 dark:text-slate-100">{g.name}</span>
                        <span className="block truncate text-[11px] text-slate-400 dark:text-slate-500">
                            {g.category || "Tanpa kategori"}{single ? "" : ` · ${g.variants.length} varian`}{g.usage > 0 ? ` · kamu pakai ${g.usage}×` : ""}{soldOut ? " · stok habis" : ""}
                        </span>
                    </span>
                    <span className="shrink-0 text-right text-xs">
                        {single
                            ? <PriceText price={g.variants[0].price} basis={g.basis} />
                            : <><span className="text-slate-400 dark:text-slate-500">mulai </span><PriceText price={g.minPrice} basis={g.basis} /></>}
                    </span>
                </button>
                {!single && (isExp || !browse) && (
                    <div className="flex flex-wrap gap-1.5 px-3 pb-2.5 pl-9">
                        {chips.map(r => chip(g, r))}
                        {!isExp && g.variants.length > chips.length && (() => {
                            const i = addNav(() => toggle(g.id));
                            return (
                                <button type="button" data-nav={i} onClick={() => toggle(g.id)} onMouseEnter={() => setHi(i)}
                                    className={`rounded-lg border border-dashed px-2.5 py-1.5 text-xs font-medium ${hi === i ? "border-indigo-500 text-indigo-700 dark:text-indigo-300" : "border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-indigo-400"}`}>
                                    Lihat semua {g.variants.length} varian
                                </button>
                            );
                        })()}
                    </div>
                )}
            </div>
        );
    };

    const hasUsage = frequent.length > 0;

    return (
        <div ref={boxRef}>
            <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input ref={inputRef} value={query}
                    onFocus={openPanel} onClick={openPanel}
                    onChange={e => { setQuery(e.target.value); resetView(); openPanel(); }}
                    onKeyDown={onKeyDown}
                    placeholder="Cari produk: nama, varian, atau SKU (mis. stiker vinyl)"
                    className="w-full pl-8 pr-9 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {(query || open) && (
                    <button type="button" aria-label={query ? "Hapus pencarian" : "Tutup daftar produk"}
                        onClick={() => { if (query) { setQuery(""); resetView(); inputRef.current?.focus(); } else setOpen(false); }}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700">
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>

            {open && (
                <div className="mt-2 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm">
                    {loading ? (
                        <div className="flex items-center gap-2 p-4 text-sm text-slate-500 dark:text-slate-400">
                            <Loader2 className="h-4 w-4 animate-spin" /> Memuat daftar produk…
                        </div>
                    ) : (
                        <>
                            {categories.length > 1 && (
                                <div className="flex gap-1.5 overflow-x-auto border-b border-slate-100 dark:border-slate-800 px-3 py-2">
                                    {[{ name: null as string | null, n: groups.length }, ...categories].map(c => {
                                        const on = category === c.name;
                                        return (
                                            <button key={c.name ?? "__semua"} type="button"
                                                onClick={() => { setCategory(c.name); resetView(); inputRef.current?.focus(); }}
                                                className={`shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${on ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-indigo-400"}`}>
                                                {c.name ?? "Semua"} <span className={on ? "text-indigo-100" : "text-slate-400"}>{c.n}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                            <div ref={listRef} className="max-h-[26rem] overflow-y-auto overscroll-contain">
                                {browse && !category && hasUsage && (
                                    <div className="border-b border-slate-100 dark:border-slate-800 px-3 py-2.5">
                                        <div className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                                            <History className="h-3 w-3" /> Sering kamu pakai
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">{frequent.map(({ g, r }) => chip(g, r, true))}</div>
                                    </div>
                                )}
                                <div className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                                    {browse ? `${category ?? "Semua produk"}${hasUsage ? " · paling sering kamu pakai di atas" : ""}` : `${results.length} produk cocok`}
                                </div>
                                {visible.map(groupRow)}
                                {results.length === 0 && (
                                    <div className="px-3 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                                        Tidak ada produk yang cocok dengan “{query.trim()}”{category ? ` di kategori ${category}` : ""}.
                                        {category && (
                                            <button type="button" onClick={() => { setCategory(null); resetView(); }}
                                                className="ml-1 font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                                                Cari di semua kategori
                                            </button>
                                        )}
                                    </div>
                                )}
                                {!showAll && results.length > visible.length && (
                                    <button type="button" onClick={() => setShowAll(true)}
                                        className="w-full border-t border-slate-100 dark:border-slate-800 px-3 py-2 text-xs font-medium text-indigo-600 hover:bg-slate-50 dark:text-indigo-400 dark:hover:bg-slate-800/60">
                                        Tampilkan {results.length - visible.length} produk lainnya
                                    </button>
                                )}
                            </div>
                            <div className="hidden items-center gap-3 border-t border-slate-100 dark:border-slate-800 px-3 py-1.5 text-[11px] text-slate-400 dark:text-slate-500 sm:flex">
                                <span>↑ ↓ pilih</span><span>Enter tambah / buka varian</span><span>Esc tutup</span>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
