"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { verifyMarketingPin, getPublicMarketingDashboard, addMarketingSpend, deleteMarketingSpend, type PublicLead, type AdSpend } from "@/lib/api/marketing";
import { TrendingUp, Users, Wallet, Clock, Loader2, Lock, RefreshCw, ChevronDown, Megaphone, Package, Filter, Target, Plus, Trash2, Receipt } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import dayjs from "dayjs";
import "dayjs/locale/id";
dayjs.locale("id");

const PIN_KEY = "marketing_pin_session";
const PIN_TTL = 24 * 60 * 60 * 1000;

const STATUS_LABEL: Record<string, string> = {
    NEW: "Baru", FOLLOW_UP: "Follow-up", NEGOTIATION: "Negosiasi",
    CLOSED_WON: "Closing", CLOSED_LOST: "Lost", INVALID: "Tidak valid",
};
const STATUS_CLS: Record<string, string> = {
    NEW: "bg-blue-100 text-blue-700",
    FOLLOW_UP: "bg-amber-100 text-amber-700",
    NEGOTIATION: "bg-violet-100 text-violet-700",
    CLOSED_WON: "bg-emerald-100 text-emerald-700",
    CLOSED_LOST: "bg-red-100 text-red-700",
    INVALID: "bg-muted text-muted-foreground",
};
const SOURCE_LABEL: Record<string, string> = {
    WHATSAPP: "WhatsApp", INSTAGRAM: "Instagram", FACEBOOK: "Facebook", TIKTOK: "TikTok",
    MARKETPLACE: "Marketplace", REFERRAL: "Referral", WEBSITE: "Website", WALK_IN: "Walk-in",
    REPEAT_ORDER: "Repeat Order", OTHER: "Lainnya", CUSTOM: "Custom",
};
const PERIODS = [
    { key: "today", label: "Hari ini" },
    { key: "week", label: "Minggu ini" },
    { key: "month", label: "Bulan ini" },
];

const COLORS = ["#6366f1", "#ec4899", "#10b981", "#f59e0b", "#3b82f6", "#8b5cf6", "#ef4444", "#14b8a6", "#f97316", "#64748b"];
const STATUS_COLOR: Record<string, string> = {
    NEW: "#3b82f6", FOLLOW_UP: "#f59e0b", NEGOTIATION: "#8b5cf6",
    CLOSED_WON: "#10b981", CLOSED_LOST: "#ef4444", INVALID: "#94a3b8",
};
const rupiah = (n: number) => "Rp" + Math.round(n || 0).toLocaleString("id-ID");
const srcLabel = (s: string, detail?: string | null) => (s === "CUSTOM" && detail) ? detail : (SOURCE_LABEL[s] || detail || s);

function readSession(): string | null {
    try {
        const raw = localStorage.getItem(PIN_KEY);
        if (!raw) return null;
        const s = JSON.parse(raw);
        if (Date.now() >= s.expires) return null;
        return s.pin;
    } catch { return null; }
}

export default function MarketingDashboardPage() {
    const [pin, setPin] = useState<string | null>(null);
    const [pinInput, setPinInput] = useState("");
    const [pinError, setPinError] = useState("");
    const [pinLoading, setPinLoading] = useState(false);

    const [period, setPeriod] = useState("month");
    const [data, setData] = useState<any>(null);
    const [leads, setLeads] = useState<PublicLead[]>([]);
    const [adSpend, setAdSpend] = useState<AdSpend | null>(null);
    const [spendOpen, setSpendOpen] = useState(false);
    const [savingSpend, setSavingSpend] = useState(false);
    const [spendForm, setSpendForm] = useState({ date: dayjs().format("YYYY-MM-DD"), source: "WHATSAPP", amount: "", note: "" });
    const [loading, setLoading] = useState(false);
    const [expanded, setExpanded] = useState<number | null>(null);
    const [statusFilter, setStatusFilter] = useState<string>("ALL");
    const [sourceSel, setSourceSel] = useState<string[]>([]); // [] = semua sumber (multi-select)
    const [expandedProduct, setExpandedProduct] = useState<string | null>(null);

    const toggleSource = (s: string) =>
        setSourceSel(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
    const matchSrc = (src: string) => sourceSel.length === 0 || sourceSel.includes(src);

    useEffect(() => { setPin(readSession()); }, []);

    const load = useCallback(async (p: string) => {
        if (!pin) return;
        setLoading(true);
        try {
            const res = await getPublicMarketingDashboard(pin, { period: p });
            setData(res.report);
            setLeads(res.leads);
            setAdSpend(res.adSpend);
        } catch (e: any) {
            if (e?.response?.status === 400) { localStorage.removeItem(PIN_KEY); setPin(null); }
        } finally { setLoading(false); }
    }, [pin]);

    useEffect(() => { if (pin) load(period); }, [pin, period, load]);

    const submitSpend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!pin) return;
        const amount = Number(spendForm.amount);
        if (!Number.isFinite(amount) || amount <= 0) return;
        setSavingSpend(true);
        try {
            await addMarketingSpend(pin, { date: spendForm.date, source: spendForm.source, amount, note: spendForm.note.trim() || undefined });
            setSpendForm(f => ({ ...f, amount: "", note: "" }));
            await load(period);
        } catch { /* noop */ } finally { setSavingSpend(false); }
    };
    const removeSpend = async (id: number) => {
        if (!pin || !confirm("Hapus catatan biaya iklan ini?")) return;
        try { await deleteMarketingSpend(pin, id); await load(period); } catch { /* noop */ }
    };

    const handlePin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!pinInput.trim()) return;
        setPinLoading(true); setPinError("");
        try {
            const res = await verifyMarketingPin(pinInput.trim());
            if (res.valid) {
                localStorage.setItem(PIN_KEY, JSON.stringify({ pin: pinInput.trim(), expires: Date.now() + PIN_TTL }));
                setPin(pinInput.trim());
            } else { setPinError("PIN salah."); setPinInput(""); }
        } catch { setPinError("Tidak bisa menghubungi server."); }
        finally { setPinLoading(false); }
    };

    const logout = () => { localStorage.removeItem(PIN_KEY); setPin(null); setPinInput(""); setData(null); };

    // ── PIN gate ──────────────────────────────────────────────────────────────
    if (!pin) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-indigo-50 to-fuchsia-50 p-4">
                <form onSubmit={handlePin} className="bg-card p-8 rounded-2xl shadow-lg w-full max-w-sm">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="rounded-lg bg-indigo-600 p-2"><Megaphone className="h-5 w-5 text-white" /></div>
                        <h1 className="text-xl font-bold">Dashboard Marketing</h1>
                    </div>
                    <p className="text-sm text-muted-foreground mb-5">Masukkan PIN untuk memantau leads, sumber, status & pendapatan.</p>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">PIN</label>
                    <input
                        type="password" inputMode="numeric" value={pinInput} autoFocus
                        onChange={e => setPinInput(e.target.value)}
                        className="w-full border rounded-lg px-4 py-3 text-lg tracking-widest text-center bg-background text-foreground focus:ring-2 focus:ring-indigo-400 outline-none"
                        placeholder="••••"
                    />
                    {pinError && <p className="text-red-600 text-sm mt-2">{pinError}</p>}
                    <button type="submit" disabled={pinLoading}
                        className="w-full mt-4 bg-indigo-600 text-white font-semibold py-3 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                        {pinLoading ? "Memeriksa..." : "Masuk"}
                    </button>
                </form>
                <p className="text-xs text-muted-foreground mt-6">© 2026 — Dashboard pemantauan leads (read-only)</p>
            </div>
        );
    }

    const t = data?.totals;
    const m = data?.metrics;

    // Subset per kombinasi filter
    const leadsByStatus = statusFilter === "ALL" ? leads : leads.filter(l => l.status === statusFilter); // utk chart sumber
    const leadsBySrc = sourceSel.length === 0 ? leads : leads.filter(l => matchSrc(l.source));    // utk chart status
    const filtered = leads.filter(l =>
        (statusFilter === "ALL" || l.status === statusFilter) && matchSrc(l.source));

    // Donut sumber (semua sumber dalam status terpilih)
    const sourceChart = (() => {
        const map = new Map<string, number>();
        for (const l of leadsByStatus) map.set(l.source, (map.get(l.source) || 0) + 1);
        return Array.from(map, ([source, value]) => ({ source, name: srcLabel(source), value })).sort((a, b) => b.value - a.value);
    })();
    // Donut status (semua status dalam sumber terpilih)
    const statusChart = Object.keys(STATUS_LABEL)
        .map(s => ({ status: s, name: STATUS_LABEL[s], value: leadsBySrc.filter(l => l.status === s).length }))
        .filter(x => x.value > 0);
    // Opsi chip filter sumber (semua sumber di data)
    const sourceOptions = (() => {
        const map = new Map<string, number>();
        for (const l of leads) map.set(l.source, (map.get(l.source) || 0) + 1);
        return Array.from(map, ([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count);
    })();
    const statusCounts: Record<string, number> = {};
    for (const l of leadsBySrc) statusCounts[l.status] = (statusCounts[l.status] || 0) + 1;

    // Agregasi produk (kedua filter) + dari lead/sumber mana
    const products = (() => {
        const map = new Map<string, { name: string; qty: number; value: number; orders: { name: string; source: string; status: string; qty: number }[] }>();
        for (const l of filtered) {
            for (const it of l.items) {
                const key = (it.description || "").trim().toLowerCase();
                if (!key) continue;
                if (!map.has(key)) map.set(key, { name: (it.description || "").trim(), qty: 0, value: 0, orders: [] });
                const e = map.get(key)!;
                e.qty += it.quantity;
                e.value += (it.unitPrice || 0) * it.quantity;
                e.orders.push({ name: l.name, source: l.source, status: l.status, qty: it.quantity });
            }
        }
        return Array.from(map.values()).sort((a, b) => b.qty - a.qty);
    })();
    const maxProductQty = Math.max(1, ...products.map(p => p.qty));
    const shownLeads = filtered;

    // Benchmark iklan per sumber (seluruh leads periode + biaya iklan)
    const benchmark = (() => {
        const map = new Map<string, { source: string; leads: number; closing: number; revenue: number; spend: number }>();
        const ensure = (s: string) => { if (!map.has(s)) map.set(s, { source: s, leads: 0, closing: 0, revenue: 0, spend: 0 }); return map.get(s)!; };
        for (const l of leads) {
            const e = ensure(l.source);
            e.leads++;
            if (l.status === "CLOSED_WON") { e.closing++; e.revenue += l.value; }
        }
        for (const s of (adSpend?.bySource || [])) ensure(s.source).spend += s.amount;
        return Array.from(map.values()).map(e => ({
            ...e,
            roas: e.spend > 0 ? e.revenue / e.spend : null,
            cpl: e.spend > 0 && e.leads > 0 ? e.spend / e.leads : null,
            cac: e.spend > 0 && e.closing > 0 ? e.spend / e.closing : null,
            profit: e.revenue - e.spend,
        })).sort((a, b) => (b.spend - a.spend) || (b.revenue - a.revenue));
    })();
    const totalSpend = adSpend?.total || 0;
    const benchRevenue = benchmark.reduce((s, b) => s + b.revenue, 0);
    const overallRoas = totalSpend > 0 ? benchRevenue / totalSpend : null;

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-fuchsia-600 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-10 shadow">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="rounded-lg bg-white/15 p-2"><Megaphone className="h-4 w-4" /></div>
                    <div className="min-w-0">
                        <div className="font-semibold leading-tight">Dashboard Marketing</div>
                        <div className="text-xs text-indigo-100">Pemantauan leads — semua cabang</div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => load(period)} disabled={loading} className="p-2 hover:bg-white/15 rounded-lg" title="Muat ulang">
                        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                    </button>
                    <button onClick={logout} className="p-2 hover:bg-white/15 rounded-lg" title="Keluar"><Lock className="h-4 w-4" /></button>
                </div>
            </div>

            <div className="max-w-5xl mx-auto p-4 space-y-4">
                {/* Period */}
                <div className="flex gap-1.5">
                    {PERIODS.map(p => (
                        <button key={p.key} onClick={() => setPeriod(p.key)}
                            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${period === p.key ? "bg-indigo-600 text-white" : "bg-card border border-border text-muted-foreground hover:bg-muted"}`}>
                            {p.label}
                        </button>
                    ))}
                </div>

                {!data ? (
                    <div className="flex justify-center py-16 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>
                ) : (
                    <>
                        {/* Summary cards */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            <Card icon={<Users className="h-5 w-5 text-indigo-600" />} label="Total Leads" value={String(t.totalLeads)} sub={`${t.closedWon} closing · ${t.closedLost} lost`} />
                            <Card icon={<TrendingUp className="h-5 w-5 text-emerald-600" />} label="Closing Rate" value={`${Math.round((m.closingRate || 0) * 100)}%`} sub={`${t.closedWon} dari ${t.totalLeads}`} />
                            <Card icon={<Wallet className="h-5 w-5 text-amber-600" />} label="Pendapatan (WON)" value={rupiah(Number(t.wonValue))} sub="dari leads closing" />
                            <Card icon={<Clock className="h-5 w-5 text-sky-600" />} label="Akan Datang" value={rupiah(Number(t.pendingValue))} sub="piutang belum lunas" />
                        </div>

                        {/* Benchmark Iklan per sumber */}
                        <div className="bg-card rounded-xl border border-border p-4">
                            <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                                <h2 className="font-semibold text-foreground flex items-center gap-2"><Target className="h-4 w-4 text-indigo-600" /> Benchmark Iklan per Sumber</h2>
                                <div className="flex items-center gap-3 text-xs">
                                    <span className="text-muted-foreground">Total biaya: <strong className="text-foreground">{rupiah(totalSpend)}</strong></span>
                                    <span className="text-muted-foreground">ROAS total: <strong className={overallRoas == null ? "text-muted-foreground" : overallRoas >= 1 ? "text-emerald-600" : "text-red-600"}>{overallRoas == null ? "—" : `${overallRoas.toFixed(2)}×`}</strong></span>
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm min-w-[660px]">
                                    <thead><tr className="text-xs text-muted-foreground border-b border-border">
                                        <th className="text-left py-2 px-2">Sumber</th>
                                        <th className="text-right py-2 px-2">Biaya Iklan</th>
                                        <th className="text-right py-2 px-2">Leads</th>
                                        <th className="text-right py-2 px-2">Closing</th>
                                        <th className="text-right py-2 px-2">Pendapatan</th>
                                        <th className="text-right py-2 px-2">ROAS</th>
                                        <th className="text-right py-2 px-2">CPL</th>
                                        <th className="text-right py-2 px-2">CAC</th>
                                        <th className="text-right py-2 px-2">Profit</th>
                                    </tr></thead>
                                    <tbody>
                                        {benchmark.map(b => (
                                            <tr key={b.source} className="border-b border-border last:border-0">
                                                <td className="py-2 px-2 font-medium text-foreground">{srcLabel(b.source)}</td>
                                                <td className="py-2 px-2 text-right text-foreground">{b.spend > 0 ? rupiah(b.spend) : "—"}</td>
                                                <td className="py-2 px-2 text-right font-mono">{b.leads}</td>
                                                <td className="py-2 px-2 text-right font-mono text-emerald-700">{b.closing}</td>
                                                <td className="py-2 px-2 text-right font-mono">{rupiah(b.revenue)}</td>
                                                <td className={`py-2 px-2 text-right font-mono font-semibold ${b.roas == null ? "text-muted-foreground/50" : b.roas >= 1 ? "text-emerald-600" : "text-red-600"}`}>{b.roas == null ? "—" : `${b.roas.toFixed(2)}×`}</td>
                                                <td className="py-2 px-2 text-right font-mono text-muted-foreground">{b.cpl == null ? "—" : rupiah(b.cpl)}</td>
                                                <td className="py-2 px-2 text-right font-mono text-muted-foreground">{b.cac == null ? "—" : rupiah(b.cac)}</td>
                                                <td className={`py-2 px-2 text-right font-mono font-semibold ${b.spend === 0 ? "text-muted-foreground/50" : b.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>{b.spend === 0 ? "—" : rupiah(b.profit)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-2">ROAS = pendapatan ÷ biaya · CPL = biaya ÷ leads · CAC = biaya ÷ closing · Profit = pendapatan − biaya. "—" = belum ada biaya iklan untuk sumber itu.</p>

                            <button onClick={() => setSpendOpen(o => !o)} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800">
                                <Receipt className="h-4 w-4" /> {spendOpen ? "Tutup" : "Catat / Kelola Biaya Iklan"}
                            </button>
                            {spendOpen && (
                                <div className="mt-3 border-t border-border pt-3">
                                    <form onSubmit={submitSpend} className="flex flex-wrap items-end gap-2 mb-3">
                                        <div><label className="text-[11px] text-muted-foreground block mb-0.5">Tanggal</label><input type="date" value={spendForm.date} onChange={e => setSpendForm(f => ({ ...f, date: e.target.value }))} className="border border-border rounded-lg px-2 py-1.5 text-sm bg-background text-foreground" /></div>
                                        <div><label className="text-[11px] text-muted-foreground block mb-0.5">Sumber</label>
                                            <select value={spendForm.source} onChange={e => setSpendForm(f => ({ ...f, source: e.target.value }))} className="border border-border rounded-lg px-2 py-1.5 text-sm bg-background text-foreground">
                                                {Object.keys(SOURCE_LABEL).map(s => <option key={s} value={s}>{SOURCE_LABEL[s]}</option>)}
                                            </select>
                                        </div>
                                        <div><label className="text-[11px] text-muted-foreground block mb-0.5">Nominal (Rp)</label><input type="number" min={0} value={spendForm.amount} onChange={e => setSpendForm(f => ({ ...f, amount: e.target.value }))} placeholder="500000" className="border border-border rounded-lg px-2 py-1.5 text-sm bg-background text-foreground w-32" /></div>
                                        <div className="flex-1 min-w-[120px]"><label className="text-[11px] text-muted-foreground block mb-0.5">Catatan (opsional)</label><input value={spendForm.note} onChange={e => setSpendForm(f => ({ ...f, note: e.target.value }))} placeholder="nama campaign" className="border border-border rounded-lg px-2 py-1.5 text-sm bg-background text-foreground w-full" /></div>
                                        <button type="submit" disabled={savingSpend} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                                            {savingSpend ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Tambah
                                        </button>
                                    </form>
                                    {adSpend && adSpend.entries.length > 0 ? (
                                        <div className="space-y-1 max-h-52 overflow-y-auto">
                                            {adSpend.entries.map(s => (
                                                <div key={s.id} className="flex items-center justify-between gap-2 text-xs bg-background rounded-lg px-2.5 py-1.5">
                                                    <span className="flex items-center gap-2 min-w-0"><span className="text-muted-foreground shrink-0">{dayjs(s.date).format("DD MMM")}</span><span className="font-medium text-foreground">{srcLabel(s.source)}</span>{s.note && <span className="text-muted-foreground truncate">· {s.note}</span>}</span>
                                                    <span className="flex items-center gap-2 shrink-0"><span className="font-mono text-foreground">{rupiah(s.amount)}</span><button onClick={() => removeSpend(s.id)} className="text-red-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button></span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : <p className="text-xs text-muted-foreground">Belum ada biaya iklan pada periode ini.</p>}
                                </div>
                            )}
                        </div>

                        {/* Diagram: donut sumber & status */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="bg-card rounded-xl border border-border p-4">
                                <h2 className="font-semibold text-foreground mb-1">Leads per Sumber</h2>
                                <ResponsiveContainer width="100%" height={210}>
                                    <PieChart>
                                        <Pie data={sourceChart} dataKey="value" nameKey="name" innerRadius={45} outerRadius={78} paddingAngle={2}>
                                            {sourceChart.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                        </Pie>
                                        <Tooltip formatter={(v: any, n: any) => [`${v} leads`, n]} />
                                        <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="bg-card rounded-xl border border-border p-4">
                                <h2 className="font-semibold text-foreground mb-1">Status Leads</h2>
                                <ResponsiveContainer width="100%" height={210}>
                                    <PieChart>
                                        <Pie data={statusChart} dataKey="value" nameKey="name" innerRadius={45} outerRadius={78} paddingAngle={2}>
                                            {statusChart.map((s, i) => <Cell key={i} fill={STATUS_COLOR[s.status] || COLORS[i % COLORS.length]} />)}
                                        </Pie>
                                        <Tooltip formatter={(v: any, n: any) => [`${v} leads`, n]} />
                                        <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Filter sumber & status */}
                        <div className="bg-card rounded-xl border border-border p-3 space-y-2">
                            <div className="flex items-start gap-2 flex-wrap">
                                <span className="text-xs font-semibold text-muted-foreground inline-flex items-center gap-1 pt-1"><Filter className="h-3 w-3" /> Sumber <span className="text-muted-foreground/50 font-normal">(bisa pilih banyak)</span></span>
                                <Chip active={sourceSel.length === 0} onClick={() => setSourceSel([])} label={`Semua (${leads.length})`} />
                                {sourceOptions.map(s => (
                                    <Chip key={s.source} active={sourceSel.includes(s.source)} onClick={() => toggleSource(s.source)} label={`${srcLabel(s.source)} (${s.count})`} />
                                ))}
                            </div>
                            <div className="flex items-start gap-2 flex-wrap">
                                <span className="text-xs font-semibold text-muted-foreground inline-flex items-center gap-1 pt-1"><Filter className="h-3 w-3" /> Status</span>
                                <Chip active={statusFilter === "ALL"} onClick={() => setStatusFilter("ALL")} label={`Semua (${leadsBySrc.length})`} />
                                {Object.keys(STATUS_LABEL).filter(s => statusCounts[s]).map(s => (
                                    <Chip key={s} active={statusFilter === s} onClick={() => setStatusFilter(s)} label={`${STATUS_LABEL[s]} (${statusCounts[s]})`} />
                                ))}
                            </div>
                        </div>

                        {/* Produk sering diorder + dari lead mana */}
                        <div className="bg-card rounded-xl border border-border p-4">
                            <div className="mb-3">
                                <h2 className="font-semibold text-foreground flex items-center gap-2 mb-2">
                                    <Package className="h-4 w-4 text-indigo-600" /> Produk Sering Diorder
                                    {statusFilter !== "ALL" && <span className="text-xs font-normal text-muted-foreground">· {STATUS_LABEL[statusFilter]}</span>}
                                </h2>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1"><Filter className="h-3 w-3" /> Sumber:</span>
                                    <Chip active={sourceSel.length === 0} onClick={() => setSourceSel([])} label="Semua" />
                                    {sourceOptions.map(s => (
                                        <Chip key={s.source} active={sourceSel.includes(s.source)} onClick={() => toggleSource(s.source)} label={`${srcLabel(s.source)} (${s.count})`} />
                                    ))}
                                </div>
                                {sourceSel.length > 1 && (
                                    <p className="text-[11px] text-indigo-600 mt-1.5">Membandingkan {sourceSel.length} sumber: <strong>{sourceSel.map(s => srcLabel(s)).join(", ")}</strong></p>
                                )}
                            </div>
                            {products.length === 0 ? (
                                <div className="text-sm text-muted-foreground py-4 text-center">Belum ada detail produk pada lead di filter ini.</div>
                            ) : (
                                <div className="space-y-2">
                                    {products.slice(0, 15).map(p => (
                                        <div key={p.name} className="rounded-lg border border-border">
                                            <button onClick={() => setExpandedProduct(expandedProduct === p.name ? null : p.name)}
                                                className="w-full p-2.5 text-left hover:bg-muted">
                                                <div className="flex items-center justify-between gap-2 mb-1">
                                                    <span className="text-sm font-medium text-foreground truncate">{p.name}</span>
                                                    <span className="text-[11px] text-muted-foreground shrink-0">{p.qty} pcs · {p.orders.length} order · {rupiah(p.value)}</span>
                                                </div>
                                                <div className="bg-muted rounded-full h-2 overflow-hidden">
                                                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(p.qty / maxProductQty) * 100}%` }} />
                                                </div>
                                            </button>
                                            {expandedProduct === p.name && (
                                                <div className="border-t border-border bg-muted/40 p-2.5 space-y-1">
                                                    <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Diorder dari lead:</div>
                                                    {p.orders.map((o, i) => (
                                                        <div key={i} className="flex items-center justify-between gap-2 text-xs bg-card rounded border border-border px-2 py-1">
                                                            <span className="truncate font-medium text-foreground">{o.name}</span>
                                                            <span className="flex items-center gap-1.5 shrink-0">
                                                                <span className="text-muted-foreground">{srcLabel(o.source)}</span>
                                                                <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${STATUS_CLS[o.status] || "bg-muted text-muted-foreground"}`}>{STATUS_LABEL[o.status] || o.status}</span>
                                                                <span className="font-mono text-muted-foreground">{o.qty}×</span>
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Leads list */}
                        <div className="space-y-2">
                            {shownLeads.map(l => (
                                <div key={l.id} className="bg-card rounded-xl border border-border overflow-hidden">
                                    <button onClick={() => setExpanded(expanded === l.id ? null : l.id)}
                                        className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-medium text-sm text-foreground truncate">{l.name}</span>
                                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${STATUS_CLS[l.status] || "bg-muted text-muted-foreground"}`}>{STATUS_LABEL[l.status] || l.status}</span>
                                            </div>
                                            <div className="text-[11px] text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2">
                                                {l.phone && <span>{l.phone}</span>}
                                                <span>· {srcLabel(l.source, l.sourceDetail)}</span>
                                                {l.csName && <span>· CS {l.csName}</span>}
                                                {l.branchName && <span>· {l.branchName}</span>}
                                                <span>· {dayjs(l.createdAt).format("DD MMM")}</span>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className="text-sm font-semibold text-emerald-700">{l.value > 0 ? rupiah(l.value) : "—"}</div>
                                            <div className="text-[10px] text-muted-foreground">{l.items.length} produk {l.hasNota ? "· nota" : ""}</div>
                                        </div>
                                        <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${expanded === l.id ? "rotate-180" : ""}`} />
                                    </button>
                                    {expanded === l.id && (
                                        <div className="border-t border-border bg-muted/40 p-3 text-xs space-y-2">
                                            {l.needs && <div className="text-muted-foreground"><span className="font-semibold">Kebutuhan:</span> {l.needs}</div>}
                                            {l.items.length === 0 ? (
                                                <div className="text-muted-foreground italic">Belum ada detail produk di lead ini.</div>
                                            ) : (
                                                <div className="space-y-1">
                                                    {l.items.map((it, i) => (
                                                        <div key={i} className="flex items-center justify-between gap-2 bg-card rounded-lg border border-border px-2.5 py-1.5">
                                                            <div className="min-w-0">
                                                                <div className="font-medium text-foreground truncate">{it.description}</div>
                                                                <div className="text-[10px] text-muted-foreground">
                                                                    {it.quantity}× {it.dimension ? `· ${it.dimension} ` : ""}{it.note ? `· ${it.note}` : ""}
                                                                </div>
                                                            </div>
                                                            <div className="text-foreground font-mono shrink-0">{rupiah(it.unitPrice * it.quantity)}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                            {shownLeads.length === 0 && <div className="text-center text-muted-foreground py-10 text-sm">Tidak ada lead pada filter ini.</div>}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

function Card({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
    return (
        <div className="bg-card rounded-xl border border-border p-3.5">
            <div className="flex items-center gap-2 mb-1.5">{icon}<span className="text-xs text-muted-foreground">{label}</span></div>
            <div className="text-lg font-bold text-foreground leading-tight">{value}</div>
            {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
        </div>
    );
}

function Chip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
    return (
        <button onClick={onClick}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${active ? "bg-gray-800 text-white" : "bg-card border border-border text-muted-foreground hover:bg-muted"}`}>
            {label}
        </button>
    );
}
