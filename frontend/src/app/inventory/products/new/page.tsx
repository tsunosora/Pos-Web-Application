"use client";

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCategories, getUnits, createProduct, uploadProductImages, uploadVariantImage, getSettings, getProducts } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, Save, Upload, Image as ImageIcon, FlaskConical, X, Ruler, Package, Link2, RefreshCw, ChevronDown, ChevronUp, Layers, Zap } from 'lucide-react';
import Link from 'next/link';

// Auto-generate SKU helper
function generateSku(productName: string, index: number): string {
    if (!productName.trim()) return '';
    const words = productName.trim().split(/\s+/).filter(Boolean);
    let prefix = '';
    if (words.length === 1) {
        prefix = words[0].substring(0, 3).toUpperCase();
    } else {
        prefix = words.map(w => w[0].toUpperCase()).join('').substring(0, 4);
    }
    const num = String(index + 1).padStart(3, '0');
    const rand = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `${prefix}-${num}-${rand}`;
}

interface PriceTierForm {
    tierName: string;
    minQty: string;
    maxQty: string;
    price: string;
}

interface VariantIngredientForm {
    name: string;
    quantity: string;
    unit: string;
    price: string;
    isServiceCost: boolean;
    rawMaterialVariantId?: number | null;
}

interface VariantForm {
    sku: string;
    variantName: string;
    price: string;
    hpp: string;
    stock: string;
    size: string;
    color: string;
    imageFile: File | null;
    imagePreview: string | null;
    skuManuallyEdited: boolean;
    isRollMaterial: boolean;
    rollPhysicalWidth: string;
    rollEffectivePrintWidth: string;
    priceTiers: PriceTierForm[];
    variantIngredients: VariantIngredientForm[];
    showPriceTiers: boolean;
    showVariantIngredients: boolean;
}

interface IngredientForm {
    name: string;
    quantity: string;
    unit: string;
    rawMaterialVariantId?: number | null;
}

const defaultVariant = (): VariantForm => ({
    sku: '', variantName: '', price: '', hpp: '', stock: '', size: '', color: '',
    imageFile: null, imagePreview: null, skuManuallyEdited: false,
    isRollMaterial: false, rollPhysicalWidth: '', rollEffectivePrintWidth: '',
    priceTiers: [], variantIngredients: [],
    showPriceTiers: false, showVariantIngredients: false,
});

export default function AddProductPage() {
    const router = useRouter();
    const queryClient = useQueryClient();

    const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: getCategories });
    const { data: units } = useQuery({ queryKey: ['units'], queryFn: getUnits });
    const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: getSettings });
    const { data: products } = useQuery({ queryKey: ['products'], queryFn: getProducts });

    const allVariants = (products as any[])?.flatMap((p: any) =>
        p.variants.map((v: any) => ({
            id: v.id,
            label: `${p.name}${v.variantName ? ` — ${v.variantName}` : ''}${v.size ? ` (${v.size})` : ''} [${v.sku}]`,
        }))
    ) ?? [];

    const [productForm, setProductForm] = useState({ name: '', description: '', categoryId: '', unitId: '' });
    const [pricingMode, setPricingMode] = useState<'UNIT' | 'AREA_BASED'>('UNIT');
    const [productType, setProductType] = useState<'SELLABLE' | 'RAW_MATERIAL' | 'SERVICE'>('SELLABLE');
    const [pricePerUnit, setPricePerUnit] = useState('');
    const [requiresProduction, setRequiresProduction] = useState(false);
    const [hasAssemblyStage, setHasAssemblyStage] = useState(false);
    const [trackStock, setTrackStock] = useState(true);

    // Multi-image state (up to 4)
    const [imageFiles, setImageFiles] = useState<(File | null)[]>([null, null, null, null]);
    const [imagePreviews, setImagePreviews] = useState<(string | null)[]>([null, null, null, null]);

    const [variants, setVariants] = useState<VariantForm[]>([defaultVariant()]);
    const [ingredients, setIngredients] = useState<IngredientForm[]>([]);
    const [showIngredients, setShowIngredients] = useState(false);

    // Auto-update SKUs when product name changes
    useEffect(() => {
        setVariants(prev => prev.map((v, i) => ({
            ...v,
            sku: v.skuManuallyEdited ? v.sku : generateSku(productForm.name, i)
        })));
    }, [productForm.name]);

    const mutation = useMutation({
        mutationFn: createProduct,
        onSuccess: async (data) => {
            // Upload product images
            const filesToUpload = imageFiles.filter(Boolean) as File[];
            if (filesToUpload.length > 0 && data.id) {
                try { await uploadProductImages(data.id, filesToUpload); } catch (e) { console.error(e); }
            }
            // Upload variant images
            for (let i = 0; i < variants.length; i++) {
                const v = variants[i];
                if (v.imageFile && data.variants?.[i]?.id) {
                    try { await uploadVariantImage(data.variants[i].id, v.imageFile); } catch (e) { console.error(e); }
                }
            }
            queryClient.invalidateQueries({ queryKey: ['products'] });
            router.push('/inventory');
        }
    });

    const handleProductImageChange = (slotIndex: number, e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setImageFiles(prev => { const next = [...prev]; next[slotIndex] = file; return next; });
            setImagePreviews(prev => { const next = [...prev]; next[slotIndex] = URL.createObjectURL(file); return next; });
        }
    };

    const removeProductImage = (slotIndex: number) => {
        setImageFiles(prev => { const next = [...prev]; next[slotIndex] = null; return next; });
        setImagePreviews(prev => { const next = [...prev]; next[slotIndex] = null; return next; });
    };

    const addVariant = () => {
        setVariants(prev => {
            const newIndex = prev.length;
            return [...prev, { ...defaultVariant(), sku: generateSku(productForm.name, newIndex) }];
        });
    };

    const removeVariant = (index: number) => {
        setVariants(prev => {
            const next = prev.filter((_, i) => i !== index);
            return next.map((v, i) => ({ ...v, sku: v.skuManuallyEdited ? v.sku : generateSku(productForm.name, i) }));
        });
    };

    const updateVariant = (index: number, field: keyof VariantForm, value: any) => {
        setVariants(prev => {
            const next = [...prev];
            if (field === 'sku') {
                next[index] = { ...next[index], sku: value, skuManuallyEdited: true };
            } else {
                (next[index] as any)[field] = value;
            }
            return next;
        });
    };

    const generateSkuForVariant = (index: number) => {
        setVariants(prev => {
            const next = [...prev];
            next[index] = { ...next[index], sku: generateSku(productForm.name, index), skuManuallyEdited: false };
            return next;
        });
    };

    const handleVariantImageChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const preview = URL.createObjectURL(file);
            updateVariant(index, 'imageFile', file);
            updateVariant(index, 'imagePreview', preview);
        }
    };

    // Ingredients
    const addIngredient = () => setIngredients(prev => [...prev, { name: '', quantity: '', unit: '', rawMaterialVariantId: null }]);
    const removeIngredient = (i: number) => setIngredients(prev => prev.filter((_, idx) => idx !== i));
    const updateIngredient = (i: number, field: keyof IngredientForm, value: any) => {
        setIngredients(prev => { const next = [...prev]; next[i] = { ...next[i], [field]: value }; return next; });
    };
    const handleIngredientStockLink = (i: number, variantId: number | null) => {
        const variant = variantId ? allVariants.find(v => v.id === variantId) : null;
        setIngredients(prev => {
            const next = [...prev];
            next[i] = {
                ...next[i],
                rawMaterialVariantId: variantId,
                name: !next[i].name && variant ? variant.label.split(' [')[0] : next[i].name,
            };
            return next;
        });
    };

    // ── Price Tiers ──────────────────────────────────────────────────────────
    const addPriceTier = (variantIndex: number) => {
        setVariants(prev => {
            const next = [...prev];
            next[variantIndex] = {
                ...next[variantIndex],
                priceTiers: [...next[variantIndex].priceTiers, { tierName: '', minQty: '', maxQty: '', price: '' }]
            };
            return next;
        });
    };
    const removePriceTier = (variantIndex: number, tierIndex: number) => {
        setVariants(prev => {
            const next = [...prev];
            next[variantIndex] = {
                ...next[variantIndex],
                priceTiers: next[variantIndex].priceTiers.filter((_, i) => i !== tierIndex)
            };
            return next;
        });
    };
    const updatePriceTier = (variantIndex: number, tierIndex: number, field: keyof PriceTierForm, value: string) => {
        setVariants(prev => {
            const next = [...prev];
            const tiers = [...next[variantIndex].priceTiers];
            tiers[tierIndex] = { ...tiers[tierIndex], [field]: value };
            next[variantIndex] = { ...next[variantIndex], priceTiers: tiers };
            return next;
        });
    };

    // ── Variant Ingredients ──────────────────────────────────────────────────
    const addVariantIngredient = (variantIndex: number) => {
        setVariants(prev => {
            const next = [...prev];
            next[variantIndex] = {
                ...next[variantIndex],
                variantIngredients: [...next[variantIndex].variantIngredients,
                    { name: '', quantity: '', unit: '', price: '', isServiceCost: false, rawMaterialVariantId: null }]
            };
            return next;
        });
    };
    const removeVariantIngredient = (variantIndex: number, ingIndex: number) => {
        setVariants(prev => {
            const next = [...prev];
            next[variantIndex] = {
                ...next[variantIndex],
                variantIngredients: next[variantIndex].variantIngredients.filter((_, i) => i !== ingIndex)
            };
            return next;
        });
    };
    const updateVariantIngredient = (variantIndex: number, ingIndex: number, field: keyof VariantIngredientForm, value: any) => {
        setVariants(prev => {
            const next = [...prev];
            const ings = [...next[variantIndex].variantIngredients];
            ings[ingIndex] = { ...ings[ingIndex], [field]: value };
            next[variantIndex] = { ...next[variantIndex], variantIngredients: ings };
            return next;
        });
    };
    const handleVariantIngredientStockLink = (variantIndex: number, ingIndex: number, variantId: number | null) => {
        const linked = variantId ? allVariants.find((v: any) => v.id === variantId) : null;
        setVariants(prev => {
            const next = [...prev];
            const ings = [...next[variantIndex].variantIngredients];
            ings[ingIndex] = {
                ...ings[ingIndex],
                rawMaterialVariantId: variantId,
                name: !ings[ingIndex].name && linked ? linked.label.split(' [')[0] : ings[ingIndex].name,
            };
            next[variantIndex] = { ...next[variantIndex], variantIngredients: ings };
            return next;
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const payload: any = {
            ...productForm,
            categoryId: Number(productForm.categoryId),
            unitId: Number(productForm.unitId),
            pricingMode,
            productType,
            requiresProduction,
            hasAssemblyStage,
            trackStock,
            pricePerUnit: pricingMode === 'AREA_BASED' ? Number(pricePerUnit) : undefined,
            variants: variants.map(v => ({
                sku: v.sku,
                variantName: v.variantName || undefined,
                price: Number(v.price),
                hpp: Number(v.hpp) || 0,
                stock: Number(v.stock),
                size: v.size || undefined,
                color: v.color || undefined,
                isRollMaterial: v.isRollMaterial,
                rollPhysicalWidth: v.isRollMaterial && v.rollPhysicalWidth ? Number(v.rollPhysicalWidth) : undefined,
                rollEffectivePrintWidth: v.isRollMaterial && v.rollEffectivePrintWidth ? Number(v.rollEffectivePrintWidth) : undefined,
                priceTiers: v.priceTiers.filter(t => t.minQty && t.price).map(t => ({
                    tierName: t.tierName || undefined,
                    minQty: Number(t.minQty),
                    maxQty: t.maxQty ? Number(t.maxQty) : null,
                    price: Number(t.price),
                })),
                variantIngredients: v.variantIngredients.filter(i => i.name.trim() && i.quantity).map(i => ({
                    name: i.name,
                    quantity: Number(i.quantity),
                    unit: i.unit,
                    price: Number(i.price) || 0,
                    isServiceCost: i.isServiceCost,
                    rawMaterialVariantId: i.rawMaterialVariantId || null,
                })),
            })),
            ingredients: showIngredients ? ingredients
                .filter(ing => ing.name.trim())
                .map(ing => ({
                    name: ing.name,
                    quantity: Number(ing.quantity) || 0,
                    unit: ing.unit,
                    rawMaterialVariantId: ing.rawMaterialVariantId || null,
                }))
                : []
        };
        mutation.mutate(payload);
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-20">
            <div className="flex items-center gap-4">
                <Link href="/inventory" className="p-2 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Tambah Produk Baru</h1>
                    <p className="text-sm text-muted-foreground">Isi detail produk, varian, dan bahan (opsional).</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Info */}
                <div className="glass p-6 rounded-xl border border-border space-y-5 shadow-sm">
                    <h2 className="text-base font-semibold border-b border-border pb-3">Informasi Dasar</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Nama Produk *</label>
                            <input
                                required type="text" value={productForm.name}
                                onChange={e => setProductForm({ ...productForm, name: e.target.value })}
                                placeholder="Contoh: Kopi Susu Gula Aren"
                                className="w-full px-4 py-2.5 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Kategori *</label>
                                <select required value={productForm.categoryId} onChange={e => setProductForm({ ...productForm, categoryId: e.target.value })} className="w-full px-3 py-2.5 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm appearance-none">
                                    <option value="" disabled>Pilih</option>
                                    {categories?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Unit *</label>
                                <select required value={productForm.unitId} onChange={e => setProductForm({ ...productForm, unitId: e.target.value })} className="w-full px-3 py-2.5 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm appearance-none">
                                    <option value="" disabled>Pilih</option>
                                    {units?.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Multi-image upload (max 4) */}
                        <div className="space-y-2 md:col-span-2">
                            <label className="text-sm font-medium">Gambar Produk <span className="text-muted-foreground font-normal">(maks. 4 gambar)</span></label>
                            <div className="grid grid-cols-4 gap-3">
                                {[0, 1, 2, 3].map(slotIndex => (
                                    <div key={slotIndex} className="aspect-square relative">
                                        {imagePreviews[slotIndex] ? (
                                            <div className="relative w-full h-full rounded-xl overflow-hidden border border-border">
                                                <img src={imagePreviews[slotIndex]!} alt={`Gambar ${slotIndex + 1}`} className="w-full h-full object-cover" />
                                                <button
                                                    type="button"
                                                    onClick={() => removeProductImage(slotIndex)}
                                                    className="absolute top-1.5 right-1.5 bg-destructive p-1 rounded-full text-white shadow-md hover:bg-destructive/90 transition-colors"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                                {slotIndex === 0 && (
                                                    <div className="absolute bottom-1.5 left-1.5 bg-primary/80 text-primary-foreground text-xs px-1.5 py-0.5 rounded font-medium backdrop-blur-sm">Utama</div>
                                                )}
                                            </div>
                                        ) : (
                                            <label className={`flex flex-col items-center justify-center w-full h-full border-2 border-dashed rounded-xl cursor-pointer hover:bg-muted/50 transition-colors ${slotIndex === 0 ? 'border-primary/40 bg-primary/5' : 'border-border'}`}>
                                                <Upload className={`w-5 h-5 mb-1 ${slotIndex === 0 ? 'text-primary/60' : 'text-muted-foreground'}`} />
                                                <span className={`text-xs font-medium ${slotIndex === 0 ? 'text-primary/60' : 'text-muted-foreground'}`}>
                                                    {slotIndex === 0 ? 'Utama' : `+${slotIndex + 1}`}
                                                </span>
                                                <input type="file" className="hidden" accept="image/*" onChange={e => handleProductImageChange(slotIndex, e)} />
                                            </label>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <p className="text-xs text-muted-foreground">Gambar pertama akan menjadi gambar utama produk.</p>
                        </div>

                        <div className="space-y-2 md:col-span-2">
                            <label className="text-sm font-medium">Deskripsi</label>
                            <textarea
                                rows={3} value={productForm.description}
                                onChange={e => setProductForm({ ...productForm, description: e.target.value })}
                                placeholder="Deskripsi singkat produk..."
                                className="w-full px-4 py-2.5 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm resize-none"
                            />
                        </div>

                        <div className="space-y-2 md:col-span-2">
                            <label className="text-sm font-medium">Tipe Produk</label>
                            <div className="grid grid-cols-3 gap-3">
                                {([
                                    { value: 'SELLABLE',     label: 'Siap Jual',  desc: 'Produk retail / dagangan langsung.',   cls: 'border-emerald-400 bg-emerald-50',   dot: 'bg-emerald-500' },
                                    { value: 'RAW_MATERIAL', label: 'Bahan Baku', desc: 'Material untuk produksi / resep.',      cls: 'border-amber-400 bg-amber-50',       dot: 'bg-amber-500' },
                                    { value: 'SERVICE',      label: 'Jasa',       desc: 'Layanan, tidak ada stok fisik.',        cls: 'border-violet-400 bg-violet-50',     dot: 'bg-violet-500' },
                                ] as const).map(opt => (
                                    <div
                                        key={opt.value}
                                        onClick={() => setProductType(opt.value)}
                                        className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${productType === opt.value ? opt.cls : 'border-border hover:border-border/80'}`}
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`w-2 h-2 rounded-full ${opt.dot}`} />
                                            <span className="font-semibold text-sm">{opt.label}</span>
                                            {productType === opt.value && <span className="ml-auto w-2 h-2 rounded-full bg-primary" />}
                                        </div>
                                        <p className="text-xs text-muted-foreground">{opt.desc}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Pricing Mode Card — only shown when Advanced Pricing is enabled in Settings */}
                {settings?.enableAdvancedPricing && (
                    <div className="glass p-6 rounded-xl border border-border shadow-sm">
                        <div className="flex items-center gap-2 border-b border-border pb-3 mb-4">
                            <Ruler className="w-5 h-5 text-muted-foreground" />
                            <h2 className="text-base font-semibold">Mode Pricing</h2>
                            <span className="ml-auto text-xs bg-primary/10 text-primary px-2 py-0.5 rounded font-medium">Digital Printing / Percetakan</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div
                                onClick={() => setPricingMode('UNIT')}
                                className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col gap-1 ${pricingMode === 'UNIT' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'}`}
                            >
                                <div className="flex items-center gap-2">
                                    <Package className="w-4 h-4 text-muted-foreground" />
                                    <span className="font-semibold text-sm">Satuan (UNIT)</span>
                                    {pricingMode === 'UNIT' && <span className="ml-auto w-2 h-2 rounded-full bg-primary" />}
                                </div>
                                <p className="text-xs text-muted-foreground">Harga per pcs/porsi/buah. Untuk toko klontong, cafe, retail biasa.</p>
                            </div>
                            <div
                                onClick={() => setPricingMode('AREA_BASED')}
                                className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col gap-1 ${pricingMode === 'AREA_BASED' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'}`}
                            >
                                <div className="flex items-center gap-2">
                                    <Ruler className="w-4 h-4 text-muted-foreground" />
                                    <span className="font-semibold text-sm">Luas Cetak (m²)</span>
                                    {pricingMode === 'AREA_BASED' && <span className="ml-auto w-2 h-2 rounded-full bg-primary" />}
                                </div>
                                <p className="text-xs text-muted-foreground">Harga per m². Di POS kasir input lebar × tinggi, harga dihitung otomatis.</p>
                            </div>
                        </div>
                        {pricingMode === 'AREA_BASED' && (
                            <p className="mt-3 text-xs text-primary/80 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
                                💡 Isi <strong>Harga/m²</strong> di bagian <strong>Varian Produk</strong> di bawah. Stok diisi dalam satuan <strong>m²</strong> (total bahan tersedia).
                            </p>
                        )}

                        {/* Requires Production */}
                        {pricingMode === 'AREA_BASED' && (
                            <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-border hover:border-primary/30 transition-colors">
                                <input type="checkbox" checked={requiresProduction} onChange={e => setRequiresProduction(e.target.checked)}
                                    className="w-4 h-4 rounded accent-primary" />
                                <div>
                                    <p className="text-sm font-medium">Produk Perlu Antrian Produksi</p>
                                    <p className="text-xs text-muted-foreground">Aktifkan untuk produk cetak yang dikerjakan operator mesin (banner, dll). Stok roll dipotong saat operator konfirmasi, bukan saat checkout kasir.</p>
                                </div>
                            </label>
                        )}
                        {pricingMode === 'AREA_BASED' && requiresProduction && (
                            <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-border hover:border-amber-400/50 transition-colors bg-amber-500/5 mt-2">
                                <input type="checkbox" checked={hasAssemblyStage} onChange={e => setHasAssemblyStage(e.target.checked)}
                                    className="w-4 h-4 rounded accent-amber-500" />
                                <div>
                                    <p className="text-sm font-medium">Produk Rakitan — Ada Tahap Pemasangan</p>
                                    <p className="text-xs text-muted-foreground">Aktifkan jika setelah cetak masih ada tahap assembly (pasang rangka, pasang frame, dll). Stok komponen (BOM) dipotong saat operator konfirmasi pemasangan.</p>
                                </div>
                            </label>
                        )}
                    </div>
                )}

                {/* Track Stock toggle */}
                <div className="glass p-4 rounded-xl border border-border shadow-sm">
                    <label className="flex items-center justify-between gap-3 cursor-pointer">
                        <div>
                            <p className="text-sm font-semibold">Lacak Stok Produk</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {trackStock
                                    ? 'Stok dipantau & dipotong otomatis saat terjual. Cocok untuk produk fisik.'
                                    : 'Stok tidak dipantau — produk selalu bisa dipesan tanpa batas. Cocok untuk jasa, konten digital, atau produk made-to-order.'}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setTrackStock(v => !v)}
                            className={`relative shrink-0 w-12 h-6 rounded-full transition-colors ${trackStock ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                        >
                            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${trackStock ? 'translate-x-6' : 'translate-x-0'}`} />
                        </button>
                    </label>
                    {!trackStock && (
                        <p className="mt-2 text-xs text-blue-600 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2">
                            Produk ini akan tampil dengan ikon ∞ di POS & inventori. Stok tidak akan dipotong saat checkout.
                        </p>
                    )}
                </div>

                {/* Variants */}
                <div className="glass p-6 rounded-xl border border-border space-y-4 shadow-sm">
                    <div className="flex items-center justify-between border-b border-border pb-3">
                        <div>
                            <h2 className="text-base font-semibold">Varian Produk</h2>
                            <p className="text-xs text-muted-foreground mt-0.5">SKU di-generate otomatis dari nama produk. Anda bisa mengubahnya manual.</p>
                        </div>
                        <button type="button" onClick={addVariant} className="flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 bg-primary/10 px-3 py-1.5 rounded-lg hover:bg-primary/20 transition-colors">
                            <Plus className="w-4 h-4" /> Tambah Varian
                        </button>
                    </div>

                    <div className="space-y-4">
                        {variants.map((v, index) => (
                            <div key={index} className="bg-muted/30 p-4 rounded-xl border border-border/60 relative group space-y-4">
                                <div className="flex items-start gap-3">
                                    {/* Variant Image */}
                                    <div className="shrink-0">
                                        <label className="block w-16 h-16 rounded-lg overflow-hidden border-2 border-dashed border-border cursor-pointer hover:border-primary/50 transition-colors relative bg-muted/50">
                                            {v.imagePreview ? (
                                                <>
                                                    <img src={v.imagePreview} alt="" className="w-full h-full object-cover" />
                                                    <div className="absolute inset-0 bg-black/20 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity">
                                                        <Upload className="w-4 h-4 text-white" />
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center h-full">
                                                    <ImageIcon className="w-5 h-5 text-muted-foreground/50" />
                                                    <span className="text-xs text-muted-foreground/50 mt-0.5">Foto</span>
                                                </div>
                                            )}
                                            <input type="file" className="hidden" accept="image/*" onChange={e => handleVariantImageChange(index, e)} />
                                        </label>
                                    </div>

                                    {/* Variant Fields */}
                                    <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-3">
                                        <div className="md:col-span-2 space-y-1">
                                            <label className="text-xs font-medium text-muted-foreground">Nama Varian</label>
                                            <input
                                                type="text" value={v.variantName}
                                                onChange={e => updateVariant(index, 'variantName', e.target.value)}
                                                placeholder="Contoh: Ukuran L, Rasa Original"
                                                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-muted-foreground">
                                                SKU *
                                                {!v.skuManuallyEdited && <span className="ml-1 text-primary/60">(auto)</span>}
                                            </label>
                                            <div className="flex gap-1.5">
                                                <input
                                                    required type="text" value={v.sku}
                                                    onChange={e => updateVariant(index, 'sku', e.target.value)}
                                                    placeholder="AUTO-001"
                                                    className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary font-mono"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => generateSkuForVariant(index)}
                                                    title="Generate SKU otomatis dari nama produk"
                                                    className="px-2.5 py-2 bg-muted border border-border rounded-lg hover:bg-primary/10 hover:border-primary/40 transition-colors text-muted-foreground hover:text-primary shrink-0"
                                                >
                                                    <RefreshCw className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-muted-foreground">
                                                {pricingMode === 'AREA_BASED' ? 'Harga/m² (Rp) *' : 'Harga Jual (Rp) *'}
                                            </label>
                                            <input required type="number" min="0" value={v.price} onChange={e => updateVariant(index, 'price', e.target.value)} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-muted-foreground">
                                                Harga Modal / HPP
                                            </label>
                                            <input type="number" min="0" value={v.hpp} onChange={e => updateVariant(index, 'hpp', e.target.value)} placeholder="Opsional" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary" />
                                        </div>
                                        {trackStock && (
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-muted-foreground">
                                                {pricingMode === 'AREA_BASED' ? 'Stok Bahan (m²) *' : 'Stok Awal *'}
                                            </label>
                                            <input required type="number" min="0" step={pricingMode === 'AREA_BASED' ? '0.01' : '1'} value={v.stock} onChange={e => updateVariant(index, 'stock', e.target.value)} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary" />
                                        </div>
                                        )}
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-muted-foreground">Size</label>
                                            <input type="text" value={v.size} onChange={e => updateVariant(index, 'size', e.target.value)} placeholder="M, L, XL" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-muted-foreground">Warna</label>
                                            <input type="text" value={v.color} onChange={e => updateVariant(index, 'color', e.target.value)} placeholder="Merah, Biru" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary" />
                                        </div>
                                    </div>

                                    {variants.length > 1 && (
                                        <button type="button" onClick={() => removeVariant(index)} className="shrink-0 p-1.5 text-destructive/60 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100 mt-0.5">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>

                                {/* Roll Material fields */}
                                <div className="border-t border-border/50 pt-3 space-y-3">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={v.isRollMaterial} onChange={e => updateVariant(index, 'isRollMaterial', e.target.checked)}
                                            className="w-4 h-4 rounded accent-primary" />
                                        <span className="text-sm font-medium">Ini adalah bahan roll (banner, MMT, dll)</span>
                                    </label>
                                    {v.isRollMaterial && (
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <label className="text-xs font-medium text-muted-foreground">Lebar Fisik Roll (m)</label>
                                                <input type="number" step="0.1" min="0" value={v.rollPhysicalWidth}
                                                    onChange={e => updateVariant(index, 'rollPhysicalWidth', e.target.value)}
                                                    placeholder="3.2"
                                                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary font-mono" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs font-medium text-muted-foreground">Lebar Cetak Efektif (m)</label>
                                                <input type="number" step="0.1" min="0" value={v.rollEffectivePrintWidth}
                                                    onChange={e => updateVariant(index, 'rollEffectivePrintWidth', e.target.value)}
                                                    placeholder="3.0"
                                                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary font-mono" />
                                                <p className="text-xs text-muted-foreground">Area cetak aktual (biasanya lebar fisik - 0.1~0.2m)</p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Harga Bertingkat (Price Tiers) */}
                                {pricingMode === 'UNIT' && (
                                <div className="border-t border-border/50 pt-3 space-y-2">
                                    <button
                                        type="button"
                                        onClick={() => updateVariant(index, 'showPriceTiers', !v.showPriceTiers)}
                                        className="flex items-center justify-between w-full text-sm font-medium text-left"
                                    >
                                        <span className="flex items-center gap-2">
                                            <Layers className="w-4 h-4 text-orange-500" />
                                            Harga Bertingkat
                                            {v.priceTiers.length > 0 && (
                                                <span className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-1.5 py-0.5 rounded font-medium">{v.priceTiers.length} tier</span>
                                            )}
                                        </span>
                                        {v.showPriceTiers ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                                    </button>
                                    {v.showPriceTiers && (
                                        <div className="space-y-2 pt-1">
                                            <p className="text-xs text-muted-foreground">Sistem otomatis memilih harga berdasarkan jumlah qty saat checkout. Isi harga jual di atas sebagai harga default jika qty tidak cocok dengan tier manapun.</p>
                                            {v.priceTiers.map((tier, ti) => (
                                                <div key={ti} className="flex gap-2 items-center bg-orange-50/50 dark:bg-orange-950/20 border border-orange-200/50 dark:border-orange-800/30 rounded-lg p-2">
                                                    <input type="text" value={tier.tierName} onChange={e => updatePriceTier(index, ti, 'tierName', e.target.value)} placeholder="Label (opsional)" className="w-28 px-2 py-1.5 bg-background border border-border rounded text-xs outline-none focus:border-primary" />
                                                    <input type="number" min="1" value={tier.minQty} onChange={e => updatePriceTier(index, ti, 'minQty', e.target.value)} placeholder="Min Qty" className="w-20 px-2 py-1.5 bg-background border border-border rounded text-xs outline-none focus:border-primary" />
                                                    <span className="text-xs text-muted-foreground shrink-0">—</span>
                                                    <input type="number" min="1" value={tier.maxQty} onChange={e => updatePriceTier(index, ti, 'maxQty', e.target.value)} placeholder="Max (kosong = ∞)" className="w-24 px-2 py-1.5 bg-background border border-border rounded text-xs outline-none focus:border-primary" />
                                                    <input type="number" min="0" value={tier.price} onChange={e => updatePriceTier(index, ti, 'price', e.target.value)} placeholder="Harga/unit (Rp)" className="flex-1 px-2 py-1.5 bg-background border border-border rounded text-xs outline-none focus:border-primary" />
                                                    <button type="button" onClick={() => removePriceTier(index, ti)} className="p-1 text-destructive/60 hover:text-destructive hover:bg-destructive/10 rounded transition-colors">
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            ))}
                                            <button type="button" onClick={() => addPriceTier(index)} className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700 font-medium transition-colors">
                                                <Plus className="w-3.5 h-3.5" /> Tambah Tier Harga
                                            </button>
                                        </div>
                                    )}
                                </div>
                                )}

                                {/* Ingredient Varian (Variant-Level BOM) */}
                                <div className="border-t border-border/50 pt-3 space-y-2">
                                    <button
                                        type="button"
                                        onClick={() => updateVariant(index, 'showVariantIngredients', !v.showVariantIngredients)}
                                        className="flex items-center justify-between w-full text-sm font-medium text-left"
                                    >
                                        <span className="flex items-center gap-2">
                                            <Zap className="w-4 h-4 text-purple-500" />
                                            Ingredient Varian
                                            {v.variantIngredients.length > 0 && (
                                                <span className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 px-1.5 py-0.5 rounded font-medium">{v.variantIngredients.length} item</span>
                                            )}
                                        </span>
                                        {v.showVariantIngredients ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                                    </button>
                                    {v.showVariantIngredients && (
                                        <div className="space-y-2 pt-1">
                                            <p className="text-xs text-muted-foreground">Bahan atau biaya yang spesifik untuk varian ini (berbeda tiap varian). Contoh: biaya klik 1 sisi vs 2 sisi, tinta warna vs hitam-putih.</p>
                                            {v.variantIngredients.map((ing, ii) => (
                                                <div key={ii} className="space-y-2 bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/50 dark:border-purple-800/30 rounded-lg p-2">
                                                    <div className="flex items-center gap-2">
                                                        <Link2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                                        <select
                                                            value={ing.rawMaterialVariantId ?? ''}
                                                            onChange={e => handleVariantIngredientStockLink(index, ii, e.target.value ? Number(e.target.value) : null)}
                                                            className="flex-1 px-2 py-1.5 bg-background border border-border rounded text-xs outline-none focus:border-primary"
                                                        >
                                                            <option value="">— Biaya manual / tidak dari stok —</option>
                                                            {allVariants.map((av: any) => (
                                                                <option key={av.id} value={av.id}>{av.label}</option>
                                                            ))}
                                                        </select>
                                                        <label className="flex items-center gap-1 text-xs shrink-0 cursor-pointer">
                                                            <input type="checkbox" checked={ing.isServiceCost} onChange={e => updateVariantIngredient(index, ii, 'isServiceCost', e.target.checked)} className="w-3.5 h-3.5 accent-purple-600" />
                                                            <span className="text-muted-foreground">Biaya Jasa</span>
                                                        </label>
                                                        <button type="button" onClick={() => removeVariantIngredient(index, ii)} className="p-1 text-destructive/60 hover:text-destructive hover:bg-destructive/10 rounded transition-colors">
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <input type="text" value={ing.name} onChange={e => updateVariantIngredient(index, ii, 'name', e.target.value)} placeholder="Nama (contoh: Biaya Klik BW)" className="flex-1 px-2 py-1.5 bg-background border border-border rounded text-xs outline-none focus:border-primary" />
                                                        <input type="number" min="0" step="any" value={ing.quantity} onChange={e => updateVariantIngredient(index, ii, 'quantity', e.target.value)} placeholder="Qty" className="w-16 px-2 py-1.5 bg-background border border-border rounded text-xs outline-none focus:border-primary" />
                                                        <input type="text" value={ing.unit} onChange={e => updateVariantIngredient(index, ii, 'unit', e.target.value)} placeholder="Unit" className="w-16 px-2 py-1.5 bg-background border border-border rounded text-xs outline-none focus:border-primary" />
                                                        <input type="number" min="0" value={ing.price} onChange={e => updateVariantIngredient(index, ii, 'price', e.target.value)} placeholder="Harga/unit" className="w-28 px-2 py-1.5 bg-background border border-border rounded text-xs outline-none focus:border-primary" />
                                                    </div>
                                                    {ing.isServiceCost && (
                                                        <p className="text-xs text-purple-600 dark:text-purple-400">Biaya Jasa — tidak memotong stok inventori, hanya masuk ke perhitungan HPP.</p>
                                                    )}
                                                </div>
                                            ))}
                                            <button type="button" onClick={() => addVariantIngredient(index)} className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700 font-medium transition-colors">
                                                <Plus className="w-3.5 h-3.5" /> Tambah Ingredient Varian
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    <button type="button" onClick={addVariant} className="w-full flex items-center justify-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 bg-primary/10 px-3 py-2 rounded-lg hover:bg-primary/20 transition-colors border border-dashed border-primary/30 hover:border-primary/50 mt-2">
                        <Plus className="w-4 h-4" /> Tambah Varian
                    </button>
                </div>

                {/* Ingredients (optional) */}
                <div className="glass p-6 rounded-xl border border-border shadow-sm">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <FlaskConical className="w-5 h-5 text-muted-foreground" />
                            <div>
                                <h2 className="text-base font-semibold">Bahan (Ingredient)</h2>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {requiresProduction && hasAssemblyStage
                                        ? 'Komponen rakitan (rangka, frame, dll) — dipotong stok saat tahap Pemasangan dimulai.'
                                        : 'Opsional — untuk kalkulasi HPP dan manajemen bahan baku.'}
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => { setShowIngredients(!showIngredients); if (!showIngredients && ingredients.length === 0) addIngredient(); }}
                            className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${showIngredients ? 'bg-muted text-foreground hover:bg-muted/70' : 'bg-primary/10 text-primary hover:bg-primary/20'}`}
                        >
                            {showIngredients ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                            {showIngredients ? 'Tutup' : 'Tambah Bahan'}
                        </button>
                    </div>

                    {showIngredients && (
                        <div className="mt-4 space-y-3">
                            {ingredients.length === 0 && (
                                <p className="text-sm text-muted-foreground text-center py-4">Belum ada bahan. Klik "+ Bahan" untuk menambah.</p>
                            )}
                            {ingredients.map((ing, i) => (
                                <div key={i} className="space-y-2 p-3 bg-muted/20 rounded-lg border border-border/60">
                                    {/* Stock link row */}
                                    <div className="flex items-center gap-2">
                                        <Link2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                        <select
                                            value={ing.rawMaterialVariantId ?? ''}
                                            onChange={e => handleIngredientStockLink(i, e.target.value ? Number(e.target.value) : null)}
                                            className="flex-1 px-3 py-1.5 bg-background border border-border rounded-lg text-xs outline-none focus:border-primary"
                                        >
                                            <option value="">— Bahan manual (tidak terhubung ke stok) —</option>
                                            {allVariants.map((v: any) => (
                                                <option key={v.id} value={v.id}>{v.label}</option>
                                            ))}
                                        </select>
                                        {ing.rawMaterialVariantId && (
                                            <span className="text-xs text-green-600 font-medium shrink-0">Terhubung</span>
                                        )}
                                    </div>
                                    {/* Detail row */}
                                    <div className="flex gap-2 items-center">
                                        <input
                                            type="text" value={ing.name}
                                            onChange={e => updateIngredient(i, 'name', e.target.value)}
                                            placeholder="Nama bahan (contoh: Gula)"
                                            className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary"
                                        />
                                        <input
                                            type="number" min="0" step="any" value={ing.quantity}
                                            onChange={e => updateIngredient(i, 'quantity', e.target.value)}
                                            placeholder="Jumlah"
                                            className="w-24 px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary"
                                        />
                                        <input
                                            type="text" value={ing.unit}
                                            onChange={e => updateIngredient(i, 'unit', e.target.value)}
                                            placeholder="Unit"
                                            className="w-20 px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary"
                                        />
                                        <button type="button" onClick={() => removeIngredient(i)} className="p-2 text-destructive/60 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {ingredients.length > 0 && (
                                <button type="button" onClick={addIngredient} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mt-2 transition-colors">
                                    <Plus className="w-3.5 h-3.5" /> Tambah Bahan Lagi
                                </button>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-3 pt-2">
                    <Link href="/inventory" className="px-5 py-2.5 rounded-lg border border-border hover:bg-muted font-medium text-sm transition-colors">
                        Batal
                    </Link>
                    <button type="submit" disabled={mutation.isPending} className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2.5 rounded-lg font-medium hover:bg-primary/90 transition-colors shadow-md disabled:opacity-50 text-sm">
                        {mutation.isPending ? 'Menyimpan...' : <><Save className="w-4 h-4" /> Simpan Produk</>}
                    </button>
                </div>
            </form>
        </div>
    );
}
