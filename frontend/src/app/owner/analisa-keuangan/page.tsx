"use client";
import dynamic from "next/dynamic";
import { useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import "dayjs/locale/id";
import { ArrowLeft, TrendingUp, TrendingDown, Minus, Loader2, Lock, BookOpen, Activity, AlertTriangle, CalendarRange, PieChart as PieIcon, Scale, GitCompareArrows, Building2 } from "lucide-react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useBranchStore } from "@/store/branch-store";
import { getFinanceCandles, type FinanceTimeframe } from "@/lib/api/finance-analytics";
import { HeatmapPanel } from "@/components/owner/finance/HeatmapPanel";
import { AnomalyPanel } from "@/components/owner/finance/AnomalyPanel";
import { JournalDrawer } from "@/components/owner/finance/JournalDrawer";
import { ComparisonInsights } from "@/components/owner/finance/ComparisonInsights";
import { ExpenseBreakdownPanel } from "@/components/owner/finance/ExpenseBreakdownPanel";
import { ReconciliationPanel } from "@/components/owner/finance/ReconciliationPanel";
import { ConsolidationPanel } from "@/components/owner/finance/ConsolidationPanel";

dayjs.locale("id");

const CandleChart = dynamic(() => import("@/components/owner/finance/CandleChart").then((m) => m.CandleChart), {
    ssr: false,
    loading: () => <div className="h-[420px] grid place-items-center text-muted-foreground"><Loader2 className="animate-spin" /></div>,
});

const fmtRp = (n: number) => "Rp " + Math.round(Number(n) || 0).toLocaleString("id-ID");
const TF: { value: FinanceTimeframe; label: string; days: number }[] = [
    { value: "day", label: "Harian", days: 45 },
    { value: "week", label: "Mingguan", days: 180 },
    { value: "month", label: "Bulanan", days: 730 },
    { value: "year", label: "Tahunan", days: 2555 },
];
type RangeMode = "auto" | "thisMonth" | "lastMonth" | "thisYear" | "custom";
const RANGE_PRESETS: { value: RangeMode; label: string }[] = [
    { value: "auto", label: "Auto" },
    { value: "thisMonth", label: "Bulan Ini" },
    { value: "lastMonth", label: "Bulan Lalu" },
    { value: "thisYear", label: "Tahun Ini" },
    { value: "custom", label: "Kustom" },
];

/** Rentang bucket dari 1 candle yang diklik (untuk drill-down jurnal). */
function bucketRange(time: string, tf: FinanceTimeframe) {
    const d = dayjs(time);
    if (tf === "year") return { startDate: d.startOf("year").format("YYYY-MM-DD"), endDate: d.endOf("year").format("YYYY-MM-DD") };
    if (tf === "month") return { startDate: d.startOf("month").format("YYYY-MM-DD"), endDate: d.endOf("month").format("YYYY-MM-DD") };
    if (tf === "week") return { startDate: d.format("YYYY-MM-DD"), endDate: d.add(6, "day").format("YYYY-MM-DD") };
    return { startDate: time, endDate: time };
}

export default function AnalisaKeuanganPage() {
    const { isOwner, currentUser } = useCurrentUser();
    const activeBranchId = useBranchStore((s) => s.activeBranchId);
    const [tf, setTf] = useState<FinanceTimeframe>("day");
    const [includeFixed, setIncludeFixed] = useState(true);
    const [drill, setDrill] = useState<{ startDate: string; endDate: string } | null>(null);
    const [rangeMode, setRangeMode] = useState<RangeMode>("auto");
    const [cStart, setCStart] = useState(dayjs().subtract(30, "day").format("YYYY-MM-DD"));
    const [cEnd, setCEnd] = useState(dayjs().format("YYYY-MM-DD"));

    const range = useMemo(() => {
        const today = dayjs().format("YYYY-MM-DD");
        switch (rangeMode) {
            case "thisMonth": return { startDate: dayjs().startOf("month").format("YYYY-MM-DD"), endDate: today };
            case "lastMonth": return { startDate: dayjs().subtract(1, "month").startOf("month").format("YYYY-MM-DD"), endDate: dayjs().subtract(1, "month").endOf("month").format("YYYY-MM-DD") };
            case "thisYear": return { startDate: dayjs().startOf("year").format("YYYY-MM-DD"), endDate: today };
            case "custom": return { startDate: cStart, endDate: cEnd };
            default: {
                const cfg = TF.find((t) => t.value === tf)!;
                return { startDate: dayjs().subtract(cfg.days, "day").format("YYYY-MM-DD"), endDate: today };
            }
        }
    }, [rangeMode, tf, cStart, cEnd]);

    const { data, isLoading } = useQuery({
        queryKey: ["finance-candles", tf, range.startDate, range.endDate, includeFixed, activeBranchId],
        queryFn: () => getFinanceCandles(tf, range.startDate, range.endDate, includeFixed),
        enabled: isOwner,
    });

    const onCandleClick = useCallback((time: string) => setDrill(bucketRange(time, tf)), [tf]);

    // Loading auth state — hindari flicker "khusus owner"
    if (currentUser === undefined) return <div className="min-h-screen grid place-items-center text-muted-foreground"><Loader2 className="animate-spin" /></div>;
    if (!isOwner) return (
        <div className="min-h-screen grid place-items-center text-muted-foreground">
            <div className="text-center"><Lock className="mx-auto mb-2" /> Halaman khusus owner.</div>
        </div>
    );

    const s = data?.summary;
    const TrendIcon = s?.trend === "bullish" ? TrendingUp : s?.trend === "bearish" ? TrendingDown : Minus;
    const trendCls = s?.trend === "bullish" ? "text-green-600 bg-green-500/10" : s?.trend === "bearish" ? "text-red-600 bg-red-500/10" : "text-muted-foreground bg-muted";
    const trendLabel = s?.trend === "bullish" ? "Bullish" : s?.trend === "bearish" ? "Bearish" : "Datar";

    return (
        <div className="min-h-screen p-4 sm:p-6 max-w-6xl mx-auto space-y-5">
            <div className="flex items-center gap-3">
                <Link href="/owner" className="p-2 rounded-lg hover:bg-muted"><ArrowLeft size={18} /></Link>
                <div className="flex-1">
                    <h1 className="text-xl font-semibold flex items-center gap-2"><Activity size={20} /> Analisa Keuangan</h1>
                    <p className="text-xs text-muted-foreground">Saldo kas berjalan sebagai candlestick — baca tren, hari rame/sepi, & anomali.</p>
                </div>
                {s && (
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-medium ${trendCls}`}>
                        <TrendIcon size={15} /> {trendLabel} {s.changePct > 0 ? "+" : ""}{s.changePct}%
                    </span>
                )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <div className="flex gap-1 p-1 rounded-xl bg-muted w-fit" title="Granularitas candle">
                    {TF.map((t) => (
                        <button key={t.value} onClick={() => setTf(t.value)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${tf === t.value ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                            {t.label}
                        </button>
                    ))}
                </div>
                <div className="flex gap-1 p-1 rounded-xl bg-muted w-fit" title="Rentang tanggal">
                    {RANGE_PRESETS.map((r) => (
                        <button key={r.value} onClick={() => setRangeMode(r.value)}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${rangeMode === r.value ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                            {r.label}
                        </button>
                    ))}
                </div>
                {rangeMode === "custom" && (
                    <div className="flex items-center gap-1.5">
                        <input type="date" value={cStart} max={cEnd} onChange={(e) => setCStart(e.target.value)} className="bg-background border border-border rounded-lg px-2 py-1 text-xs text-foreground" />
                        <span className="text-muted-foreground text-xs">→</span>
                        <input type="date" value={cEnd} min={cStart} onChange={(e) => setCEnd(e.target.value)} className="bg-background border border-border rounded-lg px-2 py-1 text-xs text-foreground" />
                    </div>
                )}
                <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
                    <input type="checkbox" checked={includeFixed} onChange={(e) => setIncludeFixed(e.target.checked)} className="accent-[var(--primary)]" />
                    Sertakan beban tetap
                </label>
                <span className="ml-auto text-xs text-muted-foreground flex items-center gap-1"><CalendarRange size={13} /> {dayjs(range.startDate).format("D MMM YYYY")} – {dayjs(range.endDate).format("D MMM YYYY")}</span>
            </div>

            {s && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                        { l: "Saldo Akhir", v: fmtRp(s.closingBalance) },
                        { l: "Total Masuk", v: fmtRp(s.totalIncome) },
                        { l: "Total Keluar", v: fmtRp(s.totalExpense) },
                        { l: "Net", v: fmtRp(s.net) },
                    ].map((k) => (
                        <div key={k.l} className="rounded-xl border border-border bg-card p-3">
                            <div className="text-xs text-muted-foreground">{k.l}</div>
                            <div className="text-lg font-semibold mt-0.5">{k.v}</div>
                        </div>
                    ))}
                </div>
            )}

            <div className="rounded-2xl border border-border bg-card p-3">
                <div className="flex items-center justify-between px-1 pb-2">
                    <h2 className="text-sm font-medium text-muted-foreground">Grafik Saldo (klik candle untuk lihat jurnal)</h2>
                </div>
                {isLoading ? (
                    <div className="h-[420px] grid place-items-center text-muted-foreground"><Loader2 className="animate-spin" /></div>
                ) : data && data.candles.length ? (
                    <CandleChart candles={data.candles} onCandleClick={onCandleClick} />
                ) : (
                    <div className="h-[420px] grid place-items-center text-muted-foreground">Belum ada data pada rentang ini.</div>
                )}
            </div>

            <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
                <h2 className="text-sm font-semibold flex items-center gap-2"><GitCompareArrows size={16} /> Perbandingan & Insight</h2>
                <ComparisonInsights startDate={range.startDate} endDate={range.endDate} includeFixed={includeFixed} />
            </section>

            <div className="grid lg:grid-cols-2 gap-4">
                <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
                    <h2 className="text-sm font-semibold flex items-center gap-2"><PieIcon size={16} /> Pengeluaran ke Mana</h2>
                    <ExpenseBreakdownPanel startDate={range.startDate} endDate={range.endDate} includeFixed={includeFixed} />
                </section>
                <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
                    <h2 className="text-sm font-semibold flex items-center gap-2"><Scale size={16} /> Rekonsiliasi Saldo & Bank</h2>
                    <ReconciliationPanel startDate={range.startDate} endDate={range.endDate} />
                </section>
            </div>

            <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
                <h2 className="text-sm font-semibold flex items-center gap-2"><Building2 size={16} /> Konsolidasi Saldo Tutup Buku (Semua Cabang)</h2>
                <ConsolidationPanel />
            </section>

            <div className="grid lg:grid-cols-2 gap-4">
                <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
                    <h2 className="text-sm font-semibold flex items-center gap-2"><Activity size={16} /> Hari & Jam Rame/Sepi</h2>
                    <HeatmapPanel startDate={range.startDate} endDate={range.endDate} />
                </section>
                <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-semibold flex items-center gap-2"><AlertTriangle size={16} /> Pergerakan Uang Tidak Jelas</h2>
                        <button onClick={() => setDrill(range)} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                            <BookOpen size={13} /> Jurnal penuh
                        </button>
                    </div>
                    <AnomalyPanel startDate={range.startDate} endDate={range.endDate} />
                </section>
            </div>

            <JournalDrawer
                open={!!drill}
                startDate={drill?.startDate || range.startDate}
                endDate={drill?.endDate || range.endDate}
                includeFixed={includeFixed}
                onClose={() => setDrill(null)}
            />
        </div>
    );
}
