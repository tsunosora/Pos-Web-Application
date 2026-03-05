"use client";

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getProducts, logStockMovement, deleteProduct } from '@/lib/api';
import { Search, Plus, Package, RefreshCw, X, Image as ImageIcon, Pencil, Trash2, ChevronDown, Filter } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function InventoryPage() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const { data: products, isLoading, error } = useQuery({
        queryKey: ['products'],
        queryFn: getProducts
    });

    // Movement modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedVariant, setSelectedVariant] = useState<any>(null);
    const [movementForm, setMovementForm] = useState({ type: 'IN', quantity: '', reason: '' });

    // Delete confirm
    const [deletingProductId, setDeletingProductId] = useState<number | null>(null);

    // Filters
    const [searchText, setSearchText] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [filterSkuVariant, setFilterSkuVariant] = useState('');
    const [filterMinPrice, setFilterMinPrice] = useState('');
    const [filterMaxPrice, setFilterMaxPrice] = useState('');
    const [filterMinStock, setFilterMinStock] = useState('');

    const movementMutation = useMutation({
        mutationFn: logStockMovement,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
            setIsModalOpen(false);
            setMovementForm({ type: 'IN', quantity: '', reason: '' });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id: number) => deleteProduct(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
            setDeletingProductId(null);
        }
    });

    const openMovementModal = (variant: any) => {
        setSelectedVariant(variant);
        setIsModalOpen(true);
    };

    const handleMovementSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedVariant) return;
        movementMutation.mutate({
            productVariantId: selectedVariant.id,
            type: movementForm.type as 'IN' | 'OUT' | 'ADJUST',
            quantity: Number(movementForm.quantity),
            reason: movementForm.reason
        });
    };

    // Unique categories for filter dropdown
    const categoryOptions = useMemo(() => {
        if (!products) return [];
        const cats = products.map((p: any) => p.category?.name).filter(Boolean);
        return [...new Set(cats)] as string[];
    }, [products]);

    // Filtered rows (flat list of variant rows with product info embedded)
    const rows = useMemo(() => {
        if (!products) return [];
        const allRows: any[] = [];
        products.forEach((product: any) => {
            product.variants.forEach((v: any, index: number) => {
                allRows.push({ product, variant: v, isFirst: index === 0 });
            });
        });

        return allRows.filter(({ product, variant }) => {
            const lowerSearch = searchText.toLowerCase();
            if (lowerSearch) {
                const inName = product.name.toLowerCase().includes(lowerSearch);
                const inSku = variant.sku.toLowerCase().includes(lowerSearch);
                const inVariantName = (variant.variantName || '').toLowerCase().includes(lowerSearch);
                if (!inName && !inSku && !inVariantName) return false;
            }
            if (filterSkuVariant && !variant.sku.toLowerCase().includes(filterSkuVariant.toLowerCase())
                && !(variant.variantName || '').toLowerCase().includes(filterSkuVariant.toLowerCase())) return false;
            if (filterCategory && product.category?.name !== filterCategory) return false;
            const price = Number(variant.price);
            if (filterMinPrice && price < Number(filterMinPrice)) return false;
            if (filterMaxPrice && price > Number(filterMaxPrice)) return false;
            if (filterMinStock && variant.stock < Number(filterMinStock)) return false;
            return true;
        });
    }, [products, searchText, filterSkuVariant, filterCategory, filterMinPrice, filterMaxPrice, filterMinStock]);

    const hasActiveFilters = filterCategory || filterSkuVariant || filterMinPrice || filterMaxPrice || filterMinStock;

    const clearFilters = () => {
        setFilterCategory('');
        setFilterSkuVariant('');
        setFilterMinPrice('');
        setFilterMaxPrice('');
        setFilterMinStock('');
        setSearchText('');
    };

    return (
        <div className="space-y-6">
            <div className="sm:flex sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Manajemen Stok & Produk</h1>
                    <p className="mt-1 text-sm text-muted-foreground">Kelola inventori, tambah produk, dan multi-varian.</p>
                </div>
                <div className="mt-4 sm:mt-0 flex gap-2 flex-wrap">
                    <Link href="/inventory/categories" className="flex items-center gap-2 bg-muted text-foreground px-4 py-2 rounded-lg font-medium hover:bg-muted/80 transition-colors border border-border text-sm">
                        Kategori
                    </Link>
                    <Link href="/inventory/units" className="flex items-center gap-2 bg-muted text-foreground px-4 py-2 rounded-lg font-medium hover:bg-muted/80 transition-colors border border-border text-sm">
                        Unit
                    </Link>
                    <Link href="/inventory/products/new" className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors shadow-sm text-sm">
                        <Plus className="h-4 w-4" /> Tambah Produk
                    </Link>
                </div>
            </div>

            <div className="glass rounded-xl shadow-sm border border-border overflow-hidden">
                {/* Search & Filter Bar */}
                <div className="p-4 border-b border-border bg-card/50 space-y-3">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1 min-w-0">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input
                                type="text"
                                value={searchText}
                                onChange={e => setSearchText(e.target.value)}
                                placeholder="Cari nama produk, SKU, atau nama varian..."
                                className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-sm text-foreground placeholder:text-muted-foreground"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="text-xs text-muted-foreground font-medium hidden sm:block">Filter:</span>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                        {/* SKU/Varian filter */}
                        <div className="relative">
                            <input
                                type="text"
                                value={filterSkuVariant}
                                onChange={e => setFilterSkuVariant(e.target.value)}
                                placeholder="SKU / Varian"
                                className="px-3 py-1.5 bg-background border border-border rounded-lg text-xs outline-none focus:border-primary w-36"
                            />
                        </div>

                        {/* Category filter */}
                        <div className="relative">
                            <select
                                value={filterCategory}
                                onChange={e => setFilterCategory(e.target.value)}
                                className="pl-3 pr-7 py-1.5 bg-background border border-border rounded-lg text-xs outline-none focus:border-primary appearance-none cursor-pointer w-36"
                            >
                                <option value="">Semua Kategori</option>
                                {categoryOptions.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
                        </div>

                        {/* Price range */}
                        <div className="flex items-center gap-1">
                            <input
                                type="number"
                                value={filterMinPrice}
                                onChange={e => setFilterMinPrice(e.target.value)}
                                placeholder="Harga min"
                                className="px-3 py-1.5 bg-background border border-border rounded-lg text-xs outline-none focus:border-primary w-28"
                            />
                            <span className="text-xs text-muted-foreground">–</span>
                            <input
                                type="number"
                                value={filterMaxPrice}
                                onChange={e => setFilterMaxPrice(e.target.value)}
                                placeholder="Harga max"
                                className="px-3 py-1.5 bg-background border border-border rounded-lg text-xs outline-none focus:border-primary w-28"
                            />
                        </div>

                        {/* Stock min filter */}
                        <div className="relative">
                            <input
                                type="number"
                                value={filterMinStock}
                                onChange={e => setFilterMinStock(e.target.value)}
                                placeholder="Stok min"
                                className="px-3 py-1.5 bg-background border border-border rounded-lg text-xs outline-none focus:border-primary w-24"
                            />
                        </div>

                        {hasActiveFilters && (
                            <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border border-border px-2.5 py-1.5 rounded-lg hover:bg-muted transition-colors">
                                <X className="h-3 w-3" /> Reset
                            </button>
                        )}

                        <span className="ml-auto text-xs text-muted-foreground">
                            {rows.length} baris
                        </span>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-border">
                        <thead className="bg-muted/50">
                            <tr>
                                <th scope="col" className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">SKU / Varian</th>
                                <th scope="col" className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Nama Produk</th>
                                <th scope="col" className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Kategori</th>
                                <th scope="col" className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Harga Jual</th>
                                <th scope="col" className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Sisa Stok</th>
                                <th scope="col" className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="bg-card divide-y divide-border/50">
                            {isLoading ? (
                                <tr><td colSpan={6} className="px-5 py-8 text-center text-muted-foreground">Memuat data produk...</td></tr>
                            ) : error ? (
                                <tr><td colSpan={6} className="px-5 py-8 text-center text-destructive">Gagal memuat produk.</td></tr>
                            ) : rows.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">
                                        <Package className="h-8 w-8 mx-auto mb-2 opacity-20" />
                                        {searchText || hasActiveFilters ? 'Tidak ada produk yang cocok dengan filter.' : 'Belum ada produk. Silakan tambah produk baru.'}
                                    </td>
                                </tr>
                            ) : (
                                rows.map(({ product, variant, isFirst }) => {
                                    // Get avatar image: prefer variant image, then product first image
                                    const productImages = product.imageUrls ? (() => { try { return JSON.parse(product.imageUrls); } catch { return []; } })() : [];
                                    const avatarSrc = variant.variantImageUrl || productImages[0] || product.imageUrl;

                                    return (
                                        <tr key={variant.id} className="hover:bg-muted/30 transition-colors group">
                                            <td className="px-5 py-4 whitespace-nowrap">
                                                <div className="text-sm font-medium text-foreground">{variant.sku}</div>
                                                {variant.variantName && (
                                                    <div className="text-xs text-muted-foreground mt-0.5">{variant.variantName}</div>
                                                )}
                                                <div className="flex gap-1 mt-0.5">
                                                    {variant.size && <span className="text-xs text-muted-foreground border border-border rounded px-1">{variant.size}</span>}
                                                    {variant.color && <span className="text-xs text-muted-foreground border border-border rounded px-1">{variant.color}</span>}
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap text-sm text-foreground/80">
                                                {isFirst ? (
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center overflow-hidden border border-border shrink-0">
                                                            {avatarSrc ? (
                                                                <img src={`${API_BASE}${avatarSrc}`} alt={product.name} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <ImageIcon className="w-5 h-5 text-muted-foreground/50" />
                                                            )}
                                                        </div>
                                                        <div>
                                                            <span className="font-medium text-foreground">{product.name}</span>
                                                            {product.ingredients?.length > 0 && (
                                                                <div className="text-xs text-muted-foreground mt-0.5">{product.ingredients.length} bahan</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground/40 ml-13 pl-1 text-xs">↳ Varian</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap">
                                                {isFirst && (
                                                    <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                                                        {product.category?.name}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap text-sm text-foreground/80 text-right font-medium">
                                                Rp {Number(variant.price).toLocaleString('id-ID')}
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <span className={`text-sm font-medium ${variant.stock < 10 ? 'text-destructive' : 'text-foreground'}`}>{variant.stock}</span>
                                                    {variant.stock < 10 && (
                                                        <span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">Menipis</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button onClick={() => openMovementModal(variant)} className="flex items-center gap-1 text-primary hover:text-primary/80 transition-colors text-xs border border-primary/20 bg-primary/10 px-2 py-1 rounded" title="Adjust Stok">
                                                        <RefreshCw className="h-3 w-3" /> Stok
                                                    </button>
                                                    {isFirst && (
                                                        <>
                                                            <button
                                                                onClick={() => router.push(`/inventory/products/${product.id}/edit`)}
                                                                className="flex items-center gap-1 text-xs border border-border bg-muted/50 px-2 py-1 rounded hover:bg-muted transition-colors opacity-0 group-hover:opacity-100"
                                                                title="Edit Produk"
                                                            >
                                                                <Pencil className="h-3 w-3" /> Edit
                                                            </button>
                                                            {deletingProductId === product.id ? (
                                                                <div className="flex items-center gap-1">
                                                                    <span className="text-xs text-destructive">Hapus?</span>
                                                                    <button onClick={() => deleteMutation.mutate(product.id)} disabled={deleteMutation.isPending} className="p-1 rounded text-destructive hover:bg-destructive/10 transition-colors">
                                                                        <Trash2 className="h-3 w-3" />
                                                                    </button>
                                                                    <button onClick={() => setDeletingProductId(null)} className="p-1 rounded text-muted-foreground hover:bg-muted transition-colors">
                                                                        <X className="h-3 w-3" />
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    onClick={() => setDeletingProductId(product.id)}
                                                                    className="p-1.5 rounded text-destructive/60 hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                                                                    title="Hapus Produk"
                                                                >
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                </button>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Stock Movement Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
                    <div className="glass bg-card w-full max-w-md rounded-xl border border-border shadow-lg overflow-hidden">
                        <div className="flex items-center justify-between p-4 border-b border-border">
                            <h3 className="font-semibold text-lg">Sesuaikan Stok Produk</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleMovementSubmit} className="p-4 space-y-4">
                            <div className="bg-muted p-3 rounded-lg border border-border/50 text-sm">
                                <p className="text-muted-foreground">SKU terpilih:</p>
                                <p className="font-medium text-foreground">{selectedVariant?.sku} {selectedVariant?.variantName && `— ${selectedVariant.variantName}`} <span className="opacity-50">| Sisa: {selectedVariant?.stock}</span></p>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Tipe Pergerakan *</label>
                                <select value={movementForm.type} onChange={e => setMovementForm({ ...movementForm, type: e.target.value })} className="w-full px-3 py-2 bg-background border border-border rounded-lg outline-none focus:border-primary">
                                    <option value="IN">Masuk (IN)</option>
                                    <option value="OUT">Keluar (OUT)</option>
                                    <option value="ADJUST">Opname/Set Manual (ADJUST)</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Kuantitas *</label>
                                <input required type="number" min="1" value={movementForm.quantity} onChange={e => setMovementForm({ ...movementForm, quantity: e.target.value })} className="w-full px-3 py-2 bg-background border border-border rounded-lg outline-none focus:border-primary" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Catatan / Alasan (Opsional)</label>
                                <input type="text" value={movementForm.reason} onChange={e => setMovementForm({ ...movementForm, reason: e.target.value })} placeholder="Misal: Stok awal / Barang rusak" className="w-full px-3 py-2 bg-background border border-border rounded-lg outline-none focus:border-primary" />
                            </div>
                            <div className="pt-4 flex justify-end gap-2">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-lg border border-border hover:bg-muted font-medium text-sm">Batal</button>
                                <button type="submit" disabled={movementMutation.isPending} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 text-sm">
                                    {movementMutation.isPending ? 'Memproses...' : 'Simpan Stok'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
