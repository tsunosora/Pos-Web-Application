"use client";

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Printer, RefreshCw, Building2, ChevronLeft, ChevronRight } from 'lucide-react';
import {
    listPrintJobs, getPrintQueueStats,
    PrintJob, PrintJobStatus,
} from '@/lib/api/print-queue';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useBranchStore } from '@/store/branch-store';

const STATUSES: { key: PrintJobStatus | 'ALL'; label: string }[] = [
    { key: 'ALL', label: 'Semua' },
    { key: 'ANTRIAN', label: 'Antrian' },
    { key: 'PROSES', label: 'Proses' },
    { key: 'SELESAI', label: 'Siap Diambil' },
    { key: 'DIAMBIL', label: 'Diambil' },
];

function fmt(s: string | null) {
    if (!s) return '—';
    return new Date(s).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function StatusChip({ s }: { s: PrintJobStatus }) {
    const map: Record<PrintJobStatus, string> = {
        ANTRIAN: 'bg-muted text-foreground border-border',
        PROSES: 'bg-indigo-100 text-indigo-800 border-indigo-300',
        SELESAI: 'bg-green-100 text-green-800 border-green-300',
        DIAMBIL: 'bg-sky-100 text-sky-800 border-sky-300',
    };
    return <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${map[s]}`}>{s}</span>;
}

function PayBadge({ s }: { s: 'PENDING' | 'PARTIAL' | 'PAID' | 'FAILED' }) {
    const map: Record<string, string> = {
        PAID: 'bg-green-100 text-green-800 border-green-300',
        PARTIAL: 'bg-amber-100 text-amber-800 border-amber-300',
        PENDING: 'bg-red-100 text-red-800 border-red-300',
        FAILED: 'bg-muted text-muted-foreground border-border',
    };
    const label = s === 'PAID' ? 'LUNAS' : s === 'PARTIAL' ? 'DP' : s === 'PENDING' ? 'BELUM LUNAS' : s;
    return <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${map[s]}`}>{label}</span>;
}

export default function PrintQueueAdminPage() {
    const [jobs, setJobs] = useState<PrintJob[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 20;
    const [stats, setStats] = useState({ antrian: 0, proses: 0, selesai: 0, diambil: 0 });
    const [filter, setFilter] = useState<PrintJobStatus | 'ALL'>('ALL');
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    // Multi-cabang: scope query ke cabang aktif user.
    // - Staff: lock ke user.branchId
    // - Owner: pakai store.activeBranchId (null = "Semua Cabang" → tidak filter)
    const { branchId: userBranchId, branchName: userBranchName, branchCode: userBranchCode, isOwner } = useCurrentUser();
    const ownerActiveBranch = useBranchStore(s => s.activeBranchId);
    const activeBranchId = isOwner ? ownerActiveBranch : userBranchId;

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [j, s] = await Promise.all([
                listPrintJobs(filter === 'ALL' ? undefined : filter, search || undefined, activeBranchId ?? undefined, page, PAGE_SIZE),
                getPrintQueueStats(activeBranchId ?? undefined),
            ]);
            setJobs(j.rows);
            setTotal(j.total);
            setStats(s);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [filter, search, activeBranchId, page]);

    // Reset ke halaman 1 saat filter/search/cabang berubah
    useEffect(() => { setPage(1); }, [filter, search, activeBranchId]);

    useEffect(() => { load(); }, [load]);

    return (
        <div>
            <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2 flex-wrap">
                        <Printer className="w-6 h-6" /> Antrian Cetak Paper
                        {/* Badge cabang aktif — supaya admin tahu sedang lihat data cabang yang mana */}
                        {activeBranchId ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold px-2 py-0.5 bg-indigo-100 text-indigo-700 border border-indigo-300 rounded-full">
                                <Building2 className="w-3 h-3" />
                                {(isOwner ? '' : userBranchCode) || userBranchName || `Cabang #${activeBranchId}`}
                            </span>
                        ) : isOwner ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 bg-amber-100 text-amber-700 border border-amber-300 rounded-full">
                                Semua Cabang
                            </span>
                        ) : null}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Pantau status cetakan paper dari setiap transaksi
                        {activeBranchId
                            ? ` di cabang ${userBranchName || `#${activeBranchId}`}`
                            : isOwner ? ' — agregat semua cabang' : ''}.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Link
                        href="/cetak"
                        target="_blank"
                        className="text-sm bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 flex items-center gap-1.5 font-medium"
                    >
                        <ExternalLink className="w-3.5 h-3.5" /> Buka Halaman Operator
                    </Link>
                    <button onClick={load} disabled={loading} className="text-sm bg-card border px-3 py-1.5 rounded-lg hover:bg-muted flex items-center gap-1">
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                {([
                    { label: 'Antrian', val: stats.antrian, color: 'text-foreground' },
                    { label: 'Proses', val: stats.proses, color: 'text-indigo-700' },
                    { label: 'Siap Diambil', val: stats.selesai, color: 'text-green-700' },
                    { label: 'Diambil', val: stats.diambil, color: 'text-sky-700' },
                ]).map(c => (
                    <div key={c.label} className="bg-card border rounded-xl p-4 shadow-sm">
                        <p className="text-xs text-muted-foreground">{c.label}</p>
                        <p className={`text-2xl font-bold ${c.color}`}>{c.val}</p>
                    </div>
                ))}
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-3">
                <div className="flex gap-1 overflow-x-auto">
                    {STATUSES.map(s => (
                        <button key={s.key} onClick={() => setFilter(s.key)} className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${filter === s.key ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-card border-border hover:bg-muted'}`}>{s.label}</button>
                    ))}
                </div>
                <input
                    type="search"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Cari no. job / invoice / pelanggan..."
                    className="border rounded-lg px-3 py-1.5 text-sm bg-card ml-auto w-full sm:w-72"
                />
            </div>

            <div className="bg-card border rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead className="bg-muted text-xs uppercase text-muted-foreground">
                            <tr>
                                <th className="px-3 py-2 text-left">No. Job</th>
                                <th className="px-3 py-2 text-left">Invoice / SC</th>
                                <th className="px-3 py-2 text-left">Pelanggan</th>
                                <th className="px-3 py-2 text-left">Produk</th>
                                <th className="px-3 py-2 text-right">Qty</th>
                                <th className="px-3 py-2 text-left">Status Cetak</th>
                                <th className="px-3 py-2 text-left">Bayar</th>
                                <th className="px-3 py-2 text-left">Mulai</th>
                                <th className="px-3 py-2 text-left">Selesai</th>
                                <th className="px-3 py-2 text-left">Diambil</th>
                                <th className="px-3 py-2 text-left">Operator</th>
                            </tr>
                        </thead>
                        <tbody>
                            {jobs.length === 0 ? (
                                <tr><td colSpan={11} className="px-3 py-10 text-center text-muted-foreground">Tidak ada job.</td></tr>
                            ) : jobs.map(j => (
                                <tr key={j.id} className="border-t hover:bg-muted">
                                    <td className="px-3 py-2 font-mono text-xs text-indigo-700 font-bold">
                                        {j.jobNumber}
                                        {(() => {
                                            const isTitipan = j.transaction.productionBranchId != null && j.transaction.productionBranchId !== j.transaction.branchId;
                                            const ownerLabel = j.transaction.branch?.code || j.transaction.branch?.name;
                                            if (isTitipan) {
                                                return (
                                                    <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 bg-amber-500/15 text-amber-700 border border-amber-500/30 rounded-full"
                                                        title={`Titipan cetak dari ${j.transaction.branch?.name || '-'}`}>
                                                        ⚑ Titipan {ownerLabel || '?'}
                                                    </div>
                                                );
                                            }
                                            if (ownerLabel) {
                                                return (
                                                    <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 bg-sky-500/15 text-sky-700 border border-sky-500/30 rounded-full"
                                                        title={`Nota milik ${j.transaction.branch?.name || '-'}`}>
                                                        🏢 {ownerLabel}
                                                    </div>
                                                );
                                            }
                                            return null;
                                        })()}
                                    </td>
                                    <td className="px-3 py-2">
                                        <Link href={`/transactions/${j.transaction.id}`} className="font-mono text-xs text-indigo-700 hover:underline">{j.transaction.invoiceNumber}</Link>
                                        {j.transaction.checkoutNumber && (
                                            <div className="font-mono text-[10px] text-muted-foreground">{j.transaction.checkoutNumber}</div>
                                        )}
                                    </td>
                                    <td className="px-3 py-2">{j.transaction.customerName || '—'}</td>
                                    <td className="px-3 py-2">
                                        <div className="font-medium">
                                            {j.transactionItem?.productVariant?.product?.name
                                                ?? (j.transactionItem as any)?.customName
                                                ?? 'Item Custom'}
                                        </div>
                                        {j.transactionItem?.productVariant?.variantName && (
                                            <div className="text-xs text-muted-foreground">{j.transactionItem.productVariant.variantName}</div>
                                        )}
                                    </td>
                                    <td className="px-3 py-2 text-right font-semibold">{j.quantity}</td>
                                    <td className="px-3 py-2"><StatusChip s={j.status} /></td>
                                    <td className="px-3 py-2"><PayBadge s={j.transaction.status} /></td>
                                    <td className="px-3 py-2 text-xs">{fmt(j.startedAt)}</td>
                                    <td className="px-3 py-2 text-xs">{fmt(j.finishedAt)}</td>
                                    <td className="px-3 py-2 text-xs">{fmt(j.pickedUpAt)}</td>
                                    <td className="px-3 py-2 text-xs">{j.operatorName || '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {total > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 border-t text-xs text-muted-foreground">
                        <span>
                            Menampilkan <span className="font-medium text-foreground">{(page - 1) * PAGE_SIZE + 1}</span>
                            –<span className="font-medium text-foreground">{(page - 1) * PAGE_SIZE + jobs.length}</span>
                            {' '}dari <span className="font-medium text-foreground">{total}</span> job
                        </span>
                        {totalPages > 1 && (
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page <= 1}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <ChevronLeft className="h-3.5 w-3.5" /> Sebelumnya
                                </button>
                                <span className="px-2 font-medium text-foreground">Hal {page} / {totalPages}</span>
                                <button
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page >= totalPages}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    Berikutnya <ChevronRight className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
