'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ArrowLeft, Plus, Trash2, Building2 } from 'lucide-react';
import Link from 'next/link';
import axios from '@/lib/api/client';
import { createBranchWorkOrder } from '@/lib/api/branch-work-orders';

interface Branch {
    id: number;
    name: string;
    phone: string | null;
}

interface ProductVariant {
    id: number;
    name: string;
    sku: string | null;
    product: { id: number; name: string; pricingMode: string };
}

interface CartItem {
    productVariantId: number;
    variantLabel: string;
    pricingMode: string;
    quantity: number;
    widthCm: string;
    heightCm: string;
    unitType: string;
    pcs: string;
    note: string;
}

function buildVariantLabel(v: ProductVariant) {
    return `${v.product.name} — ${v.name}${v.sku ? ` (${v.sku})` : ''}`;
}

export default function BranchOrderNewPage() {
    const router = useRouter();

    const [branchId, setBranchId] = useState('');
    const [referenceNumber, setReferenceNumber] = useState('');
    const [receivedBy, setReceivedBy] = useState('');
    const [notes, setNotes] = useState('');
    const [items, setItems] = useState<CartItem[]>([]);
    const [error, setError] = useState('');

    // Fetch branches
    const { data: branches = [] } = useQuery<Branch[]>({
        queryKey: ['company-branches-active'],
        queryFn: () => axios.get<Branch[]>('/company-branches/active').then(r => r.data),
    });

    // Fetch all products + variants
    const { data: allProducts = [] } = useQuery<any[]>({
        queryKey: ['products-all'],
        queryFn: () => axios.get<any[]>('/products').then(r => r.data),
    });

    const allVariants: ProductVariant[] = allProducts.flatMap((p: any) =>
        (p.variants ?? []).map((v: any) => ({
            id: v.id,
            name: v.name,
            sku: v.sku,
            product: { id: p.id, name: p.name, pricingMode: p.pricingMode },
        }))
    );

    function addItem() {
        if (allVariants.length === 0) return;
        const first = allVariants[0];
        setItems(prev => [
            ...prev,
            {
                productVariantId: first.id,
                variantLabel: buildVariantLabel(first),
                pricingMode: first.product.pricingMode,
                quantity: 1,
                widthCm: '',
                heightCm: '',
                unitType: 'm2',
                pcs: '',
                note: '',
            },
        ]);
    }

    function updateItem(idx: number, field: keyof CartItem, value: any) {
        setItems(prev => {
            const next = [...prev];
            if (field === 'productVariantId') {
                const v = allVariants.find(x => x.id === Number(value));
                if (v) {
                    next[idx] = {
                        ...next[idx],
                        productVariantId: v.id,
                        variantLabel: buildVariantLabel(v),
                        pricingMode: v.product.pricingMode,
                    };
                }
            } else {
                (next[idx] as any)[field] = value;
            }
            return next;
        });
    }

    function removeItem(idx: number) {
        setItems(prev => prev.filter((_, i) => i !== idx));
    }

    const createMut = useMutation({
        mutationFn: createBranchWorkOrder,
        onSuccess: (wo) => {
            router.push(`/branch-orders/${wo.id}`);
        },
        onError: (e: any) => setError(e?.response?.data?.message || 'Gagal menyimpan'),
    });

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!branchId) { setError('Pilih cabang terlebih dahulu'); return; }
        if (items.length === 0) { setError('Minimal 1 item'); return; }
        setError('');
        createMut.mutate({
            branchId: Number(branchId),
            referenceNumber: referenceNumber.trim() || undefined,
            receivedBy: receivedBy.trim() || undefined,
            notes: notes.trim() || undefined,
            items: items.map(it => ({
                productVariantId: it.productVariantId,
                quantity: Number(it.quantity),
                widthCm: it.pricingMode === 'AREA_BASED' && it.widthCm ? Number(it.widthCm) : null,
                heightCm: it.pricingMode === 'AREA_BASED' && it.heightCm ? Number(it.heightCm) : null,
                unitType: it.pricingMode === 'AREA_BASED' ? it.unitType || 'm2' : null,
                pcs: it.pricingMode === 'AREA_BASED' && it.pcs ? Number(it.pcs) : null,
                note: it.note.trim() || null,
            })),
        });
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center gap-2">
                <Link href="/branch-orders" className="text-gray-400 hover:text-gray-600">
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <h1 className="text-xl font-bold text-gray-800">Input Order Cabang Baru</h1>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
                {/* Header */}
                <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
                    <h2 className="font-semibold text-gray-700 flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-blue-500" />
                        Informasi Order
                    </h2>

                    {error && (
                        <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
                    )}

                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Cabang *</label>
                        <select
                            value={branchId}
                            onChange={e => setBranchId(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        >
                            <option value="">-- Pilih Cabang --</option>
                            {branches.map(b => (
                                <option key={b.id} value={b.id}>{b.name}{b.phone ? ` (${b.phone})` : ''}</option>
                            ))}
                        </select>
                        {branches.length === 0 && (
                            <p className="text-xs text-amber-600 mt-1">
                                Belum ada cabang aktif.{' '}
                                <a href="/settings/branches" target="_blank" className="underline">Kelola cabang</a>
                            </p>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">No. Referensi / Nota</label>
                            <input
                                value={referenceNumber}
                                onChange={e => setReferenceNumber(e.target.value)}
                                placeholder="cth: NOTA-001"
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Diterima oleh</label>
                            <input
                                value={receivedBy}
                                onChange={e => setReceivedBy(e.target.value)}
                                placeholder="Nama kasir / staf"
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Catatan</label>
                        <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            rows={2}
                            placeholder="Instruksi khusus, permintaan finishing, dll..."
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
                        />
                    </div>
                </div>

                {/* Items */}
                <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <h2 className="font-semibold text-gray-700">Items Pesanan</h2>
                        <button
                            type="button"
                            onClick={addItem}
                            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                        >
                            <Plus className="w-4 h-4" /> Tambah Item
                        </button>
                    </div>

                    {items.length === 0 && (
                        <p className="text-gray-400 text-sm text-center py-4">
                            Belum ada item. Klik "Tambah Item".
                        </p>
                    )}

                    {items.map((item, idx) => (
                        <div key={idx} className="border border-gray-100 rounded-lg p-3 space-y-2 bg-gray-50">
                            <div className="flex items-start gap-2">
                                <div className="flex-1">
                                    <label className="block text-xs text-gray-500 mb-1">Produk / Varian *</label>
                                    <select
                                        value={item.productVariantId}
                                        onChange={e => updateItem(idx, 'productVariantId', e.target.value)}
                                        className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                                    >
                                        {allVariants.map(v => (
                                            <option key={v.id} value={v.id}>{buildVariantLabel(v)}</option>
                                        ))}
                                    </select>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => removeItem(idx)}
                                    className="mt-5 p-1 text-red-400 hover:text-red-600"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Qty *</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={item.quantity}
                                        onChange={e => updateItem(idx, 'quantity', e.target.value)}
                                        className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                                    />
                                </div>
                                {item.pricingMode === 'AREA_BASED' && (
                                    <>
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">Lebar (cm)</label>
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.1"
                                                value={item.widthCm}
                                                onChange={e => updateItem(idx, 'widthCm', e.target.value)}
                                                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                                                placeholder="cm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">Tinggi (cm)</label>
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.1"
                                                value={item.heightCm}
                                                onChange={e => updateItem(idx, 'heightCm', e.target.value)}
                                                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                                                placeholder="cm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">Satuan</label>
                                            <select
                                                value={item.unitType}
                                                onChange={e => updateItem(idx, 'unitType', e.target.value)}
                                                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                                            >
                                                <option value="m2">m²</option>
                                                <option value="cm2">cm²</option>
                                            </select>
                                        </div>
                                    </>
                                )}
                            </div>

                            {item.pricingMode === 'AREA_BASED' && (
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Jumlah Lembar (pcs)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={item.pcs}
                                        onChange={e => updateItem(idx, 'pcs', e.target.value)}
                                        className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                                        placeholder="Opsional"
                                    />
                                </div>
                            )}

                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Catatan Item</label>
                                <input
                                    value={item.note}
                                    onChange={e => updateItem(idx, 'note', e.target.value)}
                                    placeholder="warna, finishing, bahan, dll..."
                                    className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                                />
                            </div>
                        </div>
                    ))}
                </div>

                {/* Submit */}
                <div className="flex gap-3">
                    <button
                        type="submit"
                        disabled={createMut.isPending}
                        className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50"
                    >
                        {createMut.isPending ? 'Menyimpan...' : 'Simpan Work Order'}
                    </button>
                    <Link
                        href="/branch-orders"
                        className="px-5 py-2.5 border border-gray-300 rounded-xl text-gray-600 text-center hover:bg-gray-50"
                    >
                        Batal
                    </Link>
                </div>
            </form>
        </div>
    );
}
