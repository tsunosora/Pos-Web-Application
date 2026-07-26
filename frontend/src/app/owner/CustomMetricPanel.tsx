"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Pencil, Trash2, Check, X, Tag, Target } from "lucide-react";
import {
    getCustomProductMetrics,
    createCustomProductMetric,
    updateCustomProductMetric,
    deleteCustomProductMetric,
    type CustomProductMetric,
    type UpsertCustomProductMetric,
    type CustomMetricCountMode,
    type CustomMetricRole,
} from "@/lib/api/custom-product-metrics";
import { getCategories, getProducts } from "@/lib/api/products";

interface CategoryOpt { id: number; name: string }
interface ProductOpt { id: number; name: string; variantCount: number }

const COUNT_MODES: { v: CustomMetricCountMode; label: string; hint: string }[] = [
    { v: "PCS", label: "Pcs (jumlah barang)", hint: "Σ qty × pcs" },
    { v: "QTY", label: "Qty (baris order)", hint: "Σ quantity" },
    { v: "OMZET", label: "Omzet (Rp)", hint: "Σ harga × qty" },
    { v: "NOTA", label: "Nota (jumlah transaksi)", hint: "berapa nota mengandung produk" },
];

const ROLES: { v: CustomMetricRole; label: string }[] = [
    { v: "CS", label: "CS" },
    { v: "DESIGNER", label: "Designer" },
    { v: "OPERATOR", label: "Operator" },
];

const EMPTY: UpsertCustomProductMetric = {
    name: "",
    label: "",
    isActive: true,
    displayOrder: 0,
    productIds: [],
    productVariantIds: [],
    categoryIds: [],
    nameKeywords: [],
    countMode: "PCS",
    roles: ["CS"],
};

export function CustomMetricPanel() {
    const qc = useQueryClient();
    const listQ = useQuery({ queryKey: ["custom-metrics"], queryFn: getCustomProductMetrics });
    const catQ = useQuery({ queryKey: ["categories-for-metric"], queryFn: getCategories });
    const prodQ = useQuery({ queryKey: ["products-for-metric"], queryFn: getProducts });
    const categories: CategoryOpt[] = useMemo(
        () => (catQ.data ?? []).map((c: any) => ({ id: c.id, name: c.name })),
        [catQ.data],
    );
    const products: ProductOpt[] = useMemo(
        () => (prodQ.data ?? [])
            .map((p: any) => ({ id: p.id, name: p.name, variantCount: (p.variants?.length ?? 0) }))
            .sort((a: ProductOpt, b: ProductOpt) => a.name.localeCompare(b.name)),
        [prodQ.data],
    );

    const [open, setOpen] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);
    const [form, setForm] = useState<UpsertCustomProductMetric>(EMPTY);
    const [keywordText, setKeywordText] = useState("");
    const [prodSearch, setProdSearch] = useState("");
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const invalidate = () => {
        qc.invalidateQueries({ queryKey: ["custom-metrics"] });
        // Refresh leaderboard (CS + owner) agar kolom baru langsung tampil.
        qc.invalidateQueries({ queryKey: ["lb-kpi"] });
        qc.invalidateQueries({ queryKey: ["lb-designer"] });
        qc.invalidateQueries({ queryKey: ["lb-operator"] });
        qc.invalidateQueries({ queryKey: ["owner-kpi"] });
    };

    const createMut = useMutation({
        mutationFn: createCustomProductMetric,
        onSuccess: () => { invalidate(); reset(); },
        onError: (e: any) => setErr(e?.response?.data?.message ?? "Gagal menyimpan"),
    });
    const updateMut = useMutation({
        mutationFn: ({ id, body }: { id: number; body: UpsertCustomProductMetric }) => updateCustomProductMetric(id, body),
        onSuccess: () => { invalidate(); reset(); },
        onError: (e: any) => setErr(e?.response?.data?.message ?? "Gagal menyimpan"),
    });
    const deleteMut = useMutation({
        mutationFn: deleteCustomProductMetric,
        onSuccess: invalidate,
    });
    const toggleMut = useMutation({
        mutationFn: ({ m, isActive }: { m: CustomProductMetric; isActive: boolean }) =>
            updateCustomProductMetric(m.id, { ...toBody(m), isActive }),
        onSuccess: invalidate,
    });

    function toBody(m: CustomProductMetric): UpsertCustomProductMetric {
        return {
            name: m.name, label: m.label, isActive: m.isActive, displayOrder: m.displayOrder,
            productIds: m.productIds ?? [],
            productVariantIds: m.productVariantIds ?? [], categoryIds: m.categoryIds ?? [],
            nameKeywords: m.nameKeywords ?? [], countMode: m.countMode, roles: m.roles ?? [],
        };
    }

    function reset() {
        setForm(EMPTY); setEditId(null); setKeywordText(""); setProdSearch(""); setShowAdvanced(false); setErr(null); setOpen(false);
    }
    function startNew() {
        setForm(EMPTY); setEditId(null); setKeywordText(""); setProdSearch(""); setShowAdvanced(false); setErr(null); setOpen(true);
    }
    function startEdit(m: CustomProductMetric) {
        setForm(toBody(m)); setEditId(m.id); setKeywordText((m.nameKeywords ?? []).join(", "));
        setProdSearch("");
        setShowAdvanced((m.categoryIds?.length ?? 0) > 0 || (m.nameKeywords?.length ?? 0) > 0);
        setErr(null); setOpen(true);
    }

    function parseKeywords(text: string): string[] {
        return text.split(",").map(s => s.trim()).filter(Boolean);
    }

    function submit(ev: React.FormEvent) {
        ev.preventDefault();
        setErr(null);
        const keywords = parseKeywords(keywordText);
        const body: UpsertCustomProductMetric = { ...form, nameKeywords: keywords };
        const hasRule = (body.productIds?.length ?? 0) > 0 || (body.categoryIds?.length ?? 0) > 0 || keywords.length > 0 || (body.productVariantIds?.length ?? 0) > 0;
        if (!body.name.trim() || !body.label.trim()) { setErr("Nama & label wajib diisi."); return; }
        if (!hasRule) { setErr("Pilih minimal satu produk (atau kategori/kata kunci)."); return; }
        if (!body.roles.length) { setErr("Pilih minimal satu leaderboard (role)."); return; }
        if (editId != null) updateMut.mutate({ id: editId, body });
        else createMut.mutate(body);
    }

    function toggleProduct(id: number) {
        setForm(f => {
            const set = new Set(f.productIds ?? []);
            if (set.has(id)) set.delete(id); else set.add(id);
            return { ...f, productIds: Array.from(set) };
        });
    }
    function toggleCat(id: number) {
        setForm(f => {
            const set = new Set(f.categoryIds ?? []);
            if (set.has(id)) set.delete(id); else set.add(id);
            return { ...f, categoryIds: Array.from(set) };
        });
    }
    function toggleRole(r: CustomMetricRole) {
        setForm(f => {
            const set = new Set(f.roles);
            if (set.has(r)) set.delete(r); else set.add(r);
            return { ...f, roles: Array.from(set) };
        });
    }

    const saving = createMut.isPending || updateMut.isPending;

    return (
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-indigo-500/15 text-indigo-500 grid place-items-center"><Target className="h-4 w-4" /></div>
                    <div>
                        <h3 className="text-sm font-semibold text-foreground">Metrik Produk Custom</h3>
                        <p className="text-[11px] text-muted-foreground">Kolom produk khusus di leaderboard (CS / Designer / Operator).</p>
                    </div>
                </div>
                {!open && (
                    <button onClick={startNew} className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90">
                        <Plus className="h-3.5 w-3.5" /> Tambah
                    </button>
                )}
            </div>

            {/* Form */}
            {open && (
                <form onSubmit={submit} className="mb-4 rounded-xl border border-border bg-background/60 p-3 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] text-muted-foreground block mb-0.5">Nama (internal)</label>
                            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                placeholder="mis. Jersey Kantor"
                                className="w-full border border-border rounded px-2 py-1 text-xs bg-background text-foreground" />
                        </div>
                        <div>
                            <label className="text-[10px] text-muted-foreground block mb-0.5">Label kolom (≤40)</label>
                            <input value={form.label} maxLength={40} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                                placeholder="mis. Jersey"
                                className="w-full border border-border rounded px-2 py-1 text-xs bg-background text-foreground" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] text-muted-foreground block mb-0.5">Cara hitung</label>
                            <select value={form.countMode} onChange={e => setForm(f => ({ ...f, countMode: e.target.value as CustomMetricCountMode }))}
                                className="w-full border border-border rounded px-2 py-1 text-xs bg-background text-foreground">
                                {COUNT_MODES.map(m => <option key={m.v} value={m.v}>{m.label}</option>)}
                            </select>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{COUNT_MODES.find(m => m.v === form.countMode)?.hint}</p>
                        </div>
                        <div>
                            <label className="text-[10px] text-muted-foreground block mb-0.5">Tampil di leaderboard</label>
                            <div className="flex flex-wrap gap-1.5 pt-0.5">
                                {ROLES.map(r => {
                                    const on = form.roles.includes(r.v);
                                    return (
                                        <button type="button" key={r.v} onClick={() => toggleRole(r.v)}
                                            className={`text-[11px] px-2 py-1 rounded-md border ${on ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}>
                                            {r.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Pilih produk dari inventori (aturan utama) */}
                    <div>
                        <label className="text-[10px] text-muted-foreground block mb-1">
                            Produk dari inventori <span className="text-foreground font-medium">· {(form.productIds ?? []).length} dipilih</span>
                        </label>
                        <input value={prodSearch} onChange={e => setProdSearch(e.target.value)}
                            placeholder="Cari produk…"
                            className="w-full border border-border rounded px-2 py-1 text-xs bg-background text-foreground mb-1.5" />
                        <div className="border border-border rounded-lg max-h-52 overflow-y-auto divide-y divide-border/60">
                            {prodQ.isLoading && <div className="p-3 grid place-items-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>}
                            {!prodQ.isLoading && products.length === 0 && (
                                <p className="text-[11px] text-muted-foreground p-3 text-center">Belum ada produk di inventori.</p>
                            )}
                            {products
                                .filter(p => p.name.toLowerCase().includes(prodSearch.trim().toLowerCase()))
                                .map(p => {
                                    const on = (form.productIds ?? []).includes(p.id);
                                    const disabled = p.variantCount === 0;
                                    return (
                                        <button type="button" key={p.id} disabled={disabled}
                                            onClick={() => toggleProduct(p.id)}
                                            className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-xs transition-colors ${on ? "bg-indigo-500/10" : "hover:bg-accent"} ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}>
                                            <span className={`h-3.5 w-3.5 rounded border grid place-items-center shrink-0 ${on ? "bg-indigo-500 border-indigo-500 text-white" : "border-border"}`}>
                                                {on && <Check className="h-2.5 w-2.5" />}
                                            </span>
                                            <span className="flex-1 truncate text-foreground">{p.name}</span>
                                            <span className="text-[10px] text-muted-foreground shrink-0">
                                                {disabled ? "tanpa varian" : `${p.variantCount} varian`}
                                            </span>
                                        </button>
                                    );
                                })}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">Pilih produk terdaftar — semua variannya (termasuk varian baru) otomatis ikut dihitung.</p>
                    </div>

                    {/* Aturan lanjutan (opsional): kategori & kata kunci */}
                    <div>
                        <button type="button" onClick={() => setShowAdvanced(v => !v)}
                            className="text-[11px] text-muted-foreground hover:text-foreground underline">
                            {showAdvanced ? "Sembunyikan" : "Aturan lanjutan (kategori / kata kunci)"}
                        </button>
                        {showAdvanced && (
                            <div className="mt-2 space-y-3">
                                <div>
                                    <label className="text-[10px] text-muted-foreground block mb-1">Kategori (opsional)</label>
                                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                                        {catQ.isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                                        {categories.map(c => {
                                            const on = (form.categoryIds ?? []).includes(c.id);
                                            return (
                                                <button type="button" key={c.id} onClick={() => toggleCat(c.id)}
                                                    className={`text-[11px] px-2 py-1 rounded-md border inline-flex items-center gap-1 ${on ? "bg-indigo-500/15 text-indigo-500 border-indigo-500/40" : "border-border text-muted-foreground"}`}>
                                                    <Tag className="h-3 w-3" /> {c.name}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] text-muted-foreground block mb-0.5">Kata kunci nama (pisah koma)</label>
                                    <input value={keywordText} onChange={e => setKeywordText(e.target.value)}
                                        placeholder="mis. jersey, kaos kantor"
                                        className="w-full border border-border rounded px-2 py-1 text-xs bg-background text-foreground" />
                                    <p className="text-[10px] text-muted-foreground mt-0.5">Cocokkan nama produk/varian atau item custom (mengandung kata).</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {err && <p className="text-[11px] text-red-500">{err}</p>}

                    <div className="flex items-center gap-2 pt-1">
                        <button type="submit" disabled={saving}
                            className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-60">
                            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                            {editId != null ? "Simpan Perubahan" : "Buat Metrik"}
                        </button>
                        <button type="button" onClick={reset}
                            className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:bg-accent">
                            <X className="h-3.5 w-3.5" /> Batal
                        </button>
                    </div>
                </form>
            )}

            {/* List */}
            {listQ.isLoading ? (
                <div className="py-6 grid place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : (listQ.data?.length ?? 0) === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">Belum ada metrik custom. Klik “Tambah” untuk membuat kolom produk khusus.</p>
            ) : (
                <div className="space-y-1.5">
                    {listQ.data!.map(m => (
                        <div key={m.id} className="flex items-center gap-2 rounded-lg border border-border/70 px-3 py-2">
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-sm font-medium text-foreground truncate">{m.label}</span>
                                    <span className="text-[10px] text-muted-foreground">· {m.name}</span>
                                    {!m.isActive && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">nonaktif</span>}
                                </div>
                                <div className="text-[10px] text-muted-foreground flex flex-wrap gap-x-2 mt-0.5">
                                    <span>{COUNT_MODES.find(c => c.v === m.countMode)?.label ?? m.countMode}</span>
                                    <span>· {(m.roles ?? []).join("/")}</span>
                                    {(m.productIds?.length ?? 0) > 0 && <span>· {m.productIds.length} produk</span>}
                                    {(m.categoryIds?.length ?? 0) > 0 && <span>· {m.categoryIds.length} kategori</span>}
                                    {(m.nameKeywords?.length ?? 0) > 0 && <span>· kata: {m.nameKeywords.join(", ")}</span>}
                                </div>
                            </div>
                            <button onClick={() => toggleMut.mutate({ m, isActive: !m.isActive })}
                                className="text-[10px] px-2 py-1 rounded border border-border text-muted-foreground hover:bg-accent">
                                {m.isActive ? "Nonaktifkan" : "Aktifkan"}
                            </button>
                            <button onClick={() => startEdit(m)} className="p-1.5 rounded hover:bg-accent text-muted-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                            <button onClick={() => { if (confirm(`Hapus metrik "${m.label}"?`)) deleteMut.mutate(m.id); }}
                                className="p-1.5 rounded hover:bg-red-500/10 text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
