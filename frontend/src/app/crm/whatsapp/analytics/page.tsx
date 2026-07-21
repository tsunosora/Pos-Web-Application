"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MessageSquare, Send, CheckCheck, Users, UserPlus, Megaphone, TrendingUp } from "lucide-react";
import { getWaAnalytics, listWaChannels } from "@/lib/api/whatsapp-cloud";

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
