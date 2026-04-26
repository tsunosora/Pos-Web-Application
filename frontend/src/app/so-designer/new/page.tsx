"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Trash2, Upload, Loader2, Save, Search, X } from "lucide-react";
import { useDesignerSession } from "../useDesignerSession";
import { designerCreateSO, designerUploadProofs, getPublicCustomers } from "@/lib/api/designers";
import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface CustomerHint { id: number; name: string; phone: string | null; address: string | null; }

interface DraftItem {
    key: string;
    productVariantId: number;
    productLabel: string;
    pricingMode: "UNIT" | "AREA_BASED";
    quantity: number;
    widthCm?: number;
    heightCm?: number;
    unitType?: string;
    pcs?: number;
    customPrice?: number | null;
    note?: string;
}

interface FlatVariant {
    productVariantId: number;
    label: string;
    pricingMode: "UNIT" | "AREA_BASED";
    sku: string;
}

export default function DesignerNewSOPage() {
    const router = useRouter();
    const session = useDesignerSession();

    const [customerName, setCustomerName] = useState("");
    const [customerPhone, setCustomerPhone] = useState("");
    const [customerAddress, setCustomerAddress] = useState("");
    const [customerSearch, setCustomerSearch] = useState("");
    const [customers, setCustomers] = useState<CustomerHint[]>([]);
    const [notes, setNotes] = useState("");
    const [deadline, setDeadline] = useState("");
    const [items, setItems] = useState<DraftItem[]>([]);
    const [proofFiles, setProofFiles] = useState<File[]>([]);
    const [variantSearch, setVariantSearch] = useState("");
    const [products, setProducts] = useState<any[]>([]);
    const [productsLoaded, setProductsLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    // Load customers sekali saat komponen mount
    useMemo(() => {
        getPublicCustomers().then(setCustomers).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const filteredCustomers = useMemo(() => {
        const q = customerSearch.trim().toLowerCase();
        if (!q) return [];
        return customers.filter(c =>
            c.name.toLowerCase().includes(q) || (c.phone || "").includes(q)
        ).slice(0, 6);
    }, [customers, customerSearch]);

    function pickCustomer(c: CustomerHint) {
        setCustomerName(c.name);
        setCustomerPhone(c.phone ?? "");
        setCustomerAddress(c.address ?? "");
        setCustomerSearch("");
    }

    // Lazy-load produk saat pertama kali user klik search
    async function ensureProducts() {
        if (productsLoaded) return;
        const res = await axios.get(`${API_BASE}/products/public`);
        setProducts(res.data ?? []);
        setProductsLoaded(true);
    }

    const flatVariants: FlatVariant[] = useMemo(() => {
        const out: FlatVariant[] = [];
        for (const p of products) {
            const mode: "UNIT" | "AREA_BASED" = p.pricingMode ?? "UNIT";
            for (const v of p.variants ?? []) {
                const suffix = v.variantName ? ` — ${v.variantName}` : "";
                out.push({ productVariantId: v.id, label: `${p.name}${suffix}`, pricingMode: mode, sku: v.sku ?? "" });
            }
        }
        return out;
    }, [products]);

    const filteredVariants = useMemo(() => {
        const q = variantSearch.trim().toLowerCase();
        if (!q) return flatVariants.slice(0, 30);
        return flatVariants.filter(v => v.label.toLowerCase().includes(q) || v.sku.toLowerCase().includes(q)).slice(0, 30);
    }, [flatVariants, variantSearch]);

    function addVariant(v: FlatVariant) {
        setItems(prev => [...prev, {
            key: `${v.productVariantId}-${Date.now()}`,
            productVariantId: v.productVariantId,
            productLabel: v.label,
            pricingMode: v.pricingMode,
            quantity: 1,
            unitType: v.pricingMode === "AREA_BASED" ? "cm" : undefined,
            pcs: v.pricingMode === "AREA_BASED" ? 1 : undefined,
        }]);
        setVariantSearch("");
    }

    function updateItem(key: string, patch: Partial<DraftItem>) {
        setItems(prev => prev.map(it => it.key === key ? { ...it, ...patch } : it));
    }

    function addImageFiles(files: File[] | FileList | null) {
        if (!files) return;
        const arr = Array.from(files).filter(f => f.type.startsWith("image/"));
        if (arr.length === 0) return;
        const normalized = arr.map((f, i) => {
            if (f.name && f.name !== 'image.png' && /\.[a-z0-9]+$/i.test(f.name)) return f;
            const extMap: Record<string, string> = {
                'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif',
                'image/webp': '.webp', 'image/bmp': '.bmp',
            };
            const ext = extMap[f.type] || '.png';
            return new File([f], `pasted-${Date.now()}-${i}${ext}`, { type: f.type });
        });
        setProofFiles(prev => [...prev, ...normalized].slice(0, 10));
    }

    function handleProofInput(e: React.ChangeEvent<HTMLInputElement>) {
        addImageFiles(e.target.files);
        e.target.value = "";
    }

    // Paste handler global — Ctrl+V untuk paste screenshot dari clipboard
    useEffect(() => {
        function onPaste(e: ClipboardEvent) {
            const tgt = e.target as HTMLElement | null;
            if (tgt) {
                const tag = tgt.tagName?.toLowerCase();
                if (tag === 'input' || tag === 'textarea' || tgt.isContentEditable) {
                    const items = e.clipboardData?.items;
                    const hasOnlyImage = items && Array.from(items).every(it => it.type.startsWith('image/'));
                    if (!hasOnlyImage) return;
                }
            }
            const items = e.clipboardData?.items;
            if (!items) return;
            const files: File[] = [];
            for (const it of Array.from(items)) {
                if (it.kind === 'file' && it.type.startsWith('image/')) {
                    const f = it.getAsFile();
                    if (f) files.push(f);
                }
            }
            if (files.length > 0) {
                e.preventDefault();
                addImageFiles(files);
            }
        }
        window.addEventListener('paste', onPaste);
        return () => window.removeEventListener('paste', onPaste);
    }, []);

    async function handleSave() {
        if (!session) return;
        setError(null);
        if (!customerName.trim()) { setError("Nama customer wajib diisi"); return; }
        if (items.length === 0) { setError("Tambahkan minimal 1 item"); return; }

        setSaving(true);
        try {
            const so = await designerCreateSO(session.id, session.pin, {
                customerName: customerName.trim(),
                customerPhone: customerPhone.trim() || null,
                customerAddress: customerAddress.trim() || null,
                notes: notes.trim() || null,
                deadline: deadline ? new Date(deadline).toISOString() : null,
                items: items.map(it => ({
                    productVariantId: it.productVariantId,
                    quantity: Number(it.quantity) || 1,
                    widthCm: it.widthCm ?? null,
                    heightCm: it.heightCm ?? null,
                    unitType: it.unitType ?? null,
                    pcs: it.pcs ?? null,
                    customPrice: it.customPrice ?? null,
                    note: it.note?.trim() || null,
                })),
            });
            if (proofFiles.length > 0) {
                await designerUploadProofs(so.id, session.id, session.pin, proofFiles);
            }
            router.push(`/so-designer/detail/${so.id}`);
        } catch (e: any) {
            setError(e?.response?.data?.message || e?.message || "Gagal menyimpan SO");
        } finally {
            setSaving(false);
        }
    }

    if (!session) return null;

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-3 flex items-center gap-3 shadow-lg shadow-indigo-500/20 sticky top-0 z-10">
                <Link href="/so-designer/dashboard" className="p-1.5 hover:bg-white/15 rounded-lg transition-colors">
                    <ArrowLeft className="h-5 w-5" />
                </Link>
                <div className="min-w-0">
                    <div className="font-semibold leading-tight truncate">Buat Sales Order Baru</div>
                    <div className="text-xs text-indigo-100 truncate">
                        {session.name}
                        {session.branchName && <> · <span className="text-yellow-300 font-semibold">{session.branchName}</span></>}
                    </div>
                </div>
            </div>

            <div className="max-w-2xl mx-auto p-4 space-y-4 pb-24">
                {error && <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 rounded-lg px-3 py-2 text-sm">{error}</div>}

                {/* Customer */}
                <Card title="Customer">
                    <div className="space-y-3">
                        {/* Search customer terdaftar */}
                        <Field label="Cari customer terdaftar (opsional)">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <input
                                    value={customerSearch}
                                    onChange={e => setCustomerSearch(e.target.value)}
                                    placeholder="Ketik nama atau HP untuk cari..."
                                    className="w-full pl-8 pr-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition-colors"
                                />
                                {filteredCustomers.length > 0 && (
                                    <div className="absolute z-10 mt-1 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                        {filteredCustomers.map(c => (
                                            <button
                                                key={c.id}
                                                type="button"
                                                onMouseDown={e => e.preventDefault()}
                                                onClick={() => pickCustomer(c)}
                                                className="w-full text-left px-3 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 text-sm border-b border-slate-100 dark:border-slate-800 last:border-0 text-slate-700 dark:text-slate-200"
                                            >
                                                <div className="font-medium">{c.name}</div>
                                                {c.phone && <div className="text-xs text-slate-400 dark:text-slate-500">{c.phone}</div>}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </Field>

                        <Field label="Nama Customer *">
                            <input value={customerName} onChange={e => setCustomerName(e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition-colors" placeholder="Nama pelanggan" />
                        </Field>
                        <Field label="No. HP / WA">
                            <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition-colors" placeholder="08xx..." />
                        </Field>
                        <Field label="Alamat">
                            <textarea value={customerAddress} onChange={e => setCustomerAddress(e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition-colors" rows={2} placeholder="Opsional" />
                        </Field>
                    </div>
                </Card>

                {/* Order info */}
                <Card title="Detail Order">
                    <div className="space-y-3">
                        <Field label="Deadline">
                            <input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition-colors" />
                        </Field>
                        <Field label="Catatan / Instruksi Cetak">
                            <textarea value={notes} onChange={e => setNotes(e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition-colors" rows={3}
                                placeholder="Contoh: cetak double side, laminasi doff, art carton..." />
                        </Field>
                    </div>
                </Card>

                {/* Items */}
                <Card title={`Item (${items.length})`}>
                    <div className="relative mb-3">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            value={variantSearch}
                            onChange={e => { setVariantSearch(e.target.value); ensureProducts(); }}
                            onFocus={ensureProducts}
                            placeholder="Cari produk untuk ditambahkan..."
                            className="w-full pl-8 pr-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition-colors"
                        />
                        {variantSearch && filteredVariants.length > 0 && (
                            <div className="absolute z-10 mt-1 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                                {filteredVariants.map(v => (
                                    <button key={v.productVariantId} type="button"
                                        onMouseDown={e => e.preventDefault()}
                                        onClick={() => addVariant(v)}
                                        className="w-full text-left px-3 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 text-sm border-b border-slate-100 dark:border-slate-800 last:border-0 text-slate-700 dark:text-slate-200"
                                    >
                                        <div className="font-medium">{v.label}</div>
                                        <div className="text-xs text-slate-400 dark:text-slate-500">{v.sku} • {v.pricingMode === "AREA_BASED" ? "per m²" : "per unit"}</div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {items.length === 0 ? (
                        <div className="text-center text-sm text-slate-400 dark:text-slate-500 py-6 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg">
                            Cari produk di atas untuk menambahkan item
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {items.map((it, idx) => (
                                <div key={it.key} className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 bg-slate-50 dark:bg-slate-800/50">
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <div className="text-xs text-slate-400 dark:text-slate-500">Item {idx + 1}</div>
                                            <div className="font-medium text-sm text-slate-800 dark:text-slate-200">{it.productLabel}</div>
                                        </div>
                                        <button onClick={() => setItems(p => p.filter(i => i.key !== it.key))}
                                            className="p-1 hover:bg-red-100 dark:hover:bg-red-950/40 rounded text-red-500 dark:text-red-400">
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 mt-2">
                                        {it.pricingMode !== "AREA_BASED" && (
                                            <Field label="Qty">
                                                <input type="number" min={1} value={it.quantity}
                                                    onChange={e => updateItem(it.key, { quantity: Number(e.target.value) })}
                                                    className="w-full px-2 py-1 text-sm border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100" />
                                            </Field>
                                        )}
                                        {it.pricingMode === "AREA_BASED" && (
                                            <>
                                                <Field label="Lebar (cm)">
                                                    <input type="number" min={0} value={it.widthCm ?? ""}
                                                        onChange={e => updateItem(it.key, { widthCm: Number(e.target.value) })}
                                                        className="w-full px-2 py-1 text-sm border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100" />
                                                </Field>
                                                <Field label="Tinggi (cm)">
                                                    <input type="number" min={0} value={it.heightCm ?? ""}
                                                        onChange={e => updateItem(it.key, { heightCm: Number(e.target.value) })}
                                                        className="w-full px-2 py-1 text-sm border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100" />
                                                </Field>
                                                <Field label="Pcs">
                                                    <input type="number" min={1} value={it.pcs ?? 1}
                                                        onChange={e => updateItem(it.key, { pcs: Number(e.target.value) })}
                                                        className="w-full px-2 py-1 text-sm border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100" />
                                                </Field>
                                            </>
                                        )}
                                    </div>
                                    <div className="mt-2">
                                        <input value={it.note ?? ""} onChange={e => updateItem(it.key, { note: e.target.value })}
                                            placeholder="Catatan item (finishing, file desain, dll)"
                                            className="w-full px-2 py-1 text-xs border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>

                {/* Proof */}
                <Card title={`Screenshot Proof Final (${proofFiles.length}/10)`}>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Upload screenshot ACC dari customer (WA pribadi). Akan dikirim ke group WA internal saat broadcast.</p>
                    <div
                        onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
                        onDrop={e => { e.preventDefault(); addImageFiles(e.dataTransfer.files); }}
                        className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-4 text-center hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 transition-colors"
                    >
                        <label className="inline-flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg cursor-pointer text-sm font-medium transition-colors">
                            <Upload className="h-4 w-4" /> Pilih Gambar
                            <input type="file" multiple accept="image/*" onChange={handleProofInput} className="hidden" />
                        </label>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                            atau <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded font-mono text-[10px]">Ctrl + V</kbd> untuk paste screenshot,
                            atau drag & drop file ke sini
                        </p>
                    </div>
                    {proofFiles.length > 0 && (
                        <div className="grid grid-cols-3 gap-2 mt-3">
                            {proofFiles.map((f, i) => (
                                <div key={i} className="relative group">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={URL.createObjectURL(f)} alt={f.name} className="w-full h-24 object-cover rounded-lg border border-slate-200 dark:border-slate-700" />
                                    <button onClick={() => setProofFiles(p => p.filter((_, j) => j !== i))}
                                        className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <X className="h-3 w-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>
            </div>

            {/* Sticky footer */}
            <div className="fixed bottom-0 inset-x-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 p-4 shadow-lg">
                <div className="flex gap-2 max-w-2xl mx-auto">
                    <Link href="/so-designer/dashboard" className="flex-1 text-center py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors">
                        Batal
                    </Link>
                    <button onClick={handleSave} disabled={saving}
                        className="flex-1 inline-flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white py-2.5 rounded-xl text-sm font-semibold shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition">
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Simpan SO
                    </button>
                </div>
            </div>
        </div>
    );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3">{title}</h3>
            {children}
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">{label}</label>
            {children}
        </div>
    );
}
