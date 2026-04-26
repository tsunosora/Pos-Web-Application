"use client";

import { useState, useRef, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { editTransaction, submitEditRequest, deleteTransaction, EditItemPayload } from '@/lib/api/transactions';
import { getProducts } from '@/lib/api/products';
import { X, Save, Send, AlertTriangle, Plus, Trash2, Search, PackagePlus, ChevronDown, ChevronUp } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type EditItem = {
    // For existing items
    id?: number;
    // For new items
    newVariantId?: number;
    remove?: boolean;
    // Display
    productName: string;
    variantName: string | null;
    quantity: number;
    pcs: number;                // jumlah cetak (khusus AREA_BASED)
    priceAtTime: number;        // original / base price (per unit or total for area)
    priceOverride: number | null; // custom override (null = tidak dioverride)
    widthCm: number | null;
    heightCm: number | null;
    areaCm2: number | null;
    unitType: string;
    pricingMode: 'UNIT' | 'AREA_BASED';
    isNew?: boolean;
};

type Props = {
    transaction: any;
    isManager: boolean;
    onClose: () => void;
    onSuccess: (updated?: any) => void;
    onDeleted?: () => void;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (val: number) => `Rp ${val.toLocaleString('id-ID')}`;

function calcLineTotal(item: EditItem): number {
    if (item.priceOverride !== null && item.priceOverride > 0) return item.priceOverride;
    if (item.pricingMode === 'AREA_BASED') {
        const w = item.widthCm ?? 0;
        const h = item.heightCm ?? 1;
        const pcs = Math.max(1, item.pcs || 1);
        let mult = 0;
        if (item.unitType === 'm') mult = w * h;
        else if (item.unitType === 'cm') mult = w * h;
        else if (item.unitType === 'menit') mult = w;
        else mult = (w * h) / 10000;
        return mult * item.priceAtTime * pcs;
    }
    return item.priceAtTime * item.quantity;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function EditTransactionModal({ transaction, isManager, onClose, onSuccess, onDeleted }: Props) {
    const queryClient = useQueryClient();

    // State: edit items
    const [editItems, setEditItems] = useState<EditItem[]>(() =>
        (transaction.items || []).map((item: any) => ({
            id: item.id,
            productName: item.productVariant?.product?.name || '',
            variantName: item.productVariant?.variantName || null,
            quantity: item.quantity,
            pcs: Math.max(1, Number(item.pcs) || 1),
            priceAtTime: Number(item.priceAtTime),
            priceOverride: null,
            widthCm: item.widthCm !== null ? Number(item.widthCm) : null,
            heightCm: item.heightCm !== null ? Number(item.heightCm) : null,
            areaCm2: item.areaCm2 !== null ? Number(item.areaCm2) : null,
            unitType: item.unitType || 'm',
            pricingMode: item.widthCm !== null ? 'AREA_BASED' : 'UNIT',
            remove: false,
            isNew: false,
        }))
    );

    const [discount, setDiscount] = useState<number>(Number(transaction.discount) || 0);
    const [customerName, setCustomerName] = useState<string>(transaction.customerName || '');
    const [customerPhone, setCustomerPhone] = useState<string>(transaction.customerPhone || '');
    const [customerAddress, setCustomerAddress] = useState<string>(transaction.customerAddress || '');
    const [reason, setReason] = useState('');

    // Product picker
    const [showPicker, setShowPicker] = useState(false);
    const [search, setSearch] = useState('');
    const searchRef = useRef<HTMLInputElement>(null);

    // Delete confirmation
    const [deleteConfirm, setDeleteConfirm] = useState<'idle' | 'confirm'>('idle');

    // Summary panel collapse
    const [summaryOpen, setSummaryOpen] = useState(true);

    // ── Fetch products for picker ───────────────────────────────────────────
    const { data: products = [] } = useQuery({
        queryKey: ['products-for-picker'],
        queryFn: () => getProducts(),
        enabled: showPicker,
        staleTime: 30_000,
    });

    const filtered = search.trim()
        ? products.filter((p: any) =>
            p.name.toLowerCase().includes(search.toLowerCase()) ||
            p.variants?.some((v: any) => v.sku?.toLowerCase().includes(search.toLowerCase()))
        )
        : products;

    useEffect(() => {
        if (showPicker) setTimeout(() => searchRef.current?.focus(), 100);
    }, [showPicker]);

    // ── Build payload ───────────────────────────────────────────────────────
    const buildPayload = (): EditItemPayload[] =>
        editItems
            .filter((item) => !(!item.id && !item.newVariantId)) // skip invalid
            .map((item) => {
                if (item.remove && item.id) {
                    return { id: item.id, remove: true };
                }
                if (item.isNew && item.newVariantId) {
                    const base: EditItemPayload = {
                        newVariantId: item.newVariantId,
                        ...(item.pricingMode === 'AREA_BASED'
                            ? { widthCm: item.widthCm ?? 1, heightCm: item.heightCm ?? 1, unitType: item.unitType, pcs: Math.max(1, item.pcs || 1) }
                            : { quantity: item.quantity }),
                    };
                    if (item.priceOverride !== null && item.priceOverride > 0) base.priceOverride = item.priceOverride;
                    return base;
                }
                // Existing item edit
                const base: EditItemPayload = {
                    id: item.id,
                    ...(item.pricingMode === 'AREA_BASED'
                        ? { widthCm: item.widthCm ?? 0, heightCm: item.heightCm ?? 1, unitType: item.unitType, pcs: Math.max(1, item.pcs || 1) }
                        : { quantity: item.quantity }),
                };
                if (item.priceOverride !== null && item.priceOverride > 0) base.priceOverride = item.priceOverride;
                return base;
            });

    // ── Mutations ───────────────────────────────────────────────────────────
    const directEditMutation = useMutation({
        mutationFn: () => editTransaction(transaction.id, { items: buildPayload(), discount, customerName, customerPhone, customerAddress }),
        onSuccess: (updated) => {
            queryClient.invalidateQueries({ queryKey: ['transactions'] });
            queryClient.invalidateQueries({ queryKey: ['salesSummary'] });
            // Stok & pergerakan stok bisa berubah karena edit (remove/add/ubah qty item).
            queryClient.invalidateQueries({ queryKey: ['products'] });
            queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
            queryClient.invalidateQueries({ queryKey: ['branch-stocks'] });
            queryClient.invalidateQueries({ queryKey: ['production-jobs'] });
            queryClient.invalidateQueries({ queryKey: ['print-queue'] });
            onSuccess(updated);
        },
    });

    const requestEditMutation = useMutation({
        mutationFn: () => submitEditRequest(transaction.id, { items: buildPayload(), discount, customerName, customerPhone, customerAddress, reason }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['transaction-edit-requests'] });
            onSuccess();
        },
    });

    const deleteMutation = useMutation({
        mutationFn: () => deleteTransaction(transaction.id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['transactions'] });
            queryClient.invalidateQueries({ queryKey: ['salesSummary'] });
            // Stok bahan dikembalikan di backend — refresh daftar produk, history stok, cashflow, dan antrian.
            queryClient.invalidateQueries({ queryKey: ['products'] });
            queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
            queryClient.invalidateQueries({ queryKey: ['branch-stocks'] });
            queryClient.invalidateQueries({ queryKey: ['cashflow'] });
            queryClient.invalidateQueries({ queryKey: ['production-jobs'] });
            queryClient.invalidateQueries({ queryKey: ['print-queue'] });
            onDeleted?.();
            onClose();
        },
    });

    const isSubmitting = directEditMutation.isPending || requestEditMutation.isPending;
    const error = directEditMutation.error || requestEditMutation.error || deleteMutation.error;
    // Transaksi PENDING = draft invoice, siapa saja boleh edit langsung
    const isPendingTx = transaction?.status === 'PENDING';
    const canDirectEdit = isManager || isPendingTx;

    const handleSubmit = () => {
        if (!canDirectEdit && !reason.trim()) {
            alert('Harap isi alasan permintaan edit');
            return;
        }
        if (canDirectEdit) directEditMutation.mutate();
        else requestEditMutation.mutate();
    };

    // ── Item update helpers ─────────────────────────────────────────────────
    const updateItem = (idx: number, field: keyof EditItem, value: any) =>
        setEditItems((prev) => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));

    const removeItem = (idx: number) => {
        const item = editItems[idx];
        if (item.isNew) {
            setEditItems((prev) => prev.filter((_, i) => i !== idx));
        } else {
            updateItem(idx, 'remove', !editItems[idx].remove);
        }
    };

    // ── Add product from picker ─────────────────────────────────────────────
    const addVariant = (product: any, variant: any) => {
        const isAreaBased = product.pricingMode === 'AREA_BASED';
        const newItem: EditItem = {
            newVariantId: variant.id,
            productName: product.name,
            variantName: variant.variantName || null,
            quantity: 1,
            pcs: 1,
            priceAtTime: Number(variant.price),
            priceOverride: null,
            widthCm: isAreaBased ? 1 : null,
            heightCm: isAreaBased ? 1 : null,
            areaCm2: null,
            unitType: 'm',
            pricingMode: isAreaBased ? 'AREA_BASED' : 'UNIT',
            isNew: true,
        };
        setEditItems((prev) => [...prev, newItem]);
        setShowPicker(false);
        setSearch('');
    };

    // ── Totals ──────────────────────────────────────────────────────────────
    const activeItems = editItems.filter((i) => !i.remove);
    const subtotal = activeItems.reduce((sum, item) => sum + calcLineTotal(item), 0);
    const grandTotal = Math.max(0, subtotal - discount);

    // ── Render ──────────────────────────────────────────────────────────────
    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-background border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
                    <div>
                        <h2 className="text-base font-semibold text-foreground">
                            {isManager ? 'Edit Transaksi' : 'Ajukan Perubahan Transaksi'}
                        </h2>
                        <p className="text-xs text-muted-foreground mt-0.5">{transaction.invoiceNumber}</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

                    {/* ── Items List ───────────────────────────────────────── */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Item Pesanan</h3>
                            <button
                                onClick={() => setShowPicker(true)}
                                className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors px-2 py-1.5 rounded-lg hover:bg-primary/10"
                            >
                                <Plus className="w-3.5 h-3.5" /> Tambah Produk
                            </button>
                        </div>

                        <div className="space-y-2">
                            {editItems.map((item, idx) => (
                                <div
                                    key={item.id ?? `new-${idx}`}
                                    className={`p-3 rounded-xl border transition-all ${item.remove
                                        ? 'opacity-40 bg-red-500/5 border-red-500/30 line-through'
                                        : item.isNew
                                            ? 'bg-emerald-500/5 border-emerald-500/30'
                                            : 'bg-muted/40 border-border'
                                        }`}
                                >
                                    {/* Item header */}
                                    <div className="flex items-start justify-between gap-2 mb-2.5">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-foreground truncate">
                                                {item.isNew && <span className="text-[10px] font-bold text-emerald-600 uppercase mr-1.5 bg-emerald-500/10 px-1.5 py-0.5 rounded">Baru</span>}
                                                {item.productName}{item.variantName ? ` — ${item.variantName}` : ''}
                                            </p>
                                            <p className="text-[11px] text-muted-foreground mt-0.5">
                                                Harga dasar: {fmt(item.priceAtTime)}{item.pricingMode === 'AREA_BASED' ? ' / unit area' : ' / pcs'}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => removeItem(idx)}
                                            title={item.remove ? 'Batalkan hapus' : 'Hapus item'}
                                            className={`p-1.5 rounded-lg transition-colors shrink-0 ${item.remove ? 'text-muted-foreground hover:bg-muted' : 'text-red-500 hover:bg-red-500/10'}`}
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>

                                    {!item.remove && (
                                        <div className="space-y-2">
                                            {/* Qty / dimensions */}
                                            {item.pricingMode === 'AREA_BASED' ? (
                                                <div className="space-y-2">
                                                    <div className="grid grid-cols-3 gap-2">
                                                        <div>
                                                            <label className="text-[10px] text-muted-foreground font-medium uppercase">Lebar</label>
                                                            <input type="number" min="0.01" step="0.01"
                                                                value={item.widthCm ?? ''}
                                                                onChange={(e) => updateItem(idx, 'widthCm', parseFloat(e.target.value) || 0)}
                                                                className="mt-1 w-full px-2 py-1.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] text-muted-foreground font-medium uppercase">Tinggi</label>
                                                            <input type="number" min="0.01" step="0.01"
                                                                value={item.heightCm ?? ''}
                                                                onChange={(e) => updateItem(idx, 'heightCm', parseFloat(e.target.value) || 0)}
                                                                className="mt-1 w-full px-2 py-1.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] text-muted-foreground font-medium uppercase">Satuan</label>
                                                            <select value={item.unitType}
                                                                onChange={(e) => updateItem(idx, 'unitType', e.target.value)}
                                                                className="mt-1 w-full px-2 py-1.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                                                            >
                                                                <option value="m">m</option>
                                                                <option value="cm">cm</option>
                                                                <option value="menit">menit</option>
                                                            </select>
                                                        </div>
                                                    </div>
                                                    {/* Jumlah / Pcs */}
                                                    <div className="flex items-center gap-3">
                                                        <label className="text-[10px] text-muted-foreground font-medium uppercase shrink-0">Jumlah (Pcs):</label>
                                                        <input type="number" min="1" step="1"
                                                            value={item.pcs}
                                                            onChange={(e) => updateItem(idx, 'pcs', Math.max(1, parseInt(e.target.value) || 1))}
                                                            className="w-20 px-2 py-1.5 bg-background border border-border rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30"
                                                        />
                                                        {item.pcs > 1 && (
                                                            <span className="text-[11px] text-muted-foreground">
                                                                × {item.pcs} pcs
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-3">
                                                    <label className="text-xs text-muted-foreground shrink-0">Jumlah:</label>
                                                    <input type="number" min="1"
                                                        value={item.quantity}
                                                        onChange={(e) => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                                                        className="w-24 px-2 py-1.5 bg-background border border-border rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30"
                                                    />
                                                </div>
                                            )}

                                            {/* Price override */}
                                            <div className="flex items-center gap-2 pt-1 border-t border-border/50">
                                                <label className="text-[10px] text-muted-foreground font-medium uppercase shrink-0 w-24">Harga Custom:</label>
                                                <div className="flex-1 relative">
                                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Rp</span>
                                                    <input
                                                        type="number" min="0" placeholder="Biarkan kosong = harga normal"
                                                        value={item.priceOverride ?? ''}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            updateItem(idx, 'priceOverride', val === '' ? null : Number(val));
                                                        }}
                                                        className="w-full pl-7 pr-2 py-1.5 bg-background border border-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
                                                    />
                                                </div>
                                                <span className="text-xs font-semibold text-foreground shrink-0 min-w-[80px] text-right">
                                                    = {fmt(calcLineTotal(item))}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}

                            {editItems.length === 0 && (
                                <div className="text-center py-6 text-sm text-muted-foreground">
                                    Belum ada item. Klik &quot;Tambah Produk&quot; untuk menambahkan.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Summary ──────────────────────────────────────────── */}
                    <div className="rounded-xl border border-border overflow-hidden">
                        <button
                            onClick={() => setSummaryOpen((o) => !o)}
                            className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                        >
                            <span>Ringkasan & Info Pelanggan</span>
                            {summaryOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                        {summaryOpen && (
                            <div className="p-4 space-y-4">
                                {/* Subtotal preview */}
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-muted-foreground">Subtotal</span>
                                    <span className="font-medium">{fmt(subtotal)}</span>
                                </div>

                                {/* Discount */}
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Diskon (Rp)</label>
                                    <input type="number" min="0"
                                        value={discount}
                                        onChange={(e) => setDiscount(parseInt(e.target.value) || 0)}
                                        className="mt-1.5 w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                                    />
                                </div>

                                {/* Grand Total */}
                                <div className="flex justify-between items-center pt-1 border-t border-border text-sm font-semibold">
                                    <span>Total (setelah diskon)</span>
                                    <span className="text-primary">{fmt(grandTotal)}</span>
                                </div>

                                {/* Customer */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs text-muted-foreground">Nama Pelanggan</label>
                                        <input type="text" value={customerName}
                                            onChange={(e) => setCustomerName(e.target.value)}
                                            className="mt-1 w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-muted-foreground">No. HP</label>
                                        <input type="text" value={customerPhone}
                                            onChange={(e) => setCustomerPhone(e.target.value)}
                                            className="mt-1 w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs text-muted-foreground">Alamat</label>
                                    <textarea value={customerAddress}
                                        onChange={(e) => setCustomerAddress(e.target.value)}
                                        rows={2}
                                        className="mt-1 w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── Reason ──────────────────────────────────────────── */}
                    {!canDirectEdit && (
                        <div>
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Alasan Permintaan <span className="text-red-500">*</span>
                            </label>
                            <textarea value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                rows={2}
                                placeholder="Contoh: Salah input jumlah orderan, seharusnya 3 bukan 5"
                                className="mt-1.5 w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                            />
                        </div>
                    )}

                    {canDirectEdit && (
                        <div>
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Catatan Edit (opsional)
                            </label>
                            <textarea value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                rows={2}
                                placeholder="Alasan atau catatan perubahan..."
                                className="mt-1.5 w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                            />
                        </div>
                    )}

                    {/* Alert for cashier editing non-pending */}
                    {!canDirectEdit && (
                        <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-700">
                            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                            <span>Perubahan akan dikirim ke Admin/Owner untuk disetujui terlebih dahulu.</span>
                        </div>
                    )}

                    {/* Info for cashier editing pending invoice */}
                    {isPendingTx && !isManager && (
                        <div className="flex items-start gap-2 p-3 bg-sky-500/10 border border-sky-500/20 rounded-lg text-xs text-sky-700">
                            <span>Invoice Bayar Nanti dapat diedit langsung. Perubahan tersimpan tanpa persetujuan.</span>
                        </div>
                    )}

                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-600">
                            {(error as any)?.response?.data?.message || 'Terjadi kesalahan. Coba lagi.'}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-4 py-3 border-t border-border bg-muted/20 flex justify-between items-center gap-3 shrink-0">
                    {/* Delete (manager only) */}
                    {isManager && (
                        deleteConfirm === 'idle' ? (
                            <button
                                onClick={() => setDeleteConfirm('confirm')}
                                className="flex items-center gap-1.5 px-3 py-2 text-red-500 hover:bg-red-500/10 rounded-lg text-xs font-medium transition-colors border border-red-500/30 hover:border-red-500/60"
                            >
                                <Trash2 className="w-3.5 h-3.5" /> Hapus Transaksi
                            </button>
                        ) : (
                            <div className="flex flex-col gap-1.5 max-w-md">
                                <div className="text-xs text-red-600 font-semibold leading-snug">
                                    Yakin hapus transaksi <span className="font-mono">{transaction?.invoiceNumber}</span>?
                                </div>
                                <div className="text-[11px] text-muted-foreground leading-snug">
                                    Stok bahan yang dipotong dari transaksi ini akan <strong>otomatis dikembalikan</strong> ke gudang cabang.
                                    Cashflow (pendapatan / diskon) terkait juga akan dihapus. Tindakan ini tidak bisa dibatalkan.
                                </div>
                                <div className="flex items-center gap-2 pt-0.5">
                                    <button
                                        onClick={() => deleteMutation.mutate()}
                                        disabled={deleteMutation.isPending}
                                        className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
                                    >
                                        {deleteMutation.isPending ? 'Menghapus & Mengembalikan Stok...' : 'Ya, Hapus & Kembalikan Stok'}
                                    </button>
                                    <button
                                        onClick={() => setDeleteConfirm('idle')}
                                        className="px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-muted transition-colors"
                                    >
                                        Batal
                                    </button>
                                </div>
                            </div>
                        )
                    )}

                    <div className="flex items-center gap-2 ml-auto">
                        <button onClick={onClose} className="px-4 py-2 bg-background border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors">
                            Batal
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                        >
                            {canDirectEdit ? <Save className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                            {isSubmitting ? 'Memproses...' : canDirectEdit ? 'Simpan Perubahan' : 'Ajukan Perubahan'}
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Product Picker Modal ──────────────────────────────────────── */}
            {showPicker && (
                <div className="absolute inset-0 z-10 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40" onClick={() => { setShowPicker(false); setSearch(''); }} />
                    <div className="relative bg-background border border-border rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[70vh]">
                        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
                            <PackagePlus className="w-4 h-4 text-primary shrink-0" />
                            <div className="flex-1 relative">
                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                                <input
                                    ref={searchRef}
                                    type="text"
                                    placeholder="Cari produk atau SKU..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="w-full pl-7 pr-3 py-1.5 bg-muted/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                                />
                            </div>
                            <button onClick={() => { setShowPicker(false); setSearch(''); }} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-2">
                            {filtered.length === 0 ? (
                                <p className="text-center py-8 text-sm text-muted-foreground">Produk tidak ditemukan</p>
                            ) : (
                                filtered.map((product: any) => (
                                    <div key={product.id} className="mb-1">
                                        {(product.variants || []).map((variant: any) => (
                                            <button
                                                key={variant.id}
                                                onClick={() => addVariant(product, variant)}
                                                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-muted transition-colors text-left"
                                            >
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium text-foreground truncate">
                                                        {product.name}
                                                        {variant.variantName ? ` — ${variant.variantName}` : ''}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {variant.sku} · {fmt(Number(variant.price))}
                                                        {product.pricingMode === 'AREA_BASED' ? '/m²' : '/pcs'}
                                                    </p>
                                                </div>
                                                <Plus className="w-4 h-4 text-primary shrink-0 ml-2" />
                                            </button>
                                        ))}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
