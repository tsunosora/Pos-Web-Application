"use client";

import { Tag } from "lucide-react";

/**
 * Label pekerjaan/event (mis. "Event Gemoy") yang tampil di samping nama pelanggan.
 * Label BUKAN bagian nama pelanggan — dipisah supaya data pelanggan tidak menumpuk dan
 * hitungan pelanggan/repeat order di KPI benar.
 *
 * Default: satu baris, dipotong "…" bila panjang (teks lengkap di tooltip).
 * `wrap`: tampilkan utuh & boleh turun baris — untuk halaman detail.
 */
export function LabelChip({ label, wrap = false, className = "" }: { label?: string | null; wrap?: boolean; className?: string }) {
    const text = (label ?? "").trim();
    if (!text) return null;
    return (
        <span
            title={text}
            className={`inline-flex max-w-full items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 align-middle text-[10px] font-semibold leading-tight text-amber-700 dark:text-amber-300 ${className}`}
        >
            <Tag className="h-2.5 w-2.5 shrink-0" />
            <span className={wrap ? "whitespace-normal break-words" : "min-w-0 max-w-[14rem] truncate"}>{text}</span>
        </span>
    );
}
