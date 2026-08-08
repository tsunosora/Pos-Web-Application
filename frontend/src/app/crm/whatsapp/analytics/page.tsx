"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MessageSquare, Send, CheckCheck, Users, UserPlus, Megaphone, TrendingUp, Wallet, Timer, Zap } from "lucide-react";
import { getWaAnalytics, getWaCsBenchmark, listWaChannels, type WaAnalytics, type WaCsBenchmark } from "@/lib/api/whatsapp-cloud";
import { WhatsappGuideButton } from "@/components/whatsapp/WhatsappGuideButton";

const PRESETS = [
    { label: "7 hari", days: 7 },
    { label: "30 hari", days: 30 },
    { label: "90 hari", days: 90 },
];

function pct(n: number, d: number) {
    return d > 0 ? Math.round((n / d) * 100) : 0;
}
function isoDaysAgo(days: number) {
    return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
}

const RATE_KEY = "wa_msg_rates_idr";
const DEFAULT_RATES: Record<"MARKETING" | "UTILITY" | "AUTHENTICATION", number> = { MARKETING: 660, UTILITY: 160, AUTHENTICATION: 460 };
const CAT_LABEL: Record<"MARKETING" | "UTILITY" | "AUTHENTICATION", string> = { MARKETING: "Marketing", UTILITY: "Utilitas", AUTHENTICATION: "Autentikasi" };
const CATS = ["MARKETING", "UTILITY", "AUTHENTICATION"] as const;

function CostSection({ cost }: { cost: WaAnalytics["cost"] }) {
    const [rates, setRates] = useState<Record<string, number>>(DEFAULT_RATES);
    useEffect(() => {
        try {
            const s = localStorage.getItem(RATE_KEY);
            if (s) setRates({ ...DEFAULT_RATES, ...JSON.parse(s) });
        } catch { /* ignore */ }
    }, []);
    const setRate = (cat: string, v: number) => {
        setRates((r) => {
            const n = { ...r, [cat]: isNaN(v) ? 0 : v };
            try { localStorage.setItem(RATE_KEY, JSON.stringify(n)); } catch { /* ignore */ }
            return n;
        });
    };
    const rp = (n: number) => "Rp" + Math.round(n).toLocaleString("id-ID");
    const total = CATS.reduce((sum, c) => sum + cost.billable[c] * (rates[c] || 0), 0);

    return (
        <div className="rounded-2xl border border-border bg-card/60 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium"><Wallet className="w-4 h-4" /> Estimasi biaya WhatsApp API</div>
            <p className="text-xs opacity-60">
                Model harga per-pesan Meta (sejak Jul 2025): pesan <b>template</b> ditagih per kategori; balasan <b>layanan</b> (dalam jendela 24 jam) gratis.
                Setel tarif per pesan sesuai negara/akun Anda (lihat WhatsApp Manager → Billing).
            </p>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-xs opacity-60 text-left">
                            <th className="py-1 font-normal">Kategori</th>
                            <th className="font-normal">Jumlah pesan</th>
                            <th className="font-normal">Tarif/pesan (Rp)</th>
                            <th className="font-normal text-right">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        {CATS.map((c) => (
                            <tr key={c} className="border-t border-border">
                                <td className="py-2">{CAT_LABEL[c]}</td>
                                <td>{cost.billable[c].toLocaleString("id-ID")}</td>
                                <td>
                                    <input type="number" min={0} value={rates[c] ?? 0} onChange={(e) => setRate(c, Number(e.target.value))}
                                        className="w-24 rounded-lg bg-muted/60 px-2 py-1 outline-none" />
                                </td>
                                <td className="text-right">{rp(cost.billable[c] * (rates[c] || 0))}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="border-t border-border font-semibold">
                            <td className="py-2">Total ({cost.totalBillable.toLocaleString("id-ID")} pesan)</td>
                            <td /><td />
                            <td className="text-right text-emerald-600">{rp(total)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            <div className="text-xs opacity-60">
                Pesan layanan gratis (session): {cost.freeService.toLocaleString("id-ID")}. Angka ini <b>estimasi</b> berdasarkan volume pesan × tarif yang Anda setel — biaya resmi tetap mengacu ke tagihan Meta.
            </div>
        </div>
    );
}

function fmtDur(sec: number): string {
    if (sec <= 0) return "0 dtk";
    if (sec < 60) return `${Math.round(sec)} dtk`;
    if (sec < 3600) { const m = Math.floor(sec / 60); const s = Math.round(sec % 60); return s ? `${m}m ${s}d` : `${m} mnt`; }
    const h = Math.floor(sec / 3600); const m = Math.round((sec % 3600) / 60); return `${h}j ${m}m`;
}

function CsBenchmarkSection({ from, channelId }: { from: string; channelId: number | null }) {
    const [sla, setSla] = useState(5);
    const { data, isLoading } = useQuery({
        queryKey: ["wa-cs-benchmark", from, channelId, sla],
        queryFn: () => getWaCsBenchmark({ from, channelId: channelId ?? undefined, slaMinutes: sla }),
    });
    return (
        <div className="rounded-2xl border border-border bg-card/60 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 text-sm font-medium"><Timer className="w-4 h-4" /> Kecepatan balas CS</div>
                <label className="text-xs opacity-70 flex items-center gap-1">
                    Target balas ≤
                    <input type="number" min={1} value={sla} onChange={(e) => setSla(Math.max(1, Number(e.target.value) || 1))} className="w-14 rounded-lg bg-muted/60 px-2 py-1 outline-none" /> menit
                </label>
            </div>
            <p className="text-xs opacity-60">
                First Response Time: waktu dari pesan masuk pelanggan sampai balasan <b>manusia</b> pertama. Dinilai ke agen yang mengirim balasan; auto-reply tak dihitung.
                Metrik <b>Desainer dipisah</b> agar CS tetap murni.
            </p>
            {isLoading ? (
                <p className="text-sm opacity-60">Memuat…</p>
            ) : !data || (data.agents?.length ?? 0) === 0 ? (
                <p className="text-sm opacity-60">Belum ada data balasan agen di periode ini.</p>
            ) : (() => {
                // Tahan banting terhadap bentuk lama (tanpa split) — hindari crash saat backend
                // belum ter-deploy versi baru: fallback ke `agents`/`overall`.
                const emptyOverall = { responses: 0, avgSec: 0, medianSec: 0 };
                const csAgents = data.csAgents ?? data.agents ?? [];
                const designerAgents = data.designerAgents ?? [];
                const overallCs = data.overall ?? emptyOverall;
                const overallDes = data.overallDesigner ?? emptyOverall;
                return (
                    <div className="space-y-4">
                        <BenchmarkTable title="CS" agents={csAgents} overall={overallCs} slaMinutes={data.slaMinutes} />
                        {designerAgents.length > 0 && (
                            <BenchmarkTable title="Desainer" agents={designerAgents} overall={overallDes} slaMinutes={data.slaMinutes} />
                        )}
                    </div>
                );
            })()}
        </div>
    );
}

function BenchmarkTable({ title, agents, overall, slaMinutes }: {
    title: string;
    agents: WaCsBenchmark["agents"];
    overall: WaCsBenchmark["overall"];
    slaMinutes: number;
}) {
    if (agents.length === 0) return null;
    return (
        <div className="space-y-1.5">
            <div className="text-xs font-medium opacity-80">{title}</div>
            <div className="text-xs opacity-70">
                Rata-rata: <b>{fmtDur(overall.avgSec)}</b> · median {fmtDur(overall.medianSec)} · {overall.responses} balasan
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-xs opacity-60 text-left">
                            <th className="py-1 font-normal">Agen</th>
                            <th className="font-normal">Balasan</th>
                            <th className="font-normal">Rata-rata</th>
                            <th className="font-normal">Median</th>
                            <th className="font-normal">Tercepat</th>
                            <th className="font-normal text-right">≤{slaMinutes}m</th>
                        </tr>
                    </thead>
                    <tbody>
                        {agents.map((a, i) => (
                            <tr key={a.userId} className="border-t border-border">
                                <td className="py-2"><span className="flex items-center gap-1.5">{i === 0 && <Zap className="w-3.5 h-3.5 text-amber-500" />}{a.name}</span></td>
                                <td>{a.responses}</td>
                                <td>{fmtDur(a.avgSec)}</td>
                                <td>{fmtDur(a.medianSec)}</td>
                                <td>{fmtDur(a.fastestSec)}</td>
                                <td className="text-right">
                                    <span className={a.withinSlaPct >= 80 ? "text-emerald-600" : a.withinSlaPct >= 50 ? "text-amber-600" : "text-red-500"}>{a.withinSlaPct}%</span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function Card({ icon: Icon, label, value, sub }: { icon: typeof MessageSquare; label: string; value: string | number; sub?: string }) {
    return (
        <div className="rounded-2xl border border-border bg-card/60 p-4">
            <div className="flex items-center gap-2 text-xs opacity-60"><Icon className="w-4 h-4" /> {label}</div>
            <div className="text-2xl font-semibold mt-1">{value}</div>
            {sub && <div className="text-xs opacity-60 mt-0.5">{sub}</div>}
        </div>
    );
}

export default function WhatsappAnalyticsPage() {
    const [days, setDays] = useState(30);
    const [channelId, setChannelId] = useState<number | null>(null);

    const { data: channels = [] } = useQuery({ queryKey: ["wa-channels"], queryFn: listWaChannels });
    const { data, isLoading } = useQuery({
        queryKey: ["wa-analytics", days, channelId],
        queryFn: () => getWaAnalytics({ from: isoDaysAgo(days), channelId: channelId ?? undefined }),
    });

    const maxSeries = useMemo(() => Math.max(1, ...(data?.series ?? []).map((p) => Math.max(p.inbound, p.outbound))), [data]);
    const s = data?.summary;

    return (
        <div className="max-w-5xl mx-auto p-4 space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                    <Link href="/crm/whatsapp" className="p-1.5 rounded-lg hover:bg-muted"><ArrowLeft className="w-4 h-4" /></Link>
                    <TrendingUp className="w-5 h-5 text-emerald-500" />
                    <h1 className="text-lg font-semibold">Analitik WhatsApp</h1>
                    <WhatsappGuideButton />
                </div>
                <div className="flex items-center gap-2">
                    <select value={channelId ?? ""} onChange={(e) => setChannelId(e.target.value ? +e.target.value : null)}
                        className="text-sm rounded-lg bg-muted/60 px-2.5 py-1.5 outline-none">
                        <option value="">Semua channel</option>
                        {channels.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                    <div className="flex rounded-lg bg-muted/60 overflow-hidden">
                        {PRESETS.map((p) => (
                            <button key={p.days} onClick={() => setDays(p.days)}
                                className={`text-xs px-3 py-1.5 ${days === p.days ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                                {p.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {isLoading || !s ? (
                <p className="text-sm opacity-60">Memuat…</p>
            ) : (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <Card icon={MessageSquare} label="Pesan masuk" value={s.messages.inbound} />
                        <Card icon={Send} label="Pesan keluar" value={s.messages.outbound} sub={`${s.messages.failed} gagal`} />
                        <Card icon={CheckCheck} label="Dibaca" value={`${pct(s.messages.read, s.messages.outbound)}%`} sub={`terkirim ${pct(s.messages.delivered, s.messages.outbound)}%`} />
                        <Card icon={MessageSquare} label="Percakapan baru" value={s.conversations.new} sub={`${s.conversations.open} terbuka`} />
                        <Card icon={Users} label="Total kontak" value={s.contacts.total} sub={`${s.contacts.optedOut} opt-out`} />
                        <Card icon={UserPlus} label="Lead dari WA" value={s.leadsFromWa} />
                        <Card icon={Megaphone} label="Broadcast" value={s.broadcasts.count} sub={`${s.broadcasts.sent} terkirim · ${s.broadcasts.failed} gagal`} />
                    </div>

                    {data?.cost && <CostSection cost={data.cost} />}

                    <CsBenchmarkSection from={isoDaysAgo(days)} channelId={channelId} />

                    <div className="rounded-2xl border border-border bg-card/60 p-4">
                        <div className="flex items-center justify-between mb-3">
                            <div className="text-sm font-medium">Lalu lintas pesan harian</div>
                            <div className="flex items-center gap-3 text-xs opacity-70">
                                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-sky-400 inline-block" /> masuk</span>
                                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" /> keluar</span>
                            </div>
                        </div>
                        <div className="flex items-end gap-0.5 h-40 overflow-x-auto">
                            {data.series.map((p) => (
                                <div key={p.date} className="flex-1 min-w-[6px] flex flex-col justify-end items-center gap-0.5 group relative" title={`${p.date}: ${p.inbound} masuk / ${p.outbound} keluar`}>
                                    <div className="w-full flex items-end gap-px h-36">
                                        <div className="flex-1 bg-sky-400/80 rounded-t" style={{ height: `${(p.inbound / maxSeries) * 100}%` }} />
                                        <div className="flex-1 bg-emerald-500/80 rounded-t" style={{ height: `${(p.outbound / maxSeries) * 100}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-between text-[10px] opacity-50 mt-1">
                            <span>{data.series[0]?.date}</span>
                            <span>{data.series[data.series.length - 1]?.date}</span>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
