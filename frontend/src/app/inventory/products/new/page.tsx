"use client";

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCategories, getUnits, createProduct, uploadProductImages, uploadVariantImage, getSettings } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, Save, Upload, Image as ImageIcon, FlaskConical, X, Ruler, Package } from 'lucide-react';
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
    return `${prefix}-${num}`;
}

interface VariantForm {
    sku: string;
    variantName: string;
    price: string;
    stock: string;
    size: string;
    color: string;
    imageFile: File | null;
    imagePreview: string | null;
    skuManuallyEdited: boolean;
}

interface IngredientForm {
    name: string;
    quantity: string;
    unit: string;
}

const defaultVariant = (): VariantForm => ({
    sku: '', variantName: '', price: '', stock: '', size: '', color: '',
    imageFile: null, imagePreview: null, skuManuallyEdited: false
});

export default function AddProductPage() {
    const router = useRouter();
    const queryClient = useQueryClient();

    const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: getCategories });
    const { data: units } = useQuery({ queryKey: ['units'], queryFn: getUnits });
    const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: getSettings });

    const [productForm, setProductForm] = useState({ name: '', description: '', categoryId: '', unitId: '' });
    const [pricingMode, setPricingMode] = useState<'UNIT' | 'AREA_BASED'>('UNIT');
    const [pricePerUnit, setPricePerUnit] = useState('');

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
        const newIndex = variants.length;
        setVariants(prev => [...prev, { ...defaultVariant(), sku: generateSku(productForm.name, newIndex) }]);
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

    const handleVariantImageChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const preview = URL.createObjectURL(file);
            updateVariant(index, 'imageFile', file);
            updateVariant(index, 'imagePreview', preview);
        }
    };

    // Ingredients
    const addIngredient = () => setIngredients(prev => [...prev, { name: '', quantity: '', unit: '' }]);
    const removeIngredient = (i: number) => setIngredients(prev => prev.filter((_, idx) => idx !== i));
    const updateIngredient = (i: number, field: keyof IngredientForm, value: string) => {
        setIngredients(prev => { const next = [...prev]; next[i] = { ...next[i], [field]: value }; return next; });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const payload: any = {
            ...productForm,
            categoryId: Number(productForm.categoryId),
            unitId: Number(productForm.unitId),
            pricingMode,
            pricePerUnit: pricingMode === 'AREA_BASED' ? Number(pricePerUnit) : undefined,
            variants: variants.map(v => ({
                sku: v.sku,
                variantName: v.variantName || undefined,
                price: Number(v.price),
                stock: Number(v.stock),
                size: v.size || undefined,
                color: v.color || undefined
            })),
            ingredients: showIngredients ? ingredients
                .filter(ing => ing.name.trim())
                .map(ing => ({ name: ing.name, quantity: Number(ing.quantity) || 0, unit: ing.unit }))
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
                    </div>
                )}

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
                                            <input
                                                required type="text" value={v.sku}
                                                onChange={e => updateVariant(index, 'sku', e.target.value)}
                                                placeholder="AUTO-001"
                                                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary font-mono"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-muted-foreground">
                                                {pricingMode === 'AREA_BASED' ? 'Harga/m² (Rp) *' : 'Harga Jual (Rp) *'}
                                            </label>
                                            <input required type="number" min="0" value={v.price} onChange={e => updateVariant(index, 'price', e.target.value)} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-muted-foreground">
                                                {pricingMode === 'AREA_BASED' ? 'Stok Bahan (m²) *' : 'Stok Awal *'}
                                            </label>
                                            <input required type="number" min="0" step={pricingMode === 'AREA_BASED' ? '0.01' : '1'} value={v.stock} onChange={e => updateVariant(index, 'stock', e.target.value)} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary" />
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

                                    {variants.length > 1 && (
                                        <button type="button" onClick={() => removeVariant(index)} className="shrink-0 p-1.5 text-destructive/60 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100 mt-0.5">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Ingredients (optional) */}
                <div className="glass p-6 rounded-xl border border-border shadow-sm">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <FlaskConical className="w-5 h-5 text-muted-foreground" />
                            <div>
                                <h2 className="text-base font-semibold">Bahan (Ingredient)</h2>
                                <p className="text-xs text-muted-foreground mt-0.5">Opsional — untuk kalkulasi HPP dan manajemen bahan baku.</p>
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
                                <div key={i} className="flex gap-2 items-center">
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
