"use client";

import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, FileText, Loader2, Table2, X } from "lucide-react";
import {
    getLeadsExport, LEAD_SOURCE_LABEL,
    type LeadExportParams, type LeadLevel, type LeadSource, type LeadStatus,
} from "@/lib/api/crm";
import {
    EXPORT_STATUS_LABEL, buildLeadExportMeta, buildLeadExportTable,
    downloadLeadsCsv, downloadLeadsPdf, downloadLeadsXlsx,
} from "@/lib/lead-export";

type Preset = "" | "today" | "yesterday" | "this_week" | "this_month" | "last_month" | "3_months" | "1_year" | "custom";
type Format = "csv" | "xlsx" | "pdf";

const PRESET_LABEL: Record<Preset, string> = {
    "": "Semua waktu", today: "Hari ini", yesterday: "Kemarin", this_week: "Minggu ini", this_month: "Bulan ini",
    last_month: "Bulan lalu", "3_months": "3 bulan", "1_year": "1 tahun", custom: "Pilih tanggal",
};
const PIPELINE: LeadStatus[] = ["NEW", "FOLLOW_UP", "NEGOTIATION", "CLOSED_WON", "CLOSED_LOST", "INVALID"];
const LEVEL_TEXT: Record<string, string> = { HOT: "Hot", WARM: "Warm", COLD: "Cold" };
const FORMATS: { value: Format; label: string; hint: string; icon: typeof FileText }[] = [
    { value: "csv", label: "CSV", hint: "Pemisah titik koma", icon: Table2 },
    { value: "xlsx", label: "Excel", hint: "Paling rapi di Excel", icon: FileSpreadsheet },
    { value: "pdf", label: "PDF", hint: "Siap cetak / arsip", icon: FileText },
];

/** Rentang tanggal — sama persis dgn preset filter di halaman Leads. */
function presetRange(p: Preset, from: string, to: string): { from: string; to: string } | null {
    const now = dayjs();
    const fmt = (x: ReturnType<typeof dayjs>) => x.format("YYYY-MM-DD");
    switch (p) {
        case "today": return { from: fmt(now.startOf("day")), to: fmt(now) };
        case "yesterday": return { from: fmt(now.subtract(1, "day").startOf("day")), to: fmt(now.subtract(1, "day").endOf("day")) };
        case "this_week": return { from: fmt(now.startOf("week")), to: fmt(now) };
        case "this_month": return { from: fmt(now.startOf("month")), to: fmt(now) };
        case "last_month": return { from: fmt(now.subtract(1, "month").startOf("month")), to: fmt(now.subtract(1, "month").endOf("month")) };
        case "3_months": return { from: fmt(now.subtract(3, "month")), to: fmt(now) };
        case "1_year": return { from: fmt(now.subtract(1, "year")), to: fmt(now) };
        case "custom": return from || to ? { from, to } : null;
        default: return null;
    }
}

const errMsg = (e: unknown, fb: string) =>
    (e as { response?: { data?: { message?: string } } })?.response?.data?.message || fb;

export interface LeadExportInitial {
    status: LeadStatus | "ALL";
    datePreset: string;
    customDateFrom: string;
    customDateTo: string;
    source: string;
    level: string;
    assignedToId: number | "";
    search: string;
}

/**
 * Export data lead (pelanggan) utk arsip offline: CSV / Excel / PDF, filter periode (tanggal masuk atau
 * closing) + kolom pipeline, opsional ikut filter halaman. Awalnya mengikuti filter yang sedang aktif.
 */
export function LeadExportModal({ initial, users, onClose }: {
    initial: LeadExportInitial;
    users: { id: number; name: string | null }[];
    onClose: () => void;
}) {
    const [init] = useState(initial);
    const [format, setFormat] = useState<Format>("csv");
    const [preset, setPreset] = useState<Preset>((init.datePreset || "") as Preset);
    const [from, setFrom] = useState(init.customDateFrom || "");
    const [to, setTo] = useState(init.customDateTo || "");
    const [dateField, setDateField] = useState<"created" | "closed">("created");
    const [statuses, setStatuses] = useState<Set<LeadStatus>>(() => new Set(init.status === "ALL" ? [] : [init.status]));

    const pageFilterParts = useMemo(() => {
        const parts: string[] = [];
        if (init.source) parts.push(`sumber ${LEAD_SOURCE_LABEL[init.source as LeadSource] ?? init.source}`);
        if (init.level) parts.push(`level ${LEVEL_TEXT[init.level] ?? init.level}`);
        if (init.assignedToId) parts.push(`CS ${users.find((u) => u.id === init.assignedToId)?.name ?? `#${init.assignedToId}`}`);
        if (init.search) parts.push(`cari "${init.search}"`);
        return parts;
    }, [init, users]);
    const [usePageFilters, setUsePageFilters] = useState(pageFilterParts.length > 0);

    const range = presetRange(preset, from, to);
    const params: LeadExportParams = useMemo(() => ({
        statuses: statuses.size ? PIPELINE.filter((s) => statuses.has(s)) : undefined,
        dateFrom: range?.from || undefined,
        dateTo: range?.to || undefined,
        dateField,
        ...(usePageFilters
            ? {
                source: (init.source || undefined) as LeadSource | undefined,
                level: (init.level || undefined) as LeadLevel | undefined,
                assignedToId: init.assignedToId || undefined,
                search: init.search || undefined,
            }
            : {}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [statuses, range?.from, range?.to, dateField, usePageFilters, init]);
    const paramsKey = JSON.stringify(params);

    const [count, setCount] = useState<number | null>(null);
    const [counting, setCounting] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState<string | null>(null);

    // Pratinjau jumlah (debounce) setiap pilihan berubah.
    useEffect(() => {
        let cancelled = false;
        setCounting(true);
        setError(null);
        setDone(null);
        const t = setTimeout(() => {
            getLeadsExport(params, true)
                .then((r) => { if (!cancelled) setCount(r.total); })
                .catch((e) => { if (!cancelled) { setCount(null); setError(errMsg(e, "Gagal menghitung data lead.")); } })
                .finally(() => { if (!cancelled) setCounting(false); });
        }, 300);
        return () => { cancelled = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [paramsKey]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [busy, onClose]);

    const invalidCustom = preset === "custom" && !!from && !!to && from > to;
    const periodText = range
        ? `${range.from ? dayjs(range.from).format("DD/MM/YYYY") : "awal"} – ${range.to ? dayjs(range.to).format("DD/MM/YYYY") : "sekarang"}`
        : "Semua waktu";
    const statusText = statuses.size ? PIPELINE.filter((s) => statuses.has(s)).map((s) => EXPORT_STATUS_LABEL[s]).join(", ") : "Semua kolom";
    const formatLabel = FORMATS.find((f) => f.value === format)?.label ?? format;

    // Saat "semua" (kosong) diklik satu kolom → hanya kolom itu; semua dimatikan → kembali ke semua.
    const toggleStatus = (s: LeadStatus) => setStatuses((prev) => {
        if (prev.size === 0) return new Set([s]);
        const next = new Set(prev);
        if (next.has(s)) next.delete(s); else next.add(s);
        return next;
    });

    async function runExport() {
        setBusy(true);
        setError(null);
        setDone(null);
        try {
            const res = await getLeadsExport(params);
            const rows = res.rows ?? [];
            if (!rows.length) { setError("Tidak ada lead yang cocok dengan pilihan ini."); return; }
            const meta = buildLeadExportMeta(rows, {
                periodText,
                dateFieldText: dateField === "closed" ? "tanggal closing/lost" : "tanggal masuk",
                statusText,
                filterText: usePageFilters ? pageFilterParts.join(", ") : "",
            });
            const statusSlug = statuses.size
                ? PIPELINE.filter((s) => statuses.has(s)).map((s) => EXPORT_STATUS_LABEL[s].toLowerCase().replace(/\s+/g, "-")).join("+")
                : "semua-status";
            const periodSlug = range ? `${range.from || "awal"}_${range.to || "sekarang"}` : "semua-waktu";
            const base = `data-lead_${periodSlug}_${statusSlug}_${dayjs().format("YYYYMMDD-HHmm")}`;
            if (format === "pdf") {
                downloadLeadsPdf(rows, meta, `${base}.pdf`);
            } else {
                const table = buildLeadExportTable(rows);
                if (format === "xlsx") downloadLeadsXlsx(table, meta, `${base}.xlsx`);
                else downloadLeadsCsv(table, `${base}.csv`);
            }
            setDone(`${rows.length.toLocaleString("id-ID")} lead diekspor ke ${formatLabel}${res.truncated ? ` (dibatasi ${rows.length.toLocaleString("id-ID")} dari ${res.total.toLocaleString("id-ID")})` : ""}.`);
        } catch (e) {
            setError(errMsg(e, "Gagal export data lead."));
        } finally {
            setBusy(false);
        }
    }

    const chip = (on: boolean) =>
        `rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:bg-accent"}`;

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-background/25 backdrop-blur-md" onClick={() => !busy && onClose()}>
            <div role="dialog" aria-modal="true" aria-labelledby="lead-export-title" onClick={(e) => e.stopPropagation()}
                className="glass-strong w-full sm:max-w-lg rounded-t-2xl sm:rounded-xl border border-border shadow-lg overflow-hidden flex flex-col max-h-[90vh]">
                <div className="flex items-start gap-3 border-b border-border px-4 py-3">
                    <div className="mt-0.5 rounded-lg bg-indigo-500/10 p-2 text-indigo-600 dark:text-indigo-300"><Download className="h-4 w-4" /></div>
                    <div className="min-w-0 flex-1">
                        <h3 id="lead-export-title" className="font-semibold leading-tight">Export Data Lead</h3>
                        <p className="text-xs text-muted-foreground">Unduh data pelanggan untuk arsip offline</p>
                    </div>
                    <button type="button" onClick={onClose} disabled={busy} aria-label="Tutup" className="rounded-md p-1 text-muted-foreground hover:bg-muted disabled:opacity-40">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
                    <section>
                        <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Format file</p>
                        <div className="grid grid-cols-3 gap-2">
                            {FORMATS.map((f) => {
                                const on = format === f.value;
                                const Icon = f.icon;
                                return (
                                    <button key={f.value} type="button" onClick={() => setFormat(f.value)} aria-pressed={on}
                                        className={`rounded-xl border px-2.5 py-2 text-left transition-colors ${on ? "border-primary bg-primary/10 ring-1 ring-primary" : "border-border hover:bg-accent"}`}>
                                        <span className="flex items-center gap-1.5 text-sm font-semibold"><Icon className="h-4 w-4" />{f.label}</span>
                                        <span className="block text-[11px] text-muted-foreground">{f.hint}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </section>

                    <section className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground">Periode</p>
                        <div className="flex flex-wrap gap-1.5">
                            {(Object.keys(PRESET_LABEL) as Preset[]).map((p) => (
                                <button key={p || "semua"} type="button" onClick={() => setPreset(p)} aria-pressed={preset === p} className={chip(preset === p)}>
                                    {PRESET_LABEL[p]}
                                </button>
                            ))}
                        </div>
                        {preset === "custom" && (
                            <div className="grid grid-cols-2 gap-2">
                                <label className="text-xs text-muted-foreground">Dari
                                    <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
                                        className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground" />
                                </label>
                                <label className="text-xs text-muted-foreground">Sampai
                                    <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
                                        className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground" />
                                </label>
                            </div>
                        )}
                        {invalidCustom && <p className="text-xs text-destructive">Tanggal &quot;dari&quot; lebih besar dari &quot;sampai&quot;.</p>}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                            <label className="inline-flex items-center gap-1.5">
                                <input type="radio" name="lead-export-date" checked={dateField === "created"} onChange={() => setDateField("created")} className="accent-primary" />
                                Tanggal masuk lead
                            </label>
                            <label className="inline-flex items-center gap-1.5">
                                <input type="radio" name="lead-export-date" checked={dateField === "closed"} onChange={() => setDateField("closed")} className="accent-primary" />
                                Tanggal closing / lost
                            </label>
                        </div>
                    </section>

                    <section className="space-y-2">
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-muted-foreground">Kolom pipeline</p>
                            {statuses.size > 0 && (
                                <button type="button" onClick={() => setStatuses(new Set())} className="text-xs font-medium text-primary hover:underline">Pilih semua</button>
                            )}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {PIPELINE.map((s) => {
                                const on = statuses.size === 0 || statuses.has(s);
                                return (
                                    <button key={s} type="button" onClick={() => toggleStatus(s)} aria-pressed={statuses.has(s)} className={chip(on)}>
                                        {EXPORT_STATUS_LABEL[s]}
                                    </button>
                                );
                            })}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                            {statuses.size ? `Hanya: ${statusText}` : "Semua kolom pipeline ikut. Klik satu kolom untuk memilih kolom tertentu."}
                        </p>
                    </section>

                    {pageFilterParts.length > 0 && (
                        <label className="flex items-start gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                            <input type="checkbox" checked={usePageFilters} onChange={(e) => setUsePageFilters(e.target.checked)} className="mt-0.5 accent-primary" />
                            <span>
                                Ikutkan filter halaman
                                <span className="block text-xs text-muted-foreground">{pageFilterParts.join(" · ")}</span>
                            </span>
                        </label>
                    )}

                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                        {format === "pdf"
                            ? "PDF (A4 lanskap) berisi kolom inti: tanggal masuk, nama, HP, kota, sumber, status, level, kebutuhan & item, estimasi, CS, follow-up, closing/lost — plus ringkasan filter & total."
                            : "Berisi 31 kolom: identitas & kontak, sumber & iklan, status & level, kebutuhan, item pesanan & totalnya, CS, desainer, respons pertama, follow-up, closing & alasan lost, pelanggan & No. SO, aktivitas terakhir."}
                    </p>

                    {error && (
                        <p className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
                        </p>
                    )}
                    {done && (
                        <p className="flex items-start gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> {done}
                        </p>
                    )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3">
                    <span className="text-sm text-muted-foreground" aria-live="polite">
                        {counting
                            ? <span className="inline-flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Menghitung…</span>
                            : count != null ? <><b className="text-foreground">{count.toLocaleString("id-ID")}</b> lead akan diekspor</> : null}
                    </span>
                    <div className="ml-auto flex gap-2">
                        <button type="button" onClick={onClose} disabled={busy} className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent disabled:opacity-40">Tutup</button>
                        <button type="button" onClick={runExport} disabled={busy || counting || !count || invalidCustom}
                            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
                            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Export {formatLabel}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
