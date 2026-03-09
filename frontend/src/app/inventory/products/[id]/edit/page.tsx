"use client";

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCategories, getUnits, getProduct, updateProduct, uploadProductImages, uploadVariantImage, getSettings, getProducts } from '@/lib/api';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, Save, Upload, Image as ImageIcon, FlaskConical, X, Ruler, Package, Link2 } from 'lucide-react';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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

    const [productForm, setProductForm] = useState({ name: '', description: '', categoryId: '', unitId: '' });
    const [pricingMode, setPricingMode] = useState<'UNIT' | 'AREA_BASED'>('UNIT');
    const [productType, setProductType] = useState<'SELLABLE' | 'RAW_MATERIAL' | 'SERVICE'>('SELLABLE');
    const [pricePerUnit, setPricePerUnit] = useState('');
    const [requiresProduction, setRequiresProduction] = useState(false);
    const [hasAssemblyStage, setHasAssemblyStage] = useState(false);
    const [imageFiles, setImageFiles] = useState<(File | null)[]>([null, null, null, null]);
    const [imagePreviews, setImagePreviews] = useState<(string | null)[]>([null, null, null, null]);
    const [existingImageUrls, setExistingImageUrls] = useState<(string | null)[]>([null, null, null, null]);
    const [variants, setVariants] = useState<VariantForm[]>([defaultVariant()]);
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
                pricePerUnit: pricingMode === 'AREA_BASED' ? Number(pricePerUnit) : null,
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
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
            queryClient.invalidateQueries({ queryKey: ['product', productId] });
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
    const removeVariant = (index: number) => setVariants(prev => prev.filter((_, i) => i !== index));

    const updateVariant = (index: number, field: keyof VariantForm, value: any) => {
        setVariants(prev => { const next = [...prev]; (next[index] as any)[field] = value; return next; });
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

                {/* Variants */}
                <div className="glass p-6 rounded-xl border border-border space-y-4 shadow-sm">
                    <div className="flex items-center justify-between border-b border-border pb-3">
                        <h2 className="text-base font-semibold">Varian Produk</h2>
                        <button type="button" onClick={addVariant} className="flex items-center gap-1.5 text-sm font-medium text-primary bg-primary/10 px-3 py-1.5 rounded-lg hover:bg-primary/20 transition-colors">
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

                                    <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-3">
                                        <div className="md:col-span-2 space-y-1">
                                            <label className="text-xs font-medium text-muted-foreground">Nama Varian</label>
                                            <input type="text" value={v.variantName} onChange={e => updateVariant(index, 'variantName', e.target.value)} placeholder="Contoh: Ukuran L, Rasa Original" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-muted-foreground">SKU *</label>
                                            <input required type="text" value={v.sku} onChange={e => updateVariant(index, 'sku', e.target.value)} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary font-mono" />
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
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-muted-foreground">
                                                {pricingMode === 'AREA_BASED' ? 'Stok Bahan (m²)' : 'Stok'}
                                            </label>
                                            <input type="number" min="0" step={pricingMode === 'AREA_BASED' ? '0.01' : '1'} value={v.stock} onChange={e => updateVariant(index, 'stock', e.target.value)} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-muted-foreground">Size</label>
                                            <input type="text" value={v.size} onChange={e => updateVariant(index, 'size', e.target.value)} placeholder="M, L, XL" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-muted-foreground">Warna</label>
                                            <input type="text" value={v.color} onChange={e => updateVariant(index, 'color', e.target.value)} placeholder="Merah, Biru" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary" />
                                        </div>
                                    </div>

                                    {/* Roll Material fields — tampil di semua tipe produk */}
                                    {(
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
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {variants.length > 1 && (
                                        <button type="button" onClick={() => removeVariant(index)} className="shrink-0 p-1.5 text-destructive/60 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                                {v.id && (
                                    <p className="text-xs text-muted-foreground/50 font-mono">ID Varian: {v.id}</p>
                                )}
                            </div>
                        ))}
                    </div>
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
                                        <input type="text" value={ing.name} onChange={e => updateIngredient(i, 'name', e.target.value)} placeholder="Nama bahan" className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary" />
                                        <input type="number" min="0" step="any" value={ing.quantity} onChange={e => updateIngredient(i, 'quantity', e.target.value)} placeholder="Jumlah" title="Jumlah (Kuantitas)" className="w-20 px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary" />
                                        <input type="text" value={ing.unit} onChange={e => updateIngredient(i, 'unit', e.target.value)} placeholder="Unit" title="Satuan (Pcs, Gram, dll)" className="w-16 px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary" />
                                        {/* HPP Extra Details (Read Only) */}
                                        <div className="flex gap-2">
                                            <div className="relative group">
                                                <span className="absolute -top-5 left-2 text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-card px-1 rounded border border-border">Harga Satuan</span>
                                                <input type="number" readOnly value={ing.price} placeholder="Rp 0" className="w-24 px-3 py-2 bg-muted border border-border rounded-lg text-sm text-muted-foreground outline-none cursor-not-allowed" />
                                            </div>
                                            <div className="relative group">
                                                <span className="absolute -top-5 left-2 text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-card px-1 rounded border border-border">Subtotal HPP</span>
                                                <input type="number" readOnly value={ing.subtotal} placeholder="Rp 0" className="w-28 px-3 py-2 bg-muted border border-border rounded-lg text-sm text-muted-foreground outline-none cursor-not-allowed font-medium" />
                                            </div>
                                        </div>
                                        <button type="button" onClick={() => removeIngredient(i)} className="p-2 text-destructive/60 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
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

                <div className="flex justify-end gap-3 pt-2">
                    <Link href="/inventory" className="px-5 py-2.5 rounded-lg border border-border hover:bg-muted font-medium text-sm transition-colors">
                        Batal
                    </Link>
                    <button type="submit" disabled={mutation.isPending} className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2.5 rounded-lg font-medium hover:bg-primary/90 transition-colors shadow-md disabled:opacity-50 text-sm">
                        {mutation.isPending ? 'Menyimpan...' : <><Save className="w-4 h-4" /> Simpan Perubahan</>}
                    </button>
                </div>
            </form>
        </div>
    );
}
