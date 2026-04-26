"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    Plus, Edit2, Trash2, Image as ImageIcon, Target,
    Download, Trash, ChevronDown, Check, Store, Package, Map,
    BarChart2, Zap, Cog, ShoppingBag, Wrench, Megaphone, FileText,
    Calculator, ArrowRight, Loader2, Save, X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from '@/components/ui/page-header';
import { getHppWorksheets, createHppWorksheet, updateHppWorksheet, deleteHppWorksheet, getHppWorksheetByProduct, getProducts, createProduct, updateProduct, getCategories, getUnits, uploadProductImage, uploadProductImages, addProductVariant, updateProductVariant, applyHppToVariant, applyHppToVariants, applyHppVariantsCustom, uploadVariantImage, replaceVariantPriceTiers, getClickRates } from "@/lib/api";
import { VariableCost, FixedCost } from "./types";
import { CustomNameInput, VariantCombobox } from "./HppInputs";

function HppCalculatorContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const editProductId = searchParams.get('editProductId') ? parseInt(searchParams.get('editProductId')!) : null;

    const [editMode, setEditMode] = useState(false);
    const [editingProductId, setEditingProductId] = useState<number | null>(null);
    const [editingWorksheetId, setEditingWorksheetId] = useState<number | null>(null);
    const [hasLoadedEdit, setHasLoadedEdit] = useState(false);

    const [isLoading, setIsLoading] = useState(true);
    const [worksheets, setWorksheets] = useState<any[]>([]);
    const [dbProducts, setDbProducts] = useState<any[]>([]); // For getting stock/inventory items
    const [dbClickRates, setDbClickRates] = useState<any[]>([]);
    const [hppClickRateId, setHppClickRateId] = useState<number | null>(null);
    const [hppClicksPerUnit, setHppClicksPerUnit] = useState<number>(1);

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
    const [isSavingWorksheet, setIsSavingWorksheet] = useState(false);
    const [isSavingProduct, setIsSavingProduct] = useState(false);

    // Add variant to existing product
    const [showAddVariantModal, setShowAddVariantModal] = useState(false);
    const [addVariantProductId, setAddVariantProductId] = useState<number | null>(null);
    const [addVariantName, setAddVariantName] = useState("");
    const [isSavingAddVariant, setIsSavingAddVariant] = useState(false);

    // Update HPP of existing variant
    const [showUpdateHppModal, setShowUpdateHppModal] = useState(false);
    const [updateHppProductId, setUpdateHppProductId] = useState<number | null>(null);
    const [updateHppVariantId, setUpdateHppVariantId] = useState<number | null>(null);
    const [isSavingUpdateHpp, setIsSavingUpdateHpp] = useState(false);

    // Link worksheet to variant & apply HPP
    const [linkedVariantId, setLinkedVariantId] = useState<number | null>(null);
    const [isApplyingHpp, setIsApplyingHpp] = useState(false);

    // Bulk apply HPP to multiple variants
    const [linkedProductId, setLinkedProductId] = useState<number | null>(null);
    const [selectedVariantIds, setSelectedVariantIds] = useState<number[]>([]);
    const [isApplyingBulk, setIsApplyingBulk] = useState(false);

    // Multi-variant calculator
    interface VariantCalcRow {
        id: string;
        name: string;
        widthM: string;
        heightM: string;
        multiplier: string;
        linkedVariantId: number | null;
        existingVariantId?: number | null;
        isNew?: boolean;
        newProductName?: string;
        newVariantName?: string;
        newCategoryId?: number | null;
        newUnitId?: number | null;
        customPrice?: number | null;
        additionalCost?: number | null;
        priceTiers?: { tierName: string; minQty: string; maxQty: string; price: string }[];
        showTierEditor?: boolean;
        clickRateId?: number | null;
        clicksPerUnit?: number;
    }
    const [variantCalcRows, setVariantCalcRows] = useState<VariantCalcRow[]>([]);
    const [variantCalcMode, setVariantCalcMode] = useState<'area' | 'unit'>('area');
    const [showVariantCalc, setShowVariantCalc] = useState(false);
    const [isSavingVariantCalc, setIsSavingVariantCalc] = useState(false);

    // Auto-pull selling price from linked variant
    useEffect(() => {
        if (!linkedVariantId || !dbProducts.length) return;
        for (const p of dbProducts) {
            const v = p.variants?.find((vx: any) => vx.id === linkedVariantId);
            if (v) {
                setCustomSellingPrice(Number(v.price));
                break;
            }
        }
    }, [linkedVariantId, dbProducts]);

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

    // Edit mode: load product + worksheet when editProductId param is present (run once)
    useEffect(() => {
        if (!editProductId || isLoading || !dbProducts.length || hasLoadedEdit) return;

        const product = dbProducts.find((p: any) => p.id === editProductId);
        if (!product) return;

        setHasLoadedEdit(true);

        setEditMode(true);
        setEditingProductId(editProductId);
        setProductName(product.name);
        setProductCategory(String(product.categoryId || ''));
        setSellingPricingMode(product.pricingMode || 'UNIT');
        // Pre-fill click rate from product config
        if (product.clickRateId) {
            setHppClickRateId(product.clickRateId);
            setHppClicksPerUnit(product.clicksPerUnit || 1);
        }

        // Load variants → variantCalcRows
        if (product.variants?.length > 0) {
            const rows = product.variants.map((v: any) => ({
                id: `edit-${v.id}`,
                name: v.variantName || '',
                existingVariantId: v.id,
                widthM: '',
                heightM: '',
                multiplier: '1',
                linkedVariantId: v.id,
                isNew: false,
                customPrice: Number(v.price) || null,
                additionalCost: null,
                priceTiers: (v.priceTiers || []).map((t: any) => ({
                    tierName: t.tierName || '',
                    minQty: String(t.minQty),
                    maxQty: t.maxQty ? String(t.maxQty) : '',
                    price: String(t.price),
                })),
                showTierEditor: (v.priceTiers?.length || 0) > 0,
                clickRateId: v.clickRateId ?? null,
                clicksPerUnit: v.clicksPerUnit ?? 1,
            }));
            setVariantCalcRows(rows);
            setShowVariantCalc(rows.length > 1 || rows.some((r: any) => r.name || r.priceTiers?.length));
            setVariantCalcMode('unit');
        }

        // Try to load worksheet for this product (any of the 3 scenarios)
        getHppWorksheetByProduct(editProductId).then((ws: any) => {
            if (!ws) return; // no worksheet yet — user fills from scratch
            setActiveWorksheetId(ws.id);
            setEditingWorksheetId(ws.id);
            setTargetVolume(ws.targetVolume);
            setTargetMargin(Number(ws.targetMargin));

            setVariableCosts(ws.variableCosts.map((vc: any) => {
                const variant = vc.productVariant;
                const isCustom = !variant;
                return {
                    id: vc.id.toString(),
                    productVariantId: vc.productVariantId,
                    name: isCustom
                        ? vc.customMaterialName
                        : (variant?.variantName ? `${variant.product?.name} - ${variant.variantName}` : variant?.product?.name || 'Unknown'),
                    usageAmount: Number(vc.usageAmount),
                    usageUnit: vc.usageUnit,
                    price: isCustom ? Number(vc.customPrice || 0) : Number(variant?.price || 0),
                    priceUnit: variant?.product?.unit?.name || 'unit',
                    isCustom,
                };
            }));

            setFixedCosts(ws.fixedCosts.map((fc: any) => ({
                id: fc.id.toString(),
                name: fc.name,
                amount: Number(fc.amount),
            })));

            setHasCalculated(true);
        }).catch(() => { /* no worksheet — that's fine */ });
    }, [editProductId, isLoading, dbProducts]);

    const loadInitialData = async () => {
        setIsLoading(true);
        try {
            const [wsData, pData, catData, unitData, crData] = await Promise.all([
                getHppWorksheets(),
                getProducts(),
                getCategories(),
                getUnits(),
                getClickRates(),
            ]);
            setWorksheets(wsData);
            setDbProducts(pData);
            setDbCategories(catData);
            setDbUnits(unitData);
            setDbClickRates(crData);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    // Refresh hanya data produk & worksheet tanpa toggle isLoading (agar UI tidak di-unmount)
    const refreshProductData = async () => {
        try {
            const [wsData, pData] = await Promise.all([getHppWorksheets(), getProducts()]);
            setWorksheets(wsData);
            setDbProducts(pData);
        } catch (error) {
            console.error(error);
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
        setTargetMargin(Number(ws.targetMargin));
        setLinkedVariantId(ws.productVariantId || null);

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
                price: isCustom ? Number(vc.customPrice || 0) : (() => {
                    const tiers: any[] = variant?.priceTiers || [];
                    if (tiers.length === 0) return Number(variant?.price || 0);
                    const sorted = [...tiers].sort((a: any, b: any) => Number(a.minQty) - Number(b.minQty));
                    return Number(sorted[0].price);
                })(),
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
        setLinkedVariantId(null);
        setLinkedProductId(null);
        setSelectedVariantIds([]);
    };

    const handleSaveWorksheet = async () => {
        if (!productName) return alert("Beri nama Worksheet/Resep terlebih dahulu!");
        if (isSavingWorksheet) return;
        setIsSavingWorksheet(true);

        const payload = {
            productName, targetVolume, targetMargin,
            productVariantId: linkedVariantId || null,
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
        } finally {
            setIsSavingWorksheet(false);
        }
    };

    const handleApplyHppToVariant = async () => {
        if (!activeWorksheetId) return alert("Simpan worksheet terlebih dahulu sebelum menerapkan HPP.");
        if (!linkedVariantId) return alert("Pilih varian tujuan terlebih dahulu.");
        if (!hasCalculated) return alert("Lakukan kalkulasi HPP terlebih dahulu.");
        if (hppPerPcs <= 0) return alert("HPP tidak valid.");
        if (isApplyingHpp) return;

        const confirm = window.confirm(
            `Terapkan HPP Rp ${hppPerPcs.toLocaleString('id-ID', { maximumFractionDigits: 0 })}/unit ke varian yang dipilih?\n\nIni akan update field HPP varian tersebut.`
        );
        if (!confirm) return;

        setIsApplyingHpp(true);
        try {
            // Update worksheet link dulu jika belum tersimpan
            await updateHppWorksheet(activeWorksheetId, {
                productName, targetVolume, targetMargin,
                productVariantId: linkedVariantId,
                variableCosts: variableCosts.filter(vc => vc.productVariantId || (vc.name && vc.price > 0)).map(vc => ({
                    productVariantId: vc.productVariantId || null,
                    customMaterialName: !vc.productVariantId ? vc.name : null,
                    customPrice: !vc.productVariantId ? vc.price : null,
                    usageAmount: vc.usageAmount,
                    usageUnit: vc.usageUnit
                })),
                fixedCosts: fixedCosts.map(fc => ({ name: fc.name, amount: fc.amount }))
            });
            const result = await applyHppToVariant(activeWorksheetId, hppPerPcs);
            alert(result.message || "HPP berhasil diterapkan ke varian!");
            loadInitialData();
        } catch (e: any) {
            alert(e?.response?.data?.message || "Gagal menerapkan HPP.");
        } finally {
            setIsApplyingHpp(false);
        }
    };

    const handleApplyHppToVariants = async () => {
        if (!activeWorksheetId) return alert("Simpan worksheet terlebih dahulu sebelum menerapkan HPP.");
        if (selectedVariantIds.length === 0) return alert("Centang minimal satu varian.");
        if (!hasCalculated) return alert("Lakukan kalkulasi HPP terlebih dahulu.");
        if (hppPerPcs <= 0) return alert("HPP tidak valid.");
        if (isApplyingBulk) return;

        const confirm = window.confirm(
            `Terapkan HPP Rp ${hppPerPcs.toLocaleString('id-ID', { maximumFractionDigits: 0 })}/unit ke ${selectedVariantIds.length} varian yang dipilih?`
        );
        if (!confirm) return;

        setIsApplyingBulk(true);
        try {
            const appliedIds = [...selectedVariantIds];
            const result = await applyHppToVariants(activeWorksheetId, appliedIds, hppPerPcs);
            // Refresh produk tanpa toggle isLoading agar linkedProductId & checkbox list tetap visible
            await refreshProductData();
            setSelectedVariantIds([]);
            alert(result.message || `HPP berhasil diterapkan ke ${appliedIds.length} varian!`);
        } catch (e: any) {
            alert(e?.response?.data?.message || "Gagal menerapkan HPP.");
        } finally {
            setIsApplyingBulk(false);
        }
    };

    const buildTiersPayload = (row: VariantCalcRow) =>
        (row.priceTiers || [])
            .filter(t => t.minQty && t.price)
            .map(t => ({
                tierName: t.tierName || null,
                minQty: parseInt(t.minQty),
                maxQty: t.maxQty ? parseInt(t.maxQty) : null,
                price: parseInt(t.price),
            }));

    // Hitung biaya klik per baris varian
    const calcRowClickCost = (row: VariantCalcRow): number => {
        if (!row.clickRateId) return 0;
        const rate = dbClickRates.find((r: any) => r.id === row.clickRateId);
        if (!rate) return 0;
        return Number(rate.pricePerClick) * (row.clicksPerUnit ?? 1);
    };

    const calcHppFinal = (row: VariantCalcRow) => {
        const scaleFactor = variantCalcMode === 'area'
            ? (parseFloat(row.widthM) || 0) * (parseFloat(row.heightM) || 0)
            : (parseFloat(row.multiplier) || 1);
        const hppBase = scaleFactor > 0 && hppPerPcs > 0 ? Math.round(hppPerPcs * scaleFactor) : 0;
        const rowClickCost = Math.round(calcRowClickCost(row));
        return { scaleFactor, hppBase, rowClickCost, hppFinal: hppBase + rowClickCost + (row.additionalCost || 0) };
    };

    const handleSaveVariantCalc = async () => {
        if (!activeWorksheetId) return alert('Simpan worksheet terlebih dahulu sebelum menggunakan kalkulator multi-varian.');
        if (!hasCalculated) return alert('Lakukan kalkulasi HPP terlebih dahulu (klik Refresh Kalkulasi).');

        setIsSavingVariantCalc(true);
        try {
            // Step 1: Create new products for rows with isNew = true
            const createdVariantIds: Record<string, number> = {};
            const newRows = variantCalcRows.filter(r => r.isNew && r.newProductName?.trim());
            for (const row of newRows) {
                const { scaleFactor, hppFinal } = calcHppFinal(row);
                if (scaleFactor <= 0) continue;
                const categoryId = row.newCategoryId || dbCategories[0]?.id || null;
                const unitId = row.newUnitId || dbUnits.find((u: any) => u.name === 'pcs')?.id || dbUnits[0]?.id || null;
                if (!categoryId || !unitId) {
                    alert(`Baris "${row.newProductName}" membutuhkan kategori dan satuan. Silakan pilih terlebih dahulu.`);
                    setIsSavingVariantCalc(false);
                    return;
                }
                const suggestedPrice = Math.round(hppFinal * (1 + targetMargin / 100));
                const sellingPrice = row.customPrice && row.customPrice > 0 ? row.customPrice : suggestedPrice;
                const initials = (row.newProductName || 'NEW').trim().split(/\s+/).map((w: string) => w[0] || '').join('').toUpperCase().substring(0, 5);
                const rand = Math.floor(1000 + Math.random() * 9000);
                const newProduct = await createProduct({
                    name: row.newProductName!.trim(),
                    categoryId,
                    unitId,
                    pricingMode: 'UNIT',
                    variants: [{
                        sku: `HPP-${initials}-${rand}`,
                        variantName: row.newVariantName?.trim() || null,
                        price: sellingPrice,
                        hpp: hppFinal,
                        stock: 0,
                        priceTiers: buildTiersPayload(row),
                        clickRateId: row.clickRateId ?? null,
                        clicksPerUnit: row.clickRateId ? (row.clicksPerUnit ?? 1) : null,
                    }]
                });
                const createdVariantId = newProduct?.variants?.[0]?.id;
                if (createdVariantId) {
                    createdVariantIds[row.id] = createdVariantId;
                }
            }

            // Step 2: Build toSave with existing + newly created variant IDs (using hppFinal)
            const toSave = variantCalcRows
                .map(r => {
                    const variantId = r.linkedVariantId ?? createdVariantIds[r.id] ?? null;
                    if (!variantId) return null;
                    const { scaleFactor, hppFinal } = calcHppFinal(r);
                    return { variantId, hppPerUnit: hppFinal, scaleFactor };
                })
                .filter((r): r is { variantId: number; hppPerUnit: number; scaleFactor: number } => r !== null && r.scaleFactor > 0 && r.hppPerUnit > 0);

            if (toSave.length === 0) {
                alert('Tidak ada baris valid untuk disimpan. Pastikan dimensi/multiplier diisi dan varian dipilih atau nama produk baru diisi.');
                return;
            }

            const result = await applyHppVariantsCustom(activeWorksheetId, toSave);

            // Step 3: Update selling price for existing variants that have customPrice set
            const priceUpdateRows = variantCalcRows.filter(r => r.linkedVariantId && r.customPrice && r.customPrice > 0);
            await Promise.all(priceUpdateRows.map(r => updateProductVariant(r.linkedVariantId!, { price: r.customPrice })));

            // Step 4: Replace price tiers for existing variants that have tiers defined
            const tierUpdateRows = variantCalcRows.filter(r => r.linkedVariantId && r.priceTiers && r.priceTiers.length > 0);
            await Promise.all(tierUpdateRows.map(r => replaceVariantPriceTiers(r.linkedVariantId!, buildTiersPayload(r))));

            // Step 5: Persist per-variant click rate config
            const clickUpdateRows = variantCalcRows.filter(r => {
                const vid = r.linkedVariantId ?? createdVariantIds[r.id];
                return !!vid;
            });
            await Promise.all(clickUpdateRows.map(r => {
                const vid = r.linkedVariantId ?? createdVariantIds[r.id];
                return updateProductVariant(vid!, {
                    clickRateId: r.clickRateId ?? null,
                    clicksPerUnit: r.clickRateId ? (r.clicksPerUnit ?? 1) : null,
                } as any);
            }));

            await refreshProductData();
            setVariantCalcRows(rows => rows.map(r => {
                const newVId = createdVariantIds[r.id];
                if (newVId) return { ...r, isNew: false, linkedVariantId: newVId, newProductName: '', newVariantName: '' };
                return r;
            }));
            alert(result.message);
        } catch (e: any) {
            alert(e?.response?.data?.message || 'Gagal menyimpan.');
        } finally {
            setIsSavingVariantCalc(false);
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

    const clickCostPerPcs = useMemo(() => {
        if (!hppClickRateId) return 0;
        const rate = dbClickRates.find((r: any) => r.id === hppClickRateId);
        if (!rate) return 0;
        return Number(rate.pricePerClick) * hppClicksPerUnit;
    }, [hppClickRateId, hppClicksPerUnit, dbClickRates]);

    const hppPerPcs = totalVariablePerPcs + allocatedFixedPerPcs + clickCostPerPcs;
    const baseSuggestedPrice = hppPerPcs * (1 + (targetMargin / 100)); // Default margin before tiers applied

    const handleSaveAsProduct = async () => {
        if (!productName) return alert("Nama produk wajib diisi sebelum disimpan ke stok!");
        if (!hasCalculated) return alert("Lakukan kalkulasi HPP terlebih dahulu!");
        if (isSavingProduct) return;
        setIsSavingProduct(true);

        // productCategory stores the category ID directly (from DB categories select)
        const categoryId = productCategory ? parseInt(productCategory) : null;
        if (!categoryId) { setIsSavingProduct(false); return alert(`Pilih kategori produk terlebih dahulu. Pastikan kategori sudah dibuat di Manajemen Stok.`); }

        // Use first unit or find 'pcs'
        const matchedUnit = dbUnits.find((u: any) => u.name === 'pcs') || dbUnits[0];
        const unitId = matchedUnit?.id;
        if (!unitId) { setIsSavingProduct(false); return alert("Tidak ada satuan (unit) yang terdaftar di database. Tambahkan unit terlebih dahulu."); }

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

        // Build variants: jika multi-varian sudah diisi, gunakan baris-baris tersebut
        const activeMultiRows = variantCalcRows.filter(r => r.name.trim() !== '');
        let variantsPayload: any[];
        if (activeMultiRows.length > 0) {
            variantsPayload = activeMultiRows.map(row => {
                const scaleFactor = variantCalcMode === 'area'
                    ? (parseFloat(row.widthM) || 0) * (parseFloat(row.heightM) || 0)
                    : (parseFloat(row.multiplier) || 1);
                const hppBase = scaleFactor > 0 && hppPerPcs > 0 ? Math.round(hppPerPcs * scaleFactor) : Math.round(hppPerPcs);
                const hppFinal = hppBase + (row.additionalCost || 0);
                const suggested = hppFinal > 0 ? Math.round(hppFinal * (1 + targetMargin / 100)) : sellingPrice;
                const rowPrice = row.customPrice && row.customPrice > 0 ? row.customPrice : suggested;
                const rowInitials = (row.name || productName).trim().split(/\s+/).map((w: string) => w[0] || '').join('').toUpperCase().substring(0, 4);
                return {
                    variantName: row.name.trim() || null,
                    sku: `HPP-${rowInitials}-${Math.floor(1000 + Math.random() * 9000)}`,
                    price: rowPrice,
                    hpp: hppFinal || Math.round(hppPerPcs),
                    stock: 0,
                    priceTiers: buildTiersPayload(row),
                    clickRateId: row.clickRateId ?? null,
                    clicksPerUnit: row.clickRateId ? (row.clicksPerUnit ?? 1) : null,
                };
            });
        } else {
            variantsPayload = [{
                sku,
                price: sellingPrice,
                hpp: Math.round(hppPerPcs),
                stock: calculatedStock,
            }];
        }

        try {
            const newProduct = await createProduct({
                name: productName,
                categoryId,
                unitId,
                pricingMode: sellingPricingMode,
                ingredients,
                variants: variantsPayload,
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

            // Auto-save worksheet linked to the new product
            const wsAutoPayload = {
                productName,
                targetVolume,
                targetMargin,
                productId: newProduct.id,
                productVariantId: newProduct.variants?.[0]?.id || null,
                variableCosts: variableCosts
                    .filter(vc => vc.productVariantId || (vc.name && vc.price > 0))
                    .map(vc => ({
                        productVariantId: vc.productVariantId || null,
                        customMaterialName: !vc.productVariantId ? vc.name : null,
                        customPrice: !vc.productVariantId ? vc.price : null,
                        usageAmount: vc.usageAmount,
                        usageUnit: vc.usageUnit,
                    })),
                fixedCosts: fixedCosts.map(fc => ({ name: fc.name, amount: fc.amount })),
            };
            if (activeWorksheetId) {
                await updateHppWorksheet(activeWorksheetId, wsAutoPayload);
            } else if (wsAutoPayload.variableCosts.length > 0 || wsAutoPayload.fixedCosts.length > 0) {
                await createHppWorksheet(wsAutoPayload);
            }

            const variantInfo = activeMultiRows.length > 0
                ? `${activeMultiRows.length} varian: ${activeMultiRows.map(r => r.name).join(', ')}`
                : `SKU: ${sku}`;
            alert(`Produk "${productName}" berhasil dibuat!\n${variantInfo}`);
            // Redirect to product management
            window.location.href = '/inventory';
        } catch (error: any) {
            console.error(error);
            alert(`Gagal menyimpan produk: ${error?.response?.data?.message || error.message || 'Terjadi kesalahan'}`);
        } finally {
            setIsSavingProduct(false);
        }
    };

    const handleUpdateProduct = async () => {
        if (!editingProductId || !editMode) return;
        if (!productName) return alert("Nama produk wajib diisi!");
        if (isSavingProduct) return;
        setIsSavingProduct(true);

        try {
            const categoryId = productCategory ? parseInt(productCategory) : null;
            if (!categoryId) { setIsSavingProduct(false); return alert("Pilih kategori produk!"); }

            // Use the product's actual unitId, not just 'pcs'
            const product = dbProducts.find((p: any) => p.id === editingProductId);
            const unitId = product?.unitId || dbUnits.find((u: any) => u.name === 'pcs')?.id || dbUnits[0]?.id;
            if (!unitId) { setIsSavingProduct(false); return alert("Tambahkan unit terlebih dahulu."); }

            const activeMultiRows = variantCalcRows.filter(r => r.name.trim() !== '' || r.existingVariantId);
            let variantsPayload: any[];

            if (activeMultiRows.length > 0) {
                variantsPayload = activeMultiRows.map(row => {
                    const { hppFinal } = calcHppFinal(row);
                    const rowPrice = row.customPrice && row.customPrice > 0
                        ? row.customPrice
                        : (hppFinal > 0 ? Math.round(hppFinal * (1 + targetMargin / 100)) : 0);
                    const isNew = !row.existingVariantId;
                    const skuBase = (row.name.trim() || productName).split(/\s+/).map((w: string) => w[0] || '').join('').toUpperCase().substring(0, 5);
                    return {
                        ...(row.existingVariantId ? { id: row.existingVariantId } : { sku: `HPP-${skuBase}-${Math.floor(1000 + Math.random() * 9000)}`, stock: 0 }),
                        variantName: row.name.trim() || null,
                        price: rowPrice,
                        hpp: hppFinal > 0 ? hppFinal : Math.round(hppPerPcs),
                        priceTiers: buildTiersPayload(row),
                        clickRateId: row.clickRateId ?? null,
                        clicksPerUnit: row.clickRateId ? (row.clicksPerUnit ?? 1) : null,
                    };
                });
            } else {
                const existingVariant = product?.variants?.[0];
                const sellingPrice = customSellingPrice && customSellingPrice > 0
                    ? customSellingPrice
                    : (hppPerPcs > 0 ? Math.round(hppPerPcs * (1 + targetMargin / 100)) : 0);
                variantsPayload = [{
                    ...(existingVariant?.id ? { id: existingVariant.id } : {}),
                    price: sellingPrice,
                    hpp: Math.round(hppPerPcs),
                }];
            }

            const ingredients = variableCosts
                .filter((vc: any) => vc.name && vc.usageAmount > 0)
                .map((vc: any) => ({
                    name: String(vc.name),
                    quantity: vc.usageAmount,
                    unit: vc.usageUnit || 'unit',
                    price: vc.price || 0,
                    subtotal: calculateVariableSubtotal(vc),
                    rawMaterialVariantId: vc.productVariantId || null,
                }));

            const wsPayload = {
                productName,
                targetVolume,
                targetMargin,
                productId: editingProductId,
                productVariantId: linkedVariantId || null,
                variableCosts: variableCosts
                    .filter((vc: any) => vc.productVariantId || (vc.name && vc.price > 0))
                    .map((vc: any) => ({
                        productVariantId: vc.productVariantId || null,
                        customMaterialName: !vc.productVariantId ? vc.name : null,
                        customPrice: !vc.productVariantId ? vc.price : null,
                        usageAmount: vc.usageAmount,
                        usageUnit: vc.usageUnit || 'unit',
                    })),
                fixedCosts: fixedCosts.map((fc: any) => ({ name: fc.name, amount: fc.amount })),
            };

            await updateProduct(editingProductId as number, {
                name: productName,
                categoryId,
                unitId,
                pricingMode: sellingPricingMode,
                variants: variantsPayload,
                ingredients,
            });

            if (editingWorksheetId) {
                await updateHppWorksheet(editingWorksheetId, wsPayload);
            } else {
                const newWs = await createHppWorksheet(wsPayload);
                setEditingWorksheetId(newWs.id);
                setActiveWorksheetId(newWs.id);
            }

            alert(`Produk "${productName}" berhasil diperbarui!`);
            router.push('/inventory');
        } catch (error: any) {
            const msg = error?.response?.data?.message || error?.message || 'Unknown error';
            alert(`Gagal memperbarui produk: ${msg}`);
        } finally {
            setIsSavingProduct(false);
        }
    };

    const handleAddVariantToExistingProduct = async () => {
        if (!addVariantProductId) return alert("Pilih produk terlebih dahulu!");
        if (!hasCalculated) return alert("Lakukan kalkulasi HPP terlebih dahulu!");
        if (isSavingAddVariant) return;
        setIsSavingAddVariant(true);

        const product = dbProducts.find((p: any) => p.id === addVariantProductId);
        if (!product) { setIsSavingAddVariant(false); return alert("Produk tidak ditemukan."); }

        const variantLabel = addVariantName.trim() || productName.trim();
        const initials = variantLabel.split(/\s+/).map((w: string) => w[0] || '').join('').toUpperCase().substring(0, 5);
        const rand = Math.floor(1000 + Math.random() * 9000);
        const sku = `HPP-${initials}-${rand}`;

        const priceTierMap: Record<string, number> = {
            kompetitif: targetMargin > 15 ? targetMargin - 15 : 5,
            standar: targetMargin,
            premium: targetMargin + 20,
        };
        const margin = priceTierMap[selectedTier] ?? targetMargin;
        const sellingPrice = customSellingPrice !== null && customSellingPrice > 0
            ? customSellingPrice
            : (hppPerPcs > 0 ? Math.round(hppPerPcs / (1 - margin / 100)) : 0);

        try {
            const newVariant = await addProductVariant(addVariantProductId, {
                sku,
                variantName: variantLabel,
                price: sellingPrice,
                hpp: hppPerPcs,
                stock: 0,
            });

            // Upload gambar jika user sudah memilih gambar di form kalkulator
            if (imageFileRef.current?.files?.[0]) {
                try {
                    await uploadVariantImage(newVariant.id, imageFileRef.current.files[0]);
                } catch (imgError) {
                    console.error("Gagal mengupload gambar varian:", imgError);
                }
            }

            // Link worksheet aktif ke varian baru
            if (activeWorksheetId) {
                await updateHppWorksheet(activeWorksheetId, {
                    productName,
                    targetVolume,
                    targetMargin,
                    productVariantId: newVariant.id,
                    variableCosts: variableCosts
                        .filter(vc => vc.productVariantId || (vc.name && vc.price > 0))
                        .map(vc => ({
                            productVariantId: vc.productVariantId || null,
                            customMaterialName: !vc.productVariantId ? vc.name : null,
                            customPrice: !vc.productVariantId ? vc.price : null,
                            usageAmount: vc.usageAmount,
                            usageUnit: vc.usageUnit,
                        })),
                    fixedCosts: fixedCosts.map(fc => ({ name: fc.name, amount: fc.amount })),
                });
                setLinkedVariantId(newVariant.id);
            }

            alert(`Varian "${variantLabel}" berhasil ditambahkan ke produk "${product.name}"!\nHarga: Rp ${sellingPrice.toLocaleString('id-ID')} | HPP: Rp ${Math.round(hppPerPcs).toLocaleString('id-ID')}`);
            setShowAddVariantModal(false);
            setAddVariantProductId(null);
            setAddVariantName("");
            loadInitialData();
        } catch (error: any) {
            alert(`Gagal menambahkan varian: ${error?.response?.data?.message || error.message || 'Terjadi kesalahan'}`);
        } finally {
            setIsSavingAddVariant(false);
        }
    };

    const handleUpdateVariantHpp = async () => {
        if (!updateHppVariantId) return alert("Pilih varian terlebih dahulu!");
        if (!hasCalculated) return alert("Lakukan kalkulasi HPP terlebih dahulu!");
        if (isSavingUpdateHpp) return;
        setIsSavingUpdateHpp(true);

        try {
            await updateProductVariant(updateHppVariantId, { hpp: hppPerPcs });
            const product = dbProducts.find((p: any) => p.id === updateHppProductId);
            const variant = product?.variants?.find((v: any) => v.id === updateHppVariantId);
            const label = variant ? (product.name + (variant.variantName ? ` – ${variant.variantName}` : '')) : 'Varian';
            alert(`HPP "${label}" berhasil diperbarui menjadi Rp ${Math.round(hppPerPcs).toLocaleString('id-ID')}`);
            setShowUpdateHppModal(false);
            setUpdateHppProductId(null);
            setUpdateHppVariantId(null);
            loadInitialData();
        } catch (error: any) {
            alert(`Gagal memperbarui HPP: ${error?.response?.data?.message || error.message || 'Terjadi kesalahan'}`);
        } finally {
            setIsSavingUpdateHpp(false);
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
        const effectivePrice = (() => {
            const tiers: any[] = foundVariant.priceTiers || [];
            if (tiers.length === 0) return Number(foundVariant.price);
            const sorted = [...tiers].sort((a: any, b: any) => Number(a.minQty) - Number(b.minQty));
            return Number(sorted[0].price);
        })();
        setVariableCosts(prev => prev.map(row =>
            row.id === rowId ? {
                ...row,
                productVariantId: foundVariant.id,
                name: foundVariant.variantName ? `${foundProduct.name} - ${foundVariant.variantName}` : foundProduct.name,
                price: effectivePrice,
                priceUnit: unit,
                // Hanya inisialisasi usageUnit saat pertama pilih; re-pilih tidak overwrite
                usageUnit: row.productVariantId ? row.usageUnit : unit,
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
            <PageHeader
                title="Kalkulator HPP & Resep"
                description="Buat template resep produk (Worksheet). Bahan baku terkoneksi langsung dengan Stok Sistem."
                icon={Calculator}
                breadcrumbs={[{ label: 'Laporan' }, { label: 'Kalkulator HPP' }]}
            />

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

                        {editMode && (
                            <span className="text-xs font-bold text-blue-700 bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-full">
                                Mode Edit: {productName || '...'}
                            </span>
                        )}
                        {!editMode && activeWorksheetId && (
                            <span className="text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                                #{activeWorksheetId} · {productName || 'Tanpa Nama'}
                            </span>
                        )}

                        <div className="flex items-center gap-1.5 ml-auto">
                            <button onClick={handleSaveWorksheet} disabled={isSavingWorksheet} title="Simpan Worksheet" className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 text-white hover:bg-blue-600 rounded-[6px] border border-blue-500 transition-colors text-xs font-bold disabled:opacity-60">
                                {isSavingWorksheet ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Simpan
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
                                                {dbCategories.map((c: any) => (
                                                    <option key={c.id} value={String(c.id)}>{c.name}</option>
                                                ))}
                                            </select>
                                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                                        </div>
                                    </div>
                                </div>

                                {/* Terapkan HPP ke Banyak Varian */}
                                <div className="p-3 bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-800/40 rounded-[10px] space-y-2">
                                    <label className="block text-[13px] font-semibold text-purple-700 dark:text-purple-400">Terapkan HPP ke Varian Produk</label>
                                    <p className="text-xs text-muted-foreground">Pilih produk, centang varian yang ingin di-update HPP-nya, lalu klik Terapkan.</p>

                                    {/* Pilih produk */}
                                    <div className="relative">
                                        <select
                                            value={linkedProductId ?? ''}
                                            onChange={e => {
                                                setLinkedProductId(e.target.value ? Number(e.target.value) : null);
                                                setSelectedVariantIds([]);
                                            }}
                                            className="w-full appearance-none bg-background border border-border rounded-[8px] pl-3 pr-8 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-400/30 focus:border-purple-400 transition-all"
                                        >
                                            <option value="">— Pilih produk —</option>
                                            {dbProducts.map((p: any) => (
                                                <option key={p.id} value={p.id}>{p.name}</option>
                                            ))}
                                        </select>
                                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                                    </div>

                                    {/* Daftar varian dengan checkbox */}
                                    {linkedProductId && (() => {
                                        const prod = dbProducts.find((p: any) => p.id === linkedProductId);
                                        const variants = prod?.variants || [];
                                        if (variants.length === 0) return <p className="text-xs text-muted-foreground">Produk ini tidak memiliki varian.</p>;
                                        return (
                                            <div className="space-y-1 mt-1">
                                                <div className="flex items-center justify-between mb-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const allIds = variants.map((v: any) => v.id);
                                                            setSelectedVariantIds(selectedVariantIds.length === allIds.length ? [] : allIds);
                                                        }}
                                                        className="text-xs text-purple-600 dark:text-purple-400 hover:underline"
                                                    >
                                                        {selectedVariantIds.length === variants.length ? 'Hapus semua' : 'Pilih semua'}
                                                    </button>
                                                    <span className="text-xs text-muted-foreground">{selectedVariantIds.length} dipilih</span>
                                                </div>
                                                {variants.map((v: any) => (
                                                    <label key={v.id} className="flex items-center gap-2 cursor-pointer py-1 px-2 rounded-[6px] hover:bg-purple-100/50 dark:hover:bg-purple-900/20 transition-colors">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedVariantIds.includes(v.id)}
                                                            onChange={e => {
                                                                if (e.target.checked) setSelectedVariantIds(prev => [...prev, v.id]);
                                                                else setSelectedVariantIds(prev => prev.filter(id => id !== v.id));
                                                            }}
                                                            className="w-3.5 h-3.5 accent-purple-600"
                                                        />
                                                        <span className="text-xs font-medium flex-1">
                                                            {v.variantName || prod.name}{v.sku ? ` [${v.sku}]` : ''}
                                                        </span>
                                                        <span className="text-xs text-muted-foreground shrink-0">
                                                            HPP: {Number(v.hpp) > 0 ? `Rp ${Number(v.hpp).toLocaleString('id-ID', { maximumFractionDigits: 0 })}` : '—'}
                                                        </span>
                                                    </label>
                                                ))}
                                            </div>
                                        );
                                    })()}

                                    {/* Tombol apply */}
                                    {selectedVariantIds.length > 0 && hasCalculated && activeWorksheetId && (
                                        <button
                                            type="button"
                                            onClick={handleApplyHppToVariants}
                                            disabled={isApplyingBulk}
                                            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-purple-600 text-white hover:bg-purple-700 rounded-[8px] text-xs font-bold transition-colors disabled:opacity-60"
                                        >
                                            {isApplyingBulk ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                                            Terapkan ke Varian Terpilih ({selectedVariantIds.length})
                                        </button>
                                    )}

                                    {hppPerPcs > 0 && (
                                        <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                                            HPP dihitung: Rp {hppPerPcs.toLocaleString('id-ID', { maximumFractionDigits: 0 })}/unit
                                        </p>
                                    )}
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

                        {/* Kalkulasi Multi-Varian */}
                        <div className="bg-card rounded-[12px] md:rounded-[16px] shadow-sm border border-border overflow-hidden transition-shadow hover:shadow-md">
                            <button
                                type="button"
                                onClick={() => setShowVariantCalc(v => !v)}
                                className="w-full flex items-center justify-between p-5 md:p-6 text-left"
                            >
                                <div>
                                    <h2 className="text-base md:text-lg font-bold text-foreground">Kalkulasi Multi-Varian</h2>
                                    <span className="text-xs font-medium text-muted-foreground mt-0.5 block">Hitung HPP untuk beberapa ukuran/varian sekaligus berdasarkan HPP base worksheet.</span>
                                </div>
                                <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform shrink-0", showVariantCalc && "rotate-180")} />
                            </button>

                            {showVariantCalc && (
                                <div className="p-5 md:p-6 pt-0 space-y-4">
                                    {/* Mode toggle */}
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm font-semibold text-foreground">Mode:</span>
                                        <button
                                            type="button"
                                            onClick={() => setVariantCalcMode('area')}
                                            className={cn("px-3 py-1.5 text-xs font-bold rounded-full border transition-colors", variantCalcMode === 'area' ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-primary")}
                                        >
                                            Area (m²)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setVariantCalcMode('unit')}
                                            className={cn("px-3 py-1.5 text-xs font-bold rounded-full border transition-colors", variantCalcMode === 'unit' ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-primary")}
                                        >
                                            Unit (×)
                                        </button>
                                    </div>

                                    {/* HPP base info */}
                                    {hasCalculated && hppPerPcs > 0 && (
                                        <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
                                            HPP Base: <span className="font-bold text-foreground">Rp {Math.round(hppPerPcs).toLocaleString('id-ID')}</span>/unit
                                            {variantCalcMode === 'area' && ' (per m²)'}
                                        </div>
                                    )}

                                    {/* Warning: double-count risk when both global and per-row click rates active */}
                                    {hppClickRateId !== null && variantCalcRows.some(r => r.clickRateId) && (
                                        <div className="flex items-start gap-2 px-3 py-2.5 bg-orange-50 dark:bg-orange-950/30 border border-orange-300 dark:border-orange-700 rounded-[8px] text-[12px] text-orange-800 dark:text-orange-300">
                                            <Zap className="w-3.5 h-3.5 mt-0.5 shrink-0 text-orange-500" />
                                            <span>
                                                <span className="font-bold">Perhatian double-count:</span> HPP Base sudah termasuk biaya klik global (Rp {clickCostPerPcs > 0 ? Math.round(clickCostPerPcs).toLocaleString('id-ID') : '?'}/unit). Biaya klik per-varian akan ditambahkan di atasnya — pertimbangkan kosongkan "Jenis Klik" di bagian Komponen Biaya Klik agar tidak double-count.
                                            </span>
                                        </div>
                                    )}

                                    {/* Card List */}
                                    {variantCalcRows.length > 0 && (
                                        <div className="space-y-3">
                                            {variantCalcRows.map((row, idx) => {
                                                const { scaleFactor, hppBase: _hppBaseRaw, rowClickCost, hppFinal: _hppFinalRaw } = calcHppFinal(row);
                                                const hppBase = _hppBaseRaw > 0 ? _hppBaseRaw : null;
                                                const hppFinal = _hppFinalRaw > 0 ? _hppFinalRaw : null;
                                                const suggestedPrice = hppFinal ? Math.round(hppFinal * (1 + targetMargin / 100)) : null;
                                                const tierCount = (row.priceTiers || []).filter(t => t.minQty && t.price).length;
                                                return (
                                                    <div key={row.id} className="border border-border rounded-[10px] overflow-hidden bg-background">
                                                        {/* Baris 1: Nomor + Nama + Hapus */}
                                                        <div className="flex items-center gap-2 px-3 pt-3 pb-2">
                                                            <span className="text-[11px] font-bold text-muted-foreground shrink-0">{idx + 1}</span>
                                                            <input
                                                                type="text"
                                                                value={row.name}
                                                                onChange={e => setVariantCalcRows(rows => rows.map(r => r.id === row.id ? { ...r, name: e.target.value } : r))}
                                                                placeholder="Nama varian, mis. 60×90 cm"
                                                                className="flex-1 min-w-0 px-3 py-2 bg-muted/40 border border-border rounded-[8px] text-[14px] font-semibold outline-none focus:border-primary"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => setVariantCalcRows(rows => rows.filter(r => r.id !== row.id))}
                                                                className="p-2 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                                                            >
                                                                <X className="w-4 h-4" />
                                                            </button>
                                                        </div>

                                                        {/* Baris 2: Dimensi (full width, grid) */}
                                                        <div className="px-3 pb-2">
                                                            {variantCalcMode === 'area' ? (
                                                                <div className="grid grid-cols-2 gap-2">
                                                                    <div>
                                                                        <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Lebar (m)</label>
                                                                        <input
                                                                            type="number"
                                                                            value={row.widthM}
                                                                            onChange={e => setVariantCalcRows(rows => rows.map(r => r.id === row.id ? { ...r, widthM: e.target.value } : r))}
                                                                            placeholder="0.60"
                                                                            step="0.01"
                                                                            inputMode="decimal"
                                                                            className="w-full px-3 py-2.5 bg-muted/40 border border-border rounded-[8px] text-[14px] outline-none focus:border-primary text-center"
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Tinggi (m)</label>
                                                                        <input
                                                                            type="number"
                                                                            value={row.heightM}
                                                                            onChange={e => setVariantCalcRows(rows => rows.map(r => r.id === row.id ? { ...r, heightM: e.target.value } : r))}
                                                                            placeholder="0.90"
                                                                            step="0.01"
                                                                            inputMode="decimal"
                                                                            className="w-full px-3 py-2.5 bg-muted/40 border border-border rounded-[8px] text-[14px] outline-none focus:border-primary text-center"
                                                                        />
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div>
                                                                    <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Multiplier (×)</label>
                                                                    <input
                                                                        type="number"
                                                                        value={row.multiplier}
                                                                        onChange={e => setVariantCalcRows(rows => rows.map(r => r.id === row.id ? { ...r, multiplier: e.target.value } : r))}
                                                                        placeholder="1"
                                                                        step="0.1"
                                                                        inputMode="decimal"
                                                                        className="w-full px-3 py-2.5 bg-muted/40 border border-border rounded-[8px] text-[14px] outline-none focus:border-primary text-center"
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Baris 2.5: Klik Mesin per-Varian */}
                                                        <div className="px-3 pb-2 border-t border-indigo-100 dark:border-indigo-900/40 pt-2 bg-indigo-50/30 dark:bg-indigo-950/10">
                                                            <div className="flex items-center gap-1.5 mb-1.5">
                                                                <Zap className="w-3 h-3 text-indigo-500" />
                                                                <label className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase">Klik Mesin Varian Ini</label>
                                                                {row.clickRateId && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setVariantCalcRows(rows => rows.map(r => r.id === row.id ? { ...r, clickRateId: null, clicksPerUnit: 1 } : r))}
                                                                        className="ml-auto text-[10px] text-muted-foreground hover:text-red-500 underline"
                                                                    >hapus</button>
                                                                )}
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-2">
                                                                <select
                                                                    value={row.clickRateId ?? ''}
                                                                    onChange={e => setVariantCalcRows(rows => rows.map(r => r.id === row.id ? { ...r, clickRateId: e.target.value ? +e.target.value : null } : r))}
                                                                    className="w-full border border-indigo-200 dark:border-indigo-800 rounded-[8px] px-2 py-2 text-[12px] bg-white dark:bg-background outline-none focus:border-indigo-400"
                                                                >
                                                                    <option value="">-- Tidak ada klik --</option>
                                                                    {dbClickRates.filter((r: any) => r.isActive).map((r: any) => (
                                                                        <option key={r.id} value={r.id}>
                                                                            {r.name} (Rp {Number(r.pricePerClick).toLocaleString('id-ID')})
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                                <input
                                                                    type="number"
                                                                    min={0.5}
                                                                    step={0.5}
                                                                    value={row.clicksPerUnit ?? 1}
                                                                    disabled={!row.clickRateId}
                                                                    onChange={e => setVariantCalcRows(rows => rows.map(r => r.id === row.id ? { ...r, clicksPerUnit: +e.target.value || 1 } : r))}
                                                                    placeholder="Klik/unit"
                                                                    className="w-full border border-indigo-200 dark:border-indigo-800 rounded-[8px] px-2 py-2 text-[12px] disabled:opacity-40 outline-none focus:border-indigo-400"
                                                                />
                                                            </div>
                                                            {row.clickRateId && rowClickCost > 0 && (
                                                                <p className="text-[11px] text-indigo-600 font-semibold mt-1">
                                                                    +Rp {rowClickCost.toLocaleString('id-ID')}/unit biaya klik mesin
                                                                </p>
                                                            )}
                                                        </div>

                                                        {/* Baris 3: HPP Base + Biaya Tambah (grid 2 col) */}
                                                        <div className="px-3 pb-2 grid grid-cols-2 gap-2">
                                                            <div>
                                                                <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">HPP Base</label>
                                                                <div className={cn("px-3 py-2.5 rounded-[8px] text-[13px] font-bold border", hppBase ? "bg-primary/5 border-primary/20 text-primary" : "bg-muted/40 border-border text-muted-foreground")}>
                                                                    {hppBase ? `Rp ${hppBase.toLocaleString('id-ID')}` : '—'}
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">+ Biaya Tambah</label>
                                                                <input
                                                                    type="number"
                                                                    value={row.additionalCost ?? ''}
                                                                    onChange={e => setVariantCalcRows(rows => rows.map(r => r.id === row.id ? { ...r, additionalCost: e.target.value ? parseInt(e.target.value) : null } : r))}
                                                                    placeholder="0"
                                                                    min="0"
                                                                    inputMode="numeric"
                                                                    className="w-full px-3 py-2.5 bg-muted/40 border border-border rounded-[8px] text-[14px] outline-none focus:border-primary"
                                                                />
                                                            </div>
                                                        </div>

                                                        {/* Baris 4: HPP Final + Harga Jual (grid 2 col) */}
                                                        <div className="px-3 pb-2 grid grid-cols-2 gap-2">
                                                            <div>
                                                                <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">HPP Final</label>
                                                                <div className={cn("px-3 py-2.5 rounded-[8px] text-[14px] font-bold border", hppFinal ? "bg-primary/10 border-primary/30 text-primary" : "bg-muted/40 border-border text-muted-foreground")}>
                                                                    {hppFinal ? `Rp ${hppFinal.toLocaleString('id-ID')}` : '—'}
                                                                </div>
                                                                {rowClickCost > 0 && (
                                                                    <p className="text-[10px] text-indigo-500 mt-0.5 font-medium">(termasuk klik: Rp {rowClickCost.toLocaleString('id-ID')})</p>
                                                                )}
                                                            </div>
                                                            <div>
                                                                <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">
                                                                    Harga Jual
                                                                    {suggestedPrice && !row.customPrice && (
                                                                        <span className="ml-1 font-normal normal-case text-[10px] text-muted-foreground">(saran: Rp {suggestedPrice.toLocaleString('id-ID')})</span>
                                                                    )}
                                                                </label>
                                                                <input
                                                                    type="number"
                                                                    value={row.customPrice ?? ''}
                                                                    onChange={e => setVariantCalcRows(rows => rows.map(r => r.id === row.id ? { ...r, customPrice: e.target.value ? parseInt(e.target.value) : null } : r))}
                                                                    placeholder={suggestedPrice ? suggestedPrice.toLocaleString('id-ID') : 'auto'}
                                                                    inputMode="numeric"
                                                                    className="w-full px-3 py-2.5 bg-muted/40 border border-border rounded-[8px] text-[14px] outline-none focus:border-primary"
                                                                />
                                                            </div>
                                                        </div>

                                                        {/* Baris 5: Tier badge */}
                                                        <div className="px-3 pb-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => setVariantCalcRows(rows => rows.map(r => r.id === row.id ? { ...r, showTierEditor: !r.showTierEditor, priceTiers: r.priceTiers ?? [] } : r))}
                                                                className={cn(
                                                                    "w-full py-2 text-[12px] font-bold rounded-[8px] border transition-colors",
                                                                    tierCount > 0
                                                                        ? "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-300 dark:border-orange-700"
                                                                        : "border-border text-muted-foreground hover:border-orange-400 hover:text-orange-500 bg-muted/40"
                                                                )}
                                                            >
                                                                {tierCount > 0 ? `${tierCount} Tier Harga — Klik untuk edit` : '+ Tambah Tier Harga'}
                                                            </button>
                                                        </div>

                                                        {/* Baris 6: Link Varian */}
                                                        <div className="px-3 pb-3">
                                                            {row.isNew ? (
                                                                <div className="space-y-2 p-3 bg-green-50/60 dark:bg-green-950/20 border border-green-200/60 dark:border-green-800/40 rounded-[8px]">
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-[11px] font-bold text-green-700 dark:text-green-400">Daftarkan sebagai Produk Baru</span>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setVariantCalcRows(rows => rows.map(r => r.id === row.id ? { ...r, isNew: false, newProductName: '', newVariantName: '' } : r))}
                                                                            className="text-[11px] text-muted-foreground hover:text-primary underline"
                                                                        >
                                                                            pilih existing
                                                                        </button>
                                                                    </div>
                                                                    <input
                                                                        type="text"
                                                                        value={row.newProductName ?? ''}
                                                                        onChange={e => setVariantCalcRows(rows => rows.map(r => r.id === row.id ? { ...r, newProductName: e.target.value } : r))}
                                                                        placeholder="Nama Produk *"
                                                                        className="w-full px-3 py-2.5 bg-background border border-green-400 rounded-[8px] text-[14px] outline-none focus:border-primary"
                                                                    />
                                                                    <input
                                                                        type="text"
                                                                        value={row.newVariantName ?? ''}
                                                                        onChange={e => setVariantCalcRows(rows => rows.map(r => r.id === row.id ? { ...r, newVariantName: e.target.value } : r))}
                                                                        placeholder="Nama Varian (opsional)"
                                                                        className="w-full px-3 py-2.5 bg-background border border-border rounded-[8px] text-[14px] outline-none focus:border-primary"
                                                                    />
                                                                    <div className="grid grid-cols-2 gap-2">
                                                                        <select
                                                                            value={row.newCategoryId ?? ''}
                                                                            onChange={e => setVariantCalcRows(rows => rows.map(r => r.id === row.id ? { ...r, newCategoryId: e.target.value ? parseInt(e.target.value) : null } : r))}
                                                                            className="w-full px-3 py-2.5 bg-background border border-border rounded-[8px] text-[13px] outline-none"
                                                                        >
                                                                            <option value="">Kategori *</option>
                                                                            {dbCategories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                                                        </select>
                                                                        <select
                                                                            value={row.newUnitId ?? ''}
                                                                            onChange={e => setVariantCalcRows(rows => rows.map(r => r.id === row.id ? { ...r, newUnitId: e.target.value ? parseInt(e.target.value) : null } : r))}
                                                                            className="w-full px-3 py-2.5 bg-background border border-border rounded-[8px] text-[13px] outline-none"
                                                                        >
                                                                            <option value="">Satuan *</option>
                                                                            {dbUnits.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                                                                        </select>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <select
                                                                    value={row.linkedVariantId ?? ''}
                                                                    onChange={e => {
                                                                        if (e.target.value === '__new__') {
                                                                            const defaultUnitId = dbUnits.find((u: any) => u.name?.toLowerCase() === 'pcs')?.id || dbUnits[0]?.id || null;
                                                                            setVariantCalcRows(rows => rows.map(r => r.id === row.id ? {
                                                                                ...r,
                                                                                isNew: true,
                                                                                linkedVariantId: null,
                                                                                newProductName: productName || r.name,
                                                                                newCategoryId: productCategory ? parseInt(productCategory) : null,
                                                                                newUnitId: r.newUnitId ?? defaultUnitId,
                                                                            } : r));
                                                                        } else {
                                                                            setVariantCalcRows(rows => rows.map(r => r.id === row.id ? { ...r, linkedVariantId: e.target.value ? parseInt(e.target.value) : null } : r));
                                                                        }
                                                                    }}
                                                                    className="w-full px-3 py-2.5 bg-muted/40 border border-border rounded-[8px] text-[13px] outline-none focus:border-primary"
                                                                >
                                                                    <option value="">— Link ke Varian Existing —</option>
                                                                    <option value="__new__">➕ Daftarkan sebagai Produk Baru</option>
                                                                    {dbProducts.map((p: any) =>
                                                                        (p.variants || []).map((v: any) => (
                                                                            <option key={v.id} value={v.id}>
                                                                                {p.name}{v.variantName ? ` — ${v.variantName}` : ''}{v.sku ? ` [${v.sku}]` : ''}
                                                                            </option>
                                                                        ))
                                                                    )}
                                                                </select>
                                                            )}
                                                        </div>

                                                        {/* Tier Editor (expandable) */}
                                                        {row.showTierEditor && (
                                                            <div className="px-3 pb-3 pt-1 border-t border-orange-200/50 dark:border-orange-800/30 bg-orange-50/40 dark:bg-orange-950/10 space-y-2">
                                                                <p className="text-[11px] text-muted-foreground">
                                                                    Harga default (kolom Jual) dipakai jika qty tidak cocok tier manapun.
                                                                </p>
                                                                {(row.priceTiers || []).map((tier, ti) => (
                                                                    <div key={ti} className="flex gap-2 items-center bg-background border border-orange-200/50 dark:border-orange-800/30 rounded-lg p-2 flex-wrap">
                                                                        <input
                                                                            type="text"
                                                                            value={tier.tierName}
                                                                            onChange={e => setVariantCalcRows(rows => rows.map(r => r.id === row.id ? { ...r, priceTiers: (r.priceTiers || []).map((t, i) => i === ti ? { ...t, tierName: e.target.value } : t) } : r))}
                                                                            placeholder="Label (opsional)"
                                                                            className="w-28 px-2 py-1.5 bg-background border border-border rounded text-xs outline-none focus:border-primary"
                                                                        />
                                                                        <input
                                                                            type="number" min="1"
                                                                            value={tier.minQty}
                                                                            onChange={e => setVariantCalcRows(rows => rows.map(r => r.id === row.id ? { ...r, priceTiers: (r.priceTiers || []).map((t, i) => i === ti ? { ...t, minQty: e.target.value } : t) } : r))}
                                                                            placeholder="Min Qty"
                                                                            className="w-20 px-2 py-1.5 bg-background border border-border rounded text-xs outline-none focus:border-primary"
                                                                        />
                                                                        <span className="text-xs text-muted-foreground">—</span>
                                                                        <input
                                                                            type="number" min="1"
                                                                            value={tier.maxQty}
                                                                            onChange={e => setVariantCalcRows(rows => rows.map(r => r.id === row.id ? { ...r, priceTiers: (r.priceTiers || []).map((t, i) => i === ti ? { ...t, maxQty: e.target.value } : t) } : r))}
                                                                            placeholder="Max (kosong=∞)"
                                                                            className="w-28 px-2 py-1.5 bg-background border border-border rounded text-xs outline-none focus:border-primary"
                                                                        />
                                                                        <input
                                                                            type="number" min="0"
                                                                            value={tier.price}
                                                                            onChange={e => setVariantCalcRows(rows => rows.map(r => r.id === row.id ? { ...r, priceTiers: (r.priceTiers || []).map((t, i) => i === ti ? { ...t, price: e.target.value } : t) } : r))}
                                                                            placeholder="Harga/unit (Rp)"
                                                                            className="flex-1 min-w-[100px] px-2 py-1.5 bg-background border border-border rounded text-xs outline-none focus:border-primary"
                                                                        />
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setVariantCalcRows(rows => rows.map(r => r.id === row.id ? { ...r, priceTiers: (r.priceTiers || []).filter((_, i) => i !== ti) } : r))}
                                                                            className="p-1 text-destructive/60 hover:text-destructive transition-colors"
                                                                        >
                                                                            <X className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setVariantCalcRows(rows => rows.map(r => r.id === row.id ? { ...r, priceTiers: [...(r.priceTiers || []), { tierName: '', minQty: '', maxQty: '', price: '' }] } : r))}
                                                                    className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700 font-medium transition-colors"
                                                                >
                                                                    <Plus className="w-3.5 h-3.5" /> Tambah Tier Harga
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {variantCalcRows.length === 0 && (
                                        <p className="text-sm text-muted-foreground text-center py-4">Belum ada baris. Klik &quot;+ Tambah Baris&quot; untuk memulai.</p>
                                    )}

                                    <div className="flex items-center gap-3 pt-1">
                                        <button
                                            type="button"
                                            onClick={() => setVariantCalcRows(rows => [...rows, {
                                                id: `vc-${Date.now()}`,
                                                name: '',
                                                widthM: '',
                                                heightM: '',
                                                multiplier: '1',
                                                linkedVariantId: null,
                                                clickRateId: hppClickRateId,
                                                clicksPerUnit: hppClicksPerUnit,
                                            }])}
                                            className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                                        >
                                            <Plus className="w-4 h-4" /> Tambah Baris
                                        </button>

                                        <button
                                            type="button"
                                            onClick={handleSaveVariantCalc}
                                            disabled={isSavingVariantCalc || !hasCalculated || !activeWorksheetId || !variantCalcRows.some(r => r.linkedVariantId || (r.isNew && r.newProductName?.trim()))}
                                            className="ml-auto flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-bold rounded-lg disabled:opacity-40 hover:bg-primary/90 transition-colors"
                                        >
                                            {isSavingVariantCalc ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                                            Simpan &amp; Terapkan Semua ({variantCalcRows.filter(r => r.linkedVariantId || (r.isNew && r.newProductName?.trim())).length} varian)
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Biaya Variabel */}
                        <div className="bg-card rounded-[12px] md:rounded-[16px] shadow-sm border border-border overflow-hidden transition-shadow hover:shadow-md">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 md:p-6 border-b border-border/50 gap-3">
                                <div>
                                    <h2 className="text-base md:text-lg font-bold text-foreground">Bahan Baku (Biaya Variabel)</h2>
                                    <span className="text-xs font-medium text-muted-foreground mt-0.5 block">Diambil dari stok produk gudang Anda. Harga tersinkronisasi.</span>
                                </div>
                            </div>
                            {/* Card List — Biaya Variabel */}
                            <div className="p-4 space-y-2">
                                {variableCosts.map((v) => (
                                    <div key={v.id} className="border border-border rounded-[10px] bg-background">
                                        {/* Baris 1: Nama bahan + hapus */}
                                        <div className="flex items-center gap-2 px-3 pt-3 pb-2">
                                            <div className="flex-1 min-w-0">
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
                                            </div>
                                            <button onClick={() => removeVariableCost(v.id)} className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-[6px] border border-transparent hover:border-red-200 transition-all shrink-0">
                                                <Trash className="h-4 w-4" />
                                            </button>
                                        </div>

                                        {/* Baris 2: Takaran */}
                                        <div className="px-3 pb-2">
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="text-[10px] font-bold text-muted-foreground uppercase">Takaran</label>
                                                {!v.isAreaBased && (
                                                    <button onClick={() => toggleAreaMode(v.id, true)} title="Hitung luas Lebar × Tinggi (m²)"
                                                        className="text-[10px] font-bold text-blue-500 hover:text-blue-700 underline transition-colors">
                                                        pakai m²
                                                    </button>
                                                )}
                                                {v.isAreaBased && (
                                                    <button onClick={() => toggleAreaMode(v.id, false)} className="text-[10px] text-muted-foreground hover:text-red-500 transition-colors underline" title="Kembali ke mode satuan">
                                                        kembali ke satuan
                                                    </button>
                                                )}
                                            </div>
                                            {v.isAreaBased ? (
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div className="flex items-center bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 rounded-[8px] px-3 py-2.5 gap-2">
                                                        <span className="text-[11px] font-bold text-blue-500 shrink-0">L (m)</span>
                                                        <input type="text" inputMode="decimal" value={v.widthMStr ?? ''} onChange={e => updateAreaDimension(v.id, 'widthM', e.target.value)}
                                                            className="flex-1 min-w-0 bg-transparent text-center text-[14px] font-semibold text-blue-700 dark:text-blue-300 outline-none placeholder:text-blue-300" placeholder="0" />
                                                    </div>
                                                    <div className="flex items-center bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 rounded-[8px] px-3 py-2.5 gap-2">
                                                        <span className="text-[11px] font-bold text-blue-500 shrink-0">T (m)</span>
                                                        <input type="text" inputMode="decimal" value={v.heightMStr ?? ''} onChange={e => updateAreaDimension(v.id, 'heightM', e.target.value)}
                                                            className="flex-1 min-w-0 bg-transparent text-center text-[14px] font-semibold text-blue-700 dark:text-blue-300 outline-none placeholder:text-blue-300" placeholder="0" />
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-2 gap-2">
                                                    <input type="number" inputMode="decimal" value={v.usageAmount || ''} onChange={e => updateVariableCost(v.id, 'usageAmount', Number(e.target.value))}
                                                        className="w-full px-3 py-2.5 bg-muted/40 border border-border rounded-[8px] text-[14px] font-medium outline-none focus:border-primary text-center" placeholder="0" />
                                                    <select value={v.usageUnit} onChange={e => updateVariableCost(v.id, 'usageUnit', e.target.value)}
                                                        className="w-full px-2 py-2.5 border border-border rounded-[8px] bg-muted/40 text-[13px] font-semibold outline-none cursor-pointer focus:border-primary">
                                                        <optgroup label="Berat"><option value="gram">gram</option><option value="kg">kg</option><option value="mg">mg</option></optgroup>
                                                        <optgroup label="Volume"><option value="ml">ml</option><option value="L">L</option><option value="gelas">gelas</option><option value="sdm">sdm</option><option value="sdt">sdt</option></optgroup>
                                                        <optgroup label="Satuan"><option value="pcs">pcs</option><option value="buah">buah</option><option value="lembar">lembar</option><option value="bungkus">bungkus</option><option value="box">box</option><option value="pak">pak</option></optgroup>
                                                        <optgroup label="Panjang / Luas"><option value="cm">cm</option><option value="m">m</option><option value="m²">m²</option></optgroup>
                                                    </select>
                                                </div>
                                            )}
                                        </div>

                                        {/* Baris 3: Harga per satuan */}
                                        <div className="px-3 pb-2">
                                            <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Harga per Satuan</label>
                                            <div className="flex bg-muted/40 border border-border rounded-[8px] overflow-hidden focus-within:border-primary">
                                                <span className="bg-muted px-3 py-2.5 font-semibold text-[12px] border-r border-border text-muted-foreground shrink-0">Rp</span>
                                                <input type="number" inputMode="numeric" value={v.price || ''} onChange={e => updateVariableCost(v.id, 'price', Number(e.target.value))}
                                                    className="flex-1 min-w-0 bg-transparent px-3 py-2.5 text-[14px] font-semibold outline-none" placeholder="0" />
                                                <span className="px-2 py-2.5 text-[12px] text-muted-foreground border-l border-border shrink-0">/</span>
                                                <select value={v.priceUnit || 'pcs'} onChange={e => updateVariableCost(v.id, 'priceUnit', e.target.value)}
                                                    className="bg-transparent pr-2 py-2.5 text-[12px] font-semibold outline-none cursor-pointer">
                                                    <optgroup label="Berat"><option value="gram">gram</option><option value="kg">kg</option><option value="mg">mg</option></optgroup>
                                                    <optgroup label="Volume"><option value="ml">ml</option><option value="L">L</option><option value="gelas">gelas</option></optgroup>
                                                    <optgroup label="Satuan"><option value="pcs">pcs</option><option value="buah">buah</option><option value="lembar">lembar</option><option value="bungkus">bungkus</option><option value="box">box</option></optgroup>
                                                    <optgroup label="Panjang"><option value="cm">cm</option><option value="m">m</option></optgroup>
                                                </select>
                                            </div>
                                        </div>

                                        {/* Subtotal */}
                                        <div className="px-3 pb-3">
                                            <div className="bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 font-bold text-[14px] px-3 py-2.5 rounded-[8px] border border-green-200 dark:border-green-800/50 text-right">
                                                = Rp {Math.round(calculateVariableSubtotal(v)).toLocaleString('id-ID')}
                                            </div>
                                        </div>

                                        {/* Baris 3: Acuan stok + info area */}
                                        {(!v.isCustom && v.productVariantId || v.isAreaBased) && (
                                            <div className="flex items-center gap-3 px-3 pb-2.5 flex-wrap">
                                                {!v.isCustom && v.productVariantId && (
                                                    <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer" title="Stok Produk akhir dihitung berdasarkan sisa stok bahan ini dibagi Takaran.">
                                                        <input type="checkbox" checked={v.isAcuanStok || false} onChange={e => updateVariableCost(v.id, 'isAcuanStok', e.target.checked)} className="w-3.5 h-3.5 text-primary cursor-pointer rounded" />
                                                        Jadikan Acuan Stok Produk
                                                    </label>
                                                )}
                                                {v.isAreaBased && (
                                                    <span className="text-[11px] text-blue-600 font-mono font-bold">
                                                        = {((v.widthM || 0) * (v.heightM || 0)).toFixed(4)} m²
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {variableCosts.length > 0 && (
                                    <div className="bg-primary/5 border border-primary/20 rounded-[10px] px-4 py-3 flex justify-between items-center">
                                        <span className="font-semibold text-[13px] text-muted-foreground">Total Biaya B.Baku/Pcs:</span>
                                        <span className="font-bold text-[15px] text-primary">Rp {Math.round(totalVariablePerPcs).toLocaleString('id-ID')}</span>
                                    </div>
                                )}
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

                        {/* Click Rate Component */}
                        <div className="border border-indigo-200 bg-indigo-50/50 rounded-[12px] p-4 space-y-3 dark:bg-indigo-950/20 dark:border-indigo-900">
                            <div className="flex items-center gap-2">
                                <Zap className="w-4 h-4 text-indigo-500" />
                                <p className="text-sm font-semibold text-indigo-800 dark:text-indigo-300">Komponen Biaya Klik Mesin</p>
                                <span className="text-xs text-indigo-500">(opsional)</span>
                            </div>
                            <p className="text-xs text-indigo-600/80 dark:text-indigo-400">Jika produk ini menggunakan mesin cetak berbasis klik, tambahkan di sini agar HPP sudah termasuk biaya klik.</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-indigo-700 mb-1">Jenis Klik</label>
                                    <select
                                        value={hppClickRateId ?? ''}
                                        onChange={e => setHppClickRateId(e.target.value ? +e.target.value : null)}
                                        className="w-full border border-indigo-300 rounded-lg px-3 py-2 text-sm bg-white dark:bg-background"
                                    >
                                        <option value="">-- Tidak ada --</option>
                                        {dbClickRates.filter((r: any) => r.isActive).map((r: any) => (
                                            <option key={r.id} value={r.id}>{r.name} — Rp {Number(r.pricePerClick).toLocaleString('id-ID')}/klik</option>
                                        ))}
                                    </select>
                                </div>
                                {hppClickRateId && (
                                    <div>
                                        <label className="block text-xs font-medium text-indigo-700 mb-1">Klik per Unit</label>
                                        <input
                                            type="number"
                                            min={0.5}
                                            step={0.5}
                                            value={hppClicksPerUnit}
                                            onChange={e => setHppClicksPerUnit(+e.target.value || 1)}
                                            className="w-full border border-indigo-300 rounded-lg px-3 py-2 text-sm"
                                        />
                                        {clickCostPerPcs > 0 && (
                                            <p className="text-xs text-indigo-700 font-semibold mt-1">
                                                +Rp {Math.round(clickCostPerPcs).toLocaleString('id-ID')}/unit masuk HPP
                                            </p>
                                        )}
                                    </div>
                                )}
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
                                        {clickCostPerPcs > 0 && (
                                            <div className="flex justify-between text-sm"><span className="text-muted-foreground text-indigo-600">Biaya Klik Mesin:</span><b className="text-indigo-700">Rp {Math.round(clickCostPerPcs).toLocaleString('id-ID')}</b></div>
                                        )}
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

                                        {editMode ? (
                                            <button
                                                onClick={handleUpdateProduct}
                                                disabled={isSavingProduct || !hasCalculated}
                                                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[13px] py-3 rounded-[10px] shadow-sm transition-all disabled:opacity-60">
                                                {isSavingProduct ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                                {isSavingProduct ? 'Menyimpan...' : 'Simpan Perubahan Produk'}
                                            </button>
                                        ) : (
                                            <button
                                                onClick={handleSaveAsProduct}
                                                disabled={isSavingProduct}
                                                className="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-bold text-[13px] py-3 rounded-[10px] shadow-sm transition-all disabled:opacity-60">
                                                {isSavingProduct ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingBag className="w-4 h-4" />} {isSavingProduct ? 'Menyimpan...' : 'Simpan Perhitungan & Jadikan Produk'}
                                            </button>
                                        )}
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                onClick={() => { setShowAddVariantModal(true); setAddVariantProductId(null); setAddVariantName(""); }}
                                                className="flex items-center justify-center gap-1.5 bg-blue-500 hover:bg-blue-600 text-white font-semibold text-[12px] py-2.5 rounded-[10px] shadow-sm transition-all">
                                                <Plus className="w-3.5 h-3.5" /> Tambah ke Produk Ada
                                            </button>
                                            <button
                                                onClick={() => { setShowUpdateHppModal(true); setUpdateHppProductId(null); setUpdateHppVariantId(null); }}
                                                className="flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold text-[12px] py-2.5 rounded-[10px] shadow-sm transition-all">
                                                <Save className="w-3.5 h-3.5" /> Perbarui HPP Varian
                                            </button>
                                        </div>
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

            {/* Modal: Tambah Varian ke Produk yang Ada */}
            {showAddVariantModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
                    <div className="bg-card w-full max-w-sm rounded-[16px] border border-border shadow-2xl p-5">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-base flex items-center gap-2"><Plus className="w-4 h-4 text-blue-500" /> Tambah Varian ke Produk yang Ada</h3>
                            <button onClick={() => setShowAddVariantModal(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="bg-blue-50 border border-blue-200 rounded-[10px] p-3 mb-4 space-y-1">
                            <p className="text-xs text-blue-800">HPP yang akan dipakai: <b>Rp {Math.round(hppPerPcs).toLocaleString('id-ID')}</b></p>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-semibold text-foreground mb-1.5">Pilih Produk</label>
                                <select
                                    value={addVariantProductId ?? ""}
                                    onChange={(e) => setAddVariantProductId(e.target.value ? Number(e.target.value) : null)}
                                    className="w-full bg-background border border-border rounded-[8px] px-3 py-2 text-sm outline-none focus:border-blue-400">
                                    <option value="">-- Pilih produk --</option>
                                    {dbProducts.map((p: any) => (
                                        <option key={p.id} value={p.id}>{p.name} ({p.variants?.length ?? 0} varian)</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-foreground mb-1.5">Nama Varian <span className="text-muted-foreground font-normal">(mis: F340, 2m, Glossy)</span></label>
                                <input
                                    type="text"
                                    value={addVariantName}
                                    onChange={(e) => setAddVariantName(e.target.value)}
                                    placeholder={productName || "Nama varian baru..."}
                                    className="w-full bg-background border border-border rounded-[8px] px-3 py-2 text-sm outline-none focus:border-blue-400"
                                />
                            </div>
                        </div>
                        <div className="flex gap-2 justify-end pt-4">
                            <button onClick={() => setShowAddVariantModal(false)} className="px-4 py-2 bg-muted text-foreground text-sm font-semibold rounded-[8px]">Batal</button>
                            <button
                                onClick={handleAddVariantToExistingProduct}
                                disabled={isSavingAddVariant || !addVariantProductId}
                                className="px-5 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold rounded-[8px] transition-all disabled:opacity-60 flex items-center gap-2">
                                {isSavingAddVariant ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                {isSavingAddVariant ? 'Menyimpan...' : 'Tambah Varian'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Perbarui HPP Varian */}
            {showUpdateHppModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
                    <div className="bg-card w-full max-w-sm rounded-[16px] border border-border shadow-2xl p-5">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-base flex items-center gap-2"><Save className="w-4 h-4 text-amber-500" /> Perbarui HPP Varian</h3>
                            <button onClick={() => setShowUpdateHppModal(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="bg-amber-50 border border-amber-200 rounded-[10px] p-3 mb-4">
                            <p className="text-xs text-amber-800">HPP baru yang akan diterapkan: <b>Rp {Math.round(hppPerPcs).toLocaleString('id-ID')}</b></p>
                            <p className="text-xs text-amber-600 mt-0.5">Harga jual tidak akan berubah, hanya nilai HPP.</p>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-semibold text-foreground mb-1.5">Pilih Produk</label>
                                <select
                                    value={updateHppProductId ?? ""}
                                    onChange={(e) => { setUpdateHppProductId(e.target.value ? Number(e.target.value) : null); setUpdateHppVariantId(null); }}
                                    className="w-full bg-background border border-border rounded-[8px] px-3 py-2 text-sm outline-none focus:border-amber-400">
                                    <option value="">-- Pilih produk --</option>
                                    {dbProducts.map((p: any) => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            </div>
                            {updateHppProductId && (
                                <div>
                                    <label className="block text-xs font-semibold text-foreground mb-1.5">Pilih Varian</label>
                                    <select
                                        value={updateHppVariantId ?? ""}
                                        onChange={(e) => setUpdateHppVariantId(e.target.value ? Number(e.target.value) : null)}
                                        className="w-full bg-background border border-border rounded-[8px] px-3 py-2 text-sm outline-none focus:border-amber-400">
                                        <option value="">-- Pilih varian --</option>
                                        {dbProducts.find((p: any) => p.id === updateHppProductId)?.variants?.map((v: any) => (
                                            <option key={v.id} value={v.id}>
                                                {v.variantName || 'Default'} — HPP saat ini: Rp {Number(v.hpp || 0).toLocaleString('id-ID')}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>
                        <div className="flex gap-2 justify-end pt-4">
                            <button onClick={() => setShowUpdateHppModal(false)} className="px-4 py-2 bg-muted text-foreground text-sm font-semibold rounded-[8px]">Batal</button>
                            <button
                                onClick={handleUpdateVariantHpp}
                                disabled={isSavingUpdateHpp || !updateHppVariantId}
                                className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold rounded-[8px] transition-all disabled:opacity-60 flex items-center gap-2">
                                {isSavingUpdateHpp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                {isSavingUpdateHpp ? 'Memperbarui...' : 'Perbarui HPP'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div >
    );
}

export default function HppCalculatorPage() {
    return (
        <React.Suspense fallback={null}>
            <HppCalculatorContent />
        </React.Suspense>
    );
}
