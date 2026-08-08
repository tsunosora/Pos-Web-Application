"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, ArrowLeft, Bot } from "lucide-react";
import {
    listAutoReplies, createAutoReply, updateAutoReply, deleteAutoReply,
    listWaChannels, listWaTemplates, WA_TRIGGER_LABEL,
    type WaAutoReplyRule, type WaAutoReplyTrigger, type AutoReplyBody, type WaTemplate,
} from "@/lib/api/whatsapp-cloud";
import { StatusBadge } from "@/components/ui/status-badge";
import { WhatsappGuideButton } from "@/components/whatsapp/WhatsappGuideButton";

const TRIGGERS: WaAutoReplyTrigger[] = ["GREETING", "KEYWORD", "AWAY", "DEFAULT"];
const EMPTY: AutoReplyBody = { trigger: "GREETING", replyText: "", keywords: [], priority: 0, channelId: null };

function errMsg(e: unknown, fb: string) {
    return (e as { response?: { data?: { message?: string } } })?.response?.data?.message || fb;
}

export default function WhatsappAutoReplyPage() {
    const qc = useQueryClient();
    const [form, setForm] = useState<AutoReplyBody>(EMPTY);
    const [kw, setKw] = useState("");
    const [showForm, setShowForm] = useState(false);

    const { data: rules = [], isLoading } = useQuery({ queryKey: ["wa-auto-replies"], queryFn: listAutoReplies });
    const { data: channels = [] } = useQuery({ queryKey: ["wa-channels"], queryFn: listWaChannels });
    // Template APPROVED — hanya diambil TEKS-nya untuk mengisi balasan (bukan dikirim sbg template).
    const { data: templates = [] } = useQuery({
        queryKey: ["wa-templates-approved"], queryFn: listWaTemplates,
        select: (all: WaTemplate[]) => all.filter((t) => t.status === "APPROVED"),
    });

    const invalidate = () => qc.invalidateQueries({ queryKey: ["wa-auto-replies"] });
    const createMut = useMutation({
        mutationFn: (data: AutoReplyBody) => createAutoReply(data),
        onSuccess: () => { setForm(EMPTY); setKw(""); setShowForm(false); invalidate(); },
        onError: (e) => alert(errMsg(e, "Gagal menyimpan aturan")),
    });
    const toggleMut = useMutation({ mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) => updateAutoReply(id, { isActive }), onSuccess: invalidate });
    const deleteMut = useMutation({ mutationFn: deleteAutoReply, onSuccess: invalidate });

    const save = () => {
        const keywords = form.trigger === "KEYWORD" ? kw.split(",").map((s) => s.trim()).filter(Boolean) : undefined;
        createMut.mutate({ ...form, keywords });
    };
    const channelName = (id: number | null) => (id == null ? "Semua channel" : channels.find((c) => c.id === id)?.label || `#${id}`);

    return (
        <div className="max-w-3xl mx-auto p-4 space-y-4">
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <Link href="/crm/whatsapp" className="p-1.5 rounded-lg hover:bg-muted"><ArrowLeft className="w-4 h-4" /></Link>
                    <Bot className="w-5 h-5 text-emerald-500" />
                    <h1 className="text-lg font-semibold">Balasan Otomatis</h1>
                    <WhatsappGuideButton />
                </div>
                <button onClick={() => setShowForm((s) => !s)} className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg bg-primary text-primary-foreground">
                    <Plus className="w-4 h-4" /> Tambah aturan
                </button>
            </div>

            <p className="text-sm opacity-60">
                Balasan otomatis rule-based (tanpa AI). Dievaluasi saat pesan masuk (masih dalam 24 jam).
                Urutan: <b>kata kunci</b> → <b>salam</b> (chat baru) → <b>default/di-luar-jam</b>. Balasan otomatis
                dilewati bila agen manusia baru membalas &lt;30 menit. Pesan <b>STOP</b> otomatis meng-opt-out kontak.
            </p>

            {showForm && (
                <div className="rounded-2xl border border-border bg-card/60 p-4 space-y-3">
                    <div className="grid sm:grid-cols-2 gap-3">
                        <label className="text-sm">Pemicu
                            <select value={form.trigger} onChange={(e) => setForm({ ...form, trigger: e.target.value as WaAutoReplyTrigger })}
                                className="mt-1 w-full rounded-lg bg-muted/60 px-3 py-2 outline-none">
                                {TRIGGERS.map((t) => <option key={t} value={t}>{WA_TRIGGER_LABEL[t]}</option>)}
                            </select>
                        </label>
                        <label className="text-sm">Channel
                            <select value={form.channelId ?? ""} onChange={(e) => setForm({ ...form, channelId: e.target.value ? +e.target.value : null })}
                                className="mt-1 w-full rounded-lg bg-muted/60 px-3 py-2 outline-none">
                                <option value="">Semua channel</option>
                                {channels.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                            </select>
                        </label>
                    </div>
                    {form.trigger === "KEYWORD" && (
                        <label className="text-sm block">Kata kunci (pisah koma)
                            <input value={kw} onChange={(e) => setKw(e.target.value)} placeholder="harga, biaya, lokasi"
                                className="mt-1 w-full rounded-lg bg-muted/60 px-3 py-2 outline-none" />
                        </label>
                    )}
                    <label className="text-sm block">Teks balasan
                        {templates.length > 0 && (
                            <div className="mt-1 flex items-center gap-2">
                                <select
                                    value=""
                                    onChange={(e) => {
                                        const t = templates.find((x) => x.id === Number(e.target.value));
                                        if (t) setForm((f) => ({ ...f, replyText: t.bodyText }));
                                        e.target.value = "";
                                    }}
                                    className="text-xs rounded-lg bg-muted/60 px-2 py-1.5 outline-none max-w-[16rem]"
                                >
                                    <option value="">📄 Isi dari template…</option>
                                    {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                                <span className="text-[11px] opacity-50">menyalin teksnya saja</span>
                            </div>
                        )}
                        <textarea value={form.replyText} onChange={(e) => setForm({ ...form, replyText: e.target.value })}
                            rows={3} placeholder="Halo kak 🙏 terima kasih sudah menghubungi kami…"
                            className="mt-1 w-full rounded-lg bg-muted/60 px-3 py-2 outline-none resize-none" />
                        {/\{\{\s*\d+\s*\}\}/.test(form.replyText) && (
                            <span className="text-[11px] text-amber-500 block mt-1">
                                Ada variabel {"{{1}}"} dari template — balasan otomatis kirim teks apa adanya, ganti dengan teks biasa.
                            </span>
                        )}
                    </label>
                    <div className="flex items-center justify-between gap-2">
                        <label className="text-sm flex items-center gap-2">Prioritas
                            <input type="number" value={form.priority ?? 0} onChange={(e) => setForm({ ...form, priority: +e.target.value })}
                                className="w-20 rounded-lg bg-muted/60 px-2 py-1.5 outline-none" />
                        </label>
                        <div className="flex gap-2">
                            <button onClick={() => { setShowForm(false); setForm(EMPTY); setKw(""); }} className="text-sm px-3 py-1.5 rounded-lg bg-muted">Batal</button>
                            <button onClick={save} disabled={createMut.isPending || !form.replyText.trim()} className="text-sm px-3 py-1.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-50">Simpan</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="space-y-2">
                {isLoading && <p className="text-sm opacity-60">Memuat…</p>}
                {!isLoading && rules.length === 0 && <p className="text-sm opacity-60">Belum ada aturan.</p>}
                {rules.map((r: WaAutoReplyRule) => (
                    <div key={r.id} className="rounded-2xl border border-border bg-card/60 p-4 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <StatusBadge tone={r.isActive ? "success" : "neutral"}>{WA_TRIGGER_LABEL[r.trigger]}</StatusBadge>
                                <span className="text-xs opacity-50">{channelName(r.channelId)} · prioritas {r.priority}</span>
                            </div>
                            {r.trigger === "KEYWORD" && r.keywords?.length ? (
                                <div className="text-xs mt-1 opacity-70">kata kunci: {r.keywords.join(", ")}</div>
                            ) : null}
                            <div className="text-sm mt-1 whitespace-pre-wrap opacity-90">{r.replyText}</div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <button onClick={() => toggleMut.mutate({ id: r.id, isActive: !r.isActive })}
                                className="text-xs px-2.5 py-1.5 rounded-lg bg-muted hover:bg-muted/70">
                                {r.isActive ? "Nonaktifkan" : "Aktifkan"}
                            </button>
                            <button onClick={() => { if (confirm("Hapus aturan ini?")) deleteMut.mutate(r.id); }}
                                className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-500"><Trash2 className="w-4 h-4" /></button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
