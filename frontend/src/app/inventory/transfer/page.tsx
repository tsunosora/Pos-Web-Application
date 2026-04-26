'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from '@/lib/api/client';
import { ArrowRightLeft, Plus, Trash2, Search, History, Loader2, Package } from 'lucide-react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { PageHeader } from '@/components/ui/page-header';
import { ResponsiveTable, EmptyState } from '@/components/ui/responsive-table';

interface Branch {
    id: number;
    name: string;
    code: string | null;
}

interface Variant {
    id: number;
    sku: string;
    variantName: string | null;
    stock: number;
    product: { id: number; name: string };
}

interface TransferItem {
    productVariantId: number;
    variantLabel: string;
    quantity: number;
    availableAtFrom: number;
}

interface TransferHistory {
    id: number;
    transferNumber: string;
    fromBranchId: number;
    toBranchId: number;
    notes: string | null;
    createdAt: string;
    fromBranch: { id: number; name: string; code: string | null };
    toBranch: { id: number; name: string; code: string | null };
    items: Array<{
        id: number;
        productVariantId: number;
        quantity: number;
        note: string | null;
        productVariant: {
            id: number;
            sku: string;
            variantName: string | null;
            product: { id: number; name: string };
        };
    }>;
}

const fetchBranches = () => axios.get<Branch[]>('/company-branches/active').then(r => r.data);
const fetchProducts = () => axios.get<any[]>('/products').then(r => r.data);
const fetchTransfers = () => axios.get<TransferHistory[]>('/stock-transfers').then(r => r.data);

export default function TransferStokPage() {
    const qc = useQueryClient();
    const { isOwner, branchId: userBranchId } = useCurrentUser();

    const { data: branches = [] } = useQuery({ queryKey: ['company-branches', 'active'], queryFn: fetchBranches });
    const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: fetchProducts });
    const { data: transfers = [], isLoading: loadingHistory } = useQuery({
        queryKey: ['stock-transfers'],
        queryFn: fetchTransfers,
    });

    const [fromBranchId, setFromBranchId] = useState<number | ''>(isOwner ? '' : (userBranchId ?? ''));
    const [toBranchId, setToBranchId] = useState<number | ''>('');
    const [notes, setNotes] = useState('');
    const [items, setItems] = useState<TransferItem[]>([]);
    const [variantQuery, setVariantQuery] = useState('');
    const [error, setError] = useState('');

    const allVariants: Variant[] = useMemo(() => {
        const list: Variant[] = [];
        for (const p of products) {
            for (const v of (p.variants ?? [])) {
                list.push({
                    id: v.id,
                    sku: v.sku,
                    variantName: v.variantName,
                    stock: Number(v.stock ?? 0),
                    product: { id: p.id, name: p.name },
                });
            }
        }
        return list;
    }, [products]);

    const filteredVariants = useMemo(() => {
        const q = variantQuery.trim().toLowerCase();
        if (!q) return [];
        return allVariants
            .filter(v =>
                (v.sku ?? '').toLowerCase().includes(q) ||
                (v.variantName ?? '').toLowerCase().includes(q) ||
                (v.product?.name ?? '').toLowerCase().includes(q),
            )
            .filter(v => !items.some(it => it.productVariantId === v.id))
            .slice(0, 8);
    }, [allVariants, variantQuery, items]);

    function addVariant(v: Variant) {
        setItems(prev => [
            ...prev,
            {
                productVariantId: v.id,
                variantLabel: `${v.product.name}${v.variantName ? ` — ${v.variantName}` : ''} (${v.sku})`,
                quantity: 1,
                availableAtFrom: v.stock, // stok agregat (FIXME: idealnya query BranchStock per cabang asal)
            },
        ]);
        setVariantQuery('');
    }

    function updateQty(variantId: number, qty: number) {
        setItems(prev => prev.map(it => (it.productVariantId === variantId ? { ...it, quantity: qty } : it)));
    }

    function removeItem(variantId: number) {
        setItems(prev => prev.filter(it => it.productVariantId !== variantId));
    }

    const submitMut = useMutation({
        mutationFn: () =>
            axios.post('/stock-transfers', {
                fromBranchId: Number(fromBranchId),
                toBranchId: Number(toBranchId),
                items: items.map(it => ({ productVariantId: it.productVariantId, quantity: it.quantity })),
                notes: notes.trim() || undefined,
            }).then(r => r.data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['stock-transfers'] });
            qc.invalidateQueries({ queryKey: ['products'] });
            setItems([]);
            setNotes('');
            setError('');
            alert('Transfer berhasil dibuat');
        },
        onError: (e: any) => setError(e?.response?.data?.message || 'Gagal membuat transfer'),
    });

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        if (!fromBranchId || !toBranchId) { setError('Pilih cabang asal dan tujuan'); return; }
        if (fromBranchId === toBranchId) { setError('Cabang asal dan tujuan tidak boleh sama'); return; }
        if (items.length === 0) { setError('Tambah minimal satu item'); return; }
        for (const it of items) {
            if (it.quantity <= 0) { setError(`Jumlah harus > 0 untuk ${it.variantLabel}`); return; }
        }
        submitMut.mutate();
    }

    function branchLabel(id: number) {
        const b = branches.find(br => br.id === id);
        return b ? (b.code ? `[${b.code}] ${b.name}` : b.name) : `#${id}`;
    }

    return (
        <div>
            <PageHeader
                title="Transfer Stok Antar Cabang"
                description="Pindahkan stok dari satu cabang ke cabang lain. Sistem otomatis mencatat OUT/IN."
                icon={ArrowRightLeft}
                breadcrumbs={[
                    { label: 'Inventori', href: '/inventory' },
                    { label: 'Transfer Stok' },
                ]}
            />

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
                {/* Form transfer */}
                <form
                    onSubmit={handleSubmit}
                    className="lg:col-span-3 rounded-xl border border-border bg-card p-4 sm:p-5 shadow-sm space-y-4"
                >
                    <h2 className="text-base font-semibold text-foreground">Transfer Baru</h2>

                    {error && (
                        <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-sm text-destructive">
                            {error}
                        </p>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">Dari Cabang *</label>
                            <select
                                value={fromBranchId}
                                onChange={e => setFromBranchId(e.target.value ? Number(e.target.value) : '')}
                                disabled={!isOwner}
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:bg-muted disabled:text-muted-foreground"
                            >
                                <option value="">— Pilih cabang asal —</option>
                                {branches.map(b => (
                                    <option key={b.id} value={b.id}>
                                        {b.code ? `[${b.code}] ` : ''}{b.name}
                                    </option>
                                ))}
                            </select>
                            {!isOwner && (
                                <p className="mt-1 text-[11px] text-muted-foreground">
                                    Staff hanya bisa transfer dari cabangnya sendiri.
                                </p>
                            )}
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">Ke Cabang *</label>
                            <select
                                value={toBranchId}
                                onChange={e => setToBranchId(e.target.value ? Number(e.target.value) : '')}
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                            >
                                <option value="">— Pilih cabang tujuan —</option>
                                {branches.filter(b => b.id !== fromBranchId).map(b => (
                                    <option key={b.id} value={b.id}>
                                        {b.code ? `[${b.code}] ` : ''}{b.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">Catatan (opsional)</label>
                        <input
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder="cth: Pemindahan stok bulanan"
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">Cari produk untuk ditransfer</label>
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input
                                value={variantQuery}
                                onChange={e => setVariantQuery(e.target.value)}
                                placeholder="Ketik nama produk atau SKU..."
                                className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2 text-sm"
                            />
                            {filteredVariants.length > 0 && (
                                <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-72 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg">
                                    {filteredVariants.map(v => (
                                        <button
                                            key={v.id}
                                            type="button"
                                            onClick={() => addVariant(v)}
                                            className="flex w-full items-center justify-between border-b border-border/40 px-3 py-2 text-left transition-colors last:border-0 hover:bg-accent"
                                        >
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-medium text-foreground">{v.product.name}{v.variantName ? ` — ${v.variantName}` : ''}</p>
                                                <p className="text-xs text-muted-foreground">SKU: {v.sku}</p>
                                            </div>
                                            <span className="ml-3 shrink-0 text-xs text-muted-foreground">Stok: {v.stock}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {items.length > 0 && (
                        <ResponsiveTable className="!shadow-none">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/40">
                                    <tr>
                                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Produk</th>
                                        <th className="w-32 px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Jumlah</th>
                                        <th className="w-12 px-3 py-2"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/50">
                                    {items.map(it => (
                                        <tr key={it.productVariantId}>
                                            <td className="px-3 py-2 text-foreground">{it.variantLabel}</td>
                                            <td className="px-3 py-2 text-right">
                                                <input
                                                    type="number"
                                                    min={1}
                                                    step="0.01"
                                                    value={it.quantity}
                                                    onChange={e => updateQty(it.productVariantId, Number(e.target.value))}
                                                    className="w-24 rounded border border-border bg-background px-2 py-1 text-right text-sm"
                                                />
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => removeItem(it.productVariantId)}
                                                    className="rounded p-1 text-destructive hover:bg-destructive/10"
                                                    aria-label="Hapus item"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </ResponsiveTable>
                    )}

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={submitMut.isPending}
                            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-50"
                        >
                            {submitMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                            {submitMut.isPending ? 'Memproses...' : 'Buat Transfer'}
                        </button>
                    </div>
                </form>

                {/* Riwayat */}
                <div className="lg:col-span-2 rounded-xl border border-border bg-card p-4 sm:p-5 shadow-sm">
                    <div className="mb-4 flex items-center gap-2">
                        <History className="h-5 w-5 text-primary" />
                        <h2 className="text-base font-semibold text-foreground">Riwayat Transfer</h2>
                    </div>

                    {loadingHistory ? (
                        <div className="flex justify-center py-10">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                    ) : transfers.length === 0 ? (
                        <EmptyState
                            icon={Package}
                            title="Belum ada transfer"
                            description="Transfer stok yang sudah dilakukan akan muncul di sini."
                        />
                    ) : (
                        <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                            {transfers.map(t => {
                                const fbLabel = t.fromBranch
                                    ? (t.fromBranch.code ? `[${t.fromBranch.code}] ${t.fromBranch.name}` : t.fromBranch.name)
                                    : branchLabel(t.fromBranchId);
                                const tbLabel = t.toBranch
                                    ? (t.toBranch.code ? `[${t.toBranch.code}] ${t.toBranch.name}` : t.toBranch.name)
                                    : branchLabel(t.toBranchId);
                                return (
                                    <div key={t.id} className="rounded-lg border border-border p-3 hover:bg-muted/30 transition-colors">
                                        <div className="mb-2 flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="text-[11px] font-mono text-muted-foreground">{t.transferNumber}</p>
                                                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm">
                                                    <span className="font-medium text-foreground">{fbLabel}</span>
                                                    <ArrowRightLeft className="h-3.5 w-3.5 text-primary" />
                                                    <span className="font-medium text-foreground">{tbLabel}</span>
                                                </div>
                                            </div>
                                            <span className="shrink-0 text-[11px] text-muted-foreground">
                                                {new Date(t.createdAt).toLocaleString('id-ID')}
                                            </span>
                                        </div>
                                        <ul className="space-y-0.5">
                                            {t.items.map(i => (
                                                <li key={i.id} className="text-xs text-muted-foreground">
                                                    • {i.productVariant?.product?.name}
                                                    {i.productVariant?.variantName ? ` — ${i.productVariant.variantName}` : ''}
                                                    : <strong className="text-foreground">{Number(i.quantity)}</strong>
                                                </li>
                                            ))}
                                        </ul>
                                        {t.notes && (
                                            <p className="mt-2 text-[11px] italic text-muted-foreground">"{t.notes}"</p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
