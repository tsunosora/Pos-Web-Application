"use client";

import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export interface BreadcrumbItem {
    label: string;
    href?: string;
}

export interface PageHeaderProps {
    title: string;
    description?: string;
    icon?: LucideIcon;
    breadcrumbs?: BreadcrumbItem[];
    /** Action buttons di kanan (responsive: pindah ke bawah di mobile) */
    actions?: React.ReactNode;
    /** Class tambahan untuk container terluar */
    className?: string;
}

/**
 * PageHeader — header halaman yang konsisten di semua page.
 * Layout responsive: judul + actions berdampingan di desktop,
 * stack di mobile, dengan optional breadcrumb & icon.
 */
export function PageHeader({
    title,
    description,
    icon: Icon,
    breadcrumbs,
    actions,
    className,
}: PageHeaderProps) {
    return (
        <div className={cn("mb-5 sm:mb-6", className)}>
            {breadcrumbs && breadcrumbs.length > 0 && (
                <nav aria-label="Breadcrumb" className="mb-2 flex items-center gap-1 text-xs text-muted-foreground overflow-x-auto">
                    {breadcrumbs.map((bc, i) => (
                        <span key={i} className="flex items-center gap-1 whitespace-nowrap">
                            {i > 0 && <ChevronRight className="h-3 w-3 opacity-60" />}
                            {bc.href ? (
                                <Link href={bc.href} className="hover:text-foreground hover:underline transition-colors">
                                    {bc.label}
                                </Link>
                            ) : (
                                <span className="text-foreground/80">{bc.label}</span>
                            )}
                        </span>
                    ))}
                </nav>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3 min-w-0">
                    {Icon && (
                        <div className="hidden sm:flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
                            <Icon className="h-5 w-5" />
                        </div>
                    )}
                    <div className="min-w-0">
                        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate">
                            {title}
                        </h1>
                        {description && (
                            <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                                {description}
                            </p>
                        )}
                    </div>
                </div>

                {actions && (
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {actions}
                    </div>
                )}
            </div>
        </div>
    );
}
