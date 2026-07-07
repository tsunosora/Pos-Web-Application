"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Pen } from "lucide-react";
import { UNASSIGNED_DESIGNER, type DesignerPipelineSummaryRow } from "@/lib/api/production";

/**
 * Panel ringkasan desainer di halaman Pipeline Produksi.
 * Menghitung desainer LANGSUNG dari isi pipeline: WIP (di DESIGN), sudah di-upload,
 * dan yang sudah lewat DESIGN = ACC & siap produksi. Snapshot board (bukan historis —
 * produktivitas berperiode ada di /leaderboard). Dipakai di /produksi/pipeline & /produksi/board.
 */
export function DesignerPipelinePanel({ rows }: { rows: DesignerPipelineSummaryRow[] }) {
    const [open, setOpen] = useState(true);
    const totalSiap = rows.reduce((s, r) => s + r.siapProduksi, 0);
    const totalWip = rows.reduce((s, r) => s + r.wip, 0);

    return (
        <section className="rounded-2xl border border-white/40 dark:border-white/10 bg-white/60 dark:bg-slate-900/50 backdrop-blur-xl shadow-sm">
            <button
                type="button"
                onClick={() => setOpen(v => !v)}
                className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left"
            >
                <div className="flex items-center gap-2 min-w-0">
                    <Pen className="h-4 w-4 text-indigo-500 shrink-0" />
                    <div className="min-w-0">
                        <h2 className="text-sm font-bold text-gray-800 dark:text-slate-100">Desainer di Pipeline</h2>
                        <p className="text-[11px] text-gray-500 dark:text-slate-400 truncate">
                            Dihitung dari isi pipeline · {totalSiap} siap produksi · {totalWip} WIP
                        </p>
                    </div>
                </div>
                {open ? <ChevronUp className="h-4 w-4 text-gray-400 shrink-0" /> : <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />}
            </button>

            {open && (
                <div className="px-4 pb-4">
                    {rows.length === 0 ? (
                        <p className="text-xs text-gray-400 py-3 text-center">Belum ada desain di pipeline.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-slate-500 text-left border-b border-gray-100 dark:border-slate-800">
                                        <th className="py-1.5 pr-2 font-medium">Desainer</th>
                                        <th className="py-1.5 px-2 font-medium text-center" title="Masih di stage Design">WIP</th>
                                        <th className="py-1.5 px-2 font-medium text-center" title="Sudah ada bukti desain di-upload">Upload</th>
                                        <th className="py-1.5 px-2 font-medium text-center" title="Sudah lewat Design = ACC & siap produksi">Siap Produksi</th>
                                        <th className="py-1.5 pl-2 font-medium text-center">Retur</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                                    {rows.map((r) => {
                                        const unassigned = r.name === UNASSIGNED_DESIGNER;
                                        return (
                                            <tr key={r.name} className={unassigned ? "text-gray-400 dark:text-slate-500" : "text-gray-700 dark:text-slate-200"}>
                                                <td className="py-1.5 pr-2 font-medium truncate max-w-[10rem]">
                                                    {unassigned ? <span className="italic">{r.name}</span> : r.name}
                                                </td>
                                                <td className="py-1.5 px-2 text-center tabular-nums">{r.wip || "—"}</td>
                                                <td className="py-1.5 px-2 text-center tabular-nums">{r.upload || "—"}</td>
                                                <td className="py-1.5 px-2 text-center tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                                                    {r.siapProduksi || "—"}
                                                </td>
                                                <td className="py-1.5 pl-2 text-center tabular-nums text-rose-500">{r.retur || "—"}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}
