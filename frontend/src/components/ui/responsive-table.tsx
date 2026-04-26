"use client";

import { cn } from "@/lib/utils";

/**
 * ResponsiveTable — wrapper tabel yang scroll horizontal di mobile.
 * Pakai sebagai pengganti `<div className="overflow-x-auto">…<table>…</table></div>`.
 *
 * Contoh:
 *   <ResponsiveTable>
 *     <table className="min-w-full">…</table>
 *   </ResponsiveTable>
 */
export function ResponsiveTable({
    children,
    className,
    bordered = true,
}: {
    children: React.ReactNode;
    className?: string;
    bordered?: boolean;
}) {
    return (
        <div
            className={cn(
                "relative w-full overflow-x-auto rounded-xl bg-card",
                bordered && "border border-border shadow-sm",
                className,
            )}
        >
            <div className="min-w-full inline-block align-middle">
                {children}
            </div>
        </div>
    );
}

/**
 * EmptyState — placeholder ketika tabel/list kosong.
 */
export function EmptyState({
    icon: Icon,
    title,
    description,
    action,
}: {
    icon?: React.ComponentType<{ className?: string }>;
    title: string;
    description?: string;
    action?: React.ReactNode;
}) {
    return (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            {Icon && (
                <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Icon className="h-7 w-7 text-muted-foreground/70" />
                </div>
            )}
            <h3 className="text-base font-semibold text-foreground">{title}</h3>
            {description && (
                <p className="mt-1 text-sm text-muted-foreground max-w-sm leading-relaxed">
                    {description}
                </p>
            )}
            {action && <div className="mt-4">{action}</div>}
        </div>
    );
}
