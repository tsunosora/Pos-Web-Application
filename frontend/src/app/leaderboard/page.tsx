"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
    getKpiReport, getDesignerLeaderboard, getDesignOutput, getOperatorLeaderboard,
    getTeamLeaderboard, getProductionCategories, type ProductionCategory,
    type KpiPeriod, type KpiLeaderboardEntry, type DesignCheckEntry,
    type DesignerLeaderboardEntry, type DesignOutputEntry, type OperatorLeaderboardEntry,
} from "@/lib/api";
import api from "@/lib/api/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
    Trophy, Crown, Target, Phone, Zap, Search, Palette, Factory, Award,
    Loader2, Info, ChevronDown, Users, Printer, Layers, Building2, Truck,
} from "lucide-react";
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

const PERIODS: { value: KpiPeriod; label: string }[] = [
    { value: "today", label: "Hari Ini" },
    { value: "week", label: "7 Hari" },
    { value: "month", label: "Bulan Ini" },
    { value: "custom", label: "Kustom" },
];

const CHART_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];
const TOOLTIP_STYLE = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--foreground)', boxShadow: '0 8px 24px -8px rgb(0 0 0 / 0.25)' } as const;
const AXIS_TICK = { fill: 'var(--muted-foreground)', fontSize: 12 } as const;

const fmtRp = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;
const fmtM2 = (v: number) => v > 0 ? `${(Math.round(v * 100) / 100).toLocaleString('id-ID')} m²` : '—';
const initials = (name?: string | null) => {
    const p = (name || '').trim().split(/\s+/);
    return ((p[0]?.[0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase() || '?';
};
const AVATAR = ['bg-indigo-500/15 text-indigo-600 dark:text-indigo-300', 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300', 'bg-amber-500/15 text-amber-600 dark:text-amber-300', 'bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-300', 'bg-blue-500/15 text-blue-600 dark:text-blue-300', 'bg-rose-500/15 text-rose-600 dark:text-rose-300'];
const MEDAL = ['🥇', '🥈', '🥉'];

// ── Kartu Juara (gelar) ───────────────────────────────────────────────────
function ChampionCard({ icon, title, name, value, accent }: { icon: React.ReactNode; title: string; name?: string; value: string; accent: string }) {
    return (
        <div className={`rounded-2xl border border-border bg-card p-3 shadow-sm flex items-center gap-3 ${name ? '' : 'opacity-60'}`}>
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${accent}`}>{icon}</div>
            <div className="min-w-0">
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{title}</div>
                <div className="font-bold text-foreground truncate">{name || '—'}</div>
                <div className="text-xs text-muted-foreground">{name ? value : 'Belum ada'}</div>
            </div>
        </div>
    );
}

// ── Panel "Cara Hitung" (collapsible) ─────────────────────────────────────
function CaraHitung({ children }: { children: React.ReactNode }) {
    const [open, setOpen] = useState(false);
    return (
        <div className="mt-3 rounded-xl border border-border/60 bg-muted/40 overflow-hidden">
            <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent/50 transition-colors">
                <Info className="h-3.5 w-3.5" /> Cara Hitung & Sumber Angka
                <ChevronDown className={`h-3.5 w-3.5 ml-auto transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && <div className="px-3 pb-3 pt-1 text-xs text-muted-foreground space-y-1 leading-relaxed">{children}</div>}
        </div>
    );
}

function topByOf<T>(rows: T[], val: (r: T) => number): { row: T; v: number } | null {
    if (!rows.length) return null;
    let best = rows[0], bv = val(rows[0]);
    for (const r of rows) { const v = val(r); if (v > bv) { best = r; bv = v; } }
    return bv > 0 ? { row: best, v: bv } : null;
}

function SectionCard({ title, subtitle, icon, children }: { title: string; subtitle?: string; icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="bg-card rounded-2xl border border-border shadow-sm p-4 sm:p-5 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex items-center gap-2 mb-3">
                <span className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">{icon}</span>
                <div>
                    <h2 className="font-bold text-base leading-tight">{title}</h2>
                    {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
                </div>
            </div>
            {children}
        </div>
    );
}

const Th = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
    <th className={`py-2 px-2 ${right ? 'text-right' : 'text-left'}`}>{children}</th>
);
const Rank = ({ i, name }: { i: number; name: string }) => (
    <div className="flex items-center gap-2">
        <span className="w-5 text-center text-xs">{i < 3 ? MEDAL[i] : <span className="font-mono text-muted-foreground">{i + 1}</span>}</span>
        <span className={`h-6 w-6 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${AVATAR[i % AVATAR.length]}`}>{initials(name)}</span>
        <span className="font-medium text-foreground truncate">{name}</span>
    </div>
);

export default function LeaderboardPage() {
    const { isOwner } = useCurrentUser();
    const [period, setPeriod] = useState<KpiPeriod>("month");
    const [cStart, setCStart] = useState("");
    const [cEnd, setCEnd] = useState("");
    const [branchSel, setBranchSel] = useState<number | "all">("all");
    const [divisi, setDivisi] = useState<string>("Semua");   // Semua | <roleName> | Designer
    const [karyawan, setKaryawan] = useState<string>("");     // filter nama (CS/designer)

    const branchId = branchSel === "all" ? undefined : branchSel;
    const common = { period, start: period === "custom" ? cStart : undefined, end: period === "custom" ? cEnd : undefined, branchId } as const;

    const { data: branches } = useQuery({
        queryKey: ["active-branches"],
        queryFn: async () => (await api.get("/company-branches/active")).data as { id: number; name: string }[],
        enabled: isOwner,
    });
    const { data: roles } = useQuery({
        queryKey: ["users-roles"],
        queryFn: async () => (await api.get("/users/roles")).data as { id: number; name: string }[],
    });

    const kpi = useQuery({ queryKey: ["lb-kpi", common], queryFn: () => getKpiReport(common as any) });
    const designer = useQuery({ queryKey: ["lb-designer", common], queryFn: () => getDesignerLeaderboard(common as any) });
    const designOut = useQuery({ queryKey: ["lb-designout", common], queryFn: () => getDesignOutput(common as any) });
    const operatorQ = useQuery({ queryKey: ["lb-operator", common], queryFn: () => getOperatorLeaderboard(common as any) });
    const teamQ = useQuery({ queryKey: ["lb-team", common], queryFn: () => getTeamLeaderboard(common as any) });
    const prodCatsQ = useQuery({ queryKey: ["lb-prodcats"], queryFn: getProductionCategories });

    const showTeam = divisi === "Semua" || divisi === "Tim";
    const showCS = divisi === "Semua" || (divisi !== "Designer" && divisi !== "Operator" && divisi !== "Tim");
    const showDesigner = divisi === "Semua" || divisi === "Designer";
    const showOperator = divisi === "Semua" || divisi === "Operator";
    const roleFilter = divisi !== "Semua" && divisi !== "Designer" && divisi !== "Operator" && divisi !== "Tim" ? divisi : null;
    const kw = karyawan.trim().toLowerCase();

    // ── CS rows (filter by role divisi + karyawan) ──
    const csRows = useMemo(() => {
        let r = [...(kpi.data?.leaderboard ?? [])];
        if (roleFilter) r = r.filter(x => (x.roleName || '') === roleFilter);
        if (kw) r = r.filter(x => (x.name || "").toLowerCase().includes(kw));
        const cuan = (x: KpiLeaderboardEntry) => x.wonValue + x.walkinValue;
        return r.sort((a, b) => cuan(b) - cuan(a));
    }, [kpi.data, roleFilter, kw]);

    // Kolom metrik produk custom (owner-defined) utk leaderboard CS.
    const csCustomDefs = kpi.data?.customMetricDefs ?? [];

    const dcRows = useMemo(() => {
        let r = [...(kpi.data?.designCheckLeaderboard ?? [])];
        if (kw) r = r.filter(x => (x.name || "").toLowerCase().includes(kw));
        return r;
    }, [kpi.data, kw]);
    const doRows = useMemo(() => {
        let r = [...(designOut.data ?? [])];
        if (kw) r = r.filter(x => (x.name || "").toLowerCase().includes(kw));
        return r;
    }, [designOut.data, kw]);
    const dgRows = useMemo(() => {
        let r = [...(designer.data?.leaderboard ?? [])];
        if (kw) r = r.filter(x => (x.name || "").toLowerCase().includes(kw));
        // Bagian omzet dulu; kalau seri (mis. sama-sama 0) → yang banyak bikin SO di atas
        return r.sort((a, b) => b.omzetShare - a.omzetShare || b.soCreated - a.soCreated || b.assignment - a.assignment);
    }, [designer.data, kw]);

    const opRows = useMemo(() => {
        let r = [...(operatorQ.data ?? [])];
        if (kw) r = r.filter(x => (x.name || "").toLowerCase().includes(kw));
        return r.sort((a, b) => b.total - a.total || b.printPcs - a.printPcs);
    }, [operatorQ.data, kw]);

    const teamRows = useMemo(() => [...(teamQ.data?.leaderboard ?? [])].sort((a, b) => b.omzet - a.omzet), [teamQ.data]);

    const loading = kpi.isLoading || designer.isLoading || designOut.isLoading || operatorQ.isLoading;

    // Juara CS
    const champCuan = topByOf(csRows, x => x.wonValue + x.walkinValue);
    const champClose = topByOf(csRows, x => x.dealsClosed);
    const champLead = topByOf(csRows, x => x.leadsHandled);
    const champKirim = topByOf(csRows, x => x.notasDelivered);
    const champResp = (() => {
        const withResp = csRows.filter(x => x.avgResponseHrs != null);
        if (!withResp.length) return null;
        const best = withResp.reduce((a, b) => (a.avgResponseHrs! <= b.avgResponseHrs! ? a : b));
        return { row: best, v: best.avgResponseHrs! };
    })();

    return (
        <div className="space-y-5 max-w-7xl mx-auto pb-6">
            {/* Header */}
            <div className="flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <span className="h-11 w-11 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0">
                    <Trophy className="h-6 w-6" />
                </span>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Leaderboard Tim</h1>
                    <p className="text-sm text-muted-foreground">Kinerja semua karyawan — CS &amp; Designer. Tiap angka ada keterangan "Cara Hitung"-nya.</p>
                </div>
            </div>

            {/* Filter bar */}
            <div className="bg-card rounded-2xl border border-border shadow-sm p-3 sm:p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground mr-1">Periode</span>
                    {PERIODS.map(p => (
                        <button key={p.value} onClick={() => setPeriod(p.value)}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${period === p.value ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>
                            {p.label}
                        </button>
                    ))}
                    {period === "custom" && (
                        <span className="flex items-center gap-1.5">
                            <input type="date" value={cStart} onChange={e => setCStart(e.target.value)} className="bg-background border border-border rounded-lg px-2 py-1 text-xs" />
                            <span className="text-muted-foreground text-xs">→</span>
                            <input type="date" value={cEnd} onChange={e => setCEnd(e.target.value)} className="bg-background border border-border rounded-lg px-2 py-1 text-xs" />
                        </span>
                    )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground mr-1">Divisi</span>
                    {["Semua", "Tim", ...(roles?.map(r => r.name) ?? []), "Designer", "Operator"].map(d => (
                        <button key={d} onClick={() => setDivisi(d)}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${divisi === d ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>
                            {d}
                        </button>
                    ))}
                    <div className="relative ml-auto">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                        <input value={karyawan} onChange={e => setKaryawan(e.target.value)} placeholder="Cari karyawan…"
                            className="bg-background border border-border rounded-lg pl-8 pr-2 py-1.5 text-xs w-40 focus:ring-2 focus:ring-ring outline-none" />
                    </div>
                    {isOwner && branches && branches.length > 0 && (
                        <select value={branchSel} onChange={e => setBranchSel(e.target.value === "all" ? "all" : Number(e.target.value))}
                            className="bg-background border border-border rounded-lg px-2 py-1.5 text-xs">
                            <option value="all">Semua Cabang</option>
                            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : (
                <>
                    {/* ══ TIM / CABANG (omzet nota dibagi per peran → per cabang home) ══ */}
                    {showTeam && (
                        <SectionCard icon={<Building2 className="h-5 w-5" />} title="Tim / Cabang" subtitle="Omzet tiap nota dibagi rata ke peran yang terlibat (CS · Desainer · Operator), lalu dijumlah per cabang home.">
                            {teamRows.length === 0 ? <Empty /> : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm min-w-[640px]">
                                        <thead><tr className="text-xs text-muted-foreground border-b border-border">
                                            <Th>Cabang</Th><Th right>Bagian CS</Th><Th right>Bagian Desainer</Th><Th right>Bagian Operator</Th><Th right>Total Omzet</Th>
                                        </tr></thead>
                                        <tbody>
                                            {teamRows.map((r, i) => (
                                                <tr key={r.branchId ?? 'none'} className="border-b border-border/60 last:border-0 hover:bg-accent/50 transition-colors">
                                                    <td className="py-2 px-2"><Rank i={i} name={r.name} /></td>
                                                    <td className="py-2 px-2 text-right font-mono text-indigo-600 dark:text-indigo-300">{r.csShare > 0 ? fmtRp(r.csShare) : '—'}</td>
                                                    <td className="py-2 px-2 text-right font-mono text-violet-600 dark:text-violet-300">{r.designerShare > 0 ? fmtRp(r.designerShare) : '—'}</td>
                                                    <td className="py-2 px-2 text-right font-mono text-cyan-600 dark:text-cyan-300">{r.operatorShare > 0 ? fmtRp(r.operatorShare) : '—'}</td>
                                                    <td className="py-2 px-2 text-right font-mono font-bold text-amber-600 dark:text-amber-300">{fmtRp(r.omzet)}</td>
                                                </tr>
                                            ))}
                                            {teamQ.data && (
                                                <tr className="border-t-2 border-border font-semibold">
                                                    <td className="py-2 px-2 text-muted-foreground">Total</td>
                                                    <td className="py-2 px-2 text-right font-mono">{fmtRp(teamQ.data.totals.csShare)}</td>
                                                    <td className="py-2 px-2 text-right font-mono">{fmtRp(teamQ.data.totals.designerShare)}</td>
                                                    <td className="py-2 px-2 text-right font-mono">{fmtRp(teamQ.data.totals.operatorShare)}</td>
                                                    <td className="py-2 px-2 text-right font-mono">{fmtRp(teamQ.data.totals.omzet)}</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                            <CaraHitung>
                                <p><b>Prinsip:</b> tiap nota (omzet = grandTotal) dibagi <b>rata</b> ke peran yang benar-benar terlibat di nota itu — CS pembuat lead, desainer pembuat SO, operator yang produksi. Kalau ketiganya ada → masing-masing 1/3; kalau hanya 2 peran → 1/2; dst. Total selalu = 100% omzet.</p>
                                <p><b>Cabang:</b> bagian tiap orang masuk ke <b>cabang home</b>-nya (CS: cabang akun user; Desainer: cabang di profil desainer; Operator: cabang PIN saat produksi/cetak). Jadi nota lintas cabang otomatis terbagi antar cabang.</p>
                                <p><b>Bagian operator</b> dibagi lagi antar operator sesuai keterlibatan (kerja sama 1/N).</p>
                                <p className="text-[11px] italic">"Tak diketahui" = bagian yang cabang orangnya belum ter-set (mis. data operator lama sebelum fitur ini). Akurat penuh sejak fitur aktif.</p>
                            </CaraHitung>
                        </SectionCard>
                    )}

                    {/* ══ DIVISI CS / SALES ══ */}
                    {showCS && (
                        <SectionCard icon={<Users className="h-5 w-5" />} title="Divisi CS / Sales" subtitle="Berbasis lead yang ditangani + transaksi POS walk-in.">
                            {/* Juara */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-4">
                                <ChampionCard icon={<Crown />} title="Raja Cuan" name={champCuan?.row.name} value={fmtRp(champCuan?.v ?? 0)} accent="bg-amber-500/15 text-amber-500" />
                                <ChampionCard icon={<Target />} title="Raja Closing" name={champClose?.row.name} value={`${champClose?.v ?? 0} closing`} accent="bg-emerald-500/15 text-emerald-500" />
                                <ChampionCard icon={<Phone />} title="Raja Lead" name={champLead?.row.name} value={`${champLead?.v ?? 0} lead`} accent="bg-indigo-500/15 text-indigo-500" />
                                <ChampionCard icon={<Truck />} title="Raja Kirim" name={champKirim?.row.name} value={`${champKirim?.v ?? 0} terkirim`} accent="bg-sky-500/15 text-sky-500" />
                                <ChampionCard icon={<Zap />} title="Tercepat Respon" name={champResp?.row.name} value={champResp ? `${champResp.v.toFixed(1)} jam` : ''} accent="bg-blue-500/15 text-blue-500" />
                            </div>
                            {csRows.length === 0 ? <Empty /> : (
                                <>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm min-w-[900px]">
                                            <thead><tr className="text-xs text-muted-foreground border-b border-border">
                                                <Th>Nama</Th><Th right>Leads</Th><Th right>Closing</Th><Th right>Lost</Th>
                                                <Th right>Rate</Th><Th right>Pcs</Th>
                                                {csCustomDefs.map(d => <Th key={d.id} right>{d.label}</Th>)}
                                                <Th right>Dikirim</Th><Th right>Terkirim</Th><Th right>Cuan (net)</Th><Th right>Omzet (bagian)</Th><Th right>Akan Datang</Th><Th right>Respon</Th>
                                            </tr></thead>
                                            <tbody>
                                                {csRows.map((r, i) => (
                                                    <tr key={r.userId} className="border-b border-border/60 last:border-0 hover:bg-accent/50 transition-colors">
                                                        <td className="py-2 px-2"><Rank i={i} name={r.name} />{r.roleName && <span className="ml-1 text-[10px] text-muted-foreground">· {r.roleName}</span>}</td>
                                                        <td className="py-2 px-2 text-right font-mono">{r.leadsHandled}</td>
                                                        <td className="py-2 px-2 text-right font-mono text-emerald-600 dark:text-emerald-300">{r.dealsClosed}</td>
                                                        <td className="py-2 px-2 text-right font-mono text-red-600 dark:text-red-300">{r.dealsLost || '—'}</td>
                                                        <td className="py-2 px-2 text-right font-mono font-semibold">{(r.closingRate * 100).toFixed(0)}%</td>
                                                        <td className="py-2 px-2 text-right font-mono text-muted-foreground">{(r.pcsOrdered + r.walkinPcs) || '—'}</td>
                                                        {csCustomDefs.map(d => {
                                                            const v = r.customMetrics?.[String(d.id)] ?? 0;
                                                            return (
                                                                <td key={d.id} className="py-2 px-2 text-right font-mono text-indigo-600 dark:text-indigo-300 font-semibold">
                                                                    {v ? (d.countMode === 'OMZET' ? fmtRp(v) : v.toLocaleString('id-ID')) : '—'}
                                                                </td>
                                                            );
                                                        })}
                                                        <td className="py-2 px-2 text-right font-mono text-amber-600 dark:text-amber-300 font-semibold">
                                                            {r.notasInTransit || '—'}
                                                            {r.pcsInTransit > 0 && <span className="block text-[10px] font-normal text-muted-foreground">{r.pcsInTransit} pcs</span>}
                                                        </td>
                                                        <td className="py-2 px-2 text-right font-mono text-sky-600 dark:text-sky-300 font-semibold">
                                                            {r.notasDelivered || '—'}
                                                            {r.pcsDelivered > 0 && <span className="block text-[10px] font-normal text-muted-foreground">{r.pcsDelivered} pcs</span>}
                                                        </td>
                                                        <td className="py-2 px-2 text-right font-mono text-amber-600 dark:text-amber-300">{fmtRp(r.wonValue + r.walkinValue)}</td>
                                                        <td className="py-2 px-2 text-right font-mono text-emerald-600 dark:text-emerald-300">{r.omzetShare > 0 ? fmtRp(r.omzetShare) : '—'}</td>
                                                        <td className="py-2 px-2 text-right font-mono text-muted-foreground">{r.pendingValue > 0 ? fmtRp(r.pendingValue) : '—'}</td>
                                                        <td className="py-2 px-2 text-right font-mono text-muted-foreground">{r.avgResponseHrs != null ? `${r.avgResponseHrs.toFixed(1)}j` : '—'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <MiniBar data={csRows.map(r => ({ name: r.name, v: r.wonValue + r.walkinValue }))} label="Cuan (net)" money />
                                </>
                            )}
                            <CaraHitung>
                                <p><b>Leads</b> = jumlah lead yang di-assign ke orang ini & dibuat dalam periode.</p>
                                <p><b>Closing</b> = lead berstatus <b>CLOSED_WON</b>. <b>Lost</b> = <b>CLOSED_LOST</b>. <b>Rate</b> = Closing ÷ Leads.</p>
                                <p><b>Pcs</b> = jumlah barang yang diorder — dari nota lead closing <i>+</i> transaksi POS walk-in yang ia tangani (kategori add-on tidak dihitung).</p>
                                <p><b>Dikirim</b> (sedang dikirim) = jumlah <b>nota</b> yang pesanannya sudah diberangkatkan tetapi <b>belum sampai</b> — job produksinya masih di tahap <b>KIRIM</b> di pipeline. <b>Terkirim</b> (sudah sampai) = nota yang job produksinya sudah mencapai tahap <b>SELESAI</b> — barang sudah diterima pelanggan. Keduanya berbasis nota yang <b>shippedAt</b>-nya jatuh di periode ini (dihitung sekali per nota, bukan per job) dan diatribusikan ke CS yang menangani nota tersebut (lead ⟶ CS assign, atau walk-in ⟶ kasir). Satu nota dihitung <b>Terkirim</b> hanya bila <b>semua</b> job-nya sudah SELESAI; kalau masih ada yang di KIRIM → masuk <b>Dikirim</b>. Nota yang di-<b>retur</b> tidak dihitung. Angka kecil <b>“… pcs”</b> di bawahnya = jumlah barang yang dikirim (dihitung <b>per item</b>, jadi satu nota bisa menyumbang pcs ke Dikirim & Terkirim sekaligus), basis tanggal kirim yang sama.</p>
                                <p><b>Cuan (net)</b> = Nilai deal lead yang closing (estimatedValue) <i>+</i> omzet transaksi POS walk-in yang ia tangani — keduanya <b>sudah dikurangi biaya platform</b> (fee marketplace). Ini omzet <b>penuh</b> penjualan yang ia bawa.</p>
                                <p><b>Omzet (bagian)</b> = porsi <b>adil</b> CS dari omzet nota — tiap nota dibagi rata ke peran yang terlibat (CS · desainer · operator). Dipakai board <b>Tim / Cabang</b> agar nota lintas cabang terbagi ke tiap cabang home.</p>
                                <p><b>Akan Datang</b> = sisa tagihan (piutang) transaksi yang masih PENDING/PARTIAL.</p>
                                <p><b>Respon</b> = rata-rata jam dari lead masuk sampai aktivitas pertama CS.</p>
                            </CaraHitung>
                        </SectionCard>
                    )}

                    {/* ══ DIVISI DESIGNER ══ */}
                    {showDesigner && (
                        <>
                            {/* Cek Desain */}
                            <SectionCard icon={<Search className="h-5 w-5" />} title="Designer — Cek Desain (pra-jual)" subtitle="Kerja tim: outcome lead dibagi ke designer & CS.">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                                    <ChampionCard icon={<Search />} title="Sang Pengecek" name={topByOf(dcRows, x => x.dicek)?.row.name} value={`${topByOf(dcRows, x => x.dicek)?.v ?? 0} dicek`} accent="bg-violet-500/15 text-violet-500" />
                                    <ChampionCard icon={<Target />} title="Closing Tertinggi" name={topByOf(dcRows, x => x.closing)?.row.name} value={`${topByOf(dcRows, x => x.closing)?.v ?? 0} closing`} accent="bg-emerald-500/15 text-emerald-500" />
                                </div>
                                {dcRows.length === 0 ? <Empty /> : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm min-w-[560px]">
                                            <thead><tr className="text-xs text-muted-foreground border-b border-border">
                                                <Th>Designer</Th><Th right>Dicek</Th><Th right>Closing</Th><Th right>Batal</Th><Th right>Batal teknis</Th><Th right>Rate</Th>
                                            </tr></thead>
                                            <tbody>
                                                {dcRows.map((r, i) => (
                                                    <tr key={r.name} className="border-b border-border/60 last:border-0 hover:bg-accent/50">
                                                        <td className="py-2 px-2"><Rank i={i} name={r.name} /></td>
                                                        <td className="py-2 px-2 text-right font-mono">{r.dicek}</td>
                                                        <td className="py-2 px-2 text-right font-mono text-emerald-600 dark:text-emerald-300">{r.closing}</td>
                                                        <td className="py-2 px-2 text-right font-mono text-red-600 dark:text-red-300">{r.batal || '—'}</td>
                                                        <td className="py-2 px-2 text-right font-mono text-amber-600 dark:text-amber-300">{r.batalTeknis || '—'}</td>
                                                        <td className="py-2 px-2 text-right font-mono font-semibold">{(r.closingRate * 100).toFixed(0)}%</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                                <CaraHitung>
                                    <p><b>Dicek</b> = jumlah lead yang designer ini ditunjuk mengecek desainnya (di-set di detail lead).</p>
                                    <p><b>Closing/Batal</b> = outcome lead tersebut (WON/LOST) — <b>sama dengan CS</b> yang memegang (kerja tim).</p>
                                    <p><b>Batal teknis</b> = batal dengan verdict <b>"Tidak bisa dicetak"</b> (gagal murni soal desain). <b>Rate</b> = Closing ÷ Dicek.</p>
                                </CaraHitung>
                            </SectionCard>

                            {/* Produktivitas Desain */}
                            <SectionCard icon={<Palette className="h-5 w-5" />} title="Designer — Produktivitas Jasa Desain" subtitle="Berapa desain dikerjakan + rincian tier (dari order).">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                                    <ChampionCard icon={<Palette />} title="Raja Desain" name={topByOf(doRows, x => x.total)?.row.name} value={`${topByOf(doRows, x => x.total)?.v ?? 0} desain`} accent="bg-fuchsia-500/15 text-fuchsia-500" />
                                    <ChampionCard icon={<Crown />} title="Omzet Desain Top" name={topByOf(doRows, x => x.omzet)?.row.name} value={fmtRp(topByOf(doRows, x => x.omzet)?.v ?? 0)} accent="bg-amber-500/15 text-amber-500" />
                                </div>
                                {doRows.length === 0 ? <Empty /> : (
                                    <>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm min-w-[560px]">
                                                <thead><tr className="text-xs text-muted-foreground border-b border-border">
                                                    <Th>Designer</Th><Th right>Total</Th><Th>Rincian Tier</Th><Th right>Omzet</Th>
                                                </tr></thead>
                                                <tbody>
                                                    {doRows.map((r, i) => (
                                                        <tr key={r.name} className="border-b border-border/60 last:border-0 hover:bg-accent/50 align-top">
                                                            <td className="py-2 px-2"><Rank i={i} name={r.name} /></td>
                                                            <td className="py-2 px-2 text-right font-mono font-bold text-fuchsia-600 dark:text-fuchsia-300">{r.total}</td>
                                                            <td className="py-2 px-2"><div className="flex flex-wrap gap-1">{r.byTier.map(t => <span key={t.tier} className="rounded-full bg-muted px-2 py-0.5 text-[11px]">{t.tier}<b className="text-muted-foreground">·{t.count}</b></span>)}</div></td>
                                                            <td className="py-2 px-2 text-right font-mono text-emerald-600 dark:text-emerald-300">{fmtRp(r.omzet)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        <MiniBar data={doRows.map(r => ({ name: r.name, v: r.total }))} label="Jumlah desain" />
                                    </>
                                )}
                                <CaraHitung>
                                    <p><b>Total Desain</b> = jumlah item produk <b>"Jasa Desain"</b> di nota, dijumlah qty-nya. Basis tanggal = tanggal nota dibuat.</p>
                                    <p><b>Designer</b> diambil dari SO (Sales Order). Nota walk-in tanpa SO masuk ke <b>"Belum di-assign"</b> agar tidak hilang dari hitungan.</p>
                                    <p><b>Rincian Tier</b> = pecahan per <b>varian</b> jasa desain (Easy/Medium/Hard/Standar) — tier ditentukan saat input order.</p>
                                    <p><b>Omzet</b> = nilai line item jasa desainnya saja (bukan seluruh order).</p>
                                </CaraHitung>
                            </SectionCard>

                            {/* Produksi / Omzet */}
                            <SectionCard icon={<Factory className="h-5 w-5" />} title="Designer — Produksi & Omzet" subtitle="SO yang dibuat designer + job produksi (SO yang jadi nota).">
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
                                    <ChampionCard icon={<span>📋</span>} title="Raja SO" name={topByOf(dgRows, x => x.soCreated)?.row.name} value={`${topByOf(dgRows, x => x.soCreated)?.v ?? 0} SO`} accent="bg-violet-500/15 text-violet-500" />
                                    <ChampionCard icon={<Crown />} title="Raja Omzet (bagian)" name={topByOf(dgRows, x => x.omzetShare)?.row.name} value={fmtRp(topByOf(dgRows, x => x.omzetShare)?.v ?? 0)} accent="bg-amber-500/15 text-amber-500" />
                                    <ChampionCard icon={<Award />} title="Raja ACC" name={topByOf(dgRows, x => x.acc)?.row.name} value={`${topByOf(dgRows, x => x.acc)?.v ?? 0} ACC`} accent="bg-emerald-500/15 text-emerald-500" />
                                    <ChampionCard icon={<Factory />} title="Mesin Produksi" name={topByOf(dgRows, x => x.selesai)?.row.name} value={`${topByOf(dgRows, x => x.selesai)?.v ?? 0} selesai`} accent="bg-indigo-500/15 text-indigo-500" />
                                </div>
                                {dgRows.length === 0 ? <Empty /> : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm min-w-[860px]">
                                            <thead><tr className="text-xs text-muted-foreground border-b border-border">
                                                <Th>Designer</Th><Th right>SO Dibuat</Th><Th right>Nota</Th><Th right>Job</Th><Th right>Nunggu ACC</Th><Th right>ACC</Th><Th right>Selesai</Th><Th right>Express</Th><Th right>Pcs</Th><Th right>Omzet (bagian)</Th>
                                            </tr></thead>
                                            <tbody>
                                                {dgRows.map((r, i) => (
                                                    <tr key={r.name} className="border-b border-border/60 last:border-0 hover:bg-accent/50">
                                                        <td className="py-2 px-2"><Rank i={i} name={r.name} /></td>
                                                        <td className="py-2 px-2 text-right font-mono text-violet-600 dark:text-violet-300">{r.soCreated || '—'}</td>
                                                        <td className="py-2 px-2 text-right font-mono">{r.soInvoiced || '—'}</td>
                                                        <td className="py-2 px-2 text-right font-mono">{r.assignment || '—'}</td>
                                                        <td className="py-2 px-2 text-right font-mono text-orange-600 dark:text-orange-300">{r.nungguAcc || '—'}</td>
                                                        <td className="py-2 px-2 text-right font-mono text-emerald-600 dark:text-emerald-300">{r.acc || '—'}</td>
                                                        <td className="py-2 px-2 text-right font-mono">{r.selesai || '—'}</td>
                                                        <td className="py-2 px-2 text-right font-mono text-orange-500">{r.express || '—'}</td>
                                                        <td className="py-2 px-2 text-right font-mono text-muted-foreground">{r.pcs || '—'}</td>
                                                        <td className="py-2 px-2 text-right font-mono text-amber-600 dark:text-amber-300">{r.omzetShare > 0 ? fmtRp(r.omzetShare) : '—'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                                <CaraHitung>
                                    <p><b>SO Dibuat</b> = jumlah Sales Order (SPK) yang dibuat designer di periode (kecuali yang CANCELLED). <b>Kolom ini menutup celah designer yang kerjanya membuat SO walau belum jadi nota.</b></p>
                                    <p><b>Nota</b> = jumlah SO designer yang sudah jadi nota di periode. <b>Pcs</b> = jumlah barang dari nota.</p>
                                    <p><b>Omzet (bagian)</b> = bagian desainer dari omzet nota — tiap nota dibagi rata ke peran yang terlibat (CS · desainer · operator). Bukan lagi seluruh grandTotal, tapi porsi adilnya. Lihat board <b>Tim / Cabang</b>.</p>
                                    <p><b>Nunggu ACC</b> = desain sudah di-upload, card di stage <b>ACC</b> menunggu approve customer (belum masuk cetak).</p>
                                    <p><b>Job/ACC/Selesai/Express</b> = dari job produksi (tanggal job dibuat). ACC = sudah lolos approve & masuk tahap cetak (PRINT..SELESAI); Selesai = sampai KIRIM/SELESAI.</p>
                                    <p className="text-[11px] italic">Catatan: designer bisa muncul walau Omzet 0 — kalau ia baru membuat SO yang belum jadi nota (kolom "SO Dibuat" tetap kehitung).</p>
                                </CaraHitung>
                            </SectionCard>
                        </>
                    )}

                    {/* ══ DIVISI OPERATOR PRODUKSI & CETAK ══ */}
                    {showOperator && (
                        <SectionCard icon={<Factory className="h-5 w-5" />} title="Divisi Operator — Produksi & Cetak" subtitle="Output operator dari antrian produksi (kanban) + antrian cetak paper.">
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
                                <ChampionCard icon={<Crown />} title="Raja Omzet Operator" name={topByOf(opRows, x => x.omzetShare)?.row.name} value={fmtRp(topByOf(opRows, x => x.omzetShare)?.v ?? 0)} accent="bg-amber-500/15 text-amber-500" />
                                <ChampionCard icon={<Printer />} title="Raja Cetak" name={topByOf(opRows, x => x.printJobs)?.row.name} value={`${topByOf(opRows, x => x.printJobs)?.v ?? 0} job`} accent="bg-cyan-500/15 text-cyan-500" />
                                <ChampionCard icon={<Factory />} title="Raja Produksi" name={topByOf(opRows, x => x.prodJobs)?.row.name} value={`${topByOf(opRows, x => x.prodJobs)?.v ?? 0} job`} accent="bg-indigo-500/15 text-indigo-500" />
                                <ChampionCard icon={<Layers />} title="Paling Banyak Lembar" name={topByOf(opRows, x => x.printPcs)?.row.name} value={`${topByOf(opRows, x => x.printPcs)?.v ?? 0} lembar`} accent="bg-fuchsia-500/15 text-fuchsia-500" />
                            </div>
                            {opRows.length === 0 ? <Empty /> : (
                                <>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm min-w-[760px]">
                                            <thead><tr className="text-xs text-muted-foreground border-b border-border">
                                                <Th>Operator</Th><Th right>Cetak (job)</Th><Th right>Lembar</Th><Th right>Produksi (job)</Th><Th right>Selesai</Th><Th right>Total Job</Th><Th right>Omzet (bagian)</Th>
                                            </tr></thead>
                                            <tbody>
                                                {opRows.map((r, i) => (
                                                    <tr key={r.name} className="border-b border-border/60 last:border-0 hover:bg-accent/50 transition-colors">
                                                        <td className="py-2 px-2"><Rank i={i} name={r.name} /></td>
                                                        <td className="py-2 px-2 text-right font-mono text-cyan-600 dark:text-cyan-300">{r.printJobs || '—'}</td>
                                                        <td className="py-2 px-2 text-right font-mono text-muted-foreground">{r.printPcs || '—'}</td>
                                                        <td className="py-2 px-2 text-right font-mono text-indigo-600 dark:text-indigo-300">{r.prodJobs || '—'}</td>
                                                        <td className="py-2 px-2 text-right font-mono text-emerald-600 dark:text-emerald-300">{r.prodDone || '—'}</td>
                                                        <td className="py-2 px-2 text-right font-mono font-semibold">{r.total || '—'}</td>
                                                        <td className="py-2 px-2 text-right font-mono text-amber-600 dark:text-amber-300">{r.omzetShare > 0 ? fmtRp(r.omzetShare) : '—'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    {(prodCatsQ.data ?? []).length > 0 && (
                                        <div className="overflow-x-auto mt-4">
                                            <div className="text-xs font-semibold text-muted-foreground mb-1">Breakdown Produksi per Kategori <span className="font-normal">(job · luas/pcs · omzet)</span></div>
                                            <table className="w-full text-sm min-w-[760px]">
                                                <thead><tr className="text-xs text-muted-foreground border-b border-border">
                                                    <Th>Operator</Th>
                                                    {(prodCatsQ.data ?? []).map((pc: ProductionCategory) => (
                                                        <Th key={pc.id} right>{pc.name} <span className="font-normal">(job · {pc.measureBy === 'PCS' ? 'pcs' : 'm²'} · Rp)</span></Th>
                                                    ))}
                                                </tr></thead>
                                                <tbody>
                                                    {opRows.map((r, i) => {
                                                        const cell = (pc: ProductionCategory) => {
                                                            const c = r.production?.[String(pc.id)];
                                                            if (!c || c.jobs === 0) return '—';
                                                            const measure = pc.measureBy === 'PCS' ? `${c.pcs || 0} pcs` : fmtM2(c.areaM2);
                                                            return `${c.jobs} · ${measure} · ${fmtRp(c.omzet)}`;
                                                        };
                                                        return (
                                                            <tr key={r.name} className="border-b border-border/60 last:border-0 hover:bg-accent/50 transition-colors">
                                                                <td className="py-2 px-2"><Rank i={i} name={r.name} /></td>
                                                                {(prodCatsQ.data ?? []).map((pc: ProductionCategory) => (
                                                                    <td key={pc.id} className="py-2 px-2 text-right font-mono text-indigo-600 dark:text-indigo-300">{cell(pc)}</td>
                                                                ))}
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                    <MiniBar data={opRows.map(r => ({ name: r.name, v: r.omzetShare }))} label="Omzet (bagian) operator" money />
                                </>
                            )}
                            <CaraHitung>
                                <p><b>Cetak (job)</b> = job di <b>antrian cetak paper</b> yang sudah dicetak operator ini (status SELESAI/DIAMBIL). <b>Lembar</b> = total qty yang dicetak. Basis tanggal = waktu selesai cetak.</p>
                                <p><b>Produksi (job)</b> = job di <b>antrian produksi</b> (kanban /produksi/board) yang ia geser tahapannya. <b>Selesai</b> = job yang ia bawa sampai tahap KIRIM/SELESAI. Basis tanggal = waktu pindah kartu.</p>
                                <p><b>Omzet (bagian)</b> = bagian operator dari omzet nota — tiap nota dibagi rata ke peran yang terlibat (CS · desainer · operator), lalu porsi operator dibagi lagi antar operator sesuai keterlibatan (kerja sama 1/N). Bukan lagi nilai line item. Dasar peringkat. Lihat board <b>Tim / Cabang</b>.</p>
                                <p><b>Total Job</b> = Cetak + Produksi. Operator dicocokkan berdasarkan <b>nama</b> yang ia isi saat login board/cetak.</p>
                                <p><b>Breakdown per kategori</b>: tiap <b>kategori produksi</b> (bisa ditambah/edit/hapus di <b>Manajemen Kategori → Kategori Produksi</b>) punya <b>sumber</b> sendiri — <b>Cetak</b> (dihitung dari bahan cetak/antrian cetak) atau <b>Produksi</b> (dari antrian produksi/kanban, sekali per job saat KIRIM/SELESAI). Kategori dilekatkan ke kategori barang lewat pilihan <b>Tipe Produksi</b>. Satuan mengikuti setelan kategori: <b>m²</b> (luas) atau <b>pcs</b>. <b>Rp</b> = nilai line item.</p>
                                <p className="text-[11px] italic">Produksi terhitung dari kedua board: kanban /produksi/board maupun antrian /produksi (mode-status) — keduanya kini mencatat nama operator saat menyelesaikan job.</p>
                            </CaraHitung>
                        </SectionCard>
                    )}
                </>
            )}
        </div>
    );
}

function Empty() {
    return <div className="text-center py-8 text-sm text-muted-foreground">Belum ada data di periode/filter ini.</div>;
}

function MiniBar({ data, label, money }: { data: { name: string; v: number }[]; label: string; money?: boolean }) {
    const top = data.filter(d => d.v > 0).slice(0, 8);
    if (top.length === 0) return null;
    return (
        <div className="mt-4 pt-3 border-t border-border/60">
            <div className="text-xs font-semibold text-muted-foreground mb-1">{label} — grafik</div>
            <ResponsiveContainer width="100%" height={Math.max(120, top.length * 30)}>
                <BarChart data={top} layout="vertical" margin={{ top: 4, right: 50, left: 4, bottom: 4 }}>
                    <XAxis type="number" tick={AXIS_TICK} axisLine={{ stroke: 'var(--border)' }} tickLine={{ stroke: 'var(--border)' }} tickFormatter={(v: any) => money ? `${Math.round(v / 1000)}rb` : v} />
                    <YAxis type="category" dataKey="name" width={90} tick={AXIS_TICK} axisLine={{ stroke: 'var(--border)' }} tickLine={{ stroke: 'var(--border)' }} />
                    <Tooltip cursor={{ fill: 'var(--muted)', opacity: 0.4 }} contentStyle={TOOLTIP_STYLE} formatter={(v: any) => [money ? fmtRp(v) : v, label]} />
                    <Bar dataKey="v" radius={[0, 6, 6, 0]} label={{ position: 'right', formatter: (v: any) => money ? `${Math.round(v / 1000)}rb` : v, fontSize: 11, fill: 'var(--muted-foreground)' }}>
                        {top.map((_e, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
