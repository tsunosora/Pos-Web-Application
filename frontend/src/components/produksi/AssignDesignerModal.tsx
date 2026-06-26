"use client";

import { useMemo, useState } from "react";
import type { DesignerPublic } from "@/lib/api/designers";

/**
 * Modal "Desain oleh siapa?" — muncul setelah operator/admin memilih file proof,
 * sebelum upload. Desainer yang dipilih dikreditkan ke ProductionJob.designerName
 * (leaderboard produksi). Dipakai di /produksi/board & /produksi/pipeline.
 */
export function AssignDesignerModal({
    designers, fileCount, defaultName, onPick, onCancel,
}: {
    designers: DesignerPublic[];
    fileCount: number;
    defaultName: string;
    onPick: (name: string) => void;   // "" = tanpa kredit
    onCancel: () => void;
}) {
    const [q, setQ] = useState("");
    const filtered = useMemo(() => {
        const s = q.trim().toLowerCase();
        if (!s) return designers;
        return designers.filter(d => d.name.toLowerCase().includes(s));
    }, [designers, q]);

    return (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onCancel}>
            <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="px-4 py-3 border-b border-gray-200 dark:border-slate-700">
                    <h3 className="font-bold text-gray-800 dark:text-slate-100">Desain oleh siapa?</h3>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                        {fileCount} gambar di-upload &amp; dikreditkan ke leaderboard desainer.
                    </p>
                </div>
                {designers.length > 6 && (
                    <div className="px-4 pt-3">
                        <input
                            value={q}
                            onChange={e => setQ(e.target.value)}
                            placeholder="Cari desainer…"
                            autoFocus
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        />
                    </div>
                )}
                <div className="p-3 overflow-y-auto flex-1 space-y-1.5">
                    {filtered.length === 0 ? (
                        <p className="text-center text-sm text-gray-400 dark:text-slate-500 py-6">Tidak ada desainer terdaftar.</p>
                    ) : filtered.map(d => (
                        <button
                            key={d.id}
                            onClick={() => onPick(d.name)}
                            className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                                d.name === defaultName
                                    ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300"
                                    : "border-gray-200 dark:border-slate-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 text-gray-700 dark:text-slate-200"
                            }`}
                        >
                            {d.name}
                            {d.name === defaultName && <span className="ml-2 text-[10px] text-indigo-500">· terakhir</span>}
                        </button>
                    ))}
                </div>
                <div className="px-4 py-3 border-t border-gray-200 dark:border-slate-700 flex items-center justify-between gap-2">
                    <button onClick={() => onPick("")} className="text-xs text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 underline">
                        Tanpa kredit
                    </button>
                    <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg">
                        Batal
                    </button>
                </div>
            </div>
        </div>
    );
}
