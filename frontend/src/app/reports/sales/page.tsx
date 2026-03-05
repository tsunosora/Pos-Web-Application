"use client";

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSalesSummary, getTransactions, getSettings, getBankAccounts } from '@/lib/api';
import { mapTransactionToReceipt, handlePrintSnap, handleShareWA } from '@/lib/receipt';
import { Calendar, Download, TrendingUp, BarChart, CreditCard, Banknote, Landmark, X, Receipt, Printer, MessageCircle } from "lucide-react";
import dayjs from "dayjs";

export default function SalesReportPage() {
    const { data: summary, isLoading: isLoadingSummary } = useQuery({ queryKey: ['salesSummary'], queryFn: () => getSalesSummary() });
    const { data: transactions, isLoading: isLoadingTxs } = useQuery({ queryKey: ['transactions'], queryFn: getTransactions });
    const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: getSettings });
    const { data: bankAccounts } = useQuery({ queryKey: ['bank-accounts'], queryFn: getBankAccounts });

    const [selectedTransaction, setSelectedTransaction] = useState<any | null>(null);

    const recentTransactions = transactions?.slice(0, 10) || []; // Show last 10

    if (isLoadingSummary || isLoadingTxs) {
        return <div className="flex h-screen items-center justify-center text-muted-foreground">Memuat Laporan Kelola Penjualan...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="sm:flex sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Laporan Penjualan</h1>
                    <p className="mt-1 text-sm text-muted-foreground">Ringkasan transaksi riil (Semua Waktu).</p>
                </div>
                <div className="mt-4 sm:mt-0 flex gap-3">
                    <button className="flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/20 transition-colors shadow-sm">
                        <Download className="h-4 w-4" />
                        Export CSV
                    </button>
                </div>
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
                <div className="px-6 py-4 border-b border-border bg-card/50">
                    <h3 className="text-base font-semibold text-foreground">Transaksi Terbaru</h3>
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
                            <button onClick={() => setSelectedTransaction(null)} className="p-1.5 text-muted-foreground hover:bg-muted rounded-lg transition-colors">
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
                            </div>
                            <button onClick={() => setSelectedTransaction(null)} className="px-4 py-2 bg-background border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors">
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
