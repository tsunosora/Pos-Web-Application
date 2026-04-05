"use client";

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Search, Plus, Trash2, ShoppingCart, ChevronDown, Package } from 'lucide-react';
import { getProducts, getSuppliers, createStockPurchase } from '@/lib/api';

interface CartItem {
    variantId: number;
    sku: string;
    productName: string;
    variantName: string | null;
    currentStock: number;
    quantity: string;
    unitPrice: string;
}

interface Props {
    onClose: () => void;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function PurchaseModal({ onClose }: Props) {
    const queryClient = useQueryClient();

    const [supplierId, setSupplierId] = useState<string>('');
    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [notes, setNotes] = useState('');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [search, setSearch] = useState('');
    const [showPicker, setShowPicker] = useState(false);

    const { data: productsRaw } = useQuery({ queryKey: ['products'], queryFn: getProducts });
    const { data: suppliersRaw } = useQuery({ queryKey: ['suppliers'], queryFn: getSuppliers });

    const products: any[] = productsRaw ?? [];
    const suppliers: any[] = suppliersRaw ?? [];

    // Flatten semua varian yang trackStock
    const allVariants = useMemo(() => {
        const result: any[] = [];
        for (const p of products) {
            if (p.trackStock === false) continue;
            for (const v of (p.variants ?? [])) {
                result.push({ ...v, product: p });
            }
        }
        return result;
    }, [products]);

    const filteredVariants = useMemo(() => {
        const q = search.toLowerCase();
        if (!q) return allVariants.slice(0, 40);
        return allVariants.filter(v =>
            v.sku?.toLowerCase().includes(q) ||
            v.product?.name?.toLowerCase().includes(q) ||
            v.variantName?.toLowerCase().includes(q)
        ).slice(0, 40);
    }, [allVariants, search]);

    // Cari harga beli dari SupplierItem jika supplier dipilih
    const getSupplierPrice = (variantId: number): string => {
        if (!supplierId) return '';
        const sup = suppliers.find((s: any) => s.id === Number(supplierId));
        if (!sup) return '';
        const item = (sup.items ?? []).find((i: any) => i.productVariantId === variantId);
        return item ? String(Number(item.purchasePrice)) : '';
    };

    const addToCart = (variant: any) => {
        if (cart.some(c => c.variantId === variant.id)) return;
        setCart(prev => [...prev, {
            variantId: variant.id,
            sku: variant.sku,
            productName: variant.product.name,
            variantName: variant.variantName,
            currentStock: variant.stock,
            quantity: '1',
            unitPrice: getSupplierPrice(variant.id),
        }]);
        setSearch('');
        setShowPicker(false);
    };

    const updateCart = (variantId: number, field: 'quantity' | 'unitPrice', value: string) => {
        setCart(prev => prev.map(c => c.variantId === variantId ? { ...c, [field]: value } : c));
    };

    const removeFromCart = (variantId: number) => {
        setCart(prev => prev.filter(c => c.variantId !== variantId));
    };

    const mutation = useMutation({
        mutationFn: createStockPurchase,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
            onClose();
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (cart.length === 0) return;
        const validItems = cart.filter(c => Number(c.quantity) > 0);
        if (validItems.length === 0) return;
        mutation.mutate({
            invoiceNumber: invoiceNumber.trim() || undefined,
            supplierId: supplierId ? Number(supplierId) : undefined,
            notes: notes.trim() || undefined,
            items: validItems.map(c => ({
                productVariantId: c.variantId,
                quantity: Math.round(Number(c.quantity)),
                unitPrice: c.unitPrice ? Number(c.unitPrice) : undefined,
            })),
        });
    };

    const totalNilai = cart.reduce((sum, c) => {
        const qty = Number(c.quantity) || 0;
        const price = Number(c.unitPrice) || 0;
        return sum + qty * price;
    }, 0);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-card rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
                    <div>
                        <h2 className="text-base font-semibold text-foreground">Pembelian Bahan Baku</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">Catat pembelian stok masuk dari supplier</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                        <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                    <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
                        {/* Info Pembelian */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* Supplier */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Supplier <span className="normal-case font-normal">(opsional)</span></label>
                                <div className="relative">
                                    <select
                                        value={supplierId}
                                        onChange={e => setSupplierId(e.target.value)}
                                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary appearance-none pr-8"
                                    >
                                        <option value="">— Pilih Supplier —</option>
                                        {suppliers.map((s: any) => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                                </div>
                            </div>
                            {/* No Invoice */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">No. Invoice <span className="normal-case font-normal">(opsional)</span></label>
                                <input
                                    type="text"
                                    value={invoiceNumber}
                                    onChange={e => setInvoiceNumber(e.target.value)}
                                    placeholder="Contoh: INV/2026/001"
                                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary"
                                />
                            </div>
                            {/* Catatan */}
                            <div className="space-y-1.5 sm:col-span-2">
                                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Catatan <span className="normal-case font-normal">(opsional)</span></label>
                                <input
                                    type="text"
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    placeholder="Misal: Pembelian bulanan bahan laminasi"
                                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary"
                                />
                            </div>
                        </div>

                        {/* Tambah Item ke Keranjang */}
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tambah Bahan / Produk ke Keranjang</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={e => { setSearch(e.target.value); setShowPicker(true); }}
                                    onFocus={() => setShowPicker(true)}
                                    placeholder="Cari nama produk atau SKU..."
                                    className="w-full pl-8 pr-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary"
                                />
                                {showPicker && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-xl z-20 max-h-52 overflow-y-auto">
                                        {filteredVariants.length === 0 ? (
                                            <div className="px-4 py-3 text-sm text-muted-foreground">Tidak ada produk ditemukan</div>
                                        ) : filteredVariants.map(v => {
                                            const inCart = cart.some(c => c.variantId === v.id);
                                            return (
                                                <button
                                                    key={v.id}
                                                    type="button"
                                                    disabled={inCart}
                                                    onClick={() => addToCart(v)}
                                                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${inCart ? 'opacity-40 cursor-not-allowed' : 'hover:bg-muted'}`}
                                                >
                                                    <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-foreground truncate">{v.product.name}{v.variantName ? ` — ${v.variantName}` : ''}</p>
                                                        <p className="text-xs text-muted-foreground">{v.sku} · Stok: {v.stock}</p>
                                                    </div>
                                                    {inCart && <span className="text-xs text-primary shrink-0">Sudah ada</span>}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Keranjang */}
                        {cart.length > 0 && (
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <ShoppingCart className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Keranjang ({cart.length} item)</span>
                                </div>
                                <div className="border border-border rounded-xl overflow-hidden">
                                    {/* Header */}
                                    <div className="grid grid-cols-[1fr_100px_120px_32px] gap-2 px-3 py-2 bg-muted/50 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                                        <span>Produk</span>
                                        <span className="text-right">Jumlah</span>
                                        <span className="text-right">Harga Beli/Unit</span>
                                        <span />
                                    </div>
                                    {/* Items */}
                                    {cart.map((c, idx) => (
                                        <div
                                            key={c.variantId}
                                            className={`grid grid-cols-[1fr_100px_120px_32px] gap-2 px-3 py-2.5 items-center ${idx > 0 ? 'border-t border-border/50' : ''}`}
                                        >
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-foreground truncate">{c.productName}{c.variantName ? ` — ${c.variantName}` : ''}</p>
                                                <p className="text-xs text-muted-foreground">{c.sku} · Stok saat ini: {c.currentStock}</p>
                                            </div>
                                            <input
                                                type="number"
                                                min="1"
                                                value={c.quantity}
                                                onChange={e => updateCart(c.variantId, 'quantity', e.target.value)}
                                                className="w-full px-2 py-1.5 bg-background border border-border rounded-lg text-sm text-right outline-none focus:border-primary"
                                            />
                                            <input
                                                type="number"
                                                min="0"
                                                value={c.unitPrice}
                                                onChange={e => updateCart(c.variantId, 'unitPrice', e.target.value)}
                                                placeholder="—"
                                                className="w-full px-2 py-1.5 bg-background border border-border rounded-lg text-sm text-right outline-none focus:border-primary"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removeFromCart(c.variantId)}
                                                className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                    {/* Total */}
                                    {totalNilai > 0 && (
                                        <div className="px-3 py-2 border-t border-border bg-muted/30 flex justify-between items-center">
                                            <span className="text-xs text-muted-foreground">Total Nilai Pembelian</span>
                                            <span className="text-sm font-semibold text-foreground">Rp {totalNilai.toLocaleString('id-ID')}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {cart.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-8 border border-dashed border-border rounded-xl text-muted-foreground">
                                <ShoppingCart className="h-8 w-8 mb-2 opacity-30" />
                                <p className="text-sm">Keranjang kosong</p>
                                <p className="text-xs mt-0.5">Cari dan tambahkan bahan/produk di atas</p>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-5 py-4 border-t border-border shrink-0 flex items-center justify-between gap-3">
                        <span className="text-xs text-muted-foreground">
                            {cart.length > 0 ? `${cart.length} item · stok akan bertambah setelah simpan` : 'Belum ada item'}
                        </span>
                        <div className="flex gap-2">
                            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors">
                                Batal
                            </button>
                            <button
                                type="submit"
                                disabled={cart.length === 0 || mutation.isPending}
                                className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                            >
                                {mutation.isPending ? 'Menyimpan...' : 'Simpan Pembelian'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
