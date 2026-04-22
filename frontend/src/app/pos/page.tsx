"use client";

import { useQuery, useMutation } from '@tanstack/react-query';
import { getProducts, getSettings, getBankAccounts, getCustomers, createCustomer, getUsers, createTransaction } from '@/lib/api';
import { Search, ShoppingCart, Plus, Minus, Trash2, CheckCircle2, Ruler, X, RefreshCw, StickyNote, Printer, MessageCircle, Pencil, Check, CalendarClock, CalendarRange, Clock } from "lucide-react";
import dayjs from 'dayjs';
import { cn } from "@/lib/utils";
import { useCartStore, CartItem } from '@/store/cart-store';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getSalesOrder } from '@/lib/api/sales-orders';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { useNotificationStore } from '@/store/notification-store';
import { useCurrentUser } from '@/hooks/useCurrentUser';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/** Harga display: ambil harga tier pertama (minQty terkecil) jika ada, fallback ke variant.price */
function getEffectivePrice(variant: any): number {
    const base = Number(variant.price || 0);
    const tiers: any[] = variant.priceTiers || [];
    if (tiers.length === 0) return base;
    const sorted = [...tiers].sort((a, b) => Number(a.minQty) - Number(b.minQty));
    return Number(sorted[0].price);
}

interface AreaModalState {
    open: boolean;
    mode: 'add' | 'edit';   // 'add' = new line, 'edit' = update existing line
    editLineId?: string;
    product: any;
    variant: any;
    unitType: 'm' | 'cm' | 'menit';
    widthCm: string;
    heightCm: string;
    note: string;
    pcs: string;
}

const emptyAreaModal = (): AreaModalState => ({
    open: false, mode: 'add', product: null, variant: null, unitType: 'm', widthCm: '', heightCm: '', note: '', pcs: '1'
});

import { ReceiptSnapshot, handlePrintSnap, handleShareWA } from '@/lib/receipt';
import { Suspense } from 'react';

function POSPageContent() {
    const { data: products, isLoading } = useQuery({ queryKey: ['products'], queryFn: getProducts });
    const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: getSettings });
    const { data: bankAccounts } = useQuery({ queryKey: ['bank-accounts'], queryFn: getBankAccounts });
    const { data: customers, refetch: refetchCustomers } = useQuery({ queryKey: ['customers'], queryFn: getCustomers });
    const { data: users } = useQuery({ queryKey: ['users'], queryFn: getUsers });
    const { isManager } = useCurrentUser();

    const createCustomerMutation = useMutation({
        mutationFn: createCustomer,
        onSuccess: () => { refetchCustomers(); }
    });

    const searchParams = useSearchParams();
    const router = useRouter();
    const fromSOParam = searchParams?.get('fromSO');
    const fromSOId = fromSOParam ? Number(fromSOParam) : null;
    const [salesOrderId, setSalesOrderId] = useState<number | null>(null);
    const [soPrefilled, setSoPrefilled] = useState(false);

    const { data: soData } = useQuery({
        queryKey: ['sales-order', fromSOId],
        queryFn: () => getSalesOrder(fromSOId!),
        enabled: !!fromSOId,
    });

    const [mobileCartOpen, setMobileCartOpen] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<string>('Semua');
    const [searchQuery, setSearchQuery] = useState('');
    const [isCheckoutModalOpen, setCheckoutModalOpen] = useState(false);
    const [showPayConfirm, setShowPayConfirm] = useState(false);  // confirmation step
    const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'QRIS' | 'BANK_TRANSFER' | 'KREDIT' | 'BAYAR_NANTI'>('CASH');
    const [selectedBankId, setSelectedBankId] = useState<string>('');
    const [areaModal, setAreaModal] = useState<AreaModalState>(emptyAreaModal());
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [customerAddress, setCustomerAddress] = useState('');
    const [isCustomerModalOpen, setCustomerModalOpen] = useState(false);
    const [customerSearchQuery, setCustomerSearchQuery] = useState('');
    const [customerSuggestField, setCustomerSuggestField] = useState<'name' | 'phone' | null>(null);
    const [dueDate, setDueDate] = useState('');
    const [downPayment, setDownPayment] = useState<string>('');
    const [discount, setDiscount] = useState<string>('');
    const [shippingCost, setShippingCost] = useState<string>('');
    const [cashierName, setCashierName] = useState('');
    const [employeeName, setEmployeeName] = useState('');
    const [receipt, setReceipt] = useState<ReceiptSnapshot | null>(null);
    const [productionPriority, setProductionPriority] = useState<'NORMAL' | 'EXPRESS'>('NORMAL');
    const [productionDeadline, setProductionDeadline] = useState('');
    const [productionNotes, setProductionNotes] = useState('');

    // State DP saat Bayar Nanti
    const [dpBayarNanti, setDpBayarNanti] = useState('');
    const [dpMethodBayarNanti, setDpMethodBayarNanti] = useState<'CASH' | 'QRIS' | 'BANK_TRANSFER'>('CASH');
    const [dpBankBayarNanti, setDpBankBayarNanti] = useState('');

    // Backdate state (khusus manager)
    const todayStr = new Date().toISOString().split('T')[0];
    const [transactionDate, setTransactionDate] = useState('');       // kosong = hari ini
    const [cashflowToday, setCashflowToday] = useState(false);        // true = cashflow masuk shift hari ini

    // Note Modal State for UNIT products
    const [unitNoteModal, setUnitNoteModal] = useState<{ open: boolean, lineId: string, currentNote: string }>({ open: false, lineId: '', currentNote: '' });

    // Inline price edit state
    const [priceEditState, setPriceEditState] = useState<{ lineId: string; value: string } | null>(null);

    // Inline qty edit state (UNIT items)
    const [qtyEditState, setQtyEditState] = useState<{ lineId: string; value: string } | null>(null);

    const cart = useCartStore((state) => state.items);
    const addItem = useCartStore((state) => state.addItem);
    const removeItem = useCartStore((state) => state.removeItem);
    const updateQuantity = useCartStore((state) => state.updateQuantity);
    const updateAreaDimensions = useCartStore((state) => state.updateAreaDimensions);
    const updateNote = useCartStore((state) => state.updateNote);
    const updateCustomPrice = useCartStore((state) => state.updateCustomPrice);
    const setQuantityDirect = useCartStore((state) => state.setQuantityDirect);
    const clearCart = useCartStore((state) => state.clearCart);
    const _subtotal = useCartStore((state) => state.subtotal());
    const taxRate = settings?.enableTax ? Number(settings.taxRate ?? 10) : 0;
    const discountNum = Number(discount) || 0;
    const taxAmount = (_subtotal - discountNum) * (taxRate / 100);
    const shippingCostNum = Number(shippingCost) || 0;
    const grandTotal = _subtotal - discountNum + taxAmount + shippingCostNum;
    const subtotal = _subtotal;
    const addNotification = useNotificationStore(s => s.addNotification);

    const transactionMutation = useMutation({
        mutationFn: createTransaction,
        onSuccess: (data) => {
            setCheckoutModalOpen(false);
            clearCart();
            setDiscount('');
            setShippingCost('');
            setDueDate('');
            setDownPayment('');
            setPaymentMethod('CASH');
            // Receipt is shown from snapshot captured before cart was cleared
        }
    });

    // ---- Pre-fill cart from Sales Order (?fromSO=<id>) ----
    useEffect(() => {
        if (!fromSOId || !soData || !products || soPrefilled) return;
        // Guard: SO must be in SENT state (DRAFT shouldn't invoice yet, INVOICED/CANCELLED blocked)
        if (soData.status !== 'SENT') {
            addNotification({ type: 'system', title: 'SO tidak valid', message: `SO ${soData.soNumber} tidak bisa dibuatkan nota (status: ${soData.status})` });
            setSoPrefilled(true);
            return;
        }
        clearCart();
        setCustomerName(soData.customerName || '');
        setCustomerPhone(soData.customerPhone || '');
        setCustomerAddress(soData.customerAddress || '');
        setSalesOrderId(soData.id);

        // Add each SO item to cart
        for (const it of soData.items) {
            const product = (products as any[]).find((p: any) =>
                p.variants?.some((v: any) => v.id === it.productVariantId)
            );
            if (!product) continue;
            const variant = product.variants.find((v: any) => v.id === it.productVariantId);
            if (!variant) continue;

            if (product.pricingMode === 'AREA_BASED' && it.widthCm && it.heightCm) {
                addItem(product, variant, {
                    widthCm: Number(it.widthCm),
                    heightCm: Number(it.heightCm),
                    unitType: (it.unitType as 'm' | 'cm' | 'menit') || 'cm',
                    note: it.note || undefined,
                    pcs: it.pcs ? Number(it.pcs) : 1,
                });
            } else {
                addItem(product, variant);
                // Apply qty > 1 and note for UNIT items
                const items = useCartStore.getState().items;
                const last = items[items.length - 1];
                if (last) {
                    if (it.quantity && it.quantity > 1) {
                        useCartStore.getState().setQuantityDirect(last.lineId, Number(it.quantity));
                    }
                    if (it.note) {
                        useCartStore.getState().updateNote(last.lineId, it.note);
                    }
                }
            }

            // Apply custom price if provided
            if (it.customPrice != null) {
                const items = useCartStore.getState().items;
                const last = items[items.length - 1];
                if (last) {
                    useCartStore.getState().updateCustomPrice(last.lineId, Number(it.customPrice));
                }
            }
        }
        setSoPrefilled(true);
        addNotification({ type: 'system', title: 'SO dibuka', message: `Cart ter-prefill dari SO ${soData.soNumber}` });
    }, [fromSOId, soData, products, soPrefilled, addItem, clearCart, addNotification]);

    const cancelSOMode = useCallback(() => {
        setSalesOrderId(null);
        setSoPrefilled(false);
        clearCart();
        setCustomerName(''); setCustomerPhone(''); setCustomerAddress('');
        router.replace('/pos');
    }, [clearCart, router]);

    // ---- Pre-payment invoice helpers (from current cart, before transaction) ----
    const buildCurrentSnap = (): ReceiptSnapshot => ({
        items: cart.map(item => ({
            name: item.name,
            sku: item.sku,
            qty: item.qty,
            price: item.price,
            pricePerUnit: item.pricePerUnit,
            pricingMode: item.pricingMode,
            note: item.note,
            unitType: item.unitType,
            widthCm: item.widthCm,
            heightCm: item.heightCm,
            areaM2: item.areaM2,
            customPrice: item.customPrice,
            pcs: item.pcs,
        })),
        subtotal,
        discount: discountNum > 0 ? discountNum : undefined,
        taxAmount,
        shippingCost: shippingCostNum > 0 ? shippingCostNum : undefined,
        grandTotal,
        paymentMethod,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        customerAddress: customerAddress.trim() || undefined,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        downPayment: downPayment !== '' ? Number(downPayment) : undefined,
        cashierName: cashierName.trim() || undefined,
        employeeName: employeeName.trim() || undefined,
        logoUrl: settings?.logoImageUrl || undefined,
        storeName: settings?.storeName || 'Toko',
        storeAddress: settings?.storeAddress || undefined,
        storePhone: settings?.storePhone || undefined,
        taxRate: taxRate,
        timestamp: new Date()
    });

    const handlePrintTagihan = () => handlePrintSnap(buildCurrentSnap(), 'TAGIHAN', bankAccounts);
    const handleShareTagihan = () => handleShareWA(buildCurrentSnap(), 'TAGIHAN', bankAccounts);

    const categories = useMemo(() => {
        if (!products) return ['Semua'];
        const cats = new Set(
            products
                .filter((p: any) => (p.productType || 'SELLABLE') !== 'RAW_MATERIAL')
                .map((p: any) => p.category?.name)
                .filter(Boolean)
        );
        return ['Semua', ...Array.from(cats)] as string[];
    }, [products]);

    const filteredProducts = useMemo(() => {
        if (!products) return [];
        return products.filter((p: any) => {
            if ((p.productType || 'SELLABLE') === 'RAW_MATERIAL') return false;
            const matchesCat = selectedCategory === 'Semua' || p.category?.name === selectedCategory;
            const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.variants.some((v: any) => v.sku.toLowerCase().includes(searchQuery.toLowerCase()));
            return matchesCat && matchesSearch;
        });
    }, [products, selectedCategory, searchQuery]);

    // Open area modal for a fresh new line (clicking card or '+')
    const openAreaModalFresh = (product: any, variant: any) => {
        setAreaModal({ open: true, mode: 'add', product, variant, unitType: 'm', widthCm: '', heightCm: '', note: '', pcs: '1' });
    };

    // Open area modal with existing data to edit a cart line
    const openAreaModalEdit = (lineId: string, item: typeof cart[0]) => {
        // Find product + variant from products list
        const product = products?.find((p: any) => p.id === item.id);
        const variant = product?.variants?.find((v: any) => v.id === item.productVariantId);
        setAreaModal({
            open: true, mode: 'edit', editLineId: lineId,
            product: product || { id: item.id, name: item.name, pricingMode: 'AREA_BASED' },
            variant: variant || { id: item.productVariantId, price: item.pricePerUnit, stock: item.stock },
            unitType: item.unitType || 'm',
            widthCm: String(item.widthCm || ''),
            heightCm: String(item.heightCm || ''),
            note: item.note || '',
            pcs: String(item.pcs || 1)
        });
    };

    const handleProductClick = (product: any, variant: any) => {
        if (product.trackStock !== false && Number(variant.stock) <= 0) return;
        if (product.pricingMode === 'AREA_BASED') {
            openAreaModalFresh(product, variant);
        } else {
            addItem(product, variant);
        }
    };

    const confirmAreaInput = () => {
        const w = Number(areaModal.widthCm);
        const h = areaModal.unitType === 'menit' ? 1 : Number(areaModal.heightCm); // height is irrelevant for 1D units like menit
        if (!w || w <= 0 || (areaModal.unitType !== 'menit' && (!h || h <= 0))) return;

        // areaForStock: always m² for stock comparison (independent of price unit)
        let areaForStock = 0;
        if (areaModal.unitType === 'm') areaForStock = w * h;
        else if (areaModal.unitType === 'cm') areaForStock = (w * h) / 10000;
        else if (areaModal.unitType === 'menit') areaForStock = w;

        const pcs = Math.max(1, parseInt(areaModal.pcs, 10) || 1);
        const totalAreaForStock = areaForStock * pcs;
        const stockM2 = Number(areaModal.variant?.stock || 0);
        if (areaModal.product?.trackStock !== false && totalAreaForStock > stockM2) {
            alert(`Stok bahan tidak cukup! Tersedia: ${stockM2.toFixed(2)} m², dibutuhkan: ${totalAreaForStock.toFixed(2)} m²`);
            return;
        }
        const note = areaModal.note.trim() || undefined;

        if (areaModal.mode === 'edit' && areaModal.editLineId) {
            updateAreaDimensions(areaModal.editLineId, w, h, areaModal.unitType, Number(areaModal.variant?.price || 0), note, pcs);
        } else {
            addItem(areaModal.product, areaModal.variant, { widthCm: w, heightCm: h, unitType: areaModal.unitType, note, pcs });
        }
        setAreaModal(emptyAreaModal());
    };

    const handleCheckout = async () => {
        if (cart.length === 0) return;

        if (!cashierName.trim()) {
            alert('Kolom Kasir / Staff wajib diisi sebelum memproses order!');
            return;
        }

        if (!customerName || !customerPhone) {
            alert('Data pelanggan (Nama dan No. HP) wajib diisi untuk melanjutkan transaksi!');
            return;
        }

        if (paymentMethod === 'BANK_TRANSFER' && !selectedBankId) {
            alert('Silakan pilih Rekening Bank tujuan transfer!');
            return;
        }

        if (paymentMethod === 'BAYAR_NANTI' && dpBayarNanti !== '' && Number(dpBayarNanti) > 0 && dpMethodBayarNanti === 'BANK_TRANSFER' && !dpBankBayarNanti) {
            alert('Silakan pilih Rekening Bank tujuan pembayaran DP!');
            return;
        }

        const isPayLater = paymentMethod === 'BAYAR_NANTI';

        // Snapshot cart BEFORE clearing (needed for receipt display)
        const snap: ReceiptSnapshot = {
            items: [...cart],
            subtotal,
            discount: discountNum > 0 ? discountNum : undefined,
            taxAmount,
            shippingCost: shippingCostNum > 0 ? shippingCostNum : undefined,
            grandTotal,
            paymentMethod,
            customerName: customerName.trim() || undefined,
            customerPhone: customerPhone.trim() || undefined,
            customerAddress: customerAddress.trim() || undefined,
            dueDate: dueDate ? new Date(dueDate) : undefined,
            downPayment: paymentMethod === 'BAYAR_NANTI'
                ? (dpBayarNanti !== '' && Number(dpBayarNanti) > 0 ? Number(dpBayarNanti) : 0)
                : downPayment !== '' ? Number(downPayment) : undefined,
            cashierName: cashierName.trim() || undefined,
            employeeName: employeeName.trim() || undefined,
            logoUrl: settings?.logoImageUrl || undefined,
            storeName: settings?.storeName || 'Toko',
            storeAddress: settings?.storeAddress || undefined,
            storePhone: settings?.storePhone || undefined,
            taxRate: taxRate,
            timestamp: new Date()
        };

        const payload = {
            items: cart.map(item => ({
                productVariantId: item.productVariantId,
                quantity: item.qty,
                widthCm: item.widthCm ? Number(item.widthCm) : undefined,
                heightCm: item.heightCm ? Number(item.heightCm) : undefined,
                unitType: item.unitType,
                pcs: item.pcs ?? 1,
                note: item.note,
                customPrice: item.customPrice != null ? item.customPrice : undefined,
            })),
            paymentMethod: paymentMethod === 'KREDIT' ? 'CASH'
                : paymentMethod === 'BAYAR_NANTI'
                    ? (dpBayarNanti !== '' && Number(dpBayarNanti) > 0 ? dpMethodBayarNanti : 'CASH')
                    : paymentMethod,
            saveOnly: isPayLater ? true : undefined,
            discount: discountNum > 0 ? discountNum : 0,
            shippingCost: shippingCostNum > 0 ? shippingCostNum : undefined,
            customerName: customerName.trim() || undefined,
            customerPhone: customerPhone.trim() || undefined,
            customerAddress: customerAddress.trim() || undefined,
            dueDate: dueDate || undefined,
            downPayment: paymentMethod === 'BAYAR_NANTI'
                ? (dpBayarNanti !== '' ? Number(dpBayarNanti) : 0)
                : (downPayment !== '' ? Number(downPayment) : undefined),
            cashierName: cashierName.trim() || undefined,
            employeeName: employeeName.trim() || undefined,
            bankAccountId: paymentMethod === 'BAYAR_NANTI' && dpMethodBayarNanti === 'BANK_TRANSFER'
                ? (dpBankBayarNanti ? Number(dpBankBayarNanti) : undefined)
                : (selectedBankId ? Number(selectedBankId) : undefined),
            productionPriority,
            productionDeadline: productionDeadline || undefined,
            productionNotes: productionNotes.trim() || undefined,
            // Backdate fields (only sent if manager filled them)
            transactionDate: transactionDate || undefined,
            cashflowDate: (transactionDate && cashflowToday) ? todayStr : undefined,
            // Link to Sales Order (if transaction started from SO)
            salesOrderId: salesOrderId ?? undefined,
        };

        if (!navigator.onLine) {
            const { saveOfflineTransaction } = await import('@/lib/sync');
            await saveOfflineTransaction(payload);
            clearCart(); setCheckoutModalOpen(false);
            setPaymentMethod('CASH'); setSelectedBankId('');
            setReceipt(snap);
        } else {
            transactionMutation.mutate(payload, {
                onSuccess: (data) => {
                    snap.transactionId = data?.id;
                    setCheckoutModalOpen(false);
                    clearCart();
                    // Auto-save customer baru berdasarkan nomor HP (unique key)
                    const trimPhone = customerPhone.trim();
                    const trimName = customerName.trim();
                    if (trimPhone && trimName) {
                        const exists = (customers as any[])?.some((c: any) => c.phone === trimPhone);
                        if (!exists) createCustomerMutation.mutate({ name: trimName, phone: trimPhone, address: customerAddress.trim() || undefined });
                    }
                    setCustomerName(''); setCustomerPhone(''); setCustomerAddress('');
                    setProductionPriority('NORMAL'); setProductionDeadline(''); setProductionNotes('');
                    setPaymentMethod('CASH'); setSelectedBankId('');
                    setDueDate(''); setDownPayment('');
                    setDpBayarNanti(''); setDpMethodBayarNanti('CASH'); setDpBankBayarNanti('');
                    setTransactionDate(''); setCashflowToday(false);
                    // Clear SO link after successful transaction
                    if (salesOrderId) {
                        setSalesOrderId(null);
                        setSoPrefilled(false);
                        router.replace('/pos');
                    }
                    setReceipt(snap);

                    // Notif transaksi berhasil
                    const namaCustomer = snap.customerName || 'Pelanggan';
                    const jumlahItem = snap.items.length;
                    const totalFmt = `Rp ${snap.grandTotal.toLocaleString('id-ID')}`;
                    const metodeFmt = isPayLater ? 'Bayar Nanti'
                        : snap.paymentMethod === 'CASH' ? 'Tunai'
                        : snap.paymentMethod === 'QRIS' ? 'QRIS'
                        : 'Transfer';
                    addNotification({
                        type: 'transaction',
                        title: isPayLater ? '📋 Invoice Disimpan' : '✅ Order Berhasil Masuk',
                        message: `${namaCustomer} • ${jumlahItem} item • ${totalFmt} • ${metodeFmt}`,
                    });
                }
            });
        }
    };

    const handleScan = useCallback((scannedSku: string) => {
        if (!products) return;
        for (const p of products) {
            const variantMatch = p.variants.find((v: any) => v.sku.toLowerCase() === scannedSku.toLowerCase());
            if (variantMatch) { handleProductClick(p, variantMatch); break; }
        }
    }, [products]);

    useBarcodeScanner(handleScan);

    const areaPreview = useMemo(() => {
        if (!areaModal.open || !areaModal.variant) return null;
        const w = Number(areaModal.widthCm) || 0;
        const h = areaModal.unitType === 'menit' ? 1 : (Number(areaModal.heightCm) || 0);
        if (w <= 0 || (areaModal.unitType !== 'menit' && h <= 0)) return null;

        // price is always per-m² for AREA_BASED products
        // both priceMultiplier and areaForStock use m²
        let priceMultiplier = 0;
        let areaForStock = 0;
        if (areaModal.unitType === 'm') {
            priceMultiplier = w * h;
            areaForStock = w * h;
        } else if (areaModal.unitType === 'cm') {
            priceMultiplier = (w * h) / 10000;    // cm² → m², price is per m²
            areaForStock = (w * h) / 10000;
        } else if (areaModal.unitType === 'menit') {
            priceMultiplier = w;
            areaForStock = w;
        }

        const pcs = Math.max(1, parseInt(areaModal.pcs, 10) || 1);
        const unitPrice = Number(areaModal.variant?.price || 0);
        return { priceMultiplier, areaForStock, computedPrice: priceMultiplier * unitPrice * pcs, unitPrice, pcs };
    }, [areaModal.widthCm, areaModal.heightCm, areaModal.unitType, areaModal.variant, areaModal.open, areaModal.pcs]);

    // Count AREA_BASED lines per variant for the badge
    const areaLineCount = useMemo(() => {
        const counts: Record<number, number> = {};
        cart.forEach(i => {
            if (i.pricingMode === 'AREA_BASED') counts[i.productVariantId] = (counts[i.productVariantId] || 0) + 1;
        });
        return counts;
    }, [cart]);

    return (
        <div className="flex h-[calc(100vh-8rem)] gap-6">
            {/* Product Grid */}
            <div className="flex-1 flex flex-col glass rounded-xl overflow-hidden">
                <div className="p-4 border-b border-border bg-card/50">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Cari produk atau SKU..."
                            className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm" />
                    </div>
                </div>

                <div className="p-3 flex gap-2 overflow-x-auto no-scrollbar border-b border-border/50">
                    {categories.map(cat => (
                        <button key={cat} onClick={() => setSelectedCategory(cat)}
                            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${cat === selectedCategory ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
                            {cat}
                        </button>
                    ))}
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                    {isLoading ? (
                        <div className="h-full flex items-center justify-center text-muted-foreground">Memuat Produk...</div>
                    ) : filteredProducts.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-muted-foreground">Tidak ada produk.</div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-20">
                            {filteredProducts.map((p: any) =>
                                p.variants.map((v: any) => {
                                    const isAreaBased = p.pricingMode === 'AREA_BASED';
                                    const unitLineInCart = !isAreaBased && cart.find(i => i.productVariantId === v.id);
                                    const areaLinesCount = isAreaBased ? (areaLineCount[v.id] || 0) : 0;
                                    const isInCart = isAreaBased ? areaLinesCount > 0 : !!unitLineInCart;
                                    const productImages = p.imageUrls ? (() => { try { return JSON.parse(p.imageUrls); } catch { return []; } })() : [];
                                    const imgSrc = v.variantImageUrl || productImages[0] || p.imageUrl;

                                    return (
                                        <div key={v.id} onClick={() => (p.trackStock === false || Number(v.stock) > 0) && handleProductClick(p, v)}
                                            className={`bg-card border rounded-xl p-4 transition-all group relative select-none
                                                ${(p.trackStock === false || Number(v.stock) > 0) ? 'cursor-pointer hover:border-primary/50 hover:shadow-md active:scale-[0.97]' : 'opacity-50 cursor-not-allowed grayscale'}
                                                ${isInCart ? 'border-primary/60 ring-1 ring-primary/30' : 'border-border'}`}
                                        >
                                            {/* m² badge */}
                                            {isAreaBased && (
                                                <div className="absolute top-2 left-2 z-10 bg-primary/90 text-primary-foreground text-[10px] px-1.5 py-0.5 rounded flex items-center gap-0.5 font-medium">
                                                    <Ruler className="w-2.5 h-2.5" />m²
                                                </div>
                                            )}

                                            {/* Cart badge */}
                                            {isInCart && (
                                                <div className="absolute top-2 right-2 z-10 min-w-[22px] h-[22px] bg-primary rounded-full flex items-center justify-center px-1.5">
                                                    <span className="text-white text-[10px] font-bold leading-none">
                                                        {isAreaBased ? `${areaLinesCount}×` : `×${(unitLineInCart as any)?.qty ?? 1}`}
                                                    </span>
                                                </div>
                                            )}

                                            <div className="aspect-square bg-muted/50 rounded-lg mb-3 flex items-center justify-center overflow-hidden border border-border group-hover:bg-primary/10 transition-colors">
                                                {imgSrc
                                                    ? <img src={`${API_BASE}${imgSrc}`} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                                    : <span className="text-4xl text-primary/50 font-bold">{p.name.charAt(0)}</span>
                                                }
                                            </div>
                                            <p className="font-semibold text-sm text-foreground line-clamp-2">{p.name}{v.variantName ? ` — ${v.variantName}` : (v.size ? ` (${v.size})` : '')}</p>
                                            <p className="text-xs text-muted-foreground truncate mb-1">{v.sku}</p>
                                            <div className="flex items-center justify-between">
                                                <p className="font-bold text-primary text-sm">
                                                    Rp {getEffectivePrice(v).toLocaleString('id-ID')}
                                                    {isAreaBased && <span className="text-xs font-normal text-muted-foreground">/m²</span>}
                                                    {!isAreaBased && v.priceTiers?.length > 0 && <span className="text-[10px] font-normal text-orange-500 ml-1">bertingkat</span>}
                                                </p>
                                                <p className={`text-xs font-medium ${p.trackStock === false ? 'text-blue-500' : Number(v.stock) < 10 ? 'text-destructive' : 'text-muted-foreground'}`}>
                                                    {p.trackStock === false ? '∞' : `${v.stock}${isAreaBased ? 'm²' : ''}`}
                                                </p>
                                            </div>

                                            {/* + button — visible on hover (all product types) */}
                                            {(p.trackStock === false || Number(v.stock) > 0) && (
                                                <div className="absolute bottom-3 right-3 w-7 h-7 bg-primary text-primary-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-lg scale-90 group-hover:scale-100">
                                                    <Plus className="w-4 h-4" />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Mobile Cart FAB */}
            <button
                onClick={() => setMobileCartOpen(true)}
                className="md:hidden fixed bottom-6 right-6 z-[200] bg-primary text-primary-foreground rounded-full w-16 h-16 shadow-2xl flex items-center justify-center active:scale-95 transition-transform">
                <ShoppingCart className="h-7 w-7" />
                {cart.length > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[22px] h-[22px] bg-destructive text-white text-[11px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
                        {cart.reduce((s, i) => s + i.qty, 0)}
                    </span>
                )}
            </button>

            {/* Mobile backdrop */}
            {mobileCartOpen && (
                <div
                    className="md:hidden fixed inset-0 z-[290] bg-background/60 backdrop-blur-sm"
                    onClick={() => setMobileCartOpen(false)}
                />
            )}

            {/* Cart — desktop sidebar / mobile bottom sheet */}
            <div className={cn(
                "flex-col bg-card border-border overflow-hidden shadow-sm",
                // Desktop: normal static sidebar
                "md:static md:flex md:w-[380px] md:shrink-0 md:rounded-xl md:border",
                // Mobile: fixed bottom sheet
                "fixed inset-x-0 bottom-0 z-[300] rounded-t-2xl border-t max-h-[85vh]",
                mobileCartOpen ? "flex" : "hidden md:flex"
            )}>
                <div className="p-4 bg-primary text-primary-foreground flex items-center justify-between md:rounded-t-xl rounded-t-2xl shrink-0">
                    <div className="flex items-center gap-2 font-semibold">
                        <ShoppingCart className="h-5 w-5" />
                        Keranjang ({cart.length} baris)
                    </div>
                    <div className="flex items-center gap-2">
                    {cart.length > 0 && (
                        <button onClick={clearCart} className="text-primary-foreground/70 hover:text-primary-foreground" title="Kosongkan">
                            <Trash2 className="h-5 w-5" />
                        </button>
                    )}
                    <button onClick={() => setMobileCartOpen(false)} className="md:hidden text-primary-foreground/70 hover:text-primary-foreground" title="Tutup">
                        <X className="h-5 w-5" />
                    </button>
                    </div>
                </div>

                {salesOrderId && soData && (
                    <div className="shrink-0 bg-emerald-50 border-b border-emerald-200 px-3 py-2 flex items-center justify-between gap-2">
                        <div className="text-xs">
                            <div className="font-semibold text-emerald-800">
                                Membuat nota dari <span className="font-mono">{soData.soNumber}</span>
                            </div>
                            <div className="text-emerald-700 truncate">Customer: {soData.customerName}</div>
                        </div>
                        <button
                            onClick={cancelSOMode}
                            className="text-[11px] px-2 py-1 rounded border border-emerald-300 text-emerald-800 hover:bg-emerald-100 shrink-0"
                        >
                            Batal SO
                        </button>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {cart.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-40 space-y-2">
                            <ShoppingCart className="w-12 h-12" />
                            <p className="text-sm">Keranjang kosong</p>
                        </div>
                    ) : (
                        cart.map((item) => (
                            <div key={item.lineId} className={`pb-3 border-b border-border/50 last:border-0 last:pb-0 ${item.pricingMode === 'AREA_BASED' ? 'bg-primary/3 rounded-lg px-2 py-2 border border-primary/10' : ''}`}>
                                <div className="flex gap-3">
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm text-foreground leading-tight truncate">{item.name}</p>
                                        <p className="text-xs text-muted-foreground">{item.sku}</p>

                                        {/* AREA_BASED: dimension display + edit button */}
                                        {item.pricingMode === 'AREA_BASED' && (
                                            <div className="mt-1.5 space-y-1">
                                                <div className="flex items-center gap-1.5">
                                                    <div className="flex items-center gap-1 bg-primary/10 text-primary rounded px-2 py-0.5 text-xs font-medium">
                                                        <Ruler className="w-3 h-3" />
                                                        {item.unitType === 'menit'
                                                            ? `${item.widthCm} unit`
                                                            : item.unitType === 'cm'
                                                            ? `${item.widthCm}×${item.heightCm} cm = ${Math.round(item.areaM2 || 0).toLocaleString('id-ID')} cm²`
                                                            : `${item.widthCm}×${item.heightCm} m = ${item.areaM2?.toLocaleString('id-ID')} m²`}
                                                    </div>
                                                    {item.pcs && item.pcs > 1 && (
                                                        <span className="text-[10px] font-bold bg-amber-500/15 text-amber-600 px-1.5 py-0.5 rounded">
                                                            ×{item.pcs} PCS
                                                        </span>
                                                    )}
                                                    <button onClick={() => openAreaModalEdit(item.lineId, item)}
                                                        className="p-1 text-muted-foreground hover:text-primary transition-colors rounded" title="Ubah dimensi">
                                                        <RefreshCw className="w-3 h-3" />
                                                    </button>
                                                </div>
                                                {/* Note display */}
                                                {item.note && (
                                                    <div className="flex items-start gap-1 text-xs text-muted-foreground bg-muted/40 rounded px-2 py-1">
                                                        <StickyNote className="w-3 h-3 shrink-0 mt-0.5 text-primary/60" />
                                                        <span className="break-words">{item.note}</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        {/* UNIT: note display */}
                                        {item.pricingMode === 'UNIT' && item.note && (
                                            <div className="mt-1.5 flex items-start gap-1 text-xs text-muted-foreground bg-muted/40 rounded px-2 py-1 w-fit">
                                                <StickyNote className="w-3 h-3 shrink-0 mt-0.5 text-primary/60" />
                                                <span className="break-words max-w-[200px]">{item.note}</span>
                                            </div>
                                        )}

                                        <div className="flex items-center gap-1.5 mt-1">
                                            {priceEditState?.lineId === item.lineId ? (
                                                <div className="flex items-center gap-1">
                                                    <span className="text-xs text-muted-foreground">Rp</span>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="any"
                                                        autoFocus
                                                        value={priceEditState.value}
                                                        onChange={e => setPriceEditState({ lineId: item.lineId, value: e.target.value })}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') {
                                                                const v = Number(priceEditState.value);
                                                                updateCustomPrice(item.lineId, (!isNaN(v) && v > 0) ? v : null);
                                                                setPriceEditState(null);
                                                            }
                                                            if (e.key === 'Escape') setPriceEditState(null);
                                                        }}
                                                        className="w-28 px-2 py-0.5 text-sm font-semibold bg-background border border-primary rounded outline-none focus:ring-1 focus:ring-primary font-mono"
                                                    />
                                                    <button
                                                        onClick={() => {
                                                            const v = Number(priceEditState.value);
                                                            updateCustomPrice(item.lineId, (!isNaN(v) && v > 0) ? v : null);
                                                            setPriceEditState(null);
                                                        }}
                                                        className="p-0.5 text-emerald-500 hover:text-emerald-600 transition-colors">
                                                        <Check className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => setPriceEditState(null)} className="p-0.5 text-muted-foreground hover:text-foreground transition-colors">
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <>
                                                    <p className={`text-sm font-semibold ${item.customPrice != null ? 'text-amber-500' : 'text-primary'}`}>
                                                        Rp {item.price.toLocaleString('id-ID')}
                                                    </p>
                                                    <button
                                                        onClick={() => setPriceEditState({ lineId: item.lineId, value: String(item.price) })}
                                                        className="p-0.5 text-muted-foreground hover:text-primary transition-colors"
                                                        title="Override harga">
                                                        <Pencil className="w-3 h-3" />
                                                    </button>
                                                    {item.customPrice != null && (
                                                        <button
                                                            onClick={() => updateCustomPrice(item.lineId, null)}
                                                            className="text-[10px] text-muted-foreground hover:text-destructive transition-colors"
                                                            title="Reset ke harga normal">
                                                            ↺
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-end gap-2 justify-center shrink-0">
                                        {item.pricingMode === 'AREA_BASED' ? (
                                            <button onClick={() => removeItem(item.lineId)}
                                                className="p-1.5 text-destructive/60 hover:text-destructive hover:bg-destructive/10 rounded transition-colors">
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        ) : (
                                            <div className="flex flex-col gap-2 items-end">
                                                <div className="flex items-center gap-1.5 bg-muted/50 rounded-lg p-1 border border-border">
                                                    <button onClick={() => item.qty > 1 ? updateQuantity(item.lineId, -1) : removeItem(item.lineId)}
                                                        className="p-1 hover:bg-background rounded text-muted-foreground transition-colors">
                                                        <Minus className="h-4 w-4" />
                                                    </button>
                                                    {qtyEditState?.lineId === item.lineId ? (
                                                        <input
                                                            type="number" min="1"
                                                            max={item.trackStock !== false ? item.stock : undefined}
                                                            autoFocus
                                                            value={qtyEditState.value}
                                                            onChange={e => setQtyEditState({ lineId: item.lineId, value: e.target.value })}
                                                            onKeyDown={e => {
                                                                if (e.key === 'Enter') {
                                                                    e.preventDefault();
                                                                    const v = parseInt(qtyEditState.value, 10);
                                                                    if (!isNaN(v) && v > 0) setQuantityDirect(item.lineId, v);
                                                                    setQtyEditState(null);
                                                                }
                                                                if (e.key === 'Escape') setQtyEditState(null);
                                                            }}
                                                            onBlur={() => {
                                                                const v = parseInt(qtyEditState.value, 10);
                                                                if (!isNaN(v) && v > 0) setQuantityDirect(item.lineId, v);
                                                                setQtyEditState(null);
                                                            }}
                                                            className="w-10 text-center text-sm font-medium bg-background border border-primary rounded outline-none focus:ring-1 focus:ring-primary font-mono px-1"
                                                        />
                                                    ) : (
                                                        <span
                                                            className="w-6 text-center text-sm font-medium cursor-pointer hover:text-primary hover:underline"
                                                            onClick={() => setQtyEditState({ lineId: item.lineId, value: String(item.qty) })}
                                                            title="Klik untuk ubah jumlah"
                                                        >
                                                            {item.qty}
                                                        </span>
                                                    )}
                                                    <button onClick={() => updateQuantity(item.lineId, 1)} disabled={item.trackStock !== false && item.qty >= item.stock}
                                                        className="p-1 hover:bg-background rounded text-muted-foreground transition-colors disabled:opacity-50">
                                                        <Plus className="h-4 w-4" />
                                                    </button>
                                                </div>
                                                <button onClick={() => setUnitNoteModal({ open: true, lineId: item.lineId, currentNote: item.note || '' })}
                                                    className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors bg-muted/50 px-2 py-1 rounded">
                                                    <StickyNote className="w-3 h-3" />
                                                    {item.note ? 'Edit Catatan' : '+ Catatan'}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="p-4 bg-card border-t border-border space-y-2.5 z-10">
                    <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Subtotal</span><span className="font-medium text-foreground">Rp {subtotal.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Pajak (10%)</span><span className="font-medium text-foreground">Rp {taxAmount.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="pt-2 border-t border-dashed border-border flex justify-between items-end">
                        <span className="font-medium">Grand Total</span>
                        <span className="text-2xl font-bold text-primary">Rp {grandTotal.toLocaleString('id-ID')}</span>
                    </div>
                    <button onClick={() => { setCheckoutModalOpen(true); setMobileCartOpen(false); }} disabled={cart.length === 0}
                        className="w-full py-3.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-bold transition-all shadow-md active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 text-base mt-2">
                        Proses Pembayaran
                    </button>
                </div>
            </div>

            {/* Area Input Modal (Add + Edit with note) */}
            {areaModal.open && (
                <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
                    <div className="glass bg-card w-full max-w-sm rounded-2xl border border-border shadow-2xl overflow-hidden">
                        <div className="p-5 border-b border-border flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                                    <Ruler className="w-4 h-4 text-primary" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-sm">
                                        {areaModal.mode === 'edit' ? 'Edit Dimensi Cetak' : 'Tambah Pekerjaan Cetak'}
                                    </h3>
                                    <p className="text-xs text-muted-foreground">{areaModal.product?.name}</p>
                                </div>
                            </div>
                            <button onClick={() => setAreaModal(emptyAreaModal())} className="p-1 text-muted-foreground hover:text-foreground">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-5 space-y-4">
                            {/* Unit Selection */}
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Satuan Perhitungan *</label>
                                <select
                                    value={areaModal.unitType}
                                    onChange={e => setAreaModal(prev => ({ ...prev, unitType: e.target.value as 'm' | 'cm' | 'menit' }))}
                                    className="w-full px-3 py-2.5 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm"
                                >
                                    <option value="m">Meter (m) - Hitung Luas pxl</option>
                                    <option value="cm">Centimeter (cm) - Hitung Luas pxl</option>
                                    <option value="menit">Menit/Jam/Pcs - Hitung Jumlah Langsung</option>
                                </select>
                            </div>

                            {/* Dimensions */}
                            <div className={`grid gap-3 ${areaModal.unitType === 'menit' ? 'grid-cols-1' : 'grid-cols-2'}`}>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">{areaModal.unitType === 'menit' ? 'Jumlah / Durasi *' : 'Lebar *'}</label>
                                    <input type="number" min="0" step="any" value={areaModal.widthCm}
                                        onChange={e => setAreaModal(prev => ({ ...prev, widthCm: e.target.value }))}
                                        placeholder={areaModal.unitType === 'cm' ? '120' : (areaModal.unitType === 'm' ? '1.2' : '45')} autoFocus
                                        className="w-full px-3 py-2.5 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm font-mono text-center" />
                                </div>
                                {areaModal.unitType !== 'menit' && (
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium">Tinggi *</label>
                                        <input type="number" min="0" step="any" value={areaModal.heightCm}
                                            onChange={e => setAreaModal(prev => ({ ...prev, heightCm: e.target.value }))}
                                            placeholder={areaModal.unitType === 'cm' ? '200' : '2.0'}
                                            className="w-full px-3 py-2.5 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm font-mono text-center" />
                                    </div>
                                )}
                            </div>

                            {/* Live price preview */}
                            {areaPreview && (
                                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-1.5">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">{areaModal.unitType === 'menit' ? 'Total Nilai' : 'Luas cetak'}</span>
                                        <span className="font-bold">
                                            {areaModal.unitType === 'menit'
                                                ? `${areaPreview.priceMultiplier.toLocaleString('id-ID')} unit`
                                                : `${areaPreview.priceMultiplier.toFixed(4)} m²`}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Harga Dasar</span>
                                        <span className="font-medium">
                                            {areaModal.unitType === 'menit'
                                                ? `Rp ${areaPreview.unitPrice.toLocaleString('id-ID')} /unit`
                                                : `Rp ${areaPreview.unitPrice.toLocaleString('id-ID')} /m²`}
                                        </span>
                                    </div>
                                    {areaPreview.pcs > 1 && (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">PCS / Kopi</span>
                                            <span className="font-medium text-amber-600">× {areaPreview.pcs}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between border-t border-primary/20 pt-1.5">
                                        <span className="font-semibold">Total{areaPreview.pcs > 1 ? ` (×${areaPreview.pcs} PCS)` : ''}</span>
                                        <span className="text-lg font-bold text-primary">Rp {areaPreview.computedPrice.toLocaleString('id-ID')}</span>
                                    </div>
                                </div>
                            )}

                            {/* Note / Description field */}
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium flex items-center gap-1.5">
                                    <StickyNote className="w-3.5 h-3.5 text-muted-foreground" />
                                    Nama Desain / Catatan &nbsp;
                                    <span className="text-xs font-normal text-muted-foreground">(opsional)</span>
                                </label>
                                <textarea
                                    rows={2}
                                    value={areaModal.note}
                                    onChange={e => setAreaModal(prev => ({ ...prev, note: e.target.value }))}
                                    placeholder="Contoh: Logo ACME, Laminasi Doff, Salin dari file WA, dll."
                                    className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm resize-none"
                                />
                                <p className="text-xs text-muted-foreground">Catatan ini akan tampil di keranjang sebagai referensi operator.</p>
                            </div>

                            {/* PCS / Copies */}
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium flex items-center gap-1.5">
                                    Jumlah PCS / Kopi
                                    <span className="text-xs font-normal text-muted-foreground">(default: 1)</span>
                                </label>
                                <input
                                    type="number" min="1" step="1"
                                    value={areaModal.pcs}
                                    onChange={e => setAreaModal(prev => ({ ...prev, pcs: e.target.value }))}
                                    placeholder="1"
                                    className="w-full px-3 py-2.5 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm font-mono text-center"
                                />
                                <p className="text-xs text-muted-foreground">Untuk dimensi sama yang dicetak lebih dari 1 kali.</p>
                            </div>

                            <div className="flex gap-3 pt-1">
                                <button type="button" onClick={() => setAreaModal(emptyAreaModal())}
                                    className="flex-1 py-2.5 rounded-xl border border-border bg-muted/50 font-medium text-sm hover:bg-muted transition-colors">
                                    Batal
                                </button>
                                <button type="button" onClick={confirmAreaInput} disabled={!areaPreview}
                                    className="flex-[2] py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
                                    <ShoppingCart className="w-4 h-4" />
                                    {areaModal.mode === 'edit' ? 'Simpan Perubahan' : 'Masukkan Keranjang'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Note Input Modal (For UNIT Products) */}
            {unitNoteModal.open && (
                <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
                    <div className="glass bg-card w-full max-w-sm rounded-2xl border border-border shadow-2xl overflow-hidden p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-sm flex items-center gap-2">
                                <StickyNote className="w-4 h-4 text-primary" />
                                Tambah Nama Desain / Catatan
                            </h3>
                            <button onClick={() => setUnitNoteModal({ open: false, lineId: '', currentNote: '' })} className="p-1 text-muted-foreground hover:text-foreground">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="space-y-3">
                            <textarea
                                rows={3}
                                value={unitNoteModal.currentNote}
                                onChange={e => setUnitNoteModal({ ...unitNoteModal, currentNote: e.target.value })}
                                placeholder="Contoh: Desain Banner Spanduk Ultah, Bungkus kado merah, dll."
                                className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm resize-none"
                                autoFocus
                            />
                            <div className="flex gap-2 justify-end">
                                <button type="button" onClick={() => setUnitNoteModal({ open: false, lineId: '', currentNote: '' })} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-muted transition-colors">
                                    Batal
                                </button>
                                <button type="button" onClick={() => { updateNote(unitNoteModal.lineId, unitNoteModal.currentNote); setUnitNoteModal({ open: false, lineId: '', currentNote: '' }); }} className="px-5 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-colors">
                                    Simpan Catatan
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== CHECKOUT MODAL (redesigned) ===== */}
            {isCheckoutModalOpen && (
                <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
                    <div className="glass bg-card w-full max-w-lg rounded-2xl border border-border shadow-2xl flex flex-col overflow-hidden max-h-[92vh] relative">

                        {/* === CONFIRM PAYMENT OVERLAY === */}
                        {showPayConfirm && (
                            <div className="absolute inset-0 z-20 flex items-end justify-stretch bg-background/70 backdrop-blur-sm rounded-2xl">
                                <div className="w-full bg-card border-t-2 border-primary rounded-b-2xl p-6 space-y-4 shadow-2xl">
                                    <div className="text-center">
                                        <div className="w-12 h-12 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
                                            <span className="text-2xl">⚠️</span>
                                        </div>
                                        <h3 className="text-lg font-bold">
                                            {paymentMethod === 'BAYAR_NANTI'
                                                ? (dpBayarNanti !== '' && Number(dpBayarNanti) > 0 ? 'Simpan Invoice + Terima DP' : 'Simpan Invoice (Bayar Nanti)')
                                                : paymentMethod === 'KREDIT' ? 'Konfirmasi Nota Kredit'
                                                : downPayment !== '' && Number(downPayment) < grandTotal ? 'Konfirmasi DP' : 'Konfirmasi Pembayaran'}
                                        </h3>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            {paymentMethod === 'BAYAR_NANTI'
                                                ? dpBayarNanti !== '' && Number(dpBayarNanti) > 0
                                                    ? <>Invoice disimpan dengan <strong>DP Rp {Number(dpBayarNanti).toLocaleString('id-ID')}</strong> via <strong>{dpMethodBayarNanti === 'BANK_TRANSFER' ? 'Transfer Bank' : dpMethodBayarNanti}</strong>. Sisa tagihan: <strong>Rp {(grandTotal - Number(dpBayarNanti)).toLocaleString('id-ID')}</strong>. Pastikan DP sudah diterima.</>
                                                    : <>Invoice disimpan <strong>tanpa pembayaran</strong>. Pelanggan dapat membayar nanti melalui menu <strong>Piutang</strong>.</>
                                                : paymentMethod === 'KREDIT'
                                                ? <>Transaksi disimpan sebagai <strong>piutang</strong>. Jatuh tempo: <strong>{dueDate ? dayjs(dueDate).format('DD/MM/YYYY') : '-'}</strong>. Tidak ada pembayaran diterima sekarang.</>
                                                : <>Pastikan pembayaran <strong>Rp {(downPayment !== '' && Number(downPayment) < grandTotal ? Number(downPayment) : grandTotal).toLocaleString('id-ID')}</strong> via <strong>{paymentMethod === 'BANK_TRANSFER' ? 'Transfer Bank' : paymentMethod}</strong> sudah diterima sebelum melanjutkan.</>
                                            }
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button onClick={() => setShowPayConfirm(false)}
                                            className="py-3 rounded-xl border-2 border-border bg-background font-bold text-sm hover:bg-muted transition-colors">
                                            ← Kembali
                                        </button>
                                        <button onClick={() => { setShowPayConfirm(false); handleCheckout(); }}
                                            disabled={transactionMutation.isPending}
                                            className={`py-3 rounded-xl text-white font-bold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 ${paymentMethod === 'BAYAR_NANTI' ? 'bg-sky-500 hover:bg-sky-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}>
                                            {paymentMethod === 'BAYAR_NANTI' ? <Clock className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                                            {transactionMutation.isPending ? 'Memproses...'
                                                : paymentMethod === 'BAYAR_NANTI'
                                                    ? (dpBayarNanti !== '' && Number(dpBayarNanti) > 0 ? 'Ya, Simpan + Terima DP ✓' : 'Ya, Simpan Invoice ✓')
                                                    : paymentMethod === 'KREDIT' ? 'Ya, Simpan Nota Kredit ✓'
                                                    : downPayment !== '' && Number(downPayment) < grandTotal ? 'Ya, Konfirmasi DP ✓' : 'Ya, Sudah Lunas ✓'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Header */}
                        <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
                            <div>
                                <h2 className="text-base font-bold">Tagihan Order</h2>
                                <p className="text-[11px] text-muted-foreground">{cart.length} item · {new Date().toLocaleDateString('id-ID', { dateStyle: 'medium' })}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Grand Total</p>
                                <p className="text-xl font-black text-primary">Rp {grandTotal.toLocaleString('id-ID')}</p>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto">

                            {/* ── Ringkasan + Harga ── */}
                            <div className="px-4 pt-3 pb-3 border-b border-border">
                                {/* Item list — scrollable */}
                                <div className="space-y-1 max-h-24 overflow-y-auto mb-2 pr-1">
                                    {cart.map((item) => (
                                        <div key={item.lineId} className="flex gap-2 text-xs">
                                            <div className="flex-1 min-w-0">
                                                <span className="font-medium truncate block">{item.name}</span>
                                                {item.pricingMode === 'AREA_BASED'
                                                    ? <span className="text-muted-foreground">{item.widthCm}×{item.heightCm}cm · {item.areaM2?.toFixed(2)}m²{item.note ? ` · ${item.note}` : ''}</span>
                                                    : <span className="text-muted-foreground">×{item.qty} × Rp {item.price.toLocaleString('id-ID')}{item.priceTiers.length > 0 && item.price !== item.pricePerUnit ? <span className="ml-1 text-orange-500 font-semibold"> tier</span> : null}</span>
                                                }
                                            </div>
                                            <span className="font-semibold shrink-0">Rp {(item.price * item.qty).toLocaleString('id-ID')}</span>
                                        </div>
                                    ))}
                                </div>

                                {/* Totals dengan input diskon & ongkir inline */}
                                <div className="border-t border-dashed border-border pt-2 space-y-1 text-xs">
                                    <div className="flex justify-between text-muted-foreground">
                                        <span>Subtotal</span><span>Rp {subtotal.toLocaleString('id-ID')}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-muted-foreground">Diskon (Rp)</span>
                                        <input type="number" value={discount} onChange={e => setDiscount(e.target.value)} placeholder="0" min="0"
                                            className="w-28 text-right px-2 py-0.5 border border-border rounded text-xs bg-background outline-none focus:border-destructive transition-colors text-destructive font-medium" />
                                    </div>
                                    {taxRate > 0 && (
                                        <div className="flex justify-between text-muted-foreground">
                                            <span>Pajak {taxRate}%</span><span>Rp {taxAmount.toLocaleString('id-ID')}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-center">
                                        <span className="text-muted-foreground">Ongkos Kirim</span>
                                        <input type="number" value={shippingCost} onChange={e => setShippingCost(e.target.value)} placeholder="0" min="0"
                                            className="w-28 text-right px-2 py-0.5 border border-border rounded text-xs bg-background outline-none focus:border-primary transition-colors" />
                                    </div>
                                    <div className="flex justify-between font-bold text-sm pt-1 border-t border-border">
                                        <span>Total</span><span className="text-primary">Rp {grandTotal.toLocaleString('id-ID')}</span>
                                    </div>
                                </div>
                            </div>

                            {/* ── Data Pelanggan ── */}
                            {(() => {
                                const fillCustomer = (c: any) => {
                                    setCustomerName(c.name);
                                    setCustomerPhone(c.phone || '');
                                    setCustomerAddress(c.address || '');
                                    setCustomerSuggestField(null);
                                };
                                const nameSuggestions = customerSuggestField === 'name' && customerName.trim().length > 0
                                    ? (customers as any[] || []).filter((c: any) =>
                                        c.name.toLowerCase().includes(customerName.toLowerCase()) ||
                                        (c.phone && c.phone.includes(customerName))
                                    ).slice(0, 6)
                                    : [];
                                const phoneSuggestions = customerSuggestField === 'phone' && customerPhone.trim().length > 0
                                    ? (customers as any[] || []).filter((c: any) =>
                                        (c.phone && c.phone.includes(customerPhone)) ||
                                        c.name.toLowerCase().includes(customerPhone.toLowerCase())
                                    ).slice(0, 6)
                                    : [];
                                const isExistingPhone = !!(customers as any[] || []).find((c: any) => c.phone === customerPhone.trim());
                                return (
                                    <div className="px-4 pt-3 pb-3 border-b border-border space-y-2">
                                        <div className="flex items-center justify-between">
                                            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                                                Pelanggan <span className="text-destructive">*Wajib</span>
                                            </p>
                                            {customerPhone.trim() && (
                                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${isExistingPhone ? 'bg-green-500/10 text-green-600' : 'bg-blue-500/10 text-blue-600'}`}>
                                                    {isExistingPhone ? '✓ Pelanggan lama' : '+ Pelanggan baru'}
                                                </span>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            {/* Field: Nama */}
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    placeholder="Nama Pelanggan *"
                                                    value={customerName}
                                                    onChange={e => setCustomerName(e.target.value)}
                                                    onFocus={() => setCustomerSuggestField('name')}
                                                    onBlur={() => setTimeout(() => setCustomerSuggestField(null), 150)}
                                                    className="w-full px-2.5 py-1.5 bg-background border border-border rounded-lg outline-none text-xs focus:border-primary transition-colors"
                                                />
                                                {nameSuggestions.length > 0 && (
                                                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-background border border-border rounded-lg shadow-lg overflow-hidden">
                                                        {nameSuggestions.map((c: any) => (
                                                            <div
                                                                key={c.id}
                                                                onMouseDown={e => { e.preventDefault(); fillCustomer(c); }}
                                                                className="px-3 py-2 text-xs cursor-pointer hover:bg-primary/5 flex justify-between items-center border-b border-border/50 last:border-0"
                                                            >
                                                                <span className="font-medium text-foreground">{c.name}</span>
                                                                <span className="text-muted-foreground">{c.phone || '-'}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            {/* Field: No. HP */}
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    placeholder="No. HP / WA *"
                                                    value={customerPhone}
                                                    onChange={e => {
                                                        setCustomerPhone(e.target.value);
                                                        // Auto-fill jika HP persis cocok
                                                        const match = (customers as any[] || []).find((c: any) => c.phone === e.target.value.trim());
                                                        if (match) { setCustomerName(match.name); setCustomerAddress(match.address || ''); }
                                                    }}
                                                    onFocus={() => setCustomerSuggestField('phone')}
                                                    onBlur={() => setTimeout(() => setCustomerSuggestField(null), 150)}
                                                    className="w-full px-2.5 py-1.5 bg-background border border-border rounded-lg outline-none text-xs focus:border-primary transition-colors"
                                                />
                                                {phoneSuggestions.length > 0 && (
                                                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-background border border-border rounded-lg shadow-lg overflow-hidden">
                                                        {phoneSuggestions.map((c: any) => (
                                                            <div
                                                                key={c.id}
                                                                onMouseDown={e => { e.preventDefault(); fillCustomer(c); }}
                                                                className="px-3 py-2 text-xs cursor-pointer hover:bg-primary/5 flex justify-between items-center border-b border-border/50 last:border-0"
                                                            >
                                                                <span className="font-medium text-foreground">{c.name}</span>
                                                                <span className="text-muted-foreground">{c.phone || '-'}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <input type="text" placeholder="Alamat (opsional)" value={customerAddress} onChange={e => setCustomerAddress(e.target.value)}
                                            className="w-full px-2.5 py-1.5 bg-background border border-border rounded-lg outline-none text-xs focus:border-primary transition-colors" />
                                    </div>
                                );
                            })()}

                            {/* ── Info Order ── */}
                            <div className="px-4 pt-3 pb-3 border-b border-border">
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="space-y-0.5">
                                        <label className="text-[11px] text-muted-foreground">Est. Selesai</label>
                                        <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                                            className="w-full px-2 py-1.5 bg-background border border-border rounded-lg outline-none text-xs focus:border-primary transition-colors" />
                                    </div>
                                    <div className="space-y-0.5">
                                        <label className={`text-[11px] font-medium ${!cashierName ? 'text-destructive' : 'text-muted-foreground'}`}>
                                            Kasir / Staff{!cashierName && ' *'}
                                        </label>
                                        <select value={cashierName} onChange={e => setCashierName(e.target.value)}
                                            className={`w-full px-2 py-1.5 bg-background border rounded-lg outline-none text-xs transition-colors appearance-none ${!cashierName ? 'border-destructive/60 focus:border-destructive' : 'border-border focus:border-primary'}`}>
                                            <option value="">Pilih...</option>
                                            {users?.map((u: any) => (
                                                <option key={u.id} value={u.name}>{u.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    {paymentMethod !== 'BAYAR_NANTI' && (
                                    <div className="space-y-0.5">
                                        <label className="text-[11px] text-muted-foreground">Uang Muka (DP)</label>
                                        <input type="number" placeholder="0" value={downPayment} onChange={e => setDownPayment(e.target.value)} min="0" max={grandTotal}
                                            className="w-full px-2 py-1.5 bg-background border border-border rounded-lg outline-none text-xs focus:border-primary transition-colors" />
                                    </div>
                                )}
                                </div>
                                {downPayment !== '' && Number(downPayment) < grandTotal && paymentMethod !== 'KREDIT' && (
                                    <div className="mt-2 px-2.5 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-[11px] text-amber-600 font-semibold">
                                        DP — sisa tagihan: Rp {(grandTotal - Number(downPayment)).toLocaleString('id-ID')}
                                    </div>
                                )}

                                {/* Info Produksi — conditional */}
                                {cart.some((i: any) => i.pricingMode === 'AREA_BASED') && (
                                    <div className="mt-3 pt-3 border-t border-dashed border-border space-y-2">
                                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Produksi</p>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="flex gap-1.5">
                                                {(['NORMAL', 'EXPRESS'] as const).map(p => (
                                                    <button key={p} type="button" onClick={() => setProductionPriority(p)}
                                                        className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold border-2 transition-all ${productionPriority === p
                                                            ? p === 'EXPRESS' ? 'border-red-500 bg-red-500/10 text-red-600' : 'border-primary bg-primary/10 text-primary'
                                                            : 'border-border bg-muted/50 text-muted-foreground'}`}>
                                                        {p === 'EXPRESS' ? 'EXPRESS' : 'Normal'}
                                                    </button>
                                                ))}
                                            </div>
                                            <input type="datetime-local" value={productionDeadline} onChange={e => setProductionDeadline(e.target.value)}
                                                className="w-full px-2 py-1.5 bg-background border border-border rounded-lg outline-none text-xs focus:border-primary transition-colors" />
                                        </div>
                                        <textarea rows={1} value={productionNotes} onChange={e => setProductionNotes(e.target.value)}
                                            placeholder="Catatan operator mesin (finishing, warna, dll.)"
                                            className="w-full px-2.5 py-1.5 bg-background border border-border rounded-lg outline-none text-xs focus:border-primary transition-colors resize-none" />
                                        {productionPriority === 'EXPRESS' && (
                                            <p className="text-[11px] text-red-600 font-medium bg-red-500/10 border border-red-500/20 rounded-lg px-2.5 py-1.5">
                                                ORDER EXPRESS — Antrian produksi didahulukan
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* ── Metode Pembayaran ── */}
                            <div className="px-4 pt-3 pb-3 space-y-2">
                                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Pembayaran</p>
                                <div className="grid grid-cols-4 gap-2">
                                    {(['CASH', 'QRIS', 'BANK_TRANSFER'] as const).map(m => (
                                        <button key={m} onClick={() => { setPaymentMethod(m); setDueDate(''); if (downPayment === '0') setDownPayment(''); }}
                                            className={`py-2 rounded-xl text-xs font-bold transition-all border-2 ${paymentMethod === m ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-muted/50 text-muted-foreground hover:border-primary/30'}`}>
                                            {m === 'BANK_TRANSFER' ? 'TRANSFER' : m}
                                        </button>
                                    ))}
                                    <button onClick={() => { setPaymentMethod('KREDIT'); setDownPayment('0'); }}
                                        className={`py-2 rounded-xl text-xs font-bold transition-all border-2 flex items-center justify-center gap-1 ${paymentMethod === 'KREDIT' ? 'border-violet-500 bg-violet-500/10 text-violet-600' : 'border-border bg-muted/50 text-muted-foreground hover:border-violet-400/50'}`}>
                                        <CalendarRange className="w-3 h-3 shrink-0" /> KREDIT
                                    </button>
                                </div>
                                <button onClick={() => { setPaymentMethod('BAYAR_NANTI'); setDownPayment(''); setDpBayarNanti(''); setDpMethodBayarNanti('CASH'); setDpBankBayarNanti(''); }}
                                    className={`w-full py-2 rounded-xl text-xs font-bold transition-all border-2 flex items-center justify-center gap-1.5 ${paymentMethod === 'BAYAR_NANTI' ? 'border-sky-500 bg-sky-500/10 text-sky-600' : 'border-border bg-muted/50 text-muted-foreground hover:border-sky-400/50'}`}>
                                    <Clock className="w-3 h-3 shrink-0" /> BAYAR NANTI (Simpan Invoice)
                                </button>

                                {/* Panel DP saat Bayar Nanti */}
                                {paymentMethod === 'BAYAR_NANTI' && (
                                    <div className="bg-sky-500/5 border border-sky-500/20 rounded-xl p-3 space-y-2.5">
                                        <p className="text-[11px] font-semibold text-sky-700 uppercase tracking-wider">Uang Muka / DP (Opsional)</p>
                                        <input
                                            type="number"
                                            placeholder="Nominal DP — kosongkan jika belum ada pembayaran"
                                            value={dpBayarNanti}
                                            onChange={e => setDpBayarNanti(e.target.value)}
                                            min="0"
                                            className="w-full px-3 py-2 bg-background border border-sky-300/60 rounded-lg outline-none text-sm focus:border-sky-500 transition-colors"
                                        />
                                        {dpBayarNanti !== '' && Number(dpBayarNanti) > 0 && (
                                            <>
                                                <div className="grid grid-cols-3 gap-1.5">
                                                    {(['CASH', 'QRIS', 'BANK_TRANSFER'] as const).map(m => (
                                                        <button key={m} type="button"
                                                            onClick={() => { setDpMethodBayarNanti(m); if (m !== 'BANK_TRANSFER') setDpBankBayarNanti(''); }}
                                                            className={`py-1.5 rounded-lg text-[11px] font-bold border-2 transition-all ${dpMethodBayarNanti === m ? 'border-sky-500 bg-sky-500/15 text-sky-700' : 'border-border bg-background text-muted-foreground hover:border-sky-400/50'}`}>
                                                            {m === 'BANK_TRANSFER' ? 'TRANSFER' : m}
                                                        </button>
                                                    ))}
                                                </div>
                                                {dpMethodBayarNanti === 'BANK_TRANSFER' && (
                                                    <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                                                        {!bankAccounts?.length
                                                            ? <p className="text-xs text-muted-foreground text-center py-2 bg-muted/20 border border-dashed border-border rounded-lg">Belum ada rekening bank.</p>
                                                            : bankAccounts.map((bank: any) => (
                                                                <label key={bank.id} className={`flex items-center gap-2 px-3 py-1.5 border rounded-xl cursor-pointer transition-all ${dpBankBayarNanti === String(bank.id) ? 'border-sky-500 bg-sky-500/5 ring-1 ring-sky-500/20' : 'border-border bg-background hover:bg-muted/30'}`}>
                                                                    <input type="radio" name="dpBankBayarNanti" value={bank.id} checked={dpBankBayarNanti === String(bank.id)} onChange={e => setDpBankBayarNanti(e.target.value)} className="text-sky-500 h-3.5 w-3.5" />
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="font-bold text-[11px] uppercase">{bank.bankName}</p>
                                                                        <span className="font-mono text-sky-600 text-xs font-bold">{bank.accountNumber}</span>
                                                                    </div>
                                                                </label>
                                                            ))
                                                        }
                                                    </div>
                                                )}
                                                <div className="px-2.5 py-1.5 bg-sky-500/10 border border-sky-500/20 rounded-lg text-[11px] text-sky-700 font-semibold">
                                                    DP Rp {Number(dpBayarNanti).toLocaleString('id-ID')} — sisa tagihan: Rp {(grandTotal - Number(dpBayarNanti)).toLocaleString('id-ID')}
                                                </div>
                                            </>
                                        )}
                                        {(dpBayarNanti === '' || Number(dpBayarNanti) === 0) && (
                                            <p className="text-[11px] text-sky-600/70">Invoice tersimpan dengan status <strong>Belum Bayar</strong>. Bisa dilunasi via menu Piutang.</p>
                                        )}
                                    </div>
                                )}

                                {paymentMethod === 'QRIS' && (
                                    <div className="bg-muted/30 border border-border rounded-xl p-3 text-center">
                                        {settings?.qrisImageUrl
                                            ? <img src={`${API_BASE}${settings.qrisImageUrl}`} alt="QRIS" className="w-32 h-32 object-contain rounded-lg border bg-white p-1 mx-auto shadow-sm" />
                                            : <div className="h-16 bg-muted flex items-center justify-center rounded-lg border border-dashed text-muted-foreground text-xs">QRIS belum diupload</div>
                                        }
                                    </div>
                                )}

                                {paymentMethod === 'KREDIT' && (
                                    <div className="bg-violet-500/5 border border-violet-500/20 rounded-xl p-3 space-y-2">
                                        <p className="text-[11px] font-semibold text-violet-600 uppercase tracking-wider">Jatuh Tempo Pembayaran</p>
                                        <div className="grid grid-cols-3 gap-1.5">
                                            {[
                                                { label: 'Akhir Minggu', value: dayjs().endOf('week').format('YYYY-MM-DD') },
                                                { label: 'Akhir Bulan', value: dayjs().endOf('month').format('YYYY-MM-DD') },
                                                { label: '2 Bulan', value: dayjs().add(2, 'month').format('YYYY-MM-DD') },
                                                { label: '6 Bulan', value: dayjs().add(6, 'month').format('YYYY-MM-DD') },
                                                { label: '1 Tahun', value: dayjs().add(1, 'year').format('YYYY-MM-DD') },
                                            ].map(opt => (
                                                <button key={opt.label} type="button" onClick={() => setDueDate(opt.value)}
                                                    className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold border transition-all ${dueDate === opt.value ? 'border-violet-500 bg-violet-500/15 text-violet-700' : 'border-border bg-background text-muted-foreground hover:border-violet-400/50'}`}>
                                                    {opt.label}
                                                </button>
                                            ))}
                                            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                                                min={dayjs().add(1, 'day').format('YYYY-MM-DD')}
                                                className="py-1.5 px-2 rounded-lg text-[11px] border border-border bg-background outline-none focus:border-violet-400 transition-colors" />
                                        </div>
                                        {dueDate && (
                                            <p className="text-[11px] text-violet-600 font-medium">
                                                Jatuh tempo: {dayjs(dueDate).format('DD/MM/YYYY')}
                                            </p>
                                        )}
                                    </div>
                                )}

                                {paymentMethod === 'BANK_TRANSFER' && (
                                    <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                                        {!bankAccounts?.length
                                            ? <p className="text-xs text-muted-foreground text-center py-2 bg-muted/20 border border-dashed border-border rounded-lg">Belum ada rekening bank.</p>
                                            : bankAccounts.map((bank: any) => (
                                                <label key={bank.id} className={`flex items-center gap-2.5 px-3 py-2 border rounded-xl cursor-pointer transition-all ${selectedBankId === String(bank.id) ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border bg-background hover:bg-muted/30'}`}>
                                                    <input type="radio" name="bankSelection" value={bank.id} checked={selectedBankId === String(bank.id)} onChange={(e) => setSelectedBankId(e.target.value)} className="text-primary h-3.5 w-3.5" />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-bold text-[11px] uppercase">{bank.bankName}</p>
                                                        <div className="flex items-center justify-between">
                                                            <span className="font-mono text-primary text-xs font-bold">{bank.accountNumber}</span>
                                                            <span className="text-[10px] text-muted-foreground">a.n {bank.accountOwner}</span>
                                                        </div>
                                                    </div>
                                                </label>
                                            ))
                                        }
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Backdate section — hanya untuk manager */}
                        {isManager && (
                            <div className="px-4 pb-2">
                                <div className={`rounded-xl border p-2.5 space-y-2 transition-colors ${transactionDate ? 'border-amber-400/60 bg-amber-500/5' : 'border-border bg-muted/20'}`}>
                                    <div className="flex items-center gap-2">
                                        <CalendarClock className={`w-4 h-4 shrink-0 ${transactionDate ? 'text-amber-500' : 'text-muted-foreground'}`} />
                                        <span className="text-xs font-semibold text-foreground">Tanggal Nota (Nota Terlambat)</span>
                                        {transactionDate && (
                                            <span className="ml-auto text-[10px] font-bold text-amber-600 bg-amber-500/15 px-2 py-0.5 rounded-full">BACKDATE</span>
                                        )}
                                    </div>
                                    <input
                                        type="date"
                                        value={transactionDate}
                                        max={todayStr}
                                        onChange={e => { setTransactionDate(e.target.value); if (!e.target.value) setCashflowToday(false); }}
                                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-400/50"
                                    />
                                    {transactionDate && (
                                        <label className="flex items-center gap-2 cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                checked={cashflowToday}
                                                onChange={e => setCashflowToday(e.target.checked)}
                                                className="w-4 h-4 accent-primary rounded"
                                            />
                                            <span className="text-xs text-muted-foreground">
                                                Masukkan pendapatan ke <span className="font-semibold text-primary">shift hari ini</span> (cashflow hari ini)
                                            </span>
                                        </label>
                                    )}
                                    {transactionDate && (
                                        <p className="text-[11px] text-amber-600 leading-relaxed">
                                            ⚠️ Transaksi akan tercatat pada <strong>{new Date(transactionDate + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</strong>.
                                            {cashflowToday ? ' Pendapatan masuk shift hari ini.' : ' Pendapatan masuk ke tanggal tersebut.'}
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Action bar */}
                        <div className="p-4 border-t border-border bg-muted/20 space-y-2.5 shrink-0">
                            {/* Invoice actions row */}
                            <div className="grid grid-cols-2 gap-2">
                                <button onClick={handlePrintTagihan}
                                    className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-border bg-background hover:bg-muted font-semibold text-xs transition-colors">
                                    <Printer className="w-3.5 h-3.5 text-muted-foreground" />
                                    Cetak Invoice Tagihan
                                </button>
                                <button onClick={handleShareTagihan}
                                    className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-[#25D366]/40 bg-[#25D366]/5 hover:bg-[#25D366]/10 font-semibold text-xs text-[#25D366] transition-colors">
                                    <MessageCircle className="w-3.5 h-3.5" />
                                    Kirim WA Tagihan
                                </button>
                            </div>
                            {/* Main action row */}
                            <div className="grid grid-cols-3 gap-2">
                                <button onClick={() => { setCheckoutModalOpen(false); setShowPayConfirm(false); }}
                                    className="py-3 font-bold rounded-xl border border-border bg-background hover:bg-muted transition-colors text-sm">
                                    Batal
                                </button>
                                <button onClick={() => setShowPayConfirm(true)}
                                    disabled={transactionMutation.isPending || (paymentMethod === 'KREDIT' && !dueDate)}
                                    className={`col-span-2 py-3 font-bold rounded-xl shadow-md flex items-center justify-center gap-2 disabled:opacity-50 text-sm transition-colors ${
                                        paymentMethod === 'KREDIT' ? 'bg-violet-600 hover:bg-violet-700 text-white'
                                        : paymentMethod === 'BAYAR_NANTI' ? 'bg-sky-600 hover:bg-sky-700 text-white'
                                        : 'bg-primary hover:bg-primary/90 text-primary-foreground'
                                    }`}>
                                    {paymentMethod === 'BAYAR_NANTI' ? <Clock className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                                    {paymentMethod === 'KREDIT'
                                        ? (dueDate ? 'Simpan Nota Kredit' : 'Pilih Jatuh Tempo')
                                        : paymentMethod === 'BAYAR_NANTI' ? 'Simpan Invoice (Bayar Nanti)'
                                        : downPayment !== '' && Number(downPayment) < grandTotal ? 'Konfirmasi Pembayaran DP' : 'Konfirmasi Lunas'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== RECEIPT MODAL (after successful payment) ===== */}
            {receipt && (
                <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
                    <div className="glass bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
                        {/* Success header */}
                        {(() => {
                            const isNantiNoDP = receipt.paymentMethod === 'BAYAR_NANTI' && (!receipt.downPayment || receipt.downPayment === 0);
                            const isDP = receipt.downPayment !== undefined && receipt.downPayment > 0 && receipt.downPayment < receipt.grandTotal;
                            return (
                        <div className={`p-6 border-b text-center space-y-2 ${isNantiNoDP ? 'bg-sky-500/10 border-sky-500/20' : isDP ? 'bg-amber-500/10 border-amber-500/20' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
                            <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto ${isNantiNoDP ? 'bg-sky-500' : isDP ? 'bg-amber-500' : 'bg-emerald-500'}`}>
                                {isNantiNoDP ? <Clock className="w-8 h-8 text-white" /> : <CheckCircle2 className="w-8 h-8 text-white" />}
                            </div>
                            <h2 className={`text-xl font-bold ${isNantiNoDP ? 'text-sky-600' : isDP ? 'text-amber-600' : 'text-emerald-600'}`}>
                                {isNantiNoDP ? 'Invoice Disimpan!' : isDP ? (receipt.paymentMethod === 'BAYAR_NANTI' ? 'Invoice + DP Tersimpan!' : 'Pembayaran DP Berhasil!') : 'Pembayaran Berhasil!'}
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                {receipt.timestamp.toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })}
                            </p>
                        </div>
                            );
                        })()}

                        {/* Receipt preview */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-3">
                            <div className="text-center border-b border-dashed border-border pb-3 mb-1">
                                <p className="font-bold text-base">{receipt.storeName}</p>
                                {receipt.transactionId && <p className="text-xs text-muted-foreground">TRX-{String(receipt.transactionId).padStart(5, '0')}</p>}
                            </div>

                            {/* Item list */}
                            <div className="space-y-2">
                                {receipt.items.map((item, i) => (
                                    <div key={i} className="flex gap-2">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{item.name}</p>
                                            {item.pricingMode === 'AREA_BASED'
                                                ? <p className="text-xs text-muted-foreground">{item.unitType === 'menit' ? `${item.widthCm} unit` : `${item.widthCm}×${item.heightCm} ${item.unitType || 'm'} = ${item.areaM2?.toFixed(4)} ${item.unitType === 'm' || item.unitType === 'cm' ? 'm²' : 'unit'}`}{item.note ? ` • ${item.note}` : ''}</p>
                                                : <p className="text-xs text-muted-foreground">×{item.qty} @ Rp {item.price.toLocaleString('id-ID')}{item.price !== item.pricePerUnit ? <span className="ml-1 text-orange-500 font-semibold">tier</span> : null}</p>
                                            }
                                        </div>
                                        <p className="text-sm font-semibold shrink-0">Rp {(item.price * item.qty).toLocaleString('id-ID')}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Totals */}
                            <div className="border-t border-dashed border-border pt-3 space-y-1.5">
                                <div className="flex justify-between text-sm text-muted-foreground">
                                    <span>Subtotal</span><span>Rp {receipt.subtotal.toLocaleString('id-ID')}</span>
                                </div>
                                <div className="flex justify-between text-sm text-muted-foreground">
                                    <span>Pajak (10%)</span><span>Rp {receipt.taxAmount.toLocaleString('id-ID')}</span>
                                </div>
                                <div className="flex justify-between font-bold text-base pt-1 border-t border-border">
                                    <span>TOTAL</span><span className="text-primary">Rp {receipt.grandTotal.toLocaleString('id-ID')}</span>
                                </div>
                            </div>

                            {/* Payment method badge */}
                            <div className="flex items-center justify-center gap-2 pt-1">
                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${receipt.paymentMethod === 'CASH' ? 'bg-emerald-500/10 text-emerald-600' :
                                    receipt.paymentMethod === 'QRIS' ? 'bg-blue-500/10 text-blue-600' :
                                        'bg-purple-500/10 text-purple-600'
                                    }`}>
                                    {receipt.paymentMethod === 'BANK_TRANSFER' ? 'TRANSFER BANK' : receipt.paymentMethod}
                                </span>
                                <span className={`text-xs font-bold ${receipt.paymentMethod === 'BAYAR_NANTI' && (!receipt.downPayment || receipt.downPayment === 0) ? 'text-sky-600' : receipt.downPayment !== undefined && receipt.downPayment < receipt.grandTotal ? 'text-amber-600' : 'text-emerald-600'}`}>
                                    {receipt.paymentMethod === 'BAYAR_NANTI' && (!receipt.downPayment || receipt.downPayment === 0)
                                        ? '⏳ BELUM DIBAYAR'
                                        : receipt.downPayment !== undefined && receipt.downPayment < receipt.grandTotal
                                            ? '✓ DP / BELUM LUNAS'
                                            : '✓ LUNAS'}
                                </span>
                            </div>

                            {/* Outstanding balance if DP or Bayar Nanti */}
                            {receipt.paymentMethod === 'BAYAR_NANTI' && receipt.downPayment && receipt.downPayment > 0 ? (
                                // BAYAR_NANTI + ada DP awal
                                <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg space-y-2">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-muted-foreground">DP Diterima:</span>
                                        <span className="font-bold text-emerald-600">Rp {receipt.downPayment.toLocaleString('id-ID')}</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-muted-foreground">Sisa Tagihan:</span>
                                        <span className="font-bold text-amber-600">Rp {(receipt.grandTotal - receipt.downPayment).toLocaleString('id-ID')}</span>
                                    </div>
                                </div>
                            ) : receipt.paymentMethod === 'BAYAR_NANTI' ? (
                                // BAYAR_NANTI tanpa DP
                                <div className="mt-4 p-3 bg-sky-500/10 border border-sky-500/20 rounded-lg text-center space-y-1">
                                    <p className="text-xs text-muted-foreground">Total Tagihan (Belum Dibayar):</p>
                                    <p className="font-bold text-sky-600 text-lg">Rp {receipt.grandTotal.toLocaleString('id-ID')}</p>
                                </div>
                            ) : receipt.downPayment !== undefined && receipt.downPayment < receipt.grandTotal ? (
                                <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-center space-y-1">
                                    <p className="text-xs text-muted-foreground">Sisa Tagihan (Belum Dibayar):</p>
                                    <p className="font-bold text-amber-600 text-lg">Rp {(receipt.grandTotal - receipt.downPayment).toLocaleString('id-ID')}</p>
                                </div>
                            ) : null}
                        </div>

                        {/* Action buttons */}
                        <div className="p-4 border-t border-border bg-muted/30 space-y-3">
                            {/* Print + WA row */}
                            <div className="grid grid-cols-2 gap-3">
                                <button onClick={() => handlePrintSnap(receipt, (receipt.downPayment ?? receipt.grandTotal) < receipt.grandTotal ? 'TAGIHAN' : 'LUNAS', bankAccounts)}
                                    className="flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-border bg-background hover:bg-muted hover:border-primary/30 font-semibold text-sm transition-all">
                                    <Printer className="w-4 h-4 text-muted-foreground" />
                                    Cetak Struk
                                </button>
                                <button onClick={() => handleShareWA(receipt, (receipt.downPayment ?? receipt.grandTotal) < receipt.grandTotal ? 'TAGIHAN' : 'LUNAS', bankAccounts)}
                                    className="flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-[#25D366]/40 bg-[#25D366]/5 hover:bg-[#25D366]/10 font-semibold text-sm text-[#25D366] transition-all">
                                    <MessageCircle className="w-4 h-4" />
                                    Share ke WA
                                </button>
                            </div>
                            <button onClick={() => setReceipt(null)}
                                className="w-full py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl transition-colors text-sm">
                                Selesai / Transaksi Baru
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Customer Search Sub-Modal */}
            {isCustomerModalOpen && (
                <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-background rounded-3xl shadow-xl border border-border w-full max-w-md p-6 relative animate-in zoom-in-95 duration-200">
                        <button
                            onClick={() => { setCustomerModalOpen(false); setCustomerSearchQuery(''); }}
                            className="absolute top-4 right-4 p-2 text-muted-foreground hover:bg-muted rounded-full transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <h2 className="text-xl font-bold mb-4">Cari Pelanggan</h2>

                        <div className="flex items-center px-4 py-2 mb-4 bg-muted/50 border border-border rounded-xl focus-within:ring-2 ring-primary/20 transition-all">
                            <Search className="w-5 h-5 text-muted-foreground mr-3" />
                            <input
                                type="text"
                                placeholder="Ketik nama atau no HP..."
                                value={customerSearchQuery}
                                onChange={(e) => setCustomerSearchQuery(e.target.value)}
                                className="w-full bg-transparent border-none outline-none text-sm"
                                autoFocus
                            />
                        </div>

                        <div className="max-h-[300px] overflow-y-auto pr-2 space-y-2">
                            {customers?.filter((c: any) =>
                                c.name.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
                                (c.phone && c.phone.includes(customerSearchQuery))
                            ).length === 0 ? (
                                <p className="text-center text-sm text-muted-foreground py-4">Pencarian tidak ditemukan.</p>
                            ) : (
                                customers?.filter((c: any) =>
                                    c.name.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
                                    (c.phone && c.phone.includes(customerSearchQuery))
                                ).map((customer: any) => (
                                    <div key={customer.id} className="flex flex-col p-3 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer"
                                        onClick={() => {
                                            setCustomerName(customer.name);
                                            setCustomerPhone(customer.phone || '');
                                            setCustomerAddress(customer.address || '');
                                            setCustomerModalOpen(false);
                                            setCustomerSearchQuery('');
                                        }}>
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="font-semibold text-sm">{customer.name}</span>
                                            <button className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded-md font-medium">Pilih</button>
                                        </div>
                                        <span className="text-xs text-muted-foreground">{customer.phone || '-'}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function POSPage() {
    return (
        <Suspense fallback={null}>
            <POSPageContent />
        </Suspense>
    );
}
