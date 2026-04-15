"use client";

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getStockMovements } from '@/lib/api';
import { Search, ArrowUpCircle, ArrowDownCircle, RefreshCw, Download, Filter, X } from 'lucide-react';

// ── Preset rentang tanggal ─────────────────────────────────────────────────
function getPresetRange(key: string): { start: string; end: string } {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const today = fmt(now);

    if (key === 'today') return { start: today, end: today };

    if (key === 'week') {
        const mon = new Date(now);
        mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
        return { start: fmt(mon), end: today };
    }
    if (key === 'month') {
        return { start: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`, end: today };
    }
    if (key === 'last_month') {
        const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const last  = new Date(now.getFullYear(), now.getMonth(), 0);
        return { start: fmt(first), end: fmt(last) };
    }
    if (key === 'last_30') {
        const d = new Date(now); d.setDate(d.getDate() - 29);
        return { start: fmt(d), end: today };
    }
    return { start: '', end: '' };
}

const TYPE_CONFIG = {
    IN:     { label: 'Masuk',   icon: ArrowUpCircle,   className: 'text-emerald-600 bg-emerald-100 border-emerald-200' },
    OUT:    { label: 'Keluar',  icon: ArrowDownCircle, className: 'text-red-600 bg-red-100 border-red-200' },
    ADJUST: { label: 'Koreksi', icon: RefreshCw,       className: 'text-blue-600 bg-blue-100 border-blue-200' },
} as const;

/** Format quantity: tampilkan desimal hanya jika perlu, strip trailing zeros */
function fmtQty(val: number | string): string {
    const n = Number(val);
    if (Number.isInteger(n)) return n.toLocaleString('id-ID');
    return n.toFixed(4).replace(/\.?0+$/, '').replace('.', ',');
}

/** Apakah produk ini AREA_BASED (qty & saldo dalam m²) */
function isAreaBased(m: any): boolean {
    return m.productVariant?.product?.pricingMode === 'AREA_BASED';
}

/** Tampilkan qty + satuan yang sesuai */
function fmtQtyUnit(val: number | string, areaBased: boolean): string {
    return `${fmtQty(val)} ${areaBased ? 'm²' : 'unit'}`;
}

const PRESETS = [
    { key: 'today',      label: 'Hari Ini' },
    { key: 'week',       label: 'Minggu Ini' },
    { key: 'month',      label: 'Bulan Ini' },
    { key: 'last_month', label: 'Bulan Lalu' },
    { key: 'last_30',    label: '30 Hari' },
    { key: 'custom',     label: 'Kustom' },
];

export default function StockReportPage() {
    const [preset,    setPreset]    = useState('month');
    const [startDate, setStartDate] = useState(() => getPresetRange('month').start);
    const [endDate,   setEndDate]   = useState(() => getPresetRange('month').end);
    const [typeFilter, setTypeFilter] = useState('');
    const [search,    setSearch]    = useState('');

    const { data, isLoading } = useQuery({
        queryKey: ['stock-movements', startDate, endDate, typeFilter, search],
        queryFn: () => getStockMovements({
            startDate: startDate || undefined,
            endDate:   endDate   || undefined,
            type:      typeFilter || undefined,
            search:    search    || undefined,
        }),
        staleTime: 30_000,
    });

    const movements = data?.movements ?? [];
    const summary   = data?.summary;

    // ── Export CSV ──────────────────────────────────────────────────────────
    const handleExport = () => {
        const header = 'Waktu,Produk,Varian,SKU,Tipe,Qty,Satuan,Saldo Stok,Keterangan\n';
        const rows = movements.map((m: any) => {
            const prodName = m.productVariant?.product?.name ?? '';
            const varName  = m.productVariant?.variantName ?? '';
            const sku      = m.productVariant?.sku ?? '';
            const date     = new Date(m.createdAt).toLocaleString('id-ID');
            const areaBased = isAreaBased(m);
            const unit     = areaBased ? 'm²' : 'unit';
            const qty      = m.type === 'IN' ? `+${fmtQty(m.quantity)}` : m.type === 'OUT' ? `-${fmtQty(m.quantity)}` : `~${fmtQty(m.quantity)}`;
            const note     = (m.reason ?? '').replace(/,/g, ';');
            return `"${date}","${prodName}","${varName}","${sku}","${m.type}","${qty}","${unit}","${m.balanceAfter != null ? fmtQty(m.balanceAfter) : ''}","${note}"`;
        }).join('\n');
        const blob = new Blob(['\uFEFF' + header + rows], { type: 'text/csv;charset=utf-8;' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a'); a.href = url; a.download = `laporan-stok-${startDate}-${endDate}.csv`;
        a.click(); URL.revokeObjectURL(url);
    };

    const handlePreset = (key: string) => {
        setPreset(key);
        if (key !== 'custom') {
            const range = getPresetRange(key);
            setStartDate(range.start);
            setEndDate(range.end);
        }
    };

    return (
        <div className="space-y-4">
            {/* Title */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Laporan Stok</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">Riwayat seluruh pergerakan stok dengan filter tanggal</p>
                </div>
                <button onClick={handleExport} disabled={movements.length === 0}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-40">
                    <Download className="w-4 h-4" /> Export CSV
                </button>
            </div>

            {/* Filter bar */}
            <div className="glass rounded-xl border border-border p-4 space-y-3">
                {/* Preset tabs */}
                <div className="flex gap-1.5 flex-wrap">
                    {PRESETS.map(p => (
                        <button key={p.key} onClick={() => handlePreset(p.key)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                                preset === p.key
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'bg-background text-muted-foreground border-border hover:border-primary/40'
                            }`}>
                            {p.label}
                        </button>
                    ))}
                </div>

                <div className="flex flex-wrap gap-2 items-center">
                    {/* Custom date range */}
                    <div className="flex items-center gap-1.5">
                        <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setPreset('custom'); }}
                            className="px-2.5 py-1.5 bg-background border border-border rounded-lg text-xs outline-none focus:border-primary" />
                        <span className="text-xs text-muted-foreground">–</span>
                        <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setPreset('custom'); }}
                            className="px-2.5 py-1.5 bg-background border border-border rounded-lg text-xs outline-none focus:border-primary" />
                    </div>

                    {/* Type filter */}
                    <div className="flex gap-1">
                        {[
                            { value: '', label: 'Semua' },
                            { value: 'IN',     label: 'Masuk' },
                            { value: 'OUT',    label: 'Keluar' },
                            { value: 'ADJUST', label: 'Koreksi' },
                        ].map(t => (
                            <button key={t.value} onClick={() => setTypeFilter(t.value)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                                    typeFilter === t.value
                                        ? 'bg-foreground text-background border-foreground'
                                        : 'bg-background text-muted-foreground border-border hover:border-foreground/30'
                                }`}>
                                {t.label}
                            </button>
                        ))}
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <input type="text" placeholder="Cari produk / SKU…" value={search} onChange={e => setSearch(e.target.value)}
                            className="pl-8 pr-3 py-1.5 bg-background border border-border rounded-lg text-xs outline-none focus:border-primary w-44" />
                        {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="w-3 h-3" /></button>}
                    </div>
                </div>
            </div>

            {/* Summary cards */}
            {summary && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="glass rounded-xl border border-border p-4 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Total Catatan</p>
                        <p className="text-2xl font-black text-foreground">{summary.count.toLocaleString('id-ID')}</p>
                    </div>
                    <div className="glass rounded-xl border border-emerald-200 bg-emerald-50/40 dark:bg-emerald-950/20 p-4 text-center">
                        <p className="text-xs text-emerald-600 mb-1">Total Masuk</p>
                        <p className="text-2xl font-black text-emerald-600">+{summary.totalIn.toLocaleString('id-ID')}</p>
                        <p className="text-[10px] text-muted-foreground">unit / m²</p>
                    </div>
                    <div className="glass rounded-xl border border-red-200 bg-red-50/40 dark:bg-red-950/20 p-4 text-center">
                        <p className="text-xs text-red-600 mb-1">Total Keluar</p>
                        <p className="text-2xl font-black text-red-600">-{summary.totalOut.toLocaleString('id-ID')}</p>
                        <p className="text-[10px] text-muted-foreground">unit / m²</p>
                    </div>
                    <div className="glass rounded-xl border border-blue-200 bg-blue-50/40 dark:bg-blue-950/20 p-4 text-center">
                        <p className="text-xs text-blue-600 mb-1">Net Pergerakan</p>
                        <p className={`text-2xl font-black ${summary.totalIn - summary.totalOut >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {summary.totalIn - summary.totalOut >= 0 ? '+' : ''}{(summary.totalIn - summary.totalOut).toLocaleString('id-ID')}
                        </p>
                        <p className="text-[10px] text-muted-foreground">unit / m²</p>
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="glass rounded-xl border border-border overflow-hidden">
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border bg-muted/30">
                                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Waktu</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Produk</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">SKU</th>
                                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground">Tipe</th>
                                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Qty / m²</th>
                                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground" title="Saldo stok tersisa setelah pergerakan ini terjadi">Saldo Stok ↓</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Keterangan</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            {isLoading ? (
                                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground text-sm">Memuat data…</td></tr>
                            ) : movements.length === 0 ? (
                                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground text-sm">Tidak ada data pada periode ini.</td></tr>
                            ) : movements.map((m: any) => {
                                const cfg = TYPE_CONFIG[m.type as keyof typeof TYPE_CONFIG];
                                const Icon = cfg?.icon ?? RefreshCw;
                                const prodName = m.productVariant?.product?.name ?? '–';
                                const varName  = m.productVariant?.variantName ? ` · ${m.productVariant.variantName}` : '';
                                const areaBased = isAreaBased(m);
                                const unit = areaBased ? 'm²' : 'unit';
                                return (
                                    <tr key={m.id} className="hover:bg-muted/20 transition-colors">
                                        <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                                            {new Date(m.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            <br />
                                            <span className="text-[10px]">{new Date(m.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <div className="flex items-center gap-1.5">
                                                <p className="font-medium text-foreground text-sm">{prodName}</p>
                                                {areaBased && (
                                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-800">
                                                        m²
                                                    </span>
                                                )}
                                            </div>
                                            {varName && <p className="text-xs text-muted-foreground">{varName.slice(3)}</p>}
                                        </td>
                                        <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{m.productVariant?.sku ?? '–'}</td>
                                        <td className="px-4 py-2.5 text-center">
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cfg?.className}`}>
                                                <Icon className="w-3 h-3" />{cfg?.label}
                                            </span>
                                        </td>
                                        <td className={`px-4 py-2.5 text-right font-bold text-sm ${m.type === 'IN' ? 'text-emerald-600' : m.type === 'OUT' ? 'text-red-600' : 'text-blue-600'}`}>
                                            {m.type === 'IN' ? '+' : m.type === 'OUT' ? '-' : '~'}{fmtQty(m.quantity)}
                                            <span className="text-[10px] font-normal text-muted-foreground ml-0.5">{unit}</span>
                                        </td>
                                        <td className="px-4 py-2.5 text-right text-xs font-mono">
                                            {m.balanceAfter != null ? (
                                                <span className="text-foreground font-semibold">
                                                    {fmtQty(m.balanceAfter)}
                                                    <span className="text-[10px] font-normal text-muted-foreground ml-0.5">{unit}</span>
                                                </span>
                                            ) : '–'}
                                        </td>
                                        <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-[200px] truncate" title={m.reason ?? ''}>
                                            {m.reason ?? '–'}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Mobile card list */}
                <div className="md:hidden divide-y divide-border/50">
                    {isLoading ? (
                        <div className="py-10 text-center text-muted-foreground text-sm">Memuat data…</div>
                    ) : movements.length === 0 ? (
                        <div className="py-10 text-center text-muted-foreground text-sm">Tidak ada data pada periode ini.</div>
                    ) : movements.map((m: any) => {
                        const cfg = TYPE_CONFIG[m.type as keyof typeof TYPE_CONFIG];
                        const Icon = cfg?.icon ?? RefreshCw;
                        const prodName = m.productVariant?.product?.name ?? '–';
                        const areaBased = isAreaBased(m);
                        const unit = areaBased ? 'm²' : 'unit';
                        return (
                            <div key={m.id} className="p-4 flex gap-3 items-start">
                                <span className={`mt-0.5 p-1.5 rounded-lg border ${cfg?.className}`}>
                                    <Icon className="w-4 h-4" />
                                </span>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <p className="font-semibold text-sm truncate">{prodName}</p>
                                            {areaBased && (
                                                <span className="shrink-0 px-1 py-0.5 rounded text-[10px] font-semibold bg-violet-100 dark:bg-violet-900/30 text-violet-600 border border-violet-200 dark:border-violet-800">m²</span>
                                            )}
                                        </div>
                                        <p className={`font-bold text-sm shrink-0 ${m.type === 'IN' ? 'text-emerald-600' : m.type === 'OUT' ? 'text-red-600' : 'text-blue-600'}`}>
                                            {m.type === 'IN' ? '+' : m.type === 'OUT' ? '-' : '~'}{fmtQty(m.quantity)} {unit}
                                        </p>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        {m.productVariant?.sku} · Sisa stok: {m.balanceAfter != null ? `${fmtQty(m.balanceAfter)} ${unit}` : '–'}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{m.reason ?? '–'}</p>
                                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">{new Date(m.createdAt).toLocaleString('id-ID')}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
