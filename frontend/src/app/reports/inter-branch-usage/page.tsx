"use client";

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
    ArrowLeftRight, RefreshCw, Loader2, Building2, ChevronDown, ChevronUp,
    Package, ExternalLink, Calendar,
} from 'lucide-react';
import { getInterBranchUsage } from '@/lib/api/inter-branch-usage';
import { getPublicBranches, type PublicBranch } from '@/lib/api/production';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useBranchStore } from '@/store/branch-store';

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
    if (key === 'month') return { start: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`, end: today };
    if (key === 'last_month') {
        const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const last = new Date(now.getFullYear(), now.getMonth(), 0);
        return { start: fmt(first), end: fmt(last) };
    }
    if (key === 'last_30') {
        const d = new Date(now); d.setDate(d.getDate() - 29);
        return { start: fmt(d), end: today };
    }
    return { start: '', end: '' };
}

const PRESETS = [
    { key: 'today', label: 'Hari Ini' },
    { key: 'week', label: 'Minggu Ini' },
    { key: 'month', label: 'Bulan Ini' },
    { key: 'last_month', label: 'Bulan Lalu' },
    { key: 'last_30', label: '30 Hari' },
    { key: 'custom', label: 'Kustom' },
];

function rupiah(n: number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
}

function fmtQty(n: number): string {
    if (Number.isInteger(n)) return n.toLocaleString('id-ID');
    return n.toFixed(4).replace(/\.?0+$/, '').replace('.', ',');
}

function fmtDate(s: string): string {
    return new Date(s).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function InterBranchUsageReportPage() {
    const { branchId: userBranchId, isOwner } = useCurrentUser();
    const ownerActiveBranch = useBranchStore(s => s.activeBranchId);

    const [preset, setPreset] = useState('month');
    const initial = getPresetRange('month');
    const [startDate, setStartDate] = useState(initial.start);
    const [endDate, setEndDate] = useState(initial.end);

    // Pilih cabang produksi (yang punya mesin) — yg stoknya keluar untuk cabang lain
    const [productionBranchId, setProductionBranchId] = useState<number | null>(null);
    const [expanded, setExpanded] = useState<Set<number>>(new Set());

    const { data: branches = [] } = useQuery<PublicBranch[]>({
        queryKey: ['public-branches'],
        queryFn: getPublicBranches,
        staleTime: 5 * 60_000,
        retry: false,
    });

    // Default productionBranchId: cabang aktif user atau cabang pertama
    const effectiveProductionBranch = useMemo(() => {
        if (productionBranchId != null) return productionBranchId;
        if (isOwner && ownerActiveBranch != null) return ownerActiveBranch;
        if (!isOwner && userBranchId != null) return userBranchId;
        return branches[0]?.id ?? null;
    }, [productionBranchId, isOwner, ownerActiveBranch, userBranchId, branches]);

    const { data, isLoading, refetch } = useQuery({
        queryKey: ['inter-branch-usage', startDate, endDate, effectiveProductionBranch],
        queryFn: () => getInterBranchUsage({
            startDate: startDate || undefined,
            endDate: endDate || undefined,
            productionBranchId: effectiveProductionBranch ?? undefined,
        }),
        enabled: effectiveProductionBranch != null,
        staleTime: 30_000,
    });

    const handlePreset = (key: string) => {
        setPreset(key);
        if (key !== 'custom') {
            const range = getPresetRange(key);
            setStartDate(range.start);
            setEndDate(range.end);
        }
    };

    const toggleBranchExpand = (branchId: number) => {
        setExpanded(prev => {
            const next = new Set(prev);
            if (next.has(branchId)) next.delete(branchId);
            else next.add(branchId);
            return next;
        });
    };

    const handleExportCSV = () => {
        if (!data) return;
        const header = 'Cabang Asal,Produk,Varian,SKU,Total Qty,Total Nilai,Jumlah Order,Invoice,Customer,Qty,Nilai,Tanggal\n';
        const rows: string[] = [];
        for (const b of data.perBranch) {
            for (const item of b.items) {
                for (const m of item.movements) {
                    rows.push([
                        `"${b.branchName}"`,
                        `"${item.productName}"`,
                        `"${item.variantName ?? ''}"`,
                        item.sku,
                        fmtQty(m.qty),
                        m.valueRupiah,
                        b.txCount,
                        m.txCheckoutNumber || m.txInvoiceNumber || '',
                        `"${m.customerName ?? ''}"`,
                        fmtQty(m.qty),
                        m.valueRupiah,
                        m.date,
                    ].join(','));
                }
            }
        }
        const blob = new Blob(['﻿' + header + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bahan-titipan-${data.productionBranchName || 'cabang'}-${startDate}-${endDate}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div>
            {/* Page header */}
            <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <ArrowLeftRight className="w-6 h-6 text-primary" />
                        Laporan Bahan Titipan Antar Cabang
                    </h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Tracking bahan dari cabang produksi yang dipakai untuk order titipan dari cabang lain.
                        Tidak ada hutang formal — cuma audit visibility untuk owner.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleExportCSV}
                        disabled={!data || data.perBranch.length === 0}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-40"
                    >
                        Export CSV
                    </button>
                    <button onClick={() => refetch()} disabled={isLoading}
                        className="text-sm bg-white border px-3 py-1.5 rounded-lg hover:bg-gray-50 flex items-center gap-1">
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
                    </button>
                </div>
            </div>

            {/* Filter bar */}
            <div className="rounded-xl border border-border bg-card shadow-sm p-4 space-y-3 mb-4">
                {/* Cabang produksi picker (kalau ada >1 cabang aktif) */}
                {branches.length > 1 && (
                    <div className="flex items-center gap-2 flex-wrap">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mr-2">
                            Cabang Produksi:
                        </span>
                        {branches.map(b => (
                            <button key={b.id}
                                onClick={() => setProductionBranchId(b.id)}
                                className={`px-3 py-1 text-xs font-semibold rounded-md border ${
                                    effectiveProductionBranch === b.id
                                        ? 'bg-primary text-primary-foreground border-primary'
                                        : 'bg-background border-border hover:border-primary/40'
                                }`}>
                                {b.name}
                                {b.code && <span className="ml-1 text-[10px] opacity-70 font-mono">{b.code}</span>}
                            </button>
                        ))}
                    </div>
                )}

                {/* Preset & date range */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <div className="flex gap-1.5 flex-wrap">
                        {PRESETS.map(p => (
                            <button key={p.key} onClick={() => handlePreset(p.key)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                                    preset === p.key
                                        ? 'bg-primary text-primary-foreground border-primary'
                                        : 'bg-background border-border hover:border-primary/40'
                                }`}>
                                {p.label}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-1.5 ml-2">
                        <input type="date" value={startDate}
                            onChange={e => { setStartDate(e.target.value); setPreset('custom'); }}
                            className="px-2 py-1 bg-background border border-border rounded-lg text-xs outline-none focus:border-primary" />
                        <span className="text-xs text-muted-foreground">–</span>
                        <input type="date" value={endDate}
                            onChange={e => { setEndDate(e.target.value); setPreset('custom'); }}
                            className="px-2 py-1 bg-background border border-border rounded-lg text-xs outline-none focus:border-primary" />
                    </div>
                </div>
            </div>

            {/* Summary cards */}
            {data && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                    <div className="rounded-xl border border-border bg-card shadow-sm p-4">
                        <p className="text-xs text-muted-foreground">Cabang Produksi</p>
                        <p className="text-base font-bold text-foreground mt-1 truncate">{data.productionBranchName || '—'}</p>
                    </div>
                    <div className="rounded-xl border border-border bg-card shadow-sm p-4">
                        <p className="text-xs text-muted-foreground">Total Order Titipan</p>
                        <p className="text-2xl font-black text-foreground mt-1">{data.grandTxCount.toLocaleString('id-ID')}</p>
                    </div>
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 shadow-sm p-4">
                        <p className="text-xs text-amber-700">Total Bahan Keluar</p>
                        <p className="text-2xl font-black text-amber-700 mt-1">{fmtQty(data.grandQty)}</p>
                        <p className="text-[10px] text-muted-foreground">unit / m²</p>
                    </div>
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 shadow-sm p-4">
                        <p className="text-xs text-emerald-700">Total Nilai</p>
                        <p className="text-2xl font-black text-emerald-700 mt-1">{rupiah(data.grandTotal)}</p>
                    </div>
                </div>
            )}

            {/* List per cabang asal */}
            <div className="space-y-3">
                {isLoading ? (
                    <div className="bg-card border border-border rounded-xl p-12 flex items-center justify-center text-muted-foreground">
                        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Memuat data…
                    </div>
                ) : !data || data.perBranch.length === 0 ? (
                    <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground text-sm">
                        <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>Tidak ada bahan keluar untuk titipan dari cabang lain pada periode ini.</p>
                        <p className="text-xs mt-2">Bahan baru tampil di sini saat ada transaksi titipan (kasir cabang buat nota titip cetak ke cabang produksi).</p>
                    </div>
                ) : (
                    data.perBranch.map(branch => {
                        const isOpen = expanded.has(branch.branchId);
                        return (
                            <div key={branch.branchId} className="bg-card border border-border rounded-xl overflow-hidden">
                                {/* Branch header */}
                                <button onClick={() => toggleBranchExpand(branch.branchId)}
                                    className="w-full flex items-center justify-between gap-2 p-4 hover:bg-muted/40 transition-colors text-left">
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <div className="w-10 h-10 rounded-lg bg-blue-500/15 text-blue-600 flex items-center justify-center shrink-0">
                                            <Building2 className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-foreground truncate flex items-center gap-2 flex-wrap">
                                                {branch.branchName}
                                                {branch.branchCode && (
                                                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-muted text-muted-foreground rounded">
                                                        {branch.branchCode}
                                                    </span>
                                                )}
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                {branch.txCount} order titipan · {branch.items.length} jenis bahan
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-lg font-black text-emerald-700">{rupiah(branch.totalValue)}</p>
                                        <p className="text-[10px] text-muted-foreground">total nilai bahan</p>
                                    </div>
                                    {isOpen ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
                                </button>

                                {/* Items detail */}
                                {isOpen && (
                                    <div className="border-t border-border bg-muted/20">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                                                    <th className="text-left px-4 py-2 font-semibold">Bahan</th>
                                                    <th className="text-left px-4 py-2 font-semibold">SKU</th>
                                                    <th className="text-right px-4 py-2 font-semibold">Total Qty</th>
                                                    <th className="text-right px-4 py-2 font-semibold">Total Nilai</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {branch.items.map(item => (
                                                    <ItemRow key={item.variantId} item={item} />
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

function ItemRow({ item }: { item: any }) {
    const [open, setOpen] = useState(false);
    return (
        <>
            <tr className="border-t border-border hover:bg-muted/30 cursor-pointer" onClick={() => setOpen(o => !o)}>
                <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                        {open ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                        <div>
                            <p className="font-medium text-foreground">{item.productName}</p>
                            {item.variantName && <p className="text-xs text-muted-foreground">{item.variantName}</p>}
                        </div>
                    </div>
                </td>
                <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{item.sku}</td>
                <td className="px-4 py-2.5 text-right font-semibold">{fmtQty(item.totalQty)}</td>
                <td className="px-4 py-2.5 text-right font-bold text-emerald-700">{rupiah(item.totalValue)}</td>
            </tr>
            {open && item.movements.map((m: any) => (
                <tr key={m.movementId} className="border-t border-border/50 bg-muted/10 text-xs">
                    <td className="px-4 py-2 pl-12" colSpan={2}>
                        {m.transactionId ? (
                            <Link href={`/transactions/${m.transactionId}`}
                                className="inline-flex items-center gap-1 font-mono font-semibold text-indigo-600 hover:underline">
                                <ExternalLink className="w-3 h-3" />
                                {m.txCheckoutNumber || m.txInvoiceNumber}
                            </Link>
                        ) : (
                            <span className="font-mono text-muted-foreground">{m.txCheckoutNumber || m.txInvoiceNumber || '—'}</span>
                        )}
                        {m.customerName && <span className="ml-2 text-foreground">· {m.customerName}</span>}
                        <span className="ml-2 text-muted-foreground">· {fmtDate(m.date)}</span>
                    </td>
                    <td className="px-4 py-2 text-right">{fmtQty(m.qty)}</td>
                    <td className="px-4 py-2 text-right font-semibold">{rupiah(m.valueRupiah)}</td>
                </tr>
            ))}
        </>
    );
}
