"use client";

import { useState, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, X, Building2, Phone, Mail, MapPin, Package, Search } from "lucide-react";
import { getProducts } from "@/lib/api";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/id";
import { DocType, Invoice, InvoiceItem, calcTotals, fmt } from "./types";

dayjs.extend(relativeTime);
dayjs.locale("id");

const UNITS = ["pcs", "lembar", "set", "m²", "m", "kg", "liter", "box", "roll", "unit", "jam", "hari"];

type CatalogItem = {
    label: string;
    description: string;
    unit: string;
    price: number;
    type: string;        // SELLABLE | SERVICE | RAW_MATERIAL
    pricingMode: string; // UNIT | AREA_BASED
};

export function FormModal({
    mode, docType, initial, onClose, onSave, isPending
}: {
    mode: "create" | "edit";
    docType: DocType;
    initial?: Invoice;
    onClose: () => void;
    onSave: (data: any) => void;
    isPending: boolean;
}) {
    const isQuotation = docType === "QUOTATION";

    const [clientName, setClientName] = useState(initial?.clientName ?? "");
    const [clientCompany, setClientCompany] = useState(initial?.clientCompany ?? "");
    const [clientAddress, setClientAddress] = useState(initial?.clientAddress ?? "");
    const [clientPhone, setClientPhone] = useState(initial?.clientPhone ?? "");
    const [clientEmail, setClientEmail] = useState(initial?.clientEmail ?? "");
    const [dueDate, setDueDate] = useState(initial?.dueDate ? dayjs(initial.dueDate).format("YYYY-MM-DD") : "");
    const [validUntil, setValidUntil] = useState(initial?.validUntil ? dayjs(initial.validUntil).format("YYYY-MM-DD") : "");
    const [taxRate, setTaxRate] = useState(String(parseFloat(initial?.taxRate ?? "0")));
    const [discount, setDiscount] = useState(String(parseFloat(initial?.discount ?? "0")));
    const [notes, setNotes] = useState(initial?.notes ?? "");
    const [items, setItems] = useState<InvoiceItem[]>(
        initial?.items?.length
            ? initial.items.map(i => ({ description: i.description, unit: i.unit ?? "pcs", quantity: i.quantity, price: Number(i.price), isAreaBased: false }))
            : [{ description: "", unit: "pcs", quantity: 1, price: 0, isAreaBased: false }]
    );

    // Catalog picker state
    const [openPickerIdx, setOpenPickerIdx] = useState<number | null>(null);
    const [pickerSearch, setPickerSearch] = useState("");
    const pickerRef = useRef<HTMLDivElement>(null);

    // Load products catalog
    const { data: productsData } = useQuery({ queryKey: ["products"], queryFn: getProducts, staleTime: 5 * 60 * 1000 });

    // Build flat catalog list from products + variants
    const catalogItems: CatalogItem[] = useMemo(() => {
        if (!productsData) return [];
        const list: CatalogItem[] = [];
        for (const product of productsData) {
            const unitName: string = product.unit?.name ?? "pcs";
            const type: string = product.productType ?? "SELLABLE";
            const pricingMode: string = product.pricingMode ?? "UNIT";
            if (product.variants?.length > 0) {
                for (const v of product.variants) {
                    const variantSuffix = v.variantName ? ` (${v.variantName})` : v.size || v.color ? ` (${[v.size, v.color].filter(Boolean).join(", ")})` : "";
                    list.push({
                        label: `${product.name}${variantSuffix}`,
                        description: `${product.name}${variantSuffix}`,
                        unit: pricingMode === "AREA_BASED" ? "m²" : unitName,
                        price: Number(v.price),
                        type,
                        pricingMode,
                    });
                }
            } else {
                list.push({
                    label: product.name,
                    description: product.name,
                    unit: pricingMode === "AREA_BASED" ? "m²" : unitName,
                    price: Number(product.pricePerUnit ?? 0),
                    type,
                    pricingMode,
                });
            }
        }
        return list;
    }, [productsData]);

    const filteredCatalog = useMemo(() => {
        if (!pickerSearch.trim()) return catalogItems.slice(0, 30);
        const q = pickerSearch.toLowerCase();
        return catalogItems.filter(c => c.label.toLowerCase().includes(q)).slice(0, 20);
    }, [catalogItems, pickerSearch]);

    const selectCatalogItem = (idx: number, cat: CatalogItem) => {
        const isAreaBased = cat.pricingMode === "AREA_BASED";
        setItems(prev => prev.map((item, i) => {
            if (i !== idx) return item;
            const w = item.width ?? 1;
            const h = item.height ?? 1;
            return {
                ...item,
                description: cat.description,
                unit: isAreaBased ? "m²" : cat.unit,
                price: cat.price,
                isAreaBased,
                width: isAreaBased ? w : undefined,
                height: isAreaBased ? h : undefined,
                quantity: isAreaBased ? Math.round(w * h * 100) / 100 : item.quantity,
            };
        }));
        setOpenPickerIdx(null);
        setPickerSearch("");
    };

    // Toggle area-based mode per row
    const toggleAreaMode = (idx: number) => {
        setItems(prev => prev.map((item, i) => {
            if (i !== idx) return item;
            const on = !item.isAreaBased;
            return {
                ...item,
                isAreaBased: on,
                unit: on ? "m²" : "pcs",
                width: on ? 1 : undefined,
                height: on ? 1 : undefined,
                quantity: on ? 1 : item.quantity,
            };
        }));
    };

    // Handle width/height change and recalculate area
    const handleDimensionChange = (idx: number, field: "width" | "height", value: number) => {
        setItems(prev => prev.map((item, i) => {
            if (i !== idx) return item;
            const w = field === "width" ? value : (item.width ?? 1);
            const h = field === "height" ? value : (item.height ?? 1);
            return { ...item, [field]: value, quantity: Math.round(w * h * 100) / 100 };
        }));
    };

    // Close picker on outside click
    const handlePickerBlur = () => {
        setTimeout(() => setOpenPickerIdx(null), 150);
    };

    const handleItemChange = (idx: number, field: keyof InvoiceItem, value: string | number) => {
        setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
    };
    const addItem = () => setItems(prev => [...prev, { description: "", unit: "pcs", quantity: 1, price: 0, isAreaBased: false }]);
    const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));

    const taxRateNum = parseFloat(taxRate) || 0;
    const discountNum = parseFloat(discount) || 0;
    const { subtotal, taxAmount, total } = calcTotals(items, taxRateNum, discountNum);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const seq = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
        const dateStr = dayjs().format("YYYYMMDD");
        const prefix = isQuotation ? "SPH" : "INV";
        const number = initial?.invoiceNumber ?? `${prefix}-${dateStr}-${seq}`;

        onSave({
            invoiceNumber: number,
            type: docType,
            clientName, clientCompany, clientAddress, clientPhone, clientEmail,
            dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
            validUntil: validUntil ? new Date(validUntil).toISOString() : undefined,
            taxRate: taxRateNum,
            taxAmount,
            discount: discountNum,
            subtotal,
            total,
            notes,
            items: items.map(i => ({
                description: i.isAreaBased && i.width && i.height
                    ? `${i.description} (${i.width}m × ${i.height}m)`
                    : i.description,
                unit: i.unit,
                quantity: Number(i.quantity),
                price: Number(i.price),
            })),
        });
    };

    const TYPE_BADGE: Record<string, string> = {
        SELLABLE: "bg-emerald-500/10 text-emerald-600",
        SERVICE: "bg-violet-500/10 text-violet-600",
        RAW_MATERIAL: "bg-amber-500/10 text-amber-600",
    };
    const TYPE_LABEL: Record<string, string> = {
        SELLABLE: "Produk",
        SERVICE: "Jasa",
        RAW_MATERIAL: "Bahan",
    };

    return (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-card w-full max-w-3xl rounded-xl border border-border shadow-lg flex flex-col max-h-[95vh]">
                <div className="px-6 py-4 border-b border-border flex justify-between items-center shrink-0">
                    <h3 className="font-semibold text-foreground">
                        {mode === "create" ? "Buat" : "Edit"} {isQuotation ? "Penawaran Harga (SPH)" : "Invoice"}
                    </h3>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
                </div>
                <form onSubmit={handleSubmit} className="flex flex-col grow min-h-0">
                    <div className="overflow-y-auto grow p-6 space-y-6">
                        {/* Client info */}
                        <div>
                            <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-primary" /> Informasi Klien
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Nama PIC / Kontak *</label>
                                    <input required value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Nama narahubung" className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Nama Perusahaan / Brand / Event</label>
                                    <input value={clientCompany} onChange={e => setClientCompany(e.target.value)} placeholder="PT. ABC / Event XYZ" className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground"><Phone className="h-3 w-3 inline mr-1" />No. Telepon</label>
                                    <input value={clientPhone} onChange={e => setClientPhone(e.target.value)} placeholder="08xx-xxxx-xxxx" className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground"><Mail className="h-3 w-3 inline mr-1" />Email</label>
                                    <input type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="email@perusahaan.com" className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                                </div>
                                <div className="col-span-1 sm:col-span-2 space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground"><MapPin className="h-3 w-3 inline mr-1" />Alamat Lengkap</label>
                                    <textarea rows={2} value={clientAddress} onChange={e => setClientAddress(e.target.value)} placeholder="Jl. ..." className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
                                </div>
                            </div>
                        </div>

                        {/* Date */}
                        <div className="grid grid-cols-2 gap-3">
                            {!isQuotation ? (
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Tanggal Jatuh Tempo</label>
                                    <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-muted-foreground">Berlaku Hingga *</label>
                                    <input required type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                                </div>
                            )}
                        </div>

                        {/* Items */}
                        <div>
                            <div className="flex justify-between items-center mb-3">
                                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                    <Package className="h-4 w-4 text-primary" /> Item / Deskripsi Pekerjaan
                                </h4>
                                <button type="button" onClick={addItem} className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
                                    <Plus className="h-3 w-3" /> Tambah Baris
                                </button>
                            </div>

                            {/* Hints */}
                            <div className="flex flex-wrap gap-3 mb-3 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1"><Package className="h-3 w-3" /> Ikon katalog → pilih dari inventori</span>
                                <span className="flex items-center gap-1">📐 Ikon ukuran → mode lebar × tinggi (banner, spanduk, dll.)</span>
                                <span className="flex items-center gap-1">✏️ Semua field bisa diedit bebas untuk item custom</span>
                            </div>

                            <div className="space-y-3">
                                {/* Header - hidden on mobile */}
                                <div className="hidden sm:grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-1">
                                    <span className="col-span-5">Deskripsi / Nama Produk</span>
                                    <span className="col-span-2">Satuan</span>
                                    <span className="col-span-1 text-center">Qty</span>
                                    <span className="col-span-2 text-right">Harga/Satuan</span>
                                    <span className="col-span-2 text-right">Subtotal</span>
                                </div>

                                {items.map((item, idx) => (
                                    <div key={idx} className="space-y-1.5">
                                        {/* Main row */}
                                        <div className="grid grid-cols-12 gap-2 items-center">
                                            {/* Description + catalog picker */}
                                            <div className="col-span-12 sm:col-span-5 relative" ref={openPickerIdx === idx ? pickerRef : null}>
                                                <div className="flex gap-1">
                                                    <input
                                                        required
                                                        value={item.description}
                                                        onChange={e => handleItemChange(idx, "description", e.target.value)}
                                                        onBlur={handlePickerBlur}
                                                        placeholder="Ketik bebas atau pilih dari katalog..."
                                                        className="flex-1 bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 min-w-0"
                                                    />
                                                    {/* Catalog picker toggle */}
                                                    <button
                                                        type="button"
                                                        title="Pilih dari katalog produk/jasa"
                                                        onClick={() => { setOpenPickerIdx(openPickerIdx === idx ? null : idx); setPickerSearch(""); }}
                                                        className={`shrink-0 p-2 rounded-lg border transition-colors ${openPickerIdx === idx ? "bg-primary text-primary-foreground border-primary" : "border-input bg-background text-muted-foreground hover:text-primary hover:border-primary/50"}`}
                                                    >
                                                        <Package className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>

                                                {/* Dropdown picker */}
                                                {openPickerIdx === idx && (
                                                    <div className="absolute top-full left-0 z-50 mt-1 w-80 bg-card border border-border rounded-xl shadow-xl overflow-hidden"
                                                        onMouseDown={e => e.preventDefault()}>
                                                        <div className="p-2 border-b border-border">
                                                            <div className="flex items-center gap-2 bg-background border border-input rounded-lg px-2 py-1.5">
                                                                <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                                                <input
                                                                    autoFocus
                                                                    value={pickerSearch}
                                                                    onChange={e => setPickerSearch(e.target.value)}
                                                                    placeholder="Cari produk atau jasa..."
                                                                    className="flex-1 bg-transparent text-sm focus:outline-none text-foreground placeholder:text-muted-foreground"
                                                                />
                                                                {pickerSearch && <button type="button" onClick={() => setPickerSearch("")} className="text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /></button>}
                                                            </div>
                                                        </div>
                                                        <div className="max-h-56 overflow-y-auto">
                                                            {filteredCatalog.length === 0 ? (
                                                                <p className="p-3 text-sm text-muted-foreground text-center">Tidak ditemukan.</p>
                                                            ) : filteredCatalog.map((cat, ci) => (
                                                                <button key={ci} type="button" onMouseDown={() => selectCatalogItem(idx, cat)}
                                                                    className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/60 transition-colors text-left border-b border-border/50 last:border-0">
                                                                    <div className="min-w-0">
                                                                        <div className="flex items-center gap-1.5">
                                                                            <p className="text-sm font-medium text-foreground truncate">{cat.label}</p>
                                                                            {cat.pricingMode === "AREA_BASED" && (
                                                                                <span className="shrink-0 text-xs bg-blue-500/10 text-blue-600 px-1.5 py-0.5 rounded-full">per m²</span>
                                                                            )}
                                                                        </div>
                                                                        <p className="text-xs text-muted-foreground">{cat.unit} · {fmt(cat.price)}</p>
                                                                    </div>
                                                                    <span className={`ml-2 shrink-0 text-xs px-1.5 py-0.5 rounded-full font-medium ${TYPE_BADGE[cat.type] ?? "bg-muted text-muted-foreground"}`}>
                                                                        {TYPE_LABEL[cat.type] ?? cat.type}
                                                                    </span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Unit — locked to m² when area mode */}
                                            {item.isAreaBased ? (
                                                <div className="col-span-4 sm:col-span-2 flex items-center justify-center h-9 bg-blue-500/5 border border-blue-500/20 rounded-lg text-xs font-semibold text-blue-600">m²</div>
                                            ) : (
                                                <select value={item.unit} onChange={e => handleItemChange(idx, "unit", e.target.value)} className="col-span-4 sm:col-span-2 bg-background border border-input rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                                                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                                    {item.unit && !UNITS.includes(item.unit) && <option value={item.unit}>{item.unit}</option>}
                                                </select>
                                            )}

                                            {/* Qty — shows calculated area when area mode */}
                                            {item.isAreaBased ? (
                                                <div className="col-span-2 sm:col-span-1 flex items-center justify-center h-9 bg-blue-500/5 border border-blue-500/20 rounded-lg text-xs font-semibold text-blue-600">
                                                    {item.quantity}
                                                </div>
                                            ) : (
                                                <input required type="number" min="0.01" step="0.01" value={item.quantity} onChange={e => handleItemChange(idx, "quantity", parseFloat(e.target.value) || 0)} className="col-span-2 sm:col-span-1 bg-background border border-input rounded-lg px-2 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/50" />
                                            )}

                                            {/* Price */}
                                            <input required type="number" min="0" value={item.price} onChange={e => handleItemChange(idx, "price", e.target.value)} placeholder="0" className="col-span-4 sm:col-span-2 bg-background border border-input rounded-lg px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary/50" />

                                            {/* Subtotal + area toggle + delete */}
                                            <div className="col-span-2 flex items-center justify-end gap-1">
                                                <span className="hidden sm:inline text-xs text-muted-foreground mr-1">{fmt(item.quantity * item.price)}</span>
                                                {/* Area mode toggle */}
                                                <button type="button" onClick={() => toggleAreaMode(idx)}
                                                    title={item.isAreaBased ? "Kembali ke mode qty normal" : "Aktifkan mode ukuran (m²)"}
                                                    className={`p-1.5 rounded-lg border text-xs transition-colors ${item.isAreaBased ? "bg-blue-500/10 text-blue-600 border-blue-500/30" : "border-input text-muted-foreground hover:text-blue-600 hover:border-blue-500/30"}`}>
                                                    📐
                                                </button>
                                                {items.length > 1 && (
                                                    <button type="button" onClick={() => removeItem(idx)} className="text-muted-foreground hover:text-destructive transition-colors p-1"><X className="h-3.5 w-3.5" /></button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Area dimension sub-row */}
                                        {item.isAreaBased && (
                                            <div className="ml-1 flex items-center gap-2 bg-blue-500/5 border border-blue-500/20 rounded-lg px-3 py-2">
                                                <span className="text-xs text-blue-600 font-medium shrink-0">📐 Ukuran:</span>
                                                <div className="flex items-center gap-1.5">
                                                    <input
                                                        type="number" min="0.01" step="0.01"
                                                        value={item.width ?? 1}
                                                        onChange={e => handleDimensionChange(idx, "width", parseFloat(e.target.value) || 0)}
                                                        className="w-16 bg-background border border-blue-500/30 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                                                    />
                                                    <span className="text-xs text-muted-foreground">m</span>
                                                    <span className="text-xs text-muted-foreground">×</span>
                                                    <input
                                                        type="number" min="0.01" step="0.01"
                                                        value={item.height ?? 1}
                                                        onChange={e => handleDimensionChange(idx, "height", parseFloat(e.target.value) || 0)}
                                                        className="w-16 bg-background border border-blue-500/30 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                                                    />
                                                    <span className="text-xs text-muted-foreground">m</span>
                                                    <span className="text-xs text-blue-600 font-semibold ml-1">
                                                        = {item.quantity} m²
                                                    </span>
                                                    <span className="text-xs text-muted-foreground ml-2">→</span>
                                                    <span className="text-xs font-medium text-foreground">{fmt(item.quantity * item.price)}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Tax / Discount */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">Diskon (Rp)</label>
                                <input type="number" min="0" value={discount} onChange={e => setDiscount(e.target.value)} placeholder="0" className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">PPN (%)</label>
                                <select value={taxRate} onChange={e => setTaxRate(e.target.value)} className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                                    <option value="0">Tanpa PPN</option>
                                    <option value="11">PPN 11%</option>
                                    <option value="12">PPN 12%</option>
                                </select>
                            </div>
                        </div>

                        {/* Totals preview */}
                        <div className="bg-muted/30 rounded-lg p-4 text-sm space-y-1.5">
                            <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
                            {discountNum > 0 && <div className="flex justify-between text-destructive"><span>Diskon</span><span>− {fmt(discountNum)}</span></div>}
                            {taxRateNum > 0 && <div className="flex justify-between text-muted-foreground"><span>PPN {taxRateNum}%</span><span>{fmt(taxAmount)}</span></div>}
                            <div className="flex justify-between font-bold text-foreground text-base pt-2 border-t border-border"><span>Total</span><span className="text-primary">{fmt(total)}</span></div>
                        </div>

                        {/* Notes */}
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Catatan / Syarat &amp; Ketentuan</label>
                            <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)}
                                placeholder={isQuotation ? "Misal: Penawaran berlaku 14 hari. Harga belum termasuk ongkos kirim..." : "Misal: Pembayaran via transfer ke BCA 123-456-789..."}
                                className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
                        </div>
                    </div>
                    <div className="p-4 border-t border-border bg-muted/20 flex justify-end gap-3 shrink-0">
                        <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground border border-input hover:bg-muted/50 transition-colors">Batal</button>
                        <button type="submit" disabled={isPending} className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
                            {isPending ? "Menyimpan..." : mode === "create" ? `Simpan ${isQuotation ? "Penawaran" : "Invoice"}` : "Update"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
