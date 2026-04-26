"use client";

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getProfitReport } from '@/lib/api';
import { exportToExcel, exportToPDF } from '@/lib/export';
import { Calendar, Download, TrendingUp, BarChart, DollarSign, ArrowUpRight, ArrowDownRight, Package, FileSpreadsheet, Loader2 } from "lucide-react";
import { PageHeader } from '@/components/ui/page-header';
import { ResponsiveTable, EmptyState } from '@/components/ui/responsive-table';
import { useBranchStore } from '@/store/branch-store';

export default function ProfitReportPage() {
    const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
    const activeBranchId = useBranchStore((s) => s.activeBranchId);

    const { data: profitData, isLoading } = useQuery({
        queryKey: ['profitReport', activeBranchId, dateRange],
        queryFn: () => getProfitReport(dateRange.startDate, dateRange.endDate),
    });

    if (isLoading) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
            </div>
        );
    }

    const marginColor = (profitData?.profitMargin || 0) >= 0 ? 'text-emerald-500' : 'text-rose-500';
    const profitColor = (profitData?.grossProfit || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600';

    const handleExportExcel = () => {
        if (!profitData?.items?.length) return alert('Tidak ada data untuk di-export');
        const data = profitData.items.map((item: any) => ({
            'SKU': item.sku,
            'Nama Produk': item.name,
            'Qty / Luas Terjual': item.isAreaBased
                ? `${Number(item.totalAreaM2).toFixed(2)} m² (${item.qty} pesanan)`
                : item.qty,
            'Unit': item.isAreaBased ? 'm²' : item.unit,
            'Pendapatan': Number(item.revenue),
            'Total HPP': Number(item.totalHpp),
            'Laba Kotor': Number(item.grossProfit),
            'Margin (%)': item.revenue > 0 ? Number(((item.grossProfit / item.revenue) * 100).toFixed(2)) : 0
        }));
        exportToExcel(data, `Laporan_Laba_Kotor_${dateRange.startDate || 'Semua'}_sd_${dateRange.endDate || 'Semua'}.xlsx`);
    };

    const handleExportPDF = () => {
        if (!profitData?.items?.length) return alert('Tidak ada data untuk di-export');
        const headers = ['SKU', 'Nama Produk', 'Qty', 'Pendapatan', 'Total HPP', 'Laba Kotor', 'Margin'];
        const body = profitData.items.map((item: any) => {
            const margin = item.revenue > 0 ? ((item.grossProfit / item.revenue) * 100).toFixed(1) + '%' : '0%';
            const qtyDisplay = item.isAreaBased
                ? `${Number(item.totalAreaM2).toFixed(2)} m² (${item.qty} psx)`
                : `${item.qty} ${item.unit}`;
            return [
                item.sku,
                item.name,
                qtyDisplay,
                `Rp ${Number(item.revenue).toLocaleString('id-ID')}`,
                `Rp ${Number(item.totalHpp).toLocaleString('id-ID')}`,
                `Rp ${Number(item.grossProfit).toLocaleString('id-ID')}`,
                margin
            ];
        });

        let title = 'Laporan Laba Kotor';
        if (dateRange.startDate && dateRange.endDate) {
            title += ` (${dateRange.startDate} - ${dateRange.endDate})`;
        }

        exportToPDF(title, headers, body, `Laporan_Laba_Kotor.pdf`);
    };

    return (
        <div className="animate-in fade-in duration-300">
            <PageHeader
                title="Laporan Laba Kotor"
                description="Analisis Pendapatan dikurangi Harga Pokok Penjualan (HPP)"
                icon={TrendingUp}
                breadcrumbs={[{ label: 'Laporan' }, { label: 'Laba Kotor' }]}
                actions={
                    <>
                        <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-1.5">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <input
                                type="date"
                                value={dateRange.startDate}
                                onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                                className="bg-transparent text-sm outline-none text-foreground"
                            />
                            <span className="text-muted-foreground">-</span>
                            <input
                                type="date"
                                value={dateRange.endDate}
                                onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                                className="bg-transparent text-sm outline-none text-foreground"
                            />
                        </div>
                        <button onClick={handleExportExcel} className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-3 py-2 rounded-lg text-sm font-medium hover:bg-emerald-500/20 transition-colors">
                            <FileSpreadsheet className="h-4 w-4" />
                            Excel
                        </button>
                        <button onClick={handleExportPDF} className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary px-3 py-2 rounded-lg text-sm font-medium hover:bg-primary/20 transition-colors">
                            <Download className="h-4 w-4" />
                            PDF
                        </button>
                    </>
                }
            />

            <div className="space-y-6">

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-card p-5 rounded-xl border border-border shadow-sm flex flex-col justify-center">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-muted-foreground">Total Pendapatan Bersih</p>
                        <div className="p-2 bg-blue-500/10 rounded-lg"><DollarSign className="w-4 h-4 text-blue-500" /></div>
                    </div>
                    <h2 className="text-2xl font-bold text-foreground">Rp {Number(profitData?.totalRevenue || 0).toLocaleString('id-ID')}</h2>
                    <p className="text-xs text-muted-foreground mt-2">Setelah diskon, sebelum pajak</p>
                </div>

                <div className="bg-card p-5 rounded-xl border border-border shadow-sm flex flex-col justify-center">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-muted-foreground">Total HPP</p>
                        <div className="p-2 bg-orange-500/10 rounded-lg"><Package className="w-4 h-4 text-orange-500" /></div>
                    </div>
                    <h2 className="text-2xl font-bold text-foreground">Rp {Number(profitData?.totalHpp || 0).toLocaleString('id-ID')}</h2>
                    <p className="text-xs text-muted-foreground mt-2">Modal barang yang terjual</p>
                </div>

                <div className="bg-card p-5 rounded-xl border border-border shadow-sm flex flex-col justify-center lg:col-span-2 bg-gradient-to-br from-card to-muted/30">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-muted-foreground">Laba Kotor (Gross Profit)</p>
                        <div className="p-2 bg-emerald-500/10 rounded-lg"><TrendingUp className="w-4 h-4 text-emerald-500" /></div>
                    </div>
                    <div className="flex items-end justify-between">
                        <h2 className={`text-3xl font-bold ${profitColor}`}>Rp {Number(profitData?.grossProfit || 0).toLocaleString('id-ID')}</h2>
                        <div className={`flex items-center gap-1 font-bold text-lg ${marginColor} bg-background/50 px-3 py-1 rounded-lg border border-border/50`}>
                            {profitData?.profitMargin >= 0 ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                            {Number(profitData?.profitMargin || 0).toFixed(1)}%
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                <div className="p-5 border-b border-border bg-muted/20 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <BarChart className="h-5 w-5 text-primary" />
                        <h3 className="font-semibold text-foreground">Analisis Profitabilitas per Produk</h3>
                    </div>
                </div>
                <div className="p-0 overflow-x-auto">
                    <table className="min-w-full divide-y divide-border">
                        <thead className="bg-muted/50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">SKU / Produk</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Qty Terjual</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pendapatan</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total HPP</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Laba Kotor</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Margin</th>
                            </tr>
                        </thead>
                        <tbody className="bg-card divide-y divide-border">
                            {profitData?.items?.length > 0 ? (
                                profitData.items.map((item: any, idx: number) => {
                                    const margin = item.revenue > 0 ? (item.grossProfit / item.revenue) * 100 : 0;
                                    const isLoss = item.grossProfit < 0;
                                    return (
                                        <tr key={idx} className="hover:bg-muted/30 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="font-medium text-foreground text-sm">{item.name}</div>
                                                <div className="text-xs text-muted-foreground mt-0.5">{item.sku}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">
                                                {item.isAreaBased ? (
                                                    <div>
                                                        <span className="font-bold text-foreground">
                                                            {Number(item.totalAreaM2).toLocaleString('id-ID', { maximumFractionDigits: 2 })} m²
                                                        </span>
                                                        <div className="text-xs text-muted-foreground mt-0.5">
                                                            {item.qty} pesanan
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span>{item.qty} {item.unit}</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-foreground">
                                                Rp {Number(item.revenue).toLocaleString('id-ID')}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-muted-foreground">
                                                Rp {Number(item.totalHpp).toLocaleString('id-ID')}
                                            </td>
                                            <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-bold ${isLoss ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                Rp {Number(item.grossProfit).toLocaleString('id-ID')}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${isLoss ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20' :
                                                    margin > 40 ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' :
                                                        margin > 20 ? 'bg-blue-500/10 text-blue-600 border border-blue-500/20' :
                                                            'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                                                    }`}>
                                                    {margin.toFixed(1)}%
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={6} className="px-6 py-2">
                                        <EmptyState
                                            icon={BarChart}
                                            title="Belum ada data"
                                            description="Belum ada penjualan pada periode ini. Coba pilih rentang tanggal yang lain."
                                        />
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            </div>
        </div>
    );
}
