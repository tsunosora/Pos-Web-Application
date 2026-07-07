"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { getKpiReport, getProductTrend, getSourceBreakdown, getDesignerLeaderboard, getDesignOutput, getCsTrend, getDesignerTrend, getSettings, type KpiPeriod, type LeaderboardTrendReport, LEAD_SOURCE_LABEL } from "@/lib/api";
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
    PieChart, Pie, Legend, LineChart, Line,
} from "recharts";
import {
    Clock, Target, ClipboardCheck, RotateCcw, Trophy, Sparkles, Loader2, Calendar, TrendingUp, TrendingDown, Hourglass, Package, Palette, BarChart3, X, Share2, Copy, Check, ExternalLink, Megaphone,
} from "lucide-react";
import api from "@/lib/api/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import dayjs from "dayjs";
import "dayjs/locale/id";
dayjs.locale("id");

const PERIOD_OPTIONS: { value: KpiPeriod; label: string }[] = [
    { value: "today", label: "Hari Ini" },
    { value: "week", label: "7 Hari" },
    { value: "month", label: "Bulan Ini" },
    { value: "custom", label: "Custom" },
];

// Gelar juara #1 — berubah sesuai filter urutan leaderboard (gamifikasi biar CS semangat)
const CHAMP_TITLE: Record<string, { icon: string; label: string }> = {
    uang: { icon: "👑", label: "Sultan Cuan" },
    lead: { icon: "🔥", label: "Raja Lead" },
    rate: { icon: "🎯", label: "Sniper Closing" },
};
const MEDAL = ["🥇", "🥈", "🥉"];
const PODIUM_ACCENT = ["border-l-amber-400", "border-l-slate-400", "border-l-orange-400"];

// Palet warna chart konsisten (warna -500, kontras di light & dark)
const CHART_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];

// Style tooltip recharts dark-aware (dipakai di semua chart)
const CHART_TOOLTIP_STYLE = {
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    color: "var(--foreground)",
    boxShadow: "0 8px 24px -8px rgb(0 0 0 / 0.25)",
    fontSize: 12,
} as const;
const CHART_LABEL_STYLE = { color: "var(--foreground)", fontWeight: 600 } as const;
const CHART_ITEM_STYLE = { color: "var(--muted-foreground)" } as const;
const CHART_AXIS_TICK = { fill: "var(--muted-foreground)", fontSize: 12 } as const;
const CHART_LEGEND_STYLE = { fontSize: 12, color: "var(--muted-foreground)" } as const;

// Palet aksen avatar inisial leaderboard (diturunkan dari index)
const AVATAR_ACCENTS = [
    "bg-indigo-500/15 text-indigo-600 dark:text-indigo-300",
    "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
    "bg-amber-500/15 text-amber-600 dark:text-amber-300",
    "bg-rose-500/15 text-rose-600 dark:text-rose-300",
    "bg-violet-500/15 text-violet-600 dark:text-violet-300",
    "bg-cyan-500/15 text-cyan-600 dark:text-cyan-300",
    "bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-300",
    "bg-lime-500/15 text-lime-600 dark:text-lime-300",
];
function initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

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
    const { isOwner, isManager } = useCurrentUser();
    const [shareOpen, setShareOpen] = useState(false);
    const { data: storeSettings } = useQuery({
        queryKey: ["store-settings-marketing-pin"],
        queryFn: getSettings,
        enabled: isManager,
        staleTime: 5 * 60_000,
    });
    const [period, setPeriod] = useState<KpiPeriod>("month");
    const [customStart, setCustomStart] = useState(dayjs().startOf("month").format("YYYY-MM-DD"));
    const [customEnd, setCustomEnd] = useState(dayjs().format("YYYY-MM-DD"));

    // Filter global: cabang (owner only — staff terkunci di cabangnya) & staff/CS
    const [branchSel, setBranchSel] = useState<number | "ALL">("ALL");
    const [csSel, setCsSel] = useState<number | "ALL">("ALL");
    // 'all' eksplisit supaya pilihan dashboard menang atas pilihan cabang di topbar
    const branchParam: number | "all" | undefined = isOwner ? (branchSel === "ALL" ? "all" : branchSel) : undefined;
    const csParam = csSel === "ALL" ? undefined : csSel;

    const { data: branches } = useQuery({
        queryKey: ["active-branches"],
        queryFn: async () => (await api.get("/company-branches/active")).data as { id: number; name: string; code?: string | null }[],
        staleTime: 5 * 60_000,
        enabled: isOwner,
    });
    const { data: staffUsers } = useQuery({
        queryKey: ["users-for-kpi-filter"],
        queryFn: async () => (await api.get("/users")).data as { id: number; name: string | null; email: string }[],
        staleTime: 5 * 60_000,
    });

    const { data, isLoading } = useQuery({
        queryKey: ["crm-kpi", period, customStart, customEnd, branchParam, csParam],
        queryFn: () => getKpiReport({
            period,
            start: period === "custom" ? customStart : undefined,
            end: period === "custom" ? customEnd : undefined,
            branchId: branchParam,
            csId: csParam,
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

    // Urutan leaderboard CS — bisa dipilih: CS / Lead / Closing Rate / Uang
    const [leaderboardSort, setLeaderboardSort] = useState<"cs" | "lead" | "rate" | "uang">("uang");
    const [showCsChart, setShowCsChart] = useState(false);
    const sortedLeaderboard = useMemo(() => {
        const rows = [...(data?.leaderboard ?? [])];
        switch (leaderboardSort) {
            case "cs":   return rows.sort((a, b) => a.name.localeCompare(b.name));
            case "lead": return rows.sort((a, b) => b.leadsHandled - a.leadsHandled);
            case "rate": return rows.sort((a, b) => b.closingRate - a.closingRate);
            case "uang": return rows.sort((a, b) => (b.wonValue + b.walkinValue) - (a.wonValue + a.walkinValue));
            default:     return rows;
        }
    }, [data, leaderboardSort]);

    return (
        <div className="space-y-4">
            <div className="flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="h-11 w-11 rounded-xl flex items-center justify-center bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 shadow-sm shrink-0">
                    <Sparkles className="h-6 w-6" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">CRM Dashboard</h1>
                    <p className="text-sm text-muted-foreground">
                        Metrik performa CRM: response time, closing rate, follow-up compliance, repeat order rate, &amp; leaderboard CS
                    </p>
                </div>
                {isManager && (
                    <button
                        onClick={() => setShareOpen(true)}
                        className="ml-auto shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm"
                        title="Bagikan link dashboard publik ke tim marketing"
                    >
                        <Share2 className="h-4 w-4" /> Bagikan Link
                    </button>
                )}
            </div>

            {shareOpen && (
                <ShareMarketingModal
                    pin={(storeSettings as any)?.marketingPin || ""}
                    onClose={() => setShareOpen(false)}
                />
            )}

            {/* Period filter */}
            <div className="flex gap-2 flex-wrap items-center">
                {PERIOD_OPTIONS.map(p => (
                    <button
                        key={p.value}
                        onClick={() => setPeriod(p.value)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            period === p.value ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-accent"
                        }`}
                    >
                        {p.label}
                    </button>
                ))}
                {period === "custom" && (
                    <div className="flex gap-2 items-center text-sm">
                        <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
                            className="border border-border rounded px-2 py-1" />
                        <span>—</span>
                        <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                            className="border border-border rounded px-2 py-1" />
                    </div>
                )}
                {/* Filter cabang (owner) & staff — berlaku untuk semua metrik di halaman ini */}
                {isOwner && (
                    <select
                        value={branchSel}
                        onChange={(e) => setBranchSel(e.target.value === "ALL" ? "ALL" : Number(e.target.value))}
                        className="text-sm font-medium border border-border rounded-lg px-2.5 py-1.5 bg-card outline-none focus:ring-2 focus:ring-indigo-300"
                        title="Filter cabang"
                    >
                        <option value="ALL">🏬 Semua Cabang</option>
                        {(branches ?? []).map(b => (
                            <option key={b.id} value={b.id}>{b.code ? `[${b.code}] ` : ""}{b.name}</option>
                        ))}
                    </select>
                )}
                <select
                    value={csSel}
                    onChange={(e) => setCsSel(e.target.value === "ALL" ? "ALL" : Number(e.target.value))}
                    className="text-sm font-medium border border-border rounded-lg px-2.5 py-1.5 bg-card outline-none focus:ring-2 focus:ring-indigo-300"
                    title="Filter staff/CS"
                >
                    <option value="ALL">👥 Semua Staff</option>
                    {(staffUsers ?? []).map(u => (
                        <option key={u.id} value={u.id}>{u.name || u.email}</option>
                    ))}
                </select>
                {data && (
                    <div className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {dayjs(data.period.start).format("DD MMM YY")} — {dayjs(data.period.end).format("DD MMM YY")}
                    </div>
                )}
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" /> Memuat...
                </div>
            ) : !data ? (
                <div className="bg-card border rounded-xl p-8 text-center text-muted-foreground">
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
                            accent="bg-blue-500/10 text-blue-600 dark:text-blue-300"
                            delay={0}
                        />
                        <MetricCard
                            icon={<Target className="h-5 w-5" />}
                            label="Closing Rate"
                            value={`${(data.metrics.closingRate * 100).toFixed(1)}%`}
                            sub={`${data.totals.closedWon} closing, ${data.totals.closedLost} lost`}
                            accent="bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
                            delay={50}
                        />
                        <MetricCard
                            icon={<ClipboardCheck className="h-5 w-5" />}
                            label="FU Compliance"
                            value={`${(data.metrics.fuComplianceRate * 100).toFixed(1)}%`}
                            sub={`${data.totals.compliant}/${data.totals.totalFu} FU on-time`}
                            accent="bg-amber-500/10 text-amber-600 dark:text-amber-300"
                            delay={100}
                        />
                        <MetricCard
                            icon={<RotateCcw className="h-5 w-5" />}
                            label="Repeat Order Rate"
                            value={`${(data.metrics.repeatOrderRate * 100).toFixed(1)}%`}
                            sub={`${data.totals.customersRepeat}/${data.totals.customersWithOrder} customer`}
                            accent="bg-violet-500/10 text-violet-600 dark:text-violet-300"
                            delay={150}
                        />
                        <MetricCard
                            icon={<TrendingUp className="h-5 w-5" />}
                            label="Nilai WON"
                            value={data.totals.wonValue > 0
                                ? `Rp ${(data.totals.wonValue / 1_000_000).toFixed(1)}jt`
                                : "Rp 0"}
                            sub={`dari ${data.totals.closedWon} deal closing`}
                            accent="bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
                            delay={200}
                        />
                        <MetricCard
                            icon={<TrendingDown className="h-5 w-5" />}
                            label="Nilai Lost"
                            value={data.totals.lostValue > 0
                                ? `Rp ${(data.totals.lostValue / 1_000_000).toFixed(1)}jt`
                                : "Rp 0"}
                            sub={`dari ${data.totals.closedLost} lead gagal`}
                            accent="bg-red-500/10 text-red-600 dark:text-red-300"
                            delay={250}
                        />
                        <MetricCard
                            icon={<Hourglass className="h-5 w-5" />}
                            label="Nilai Akan Datang"
                            value={data.totals.pendingValue > 0
                                ? `Rp ${(data.totals.pendingValue / 1_000_000).toFixed(1)}jt`
                                : "Rp 0"}
                            sub="Saldo piutang belum lunas (PENDING + DP)"
                            accent="bg-amber-500/10 text-amber-600 dark:text-amber-300"
                            delay={300}
                        />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Leads by Source */}
                        <div className="bg-card rounded-2xl border border-border shadow-sm p-4 transition-[box-shadow,border-color] hover:shadow-md animate-in fade-in slide-in-from-bottom-2 duration-500">
                            <h2 className="font-bold text-base mb-3 flex items-center gap-2">
                                <span className="h-7 w-7 rounded-lg flex items-center justify-center bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">
                                    <Target className="h-4 w-4" />
                                </span>
                                Lead Per Sumber
                            </h2>
                            {sourceChartData.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-8">Belum ada lead di periode ini.</p>
                            ) : (
                                <ResponsiveContainer width="100%" height={280}>
                                    <PieChart>
                                        <Pie
                                            data={sourceChartData}
                                            dataKey="value"
                                            nameKey="name"
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={55}
                                            outerRadius={90}
                                            paddingAngle={2}
                                            cornerRadius={4}
                                            stroke="var(--card)"
                                            strokeWidth={2}
                                            label={(entry: any) => `${entry.name} (${entry.value})`}
                                        >
                                            {sourceChartData.map((entry, i) => (
                                                <Cell key={i} fill={SOURCE_COLOR[entry.source] || CHART_COLORS[i % CHART_COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip contentStyle={CHART_TOOLTIP_STYLE} labelStyle={CHART_LABEL_STYLE} itemStyle={CHART_ITEM_STYLE} />
                                        <Legend wrapperStyle={CHART_LEGEND_STYLE} />
                                    </PieChart>
                                </ResponsiveContainer>
                            )}
                        </div>

                        {/* Leads by Source — Bar fallback */}
                        <div className="bg-card rounded-2xl border border-border shadow-sm p-4 transition-[box-shadow,border-color] hover:shadow-md animate-in fade-in slide-in-from-bottom-2 duration-500" style={{ animationDelay: "80ms" }}>
                            <h2 className="font-bold text-base mb-3 flex items-center gap-2">
                                <span className="h-7 w-7 rounded-lg flex items-center justify-center bg-violet-500/10 text-violet-600 dark:text-violet-300">
                                    <BarChart3 className="h-4 w-4" />
                                </span>
                                Distribusi (Bar)
                            </h2>
                            {sourceChartData.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-8">—</p>
                            ) : (
                                <ResponsiveContainer width="100%" height={280}>
                                    <BarChart data={sourceChartData} margin={{ top: 20, right: 10, left: -10, bottom: 5 }}>
                                        <XAxis dataKey="name" tick={CHART_AXIS_TICK} axisLine={{ stroke: "var(--border)" }} tickLine={{ stroke: "var(--border)" }} />
                                        <YAxis tick={CHART_AXIS_TICK} allowDecimals={false} axisLine={{ stroke: "var(--border)" }} tickLine={{ stroke: "var(--border)" }} />
                                        <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.4 }} contentStyle={CHART_TOOLTIP_STYLE} labelStyle={CHART_LABEL_STYLE} itemStyle={CHART_ITEM_STYLE} />
                                        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                                            {sourceChartData.map((entry, i) => (
                                                <Cell key={i} fill={SOURCE_COLOR[entry.source] || CHART_COLORS[i % CHART_COLORS.length]} />
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
                        branchId={branchParam}
                        globalCsId={csSel}
                        csOptions={(data?.leaderboard ?? []).map(r => ({ id: r.userId, name: r.name }))}
                    />

                    {/* Breakdown per Sumber (gaya Shopee) */}
                    <SourceBreakdownChart
                        period={period}
                        customStart={customStart}
                        customEnd={customEnd}
                        branchId={branchParam}
                        globalCsId={csSel}
                        csOptions={(data?.leaderboard ?? []).map(r => ({ id: r.userId, name: r.name }))}
                    />

                    {/* Semua leaderboard dipindah ke halaman khusus */}
                    <Link href="/leaderboard" className="block bg-gradient-to-r from-amber-500/10 to-transparent border border-amber-500/20 rounded-2xl p-4 hover:border-amber-500/40 transition-colors">
                        <div className="flex items-center gap-3">
                            <span className="h-11 w-11 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0"><Trophy className="h-6 w-6" /></span>
                            <div className="min-w-0">
                                <div className="font-bold text-foreground">Leaderboard Tim →</div>
                                <div className="text-xs text-muted-foreground">Semua leaderboard (CS &amp; Designer) + gelar juara, grafik &amp; cara hitung kini ada di halaman khusus.</div>
                            </div>
                        </div>
                    </Link>

                </>
            )}
        </div>
    );
}

function MetricCard({
    icon, label, value, sub, accent, delay = 0,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
    sub: string;
    accent: string;
    delay?: number;
}) {
    return (
        <div
            className="bg-card rounded-2xl border border-border shadow-sm p-4 transition-[box-shadow,border-color] hover:shadow-md hover:border-primary/40 animate-in fade-in slide-in-from-bottom-2 duration-500"
            style={{ animationDelay: `${delay}ms` }}
        >
            <div className="flex items-center gap-2.5 mb-2">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${accent}`}>
                    {icon}
                </div>
                <div className="text-xs text-muted-foreground font-medium leading-tight uppercase tracking-wide">{label}</div>
            </div>
            <div className="text-2xl font-bold font-mono text-foreground">{value}</div>
            <div className="text-xs text-muted-foreground mt-1">{sub}</div>
        </div>
    );
}

// Palet warna garis — diputar berdasarkan indeks seri
const TREND_COLORS = [
    "#6366F1", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
    "#06B6D4", "#EC4899", "#84CC16", "#F97316",
];

function ProductTrendChart({
    period, customStart, customEnd, csOptions, branchId, globalCsId,
}: {
    period: KpiPeriod;
    customStart: string;
    customEnd: string;
    csOptions: { id: number; name: string }[];
    branchId?: number | "all";
    globalCsId: number | "ALL";
}) {
    const [mode, setMode] = useState<"category" | "product">("category");
    const [csId, setCsId] = useState<number | "ALL">("ALL");

    // Filter staff global (header halaman) menang atas pilihan lokal
    const globalActive = globalCsId !== "ALL";
    // Kalau CS terpilih tidak lagi ada di periode baru, reset ke Semua
    const csValid = csId === "ALL" || csOptions.some(c => c.id === csId);
    const effectiveCsId = globalActive ? globalCsId : (csValid ? csId : "ALL");

    const { data, isLoading } = useQuery({
        queryKey: ["crm-product-trend", period, customStart, customEnd, effectiveCsId, branchId],
        queryFn: () => getProductTrend({
            period,
            start: period === "custom" ? customStart : undefined,
            end: period === "custom" ? customEnd : undefined,
            csId: effectiveCsId === "ALL" ? undefined : effectiveCsId,
            branchId,
        }),
        staleTime: 60_000,
    });

    const group = data ? data[mode] : null;
    const hasData = !!group && group.series.length > 0 && group.totals.some(t => t.pcs > 0);
    const grandTotal = group?.totals.reduce((s, t) => s + t.pcs, 0) ?? 0;

    return (
        <div className="bg-card rounded-2xl border border-border shadow-sm p-5 transition-[box-shadow,border-color] hover:shadow-md animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                <h2 className="font-bold text-base flex items-center gap-2">
                    <span className="h-8 w-8 rounded-xl flex items-center justify-center bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">
                        <Package className="h-5 w-5" />
                    </span>
                    Tren Produk Diorder
                    {data && (
                        <span className="text-xs font-normal text-muted-foreground">
                            ({data.bucketBy === "week" ? "per minggu" : "per hari"})
                        </span>
                    )}
                </h2>
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Filter CS (nonaktif saat filter staff global dipakai) */}
                    <select
                        value={effectiveCsId}
                        onChange={(e) => setCsId(e.target.value === "ALL" ? "ALL" : Number(e.target.value))}
                        disabled={globalActive}
                        title={globalActive ? "Mengikuti filter staff di atas halaman" : undefined}
                        className="text-xs font-semibold border border-border rounded-lg px-2.5 py-1.5 bg-card outline-none focus:ring-2 focus:ring-indigo-300 disabled:bg-muted disabled:text-muted-foreground"
                    >
                        <option value="ALL">Semua CS</option>
                        {csOptions.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                        {globalActive && !csOptions.some(c => c.id === globalCsId) && (
                            <option value={globalCsId}>Staff #{globalCsId}</option>
                        )}
                    </select>
                    {/* Toggle Kategori / Produk */}
                    <div className="flex bg-muted rounded-lg p-0.5 text-xs font-semibold">
                        <button
                            onClick={() => setMode("category")}
                            className={`px-3 py-1 rounded-md transition-colors ${mode === "category" ? "bg-card text-indigo-600 shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                        >
                            Kategori
                        </button>
                        <button
                            onClick={() => setMode("product")}
                            className={`px-3 py-1 rounded-md transition-colors ${mode === "product" ? "bg-card text-indigo-600 shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                        >
                            Produk
                        </button>
                    </div>
                </div>
            </div>

            <p className="text-xs text-muted-foreground -mt-1 mb-3">
                Dari <strong>semua transaksi POS</strong> di periode (termasuk walk-in tanpa lead), berdasarkan <strong>tanggal transaksi</strong>.
                Item add-on (kerah/lengan/rib) tidak dihitung sebagai pcs.
            </p>

            {/* Pisahan sumber: dari lead vs dari walk-in (saat filter CS aktif) */}
            {effectiveCsId !== "ALL" && data?.sourceSplit && (
                <div className="flex flex-wrap items-center gap-2 mb-3 text-xs">
                    <span className="text-muted-foreground">
                        Order <strong className="text-foreground">{csOptions.find(c => c.id === effectiveCsId)?.name}</strong>:
                    </span>
                    <div className="flex items-center gap-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-2.5 py-1">
                        <span className="font-medium text-indigo-700 dark:text-indigo-300">Dari Lead</span>
                        <span className="font-mono text-indigo-600 dark:text-indigo-300">{data.sourceSplit.lead.toLocaleString("id-ID")} pcs</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full px-2.5 py-1">
                        <span className="font-medium text-amber-700 dark:text-amber-300">Dari Walk-in</span>
                        <span className="font-mono text-amber-600 dark:text-amber-300">{data.sourceSplit.walkin.toLocaleString("id-ID")} pcs</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                        (walk-in dicocokkan dari Kasir/Staff)
                    </span>
                </div>
            )}

            {isLoading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                </div>
            ) : !hasData ? (
                <p className="text-sm text-muted-foreground text-center py-12">
                    Belum ada order di periode ini.
                </p>
            ) : (
                <>
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={group!.data} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
                            <XAxis dataKey="label" tick={CHART_AXIS_TICK} axisLine={{ stroke: "var(--border)" }} tickLine={{ stroke: "var(--border)" }} />
                            <YAxis tick={CHART_AXIS_TICK} allowDecimals={false} axisLine={{ stroke: "var(--border)" }} tickLine={{ stroke: "var(--border)" }} />
                            <Tooltip
                                formatter={(value: any, name: any) => [`${value} pcs`, name]}
                                contentStyle={CHART_TOOLTIP_STYLE} labelStyle={CHART_LABEL_STYLE} itemStyle={CHART_ITEM_STYLE}
                                cursor={{ stroke: "var(--border)" }}
                            />
                            <Legend wrapperStyle={CHART_LEGEND_STYLE} />
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
                                <div key={t.name} className="flex items-center gap-1.5 text-xs bg-muted border rounded-full px-2.5 py-1">
                                    <span
                                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                        style={{ backgroundColor: TREND_COLORS[group!.series.indexOf(t.name) % TREND_COLORS.length] }}
                                    />
                                    <span className="font-medium text-foreground">{t.name}</span>
                                    <span className="font-mono text-muted-foreground">{t.pcs.toLocaleString("id-ID")} pcs</span>
                                </div>
                            ))}
                        <div className="flex items-center gap-1.5 text-xs bg-indigo-500/10 border border-indigo-500/20 rounded-full px-2.5 py-1 ml-auto">
                            <span className="font-semibold text-indigo-700 dark:text-indigo-300">Total</span>
                            <span className="font-mono text-indigo-600 dark:text-indigo-300">{grandTotal.toLocaleString("id-ID")} pcs</span>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

// ── Breakdown per Sumber (gaya dashboard Shopee) ─────────────────────────────
const BREAKDOWN_STATUS: { value: string; label: string; on: string; off: string }[] = [
    { value: "CLOSED_WON",  label: "Closing", on: "bg-emerald-600 text-white border-emerald-600", off: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20 hover:bg-emerald-500/20" },
    { value: "CLOSED_LOST", label: "Lost",    on: "bg-red-600 text-white border-red-600",          off: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20 hover:bg-red-500/20" },
    { value: "INVALID",     label: "Invalid", on: "bg-orange-500 text-white border-orange-500",    off: "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/20 hover:bg-orange-500/20" },
];

function fmtRpShort(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}jt`;
    if (n >= 1_000) return `${Math.round(n / 1_000)}rb`;
    return `${n}`;
}

function SourceBreakdownChart({
    period, customStart, customEnd, csOptions, branchId, globalCsId,
}: {
    period: KpiPeriod;
    customStart: string;
    customEnd: string;
    csOptions: { id: number; name: string }[];
    branchId?: number | "all";
    globalCsId: number | "ALL";
}) {
    const [csId, setCsId] = useState<number | "ALL">("ALL");
    const [statuses, setStatuses] = useState<string[]>(["CLOSED_WON"]);
    const [metric, setMetric] = useState<"pcs" | "value">("pcs");
    const [activeSources, setActiveSources] = useState<string[]>([]);

    // Filter staff global (header halaman) menang atas pilihan lokal
    const globalActive = globalCsId !== "ALL";
    const csValid = csId === "ALL" || csOptions.some(c => c.id === csId);
    const effectiveCsId = globalActive ? globalCsId : (csValid ? csId : "ALL");

    const { data, isLoading } = useQuery({
        queryKey: ["crm-source-breakdown", period, customStart, customEnd, effectiveCsId, statuses, branchId],
        queryFn: () => getSourceBreakdown({
            period,
            start: period === "custom" ? customStart : undefined,
            end: period === "custom" ? customEnd : undefined,
            csId: effectiveCsId === "ALL" ? undefined : effectiveCsId,
            status: statuses.join(","),
            branchId,
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
        <div className="bg-card rounded-2xl border border-border shadow-sm p-5 transition-[box-shadow,border-color] hover:shadow-md animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                <h2 className="font-bold text-base flex items-center gap-2">
                    <span className="h-8 w-8 rounded-xl flex items-center justify-center bg-rose-500/10 text-rose-600 dark:text-rose-300">
                        <TrendingUp className="h-5 w-5" />
                    </span>
                    Breakdown per Sumber
                    {data && (
                        <span className="text-xs font-normal text-muted-foreground">
                            ({data.bucketBy === "week" ? "per minggu" : "per hari"})
                        </span>
                    )}
                </h2>
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Filter CS (nonaktif saat filter staff global dipakai) */}
                    <select
                        value={effectiveCsId}
                        onChange={(e) => setCsId(e.target.value === "ALL" ? "ALL" : Number(e.target.value))}
                        disabled={globalActive}
                        title={globalActive ? "Mengikuti filter staff di atas halaman" : undefined}
                        className="text-xs font-semibold border border-border rounded-lg px-2.5 py-1.5 bg-card outline-none focus:ring-2 focus:ring-rose-300 disabled:bg-muted disabled:text-muted-foreground"
                    >
                        <option value="ALL">Semua CS</option>
                        {csOptions.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                        {globalActive && !csOptions.some(c => c.id === globalCsId) && (
                            <option value={globalCsId}>Staff #{globalCsId}</option>
                        )}
                    </select>
                    {/* Toggle metrik */}
                    <div className="flex bg-muted rounded-lg p-0.5 text-xs font-semibold">
                        <button
                            onClick={() => setMetric("pcs")}
                            className={`px-3 py-1 rounded-md transition-colors ${metric === "pcs" ? "bg-card text-rose-600 shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                        >
                            Pcs
                        </button>
                        <button
                            onClick={() => setMetric("value")}
                            className={`px-3 py-1 rounded-md transition-colors ${metric === "value" ? "bg-card text-rose-600 shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                        >
                            Nilai Rp
                        </button>
                    </div>
                </div>
            </div>

            <p className="text-xs text-muted-foreground -mt-1 mb-3">
                Hanya dari <strong>lead</strong> (sesuai filter status), berdasarkan <strong>tanggal lead masuk</strong> — pcs diambil dari nota hasil closing.
                Order walk-in tanpa lead tidak dihitung di sini, jadi total pcs wajar lebih kecil dari Tren Produk.
            </p>

            {/* Filter status */}
            <div className="flex items-center gap-1.5 flex-wrap mb-3">
                <span className="text-[11px] text-muted-foreground font-semibold uppercase mr-1">Status:</span>
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
                    <span className="text-[10px] text-muted-foreground italic ml-1">
                        Pcs hanya dari Closing — Lost/Invalid belum jadi order
                    </span>
                )}
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-rose-500" />
                </div>
            ) : !hasSources ? (
                <p className="text-sm text-muted-foreground text-center py-12">
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
                                    className={`text-left rounded-lg border-2 p-2.5 transition-all ${active ? "bg-card shadow-sm" : "bg-muted border-border opacity-60 hover:opacity-100"}`}
                                    style={active ? { borderColor: color } : undefined}
                                >
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: active ? color : "#cbd5e1" }} />
                                        <span className="text-xs font-semibold text-foreground truncate">{srcLabel(s.key)}</span>
                                    </div>
                                    <div className="font-mono font-bold text-sm text-foreground">
                                        {metric === "pcs" ? `${s.pcs.toLocaleString("id-ID")} pcs` : `Rp ${s.value.toLocaleString("id-ID")}`}
                                    </div>
                                    <div className="font-mono text-[10px] text-muted-foreground">
                                        {metric === "pcs" ? `Rp ${fmtRpShort(s.value)}` : `${s.pcs.toLocaleString("id-ID")} pcs`}
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {/* Chart perbandingan */}
                    {activeSources.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-12">
                            Klik kotak sumber di atas untuk menampilkan grafik perbandingan.
                        </p>
                    ) : (
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                                <XAxis dataKey="label" tick={CHART_AXIS_TICK} axisLine={{ stroke: "var(--border)" }} tickLine={{ stroke: "var(--border)" }} />
                                <YAxis
                                    tick={CHART_AXIS_TICK}
                                    allowDecimals={false}
                                    axisLine={{ stroke: "var(--border)" }} tickLine={{ stroke: "var(--border)" }}
                                    tickFormatter={(v: any) => metric === "value" ? fmtRpShort(Number(v)) : `${v}`}
                                />
                                <Tooltip
                                    formatter={(value: any, name: any) => [
                                        metric === "value" ? `Rp ${Number(value).toLocaleString("id-ID")}` : `${value} pcs`,
                                        srcLabel(String(name)),
                                    ]}
                                    contentStyle={CHART_TOOLTIP_STYLE} labelStyle={CHART_LABEL_STYLE} itemStyle={CHART_ITEM_STYLE}
                                    cursor={{ stroke: "var(--border)" }}
                                />
                                <Legend wrapperStyle={CHART_LEGEND_STYLE} formatter={(v: any) => srcLabel(String(v))} />
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
                                <h3 className="text-sm font-bold text-foreground">Closing Rate per Sumber</h3>
                                <span className="text-[10px] text-muted-foreground italic">
                                    Dari semua lead di periode ini (lepas filter status di atas; Invalid tidak dihitung)
                                </span>
                            </div>
                            <ResponsiveContainer width="100%" height={Math.max(140, rateData.length * 36)}>
                                <BarChart data={rateData} layout="vertical" margin={{ top: 5, right: 40, left: 10, bottom: 5 }}>
                                    <XAxis type="number" domain={[0, 100]} tickFormatter={(v: any) => `${v}%`} tick={CHART_AXIS_TICK} axisLine={{ stroke: "var(--border)" }} tickLine={{ stroke: "var(--border)" }} />
                                    <YAxis type="category" dataKey="name" width={95} tick={CHART_AXIS_TICK} axisLine={{ stroke: "var(--border)" }} tickLine={{ stroke: "var(--border)" }} />
                                    <Tooltip
                                        cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                                        formatter={(value: any, _n: any, p: any) => [
                                            `${value}%  (${p.payload.won}/${p.payload.valid} lead)`,
                                            "Closing rate",
                                        ]}
                                        contentStyle={CHART_TOOLTIP_STYLE} labelStyle={CHART_LABEL_STYLE} itemStyle={CHART_ITEM_STYLE}
                                    />
                                    <Bar dataKey="rate" radius={[0, 6, 6, 0]} label={{ position: "right", formatter: (v: any) => `${v}%`, fontSize: 11, fill: "var(--muted-foreground)" }}>
                                        {rateData.map((_e, i) => (
                                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
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

// ── Leaderboard Designer ─────────────────────────────────────────────────────
const DESIGNER_CHAMP: Record<string, { icon: string; label: string }> = {
    omzet:      { icon: "💰", label: "Raja Omzet" },
    assignment: { icon: "💪", label: "Paling Rajin" },
    acc:        { icon: "🏆", label: "Raja ACC" },
    selesai:    { icon: "🏭", label: "Mesin Produksi" },
};

function DesignerLeaderboard({
    period, customStart, customEnd, branchId,
}: {
    period: KpiPeriod;
    customStart: string;
    customEnd: string;
    branchId?: number | "all";
}) {
    const [sort, setSort] = useState<"designer" | "omzet" | "assignment" | "acc" | "selesai">("omzet");
    const [showChart, setShowChart] = useState(false);

    const { data, isLoading } = useQuery({
        queryKey: ["crm-designer-leaderboard", period, customStart, customEnd, branchId],
        queryFn: () => getDesignerLeaderboard({
            period,
            start: period === "custom" ? customStart : undefined,
            end: period === "custom" ? customEnd : undefined,
            branchId,
        }),
        staleTime: 60_000,
    });

    const rows = useMemo(() => {
        const list = [...(data?.leaderboard ?? [])];
        switch (sort) {
            case "designer":   return list.sort((a, b) => a.name.localeCompare(b.name));
            case "omzet":      return list.sort((a, b) => b.omzet - a.omzet || b.acc - a.acc);
            case "assignment": return list.sort((a, b) => b.assignment - a.assignment);
            case "acc":        return list.sort((a, b) => b.acc - a.acc || b.accRate - a.accRate);
            case "selesai":    return list.sort((a, b) => b.selesai - a.selesai);
            default:           return list;
        }
    }, [data, sort]);

    const champKey = sort === "designer" ? null : sort;

    return (
        <div className="bg-card rounded-2xl border border-border shadow-sm p-5 transition-[box-shadow,border-color] hover:shadow-md animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                <h2 className="font-bold text-base flex items-center gap-2">
                    <span className="h-8 w-8 rounded-xl flex items-center justify-center bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-300">
                        <Palette className="h-5 w-5" />
                    </span>
                    Leaderboard Designer
                </h2>
                <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-[10px] text-muted-foreground font-semibold uppercase mr-1">Urutkan:</span>
                    {([
                        { key: "designer",   label: "Designer" },
                        { key: "omzet",      label: "Omzet" },
                        { key: "assignment", label: "Assignment" },
                        { key: "acc",        label: "ACC" },
                        { key: "selesai",    label: "Selesai" },
                    ] as const).map(({ key, label }) => (
                        <button
                            key={key}
                            onClick={() => setSort(key)}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                                sort === key
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted text-muted-foreground hover:bg-accent"
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                    <button
                        onClick={() => setShowChart(true)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-500/20 transition-colors ml-1"
                    >
                        <BarChart3 className="h-3.5 w-3.5" /> Grafik Desainer
                    </button>
                </div>
            </div>

            {showChart && (
                <LeaderboardChartModal
                    title="Grafik Tren Designer"
                    fetcher={getDesignerTrend}
                    queryKey="crm-designer-trend"
                    metrics={DESIGNER_CHART_METRICS}
                    period={period}
                    customStart={customStart}
                    customEnd={customEnd}
                    branchId={branchId}
                    onClose={() => setShowChart(false)}
                />
            )}

            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-fuchsia-500" />
                </div>
            ) : rows.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                    Belum ada job desain yang ter-assign ke designer di periode ini.
                </p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b text-xs text-muted-foreground uppercase">
                                <th className="text-left py-2 px-2">#</th>
                                <th className="text-left py-2 px-2">Designer</th>
                                <th className="text-right py-2 px-2 text-green-700">Omzet</th>
                                <th className="text-right py-2 px-2 text-violet-600">Pcs</th>
                                <th className="text-right py-2 px-2">Assignment</th>
                                <th className="text-right py-2 px-2 text-cyan-600">SO Dibuat</th>
                                <th className="text-right py-2 px-2 text-cyan-700">Jadi Nota</th>
                                <th className="text-right py-2 px-2 text-cyan-700">Konv. SO</th>
                                <th className="text-right py-2 px-2 text-emerald-600">ACC</th>
                                <th className="text-right py-2 px-2">ACC Rate</th>
                                <th className="text-right py-2 px-2 text-muted-foreground">Masih Desain</th>
                                <th className="text-right py-2 px-2 text-red-600">Retur</th>
                                <th className="text-right py-2 px-2">Selesai</th>
                                <th className="text-right py-2 px-2 text-amber-600">Batal</th>
                                <th className="text-right py-2 px-2 text-orange-500">Express</th>
                                <th className="text-right py-2 px-2">Avg Desain</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(() => {
                                const metricVal = (r: typeof rows[number]) =>
                                    sort === "omzet" ? r.omzet
                                    : sort === "assignment" ? r.assignment
                                    : sort === "acc" ? r.acc
                                    : sort === "selesai" ? r.selesai
                                    : 0;
                                const topVal = Math.max(1, ...rows.map(metricVal));
                                return rows.map((row, i) => {
                                const isPodium = sort !== "designer" && i < 3;
                                const champ = i === 0 && champKey ? DESIGNER_CHAMP[champKey] : null;
                                const isChampion = i === 0 && sort !== "designer";
                                const pct = sort !== "designer" ? Math.round((metricVal(row) / topVal) * 100) : 0;
                                return (
                                <tr
                                    key={row.name}
                                    className={`border-t transition-colors hover:bg-accent/50 animate-in fade-in slide-in-from-bottom-1 ${
                                        isChampion
                                            ? "ring-1 ring-fuchsia-500/30 bg-gradient-to-r from-fuchsia-500/10 to-transparent"
                                            : isPodium ? "bg-muted/40 border-l-4 " + PODIUM_ACCENT[i] : ""
                                    }`}
                                    style={{ animationDelay: `${i * 30}ms` }}
                                >
                                    <td className="py-2 px-2 text-center">
                                        {isPodium ? <span className="text-lg">{MEDAL[i]}</span> : <span className="text-muted-foreground font-mono text-xs">{i + 1}</span>}
                                    </td>
                                    <td className="py-2 px-2">
                                        <div className="flex items-center gap-2">
                                            <span className={`h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${AVATAR_ACCENTS[i % AVATAR_ACCENTS.length]}`}>
                                                {initials(row.name)}
                                            </span>
                                            <div className="min-w-[120px]">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className={`font-semibold ${isChampion ? "text-fuchsia-700 dark:text-fuchsia-300" : ""}`}>{row.name}</span>
                                                    {champ && (
                                                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-300 border border-fuchsia-500/30 text-[9px] font-bold whitespace-nowrap">
                                                            {champ.icon} {champ.label}
                                                        </span>
                                                    )}
                                                </div>
                                                {sort !== "designer" && (
                                                    <div className="mt-1 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full transition-[width] duration-500 ${isChampion ? "bg-fuchsia-500" : "bg-primary/70"}`}
                                                            style={{ width: `${pct}%` }}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-2 px-2 text-right font-mono text-green-700 font-semibold whitespace-nowrap">{row.omzet > 0 ? `Rp ${row.omzet.toLocaleString('id-ID')}` : <span className="text-muted-foreground/40 font-normal">—</span>}</td>
                                    <td className="py-2 px-2 text-right font-mono text-violet-600">{row.pcs > 0 ? row.pcs.toLocaleString('id-ID') : <span className="text-muted-foreground/40">—</span>}</td>
                                    <td className="py-2 px-2 text-right font-mono text-muted-foreground">{row.assignment}</td>
                                    <td className="py-2 px-2 text-right font-mono text-cyan-600">{row.soCreated > 0 ? row.soCreated : <span className="text-muted-foreground/40">—</span>}</td>
                                    <td className="py-2 px-2 text-right font-mono text-cyan-700">{row.soInvoiced > 0 ? row.soInvoiced : <span className="text-muted-foreground/40">—</span>}</td>
                                    <td className="py-2 px-2 text-right font-mono text-cyan-700">{row.soCreated > 0 ? `${(row.soConvRate * 100).toFixed(0)}%` : <span className="text-muted-foreground/40">—</span>}</td>
                                    <td className="py-2 px-2 text-right font-mono text-emerald-700 font-semibold">{row.acc}</td>
                                    <td className="py-2 px-2 text-right font-mono">{(row.accRate * 100).toFixed(0)}%</td>
                                    <td className="py-2 px-2 text-right font-mono text-muted-foreground">{row.wip > 0 ? row.wip : <span className="text-muted-foreground/40">—</span>}</td>
                                    <td className="py-2 px-2 text-right font-mono text-red-600">{row.retur > 0 ? row.retur : <span className="text-muted-foreground/40">—</span>}</td>
                                    <td className="py-2 px-2 text-right font-mono text-foreground">{row.selesai}</td>
                                    <td className="py-2 px-2 text-right font-mono text-amber-600">{row.batal > 0 ? row.batal : <span className="text-muted-foreground/40">—</span>}</td>
                                    <td className="py-2 px-2 text-right font-mono text-orange-500">{row.express > 0 ? row.express : <span className="text-muted-foreground/40">—</span>}</td>
                                    <td className="py-2 px-2 text-right font-mono text-muted-foreground">{row.avgDesignHrs != null ? `${row.avgDesignHrs.toFixed(1)}h` : <span className="text-muted-foreground">—</span>}</td>
                                </tr>
                                );
                                });
                            })()}
                        </tbody>
                        <tfoot>
                            <tr className="border-t-2 border-border bg-muted font-semibold text-xs">
                                <td colSpan={2} className="py-2 px-2 text-muted-foreground">Total</td>
                                <td className="py-2 px-2 text-right font-mono text-green-700 whitespace-nowrap">{(data?.totals.omzet ?? 0) > 0 ? `Rp ${(data?.totals.omzet ?? 0).toLocaleString('id-ID')}` : '—'}</td>
                                <td className="py-2 px-2 text-right font-mono text-violet-600">{(data?.totals.pcs ?? 0).toLocaleString('id-ID')}</td>
                                <td className="py-2 px-2 text-right font-mono">{data?.totals.assignment ?? 0}</td>
                                <td className="py-2 px-2 text-right font-mono text-cyan-600">{data?.totals.soCreated ?? 0}</td>
                                <td className="py-2 px-2 text-right font-mono text-cyan-700">{data?.totals.soInvoiced ?? 0}</td>
                                <td className="py-2 px-2 text-right font-mono text-muted-foreground">—</td>
                                <td className="py-2 px-2 text-right font-mono text-emerald-700">{data?.totals.acc ?? 0}</td>
                                <td className="py-2 px-2 text-right font-mono text-muted-foreground">—</td>
                                <td className="py-2 px-2 text-right font-mono text-muted-foreground">{data?.totals.wip ?? 0}</td>
                                <td className="py-2 px-2 text-right font-mono text-red-600">{data?.totals.retur ?? 0}</td>
                                <td className="py-2 px-2 text-right font-mono text-foreground">{data?.totals.selesai ?? 0}</td>
                                <td className="py-2 px-2 text-right font-mono text-amber-600">{data?.totals.batal ?? 0}</td>
                                <td className="py-2 px-2 text-right font-mono text-orange-500">{data?.totals.express ?? 0}</td>
                                <td className="py-2 px-2 text-right font-mono text-muted-foreground">—</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}
        </div>
    );
}

// ── Modal Grafik Leaderboard (reusable: CS & Designer) ───────────────────────
type ChartMetric = { key: string; label: string; fmt: "num" | "pct" | "money" };

const CS_CHART_METRICS: ChartMetric[] = [
    { key: "leads", label: "Leads", fmt: "num" },
    { key: "closing", label: "Closing", fmt: "num" },
    { key: "pcs", label: "Pcs Order", fmt: "num" },
    { key: "lost", label: "Lost", fmt: "num" },
    { key: "invalid", label: "Invalid", fmt: "num" },
    { key: "closingRate", label: "Closing Rate", fmt: "pct" },
    { key: "wonValue", label: "Nilai WON", fmt: "money" },
    { key: "lostValue", label: "Nilai Lost", fmt: "money" },
];

const DESIGNER_CHART_METRICS: ChartMetric[] = [
    { key: "assignment", label: "Assignment", fmt: "num" },
    { key: "soCreated", label: "SO Dibuat", fmt: "num" },
    { key: "acc", label: "ACC", fmt: "num" },
    { key: "wip", label: "Masih Desain", fmt: "num" },
    { key: "retur", label: "Retur", fmt: "num" },
    { key: "selesai", label: "Selesai", fmt: "num" },
    { key: "batal", label: "Batal", fmt: "num" },
    { key: "express", label: "Express", fmt: "num" },
];

// Modal grafik TREN waktu (garis naik-turun per hari/minggu) — tiap orang satu garis.
function LeaderboardChartModal({
    title, fetcher, queryKey, metrics, period, customStart, customEnd, branchId, onClose,
}: {
    title: string;
    fetcher: (p: { period: KpiPeriod; start?: string; end?: string; branchId?: number | "all" }) => Promise<LeaderboardTrendReport>;
    queryKey: string;
    metrics: ChartMetric[];
    period: KpiPeriod;
    customStart: string;
    customEnd: string;
    branchId?: number | "all";
    onClose: () => void;
}) {
    const [metricKey, setMetricKey] = useState(metrics[0].key);
    const [activePersons, setActivePersons] = useState<string[]>([]);
    const metric = metrics.find(m => m.key === metricKey) ?? metrics[0];

    const { data, isLoading } = useQuery({
        queryKey: [queryKey, period, customStart, customEnd, branchId],
        queryFn: () => fetcher({
            period,
            start: period === "custom" ? customStart : undefined,
            end: period === "custom" ? customEnd : undefined,
            branchId,
        }),
        staleTime: 60_000,
    });

    const persons = useMemo(() => data?.persons ?? [], [data]);
    const personsSig = persons.join("|");
    useEffect(() => {
        if (!data) return;
        setActivePersons(prev => {
            const valid = prev.filter(p => persons.includes(p));
            return valid.length > 0 ? valid : persons.slice(0, 5);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [personsSig]);

    const colorOf = (p: string) => TREND_COLORS[persons.indexOf(p) % TREND_COLORS.length];
    const fmtFull = (v: number) =>
        metric.fmt === "money" ? `Rp ${v.toLocaleString("id-ID")}`
        : metric.fmt === "pct" ? `${v}%`
        : v.toLocaleString("id-ID");
    const fmtAxis = (v: number) =>
        metric.fmt === "money" ? fmtRpShort(v)
        : metric.fmt === "pct" ? `${v}%`
        : `${v}`;

    const chartData = data ? data.metrics[metric.key] ?? [] : [];

    return (
        <div className="fixed inset-0 bg-background/25 backdrop-blur-md z-[300] flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200" onClick={onClose}>
            <div className="glass-strong bg-card rounded-2xl border border-border shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-300" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-4 border-b border-border">
                    <h3 className="font-bold text-base flex items-center gap-2">
                        <span className="h-8 w-8 rounded-xl flex items-center justify-center bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">
                            <BarChart3 className="h-5 w-5" />
                        </span>
                        {title}
                        {data && <span className="text-xs font-normal text-muted-foreground">({data.bucketBy === "week" ? "per minggu" : "per hari"})</span>}
                    </h3>
                    <button onClick={onClose} className="p-1.5 hover:bg-accent rounded-lg transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>
                <div className="p-4 overflow-y-auto">
                    {/* Filter metrik */}
                    <div className="flex flex-wrap gap-1.5 mb-3">
                        <span className="text-[10px] text-muted-foreground font-semibold uppercase mr-1 self-center">Metrik:</span>
                        {metrics.map(m => (
                            <button
                                key={m.key}
                                onClick={() => setMetricKey(m.key)}
                                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                                    metricKey === m.key
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-muted text-muted-foreground hover:bg-accent"
                                }`}
                            >
                                {m.label}
                            </button>
                        ))}
                    </div>

                    {isLoading ? (
                        <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-indigo-500" /></div>
                    ) : persons.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-12">Belum ada data di periode ini.</p>
                    ) : (
                        <>
                            {/* Toggle orang (klik untuk tampil/sembunyi garis) */}
                            <div className="flex flex-wrap gap-1.5 mb-3">
                                {persons.map(p => {
                                    const on = activePersons.includes(p);
                                    return (
                                        <button
                                            key={p}
                                            onClick={() => setActivePersons(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])}
                                            className={`flex items-center gap-1 px-2 py-1 rounded-full border text-[11px] font-medium transition-all ${on ? "bg-card" : "bg-muted text-muted-foreground opacity-60"}`}
                                            style={on ? { borderColor: colorOf(p) } : undefined}
                                        >
                                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: on ? colorOf(p) : "#cbd5e1" }} />
                                            {p}
                                        </button>
                                    );
                                })}
                            </div>

                            {activePersons.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-12">Pilih minimal satu nama di atas untuk menampilkan garis.</p>
                            ) : (
                                <ResponsiveContainer width="100%" height={320}>
                                    <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                                        <XAxis dataKey="label" tick={CHART_AXIS_TICK} axisLine={{ stroke: "var(--border)" }} tickLine={{ stroke: "var(--border)" }} />
                                        <YAxis tick={CHART_AXIS_TICK} allowDecimals={false} axisLine={{ stroke: "var(--border)" }} tickLine={{ stroke: "var(--border)" }} tickFormatter={(v: any) => fmtAxis(Number(v))} />
                                        <Tooltip formatter={(v: any, n: any) => [fmtFull(Number(v)), n]} contentStyle={CHART_TOOLTIP_STYLE} labelStyle={CHART_LABEL_STYLE} itemStyle={CHART_ITEM_STYLE} cursor={{ stroke: "var(--border)" }} />
                                        <Legend wrapperStyle={CHART_LEGEND_STYLE} />
                                        {activePersons.map(p => (
                                            <Line key={p} type="monotone" dataKey={p} stroke={colorOf(p)} strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 5 }} />
                                        ))}
                                    </LineChart>
                                </ResponsiveContainer>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Produktivitas Jasa Desain (berapa desain dikerjakan + rincian per tier) ───
function DesignOutputCard({
    period, customStart, customEnd, branchId,
}: {
    period: KpiPeriod;
    customStart: string;
    customEnd: string;
    branchId: number | 'all' | undefined;
}) {
    const { data, isLoading } = useQuery({
        queryKey: ["crm-design-output", period, customStart, customEnd, branchId],
        queryFn: () => getDesignOutput({
            period,
            start: period === "custom" ? customStart : undefined,
            end: period === "custom" ? customEnd : undefined,
            branchId,
        }),
    });
    const rows = data ?? [];

    return (
        <div className="bg-card rounded-2xl border border-border shadow-sm p-4 sm:p-5 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex items-center gap-2 mb-3">
                <span className="h-8 w-8 rounded-xl bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-300 flex items-center justify-center shrink-0">
                    <Palette className="h-4 w-4" />
                </span>
                <div>
                    <h2 className="font-bold text-base leading-tight">Produktivitas Jasa Desain</h2>
                    <p className="text-xs text-muted-foreground">Berapa desain dikerjakan tiap designer + rincian tier. Ganti periode di atas (mis. "Hari Ini").</p>
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : rows.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">Belum ada jasa desain di periode ini.</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[560px]">
                        <thead>
                            <tr className="text-xs text-muted-foreground border-b border-border">
                                <th className="py-2 px-2 text-left">Designer</th>
                                <th className="py-2 px-2 text-right">Total Desain</th>
                                <th className="py-2 px-2 text-left">Rincian Tier</th>
                                <th className="py-2 px-2 text-right">Omzet Desain</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((d, i) => (
                                <tr key={d.name} className="border-b border-border/60 last:border-0 hover:bg-accent/50 transition-colors align-top">
                                    <td className="py-2 px-2 font-medium text-foreground">
                                        <span className="text-muted-foreground font-mono text-xs mr-2">{i + 1}</span>{d.name}
                                    </td>
                                    <td className="py-2 px-2 text-right font-mono font-bold text-fuchsia-600 dark:text-fuchsia-300">{d.total}</td>
                                    <td className="py-2 px-2">
                                        <div className="flex flex-wrap gap-1">
                                            {d.byTier.map(t => (
                                                <span key={t.tier} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-foreground">
                                                    {t.tier}<span className="font-semibold text-muted-foreground">·{t.count}</span>
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="py-2 px-2 text-right font-mono text-emerald-600 dark:text-emerald-300">Rp {d.omzet.toLocaleString('id-ID')}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

// ─── Modal Bagikan Link Dashboard Marketing ────────────────────────────────
function ShareMarketingModal({ pin, onClose }: { pin: string; onClose: () => void }) {
    const [copied, setCopied] = useState<string | null>(null);
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const link = `${origin}/marketing`;

    const copy = (text: string, key: string) => {
        navigator.clipboard?.writeText(text).then(() => {
            setCopied(key);
            setTimeout(() => setCopied(null), 1500);
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/40 backdrop-blur-md p-4" onClick={onClose}>
            <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-xl p-5" onClick={e => e.stopPropagation()}>
                <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                        <div className="rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 p-2"><Megaphone className="h-5 w-5" /></div>
                        <h3 className="font-bold text-lg">Bagikan Dashboard Marketing</h3>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted text-muted-foreground"><X className="h-5 w-5" /></button>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                    Link publik <strong>read-only</strong> untuk tim marketing memantau leads (sumber, status, pendapatan, produk). Cukup link + PIN, tanpa login.
                </p>

                <label className="text-xs font-semibold text-muted-foreground">Link</label>
                <div className="flex gap-2 mt-1 mb-3">
                    <input readOnly value={link} className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-muted/40 font-mono truncate" />
                    <button onClick={() => copy(link, "link")} className="px-3 py-2 rounded-lg border border-border hover:bg-muted text-sm font-medium inline-flex items-center gap-1.5">
                        {copied === "link" ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                    </button>
                </div>

                <label className="text-xs font-semibold text-muted-foreground">PIN</label>
                {pin ? (
                    <div className="flex gap-2 mt-1 mb-3">
                        <input readOnly value={pin} className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-muted/40 font-mono tracking-widest" />
                        <button onClick={() => copy(pin, "pin")} className="px-3 py-2 rounded-lg border border-border hover:bg-muted text-sm font-medium inline-flex items-center gap-1.5">
                            {copied === "pin" ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                        </button>
                    </div>
                ) : (
                    <div className="mt-1 mb-3 text-sm bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 rounded-lg px-3 py-2">
                        PIN belum diatur. Set dulu di <Link href="/settings/general" className="font-semibold underline">Pengaturan → Umum → PIN Dashboard Marketing</Link>.
                    </div>
                )}

                <div className="flex gap-2 mt-2">
                    <a href={link} target="_blank" rel="noopener noreferrer"
                        className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-border hover:bg-muted text-sm font-medium">
                        <ExternalLink className="h-4 w-4" /> Buka
                    </a>
                    <button onClick={() => copy(pin ? `${link}\nPIN: ${pin}` : link, "both")}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700">
                        {copied === "both" ? <><Check className="h-4 w-4" /> Tersalin</> : <><Copy className="h-4 w-4" /> Salin Link + PIN</>}
                    </button>
                </div>
            </div>
        </div>
    );
}
