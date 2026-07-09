"use client";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Landmark, ShieldCheck, ShieldAlert } from "lucide-react";
import { getFinanceReconciliation } from "@/lib/api/finance-analytics";
import { useBranchStore } from "@/store/branch-store";

const fmtRp = (n: number) => "Rp " + Math.round(Number(n) || 0).toLocaleString("id-ID");

export function ReconciliationPanel({ startDate, endDate }: { startDate: string; endDate: string }) {
    const activeBranchId = useBranchStore((s) => s.activeBranchId);
    const { data, isLoading } = useQuery({
        queryKey: ["finance-reconciliation", startDate, endDate, activeBranchId],
        queryFn: () => getFinanceReconciliation(startDate, endDate),
    });

    if (isLoading) return <div className="h-40 grid place-items-center text-muted-foreground"><Loader2 className="animate-spin" /></div>;
    if (!data) return null;

    const sr = data.shiftReconciliation;
    return (
        <div className="space-y-4">
            <div>
                <div className="flex items-center gap-2 text-sm font-medium mb-2"><Landmark size={15} /> Saldo Bank Saat Ini</div>
                <div className="space-y-1.5">
                    {data.bankAccounts.length === 0 ? (
                        <div className="text-sm text-muted-foreground">Belum ada rekening bank terdaftar.</div>
                    ) : data.bankAccounts.map((b) => (
                        <div key={b.name} className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{b.name}</span>
                            <span className="tabular-nums">{fmtRp(b.balance)}</span>
                        </div>
                    ))}
                    <div className="flex justify-between text-sm font-semibold pt-1.5 border-t border-border">
                        <span>Total</span><span className="tabular-nums">{fmtRp(data.totalBankBalance)}</span>
                    </div>
                </div>
            </div>

            <div className={`rounded-xl border p-3 ${data.hasIssue ? "border-red-500/40 bg-red-500/5" : "border-green-500/30 bg-green-500/5"}`}>
                <div className="flex items-center gap-2 text-sm font-medium">
                    {data.hasIssue ? <ShieldAlert size={16} className="text-red-600" /> : <ShieldCheck size={16} className="text-green-600" />}
                    Selisih Kas Terakumulasi (dari {sr.totalShifts} laporan shift)
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                    <div>
                        <div className="text-xs text-muted-foreground">Selisih bersih</div>
                        <div className={`font-semibold ${data.hasIssue ? "text-red-600" : ""}`}>{sr.netDifference > 0 ? "+" : ""}{fmtRp(sr.netDifference)}</div>
                    </div>
                    <div>
                        <div className="text-xs text-muted-foreground">Total selisih (abs)</div>
                        <div className="font-semibold">{fmtRp(sr.absDifference)}</div>
                    </div>
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">
                    {data.hasIssue
                        ? `${sr.shiftsWithDiff} shift punya selisih kas — indikasi pergerakan uang yang perlu ditelusuri.`
                        : "Tidak ada selisih kas pada shift periode ini. ✅"}
                </p>
            </div>
        </div>
    );
}
