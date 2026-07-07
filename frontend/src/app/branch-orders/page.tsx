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
import { badgeToneClass } from '@/components/ui/status-badge';

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
    ANTRIAN: badgeToneClass.warning,
    PROSES: badgeToneClass.info,
    SELESAI: badgeToneClass.success,
    DIBATALKAN: badgeToneClass.neutral,
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
                    className="border border-border rounded-lg px-3 py-2 text-sm"
                >
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <select
                    value={month}
                    onChange={e => setMonth(e.target.value)}
                    className="border border-border rounded-lg px-3 py-2 text-sm"
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
                    className="border border-border rounded-lg px-3 py-2 text-sm"
                >
                    <option value="">Semua Cabang</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
            </div>

            {isLoading ? (
                <p className="text-muted-foreground text-sm">Memuat rekap...</p>
            ) : !summary ? null : (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-card border border-border rounded-xl p-4 text-center">
                            <p className="text-2xl font-bold text-blue-600">{summary.totalOrders}</p>
                            <p className="text-xs text-muted-foreground mt-1">Total Work Order</p>
                        </div>
                        <div className="bg-card border border-border rounded-xl p-4 text-center">
                            <p className="text-lg text-muted-foreground font-medium">{summary.period}</p>
                            <p className="text-xs text-muted-foreground mt-1">Periode</p>
                        </div>
                    </div>

                    {summary.byBranch.length === 0 ? (
                        <p className="text-muted-foreground text-sm text-center py-8">Tidak ada data untuk periode ini.</p>
                    ) : (
                        <div className="space-y-3">
                            {summary.byBranch.map(b => {
                                const pct = b.totalOrders > 0 ? Math.round((b.selesai / b.totalOrders) * 100) : 0;
                                return (
                                    <div key={b.branchId} className="bg-card border border-border rounded-xl p-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <p className="font-semibold text-foreground">{b.branchName}</p>
                                            <span className="text-xs text-muted-foreground">{b.totalOrders} WO · {b.totalItems} items</span>
                                        </div>
                                        <div className="flex gap-3 text-center text-xs">
                                            <div className="flex-1 bg-emerald-500/10 rounded-lg py-2">
                                                <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">{b.selesai}</p>
                                                <p className="text-emerald-700 dark:text-emerald-300">Selesai</p>
                                            </div>
                                            <div className="flex-1 bg-blue-500/10 rounded-lg py-2">
                                                <p className="text-xl font-bold text-blue-700 dark:text-blue-300">{b.proses}</p>
                                                <p className="text-blue-700 dark:text-blue-300">Proses</p>
                                            </div>
                                            <div className="flex-1 bg-amber-500/10 rounded-lg py-2">
                                                <p className="text-xl font-bold text-amber-700 dark:text-amber-300">{b.antrian}</p>
                                                <p className="text-amber-700 dark:text-amber-300">Antrian</p>
                                            </div>
                                        </div>
                                        <div>
                                            <div className="flex justify-between text-xs text-muted-foreground mb-1">
                                                <span>Tingkat penyelesaian</span>
                                                <span>{pct}%</span>
                                            </div>
                                            <div className="h-2 bg-muted rounded-full overflow-hidden">
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
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Cari WO#, cabang..."
                        className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm"
                    />
                </div>
                <select
                    value={filterBranch}
                    onChange={e => setFilterBranch(e.target.value)}
                    className="border border-border rounded-lg px-3 py-2 text-sm"
                >
                    <option value="">Semua Cabang</option>
                    {branches.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                </select>
                <select
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value)}
                    className="border border-border rounded-lg px-3 py-2 text-sm"
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
                    className="border border-border rounded-lg px-3 py-2 text-sm"
                >
                    <option value="">Semua Bulan</option>
                    {monthOpts.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                </select>
            </div>

            {isLoading ? (
                <p className="text-muted-foreground text-sm">Memuat...</p>
            ) : filtered.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                    <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p>Belum ada work order</p>
                </div>
            ) : (
                <div className="bg-card rounded-xl border border-border overflow-x-auto">
                    <table className="w-full text-sm min-w-[640px]">
                        <thead className="bg-muted border-b border-border">
                            <tr>
                                <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">WO#</th>
                                <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Cabang</th>
                                <th className="text-left px-4 py-2.5 text-muted-foreground font-medium hidden md:table-cell">Ref / Diterima</th>
                                <th className="text-center px-4 py-2.5 text-muted-foreground font-medium">Items</th>
                                <th className="text-left px-4 py-2.5 text-muted-foreground font-medium hidden md:table-cell">Tanggal</th>
                                <th className="text-center px-4 py-2.5 text-muted-foreground font-medium">Status</th>
                                <th className="px-4 py-2.5" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {filtered.map(wo => (
                                <tr key={wo.id} className="hover:bg-muted transition-colors">
                                    <td className="px-4 py-3 font-mono text-xs text-foreground">{wo.woNumber}</td>
                                    <td className="px-4 py-3 font-medium text-foreground">{wo.branch.name}</td>
                                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                                        {wo.referenceNumber && <span className="block text-xs">Ref: {wo.referenceNumber}</span>}
                                        {wo.receivedBy && <span className="block text-xs text-muted-foreground">Diterima: {wo.receivedBy}</span>}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                                            {wo.items.length}
                                            {wo.items.filter(i => i.isDone).length > 0 && (
                                                <span className="text-xs text-green-600">
                                                    ({wo.items.filter(i => i.isDone).length}✓)
                                                </span>
                                            )}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-muted-foreground text-xs hidden md:table-cell">
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
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-blue-600" />
                    <h1 className="text-xl font-bold text-foreground">Order Cabang</h1>
                </div>
                <Link
                    href="/branch-orders/new"
                    className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-blue-700"
                >
                    <Plus className="w-4 h-4" /> Input Order Baru
                </Link>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
                <button
                    onClick={() => setTab('list')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'list' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                    <ClipboardList className="w-4 h-4" /> Daftar WO
                </button>
                <button
                    onClick={() => setTab('summary')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'summary' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                    <BarChart3 className="w-4 h-4" /> Rekapitulasi
                </button>
            </div>

            {tab === 'list' ? <ListTab /> : <SummaryTab />}
        </div>
    );
}
