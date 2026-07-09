"use client";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ShieldCheck, AlertTriangle, Scale, TrendingDown, HelpCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { getFinanceAnomalies, type FinanceAnomaly } from "@/lib/api/finance-analytics";
import { useBranchStore } from "@/store/branch-store";

const PAGE_SIZE = 5;

const fmtDate = (s: string) => new Date(s + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

const TYPE_ICON: Record<string, typeof Scale> = { SHIFT_DIFF: Scale, OUTLIER: AlertTriangle, UNEXPLAINED: HelpCircle, DIP: TrendingDown };
const SEV_CLS: Record<FinanceAnomaly["severity"], string> = {
    high: "border-red-500/40 bg-red-500/5",
    med: "border-amber-500/40 bg-amber-500/5",
    low: "border-border bg-muted/30",
};
const SEV_BADGE: Record<FinanceAnomaly["severity"], string> = {
    high: "bg-red-500/15 text-red-600",
    med: "bg-amber-500/15 text-amber-600",
    low: "bg-muted text-muted-foreground",
};
const SEV_LABEL: Record<FinanceAnomaly["severity"], string> = { high: "Tinggi", med: "Sedang", low: "Rendah" };

export function AnomalyPanel({ startDate, endDate }: { startDate: string; endDate: string }) {
    const activeBranchId = useBranchStore((s) => s.activeBranchId);
    const [page, setPage] = useState(1);
    const { data, isLoading } = useQuery({
        queryKey: ["finance-anomalies", startDate, endDate, activeBranchId],
        queryFn: () => getFinanceAnomalies(startDate, endDate),
    });

    const count = data?.count ?? 0;
    const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
    // reset ke halaman 1 kalau data/rentang berubah
    useEffect(() => { setPage(1); }, [startDate, endDate, activeBranchId, count]);
    const pageItems = useMemo(() => (data?.anomalies ?? []).slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [data, page]);

    if (isLoading) return <div className="h-32 grid place-items-center text-muted-foreground"><Loader2 className="animate-spin" /></div>;
    if (!data || count === 0) {
        return (
            <div className="flex items-center gap-3 rounded-xl border border-green-500/30 bg-green-500/5 p-4 text-sm">
                <ShieldCheck className="text-green-600 shrink-0" />
                <span>Tidak ada anomali terdeteksi — arus kas terlihat sehat pada periode ini. ✅</span>
            </div>
        );
    }
    return (
        <div className="space-y-2">
            {pageItems.map((a, i) => {
                const Icon = TYPE_ICON[a.type] || AlertTriangle;
                return (
                    <div key={(page - 1) * PAGE_SIZE + i} className={`flex items-start gap-3 rounded-xl border p-3 text-sm ${SEV_CLS[a.severity]}`}>
                        <Icon size={18} className="mt-0.5 shrink-0 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${SEV_BADGE[a.severity]}`}>{SEV_LABEL[a.severity]}</span>
                                <span className="text-xs text-muted-foreground">{fmtDate(a.date)}</span>
                            </div>
                            <p className="mt-1">{a.reason}</p>
                        </div>
                    </div>
                );
            })}

            {totalPages > 1 && (
                <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-muted-foreground">
                        {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, count)} dari {count} anomali
                    </span>
                    <div className="flex items-center gap-1">
                        <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                            className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed" aria-label="Sebelumnya">
                            <ChevronLeft size={15} />
                        </button>
                        <span className="text-xs text-muted-foreground tabular-nums px-1">{page}/{totalPages}</span>
                        <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                            className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed" aria-label="Berikutnya">
                            <ChevronRight size={15} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
