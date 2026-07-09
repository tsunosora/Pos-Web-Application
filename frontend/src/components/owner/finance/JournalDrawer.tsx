"use client";
import { useQuery } from "@tanstack/react-query";
import { X, Loader2, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { getFinanceJournal } from "@/lib/api/finance-analytics";
import { useBranchStore } from "@/store/branch-store";

const fmtRp = (n: number) => "Rp " + Math.round(Number(n) || 0).toLocaleString("id-ID");
const fmtDate = (s: string) => new Date(s + "T00:00:00").toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

export function JournalDrawer({ open, startDate, endDate, includeFixed, title, onClose }: { open: boolean; startDate: string; endDate: string; includeFixed: boolean; title?: string; onClose: () => void }) {
    const activeBranchId = useBranchStore((s) => s.activeBranchId);
    const { data, isLoading } = useQuery({
        queryKey: ["finance-journal", startDate, endDate, includeFixed, activeBranchId],
        queryFn: () => getFinanceJournal(startDate, endDate, includeFixed),
        enabled: open,
    });

    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-lg h-full bg-card border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
                <div className="flex items-center gap-2 p-4 border-b border-border">
                    <div className="flex-1">
                        <h2 className="font-semibold">{title || "Jurnal Keuangan"}</h2>
                        <p className="text-xs text-muted-foreground">{startDate === endDate ? fmtDate(startDate) : `${fmtDate(startDate)} – ${fmtDate(endDate)}`}</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted"><X size={18} /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {isLoading ? (
                        <div className="h-40 grid place-items-center text-muted-foreground"><Loader2 className="animate-spin" /></div>
                    ) : !data || data.days.length === 0 ? (
                        <div className="h-40 grid place-items-center text-muted-foreground text-sm">Tidak ada pergerakan uang pada periode ini.</div>
                    ) : (
                        data.days.map((day) => (
                            <div key={day.date} className="rounded-xl border border-border overflow-hidden">
                                <div className="flex items-center justify-between px-3 py-2 bg-muted/50 text-sm">
                                    <span className="font-medium">{fmtDate(day.date)}</span>
                                    <span className="text-muted-foreground">Saldo: {fmtRp(day.closingBalance)}</span>
                                </div>
                                <div className="divide-y divide-border">
                                    {day.entries.map((e, i) => (
                                        <div key={i} className="flex items-center gap-3 px-3 py-2 text-sm">
                                            <span className={`shrink-0 grid place-items-center w-7 h-7 rounded-full ${e.type === "INCOME" ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"}`}>
                                                {e.type === "INCOME" ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <div className="truncate">{e.label}</div>
                                                <div className="text-xs text-muted-foreground">{e.category}{e.paymentMethod ? ` · ${e.paymentMethod}` : ""}{e.source === "fixed" ? " · beban tetap" : ""}</div>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <div className={e.type === "INCOME" ? "text-green-600 font-medium" : "text-red-600 font-medium"}>{e.type === "INCOME" ? "+" : "−"}{fmtRp(e.amount)}</div>
                                                <div className="text-xs text-muted-foreground">{fmtRp(e.runningBalance)}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex justify-between px-3 py-2 text-xs bg-muted/30">
                                    <span className="text-green-600">Masuk {fmtRp(day.income)}</span>
                                    <span className="text-red-600">Keluar {fmtRp(day.expense)}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
