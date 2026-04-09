"use client";

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getProducts, logStockMovement, deleteProduct, bulkDeleteProducts, bulkImportProducts } from '@/lib/api';
import { downloadBulkTemplate, parseBulkExcel, BulkProductInput } from '@/lib/bulk-import';
import { Search, Plus, Package, RefreshCw, X, Image as ImageIcon, Pencil, Trash2, ChevronDown, Filter, Download, Upload, Calculator, Share2, History, MoreVertical, ShoppingCart } from 'lucide-react';
import StockHistoryModal from './StockHistoryModal';
import PurchaseModal from './PurchaseModal';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const WASTE_TYPES = ['Gagal Cetak', 'Percobaan/Test Print', 'Sampel', 'Rusak Cetak', 'Lainnya'];

/** Harga display: ambil harga tier pertama (minQty terkecil) jika ada, fallback ke variant.price */
function getEffectivePrice(variant: any): number {
    const base = Number(variant.price || 0);
    const tiers: any[] = variant.priceTiers || [];
    if (tiers.length === 0) return base;
    const sorted = [...tiers].sort((a, b) => Number(a.minQty) - Number(b.minQty));
    return Number(sorted[0].price);
}


export default function InventoryPage() {
    const router = useRouter();
    const queryClient = useQueryClient();

    // Remove main's padding so sticky header is truly flush with navbar
    useEffect(() => {
        const main = document.querySelector('main');
        if (!main) return;
        main.style.padding = '0';
        return () => { main.style.padding = ''; };
    }, []);
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

    // Waste modal
    const [showWasteModal, setShowWasteModal] = useState(false);
    const [wasteVariant, setWasteVariant] = useState<any>(null);

    // Stock history modal
    const [historyVariant, setHistoryVariant] = useState<{ variant: any; product: any } | null>(null);

    // Kebab dropdown
    const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);

    // Purchase modal
    const [showPurchaseModal, setShowPurchaseModal] = useState(false);
    const [wasteForm, setWasteForm] = useState({ quantity: '', panjang: '', lebar: '', wasteType: 'Gagal Cetak', notes: '', operatorName: '' });

    // Expanded products (variant accordion)
    const [expandedProducts, setExpandedProducts] = useState<Set<number>>(new Set());
    const toggleExpand = (id: number) => setExpandedProducts(prev => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
    });

    const closeDropdown = () => setOpenDropdownId(null);

    useEffect(() => {
        if (!openDropdownId) return;
        const close = (e: MouseEvent) => {
            if (!(e.target as HTMLElement).closest('[data-kebab-dropdown]')) {
                closeDropdown();
            }
        };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [openDropdownId]);

    const [shareToastId, setShareToastId] = useState<number | null>(null);
    const handleShare = (productId: number) => {
        const url = `${window.location.origin}/p/${productId}`;
        navigator.clipboard.writeText(url).then(() => {
            setShareToastId(productId);
            setTimeout(() => setShareToastId(null), 2000);
        });
    };

    // Filters
    const [searchText, setSearchText] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [filterSkuVariant, setFilterSkuVariant] = useState('');
    const [filterMinPrice, setFilterMinPrice] = useState('');
    const [filterMaxPrice, setFilterMaxPrice] = useState('');
    const [filterMinStock, setFilterMinStock] = useState('');
    const [filterType, setFilterType] = useState('');

    // Bulk select & delete
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);

    // Bulk import modal
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [bulkStep, setBulkStep] = useState<'upload' | 'preview' | 'result'>('upload');
    const [bulkFile, setBulkFile] = useState<File | null>(null);
    const [bulkPreview, setBulkPreview] = useState<BulkProductInput[] | null>(null);
    const [bulkParseErrors, setBulkParseErrors] = useState<string[]>([]);
    const [bulkImporting, setBulkImporting] = useState(false);
    const [bulkResult, setBulkResult] = useState<{ created: number; errors: { name: string; message: string }[] } | null>(null);

    const handleBulkFileChange = async (file: File | null) => {
        if (!file) return;
        setBulkFile(file);
        const { products, errors } = await parseBulkExcel(file);
        setBulkPreview(products);
        setBulkParseErrors(errors);
        setBulkStep('preview');
    };

    const handleBulkImport = async () => {
        if (!bulkPreview) return;
        setBulkImporting(true);
        try {
            const result = await bulkImportProducts({ products: bulkPreview });
            setBulkResult(result);
            setBulkStep('result');
            queryClient.invalidateQueries({ queryKey: ['products'] });
        } catch (err: any) {
            setBulkResult({ created: 0, errors: [{ name: 'Request Error', message: err.message }] });
            setBulkStep('result');
        } finally {
            setBulkImporting(false);
        }
    };

    const closeBulkModal = () => {
        setShowBulkModal(false);
        setBulkStep('upload');
        setBulkFile(null);
        setBulkPreview(null);
        setBulkParseErrors([]);
        setBulkResult(null);
    };

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

    const bulkDeleteMutation = useMutation({
        mutationFn: (ids: number[]) => bulkDeleteProducts(ids),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
            setSelectedIds(new Set());
            setShowBulkDeleteModal(false);
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

    const handleWasteSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!wasteVariant || !wasteForm.operatorName.trim()) return;
        if (wasteVariant.isRollMaterial && (!wasteForm.panjang || !wasteForm.lebar)) return;
        if (!wasteVariant.isRollMaterial && !wasteForm.quantity) return;
        const reason = `Susut: ${wasteForm.wasteType}${wasteForm.notes ? ` - ${wasteForm.notes}` : ''} (Operator: ${wasteForm.operatorName.trim()})`;
        const qty = wasteVariant.isRollMaterial
            ? Math.ceil(Number(wasteForm.panjang) * Number(wasteForm.lebar))
            : Number(wasteForm.quantity);
        movementMutation.mutate(
            { productVariantId: wasteVariant.id, type: 'OUT', quantity: qty, reason },
            {
                onSuccess: () => {
                    setShowWasteModal(false);
                    setWasteVariant(null);
                    setWasteForm({ quantity: '', panjang: '', lebar: '', wasteType: 'Gagal Cetak', notes: '', operatorName: '' });
                },
            }
        );
    };

    // Jumlah produk per tipe (untuk badge di tabs)
    const typeCounts = useMemo(() => {
        if (!products) return {} as Record<string, number>;
        const counts: Record<string, number> = { '': 0 };
        (products as any[]).forEach((p: any) => {
            const type = p.productType || 'SELLABLE';
            counts[type] = (counts[type] || 0) + 1;
            counts[''] = (counts[''] || 0) + 1;
        });
        return counts;
    }, [products]);

    // Kategori yang tersedia sesuai tipe yang dipilih (untuk sub-tabs)
    const filteredCategoryOptions = useMemo(() => {
        if (!products) return [] as string[];
        const cats = (products as any[])
            .filter((p: any) => !filterType || (p.productType || 'SELLABLE') === filterType)
            .map((p: any) => p.category?.name)
            .filter(Boolean);
        return [...new Set(cats)] as string[];
    }, [products, filterType]);

    // Jumlah produk per kategori (dalam tipe yang dipilih, untuk badge sub-tabs)
    const categoryCounts = useMemo(() => {
        if (!products) return {} as Record<string, number>;
        const counts: Record<string, number> = {};
        (products as any[])
            .filter((p: any) => !filterType || (p.productType || 'SELLABLE') === filterType)
            .forEach((p: any) => {
                const cat = p.category?.name || '';
                if (cat) counts[cat] = (counts[cat] || 0) + 1;
            });
        return counts;
    }, [products, filterType]);


    // Group by product, filter variants per product
    const groupedProducts = useMemo(() => {
        if (!products) return [];
        return (products as any[])
            .map((product: any) => {
                const matchedVariants = product.variants.filter((v: any) => {
                    const lowerSearch = searchText.toLowerCase();
                    if (lowerSearch) {
                        const inName = product.name.toLowerCase().includes(lowerSearch);
                        const inSku = v.sku.toLowerCase().includes(lowerSearch);
                        const inVariantName = (v.variantName || '').toLowerCase().includes(lowerSearch);
                        if (!inName && !inSku && !inVariantName) return false;
                    }
                    if (filterSkuVariant && !v.sku.toLowerCase().includes(filterSkuVariant.toLowerCase())
                        && !(v.variantName || '').toLowerCase().includes(filterSkuVariant.toLowerCase())) return false;
                    if (filterCategory && product.category?.name !== filterCategory) return false;
                    if (filterType && (product.productType || 'SELLABLE') !== filterType) return false;
                    const price = Number(v.price);
                    if (filterMinPrice && price < Number(filterMinPrice)) return false;
                    if (filterMaxPrice && price > Number(filterMaxPrice)) return false;
                    if (filterMinStock && product.trackStock !== false && v.stock < Number(filterMinStock)) return false;
                    return true;
                });
                return { product, matchedVariants };
            })
            .filter(({ matchedVariants }) => matchedVariants.length > 0);
    }, [products, searchText, filterSkuVariant, filterCategory, filterType, filterMinPrice, filterMaxPrice, filterMinStock]);

    const totalRows = groupedProducts.reduce((acc, { matchedVariants }) => acc + matchedVariants.length, 0);

    const hasActiveFilters = filterCategory || filterSkuVariant || filterMinPrice || filterMaxPrice || filterMinStock || filterType;
    const isFilterActive = !!(searchText || hasActiveFilters);

    const toggleSelect = (id: number) =>
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });

    const toggleSelectAll = () => {
        const allIds = groupedProducts.map(({ product }: any) => product.id);
        setSelectedIds(prev => prev.size === allIds.length ? new Set() : new Set(allIds));
    };

    const handleTypeTabChange = (type: string) => {
        setFilterType(type);
        setFilterCategory(''); // reset kategori saat ganti tipe
    };

    const clearFilters = () => {
        setFilterCategory('');
        setFilterSkuVariant('');
        setFilterMinPrice('');
        setFilterMaxPrice('');
        setFilterMinStock('');
        setFilterType('');
        setSearchText('');
    };

    const PRODUCT_TYPE_CONFIG: Record<string, { label: string; className: string }> = {
        SELLABLE:     { label: 'Siap Jual',  className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
        RAW_MATERIAL: { label: 'Bahan Baku', className: 'bg-amber-100 text-amber-700 border-amber-200' },
        SERVICE:      { label: 'Jasa',       className: 'bg-violet-100 text-violet-700 border-violet-200' },
    };

    return (
        <div>
            {/* ── Sticky top bar ── */}
            <div className="sticky top-0 z-20 bg-background border-b border-border px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 lg:pt-8 pb-3">
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
                    <button
                        onClick={() => downloadBulkTemplate()}
                        className="flex items-center gap-2 bg-muted text-foreground px-4 py-2 rounded-lg font-medium hover:bg-muted/80 transition-colors border border-border text-sm"
                    >
                        <Download className="h-4 w-4" /> Template
                    </button>
                    <button
                        onClick={() => setShowBulkModal(true)}
                        className="flex items-center gap-2 bg-muted text-foreground px-4 py-2 rounded-lg font-medium hover:bg-muted/80 transition-colors border border-border text-sm"
                    >
                        <Upload className="h-4 w-4" /> Import Bulk
                    </button>
                    <button
                        onClick={() => setShowPurchaseModal(true)}
                        className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-emerald-700 transition-colors shadow-sm text-sm"
                    >
                        <ShoppingCart className="h-4 w-4" /> Pembelian
                    </button>
                    <button
                        onClick={() => { setWasteVariant(null); setShowWasteModal(true); }}
                        className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-amber-600 transition-colors shadow-sm text-sm"
                    >
                        <Trash2 className="h-4 w-4" /> Catat Susut
                    </button>
                    <Link href="/inventory/products/new" className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors shadow-sm text-sm">
                        <Plus className="h-4 w-4" /> Tambah Produk
                    </Link>
                </div>
            </div>

            {/* Bulk action toolbar — inside sticky, below title */}
            {selectedIds.size > 0 && (
                <div className="flex items-center gap-3 px-4 py-2.5 bg-destructive/10 border border-destructive/20 rounded-xl mt-2">
                    <span className="text-sm font-medium text-destructive">{selectedIds.size} produk dipilih</span>
                    <button
                        onClick={() => setShowBulkDeleteModal(true)}
                        className="flex items-center gap-1.5 text-sm font-semibold text-white bg-destructive px-3 py-1.5 rounded-lg hover:bg-destructive/90 transition-colors"
                    >
                        <Trash2 className="w-3.5 h-3.5" /> Hapus yang Dipilih
                    </button>
                    <button
                        onClick={() => setSelectedIds(new Set())}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                        Batal pilih
                    </button>
                </div>
            )}

            {/* ── Tabs Tipe Produk ── */}
            <div className="mt-3">
                <div className="flex gap-1 bg-muted/50 rounded-xl p-1 border border-border overflow-x-auto scrollbar-hide">
                    {[
                        { value: '', label: 'Semua Produk' },
                        { value: 'SELLABLE', label: 'Siap Jual' },
                        { value: 'RAW_MATERIAL', label: 'Bahan Baku' },
                        { value: 'SERVICE', label: 'Jasa' },
                    ].map(tab => (
                        <button
                            key={tab.value}
                            onClick={() => handleTypeTabChange(tab.value)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap shrink-0 ${
                                filterType === tab.value
                                    ? 'bg-background text-foreground shadow-sm border border-border'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                            }`}
                        >
                            {tab.label}
                            {typeCounts[tab.value] !== undefined && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold leading-none ${
                                    filterType === tab.value
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-muted text-muted-foreground'
                                }`}>
                                    {typeCounts[tab.value] ?? 0}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Sub-tabs Kategori — tampil jika ada kategori pada tipe yang dipilih */}
                {filteredCategoryOptions.length > 0 && (
                    <div className="flex gap-1.5 mt-2 overflow-x-auto scrollbar-hide pb-0.5">
                        <button
                            onClick={() => setFilterCategory('')}
                            className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-all whitespace-nowrap shrink-0 border ${
                                filterCategory === ''
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground'
                            }`}
                        >
                            Semua Kategori
                        </button>
                        {filteredCategoryOptions.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setFilterCategory(cat)}
                                className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-all whitespace-nowrap shrink-0 border ${
                                    filterCategory === cat
                                        ? 'bg-primary text-primary-foreground border-primary'
                                        : 'bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground'
                                }`}
                            >
                                {cat}
                                <span className={`text-[10px] px-1 rounded-full leading-none font-semibold ${
                                    filterCategory === cat ? 'text-primary-foreground/80' : 'text-muted-foreground'
                                }`}>
                                    {categoryCounts[cat] ?? 0}
                                </span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Search & Filter Bar */}
            <div className="glass rounded-xl border border-border shadow-sm p-4 space-y-3 mt-3">
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
                            {groupedProducts.length} produk · {totalRows} varian
                        </span>
                    </div>
            </div>
            </div>{/* end sticky wrapper */}

            <div className="px-4 sm:px-6 lg:px-8 pt-4 pb-4 sm:pb-6 lg:pb-8">
            {/* Product list card */}
            <div className="glass rounded-xl shadow-sm border border-border overflow-hidden">
                {/* ── Mobile card list ── */}
                <div className="md:hidden divide-y divide-border/50">
                    {isLoading ? (
                        <div className="py-10 text-center text-muted-foreground">Memuat data produk...</div>
                    ) : error ? (
                        <div className="py-10 text-center text-destructive">Gagal memuat produk.</div>
                    ) : groupedProducts.length === 0 ? (
                        <div className="py-10 text-center text-muted-foreground">
                            <Package className="h-8 w-8 mx-auto mb-2 opacity-20" />
                            {searchText || hasActiveFilters ? 'Tidak ada produk yang cocok.' : 'Belum ada produk.'}
                        </div>
                    ) : groupedProducts.map(({ product, matchedVariants }) => {
                        const productImages = product.imageUrls ? (() => { try { return JSON.parse(product.imageUrls); } catch { return []; } })() : [];
                        const typeCfg = PRODUCT_TYPE_CONFIG[product.productType || 'SELLABLE'];
                        const hasMultiple = matchedVariants.length > 1;
                        const expanded = isFilterActive || expandedProducts.has(product.id);
                        const visibleVariants = expanded ? matchedVariants : [matchedVariants[0]];
                        return (
                            <div key={product.id}>
                                {visibleVariants.map((variant: any, idx: number) => {
                                    const isFirst = idx === 0;
                                    const avatarSrc = variant.variantImageUrl || productImages[0] || product.imageUrl;
                                    return (
                                        <div key={variant.id} className={`p-4 hover:bg-muted/20 transition-colors ${!isFirst ? 'bg-muted/10 border-t border-dashed border-border/50' : ''} ${isFirst && selectedIds.has(product.id) ? 'bg-destructive/5' : ''}`}>
                                            <div className="flex items-start gap-3">
                                                {isFirst && (
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedIds.has(product.id)}
                                                        onChange={() => toggleSelect(product.id)}
                                                        onClick={e => e.stopPropagation()}
                                                        className="w-4 h-4 rounded accent-primary shrink-0 mt-1"
                                                    />
                                                )}
                                                <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden border border-border shrink-0">
                                                    {avatarSrc
                                                        ? <img src={`${API_BASE}${avatarSrc}`} alt={product.name} className="w-full h-full object-cover" />
                                                        : <ImageIcon className="w-5 h-5 text-muted-foreground/40" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="min-w-0">
                                                            <p className="font-semibold text-sm text-foreground truncate">{product.name}</p>
                                                            <p className="text-xs text-muted-foreground font-mono">{variant.sku}</p>
                                                            {variant.variantName && <p className="text-xs text-muted-foreground">{variant.variantName}</p>}
                                                            {(variant.size || variant.color) && (
                                                                <div className="flex gap-1 mt-0.5">
                                                                    {variant.size && <span className="text-[10px] border border-border rounded px-1 text-muted-foreground">{variant.size}</span>}
                                                                    {variant.color && <span className="text-[10px] border border-border rounded px-1 text-muted-foreground">{variant.color}</span>}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="shrink-0 text-right">
                                                            {product.trackStock === false ? (
                                                                <>
                                                                    <p className="text-lg font-bold leading-none text-blue-500">∞</p>
                                                                    <p className="text-[10px] text-blue-400 mt-0.5">tak terbatas</p>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <p className={`text-lg font-bold leading-none ${variant.stock < 10 ? 'text-destructive' : 'text-foreground'}`}>{variant.stock}</p>
                                                                    <p className="text-[10px] text-muted-foreground mt-0.5">stok saat ini</p>
                                                                    {variant.movements?.[0] && (
                                                                        <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                                                                            awal: {(() => { const v = variant.movements[0].balanceAfter ?? variant.movements[0].quantity; return Number.isInteger(Number(v)) ? Number(v) : Number(v).toFixed(2); })()}
                                                                        </p>
                                                                    )}
                                                                    {variant.stock < 10 && <span className="text-[10px] text-destructive font-medium">Menipis</span>}
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center flex-wrap gap-2 mt-1.5">
                                                        <span className="text-sm font-bold text-primary">Rp {getEffectivePrice(variant).toLocaleString('id-ID')}</span>
                                                        {(variant.priceTiers?.length > 0) && <span className="text-[10px] bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-1.5 py-0.5 rounded font-medium">{variant.priceTiers.length} tier</span>}
                                                        {Number(variant.hpp) > 0 && <span className="text-xs text-muted-foreground">Modal: Rp {Number(variant.hpp).toLocaleString('id-ID')}</span>}
                                                        {isFirst && product.category?.name && <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{product.category.name}</span>}
                                                        {isFirst && typeCfg && <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold ${typeCfg.className}`}>{typeCfg.label}</span>}
                                                    </div>
                                                    <div className="flex items-center gap-1.5 mt-2.5">
                                                        {/* Per-variant */}
                                                        <button onClick={() => openMovementModal(variant)} className="flex items-center gap-1 text-primary text-xs border border-primary/20 bg-primary/10 px-2.5 py-1.5 rounded-lg">
                                                            <RefreshCw className="h-3 w-3" /> Stok
                                                        </button>
                                                        <button onClick={() => setHistoryVariant({ variant, product })} className="p-1.5 rounded-lg border border-border bg-muted/50 text-muted-foreground hover:bg-muted transition-colors" title="Riwayat Stok">
                                                            <History className="h-3.5 w-3.5" />
                                                        </button>
                                                        {/* Per-product: kebab dropdown */}
                                                        {isFirst && (
                                                            <div className="relative ml-auto" data-kebab-dropdown>
                                                                <button
                                                                    onClick={() => setOpenDropdownId(openDropdownId === product.id ? null : product.id)}
                                                                    className="p-1.5 rounded-lg border border-border bg-muted/50 text-muted-foreground hover:bg-muted transition-colors"
                                                                >
                                                                    <MoreVertical className="h-3.5 w-3.5" />
                                                                </button>
                                                                {openDropdownId === product.id && (
                                                                    <div className="absolute right-0 top-full mt-1 w-52 bg-card border border-border rounded-xl shadow-xl z-30 py-1.5 overflow-hidden">
                                                                        <button onClick={() => { setWasteVariant(variant); setShowWasteModal(true); closeDropdown(); }} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors">
                                                                            <Trash2 className="h-3.5 w-3.5 shrink-0" /> Catat Susut
                                                                        </button>
                                                                        <div className="h-px bg-border/60 my-1" />
                                                                        <button onClick={() => { router.push(`/inventory/products/${product.id}/edit`); closeDropdown(); }} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm hover:bg-muted transition-colors">
                                                                            <Pencil className="h-3.5 w-3.5 shrink-0" /> Edit Produk
                                                                        </button>
                                                                        <button onClick={() => { router.push(`/reports/hpp?editProductId=${product.id}`); closeDropdown(); }} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors">
                                                                            <Calculator className="h-3.5 w-3.5 shrink-0" /> Kalkulator HPP
                                                                        </button>
                                                                        <button onClick={() => { handleShare(product.id); closeDropdown(); }} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/30 transition-colors">
                                                                            <Share2 className="h-3.5 w-3.5 shrink-0" /> {shareToastId === product.id ? 'Link Disalin!' : 'Salin Link'}
                                                                        </button>
                                                                        <div className="h-px bg-border/60 my-1" />
                                                                        <button onClick={() => { setDeletingProductId(product.id); closeDropdown(); }} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors">
                                                                            <Trash2 className="h-3.5 w-3.5 shrink-0" /> Hapus Produk
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                {/* Expand/collapse toggle — mobile */}
                                {hasMultiple && !isFilterActive && (
                                    <button
                                        onClick={() => toggleExpand(product.id)}
                                        className="w-full py-2 flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors border-t border-dashed border-border/50"
                                    >
                                        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                                        {expanded ? 'Sembunyikan varian' : `Lihat ${matchedVariants.length - 1} varian lainnya`}
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* ── Desktop table ── */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="min-w-full divide-y divide-border">
                        <thead className="bg-muted/50">
                            <tr>
                                <th scope="col" className="px-4 py-3 w-10">
                                    <input
                                        type="checkbox"
                                        checked={groupedProducts.length > 0 && selectedIds.size === groupedProducts.length}
                                        onChange={toggleSelectAll}
                                        className="w-4 h-4 rounded accent-primary"
                                        title="Pilih semua"
                                    />
                                </th>
                                <th scope="col" className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">SKU / Varian</th>
                                <th scope="col" className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Nama Produk</th>
                                <th scope="col" className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Kategori</th>
                                <th scope="col" className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Harga Jual</th>
                                <th scope="col" className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Harga Modal</th>
                                <th scope="col" className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Stok Awal</th>
                                <th scope="col" className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Sisa Stok</th>
                                <th scope="col" className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="bg-card divide-y divide-border/50">
                            {isLoading ? (
                                <tr><td colSpan={9} className="px-5 py-8 text-center text-muted-foreground">Memuat data produk...</td></tr>
                            ) : error ? (
                                <tr><td colSpan={9} className="px-5 py-8 text-center text-destructive">Gagal memuat produk.</td></tr>
                            ) : groupedProducts.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="px-5 py-10 text-center text-muted-foreground">
                                        <Package className="h-8 w-8 mx-auto mb-2 opacity-20" />
                                        {searchText || hasActiveFilters ? 'Tidak ada produk yang cocok dengan filter.' : 'Belum ada produk. Silakan tambah produk baru.'}
                                    </td>
                                </tr>
                            ) : groupedProducts.map(({ product, matchedVariants }) => {
                                const productImages = product.imageUrls ? (() => { try { return JSON.parse(product.imageUrls); } catch { return []; } })() : [];
                                const hasMultiple = matchedVariants.length > 1;
                                const expanded = isFilterActive || expandedProducts.has(product.id);
                                const visibleVariants = expanded ? matchedVariants : [matchedVariants[0]];
                                const hiddenCount = matchedVariants.length - 1;

                                return [
                                    ...visibleVariants.map((variant: any, idx: number) => {
                                        const isFirst = idx === 0;
                                        const avatarSrc = variant.variantImageUrl || productImages[0] || product.imageUrl;
                                        return (
                                            <tr key={variant.id} className={`hover:bg-muted/30 transition-colors group ${!isFirst ? 'bg-muted/5' : ''} ${isFirst && selectedIds.has(product.id) ? 'bg-destructive/5' : ''}`}>
                                                <td className="px-4 py-4 w-10">
                                                    {isFirst && (
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedIds.has(product.id)}
                                                            onChange={() => toggleSelect(product.id)}
                                                            className="w-4 h-4 rounded accent-primary"
                                                        />
                                                    )}
                                                </td>
                                                <td className="px-5 py-4 whitespace-nowrap">
                                                    <div className="text-sm font-medium text-foreground">{variant.sku}</div>
                                                    {variant.variantName && <div className="text-xs text-muted-foreground mt-0.5">{variant.variantName}</div>}
                                                    <div className="flex gap-1 mt-0.5">
                                                        {variant.size && <span className="text-xs text-muted-foreground border border-border rounded px-1">{variant.size}</span>}
                                                        {variant.color && <span className="text-xs text-muted-foreground border border-border rounded px-1">{variant.color}</span>}
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4 whitespace-nowrap text-sm text-foreground/80">
                                                    {isFirst ? (
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center overflow-hidden border border-border shrink-0">
                                                                {avatarSrc ? <img src={`${API_BASE}${avatarSrc}`} alt={product.name} className="w-full h-full object-cover" /> : <ImageIcon className="w-5 h-5 text-muted-foreground/50" />}
                                                            </div>
                                                            <div>
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    <span className="font-medium text-foreground">{product.name}</span>
                                                                    {(() => { const cfg = PRODUCT_TYPE_CONFIG[product.productType || 'SELLABLE']; return cfg ? <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${cfg.className}`}>{cfg.label}</span> : null; })()}
                                                                    {hasMultiple && !isFilterActive && (
                                                                        <button
                                                                            onClick={() => toggleExpand(product.id)}
                                                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted border border-border text-[10px] text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-colors"
                                                                        >
                                                                            <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                                                                            {expanded ? `${matchedVariants.length} varian` : `+${hiddenCount} varian`}
                                                                        </button>
                                                                    )}
                                                                </div>
                                                                {product.ingredients?.length > 0 && <div className="text-xs text-muted-foreground mt-0.5">{product.ingredients.length} bahan</div>}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground/40 pl-13 text-xs">↳ Varian</span>
                                                    )}
                                                </td>
                                                <td className="px-5 py-4 whitespace-nowrap">
                                                    {isFirst && <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">{product.category?.name}</span>}
                                                </td>
                                                <td className="px-5 py-4 whitespace-nowrap text-sm text-foreground/80 text-right font-medium">
                                                    Rp {getEffectivePrice(variant).toLocaleString('id-ID')}
                                                    {variant.priceTiers?.length > 0 && <span className="ml-1 text-[10px] text-orange-500">({variant.priceTiers.length} tier)</span>}
                                                </td>
                                                <td className="px-5 py-4 whitespace-nowrap text-sm text-muted-foreground text-right">
                                                    Rp {Number(variant.hpp || 0).toLocaleString('id-ID')}
                                                </td>
                                                <td className="px-5 py-4 whitespace-nowrap text-right">
                                                    {(() => {
                                                        const initMov = variant.movements?.[0];
                                                        if (!initMov) return <span className="text-xs text-muted-foreground/40">—</span>;
                                                        const val = initMov.balanceAfter ?? initMov.quantity;
                                                        return <span className="text-sm text-muted-foreground">{Number.isInteger(Number(val)) ? Number(val) : Number(val).toFixed(2)}</span>;
                                                    })()}
                                                </td>
                                                <td className="px-5 py-4 whitespace-nowrap text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        {product.trackStock === false ? (
                                                            <span className="text-sm font-bold text-blue-500">∞</span>
                                                        ) : (
                                                            <>
                                                                <span className={`text-sm font-medium ${variant.stock < 10 ? 'text-destructive' : 'text-foreground'}`}>{variant.stock}</span>
                                                                {variant.stock < 10 && <span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">Menipis</span>}
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap text-right">
                                                    <div className="flex items-center justify-end gap-0.5">
                                                        {/* Per-variant: Sesuaikan Stok */}
                                                        <button onClick={() => openMovementModal(variant)} className="p-1.5 rounded-lg text-primary hover:bg-primary/10 transition-colors" title="Sesuaikan Stok">
                                                            <RefreshCw className="h-4 w-4" />
                                                        </button>
                                                        {/* Per-variant: Riwayat Stok */}
                                                        <button onClick={() => setHistoryVariant({ variant, product })} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors" title="Riwayat Stok">
                                                            <History className="h-4 w-4" />
                                                        </button>
                                                        {/* Per-product: kebab dropdown */}
                                                        {isFirst && (
                                                            <div className="relative" data-kebab-dropdown>
                                                                <button
                                                                    onClick={() => setOpenDropdownId(openDropdownId === product.id ? null : product.id)}
                                                                    className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
                                                                    title="Aksi lainnya"
                                                                >
                                                                    <MoreVertical className="h-4 w-4" />
                                                                </button>
                                                                {openDropdownId === product.id && (
                                                                    <div className="absolute right-0 top-full mt-1 w-52 bg-card border border-border rounded-xl shadow-xl z-30 py-1.5 overflow-hidden">
                                                                        <button onClick={() => { setWasteVariant(variant); setShowWasteModal(true); closeDropdown(); }} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors">
                                                                            <Trash2 className="h-3.5 w-3.5 shrink-0" /> Catat Susut
                                                                        </button>
                                                                        <div className="h-px bg-border/60 my-1" />
                                                                        <button onClick={() => { router.push(`/inventory/products/${product.id}/edit`); closeDropdown(); }} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm hover:bg-muted transition-colors">
                                                                            <Pencil className="h-3.5 w-3.5 shrink-0" /> Edit Produk
                                                                        </button>
                                                                        <button onClick={() => { router.push(`/reports/hpp?editProductId=${product.id}`); closeDropdown(); }} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors">
                                                                            <Calculator className="h-3.5 w-3.5 shrink-0" /> Kalkulator HPP
                                                                        </button>
                                                                        <button onClick={() => { handleShare(product.id); closeDropdown(); }} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/30 transition-colors">
                                                                            <Share2 className="h-3.5 w-3.5 shrink-0" /> {shareToastId === product.id ? 'Link Disalin!' : 'Salin Link Produk'}
                                                                        </button>
                                                                        <div className="h-px bg-border/60 my-1" />
                                                                        <button onClick={() => { setDeletingProductId(product.id); closeDropdown(); }} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors">
                                                                            <Trash2 className="h-3.5 w-3.5 shrink-0" /> Hapus Produk
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    }),
                                    // Collapsed row — tampil jika ada varian tersembunyi
                                    (!expanded && hasMultiple && !isFilterActive) ? (
                                        <tr key={`toggle-${product.id}`}>
                                            <td colSpan={9} className="px-5 py-0">
                                                <button
                                                    onClick={() => toggleExpand(product.id)}
                                                    className="w-full py-2 flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors rounded-b border-t border-dashed border-border/50"
                                                >
                                                    <ChevronDown className="h-3.5 w-3.5" />
                                                    Lihat {hiddenCount} varian lainnya
                                                </button>
                                            </td>
                                        </tr>
                                    ) : null
                                ];
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
            </div>{/* end content wrapper */}

            {/* Bulk Delete Confirmation Modal */}
            {showBulkDeleteModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-background rounded-xl border border-border p-6 max-w-sm w-full shadow-xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                                <Trash2 className="w-5 h-5 text-destructive" />
                            </div>
                            <h3 className="text-base font-semibold">Hapus {selectedIds.size} Produk?</h3>
                        </div>
                        <p className="text-sm text-muted-foreground mb-6">
                            Semua varian, foto, dan data stok dari <strong>{selectedIds.size} produk</strong> yang dipilih akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowBulkDeleteModal(false)}
                                className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
                            >
                                Batal
                            </button>
                            <button
                                onClick={() => bulkDeleteMutation.mutate([...selectedIds])}
                                disabled={bulkDeleteMutation.isPending}
                                className="px-4 py-2 text-sm bg-destructive text-white rounded-lg hover:bg-destructive/90 transition-colors disabled:opacity-60 font-medium"
                            >
                                {bulkDeleteMutation.isPending ? 'Menghapus...' : `Hapus ${selectedIds.size} Produk`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Single Product Confirmation Modal */}
            {deletingProductId && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-background rounded-xl border border-border p-6 max-w-sm w-full shadow-xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                                <Trash2 className="w-5 h-5 text-destructive" />
                            </div>
                            <div>
                                <h3 className="text-base font-semibold">Hapus Produk?</h3>
                                <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                                    {(products as any[])?.find((p: any) => p.id === deletingProductId)?.name ?? ''}
                                </p>
                            </div>
                        </div>
                        <p className="text-sm text-muted-foreground mb-6">
                            Semua varian, foto, dan data stok produk ini akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setDeletingProductId(null)}
                                className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
                            >
                                Batal
                            </button>
                            <button
                                onClick={() => deleteMutation.mutate(deletingProductId)}
                                disabled={deleteMutation.isPending}
                                className="px-4 py-2 text-sm bg-destructive text-white rounded-lg hover:bg-destructive/90 transition-colors disabled:opacity-60 font-medium"
                            >
                                {deleteMutation.isPending ? 'Menghapus...' : 'Ya, Hapus'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

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

            {/* Waste Recording Modal */}
            {showWasteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
                    <div className="glass bg-card w-full max-w-md rounded-xl border border-border shadow-lg overflow-hidden">
                        <div className="flex items-center justify-between p-4 border-b border-border">
                            <h3 className="font-semibold text-lg">Catat Susut Bahan</h3>
                            <button onClick={() => setShowWasteModal(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleWasteSubmit} className="p-4 space-y-4">
                            {!wasteVariant ? (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Pilih Varian Produk *</label>
                                    <select
                                        required
                                        onChange={e => {
                                            const allVariants = (products as any[])?.flatMap((p: any) => p.variants) ?? [];
                                            setWasteVariant(allVariants.find((v: any) => v.id === Number(e.target.value)) ?? null);
                                        }}
                                        className="w-full px-3 py-2 bg-background border border-border rounded-lg outline-none focus:border-primary text-sm"
                                    >
                                        <option value="">-- Pilih Varian --</option>
                                        {(products as any[])?.flatMap((p: any) =>
                                            p.variants.map((v: any) => (
                                                <option key={v.id} value={v.id}>{p.name} — {v.sku}</option>
                                            ))
                                        )}
                                    </select>
                                </div>
                            ) : (
                                <div className="bg-muted p-3 rounded-lg border border-border/50 text-sm flex items-center justify-between">
                                    <div>
                                        <p className="text-muted-foreground text-xs">Bahan terpilih:</p>
                                        <p className="font-medium">{wasteVariant.sku}{wasteVariant.variantName ? ` — ${wasteVariant.variantName}` : ''} <span className="text-muted-foreground font-normal">| Stok: {wasteVariant.stock}</span></p>
                                    </div>
                                    <button type="button" onClick={() => setWasteVariant(null)} className="text-xs text-muted-foreground hover:text-foreground">Ganti</button>
                                </div>
                            )}
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Nama Operator *</label>
                                <input
                                    required
                                    type="text"
                                    value={wasteForm.operatorName}
                                    onChange={e => setWasteForm({ ...wasteForm, operatorName: e.target.value })}
                                    placeholder="Masukkan nama operator"
                                    className="w-full px-3 py-2 bg-background border border-border rounded-lg outline-none focus:border-primary text-sm"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Jenis Susut *</label>
                                <select
                                    value={wasteForm.wasteType}
                                    onChange={e => setWasteForm({ ...wasteForm, wasteType: e.target.value })}
                                    className="w-full px-3 py-2 bg-background border border-border rounded-lg outline-none focus:border-primary text-sm"
                                >
                                    {WASTE_TYPES.map(w => <option key={w} value={w}>{w}</option>)}
                                </select>
                            </div>
                            {wasteVariant?.isRollMaterial ? (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Ukuran Banner (m) *</label>
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 space-y-1">
                                            <span className="text-xs text-muted-foreground">Panjang</span>
                                            <input
                                                required
                                                type="number"
                                                min="0.01"
                                                step="0.01"
                                                value={wasteForm.panjang}
                                                onChange={e => setWasteForm({ ...wasteForm, panjang: e.target.value })}
                                                className="w-full px-3 py-2 bg-background border border-border rounded-lg outline-none focus:border-primary text-sm"
                                                placeholder="Contoh: 3"
                                            />
                                        </div>
                                        <span className="text-muted-foreground mt-4">×</span>
                                        <div className="flex-1 space-y-1">
                                            <span className="text-xs text-muted-foreground">Lebar</span>
                                            <input
                                                required
                                                type="number"
                                                min="0.01"
                                                step="0.01"
                                                value={wasteForm.lebar}
                                                onChange={e => setWasteForm({ ...wasteForm, lebar: e.target.value })}
                                                className="w-full px-3 py-2 bg-background border border-border rounded-lg outline-none focus:border-primary text-sm"
                                                placeholder="Contoh: 1.5"
                                            />
                                        </div>
                                    </div>
                                    {wasteForm.panjang && wasteForm.lebar && (
                                        <p className="text-xs text-amber-600 font-medium">
                                            Luas: {(Number(wasteForm.panjang) * Number(wasteForm.lebar)).toFixed(2)} m² → disimpan sebagai {Math.ceil(Number(wasteForm.panjang) * Number(wasteForm.lebar))} m²
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Jumlah *</label>
                                    <input
                                        required
                                        type="number"
                                        min="1"
                                        step="1"
                                        value={wasteForm.quantity}
                                        onChange={e => setWasteForm({ ...wasteForm, quantity: e.target.value })}
                                        className="w-full px-3 py-2 bg-background border border-border rounded-lg outline-none focus:border-primary text-sm"
                                        placeholder="Jumlah yang terbuang/rusak"
                                    />
                                </div>
                            )}
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Keterangan (Opsional)</label>
                                <input
                                    type="text"
                                    value={wasteForm.notes}
                                    onChange={e => setWasteForm({ ...wasteForm, notes: e.target.value })}
                                    placeholder="Misal: percobaan cetak banner A3 ukuran 2x3m"
                                    className="w-full px-3 py-2 bg-background border border-border rounded-lg outline-none focus:border-primary text-sm"
                                />
                            </div>
                            <div className="pt-4 flex justify-end gap-2">
                                <button type="button" onClick={() => setShowWasteModal(false)} className="px-4 py-2 rounded-lg border border-border hover:bg-muted font-medium text-sm">Batal</button>
                                <button type="submit" disabled={movementMutation.isPending || !wasteVariant} className="px-4 py-2 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 disabled:opacity-50 text-sm">
                                    {movementMutation.isPending ? 'Menyimpan...' : 'Catat Susut'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Bulk Import Modal */}
            {showBulkModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-card rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                            <h2 className="text-lg font-semibold">
                                {bulkStep === 'upload' && 'Import Produk Bulk'}
                                {bulkStep === 'preview' && 'Preview Data Import'}
                                {bulkStep === 'result' && 'Hasil Import'}
                            </h2>
                            <button onClick={closeBulkModal} className="text-muted-foreground hover:text-foreground">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="overflow-y-auto flex-1 p-6">
                            {/* Step 1: Upload */}
                            {bulkStep === 'upload' && (
                                <div className="space-y-4">
                                    <p className="text-sm text-muted-foreground">
                                        Upload file Excel (.xlsx) yang sudah diisi sesuai template. Klik tombol <strong>Template</strong> di halaman inventory untuk mengunduh template terlebih dahulu.
                                    </p>
                                    <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-border rounded-xl cursor-pointer hover:bg-muted/50 transition-colors">
                                        <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                                        <span className="text-sm text-muted-foreground">Klik atau drag & drop file .xlsx di sini</span>
                                        <input
                                            type="file"
                                            accept=".xlsx"
                                            className="hidden"
                                            onChange={e => handleBulkFileChange(e.target.files?.[0] || null)}
                                        />
                                    </label>
                                </div>
                            )}

                            {/* Step 2: Preview */}
                            {bulkStep === 'preview' && bulkPreview && (
                                <div className="space-y-4">
                                    {bulkParseErrors.length > 0 && (
                                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
                                            <p className="text-xs font-semibold text-amber-700">Peringatan ({bulkParseErrors.length} baris dilewati):</p>
                                            {bulkParseErrors.map((e, i) => (
                                                <p key={i} className="text-xs text-amber-600">{e}</p>
                                            ))}
                                        </div>
                                    )}
                                    {bulkPreview.length === 0 ? (
                                        <p className="text-sm text-muted-foreground text-center py-8">Tidak ada data valid yang ditemukan di file.</p>
                                    ) : (
                                        <>
                                            <p className="text-sm text-muted-foreground">
                                                Ditemukan <strong>{bulkPreview.length} produk</strong> ({bulkPreview.reduce((a, p) => a + p.variants.length, 0)} varian total). Konfirmasi untuk mulai import.
                                            </p>
                                            <div className="border border-border rounded-lg overflow-hidden">
                                                <table className="w-full text-sm">
                                                    <thead className="bg-muted/50">
                                                        <tr>
                                                            <th className="text-left px-3 py-2 font-medium text-xs text-muted-foreground">Nama Produk</th>
                                                            <th className="text-left px-3 py-2 font-medium text-xs text-muted-foreground">Kategori</th>
                                                            <th className="text-center px-3 py-2 font-medium text-xs text-muted-foreground">Varian</th>
                                                            <th className="text-left px-3 py-2 font-medium text-xs text-muted-foreground">SKU</th>
                                                            <th className="text-center px-3 py-2 font-medium text-xs text-muted-foreground">HPP</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-border">
                                                        {bulkPreview.map((p, i) => (
                                                            <tr key={i} className="hover:bg-muted/30">
                                                                <td className="px-3 py-2 font-medium">{p.name}</td>
                                                                <td className="px-3 py-2 text-muted-foreground">{p.category}</td>
                                                                <td className="px-3 py-2 text-center">{p.variants.length}</td>
                                                                <td className="px-3 py-2 text-xs text-muted-foreground">{p.variants.map(v => v.sku).join(', ')}</td>
                                                                <td className="px-3 py-2 text-center">{p.hppWorksheets.length > 0 ? '✓' : '—'}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}

                            {/* Step 3: Result */}
                            {bulkStep === 'result' && bulkResult && (
                                <div className="space-y-4">
                                    <div className={`rounded-lg p-4 border ${bulkResult.errors.length === 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                                        <p className={`font-semibold ${bulkResult.errors.length === 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                                            {bulkResult.created} produk berhasil dibuat.{bulkResult.errors.length > 0 ? ` ${bulkResult.errors.length} gagal.` : ''}
                                        </p>
                                    </div>
                                    {bulkResult.errors.length > 0 && (
                                        <div className="space-y-2">
                                            <p className="text-sm font-medium text-destructive">Detail error:</p>
                                            {bulkResult.errors.map((e, i) => (
                                                <div key={i} className="bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2 text-xs">
                                                    <span className="font-medium">{e.name}:</span> {e.message}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
                            {bulkStep === 'upload' && (
                                <button onClick={closeBulkModal} className="px-4 py-2 rounded-lg border border-border hover:bg-muted font-medium text-sm">Batal</button>
                            )}
                            {bulkStep === 'preview' && (
                                <>
                                    <button onClick={() => setBulkStep('upload')} className="px-4 py-2 rounded-lg border border-border hover:bg-muted font-medium text-sm">Kembali</button>
                                    <button
                                        onClick={handleBulkImport}
                                        disabled={bulkImporting || !bulkPreview || bulkPreview.length === 0}
                                        className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 text-sm"
                                    >
                                        {bulkImporting ? 'Mengimport...' : `Konfirmasi & Import ${bulkPreview?.length || 0} Produk`}
                                    </button>
                                </>
                            )}
                            {bulkStep === 'result' && (
                                <button onClick={closeBulkModal} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 text-sm">Selesai</button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Purchase Modal */}
            {showPurchaseModal && (
                <PurchaseModal onClose={() => setShowPurchaseModal(false)} />
            )}

            {/* Stock History Modal */}
            {historyVariant && (
                <StockHistoryModal
                    variant={historyVariant.variant}
                    productName={historyVariant.product.name}
                    onClose={() => setHistoryVariant(null)}
                />
            )}
        </div>
    );
}
