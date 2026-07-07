"use client";

import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getProfitReport } from '@/lib/api';
import { exportToExcel, exportToPDF } from '@/lib/export';
import { Calendar, Download, TrendingUp, BarChart, DollarSign, ArrowUpRight, ArrowDownRight, Package, FileSpreadsheet, Loader2, Factory, ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from '@/components/ui/page-header';
import { ResponsiveTable, EmptyState } from '@/components/ui/responsive-table';
import { useBranchStore } from '@/store/branch-store';

export default function ProfitReportPage() {
    const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
    // Filter "mesin" = kategori produk. '' = semua mesin.
    const [machineFilter, setMachineFilter] = useState<string>('');
    // Slider kartu kategori: scroll horizontal via tombol panah.
    const catScrollRef = useRef<HTMLDivElement>(null);
    const scrollCats = (dir: number) => {
        const el = catScrollRef.current;
        if (!el) return;
        el.scrollBy({ left: dir * Math.max(260, el.clientWidth * 0.8), behavior: 'smooth' });
    };
    const activeBranchId = useBranchStore((s) => s.activeBranchId);

    const { data: profitData, isLoading } = useQuery({
        queryKey: ['profitReport', activeBranchId, dateRange],
        queryFn: () => getProfitReport(dateRange.startDate, dateRange.endDate),
    });

    // Preset tanggal cepat. Format lokal YYYY-MM-DD (hindari geser zona waktu).
    const fmt = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };
    const applyPreset = (preset: 'today' | 'yesterday' | 'last7' | 'thisMonth' | 'thisYear' | 'all') => {
        const now = new Date();
        if (preset === 'all') { setDateRange({ startDate: '', endDate: '' }); return; }
        let start = new Date(now);
        let end = new Date(now);
        if (preset === 'yesterday') { start.setDate(now.getDate() - 1); end = new Date(start); }
        else if (preset === 'last7') { start.setDate(now.getDate() - 6); }
        else if (preset === 'thisMonth') { start = new Date(now.getFullYear(), now.getMonth(), 1); }
        else if (preset === 'thisYear') { start = new Date(now.getFullYear(), 0, 1); }
        setDateRange({ startDate: fmt(start), endDate: fmt(end) });
    };
    // Cek preset mana yang sedang aktif (untuk highlight tombol).
    const activePreset = (() => {
        const { startDate, endDate } = dateRange;
        if (!startDate && !endDate) return 'all';
        const now = new Date();
        const matches = (s: Date, e: Date) => startDate === fmt(s) && endDate === fmt(e);
        const y = new Date(now); const ystart = new Date(now); ystart.setDate(now.getDate() - 1);
        const l7 = new Date(now); l7.setDate(now.getDate() - 6);
        if (matches(now, now)) return 'today';
        if (matches(ystart, ystart)) return 'yesterday';
        if (matches(l7, now)) return 'last7';
        if (matches(new Date(now.getFullYear(), now.getMonth(), 1), now)) return 'thisMonth';
        if (matches(new Date(now.getFullYear(), 0, 1), now)) return 'thisYear';
        return 'custom';
    })();

    // Ringkasan laba per mesin (kategori) dari backend.
    const categories: any[] = profitData?.categories || [];
    // Item tabel, difilter sesuai mesin yang dipilih.
    const visibleItems: any[] = (profitData?.items || []).filter(
        (it: any) => !machineFilter || String(it.categoryId ?? 'none') === machineFilter
    );

    // Ringkasan atas ikut menyesuaikan saat kategori difilter (dihitung dari item
    // yang tampil); tanpa filter pakai total periode penuh dari backend.
    const isFiltered = !!machineFilter;
    const filteredTotals = visibleItems.reduce(
        (a: { revenue: number; hpp: number }, it: any) => {
            a.revenue += Number(it.revenue || 0);
            a.hpp += Number(it.totalHpp || 0);
            return a;
        }, { revenue: 0, hpp: 0 });
    const viewRevenue = isFiltered ? filteredTotals.revenue : Number(profitData?.totalRevenue || 0);
    const viewHpp = isFiltered ? filteredTotals.hpp : Number(profitData?.totalHpp || 0);
    const viewGross = isFiltered ? (filteredTotals.revenue - filteredTotals.hpp) : Number(profitData?.grossProfit || 0);
    const viewMargin = isFiltered ? (filteredTotals.revenue > 0 ? (viewGross / filteredTotals.revenue) * 100 : 0) : Number(profitData?.profitMargin || 0);
    const filterName = isFiltered ? (categories.find((c: any) => String(c.categoryId ?? 'none') === machineFilter)?.categoryName || 'Kategori') : null;

    if (isLoading) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
            </div>
        );
    }

    const marginColor = viewMargin >= 0 ? 'text-emerald-500' : 'text-rose-500';
    const profitColor = viewGross >= 0 ? 'text-emerald-600' : 'text-rose-600';

    const handleExportExcel = () => {
        if (!visibleItems.length) return alert('Tidak ada data untuk di-export');
        const data = visibleItems.map((item: any) => ({
            'SKU': item.sku,
            'Nama Produk': item.name,
            'Mesin / Kategori': item.categoryName || 'Tanpa Kategori',
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
        if (!visibleItems.length) return alert('Tidak ada data untuk di-export');
        const headers = ['SKU', 'Nama Produk', 'Mesin', 'Qty', 'Pendapatan', 'Total HPP', 'Laba Kotor', 'Margin'];
        const body = visibleItems.map((item: any) => {
            const margin = item.revenue > 0 ? ((item.grossProfit / item.revenue) * 100).toFixed(1) + '%' : '0%';
            const qtyDisplay = item.isAreaBased
                ? `${Number(item.totalAreaM2).toFixed(2)} m² (${item.qty} psx)`
                : `${item.qty} ${item.unit}`;
            return [
                item.sku,
                item.name,
                item.categoryName || 'Tanpa Kategori',
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

            {/* Preset tanggal cepat */}
            <div className="flex items-center gap-2 flex-wrap">
                {([
                    { key: 'today', label: 'Hari Ini' },
                    { key: 'yesterday', label: 'Kemarin' },
                    { key: 'last7', label: '7 Hari' },
                    { key: 'thisMonth', label: 'Bulan Ini' },
                    { key: 'thisYear', label: 'Tahun Ini' },
                    { key: 'all', label: 'Semua' },
                ] as const).map((p) => (
                    <button
                        key={p.key}
                        onClick={() => applyPreset(p.key)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${activePreset === p.key
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-card text-muted-foreground border-border hover:bg-muted/40'
                            }`}
                    >
                        {p.label}
                    </button>
                ))}
                {activePreset === 'custom' && (
                    <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-600 border border-amber-500/20">
                        Rentang custom
                    </span>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="glass p-5 rounded-xl shadow-sm flex flex-col justify-center">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-muted-foreground">Total Pendapatan Bersih</p>
                        <div className="p-2 bg-blue-500/10 rounded-lg"><DollarSign className="w-4 h-4 text-blue-500" /></div>
                    </div>
                    <h2 className="text-2xl font-bold text-foreground">Rp {viewRevenue.toLocaleString('id-ID')}</h2>
                    <p className="text-xs text-muted-foreground mt-2">{filterName ? `Kategori: ${filterName}` : 'Setelah diskon, sebelum pajak'}</p>
                </div>

                <div className="glass p-5 rounded-xl shadow-sm flex flex-col justify-center">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-muted-foreground">Total HPP</p>
                        <div className="p-2 bg-orange-500/10 rounded-lg"><Package className="w-4 h-4 text-orange-500" /></div>
                    </div>
                    <h2 className="text-2xl font-bold text-foreground">Rp {viewHpp.toLocaleString('id-ID')}</h2>
                    <p className="text-xs text-muted-foreground mt-2">{filterName ? `Modal kategori ${filterName}` : 'Modal barang yang terjual'}</p>
                </div>

                <div className="glass p-5 rounded-xl shadow-sm flex flex-col justify-center lg:col-span-2 bg-gradient-to-br from-card to-muted/30">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-muted-foreground">Laba Kotor (Gross Profit){filterName ? ` — ${filterName}` : ''}</p>
                        <div className="p-2 bg-emerald-500/10 rounded-lg"><TrendingUp className="w-4 h-4 text-emerald-500" /></div>
                    </div>
                    <div className="flex items-end justify-between">
                        <h2 className={`text-3xl font-bold ${profitColor}`}>Rp {viewGross.toLocaleString('id-ID')}</h2>
                        <div className={`flex items-center gap-1 font-bold text-lg ${marginColor} bg-background/50 px-3 py-1 rounded-lg border border-border/50`}>
                            {viewMargin >= 0 ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                            {viewMargin.toFixed(1)}%
                        </div>
                    </div>
                </div>
            </div>

            {/* Ringkasan laba per mesin (kategori produk) */}
            {categories.length > 0 && (
                <div className="glass rounded-xl shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-border bg-muted/20 flex items-center gap-2">
                        <Factory className="h-5 w-5 text-primary" />
                        <h3 className="font-semibold text-foreground">Laba per Mesin / Kategori</h3>
                        <span className="text-xs text-muted-foreground">— klik kartu untuk filter tabel di bawah</span>
                    </div>
                    {/* Slider horizontal: swipe di mobile, tombol panah di layar lebar */}
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => scrollCats(-1)}
                            aria-label="Geser kiri"
                            className="hidden sm:flex absolute left-1 top-1/2 -translate-y-1/2 z-10 items-center justify-center h-8 w-8 rounded-full bg-card/90 border border-border shadow-md hover:bg-muted transition-colors"
                        >
                            <ChevronLeft className="h-4 w-4 text-foreground" />
                        </button>
                        <div
                            ref={catScrollRef}
                            className="grid grid-flow-col grid-rows-1 sm:grid-rows-2 auto-cols-max gap-3 overflow-x-auto scroll-smooth snap-x snap-mandatory px-4 py-4 sm:px-12 [scrollbar-width:thin] [-webkit-overflow-scrolling:touch]"
                        >
                            {categories.map((cat: any) => {
                                const key = String(cat.categoryId ?? 'none');
                                const isActive = machineFilter === key;
                                const isLoss = cat.grossProfit < 0;
                                return (
                                    <button
                                        key={key}
                                        onClick={() => setMachineFilter(isActive ? '' : key)}
                                        className={`text-left p-4 rounded-xl border transition-colors snap-start w-[78vw] sm:w-[260px] ${isActive
                                            ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                            : 'border-border bg-background/50 hover:bg-muted/40'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between gap-2 mb-2">
                                            <span className="font-semibold text-sm text-foreground truncate" title={cat.categoryName}>{cat.categoryName}</span>
                                            <span className="text-[10px] shrink-0 text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{cat.productCount} produk</span>
                                        </div>
                                        <div className={`text-lg font-bold ${isLoss ? 'text-rose-600' : 'text-emerald-600'}`}>
                                            Rp {Number(cat.grossProfit).toLocaleString('id-ID')}
                                        </div>
                                        <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
                                            <span>Omzet Rp {Number(cat.revenue).toLocaleString('id-ID')}</span>
                                            <span className={`font-medium ${isLoss ? 'text-rose-500' : 'text-emerald-500'}`}>{Number(cat.profitMargin).toFixed(1)}%</span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                        <button
                            type="button"
                            onClick={() => scrollCats(1)}
                            aria-label="Geser kanan"
                            className="hidden sm:flex absolute right-1 top-1/2 -translate-y-1/2 z-10 items-center justify-center h-8 w-8 rounded-full bg-card/90 border border-border shadow-md hover:bg-muted transition-colors"
                        >
                            <ChevronRight className="h-4 w-4 text-foreground" />
                        </button>
                    </div>
                </div>
            )}

            <div className="glass rounded-xl shadow-sm overflow-hidden">
                <div className="p-5 border-b border-border bg-muted/20 flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                        <BarChart className="h-5 w-5 text-primary" />
                        <h3 className="font-semibold text-foreground">Analisis Profitabilitas per Produk</h3>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Filter per kategori / mesin (sinkron dengan klik kartu di atas) */}
                        <div className="flex items-center gap-1.5">
                            <Factory className="h-4 w-4 text-muted-foreground" />
                            <select
                                value={machineFilter}
                                onChange={(e) => setMachineFilter(e.target.value)}
                                className="bg-background border border-input rounded-lg px-3 py-1.5 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                                title="Filter berdasarkan kategori / mesin"
                            >
                                <option value="">Semua kategori / mesin</option>
                                {categories.map((c: any) => {
                                    const key = String(c.categoryId ?? 'none');
                                    return <option key={key} value={key}>{c.categoryName}</option>;
                                })}
                            </select>
                        </div>
                        {machineFilter && (
                            <button
                                onClick={() => setMachineFilter('')}
                                className="inline-flex items-center gap-1 text-xs font-medium text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-lg hover:bg-primary/20 transition-colors"
                            >
                                hapus filter ✕
                            </button>
                        )}
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
                        <tbody className="divide-y divide-border">
                            {visibleItems.length > 0 ? (
                                visibleItems.map((item: any, idx: number) => {
                                    const margin = item.revenue > 0 ? (item.grossProfit / item.revenue) * 100 : 0;
                                    const isLoss = item.grossProfit < 0;
                                    return (
                                        <tr key={idx} className="hover:bg-muted/30 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-medium text-foreground text-sm">{item.name}</span>
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded">
                                                        <Factory className="h-3 w-3" />
                                                        {item.categoryName || 'Tanpa Kategori'}
                                                    </span>
                                                </div>
                                                <div className="text-xs text-muted-foreground mt-0.5">{item.sku}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium tabular-nums">
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
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-foreground tabular-nums">
                                                Rp {Number(item.revenue).toLocaleString('id-ID')}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-muted-foreground tabular-nums">
                                                Rp {Number(item.totalHpp).toLocaleString('id-ID')}
                                            </td>
                                            <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-bold tabular-nums ${isLoss ? 'text-rose-600' : 'text-emerald-600'}`}>
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
