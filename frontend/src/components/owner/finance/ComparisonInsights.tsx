"use client";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Lightbulb, ArrowUp, ArrowDown } from "lucide-react";
import { getFinanceComparison } from "@/lib/api/finance-analytics";
import { useBranchStore } from "@/store/branch-store";

const fmtRp = (n: number) => "Rp " + Math.round(Number(n) || 0).toLocaleString("id-ID");

function DeltaCard({ label, current, delta, pct, invert }: { label: string; current: number; delta: number; pct: number; invert?: boolean }) {
    // invert: untuk pengeluaran, naik = jelek (merah)
    const good = invert ? delta < 0 : delta > 0;
    const neutral = delta === 0;
    const cls = neutral ? "text-muted-foreground" : good ? "text-green-600" : "text-red-600";
    const Icon = delta >= 0 ? ArrowUp : ArrowDown;
    return (
        <div className="rounded-xl border border-border bg-card p-3">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="text-lg font-semibold mt-0.5">{fmtRp(current)}</div>
            {!neutral && (
                <div className={`text-xs mt-0.5 inline-flex items-center gap-0.5 ${cls}`}>
                    <Icon size={12} /> {pct > 0 ? "+" : ""}{pct}% ({delta > 0 ? "+" : ""}{fmtRp(delta)})
                </div>
            )}
        </div>
    );
}

export function ComparisonInsights({ startDate, endDate, includeFixed }: { startDate: string; endDate: string; includeFixed: boolean }) {
    const activeBranchId = useBranchStore((s) => s.activeBranchId);
    const { data, isLoading } = useQuery({
        queryKey: ["finance-comparison", startDate, endDate, includeFixed, activeBranchId],
        queryFn: () => getFinanceComparison(startDate, endDate, includeFixed),
    });

    if (isLoading) return <div className="h-28 grid place-items-center text-muted-foreground"><Loader2 className="animate-spin" /></div>;
    if (!data) return null;

    return (
        <div className="space-y-3">
            {data.insights.length > 0 && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-1.5">
                    {data.insights.map((s, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm">
                            <Lightbulb size={15} className="mt-0.5 shrink-0 text-amber-500" />
                            <span>{s}</span>
                        </div>
                    ))}
                    <p className="text-[10px] text-muted-foreground pt-1">Dibanding periode sebelumnya ({data.previous.period.startDate} – {data.previous.period.endDate}).</p>
                </div>
            )}
            <div className="grid grid-cols-3 gap-3">
                <DeltaCard label="Omzet" current={data.current.income} delta={data.delta.income} pct={data.delta.incomePct} />
                <DeltaCard label="Pengeluaran" current={data.current.expense} delta={data.delta.expense} pct={data.delta.expensePct} invert />
                <DeltaCard label="Laba Bersih" current={data.current.net} delta={data.delta.net} pct={data.delta.netPct} />
            </div>
        </div>
    );
}
