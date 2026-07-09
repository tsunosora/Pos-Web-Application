"use client";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Flame, Snowflake } from "lucide-react";
import { getFinanceHeatmap } from "@/lib/api/finance-analytics";
import { useBranchStore } from "@/store/branch-store";

const fmtRp = (n: number) => "Rp " + Math.round(Number(n) || 0).toLocaleString("id-ID");
const DOW_SHORT = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

export function HeatmapPanel({ startDate, endDate }: { startDate: string; endDate: string }) {
    const activeBranchId = useBranchStore((s) => s.activeBranchId);
    const { data, isLoading } = useQuery({
        queryKey: ["finance-heatmap", startDate, endDate, activeBranchId],
        queryFn: () => getFinanceHeatmap(startDate, endDate),
    });

    const maxCount = useMemo(() => Math.max(1, ...(data?.grid.map((g) => g.count) ?? [1])), [data]);
    const cell = useMemo(() => {
        const m: Record<string, number> = {};
        data?.grid.forEach((g) => { m[`${g.dow}-${g.hour}`] = g.count; });
        return m;
    }, [data]);

    if (isLoading) return <div className="h-40 grid place-items-center text-muted-foreground"><Loader2 className="animate-spin" /></div>;
    if (!data) return null;

    const hours = Array.from({ length: 24 }, (_, h) => h);
    return (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm">
                    <Flame size={16} className="text-orange-500" />
                    <span className="text-muted-foreground">Terramai:</span>
                    <span className="font-medium">{data.busiestDay?.label} ({data.busiestDay?.count}× · {fmtRp(data.busiestDay?.revenue || 0)})</span>
                </div>
                {data.quietestDay && (
                    <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm">
                        <Snowflake size={16} className="text-sky-500" />
                        <span className="text-muted-foreground">Tersepi:</span>
                        <span className="font-medium">{data.quietestDay.label} ({data.quietestDay.count}× · {fmtRp(data.quietestDay.revenue)})</span>
                    </div>
                )}
            </div>

            <div className="overflow-x-auto">
                <div className="min-w-[560px]">
                    <div className="grid" style={{ gridTemplateColumns: "auto repeat(24, minmax(0, 1fr))" }}>
                        <div />
                        {hours.map((h) => (
                            <div key={h} className="text-[9px] text-center text-muted-foreground pb-1">{h % 3 === 0 ? h : ""}</div>
                        ))}
                        {DOW_SHORT.map((label, dow) => (
                            <div key={dow} className="contents">
                                <div className="text-xs text-muted-foreground pr-2 flex items-center justify-end">{label}</div>
                                {hours.map((h) => {
                                    const c = cell[`${dow}-${h}`] || 0;
                                    const intensity = c / maxCount;
                                    return (
                                        <div key={h} className="aspect-square m-[1px] rounded-[3px] border border-border/40" title={`${label} jam ${h}:00 — ${c} transaksi`}
                                            style={{ backgroundColor: c === 0 ? "transparent" : `color-mix(in srgb, var(--primary) ${Math.round(20 + intensity * 80)}%, transparent)` }} />
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-2">Kolom = jam (0–23), baris = hari. Makin pekat = makin rame transaksi.</p>
                </div>
            </div>
        </div>
    );
}
