"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getKpiReport, getProductTrend, getSourceBreakdown, type KpiPeriod, LEAD_SOURCE_LABEL } from "@/lib/api";
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
    PieChart, Pie, Legend, LineChart, Line,
} from "recharts";
import {
    Clock, Target, ClipboardCheck, RotateCcw, Trophy, Sparkles, Loader2, Calendar, TrendingUp, TrendingDown, Hourglass, Package,
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

                    {/* Tren Produk */}
                    <ProductTrendChart
                        period={period}
                        customStart={customStart}
                        customEnd={customEnd}
                        csOptions={(data?.leaderboard ?? []).map(r => ({ id: r.userId, name: r.name }))}
                    />

                    {/* Breakdown per Sumber (gaya Shopee) */}
                    <SourceBreakdownChart
                        period={period}
                        customStart={customStart}
                        customEnd={customEnd}
                        csOptions={(data?.leaderboard ?? []).map(r => ({ id: r.userId, name: r.name }))}
                    />

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
                                            <th className="text-right py-2 px-2 text-blue-600">Pcs Order</th>
                                            <th className="text-right py-2 px-2">Lost</th>
                                            <th className="text-right py-2 px-2 text-orange-600">Invalid</th>
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
                                                <td className="py-2 px-2 text-right font-mono text-blue-600 font-semibold">
                                                    {row.pcsOrdered > 0 ? `${row.pcsOrdered.toLocaleString('id-ID')} pcs` : <span className="text-gray-300">—</span>}
                                                </td>
                                                <td className="py-2 px-2 text-right font-mono text-red-600">{row.dealsLost}</td>
                                                <td className="py-2 px-2 text-right font-mono text-orange-600">
                                                    {row.invalidLeads > 0 ? row.invalidLeads : <span className="text-gray-300">—</span>}
                                                </td>
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
                                            <td className="py-2 px-2 text-right font-mono text-blue-600">
                                                {(data.totals.totalPcs ?? 0) > 0 ? `${data.totals.totalPcs.toLocaleString('id-ID')} pcs` : '—'}
                                            </td>
                                            <td className="py-2 px-2 text-right font-mono text-red-600">{data.totals.closedLost}</td>
                                            <td className="py-2 px-2 text-right font-mono text-orange-600">{data.totals.totalInvalid ?? 0}</td>
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

// Palet warna garis — diputar berdasarkan indeks seri
const TREND_COLORS = [
    "#6366F1", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
    "#06B6D4", "#EC4899", "#84CC16", "#F97316",
];

function ProductTrendChart({
    period, customStart, customEnd, csOptions,
}: {
    period: KpiPeriod;
    customStart: string;
    customEnd: string;
    csOptions: { id: number; name: string }[];
}) {
    const [mode, setMode] = useState<"category" | "product">("category");
    const [csId, setCsId] = useState<number | "ALL">("ALL");

    // Kalau CS terpilih tidak lagi ada di periode baru, reset ke Semua
    const csValid = csId === "ALL" || csOptions.some(c => c.id === csId);
    const effectiveCsId = csValid ? csId : "ALL";

    const { data, isLoading } = useQuery({
        queryKey: ["crm-product-trend", period, customStart, customEnd, effectiveCsId],
        queryFn: () => getProductTrend({
            period,
            start: period === "custom" ? customStart : undefined,
            end: period === "custom" ? customEnd : undefined,
            csId: effectiveCsId === "ALL" ? undefined : effectiveCsId,
        }),
        staleTime: 60_000,
    });

    const group = data ? data[mode] : null;
    const hasData = !!group && group.series.length > 0 && group.totals.some(t => t.pcs > 0);
    const grandTotal = group?.totals.reduce((s, t) => s + t.pcs, 0) ?? 0;

    return (
        <div className="bg-white rounded-xl border p-5">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                <h2 className="font-bold text-base flex items-center gap-2">
                    <Package className="h-5 w-5 text-indigo-500" />
                    Tren Produk Diorder
                    {data && (
                        <span className="text-xs font-normal text-gray-400">
                            ({data.bucketBy === "week" ? "per minggu" : "per hari"})
                        </span>
                    )}
                </h2>
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Filter CS */}
                    <select
                        value={effectiveCsId}
                        onChange={(e) => setCsId(e.target.value === "ALL" ? "ALL" : Number(e.target.value))}
                        className="text-xs font-semibold border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white outline-none focus:ring-2 focus:ring-indigo-300"
                    >
                        <option value="ALL">Semua CS</option>
                        {csOptions.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                    {/* Toggle Kategori / Produk */}
                    <div className="flex bg-gray-100 rounded-lg p-0.5 text-xs font-semibold">
                        <button
                            onClick={() => setMode("category")}
                            className={`px-3 py-1 rounded-md transition-colors ${mode === "category" ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                        >
                            Kategori
                        </button>
                        <button
                            onClick={() => setMode("product")}
                            className={`px-3 py-1 rounded-md transition-colors ${mode === "product" ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                        >
                            Produk
                        </button>
                    </div>
                </div>
            </div>

            {/* Pisahan sumber: dari lead vs dari walk-in (saat filter CS aktif) */}
            {effectiveCsId !== "ALL" && data?.sourceSplit && (
                <div className="flex flex-wrap items-center gap-2 mb-3 text-xs">
                    <span className="text-gray-500">
                        Order <strong className="text-gray-700">{csOptions.find(c => c.id === effectiveCsId)?.name}</strong>:
                    </span>
                    <div className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 rounded-full px-2.5 py-1">
                        <span className="font-medium text-indigo-700">Dari Lead</span>
                        <span className="font-mono text-indigo-600">{data.sourceSplit.lead.toLocaleString("id-ID")} pcs</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">
                        <span className="font-medium text-amber-700">Dari Walk-in</span>
                        <span className="font-mono text-amber-600">{data.sourceSplit.walkin.toLocaleString("id-ID")} pcs</span>
                    </div>
                    <span className="text-[11px] text-gray-400">
                        (walk-in dicocokkan dari Kasir/Staff)
                    </span>
                </div>
            )}

            {isLoading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                </div>
            ) : !hasData ? (
                <p className="text-sm text-gray-500 text-center py-12">
                    Belum ada order di periode ini.
                </p>
            ) : (
                <>
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={group!.data} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
                            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                            <Tooltip
                                formatter={(value: any, name: any) => [`${value} pcs`, name]}
                                contentStyle={{ fontSize: 12 }}
                            />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                            {group!.series.map((s, i) => (
                                <Line
                                    key={s}
                                    type="monotone"
                                    dataKey={s}
                                    stroke={TREND_COLORS[i % TREND_COLORS.length]}
                                    strokeWidth={2}
                                    dot={{ r: 2 }}
                                    activeDot={{ r: 5 }}
                                />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>

                    {/* Ringkasan total per seri */}
                    <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
                        {group!.totals
                            .filter(t => t.pcs > 0)
                            .map((t, i) => (
                                <div key={t.name} className="flex items-center gap-1.5 text-xs bg-gray-50 border rounded-full px-2.5 py-1">
                                    <span
                                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                        style={{ backgroundColor: TREND_COLORS[group!.series.indexOf(t.name) % TREND_COLORS.length] }}
                                    />
                                    <span className="font-medium text-gray-700">{t.name}</span>
                                    <span className="font-mono text-gray-500">{t.pcs.toLocaleString("id-ID")} pcs</span>
                                </div>
                            ))}
                        <div className="flex items-center gap-1.5 text-xs bg-indigo-50 border border-indigo-200 rounded-full px-2.5 py-1 ml-auto">
                            <span className="font-semibold text-indigo-700">Total</span>
                            <span className="font-mono text-indigo-600">{grandTotal.toLocaleString("id-ID")} pcs</span>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

// ── Breakdown per Sumber (gaya dashboard Shopee) ─────────────────────────────
const BREAKDOWN_STATUS: { value: string; label: string; on: string; off: string }[] = [
    { value: "CLOSED_WON",  label: "Closing", on: "bg-emerald-600 text-white border-emerald-600", off: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100" },
    { value: "CLOSED_LOST", label: "Lost",    on: "bg-red-600 text-white border-red-600",          off: "bg-red-50 text-red-700 border-red-200 hover:bg-red-100" },
    { value: "INVALID",     label: "Invalid", on: "bg-orange-500 text-white border-orange-500",    off: "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100" },
];

function fmtRpShort(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}jt`;
    if (n >= 1_000) return `${Math.round(n / 1_000)}rb`;
    return `${n}`;
}

function SourceBreakdownChart({
    period, customStart, customEnd, csOptions,
}: {
    period: KpiPeriod;
    customStart: string;
    customEnd: string;
    csOptions: { id: number; name: string }[];
}) {
    const [csId, setCsId] = useState<number | "ALL">("ALL");
    const [statuses, setStatuses] = useState<string[]>(["CLOSED_WON"]);
    const [metric, setMetric] = useState<"pcs" | "value">("pcs");
    const [activeSources, setActiveSources] = useState<string[]>([]);

    const csValid = csId === "ALL" || csOptions.some(c => c.id === csId);
    const effectiveCsId = csValid ? csId : "ALL";

    const { data, isLoading } = useQuery({
        queryKey: ["crm-source-breakdown", period, customStart, customEnd, effectiveCsId, statuses],
        queryFn: () => getSourceBreakdown({
            period,
            start: period === "custom" ? customStart : undefined,
            end: period === "custom" ? customEnd : undefined,
            csId: effectiveCsId === "ALL" ? undefined : effectiveCsId,
            status: statuses.join(","),
        }),
        staleTime: 60_000,
    });

    const sourceKeys = useMemo(() => (data?.sources ?? []).map(s => s.key), [data]);
    const keysSig = sourceKeys.join("|");

    // Default pilih top 5 sumber; pertahankan pilihan user yang masih valid
    useEffect(() => {
        if (!data) return;
        setActiveSources(prev => {
            const stillValid = prev.filter(k => sourceKeys.includes(k));
            if (stillValid.length > 0) return stillValid;
            return data.sources.slice(0, 5).map(s => s.key);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [keysSig]);

    const toggleStatus = (val: string) => {
        setStatuses(prev => {
            if (prev.includes(val)) {
                const next = prev.filter(s => s !== val);
                return next.length === 0 ? prev : next; // minimal 1 status
            }
            return [...prev, val];
        });
    };

    const toggleSource = (key: string) => {
        setActiveSources(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
    };

    const srcLabel = (key: string) => (LEAD_SOURCE_LABEL as Record<string, string>)[key] || key;
    const colorOf = (key: string) => TREND_COLORS[sourceKeys.indexOf(key) % TREND_COLORS.length];

    const chartData = data ? data[metric].data : [];
    const hasSources = (data?.sources.length ?? 0) > 0;

    const rateData = (data?.closingRateBySource ?? [])
        .filter(r => r.leadsValid > 0)
        .map(r => ({
            name: srcLabel(r.key),
            rate: Math.round(r.rate * 1000) / 10,   // % satu desimal
            won: r.closedWon,
            valid: r.leadsValid,
        }));

    return (
        <div className="bg-white rounded-xl border p-5">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                <h2 className="font-bold text-base flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-rose-500" />
                    Breakdown per Sumber
                    {data && (
                        <span className="text-xs font-normal text-gray-400">
                            ({data.bucketBy === "week" ? "per minggu" : "per hari"})
                        </span>
                    )}
                </h2>
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Filter CS */}
                    <select
                        value={effectiveCsId}
                        onChange={(e) => setCsId(e.target.value === "ALL" ? "ALL" : Number(e.target.value))}
                        className="text-xs font-semibold border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white outline-none focus:ring-2 focus:ring-rose-300"
                    >
                        <option value="ALL">Semua CS</option>
                        {csOptions.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                    {/* Toggle metrik */}
                    <div className="flex bg-gray-100 rounded-lg p-0.5 text-xs font-semibold">
                        <button
                            onClick={() => setMetric("pcs")}
                            className={`px-3 py-1 rounded-md transition-colors ${metric === "pcs" ? "bg-white text-rose-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                        >
                            Pcs
                        </button>
                        <button
                            onClick={() => setMetric("value")}
                            className={`px-3 py-1 rounded-md transition-colors ${metric === "value" ? "bg-white text-rose-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                        >
                            Nilai Rp
                        </button>
                    </div>
                </div>
            </div>

            {/* Filter status */}
            <div className="flex items-center gap-1.5 flex-wrap mb-3">
                <span className="text-[11px] text-gray-400 font-semibold uppercase mr-1">Status:</span>
                {BREAKDOWN_STATUS.map(s => (
                    <button
                        key={s.value}
                        onClick={() => toggleStatus(s.value)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${statuses.includes(s.value) ? s.on : s.off}`}
                    >
                        {s.label}
                    </button>
                ))}
                {metric === "pcs" && statuses.some(s => s !== "CLOSED_WON") && (
                    <span className="text-[10px] text-gray-400 italic ml-1">
                        Pcs hanya dari Closing — Lost/Invalid belum jadi order
                    </span>
                )}
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-rose-500" />
                </div>
            ) : !hasSources ? (
                <p className="text-sm text-gray-500 text-center py-12">
                    Belum ada data di periode & filter ini.
                </p>
            ) : (
                <>
                    {/* Kotak per sumber — klik untuk toggle ke chart */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-4">
                        {data!.sources.map(s => {
                            const active = activeSources.includes(s.key);
                            const color = colorOf(s.key);
                            return (
                                <button
                                    key={s.key}
                                    onClick={() => toggleSource(s.key)}
                                    className={`text-left rounded-lg border-2 p-2.5 transition-all ${active ? "bg-white shadow-sm" : "bg-gray-50 border-gray-200 opacity-60 hover:opacity-100"}`}
                                    style={active ? { borderColor: color } : undefined}
                                >
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: active ? color : "#cbd5e1" }} />
                                        <span className="text-xs font-semibold text-gray-700 truncate">{srcLabel(s.key)}</span>
                                    </div>
                                    <div className="font-mono font-bold text-sm text-gray-800">
                                        {metric === "pcs" ? `${s.pcs.toLocaleString("id-ID")} pcs` : `Rp ${s.value.toLocaleString("id-ID")}`}
                                    </div>
                                    <div className="font-mono text-[10px] text-gray-400">
                                        {metric === "pcs" ? `Rp ${fmtRpShort(s.value)}` : `${s.pcs.toLocaleString("id-ID")} pcs`}
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {/* Chart perbandingan */}
                    {activeSources.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-12">
                            Klik kotak sumber di atas untuk menampilkan grafik perbandingan.
                        </p>
                    ) : (
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                                <YAxis
                                    tick={{ fontSize: 11 }}
                                    allowDecimals={false}
                                    tickFormatter={(v: any) => metric === "value" ? fmtRpShort(Number(v)) : `${v}`}
                                />
                                <Tooltip
                                    formatter={(value: any, name: any) => [
                                        metric === "value" ? `Rp ${Number(value).toLocaleString("id-ID")}` : `${value} pcs`,
                                        srcLabel(String(name)),
                                    ]}
                                    contentStyle={{ fontSize: 12 }}
                                />
                                <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v: any) => srcLabel(String(v))} />
                                {activeSources.map(key => (
                                    <Line
                                        key={key}
                                        type="monotone"
                                        dataKey={key}
                                        stroke={colorOf(key)}
                                        strokeWidth={2}
                                        dot={{ r: 2 }}
                                        activeDot={{ r: 5 }}
                                    />
                                ))}
                            </LineChart>
                        </ResponsiveContainer>
                    )}

                    {/* Distribusi closing rate per sumber */}
                    {rateData.length > 0 && (
                        <div className="mt-5 pt-4 border-t">
                            <div className="flex items-center justify-between flex-wrap gap-1 mb-2">
                                <h3 className="text-sm font-bold text-gray-700">Closing Rate per Sumber</h3>
                                <span className="text-[10px] text-gray-400 italic">
                                    Dari semua lead di periode ini (lepas filter status di atas; Invalid tidak dihitung)
                                </span>
                            </div>
                            <ResponsiveContainer width="100%" height={Math.max(140, rateData.length * 36)}>
                                <BarChart data={rateData} layout="vertical" margin={{ top: 5, right: 40, left: 10, bottom: 5 }}>
                                    <XAxis type="number" domain={[0, 100]} tickFormatter={(v: any) => `${v}%`} tick={{ fontSize: 11 }} />
                                    <YAxis type="category" dataKey="name" width={95} tick={{ fontSize: 11 }} />
                                    <Tooltip
                                        formatter={(value: any, _n: any, p: any) => [
                                            `${value}%  (${p.payload.won}/${p.payload.valid} lead)`,
                                            "Closing rate",
                                        ]}
                                        contentStyle={{ fontSize: 12 }}
                                    />
                                    <Bar dataKey="rate" radius={[0, 4, 4, 0]} label={{ position: "right", formatter: (v: any) => `${v}%`, fontSize: 11, fill: "#6b7280" }}>
                                        {rateData.map((_e, i) => (
                                            <Cell key={i} fill={TREND_COLORS[i % TREND_COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
