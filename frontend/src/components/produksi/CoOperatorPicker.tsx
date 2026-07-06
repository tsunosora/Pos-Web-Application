"use client";

import { useMemo, useState } from "react";
import type { DesignerPublic } from "@/lib/api/designers";

/**
 * Picker "Kerja sama dengan …" — inline multi-select nama rekan operator.
 * Dipakai di operator produksi & operator cetak saat menyelesaikan pekerjaan.
 * Bila >1 operator mengerjakan 1 project (mis. lintas shift), poin leaderboard
 * dibagi rata 1/N ke primary + tiap rekan yang dipilih di sini.
 *
 * `value` = daftar nama rekan (tanpa diri sendiri). Nama `selfName` di-exclude
 * dari daftar supaya operator tak memilih dirinya sendiri.
 */
export function CoOperatorPicker({
    designers, selfName, value, onChange,
}: {
    designers: DesignerPublic[];
    selfName: string;
    value: string[];
    onChange: (names: string[]) => void;
}) {
    const [q, setQ] = useState("");

    const options = useMemo(() => {
        const self = selfName.trim();
        const s = q.trim().toLowerCase();
        return designers
            .filter(d => d.name.trim() && d.name.trim() !== self)
            .filter(d => !s || d.name.toLowerCase().includes(s));
    }, [designers, selfName, q]);

    const toggle = (name: string) => {
        if (value.includes(name)) onChange(value.filter(n => n !== name));
        else onChange([...value, name]);
    };

    const shareCount = value.length + 1; // primary + rekan
    const sharePct = Math.round((100 / shareCount) * 10) / 10;

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-gray-700 dark:text-slate-200">
                    Kerja sama dengan <span className="font-normal text-gray-400 dark:text-slate-500">(opsional)</span>
                </label>
                {value.length > 0 && (
                    <span className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
                        poin dibagi {shareCount} · ~{sharePct}% / orang
                    </span>
                )}
            </div>

            {value.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {value.map(name => (
                        <button
                            key={name}
                            type="button"
                            onClick={() => toggle(name)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800"
                        >
                            {name}
                            <span className="text-indigo-400 dark:text-indigo-500">✕</span>
                        </button>
                    ))}
                </div>
            )}

            {designers.length > 6 && (
                <input
                    value={q}
                    onChange={e => setQ(e.target.value)}
                    placeholder="Cari nama rekan…"
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
            )}

            <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                {options.length === 0 ? (
                    <p className="text-xs text-gray-400 dark:text-slate-500 py-2">Tidak ada rekan lain.</p>
                ) : options.map(d => {
                    const active = value.includes(d.name);
                    return (
                        <button
                            key={d.id}
                            type="button"
                            onClick={() => toggle(d.name)}
                            className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                                active
                                    ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300"
                                    : "border-gray-200 dark:border-slate-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 text-gray-700 dark:text-slate-200"
                            }`}
                        >
                            {active && <span className="mr-1">✓</span>}
                            {d.name}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
