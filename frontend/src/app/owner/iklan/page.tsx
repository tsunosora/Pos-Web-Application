"use client";

import { useState, Fragment } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import {
    Megaphone, ArrowLeft, Loader2, Lock, RefreshCw, Wallet, MessageSquare,
    TrendingUp, Target, AlertTriangle, Tag, Plus, Trash2, Building2, Percent,
    ChevronRight, ChevronDown, Video, DollarSign, CheckCircle2,
} from "lucide-react";
import {
    getAdsOverview, getAdAccounts, getAdLabels, upsertAdLabel, deleteAdLabel,
    assignCampaignLabel, setCampaignProfit, getAdBreakdown, type CampaignRow, type AdRow,
} from "@/lib/api/meta-ads";
import { getActiveCompanyBranches } from "@/lib/api/discord";
import { useCurrentUser } from "@/hooks/useCurrentUser";

function fmtMoney(n: number | null | undefined, currency: string | null): string {
    if (n == null) return "—";
    try { return new Intl.NumberFormat("id-ID", { style: "currency", currency: currency || "IDR", maximumFractionDigits: 0 }).format(n); }
    catch { return `${currency || ""} ${Math.round(n).toLocaleString("id-ID")}`; }
}
const fmtNum = (n: number | null | undefined) => (n == null ? "—" : Number(n).toLocaleString("id-ID"));
const fmtX = (n: number | null | undefined) => (n == null ? "—" : `${n.toFixed(2)}×`);
const fmtPct = (n: number | null | undefined) => (n == null ? "—" : `${Number(n).toFixed(2)}%`);

// Warna KPI (standar): CTR ≥2%, ROAS ≥4×, CPR ≤ patokan (profit×5%).
const good = "text-emerald-600 dark:text-emerald-400";
const bad = "text-red-600 dark:text-red-400";
const ctrTone = (c: number) => (c >= 2 ? good : bad);
const roasTone = (r: number | null) => (r == null ? "" : r >= 4 ? good : bad);
const cprTone = (cpr: number | null, target: number | null) => (cpr == null || target == null ? "" : cpr <= target ? good : bad);

const STATUS_TONE: Record<string, string> = {
    ACTIVE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    PAUSED: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
};
const statusTone = (s: string | null) => (!s ? "bg-muted text-muted-foreground" : STATUS_TONE[s.toUpperCase()] || "bg-muted text-muted-foreground");

function StatCard({ icon: Icon, label, value, hint, accent, valueClass }: { icon: any; label: string; value: string; hint?: string; accent?: string; valueClass?: string; }) {
    return (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium"><Icon className={`h-4 w-4 ${accent || ""}`} /> {label}</div>
            <div className={`mt-1.5 text-2xl font-bold tabular-nums ${valueClass || "text-foreground"}`}>{value}</div>
            {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
        </div>
    );
}

// Sub-baris drill-down per iklan/video dalam 1 campaign.
function AdRowsExpand({ campaignId, since, until, currency, colSpan }: { campaignId: string; since: string; until: string; currency: string; colSpan: number; }) {
    const q = useQuery({ queryKey: ["ads-breakdown", campaignId, since, until], queryFn: () => getAdBreakdown(campaignId, since, until), retry: false });
    if (q.isLoading) return <tr><td colSpan={colSpan} className="px-6 py-3 text-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline" /> memuat iklan…</td></tr>;
    const ads = q.data?.ads ?? [];
    if (!ads.length) return <tr><td colSpan={colSpan} className="px-6 py-3 text-center text-muted-foreground text-xs">Tidak ada iklan pada rentang ini.</td></tr>;
    return (
        <tr><td colSpan={colSpan} className="bg-muted/30 px-4 py-3">
            <div className="text-xs font-semibold mb-2 flex items-center gap-1.5"><Video className="h-3.5 w-3.5" /> Rincian per Iklan / Video</div>
            <div className="overflow-x-auto">
                <table className="w-full text-xs">
                    <thead className="text-muted-foreground"><tr className="text-left">
                        <th className="py-1 pr-3 font-medium">Iklan</th>
                        <th className="py-1 px-2 font-medium text-right">Belanja</th>
                        <th className="py-1 px-2 font-medium text-right">Klik/CTR</th>
                        <th className="py-1 px-2 font-medium text-right">Chat</th>
                        <th className="py-1 px-2 font-medium text-right" title="Video plays (±3 dtk)">3 dtk</th>
                        <th className="py-1 px-2 font-medium text-right">25%</th>
                        <th className="py-1 px-2 font-medium text-right">50%</th>
                        <th className="py-1 px-2 font-medium text-right">75%</th>
                        <th className="py-1 px-2 font-medium text-right">100%</th>
                        <th className="py-1 px-2 font-medium text-right">Lead</th>
                        <th className="py-1 px-2 font-medium text-right">Closing</th>
                        <th className="py-1 px-2 font-medium text-right">ROAS</th>
                    </tr></thead>
                    <tbody>
                        {ads.map((a: AdRow) => (
                            <tr key={a.id} className="border-t border-border/50">
                                <td className="py-1 pr-3"><div className="font-medium">{a.name}</div><div className="text-[10px] text-muted-foreground">{a.effectiveStatus || ""}</div></td>
                                <td className="py-1 px-2 text-right tabular-nums">{fmtMoney(a.spend, currency)}</td>
                                <td className="py-1 px-2 text-right tabular-nums">{fmtNum(a.clicks)} <span className={ctrTone(a.ctr)}>({fmtPct(a.ctr)})</span></td>
                                <td className="py-1 px-2 text-right tabular-nums">{fmtNum(a.results)}</td>
                                <td className="py-1 px-2 text-right tabular-nums">{fmtNum(a.video.plays)}</td>
                                <td className="py-1 px-2 text-right tabular-nums">{fmtNum(a.video.p25)}</td>
                                <td className="py-1 px-2 text-right tabular-nums">{fmtNum(a.video.p50)}</td>
                                <td className="py-1 px-2 text-right tabular-nums">{fmtNum(a.video.p75)}</td>
                                <td className="py-1 px-2 text-right tabular-nums">{fmtNum(a.video.p100)}</td>
                                <td className="py-1 px-2 text-right tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">{fmtNum(a.leadsCaptured)}</td>
                                <td className="py-1 px-2 text-right tabular-nums font-semibold">{fmtNum(a.closings)}</td>
                                <td className={`py-1 px-2 text-right tabular-nums font-semibold ${roasTone(a.roas)}`}>{fmtX(a.roas)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <p className="text-[10px] text-muted-foreground mt-1">Kolom video = jumlah penonton sampai persentase durasi tsb. "Closing" = lead yang jadi transaksi lunas.</p>
            </div>
        </td></tr>
    );
}

export default function OwnerAdsPage() {
    const { currentUser, isOwner } = useCurrentUser();
    const qc = useQueryClient();
    const [since, setSince] = useState(dayjs().subtract(29, "day").format("YYYY-MM-DD"));
    const [until, setUntil] = useState(dayjs().format("YYYY-MM-DD"));
    const [accountId, setAccountId] = useState<string>("");
    const [filterLabelId, setFilterLabelId] = useState<string>("");
    const [showLabels, setShowLabels] = useState(false);
    const [newLabel, setNewLabel] = useState("");
    const [newLabelBranch, setNewLabelBranch] = useState<string>("");
    const [expanded, setExpanded] = useState<string | null>(null);

    const accountsQ = useQuery({ queryKey: ["ads-accounts"], queryFn: getAdAccounts, enabled: isOwner, staleTime: 6e5, retry: false });
    const labelsQ = useQuery({ queryKey: ["ads-labels"], queryFn: getAdLabels, enabled: isOwner, retry: false });
    const branchesQ = useQuery({ queryKey: ["active-branches"], queryFn: getActiveCompanyBranches, enabled: isOwner, staleTime: 6e5, retry: false });
    const overviewQ = useQuery({
        queryKey: ["ads-overview", since, until, accountId, filterLabelId],
        queryFn: () => getAdsOverview({ since, until, accountId: accountId || undefined, labelId: filterLabelId ? Number(filterLabelId) : undefined }),
        enabled: isOwner, retry: false,
    });

    const acct = overviewQ.data?.account?.id;
    const invalidate = () => { qc.invalidateQueries({ queryKey: ["ads-overview"] }); qc.invalidateQueries({ queryKey: ["ads-labels"] }); };
    const assignMut = useMutation({ mutationFn: (v: { campaignId: string; labelId: number | null }) => assignCampaignLabel(v.campaignId, v.labelId, acct), onSuccess: invalidate });
    const profitMut = useMutation({ mutationFn: (v: { campaignId: string; profit: number | null }) => setCampaignProfit(v.campaignId, v.profit, acct), onSuccess: () => qc.invalidateQueries({ queryKey: ["ads-overview"] }) });
    const createLabelMut = useMutation({ mutationFn: () => upsertAdLabel(newLabel.trim(), newLabelBranch ? Number(newLabelBranch) : null), onSuccess: () => { setNewLabel(""); setNewLabelBranch(""); qc.invalidateQueries({ queryKey: ["ads-labels"] }); } });
    const deleteLabelMut = useMutation({ mutationFn: (id: number) => deleteAdLabel(id), onSuccess: invalidate });

    if (!currentUser) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
    if (!isOwner) return (
        <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-center">
            <Lock className="h-10 w-10 text-muted-foreground" /><p className="text-muted-foreground">Halaman ini khusus Owner.</p>
            <Link href="/" className="text-sm text-primary underline">Kembali ke Dashboard</Link>
        </div>
    );

    const data = overviewQ.data;
    const currency = data?.currency ?? "IDR";
    const err = overviewQ.error as any;
    const labels = labelsQ.data ?? [];
    const COLS = 11; // jumlah kolom tabel campaign (utk colSpan drill-down)

    return (
        <div className="mx-auto max-w-[110rem] p-4 sm:p-6 space-y-5">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <Link href="/owner" className="rounded-lg border p-1.5 hover:bg-accent" title="Kembali ke Owner"><ArrowLeft className="h-4 w-4" /></Link>
                    <Megaphone className="h-6 w-6 text-sky-500" />
                    <div>
                        <h1 className="text-lg font-bold leading-tight">Iklan Meta (Ads Management)</h1>
                        <p className="text-xs text-muted-foreground">Standar KPI: CTR ≥2% · ROAS ≥4× · CPR ≤ profit×5% · omzet dari closing nyata</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setShowLabels((s) => !s)} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm hover:bg-accent"><Tag className="h-4 w-4" /> Kelola Label</button>
                    <button onClick={() => overviewQ.refetch()} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm hover:bg-accent"><RefreshCw className={`h-4 w-4 ${overviewQ.isFetching ? "animate-spin" : ""}`} /> Segarkan</button>
                </div>
            </div>

            {/* Kelola Label */}
            {showLabels && (
                <div className="rounded-xl border bg-card p-4 space-y-3">
                    <div className="text-sm font-semibold flex items-center gap-1.5"><Tag className="h-4 w-4" /> Label Custom Iklan</div>
                    <p className="text-xs text-muted-foreground">Label memisahkan biaya & lead per cabang/perusahaan di dashboard. Tautkan ke cabang → lead dari iklan berlabel ini otomatis masuk cabang tsb.</p>
                    <div className="flex flex-wrap items-end gap-2">
                        <label className="text-xs font-medium text-muted-foreground">Nama Label
                            <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="mis. Voliko Paris / Divisi Spanduk" className="mt-1 block rounded-lg border bg-background px-2 py-1.5 text-sm w-52" />
                        </label>
                        <label className="text-xs font-medium text-muted-foreground">Tautkan Cabang (opsional)
                            <select value={newLabelBranch} onChange={(e) => setNewLabelBranch(e.target.value)} className="mt-1 block rounded-lg border bg-background px-2 py-1.5 text-sm">
                                <option value="">— tidak ditautkan —</option>
                                {(branchesQ.data ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                        </label>
                        <button disabled={!newLabel.trim() || createLabelMut.isPending} onClick={() => createLabelMut.mutate()} className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50">
                            {createLabelMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Simpan
                        </button>
                    </div>
                    {labels.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1">
                            {labels.map((l) => (
                                <span key={l.id} className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-xs">
                                    <Tag className="h-3 w-3 text-sky-500" /><b>{l.name}</b>
                                    {l.branchName && <span className="text-muted-foreground inline-flex items-center gap-0.5"><Building2 className="h-3 w-3" />{l.branchName}</span>}
                                    <span className="text-muted-foreground">· {l.campaignCount} campaign</span>
                                    <button onClick={() => { if (confirm(`Hapus label "${l.name}"?`)) deleteLabelMut.mutate(l.id); }} className="text-red-500 hover:text-red-600" title="Hapus label"><Trash2 className="h-3 w-3" /></button>
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Filter */}
            <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-3">
                <label className="text-xs font-medium text-muted-foreground">Dari<input type="date" value={since} max={until} onChange={(e) => setSince(e.target.value)} className="mt-1 block rounded-lg border bg-background px-2 py-1.5 text-sm" /></label>
                <label className="text-xs font-medium text-muted-foreground">Sampai<input type="date" value={until} min={since} max={dayjs().format("YYYY-MM-DD")} onChange={(e) => setUntil(e.target.value)} className="mt-1 block rounded-lg border bg-background px-2 py-1.5 text-sm" /></label>
                <label className="text-xs font-medium text-muted-foreground">Label
                    <select value={filterLabelId} onChange={(e) => setFilterLabelId(e.target.value)} className="mt-1 block rounded-lg border bg-background px-2 py-1.5 text-sm">
                        <option value="">Semua label</option>
                        {labels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                </label>
                {(accountsQ.data?.length ?? 0) > 0 && (
                    <label className="text-xs font-medium text-muted-foreground">Akun Iklan
                        <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="mt-1 block rounded-lg border bg-background px-2 py-1.5 text-sm">
                            <option value="">Default ({data?.account?.name ?? "auto"})</option>
                            {accountsQ.data!.map((a) => <option key={a.id} value={a.id}>{a.name} — {a.id}</option>)}
                        </select>
                    </label>
                )}
            </div>

            {err && (
                <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <div><b>Gagal memuat data iklan.</b> {String(err?.response?.data?.message || err?.message || err)}</div>
                </div>
            )}
            {overviewQ.isLoading && <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}
            {data && !data.account && !overviewQ.isLoading && <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">Tidak ada ad account yang bisa diakses token ini.</div>}

            {data?.account && (
                <>
                    {/* KPI cards */}
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                        <StatCard icon={Wallet} accent="text-rose-500" label="Belanja Iklan" value={fmtMoney(data.totals.spend, currency)} hint={`${dayjs(data.since).format("DD MMM")} – ${dayjs(data.until).format("DD MMM YYYY")}`} />
                        <StatCard icon={DollarSign} accent="text-emerald-500" label="Omzet (closing)" value={fmtMoney(data.totals.omzet, currency)} hint={`${fmtNum(data.totals.closings)} closing`} />
                        <StatCard icon={TrendingUp} accent="text-violet-500" label="ROAS" value={fmtX(data.totals.roas)} hint="target ≥ 4×" valueClass={roasTone(data.totals.roas)} />
                        <StatCard icon={MessageSquare} accent="text-sky-500" label="Chat Masuk" value={fmtNum(data.totals.results)} hint={`${fmtNum(data.totals.leadsCaptured)} lead CRM`} />
                        <StatCard icon={Percent} accent="text-amber-500" label="CTR rata-rata" value={fmtPct(data.totals.avgCtr)} hint="target ≥ 2%" valueClass={ctrTone(data.totals.avgCtr)} />
                    </div>

                    {/* Per Cabang (Imogiri vs Sewon) */}
                    {data.byBranch.length > 0 && (
                        <div className="rounded-xl border bg-card p-4">
                            <div className="text-sm font-semibold mb-2 flex items-center gap-1.5"><Building2 className="h-4 w-4" /> Per Cabang (dari CS penerima lead)</div>
                            <div className="overflow-x-auto"><table className="w-full text-sm">
                                <thead className="text-xs text-muted-foreground"><tr className="text-left">
                                    <th className="py-1.5 pr-3 font-medium">Cabang</th>
                                    <th className="py-1.5 px-3 font-medium text-right">Lead</th>
                                    <th className="py-1.5 px-3 font-medium text-right">Closing</th>
                                    <th className="py-1.5 px-3 font-medium text-right">Omzet</th>
                                </tr></thead>
                                <tbody>{data.byBranch.map((b) => (
                                    <tr key={b.branchId ?? "none"} className="border-t">
                                        <td className="py-1.5 pr-3 font-medium">{b.branchName}</td>
                                        <td className="py-1.5 px-3 text-right tabular-nums">{fmtNum(b.leadsCaptured)}</td>
                                        <td className="py-1.5 px-3 text-right tabular-nums font-semibold">{fmtNum(b.closings)}</td>
                                        <td className="py-1.5 px-3 text-right tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">{fmtMoney(b.omzet, currency)}</td>
                                    </tr>
                                ))}</tbody>
                            </table></div>
                            <p className="text-[11px] text-muted-foreground mt-1">Belanja tak dipisah per cabang karena 1 campaign menyebar ke beberapa CS lintas cabang. Cabang diambil dari CS/lead penerima.</p>
                        </div>
                    )}

                    {data.unattributedLeads > 0 && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                            {data.unattributedLeads} lead dari iklan belum terpetakan ke campaign di akun ini (iklan mungkin dari akun lain / sudah dihapus).
                        </div>
                    )}

                    {/* Tabel campaign */}
                    <div className="overflow-x-auto rounded-xl border bg-card">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50 text-xs text-muted-foreground"><tr className="text-left">
                                <th className="px-3 py-2 font-medium">Campaign</th>
                                <th className="px-3 py-2 font-medium">Label</th>
                                <th className="px-3 py-2 font-medium text-right" title="Profit produk → patokan CPR = profit×5%">Profit</th>
                                <th className="px-3 py-2 font-medium text-right">Belanja</th>
                                <th className="px-3 py-2 font-medium text-right">Klik/CTR</th>
                                <th className="px-3 py-2 font-medium text-right">Chat</th>
                                <th className="px-3 py-2 font-medium text-right" title="Cost Per Result (biaya/hasil)">CPR</th>
                                <th className="px-3 py-2 font-medium text-right">Omzet</th>
                                <th className="px-3 py-2 font-medium text-right">Closing</th>
                                <th className="px-3 py-2 font-medium text-right">ROAS</th>
                                <th className="px-3 py-2 font-medium text-center">Video</th>
                            </tr></thead>
                            <tbody>
                                {data.campaigns.length === 0 && <tr><td colSpan={COLS} className="px-3 py-6 text-center text-muted-foreground">Tidak ada campaign pada rentang/label ini.</td></tr>}
                                {data.campaigns.map((c: CampaignRow) => (
                                    <Fragment key={c.id}>
                                        <tr className="border-t hover:bg-accent/40">
                                            <td className="px-3 py-2">
                                                <div className="font-medium text-foreground flex items-center gap-1.5">
                                                    <span className={`inline-block h-1.5 w-1.5 rounded-full ${statusTone(c.effectiveStatus || c.status).includes("emerald") ? "bg-emerald-500" : "bg-amber-400"}`} />
                                                    {c.name}
                                                </div>
                                                {c.objective && <div className="text-[11px] text-muted-foreground">{c.objective}</div>}
                                            </td>
                                            <td className="px-3 py-2">
                                                <select value={c.labelId ?? ""} disabled={assignMut.isPending} onChange={(e) => assignMut.mutate({ campaignId: c.id, labelId: e.target.value ? Number(e.target.value) : null })} className="rounded-lg border bg-background px-2 py-1 text-xs max-w-[150px]">
                                                    <option value="">— tanpa —</option>
                                                    {labels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                                                </select>
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                <input type="number" defaultValue={c.productProfit ?? ""} placeholder="0" key={`${c.id}-${c.productProfit}`}
                                                    onBlur={(e) => { const v = e.target.value.trim(); const num = v ? Number(v) : null; if ((num ?? null) !== (c.productProfit ?? null)) profitMut.mutate({ campaignId: c.id, profit: num }); }}
                                                    className="w-24 rounded-lg border bg-background px-2 py-1 text-xs text-right tabular-nums" title="Profit produk (Rp). Patokan CPR = ini × 5%" />
                                                {c.cprTarget != null && <div className="text-[10px] text-muted-foreground mt-0.5">CPR ≤ {fmtMoney(c.cprTarget, currency)}</div>}
                                            </td>
                                            <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(c.spend, currency)}</td>
                                            <td className="px-3 py-2 text-right tabular-nums">{fmtNum(c.clicks)} <span className={ctrTone(c.ctr)}>({fmtPct(c.ctr)})</span></td>
                                            <td className="px-3 py-2 text-right tabular-nums">{fmtNum(c.results)}</td>
                                            <td className={`px-3 py-2 text-right tabular-nums font-semibold ${cprTone(c.costPerResult, c.cprTarget)}`}>{fmtMoney(c.costPerResult, currency)}</td>
                                            <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(c.omzet, currency)}</td>
                                            <td className="px-3 py-2 text-right tabular-nums font-semibold">{fmtNum(c.closings)}</td>
                                            <td className={`px-3 py-2 text-right tabular-nums font-semibold ${roasTone(c.roas)}`}>{fmtX(c.roas)}</td>
                                            <td className="px-3 py-2 text-center">
                                                <button onClick={() => setExpanded(expanded === c.id ? null : c.id)} className="inline-flex items-center gap-0.5 rounded-lg border px-2 py-1 text-xs hover:bg-accent" title="Rincian per iklan/video">
                                                    {expanded === c.id ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />} <Video className="h-3.5 w-3.5" />
                                                </button>
                                            </td>
                                        </tr>
                                        {expanded === c.id && <AdRowsExpand campaignId={c.id} since={data.since} until={data.until} currency={currency} colSpan={COLS} />}
                                    </Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-500" /> Hijau = memenuhi standar (CTR ≥2%, ROAS ≥4×, CPR ≤ profit×5%). Isi kolom Profit agar patokan CPR muncul. Klik ikon Video untuk lihat video mana yang paling menghasilkan closing.</p>
                </>
            )}
        </div>
    );
}
