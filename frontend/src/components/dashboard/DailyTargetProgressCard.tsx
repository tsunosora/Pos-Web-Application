"use client";

import { useQuery } from "@tanstack/react-query";
import { useBranchStore } from "@/store/branch-store";
import { getDailyTargetStatus, type DailyTargetBranch } from "@/lib/api/reports";
import { cn } from "@/lib/utils";
import { Target } from "lucide-react";

const rupiah = (n: number) => "Rp " + Math.round(n).toLocaleString("id-ID");

function Bar({ pct, met }: { pct: number; met: boolean }) {
    const w = Math.min(100, Math.max(0, pct));
    return (
        <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
                className={cn(
                    "h-full rounded-full transition-all duration-500",
                    met ? "bg-emerald-500" : w >= 60 ? "bg-amber-400" : "bg-red-500",
                )}
                style={{ width: `${w}%` }}
            />
        </div>
    );
}

export function DailyTargetProgressCard() {
    const activeBranchId = useBranchStore((s) => s.activeBranchId);
    const { data, isLoading } = useQuery({
        queryKey: ["daily-target-status", activeBranchId],
        queryFn: getDailyTargetStatus,
        refetchInterval: 5 * 60_000,
    });

    if (isLoading || !data || data.branches.length === 0) return null;

    const branches = data.branches;
    const totalOmzet = branches.reduce((s, b) => s + b.todayOmzet, 0);
    const totalTarget = branches.reduce((s, b) => s + b.dailyTarget, 0);
    const aggPct = totalTarget > 0 ? (totalOmzet / totalTarget) * 100 : 0;
    const aggMet = totalOmzet >= totalTarget && totalTarget > 0;
    const multi = branches.length > 1;

    return (
        <div className="glass-card rounded-2xl p-5">
            <div className="mb-3 flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                    <Target className="h-5 w-5 text-foreground" />
                </div>
                <div>
                    <p className="text-sm font-semibold text-foreground">Target Omzet Harian</p>
                    <p className="text-xs text-muted-foreground">Untuk menutup beban tetap bulanan</p>
                </div>
            </div>

            {/* Agregat / cabang tunggal */}
            <div className="mb-1 flex items-baseline justify-between">
                <span className="text-lg font-bold text-foreground">{rupiah(totalOmzet)}</span>
                <span className="text-xs text-muted-foreground">
                    target {rupiah(totalTarget)} · {Math.round(aggPct)}%
                </span>
            </div>
            <Bar pct={aggPct} met={aggMet} />
            {!aggMet && (
                <p className="mt-1.5 text-xs text-red-500">
                    Kurang {rupiah(totalTarget - totalOmzet)} lagi untuk target hari ini
                </p>
            )}

            {/* Rincian per cabang (mode Semua Cabang) */}
            {multi && (
                <div className="mt-4 space-y-3 border-t border-border/50 pt-3">
                    {branches.map((b: DailyTargetBranch) => (
                        <div key={b.branchId}>
                            <div className="mb-1 flex items-center justify-between text-xs">
                                <span className="font-medium text-foreground">{b.branchName}</span>
                                <span className={b.met ? "text-emerald-600" : "text-muted-foreground"}>
                                    {rupiah(b.todayOmzet)} / {rupiah(b.dailyTarget)}
                                </span>
                            </div>
                            <Bar pct={b.pct} met={b.met} />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
