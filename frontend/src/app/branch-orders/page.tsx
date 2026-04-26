'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
    Building2, Plus, Search, ClipboardList, CheckCircle2,
    Clock, XCircle, AlertCircle, BarChart3,
} from 'lucide-react';
import {
    listBranchWorkOrders,
    getBranchWOSummary,
    type BranchWOStatus,
} from '@/lib/api/branch-work-orders';
import axios from '@/lib/api/client';

interface Branch {
    id: number;
    name: string;
}

const STATUS_LABELS: Record<BranchWOStatus, string> = {
    ANTRIAN: 'Antrian',
    PROSES: 'Proses',
    SELESAI: 'Selesai',
    DIBATALKAN: 'Dibatalkan',
};

const STATUS_COLORS: Record<BranchWOStatus, string> = {
    ANTRIAN: 'bg-yellow-100 text-yellow-800',
    PROSES: 'bg-blue-100 text-blue-800',
    SELESAI: 'bg-green-100 text-green-800',
    DIBATALKAN: 'bg-gray-100 text-gray-600',
};

const STATUS_ICONS: Record<BranchWOStatus, React.ReactNode> = {
    ANTRIAN: <Clock className="w-3.5 h-3.5" />,
    PROSES: <AlertCircle className="w-3.5 h-3.5" />,
    SELESAI: <CheckCircle2 className="w-3.5 h-3.5" />,
    DIBATALKAN: <XCircle className="w-3.5 h-3.5" />,
};

function formatDate(s: string) {
    return new Date(s).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getMonthOptions() {
    const opts: { value: string; label: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const lbl = d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
        opts.push({ value: val, label: lbl });
    }
    return opts;
}

function getYearOptions() {
    const now = new Date();
    return Array.from({ length: 3 }, (_, i) => now.getFullYear() - i);
}

// ─── Summary Tab ─────────────────────────────────────────────────────────────

function SummaryTab() {
    const now = new Date();
    const [year, setYear] = useState(String(now.getFullYear()));
    const [month, setMonth] = useState(String(now.getMonth() + 1));
    const [filterBranch, setFilterBranch] = useState('');

    const { data: branches = [] } = useQuery<Branch[]>({
        queryKey: ['company-branches-active'],
        queryFn: () => axios.get<Branch[]>('/company-branches/active').then(r => r.data),
    });

    const { data: summary, isLoading } = useQuery({
        queryKey: ['branch-wo-summary', year, month, filterBranch],
        queryFn: () => getBranchWOSummary({
            year: Number(year),
            month: month ? Number(month) : undefined,
            branchId: filterBranch ? Number(filterBranch) : undefined,
        }),
    });

    const years = getYearOptions();

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
                <select
                    value={year}
                    onChange={e => setYear(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <select
                    value={month}
                    onChange={e => setMonth(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                    <option value="">Seluruh Tahun</option>
                    {Array.from({ length: 12 }, (_, i) => {
                        const d = new Date(2000, i, 1);
                        return (
                            <option key={i + 1} value={i + 1}>
                                {d.toLocaleDateString('id-ID', { month: 'long' })}
                            </option>
                        );
                    })}
                </select>
                <select
                    value={filterBranch}
                    onChange={e => setFilterBranch(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                    <option value="">Semua Cabang</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
            </div>

            {isLoading ? (
                <p className="text-gray-400 text-sm">Memuat rekap...</p>
            ) : !summary ? null : (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
                            <p className="text-2xl font-bold text-blue-600">{summary.totalOrders}</p>
                            <p className="text-xs text-gray-500 mt-1">Total Work Order</p>
                        </div>
                        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
                            <p className="text-lg text-gray-500 font-medium">{summary.period}</p>
                            <p className="text-xs text-gray-400 mt-1">Periode</p>
                        </div>
                    </div>

                    {summary.byBranch.length === 0 ? (
                        <p className="text-gray-400 text-sm text-center py-8">Tidak ada data untuk periode ini.</p>
                    ) : (
                        <div className="space-y-3">
                            {summary.byBranch.map(b => {
                                const pct = b.totalOrders > 0 ? Math.round((b.selesai / b.totalOrders) * 100) : 0;
                                return (
                                    <div key={b.branchId} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <p className="font-semibold text-gray-800">{b.branchName}</p>
                                            <span className="text-xs text-gray-400">{b.totalOrders} WO · {b.totalItems} items</span>
                                        </div>
                                        <div className="flex gap-3 text-center text-xs">
                                            <div className="flex-1 bg-green-50 rounded-lg py-2">
                                                <p className="text-xl font-bold text-green-600">{b.selesai}</p>
                                                <p className="text-green-700">Selesai</p>
                                            </div>
                                            <div className="flex-1 bg-blue-50 rounded-lg py-2">
                                                <p className="text-xl font-bold text-blue-600">{b.proses}</p>
                                                <p className="text-blue-700">Proses</p>
                                            </div>
                                            <div className="flex-1 bg-yellow-50 rounded-lg py-2">
                                                <p className="text-xl font-bold text-yellow-600">{b.antrian}</p>
                                                <p className="text-yellow-700">Antrian</p>
                                            </div>
                                        </div>
                                        <div>
                                            <div className="flex justify-between text-xs text-gray-400 mb-1">
                                                <span>Tingkat penyelesaian</span>
                                                <span>{pct}%</span>
                                            </div>
                                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-green-500 rounded-full"
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── List Tab ─────────────────────────────────────────────────────────────────

function ListTab() {
    const [filterBranch, setFilterBranch] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterMonth, setFilterMonth] = useState('');
    const [search, setSearch] = useState('');

    const { data: branches = [] } = useQuery<Branch[]>({
        queryKey: ['company-branches-active'],
        queryFn: () => axios.get<Branch[]>('/company-branches/active').then(r => r.data),
    });

    const { data: orders = [], isLoading } = useQuery({
        queryKey: ['branch-work-orders', filterBranch, filterStatus, filterMonth],
        queryFn: () =>
            listBranchWorkOrders({
                branchId: filterBranch ? Number(filterBranch) : undefined,
                status: filterStatus || undefined,
                month: filterMonth || undefined,
            }),
    });

    const filtered = orders.filter(wo => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
            wo.woNumber.toLowerCase().includes(q) ||
            wo.branch.name.toLowerCase().includes(q) ||
            (wo.referenceNumber ?? '').toLowerCase().includes(q) ||
            (wo.receivedBy ?? '').toLowerCase().includes(q)
        );
    });

    const monthOpts = getMonthOptions();

    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="relative col-span-2 md:col-span-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Cari WO#, cabang..."
                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                </div>
                <select
                    value={filterBranch}
                    onChange={e => setFilterBranch(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                    <option value="">Semua Cabang</option>
                    {branches.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                </select>
                <select
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                    <option value="">Semua Status</option>
                    <option value="ANTRIAN">Antrian</option>
                    <option value="PROSES">Proses</option>
                    <option value="SELESAI">Selesai</option>
                    <option value="DIBATALKAN">Dibatalkan</option>
                </select>
                <select
                    value={filterMonth}
                    onChange={e => setFilterMonth(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                    <option value="">Semua Bulan</option>
                    {monthOpts.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                </select>
            </div>

            {isLoading ? (
                <p className="text-gray-400 text-sm">Memuat...</p>
            ) : filtered.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                    <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p>Belum ada work order</p>
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="text-left px-4 py-2.5 text-gray-500 font-medium">WO#</th>
                                <th className="text-left px-4 py-2.5 text-gray-500 font-medium">Cabang</th>
                                <th className="text-left px-4 py-2.5 text-gray-500 font-medium hidden md:table-cell">Ref / Diterima</th>
                                <th className="text-center px-4 py-2.5 text-gray-500 font-medium">Items</th>
                                <th className="text-left px-4 py-2.5 text-gray-500 font-medium hidden md:table-cell">Tanggal</th>
                                <th className="text-center px-4 py-2.5 text-gray-500 font-medium">Status</th>
                                <th className="px-4 py-2.5" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filtered.map(wo => (
                                <tr key={wo.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-4 py-3 font-mono text-xs text-gray-700">{wo.woNumber}</td>
                                    <td className="px-4 py-3 font-medium text-gray-800">{wo.branch.name}</td>
                                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell">
                                        {wo.referenceNumber && <span className="block text-xs">Ref: {wo.referenceNumber}</span>}
                                        {wo.receivedBy && <span className="block text-xs text-gray-400">Diterima: {wo.receivedBy}</span>}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span className="inline-flex items-center gap-1 text-gray-600">
                                            {wo.items.length}
                                            {wo.items.filter(i => i.isDone).length > 0 && (
                                                <span className="text-xs text-green-600">
                                                    ({wo.items.filter(i => i.isDone).length}✓)
                                                </span>
                                            )}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-gray-400 text-xs hidden md:table-cell">
                                        {formatDate(wo.createdAt)}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[wo.status]}`}>
                                            {STATUS_ICONS[wo.status]}
                                            {STATUS_LABELS[wo.status]}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <Link
                                            href={`/branch-orders/${wo.id}`}
                                            className="text-blue-600 text-xs hover:underline"
                                        >
                                            Detail
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BranchOrdersPage() {
    const [tab, setTab] = useState<'list' | 'summary'>('list');

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-blue-600" />
                    <h1 className="text-xl font-bold text-gray-800">Order Cabang</h1>
                </div>
                <Link
                    href="/branch-orders/new"
                    className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-blue-700"
                >
                    <Plus className="w-4 h-4" /> Input Order Baru
                </Link>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
                <button
                    onClick={() => setTab('list')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'list' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <ClipboardList className="w-4 h-4" /> Daftar WO
                </button>
                <button
                    onClick={() => setTab('summary')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'summary' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <BarChart3 className="w-4 h-4" /> Rekapitulasi
                </button>
            </div>

            {tab === 'list' ? <ListTab /> : <SummaryTab />}
        </div>
    );
}
