"use client";

import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

/**
 * Badge status terpusat — dark-mode aware.
 *
 * Tiap halaman punya enum status sendiri (SalesOrderStatus, BranchWOStatus, dll),
 * jadi alih-alih satu komponen enum-tunggal, kita sediakan peta "tone" semantik.
 * Halaman memetakan status → tone; kelasnya konsisten & terbaca di light + dark.
 *
 * Pola `bg-*-500/15 + text-*-700 dark:text-*-300` dipilih supaya badge tampil
 * sebagai tint transparan (bukan pill pastel terang yang jadi "pulau" di dark mode).
 */
export type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger" | "accent";

export const badgeToneClass: Record<BadgeTone, string> = {
    neutral: "bg-muted text-foreground border-border",
    info: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
    success: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    warning: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    danger: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
    accent: "bg-primary/15 text-foreground border-primary/30",
};

export function StatusBadge({
    tone = "neutral",
    icon: Icon,
    children,
    className,
}: {
    tone?: BadgeTone;
    icon?: LucideIcon;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
                badgeToneClass[tone],
                className,
            )}
        >
            {Icon && <Icon className="h-3 w-3 shrink-0" />}
            {children}
        </span>
    );
}
