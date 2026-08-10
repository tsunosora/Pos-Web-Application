"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import "dayjs/locale/id";
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, Cell,
} from "recharts";
import {
    Crown, Wallet, TrendingUp, Receipt, PiggyBank, Landmark, Package, CalendarClock, Clock,
    Loader2, Lock, Building2, HandCoins, BarChart3, Info, ChevronDown, ArrowLeft,
    Plus, Trash2, Pencil, X, Check, Users, Palette, Factory, Sparkles, FileBarChart,
} from "lucide-react";
import api from "@/lib/api/client";
import { getKpiReport, getDesignerLeaderboard, getOperatorLeaderboard } from "@/lib/api";
import { getProfitReport, getOrdersByHour } from "@/lib/api/reports";
import {
    getCashflows, getCashflowMonthlyTrend, getCashflowCategoryBreakdown,
    getBankAccountsSummary, type BankAccountSummary,
} from "@/lib/api/cashflow";
import {
    getFixedExpenses, createFixedExpense, updateFixedExpense, deleteFixedExpense,
    type FixedExpense, type FixedExpenseCategory,
} from "@/lib/api/fixed-expenses";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useBranchStore } from "@/store/branch-store";
import { BonusPanel } from "./BonusPanel";
import { CustomMetricPanel } from "./CustomMetricPanel";
import { CsRatingSection } from "@/components/owner/CsRatingSection";
import { TaskLoadPanel } from "@/components/owner/TaskLoadPanel";
import { StudioAiSettings } from "@/components/owner/StudioAiSettings";
import { badgeToneClass } from "@/components/ui/status-badge";

dayjs.locale("id");

const PERIODS = [
    { value: "today", label: "Hari Ini" },
    { value: "week", label: "7 Hari" },
    { value: "month", label: "Bulan Ini" },
    { value: "custom", label: "Kustom" },
] as const;
type Period = typeof PERIODS[number]["value"];

const CHART_TOOLTIP_STYLE = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--foreground)", boxShadow: "0 8px 24px -8px rgb(0 0 0 / 0.25)" } as const;
const AXIS_TICK = { fill: "var(--muted-foreground)", fontSize: 11 } as const;

// Warna bar distribusi order per jam berdasarkan level ramai/sepi
const HOUR_LEVEL_COLOR: Record<string, string> = {
    ramai: "#10b981",   // hijau — jam ramai
    normal: "#6366f1",  // indigo — normal
    sepi: "#f59e0b",    // amber — jam sepi
    tutup: "var(--muted)",
};
const hhmm = (h?: number | null) => (h == null ? "-" : `${String(h).padStart(2, "0")}:00`);
const rangeLabel = (r?: { from: number; to: number } | null) =>
    r ? (r.from === r.to ? hhmm(r.from) : `${hhmm(r.from)}–${hhmm(r.to)}`) : "-";

const CAT_LABEL: Record<FixedExpenseCategory, string> = { GAJI: "Gaji", SEWA: "Sewa", ANGSURAN: "Angsuran", SUPPLIER: "Supplier", LAINNYA: "Lainnya" };
const CAT_CLS: Record<FixedExpenseCategory, string> = {
    GAJI: badgeToneClass.info, SEWA: badgeToneClass.warning,
    ANGSURAN: badgeToneClass.accent, SUPPLIER: badgeToneClass.success, LAINNYA: badgeToneClass.neutral,
};
const CATEGORIES: FixedExpenseCategory[] = ["GAJI", "SEWA", "ANGSURAN", "SUPPLIER", "LAINNYA"];

const fmtRp = (n: number) => "Rp " + Math.round(Number(n) || 0).toLocaleString("id-ID");
const fmtRpShort = (n: number) => {
    const v = Math.round(Number(n) || 0);
    if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}jt`;
    if (Math.abs(v) >= 1_000) return `${Math.round(v / 1_000)}rb`;
    return String(v);
};

// Kategori pengeluaran kas yang BUKAN biaya operasional (pembelian stok / settlement internal).
// "sub"/"printing luar" = COGS yang sudah masuk HPP (Laba Kotor) → jangan tampil lagi di opex biar tak ganda.
const NON_OPEX_KEYWORDS = ["inter", "antar cabang", "titipan", "stok", "stock", "beli", "pembelian", "supplier", "restock", "modal", "sub / printing", "printing luar"];
const isNonOpex = (cat?: string) => NON_OPEX_KEYWORDS.some(k => (cat || "").toLowerCase().includes(k));

function computeRange(period: Period, cStart: string, cEnd: string): { start: string; end: string } {
    const today = dayjs();
    if (period === "today") return { start: today.format("YYYY-MM-DD"), end: today.format("YYYY-MM-DD") };
    if (period === "week") return { start: today.subtract(6, "day").format("YYYY-MM-DD"), end: today.format("YYYY-MM-DD") };
    if (period === "month") return { start: today.startOf("month").format("YYYY-MM-DD"), end: today.format("YYYY-MM-DD") };
    return { start: cStart || today.startOf("month").format("YYYY-MM-DD"), end: cEnd || today.format("YYYY-MM-DD") };
}

const EMPTY_FORM = { name: "", category: "GAJI" as FixedExpenseCategory, amount: "", branchId: "" as number | "", dueDay: "" as number | "", note: "" };

export default function OwnerDashboardPage() {
    const { isOwner, currentUser } = useCurrentUser();
    const qc = useQueryClient();
    const activeBranchId = useBranchStore(s => s.activeBranchId);
    const setActiveBranchId = useBranchStore(s => s.setActiveBranchId);

    const [period, setPeriod] = useState<Period>("month");
    const [cStart, setCStart] = useState("");
    const [cEnd, setCEnd] = useState("");
    const { start, end } = useMemo(() => computeRange(period, cStart, cEnd), [period, cStart, cEnd]);

    const [formOpen, setFormOpen] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);
    const [form, setForm] = useState(EMPTY_FORM);

    const { data: branches } = useQuery({
        queryKey: ["active-branches"],
        queryFn: async () => (await api.get("/company-branches/active")).data as { id: number; name: string; code?: string | null }[],
        enabled: isOwner,
        staleTime: 5 * 60 * 1000,
    });

    const qkey = [period, start, end, activeBranchId] as const;
    const profitQ = useQuery({ queryKey: ["owner-profit", ...qkey], queryFn: () => getProfitReport(start, end), enabled: isOwner });
    const cashQ = useQuery({ queryKey: ["owner-cash", ...qkey], queryFn: () => getCashflows(start, end), enabled: isOwner });
    const catQ = useQuery({ queryKey: ["owner-cat", ...qkey], queryFn: () => getCashflowCategoryBreakdown(start, end), enabled: isOwner });
    const trendQ = useQuery({ queryKey: ["owner-trend", activeBranchId], queryFn: () => getCashflowMonthlyTrend(), enabled: isOwner });
    const banksQ = useQuery({ queryKey: ["owner-banks", ...qkey], queryFn: () => getBankAccountsSummary(start, end), enabled: isOwner });
    const kpiQ = useQuery({ queryKey: ["owner-kpi", ...qkey], queryFn: () => getKpiReport({ period, start: period === "custom" ? start : undefined, end: period === "custom" ? end : undefined }), enabled: isOwner });
    const fixedQ = useQuery({ queryKey: ["owner-fixed"], queryFn: () => getFixedExpenses(), enabled: isOwner });
    const lbParams = { period, start: period === "custom" ? start : undefined, end: period === "custom" ? end : undefined } as const;
    const designerQ = useQuery({ queryKey: ["owner-designer", ...qkey], queryFn: () => getDesignerLeaderboard(lbParams), enabled: isOwner });
    const operatorQ = useQuery({ queryKey: ["owner-operator", ...qkey], queryFn: () => getOperatorLeaderboard(lbParams), enabled: isOwner });
    const ordersHourQ = useQuery({ queryKey: ["owner-orders-hour", ...qkey], queryFn: () => getOrdersByHour(start, end), enabled: isOwner });

    const invalidateFixed = () => qc.invalidateQueries({ queryKey: ["owner-fixed"] });
    const createMut = useMutation({ mutationFn: createFixedExpense, onSuccess: () => { invalidateFixed(); resetForm(); } });
    const updateMut = useMutation({ mutationFn: ({ id, data }: { id: number; data: any }) => updateFixedExpense(id, data), onSuccess: () => { invalidateFixed(); resetForm(); } });
    const deleteMut = useMutation({ mutationFn: deleteFixedExpense, onSuccess: invalidateFixed });
    const toggleMut = useMutation({ mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) => updateFixedExpense(id, { isActive }), onSuccess: invalidateFixed });

    function resetForm() { setForm(EMPTY_FORM); setEditId(null); setFormOpen(false); }
    function startEdit(e: FixedExpense) {
        setEditId(e.id);
        setForm({ name: e.name, category: e.category, amount: String(e.amount), branchId: e.branchId ?? "", dueDay: e.dueDay ?? "", note: e.note ?? "" });
        setFormOpen(true);
    }
    function submitForm(ev: React.FormEvent) {
        ev.preventDefault();
        const amount = Number(form.amount);
        if (!form.name.trim() || !Number.isFinite(amount) || amount <= 0) return;
        const payload = {
            name: form.name.trim(), category: form.category, amount,
            branchId: form.branchId === "" ? null : Number(form.branchId),
            dueDay: form.dueDay === "" ? null : Number(form.dueDay),
            note: form.note.trim() || null,
        };
        if (editId) updateMut.mutate({ id: editId, data: payload });
        else createMut.mutate(payload);
    }

    const profit = profitQ.data;
    const revenue = Number(profit?.totalRevenue || 0);
    const hpp = Number(profit?.totalHpp || 0);
    const grossProfit = Number(profit?.grossProfit || 0);
    const margin = Number(profit?.profitMargin || 0);
    const txCount = Number(profit?.transactionCount || 0);

    const cashSummary = cashQ.data?.summary || { totalIncome: 0, totalExpense: 0, balance: 0 };
    const expenseCats: { category: string; total: number }[] = useMemo(() => catQ.data?.expense || [], [catQ.data]);
    const opex = expenseCats.filter(e => !isNonOpex(e.category)).reduce((s, e) => s + Number(e.total || 0), 0);
    const opexEff = expenseCats.length ? opex : Number(cashSummary.totalExpense || 0);

    const piutang = Number(kpiQ.data?.totals?.pendingValue || 0);
    const banks: BankAccountSummary[] = banksQ.data || [];
    const bankBalance = banks.filter(b => b.currentBalance != null).reduce((s, b) => s + Number(b.currentBalance || 0), 0);

    // Beban tetap: pusat (branchId null) selalu ikut; cabang spesifik hanya saat cabang itu dipilih / mode semua.
    const fixedScoped = useMemo(() => (fixedQ.data || []).filter(e =>
        activeBranchId == null ? true : (e.branchId == null || e.branchId === activeBranchId),
    ), [fixedQ.data, activeBranchId]);
    const monthlyFixed = fixedScoped.filter(e => e.isActive).reduce((s, e) => s + Number(e.amount || 0), 0);
    const daysInPeriod = Math.max(1, dayjs(end).diff(dayjs(start), "day") + 1);
    const proratedFixed = monthlyFixed * daysInPeriod / 30;
    const estNetProfit = grossProfit - proratedFixed;

    const categories = useMemo(() => {
        const list = profit?.categories || [];
        return [...list].sort((a, b) => Number(b.grossProfit) - Number(a.grossProfit));
    }, [profit]);
    const topProducts = useMemo(() => {
        const list = profit?.items || [];
        return [...list].sort((a, b) => Number(b.grossProfit) - Number(a.grossProfit)).slice(0, 8);
    }, [profit]);
    const trendData = useMemo(() => {
        const t = trendQ.data || [];
        return t.map((r: { month: string; income: number; expense: number }) => ({ month: r.month, Pemasukan: Number(r.income || 0), Pengeluaran: Number(r.expense || 0) }));
    }, [trendQ.data]);
    const expenseChart = useMemo(() =>
        [...expenseCats].sort((a, b) => Number(b.total) - Number(a.total)).slice(0, 8)
            .map(e => ({ name: e.category || "Lainnya", value: Number(e.total || 0) })),
    [expenseCats]);

    // ── Distribusi order per jam (ramai/sepi) ─────────────────────────────────
    const ordersHour = ordersHourQ.data;
    const ordersHourData = useMemo(
        () => (ordersHour?.byHour ?? []).map(h => ({
            jam: String(h.hour).padStart(2, "0"),
            Order: h.count,
            revenue: h.revenue,
            level: h.level,
        })),
        [ordersHour],
    );
    const ordersTotal = ordersHour?.totalOrders ?? 0;
    const ordersRevenue = ordersHour?.totalRevenue ?? 0;

    // ── Leads & Leaderboard Karyawan ──────────────────────────────────────────
    const kpiTotals = kpiQ.data?.totals;
    const kpiMetrics = kpiQ.data?.metrics;
    const leadsBySource: { source: string; count: number }[] = useMemo(() => {
        const arr = kpiQ.data?.leadsBySource || [];
        return [...arr].sort((a: any, b: any) => b.count - a.count);
    }, [kpiQ.data]);
    const csRows = useMemo(() => {
        const arr = kpiQ.data?.leaderboard || [];
        return [...arr].sort((a: any, b: any) => (b.wonValue + b.walkinValue) - (a.wonValue + a.walkinValue));
    }, [kpiQ.data]);
    const designerRows = useMemo(() => {
        const arr = designerQ.data?.leaderboard || [];
        return [...arr].sort((a: any, b: any) => b.omzet - a.omzet || b.acc - a.acc);
    }, [designerQ.data]);
    const operatorRows = useMemo(() => [...(operatorQ.data?.leaderboard || [])], [operatorQ.data]);

    const branchName = (id: number | null) => id == null ? "Pusat / Semua" : (branches?.find(b => b.id === id)?.name || `Cabang #${id}`);
    const branchLabel = activeBranchId == null ? "Semua Cabang" : branchName(activeBranchId);
    const loading = profitQ.isLoading || cashQ.isLoading || kpiQ.isLoading;

    // Saat role masih dimuat, jangan tampilkan "akses ditolak" dulu (hindari flash utk owner).
    if (currentUser === undefined) {
        return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
    }
    if (!isOwner) {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center py-24 text-center px-4">
                <div className="h-14 w-14 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center mb-4"><Lock className="h-7 w-7" /></div>
                <h1 className="text-xl font-bold text-foreground">Khusus Owner</h1>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">Halaman ini hanya bisa diakses oleh pemilik / owner.</p>
                <Link href="/" className="mt-5 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"><ArrowLeft className="h-4 w-4" /> Kembali ke aplikasi</Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Top bar (halaman terpisah, tanpa sidebar app) */}
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-20 shadow">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="rounded-lg bg-white/15 p-2"><Crown className="h-5 w-5" /></div>
                    <div className="min-w-0">
                        <div className="font-semibold leading-tight">Dashboard Owner</div>
                        <div className="text-xs text-amber-50/90">Ringkasan keuangan — {branchLabel}</div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Link href="/owner/analisa-keuangan" className="inline-flex items-center gap-1.5 text-sm font-medium bg-white/15 hover:bg-white/25 rounded-lg px-3 py-1.5 transition-colors">
                        <BarChart3 className="h-4 w-4" /> <span className="hidden sm:inline">Analisa Keuangan</span>
                    </Link>
                    <Link href="/owner/laporan-bulanan" className="inline-flex items-center gap-1.5 text-sm font-medium bg-white/15 hover:bg-white/25 rounded-lg px-3 py-1.5 transition-colors">
                        <FileBarChart className="h-4 w-4" /> <span className="hidden sm:inline">Laporan Bulanan</span>
                    </Link>
                    <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium bg-white/15 hover:bg-white/25 rounded-lg px-3 py-1.5 transition-colors">
                        <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Kembali ke App</span>
                    </Link>
                </div>
            </div>

            <div className="max-w-7xl mx-auto p-4 space-y-5 pb-10">
                {/* Filter */}
                <div className="rounded-2xl glass p-3 sm:p-4 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground mr-1">Periode</span>
                    {PERIODS.map(p => (
                        <button key={p.value} onClick={() => setPeriod(p.value)}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${period === p.value ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-accent"}`}>
                            {p.label}
                        </button>
                    ))}
                    {period === "custom" && (
                        <span className="flex items-center gap-1.5">
                            <input type="date" value={cStart} onChange={e => setCStart(e.target.value)} className="bg-background border border-border rounded-lg px-2 py-1 text-xs text-foreground" />
                            <span className="text-muted-foreground text-xs">→</span>
                            <input type="date" value={cEnd} onChange={e => setCEnd(e.target.value)} className="bg-background border border-border rounded-lg px-2 py-1 text-xs text-foreground" />
                        </span>
                    )}
                    <label className="ml-auto inline-flex items-center gap-1.5 text-sm">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <select
                            value={activeBranchId ?? "all"}
                            onChange={e => setActiveBranchId(e.target.value === "all" ? null : Number(e.target.value))}
                            className="bg-background border border-border rounded-lg px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                            <option value="all">Semua Cabang</option>
                            {(branches || []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                    </label>
                </div>

                {loading ? (
                    <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
                ) : (
                    <>
                        {/* Kartu utama */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            <StatCard icon={<Wallet className="h-5 w-5 text-emerald-600" />} label="Omzet (terbayar)" value={fmtRp(revenue)} sub={`${txCount} transaksi lunas`} />
                            <StatCard icon={<TrendingUp className="h-5 w-5 text-indigo-600" />} label="Laba Kotor" value={fmtRp(grossProfit)} sub={`margin ${margin.toFixed(1)}%`} valueClass="text-indigo-600 dark:text-indigo-300" />
                            <StatCard icon={<PiggyBank className="h-5 w-5 text-violet-600" />} label="Estimasi Laba Bersih" value={fmtRp(estNetProfit)} sub="Laba Kotor − beban tetap" valueClass={estNetProfit >= 0 ? "text-violet-600 dark:text-violet-300" : "text-red-600 dark:text-red-300"} />
                            <StatCard icon={<HandCoins className="h-5 w-5 text-amber-600" />} label="Piutang" value={fmtRp(piutang)} sub="belum dibayar pelanggan" valueClass="text-amber-600 dark:text-amber-300" />
                        </div>

                        {/* Kartu sekunder */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            <StatCard icon={<Package className="h-5 w-5 text-slate-500" />} label="HPP (modal)" value={fmtRp(hpp)} sub="harga pokok terjual" />
                            <StatCard icon={<CalendarClock className="h-5 w-5 text-rose-500" />} label="Beban Tetap / Bulan" value={fmtRp(monthlyFixed)} sub={`${fixedScoped.filter(e => e.isActive).length} item aktif`} valueClass="text-rose-600 dark:text-rose-300" />
                            <StatCard icon={<Receipt className="h-5 w-5 text-red-500" />} label="Biaya Operasional (kas)" value={fmtRp(opexEff)} sub="info — tidak dikurangi ke laba bersih" />
                            <StatCard icon={<Landmark className="h-5 w-5 text-sky-600" />} label="Saldo Bank" value={fmtRp(bankBalance)} sub="saldo tercatat (tutup shift)" valueClass="text-sky-600 dark:text-sky-300" />
                        </div>

                        {/* Beban tetap bulanan — kelola */}
                        <Section icon={<CalendarClock className="h-5 w-5" />} title="Beban Tetap Bulanan" subtitle="Gaji, sewa, angsuran mesin, supplier — dipakai menghitung laba bersih.">
                            <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                                <div className="text-sm text-muted-foreground">
                                    Total ({branchLabel}): <strong className="text-foreground">{fmtRp(monthlyFixed)}</strong>/bln
                                    <span className="text-xs"> · prorata periode ini {fmtRp(proratedFixed)}</span>
                                </div>
                                {!formOpen && (
                                    <button onClick={() => { setForm({ ...EMPTY_FORM, branchId: activeBranchId ?? "" }); setEditId(null); setFormOpen(true); }}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
                                        <Plus className="h-4 w-4" /> Tambah Beban
                                    </button>
                                )}
                            </div>

                            {formOpen && (
                                <form onSubmit={submitForm} className="mb-3 rounded-xl border border-border bg-background/50 p-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 items-end">
                                    <div className="col-span-2 sm:col-span-1">
                                        <label className="text-[11px] text-muted-foreground block mb-0.5">Nama</label>
                                        <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="mis. Gaji Andi" className="w-full border border-border rounded-lg px-2 py-1.5 text-sm bg-background text-foreground" />
                                    </div>
                                    <div>
                                        <label className="text-[11px] text-muted-foreground block mb-0.5">Kategori</label>
                                        <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as FixedExpenseCategory }))} className="w-full border border-border rounded-lg px-2 py-1.5 text-sm bg-background text-foreground">
                                            {CATEGORIES.map(c => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[11px] text-muted-foreground block mb-0.5">Nominal/bln</label>
                                        <input type="number" min={0} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="3000000" className="w-full border border-border rounded-lg px-2 py-1.5 text-sm bg-background text-foreground" />
                                    </div>
                                    <div>
                                        <label className="text-[11px] text-muted-foreground block mb-0.5">Cabang</label>
                                        <select value={form.branchId === "" ? "" : String(form.branchId)} onChange={e => setForm(f => ({ ...f, branchId: e.target.value === "" ? "" : Number(e.target.value) }))} className="w-full border border-border rounded-lg px-2 py-1.5 text-sm bg-background text-foreground">
                                            <option value="">Pusat / Semua</option>
                                            {(branches || []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[11px] text-muted-foreground block mb-0.5">Jatuh tempo</label>
                                        <input type="number" min={1} max={31} value={form.dueDay} onChange={e => setForm(f => ({ ...f, dueDay: e.target.value === "" ? "" : Number(e.target.value) }))} placeholder="tgl" className="w-full border border-border rounded-lg px-2 py-1.5 text-sm bg-background text-foreground" />
                                    </div>
                                    <div className="col-span-2 sm:col-span-3 lg:col-span-6 flex items-end gap-2">
                                        <div className="flex-1">
                                            <label className="text-[11px] text-muted-foreground block mb-0.5">Catatan (opsional)</label>
                                            <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="keterangan" className="w-full border border-border rounded-lg px-2 py-1.5 text-sm bg-background text-foreground" />
                                        </div>
                                        <button type="submit" disabled={createMut.isPending || updateMut.isPending} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
                                            {(createMut.isPending || updateMut.isPending) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {editId ? "Simpan" : "Tambah"}
                                        </button>
                                        <button type="button" onClick={resetForm} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-muted text-muted-foreground rounded-lg text-sm hover:bg-accent"><X className="h-4 w-4" /></button>
                                    </div>
                                </form>
                            )}

                            {(fixedQ.data || []).length === 0 ? (
                                <Empty />
                            ) : (
                                <div className="space-y-1.5">
                                    {(fixedQ.data || []).map(e => (
                                        <div key={e.id} className={`flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 ${e.isActive ? "bg-background/50" : "bg-muted/40 opacity-60"}`}>
                                            <div className="min-w-0 flex items-center gap-2 flex-wrap">
                                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${CAT_CLS[e.category]}`}>{CAT_LABEL[e.category]}</span>
                                                <span className="text-sm font-medium text-foreground truncate">{e.name}</span>
                                                <span className="text-[11px] text-muted-foreground">· {branchName(e.branchId)}</span>
                                                {e.dueDay && <span className="text-[11px] text-muted-foreground">· tiap tgl {e.dueDay}</span>}
                                                {e.note && <span className="text-[11px] text-muted-foreground truncate">· {e.note}</span>}
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <span className="text-sm font-mono font-semibold text-foreground">{fmtRp(e.amount)}</span>
                                                <button onClick={() => toggleMut.mutate({ id: e.id, isActive: !e.isActive })} title={e.isActive ? "Nonaktifkan" : "Aktifkan"} className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${e.isActive ? badgeToneClass.success : "bg-muted text-muted-foreground"}`}>{e.isActive ? "Aktif" : "Off"}</button>
                                                <button onClick={() => startEdit(e)} className="text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                                                <button onClick={() => { if (confirm(`Hapus beban "${e.name}"?`)) deleteMut.mutate(e.id); }} className="text-red-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Section>

                        {/* Tren arus kas */}
                        <Section icon={<BarChart3 className="h-5 w-5" />} title="Tren Arus Kas (6 Bulan)" subtitle="Pemasukan vs pengeluaran tiap bulan.">
                            {trendData.length === 0 ? <Empty /> : (
                                <ResponsiveContainer width="100%" height={260}>
                                    <BarChart data={trendData} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                        <XAxis dataKey="month" tick={AXIS_TICK} axisLine={{ stroke: "var(--border)" }} tickLine={{ stroke: "var(--border)" }} />
                                        <YAxis tick={AXIS_TICK} axisLine={{ stroke: "var(--border)" }} tickLine={{ stroke: "var(--border)" }} tickFormatter={(v: any) => fmtRpShort(v)} />
                                        <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: any, n: any) => [fmtRp(v), n]} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
                                        <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                                        <Bar dataKey="Pemasukan" fill="#10b981" radius={[6, 6, 0, 0]} />
                                        <Bar dataKey="Pengeluaran" fill="#ef4444" radius={[6, 6, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </Section>

                        {/* Kapan order ramai / sepi — distribusi per jam mulai */}
                        <Section
                            icon={<Clock className="h-5 w-5" />}
                            title="Kapan Order Ramai / Sepi"
                            subtitle="Jumlah order lunas berdasarkan jam pembuatan (jam mulai)."
                        >
                            {ordersHourQ.isLoading ? (
                                <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                            ) : ordersTotal === 0 ? (
                                <Empty />
                            ) : (
                                <>
                                    {/* Ringkasan total: jumlah order + nominal seluruh omzet pada periode ini */}
                                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mb-3 text-sm">
                                        <span className="text-muted-foreground">Total order: <b className="text-foreground font-mono">{ordersTotal}</b></span>
                                        <span className="text-muted-foreground">Total omzet: <b className="text-foreground font-mono">{fmtRp(ordersRevenue)}</b></span>
                                    </div>
                                    {/* Panel insight ringkas */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                                        <InsightCell tone="ramai" label="Jam Puncak" value={hhmm(ordersHour?.peakHour)} />
                                        <InsightCell tone="ramai" label="Rentang Ramai" value={rangeLabel(ordersHour?.busyRange)} />
                                        <InsightCell tone="sepi" label="Rentang Sepi" value={rangeLabel(ordersHour?.quietRange)} />
                                        <InsightCell tone="normal" label="Rata-rata/jam" value={`${ordersHour?.avgPerHour ?? 0} order`} />
                                    </div>
                                    <ResponsiveContainer width="100%" height={260}>
                                        <BarChart data={ordersHourData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                            <XAxis dataKey="jam" tick={AXIS_TICK} axisLine={{ stroke: "var(--border)" }} tickLine={{ stroke: "var(--border)" }} interval={1} />
                                            <YAxis tick={AXIS_TICK} axisLine={{ stroke: "var(--border)" }} tickLine={{ stroke: "var(--border)" }} allowDecimals={false} />
                                            <Tooltip
                                                contentStyle={CHART_TOOLTIP_STYLE}
                                                cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                                                formatter={(v: any, _n: any, item: any) => {
                                                    const rev = Number(item?.payload?.revenue ?? 0);
                                                    const pct = ordersTotal ? (Number(v) / ordersTotal) * 100 : 0;
                                                    return [`${v} order · ${pct.toFixed(1)}% dari total · ${fmtRp(rev)}`, "Jumlah"];
                                                }}
                                                labelFormatter={(l: any) => `Pukul ${l}:00`}
                                            />
                                            <Bar dataKey="Order" radius={[6, 6, 0, 0]}>
                                                {ordersHourData.map((d, i) => <Cell key={i} fill={HOUR_LEVEL_COLOR[d.level] || "#6366f1"} />)}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                    {/* Legend level */}
                                    <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
                                        <LegendDot color="#10b981" label="Ramai" />
                                        <LegendDot color="#6366f1" label="Normal" />
                                        <LegendDot color="#f59e0b" label="Sepi" />
                                    </div>
                                </>
                            )}
                        </Section>

                        {/* Laba per kategori + Pengeluaran per kategori */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <Section icon={<TrendingUp className="h-5 w-5" />} title="Laba per Kategori / Mesin" subtitle="Kontribusi tiap kategori produk.">
                                {categories.length === 0 ? <Empty /> : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm min-w-[440px]">
                                            <thead><tr className="text-xs text-muted-foreground border-b border-border">
                                                <th className="text-left py-2 px-2">Kategori</th>
                                                <th className="text-right py-2 px-2">Omzet</th>
                                                <th className="text-right py-2 px-2">HPP</th>
                                                <th className="text-right py-2 px-2">Laba</th>
                                                <th className="text-right py-2 px-2">Margin</th>
                                            </tr></thead>
                                            <tbody>
                                                {categories.map((c, i) => (
                                                    <tr key={c.categoryId ?? `x${i}`} className="border-b border-border/60 last:border-0">
                                                        <td className="py-2 px-2 font-medium text-foreground truncate max-w-[140px]">{c.categoryName || "Tanpa kategori"}</td>
                                                        <td className="py-2 px-2 text-right font-mono">{fmtRp(c.revenue)}</td>
                                                        <td className="py-2 px-2 text-right font-mono text-muted-foreground">{fmtRp(c.totalHpp)}</td>
                                                        <td className="py-2 px-2 text-right font-mono text-emerald-600 dark:text-emerald-300">{fmtRp(c.grossProfit)}</td>
                                                        <td className="py-2 px-2 text-right font-mono font-semibold">{Number(c.profitMargin || 0).toFixed(0)}%</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </Section>

                            <Section icon={<Receipt className="h-5 w-5" />} title="Pengeluaran Kas per Kategori" subtitle="Ke mana uang keluar pada periode ini.">
                                {expenseChart.length === 0 ? <Empty /> : (
                                    <div className="space-y-2">
                                        {(() => {
                                            const max = Math.max(1, ...expenseChart.map(e => e.value));
                                            return expenseChart.map(e => (
                                                <div key={e.name}>
                                                    <div className="flex items-center justify-between gap-2 text-xs mb-0.5">
                                                        <span className="text-foreground truncate">{e.name}</span>
                                                        <span className="font-mono text-muted-foreground shrink-0">{fmtRp(e.value)}</span>
                                                    </div>
                                                    <div className="bg-muted rounded-full h-2 overflow-hidden">
                                                        <div className="h-full bg-red-400 rounded-full" style={{ width: `${(e.value / max) * 100}%` }} />
                                                    </div>
                                                </div>
                                            ));
                                        })()}
                                    </div>
                                )}
                            </Section>
                        </div>

                        {/* Saldo bank + Top produk */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <Section icon={<Landmark className="h-5 w-5" />} title="Saldo Kas & Bank" subtitle="Saldo tercatat + arus kas periode.">
                                {banks.length === 0 ? <Empty /> : (
                                    <div className="space-y-2">
                                        {banks.map(b => (
                                            <div key={b.key} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background/50 px-3 py-2">
                                                <div className="min-w-0">
                                                    <div className="text-sm font-medium text-foreground truncate">{b.bankName}</div>
                                                    <div className="text-[11px] text-muted-foreground">masuk {fmtRpShort(b.periodIn)} · keluar {fmtRpShort(b.periodOut)}</div>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <div className="text-sm font-mono font-semibold text-foreground">{b.currentBalance != null ? fmtRp(b.currentBalance) : "—"}</div>
                                                    <div className={`text-[11px] font-mono ${b.periodNet >= 0 ? "text-emerald-600 dark:text-emerald-300" : "text-red-600 dark:text-red-300"}`}>{b.periodNet >= 0 ? "+" : ""}{fmtRpShort(b.periodNet)}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </Section>

                            <Section icon={<Package className="h-5 w-5" />} title="Top Produk Penyumbang Laba" subtitle="8 produk dengan laba kotor tertinggi.">
                                {topProducts.length === 0 ? <Empty /> : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm min-w-[380px]">
                                            <thead><tr className="text-xs text-muted-foreground border-b border-border">
                                                <th className="text-left py-2 px-2">Produk</th>
                                                <th className="text-right py-2 px-2">Qty</th>
                                                <th className="text-right py-2 px-2">Omzet</th>
                                                <th className="text-right py-2 px-2">Laba</th>
                                            </tr></thead>
                                            <tbody>
                                                {topProducts.map((p, i) => (
                                                    <tr key={p.productVariantId ?? `p${i}`} className="border-b border-border/60 last:border-0">
                                                        <td className="py-2 px-2 font-medium text-foreground truncate max-w-[160px]">{p.name}</td>
                                                        <td className="py-2 px-2 text-right font-mono text-muted-foreground">{Number(p.qty || 0)}</td>
                                                        <td className="py-2 px-2 text-right font-mono">{fmtRp(p.revenue)}</td>
                                                        <td className="py-2 px-2 text-right font-mono text-emerald-600 dark:text-emerald-300">{fmtRp(p.grossProfit)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </Section>
                        </div>

                        {/* Leads */}
                        <Section icon={<Sparkles className="h-5 w-5" />} title="Leads (CRM)" subtitle="Ringkasan lead masuk & closing pada periode ini.">
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                                <MiniStat label="Total Leads" value={String(kpiTotals?.totalLeads ?? 0)} />
                                <MiniStat label="Closing" value={String(kpiTotals?.closedWon ?? 0)} cls="text-emerald-600 dark:text-emerald-300" />
                                <MiniStat label="Lost" value={String(kpiTotals?.closedLost ?? 0)} cls="text-red-600 dark:text-red-300" />
                                <MiniStat label="Closing Rate" value={`${Math.round((kpiMetrics?.closingRate ?? 0) * 100)}%`} />
                            </div>
                            {leadsBySource.length === 0 ? <Empty /> : (
                                <div className="space-y-2">
                                    <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Leads per Sumber</div>
                                    {(() => {
                                        const max = Math.max(1, ...leadsBySource.map(s => s.count));
                                        return leadsBySource.slice(0, 8).map(s => (
                                            <div key={s.source}>
                                                <div className="flex items-center justify-between gap-2 text-xs mb-0.5">
                                                    <span className="text-foreground truncate">{s.source}</span>
                                                    <span className="font-mono text-muted-foreground shrink-0">{s.count}</span>
                                                </div>
                                                <div className="bg-muted rounded-full h-2 overflow-hidden">
                                                    <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${(s.count / max) * 100}%` }} />
                                                </div>
                                            </div>
                                        ));
                                    })()}
                                </div>
                            )}
                        </Section>

                        {/* Leaderboard Karyawan */}
                        <Section icon={<Users className="h-5 w-5" />} title="Leaderboard Karyawan" subtitle="Kinerja CS, Designer & Operator pada periode/cabang ini.">
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                {/* CS */}
                                <div>
                                    <div className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-2"><Users className="h-3.5 w-3.5 text-indigo-500" /> Customer Service</div>
                                    <LbTable rows={csRows} empty="Belum ada data CS."
                                        cols={["Nama", "Lead", "Closing", "Cuan"]}
                                        render={(r: any) => [r.name, r.leadsHandled, r.dealsClosed, fmtRp((r.wonValue || 0) + (r.walkinValue || 0))]} />
                                </div>
                                {/* Designer */}
                                <div>
                                    <div className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-2"><Palette className="h-3.5 w-3.5 text-fuchsia-500" /> Designer</div>
                                    <LbTable rows={designerRows} empty="Belum ada data Designer."
                                        cols={["Nama", "ACC", "SO", "Omzet"]}
                                        render={(r: any) => [r.name, r.acc || 0, r.soCreated || 0, fmtRp(r.omzet || 0)]} />
                                </div>
                                {/* Operator */}
                                <div>
                                    <div className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-2"><Factory className="h-3.5 w-3.5 text-sky-500" /> Operator</div>
                                    <LbTable rows={operatorRows} empty="Belum ada data Operator."
                                        cols={["Nama", "Cetak", "Produksi", "Omzet"]}
                                        render={(r: any) => [r.name, r.printJobs || 0, r.prodJobs || 0, fmtRp(r.omzet || 0)]} />
                                </div>
                            </div>
                        </Section>

                        {/* Penilaian CS — poling pelayanan dari pelanggan */}
                        <CsRatingSection branchId={activeBranchId} from={start} to={end} branches={branches || []} />

                        {/* Bonus Karyawan (target, pencapaian, toggle manual) */}
                        <BonusPanel branches={branches || []} activeBranchId={activeBranchId} />

                        {/* Metrik Produk Custom (kolom produk khusus di leaderboard) */}
                        <CustomMetricPanel />

                        {/* Beban tugas karyawan — deteksi idle & tugas terlambat */}
                        <TaskLoadPanel enabled={isOwner} />

                        {/* AI Studio Desain — kelola token 9router & toggle asisten AI */}
                        <StudioAiSettings />

                        <CaraHitung>
                            <p><b>Omzet</b> = penjualan netto transaksi <b>lunas</b> (total − diskon). <b>HPP</b> = modal barang terjual. <b>Laba Kotor</b> = Omzet − HPP.</p>
                            <p><b>Estimasi Laba Bersih</b> = Laba Kotor − <b>beban tetap</b> (prorata: beban bulanan × hari periode ÷ 30). Biaya operasional kas ditampilkan terpisah sebagai info (tidak dikurangi, agar tidak dobel dengan beban tetap & HPP).</p>
                            <p><b>Beban Tetap</b> kamu input sendiri (gaji, sewa, angsuran, supplier). <b>Pusat/Semua</b> ikut dihitung di semua cabang; beban cabang tertentu hanya saat cabang itu dipilih.</p>
                            <p><b>Piutang</b> = sisa tagihan belum lunas. Semua angka ikut <b>periode</b> & <b>cabang</b> di atas (kecuali Tren Arus Kas: 6 bulan terakhir).</p>
                        </CaraHitung>
                    </>
                )}
            </div>
        </div>
    );
}

function StatCard({ icon, label, value, sub, valueClass }: { icon: React.ReactNode; label: string; value: string; sub?: string; valueClass?: string }) {
    return (
        <div className="rounded-xl glass-card p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-1.5">{icon}<span className="text-xs text-muted-foreground">{label}</span></div>
            <div className={`text-lg sm:text-xl font-bold leading-tight ${valueClass || "text-foreground"}`}>{value}</div>
            {sub && <div className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
        </div>
    );
}

function MiniStat({ label, value, cls }: { label: string; value: string; cls?: string }) {
    return (
        <div className="rounded-lg bg-muted/50 p-2.5 text-center">
            <div className={`text-lg font-bold leading-none ${cls || "text-foreground"}`}>{value}</div>
            <div className="text-[10px] text-muted-foreground mt-1">{label}</div>
        </div>
    );
}

function LbTable({ rows, cols, render, empty }: { rows: any[]; cols: string[]; render: (r: any) => (string | number)[]; empty: string }) {
    if (!rows || rows.length === 0) return <div className="text-xs text-muted-foreground py-4 text-center">{empty}</div>;
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-xs">
                <thead><tr className="text-[10px] text-muted-foreground border-b border-border">
                    {cols.map((c, i) => <th key={c} className={`py-1.5 px-1.5 ${i === 0 ? "text-left" : "text-right"}`}>{c}</th>)}
                </tr></thead>
                <tbody>
                    {rows.slice(0, 8).map((r, ri) => {
                        const cells = render(r);
                        return (
                            <tr key={ri} className="border-b border-border/60 last:border-0">
                                {cells.map((cell, ci) => (
                                    <td key={ci} className={`py-1.5 px-1.5 ${ci === 0 ? "text-left font-medium text-foreground truncate max-w-[110px]" : "text-right font-mono text-muted-foreground"}`}>
                                        {ci === 0 && <span className="text-muted-foreground mr-1">{ri + 1}.</span>}{cell}
                                    </td>
                                ))}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

function Section({ title, subtitle, icon, children }: { title: string; subtitle?: string; icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="rounded-2xl glass p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-3">
                <span className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">{icon}</span>
                <div>
                    <h2 className="font-bold text-base leading-tight text-foreground">{title}</h2>
                    {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
                </div>
            </div>
            {children}
        </div>
    );
}

function Empty() {
    return <div className="text-center py-8 text-sm text-muted-foreground">Belum ada data di periode/cabang ini.</div>;
}

function InsightCell({ tone, label, value }: { tone: "ramai" | "sepi" | "normal"; label: string; value: string }) {
    const cls = tone === "ramai" ? "text-emerald-600 dark:text-emerald-300"
        : tone === "sepi" ? "text-amber-600 dark:text-amber-300"
        : "text-foreground";
    return (
        <div className="rounded-xl bg-muted/50 px-3 py-2">
            <p className="text-[11px] text-muted-foreground">{label}</p>
            <p className={`font-bold text-sm ${cls}`}>{value}</p>
        </div>
    );
}
function LegendDot({ color, label }: { color: string; label: string }) {
    return <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />{label}</span>;
}

function CaraHitung({ children }: { children: React.ReactNode }) {
    const [open, setOpen] = useState(false);
    return (
        <div className="rounded-xl border border-border/60 bg-muted/40 overflow-hidden">
            <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent/50 transition-colors">
                <Info className="h-3.5 w-3.5" /> Cara Hitung & Sumber Angka
                <ChevronDown className={`h-3.5 w-3.5 ml-auto transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
            {open && <div className="px-3 pb-3 pt-1 text-xs text-muted-foreground space-y-1 leading-relaxed">{children}</div>}
        </div>
    );
}
