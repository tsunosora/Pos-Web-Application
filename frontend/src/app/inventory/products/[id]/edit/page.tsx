"use client";

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCategories, getUnits, getProduct, updateProduct, uploadProductImages, uploadVariantImage, getSettings, getProducts, getHppWorksheets, createHppWorksheet, updateHppWorksheet, applyHppToVariant } from '@/lib/api';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, Save, Upload, Image as ImageIcon, FlaskConical, X, Ruler, Package, Link2, RefreshCw, Calculator, Pencil } from 'lucide-react';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function calcHppPerUnit(variableCosts: any[], fixedCosts: any[], targetVolume: number): number {
    const totalVC = (variableCosts || []).reduce((s: number, vc: any) => {
        const price = vc.productVariantId
            ? Number(vc.productVariant?.price || 0)
            : (Number(vc.customPrice) || 0);
        return s + price * Number(vc.usageAmount);
    }, 0);
    const totalFC = (fixedCosts || []).reduce((s: number, fc: any) =>
        s + Number(fc.amount), 0) / Math.max(Number(targetVolume) || 1, 1);
    return totalVC + totalFC;
}

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

interface VariantForm {
    id?: number;
    sku: string;
    variantName: string;
    price: string;
    hpp: string;
    stock: string;
    size: string;
    color: string;
    imageFile: File | null;
    imagePreview: string | null;
    existingImageUrl?: string | null;
    isRollMaterial: boolean;
    rollPhysicalWidth: string;
    rollEffectivePrintWidth: string;
    priceTiers: PriceTierForm[];
}

interface IngredientForm {
    id?: number;
    name: string;
    quantity: string;
    unit: string;
    price?: string;
    subtotal?: string;
    rawMaterialVariantId?: number | null;
}

const defaultVariant = (sku = ''): VariantForm => ({
    sku, variantName: '', price: '', hpp: '', stock: '', size: '', color: '',
    imageFile: null, imagePreview: null, existingImageUrl: null,
    isRollMaterial: false, rollPhysicalWidth: '', rollEffectivePrintWidth: '',
    priceTiers: [],
});

export default function EditProductPage() {
    const router = useRouter();
    const params = useParams();
    const productId = Number(params.id);
    const queryClient = useQueryClient();

    const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: getCategories });
    const { data: units } = useQuery({ queryKey: ['units'], queryFn: getUnits });
    const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: getSettings });
    const { data: products } = useQuery({ queryKey: ['products'], queryFn: getProducts });
    const { data: product, isLoading } = useQuery({
        queryKey: ['product', productId],
        queryFn: () => getProduct(productId),
        enabled: !!productId
    });

    const { data: allHppWorksheets, refetch: refetchHpp } = useQuery({
        queryKey: ['hpp-all'],
        queryFn: () => getHppWorksheets(),
    });

    const hppByVariantId = useMemo<Record<number, any[]>>(() => {
        if (!allHppWorksheets) return {};
        const map: Record<number, any[]> = {};
        for (const ws of (allHppWorksheets as any[])) {
            if (ws.productVariantId) {
                map[ws.productVariantId] = map[ws.productVariantId] || [];
                map[ws.productVariantId].push(ws);
            }
        }
        return map;
    }, [allHppWorksheets]);

    const [hppOpenVariants, setHppOpenVariants] = useState<Set<number>>(new Set());
    const [hppEditState, setHppEditState] = useState<{
        worksheetId: number | null;
        variantIndex: number;
        variantId: number;
        variantLabel: string;
        variantPrice: number;
        form: {
            productName: string;
            targetVolume: number;
            targetMargin: number;
            variableCosts: { customMaterialName: string; customPrice: number; usageAmount: number; usageUnit: string }[];
            fixedCosts: { name: string; amount: number }[];
        };
    } | null>(null);
    const [hppSaving, setHppSaving] = useState(false);

    const toggleHppSection = (idx: number) => setHppOpenVariants(prev => {
        const next = new Set(prev);
        next.has(idx) ? next.delete(idx) : next.add(idx);
        return next;
    });

    const openHppEditor = (variantIndex: number, ws: any | null) => {
        const v = variants[variantIndex];
        const label = `${productForm.name}${v.variantName ? ' — ' + v.variantName : ''}`;
        if (ws) {
            setHppEditState({
                worksheetId: ws.id,
                variantIndex,
                variantId: v.id!,
                variantLabel: label,
                variantPrice: Number(v.price),
                form: {
                    productName: ws.productName,
                    targetVolume: Number(ws.targetVolume),
                    targetMargin: Number(ws.targetMargin),
                    variableCosts: (ws.variableCosts || []).map((vc: any) => ({
                        customMaterialName: vc.productVariantId
                            ? (vc.productVariant?.variantName
                                ? `${vc.productVariant?.product?.name} - ${vc.productVariant?.variantName}`
                                : (vc.productVariant?.product?.name || vc.customMaterialName || ''))
                            : (vc.customMaterialName || ''),
                        customPrice: vc.productVariantId
                            ? Number(vc.productVariant?.price || 0)
                            : (Number(vc.customPrice) || 0),
                        usageAmount: Number(vc.usageAmount),
                        usageUnit: vc.usageUnit || 'pcs',
                    })),
                    fixedCosts: (ws.fixedCosts || []).map((fc: any) => ({
                        name: fc.name,
                        amount: Number(fc.amount),
                    })),
                },
            });
        } else {
            setHppEditState({
                worksheetId: null,
                variantIndex,
                variantId: v.id!,
                variantLabel: label,
                variantPrice: Number(v.price),
                form: {
                    productName: label,
                    targetVolume: 100,
                    targetMargin: 50,
                    variableCosts: [{ customMaterialName: '', customPrice: 0, usageAmount: 1, usageUnit: 'pcs' }],
                    fixedCosts: [],
                },
            });
        }
    };

    const handleHppSave = async (applyAfterSave = false) => {
        if (!hppEditState) return;
        setHppSaving(true);
        try {
            const payload = {
                productName: hppEditState.form.productName,
                targetVolume: hppEditState.form.targetVolume,
                targetMargin: hppEditState.form.targetMargin,
                productVariantId: hppEditState.variantId,
                variableCosts: hppEditState.form.variableCosts.filter(vc => vc.customMaterialName),
                fixedCosts: hppEditState.form.fixedCosts.filter(fc => fc.name),
            };
            let savedWs;
            if (hppEditState.worksheetId) {
                savedWs = await updateHppWorksheet(hppEditState.worksheetId, payload);
            } else {
                savedWs = await createHppWorksheet(payload);
            }
            if (applyAfterSave) {
                const hpp = calcHppPerUnit(savedWs.variableCosts, savedWs.fixedCosts, savedWs.targetVolume);
                await applyHppToVariant(savedWs.id, Math.round(hpp));
                updateVariant(hppEditState.variantIndex, 'hpp', String(Math.round(hpp)));
                queryClient.invalidateQueries({ queryKey: ['products'] });
            }
            await refetchHpp();
            setHppEditState(null);
        } catch (err: any) {
            alert('Gagal menyimpan: ' + err.message);
        } finally {
            setHppSaving(false);
        }
    };

    const [productForm, setProductForm] = useState({ name: '', description: '', categoryId: '', unitId: '' });
    const [pricingMode, setPricingMode] = useState<'UNIT' | 'AREA_BASED'>('UNIT');
    const [productType, setProductType] = useState<'SELLABLE' | 'RAW_MATERIAL' | 'SERVICE'>('SELLABLE');
    const [pricePerUnit, setPricePerUnit] = useState('');
    const [requiresProduction, setRequiresProduction] = useState(false);
    const [hasAssemblyStage, setHasAssemblyStage] = useState(false);
    const [trackStock, setTrackStock] = useState(true);
    const [imageFiles, setImageFiles] = useState<(File | null)[]>([null, null, null, null]);
    const [imagePreviews, setImagePreviews] = useState<(string | null)[]>([null, null, null, null]);
    const [existingImageUrls, setExistingImageUrls] = useState<(string | null)[]>([null, null, null, null]);
    const [variants, setVariants] = useState<VariantForm[]>([defaultVariant()]);
    const [deletedVariantIds, setDeletedVariantIds] = useState<number[]>([]);
    const [ingredients, setIngredients] = useState<IngredientForm[]>([]);
    const [showIngredients, setShowIngredients] = useState(false);
    const [initialized, setInitialized] = useState(false);

    const allVariants = (products as any[])?.flatMap((p: any) =>
        p.variants.map((v: any) => ({
            id: v.id,
            label: `${p.name}${v.variantName ? ` — ${v.variantName}` : ''}${v.size ? ` (${v.size})` : ''} [${v.sku}]`,
        }))
    ) ?? [];

    // Pre-fill form when product data arrives
    useEffect(() => {
        if (product && !initialized) {
            setProductForm({
                name: product.name || '',
                description: product.description || '',
                categoryId: String(product.categoryId || ''),
                unitId: String(product.unitId || ''),
            });
            setPricingMode(product.pricingMode || 'UNIT');
            setProductType(product.productType || 'SELLABLE');
            setPricePerUnit(product.pricePerUnit ? String(product.pricePerUnit) : '');
            setRequiresProduction(product.requiresProduction || false);
            setHasAssemblyStage(product.hasAssemblyStage || false);
            setTrackStock(product.trackStock !== false); // default true if not set

            // Parse existing images
            let existingUrls: (string | null)[] = [null, null, null, null];
            if (product.imageUrls) {
                try {
                    const parsed = JSON.parse(product.imageUrls);
                    parsed.slice(0, 4).forEach((url: string, i: number) => { existingUrls[i] = url; });
                } catch { }
            } else if (product.imageUrl) {
                existingUrls[0] = product.imageUrl;
            }
            setExistingImageUrls(existingUrls);
            setImagePreviews(existingUrls.map(url => url ? `${API_BASE}${url}` : null));

            // Variants
            setVariants(product.variants?.map((v: any) => ({
                id: v.id,
                sku: v.sku || '',
                variantName: v.variantName || '',
                price: String(v.price || ''),
                hpp: String(v.hpp || ''),
                stock: String(v.stock || 0),
                size: v.size || '',
                color: v.color || '',
                imageFile: null,
                imagePreview: v.variantImageUrl ? `${API_BASE}${v.variantImageUrl}` : null,
                existingImageUrl: v.variantImageUrl || null,
                isRollMaterial: v.isRollMaterial || false,
                rollPhysicalWidth: v.rollPhysicalWidth ? String(v.rollPhysicalWidth) : '',
                rollEffectivePrintWidth: v.rollEffectivePrintWidth ? String(v.rollEffectivePrintWidth) : '',
                priceTiers: (v.priceTiers || []).map((t: any) => ({
                    tierName: t.tierName || '',
                    minQty: String(t.minQty),
                    maxQty: t.maxQty !== null && t.maxQty !== undefined ? String(t.maxQty) : '',
                    price: String(t.price),
                })),
            })) || [defaultVariant()]);

            // Ingredients
            if (product.ingredients && product.ingredients.length > 0) {
                setIngredients(product.ingredients.map((ing: any) => ({
                    id: ing.id,
                    name: ing.name,
                    quantity: String(ing.quantity),
                    unit: ing.unit,
                    price: ing.price !== undefined ? String(ing.price) : '0',
                    subtotal: ing.subtotal !== undefined ? String(ing.subtotal) : '0',
                    rawMaterialVariantId: ing.rawMaterialVariantId ?? null,
                })));
                setShowIngredients(true);
            }

            setInitialized(true);
        }
    }, [product, initialized]);

    const mutation = useMutation({
        mutationFn: async () => {
            const payload: any = {
                name: productForm.name,
                description: productForm.description,
                categoryId: Number(productForm.categoryId),
                unitId: Number(productForm.unitId),
                pricingMode,
                productType,
                requiresProduction,
                hasAssemblyStage,
                trackStock,
                pricePerUnit: pricingMode === 'AREA_BASED' ? Number(pricePerUnit) : null,
                deletedVariantIds: deletedVariantIds.length > 0 ? deletedVariantIds : undefined,
                variants: variants.map(v => ({
                    id: v.id,
                    sku: v.sku,
                    variantName: v.variantName || undefined,
                    price: Number(v.price),
                    hpp: Number(v.hpp) || 0,
                    stock: Number(v.stock),
                    size: v.size || undefined,
                    color: v.color || undefined,
                    isRollMaterial: v.isRollMaterial,
                    rollPhysicalWidth: v.isRollMaterial && v.rollPhysicalWidth ? Number(v.rollPhysicalWidth) : null,
                    rollEffectivePrintWidth: v.isRollMaterial && v.rollEffectivePrintWidth ? Number(v.rollEffectivePrintWidth) : null,
                    priceTiers: v.priceTiers.filter(t => t.minQty && t.price).map(t => ({
                        tierName: t.tierName || null,
                        minQty: parseInt(t.minQty),
                        maxQty: t.maxQty ? parseInt(t.maxQty) : null,
                        price: parseInt(t.price),
                    })),
                })),
                ingredients: ingredients
                    .filter(ing => ing.name.trim())
                    .map(ing => ({
                        name: ing.name,
                        quantity: Number(ing.quantity) || 0,
                        unit: ing.unit,
                        price: Number(ing.price) || 0,
                        subtotal: Number(ing.subtotal) || 0,
                        rawMaterialVariantId: ing.rawMaterialVariantId || null,
                    }))
            };

            const updated = await updateProduct(productId, payload);

            // Upload new product images
            const newFiles = imageFiles.filter(Boolean) as File[];
            if (newFiles.length > 0) {
                await uploadProductImages(productId, newFiles);
            }

            // Upload new variant images
            for (let i = 0; i < variants.length; i++) {
                const v = variants[i];
                if (v.imageFile) {
                    const variantIdToUse = v.id || updated.variants?.[i]?.id;
                    if (variantIdToUse) {
                        try { await uploadVariantImage(variantIdToUse, v.imageFile); } catch (e) { console.error(e); }
                    }
                }
            }
            return updated;
        },
        onSuccess: async () => {
            await queryClient.refetchQueries({ queryKey: ['products'] });
            queryClient.removeQueries({ queryKey: ['product', productId] });
            setDeletedVariantIds([]);
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
        setImagePreviews(prev => { const next = [...prev]; next[slotIndex] = existingImageUrls[slotIndex] ? `${API_BASE}${existingImageUrls[slotIndex]}` : null; return next; });
        setImageFiles(prev => { const next = [...prev]; next[slotIndex] = null; return next; });
        setImagePreviews(prev => { const next = [...prev]; next[slotIndex] = null; return next; });
        setExistingImageUrls(prev => { const next = [...prev]; next[slotIndex] = null; return next; });
    };

    const addVariant = () => setVariants(prev => [...prev, defaultVariant()]);
    const removeVariant = (index: number) => {
        const variant = variants[index];
        if (variant?.id) {
            setDeletedVariantIds(prev => [...prev, variant.id!]);
        }
        setVariants(prev => prev.filter((_, i) => i !== index));
    };

    const updateVariant = (index: number, field: keyof VariantForm, value: any) => {
        setVariants(prev => { const next = [...prev]; (next[index] as any)[field] = value; return next; });
    };

    const addTier = (variantIndex: number) => {
        setVariants(prev => {
            const next = [...prev];
            next[variantIndex] = { ...next[variantIndex], priceTiers: [...next[variantIndex].priceTiers, { tierName: '', minQty: '', maxQty: '', price: '' }] };
            return next;
        });
    };
    const removeTier = (variantIndex: number, tierIndex: number) => {
        setVariants(prev => {
            const next = [...prev];
            next[variantIndex] = { ...next[variantIndex], priceTiers: next[variantIndex].priceTiers.filter((_, i) => i !== tierIndex) };
            return next;
        });
    };
    const updateTier = (variantIndex: number, tierIndex: number, field: keyof PriceTierForm, value: string) => {
        setVariants(prev => {
            const next = [...prev];
            const tiers = [...next[variantIndex].priceTiers];
            tiers[tierIndex] = { ...tiers[tierIndex], [field]: value };
            next[variantIndex] = { ...next[variantIndex], priceTiers: tiers };
            return next;
        });
    };

    const generateSkuForVariant = (index: number) => {
        setVariants(prev => {
            const next = [...prev];
            next[index] = { ...next[index], sku: generateSku(productForm.name, index) };
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

    const addIngredient = () => setIngredients(prev => [...prev, { name: '', quantity: '', unit: '', price: '0', subtotal: '0', rawMaterialVariantId: null }]);
    const removeIngredient = (i: number) => setIngredients(prev => prev.filter((_, idx) => idx !== i));
    const updateIngredient = (i: number, field: keyof IngredientForm, value: any) => {
        setIngredients(prev => { const next = [...prev]; next[i] = { ...next[i], [field]: value }; return next; });
    };
    const handleIngredientStockLink = (i: number, variantId: number | null) => {
        const variant = variantId ? allVariants.find((v: any) => v.id === variantId) : null;
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

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        mutation.mutate();
    };

    if (isLoading) {
        return (
            <div className="max-w-4xl mx-auto py-16 text-center text-muted-foreground">
                <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                Memuat data produk...
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-20">
            <div className="flex items-center gap-4">
                <Link href="/inventory" className="p-2 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Edit Produk</h1>
                    <p className="text-sm text-muted-foreground">{product?.name}</p>
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

                        {/* Multi-image upload */}
                        <div className="space-y-2 md:col-span-2">
                            <label className="text-sm font-medium">Gambar Produk <span className="text-muted-foreground font-normal">(maks. 4 gambar)</span></label>
                            <div className="grid grid-cols-4 gap-3">
                                {[0, 1, 2, 3].map(slotIndex => (
                                    <div key={slotIndex} className="aspect-square relative">
                                        {imagePreviews[slotIndex] ? (
                                            <div className="relative w-full h-full rounded-xl overflow-hidden border border-border">
                                                <img src={imagePreviews[slotIndex]!} alt="" className="w-full h-full object-cover" />
                                                <button type="button" onClick={() => removeProductImage(slotIndex)} className="absolute top-1.5 right-1.5 bg-destructive p-1 rounded-full text-white shadow-md hover:bg-destructive/90">
                                                    <X className="w-3 h-3" />
                                                </button>
                                                {slotIndex === 0 && <div className="absolute bottom-1.5 left-1.5 bg-primary/80 text-primary-foreground text-xs px-1.5 py-0.5 rounded font-medium">Utama</div>}
                                            </div>
                                        ) : (
                                            <label className={`flex flex-col items-center justify-center w-full h-full border-2 border-dashed rounded-xl cursor-pointer hover:bg-muted/50 transition-colors ${slotIndex === 0 ? 'border-primary/40 bg-primary/5' : 'border-border'}`}>
                                                <Upload className={`w-5 h-5 mb-1 ${slotIndex === 0 ? 'text-primary/60' : 'text-muted-foreground'}`} />
                                                <span className={`text-xs ${slotIndex === 0 ? 'text-primary/60' : 'text-muted-foreground'}`}>{slotIndex === 0 ? 'Utama' : `+${slotIndex + 1}`}</span>
                                                <input type="file" className="hidden" accept="image/*" onChange={e => handleProductImageChange(slotIndex, e)} />
                                            </label>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2 md:col-span-2">
                            <label className="text-sm font-medium">Deskripsi</label>
                            <textarea
                                rows={3} value={productForm.description}
                                onChange={e => setProductForm({ ...productForm, description: e.target.value })}
                                className="w-full px-4 py-2.5 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm resize-none"
                            />
                        </div>

                        <div className="space-y-2 md:col-span-2">
                            <label className="text-sm font-medium">Tipe Produk</label>
                            <div className="grid grid-cols-1 min-[480px]:grid-cols-3 gap-2">
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

                {/* Pricing Mode Card */}
                {settings?.enableAdvancedPricing && (
                    <div className="glass p-6 rounded-xl border border-border shadow-sm">
                        <div className="flex items-center gap-2 border-b border-border pb-3 mb-4">
                            <Ruler className="w-5 h-5 text-muted-foreground" />
                            <h2 className="text-base font-semibold">Mode Pricing</h2>
                            <span className="ml-auto text-xs bg-primary/10 text-primary px-2 py-0.5 rounded font-medium">Digital Printing / Percetakan</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div onClick={() => setPricingMode('UNIT')} className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col gap-1 ${pricingMode === 'UNIT' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'}`}>
                                <div className="flex items-center gap-2"><Package className="w-4 h-4 text-muted-foreground" /><span className="font-semibold text-sm">Satuan (UNIT)</span>{pricingMode === 'UNIT' && <span className="ml-auto w-2 h-2 rounded-full bg-primary" />}</div>
                                <p className="text-xs text-muted-foreground">Harga per pcs/porsi. Toko klontong, cafe, retail.</p>
                            </div>
                            <div onClick={() => setPricingMode('AREA_BASED')} className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col gap-1 ${pricingMode === 'AREA_BASED' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'}`}>
                                <div className="flex items-center gap-2"><Ruler className="w-4 h-4 text-muted-foreground" /><span className="font-semibold text-sm">Luas Cetak (m²)</span>{pricingMode === 'AREA_BASED' && <span className="ml-auto w-2 h-2 rounded-full bg-primary" />}</div>
                                <p className="text-xs text-muted-foreground">Harga per m². Di POS kasir input lebar × tinggi.</p>
                            </div>
                        </div>
                        {pricingMode === 'AREA_BASED' && (
                            <div className="mt-4 space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Harga per m² (Rp) *</label>
                                    <input required={pricingMode === 'AREA_BASED'} type="number" min="0" value={pricePerUnit} onChange={e => setPricePerUnit(e.target.value)} placeholder="Contoh: 25000" className="w-full px-4 py-2.5 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm" />
                                </div>
                                <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-border hover:border-primary/30 transition-colors">
                                    <input type="checkbox" checked={requiresProduction} onChange={e => setRequiresProduction(e.target.checked)}
                                        className="w-4 h-4 rounded accent-primary" />
                                    <div>
                                        <p className="text-sm font-medium">Produk Perlu Antrian Produksi</p>
                                        <p className="text-xs text-muted-foreground">Aktifkan untuk produk cetak yang dikerjakan operator mesin. Stok roll dipotong saat operator konfirmasi.</p>
                                    </div>
                                </label>
                                {requiresProduction && (
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
                        <h2 className="text-base font-semibold">Varian Produk</h2>
                        <button type="button" onClick={addVariant} className="flex items-center gap-1.5 text-sm font-medium text-primary bg-primary/10 px-3 py-1.5 rounded-lg hover:bg-primary/20 transition-colors">
                            <Plus className="w-4 h-4" /> Tambah Varian
                        </button>
                    </div>

                    <div className="space-y-3">
                        {variants.map((v, index) => (
                            <div key={index} className="bg-muted/30 rounded-xl border border-border/60 overflow-hidden">

                                {/* Header: Foto + Nama + Hapus */}
                                <div className="flex items-center gap-3 p-3 bg-background border-b border-border/40">
                                    <label className="shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 border-dashed border-border cursor-pointer hover:border-primary/50 transition-colors relative bg-muted/50">
                                        {v.imagePreview ? (
                                            <img src={v.imagePreview} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="flex flex-col items-center justify-center h-full gap-0.5">
                                                <ImageIcon className="w-4 h-4 text-muted-foreground/50" />
                                                <span className="text-[10px] text-muted-foreground/50">Foto</span>
                                            </div>
                                        )}
                                        <input type="file" className="hidden" accept="image/*" onChange={e => handleVariantImageChange(index, e)} />
                                    </label>
                                    <div className="flex-1 min-w-0">
                                        <input
                                            type="text" value={v.variantName}
                                            onChange={e => updateVariant(index, 'variantName', e.target.value)}
                                            placeholder="Nama varian (mis. Ukuran L)"
                                            className="w-full px-3 py-2.5 bg-muted/40 border border-border rounded-lg text-sm font-semibold outline-none focus:border-primary"
                                        />
                                    </div>
                                    {variants.length > 1 && (
                                        <button type="button" onClick={() => removeVariant(index)} className="shrink-0 p-2 text-destructive/60 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>

                                {/* Body: Fields */}
                                <div className="p-3 space-y-3">
                                    {/* SKU */}
                                    <div>
                                        <label className="block text-[11px] font-semibold text-muted-foreground uppercase mb-1">SKU *</label>
                                        <div className="flex gap-2">
                                            <input required type="text" value={v.sku}
                                                onChange={e => updateVariant(index, 'sku', e.target.value)}
                                                className="flex-1 min-w-0 px-3 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary font-mono" />
                                            <button type="button" onClick={() => generateSkuForVariant(index)}
                                                title="Generate SKU"
                                                className="px-3 py-2.5 bg-muted border border-border rounded-lg hover:bg-primary/10 hover:border-primary/40 transition-colors text-muted-foreground hover:text-primary shrink-0">
                                                <RefreshCw className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Harga Jual + HPP */}
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="block text-[11px] font-semibold text-muted-foreground uppercase mb-1">
                                                {pricingMode === 'AREA_BASED' ? 'Harga/m² (Rp)' : 'Harga Jual (Rp)'} *
                                            </label>
                                            <input required type="number" min="0" inputMode="numeric" value={v.price}
                                                onChange={e => updateVariant(index, 'price', e.target.value)}
                                                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary" />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-semibold text-muted-foreground uppercase mb-1">Modal / HPP</label>
                                            <input type="number" min="0" inputMode="numeric" value={v.hpp}
                                                onChange={e => updateVariant(index, 'hpp', e.target.value)}
                                                placeholder="Opsional"
                                                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary" />
                                        </div>
                                    </div>

                                    {/* Stok + Size + Warna */}
                                    <div className="grid grid-cols-3 gap-2">
                                        {trackStock && (
                                            <div>
                                                <label className="block text-[11px] font-semibold text-muted-foreground uppercase mb-1">
                                                    {pricingMode === 'AREA_BASED' ? 'Stok (m²)' : 'Stok'}
                                                </label>
                                                <input type="number" min="0" inputMode="decimal"
                                                    step={pricingMode === 'AREA_BASED' ? '0.01' : '1'}
                                                    value={v.stock}
                                                    onChange={e => updateVariant(index, 'stock', e.target.value)}
                                                    className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary" />
                                            </div>
                                        )}
                                        <div>
                                            <label className="block text-[11px] font-semibold text-muted-foreground uppercase mb-1">Size</label>
                                            <input type="text" value={v.size}
                                                onChange={e => updateVariant(index, 'size', e.target.value)}
                                                placeholder="M, L, XL"
                                                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary" />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-semibold text-muted-foreground uppercase mb-1">Warna</label>
                                            <input type="text" value={v.color}
                                                onChange={e => updateVariant(index, 'color', e.target.value)}
                                                placeholder="Merah"
                                                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary" />
                                        </div>
                                    </div>

                                    {/* Harga Bertingkat (Price Tiers) */}
                                    {pricingMode !== 'AREA_BASED' && (
                                        <div className="border-t border-border/40 pt-3 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[11px] font-semibold text-muted-foreground uppercase">
                                                    Harga Bertingkat
                                                    {v.priceTiers.length > 0 && <span className="ml-1.5 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-1.5 py-0.5 rounded font-semibold">{v.priceTiers.length} tier</span>}
                                                </span>
                                                <button type="button" onClick={() => addTier(index)} className="flex items-center gap-1 text-xs text-primary font-semibold py-1 px-2 bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors">
                                                    <Plus className="w-3.5 h-3.5" /> Tambah Tier
                                                </button>
                                            </div>
                                            {v.priceTiers.length === 0 && (
                                                <p className="text-[11px] text-muted-foreground">Harga Jual di atas berlaku untuk semua qty.</p>
                                            )}
                                            {v.priceTiers.map((tier, ti) => (
                                                <div key={ti} className="bg-orange-50/60 dark:bg-orange-950/10 border border-orange-200/60 dark:border-orange-800/30 rounded-lg p-2.5 space-y-2">
                                                    <div className="flex gap-2 items-center">
                                                        <input type="text" value={tier.tierName}
                                                            onChange={e => updateTier(index, ti, 'tierName', e.target.value)}
                                                            placeholder="Label tier (mis. Grosir)"
                                                            className="flex-1 px-3 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary" />
                                                        <button type="button" onClick={() => removeTier(index, ti)} className="w-9 h-9 flex items-center justify-center text-destructive/60 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors shrink-0">
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-2">
                                                        <div>
                                                            <label className="block text-[10px] text-muted-foreground mb-1">Min Qty</label>
                                                            <input type="number" min="1" inputMode="numeric" value={tier.minQty}
                                                                onChange={e => updateTier(index, ti, 'minQty', e.target.value)}
                                                                placeholder="1"
                                                                className="w-full px-2 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary text-center" />
                                                        </div>
                                                        <div>
                                                            <label className="block text-[10px] text-muted-foreground mb-1">Max Qty</label>
                                                            <input type="number" min="1" inputMode="numeric" value={tier.maxQty}
                                                                onChange={e => updateTier(index, ti, 'maxQty', e.target.value)}
                                                                placeholder="∞"
                                                                className="w-full px-2 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary text-center" />
                                                        </div>
                                                        <div>
                                                            <label className="block text-[10px] text-muted-foreground mb-1">Harga/unit (Rp)</label>
                                                            <input type="number" min="0" inputMode="numeric" value={tier.price}
                                                                onChange={e => updateTier(index, ti, 'price', e.target.value)}
                                                                placeholder="0"
                                                                className="w-full px-2 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary" />
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                            {v.priceTiers.length > 0 && (
                                                <p className="text-[10px] text-muted-foreground">Harga Jual dipakai jika qty tidak cocok tier manapun.</p>
                                            )}
                                        </div>
                                    )}

                                    {/* Roll Material */}
                                    <div className="border-t border-border/40 pt-3 space-y-3">
                                        <label className="flex items-center gap-2.5 cursor-pointer">
                                            <input type="checkbox" checked={v.isRollMaterial}
                                                onChange={e => updateVariant(index, 'isRollMaterial', e.target.checked)}
                                                className="w-4 h-4 rounded accent-primary" />
                                            <span className="text-sm font-medium">Bahan roll (banner, MMT, dll)</span>
                                        </label>
                                        {v.isRollMaterial && (
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="block text-[11px] font-semibold text-muted-foreground uppercase mb-1">Lebar Fisik (m)</label>
                                                    <input type="number" step="0.1" min="0" inputMode="decimal" value={v.rollPhysicalWidth}
                                                        onChange={e => updateVariant(index, 'rollPhysicalWidth', e.target.value)}
                                                        placeholder="3.2"
                                                        className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary font-mono" />
                                                </div>
                                                <div>
                                                    <label className="block text-[11px] font-semibold text-muted-foreground uppercase mb-1">Lebar Cetak (m)</label>
                                                    <input type="number" step="0.1" min="0" inputMode="decimal" value={v.rollEffectivePrintWidth}
                                                        onChange={e => updateVariant(index, 'rollEffectivePrintWidth', e.target.value)}
                                                        placeholder="3.0"
                                                        className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary font-mono" />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {v.id && (
                                    <div className="px-3 pb-2">
                                        <p className="text-[10px] text-muted-foreground/40 font-mono">ID: {v.id}</p>
                                    </div>
                                )}
                                {/* HPP Worksheet — only for saved variants */}
                                {v.id && (
                                    <div className="border-t border-border/50 pt-3">
                                        <button
                                            type="button"
                                            onClick={() => toggleHppSection(index)}
                                            className={`flex items-center gap-2 text-sm font-medium transition-colors ${hppOpenVariants.has(index) ? 'text-amber-700' : 'text-muted-foreground hover:text-foreground'}`}
                                        >
                                            <Calculator className="w-4 h-4" />
                                            HPP Worksheet
                                            {(hppByVariantId[v.id!] || []).length > 0 && (
                                                <span className="ml-1 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-semibold">
                                                    {(hppByVariantId[v.id!] || []).length}
                                                </span>
                                            )}
                                            <span className="text-xs text-muted-foreground">{hppOpenVariants.has(index) ? '▲' : '▼'}</span>
                                        </button>

                                        {hppOpenVariants.has(index) && (
                                            <div className="mt-3 space-y-2">
                                                {(hppByVariantId[v.id!] || []).length === 0 ? (
                                                    <p className="text-xs text-muted-foreground">Belum ada HPP worksheet untuk varian ini.</p>
                                                ) : (
                                                    (hppByVariantId[v.id!] || []).map((ws: any) => {
                                                        const hppVal = calcHppPerUnit(ws.variableCosts, ws.fixedCosts, ws.targetVolume);
                                                        const margin = Number(v.price) > 0 ? ((Number(v.price) - hppVal) / Number(v.price)) * 100 : 0;
                                                        return (
                                                            <div key={ws.id} className="flex items-center justify-between gap-3 bg-amber-50/50 border border-amber-200 rounded-lg px-3 py-2">
                                                                <div>
                                                                    <p className="text-xs font-semibold text-foreground">{ws.productName}</p>
                                                                    <p className="text-xs text-muted-foreground">
                                                                        HPP: <span className="font-bold text-foreground">Rp {Math.round(hppVal).toLocaleString('id-ID')}</span>/unit ·{' '}
                                                                        <span className={`font-semibold ${margin < 0 ? 'text-destructive' : margin < 20 ? 'text-amber-600' : 'text-emerald-600'}`}>{margin.toFixed(1)}% margin</span>
                                                                    </p>
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => openHppEditor(index, ws)}
                                                                    className="flex items-center gap-1 text-xs border border-border px-2.5 py-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground shrink-0"
                                                                >
                                                                    <Pencil className="w-3 h-3" /> Edit
                                                                </button>
                                                            </div>
                                                        );
                                                    })
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => openHppEditor(index, null)}
                                                    className="text-xs text-amber-700 border border-dashed border-amber-300 bg-amber-50/50 px-3 py-1.5 rounded-lg hover:bg-amber-100 transition-colors"
                                                >
                                                    + Tambah Worksheet HPP
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <button type="button" onClick={addVariant} className="w-full flex items-center justify-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 bg-primary/10 px-3 py-2 rounded-lg hover:bg-primary/20 transition-colors border border-dashed border-primary/30 hover:border-primary/50 mt-2">
                        <Plus className="w-4 h-4" /> Tambah Varian
                    </button>
                </div>

                {/* Ingredients */}
                <div className="glass p-6 rounded-xl border border-border shadow-sm">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <FlaskConical className="w-5 h-5 text-muted-foreground" />
                            <div>
                                <h2 className="text-base font-semibold">Bahan (Ingredient)</h2>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {requiresProduction && hasAssemblyStage
                                        ? 'Komponen rakitan (rangka, frame, dll) — dipotong stok saat tahap Pemasangan dimulai.'
                                        : 'Opsional — untuk kalkulasi HPP.'}
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => { setShowIngredients(!showIngredients); if (!showIngredients && ingredients.length === 0) addIngredient(); }}
                            className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${showIngredients ? 'bg-muted text-foreground' : 'bg-primary/10 text-primary hover:bg-primary/20'}`}
                        >
                            {showIngredients ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                            {showIngredients ? 'Tutup' : 'Tambah Bahan'}
                        </button>
                    </div>

                    {showIngredients && (
                        <div className="mt-4 space-y-3">
                            {ingredients.map((ing, i) => (
                                <div key={i} className="bg-muted/30 rounded-xl border border-border/60 overflow-hidden">

                                    {/* Header: Nama Bahan + Hapus */}
                                    <div className="flex items-center gap-3 p-3 bg-background border-b border-border/40">
                                        <div className="flex-1 min-w-0">
                                            <input
                                                type="text" value={ing.name}
                                                onChange={e => updateIngredient(i, 'name', e.target.value)}
                                                placeholder="Nama bahan (mis. Kertas Art, Tinta, Laminasi)"
                                                className="w-full px-3 py-2.5 bg-muted/40 border border-border rounded-lg text-sm font-semibold outline-none focus:border-primary"
                                            />
                                        </div>
                                        <button type="button" onClick={() => removeIngredient(i)} className="shrink-0 p-2 text-destructive/60 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>

                                    {/* Body */}
                                    <div className="p-3 space-y-3">
                                        {/* Stock link */}
                                        <div>
                                            <label className="block text-[11px] font-semibold text-muted-foreground uppercase mb-1">
                                                <span className="flex items-center gap-1"><Link2 className="w-3 h-3" /> Terhubung ke Stok</span>
                                            </label>
                                            <div className="flex items-center gap-2">
                                                <select
                                                    value={ing.rawMaterialVariantId ?? ''}
                                                    onChange={e => handleIngredientStockLink(i, e.target.value ? Number(e.target.value) : null)}
                                                    className="flex-1 px-3 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary"
                                                >
                                                    <option value="">— Bahan manual (tidak potong stok) —</option>
                                                    {allVariants.map((v: any) => (
                                                        <option key={v.id} value={v.id}>{v.label}</option>
                                                    ))}
                                                </select>
                                                {ing.rawMaterialVariantId && (
                                                    <span className="text-xs text-green-600 font-semibold shrink-0 bg-green-50 dark:bg-green-950/20 px-2 py-1 rounded-lg border border-green-200 dark:border-green-800">✓ Link</span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Qty + Unit + Harga + Subtotal */}
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="block text-[11px] font-semibold text-muted-foreground uppercase mb-1">Jumlah</label>
                                                <input type="number" min="0" step="any" inputMode="decimal" value={ing.quantity} onChange={e => updateIngredient(i, 'quantity', e.target.value)} placeholder="0" className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary" />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-semibold text-muted-foreground uppercase mb-1">Satuan</label>
                                                <input type="text" value={ing.unit} onChange={e => updateIngredient(i, 'unit', e.target.value)} placeholder="pcs, gram, lembar..." className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary" />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="block text-[11px] font-semibold text-muted-foreground uppercase mb-1">Harga Satuan (Rp)</label>
                                                <input type="number" readOnly value={ing.price} placeholder="0" className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-muted-foreground outline-none cursor-not-allowed" />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-semibold text-muted-foreground uppercase mb-1">Subtotal HPP (Rp)</label>
                                                <input type="number" readOnly value={ing.subtotal} placeholder="0" className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm text-muted-foreground outline-none cursor-not-allowed font-bold" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <button type="button" onClick={addIngredient} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mt-1 transition-colors">
                                <Plus className="w-3.5 h-3.5" /> Tambah Bahan Lagi
                            </button>

                            {/* HPP Total & Margin Summary */}
                            {ingredients.length > 0 && (
                                (() => {
                                    const totalHpp = ingredients.reduce((sum, ing) => sum + (Number(ing.subtotal) || 0), 0);
                                    const hasSingleVariant = variants.length === 1;
                                    const variantPrice = hasSingleVariant ? Number(variants[0].price) || 0 : 0;
                                    const profit = variantPrice - totalHpp;
                                    const marginPercent = variantPrice > 0 ? Math.round((profit / variantPrice) * 100) : 0;

                                    return (
                                        <div className="mt-5 p-4 bg-primary/5 rounded-xl border border-primary/20 space-y-3">
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-muted-foreground font-medium">Total HPP Bahan Baku:</span>
                                                <span className="font-bold text-foreground">Rp {totalHpp.toLocaleString('id-ID')}</span>
                                            </div>

                                            {hasSingleVariant && variantPrice > 0 && (
                                                <>
                                                    <div className="flex justify-between items-center text-sm pt-3 border-t border-border/50">
                                                        <span className="text-muted-foreground font-medium">Harga Jual Varian:</span>
                                                        <span className="font-semibold text-foreground">Rp {variantPrice.toLocaleString('id-ID')}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center text-sm">
                                                        <span className="text-muted-foreground font-medium">Est. Margin / Keuntungan:</span>
                                                        <span className={`font-bold ${profit > 0 ? 'text-green-600' : profit < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                                                            {marginPercent}% (Rp {profit.toLocaleString('id-ID')})
                                                        </span>
                                                    </div>
                                                </>
                                            )}

                                            {!hasSingleVariant && (
                                                <div className="text-xs text-muted-foreground pt-3 border-t border-border/50 mt-2 text-center italic">
                                                    *Margin keuntungan total tidak ditampilkan karena Anda memiliki lebih dari 1 varian dengan harga berbeda.
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()
                            )}
                        </div>
                    )}
                </div>

                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
                    <Link href="/inventory" className="flex items-center justify-center px-5 py-3 rounded-lg border border-border hover:bg-muted font-medium text-sm transition-colors">
                        Batal
                    </Link>
                    <button type="submit" disabled={mutation.isPending} className="flex items-center justify-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors shadow-md disabled:opacity-50 text-sm">
                        {mutation.isPending ? 'Menyimpan...' : <><Save className="w-4 h-4" /> Simpan Perubahan</>}
                    </button>
                </div>
            </form>

            {/* HPP Worksheet Edit Modal */}
            {hppEditState && (() => {
                const f = hppEditState.form;
                const liveHpp = calcHppPerUnit(f.variableCosts, f.fixedCosts, f.targetVolume);
                const liveMargin = hppEditState.variantPrice > 0
                    ? ((hppEditState.variantPrice - liveHpp) / hppEditState.variantPrice) * 100
                    : 0;
                const setForm = (patch: Partial<typeof f>) =>
                    setHppEditState(prev => prev ? { ...prev, form: { ...prev.form, ...patch } } : null);
                const setVC = (i: number, patch: Partial<typeof f.variableCosts[0]>) =>
                    setForm({ variableCosts: f.variableCosts.map((r, idx) => idx === i ? { ...r, ...patch } : r) });
                const setFC = (i: number, patch: Partial<typeof f.fixedCosts[0]>) =>
                    setForm({ fixedCosts: f.fixedCosts.map((r, idx) => idx === i ? { ...r, ...patch } : r) });
                return (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-card rounded-xl shadow-xl w-full max-w-2xl max-h-[92vh] flex flex-col">
                            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                                <div>
                                    <h2 className="text-base font-semibold">{hppEditState.worksheetId ? 'Edit' : 'Buat'} HPP Worksheet</h2>
                                    <p className="text-xs text-muted-foreground mt-0.5">{hppEditState.variantLabel}</p>
                                </div>
                                <button type="button" onClick={() => setHppEditState(null)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
                            </div>

                            <div className="overflow-y-auto flex-1 p-6 space-y-5">
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="col-span-3 space-y-1">
                                        <label className="text-xs font-medium text-muted-foreground">Nama Worksheet</label>
                                        <input value={f.productName} onChange={e => setForm({ productName: e.target.value })} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-muted-foreground">Volume Target (unit)</label>
                                        <input type="number" min="1" value={f.targetVolume} onChange={e => setForm({ targetVolume: Number(e.target.value) })} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-muted-foreground">Target Margin (%)</label>
                                        <input type="number" min="0" max="100" value={f.targetMargin} onChange={e => setForm({ targetMargin: Number(e.target.value) })} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-muted-foreground">Harga Jual</label>
                                        <div className="px-3 py-2 bg-muted/50 border border-border rounded-lg text-sm text-muted-foreground">Rp {hppEditState.variantPrice.toLocaleString('id-ID')}</div>
                                    </div>
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="text-sm font-semibold">Biaya Variabel</h3>
                                        <button type="button" onClick={() => setForm({ variableCosts: [...f.variableCosts, { customMaterialName: '', customPrice: 0, usageAmount: 1, usageUnit: 'pcs' }] })} className="text-xs text-primary border border-primary/30 px-2 py-1 rounded hover:bg-primary/5 transition-colors">+ Tambah Bahan</button>
                                    </div>
                                    <div className="space-y-2">
                                        {f.variableCosts.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">Belum ada biaya variabel.</p>}
                                        {f.variableCosts.map((vc, i) => (
                                            <div key={i} className="grid grid-cols-12 gap-2 items-center">
                                                <input value={vc.customMaterialName} onChange={e => setVC(i, { customMaterialName: e.target.value })} placeholder="Nama bahan" className="col-span-4 px-2 py-1.5 bg-background border border-border rounded text-xs outline-none focus:border-primary" />
                                                <input type="number" value={vc.customPrice} onChange={e => setVC(i, { customPrice: Number(e.target.value) })} placeholder="Harga" className="col-span-3 px-2 py-1.5 bg-background border border-border rounded text-xs outline-none focus:border-primary" />
                                                <input type="number" value={vc.usageAmount} onChange={e => setVC(i, { usageAmount: Number(e.target.value) })} placeholder="Jumlah" className="col-span-2 px-2 py-1.5 bg-background border border-border rounded text-xs outline-none focus:border-primary" />
                                                <input value={vc.usageUnit} onChange={e => setVC(i, { usageUnit: e.target.value })} placeholder="Satuan" className="col-span-2 px-2 py-1.5 bg-background border border-border rounded text-xs outline-none focus:border-primary" />
                                                <button type="button" onClick={() => setForm({ variableCosts: f.variableCosts.filter((_, idx) => idx !== i) })} className="col-span-1 flex justify-center text-destructive/60 hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="text-sm font-semibold">Biaya Tetap (per batch)</h3>
                                        <button type="button" onClick={() => setForm({ fixedCosts: [...f.fixedCosts, { name: '', amount: 0 }] })} className="text-xs text-primary border border-primary/30 px-2 py-1 rounded hover:bg-primary/5 transition-colors">+ Tambah Biaya</button>
                                    </div>
                                    <div className="space-y-2">
                                        {f.fixedCosts.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">Belum ada biaya tetap.</p>}
                                        {f.fixedCosts.map((fc, i) => (
                                            <div key={i} className="grid grid-cols-12 gap-2 items-center">
                                                <input value={fc.name} onChange={e => setFC(i, { name: e.target.value })} placeholder="Nama biaya" className="col-span-7 px-2 py-1.5 bg-background border border-border rounded text-xs outline-none focus:border-primary" />
                                                <input type="number" value={fc.amount} onChange={e => setFC(i, { amount: Number(e.target.value) })} placeholder="Jumlah (Rp)" className="col-span-4 px-2 py-1.5 bg-background border border-border rounded text-xs outline-none focus:border-primary" />
                                                <button type="button" onClick={() => setForm({ fixedCosts: f.fixedCosts.filter((_, idx) => idx !== i) })} className="col-span-1 flex justify-center text-destructive/60 hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className={`rounded-xl p-4 border ${liveMargin < 0 ? 'bg-destructive/5 border-destructive/20' : liveMargin < 20 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
                                    <div className="flex items-center justify-between flex-wrap gap-3">
                                        <div>
                                            <p className="text-xs text-muted-foreground">HPP per unit</p>
                                            <p className="text-xl font-bold text-foreground">Rp {Math.round(liveHpp).toLocaleString('id-ID')}</p>
                                            <p className="text-xs text-muted-foreground mt-0.5">dari volume {f.targetVolume} unit</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs text-muted-foreground">Margin vs harga jual</p>
                                            <p className={`text-2xl font-bold ${liveMargin < 0 ? 'text-destructive' : liveMargin < 20 ? 'text-amber-600' : 'text-emerald-600'}`}>{liveMargin.toFixed(1)}%</p>
                                            <p className="text-xs text-muted-foreground">target: {f.targetMargin}%</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="px-6 py-4 border-t border-border flex justify-between gap-2">
                                <button type="button" onClick={() => setHppEditState(null)} className="px-4 py-2 rounded-lg border border-border hover:bg-muted font-medium text-sm">Batal</button>
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => handleHppSave(false)} disabled={hppSaving} className="px-4 py-2 border border-border bg-muted/50 text-foreground rounded-lg font-medium hover:bg-muted disabled:opacity-50 text-sm">
                                        {hppSaving ? 'Menyimpan...' : 'Simpan'}
                                    </button>
                                    <button type="button" onClick={() => handleHppSave(true)} disabled={hppSaving} className="px-4 py-2 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 disabled:opacity-50 text-sm">
                                        {hppSaving ? 'Menyimpan...' : 'Simpan & Terapkan ke Varian'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}
