"use client";

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { editTransaction, submitEditRequest } from '@/lib/api/transactions';
import { X, Save, Send, AlertTriangle } from 'lucide-react';

type EditItem = {
    id: number;
    productName: string;
    variantName: string | null;
    quantity: number;
    priceAtTime: number;
    widthCm: number | null;
    heightCm: number | null;
    areaCm2: number | null;
    unitType: string;
};

type Props = {
    transaction: any;
    isManager: boolean;
    onClose: () => void;
    onSuccess: (updated?: any) => void;
};

export default function EditTransactionModal({ transaction, isManager, onClose, onSuccess }: Props) {
    const queryClient = useQueryClient();

    const [editItems, setEditItems] = useState<EditItem[]>(() =>
        (transaction.items || []).map((item: any) => ({
            id: item.id,
            productName: item.productVariant?.product?.name || '',
            variantName: item.productVariant?.variantName || null,
            quantity: item.quantity,
            priceAtTime: Number(item.priceAtTime),
            widthCm: item.widthCm !== null ? Number(item.widthCm) : null,
            heightCm: item.heightCm !== null ? Number(item.heightCm) : null,
            areaCm2: item.areaCm2 !== null ? Number(item.areaCm2) : null,
            unitType: 'm',
        }))
    );

    const [discount, setDiscount] = useState<number>(Number(transaction.discount) || 0);
    const [customerName, setCustomerName] = useState<string>(transaction.customerName || '');
    const [customerPhone, setCustomerPhone] = useState<string>(transaction.customerPhone || '');
    const [customerAddress, setCustomerAddress] = useState<string>(transaction.customerAddress || '');
    const [reason, setReason] = useState('');

    const buildPayload = () => ({
        items: editItems.map((item) => ({
            id: item.id,
            ...(item.widthCm !== null
                ? { widthCm: item.widthCm, heightCm: item.heightCm ?? 1, unitType: item.unitType }
                : { quantity: item.quantity }),
        })),
        discount,
        customerName: customerName || undefined,
        customerPhone: customerPhone || undefined,
        customerAddress: customerAddress || undefined,
    });

    const directEditMutation = useMutation({
        mutationFn: () => editTransaction(transaction.id, buildPayload()),
        onSuccess: (updated) => {
            queryClient.invalidateQueries({ queryKey: ['transactions'] });
            queryClient.invalidateQueries({ queryKey: ['salesSummary'] });
            onSuccess(updated);
        },
    });

    const requestEditMutation = useMutation({
        mutationFn: () => submitEditRequest(transaction.id, { ...buildPayload(), reason }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['transaction-edit-requests'] });
            onSuccess();
        },
    });

    const isSubmitting = directEditMutation.isPending || requestEditMutation.isPending;
    const error = directEditMutation.error || requestEditMutation.error;

    const handleSubmit = () => {
        if (!isManager && !reason.trim()) {
            alert('Harap isi alasan permintaan edit');
            return;
        }
        if (isManager) {
            directEditMutation.mutate();
        } else {
            requestEditMutation.mutate();
        }
    };

    const updateItem = (idx: number, field: keyof EditItem, value: any) => {
        setEditItems((prev) => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
    };

    const formatCurrency = (val: number) => `Rp ${val.toLocaleString('id-ID')}`;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60" onClick={onClose} />
            <div className="relative bg-background border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-border">
                    <div>
                        <h2 className="text-base font-semibold text-foreground">
                            {isManager ? 'Edit Transaksi' : 'Ajukan Perubahan Transaksi'}
                        </h2>
                        <p className="text-xs text-muted-foreground mt-0.5">{transaction.invoiceNumber}</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                    {/* Items */}
                    <div>
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Item Pesanan</h3>
                        <div className="space-y-3">
                            {editItems.map((item, idx) => (
                                <div key={item.id} className="p-3 bg-muted/40 rounded-xl border border-border">
                                    <div className="flex items-start justify-between gap-3 mb-2">
                                        <div>
                                            <p className="text-sm font-medium text-foreground">
                                                {item.productName}{item.variantName ? ` — ${item.variantName}` : ''}
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                {formatCurrency(item.priceAtTime)}
                                                {item.widthCm !== null ? ' / m²' : ' / pcs'}
                                            </p>
                                        </div>
                                    </div>

                                    {item.widthCm !== null ? (
                                        // AREA_BASED item
                                        <div className="grid grid-cols-3 gap-2">
                                            <div>
                                                <label className="text-[10px] text-muted-foreground font-medium uppercase">Lebar</label>
                                                <input
                                                    type="number"
                                                    min="0.01"
                                                    step="0.01"
                                                    value={item.widthCm ?? ''}
                                                    onChange={(e) => updateItem(idx, 'widthCm', parseFloat(e.target.value) || 0)}
                                                    className="mt-1 w-full px-2 py-1.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-muted-foreground font-medium uppercase">Tinggi</label>
                                                <input
                                                    type="number"
                                                    min="0.01"
                                                    step="0.01"
                                                    value={item.heightCm ?? ''}
                                                    onChange={(e) => updateItem(idx, 'heightCm', parseFloat(e.target.value) || 0)}
                                                    className="mt-1 w-full px-2 py-1.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-muted-foreground font-medium uppercase">Satuan</label>
                                                <select
                                                    value={item.unitType}
                                                    onChange={(e) => updateItem(idx, 'unitType', e.target.value)}
                                                    className="mt-1 w-full px-2 py-1.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                                                >
                                                    <option value="m">m</option>
                                                    <option value="cm">cm</option>
                                                    <option value="menit">menit</option>
                                                </select>
                                            </div>
                                        </div>
                                    ) : (
                                        // UNIT mode item
                                        <div className="flex items-center gap-3">
                                            <label className="text-xs text-muted-foreground shrink-0">Jumlah:</label>
                                            <input
                                                type="number"
                                                min="1"
                                                value={item.quantity}
                                                onChange={(e) => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                                                className="w-24 px-2 py-1.5 bg-background border border-border rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30"
                                            />
                                            <span className="text-xs text-muted-foreground">
                                                = {formatCurrency(item.quantity * item.priceAtTime)}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Discount */}
                    <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Diskon (Rp)</label>
                        <input
                            type="number"
                            min="0"
                            value={discount}
                            onChange={(e) => setDiscount(parseInt(e.target.value) || 0)}
                            className="mt-1.5 w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                    </div>

                    {/* Customer Info */}
                    <div>
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Info Pelanggan</h3>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-muted-foreground">Nama</label>
                                <input
                                    type="text"
                                    value={customerName}
                                    onChange={(e) => setCustomerName(e.target.value)}
                                    className="mt-1 w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-muted-foreground">No. HP</label>
                                <input
                                    type="text"
                                    value={customerPhone}
                                    onChange={(e) => setCustomerPhone(e.target.value)}
                                    className="mt-1 w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                                />
                            </div>
                        </div>
                        <div className="mt-3">
                            <label className="text-xs text-muted-foreground">Alamat</label>
                            <textarea
                                value={customerAddress}
                                onChange={(e) => setCustomerAddress(e.target.value)}
                                rows={2}
                                className="mt-1 w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                            />
                        </div>
                    </div>

                    {/* Reason (required for non-managers) */}
                    {!isManager && (
                        <div>
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Alasan Permintaan <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                rows={2}
                                placeholder="Contoh: Salah input jumlah orderan, seharusnya 3 bukan 5"
                                className="mt-1.5 w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                            />
                        </div>
                    )}

                    {/* Reason optional for managers */}
                    {isManager && (
                        <div>
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Catatan Edit (opsional)
                            </label>
                            <textarea
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                rows={2}
                                placeholder="Alasan atau catatan perubahan..."
                                className="mt-1.5 w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                            />
                        </div>
                    )}

                    {/* Warning */}
                    {!isManager && (
                        <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-700">
                            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                            <span>Perubahan akan dikirim ke Admin/Owner untuk disetujui terlebih dahulu sebelum diterapkan.</span>
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-600">
                            {(error as any)?.response?.data?.message || 'Terjadi kesalahan. Coba lagi.'}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-border bg-muted/30 flex justify-between items-center">
                    <button onClick={onClose} className="px-4 py-2 bg-background border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors">
                        Batal
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                        {isManager ? <Save className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                        {isSubmitting ? 'Memproses...' : isManager ? 'Simpan Perubahan' : 'Ajukan Perubahan'}
                    </button>
                </div>
            </div>
        </div>
    );
}
