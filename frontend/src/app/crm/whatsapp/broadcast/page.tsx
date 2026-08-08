"use client";

import { useMemo, useState, useEffect } from "react";
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
import { WhatsappGuideButton } from "@/components/whatsapp/WhatsappGuideButton";

// Field data pelanggan/lead yang bisa diisi OTOMATIS (broadcast ke kontak terdaftar).
const DATA_FIELDS: Array<{ key: string; label: string }> = [
    { key: "name", label: "Nama pelanggan" },
    { key: "phone", label: "Nomor HP" },
    { key: "address", label: "Alamat" },
    { key: "city", label: "Kota" },
];
// Peta keterangan variabel template → field DB, untuk auto-map saat pilih template.
const LABEL_TO_FIELD: Record<string, string> = {
    "Nama pelanggan": "name", "Nomor HP": "phone",
    "Alamat pelanggan": "address", "Alamat": "address", "Kota": "city",
};

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
    const [recipientMode, setRecipientMode] = useState<"segment" | "import">("segment");
    const [numbersText, setNumbersText] = useState("");
    const [csv, setCsv] = useState<{ headers: string[]; rows: string[][] } | null>(null);
    const [numberCol, setNumberCol] = useState(0);

    const { data: broadcasts = [] } = useQuery({ queryKey: ["wa-broadcasts"], queryFn: listWaBroadcasts, refetchInterval: 5000 });
    const { data: channels = [] } = useQuery({ queryKey: ["wa-channels"], queryFn: listWaChannels });
    const { data: templates = [] } = useQuery({
        queryKey: ["wa-templates-approved"], queryFn: listWaTemplates,
        select: (all: WaTemplate[]) => all.filter((t) => t.status === "APPROVED"),
    });

    const selectedTpl = useMemo(() => templates.find((t) => t.id === templateId), [templates, templateId]);
    const nVars = selectedTpl ? countVars(selectedTpl.bodyText) : 0;
    // Keterangan & contoh tiap variabel (dari template) → biar {{1}} tidak mentah.
    const varLabels = Array.isArray(selectedTpl?.variableLabels) ? (selectedTpl!.variableLabels as string[]) : [];
    const varSamples = Array.isArray(selectedTpl?.variableSample) ? (selectedTpl!.variableSample as string[]) : [];

    // Saat pilih template: isi OTOMATIS dari field data pelanggan bila keterangan cocok.
    useEffect(() => {
        if (!selectedTpl) return;
        setVarMap(Array.from({ length: nVars }, (_, i) => {
            const field = LABEL_TO_FIELD[(varLabels[i] || "").trim()];
            return field ? { source: "field" as const, field } : { source: "static" as const, value: "" };
        }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [templateId]);
    const segment = { onlyLinked, leadStatus: leadStatus || undefined };
    const parsedNumbers = numbersText.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
    // Nomor untuk impor: dari kolom nomor CSV bila ada, else dari textarea tempel.
    const csvNumbers = csv ? csv.rows.map((r) => (r[numberCol] ?? "").trim()).filter(Boolean) : [];
    const importNumbers = recipientMode === "import" ? (csv ? csvNumbers : parsedNumbers) : undefined;
    // Personalisasi aktif bila ada variabel yang dipetakan ke kolom CSV.
    const personalized = recipientMode === "import" && !!csv && varMap.some((m) => m?.source === "column");
    const builtRecipients = personalized && csv
        ? csv.rows
            .map((row) => ({
                number: (row[numberCol] ?? "").trim(),
                vars: Array.from({ length: nVars }, (_, i) => {
                    const m = varMap[i] || { source: "static", value: "" };
                    if (m.source === "column") return (row[m.columnIndex ?? 0] ?? "").trim();
                    if (m.source === "static") return m.value ?? "";
                    return "";
                }),
            }))
            .filter((r) => r.number)
        : undefined;

    const invalidate = () => qc.invalidateQueries({ queryKey: ["wa-broadcasts"] });

    const previewMut = useMutation({
        mutationFn: () => previewBroadcast(segment, importNumbers),
        onSuccess: (r) => setPreview(r.count),
    });
    const createMut = useMutation({
        mutationFn: () => createWaBroadcast({
            name, channelId: channelId as number, templateId: templateId as number,
            segment,
            ...(personalized ? { recipients: builtRecipients } : importNumbers?.length ? { numbers: importNumbers } : {}),
            variableMap: Array.from({ length: nVars }, (_, i) => varMap[i] || { source: "static", value: "" }),
            scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        }),
        onSuccess: () => { resetForm(); invalidate(); },
        onError: (e) => alert(errMsg(e, "Gagal membuat broadcast")),
    });

    // Parse CSV (deteksi header + kolom nomor otomatis) untuk impor & personalisasi.
    const onCsvFile = async (file: File | null) => {
        if (!file) return;
        const text = await file.text();
        const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        if (!lines.length) return;
        const parse = (line: string) => line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
        let rows = lines.map(parse);
        const digits = (s: string) => (s || "").replace(/\D/g, "").length;
        const firstHasNumber = rows[0].some((c) => digits(c) >= 8);
        let headers: string[];
        if (firstHasNumber) headers = rows[0].map((_, i) => `Kolom ${i + 1}`);
        else { headers = rows[0]; rows = rows.slice(1); }
        const width = Math.max(headers.length, ...rows.map((r) => r.length));
        headers = Array.from({ length: width }, (_, i) => headers[i] || `Kolom ${i + 1}`);
        rows = rows.map((r) => Array.from({ length: width }, (_, i) => r[i] ?? ""));
        let best = 0, bestScore = -1;
        for (let c = 0; c < width; c++) {
            const score = rows.reduce((n, r) => n + (digits(r[c]) >= 8 ? 1 : 0), 0);
            if (score > bestScore) { bestScore = score; best = c; }
        }
        setCsv({ headers, rows });
        setNumberCol(best);
        setNumbersText("");
        setPreview(null);
    };
    const actMut = useMutation({
        mutationFn: ({ id, act }: { id: number; act: "run" | "pause" | "resume" | "cancel" }) =>
            ({ run: runWaBroadcast, pause: pauseWaBroadcast, resume: resumeWaBroadcast, cancel: cancelWaBroadcast }[act])(id),
        onSuccess: invalidate,
        onError: (e) => alert(errMsg(e, "Aksi gagal")),
    });

    function resetForm() {
        setShowForm(false); setName(""); setChannelId(null); setTemplateId(null);
        setOnlyLinked(false); setLeadStatus(""); setScheduledAt(""); setVarMap([]); setPreview(null);
        setRecipientMode("segment"); setNumbersText(""); setCsv(null); setNumberCol(0);
    }
    const canCreate = name.trim() && channelId && templateId && (recipientMode === "segment" || (importNumbers?.length ?? 0) > 0);

    return (
        <div className="max-w-4xl mx-auto p-4 space-y-4">
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <Link href="/crm/whatsapp" className="p-1.5 rounded-lg hover:bg-muted"><ArrowLeft className="w-4 h-4" /></Link>
                    <h1 className="text-lg font-semibold">Broadcast WhatsApp</h1>
                    <WhatsappGuideButton />
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
                            <p className="text-[11px] opacity-60 -mt-1">
                                Variabel (<span className="font-mono">{"{{1}}"}</span>, <span className="font-mono">{"{{2}}"}</span>) &amp; artinya berasal dari <b>template</b>. Untuk <b>menambah/mengubah</b> variabel, edit teks template di{" "}
                                <Link href="/crm/whatsapp/templates" className="underline">halaman Template</Link> (tambah <span className="font-mono">{"{{n}}"}</span> di isi pesan + beri keterangan). Di sini Anda hanya <b>mengisi nilainya</b>.
                            </p>
                            {Array.from({ length: nVars }, (_, i) => {
                                const m = varMap[i] || { source: "static", value: "" };
                                return (
                                    <div key={i} className="rounded-lg bg-muted/30 p-2 space-y-1.5">
                                        <div className="text-xs">
                                            <span className="font-mono opacity-70">{`{{${i + 1}}}`}</span>{" "}
                                            <span className="font-medium">{varLabels[i] || "(tanpa keterangan di template)"}</span>
                                            {varSamples[i] && <span className="opacity-50"> · contoh: {varSamples[i]}</span>}
                                        </div>
                                        <div className="flex items-center gap-2">
                                        <select
                                            value={m.source === "column" ? `column:${m.columnIndex ?? 0}` : m.source === "field" ? `field:${m.field ?? "name"}` : m.source}
                                            onChange={(e) => {
                                                const v = e.target.value;
                                                const next = [...varMap];
                                                next[i] = v.startsWith("column:")
                                                    ? { source: "column", columnIndex: parseInt(v.slice(7), 10) }
                                                    : v.startsWith("field:")
                                                      ? { source: "field", field: v.slice(6) }
                                                      : { ...m, source: v as VariableMapItem["source"] };
                                                setVarMap(next);
                                            }}
                                            className="rounded-lg bg-muted/60 px-2 py-1.5 text-sm outline-none"
                                        >
                                            <option value="static">Teks tetap (isi manual)</option>
                                            <option value="profileName">Nama profil WA</option>
                                            {!csv && (
                                                <optgroup label="Otomatis dari data pelanggan">
                                                    {DATA_FIELDS.map((f) => <option key={f.key} value={`field:${f.key}`}>Data: {f.label}</option>)}
                                                </optgroup>
                                            )}
                                            {csv && csv.headers.map((h, ci) => (
                                                <option key={ci} value={`column:${ci}`}>Kolom CSV: {h}</option>
                                            ))}
                                        </select>
                                        {m.source === "static" && (
                                            <input value={m.value ?? ""} onChange={(e) => {
                                                const next = [...varMap]; next[i] = { ...m, value: e.target.value }; setVarMap(next);
                                            }} placeholder="nilai" className="flex-1 rounded-lg bg-muted/60 px-2 py-1.5 text-sm outline-none" />
                                        )}
                                        {m.source === "column" && csv && (
                                            <span className="text-xs opacity-50 flex-1 truncate">contoh: {csv.rows[0]?.[m.columnIndex ?? 0] || "—"}</span>
                                        )}
                                        {m.source === "field" && (
                                            <span className="text-xs text-emerald-600 flex-1 truncate">✓ otomatis dari data pelanggan ({DATA_FIELDS.find((f) => f.key === m.field)?.label || m.field})</span>
                                        )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Sumber penerima */}
                    <div className="space-y-2">
                        <div className="text-sm font-medium">Penerima</div>
                        <div className="flex gap-2">
                            <button type="button" onClick={() => { setRecipientMode("segment"); setPreview(null); }}
                                className={`text-xs px-3 py-1.5 rounded-lg ${recipientMode === "segment" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70"}`}>
                                Kontak terdaftar
                            </button>
                            <button type="button" onClick={() => { setRecipientMode("import"); setPreview(null); }}
                                className={`text-xs px-3 py-1.5 rounded-lg ${recipientMode === "import" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70"}`}>
                                Impor nomor (CSV / tempel)
                            </button>
                        </div>

                        {recipientMode === "segment" ? (
                            <div className="grid sm:grid-cols-2 gap-3 items-end">
                                <label className="text-sm flex items-center gap-2">
                                    <input type="checkbox" checked={onlyLinked} onChange={(e) => { setOnlyLinked(e.target.checked); setPreview(null); }} />
                                    Hanya kontak tertaut Lead/Pelanggan
                                </label>
                                <label className="text-sm">Filter status lead (opsional)
                                    <input value={leadStatus} onChange={(e) => { setLeadStatus(e.target.value); setPreview(null); }} placeholder="CLOSED_WON"
                                        className="mt-1 w-full rounded-lg bg-muted/60 px-3 py-2 outline-none" />
                                </label>
                            </div>
                        ) : csv ? (
                            <div className="rounded-lg border border-border p-3 space-y-2">
                                <div className="flex items-center justify-between gap-2 flex-wrap text-sm">
                                    <div className="flex items-center gap-2">
                                        <span className="opacity-70">Kolom nomor:</span>
                                        <select value={numberCol} onChange={(e) => { setNumberCol(Number(e.target.value)); setPreview(null); }}
                                            className="rounded-lg bg-muted/60 px-2 py-1 text-sm outline-none">
                                            {csv.headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                                        </select>
                                    </div>
                                    <button type="button" onClick={() => { setCsv(null); setPreview(null); }} className="text-xs px-2 py-1 rounded-lg bg-muted hover:bg-muted/70">Hapus CSV</button>
                                </div>
                                <div className="text-xs opacity-60">{csvNumbers.length} baris · pratinjau 3 pertama:</div>
                                <div className="overflow-x-auto">
                                    <table className="text-xs w-full">
                                        <thead><tr>{csv.headers.map((h, i) => <th key={i} className={`px-2 py-1 text-left ${i === numberCol ? "text-emerald-600 font-semibold" : "opacity-60"}`}>{h}{i === numberCol ? " (nomor)" : ""}</th>)}</tr></thead>
                                        <tbody>{csv.rows.slice(0, 3).map((r, ri) => <tr key={ri}>{r.map((c, ci) => <td key={ci} className="px-2 py-1 border-t border-border/50">{c}</td>)}</tr>)}</tbody>
                                    </table>
                                </div>
                                {personalized
                                    ? <div className="text-[11px] text-emerald-600">✓ Personalisasi aktif — variabel diisi dari kolom CSV per baris (petakan di atas: pilih “Kolom: …”).</div>
                                    : nVars > 0 && <div className="text-[11px] opacity-60">Untuk personalisasi, petakan variabel ke kolom CSV di bagian “Isi variabel”.</div>}
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <textarea value={numbersText} onChange={(e) => { setNumbersText(e.target.value); setPreview(null); }}
                                    rows={4} placeholder={"Tempel nomor (satu per baris atau pisah koma). Contoh:\n08123456789\n628123456780"}
                                    className="w-full rounded-lg bg-muted/60 px-3 py-2 text-sm outline-none resize-none font-mono" />
                                <div className="flex items-center gap-3 text-xs flex-wrap">
                                    <label className="px-2.5 py-1.5 rounded-lg bg-muted hover:bg-muted/70 cursor-pointer">
                                        Unggah CSV
                                        <input type="file" accept=".csv,.txt" className="hidden" onChange={(e) => onCsvFile(e.target.files?.[0] ?? null)} />
                                    </label>
                                    <span className="opacity-60">{parsedNumbers.length} nomor terdeteksi · otomatis dinormalkan (0→62), duplikat & tak valid dibuang saat kirim.</span>
                                </div>
                                <div className="text-[11px] opacity-50">CSV berkolom (mis. nama, nomor, tagihan) → bisa personalisasi variabel per baris.</div>
                            </div>
                        )}

                        <div className="grid sm:grid-cols-2 gap-3 items-end pt-1">
                            <label className="text-sm">Jadwalkan (opsional)
                                <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)}
                                    className="mt-1 w-full rounded-lg bg-muted/60 px-3 py-2 outline-none" />
                            </label>
                            <button onClick={() => previewMut.mutate()} className="flex items-center gap-1 text-sm px-3 py-2 rounded-lg bg-muted hover:bg-muted/70">
                                <Users className="w-4 h-4" /> Hitung penerima {preview != null && `→ ${preview}`}
                            </button>
                        </div>
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
