"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { getActiveSection, isItemActive, canSeeNavItem } from "./nav-config";
import { useNavBadges } from "@/hooks/useNavBadges";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useUIStore } from "@/store/ui-store";

/**
 * Sub-navigasi kontekstual (item dari kategori aktif, mengikuti route).
 * - mode "inline": di dalam header. Jika muat → tampil; jika tidak muat (terpotong)
 *   → disembunyikan & SubNav pindah ke dock bawah (tanpa slide).
 * - mode "strip": dock kaca mengambang di bawah (mobile, atau saat header overflow).
 */
export function SubNav({ mode = "inline" }: { mode?: "inline" | "strip" }) {
    const pathname = usePathname();
    const { isManager, isOwner } = useCurrentUser();
    const { getBadge } = useNavBadges();
    const subnavOverflow = useUIStore((s) => s.subnavOverflow);
    const setSubnavOverflow = useUIStore((s) => s.setSubnavOverflow);
    const measureRef = useRef<HTMLDivElement>(null);

    const section = getActiveSection(pathname);

    // Ukur apakah pills muat di header (inline). Jika tidak → tandai overflow agar
    // SubNav pindah ke dock bawah. clientWidth 0 (header disembunyikan di mobile)
    // tidak dihitung overflow — dock mobile diatur lewat breakpoint.
    useEffect(() => {
        if (mode !== "inline") return;
        const el = measureRef.current;
        // Tidak ada SubNav inline (mis. halaman tanpa kategori) → reset flag.
        if (!el) { setSubnavOverflow(false); return; }
        const measure = () => {
            const overflow = el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1;
            setSubnavOverflow(overflow);
        };
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, [mode, pathname, setSubnavOverflow]);

    // Strip (mobile): tidak tampil saat tak ada kategori aktif.
    if (mode === "strip" && !section) return null;
    // Inline (desktop): tetap kirim spacer agar aksi kanan tetap di kanan.
    if (mode === "inline" && !section) return <div className="flex-1" />;

    const items = section!.items.filter(it => canSeeNavItem(it, { isManager, isOwner }));
    const activeHref = items
        .filter(it => isItemActive(pathname, it.href))
        .sort((a, b) => b.href.length - a.href.length)[0]?.href;

    // iconOnly=true (dock mobile): SEMUA item ikon seragam, aktif ditandai warna
    // saja (tanpa label) supaya tidak ada yang menggeser/menyembunyikan item.
    // iconOnly=false (header desktop): item aktif tampil ikon + label.
    const renderPills = (iconOnly: boolean) =>
        items.map((item) => {
            const active = item.href === activeHref;
            const badge = getBadge(item);
            const showLabel = active && !iconOnly;
            return (
                <Link
                    key={item.href}
                    href={item.href}
                    title={item.name}
                    className={cn(
                        "group relative inline-flex items-center justify-center shrink-0 rounded-lg text-xs font-medium transition-all duration-200",
                        showLabel
                            ? "gap-1.5 px-2.5 py-1.5 bg-primary text-primary-foreground shadow-sm"
                            : "h-8 w-8",
                        !showLabel && (active
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-foreground/70 hover:bg-muted/70 hover:text-foreground"),
                    )}
                    aria-current={active ? 'page' : undefined}
                >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {showLabel && <span className="whitespace-nowrap">{item.name}</span>}
                    {badge > 0 && (
                        showLabel ? (
                            <span className="ml-0.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                                {badge > 99 ? '99+' : badge}
                            </span>
                        ) : (
                            // Ikon-saja → badge jadi titik kecil di pojok.
                            <span className="absolute -top-0.5 -right-0.5 flex h-3.5 min-w-[0.875rem] items-center justify-center rounded-full bg-red-500 px-0.5 text-[8px] font-bold text-white ring-1 ring-background">
                                {badge > 9 ? '9+' : badge}
                            </span>
                        )
                    )}
                </Link>
            );
        });

    if (mode === "strip") {
        // Dock kaca mengambang di bawah layar. Tampil di mobile (selalu) dan di
        // desktop HANYA saat SubNav header overflow. Semua ikon seragam & terpusat.
        return (
            <div
                className={cn(
                    "fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-1 pointer-events-none print:hidden",
                    subnavOverflow ? "" : "md:hidden",
                )}
            >
                {/* Kotak kaca hanya selebar isi (max selebar layar), terpusat. */}
                <div className="pointer-events-auto max-w-full overflow-x-auto no-scrollbar rounded-2xl border border-border/40 bg-card/70 backdrop-blur-2xl backdrop-saturate-150 px-1.5 py-1.5 shadow-[0_12px_36px_-8px_rgb(0_0_0/0.45),inset_0_1px_0_0_rgb(255_255_255/0.22)]">
                    <div className="flex w-max items-center gap-0.5">
                        {renderPills(true)}
                    </div>
                </div>
            </div>
        );
    }
    // Inline (header): TANPA slide. Konten di-clip & diukur; jika tidak muat,
    // di-invisible-kan (tetap menempati lebar untuk pengukuran) sementara dock
    // bawah mengambil alih.
    return (
        <div ref={measureRef} className="flex flex-1 min-w-0 items-center overflow-hidden">
            <div className={cn("flex items-center gap-1", subnavOverflow && "invisible")}>
                {renderPills(false)}
            </div>
        </div>
    );
}
