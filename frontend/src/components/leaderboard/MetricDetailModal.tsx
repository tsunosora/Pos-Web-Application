"use client";
import { useQuery } from "@tanstack/react-query";
import { X, Loader2 } from "lucide-react";
import {
    getKpiMetricDetail,
    type KpiDivision,
    type KpiMetricKey,
    type KpiDetailRow,
} from "@/lib/api/crm";

export interface MetricDetailModalProps {
    division: KpiDivision;
    metric: KpiMetricKey;
    metricId?: number;
    userId: number;
    personName: string;
    metricLabel: string; // label awal (fallback sebelum data datang)
    query: { period?: string; start?: string; end?: string; branchId?: string | number };
    onClose: () => void;
}

const fmtRp = (n: number) => "Rp" + Math.round(n).toLocaleString("id-ID");

export default function MetricDetailModal(p: MetricDetailModalProps) {
    const q = useQuery({
        queryKey: ["lb-detail", p.division, p.metric, p.metricId, p.userId, p.query],
        queryFn: () =>
            getKpiMetricDetail({
                division: p.division,
                metric: p.metric,
                metricId: p.metricId,
                userId: p.userId,
                ...p.query,
            }),
    });
    const d = q.data;
    const valueMode = d?.valueMode ?? "count";
    const fmtVal = (n: number) =>
        valueMode === "money"
            ? fmtRp(n)
            : valueMode === "percent"
              ? `${(n * 100).toFixed(0)}%`
              : String(Math.round(n));

    return (
        <div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={p.onClose}
        >
            <div
                className="w-full max-w-3xl max-h-[85vh] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-border px-5 py-3">
                    <div>
                        <h3 className="font-semibold">{d?.metricLabel ?? p.metricLabel}</h3>
                        <p className="text-xs text-muted-foreground">{p.personName}</p>
                    </div>
                    <button onClick={p.onClose} className="rounded-lg p-1.5 hover:bg-accent transition-colors">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="overflow-y-auto p-5">
                    {q.isLoading ? (
                        <div className="flex justify-center py-16">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : q.isError ? (
                        <p className="py-12 text-center text-sm text-red-600 dark:text-red-400">
                            Gagal memuat rincian. Coba lagi.
                        </p>
                    ) : !d || d.rows.length === 0 ? (
                        <p className="py-12 text-center text-sm text-muted-foreground">Tidak ada rincian untuk periode ini.</p>
                    ) : (
                        <>
                            {/* Ringkasan */}
                            <div className="mb-4 grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                                <Stat label="Jumlah" value={String(d.totals.rows)} />
                                {valueMode !== "count" && valueMode !== "pcs" && (
                                    <Stat label="Total" value={fmtVal(d.totals.value)} />
                                )}
                                {(valueMode === "pcs" || d.totals.pcs > 0) && (
                                    <Stat label="Total Pcs" value={String(d.totals.pcs)} />
                                )}
                            </div>

                            {/* Breakdown sumber */}
                            <SourceBreakdown rows={d.rows} />

                            {/* Tabel rincian */}
                            <div className="overflow-x-auto rounded-xl border border-border">
                                <table className="w-full text-sm min-w-[560px]">
                                    <thead className="bg-muted/50 text-xs text-muted-foreground">
                                        <tr>
                                            <th className="px-3 py-2 text-left font-medium">Nota / Lead</th>
                                            <th className="px-3 py-2 text-left font-medium">Pelanggan</th>
                                            <th className="px-3 py-2 text-left font-medium">Sumber</th>
                                            <th className="px-3 py-2 text-left font-medium">Status</th>
                                            <th className="px-3 py-2 text-right font-medium">
                                                {valueMode === "pcs" ? "Pcs" : "Nilai"}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {d.rows.map((r, i) => (
                                            <tr key={`${r.kind}-${r.refId}-${i}`} className="border-t border-border/60 hover:bg-accent/40 transition-colors">
                                                <td className="px-3 py-2 whitespace-nowrap">{r.invoiceNumber || `Lead #${r.refId}`}</td>
                                                <td className="px-3 py-2">
                                                    <div>{r.customerName || "—"}</div>
                                                    {r.customerPhone && (
                                                        <div className="text-xs text-muted-foreground">{r.customerPhone}</div>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2">
                                                    {r.sourceLabel}
                                                    {r.sourceDetail && r.sourceDetail !== r.sourceLabel && (
                                                        <span className="text-xs text-muted-foreground"> · {r.sourceDetail}</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2">
                                                    <StatusLabel status={r.status} />
                                                </td>
                                                <td className="px-3 py-2 text-right font-mono whitespace-nowrap">
                                                    {valueMode === "pcs" ? `${r.pcs} pcs` : fmtVal(r.value)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl border border-border bg-muted/30 px-3 py-2">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="font-semibold">{value}</div>
        </div>
    );
}

const STATUS_LABEL: Record<string, string> = {
    NEW: "Baru",
    FOLLOW_UP: "Follow-up",
    NEGOTIATION: "Negosiasi",
    CLOSED_WON: "Closing",
    CLOSED_LOST: "Lost",
    INVALID: "Invalid",
    PAID: "Lunas",
    PARTIAL: "DP",
    PENDING: "Belum bayar",
};

function StatusLabel({ status }: { status: string | null }) {
    if (!status) return <span className="text-muted-foreground">—</span>;
    return <span>{STATUS_LABEL[status] ?? status}</span>;
}

function SourceBreakdown({ rows }: { rows: KpiDetailRow[] }) {
    const map = new Map<string, number>();
    for (const r of rows) map.set(r.sourceLabel, (map.get(r.sourceLabel) || 0) + 1);
    const entries = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
    if (entries.length <= 1) return null;
    return (
        <div className="mb-4 flex flex-wrap gap-2">
            {entries.map(([s, c]) => (
                <span key={s} className="rounded-full bg-accent px-2.5 py-1 text-xs">
                    {s}: <b>{c}</b>
                </span>
            ))}
        </div>
    );
}
