"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getTaskSummary } from "@/lib/api";
import { ClipboardList, AlertTriangle, MoonStar, ArrowRight } from "lucide-react";

/**
 * Panel beban tugas per karyawan untuk owner — deteksi siapa yang idle
 * (0 tugas aktif) dan siapa yang punya tugas terlambat.
 */
export function TaskLoadPanel({ enabled = true }: { enabled?: boolean }) {
    const { data: rows = [], isLoading } = useQuery({
        queryKey: ["task-summary"],
        queryFn: getTaskSummary,
        enabled,
        staleTime: 60 * 1000,
    });

    return (
        <div className="rounded-xl glass-card p-3 sm:p-4">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <ClipboardList className="h-5 w-5 text-primary" />
                    <h3 className="text-sm font-bold text-foreground">Beban Tugas Karyawan</h3>
                </div>
                <Link href="/tugas" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                    Papan tugas <ArrowRight className="h-3 w-3" />
                </Link>
            </div>

            {isLoading ? (
                <p className="text-xs text-muted-foreground py-4 text-center">Memuat…</p>
            ) : rows.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">Belum ada tugas terdata.</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="text-muted-foreground border-b border-border/60">
                                <th className="text-left font-medium py-1.5">Karyawan</th>
                                <th className="text-center font-medium py-1.5">Belum</th>
                                <th className="text-center font-medium py-1.5">Proses</th>
                                <th className="text-center font-medium py-1.5">Selesai</th>
                                <th className="text-center font-medium py-1.5">Telat</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r) => {
                                const active = r.todo + r.inProgress;
                                const idle = active === 0;
                                return (
                                    <tr key={r.assigneeId ?? "none"} className="border-b border-border/40 last:border-0">
                                        <td className="py-1.5 pr-2">
                                            <span className="text-foreground font-medium">{r.name}</span>
                                            {idle && (
                                                <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                                                    <MoonStar className="h-3 w-3" /> idle
                                                </span>
                                            )}
                                        </td>
                                        <td className="text-center text-foreground">{r.todo}</td>
                                        <td className="text-center text-amber-600 dark:text-amber-400">{r.inProgress}</td>
                                        <td className="text-center text-emerald-600 dark:text-emerald-400">{r.done}</td>
                                        <td className="text-center">
                                            {r.overdue > 0 ? (
                                                <span className="inline-flex items-center gap-0.5 font-semibold text-red-600 dark:text-red-400">
                                                    <AlertTriangle className="h-3 w-3" /> {r.overdue}
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground">0</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
