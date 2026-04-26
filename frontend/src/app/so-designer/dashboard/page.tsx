"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Eye, ExternalLink, LogOut, Loader2, FileSignature } from "lucide-react";
import { designerListSOs } from "@/lib/api/designers";
import { useDesignerSession, clearDesignerSession } from "../useDesignerSession";
import type { SalesOrder, SalesOrderStatus } from "@/lib/api/sales-orders";
import dayjs from "dayjs";
import "dayjs/locale/id";

dayjs.locale("id");

const STATUS_BADGE: Record<SalesOrderStatus, string> = {
    DRAFT: "bg-slate-200 text-slate-700 border border-slate-300",
    SENT: "bg-blue-100 text-blue-700 border border-blue-200",
    INVOICED: "bg-emerald-100 text-emerald-700 border border-emerald-200",
    CANCELLED: "bg-red-100 text-red-700 border border-red-200",
};
const STATUS_LABEL: Record<SalesOrderStatus, string> = {
    DRAFT: "Draft",
    SENT: "Terkirim WA",
    INVOICED: "Sudah Nota",
    CANCELLED: "Dibatalkan",
};

export default function DesignerDashboardPage() {
    const router = useRouter();
    const session = useDesignerSession();
    const [sos, setSos] = useState<SalesOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!session) return;
        designerListSOs(session.id, session.pin)
            .then(setSos)
            .catch(() => setError("Gagal memuat data SO"))
            .finally(() => setLoading(false));
    }, [session]);

    function logout() {
        clearDesignerSession();
        router.replace("/so-designer");
    }

    if (!session) return null;

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-3 flex items-center justify-between shadow-lg shadow-indigo-500/20 sticky top-0 z-10">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="rounded-lg bg-white/15 backdrop-blur-sm p-2 ring-1 ring-white/20 shrink-0">
                        <FileSignature className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                        <div className="font-semibold leading-tight truncate">Portal Desainer</div>
                        <div className="text-xs text-indigo-100 truncate">
                            {session.name}
                            {session.branchName && <> · <span className="font-semibold text-yellow-300">{session.branchName}</span></>}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <Link
                        href="/so-designer/new"
                        className="inline-flex items-center gap-1.5 bg-white text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-indigo-50 transition-colors shadow-sm"
                    >
                        <Plus className="h-3.5 w-3.5" /> Buat SO
                    </Link>
                    <button onClick={logout} className="p-1.5 hover:bg-white/15 rounded-lg transition-colors" title="Keluar">
                        <LogOut className="h-4 w-4" />
                    </button>
                </div>
            </div>

            <div className="max-w-3xl mx-auto p-4 space-y-4">
                <div className="flex items-baseline justify-between">
                    <h2 className="font-semibold text-slate-700 dark:text-slate-200">Sales Order Kamu</h2>
                    {!loading && sos.length > 0 && (
                        <span className="text-xs text-slate-500 dark:text-slate-400">{sos.length} SO</span>
                    )}
                </div>

                {error && <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 rounded-lg px-3 py-2 text-sm">{error}</div>}

                {loading ? (
                    <div className="flex justify-center py-10 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /></div>
                ) : sos.length === 0 ? (
                    <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-12 text-center">
                        <div className="mx-auto h-14 w-14 rounded-full bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center mb-3">
                            <FileSignature className="h-7 w-7 text-indigo-400" />
                        </div>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Belum ada Sales Order</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4">Klik tombol di bawah untuk mulai membuat SO pertama.</p>
                        <Link
                            href="/so-designer/new"
                            className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                        >
                            <Plus className="h-4 w-4" /> Buat SO Pertama
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {sos.map(so => (
                            <div key={so.id} className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex items-center gap-3 shadow-sm hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-900 transition-all">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">{so.soNumber}</span>
                                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[so.status]}`}>
                                            {STATUS_LABEL[so.status]}
                                        </span>
                                    </div>
                                    <div className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate mt-0.5">{so.customerName}</div>
                                    <div className="text-xs text-slate-400 dark:text-slate-500">
                                        {so.items.length} item · {dayjs(so.createdAt).format("DD MMM YYYY")}
                                        {so.deadline && <> · Deadline: <span className="text-amber-600 dark:text-amber-400 font-medium">{dayjs(so.deadline).format("DD MMM")}</span></>}
                                    </div>
                                </div>
                                <div className="flex gap-1 shrink-0">
                                    {so.status === "INVOICED" && so.transaction && (
                                        <span className="hidden sm:inline-flex items-center px-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[10px] font-mono font-semibold border border-emerald-200 dark:border-emerald-900">
                                            {so.transaction.invoiceNumber}
                                        </span>
                                    )}
                                    <Link
                                        href={`/so-designer/detail/${so.id}`}
                                        className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 hover:border-indigo-300 dark:hover:border-indigo-800 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                        title="Detail"
                                    >
                                        <Eye className="h-4 w-4" />
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
