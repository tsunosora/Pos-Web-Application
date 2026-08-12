"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import {
    Megaphone, ArrowLeft, Loader2, Lock, RefreshCw, Wallet, MessageSquare,
    UserPlus, Target, AlertTriangle,
} from "lucide-react";
import { getAdsOverview, getAdAccounts, type CampaignRow } from "@/lib/api/meta-ads";
import { useCurrentUser } from "@/hooks/useCurrentUser";

function fmtMoney(n: number | null | undefined, currency: string | null): string {
    if (n == null) return "—";
    try {
        return new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency: currency || "IDR",
            maximumFractionDigits: 0,
        }).format(n);
    } catch {
        return `${currency || ""} ${Math.round(n).toLocaleString("id-ID")}`;
    }
}
const fmtNum = (n: number | null | undefined) => (n == null ? "—" : Number(n).toLocaleString("id-ID"));

const STATUS_TONE: Record<string, string> = {
    ACTIVE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    PAUSED: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
};
function statusTone(s: string | null): string {
    if (!s) return "bg-muted text-muted-foreground";
    return STATUS_TONE[s.toUpperCase()] || "bg-muted text-muted-foreground";
}

function StatCard({ icon: Icon, label, value, hint, accent }: {
    icon: any; label: string; value: string; hint?: string; accent?: string;
}) {
    return (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
                <Icon className={`h-4 w-4 ${accent || ""}`} /> {label}
            </div>
            <div className="mt-1.5 text-2xl font-bold text-foreground tabular-nums">{value}</div>
            {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
        </div>
    );
}

export default function OwnerAdsPage() {
    const { currentUser, isOwner } = useCurrentUser();
    const [since, setSince] = useState(dayjs().subtract(29, "day").format("YYYY-MM-DD"));
    const [until, setUntil] = useState(dayjs().format("YYYY-MM-DD"));
    const [accountId, setAccountId] = useState<string>("");

    const accountsQ = useQuery({
        queryKey: ["ads-accounts"],
        queryFn: getAdAccounts,
        enabled: isOwner,
        staleTime: 10 * 60 * 1000,
        retry: false,
    });

    const overviewQ = useQuery({
        queryKey: ["ads-overview", since, until, accountId],
        queryFn: () => getAdsOverview({ since, until, accountId: accountId || undefined }),
        enabled: isOwner,
        retry: false,
    });

    // Gate: masih memuat vs bukan owner.
    if (!currentUser) {
        return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
    }
    if (!isOwner) {
        return (
            <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-center">
                <Lock className="h-10 w-10 text-muted-foreground" />
                <p className="text-muted-foreground">Halaman ini khusus Owner.</p>
                <Link href="/" className="text-sm text-primary underline">Kembali ke Dashboard</Link>
            </div>
        );
    }

    const data = overviewQ.data;
    const currency = data?.currency ?? "IDR";
    const err = overviewQ.error as any;

    return (
        <div className="mx-auto max-w-[96rem] p-4 sm:p-6 space-y-5">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <Link href="/owner" className="rounded-lg border p-1.5 hover:bg-accent" title="Kembali ke Owner">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                    <Megaphone className="h-6 w-6 text-sky-500" />
                    <div>
                        <h1 className="text-lg font-bold leading-tight">Iklan Meta (Ads Management)</h1>
                        <p className="text-xs text-muted-foreground">Biaya iklan digabung dengan lead nyata di CRM → cost-per-lead riil</p>
                    </div>
                </div>
                <button
                    onClick={() => overviewQ.refetch()}
                    className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm hover:bg-accent"
                >
                    <RefreshCw className={`h-4 w-4 ${overviewQ.isFetching ? "animate-spin" : ""}`} /> Segarkan
                </button>
            </div>

            {/* Filter */}
            <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-3">
                <label className="text-xs font-medium text-muted-foreground">
                    Dari
                    <input type="date" value={since} max={until} onChange={(e) => setSince(e.target.value)}
                        className="mt-1 block rounded-lg border bg-background px-2 py-1.5 text-sm" />
                </label>
                <label className="text-xs font-medium text-muted-foreground">
                    Sampai
                    <input type="date" value={until} min={since} max={dayjs().format("YYYY-MM-DD")} onChange={(e) => setUntil(e.target.value)}
                        className="mt-1 block rounded-lg border bg-background px-2 py-1.5 text-sm" />
                </label>
                {(accountsQ.data?.length ?? 0) > 0 && (
                    <label className="text-xs font-medium text-muted-foreground">
                        Akun Iklan
                        <select value={accountId} onChange={(e) => setAccountId(e.target.value)}
                            className="mt-1 block rounded-lg border bg-background px-2 py-1.5 text-sm">
                            <option value="">Default ({data?.account?.name ?? "auto"})</option>
                            {accountsQ.data!.map((a) => (
                                <option key={a.id} value={a.id}>{a.name} — {a.id}</option>
                            ))}
                        </select>
                    </label>
                )}
                <div className="ml-auto text-[11px] text-muted-foreground self-center">
                    {data?.account ? <>Akun: <b>{data.account.name}</b> ({data.account.id})</> : null}
                </div>
            </div>

            {/* Error */}
            {err && (
                <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <div>
                        <b>Gagal memuat data iklan.</b> {String(err?.response?.data?.message || err?.message || err)}
                        <div className="text-xs mt-1 opacity-80">Pastikan token WA punya scope <code>ads_read</code> &amp; akun iklan sudah ditambahkan sebagai aset.</div>
                    </div>
                </div>
            )}

            {/* Loading */}
            {overviewQ.isLoading && (
                <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            )}

            {/* Kosong */}
            {data && !data.account && !overviewQ.isLoading && (
                <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
                    Tidak ada ad account yang bisa diakses token ini.
                </div>
            )}

            {/* Ringkasan + tabel */}
            {data?.account && (
                <>
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                        <StatCard icon={Wallet} accent="text-rose-500" label="Total Belanja Iklan"
                            value={fmtMoney(data.totals.spend, currency)}
                            hint={`${dayjs(data.since).format("DD MMM")} – ${dayjs(data.until).format("DD MMM YYYY")}`} />
                        <StatCard icon={MessageSquare} accent="text-sky-500" label="Hasil Meta (chat WA)"
                            value={fmtNum(data.totals.results)} hint="Percakapan WA dimulai (lapor Meta)" />
                        <StatCard icon={UserPlus} accent="text-emerald-500" label="Lead CRM dari Iklan"
                            value={fmtNum(data.totals.leadsCaptured)} hint="Terhitung dari data CRM Anda" />
                        <StatCard icon={Target} accent="text-violet-500" label="Biaya / Lead (riil)"
                            value={fmtMoney(data.totals.costPerLead, currency)} hint="Belanja ÷ lead CRM" />
                    </div>

                    {data.unattributedLeads > 0 && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                            {data.unattributedLeads} lead dari iklan belum terpetakan ke campaign di akun ini (iklan mungkin dari akun lain atau sudah dihapus).
                        </div>
                    )}

                    <div className="overflow-x-auto rounded-xl border bg-card">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50 text-xs text-muted-foreground">
                                <tr className="text-left">
                                    <th className="px-3 py-2 font-medium">Campaign</th>
                                    <th className="px-3 py-2 font-medium">Status</th>
                                    <th className="px-3 py-2 font-medium text-right">Belanja</th>
                                    <th className="px-3 py-2 font-medium text-right">Hasil Meta</th>
                                    <th className="px-3 py-2 font-medium text-right">Biaya/Hasil</th>
                                    <th className="px-3 py-2 font-medium text-right">Lead CRM</th>
                                    <th className="px-3 py-2 font-medium text-right">Biaya/Lead</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.campaigns.length === 0 && (
                                    <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">Tidak ada campaign pada rentang ini.</td></tr>
                                )}
                                {data.campaigns.map((c: CampaignRow) => (
                                    <tr key={c.id} className="border-t hover:bg-accent/40">
                                        <td className="px-3 py-2">
                                            <div className="font-medium text-foreground">{c.name}</div>
                                            {c.objective && <div className="text-[11px] text-muted-foreground">{c.objective}</div>}
                                        </td>
                                        <td className="px-3 py-2">
                                            <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${statusTone(c.effectiveStatus || c.status)}`}>
                                                {c.effectiveStatus || c.status || "—"}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(c.spend, currency)}</td>
                                        <td className="px-3 py-2 text-right tabular-nums">{fmtNum(c.results)}</td>
                                        <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(c.costPerResult, currency)}</td>
                                        <td className="px-3 py-2 text-right tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">{fmtNum(c.leadsCaptured)}</td>
                                        <td className="px-3 py-2 text-right tabular-nums font-semibold">{fmtMoney(c.costPerLead, currency)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                        "Hasil Meta" = laporan Meta (percakapan WA dimulai). "Lead CRM" = lead yang benar-benar tercatat di sistem Anda dari klik iklan (via adId). Selisih wajar karena beda definisi & jendela atribusi.
                    </p>
                </>
            )}
        </div>
    );
}
