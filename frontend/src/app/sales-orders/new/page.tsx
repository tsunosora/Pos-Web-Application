"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Plus, Trash2, Upload, Loader2, Save, Search, X } from "lucide-react";
import { getCustomers } from "@/lib/api/customers";
import { getProducts } from "@/lib/api/products";
import { createSalesOrder, uploadProofs, type CreateSalesOrderPayload } from "@/lib/api/sales-orders";
import { useCurrentUser } from "@/hooks/useCurrentUser";

interface DraftItem {
    key: string;
    productVariantId: number | null;
    productLabel: string;
    pricingMode: 'UNIT' | 'AREA_BASED';
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
    pricingMode: 'UNIT' | 'AREA_BASED';
    price: number;
    sku: string;
}

export default function NewSalesOrderPage() {
    const router = useRouter();
    const { currentUser } = useCurrentUser();

    const [customerId, setCustomerId] = useState<number | null>(null);
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [customerAddress, setCustomerAddress] = useState('');
    const [designerName, setDesignerName] = useState(currentUser?.name ?? '');
    const [notes, setNotes] = useState('');
    const [deadline, setDeadline] = useState('');
    const [items, setItems] = useState<DraftItem[]>([]);
    const [proofFiles, setProofFiles] = useState<File[]>([]);
    const [error, setError] = useState<string | null>(null);

    const [customerSearch, setCustomerSearch] = useState('');
    const [variantSearch, setVariantSearch] = useState('');

    const { data: customers } = useQuery({ queryKey: ['customers'], queryFn: getCustomers });
    const { data: products } = useQuery({ queryKey: ['products'], queryFn: getProducts });

    const flatVariants: FlatVariant[] = useMemo(() => {
        if (!products) return [];
        const out: FlatVariant[] = [];
        for (const p of products) {
            const mode: 'UNIT' | 'AREA_BASED' = p.pricingMode ?? 'UNIT';
            for (const v of (p.variants ?? [])) {
                const suffix = v.variantName ? ` — ${v.variantName}` : '';
                out.push({
                    productVariantId: v.id,
                    label: `${p.name}${suffix}`,
                    pricingMode: mode,
                    price: Number(v.price ?? 0),
                    sku: v.sku ?? '',
                });
            }
        }
        return out;
    }, [products]);

    const filteredVariants = useMemo(() => {
        const q = variantSearch.trim().toLowerCase();
        if (!q) return flatVariants.slice(0, 30);
        return flatVariants.filter(v =>
            v.label.toLowerCase().includes(q) || v.sku.toLowerCase().includes(q)
        ).slice(0, 30);
    }, [flatVariants, variantSearch]);

    const filteredCustomers = useMemo(() => {
        if (!customers) return [];
        const q = customerSearch.trim().toLowerCase();
        if (!q) return [];
        return (customers as any[]).filter(c =>
            c.name.toLowerCase().includes(q) || (c.phone || '').includes(q)
        ).slice(0, 8);
    }, [customers, customerSearch]);

    function addVariantAsItem(v: FlatVariant) {
        setItems(prev => [...prev, {
            key: `${v.productVariantId}-${Date.now()}`,
            productVariantId: v.productVariantId,
            productLabel: v.label,
            pricingMode: v.pricingMode,
            quantity: 1,
            unitType: v.pricingMode === 'AREA_BASED' ? 'cm' : undefined,
            pcs: v.pricingMode === 'AREA_BASED' ? 1 : undefined,
        }]);
        setVariantSearch('');
    }

    function updateItem(key: string, patch: Partial<DraftItem>) {
        setItems(prev => prev.map(it => it.key === key ? { ...it, ...patch } : it));
    }

    function removeItem(key: string) {
        setItems(prev => prev.filter(it => it.key !== key));
    }

    function pickCustomer(c: any) {
        setCustomerId(c.id);
        setCustomerName(c.name);
        setCustomerPhone(c.phone ?? '');
        setCustomerAddress(c.address ?? '');
        setCustomerSearch('');
    }

    function addImageFiles(files: File[] | FileList | null) {
        if (!files) return;
        const arr = Array.from(files).filter(f => f.type.startsWith('image/'));
        if (arr.length === 0) return;
        // Normalize nama untuk file dari clipboard (biasanya namanya cuma "image.png" tanpa ekstensi atau anonim)
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
        e.target.value = '';
    }

    function removeProof(idx: number) {
        setProofFiles(prev => prev.filter((_, i) => i !== idx));
    }

    // Paste handler global — Ctrl+V di mana pun pada halaman ini akan menambahkan gambar dari clipboard.
    useEffect(() => {
        function onPaste(e: ClipboardEvent) {
            // Skip kalau user lagi paste di textarea/input (text paste normal)
            const tgt = e.target as HTMLElement | null;
            if (tgt) {
                const tag = tgt.tagName?.toLowerCase();
                if (tag === 'input' || tag === 'textarea' || tgt.isContentEditable) {
                    // Tapi kalau clipboard cuma berisi gambar (bukan text), tetap intercept
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

    const mutation = useMutation({
        mutationFn: async () => {
            setError(null);
            if (!customerName.trim()) throw new Error('Nama customer wajib diisi');
            if (!designerName.trim()) throw new Error('Nama desainer wajib diisi');
            if (items.length === 0) throw new Error('Tambahkan minimal 1 item');
            for (const it of items) {
                if (!it.productVariantId) throw new Error('Ada item tanpa produk');
                if (!it.quantity || it.quantity < 1) throw new Error('Quantity tiap item minimal 1');
            }

            const payload: CreateSalesOrderPayload = {
                customerId: customerId,
                customerName: customerName.trim(),
                customerPhone: customerPhone.trim() || null,
                customerAddress: customerAddress.trim() || null,
                designerName: designerName.trim(),
                notes: notes.trim() || null,
                deadline: deadline ? new Date(deadline).toISOString() : null,
                items: items.map(it => ({
                    productVariantId: it.productVariantId!,
                    quantity: Number(it.quantity) || 1,
                    widthCm: it.widthCm ?? null,
                    heightCm: it.heightCm ?? null,
                    unitType: it.unitType ?? null,
                    pcs: it.pcs ?? null,
                    customPrice: it.customPrice ?? null,
                    note: it.note?.trim() || null,
                })),
            };
            const so = await createSalesOrder(payload);
            if (proofFiles.length > 0) {
                await uploadProofs(so.id, proofFiles);
            }
            return so;
        },
        onSuccess: (so) => {
            router.push(`/sales-orders/${so.id}`);
        },
        onError: (e: any) => {
            setError(e?.response?.data?.message || e?.message || 'Gagal menyimpan SO');
        },
    });

    return (
        <div className="max-w-4xl mx-auto space-y-4">
            <div className="flex items-center gap-2">
                <Link href="/sales-orders" className="p-2 hover:bg-muted rounded-md">
                    <ArrowLeft className="h-5 w-5" />
                </Link>
                <h1 className="text-xl font-bold">Buat Sales Order Baru</h1>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md text-sm">
                    {error}
                </div>
            )}

            {/* Customer */}
            <Section title="Informasi Customer">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="md:col-span-2 relative">
                        <label className="text-xs font-medium text-muted-foreground">Cari customer terdaftar</label>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input
                                value={customerSearch}
                                onChange={e => setCustomerSearch(e.target.value)}
                                placeholder="Nama atau nomor HP..."
                                className="w-full pl-8 pr-3 py-2 text-sm border border-border rounded-md bg-background"
                            />
                        </div>
                        {filteredCustomers.length > 0 && (
                            <div className="absolute z-10 mt-1 w-full bg-card border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
                                {filteredCustomers.map((c: any) => (
                                    <button
                                        key={c.id}
                                        type="button"
                                        onMouseDown={e => e.preventDefault()}
                                        onClick={() => pickCustomer(c)}
                                        className="w-full text-left px-3 py-2 hover:bg-muted text-sm border-b border-border last:border-0"
                                    >
                                        <div className="font-medium">{c.name}</div>
                                        {c.phone && <div className="text-xs text-muted-foreground">{c.phone}</div>}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <Field label="Nama Customer *">
                        <input
                            value={customerName}
                            onChange={e => { setCustomerName(e.target.value); setCustomerId(null); }}
                            className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background"
                            placeholder="Nama pelanggan"
                        />
                    </Field>
                    <Field label="No. HP / WA">
                        <input
                            value={customerPhone}
                            onChange={e => setCustomerPhone(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background"
                            placeholder="08xx..."
                        />
                    </Field>
                    <Field label="Alamat" full>
                        <textarea
                            value={customerAddress}
                            onChange={e => setCustomerAddress(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background"
                            rows={2}
                            placeholder="Opsional"
                        />
                    </Field>
                </div>
            </Section>

            {/* Order info */}
            <Section title="Informasi Order">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Field label="Desainer *">
                        <input
                            value={designerName}
                            onChange={e => setDesignerName(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background"
                            placeholder="Nama desainer"
                        />
                    </Field>
                    <Field label="Deadline">
                        <input
                            type="datetime-local"
                            value={deadline}
                            onChange={e => setDeadline(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background"
                        />
                    </Field>
                    <Field label="Catatan / Instruksi Cetak" full>
                        <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background"
                            rows={3}
                            placeholder="Contoh: cetak double side, laminasi doff, bahan art carton..."
                        />
                    </Field>
                </div>
            </Section>

            {/* Items */}
            <Section title={`Item Orderan (${items.length})`}>
                <div className="relative mb-3">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                        value={variantSearch}
                        onChange={e => setVariantSearch(e.target.value)}
                        placeholder="Cari produk/variant untuk ditambah..."
                        className="w-full pl-8 pr-3 py-2 text-sm border border-border rounded-md bg-background"
                    />
                    {variantSearch && filteredVariants.length > 0 && (
                        <div className="absolute z-10 mt-1 w-full bg-card border border-border rounded-md shadow-lg max-h-72 overflow-y-auto">
                            {filteredVariants.map(v => (
                                <button
                                    key={v.productVariantId}
                                    type="button"
                                    onMouseDown={e => e.preventDefault()}
                                    onClick={() => addVariantAsItem(v)}
                                    className="w-full text-left px-3 py-2 hover:bg-muted text-sm border-b border-border last:border-0"
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="font-medium">{v.label}</div>
                                            <div className="text-xs text-muted-foreground">SKU: {v.sku} • {v.pricingMode === 'AREA_BASED' ? 'per m²' : 'per unit'}</div>
                                        </div>
                                        <div className="text-xs font-semibold">Rp {v.price.toLocaleString('id-ID')}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {items.length === 0 ? (
                    <div className="text-center text-sm text-muted-foreground py-6 border border-dashed border-border rounded-md">
                        Belum ada item. Cari produk di atas untuk menambahkan.
                    </div>
                ) : (
                    <div className="space-y-2">
                        {items.map((it, idx) => (
                            <div key={it.key} className="border border-border rounded-md p-3 bg-muted/20">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                        <div className="text-xs text-muted-foreground">Item {idx + 1}</div>
                                        <div className="font-medium text-sm">{it.productLabel}</div>
                                    </div>
                                    <button
                                        onClick={() => removeItem(it.key)}
                                        className="p-1 hover:bg-red-100 rounded text-red-600"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-2">
                                    <Field label="Qty">
                                        <input
                                            type="number" min={1}
                                            value={it.quantity}
                                            onChange={e => updateItem(it.key, { quantity: Number(e.target.value) })}
                                            className="w-full px-2 py-1 text-sm border border-border rounded bg-background"
                                        />
                                    </Field>
                                    {it.pricingMode === 'AREA_BASED' && (
                                        <>
                                            <Field label="Lebar (cm)">
                                                <input
                                                    type="number" min={0}
                                                    value={it.widthCm ?? ''}
                                                    onChange={e => updateItem(it.key, { widthCm: Number(e.target.value) })}
                                                    className="w-full px-2 py-1 text-sm border border-border rounded bg-background"
                                                />
                                            </Field>
                                            <Field label="Tinggi (cm)">
                                                <input
                                                    type="number" min={0}
                                                    value={it.heightCm ?? ''}
                                                    onChange={e => updateItem(it.key, { heightCm: Number(e.target.value) })}
                                                    className="w-full px-2 py-1 text-sm border border-border rounded bg-background"
                                                />
                                            </Field>
                                            <Field label="Pcs/Kopi">
                                                <input
                                                    type="number" min={1}
                                                    value={it.pcs ?? 1}
                                                    onChange={e => updateItem(it.key, { pcs: Number(e.target.value) })}
                                                    className="w-full px-2 py-1 text-sm border border-border rounded bg-background"
                                                />
                                            </Field>
                                        </>
                                    )}
                                    <Field label="Harga Override (opsional)">
                                        <input
                                            type="number" min={0}
                                            value={it.customPrice ?? ''}
                                            onChange={e => updateItem(it.key, {
                                                customPrice: e.target.value === '' ? null : Number(e.target.value)
                                            })}
                                            className="w-full px-2 py-1 text-sm border border-border rounded bg-background"
                                            placeholder="Auto"
                                        />
                                    </Field>
                                </div>
                                <div className="mt-2">
                                    <input
                                        value={it.note ?? ''}
                                        onChange={e => updateItem(it.key, { note: e.target.value })}
                                        placeholder="Catatan item (finishing, file design, dll)"
                                        className="w-full px-2 py-1 text-xs border border-border rounded bg-background"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Section>

            {/* Proof images */}
            <Section title={`Screenshot Proof Final (${proofFiles.length}/10)`}>
                <p className="text-xs text-muted-foreground mb-2">
                    Upload screenshot bukti ACC dari customer (WA pribadi). Gambar ini nanti dikirim ke group WA internal sebagai handoff ke kasir/operator.
                </p>
                <div
                    onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
                    onDrop={e => { e.preventDefault(); addImageFiles(e.dataTransfer.files); }}
                    className="border-2 border-dashed border-border rounded-lg p-4 text-center hover:bg-muted/40 transition-colors"
                >
                    <label className="inline-flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-md cursor-pointer hover:opacity-90 text-sm font-medium">
                        <Upload className="h-4 w-4" />
                        Pilih Gambar
                        <input
                            type="file"
                            multiple
                            accept="image/*"
                            onChange={handleProofInput}
                            className="hidden"
                        />
                    </label>
                    <p className="text-xs text-muted-foreground mt-2">
                        atau <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded font-mono text-[10px]">Ctrl + V</kbd> untuk paste screenshot,
                        atau drag & drop file ke sini
                    </p>
                </div>
                {proofFiles.length > 0 && (
                    <div className="grid grid-cols-3 md:grid-cols-5 gap-2 mt-3">
                        {proofFiles.map((f, i) => (
                            <div key={i} className="relative group">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={URL.createObjectURL(f)}
                                    alt={f.name}
                                    className="w-full h-24 object-cover rounded border border-border"
                                />
                                <button
                                    onClick={() => removeProof(i)}
                                    className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition"
                                    type="button"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </Section>

            {/* Actions */}
            <div className="flex justify-end gap-2 sticky bottom-0 bg-background/80 backdrop-blur py-3 border-t border-border">
                <Link href="/sales-orders" className="px-4 py-2 text-sm border border-border rounded-md hover:bg-muted">
                    Batal
                </Link>
                <button
                    onClick={() => mutation.mutate()}
                    disabled={mutation.isPending}
                    className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50"
                >
                    {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Simpan SO (Draft)
                </button>
            </div>
        </div>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="bg-card border border-border rounded-lg p-4">
            <h2 className="text-sm font-semibold mb-3">{title}</h2>
            {children}
        </div>
    );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
    return (
        <div className={full ? 'md:col-span-2' : ''}>
            <label className="text-xs font-medium text-muted-foreground block mb-1">{label}</label>
            {children}
        </div>
    );
}
