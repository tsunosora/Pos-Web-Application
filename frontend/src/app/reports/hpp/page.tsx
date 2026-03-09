"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import {
    Plus, Edit2, Trash2, Image as ImageIcon, Target,
    Search, Download, Trash, ChevronDown, Check, Store, Package, Map,
    BarChart2, Zap, Cog, ShoppingBag, Wrench, Megaphone, FileText,
    Calculator, ArrowRight, Loader2, Save, X, Database
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getHppWorksheets, createHppWorksheet, updateHppWorksheet, deleteHppWorksheet, getProducts, createProduct, getCategories, getUnits, uploadProductImage, uploadProductImages } from "@/lib/api";

function CustomNameInput({ value, onChange, onSwitchToStock }: { value: string; onChange: (val: string) => void; onSwitchToStock: () => void }) {
    const [local, setLocal] = useState(value);
    // Sync jika nilai dari parent berubah (misalnya load worksheet)
    useEffect(() => { setLocal(value); }, [value]);
    return (
        <div className="relative flex items-center">
            <input
                type="text"
                value={local}
                onChange={(e) => setLocal(e.target.value)}
                onBlur={() => onChange(local)}
                placeholder="Tulis nama bahan..."
                autoFocus
                className="w-full pl-3 pr-8 py-2 bg-background border border-primary rounded-[6px] text-[13px] font-semibold text-foreground outline-none focus:ring-1 focus:ring-primary/20"
            />
            <button type="button" title="Pilih dari stok" onClick={onSwitchToStock} className="absolute right-2 text-muted-foreground hover:text-green-600 transition-colors">
                <Database className="w-3.5 h-3.5" />
            </button>
        </div>
    );
}

interface VariantComboboxProps {
    rowId: string;
    currentVariantId?: number;
    currentName: string;
    dbProducts: any[];
    onSelectVariant: (rowId: string, variantId: string) => void;
    onSelectManual: (rowId: string, initialName?: string) => void;
}

function VariantCombobox({ rowId, currentVariantId, currentName, dbProducts, onSelectVariant, onSelectManual }: VariantComboboxProps) {
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleUseAsCustom = (name: string) => {
        onSelectManual(rowId, name.trim());
        setOpen(false);
        setQuery('');
    };

    const allVariants = useMemo(() => {
        const result: { label: string; variantId: string }[] = [];
        for (const p of dbProducts) {
            for (const v of (p.variants || [])) {
                result.push({ label: p.name + (v.variantName ? ` – ${v.variantName}` : ''), variantId: String(v.id) });
            }
        }
        return result;
    }, [dbProducts]);

    const filtered = useMemo(() => {
        if (!query.trim()) return allVariants.slice(0, 60);
        const q = query.toLowerCase();
        return allVariants.filter(v => v.label.toLowerCase().includes(q)).slice(0, 60);
    }, [query, allVariants]);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <div ref={containerRef} className="relative">
            <div
                className="flex items-center bg-card border border-green-500 rounded-[6px] overflow-hidden cursor-text"
                onClick={() => { setOpen(true); }}
            >
                {open ? (
                    <input
                        autoFocus
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && query.trim() && filtered.length === 0) {
                                handleUseAsCustom(query);
                            }
                        }}
                        placeholder="Ketik untuk mencari bahan baku..."
                        className="flex-1 pl-3 pr-2 py-2 bg-transparent text-[13px] font-semibold text-foreground outline-none"
                    />
                ) : (
                    <span className={cn("flex-1 pl-3 pr-2 py-2 text-[13px] font-semibold truncate", currentVariantId ? "text-foreground" : "text-muted-foreground")}>
                        {currentName || '— Pilih Bahan dari Stok —'}
                    </span>
                )}
                <Search className="w-3.5 h-3.5 text-green-500 mr-2 shrink-0 pointer-events-none" />
            </div>
            {open && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-[6px] shadow-lg max-h-52 overflow-y-auto">
                    {filtered.length === 0 ? (
                        query.trim() ? (
                            <button
                                type="button"
                                onMouseDown={(e) => { e.preventDefault(); handleUseAsCustom(query); }}
                                className="w-full text-left px-3 py-2.5 text-[13px] text-primary font-semibold hover:bg-primary/10 transition-colors"
                            >
                                ➕ Tambah &ldquo;{query}&rdquo; sebagai bahan custom
                            </button>
                        ) : (
                            <div className="px-3 py-2 text-[12px] text-muted-foreground">Ketik nama bahan...</div>
                        )
                    ) : filtered.map(item => (
                        <button
                            key={item.variantId}
                            type="button"
                            onMouseDown={(e) => {
                                e.preventDefault();
                                onSelectVariant(rowId, item.variantId);
                                setOpen(false);
                                setQuery('');
                            }}
                            className={cn(
                                "w-full text-left px-3 py-2 text-[13px] hover:bg-primary/10 transition-colors",
                                currentVariantId && String(currentVariantId) === item.variantId ? "bg-primary/10 font-semibold" : ""
                            )}
                        >
                            {item.label}
                        </button>
                    ))}
                    <button
                        type="button"
                        onMouseDown={(e) => {
                            e.preventDefault();
                            handleUseAsCustom(query);
                        }}
                        className="w-full text-left px-3 py-2 text-[13px] text-orange-600 font-bold border-t border-border hover:bg-orange-50 transition-colors"
                    >
                        ✏️ Input Manual (tidak ada di stok)
                    </button>
                </div>
            )}
        </div>
    );
}

interface VariableCost {
    id: string; // Tmp ui ID
    productVariantId?: number; // DB Link
    name: string;
    usageAmount: number;
    usageUnit: string;
    price: number;
    priceUnit: string; // Stored just for UI display info
    isCustom?: boolean; // true = manually typed name, false = from stock
    isAcuanStok?: boolean; // Menentukan stok awal produk dari bahan ini
    isAreaBased?: boolean; // mode lebar x tinggi (m²)
    widthM?: number;
    heightM?: number;
    widthMStr?: string;  // raw string input untuk widthM (agar bisa ketik "0,6")
    heightMStr?: string; // raw string input untuk heightM
}

interface FixedCost {
    id: string; // Tmp ui id
    name: string;
    amount: number;
}

export default function HppCalculatorPage() {
    const [isLoading, setIsLoading] = useState(true);
    const [worksheets, setWorksheets] = useState<any[]>([]);
    const [dbProducts, setDbProducts] = useState<any[]>([]); // For getting stock/inventory items

    const [dbCategories, setDbCategories] = useState<any[]>([]);
    const [dbUnits, setDbUnits] = useState<any[]>([]);
    const [activeWorksheetId, setActiveWorksheetId] = useState<number | null>(null);
    const [productName, setProductName] = useState("");
    const [productCategory, setProductCategory] = useState("");
    const [productImageUrl, setProductImageUrl] = useState("");
    const [hppMode, setHppMode] = useState<'per_pcs' | 'per_batch'>('per_pcs');
    const [targetVolume, setTargetVolume] = useState<number>(1000);
    const [targetMargin, setTargetMargin] = useState<number>(50);
    const [sellingPricingMode, setSellingPricingMode] = useState<'UNIT' | 'AREA_BASED'>('UNIT');
    const [customSellingPrice, setCustomSellingPrice] = useState<number | null>(null);

    const [variableCosts, setVariableCosts] = useState<VariableCost[]>([]);
    const [fixedCosts, setFixedCosts] = useState<FixedCost[]>([]);
    const [hasCalculated, setHasCalculated] = useState(false);

    // Fixed cost presets
    const [fixedCostPresets, setFixedCostPresets] = useState<{ id: string; name: string; costs: FixedCost[] }[]>([]);
    const [showPresetModal, setShowPresetModal] = useState(false);
    const [presetName, setPresetName] = useState("");

    // Selected pricing tier in results panel
    const [selectedTier, setSelectedTier] = useState<'kompetitif' | 'standar' | 'premium'>('standar');

    // For handling product modal registration
    const [showRegisterProductModal, setShowRegisterProductModal] = useState(false);

    // Image upload ref
    const imageFileRef = useRef<HTMLInputElement>(null);
    const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const objectUrl = URL.createObjectURL(file);
        setProductImageUrl(objectUrl);
    };

    useEffect(() => {
        loadInitialData();
    }, []);

    const loadInitialData = async () => {
        setIsLoading(true);
        try {
            const [wsData, pData, catData, unitData] = await Promise.all([
                getHppWorksheets(),
                getProducts(),
                getCategories(),
                getUnits()
            ]);
            setWorksheets(wsData);
            setDbProducts(pData);
            setDbCategories(catData);
            setDbUnits(unitData);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelectWorksheet = (wsIdStr: string) => {
        if (!wsIdStr) {
            resetWorksheet();
            return;
        }
        const wsId = parseInt(wsIdStr);
        const ws = worksheets.find(w => w.id === wsId);
        if (!ws) return;

        setActiveWorksheetId(ws.id);
        setProductName(ws.productName);
        setTargetVolume(ws.targetVolume);
        setTargetMargin(Number(ws.targetMargin)); // db has decimal type

        // Map Variable Costs from DB backwards
        setVariableCosts(ws.variableCosts.map((vc: any) => {
            const variant = vc.productVariant;
            const isCustom = !variant;

            return {
                id: vc.id.toString(),
                productVariantId: vc.productVariantId,
                name: isCustom ? vc.customMaterialName : (variant?.variantName ? `${variant.product?.name} - ${variant.variantName}` : variant?.product?.name || "Unknown"),
                usageAmount: Number(vc.usageAmount),
                usageUnit: vc.usageUnit,
                price: isCustom ? Number(vc.customPrice || 0) : Number(variant?.price || 0),
                priceUnit: variant?.product?.unit?.name || 'unit',
                isCustom
            };
        }));

        setFixedCosts(ws.fixedCosts.map((fc: any) => ({
            id: fc.id.toString(),
            name: fc.name,
            amount: Number(fc.amount)
        })));

        setHasCalculated(true);
    };

    const resetWorksheet = () => {
        setActiveWorksheetId(null);
        setProductName("");
        setTargetVolume(1000);
        setTargetMargin(50);
        setVariableCosts([]);
        setFixedCosts([]);
        setHasCalculated(false);
        setCustomSellingPrice(null);
        setSellingPricingMode('UNIT');
    };

    const handleSaveWorksheet = async () => {
        if (!productName) return alert("Beri nama Worksheet/Resep terlebih dahulu!");

        const payload = {
            productName, targetVolume, targetMargin,
            variableCosts: variableCosts
                .filter(vc => vc.productVariantId || (vc.name && vc.price > 0)) // Save both stock & custom rows
                .map(vc => ({
                    productVariantId: vc.productVariantId || null,
                    customMaterialName: !vc.productVariantId ? vc.name : null,
                    customPrice: !vc.productVariantId ? vc.price : null,
                    usageAmount: vc.usageAmount,
                    usageUnit: vc.usageUnit
                })),
            fixedCosts: fixedCosts.map(fc => ({
                name: fc.name,
                amount: fc.amount
            }))
        };

        try {
            if (activeWorksheetId) {
                await updateHppWorksheet(activeWorksheetId, payload);
                alert("Worksheet di-update!");
            } else {
                const res = await createHppWorksheet(payload);
                setActiveWorksheetId(res.id);
                alert("Worksheet baru dibuat!");
            }
            loadInitialData();
            setHasCalculated(true);
        } catch (error) {
            console.error(error);
            alert("Gagal menyimpan resep");
        }
    };

    const calculateVariableSubtotal = (v: VariableCost) => {
        const pUnitNumMatch = v.priceUnit?.match(/\d+/);
        const pUnitNum = pUnitNumMatch ? parseInt(pUnitNumMatch[0]) : 1;
        if (v.price === 0 || v.usageAmount === 0) return 0;
        return (v.price / pUnitNum) * v.usageAmount;
    };

    // Derived Calculations
    const totalVariablePerPcs = useMemo(() => {
        return variableCosts.reduce((acc, v) => acc + calculateVariableSubtotal(v), 0);
    }, [variableCosts]);

    const totalFixedMonthly = useMemo(() => {
        return fixedCosts.reduce((acc, f) => acc + (Number(f.amount) || 0), 0);
    }, [fixedCosts]);

    const allocatedFixedPerPcs = useMemo(() => {
        if (!targetVolume || targetVolume <= 0) return 0;
        return totalFixedMonthly / targetVolume;
    }, [totalFixedMonthly, targetVolume]);

    const hppPerPcs = totalVariablePerPcs + allocatedFixedPerPcs;
    const baseSuggestedPrice = hppPerPcs * (1 + (targetMargin / 100)); // Default margin before tiers applied

    const handleSaveAsProduct = async () => {
        if (!productName) return alert("Nama produk wajib diisi sebelum disimpan ke stok!");
        if (!hasCalculated) return alert("Lakukan kalkulasi HPP terlebih dahulu!");

        // Find category by name (productCategory state holds a name-slug), or null if not set
        const matchedCat = dbCategories.find((c: any) =>
            c.name.toLowerCase() === productCategory.toLowerCase() || c.name === productCategory);
        const categoryId = matchedCat?.id;
        if (!categoryId) return alert(`Kategori "${productCategory || '(belum dipilih)'}" tidak ditemukan di database. Silakan pilih kategori yang ada atau buat kategori di Pengaturan.`);

        // Use first unit or find 'pcs'
        const matchedUnit = dbUnits.find((u: any) => u.name === 'pcs') || dbUnits[0];
        const unitId = matchedUnit?.id;
        if (!unitId) return alert("Tidak ada satuan (unit) yang terdaftar di database. Tambahkan unit terlebih dahulu.");

        // Calculate the price based on selected tier or use Custom Price
        const priceTierMap: Record<string, number> = {
            kompetitif: targetMargin > 15 ? targetMargin - 15 : 5,
            standar: targetMargin,
            premium: targetMargin + 20,
        };
        const margin = priceTierMap[selectedTier] ?? targetMargin;
        const systemSuggestedPrice = hppPerPcs > 0 ? Math.round(hppPerPcs / (1 - margin / 100)) : 0;
        const sellingPrice = customSellingPrice !== null && customSellingPrice > 0 ? customSellingPrice : systemSuggestedPrice;

        const initials = productName.trim().split(/\s+/).map((w: string) => w[0] || '').join('').toUpperCase().substring(0, 5) || productName.replace(/\s+/g, '').toUpperCase().substring(0, 5);
        const rand = Math.floor(1000 + Math.random() * 9000);
        const sku = `HPP-${initials}-${rand}`;

        // Calculate Stock Based on Acuan (if any)
        const acuanItem = variableCosts.find(vc => vc.isAcuanStok);
        let calculatedStock = 0;
        if (acuanItem && acuanItem.productVariantId && acuanItem.usageAmount > 0) {
            // Temukan variant bahan baku aslinya
            let acuanVariant: any = null;
            for (const p of dbProducts) {
                const va = p.variants?.find((vx: any) => vx.id === acuanItem.productVariantId);
                if (va) { acuanVariant = va; break; }
            }
            if (acuanVariant) {
                // Konversi stok jika beda unit. Secara simpel, kalkulator web ini kita bagi mentah
                // Jika butuh takaran rumit misal konversi g -> kg dsb, perlu diperhatikan. 
                // Asumsinya unit sudah senada dengan stock variants
                calculatedStock = Math.floor(Number(acuanVariant.stock) / Number(acuanItem.usageAmount));
            }
        }

        // Map ingredients for the new product (matches Prisma Ingredient model)
        const ingredients = variableCosts.map(vc => ({
            name: vc.name,
            quantity: vc.usageAmount,
            unit: vc.usageUnit,
            price: vc.price,
            subtotal: calculateVariableSubtotal(vc),
            rawMaterialVariantId: vc.productVariantId || null
        }));

        try {
            const newProduct = await createProduct({
                name: productName,
                categoryId,
                unitId,
                pricingMode: sellingPricingMode,
                ingredients,
                variants: [{
                    sku,
                    price: sellingPrice,
                    hpp: hppPerPcs,
                    stock: calculatedStock,
                }]
            });

            // Upload Image if selected and loaded into preview
            if (imageFileRef.current && imageFileRef.current.files && imageFileRef.current.files[0]) {
                const file = imageFileRef.current.files[0];
                try {
                    await uploadProductImages(newProduct.id, [file]);
                } catch (imgError) {
                    console.error("Gagal mengupload gambar produk:", imgError);
                    alert("Produk berhasil dibuat, tetapi gagal mengupload gambar.");
                }
            }

            // Ask to optionally save the worksheet as well
            if (confirm("Produk berhasil disiapkan! Apakah Anda juga ingin menyimpan lembar kerja (Worksheet) ini agar bisa diedit di kemudian hari?")) {
                await handleSaveWorksheet();
            }

            alert(`Produk berhasil dibuat dan ditambahkan ke daftar Manajemen Stok!\nHarga jual: Rp ${sellingPrice.toLocaleString('id-ID')}\nSKU: ${sku}`);
            // Redirect to product management
            window.location.href = '/inventory/products';
        } catch (error: any) {
            console.error(error);
            alert(`Gagal menyimpan produk: ${error?.response?.data?.message || error.message || 'Terjadi kesalahan'}`);
        }
    };

    const handleDeleteWorksheet = async () => {
        if (!activeWorksheetId) return;
        if (!confirm("Hapus resep ini secara permanen?")) return;
        try {
            await deleteHppWorksheet(activeWorksheetId);
            resetWorksheet();
            loadInitialData();
            alert("Dihapus!");
        } catch (error) {
            console.error(error);
        }
    };


    // Handlers for Variable Costs
    const addVariableCost = () => {
        setVariableCosts(prev => [...prev, {
            id: Date.now().toString(),
            name: "", usageAmount: 0, usageUnit: "pcs", price: 0, priceUnit: "pcs", isAcuanStok: false,
            isAreaBased: false, widthM: 0, heightM: 0, widthMStr: '', heightMStr: '',
        }]);
    };

    const toggleAreaMode = (id: string, on: boolean) => {
        setVariableCosts(prev => prev.map(v => {
            if (v.id !== id) return v;
            if (on) return { ...v, isAreaBased: true, usageUnit: 'm²', widthM: 0, heightM: 0, widthMStr: '', heightMStr: '', usageAmount: 0 };
            return { ...v, isAreaBased: false };
        }));
    };

    const updateAreaDimension = (id: string, field: 'widthM' | 'heightM', raw: string) => {
        const value = parseFloat(raw.replace(',', '.')) || 0;
        const strField = field === 'widthM' ? 'widthMStr' : 'heightMStr';
        setVariableCosts(prev => prev.map(v => {
            if (v.id !== id) return v;
            const newW = field === 'widthM' ? value : (v.widthM || 0);
            const newH = field === 'heightM' ? value : (v.heightM || 0);
            return { ...v, [field]: value, [strField]: raw, usageAmount: newW * newH };
        }));
    };

    const removeVariableCost = (id: string) => {
        setVariableCosts(variableCosts.filter(v => v.id !== id));
    };

    const updateVariableCost = (id: string, field: keyof VariableCost, value: any) => {
        setVariableCosts(prev => prev.map(v => v.id === id ? { ...v, [field]: value } : v));
    };

    // Applies all fields from a selected stock variant to a VariableCost row in one atomic update
    const applyVariantToVariableCost = (rowId: string, variantIdStr: string) => {
        if (!variantIdStr) return;
        let foundVariant: any = null;
        let foundProduct: any = null;
        for (const p of dbProducts) {
            const va = p.variants?.find((vx: any) => vx.id.toString() === variantIdStr);
            if (va) { foundVariant = va; foundProduct = p; break; }
        }
        if (!foundVariant || !foundProduct) return;
        const unit = foundProduct.unit?.name || 'pcs';
        setVariableCosts(prev => prev.map(row =>
            row.id === rowId ? {
                ...row,
                productVariantId: foundVariant.id,
                name: foundVariant.variantName ? `${foundProduct.name} - ${foundVariant.variantName}` : foundProduct.name,
                price: Number(foundVariant.price),
                priceUnit: unit,
                usageUnit: unit, // auto-sync usage unit to stock's unit
            } : row
        ));
    };

    // Three pricing tiers
    const priceTiers = {
        kompetitif: { label: 'Kompetitif', margin: Math.max(targetMargin - 15, 5), color: 'blue', description: 'Harga bersaing, margin tipis' },
        standar: { label: 'Standar', margin: targetMargin, color: 'primary', description: `Margin target Anda (${targetMargin}%)` },
        premium: { label: 'Premium', margin: targetMargin + 20, color: 'amber', description: 'Harga premium, margin tebal' },
    };
    const selectedTierMargin = priceTiers[selectedTier].margin;
    const suggestedPrice = hppPerPcs * (1 + (selectedTierMargin / 100));
    const potentialMonthlyProfit = (suggestedPrice - hppPerPcs) * targetVolume;

    // Handlers for Fixed Costs
    const addFixedCost = () => {
        setFixedCosts([...fixedCosts, { id: Date.now().toString(), name: "", amount: 0 }]);
    };

    const removeFixedCost = (id: string) => {
        setFixedCosts(fixedCosts.filter(f => f.id !== id));
    };

    const updateFixedCost = (id: string, field: keyof FixedCost, value: any) => {
        setFixedCosts(fixedCosts.map(f => f.id === id ? { ...f, [field]: value } : f));
    };

    // Fixed cost presets
    const saveAsPreset = () => {
        if (!presetName.trim()) return alert("Beri nama preset terlebih dahulu");
        const newPreset = { id: Date.now().toString(), name: presetName.trim(), costs: fixedCosts.map(f => ({ ...f, id: Date.now().toString() + Math.random() })) };
        setFixedCostPresets(prev => [...prev, newPreset]);
        setPresetName("");
        setShowPresetModal(false);
    };

    const applyPreset = (preset: { id: string; name: string; costs: FixedCost[] }) => {
        setFixedCosts(preset.costs.map(c => ({ ...c, id: Date.now().toString() + Math.random() })));
        setShowPresetModal(false);
    };

    const deletePreset = (presetId: string) => {
        setFixedCostPresets(prev => prev.filter(p => p.id !== presetId));
    };

    if (isLoading) return <div className="p-8 flex justify-center text-muted-foreground"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="min-h-[calc(100vh-80px)] bg-background font-sans pb-24 rounded-tl-2xl overflow-hidden -m-4 sm:-m-6 lg:-m-8 p-4 sm:p-6 lg:p-8">
            <div className="pt-4 pb-8 text-center max-w-3xl mx-auto">
                <h1 className="text-[24px] md:text-[28px] font-bold text-foreground tracking-tight">Kalkulator HPP & Resep</h1>
                <p className="mt-2 text-[14px] text-muted-foreground font-medium">Buat template resep produk (Worksheet). Bahan baku terkoneksi langsung dengan Stok Sistem.</p>
            </div>

            <div className="max-w-6xl mx-auto space-y-6">

                {/* Worksheet Selector Bar */}
                <div className="bg-card rounded-[8px] shadow-sm border border-border p-3 sm:p-4 transition-shadow hover:shadow-md">
                    <div className="flex flex-wrap items-center gap-3">
                        {/* Worksheet selector */}
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-foreground whitespace-nowrap">📋 Worksheet:</span>
                            <div className="relative min-w-[200px]">
                                <select
                                    value={activeWorksheetId?.toString() || ""}
                                    onChange={(e) => handleSelectWorksheet(e.target.value)}
                                    className="w-full appearance-none bg-background border border-border rounded-[6px] pl-3 pr-8 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer">
                                    <option value="">-- Worksheet Baru --</option>
                                    {worksheets.map((ws: any) => (
                                        <option key={ws.id} value={ws.id}>{ws.productName || `Worksheet #${ws.id}`}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                            </div>
                        </div>

                        <div className="w-px h-6 bg-border hidden sm:block" />

                        {activeWorksheetId && (
                            <span className="text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                                #{activeWorksheetId} · {productName || 'Tanpa Nama'}
                            </span>
                        )}

                        <div className="flex items-center gap-1.5 ml-auto">
                            <button onClick={handleSaveWorksheet} title="Simpan Worksheet" className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 text-white hover:bg-blue-600 rounded-[6px] border border-blue-500 transition-colors text-xs font-bold">
                                <Save className="w-3.5 h-3.5" /> Simpan
                            </button>
                            <button onClick={resetWorksheet} title="Buat Worksheet Baru" className="flex items-center gap-1.5 px-2.5 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-[6px] border border-green-200 transition-colors text-xs font-semibold" aria-label="Baru">
                                <Plus className="w-3.5 h-3.5" /> Baru
                            </button>
                            {activeWorksheetId && (
                                <button onClick={handleDeleteWorksheet} title="Hapus Worksheet ini" className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-[6px] border border-red-200 transition-colors text-xs font-semibold" aria-label="Hapus">
                                    <Trash2 className="w-3.5 h-3.5" /> Hapus
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    <div className="lg:col-span-8 space-y-6">
                        {/* Parameter Kalkulasi Card */}
                        <div className="bg-card rounded-[12px] md:rounded-[16px] shadow-sm border border-border p-5 md:p-6 transition-shadow hover:shadow-md">
                            <h2 className="text-base md:text-lg font-bold text-foreground mb-5">Parameter Kalkulasi</h2>
                            <div className="space-y-5">

                                {/* Row 1: Nama Produk + Kategori */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[13px] font-semibold text-foreground/80 mb-1.5">Nama Produk <span className="text-red-500">*</span></label>
                                        <input type="text" value={productName} onChange={(e) => setProductName(e.target.value)}
                                            placeholder="Cth: Kopi Susu Aren, Sablon Kaos A3..."
                                            className="w-full bg-muted border border-border rounded-[10px] px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-foreground" />
                                    </div>
                                    <div>
                                        <label className="block text-[13px] font-semibold text-foreground/80 mb-1.5">Kategori Produk</label>
                                        <div className="relative">
                                            <select value={productCategory} onChange={(e) => setProductCategory(e.target.value)}
                                                className="w-full appearance-none bg-muted border border-border rounded-[10px] pl-3.5 pr-8 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-foreground cursor-pointer">
                                                <option value="">-- Pilih Kategori --</option>
                                                <option value="makanan">Makanan</option>
                                                <option value="minuman">Minuman</option>
                                                <option value="merchandise">Merchandise</option>
                                                <option value="cetak">Cetak / Print</option>
                                                <option value="jasa">Jasa</option>
                                                <option value="lainnya">Lainnya</option>
                                            </select>
                                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                                        </div>
                                    </div>
                                </div>

                                {/* Row 2: Gambar Produk (Opsional) */}
                                <div>
                                    <label className="block text-[13px] font-semibold text-foreground/80 mb-1.5">
                                        Gambar Produk <span className="text-muted-foreground font-normal">(Opsional)</span>
                                    </label>
                                    {/* Hidden native file input */}
                                    <input
                                        ref={imageFileRef}
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleImageFileChange}
                                    />
                                    <div className="flex items-center gap-4">
                                        {/* Clickable preview area */}
                                        <button
                                            type="button"
                                            onClick={() => imageFileRef.current?.click()}
                                            className="group relative w-20 h-20 rounded-[12px] border-2 border-dashed border-border bg-muted flex items-center justify-center overflow-hidden shrink-0 hover:border-primary hover:bg-primary/5 transition-all cursor-pointer">
                                            {productImageUrl ? (
                                                <>
                                                    <img src={productImageUrl} alt="preview" className="w-full h-full object-cover" />
                                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <ImageIcon className="w-5 h-5 text-white" />
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="flex flex-col items-center gap-1">
                                                    <ImageIcon className="w-6 h-6 text-muted-foreground/50 group-hover:text-primary/50 transition-colors" />
                                                    <span className="text-[10px] text-muted-foreground font-medium">Klik upload</span>
                                                </div>
                                            )}
                                        </button>
                                        <div className="flex-1 space-y-1.5">
                                            <button
                                                type="button"
                                                onClick={() => imageFileRef.current?.click()}
                                                className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-[8px] text-sm font-semibold text-foreground hover:border-primary hover:text-primary transition-all">
                                                <ImageIcon className="w-4 h-4" /> Pilih Gambar dari Perangkat
                                            </button>
                                            {productImageUrl && (
                                                <button type="button" onClick={() => {
                                                    setProductImageUrl('');
                                                    if (imageFileRef.current) imageFileRef.current.value = '';
                                                }}
                                                    className="text-xs text-red-500 hover:text-red-700 font-semibold">
                                                    × Hapus Gambar
                                                </button>
                                            )}
                                            <p className="text-[11px] text-muted-foreground">Format: JPG, PNG, WEBP. Maks 5MB.</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Row 3: Mode Perhitungan HPP */}
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <label className="text-[13px] font-semibold text-foreground/80">Mode Perhitungan HPP</label>
                                        <div className="relative group">
                                            <span className="w-4 h-4 rounded-full bg-muted border border-border text-muted-foreground text-[10px] font-bold flex items-center justify-center cursor-help">?</span>
                                            <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 hidden group-hover:block z-20 w-64 p-3 bg-card border border-border rounded-[10px] shadow-lg text-[12px] text-muted-foreground leading-relaxed">
                                                <b className="text-foreground block mb-1">Apa bedanya?</b>
                                                <p><b className="text-primary">Per Pcs:</b> Bahan baku dimasukkan sebagai kebutuhan per 1 buah produk jadi. HPP = total bahan per 1 pcs.</p>
                                                <p className="mt-1"><b className="text-amber-600">Per Resep (Batch):</b> Bahan baku dimasukkan untuk sekali produksi penuh (misalnya 1 loyang, 1 pot, dll). HPP per pcs = total bahan ÷ jumlah hasil jadi.</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setHppMode('per_pcs')}
                                            className={`flex flex-col items-start gap-1 p-4 rounded-[12px] border-2 transition-all text-left ${hppMode === 'per_pcs'
                                                ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                                                : 'border-border bg-muted/50 hover:border-primary/40'
                                                }`}>
                                            <div className="flex items-center gap-2 w-full">
                                                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${hppMode === 'per_pcs' ? 'border-primary' : 'border-muted-foreground'
                                                    }`}>
                                                    {hppMode === 'per_pcs' && <div className="w-2 h-2 bg-primary rounded-full" />}
                                                </div>
                                                <span className={`text-sm font-bold ${hppMode === 'per_pcs' ? 'text-primary' : 'text-foreground'}`}>
                                                    Per Pcs (Satuan)
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-muted-foreground pl-6">Hitung HPP per 1 unit produk jadi. Cocok untuk produk yang dijual satuan.</p>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setHppMode('per_batch')}
                                            className={`flex flex-col items-start gap-1 p-4 rounded-[12px] border-2 transition-all text-left ${hppMode === 'per_batch'
                                                ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-200'
                                                : 'border-border bg-muted/50 hover:border-amber-400'
                                                }`}>
                                            <div className="flex items-center gap-2 w-full">
                                                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${hppMode === 'per_batch' ? 'border-amber-500' : 'border-muted-foreground'
                                                    }`}>
                                                    {hppMode === 'per_batch' && <div className="w-2 h-2 bg-amber-500 rounded-full" />}
                                                </div>
                                                <span className={`text-sm font-bold ${hppMode === 'per_batch' ? 'text-amber-700' : 'text-foreground'}`}>
                                                    Per Resep (Batch)
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-muted-foreground pl-6">Hitung HPP per satu kali produksi penuh. Cocok untuk produk massal atau catering.</p>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Biaya Variabel */}
                        <div className="bg-card rounded-[12px] md:rounded-[16px] shadow-sm border border-border overflow-hidden transition-shadow hover:shadow-md">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 md:p-6 border-b border-border/50 gap-3">
                                <div>
                                    <h2 className="text-base md:text-lg font-bold text-foreground">Bahan Baku (Biaya Variabel)</h2>
                                    <span className="text-xs font-medium text-muted-foreground mt-0.5 block">Diambil dari stok produk gudang Anda. Harga tersinkronisasi.</span>
                                </div>
                            </div>
                            {/* Mobile Cards — Biaya Variabel */}
                            <div className="md:hidden p-4 space-y-3">
                                {variableCosts.map((v) => (
                                    <div key={v.id} className="bg-muted/30 border border-border rounded-xl p-3 space-y-3">
                                        {/* Bahan Baku */}
                                        {v.isCustom ? (
                                            <CustomNameInput
                                                value={v.name}
                                                onChange={(val) => updateVariableCost(v.id, 'name', val)}
                                                onSwitchToStock={() => updateVariableCost(v.id, 'isCustom', false)}
                                            />
                                        ) : (
                                            <VariantCombobox
                                                rowId={v.id}
                                                currentVariantId={v.productVariantId}
                                                currentName={v.name}
                                                dbProducts={dbProducts}
                                                onSelectVariant={applyVariantToVariableCost}
                                                onSelectManual={(rowId, initialName) => setVariableCosts(prev => prev.map(c => c.id === rowId ? { ...c, isCustom: true, productVariantId: undefined, name: initialName || '' } : c))}
                                            />
                                        )}

                                        {/* Acuan Stok */}
                                        {!v.isCustom && v.productVariantId && (
                                            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer" title="Stok Produk akhir dihitung berdasarkan sisa stok bahan ini dibagi Takaran.">
                                                <input type="checkbox" checked={v.isAcuanStok || false} onChange={(e) => updateVariableCost(v.id, 'isAcuanStok', e.target.checked)} className="w-4 h-4 text-primary cursor-pointer rounded" />
                                                Jadikan Acuan Stok Produk
                                            </label>
                                        )}

                                        {/* Takaran + Harga */}
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Takaran / Pcs</p>
                                                {v.isAreaBased ? (
                                                    <div className="space-y-1.5">
                                                        <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-[8px] px-2.5 py-2">
                                                            <span className="text-[10px] font-bold text-blue-500 shrink-0">L</span>
                                                            <input type="text" inputMode="decimal" value={v.widthMStr ?? ''} onChange={(e) => updateAreaDimension(v.id, 'widthM', e.target.value)}
                                                                className="flex-1 min-w-0 bg-transparent text-center text-[13px] font-semibold text-blue-700 outline-none placeholder:text-blue-300" placeholder="0" />
                                                            <span className="text-[12px] text-blue-400 font-bold shrink-0">×</span>
                                                            <span className="text-[10px] font-bold text-blue-500 shrink-0">T</span>
                                                            <input type="text" inputMode="decimal" value={v.heightMStr ?? ''} onChange={(e) => updateAreaDimension(v.id, 'heightM', e.target.value)}
                                                                className="flex-1 min-w-0 bg-transparent text-center text-[13px] font-semibold text-blue-700 outline-none placeholder:text-blue-300" placeholder="0" />
                                                            <span className="text-[10px] font-semibold text-blue-500 shrink-0">m</span>
                                                        </div>
                                                        <div className="flex items-center justify-between px-0.5">
                                                            <span className="text-[11px] text-blue-600 font-mono font-bold">= {((v.widthM || 0) * (v.heightM || 0)).toFixed(4)} m²</span>
                                                            <button onClick={() => toggleAreaMode(v.id, false)} className="text-[10px] text-muted-foreground hover:text-red-500 transition-colors" title="Kembali ke mode satuan">✕ kembali</button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex gap-1.5">
                                                        <input type="number" value={v.usageAmount || ''} onChange={(e) => updateVariableCost(v.id, 'usageAmount', Number(e.target.value))}
                                                            className="w-14 px-2 py-2 bg-background border border-border rounded-[6px] text-[13px] font-medium text-foreground outline-none focus:border-primary text-center" placeholder="0" />
                                                        <select value={v.usageUnit} onChange={(e) => updateVariableCost(v.id, 'usageUnit', e.target.value)}
                                                            className="flex-1 pl-2 pr-1 py-2 border border-border rounded-[6px] bg-background text-[12px] text-foreground font-semibold outline-none cursor-pointer focus:border-primary">
                                                            <option value="gram">gram</option><option value="kg">kg</option><option value="mg">mg</option>
                                                            <option value="ml">ml</option><option value="L">L</option><option value="gelas">gelas</option><option value="sdm">sdm</option><option value="sdt">sdt</option>
                                                            <option value="pcs">pcs</option><option value="buah">buah</option><option value="lembar">lembar</option><option value="bungkus">bungkus</option><option value="box">box</option><option value="pak">pak</option>
                                                            <option value="cm">cm</option><option value="m">m</option><option value="m²">m²</option>
                                                        </select>
                                                        <button onClick={() => toggleAreaMode(v.id, true)} title="Hitung luas Lebar × Tinggi (m²)"
                                                            className="px-1.5 py-2 border border-dashed border-border rounded-[6px] text-[10px] font-bold text-muted-foreground hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all shrink-0">m²</button>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Harga</p>
                                                <div className="flex bg-background border border-border rounded-[6px] overflow-hidden focus-within:border-primary">
                                                    <span className="bg-muted px-2 py-2 font-semibold text-[12px] border-r border-border text-muted-foreground">Rp</span>
                                                    <input type="number" value={v.price || ''} onChange={(e) => updateVariableCost(v.id, 'price', Number(e.target.value))} className="w-full bg-transparent px-2 py-2 text-[13px] font-semibold outline-none text-right" placeholder="0" />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Per unit + Subtotal + Delete */}
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[11px] text-muted-foreground">Per</span>
                                                <select value={v.priceUnit || 'pcs'} onChange={(e) => updateVariableCost(v.id, 'priceUnit', e.target.value)}
                                                    className="pl-2 pr-5 py-1.5 border border-border rounded-[6px] bg-background text-[12px] font-semibold outline-none cursor-pointer focus:border-primary appearance-none">
                                                    <option value="gram">gram</option><option value="kg">kg</option><option value="mg">mg</option>
                                                    <option value="ml">ml</option><option value="L">L</option><option value="gelas">gelas</option>
                                                    <option value="pcs">pcs</option><option value="buah">buah</option><option value="lembar">lembar</option><option value="bungkus">bungkus</option><option value="box">box</option>
                                                    <option value="cm">cm</option><option value="m">m</option>
                                                </select>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="bg-green-50 text-green-700 font-bold text-[13px] px-3 py-1.5 rounded-[6px] border border-green-200">
                                                    Rp {Math.round(calculateVariableSubtotal(v)).toLocaleString('id-ID')}
                                                </div>
                                                <button onClick={() => removeVariableCost(v.id)} className="p-2 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-[6px] border border-border hover:border-red-200 transition-all">
                                                    <Trash className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {variableCosts.length > 0 && (
                                    <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 flex justify-between items-center">
                                        <span className="font-semibold text-[13px] text-muted-foreground">Total Biaya B.Baku/Pcs:</span>
                                        <span className="font-bold text-[15px] text-primary">Rp {Math.round(totalVariablePerPcs).toLocaleString('id-ID')}</span>
                                    </div>
                                )}
                            </div>

                            {/* Desktop Table — Biaya Variabel */}
                            <div className="hidden md:block overflow-x-auto">
                                <table className="w-full text-left border-collapse min-w-[800px]">
                                    <thead>
                                        <tr className="bg-muted/50 border-b border-border/50 bg-slate-50">
                                            <th className="px-3 py-3 text-[11px] md:text-xs font-bold text-muted-foreground uppercase tracking-wide w-1/4">BAHAN BAKU</th>
                                            <th className="px-2 py-3 text-[11px] md:text-xs font-bold text-muted-foreground uppercase tracking-wide text-center" title="Jadikan Acuan Stok Produk">ACUAN STOK</th>
                                            <th className="px-3 py-3 text-[11px] md:text-xs font-bold text-muted-foreground uppercase tracking-wide">TAKARAN / PCS</th>
                                            <th className="px-3 py-3 text-[11px] md:text-xs font-bold text-muted-foreground uppercase tracking-wide">HARGA</th>
                                            <th className="px-3 py-3 text-[11px] md:text-xs font-bold text-muted-foreground uppercase tracking-wide">JML</th>
                                            <th className="px-3 py-3 text-[11px] md:text-xs font-bold text-muted-foreground uppercase tracking-wide">UNIT</th>
                                            <th className="px-3 py-3 text-[11px] md:text-xs font-bold text-muted-foreground uppercase tracking-wide text-right">SUBTOTAL</th>
                                            <th className="w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/50">
                                        {variableCosts.map((v) => (
                                            <tr key={v.id} className="group hover:bg-muted/30 transition-colors">
                                                <td className="px-3 py-2 md:py-3 align-middle min-w-[200px]">
                                                    {v.isCustom ? (
                                                        <CustomNameInput
                                                            value={v.name}
                                                            onChange={(val) => updateVariableCost(v.id, 'name', val)}
                                                            onSwitchToStock={() => updateVariableCost(v.id, 'isCustom', false)}
                                                        />
                                                    ) : (
                                                        <VariantCombobox
                                                            rowId={v.id}
                                                            currentVariantId={v.productVariantId}
                                                            currentName={v.name}
                                                            dbProducts={dbProducts}
                                                            onSelectVariant={applyVariantToVariableCost}
                                                            onSelectManual={(rowId, initialName) => setVariableCosts(prev => prev.map(c => c.id === rowId ? { ...c, isCustom: true, productVariantId: undefined, name: initialName || '' } : c))}
                                                        />
                                                    )}
                                                </td>
                                                <td className="px-2 py-2 md:py-3 align-middle text-center">
                                                    {!v.isCustom && v.productVariantId && (
                                                        <div className="flex justify-center" title="Stok Produk akhir akan dihitung berdasarkan sisa stok bahan ini dibagi Takaran.">
                                                            <input type="checkbox" checked={v.isAcuanStok || false} onChange={(e) => updateVariableCost(v.id, 'isAcuanStok', e.target.checked)} className="w-4 h-4 text-primary focus:ring-primary/50 cursor-pointer rounded" />
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2 md:py-3 align-middle">
                                                    {v.isAreaBased ? (
                                                        <div className="space-y-1.5 min-w-[155px]">
                                                            <div className="flex items-center gap-1 bg-blue-50 border border-blue-200 rounded-[8px] px-2 py-1.5">
                                                                <span className="text-[10px] font-bold text-blue-500 shrink-0">L</span>
                                                                <input
                                                                    type="text" inputMode="decimal"
                                                                    value={v.widthMStr ?? ''}
                                                                    onChange={e => updateAreaDimension(v.id, 'widthM', e.target.value)}
                                                                    className="w-0 flex-1 bg-transparent text-center text-[13px] font-semibold text-blue-700 outline-none placeholder:text-blue-300"
                                                                    placeholder="0"
                                                                />
                                                                <span className="text-[12px] text-blue-400 font-bold shrink-0">×</span>
                                                                <span className="text-[10px] font-bold text-blue-500 shrink-0">T</span>
                                                                <input
                                                                    type="text" inputMode="decimal"
                                                                    value={v.heightMStr ?? ''}
                                                                    onChange={e => updateAreaDimension(v.id, 'heightM', e.target.value)}
                                                                    className="w-0 flex-1 bg-transparent text-center text-[13px] font-semibold text-blue-700 outline-none placeholder:text-blue-300"
                                                                    placeholder="0"
                                                                />
                                                                <span className="text-[10px] font-semibold text-blue-500 shrink-0">m</span>
                                                            </div>
                                                            <div className="flex items-center justify-between px-0.5">
                                                                <span className="text-[11px] text-blue-600 font-mono font-bold">= {((v.widthM || 0) * (v.heightM || 0)).toFixed(4)} m²</span>
                                                                <button type="button" onClick={() => toggleAreaMode(v.id, false)} className="text-[10px] text-muted-foreground hover:text-red-500 transition-colors" title="Kembali ke mode satuan">✕</button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-1.5">
                                                            <input type="number" value={v.usageAmount || ''} onChange={(e) => updateVariableCost(v.id, 'usageAmount', Number(e.target.value))}
                                                                className="w-[70px] px-3 py-2 bg-background border border-border rounded-[6px] text-[13px] font-medium text-foreground outline-none focus:border-primary text-center" placeholder="0" />
                                                            <div className="relative">
                                                                <select value={v.usageUnit} onChange={(e) => updateVariableCost(v.id, 'usageUnit', e.target.value)}
                                                                    className="appearance-none w-[80px] pl-3 pr-6 py-2 border border-border rounded-[6px] bg-background text-[13px] text-foreground font-semibold outline-none cursor-pointer focus:border-primary">
                                                                    <optgroup label="Berat">
                                                                        <option value="gram">gram</option><option value="kg">kg</option><option value="mg">mg</option>
                                                                    </optgroup>
                                                                    <optgroup label="Volume">
                                                                        <option value="ml">ml</option><option value="L">L</option><option value="gelas">gelas</option><option value="sdm">sdm</option><option value="sdt">sdt</option>
                                                                    </optgroup>
                                                                    <optgroup label="Satuan">
                                                                        <option value="pcs">pcs</option><option value="buah">buah</option><option value="lembar">lembar</option><option value="bungkus">bungkus</option><option value="box">box</option><option value="pak">pak</option>
                                                                    </optgroup>
                                                                    <optgroup label="Panjang / Luas">
                                                                        <option value="cm">cm</option><option value="m">m</option><option value="m²">m²</option>
                                                                    </optgroup>
                                                                </select>
                                                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-muted-foreground opacity-70" />
                                                            </div>
                                                            <button type="button" onClick={() => toggleAreaMode(v.id, true)} title="Hitung luas dari Lebar × Tinggi (m²)"
                                                                className="px-1.5 py-2 border border-dashed border-border rounded-[6px] text-[10px] font-bold text-muted-foreground hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all shrink-0">m²</button>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2 md:py-3 align-middle">
                                                    <div className="flex bg-background border border-border rounded-[6px] overflow-hidden min-w-[110px] focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20">
                                                        <span className="bg-muted px-2 py-2 font-semibold text-[13px] border-r border-border text-muted-foreground">Rp</span>
                                                        <input type="number" value={v.price || ''} onChange={(e) => updateVariableCost(v.id, 'price', Number(e.target.value))} className="w-full bg-transparent px-2 py-2 text-[13px] font-semibold outline-none text-right" placeholder="0" />
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2 md:py-3 align-middle">
                                                    <input type="number" value={v.usageAmount || ''} readOnly className="w-[50px] px-2 py-2 bg-muted/40 border border-border text-muted-foreground rounded-[6px] text-[13px] font-semibold text-center outline-none opacity-70" title="Jumlah diisi di Takaran/PCS" />
                                                </td>
                                                <td className="px-3 py-2 md:py-3 align-middle">
                                                    <div className="relative min-w-[80px]">
                                                        <select value={v.priceUnit || 'pcs'} onChange={(e) => updateVariableCost(v.id, 'priceUnit', e.target.value)} className="appearance-none w-full pl-2 pr-6 py-2 border border-border text-foreground rounded-[6px] bg-background text-[13px] font-semibold outline-none cursor-pointer focus:border-primary">
                                                            <optgroup label="Berat">
                                                                <option value="gram">gram</option><option value="kg">kg</option><option value="mg">mg</option>
                                                            </optgroup>
                                                            <optgroup label="Volume">
                                                                <option value="ml">ml</option><option value="L">L</option><option value="gelas">gelas</option>
                                                            </optgroup>
                                                            <optgroup label="Satuan">
                                                                <option value="pcs">pcs</option><option value="buah">buah</option><option value="lembar">lembar</option><option value="bungkus">bungkus</option><option value="box">box</option>
                                                            </optgroup>
                                                            <optgroup label="Panjang">
                                                                <option value="cm">cm</option><option value="m">m</option>
                                                            </optgroup>
                                                        </select>
                                                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-muted-foreground opacity-50" />
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2 md:py-3 align-middle text-right">
                                                    <div className="bg-green-50 text-green-700 font-bold text-[14px] px-3 py-1.5 rounded-[6px] inline-block border border-green-200 min-w-[100px] text-center">
                                                        Rp {Math.round(calculateVariableSubtotal(v)).toLocaleString('id-ID')}
                                                    </div>
                                                </td>
                                                <td className="py-2 md:py-3 align-middle text-center pr-2">
                                                    <button onClick={() => removeVariableCost(v.id)} className="p-2 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-[4px] border border-transparent hover:border-red-200 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100">
                                                        <Trash className="h-4 w-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        <tr className="bg-primary/5">
                                            <td colSpan={6} className="px-4 py-4 text-right"><span className="font-semibold text-[13px] text-muted-foreground">Total Biaya B.Baku/Pcs:</span></td>
                                            <td className="px-3 py-4 text-right"><span className="font-bold text-[15px] text-primary">Rp {Math.round(totalVariablePerPcs).toLocaleString('id-ID')}</span></td>
                                            <td></td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                            <div className="p-5 md:p-6 bg-muted/50 border-t border-border/50">
                                <button onClick={addVariableCost} className="flex items-center justify-center sm:justify-start gap-2 px-4 py-2 border border-border bg-card text-foreground/80 font-semibold rounded-[10px] hover:border-primary hover:text-primary transition-all text-sm w-full sm:w-auto">
                                    <Plus className="h-4 w-4" /> Tambah Bahan Baru
                                </button>
                            </div>
                        </div>

                        {/* Alokasi Biaya Tetap */}
                        <div className="bg-card rounded-[12px] md:rounded-[16px] shadow-sm border border-border p-5 md:p-6 transition-shadow hover:shadow-md">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                                <div><h2 className="text-base md:text-lg font-bold text-foreground">Biaya Tetap (Fixed Cost) Bulanan</h2>
                                    <p className="text-xs text-muted-foreground mt-1">Biaya non-bahan baku seperti Gaji, Sewa, dsb.</p></div>
                            </div>
                            <div className="space-y-6">
                                <div className="p-4 bg-primary/5 border border-primary/20 rounded-[12px] flex flex-col sm:flex-row items-center gap-4">
                                    <div className="flex-1">
                                        <label className="block text-[13px] md:text-sm font-bold text-foreground mb-1">Target Volume Penjualan Sebulan</label>
                                    </div>
                                    <div className="relative w-full sm:max-w-[200px]">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Target className="h-4 w-4 text-primary" /></div>
                                        <input type="number" value={targetVolume || ''} onChange={(e) => setTargetVolume(Number(e.target.value))}
                                            className="w-full bg-card border-2 border-primary/30 rounded-[10px] pl-9 pr-14 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-foreground" />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground font-bold bg-card">Pcs</span>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    {fixedCosts.map((f) => (
                                        <div key={f.id} className="flex flex-col sm:flex-row sm:items-end gap-3 p-4 bg-muted/50 border border-border/50 rounded-[12px]">
                                            <div className="flex-1">
                                                <label className="block text-[12px] font-semibold text-muted-foreground mb-1">Nama Biaya</label>
                                                <input type="text" value={f.name} onChange={(e) => updateFixedCost(f.id, 'name', e.target.value)} placeholder="Sewa"
                                                    className="w-full bg-card border border-border rounded-[8px] px-3 py-2 text-[13px] font-medium outline-none focus:border-primary text-foreground" />
                                            </div>
                                            <div className="flex-1 relative">
                                                <label className="block text-[12px] font-semibold text-muted-foreground mb-1">Total Biaya Bulanan</label>
                                                <input type="number" value={f.amount || ''} onChange={(e) => updateFixedCost(f.id, 'amount', Number(e.target.value))}
                                                    className="w-full bg-card border border-border rounded-[8px] px-3 py-2 text-[13px] font-semibold outline-none focus:border-primary text-foreground" />
                                            </div>
                                            <button onClick={() => removeFixedCost(f.id)} className="p-2 mb-0.5 text-muted-foreground hover:text-destructive border border-border rounded-[8px] hover:border-destructive/30 hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
                                        </div>
                                    ))}
                                </div>
                                {/* Fixed Cost Presets */}
                                <div className="flex items-center justify-between border-t border-border/50 pt-4">
                                    <div className="flex gap-2">
                                        <button onClick={addFixedCost} className="flex items-center gap-1.5 px-4 py-2 bg-card text-muted-foreground font-semibold rounded-[8px] hover:text-primary transition-all text-[13px] border border-border"><Plus className="h-4 w-4" />Tambah</button>
                                        <button onClick={() => setShowPresetModal(true)} className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 text-amber-700 font-semibold rounded-[8px] hover:bg-amber-100 transition-all text-[13px] border border-amber-200">
                                            <FileText className="h-4 w-4" /> Simpan &amp; Gunakan Preset
                                        </button>
                                    </div>
                                    <div className="text-right"><p className="text-xs text-muted-foreground font-medium">Total Fixed Cost Bulanan</p><p className="text-lg font-bold text-foreground">Rp {totalFixedMonthly.toLocaleString('id-ID')}</p></div>
                                </div>
                            </div>
                        </div>

                        <div className="pt-2 pb-6">
                            <button onClick={() => setHasCalculated(true)} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-[15px] py-4 rounded-[12px] shadow-md transition-all flex items-center justify-center gap-2">
                                <Calculator className="w-5 h-5" /> REFRESH KALKULASI HASIL
                            </button>
                        </div>
                    </div >

                    <div className="lg:col-span-4 lg:sticky lg:top-8 mt-2 lg:mt-0">
                        <div className="bg-card rounded-[12px] shadow-sm border border-border flex flex-col overflow-hidden">
                            <div className="p-4 border-b border-border/50 flex justify-between items-center bg-card/80">
                                <h2 className="text-base font-bold text-foreground flex items-center gap-2"><BarChart2 className="h-5 w-5 text-primary" />Hasil Analisis HPP</h2>
                            </div>
                            {!hasCalculated ? (
                                <div className="flex-1 p-6 flex flex-col items-center justify-center text-center min-h-[300px]">
                                    <Calculator className="w-10 h-10 text-muted-foreground/30 mb-3" />
                                    <h3 className="text-[15px] font-bold text-foreground mb-2">Siap Dihitung</h3>
                                    <p className="text-[13px] text-muted-foreground max-w-[220px]">Isi bahan baku dan klik tombol Kalkulasikan untuk melihat hasil analisis HPP.</p>
                                </div>
                            ) : (
                                <div className="p-5 space-y-5">
                                    {/* HPP Summary */}
                                    <div className="space-y-2">
                                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Struktur Modal / Pcs</p>
                                        <div className="flex justify-between text-sm"><span className="text-muted-foreground">Bahan Baku:</span><b>Rp {Math.round(totalVariablePerPcs).toLocaleString('id-ID')}</b></div>
                                        <div className="flex justify-between text-sm"><span className="text-muted-foreground">Biaya Tetap/Pcs:</span><b>Rp {Math.round(allocatedFixedPerPcs).toLocaleString('id-ID')}</b></div>
                                        <div className="flex justify-between items-center p-2.5 bg-primary/5 rounded-lg border border-primary/20">
                                            <span className="font-bold text-sm text-foreground/80">TOTAL MODAL POKOK</span>
                                            <span className="text-base font-black text-primary">Rp {Math.round(hppPerPcs).toLocaleString('id-ID')}</span>
                                        </div>
                                    </div>

                                    {/* Pricing Tiers */}
                                    <div className="space-y-2">
                                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Opsi Harga Jual</p>
                                        {(['kompetitif', 'standar', 'premium'] as const).map((tier) => {
                                            const t = priceTiers[tier];
                                            const price = hppPerPcs * (1 + t.margin / 100);
                                            const profit = price - hppPerPcs;
                                            const isSelected = selectedTier === tier;
                                            const colors = {
                                                kompetitif: isSelected ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-200' : 'bg-card border-border hover:border-blue-300',
                                                standar: isSelected ? 'bg-primary/5 border-primary ring-2 ring-primary/20' : 'bg-card border-border hover:border-primary/50',
                                                premium: isSelected ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-200' : 'bg-card border-border hover:border-amber-300',
                                            };
                                            const textColors = { kompetitif: 'text-blue-700', standar: 'text-primary', premium: 'text-amber-700' };
                                            return (
                                                <button key={tier} onClick={() => setSelectedTier(tier)}
                                                    className={`w-full flex items-center justify-between p-3 rounded-[10px] border transition-all cursor-pointer ${colors[tier]}`}>
                                                    <div className="text-left">
                                                        <p className={`text-[13px] font-bold ${textColors[tier]}`}>{t.label} <span className="text-[11px] font-medium opacity-70">({t.margin}%)</span></p>
                                                        <p className="text-[11px] text-muted-foreground">{t.description}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className={`text-[15px] font-black ${textColors[tier]}`}>Rp {Math.round(price).toLocaleString('id-ID')}</p>
                                                        <p className="text-[11px] text-green-600 font-semibold">+Rp {Math.round(profit).toLocaleString('id-ID')}/pcs</p>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* Projection */}
                                    <div className="bg-green-50 border border-green-200 rounded-[10px] p-3 text-center">
                                        <p className="text-[11px] text-green-700 font-semibold">Estimasi Laba Bulanan ({targetVolume.toLocaleString('id-ID')} pcs)</p>
                                        <p className="text-xl font-black text-green-700">Rp {Math.round(potentialMonthlyProfit).toLocaleString('id-ID')}</p>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="space-y-4 pt-2 border-t border-border/50">
                                        <div className="space-y-4 mb-4 bg-muted/30 p-4 border border-border rounded-lg">
                                            {/* Pricing Mode Selection */}
                                            <div>
                                                <label className="block text-sm font-semibold text-foreground mb-2">Pilih Mode Penjualan 🌍</label>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <label className={cn("border-2 rounded-[6px] p-2 flex items-center justify-center gap-2 cursor-pointer transition-all", sellingPricingMode === 'UNIT' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted')}>
                                                        <input type="radio" value="UNIT" checked={sellingPricingMode === 'UNIT'} onChange={() => setSellingPricingMode('UNIT')} className="hidden" />
                                                        <Package className="w-4 h-4" /> <span className="text-xs font-bold">Produk Satuan (Pcs/Box)</span>
                                                    </label>
                                                    <label className={cn("border-2 rounded-[6px] p-2 flex items-center justify-center gap-2 cursor-pointer transition-all", sellingPricingMode === 'AREA_BASED' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted')}>
                                                        <input type="radio" value="AREA_BASED" checked={sellingPricingMode === 'AREA_BASED'} onChange={() => setSellingPricingMode('AREA_BASED')} className="hidden" />
                                                        <Map className="w-4 h-4" /> <span className="text-xs font-bold">Cetak Luas (m²)</span>
                                                    </label>
                                                </div>
                                            </div>

                                            {/* Edit Final Price */}
                                            <div>
                                                <div className="flex justify-between items-center mb-1.5">
                                                    <label className="text-sm font-semibold text-foreground">Harga Jual Kustom</label>
                                                    {customSellingPrice !== null && (
                                                        <button onClick={() => setCustomSellingPrice(null)} className="text-[11px] text-primary font-bold hover:underline">Reset ke {suggestedPrice.toLocaleString('id-ID')}</button>
                                                    )}
                                                </div>
                                                <p className="text-[11px] text-muted-foreground mb-2 block">Isi jika Anda tidak ingin menggunakan angka pasaran yang disarankan sistem (Opsional).</p>
                                                <div className="relative">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">Rp</span>
                                                    <input
                                                        type="number"
                                                        value={customSellingPrice !== null ? customSellingPrice : suggestedPrice}
                                                        onChange={(e) => setCustomSellingPrice(e.target.value ? Number(e.target.value) : null)}
                                                        className="w-full pl-9 pr-3 py-2 bg-background border border-primary/40 rounded-[8px] text-sm font-bold text-foreground focus:ring-2 focus:ring-primary/20 outline-none"
                                                        min={hppPerPcs}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <button
                                            onClick={handleSaveAsProduct}
                                            className="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-bold text-[13px] py-3 rounded-[10px] shadow-sm transition-all">
                                            <ShoppingBag className="w-4 h-4" /> Simpan Perhitungan &amp; Jadikan Produk
                                        </button>
                                        <button
                                            onClick={resetWorksheet}
                                            className="w-full flex items-center justify-center gap-2 bg-muted hover:bg-muted/80 text-muted-foreground font-semibold text-[13px] py-2.5 rounded-[10px] border border-border transition-all">
                                            <ArrowRight className="w-4 h-4" /> Hitung Produk Baru (Reset Form)
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div >
            </div >

            {/* Modal Convert Worksheet -> POS Menu Product */}
            {
                showRegisterProductModal && activeWorksheetId && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
                        <div className="bg-card w-full max-w-sm rounded-[16px] border border-border shadow-2xl p-5 overflow-hidden">
                            <div className="flex justify-between items-center mb-5">
                                <h3 className="font-bold text-lg">Pendaftaran Produk</h3>
                                <button onClick={() => setShowRegisterProductModal(false)} className="text-muted-foreground"><X className="w-5 h-5" /></button>
                            </div>
                            <div className="space-y-4">
                                <p className="text-sm text-muted-foreground">Resep <b>{productName}</b> akan dibuat menjadi Produk di Menu POS. Anda dapat mengatur foto dan Kategori di halaman Produk nanti.</p>
                                <div className="bg-muted p-3 rounded-lg border border-border space-y-1">
                                    <div className="flex justify-between"><span className="text-xs">Nama:</span><span className="text-xs font-bold">{productName}</span></div>
                                    <div className="flex justify-between"><span className="text-xs">Harga Referensi HPP:</span><span className="text-xs font-bold">Rp {Math.round(suggestedPrice).toLocaleString('id-ID')}</span></div>
                                </div>
                                <div className="flex gap-2 justify-end pt-4">
                                    <button onClick={() => setShowRegisterProductModal(false)} className="px-4 py-2 bg-muted text-foreground text-sm font-semibold rounded-lg">Tutup</button>
                                    <a href="/inventory/products" className="px-5 py-2 bg-primary text-primary-foreground text-sm font-bold rounded-lg shadow cursor-pointer text-center">Ke Halaman Produk</a>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Fixed Cost Preset Modal */}
            {showPresetModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
                    <div className="bg-card w-full max-w-md rounded-[16px] border border-border shadow-2xl p-5">
                        <div className="flex justify-between items-center mb-5">
                            <h3 className="font-bold text-lg flex items-center gap-2"><FileText className="w-5 h-5 text-amber-600" /> Preset Biaya Tetap</h3>
                            <button onClick={() => setShowPresetModal(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
                        </div>
                        {/* Save new preset */}
                        <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-[12px] space-y-3">
                            <p className="text-sm font-semibold text-amber-800">Simpan biaya tetap ini sebagai preset:</p>
                            <div className="flex gap-2">
                                <input type="text" value={presetName} onChange={(e) => setPresetName(e.target.value)} placeholder="Cth: Operasional Bulan Maret..."
                                    className="flex-1 bg-card border border-border rounded-[8px] px-3 py-2 text-sm outline-none focus:border-amber-400" />
                                <button onClick={saveAsPreset} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm rounded-[8px] transition-all flex items-center gap-1.5">
                                    <Save className="w-4 h-4" /> Simpan
                                </button>
                            </div>
                        </div>
                        {/* Existing presets */}
                        <div className="space-y-2">
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Preset Tersimpan</p>
                            {fixedCostPresets.length === 0 ? (
                                <p className="text-sm text-muted-foreground italic text-center py-4">Belum ada preset yang disimpan</p>
                            ) : (
                                fixedCostPresets.map(preset => (
                                    <div key={preset.id} className="flex items-center justify-between p-3 bg-muted/40 border border-border rounded-[10px]">
                                        <div>
                                            <p className="text-sm font-semibold text-foreground">{preset.name}</p>
                                            <p className="text-xs text-muted-foreground">{preset.costs.length} item biaya — Total: Rp {preset.costs.reduce((a, c) => a + c.amount, 0).toLocaleString('id-ID')}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => applyPreset(preset)} className="px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 font-semibold text-xs rounded-[6px] transition-all">Gunakan</button>
                                            <button onClick={() => deletePreset(preset.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-[6px] border border-transparent hover:border-red-200 transition-all"><Trash2 className="w-4 h-4" /></button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}
