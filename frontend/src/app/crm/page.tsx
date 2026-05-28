"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getKpiReport, type KpiPeriod, LEAD_SOURCE_LABEL } from "@/lib/api";
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
    PieChart, Pie, Legend,
} from "recharts";
import {
    Clock, Target, ClipboardCheck, RotateCcw, Trophy, Sparkles, Loader2, Calendar, TrendingUp, TrendingDown, Hourglass,
} from "lucide-react";
import dayjs from "dayjs";
import "dayjs/locale/id";
dayjs.locale("id");

const PERIOD_OPTIONS: { value: KpiPeriod; label: string }[] = [
    { value: "today", label: "Hari Ini" },
    { value: "week", label: "7 Hari" },
    { value: "month", label: "Bulan Ini" },
    { value: "custom", label: "Custom" },
];

const SOURCE_COLOR: Record<string, string> = {
    WHATSAPP: "#25D366",
    INSTAGRAM: "#E1306C",
    FACEBOOK: "#1877F2",
    TIKTOK: "#000000",
    MARKETPLACE: "#F97316",
    REFERRAL: "#10B981",
    WEBSITE: "#6366F1",
    WALK_IN: "#F59E0B",
    REPEAT_ORDER: "#8B5CF6",
    OTHER: "#6B7280",
};

export default function CrmDashboardPage() {
    const [period, setPeriod] = useState<KpiPeriod>("month");
    const [customStart, setCustomStart] = useState(dayjs().startOf("month").format("YYYY-MM-DD"));
    const [customEnd, setCustomEnd] = useState(dayjs().format("YYYY-MM-DD"));

    const { data, isLoading } = useQuery({
        queryKey: ["crm-kpi", period, customStart, customEnd],
        queryFn: () => getKpiReport({
            period,
            start: period === "custom" ? customStart : undefined,
            end: period === "custom" ? customEnd : undefined,
        }),
        staleTime: 60_000,
    });

    const sourceChartData = useMemo(() => {
        return (data?.leadsBySource ?? []).map(s => ({
            name: (LEAD_SOURCE_LABEL as Record<string, string>)[s.source] || s.source,
            value: s.count,
            source: s.source,
        }));
    }, [data]);

    return (
        <div className="space-y-4">
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Sparkles className="h-6 w-6 text-indigo-600" />
                    CRM Dashboard
                </h1>
                <p className="text-sm text-gray-500">
                    Metrik performa CRM: response time, closing rate, follow-up compliance, repeat order rate, & leaderboard CS
                </p>
            </div>

            {/* Period filter */}
            <div className="flex gap-2 flex-wrap items-center">
                {PERIOD_OPTIONS.map(p => (
                    <button
                        key={p.value}
                        onClick={() => setPeriod(p.value)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                            period === p.value ? "bg-indigo-600 text-white shadow" : "bg-gray-100 hover:bg-gray-200"
                        }`}
                    >
                        {p.label}
                    </button>
                ))}
                {period === "custom" && (
                    <div className="flex gap-2 items-center text-sm">
                        <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
                            className="border border-gray-300 rounded px-2 py-1" />
                        <span>—</span>
                        <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                            className="border border-gray-300 rounded px-2 py-1" />
                    </div>
                )}
                {data && (
                    <div className="text-xs text-gray-500 ml-auto flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {dayjs(data.period.start).format("DD MMM YY")} — {dayjs(data.period.end).format("DD MMM YY")}
                    </div>
                )}
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-12 text-gray-500">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" /> Memuat...
                </div>
            ) : !data ? (
                <div className="bg-white border rounded-xl p-8 text-center text-gray-500">
                    Tidak ada data
                </div>
            ) : (
                <>
                    {/* Summary cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                        <MetricCard
                            icon={<Clock className="h-5 w-5" />}
                            label="Avg Response Time"
                            value={`${data.metrics.responseTimeAvgHrs} jam`}
                            sub={`dari ${data.totals.totalLeads} lead`}
                            color="bg-blue-50 border-blue-200 text-blue-700"
                        />
                        <MetricCard
                            icon={<Target className="h-5 w-5" />}
                            label="Closing Rate"
                            value={`${(data.metrics.closingRate * 100).toFixed(1)}%`}
                            sub={`${data.totals.closedWon} closing, ${data.totals.closedLost} lost`}
                            color="bg-emerald-50 border-emerald-200 text-emerald-700"
                        />
                        <MetricCard
                            icon={<ClipboardCheck className="h-5 w-5" />}
                            label="FU Compliance"
                            value={`${(data.metrics.fuComplianceRate * 100).toFixed(1)}%`}
                            sub={`${data.totals.compliant}/${data.totals.totalFu} FU on-time`}
                            color="bg-amber-50 border-amber-200 text-amber-700"
                        />
                        <MetricCard
                            icon={<RotateCcw className="h-5 w-5" />}
                            label="Repeat Order Rate"
                            value={`${(data.metrics.repeatOrderRate * 100).toFixed(1)}%`}
                            sub={`${data.totals.customersRepeat}/${data.totals.customersWithOrder} customer`}
                            color="bg-purple-50 border-purple-200 text-purple-700"
                        />
                        <MetricCard
                            icon={<TrendingUp className="h-5 w-5" />}
                            label="Nilai WON"
                            value={data.totals.wonValue > 0
                                ? `Rp ${(data.totals.wonValue / 1_000_000).toFixed(1)}jt`
                                : "Rp 0"}
                            sub={`dari ${data.totals.closedWon} deal closing`}
                            color="bg-emerald-50 border-emerald-200 text-emerald-700"
                        />
                        <MetricCard
                            icon={<TrendingDown className="h-5 w-5" />}
                            label="Nilai Lost"
                            value={data.totals.lostValue > 0
                                ? `Rp ${(data.totals.lostValue / 1_000_000).toFixed(1)}jt`
                                : "Rp 0"}
                            sub={`dari ${data.totals.closedLost} lead gagal`}
                            color="bg-red-50 border-red-200 text-red-700"
                        />
                        <MetricCard
                            icon={<Hourglass className="h-5 w-5" />}
                            label="Nilai Akan Datang"
                            value={data.totals.pendingValue > 0
                                ? `Rp ${(data.totals.pendingValue / 1_000_000).toFixed(1)}jt`
                                : "Rp 0"}
                            sub="Saldo piutang belum lunas (PENDING + DP)"
                            color="bg-amber-50 border-amber-200 text-amber-700"
                        />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Leads by Source */}
                        <div className="bg-white rounded-xl border p-5">
                            <h2 className="font-bold text-base mb-3">Lead Per Sumber</h2>
                            {sourceChartData.length === 0 ? (
                                <p className="text-sm text-gray-500 text-center py-8">Belum ada lead di periode ini.</p>
                            ) : (
                                <ResponsiveContainer width="100%" height={280}>
                                    <PieChart>
                                        <Pie
                                            data={sourceChartData}
                                            dataKey="value"
                                            nameKey="name"
                                            cx="50%"
                                            cy="50%"
                                            outerRadius={90}
                                            label={(entry: any) => `${entry.name} (${entry.value})`}
                                        >
                                            {sourceChartData.map((entry, i) => (
                                                <Cell key={i} fill={SOURCE_COLOR[entry.source] || "#999"} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            )}
                        </div>

                        {/* Leads by Source — Bar fallback */}
                        <div className="bg-white rounded-xl border p-5">
                            <h2 className="font-bold text-base mb-3">Distribusi (Bar)</h2>
                            {sourceChartData.length === 0 ? (
                                <p className="text-sm text-gray-500 text-center py-8">—</p>
                            ) : (
                                <ResponsiveContainer width="100%" height={280}>
                                    <BarChart data={sourceChartData} margin={{ top: 20, right: 10, left: -10, bottom: 5 }}>
                                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                                        <Tooltip />
                                        <Bar dataKey="value">
                                            {sourceChartData.map((entry, i) => (
                                                <Cell key={i} fill={SOURCE_COLOR[entry.source] || "#999"} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>

                    {/* Leaderboard */}
                    <div className="bg-white rounded-xl border p-5">
                        <h2 className="font-bold text-base mb-3 flex items-center gap-2">
                            <Trophy className="h-5 w-5 text-amber-500" />
                            Leaderboard CS
                        </h2>
                        {data.leaderboard.length === 0 ? (
                            <p className="text-sm text-gray-500 text-center py-6">
                                Belum ada lead yang ter-assign ke user di periode ini.
                            </p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b text-xs text-gray-500 uppercase">
                                            <th className="text-left py-2 px-2">#</th>
                                            <th className="text-left py-2 px-2">Nama CS</th>
                                            <th className="text-right py-2 px-2">Leads</th>
                                            <th className="text-right py-2 px-2">Closing</th>
                                            <th className="text-right py-2 px-2">Lost</th>
                                            <th className="text-right py-2 px-2">Rate</th>
                                            <th className="text-right py-2 px-2">Nilai WON</th>
                                            <th className="text-right py-2 px-2">Nilai Akan Datang</th>
                                            <th className="text-right py-2 px-2">Nilai Lost</th>
                                            <th className="text-right py-2 px-2">Avg Response</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.leaderboard.map((row, i) => (
                                            <tr key={row.userId} className="border-t hover:bg-gray-50">
                                                <td className="py-2 px-2">
                                                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                                                </td>
                                                <td className="py-2 px-2 font-semibold">{row.name}</td>
                                                <td className="py-2 px-2 text-right font-mono text-gray-600">{row.leadsHandled}</td>
                                                <td className="py-2 px-2 text-right font-mono text-emerald-700 font-semibold">{row.dealsClosed}</td>
                                                <td className="py-2 px-2 text-right font-mono text-red-600">{row.dealsLost}</td>
                                                <td className="py-2 px-2 text-right font-mono">
                                                    {(row.closingRate * 100).toFixed(0)}%
                                                </td>
                                                <td className="py-2 px-2 text-right font-mono text-emerald-700">
                                                    {row.wonValue > 0
                                                        ? `Rp ${row.wonValue.toLocaleString('id-ID')}`
                                                        : <span className="text-gray-300">—</span>}
                                                </td>
                                                <td className="py-2 px-2 text-right font-mono text-amber-600">
                                                    {row.pendingValue > 0 ? (
                                                        <span title="Saldo piutang dari transaksi PENDING/DP belum lunas">
                                                            Rp {row.pendingValue.toLocaleString('id-ID')}
                                                        </span>
                                                    ) : <span className="text-gray-300">—</span>}
                                                </td>
                                                <td className="py-2 px-2 text-right font-mono text-red-600">
                                                    {row.lostValue > 0
                                                        ? `Rp ${row.lostValue.toLocaleString('id-ID')}`
                                                        : <span className="text-gray-300">—</span>}
                                                </td>
                                                <td className="py-2 px-2 text-right font-mono text-gray-500">
                                                    {row.avgResponseHrs != null
                                                        ? `${row.avgResponseHrs.toFixed(1)}h`
                                                        : <span className="text-gray-400">—</span>}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    {/* Footer: total row */}
                                    <tfoot>
                                        <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold text-xs">
                                            <td colSpan={2} className="py-2 px-2 text-gray-500">Total</td>
                                            <td className="py-2 px-2 text-right font-mono">{data.totals.totalLeads}</td>
                                            <td className="py-2 px-2 text-right font-mono text-emerald-700">{data.totals.closedWon}</td>
                                            <td className="py-2 px-2 text-right font-mono text-red-600">{data.totals.closedLost}</td>
                                            <td className="py-2 px-2 text-right font-mono">
                                                {(data.metrics.closingRate * 100).toFixed(0)}%
                                            </td>
                                            <td className="py-2 px-2 text-right font-mono text-emerald-700">
                                                {data.totals.wonValue > 0
                                                    ? `Rp ${data.totals.wonValue.toLocaleString('id-ID')}`
                                                    : '—'}
                                            </td>
                                            <td className="py-2 px-2 text-right font-mono text-amber-600">
                                                {data.totals.pendingValue > 0
                                                    ? `Rp ${data.totals.pendingValue.toLocaleString('id-ID')}`
                                                    : '—'}
                                            </td>
                                            <td className="py-2 px-2 text-right font-mono text-red-600">
                                                {data.totals.lostValue > 0
                                                    ? `Rp ${data.totals.lostValue.toLocaleString('id-ID')}`
                                                    : '—'}
                                            </td>
                                            <td className="py-2 px-2 text-right font-mono text-gray-500">
                                                {data.metrics.responseTimeAvgHrs > 0
                                                    ? `${data.metrics.responseTimeAvgHrs.toFixed(1)}h`
                                                    : '—'}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

function MetricCard({
    icon, label, value, sub, color,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
    sub: string;
    color: string;
}) {
    return (
        <div className={`border rounded-xl p-4 ${color}`}>
            <div className="flex items-center gap-2 mb-1 text-xs font-bold uppercase">
                {icon} {label}
            </div>
            <div className="text-2xl font-bold font-mono">{value}</div>
            <div className="text-xs opacity-70 mt-1">{sub}</div>
        </div>
    );
}
