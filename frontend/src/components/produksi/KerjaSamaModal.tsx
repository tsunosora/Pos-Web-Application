"use client";

import { useState } from "react";
import type { DesignerPublic } from "@/lib/api/designers";
import { CoOperatorPicker } from "./CoOperatorPicker";

/**
 * Modal konfirmasi penyelesaian pekerjaan + opsi "Kerja sama dengan …".
 * Muncul saat operator menandai job selesai (produksi: pindah ke KIRIM/SELESAI;
 * cetak: tombol Selesai). Bila operator menambah rekan, poin leaderboard dibagi
 * rata 1/N (primary + rekan). Kalau tanpa rekan → perilaku lama (100% ke operator).
 */
export function KerjaSamaModal({
    title, subtitle, designers, selfName, submitting, onConfirm, onCancel,
}: {
    title: string;
    subtitle?: string;
    designers: DesignerPublic[];
    selfName: string;
    submitting?: boolean;
    onConfirm: (coOperatorNames: string[]) => void;
    onCancel: () => void;
}) {
    const [coOperators, setCoOperators] = useState<string[]>([]);

    return (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onCancel}>
            <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="px-4 py-3 border-b border-gray-200 dark:border-slate-700">
                    <h3 className="font-bold text-gray-800 dark:text-slate-100">{title}</h3>
                    {subtitle && <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
                </div>

                <div className="p-4 overflow-y-auto flex-1">
                    <CoOperatorPicker
                        designers={designers}
                        selfName={selfName}
                        value={coOperators}
                        onChange={setCoOperators}
                    />
                </div>

                <div className="px-4 py-3 border-t border-gray-200 dark:border-slate-700 flex items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={submitting}
                        className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg disabled:opacity-50"
                    >
                        Batal
                    </button>
                    <button
                        type="button"
                        onClick={() => onConfirm(coOperators)}
                        disabled={submitting}
                        className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50"
                    >
                        {submitting ? "Menyimpan…" : "Selesaikan"}
                    </button>
                </div>
            </div>
        </div>
    );
}
