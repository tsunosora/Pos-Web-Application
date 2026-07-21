"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, ArrowLeft, Play, Pause, X, Send, Users } from "lucide-react";
import {
    listWaBroadcasts, createWaBroadcast, previewBroadcast,
    runWaBroadcast, pauseWaBroadcast, resumeWaBroadcast, cancelWaBroadcast,
    listWaChannels, listWaTemplates, WA_BROADCAST_STATUS_LABEL,
    type WaBroadcast, type WaBroadcastStatus, type VariableMapItem, type WaTemplate,
} from "@/lib/api/whatsapp-cloud";
import { StatusBadge, type BadgeTone } from "@/components/ui/status-badge";

const STATUS_TONE: Record<WaBroadcastStatus, BadgeTone> = {
    DRAFT: "neutral", SCHEDULED: "info", RUNNING: "warning", PAUSED: "info",
    COMPLETED: "success", FAILED: "danger", CANCELLED: "neutral",
};

function errMsg(e: unknown, fb: string) {
    return (e as { response?: { data?: { message?: string } } })?.response?.data?.message || fb;
}
function countVars(body: string): number {
    const idx = [...body.matchAll(/\{\{(\d+)\}\}/g)].map((m) => +m[1]);
    return idx.length ? Math.max(...idx) : 0;
}

export default function WhatsappBroadcastPage() {
    const qc = useQueryClient();
    const [showForm, setShowForm] = useState(false);
    const [name, setName] = useState("");
    const [channelId, setChannelId] = useState<number | null>(null);
    const [templateId, setTemplateId] = useState<number | null>(null);
    const [onlyLinked, setOnlyLinked] = useState(false);
    const [leadStatus, setLeadStatus] = useState("");
    const [scheduledAt, setScheduledAt] = useState("");
    const [varMap, setVarMap] = useState<VariableMapItem[]>([]);
    const [preview, setPreview] = useState<number | null>(null);

    const { data: broadcasts = [] } = useQuery({ queryKey: ["wa-broadcasts"], queryFn: listWaBroadcasts, refetchInterval: 5000 });
    const { data: channels = [] } = useQuery({ queryKey: ["wa-channels"], queryFn: listWaChannels });
    const { data: templates = [] } = useQuery({
        queryKey: ["wa-templates-approved"], queryFn: listWaTemplates,
        select: (all: WaTemplate[]) => all.filter((t) => t.status === "APPROVED"),
    });

    const selectedTpl = useMemo(() => templates.find((t) => t.id === templateId), [templates, templateId]);
    const nVars = selectedTpl ? countVars(selectedTpl.bodyText) : 0;
    const segment = { onlyLinked, leadStatus: leadStatus || undefined };

    const invalidate = () => qc.invalidateQueries({ queryKey: ["wa-broadcasts"] });

    const previewMut = useMutation({
        mutationFn: () => previewBroadcast(segment),
        onSuccess: (r) => setPreview(r.count),
    });
    const createMut = useMutation({
        mutationFn: () => createWaBroadcast({
            name, channelId: channelId as number, templateId: templateId as number,
            segment, variableMap: Array.from({ length: nVars }, (_, i) => varMap[i] || { source: "static", value: "" }),
            scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        }),
        onSuccess: () => { resetForm(); invalidate(); },
        onError: (e) => alert(errMsg(e, "Gagal membuat broadcast")),
    });
    const actMut = useMutation({
        mutationFn: ({ id, act }: { id: number; act: "run" | "pause" | "resume" | "cancel" }) =>
            ({ run: runWaBroadcast, pause: pauseWaBroadcast, resume: resumeWaBroadcast, cancel: cancelWaBroadcast }[act])(id),
        onSuccess: invalidate,
        onError: (e) => alert(errMsg(e, "Aksi gagal")),
    });

    function resetForm() {
        setShowForm(false); setName(""); setChannelId(null); setTemplateId(null);
        setOnlyLinked(false); setLeadStatus(""); setScheduledAt(""); setVarMap([]); setPreview(null);
    }
    const canCreate = name.trim() && channelId && templateId;

    return (
        <div className="max-w-4xl mx-auto p-4 space-y-4">
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <Link href="/crm/whatsapp" className="p-1.5 rounded-lg hover:bg-muted"><ArrowLeft className="w-4 h-4" /></Link>
                    <h1 className="text-lg font-semibold">Broadcast WhatsApp</h1>
                </div>
                <button onClick={() => setShowForm((s) => !s)} className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg bg-primary text-primary-foreground">
                    <Plus className="w-4 h-4" /> Buat broadcast
                </button>
            </div>

            <p className="text-sm opacity-60">
                Kirim <b>template disetujui</b> ke banyak kontak sekaligus. Kontak yang opt-out otomatis dilewati.
                Perlu template APPROVED — <Link href="/crm/whatsapp/templates" className="underline">kelola template</Link>.
            </p>

            {showForm && (
                <div className="rounded-2xl border border-border bg-card/60 p-4 space-y-3">
                    <div className="grid sm:grid-cols-2 gap-3">
                        <label className="text-sm">Nama kampanye
                            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Promo Agustus"
                                className="mt-1 w-full rounded-lg bg-muted/60 px-3 py-2 outline-none" />
                        </label>
                        <label className="text-sm">Channel (nomor)
                            <select value={channelId ?? ""} onChange={(e) => setChannelId(e.target.value ? +e.target.value : null)}
                                className="mt-1 w-full rounded-lg bg-muted/60 px-3 py-2 outline-none">
                                <option value="">Pilih…</option>
                                {channels.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                            </select>
                        </label>
                        <label className="text-sm sm:col-span-2">Template (APPROVED)
                            <select value={templateId ?? ""} onChange={(e) => { setTemplateId(e.target.value ? +e.target.value : null); setVarMap([]); }}
                                className="mt-1 w-full rounded-lg bg-muted/60 px-3 py-2 outline-none">
                                <option value="">Pilih…</option>
                                {templates.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.language})</option>)}
                            </select>
                        </label>
                    </div>

                    {selectedTpl && (
                        <div className="text-xs rounded-lg bg-muted/40 p-2 whitespace-pre-wrap opacity-80">{selectedTpl.bodyText}</div>
                    )}

                    {/* Mapping variabel */}
                    {nVars > 0 && (
                        <div className="space-y-2">
                            <div className="text-sm font-medium">Isi variabel</div>
                            {Array.from({ length: nVars }, (_, i) => {
                                const m = varMap[i] || { source: "static", value: "" };
                                return (
                                    <div key={i} className="flex items-center gap-2">
                                        <span className="text-xs w-10 opacity-60">{`{{${i + 1}}}`}</span>
                                        <select value={m.source} onChange={(e) => {
                                            const next = [...varMap]; next[i] = { ...m, source: e.target.value as VariableMapItem["source"] }; setVarMap(next);
                                        }} className="rounded-lg bg-muted/60 px-2 py-1.5 text-sm outline-none">
                                            <option value="static">Teks tetap</option>
                                            <option value="profileName">Nama kontak</option>
                                        </select>
                                        {m.source === "static" && (
                                            <input value={m.value ?? ""} onChange={(e) => {
                                                const next = [...varMap]; next[i] = { ...m, value: e.target.value }; setVarMap(next);
                                            }} placeholder="nilai" className="flex-1 rounded-lg bg-muted/60 px-2 py-1.5 text-sm outline-none" />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Segmen */}
                    <div className="grid sm:grid-cols-2 gap-3 items-end">
                        <label className="text-sm flex items-center gap-2">
                            <input type="checkbox" checked={onlyLinked} onChange={(e) => setOnlyLinked(e.target.checked)} />
                            Hanya kontak tertaut Lead/Pelanggan
                        </label>
                        <label className="text-sm">Filter status lead (opsional)
                            <input value={leadStatus} onChange={(e) => setLeadStatus(e.target.value)} placeholder="CLOSED_WON"
                                className="mt-1 w-full rounded-lg bg-muted/60 px-3 py-2 outline-none" />
                        </label>
                        <label className="text-sm">Jadwalkan (opsional)
                            <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)}
                                className="mt-1 w-full rounded-lg bg-muted/60 px-3 py-2 outline-none" />
                        </label>
                        <button onClick={() => previewMut.mutate()} className="flex items-center gap-1 text-sm px-3 py-2 rounded-lg bg-muted hover:bg-muted/70">
                            <Users className="w-4 h-4" /> Hitung penerima {preview != null && `→ ${preview}`}
                        </button>
                    </div>

                    <div className="flex gap-2 justify-end">
                        <button onClick={resetForm} className="text-sm px-3 py-1.5 rounded-lg bg-muted">Batal</button>
                        <button onClick={() => createMut.mutate()} disabled={!canCreate || createMut.isPending}
                            className="text-sm px-3 py-1.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-50">
                            {scheduledAt ? "Jadwalkan" : "Simpan draf"}
                        </button>
                    </div>
                </div>
            )}

            <div className="space-y-2">
                {broadcasts.length === 0 && <p className="text-sm opacity-60">Belum ada broadcast.</p>}
                {broadcasts.map((b: WaBroadcast) => {
                    const pct = b.totalCount ? Math.round(((b.sentCount + b.failedCount) / b.totalCount) * 100) : 0;
                    return (
                        <div key={b.id} className="rounded-2xl border border-border bg-card/60 p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-medium">{b.name}</span>
                                        <StatusBadge tone={STATUS_TONE[b.status]}>{WA_BROADCAST_STATUS_LABEL[b.status]}</StatusBadge>
                                    </div>
                                    <div className="text-xs opacity-60 mt-1">
                                        {b.template?.name} · {b.channel?.label} · {b.sentCount}/{b.totalCount} terkirim
                                        {b.failedCount > 0 && ` · ${b.failedCount} gagal`}
                                        {b.scheduledAt && ` · jadwal ${new Date(b.scheduledAt).toLocaleString("id-ID")}`}
                                    </div>
                                    <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden w-56 max-w-full">
                                        <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    {(b.status === "DRAFT" || b.status === "SCHEDULED") && (
                                        <button onClick={() => actMut.mutate({ id: b.id, act: "run" })} title="Jalankan" className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-emerald-500 text-white"><Send className="w-3.5 h-3.5" /> Kirim</button>
                                    )}
                                    {b.status === "RUNNING" && (
                                        <button onClick={() => actMut.mutate({ id: b.id, act: "pause" })} title="Jeda" className="p-1.5 rounded-lg bg-muted hover:bg-muted/70"><Pause className="w-4 h-4" /></button>
                                    )}
                                    {b.status === "PAUSED" && (
                                        <button onClick={() => actMut.mutate({ id: b.id, act: "resume" })} title="Lanjutkan" className="p-1.5 rounded-lg bg-muted hover:bg-muted/70"><Play className="w-4 h-4" /></button>
                                    )}
                                    {!["COMPLETED", "CANCELLED", "FAILED"].includes(b.status) && (
                                        <button onClick={() => { if (confirm("Batalkan broadcast?")) actMut.mutate({ id: b.id, act: "cancel" }); }} title="Batalkan" className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-500"><X className="w-4 h-4" /></button>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
