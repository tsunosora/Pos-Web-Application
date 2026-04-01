"use client";

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSalesSummary, getTransactions, getSettings, getBankAccounts } from '@/lib/api';
import { updateTransactionPaymentMethod } from '@/lib/api/transactions';
import { mapTransactionToReceipt, handlePrintSnap, handleShareWA } from '@/lib/receipt';
import { exportToExcel, exportToPDF } from '@/lib/export';
import { Download, BarChart, CreditCard, Banknote, Landmark, X, Receipt, Printer, MessageCircle, FileSpreadsheet, Pencil, Check, CalendarDays, PenSquare } from "lucide-react";
import dayjs from "dayjs";
import { useCurrentUser } from '@/hooks/useCurrentUser';
import EditTransactionModal from './EditTransactionModal';

type SalesPeriodKey = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'last_month' | 'this_year' | 'all' | 'custom';

const SALES_PERIODS: { key: SalesPeriodKey; label: string }[] = [
    { key: 'today', label: 'Hari Ini' },
    { key: 'yesterday', label: 'Kemarin' },
    { key: 'this_week', label: 'Minggu Ini' },
    { key: 'this_month', label: 'Bulan Ini' },
    { key: 'last_month', label: 'Bulan Lalu' },
    { key: 'this_year', label: 'Tahun Ini' },
    { key: 'all', label: 'Semua' },
    { key: 'custom', label: 'Kustom' },
];

function getSalesPeriodDates(period: SalesPeriodKey, customStart: string, customEnd: string): { startDate?: string; endDate?: string } {
    const now = dayjs();
    switch (period) {
        case 'today': return { startDate: now.format('YYYY-MM-DD'), endDate: now.format('YYYY-MM-DD') };
        case 'yesterday': { const y = now.subtract(1, 'day'); return { startDate: y.format('YYYY-MM-DD'), endDate: y.format('YYYY-MM-DD') }; }
        case 'this_week': return { startDate: now.startOf('week').format('YYYY-MM-DD'), endDate: now.endOf('week').format('YYYY-MM-DD') };
        case 'this_month': return { startDate: now.startOf('month').format('YYYY-MM-DD'), endDate: now.endOf('month').format('YYYY-MM-DD') };
        case 'last_month': { const lm = now.subtract(1, 'month'); return { startDate: lm.startOf('month').format('YYYY-MM-DD'), endDate: lm.endOf('month').format('YYYY-MM-DD') }; }
        case 'this_year': return { startDate: now.startOf('year').format('YYYY-MM-DD'), endDate: now.endOf('year').format('YYYY-MM-DD') };
        case 'custom': return { startDate: customStart || undefined, endDate: customEnd || undefined };
        default: return {};
    }
}

export default function SalesReportPage() {
    const queryClient = useQueryClient();

    const [period, setPeriod] = useState<SalesPeriodKey>('this_month');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');

    const { startDate, endDate } = getSalesPeriodDates(period, customStart, customEnd);

    const { data: summary, isLoading: isLoadingSummary } = useQuery({
        queryKey: ['salesSummary', startDate, endDate],
        queryFn: () => getSalesSummary(startDate, endDate),
    });
    const { data: transactions, isLoading: isLoadingTxs } = useQuery({
        queryKey: ['transactions', startDate, endDate],
        queryFn: () => getTransactions(startDate, endDate),
    });
    const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: getSettings });
    const { data: bankAccounts } = useQuery({ queryKey: ['bank-accounts'], queryFn: getBankAccounts });

    const { isManager } = useCurrentUser();
    const [selectedTransaction, setSelectedTransaction] = useState<any | null>(null);
    const [editPayment, setEditPayment] = useState<{ method: string; bankId: string } | null>(null);
    const [showEditModal, setShowEditModal] = useState(false);

    const updatePaymentMutation = useMutation({
        mutationFn: ({ id, method, bankId }: { id: number; method: string; bankId: string }) =>
            updateTransactionPaymentMethod(id, { paymentMethod: method, bankAccountId: bankId ? Number(bankId) : undefined }),
        onSuccess: (updated) => {
            queryClient.invalidateQueries({ queryKey: ['transactions', startDate, endDate] });
            queryClient.invalidateQueries({ queryKey: ['salesSummary', startDate, endDate] });
            setSelectedTransaction((prev: any) => prev ? { ...prev, paymentMethod: updated.paymentMethod, bankAccountId: updated.bankAccountId } : null);
            setEditPayment(null);
        }
    });

    const recentTransactions = transactions || [];

    const handleExportExcel = () => {
        if (!transactions?.length) return alert('Tidak ada transaksi untuk di-export');
        const data = transactions.map((t: any) => ({
            'No Invoice': t.invoiceNumber,
            'Tanggal': dayjs(t.createdAt).format('DD MMM YYYY HH:mm'),
            'Kasir': t.cashierName || '-',
            'Subtotal': Number(t.totalAmount),
            'Diskon': Number(t.discount),
            'Pajak': Number(t.tax),
            'Total Bersih': Number(t.grandTotal),
            'Metode Pembayaran': t.paymentMethod,
            'Status': t.status
        }));
        exportToExcel(data, `Laporan_Transaksi_${dayjs().format('YYYYMMDD')}.xlsx`);
    };

    const handleExportPDF = () => {
        if (!transactions?.length) return alert('Tidak ada transaksi untuk di-export');
        const headers = ['Invoice', 'Tanggal', 'Kasir', 'Metode', 'Status', 'Total'];
        const body = transactions.map((t: any) => [
            t.invoiceNumber,
            dayjs(t.createdAt).format('DD MMM YYYY HH:mm'),
            t.cashierName || '-',
            t.paymentMethod,
            t.status,
            `Rp ${Number(t.grandTotal).toLocaleString('id-ID')}`
        ]);
        exportToPDF('Laporan Seluruh Transaksi', headers, body, `Laporan_Transaksi_${dayjs().format('YYYYMMDD')}.pdf`);
    };

    if (isLoadingSummary || isLoadingTxs) {
        return <div className="flex h-screen items-center justify-center text-muted-foreground">Memuat Laporan Kelola Penjualan...</div>;
    }

    const periodLabel = SALES_PERIODS.find(p => p.key === period)?.label ?? '';

    return (
        <div className="space-y-6">
            <div className="sm:flex sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Laporan Penjualan</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Ringkasan transaksi riil — <span className="font-medium text-primary">{periodLabel}</span>
                        {period === 'custom' && startDate && endDate ? ` (${dayjs(startDate).format('D MMM')} – ${dayjs(endDate).format('D MMM YYYY')})` : ''}
                    </p>
                </div>
                <div className="mt-4 sm:mt-0 flex flex-wrap gap-3">
                    <button onClick={handleExportExcel} className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 text-green-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-500/20 transition-colors shadow-sm">
                        <FileSpreadsheet className="h-4 w-4" />
                        Export Excel
                    </button>
                    <button onClick={handleExportPDF} className="flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/20 transition-colors shadow-sm">
                        <Download className="h-4 w-4" />
                        Export PDF
                    </button>
                </div>
            </div>

            {/* Period filter */}
            <div className="glass rounded-xl border border-border p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <CalendarDays className="h-4 w-4" />
                    Filter Periode
                </div>
                <div className="flex flex-wrap gap-2">
                    {SALES_PERIODS.map(p => (
                        <button
                            key={p.key}
                            onClick={() => setPeriod(p.key)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                period === p.key
                                    ? 'bg-primary text-primary-foreground shadow-sm'
                                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                            }`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
                {period === 'custom' && (
                    <div className="flex flex-wrap items-center gap-3 pt-1">
                        <div className="flex items-center gap-2">
                            <label className="text-sm text-muted-foreground whitespace-nowrap">Dari</label>
                            <input
                                type="date"
                                value={customStart}
                                onChange={e => setCustomStart(e.target.value)}
                                className="border border-border rounded-lg px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-sm text-muted-foreground whitespace-nowrap">Sampai</label>
                            <input
                                type="date"
                                value={customEnd}
                                onChange={e => setCustomEnd(e.target.value)}
                                min={customStart}
                                className="border border-border rounded-lg px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                            />
                        </div>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass p-6 rounded-xl border border-border flex flex-col justify-center">
                    <p className="text-sm font-medium text-muted-foreground mb-1">Total Pendapatan</p>
                    <div className="flex items-baseline gap-2">
                        <h2 className="text-3xl font-bold text-foreground">Rp {Number(summary?.totalRevenue || 0).toLocaleString('id-ID')}</h2>
                    </div>
                </div>
                <div className="glass p-6 rounded-xl border border-border flex flex-col justify-center">
                    <p className="text-sm font-medium text-muted-foreground mb-1">Volume Transaksi</p>
                    <h2 className="text-3xl font-bold text-foreground">{summary?.totalTransactions || 0}<span className="text-lg text-muted-foreground font-normal ml-1">struk</span></h2>
                </div>
                <div className="glass p-6 rounded-xl border border-border flex flex-col justify-center">
                    <p className="text-sm font-medium text-muted-foreground mb-1">Rata-rata Order (Basket Size)</p>
                    <h2 className="text-3xl font-bold text-foreground">Rp {Math.round(summary?.averageTransactionValue || 0).toLocaleString('id-ID')}<span className="text-lg text-muted-foreground font-normal ml-1">/trx</span></h2>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Produk Terlaris */}
                <div className="glass rounded-xl border border-border p-6 flex flex-col">
                    <div className="flex items-center gap-3 mb-4">
                        <BarChart className="h-5 w-5 text-primary" />
                        <h3 className="text-lg font-semibold text-foreground">Top 5 Produk Terlaris</h3>
                    </div>
                    <div className="space-y-4 flex-1">
                        {summary?.topSellingItems?.map((item: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between border-b border-border/50 pb-3 last:border-0 last:pb-0">
                                <div>
                                    <p className="font-semibold text-foreground text-sm">{item.name}</p>
                                    <p className="text-xs text-muted-foreground">{item.sku}</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-primary">{item.qty} pcs</p>
                                    <p className="text-xs text-muted-foreground">Rp {Number(item.revenue).toLocaleString('id-ID')}</p>
                                </div>
                            </div>
                        ))}
                        {(!summary?.topSellingItems || summary.topSellingItems.length === 0) && (
                            <p className="text-sm text-muted-foreground text-center py-4">Belum ada data penjualan.</p>
                        )}
                    </div>
                </div>

                {/* Metode Pembayaran */}
                <div className="glass rounded-xl border border-border p-6 flex flex-col">
                    <h3 className="text-lg font-semibold text-foreground mb-4">Metode Pembayaran (Distribusi)</h3>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border/50">
                            <div className="flex items-center gap-3">
                                <Banknote className="h-5 w-5 text-green-500 shrink-0" />
                                <div>
                                    <span className="font-medium block text-sm">Cash / Tunai</span>
                                    <span className="text-xs text-muted-foreground">{summary?.paymentMethods?.CASH || 0} trx</span>
                                </div>
                            </div>
                            <span className="font-bold text-base text-green-600">Rp {Number(summary?.paymentMethodsRevenue?.CASH || 0).toLocaleString('id-ID')}</span>
                        </div>
                        <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border/50">
                            <div className="flex items-center gap-3">
                                <CreditCard className="h-5 w-5 text-blue-500 shrink-0" />
                                <div>
                                    <span className="font-medium block text-sm">QRIS</span>
                                    <span className="text-xs text-muted-foreground">{summary?.paymentMethods?.QRIS || 0} trx</span>
                                </div>
                            </div>
                            <span className="font-bold text-base text-blue-600">Rp {Number(summary?.paymentMethodsRevenue?.QRIS || 0).toLocaleString('id-ID')}</span>
                        </div>
                        <div className="p-4 bg-muted/30 rounded-lg border border-border/50 space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Landmark className="h-5 w-5 text-orange-500 shrink-0" />
                                    <div>
                                        <span className="font-medium block text-sm">Transfer Bank</span>
                                        <span className="text-xs text-muted-foreground">{summary?.paymentMethods?.BANK_TRANSFER || 0} trx</span>
                                    </div>
                                </div>
                                <span className="font-bold text-base text-orange-600">Rp {Number(summary?.paymentMethodsRevenue?.BANK_TRANSFER || 0).toLocaleString('id-ID')}</span>
                            </div>
                            {summary?.bankTransfersRevenue && Object.keys(summary.bankTransfersRevenue).length > 0 && (
                                <div className="pt-3 border-t border-border/50 space-y-2">
                                    {Object.entries(summary.bankTransfersRevenue).map(([bankName, amount]: any) => (
                                        <div key={bankName} className="flex justify-between items-center text-sm pl-8">
                                            <span className="text-muted-foreground uppercase text-xs font-semibold">{bankName}</span>
                                            <span className="font-bold text-foreground text-xs">Rp {Number(amount).toLocaleString('id-ID')}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="glass rounded-xl border border-border overflow-hidden pb-10">
                <div className="px-6 py-4 border-b border-border bg-card/50 flex items-center justify-between">
                    <h3 className="text-base font-semibold text-foreground">
                        Histori Transaksi — {periodLabel}
                    </h3>
                    <span className="text-sm text-muted-foreground">{recentTransactions.length} transaksi</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-border">
                        <thead className="bg-muted/50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Invoice</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Waktu</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Metode</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Total</th>
                            </tr>
                        </thead>
                        <tbody className="bg-card divide-y divide-border">
                            {recentTransactions.map((trx: any) => (
                                <tr key={trx.id} onClick={() => setSelectedTransaction(trx)} className="hover:bg-muted/30 transition-colors cursor-pointer">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-primary">
                                        <div className="flex items-center gap-2">
                                            {trx.status === 'PARTIAL' && <span className="bg-orange-500/10 text-orange-600 border border-orange-500/20 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">DP</span>}
                                            {trx.invoiceNumber}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground/80">{dayjs(trx.createdAt).format('DD MMM YYYY HH:mm')}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                                            {trx.paymentMethod}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-foreground text-right">
                                        Rp {Number(trx.grandTotal).toLocaleString('id-ID')}
                                    </td>
                                </tr>
                            ))}
                            {recentTransactions.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-8 text-center text-sm text-muted-foreground">Belum ada transaksi tercatat.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Transaction Detail Modal */}
            {selectedTransaction && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-card w-full max-w-md rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-muted/30">
                            <div className="flex items-center gap-2">
                                <Receipt className="w-5 h-5 text-primary" />
                                <h3 className="font-semibold text-foreground">Detail Transaksi</h3>
                            </div>
                            <button onClick={() => { setSelectedTransaction(null); setEditPayment(null); }} className="p-1.5 text-muted-foreground hover:bg-muted rounded-lg transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-6">
                            {/* Header Info */}
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="text-muted-foreground text-xs mb-1">No. Invoice</p>
                                    <p className="font-medium text-foreground">{selectedTransaction.invoiceNumber}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground text-xs mb-1">Tanggal</p>
                                    <p className="font-medium text-foreground">{dayjs(selectedTransaction.createdAt).format('DD MMM YYYY, HH:mm')}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground text-xs mb-1">Kasir</p>
                                    <p className="font-medium text-foreground">{selectedTransaction.cashierName || '-'}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground text-xs mb-1">Status Pembayaran</p>
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${selectedTransaction.status === 'PAID' ? 'bg-green-500/10 text-green-600 border border-green-500/20' :
                                        selectedTransaction.status === 'PARTIAL' ? 'bg-orange-500/10 text-orange-600 border border-orange-500/20' :
                                            'bg-muted text-muted-foreground'
                                        }`}>
                                        {selectedTransaction.status === 'PARTIAL' ? 'DP / SEBAGIAN' : selectedTransaction.status === 'PAID' ? 'LUNAS' : selectedTransaction.status}
                                    </span>
                                </div>
                                <div className="col-span-2">
                                    <p className="text-muted-foreground text-xs mb-1">Metode Pembayaran</p>
                                    {editPayment ? (
                                        <div className="space-y-2">
                                            <div className="flex gap-1.5">
                                                {(['CASH', 'QRIS', 'BANK_TRANSFER'] as const).map(m => (
                                                    <button key={m} onClick={() => setEditPayment(p => p ? { ...p, method: m, bankId: m !== 'BANK_TRANSFER' ? '' : p.bankId } : null)}
                                                        className={`px-2.5 py-1 rounded-lg text-xs font-bold border-2 transition-all ${editPayment.method === m ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-muted/50 text-muted-foreground'}`}>
                                                        {m === 'BANK_TRANSFER' ? 'TRANSFER' : m}
                                                    </button>
                                                ))}
                                            </div>
                                            {editPayment.method === 'BANK_TRANSFER' && (
                                                <select value={editPayment.bankId} onChange={e => setEditPayment(p => p ? { ...p, bankId: e.target.value } : null)}
                                                    className="w-full text-xs border border-border rounded-lg px-2 py-1.5 bg-background">
                                                    <option value="">Pilih rekening bank...</option>
                                                    {bankAccounts?.map((b: any) => (
                                                        <option key={b.id} value={b.id}>{b.bankName} – {b.accountNumber} ({b.accountOwner})</option>
                                                    ))}
                                                </select>
                                            )}
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => {
                                                        if (editPayment.method === 'BANK_TRANSFER' && !editPayment.bankId) {
                                                            alert('Pilih rekening bank tujuan!');
                                                            return;
                                                        }
                                                        updatePaymentMutation.mutate({ id: selectedTransaction.id, method: editPayment.method, bankId: editPayment.bankId });
                                                    }}
                                                    disabled={updatePaymentMutation.isPending}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 disabled:opacity-50">
                                                    <Check className="w-3.5 h-3.5" /> Simpan
                                                </button>
                                                <button onClick={() => setEditPayment(null)} className="px-3 py-1.5 bg-muted border border-border rounded-lg text-xs font-medium hover:bg-muted/80">
                                                    Batal
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                                                {selectedTransaction.paymentMethod}
                                            </span>
                                            <button
                                                onClick={() => setEditPayment({ method: selectedTransaction.paymentMethod, bankId: selectedTransaction.bankAccountId ? String(selectedTransaction.bankAccountId) : '' })}
                                                className="p-1 text-muted-foreground hover:text-primary transition-colors rounded"
                                                title="Edit metode pembayaran">
                                                <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Items List */}
                            <div>
                                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 border-b border-border pb-1">Pesanan</h4>
                                <div className="space-y-3">
                                    {selectedTransaction.items?.map((item: any) => (
                                        <div key={item.id} className="flex justify-between text-sm">
                                            <div>
                                                <p className="font-medium text-foreground">{item.productVariant?.product?.name} {item.productVariant?.variantName && ` - ${item.productVariant.variantName}`}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {item.quantity} x Rp {Number(item.priceAtTime).toLocaleString('id-ID')}
                                                </p>
                                            </div>
                                            <p className="font-medium text-foreground text-right w-24">
                                                Rp {(item.quantity * Number(item.priceAtTime)).toLocaleString('id-ID')}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Summary Totals */}
                            <div className="border-t border-border pt-4 space-y-2 text-sm">
                                <div className="flex justify-between text-muted-foreground">
                                    <span>Subtotal</span>
                                    <span>Rp {Number(selectedTransaction.totalAmount).toLocaleString('id-ID')}</span>
                                </div>
                                {Number(selectedTransaction.discount) > 0 && (
                                    <div className="flex justify-between text-emerald-600">
                                        <span>Diskon</span>
                                        <span>- Rp {Number(selectedTransaction.discount).toLocaleString('id-ID')}</span>
                                    </div>
                                )}
                                {Number(selectedTransaction.tax) > 0 && (
                                    <div className="flex justify-between text-muted-foreground">
                                        <span>Pajak</span>
                                        <span>Rp {Number(selectedTransaction.tax).toLocaleString('id-ID')}</span>
                                    </div>
                                )}
                                <div className="flex justify-between font-bold text-foreground pt-2 border-t border-border/50">
                                    <span>Total Bayar</span>
                                    <span>Rp {Number(selectedTransaction.grandTotal).toLocaleString('id-ID')}</span>
                                </div>

                                {/* DP Details if partial */}
                                {selectedTransaction.status === 'PARTIAL' && (
                                    <div className="mt-3 p-3 bg-orange-500/5 rounded-lg border border-orange-500/20 space-y-1">
                                        <div className="flex justify-between font-medium text-orange-700 text-xs">
                                            <span>Uang Muka (DP)</span>
                                            <span>Rp {Number(selectedTransaction.downPayment).toLocaleString('id-ID')}</span>
                                        </div>
                                        <div className="flex justify-between font-bold text-red-600 text-sm pt-1 border-t border-orange-500/20">
                                            <span>Sisa Tagihan</span>
                                            <span>Rp {(Number(selectedTransaction.grandTotal) - Number(selectedTransaction.downPayment)).toLocaleString('id-ID')}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="p-4 border-t border-border bg-muted/30 flex justify-between items-center">
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handlePrintSnap(mapTransactionToReceipt(selectedTransaction, settings), selectedTransaction.status === 'PARTIAL' ? 'TAGIHAN' : 'LUNAS', bankAccounts)}
                                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors outline-none"
                                >
                                    <Printer className="w-4 h-4" /> Cetak Struk
                                </button>
                                <button
                                    onClick={() => handleShareWA(mapTransactionToReceipt(selectedTransaction, settings), selectedTransaction.status === 'PARTIAL' ? 'TAGIHAN' : 'LUNAS', bankAccounts)}
                                    className="flex items-center gap-2 px-4 py-2 bg-[#25D366] text-white rounded-lg text-sm font-medium hover:bg-[#20bd5a] transition-colors outline-none"
                                >
                                    <MessageCircle className="w-4 h-4" /> WA
                                </button>
                                {(selectedTransaction.status === 'PAID' || selectedTransaction.status === 'PARTIAL') && (
                                    <button
                                        onClick={() => setShowEditModal(true)}
                                        className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/20 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-500/20 transition-colors outline-none"
                                    >
                                        <PenSquare className="w-4 h-4" />
                                        {isManager ? 'Edit' : 'Ajukan Edit'}
                                    </button>
                                )}
                            </div>
                            <button onClick={() => { setSelectedTransaction(null); setEditPayment(null); }} className="px-4 py-2 bg-background border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors">
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Transaction Modal */}
            {showEditModal && selectedTransaction && (
                <EditTransactionModal
                    transaction={selectedTransaction}
                    isManager={isManager}
                    onClose={() => setShowEditModal(false)}
                    onSuccess={(updated) => {
                        setShowEditModal(false);
                        if (updated) {
                            setSelectedTransaction(updated);
                            queryClient.invalidateQueries({ queryKey: ['transactions', startDate, endDate] });
                            queryClient.invalidateQueries({ queryKey: ['salesSummary', startDate, endDate] });
                        }
                    }}
                />
            )}
        </div>
    );
}
