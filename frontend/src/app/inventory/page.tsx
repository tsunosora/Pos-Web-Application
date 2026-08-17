"use client";

import { useState, useMemo, useEffect, Fragment } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getProducts, logStockMovement, deleteProduct, bulkDeleteProducts, bulkImportProducts } from '@/lib/api';
import { downloadBulkTemplate, parseBulkExcel, BulkProductInput } from '@/lib/bulk-import';
import { Search, Plus, Package, RefreshCw, X, Image as ImageIcon, Pencil, Trash2, ChevronDown, Filter, Download, Upload, Calculator, Share2, History, MoreVertical, ShoppingCart, Loader2, Table2, LayoutGrid, Rows3, GalleryHorizontal, FolderTree, Ruler } from 'lucide-react';
import { EmptyState } from '@/components/ui/responsive-table';
import { useUIStore, type InventoryViewMode } from '@/store/ui-store';
import { cn } from '@/lib/utils';
import { useIncrementalRender } from '@/lib/useIncrementalRender';
import { badgeToneClass } from '@/components/ui/status-badge';
import { ProductImageFill } from '@/components/ui/ProductImageFill';
import StockHistoryModal from './StockHistoryModal';
import PurchaseModal from './PurchaseModal';
import { SmartStockModal } from './StockControls';
import CategoryPanel from './CategoryPanel';
import UnitPanel from './UnitPanel';
import ChangeCategoryModal from './ChangeCategoryModal';
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


// View mode options shown in the toggle
const VIEW_MODES: { key: InventoryViewMode; label: string; icon: any; hint: string }[] = [
    { key: 'table',   label: 'Tabel',    icon: Table2,             hint: 'Tampilan tabel padat dengan semua kolom' },
    { key: 'compact', label: 'Kompak',   icon: Rows3,              hint: 'Daftar ringkas dengan thumbnail kecil' },
    { key: 'grid',    label: 'Grid',     icon: LayoutGrid,         hint: 'Kartu produk dengan gambar' },
    { key: 'gallery', label: 'Galeri',   icon: GalleryHorizontal,  hint: 'Galeri besar fokus visual' },
];

export default function InventoryPage() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const viewMode = useUIStore(s => s.inventoryViewMode);
    const setViewMode = useUIStore(s => s.setInventoryViewMode);

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

    // Delete confirm
    const [deletingProductId, setDeletingProductId] = useState<number | null>(null);

    // Waste modal
    const [showWasteModal, setShowWasteModal] = useState(false);
    const [wasteVariant, setWasteVariant] = useState<any>(null);

    // Stock history modal
    const [historyVariant, setHistoryVariant] = useState<{ variant: any; product: any } | null>(null);

    // Kebab dropdown
    const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);
    // Posisi dropdown tabel (di-portal ke body agar tak terpotong overflow-x tabel di tablet)
    const [tableMenuPos, setTableMenuPos] = useState<{ top: number; left: number } | null>(null);

    // Mobile action menu (⋮ more)
    const [showMobileActions, setShowMobileActions] = useState(false);

    // Filter panel toggle (collapsible)
    const [showFilters, setShowFilters] = useState(false);
    // Header ringkas: tab Tipe & Kategori disembunyikan default, dibuka via chevron
    const [headerExpanded, setHeaderExpanded] = useState(false);

    // Purchase modal
    const [showPurchaseModal, setShowPurchaseModal] = useState(false);
    // Panel kategori & unit (slide-over inline)
    const [showCategoryPanel, setShowCategoryPanel] = useState(false);
    const [showUnitPanel, setShowUnitPanel] = useState(false);
    // Produk yang sedang diganti kategorinya (modal cepat)
    const [categoryEditProduct, setCategoryEditProduct] = useState<any>(null);
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

    useEffect(() => {
        if (!showMobileActions) return;
        const close = (e: MouseEvent) => {
            if (!(e.target as HTMLElement).closest('[data-mobile-menu]')) {
                setShowMobileActions(false);
            }
        };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [showMobileActions]);

    const [shareToastId, setShareToastId] = useState<number | null>(null);
    const handleShare = (productId: number) => {
        const shareDomain = process.env.NEXT_PUBLIC_SHARE_DOMAIN || window.location.origin;
        const url = `${shareDomain}/p/${productId}`;
        navigator.clipboard.writeText(url).then(() => {
            setShareToastId(productId);
            setTimeout(() => setShareToastId(null), 2000);
        });
    };

    // Filters
    const [searchText, setSearchText] = useState('');
    // Prefill pencarian dari deep-link (mis. klik card produk di Asisten AI → /inventory?q=Nama).
    useEffect(() => {
        try {
            const q = new URLSearchParams(window.location.search).get('q');
            if (q) setSearchText(q);
        } catch { /* ignore */ }
    }, []);
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

    const openMovementModal = (variant: any, productName?: string) => {
        setSelectedVariant(productName ? { ...variant, productName } : variant);
        setIsModalOpen(true);
    };

    // Submit stok (dipakai quick-adjust inline & modal pintar). mutateAsync → refetch produk.
    const adjustStock = (p: { productVariantId: number; type: 'IN' | 'OUT' | 'ADJUST'; quantity: number; reason?: string }) =>
        movementMutation.mutateAsync(p);


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
    // Helper: label kategori tampil "Parent › Sub" jika ada parent
    const getCategoryLabel = (cat: any): string => {
        if (!cat) return '';
        return cat.parent ? `${cat.parent.name} › ${cat.name}` : cat.name;
    };
    // Label grup untuk header pemisah (produk tanpa kategori → "Tanpa Kategori")
    const groupLabel = (product: any): string => getCategoryLabel(product?.category) || 'Tanpa Kategori';

    // Filter tabs: tampilkan nama parent unik (agar klik "Cetak" = semua sub-cetak)
    const filteredCategoryOptions = useMemo(() => {
        if (!products) return [] as string[];
        const cats = (products as any[])
            .filter((p: any) => !filterType || (p.productType || 'SELLABLE') === filterType)
            .map((p: any) => {
                const cat = p.category;
                if (!cat) return null;
                // Tampilkan parent name jika ada, atau name langsung
                return cat.parent ? cat.parent.name : cat.name;
            })
            .filter(Boolean);
        return [...new Set(cats)] as string[];
    }, [products, filterType]);

    // Jumlah produk per kategori-filter (parent name)
    const categoryCounts = useMemo(() => {
        if (!products) return {} as Record<string, number>;
        const counts: Record<string, number> = {};
        (products as any[])
            .filter((p: any) => !filterType || (p.productType || 'SELLABLE') === filterType)
            .forEach((p: any) => {
                const cat = p.category;
                if (!cat) return;
                const key = cat.parent ? cat.parent.name : cat.name;
                counts[key] = (counts[key] || 0) + 1;
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
                    if (filterCategory) {
                        const cat = product.category;
                        const catKey = cat?.parent ? cat.parent.name : cat?.name;
                        if (catKey !== filterCategory) return false;
                    }
                    if (filterType && (product.productType || 'SELLABLE') !== filterType) return false;
                    const price = Number(v.price);
                    if (filterMinPrice && price < Number(filterMinPrice)) return false;
                    if (filterMaxPrice && price > Number(filterMaxPrice)) return false;
                    if (filterMinStock && product.trackStock !== false && v.stock < Number(filterMinStock)) return false;
                    return true;
                });
                return { product, matchedVariants };
            })
            .filter(({ matchedVariants }) => matchedVariants.length > 0)
            // Urut berkelompok per kategori/grup (parent › sub), lalu per nama produk;
            // produk tanpa kategori diletakkan paling akhir.
            .sort((a: any, b: any) => {
                const key = (p: any) => {
                    const c = p.product.category;
                    return c ? (c.parent ? `${c.parent.name} › ${c.name}` : c.name) : '￿';
                };
                const g = key(a).localeCompare(key(b), 'id', { sensitivity: 'base' });
                return g !== 0 ? g : (a.product.name || '').localeCompare(b.product.name || '', 'id', { sensitivity: 'base' });
            });
    }, [products, searchText, filterSkuVariant, filterCategory, filterType, filterMinPrice, filterMaxPrice, filterMinStock]);

    const totalRows = groupedProducts.reduce((acc, { matchedVariants }) => acc + matchedVariants.length, 0);

    // Render bertahap: batasi baris/kartu yang digambar sekaligus. Search/filter tetap
    // atas SELURUH produk (groupedProducts). Cegah DOM berat saat produk banyak.
    const {
        visible: visibleGrouped,
        hasMore: hasMoreGrouped,
        remaining: remainingGrouped,
        loadMore: loadMoreGrouped,
        sentinelRef: groupedSentinel,
    } = useIncrementalRender(groupedProducts, 40);

    const hasActiveFilters = filterCategory || filterSkuVariant || filterMinPrice || filterMaxPrice || filterMinStock || filterType;
    const isFilterActive = !!(searchText || hasActiveFilters);
    const activeFilterCount = [filterSkuVariant, filterMinPrice, filterMaxPrice, filterMinStock].filter(Boolean).length;

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
        SELLABLE:     { label: 'Siap Jual',  className: badgeToneClass.success },
        RAW_MATERIAL: { label: 'Bahan Baku', className: badgeToneClass.warning },
        SERVICE:      { label: 'Jasa',       className: 'bg-violet-100 text-violet-700 border-violet-200' },
    };

    return (
        <div>
            {/* ── Sticky top bar ── */}
            <div className="sticky top-0 z-20 rounded-2xl border border-border/40 bg-card/55 backdrop-blur-2xl backdrop-saturate-150 shadow-lg px-4 sm:px-6 lg:px-7 pt-4 pb-3 mb-3">
            {/* Title + Action buttons */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <div className="hidden sm:flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
                    <Package className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-[10rem]">
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate">Manajemen Stok & Produk</h1>
                    <p className="mt-0.5 text-xs sm:text-sm text-muted-foreground hidden sm:block">Kelola inventori, varian, harga, dan stok per cabang.</p>
                </div>
                {/* Mobile: compact Tambah + ⋮ more menu */}
                <div className="flex items-center gap-1.5 sm:hidden shrink-0">
                    <Link href="/inventory/products/new" className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors shadow-sm text-sm">
                        <Plus className="h-4 w-4" /> Tambah
                    </Link>
                    <div className="relative" data-mobile-menu>
                        <button
                            onClick={() => setShowMobileActions(v => !v)}
                            className="p-2 rounded-lg border border-border bg-muted/50 text-muted-foreground hover:bg-muted transition-colors"
                        >
                            <MoreVertical className="h-5 w-5" />
                        </button>
                        {showMobileActions && (
                            <div className="absolute right-0 top-full mt-1 w-56 bg-card border border-border rounded-xl shadow-xl z-40 py-1.5 overflow-hidden">
                                <button onClick={() => { setShowPurchaseModal(true); setShowMobileActions(false); }} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors">
                                    <ShoppingCart className="h-4 w-4 shrink-0" /> Pembelian Stok
                                </button>
                                <button onClick={() => { setWasteVariant(null); setShowWasteModal(true); setShowMobileActions(false); }} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors">
                                    <Trash2 className="h-4 w-4 shrink-0" /> Catat Susut
                                </button>
                                <div className="h-px bg-border/60 my-1" />
                                <button onClick={() => { downloadBulkTemplate(); setShowMobileActions(false); }} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm hover:bg-muted transition-colors">
                                    <Download className="h-4 w-4 shrink-0" /> Download Template
                                </button>
                                <button onClick={() => { setShowBulkModal(true); setShowMobileActions(false); }} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm hover:bg-muted transition-colors">
                                    <Upload className="h-4 w-4 shrink-0" /> Import Bulk
                                </button>
                                <div className="h-px bg-border/60 my-1" />
                                <button onClick={() => { setShowCategoryPanel(true); setShowMobileActions(false); }} className="w-full text-left flex items-center gap-2.5 px-3.5 py-2.5 text-sm hover:bg-muted transition-colors">
                                    Kategori
                                </button>
                                <button onClick={() => { setShowUnitPanel(true); setShowMobileActions(false); }} className="w-full text-left flex items-center gap-2.5 px-3.5 py-2.5 text-sm hover:bg-muted transition-colors">
                                    Unit
                                </button>
                            </div>
                        )}
                    </div>
                </div>
                {/* Desktop: aksi sekunder (ikon ringkas) + aksi utama (berlabel) */}
                <div className="hidden sm:flex flex-wrap items-center justify-end gap-2 ml-auto">
                    {/* Sekunder: tombol ikon, dikelompokkan */}
                    <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-1">
                        <button onClick={() => setShowCategoryPanel(true)} title="Kelola Kategori" className="h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground transition-colors">
                            <FolderTree className="h-4 w-4" />
                        </button>
                        <button onClick={() => setShowUnitPanel(true)} title="Kelola Unit" className="h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground transition-colors">
                            <Ruler className="h-4 w-4" />
                        </button>
                        <button onClick={() => downloadBulkTemplate()} title="Download Template Impor" className="h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground transition-colors">
                            <Download className="h-4 w-4" />
                        </button>
                        <button onClick={() => setShowBulkModal(true)} title="Impor Bulk" className="h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground transition-colors">
                            <Upload className="h-4 w-4" />
                        </button>
                    </div>
                    {/* Utama: berlabel */}
                    <button onClick={() => setShowPurchaseModal(true)} className="flex items-center gap-2 bg-emerald-600 text-white px-3.5 py-2 rounded-lg font-medium hover:bg-emerald-700 transition-colors shadow-sm text-sm">
                        <ShoppingCart className="h-4 w-4" /> <span className="hidden md:inline">Pembelian</span>
                    </button>
                    <button onClick={() => { setWasteVariant(null); setShowWasteModal(true); }} className="flex items-center gap-2 bg-amber-500 text-white px-3.5 py-2 rounded-lg font-medium hover:bg-amber-600 transition-colors shadow-sm text-sm">
                        <Trash2 className="h-4 w-4" /> <span className="hidden md:inline">Catat Susut</span>
                    </button>
                    <Link href="/inventory/products/new" className="flex items-center gap-2 bg-primary text-primary-foreground px-3.5 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors shadow-sm text-sm">
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

            {/* Toggle ringkas: Tipe & Kategori */}
            <button
                onClick={() => setHeaderExpanded(v => !v)}
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
                <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", headerExpanded && "rotate-180")} />
                {headerExpanded ? 'Sembunyikan tipe & kategori' : 'Tipe & Kategori'}
                {!headerExpanded && (filterType || filterCategory) && (
                    <span className="ml-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-semibold">
                        {filterCategory || (filterType === 'SELLABLE' ? 'Siap Jual' : filterType === 'RAW_MATERIAL' ? 'Bahan Baku' : filterType === 'SERVICE' ? 'Jasa' : '')}
                    </span>
                )}
            </button>

            {/* ── Tabs Tipe Produk (collapsible) ── */}
            {headerExpanded && (
            <div className="mt-3 animate-in fade-in slide-in-from-top-1 duration-200">
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
            )}

            {/* Search + Filter toggle */}
            <div className="mt-3 space-y-2">
                <div className="flex gap-2">
                    <div className="relative flex-1 min-w-0">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                            type="text"
                            value={searchText}
                            onChange={e => setSearchText(e.target.value)}
                            placeholder="Cari produk, SKU, varian..."
                            className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-sm text-foreground placeholder:text-muted-foreground"
                        />
                    </div>
                    <button
                        onClick={() => setShowFilters(v => !v)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors shrink-0 ${
                            showFilters || hasActiveFilters
                                ? 'border-primary text-primary bg-primary/5'
                                : 'border-border text-muted-foreground hover:bg-muted'
                        }`}
                    >
                        <Filter className="h-4 w-4" />
                        <span className="hidden sm:inline">Filter</span>
                        {activeFilterCount > 0 && (
                            <span className="flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold leading-none">
                                {activeFilterCount}
                            </span>
                        )}
                    </button>
                </div>

                {/* Collapsible filter panel */}
                {showFilters && (
                    <div className="glass rounded-xl border border-border shadow-sm p-3">
                        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:items-center">
                            <input
                                type="text"
                                value={filterSkuVariant}
                                onChange={e => setFilterSkuVariant(e.target.value)}
                                placeholder="SKU / Varian"
                                className="px-3 py-1.5 bg-background border border-border rounded-lg text-xs outline-none focus:border-primary w-full sm:w-36"
                            />
                            <div className="flex items-center gap-1">
                                <input
                                    type="number"
                                    value={filterMinPrice}
                                    onChange={e => setFilterMinPrice(e.target.value)}
                                    placeholder="Harga min"
                                    className="px-3 py-1.5 bg-background border border-border rounded-lg text-xs outline-none focus:border-primary flex-1 sm:flex-none sm:w-28 min-w-0"
                                />
                                <span className="text-xs text-muted-foreground shrink-0">–</span>
                                <input
                                    type="number"
                                    value={filterMaxPrice}
                                    onChange={e => setFilterMaxPrice(e.target.value)}
                                    placeholder="Harga max"
                                    className="px-3 py-1.5 bg-background border border-border rounded-lg text-xs outline-none focus:border-primary flex-1 sm:flex-none sm:w-28 min-w-0"
                                />
                            </div>
                            <input
                                type="number"
                                value={filterMinStock}
                                onChange={e => setFilterMinStock(e.target.value)}
                                placeholder="Stok min"
                                className="px-3 py-1.5 bg-background border border-border rounded-lg text-xs outline-none focus:border-primary w-full sm:w-24"
                            />
                            {hasActiveFilters && (
                                <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border border-border px-2.5 py-1.5 rounded-lg hover:bg-muted transition-colors">
                                    <X className="h-3 w-3" /> Reset
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Product count + view mode toggle (desktop only) */}
                <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">{groupedProducts.length} produk · {totalRows} varian</span>
                    <div className="hidden sm:inline-flex items-center gap-0.5 rounded-lg border border-border bg-muted p-0.5" role="group" aria-label="Pilih tampilan produk">
                        {VIEW_MODES.map(m => {
                            const Icon = m.icon;
                            const active = viewMode === m.key;
                            return (
                                <button
                                    key={m.key}
                                    type="button"
                                    onClick={() => setViewMode(m.key)}
                                    title={m.hint}
                                    aria-pressed={active}
                                    aria-label={m.label}
                                    className={cn(
                                        'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors',
                                        active
                                            ? 'bg-background text-foreground shadow-sm'
                                            : 'text-muted-foreground hover:text-foreground',
                                    )}
                                >
                                    <Icon className="h-3.5 w-3.5" />
                                    <span className="hidden lg:inline">{m.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
            </div>{/* end sticky wrapper */}

            <div className="px-4 sm:px-6 lg:px-8 pt-4 pb-4 sm:pb-6 lg:pb-8">
            {/* Product list wrapper — pakai bg-background (beda dari bg-card kartu) agar
                kartu produk menonjol jelas & tidak terlihat "transparan/menyatu". */}
            <div className="bg-background rounded-xl shadow-sm border border-border overflow-visible">
                {/* ── Mobile card list ── */}
                <div className="sm:hidden divide-y divide-border/50">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12 text-muted-foreground">
                            <Loader2 className="h-5 w-5 animate-spin" />
                        </div>
                    ) : error ? (
                        <div className="py-10 text-center text-destructive text-sm">Gagal memuat produk.</div>
                    ) : groupedProducts.length === 0 ? (
                        <EmptyState
                            icon={Package}
                            title={searchText || hasActiveFilters ? 'Tidak ditemukan' : 'Belum ada produk'}
                            description={searchText || hasActiveFilters ? 'Coba ubah kata kunci atau reset filter.' : 'Mulai dengan klik tombol Tambah Produk.'}
                        />
                    ) : visibleGrouped.map(({ product, matchedVariants }, gi) => {
                        const productImages = product.imageUrls ? (() => { try { return JSON.parse(product.imageUrls); } catch { return []; } })() : [];
                        const typeCfg = PRODUCT_TYPE_CONFIG[product.productType || 'SELLABLE'];
                        const hasMultiple = matchedVariants.length > 1;
                        const expanded = isFilterActive || expandedProducts.has(product.id);
                        const visibleVariants = expanded ? matchedVariants : [matchedVariants[0]];
                        return (
                            <div key={product.id}>
                                {(gi === 0 || groupLabel(visibleGrouped[gi - 1].product) !== groupLabel(product)) && (<div className="px-4 py-2 bg-muted/40 border-y border-border text-xs font-bold text-muted-foreground uppercase tracking-wider">{groupLabel(product)}</div>)}
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
                                                        ? <img src={`${API_BASE}${avatarSrc}`} alt={product.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
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
                                                        {isFirst && product.category?.name && <button type="button" onClick={(e) => { e.stopPropagation(); setCategoryEditProduct(product); }} title="Klik untuk ganti kategori" className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors">{getCategoryLabel(product.category)}</button>}
                                                        {isFirst && typeCfg && <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold ${typeCfg.className}`}>{typeCfg.label}</span>}
                                                    </div>
                                                    <div className="flex items-center flex-wrap gap-1.5 mt-2.5">
                                                        {/* Per-variant: modal pintar (Masuk/Keluar/Setel) */}
                                                        <button onClick={() => openMovementModal(variant, product.name)} className="flex items-center gap-1 text-primary text-xs border border-primary/20 bg-primary/10 px-2.5 py-1.5 rounded-lg">
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
                                                                    <div className="absolute right-0 top-full mt-1 w-52 max-w-[calc(100vw-2rem)] bg-card border border-border rounded-xl shadow-xl z-30 py-1.5 overflow-hidden">
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

                {/* ── Desktop: Tabel ── */}
                <div className={cn('hidden overflow-x-auto', viewMode === 'table' ? 'sm:block' : 'sm:hidden')}>
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
                                <th scope="col" className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">SKU / Varian</th>
                                <th scope="col" className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Nama Produk</th>
                                <th scope="col" className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Kategori</th>
                                <th scope="col" className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Harga Jual</th>
                                <th scope="col" className="hidden xl:table-cell px-4 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Harga Modal</th>
                                <th scope="col" className="hidden lg:table-cell px-4 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Stok Awal</th>
                                <th scope="col" className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Sisa Stok</th>
                                <th scope="col" className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            {isLoading ? (
                                <tr><td colSpan={9} className="px-5 py-12 text-center text-muted-foreground">
                                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                                </td></tr>
                            ) : error ? (
                                <tr><td colSpan={9} className="px-5 py-8 text-center text-destructive">Gagal memuat produk.</td></tr>
                            ) : groupedProducts.length === 0 ? (
                                <tr>
                                    <td colSpan={9}>
                                        <EmptyState
                                            icon={Package}
                                            title={searchText || hasActiveFilters ? 'Tidak ditemukan' : 'Belum ada produk'}
                                            description={searchText || hasActiveFilters ? 'Coba ubah kata kunci pencarian atau reset filter.' : 'Mulai dengan klik tombol Tambah Produk di atas.'}
                                            action={
                                                searchText || hasActiveFilters ? (
                                                    <button
                                                        onClick={clearFilters}
                                                        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                                                    >
                                                        <X className="h-3.5 w-3.5" /> Reset filter
                                                    </button>
                                                ) : (
                                                    <Link
                                                        href="/inventory/products/new"
                                                        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                                                    >
                                                        <Plus className="h-4 w-4" /> Tambah Produk
                                                    </Link>
                                                )
                                            }
                                        />
                                    </td>
                                </tr>
                            ) : visibleGrouped.map(({ product, matchedVariants }, gi) => {
                                const productImages = product.imageUrls ? (() => { try { return JSON.parse(product.imageUrls); } catch { return []; } })() : [];
                                const hasMultiple = matchedVariants.length > 1;
                                const expanded = isFilterActive || expandedProducts.has(product.id);
                                const visibleVariants = expanded ? matchedVariants : [matchedVariants[0]];
                                const hiddenCount = matchedVariants.length - 1;

                                return [
                                    (gi === 0 || groupLabel(visibleGrouped[gi - 1].product) !== groupLabel(product)) && (
                                        <tr key={`grp-${product.id}`} className="bg-muted/40 border-y border-border">
                                            <td colSpan={12} className="px-4 py-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">{groupLabel(product)}</td>
                                        </tr>
                                    ),
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
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <div className="text-sm font-medium text-foreground">{variant.sku}</div>
                                                    {variant.variantName && <div className="text-xs text-muted-foreground mt-0.5">{variant.variantName}</div>}
                                                    <div className="flex gap-1 mt-0.5">
                                                        {variant.size && <span className="text-xs text-muted-foreground border border-border rounded px-1">{variant.size}</span>}
                                                        {variant.color && <span className="text-xs text-muted-foreground border border-border rounded px-1">{variant.color}</span>}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-foreground/80">
                                                    {isFirst ? (
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center overflow-hidden border border-border shrink-0">
                                                                {avatarSrc ? <img src={`${API_BASE}${avatarSrc}`} alt={product.name} loading="lazy" decoding="async" className="w-full h-full object-cover" /> : <ImageIcon className="w-5 h-5 text-muted-foreground/50" />}
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
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    {isFirst && <button type="button" onClick={() => setCategoryEditProduct(product)} title="Klik untuk ganti kategori" className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors">{getCategoryLabel(product.category)}</button>}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-foreground/80 text-right font-medium">
                                                    Rp {getEffectivePrice(variant).toLocaleString('id-ID')}
                                                    {variant.priceTiers?.length > 0 && <span className="ml-1 text-[10px] text-orange-500">({variant.priceTiers.length} tier)</span>}
                                                </td>
                                                <td className="hidden xl:table-cell px-4 py-3 whitespace-nowrap text-sm text-muted-foreground text-right">
                                                    Rp {Number(variant.hpp || 0).toLocaleString('id-ID')}
                                                </td>
                                                <td className="hidden lg:table-cell px-4 py-3 whitespace-nowrap text-right">
                                                    {(() => {
                                                        const initMov = variant.movements?.[0];
                                                        if (!initMov) return <span className="text-xs text-muted-foreground/40">—</span>;
                                                        const val = initMov.balanceAfter ?? initMov.quantity;
                                                        return <span className="text-sm text-muted-foreground">{Number.isInteger(Number(val)) ? Number(val) : Number(val).toFixed(2)}</span>;
                                                    })()}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-right">
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
                                                <td className="px-4 py-3 whitespace-nowrap text-right">
                                                    <div className="flex items-center justify-end gap-0.5">
                                                        {/* Per-variant: Sesuaikan Stok */}
                                                        <button onClick={() => openMovementModal(variant, product.name)} className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-primary hover:bg-primary/10 transition-colors" title="Sesuaikan Stok">
                                                            <RefreshCw className="h-4 w-4" />
                                                        </button>
                                                        {/* Per-variant: Riwayat Stok */}
                                                        <button onClick={() => setHistoryVariant({ variant, product })} className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors" title="Riwayat Stok">
                                                            <History className="h-4 w-4" />
                                                        </button>
                                                        {/* Per-product: kebab dropdown */}
                                                        {isFirst && (
                                                            <div className="relative" data-kebab-dropdown>
                                                                <button
                                                                    onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setTableMenuPos({ top: r.bottom + 4, left: Math.max(8, r.right - 208) }); setOpenDropdownId(openDropdownId === product.id ? null : product.id); }}
                                                                    className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors"
                                                                    title="Aksi lainnya"
                                                                >
                                                                    <MoreVertical className="h-4 w-4" />
                                                                </button>
                                                                {openDropdownId === product.id && tableMenuPos && createPortal(
                                                                    <div data-kebab-dropdown style={{ position: 'fixed', top: tableMenuPos.top, left: tableMenuPos.left }} className="w-52 bg-card border border-border rounded-xl shadow-xl z-[60] py-1.5">
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
                                                                    </div>,
                                                                    document.body,
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

                {/* ── Desktop: Kompak (dense list) ── */}
                {viewMode === 'compact' && (
                    <div className="hidden sm:block divide-y divide-border/50">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-12 text-muted-foreground">
                                <Loader2 className="h-5 w-5 animate-spin" />
                            </div>
                        ) : groupedProducts.length === 0 ? (
                            <EmptyState
                                icon={Package}
                                title={searchText || hasActiveFilters ? 'Tidak ditemukan' : 'Belum ada produk'}
                                description={searchText || hasActiveFilters ? 'Coba ubah kata kunci atau reset filter.' : 'Mulai dengan klik tombol Tambah Produk.'}
                            />
                        ) : visibleGrouped.map(({ product, matchedVariants }, gi) => {
                            const productImages = product.imageUrls ? (() => { try { return JSON.parse(product.imageUrls); } catch { return []; } })() : [];
                            const typeCfg = PRODUCT_TYPE_CONFIG[product.productType || 'SELLABLE'];
                            const expanded = isFilterActive || expandedProducts.has(product.id);
                            const hasMultiple = matchedVariants.length > 1;
                            const visibleVariants = expanded ? matchedVariants : [matchedVariants[0]];
                            const hiddenCount = matchedVariants.length - 1;
                            return (
                                <div key={product.id}>
                                    {(gi === 0 || groupLabel(visibleGrouped[gi - 1].product) !== groupLabel(product)) && (<div className="px-4 py-1.5 bg-muted/40 border-y border-border text-xs font-bold text-muted-foreground uppercase tracking-wider">{groupLabel(product)}</div>)}
                                    {visibleVariants.map((variant: any, idx: number) => {
                                        const isFirst = idx === 0;
                                        const avatarSrc = variant.variantImageUrl || productImages[0] || product.imageUrl;
                                        return (
                                            <div key={variant.id} className={cn('flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors group', !isFirst && 'pl-12 bg-muted/10')}>
                                                {isFirst ? (
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedIds.has(product.id)}
                                                        onChange={() => toggleSelect(product.id)}
                                                        className="w-4 h-4 rounded accent-primary shrink-0"
                                                    />
                                                ) : (
                                                    <div className="w-4 shrink-0" />
                                                )}
                                                <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center overflow-hidden border border-border shrink-0">
                                                    {avatarSrc
                                                        ? <img src={`${API_BASE}${avatarSrc}`} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                                                        : <ImageIcon className="w-4 h-4 text-muted-foreground/40" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="text-sm font-semibold text-foreground truncate">{isFirst ? product.name : (variant.variantName || variant.sku)}</span>
                                                        {isFirst && typeCfg && <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-semibold', typeCfg.className)}>{typeCfg.label}</span>}
                                                        {isFirst && hasMultiple && !isFilterActive && (
                                                            <button
                                                                onClick={() => toggleExpand(product.id)}
                                                                className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-primary"
                                                            >
                                                                <ChevronDown className={cn('h-3 w-3 transition-transform', expanded && 'rotate-180')} />
                                                                {expanded ? `${matchedVariants.length} varian` : `+${hiddenCount}`}
                                                            </button>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 truncate">
                                                        <span className="font-mono">{variant.sku}</span>
                                                        {!isFirst && variant.variantName && <span>· {variant.variantName}</span>}
                                                        {isFirst && product.category?.name && <button type="button" onClick={(e) => { e.stopPropagation(); setCategoryEditProduct(product); }} title="Klik untuk ganti kategori" className="hover:text-primary transition-colors">· {getCategoryLabel(product.category)}</button>}
                                                    </div>
                                                </div>
                                                <div className="hidden sm:block text-right shrink-0 w-28">
                                                    <p className="text-sm font-bold text-primary">Rp {getEffectivePrice(variant).toLocaleString('id-ID')}</p>
                                                    {Number(variant.hpp) > 0 && <p className="text-[10px] text-muted-foreground">HPP: {Number(variant.hpp).toLocaleString('id-ID')}</p>}
                                                </div>
                                                <div className="text-right shrink-0 w-16">
                                                    {product.trackStock === false ? (
                                                        <span className="text-base font-bold text-blue-500">∞</span>
                                                    ) : (
                                                        <span className={cn('text-sm font-semibold', variant.stock < 10 ? 'text-destructive' : 'text-foreground')}>{variant.stock}</span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-0.5 shrink-0">
                                                    <button onClick={() => openMovementModal(variant, product.name)} className="p-1.5 rounded-md text-primary hover:bg-primary/10 transition-colors" title="Sesuaikan Stok">
                                                        <RefreshCw className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button onClick={() => setHistoryVariant({ variant, product })} className="p-1.5 rounded-md text-muted-foreground hover:bg-muted transition-colors" title="Riwayat">
                                                        <History className="h-3.5 w-3.5" />
                                                    </button>
                                                    {isFirst && (
                                                        <div className="relative" data-kebab-dropdown>
                                                            <button onClick={() => setOpenDropdownId(openDropdownId === product.id ? null : product.id)} className="p-1.5 rounded-md text-muted-foreground hover:bg-muted">
                                                                <MoreVertical className="h-3.5 w-3.5" />
                                                            </button>
                                                            {openDropdownId === product.id && (
                                                                <div className="absolute right-0 top-full mt-1 w-52 max-w-[calc(100vw-2rem)] bg-card border border-border rounded-xl shadow-xl z-30 py-1.5 overflow-hidden">
                                                                    <button onClick={() => { setWasteVariant(variant); setShowWasteModal(true); closeDropdown(); }} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors">
                                                                        <Trash2 className="h-3.5 w-3.5 shrink-0" /> Catat Susut
                                                                    </button>
                                                                    <div className="h-px bg-border/60 my-1" />
                                                                    <button onClick={() => { router.push(`/inventory/products/${product.id}/edit`); closeDropdown(); }} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm hover:bg-muted transition-colors">
                                                                        <Pencil className="h-3.5 w-3.5 shrink-0" /> Edit Produk
                                                                    </button>
                                                                    <button onClick={() => { handleShare(product.id); closeDropdown(); }} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/30 transition-colors">
                                                                        <Share2 className="h-3.5 w-3.5 shrink-0" /> {shareToastId === product.id ? 'Tersalin!' : 'Salin Link'}
                                                                    </button>
                                                                    <div className="h-px bg-border/60 my-1" />
                                                                    <button onClick={() => { setDeletingProductId(product.id); closeDropdown(); }} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors">
                                                                        <Trash2 className="h-3.5 w-3.5 shrink-0" /> Hapus
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* ── Desktop: Grid (kartu produk) ── */}
                {viewMode === 'grid' && (
                    <div className="hidden sm:block p-3 sm:p-4">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-12 text-muted-foreground">
                                <Loader2 className="h-5 w-5 animate-spin" />
                            </div>
                        ) : groupedProducts.length === 0 ? (
                            <EmptyState
                                icon={Package}
                                title={searchText || hasActiveFilters ? 'Tidak ditemukan' : 'Belum ada produk'}
                                description={searchText || hasActiveFilters ? 'Coba ubah kata kunci atau reset filter.' : 'Mulai dengan klik tombol Tambah Produk.'}
                            />
                        ) : (
                            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4">
                                {visibleGrouped.map(({ product, matchedVariants }) => {
                                    const productImages = product.imageUrls ? (() => { try { return JSON.parse(product.imageUrls); } catch { return []; } })() : [];
                                    const typeCfg = PRODUCT_TYPE_CONFIG[product.productType || 'SELLABLE'];
                                    const firstVariant = matchedVariants[0];
                                    const avatarSrc = firstVariant.variantImageUrl || productImages[0] || product.imageUrl;
                                    const minPrice = Math.min(...matchedVariants.map((v: any) => getEffectivePrice(v)));
                                    const maxPrice = Math.max(...matchedVariants.map((v: any) => getEffectivePrice(v)));
                                    const totalStock = matchedVariants.reduce((s: number, v: any) => s + Number(v.stock || 0), 0);
                                    const lowStock = product.trackStock !== false && totalStock < 10;
                                    return (
                                        <div key={product.id} className={cn('group relative flex flex-col rounded-xl border border-border bg-card shadow-sm hover:shadow-md hover:border-primary/40 transition-all overflow-hidden', selectedIds.has(product.id) && 'ring-2 ring-destructive/40')}>
                                            {/* Checkbox overlay */}
                                            <div className="absolute top-2 left-2 z-10">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.has(product.id)}
                                                    onChange={() => toggleSelect(product.id)}
                                                    className="w-4 h-4 rounded accent-primary bg-card/80 backdrop-blur"
                                                />
                                            </div>
                                            {/* Type badge */}
                                            {typeCfg && (
                                                <span className={cn('absolute top-2 right-2 z-10 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border', typeCfg.className)}>
                                                    {typeCfg.label}
                                                </span>
                                            )}
                                            {/* Image */}
                                            <ProductImageFill
                                                src={avatarSrc ? `${API_BASE}${avatarSrc}` : null}
                                                alt={product.name}
                                                className="aspect-square"
                                                fallback={<ImageIcon className="w-10 h-10 text-muted-foreground/30" />}
                                            />
                                            {/* Body */}
                                            <div className="flex-1 flex flex-col p-3">
                                                <p className="text-sm font-semibold text-foreground line-clamp-2 leading-snug">{product.name}</p>
                                                {product.category?.name && (
                                                    <button type="button" onClick={() => setCategoryEditProduct(product)} title="Klik untuk ganti kategori" className="block max-w-full text-left text-[11px] text-muted-foreground mt-0.5 truncate hover:text-primary transition-colors">{getCategoryLabel(product.category)}</button>
                                                )}
                                                <div className="mt-2 flex items-baseline gap-1">
                                                    <span className="text-base font-bold text-primary">
                                                        Rp {minPrice === maxPrice ? minPrice.toLocaleString('id-ID') : `${(minPrice / 1000).toFixed(0)}–${(maxPrice / 1000).toFixed(0)}rb`}
                                                    </span>
                                                </div>
                                                <div className="mt-2 flex items-center justify-between text-xs">
                                                    {product.trackStock === false ? (
                                                        <span className="inline-flex items-center gap-1 text-blue-500 font-medium">
                                                            <span className="text-base leading-none">∞</span> Tak terbatas
                                                        </span>
                                                    ) : (
                                                        <span className={cn('inline-flex items-center gap-1 font-medium', lowStock ? 'text-destructive' : 'text-muted-foreground')}>
                                                            <Package className="h-3 w-3" />
                                                            {totalStock} stok {lowStock && '· menipis'}
                                                        </span>
                                                    )}
                                                    {matchedVariants.length > 1 && (
                                                        <span className="text-muted-foreground">{matchedVariants.length} varian</span>
                                                    )}
                                                </div>
                                                {/* Actions */}
                                                <div className="mt-3 pt-3 border-t border-border/60 flex flex-wrap items-center gap-1">
                                                    <button onClick={() => openMovementModal(firstVariant, product.name)} className="flex-1 h-8 inline-flex items-center justify-center gap-1 rounded-lg border border-border bg-background px-2 text-xs font-medium text-foreground hover:bg-muted transition-colors">
                                                        <RefreshCw className="h-3.5 w-3.5" /> Stok
                                                    </button>
                                                    <button onClick={() => router.push(`/inventory/products/${product.id}/edit`)} className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Edit">
                                                        <Pencil className="h-3 w-3" />
                                                    </button>
                                                    <div className="relative" data-kebab-dropdown>
                                                        <button onClick={() => setOpenDropdownId(openDropdownId === product.id ? null : product.id)} className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                                                            <MoreVertical className="h-3 w-3" />
                                                        </button>
                                                        {openDropdownId === product.id && (
                                                            <div className="absolute right-0 bottom-full mb-1 w-48 bg-card border border-border rounded-xl shadow-xl z-30 py-1.5 overflow-hidden">
                                                                <button onClick={() => { setHistoryVariant({ variant: firstVariant, product }); closeDropdown(); }} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm hover:bg-muted">
                                                                    <History className="h-3.5 w-3.5" /> Riwayat Stok
                                                                </button>
                                                                <button onClick={() => { setWasteVariant(firstVariant); setShowWasteModal(true); closeDropdown(); }} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30">
                                                                    <Trash2 className="h-3.5 w-3.5" /> Catat Susut
                                                                </button>
                                                                <button onClick={() => { handleShare(product.id); closeDropdown(); }} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/30">
                                                                    <Share2 className="h-3.5 w-3.5" /> {shareToastId === product.id ? 'Tersalin!' : 'Salin Link'}
                                                                </button>
                                                                <div className="h-px bg-border/60 my-1" />
                                                                <button onClick={() => { setDeletingProductId(product.id); closeDropdown(); }} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-destructive hover:bg-destructive/10">
                                                                    <Trash2 className="h-3.5 w-3.5" /> Hapus
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* ── Desktop: Galeri (besar fokus visual) ── */}
                {viewMode === 'gallery' && (
                    <div className="hidden sm:block p-4 sm:p-5">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-12 text-muted-foreground">
                                <Loader2 className="h-5 w-5 animate-spin" />
                            </div>
                        ) : groupedProducts.length === 0 ? (
                            <EmptyState
                                icon={Package}
                                title={searchText || hasActiveFilters ? 'Tidak ditemukan' : 'Belum ada produk'}
                                description={searchText || hasActiveFilters ? 'Coba ubah kata kunci atau reset filter.' : 'Mulai dengan klik tombol Tambah Produk.'}
                            />
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4 sm:gap-5">
                                {visibleGrouped.map(({ product, matchedVariants }) => {
                                    const productImages = product.imageUrls ? (() => { try { return JSON.parse(product.imageUrls); } catch { return []; } })() : [];
                                    const typeCfg = PRODUCT_TYPE_CONFIG[product.productType || 'SELLABLE'];
                                    const firstVariant = matchedVariants[0];
                                    const avatarSrc = firstVariant.variantImageUrl || productImages[0] || product.imageUrl;
                                    const allImages = [avatarSrc, ...productImages.slice(0, 3)].filter(Boolean) as string[];
                                    const totalStock = matchedVariants.reduce((s: number, v: any) => s + Number(v.stock || 0), 0);
                                    const lowStock = product.trackStock !== false && totalStock < 10;
                                    return (
                                        <div key={product.id} className={cn('group flex flex-col sm:flex-row gap-4 rounded-xl border border-border bg-card p-4 shadow-sm hover:shadow-md hover:border-primary/40 transition-all', selectedIds.has(product.id) && 'ring-2 ring-destructive/40')}>
                                            {/* Hero image + thumbnails */}
                                            <div className="sm:w-56 shrink-0">
                                                <ProductImageFill
                                                    src={avatarSrc ? `${API_BASE}${avatarSrc}` : null}
                                                    alt={product.name}
                                                    className="aspect-square rounded-lg border border-border"
                                                    hoverZoom={false}
                                                    fallback={<ImageIcon className="w-12 h-12 text-muted-foreground/30" />}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedIds.has(product.id)}
                                                        onChange={() => toggleSelect(product.id)}
                                                        className="absolute top-2 left-2 z-10 w-4 h-4 rounded accent-primary"
                                                    />
                                                </ProductImageFill>
                                                {allImages.length > 1 && (
                                                    <div className="mt-2 grid grid-cols-4 gap-1">
                                                        {allImages.slice(1, 5).map((img, i) => (
                                                            <div key={i} className="aspect-square rounded-md bg-muted overflow-hidden border border-border">
                                                                <img src={`${API_BASE}${img}`} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            {/* Body */}
                                            <div className="flex-1 min-w-0 flex flex-col">
                                                <div className="flex items-start gap-2 flex-wrap">
                                                    <h3 className="text-base sm:text-lg font-bold text-foreground flex-1">{product.name}</h3>
                                                    {typeCfg && (
                                                        <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border', typeCfg.className)}>
                                                            {typeCfg.label}
                                                        </span>
                                                    )}
                                                </div>
                                                {product.category?.name && (
                                                    <button type="button" onClick={() => setCategoryEditProduct(product)} title="Klik untuk ganti kategori" className="block text-left text-xs text-muted-foreground mt-1 hover:text-primary transition-colors">{getCategoryLabel(product.category)}</button>
                                                )}
                                                {/* Variant chips */}
                                                <div className="mt-3 flex flex-wrap gap-1.5">
                                                    {matchedVariants.slice(0, 6).map((v: any) => (
                                                        <span key={v.id} className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/50 px-2 py-0.5 text-[11px] text-foreground">
                                                            <span className="font-mono text-muted-foreground">{v.sku}</span>
                                                            {v.variantName && <span>· {v.variantName}</span>}
                                                            <span className={cn('font-semibold', v.stock < 10 && product.trackStock !== false && 'text-destructive')}>
                                                                {product.trackStock === false ? '∞' : v.stock}
                                                            </span>
                                                        </span>
                                                    ))}
                                                    {matchedVariants.length > 6 && (
                                                        <span className="text-[11px] text-muted-foreground self-center">+{matchedVariants.length - 6}</span>
                                                    )}
                                                </div>
                                                {/* Pricing summary */}
                                                <div className="mt-auto pt-3 flex items-end justify-between gap-3 flex-wrap">
                                                    <div>
                                                        <p className="text-[11px] text-muted-foreground">Mulai dari</p>
                                                        <p className="text-xl font-bold text-primary">
                                                            Rp {Math.min(...matchedVariants.map((v: any) => getEffectivePrice(v))).toLocaleString('id-ID')}
                                                        </p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-[11px] text-muted-foreground">Total stok</p>
                                                        <p className={cn('text-lg font-bold', lowStock ? 'text-destructive' : 'text-foreground')}>
                                                            {product.trackStock === false ? '∞' : totalStock}
                                                        </p>
                                                    </div>
                                                </div>
                                                {/* Actions */}
                                                <div className="mt-3 pt-3 border-t border-border/60 flex flex-wrap items-center gap-1.5">
                                                    <button onClick={() => openMovementModal(firstVariant, product.name)} className="h-8 inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 text-xs font-medium text-primary hover:bg-primary/20">
                                                        <RefreshCw className="h-3.5 w-3.5" /> Sesuaikan Stok
                                                    </button>
                                                    <button onClick={() => router.push(`/inventory/products/${product.id}/edit`)} className="h-8 inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-xs font-medium hover:bg-muted">
                                                        <Pencil className="h-3.5 w-3.5" /> Edit
                                                    </button>
                                                    <button onClick={() => setHistoryVariant({ variant: firstVariant, product })} className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:bg-muted" title="Riwayat">
                                                        <History className="h-3.5 w-3.5" />
                                                    </button>
                                                    <div className="relative ml-auto" data-kebab-dropdown>
                                                        <button onClick={() => setOpenDropdownId(openDropdownId === product.id ? null : product.id)} className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:bg-muted">
                                                            <MoreVertical className="h-3.5 w-3.5" />
                                                        </button>
                                                        {openDropdownId === product.id && (
                                                            <div className="absolute right-0 bottom-full mb-1 w-48 bg-card border border-border rounded-xl shadow-xl z-30 py-1.5 overflow-hidden">
                                                                <button onClick={() => { setWasteVariant(firstVariant); setShowWasteModal(true); closeDropdown(); }} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30">
                                                                    <Trash2 className="h-3.5 w-3.5" /> Catat Susut
                                                                </button>
                                                                <button onClick={() => { handleShare(product.id); closeDropdown(); }} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/30">
                                                                    <Share2 className="h-3.5 w-3.5" /> {shareToastId === product.id ? 'Tersalin!' : 'Salin Link'}
                                                                </button>
                                                                <div className="h-px bg-border/60 my-1" />
                                                                <button onClick={() => { setDeletingProductId(product.id); closeDropdown(); }} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-destructive hover:bg-destructive/10">
                                                                    <Trash2 className="h-3.5 w-3.5" /> Hapus
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>
            {hasMoreGrouped && (
                <div className="px-4 sm:px-6 lg:px-8 pt-3 pb-6">
                    <div ref={groupedSentinel} className="h-1" />
                    <button type="button" onClick={loadMoreGrouped} className="mx-auto block text-xs text-muted-foreground hover:text-foreground py-2.5 px-5 rounded-lg border border-border">
                        Muat lebih banyak ({remainingGrouped} produk lagi)
                    </button>
                </div>
            )}
            </div>{/* end content wrapper */}

            {/* Bulk Delete Confirmation Modal */}
            {showBulkDeleteModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="glass-strong rounded-xl border border-border p-6 max-w-sm w-full shadow-xl">
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
                    <div className="glass-strong rounded-xl border border-border p-6 max-w-sm w-full shadow-xl">
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

            {/* Modal pintar input stok: tab Masuk / Keluar / Setel */}
            {isModalOpen && selectedVariant && (
                <SmartStockModal
                    variant={selectedVariant}
                    productName={selectedVariant.productName}
                    onClose={() => setIsModalOpen(false)}
                    onSubmit={adjustStock}
                />
            )}

            {/* Waste Recording Modal */}
            {showWasteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/88 backdrop-blur-3xl">
                    <div className="glass-strong w-full max-w-md rounded-xl border border-border shadow-lg overflow-hidden">
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

            {/* Panel kategori & unit inline (slide-over) */}
            <CategoryPanel open={showCategoryPanel} onClose={() => setShowCategoryPanel(false)} />
            <UnitPanel open={showUnitPanel} onClose={() => setShowUnitPanel(false)} />

            {/* Modal ganti kategori cepat */}
            {categoryEditProduct && (
                <ChangeCategoryModal product={categoryEditProduct} onClose={() => setCategoryEditProduct(null)} />
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
