"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, Eye, FileSignature, Loader2, ExternalLink, Users } from "lucide-react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { listSalesOrders, type SalesOrder, type SalesOrderStatus } from "@/lib/api/sales-orders";
import dayjs from "dayjs";
import "dayjs/locale/id";

dayjs.locale("id");

const TABS: { key: 'ALL' | SalesOrderStatus; label: string; color: string }[] = [
    { key: 'ALL', label: 'Semua', color: 'bg-slate-100 text-slate-700' },
    { key: 'DRAFT', label: 'Draft', color: 'bg-gray-100 text-gray-700' },
    { key: 'SENT', label: 'Terkirim', color: 'bg-blue-100 text-blue-700' },
    { key: 'INVOICED', label: 'Invoiced', color: 'bg-emerald-100 text-emerald-700' },
    { key: 'CANCELLED', label: 'Dibatalkan', color: 'bg-red-100 text-red-700' },
];

const STATUS_BADGE: Record<SalesOrderStatus, string> = {
    DRAFT: 'bg-gray-100 text-gray-700 border-gray-200',
    SENT: 'bg-blue-100 text-blue-700 border-blue-200',
    INVOICED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    CANCELLED: 'bg-red-100 text-red-700 border-red-200',
};

const STATUS_LABEL: Record<SalesOrderStatus, string> = {
    DRAFT: 'Draft',
    SENT: 'Terkirim WA',
    INVOICED: 'Sudah Invoice',
    CANCELLED: 'Dibatalkan',
};

export default function SalesOrdersPage() {
    const { isManager } = useCurrentUser();
    const [activeTab, setActiveTab] = useState<'ALL' | SalesOrderStatus>('ALL');
    const [search, setSearch] = useState('');

    const { data, isLoading } = useQuery({
        queryKey: ['sales-orders', activeTab, search],
        queryFn: () => listSalesOrders({
            status: activeTab === 'ALL' ? undefined : activeTab,
            search: search.trim() || undefined,
        }),
        refetchInterval: 30_000,
    });

    const sos: SalesOrder[] = data ?? [];

    const summary = useMemo(() => ({
        total: sos.length,
        draft: sos.filter(s => s.status === 'DRAFT').length,
        sent: sos.filter(s => s.status === 'SENT').length,
        invoiced: sos.filter(s => s.status === 'INVOICED').length,
    }), [sos]);

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <FileSignature className="h-6 w-6 text-primary" />
                        Sales Order
                    </h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Jembatan dari desainer ke kasir — upload proof, kirim ke group WA internal, lalu kasir buat nota.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {/* Link ke portal desainer */}
                    <a
                        href="/so-designer"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 border border-border px-3 py-2 rounded-md text-sm font-medium hover:bg-muted"
                    >
                        <Users className="h-4 w-4" /> Portal Desainer
                    </a>
                    {isManager && (
                        <Link
                            href="/settings/designers"
                            className="inline-flex items-center gap-2 border border-border px-3 py-2 rounded-md text-sm font-medium hover:bg-muted"
                        >
                            <Users className="h-4 w-4" /> Kelola Desainer
                        </Link>
                    )}
                    <Link
                        href="/sales-orders/new"
                        className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:opacity-90"
                    >
                        <Plus className="h-4 w-4" /> Buat SO Baru
                    </Link>
                </div>
            </div>

            {/* Summary strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="Total SO" value={summary.total} />
                <StatCard label="Draft" value={summary.draft} accent="text-gray-700" />
                <StatCard label="Menunggu Nota" value={summary.sent} accent="text-blue-600" />
                <StatCard label="Sudah Invoice" value={summary.invoiced} accent="text-emerald-600" />
            </div>

            {/* Tabs + search */}
            <div className="bg-card border border-border rounded-lg">
                <div className="flex flex-wrap items-center justify-between gap-3 p-3 border-b border-border">
                    <div className="flex flex-wrap gap-1.5">
                        {TABS.map(t => (
                            <button
                                key={t.key}
                                onClick={() => setActiveTab(t.key)}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${activeTab === t.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Cari SO# / customer..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="pl-8 pr-3 py-1.5 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary w-64"
                        />
                    </div>
                </div>

                {isLoading ? (
                    <div className="p-12 flex items-center justify-center text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Memuat...
                    </div>
                ) : sos.length === 0 ? (
                    <div className="p-12 text-center text-muted-foreground text-sm">
                        Belum ada Surat Order {activeTab !== 'ALL' && `dengan status ${STATUS_LABEL[activeTab as SalesOrderStatus]}`}.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                                <tr>
                                    <th className="px-3 py-2 text-left font-medium">SO#</th>
                                    <th className="px-3 py-2 text-left font-medium">Tanggal</th>
                                    <th className="px-3 py-2 text-left font-medium">Customer</th>
                                    <th className="px-3 py-2 text-left font-medium">Desainer</th>
                                    <th className="px-3 py-2 text-center font-medium">Item</th>
                                    <th className="px-3 py-2 text-left font-medium">Deadline</th>
                                    <th className="px-3 py-2 text-center font-medium">Status</th>
                                    <th className="px-3 py-2 text-right font-medium">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {sos.map(so => (
                                    <tr key={so.id} className="hover:bg-muted/30">
                                        <td className="px-3 py-2 font-mono text-xs font-medium">{so.soNumber}</td>
                                        <td className="px-3 py-2 text-xs text-muted-foreground">
                                            {dayjs(so.createdAt).format('DD MMM YYYY HH:mm')}
                                        </td>
                                        <td className="px-3 py-2">
                                            <div className="font-medium truncate max-w-[200px]">{so.customerName}</div>
                                            {so.customerPhone && <div className="text-xs text-muted-foreground">{so.customerPhone}</div>}
                                        </td>
                                        <td className="px-3 py-2 text-xs">{so.designerName}</td>
                                        <td className="px-3 py-2 text-center">{so.items.length}</td>
                                        <td className="px-3 py-2 text-xs">
                                            {so.deadline ? dayjs(so.deadline).format('DD MMM YYYY') : '—'}
                                        </td>
                                        <td className="px-3 py-2 text-center">
                                            <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_BADGE[so.status]}`}>
                                                {STATUS_LABEL[so.status]}
                                            </span>
                                            {so.transaction && (
                                                <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                                                    {so.transaction.invoiceNumber}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <Link
                                                    href={`/sales-orders/${so.id}`}
                                                    className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-border hover:bg-muted"
                                                >
                                                    <Eye className="h-3 w-3" /> Detail
                                                </Link>
                                                {so.status === 'SENT' && (
                                                    <Link
                                                        href={`/pos?fromSO=${so.id}`}
                                                        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700"
                                                    >
                                                        <ExternalLink className="h-3 w-3" /> Buat Nota
                                                    </Link>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
    return (
        <div className="bg-card border border-border rounded-lg p-3">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className={`text-2xl font-bold mt-0.5 ${accent ?? ''}`}>{value}</div>
        </div>
    );
}
