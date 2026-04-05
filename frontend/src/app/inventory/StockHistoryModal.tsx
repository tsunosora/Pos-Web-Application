"use client";

import { useQuery } from '@tanstack/react-query';
import { X, TrendingUp, TrendingDown, RefreshCw, ArrowUpCircle, ArrowDownCircle, MinusCircle } from 'lucide-react';
import { getVariantStockHistory } from '@/lib/api';

interface Props {
    variant: { id: number; sku: string; variantName?: string };
    productName: string;
    onClose: () => void;
}

const TYPE_CONFIG = {
    IN:     { label: 'Masuk',     icon: ArrowUpCircle,   color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/30', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300', sign: '+' },
    OUT:    { label: 'Keluar',    icon: ArrowDownCircle, color: 'text-rose-500',     bg: 'bg-rose-50 dark:bg-rose-950/30',       badge: 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300',         sign: '-' },
    ADJUST: { label: 'Koreksi',  icon: RefreshCw,        color: 'text-blue-500',    bg: 'bg-blue-50 dark:bg-blue-950/30',       badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',         sign: '~' },
};

function reasonLabel(reason: string | null): string {
    if (!reason) return 'Tidak ada keterangan';
    if (reason.startsWith('Penjualan')) return reason;
    if (reason.startsWith('Terpotong')) return reason;
    if (reason.startsWith('Stok Opname')) return reason;
    if (reason.startsWith('Penyesuaian Manual')) return 'Penyesuaian Manual';
    if (reason.startsWith('Hapus Transaksi')) return reason;
    if (reason.startsWith('Hapus Item Edit')) return reason;
    if (reason.startsWith('Tambah Item Edit')) return reason;
    if (reason.startsWith('Koreksi Edit')) return reason;
    if (reason.startsWith('Produksi Job')) return reason;
    if (reason.startsWith('Gabung Cetak')) return reason;
    if (reason.startsWith('Pemasangan Job')) return reason;
    if (reason.startsWith('Susut:')) return reason;
    return reason;
}

function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function StockHistoryModal({ variant, productName, onClose }: Props) {
    const { data, isLoading } = useQuery({
        queryKey: ['stock-history', variant.id],
        queryFn: () => getVariantStockHistory(variant.id),
    });

    const movements: any[] = data?.movements ?? [];
    const title = variant.variantName ? `${productName} — ${variant.variantName}` : productName;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-card rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[85vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
                    <div>
                        <h2 className="text-base font-semibold text-foreground">Riwayat Stok</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">{title} · SKU: {variant.sku}</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                        <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                </div>

                {/* List */}
                <div className="overflow-y-auto flex-1 px-4 py-3 space-y-2">
                    {isLoading ? (
                        <div className="py-12 text-center text-sm text-muted-foreground">Memuat riwayat...</div>
                    ) : movements.length === 0 ? (
                        <div className="py-12 text-center text-sm text-muted-foreground">Belum ada pergerakan stok</div>
                    ) : movements.map((m: any) => {
                        const cfg = TYPE_CONFIG[m.type as keyof typeof TYPE_CONFIG] ?? TYPE_CONFIG.ADJUST;
                        const Icon = cfg.icon;
                        const qty = m.quantity / 100;
                        const qtyDisplay = Number.isInteger(qty) ? qty : qty.toFixed(2);
                        return (
                            <div key={m.id} className={`flex items-start gap-3 rounded-lg px-3 py-2.5 ${cfg.bg}`}>
                                {/* Icon */}
                                <div className="mt-0.5 shrink-0">
                                    <Icon className={`h-5 w-5 ${cfg.color}`} />
                                </div>
                                {/* Middle */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${cfg.badge}`}>{cfg.label}</span>
                                        {m.referenceId && m.referenceId !== 'manual-adjust' && (
                                            <span className="text-[10px] text-muted-foreground font-mono">{m.referenceId}</span>
                                        )}
                                    </div>
                                    <p className="text-xs text-foreground/80 mt-0.5 leading-snug">{reasonLabel(m.reason)}</p>
                                    <p className="text-[10px] text-muted-foreground mt-1">{m.createdAt ? formatDate(m.createdAt) : '—'}</p>
                                </div>
                                {/* Qty */}
                                <div className="shrink-0 text-right">
                                    <span className={`text-sm font-bold ${m.type === 'IN' ? 'text-emerald-600 dark:text-emerald-400' : m.type === 'OUT' ? 'text-rose-600 dark:text-rose-400' : 'text-blue-600 dark:text-blue-400'}`}>
                                        {cfg.sign}{qtyDisplay}
                                    </span>
                                    {m.balanceAfter != null && (
                                        <p className="text-[10px] text-muted-foreground mt-0.5">Sisa: {Number.isInteger(m.balanceAfter) ? m.balanceAfter : Number(m.balanceAfter).toFixed(2)}</p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Footer */}
                {data?.total > 0 && (
                    <div className="px-5 py-3 border-t border-border shrink-0">
                        <p className="text-xs text-muted-foreground text-center">{data.total} catatan · menampilkan {movements.length} terbaru</p>
                    </div>
                )}
            </div>
        </div>
    );
}
