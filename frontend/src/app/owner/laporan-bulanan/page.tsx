"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import "dayjs/locale/id";
import {
    Area, AreaChart, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
    ArrowLeft, FileText, Loader2, Lock, FileBarChart, TrendingUp, TrendingDown, Minus,
    Sparkles, Rocket, Wallet, Scale, AlertTriangle, Lightbulb, Building2,
} from "lucide-react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useBranchStore } from "@/store/branch-store";
import api from "@/lib/api/client";
import { getFinanceMonthlyReport, type FinanceMonthlyReport } from "@/lib/api/finance-analytics";
import { StatusBadge, type BadgeTone } from "@/components/ui/status-badge";
import { buildMonthlyReportPDF } from "@/lib/report-pdf";

dayjs.locale("id");
const rp = (n: number) => "Rp " + Math.round(Number(n) || 0).toLocaleString("id-ID");
const num = (n: number) => Math.round(Number(n) || 0).toLocaleString("id-ID");
const AXIS_TICK = { fontSize: 11, fill: "var(--muted-foreground)" };

export default function LaporanBulananPage() {
    const { isOwner, currentUser } = useCurrentUser();
    const activeBranchId = useBranchStore((s) => s.activeBranchId);
    const setActiveBranchId = useBranchStore((s) => s.setActiveBranchId);
    const [month, setMonth] = useState(dayjs().format("YYYY-MM"));
    const [includeFixed, setIncludeFixed] = useState(true);
    const [y, m] = month.split("-").map(Number);

    const { data: branches } = useQuery({
        queryKey: ["active-branches"],
        queryFn: async () => (await api.get("/company-branches/active")).data as { id: number; name: string }[],
        staleTime: 5 * 60 * 1000,
        enabled: isOwner,
    });
    const { data, isLoading } = useQuery({
        queryKey: ["finance-monthly-report", y, m, includeFixed, activeBranchId],
        queryFn: () => getFinanceMonthlyReport(y, m, includeFixed),
        enabled: isOwner,
    });

    if (currentUser === undefined)
        return <div className="min-h-screen grid place-items-center text-muted-foreground"><Loader2 className="animate-spin" /></div>;
    if (!isOwner)
        return <div className="min-h-screen grid place-items-center text-muted-foreground"><div className="text-center"><Lock className="mx-auto mb-2" /> Halaman khusus owner.</div></div>;

    return (
        <div className="min-h-screen p-4 sm:p-6 max-w-5xl mx-auto space-y-5">
            <div className="flex items-center gap-3">
                <Link href="/owner" className="p-2 rounded-lg hover:bg-muted"><ArrowLeft size={18} /></Link>
                <div className="flex-1">
                    <h1 className="text-xl font-semibold flex items-center gap-2"><FileBarChart size={20} /> Laporan Bulanan Owner</h1>
                    <p className="text-xs text-muted-foreground">Jurnal keuangan sebulan penuh + analisa otomatis + perkembangan perusahaan. Export PDF kapan saja.</p>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 bg-card rounded-2xl border border-border p-3">
                <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
                    className="bg-background border border-border rounded-lg px-2.5 py-1.5 text-sm text-foreground" />
                {branches && branches.length > 0 && (
                    <label className="inline-flex items-center gap-1.5 text-sm">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <select value={activeBranchId ?? "all"} onChange={(e) => setActiveBranchId(e.target.value === "all" ? null : Number(e.target.value))}
                            className="bg-background border border-border rounded-lg px-2.5 py-1.5 text-sm text-foreground">
                            <option value="all">Semua Cabang (konsolidasi)</option>
                            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                    </label>
                )}
                <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
                    <input type="checkbox" checked={includeFixed} onChange={(e) => setIncludeFixed(e.target.checked)} className="accent-[var(--primary)]" />
                    Sertakan beban tetap
                </label>
                <button onClick={() => data && buildMonthlyReportPDF(data)} disabled={!data}
                    className="ml-auto inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary px-3 py-2 rounded-lg text-sm font-medium hover:bg-primary/20 disabled:opacity-50">
                    <FileText className="h-4 w-4" /> Export PDF
                </button>
            </div>

            <p className="text-xs text-muted-foreground -mt-2">
                {activeBranchId == null
                    ? "Mode Semua Cabang menggabungkan seluruh cabang + pusat. Pilih cabang/pusat spesifik untuk laporan terpisah."
                    : "Laporan difilter untuk satu cabang/pusat. Pilih “Semua Cabang” untuk konsolidasi."}
            </p>

            {isLoading ? (
                <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : !data ? (
                <div className="text-center py-16 text-muted-foreground">Gagal memuat data.</div>
            ) : (
                <ReportBody data={data} />
            )}
        </div>
    );
}

function ReportBody({ data }: { data: FinanceMonthlyReport }) {
    const s = data.summary;
    const t = data.trend;
    const TrendIcon = t.direction === "naik" ? TrendingUp : t.direction === "turun" ? TrendingDown : Minus;
    const trendCls = t.direction === "naik" ? "text-emerald-600 bg-emerald-500/10" : t.direction === "turun" ? "text-red-600 bg-red-500/10" : "text-muted-foreground bg-muted";
    const chartData = t.months.map((mo) => ({ label: mo.label.replace(/ \d{4}$/, ""), Laba: mo.net }));

    return (
        <div className="space-y-5">
            {/* KPI */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Card label="Omzet" value={rp(s.income)} cls="text-emerald-600 dark:text-emerald-300" />
                <Card label="Pengeluaran" value={rp(s.expense)} cls="text-red-600 dark:text-red-300" />
                <Card label="Laba / Rugi (kas)" value={rp(s.net)} cls={s.net >= 0 ? "text-indigo-600 dark:text-indigo-300" : "text-red-600 dark:text-red-300"} />
                <Card label="Margin" value={`${s.margin}%`} cls="text-amber-600 dark:text-amber-300" />
            </div>

            {/* Analisa otomatis */}
            <div className="bg-card rounded-2xl border border-border p-4 space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-foreground flex items-center gap-2"><Sparkles size={16} /> Analisa Otomatis</h2>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${trendCls}`}>
                        <TrendIcon size={13} /> Tren {t.direction} {t.avgMonthlyGrowthPct > 0 ? "+" : ""}{t.avgMonthlyGrowthPct}%
                    </span>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                    <AnalysisBlock icon={<Sparkles size={14} />} title="Ringkasan Eksekutif" lines={data.analysis.executive} tone="accent" />
                    <AnalysisBlock icon={<Rocket size={14} />} title="Perkembangan Perusahaan" lines={data.analysis.growth} tone="info" />
                    <AnalysisBlock icon={<Scale size={14} />} title="Efisiensi Biaya" lines={data.analysis.efficiency} tone="neutral" />
                    <AnalysisBlock icon={<Wallet size={14} />} title="Kesehatan Arus Kas" lines={data.analysis.cashHealth} tone="neutral" />
                    <AnalysisBlock icon={<AlertTriangle size={14} />} title="Peringatan" lines={data.analysis.warnings} tone="warning" />
                    <AnalysisBlock icon={<Lightbulb size={14} />} title="Rekomendasi" lines={data.analysis.recommendations} tone="success" />
                </div>
            </div>

            {/* Grafik perkembangan */}
            <Section title="Perkembangan Laba (6 Bulan)">
                <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                        <defs>
                            <linearGradient id="labaGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="label" tick={AXIS_TICK} axisLine={{ stroke: "var(--border)" }} tickLine={{ stroke: "var(--border)" }} />
                        <YAxis tick={AXIS_TICK} axisLine={{ stroke: "var(--border)" }} tickLine={{ stroke: "var(--border)" }} tickFormatter={(v) => (v / 1_000_000).toFixed(0) + "jt"} />
                        <Tooltip formatter={(v) => rp(Number(v) || 0)} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--foreground)" }} />
                        <Area type="monotone" dataKey="Laba" stroke="#6366f1" strokeWidth={2} fill="url(#labaGrad)" />
                    </AreaChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-1">
                    {t.bestMonth && <span>Terbaik: <strong className="text-emerald-600 dark:text-emerald-300">{t.bestMonth.label}</strong> ({rp(t.bestMonth.net)})</span>}
                    {t.worstMonth && <span>Terlemah: <strong className="text-red-600 dark:text-red-300">{t.worstMonth.label}</strong> ({rp(t.worstMonth.net)})</span>}
                </div>
            </Section>

            {/* Tabel pendapatan & pengeluaran */}
            <div className="grid lg:grid-cols-2 gap-4">
                <Section title="Pendapatan per Kanal">
                    {s.incomeChannels.length === 0 ? <Empty /> : (
                        <PreviewTable head={["Kanal", "Jumlah"]}
                            rows={s.incomeChannels.map((c) => [c.channel, num(c.total)])}
                            foot={["TOTAL", num(s.income)]} />
                    )}
                </Section>
                <Section title="Pengeluaran per Kategori">
                    {s.expenseCategories.length === 0 ? <Empty /> : (
                        <PreviewTable head={["Kategori", "Jumlah", "%"]}
                            rows={s.expenseCategories.map((c) => [c.category, num(c.amount), `${c.pct}%`])}
                            foot={["TOTAL", num(s.expense), "100%"]} />
                    )}
                </Section>
            </div>

            {/* Perbandingan vs bulan lalu */}
            <Section title="Perbandingan vs Bulan Sebelumnya">
                <div className="grid grid-cols-3 gap-3 text-center">
                    <DeltaCard label="Omzet" pct={data.comparison.delta.incomePct} />
                    <DeltaCard label="Pengeluaran" pct={data.comparison.delta.expensePct} invert />
                    <DeltaCard label="Laba" pct={data.comparison.delta.netPct} />
                </div>
                {data.comparison.topExpenseChanges.length > 0 && (
                    <div className="mt-3">
                        <PreviewTable head={["Perubahan Biaya Terbesar", "Bulan Ini", "Bulan Lalu", "Selisih"]}
                            rows={data.comparison.topExpenseChanges.map((c) => [c.category, num(c.current), num(c.previous), (c.delta >= 0 ? "+" : "") + num(c.delta)])} />
                    </div>
                )}
            </Section>

            {/* Anomali */}
            {data.anomalies.items.length > 0 && (
                <Section title={`Pergerakan Uang yang Perlu Dicek (${data.anomalies.count})`}>
                    <div className="space-y-2">
                        {data.anomalies.items.map((a, i) => (
                            <div key={i} className="flex items-start gap-2 text-sm border-b border-border/60 last:border-0 pb-2 last:pb-0">
                                <StatusBadge tone={a.severity === "high" ? "danger" : a.severity === "med" ? "warning" : "neutral"}>{a.severity.toUpperCase()}</StatusBadge>
                                <div className="flex-1">
                                    <span className="text-foreground">{a.reason}</span>
                                    <span className="text-muted-foreground text-xs"> — {dayjs(a.date).format("DD MMM YYYY")}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </Section>
            )}

            <div className="rounded-xl border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground">
                <strong>Basis kas:</strong> Omzet = uang masuk, Pengeluaran = uang keluar {data.branchName ? `(cabang ${data.branchName})` : "(semua cabang)"}
                {" "}— {data.period.monthLabel} {data.period.year}. Analisa dihasilkan otomatis dari data; angka mengikuti opsi &quot;Sertakan beban tetap&quot;.
            </div>
        </div>
    );
}

// ── Sub-komponen ──
function Card({ label, value, cls }: { label: string; value: string; cls?: string }) {
    return (
        <div className="bg-card rounded-xl border border-border p-3.5">
            <div className="text-xs text-muted-foreground mb-1">{label}</div>
            <div className={`text-base sm:text-lg font-bold leading-tight ${cls || "text-foreground"}`}>{value}</div>
        </div>
    );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="bg-card rounded-2xl border border-border p-4">
            <h2 className="font-semibold text-foreground mb-3">{title}</h2>
            {children}
        </div>
    );
}
function Empty() { return <div className="text-sm text-muted-foreground py-3 text-center">Tidak ada data.</div>; }

function AnalysisBlock({ icon, title, lines, tone }: { icon: React.ReactNode; title: string; lines: string[]; tone: BadgeTone }) {
    if (!lines.length) return null;
    const accent: Record<BadgeTone, string> = {
        neutral: "text-foreground", info: "text-blue-600 dark:text-blue-300", success: "text-emerald-600 dark:text-emerald-300",
        warning: "text-amber-600 dark:text-amber-300", danger: "text-red-600 dark:text-red-300", accent: "text-primary",
    };
    return (
        <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
            <div className={`flex items-center gap-1.5 text-xs font-semibold mb-1.5 ${accent[tone]}`}>{icon} {title}</div>
            <ul className="space-y-1 text-sm text-foreground/90">
                {lines.map((l, i) => <li key={i} className="flex gap-1.5"><span className="text-muted-foreground">•</span><span>{l}</span></li>)}
            </ul>
        </div>
    );
}

function DeltaCard({ label, pct, invert }: { label: string; pct: number; invert?: boolean }) {
    const good = invert ? pct <= 0 : pct >= 0;
    const cls = pct === 0 ? "text-muted-foreground" : good ? "text-emerald-600 dark:text-emerald-300" : "text-red-600 dark:text-red-300";
    return (
        <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
            <div className="text-xs text-muted-foreground mb-1">{label}</div>
            <div className={`text-base font-bold ${cls}`}>{pct > 0 ? "+" : ""}{pct}%</div>
        </div>
    );
}

function PreviewTable({ head, rows, foot }: { head: string[]; rows: (string | number)[][]; foot?: (string | number)[] }) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[320px]">
                <thead><tr className="text-[10px] text-muted-foreground border-b border-border">
                    {head.map((h, i) => <th key={i} className={`py-1.5 px-2 ${i === 0 ? "text-left" : "text-right"}`}>{h}</th>)}
                </tr></thead>
                <tbody>
                    {rows.map((r, ri) => (
                        <tr key={ri} className="border-b border-border/60 last:border-0">
                            {r.map((c, ci) => <td key={ci} className={`py-1.5 px-2 ${ci === 0 ? "text-left font-medium text-foreground" : "text-right font-mono text-muted-foreground"}`}>{c}</td>)}
                        </tr>
                    ))}
                </tbody>
                {foot && <tfoot><tr className="border-t-2 border-border font-semibold">
                    {foot.map((c, ci) => <td key={ci} className={`py-1.5 px-2 ${ci === 0 ? "text-left" : "text-right font-mono"} text-foreground`}>{c}</td>)}
                </tr></tfoot>}
            </table>
        </div>
    );
}
