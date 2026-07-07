"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, Eye, FileSignature, Loader2, ExternalLink, Users, Building2, ChevronLeft, ChevronRight } from "lucide-react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useBranchStore } from "@/store/branch-store";
import { listSalesOrders, type SalesOrder, type SalesOrderStatus } from "@/lib/api/sales-orders";
import { getPublicBranches, type PublicBranch } from "@/lib/api/production";
import { badgeToneClass } from "@/components/ui/status-badge";
import dayjs from "dayjs";
import "dayjs/locale/id";

dayjs.locale("id");

const TABS: { key: 'ALL' | SalesOrderStatus; label: string; color: string }[] = [
    { key: 'ALL', label: 'Semua', color: badgeToneClass.neutral },
    { key: 'DRAFT', label: 'Draft', color: badgeToneClass.neutral },
    { key: 'SENT', label: 'Terkirim', color: badgeToneClass.info },
    { key: 'INVOICED', label: 'Invoiced', color: badgeToneClass.success },
    { key: 'CANCELLED', label: 'Dibatalkan', color: badgeToneClass.danger },
];

const STATUS_BADGE: Record<SalesOrderStatus, string> = {
    DRAFT: badgeToneClass.neutral,
    SENT: badgeToneClass.info,
    INVOICED: badgeToneClass.success,
    CANCELLED: badgeToneClass.danger,
};

const STATUS_LABEL: Record<SalesOrderStatus, string> = {
    DRAFT: 'Draft',
    SENT: 'Terkirim ke Discord',
    INVOICED: 'Sudah Invoice',
    CANCELLED: 'Dibatalkan',
};

export default function SalesOrdersPage() {
    const { isManager, branchId: userBranchId, isOwner } = useCurrentUser();
    const ownerActiveBranch = useBranchStore(s => s.activeBranchId);
    const [activeTab, setActiveTab] = useState<'ALL' | SalesOrderStatus>('ALL');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 20;
    // Tab cabang — id cabang yang sedang dipilih untuk dilihat SO-nya.
    // - Staff: locked ke userBranchId (hanya 1 tab, otomatis dipilih)
    // - Owner: bisa switch antar cabang via tab; default = ownerActiveBranch atau cabang pertama
    const [activeBranchTab, setActiveBranchTab] = useState<number | null>(null);

    // Load list cabang aktif untuk render tab (cuma untuk Owner)
    const { data: branches = [] } = useQuery<PublicBranch[]>({
        queryKey: ['public-branches'],
        queryFn: getPublicBranches,
        staleTime: 5 * 60_000,
        retry: false,
        enabled: isOwner, // staff tidak butuh tab list — locked
    });

    // Sinkronkan default activeBranchTab dengan user/branch context
    useEffect(() => {
        if (!isOwner) {
            // Staff: locked ke cabang dia
            if (activeBranchTab !== userBranchId) setActiveBranchTab(userBranchId);
            return;
        }
        // Owner: kalau belum di-set, default ke ownerActiveBranch atau cabang pertama
        if (activeBranchTab == null) {
            if (ownerActiveBranch != null) setActiveBranchTab(ownerActiveBranch);
            else if (branches.length > 0) setActiveBranchTab(branches[0].id);
        }
    }, [isOwner, userBranchId, ownerActiveBranch, branches, activeBranchTab]);

    // Reset ke halaman 1 saat filter berubah
    useEffect(() => { setPage(1); }, [activeTab, search, activeBranchTab]);

    const { data, isLoading } = useQuery({
        queryKey: ['sales-orders', activeTab, search, activeBranchTab, page],
        queryFn: () => listSalesOrders({
            status: activeTab === 'ALL' ? undefined : activeTab,
            search: search.trim() || undefined,
            branchId: activeBranchTab ?? undefined,
            page,
            pageSize: PAGE_SIZE,
        }),
        refetchInterval: 30_000,
        enabled: activeBranchTab != null, // jangan fetch sebelum cabang dipilih
        placeholderData: (prev) => prev,  // tahan data lama saat pindah halaman (no flicker)
    });

    const sos: SalesOrder[] = data?.rows ?? [];
    const counts = data?.counts;
    const total = data?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const summary = useMemo(() => ({
        total: counts?.ALL ?? 0,
        draft: counts?.DRAFT ?? 0,
        sent: counts?.SENT ?? 0,
        invoiced: counts?.INVOICED ?? 0,
    }), [counts]);

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <FileSignature className="h-6 w-6 text-primary" />
                        Sales Order
                    </h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Jembatan dari desainer ke kasir — upload proof, kirim ke Discord internal, lalu kasir buat nota.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
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
                <StatCard label="Draft" value={summary.draft} accent="text-foreground" />
                <StatCard label="Menunggu Nota" value={summary.sent} accent="text-blue-600" />
                <StatCard label="Sudah Invoice" value={summary.invoiced} accent="text-emerald-600" />
            </div>

            {/* Tab cabang — wajib pilih 1 cabang, tidak ada mode "Semua Cabang" supaya SO tidak campur */}
            {isOwner && branches.length > 1 && (
                <div className="bg-card border border-border rounded-lg p-2">
                    <div className="flex items-center gap-2 mb-2 px-1">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pilih Cabang</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {branches.map(b => (
                            <button
                                key={b.id}
                                onClick={() => setActiveBranchTab(b.id)}
                                className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${
                                    activeBranchTab === b.id
                                        ? 'bg-primary text-primary-foreground shadow-sm'
                                        : 'bg-muted text-foreground hover:bg-muted/70'
                                }`}
                            >
                                {b.name}
                                {b.code && <span className="ml-1.5 text-xs font-mono opacity-70">{b.code}</span>}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Tabs status + search */}
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
                                {counts && (
                                    <span className={`ml-1.5 text-xs font-semibold px-1.5 py-0.5 rounded-full ${activeTab === t.key ? 'bg-primary-foreground/20' : 'bg-background/70'}`}>
                                        {counts[t.key]}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Cari SO# / customer..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="pl-8 pr-3 py-1.5 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary w-56"
                            />
                        </div>
                    </div>
                </div>

                {activeBranchTab == null ? (
                    <div className="p-12 text-center text-muted-foreground text-sm">
                        Pilih cabang di atas untuk melihat Sales Order.
                    </div>
                ) : isLoading ? (
                    <div className="p-12 flex items-center justify-center text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Memuat...
                    </div>
                ) : sos.length === 0 ? (
                    <div className="p-12 text-center text-muted-foreground text-sm">
                        Belum ada Surat Order {activeTab !== 'ALL' && `dengan status ${STATUS_LABEL[activeTab as SalesOrderStatus]}`} di cabang ini.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                                <tr>
                                    <th className="px-3 py-2 text-left font-medium">SO#</th>
                                    <th className="px-3 py-2 text-left font-medium">Tanggal</th>
                                    <th className="px-3 py-2 text-left font-medium">Customer</th>
                                    <th className="px-3 py-2 text-left font-medium">Desainer / Cabang</th>
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
                                        <td className="px-3 py-2 text-xs">
                                            <div>{so.designerName}</div>
                                            {(so as any).branchName && (
                                                <span className={`inline-block mt-0.5 ${badgeToneClass.info} text-xs font-semibold px-1.5 py-0.5 rounded-full`}>
                                                    {(so as any).branchName}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2 text-center">{so.items.length}</td>
                                        <td className="px-3 py-2 text-xs">
                                            {so.deadline ? dayjs(so.deadline).format('DD MMM YYYY') : '—'}
                                        </td>
                                        <td className="px-3 py-2 text-center">
                                            <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full border ${STATUS_BADGE[so.status]}`}>
                                                {STATUS_LABEL[so.status]}
                                            </span>
                                            {so.transaction && (
                                                <div className="text-xs text-muted-foreground mt-0.5 font-mono">
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
                                                {(so.status === 'DRAFT' || so.status === 'SENT') && (
                                                    <Link
                                                        href={`/pos?fromSO=${so.id}`}
                                                        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700"
                                                        title="Bawa item SO ke POS, lanjutkan checkout untuk terbit nota"
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

                {/* Footer pagination */}
                {activeBranchTab != null && total > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 border-t border-border text-xs text-muted-foreground">
                        <span>
                            Menampilkan <span className="font-medium text-foreground">{(page - 1) * PAGE_SIZE + 1}</span>
                            –<span className="font-medium text-foreground">{(page - 1) * PAGE_SIZE + sos.length}</span>
                            {' '}dari <span className="font-medium text-foreground">{total}</span> SO
                        </span>
                        {totalPages > 1 && (
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page <= 1}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <ChevronLeft className="h-3.5 w-3.5" /> Sebelumnya
                                </button>
                                <span className="px-2 font-medium text-foreground">Hal {page} / {totalPages}</span>
                                <button
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page >= totalPages}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
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

function StatCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
    return (
        <div className="bg-card border border-border rounded-lg p-3">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className={`text-2xl font-bold mt-0.5 ${accent ?? ''}`}>{value}</div>
        </div>
    );
}
