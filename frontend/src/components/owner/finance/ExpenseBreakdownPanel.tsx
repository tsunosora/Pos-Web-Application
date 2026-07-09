"use client";
import { useQuery } from "@tanstack/react-query";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Loader2 } from "lucide-react";
import { getFinanceExpenseBreakdown } from "@/lib/api/finance-analytics";
import { useBranchStore } from "@/store/branch-store";

const fmtRp = (n: number) => "Rp " + Math.round(Number(n) || 0).toLocaleString("id-ID");
const COLORS = ["#f97316", "#3b82f6", "#a855f7", "#22c55e", "#eab308", "#ef4444", "#14b8a6", "#ec4899", "#64748b"];
const TOOLTIP_STYLE = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--foreground)" } as const;

export function ExpenseBreakdownPanel({ startDate, endDate, includeFixed }: { startDate: string; endDate: string; includeFixed: boolean }) {
    const activeBranchId = useBranchStore((s) => s.activeBranchId);
    const { data, isLoading } = useQuery({
        queryKey: ["finance-expense-breakdown", startDate, endDate, includeFixed, activeBranchId],
        queryFn: () => getFinanceExpenseBreakdown(startDate, endDate, includeFixed),
    });

    if (isLoading) return <div className="h-40 grid place-items-center text-muted-foreground"><Loader2 className="animate-spin" /></div>;
    if (!data || data.categories.length === 0) return <div className="h-40 grid place-items-center text-muted-foreground text-sm">Belum ada pengeluaran pada periode ini.</div>;

    const top = data.categories.slice(0, 8);
    const rest = data.categories.slice(8);
    const chartData = rest.length ? [...top, { category: "Lainnya", amount: rest.reduce((s, c) => s + c.amount, 0), pct: rest.reduce((s, c) => s + c.pct, 0) }] : top;

    return (
        <div className="grid sm:grid-cols-2 gap-4 items-center">
            <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie data={chartData} dataKey="amount" nameKey="category" innerRadius={45} outerRadius={80} paddingAngle={2}>
                            {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => fmtRp(Number(v))} />
                    </PieChart>
                </ResponsiveContainer>
            </div>
            <div className="space-y-1.5">
                <div className="flex justify-between text-sm font-medium pb-1 border-b border-border">
                    <span>Total pengeluaran</span><span>{fmtRp(data.total)}</span>
                </div>
                {chartData.map((c, i) => (
                    <div key={c.category} className="flex items-center gap-2 text-sm">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                        <span className="flex-1 truncate">{c.category}</span>
                        <span className="text-muted-foreground tabular-nums">{c.pct}%</span>
                        <span className="tabular-nums w-24 text-right">{fmtRp(c.amount)}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
