"use client";

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Printer, RefreshCw } from 'lucide-react';
import {
    listPrintJobs, getPrintQueueStats,
    PrintJob, PrintJobStatus,
} from '@/lib/api/print-queue';

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
        ANTRIAN: 'bg-gray-100 text-gray-700 border-gray-300',
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
        FAILED: 'bg-gray-100 text-gray-600 border-gray-300',
    };
    const label = s === 'PAID' ? 'LUNAS' : s === 'PARTIAL' ? 'DP' : s === 'PENDING' ? 'BELUM LUNAS' : s;
    return <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${map[s]}`}>{label}</span>;
}

export default function PrintQueueAdminPage() {
    const [jobs, setJobs] = useState<PrintJob[]>([]);
    const [stats, setStats] = useState({ antrian: 0, proses: 0, selesai: 0, diambil: 0 });
    const [filter, setFilter] = useState<PrintJobStatus | 'ALL'>('ALL');
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [j, s] = await Promise.all([
                listPrintJobs(filter === 'ALL' ? undefined : filter, search || undefined),
                getPrintQueueStats(),
            ]);
            setJobs(j);
            setStats(s);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [filter, search]);

    useEffect(() => { load(); }, [load]);

    return (
        <div>
            <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2"><Printer className="w-6 h-6" /> Antrian Cetak Paper</h1>
                    <p className="text-sm text-muted-foreground">Pantau status cetakan paper dari setiap transaksi.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Link
                        href="/cetak"
                        target="_blank"
                        className="text-sm bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 flex items-center gap-1.5 font-medium"
                    >
                        <ExternalLink className="w-3.5 h-3.5" /> Buka Halaman Operator
                    </Link>
                    <button onClick={load} disabled={loading} className="text-sm bg-white border px-3 py-1.5 rounded-lg hover:bg-gray-50 flex items-center gap-1">
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                {([
                    { label: 'Antrian', val: stats.antrian, color: 'text-gray-700' },
                    { label: 'Proses', val: stats.proses, color: 'text-indigo-700' },
                    { label: 'Siap Diambil', val: stats.selesai, color: 'text-green-700' },
                    { label: 'Diambil', val: stats.diambil, color: 'text-sky-700' },
                ]).map(c => (
                    <div key={c.label} className="bg-white border rounded-xl p-4 shadow-sm">
                        <p className="text-xs text-gray-500">{c.label}</p>
                        <p className={`text-2xl font-bold ${c.color}`}>{c.val}</p>
                    </div>
                ))}
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-3">
                <div className="flex gap-1 overflow-x-auto">
                    {STATUSES.map(s => (
                        <button key={s.key} onClick={() => setFilter(s.key)} className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${filter === s.key ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>{s.label}</button>
                    ))}
                </div>
                <input
                    type="search"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Cari no. job / invoice / pelanggan..."
                    className="border rounded-lg px-3 py-1.5 text-sm bg-white ml-auto w-full sm:w-72"
                />
            </div>

            <div className="bg-white border rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead className="bg-gray-50 text-xs uppercase text-gray-600">
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
                                <tr><td colSpan={11} className="px-3 py-10 text-center text-gray-500">Tidak ada job.</td></tr>
                            ) : jobs.map(j => (
                                <tr key={j.id} className="border-t hover:bg-gray-50">
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
                                            <div className="font-mono text-[10px] text-gray-500">{j.transaction.checkoutNumber}</div>
                                        )}
                                    </td>
                                    <td className="px-3 py-2">{j.transaction.customerName || '—'}</td>
                                    <td className="px-3 py-2">
                                        <div className="font-medium">{j.transactionItem.productVariant.product.name}</div>
                                        {j.transactionItem.productVariant.variantName && (
                                            <div className="text-xs text-gray-500">{j.transactionItem.productVariant.variantName}</div>
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
            </div>
        </div>
    );
}
