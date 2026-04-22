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
    DRAFT: "bg-gray-100 text-gray-700",
    SENT: "bg-blue-100 text-blue-700",
    INVOICED: "bg-emerald-100 text-emerald-700",
    CANCELLED: "bg-red-100 text-red-700",
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
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <div className="bg-indigo-700 text-white px-4 py-3 flex items-center justify-between shadow">
                <div className="flex items-center gap-2">
                    <FileSignature className="h-5 w-5" />
                    <div>
                        <div className="font-semibold">Portal Desainer</div>
                        <div className="text-xs text-indigo-200">Halo, {session.name} 👋</div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Link
                        href="/so-designer/new"
                        className="inline-flex items-center gap-1 bg-white text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-indigo-50"
                    >
                        <Plus className="h-3.5 w-3.5" /> Buat SO
                    </Link>
                    <button onClick={logout} className="p-1.5 hover:bg-indigo-600 rounded-lg">
                        <LogOut className="h-4 w-4" />
                    </button>
                </div>
            </div>

            <div className="max-w-3xl mx-auto p-4 space-y-4">
                <h2 className="font-semibold text-slate-700">Sales Order Kamu</h2>

                {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">{error}</div>}

                {loading ? (
                    <div className="flex justify-center py-10 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /></div>
                ) : sos.length === 0 ? (
                    <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-slate-400 text-sm">
                        Belum ada SO. Klik &ldquo;Buat SO&rdquo; untuk mulai.
                    </div>
                ) : (
                    <div className="space-y-2">
                        {sos.map(so => (
                            <div key={so.id} className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-3 shadow-sm">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-mono text-xs font-bold text-slate-800">{so.soNumber}</span>
                                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[so.status]}`}>
                                            {STATUS_LABEL[so.status]}
                                        </span>
                                    </div>
                                    <div className="text-sm font-medium text-slate-700 truncate mt-0.5">{so.customerName}</div>
                                    <div className="text-xs text-slate-400">
                                        {so.items.length} item • {dayjs(so.createdAt).format("DD MMM YYYY")}
                                        {so.deadline && <> • Deadline: {dayjs(so.deadline).format("DD MMM")}</>}
                                    </div>
                                </div>
                                <div className="flex gap-1 shrink-0">
                                    <Link
                                        href={`/so-designer/detail/${so.id}`}
                                        className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
                                        title="Detail"
                                    >
                                        <Eye className="h-4 w-4" />
                                    </Link>
                                    {so.status === "INVOICED" && so.transaction && (
                                        <span className="p-2 rounded-lg bg-emerald-50 text-emerald-600 text-xs font-mono">
                                            {so.transaction.invoiceNumber}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
