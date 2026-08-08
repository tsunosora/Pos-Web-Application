"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, ArrowLeft, RefreshCw, Send } from "lucide-react";
import {
    listWaTemplates, createWaTemplate, deleteWaTemplate, submitWaTemplate, syncWaTemplates,
    listWaChannels, WA_TEMPLATE_STATUS_LABEL,
    type WaTemplate, type WaTemplateStatus, type TemplateBody,
} from "@/lib/api/whatsapp-cloud";
import { StatusBadge, type BadgeTone } from "@/components/ui/status-badge";
import { WhatsappGuideButton } from "@/components/whatsapp/WhatsappGuideButton";
import { TemplateVariableBuilder, detectVarCount } from "@/components/whatsapp/TemplateVariableBuilder";

const STATUS_TONE: Record<WaTemplateStatus, BadgeTone> = {
    DRAFT: "neutral", PENDING: "warning", APPROVED: "success", REJECTED: "danger", PAUSED: "info", DISABLED: "neutral",
};
const CATEGORIES = ["UTILITY", "MARKETING", "AUTHENTICATION"];
const EMPTY: TemplateBody = { name: "", language: "id", category: "UTILITY", bodyText: "", headerText: "", footerText: "", variableSample: [] };

// Draft template pembuka siap pakai (tinggal klik → isi form → Submit ke Meta).
// Ganti "Voliko Print" dengan nama tokomu bila berbeda sebelum Submit.
const PRESETS: Array<{ key: string; title: string; desc: string; body: TemplateBody; samples: string[]; labels: string[] }> = [
    {
        key: "sapaan_pembuka",
        title: "Pembuka polos",
        desc: 'Tanpa variabel — cocok untuk "Chat Baru" di inbox.',
        body: {
            name: "sapaan_pembuka", language: "id", category: "MARKETING", headerText: "",
            bodyText:
                "Halo, perkenalkan kami dari Voliko Print 🙏\n\n" +
                "Terima kasih atas ketertarikannya pada produk kami. Kami siap membantu kebutuhan cetak & desain Anda — mulai dari info produk, harga, hingga pemesanan.\n\n" +
                "Silakan balas pesan ini, tim kami akan langsung melayani. 😊",
            footerText: "Balas STOP untuk berhenti menerima pesan.", variableSample: [],
        },
        samples: [], labels: [],
    },
    {
        key: "sapaan_pembuka_nama",
        title: "Pembuka + nama",
        desc: "Personalisasi {{1}} = nama pelanggan — untuk Broadcast.",
        body: {
            name: "sapaan_pembuka_nama", language: "id", category: "MARKETING", headerText: "",
            bodyText:
                "Halo {{1}} 👋\n\n" +
                "Perkenalkan kami dari Voliko Print. Terima kasih atas ketertarikannya pada produk kami. Kami siap membantu kebutuhan cetak & desain Anda.\n\n" +
                "Silakan balas pesan ini untuk info produk, harga, atau pemesanan ya. 😊",
            footerText: "Balas STOP untuk berhenti menerima pesan.", variableSample: ["Budi"],
        },
        samples: ["Budi"], labels: ["Nama pelanggan"],
    },
];

function errMsg(e: unknown, fb: string) {
    return (e as { response?: { data?: { message?: string } } })?.response?.data?.message || fb;
}


export default function WhatsappTemplatesPage() {
    const qc = useQueryClient();
    const [form, setForm] = useState<TemplateBody>(EMPTY);
    const [varSamples, setVarSamples] = useState<string[]>([]);
    const [varLabels, setVarLabels] = useState<string[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [channelId, setChannelId] = useState<number | null>(null);
    const varCount = detectVarCount(form.bodyText);

    const { data: templates = [], isLoading } = useQuery({ queryKey: ["wa-templates"], queryFn: listWaTemplates });
    const { data: channels = [] } = useQuery({ queryKey: ["wa-channels"], queryFn: listWaChannels });

    const invalidate = () => qc.invalidateQueries({ queryKey: ["wa-templates"] });

    const createMut = useMutation({
        mutationFn: (data: TemplateBody) => createWaTemplate(data),
        onSuccess: () => { setForm(EMPTY); setVarSamples([]); setVarLabels([]); setShowForm(false); invalidate(); },
        onError: (e) => alert(errMsg(e, "Gagal membuat template")),
    });
    const deleteMut = useMutation({ mutationFn: deleteWaTemplate, onSuccess: invalidate, onError: (e) => alert(errMsg(e, "Gagal menghapus")) });
    const submitMut = useMutation({
        mutationFn: (id: number) => submitWaTemplate(id, channelId as number),
        onSuccess: invalidate,
        onError: (e) => alert(errMsg(e, "Gagal submit ke Meta")),
    });
    const syncMut = useMutation({
        mutationFn: () => syncWaTemplates(channelId as number),
        onSuccess: (r) => { invalidate(); alert(`Sinkron selesai: ${r.updated} template diperbarui dari ${r.fetched} di Meta.`); },
        onError: (e) => alert(errMsg(e, "Gagal sinkron")),
    });

    const submit = () => {
        const variableSample = Array.from({ length: varCount }, (_, i) => (varSamples[i] || "").trim());
        const variableLabels = Array.from({ length: varCount }, (_, i) => (varLabels[i] || "").trim());
        createMut.mutate({ ...form, variableSample, variableLabels });
    };

    // Isi form dari draft siap pakai lalu buka form untuk ditinjau/di-Submit.
    const applyPreset = (p: (typeof PRESETS)[number]) => {
        setForm({ ...p.body });
        setVarSamples([...p.samples]);
        setVarLabels([...p.labels]);
        setShowForm(true);
    };

    return (
        <div className="max-w-4xl mx-auto p-4 space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                    <Link href="/crm/whatsapp" className="p-1.5 rounded-lg hover:bg-muted"><ArrowLeft className="w-4 h-4" /></Link>
                    <h1 className="text-lg font-semibold">Template Pesan Meta</h1>
                    <WhatsappGuideButton />
                </div>
                <div className="flex items-center gap-2">
                    <select
                        value={channelId ?? ""}
                        onChange={(e) => setChannelId(e.target.value ? +e.target.value : null)}
                        className="text-sm rounded-lg bg-muted/60 px-2.5 py-1.5 outline-none"
                    >
                        <option value="">Pilih channel (WABA)…</option>
                        {channels.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                    <button
                        onClick={() => channelId ? syncMut.mutate() : alert("Pilih channel dulu")}
                        disabled={syncMut.isPending}
                        className="flex items-center gap-1 text-sm px-2.5 py-1.5 rounded-lg bg-muted hover:bg-muted/70 disabled:opacity-50"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${syncMut.isPending ? "animate-spin" : ""}`} /> Sinkron
                    </button>
                    <button onClick={() => setShowForm((s) => !s)} className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg bg-primary text-primary-foreground">
                        <Plus className="w-4 h-4" /> Buat
                    </button>
                </div>
            </div>

            <p className="text-sm opacity-60">
                Template harus <b>disetujui Meta</b> sebelum dipakai untuk balasan di luar 24 jam atau broadcast.
                Gunakan <code>{"{{1}}"}</code>, <code>{"{{2}}"}</code> sebagai variabel; isi contoh nilainya agar lolos review.
            </p>

            <div className="rounded-2xl border border-dashed border-border bg-card/40 p-3">
                <div className="text-sm font-medium mb-2">📝 Draft siap pakai</div>
                <div className="grid sm:grid-cols-2 gap-2">
                    {PRESETS.map((p) => (
                        <div key={p.key} className="rounded-xl border border-border bg-background/60 p-3 flex flex-col gap-1">
                            <div className="font-medium text-sm">{p.title}</div>
                            <div className="text-xs opacity-60">{p.desc}</div>
                            <div className="text-xs opacity-70 mt-1 whitespace-pre-wrap max-h-16 overflow-hidden">{p.body.bodyText}</div>
                            <button onClick={() => applyPreset(p)}
                                className="mt-2 self-start text-xs px-2.5 py-1 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600">
                                Pakai draft ini
                            </button>
                        </div>
                    ))}
                </div>
                <p className="text-[11px] opacity-50 mt-2">Ganti “Voliko Print” dengan nama tokomu bila berbeda sebelum Submit.</p>
            </div>

            {showForm && (
                <div className="rounded-2xl border border-border bg-card/60 p-4 grid sm:grid-cols-2 gap-3">
                    <label className="text-sm">Nama (huruf kecil/underscore)
                        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                            placeholder="followup_lead" className="mt-1 w-full rounded-lg bg-muted/60 px-3 py-2 outline-none" />
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                        <label className="text-sm">Bahasa
                            <input value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}
                                placeholder="id" className="mt-1 w-full rounded-lg bg-muted/60 px-3 py-2 outline-none" />
                        </label>
                        <label className="text-sm">Kategori
                            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                                className="mt-1 w-full rounded-lg bg-muted/60 px-3 py-2 outline-none">
                                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </label>
                    </div>
                    <label className="text-sm sm:col-span-2">Header (opsional)
                        <input value={form.headerText ?? ""} onChange={(e) => setForm({ ...form, headerText: e.target.value })}
                            className="mt-1 w-full rounded-lg bg-muted/60 px-3 py-2 outline-none" />
                    </label>
                    <label className="text-sm sm:col-span-2">Isi pesan (body)
                        <textarea value={form.bodyText} onChange={(e) => setForm({ ...form, bodyText: e.target.value })}
                            rows={3} placeholder="Halo {{1}}, pesanan {{2}} sudah siap diambil 🙏"
                            className="mt-1 w-full rounded-lg bg-muted/60 px-3 py-2 outline-none resize-none" />
                    </label>
                    <label className="text-sm">Footer (opsional)
                        <input value={form.footerText ?? ""} onChange={(e) => setForm({ ...form, footerText: e.target.value })}
                            className="mt-1 w-full rounded-lg bg-muted/60 px-3 py-2 outline-none" />
                    </label>
                    <div className="sm:col-span-2">
                        <TemplateVariableBuilder
                            body={form.bodyText}
                            onBody={(b) => setForm((f) => ({ ...f, bodyText: b }))}
                            labels={varLabels}
                            samples={varSamples}
                            setLabels={setVarLabels}
                            setSamples={setVarSamples}
                        />
                    </div>
                    <div className="sm:col-span-2 flex gap-2 justify-end">
                        <button onClick={() => { setShowForm(false); setForm(EMPTY); setVarSamples([]); setVarLabels([]); }} className="text-sm px-3 py-1.5 rounded-lg bg-muted">Batal</button>
                        <button onClick={submit} disabled={createMut.isPending} className="text-sm px-3 py-1.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-50">Simpan draf</button>
                    </div>
                </div>
            )}

            <div className="space-y-2">
                {isLoading && <p className="text-sm opacity-60">Memuat…</p>}
                {!isLoading && templates.length === 0 && <p className="text-sm opacity-60">Belum ada template.</p>}
                {templates.map((t: WaTemplate) => (
                    <div key={t.id} className="rounded-2xl border border-border bg-card/60 p-4">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-medium">{t.name}</span>
                                    <StatusBadge tone={STATUS_TONE[t.status]}>{WA_TEMPLATE_STATUS_LABEL[t.status]}</StatusBadge>
                                    <span className="text-xs opacity-50">{t.language} · {t.category}</span>
                                </div>
                                {t.headerText && <div className="text-xs font-semibold mt-2 opacity-80">{t.headerText}</div>}
                                <div className="text-sm mt-1 whitespace-pre-wrap opacity-90">{t.bodyText}</div>
                                {t.footerText && <div className="text-xs opacity-50 mt-1">{t.footerText}</div>}
                                {(() => {
                                    const labels = Array.isArray(t.variableLabels) ? (t.variableLabels as string[]) : [];
                                    const samples = Array.isArray(t.variableSample) ? (t.variableSample as string[]) : [];
                                    const count = Math.max(labels.length, samples.length);
                                    if (count === 0) return null;
                                    return (
                                        <div className="mt-2 rounded-lg bg-muted/40 px-2.5 py-1.5 text-xs space-y-0.5">
                                            <div className="opacity-60 font-medium">Variabel:</div>
                                            {Array.from({ length: count }, (_, i) => (
                                                <div key={i} className="flex gap-1.5">
                                                    <span className="font-mono opacity-70 shrink-0">{`{{${i + 1}}}`}</span>
                                                    <span className="opacity-90">{labels[i] || <span className="italic opacity-50">tanpa keterangan</span>}</span>
                                                    {samples[i] && <span className="opacity-50">— mis. {samples[i]}</span>}
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()}
                                {t.status === "REJECTED" && t.rejectedReason && (
                                    <div className="text-xs text-red-500 mt-2">Ditolak: {t.rejectedReason}</div>
                                )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                {(t.status === "DRAFT" || t.status === "REJECTED") && (
                                    <button
                                        onClick={() => channelId ? submitMut.mutate(t.id) : alert("Pilih channel (WABA) di atas dulu")}
                                        disabled={submitMut.isPending}
                                        className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50"
                                    >
                                        <Send className="w-3.5 h-3.5" /> Submit
                                    </button>
                                )}
                                <button
                                    onClick={() => { if (confirm(`Hapus template "${t.name}"?`)) deleteMut.mutate(t.id); }}
                                    className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-500"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
