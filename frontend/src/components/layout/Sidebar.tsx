"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Settings, Store, X, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useUIStore } from "@/store/ui-store";
import { useQuery } from "@tanstack/react-query";
import { getSettings } from "@/lib/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useNavBadges } from "@/hooks/useNavBadges";
import { SECTIONS, TOP_LINK, OWNER_LINK, DESIGNER_LINK, isItemActive, getActiveSection, firstItemHref, canSeeNavItem, type NavSection } from "./nav-config";

export function Sidebar() {
    const pathname = usePathname();
    const { isSidebarOpen, closeSidebar, sidebarCollapsed: collapsed, toggleSidebarCollapsed } = useUIStore();
    const { isManager, isOwner, isDesigner } = useCurrentUser();
    const { getSectionBadge, getBadge } = useNavBadges();

    const { data: settings } = useQuery({
        queryKey: ['store-settings'],
        queryFn: getSettings,
        staleTime: 5 * 60 * 1000,
    });

    const storeName = settings?.storeName || 'PosPro';
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const logoUrl = settings?.logoImageUrl ? `${API_URL}${settings.logoImageUrl}` : null;

    const activeSection = getActiveSection(pathname);
    const handleLinkClick = () => {
        if (typeof window !== 'undefined' && window.innerWidth < 1024) closeSidebar();
    };

    // Drawer mobile/tablet terbuka → kunci scroll body + tutup dengan tombol Esc.
    // Mencegah halaman di belakang backdrop ikut "digeser" saat menu terbuka.
    useEffect(() => {
        if (!isSidebarOpen) return;
        if (typeof window === 'undefined' || window.innerWidth >= 1024) return;
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeSidebar(); };
        window.addEventListener('keydown', onKey);
        return () => {
            document.body.style.overflow = prevOverflow;
            window.removeEventListener('keydown', onKey);
        };
    }, [isSidebarOpen, closeSidebar]);

    const visibleSections = SECTIONS.filter(s => s.items.some(it => canSeeNavItem(it, { isManager, isOwner })));

    // Class link nav — saat collapsed (lg+) jadi ikon terpusat.
    const navLinkCls = (active: boolean) =>
        cn(
            "group relative flex min-h-[44px] items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-1 focus-visible:ring-offset-sidebar",
            collapsed && "lg:justify-center lg:px-2",
            active
                ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-md ring-1 ring-sidebar-border/50"
                : "text-sidebar-foreground/85 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground hover:shadow-sm",
            !collapsed && !active && "hover:translate-x-0.5",
        );

    function CategoryLink({ section }: { section: NavSection }) {
        const active = activeSection?.key === section.key;
        const badge = getSectionBadge(section);
        return (
            <Link
                href={firstItemHref(section, isManager, isOwner)}
                onClick={handleLinkClick}
                title={section.label}
                className={navLinkCls(active)}
                aria-current={active ? 'page' : undefined}
            >
                <section.icon
                    className={cn(
                        "mr-2.5 h-[18px] w-[18px] shrink-0 transition-colors",
                        collapsed && "lg:mr-0",
                        active ? "text-sidebar-accent-foreground" : "text-sidebar-foreground/60 group-hover:text-sidebar-accent-foreground",
                    )}
                    aria-hidden="true"
                />
                <span className={cn("truncate", collapsed && "lg:hidden")}>{section.label}</span>
                {badge > 0 && (
                    <span
                        className={cn(
                            "h-2 w-2 rounded-full bg-red-500 ring-2 ring-sidebar/60",
                            collapsed ? "ml-auto lg:absolute lg:top-1.5 lg:right-1.5 lg:ml-0" : "ml-auto",
                        )}
                        title="Ada item perlu perhatian"
                    />
                )}
            </Link>
        );
    }

    return (
        <>
            {/* Mobile backdrop */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-background/85 backdrop-blur-3xl lg:hidden"
                    onClick={closeSidebar}
                    aria-hidden="true"
                />
            )}

            {/* Sidebar shell — kategori utama saja (sub-menu pindah ke header) */}
            <aside
                className={cn(
                    "fixed inset-y-0 left-0 z-50 flex h-full w-72 flex-col overflow-hidden bg-sidebar text-sidebar-foreground",
                    "border-r border-sidebar-border shadow-xl",
                    "transition-[transform,width] duration-300 ease-in-out",
                    "lg:static lg:translate-x-0",
                    collapsed ? "lg:w-[4.75rem]" : "lg:w-64",
                    // Desktop: panel kaca "mengambang" — frosted (blur+saturate) + tepi kaca
                    "lg:m-3 lg:h-[calc(100vh-1.5rem)] lg:rounded-3xl lg:border lg:border-white/15",
                    "lg:bg-sidebar/40 lg:backdrop-blur-2xl lg:backdrop-saturate-150",
                    "lg:shadow-[0_8px_40px_-8px_rgb(0_0_0/0.28),inset_0_1px_0_0_rgb(255_255_255/0.30)]",
                    isSidebarOpen ? "translate-x-0" : "-translate-x-full",
                )}
                aria-label="Navigasi utama"
            >
                {/* Brand header */}
                <div className={cn(
                    "flex h-16 shrink-0 items-center justify-between gap-2 px-4 bg-sidebar-accent/30 border-b border-sidebar-border/60",
                    collapsed && "lg:px-0 lg:justify-center",
                )}>
                    <Link
                        href="/"
                        onClick={handleLinkClick}
                        title={storeName}
                        className={cn("flex items-center gap-2.5 min-w-0 flex-1 group", collapsed && "lg:flex-none lg:justify-center")}
                    >
                        <div className="h-9 w-9 rounded-xl bg-sidebar-primary flex items-center justify-center shrink-0 overflow-hidden ring-1 ring-sidebar-border/40 group-hover:ring-sidebar-primary/40 transition">
                            {logoUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={logoUrl} alt="Logo Toko" className="h-full w-full object-cover" />
                            ) : (
                                <Store className="h-5 w-5 text-sidebar-primary-foreground" />
                            )}
                        </div>
                        <span className={cn("text-base font-bold tracking-tight truncate", collapsed && "lg:hidden")} title={storeName}>
                            {storeName}
                        </span>
                    </Link>

                    <button
                        type="button"
                        className="lg:hidden text-sidebar-foreground/70 hover:text-sidebar-foreground p-2 rounded-md hover:bg-sidebar-accent/50 shrink-0"
                        onClick={closeSidebar}
                        aria-label="Tutup menu"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Nav — Dashboard + kategori utama */}
                <nav className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-3 py-4 space-y-1">
                    <Link
                        href={TOP_LINK.href}
                        onClick={handleLinkClick}
                        title="Dashboard"
                        className={navLinkCls(isItemActive(pathname, '/'))}
                        aria-current={isItemActive(pathname, '/') ? 'page' : undefined}
                    >
                        <LayoutDashboard className={cn("mr-2.5 h-[18px] w-[18px] shrink-0", collapsed && "lg:mr-0", isItemActive(pathname, '/') ? "text-sidebar-accent-foreground" : "text-sidebar-foreground/60 group-hover:text-sidebar-accent-foreground")} />
                        <span className={cn("truncate", collapsed && "lg:hidden")}>Dashboard</span>
                    </Link>

                    {isOwner && (() => {
                        const OwnerIcon = OWNER_LINK.icon;
                        const active = isItemActive(pathname, OWNER_LINK.href);
                        return (
                            <Link
                                href={OWNER_LINK.href}
                                onClick={handleLinkClick}
                                title={OWNER_LINK.name}
                                className={navLinkCls(active)}
                                aria-current={active ? 'page' : undefined}
                            >
                                <OwnerIcon className={cn("mr-2.5 h-[18px] w-[18px] shrink-0", collapsed && "lg:mr-0", active ? "text-sidebar-accent-foreground" : "text-amber-500 group-hover:text-sidebar-accent-foreground")} />
                                <span className={cn("truncate", collapsed && "lg:hidden")}>{OWNER_LINK.name}</span>
                            </Link>
                        );
                    })()}

                    {(isDesigner || isManager) && (() => {
                        const DesignerIcon = DESIGNER_LINK.icon;
                        const active = isItemActive(pathname, DESIGNER_LINK.href);
                        return (
                            <Link
                                href={DESIGNER_LINK.href}
                                onClick={handleLinkClick}
                                title={DESIGNER_LINK.name}
                                className={navLinkCls(active)}
                                aria-current={active ? 'page' : undefined}
                            >
                                <DesignerIcon className={cn("mr-2.5 h-[18px] w-[18px] shrink-0", collapsed && "lg:mr-0", active ? "text-sidebar-accent-foreground" : "text-fuchsia-500 group-hover:text-sidebar-accent-foreground")} />
                                <span className={cn("truncate", collapsed && "lg:hidden")}>{DESIGNER_LINK.name}</span>
                            </Link>
                        );
                    })()}

                    <div className="my-2 h-px bg-sidebar-border/50" />

                    {visibleSections.map((section) => {
                        const isActiveSection = activeSection?.key === section.key;
                        const subItems = section.items.filter(it => canSeeNavItem(it, { isManager, isOwner }));
                        const subActiveHref = subItems
                            .filter(it => isItemActive(pathname, it.href))
                            .sort((a, b) => b.href.length - a.href.length)[0]?.href;
                        return (
                            <div key={section.key}>
                                <CategoryLink section={section} />
                                {/* Sub-item kategori aktif — hanya di drawer mobile;
                                    di desktop sub-menu tampil inline di header. */}
                                {isActiveSection && (
                                    <div className="md:hidden mt-0.5 ml-3.5 space-y-0.5 border-l border-sidebar-border/50 pl-2.5">
                                        {subItems.map((item) => {
                                            const active = item.href === subActiveHref;
                                            const badge = getBadge(item);
                                            return (
                                                <Link
                                                    key={item.href}
                                                    href={item.href}
                                                    onClick={handleLinkClick}
                                                    className={cn(
                                                        "group flex items-center rounded-lg px-2.5 py-2 text-[13px] font-medium transition-all",
                                                        active
                                                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                                                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                                                    )}
                                                    aria-current={active ? 'page' : undefined}
                                                >
                                                    <item.icon className="mr-2 h-4 w-4 shrink-0 opacity-70" />
                                                    <span className="truncate">{item.name}</span>
                                                    {badge > 0 && (
                                                        <span className="ml-auto inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                                                            {badge > 99 ? '99+' : badge}
                                                        </span>
                                                    )}
                                                </Link>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </nav>

                {/* Footer: tombol ciutkan (desktop) + Settings */}
                <div className="shrink-0 border-t border-sidebar-border/60 p-3 bg-sidebar-accent/20 space-y-1">
                    <button
                        type="button"
                        onClick={toggleSidebarCollapsed}
                        title={collapsed ? "Lebarkan menu" : "Ciutkan menu"}
                        className={cn(
                            "hidden lg:flex w-full items-center rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground/85 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground transition-all duration-200",
                            collapsed && "lg:justify-center lg:px-2",
                        )}
                    >
                        {collapsed
                            ? <PanelLeftOpen className="h-[18px] w-[18px] shrink-0 text-sidebar-foreground/60" />
                            : <PanelLeftClose className="mr-2.5 h-[18px] w-[18px] shrink-0 text-sidebar-foreground/60" />}
                        <span className={cn("truncate", collapsed && "lg:hidden")}>Ciutkan</span>
                    </button>

                    <Link
                        href="/settings"
                        onClick={handleLinkClick}
                        title="Pengaturan"
                        className={navLinkCls(isItemActive(pathname, '/settings'))}
                    >
                        <Settings className={cn("mr-2.5 h-[18px] w-[18px] shrink-0 text-sidebar-foreground/60 group-hover:text-sidebar-foreground transition-colors", collapsed && "lg:mr-0")} />
                        <span className={cn("truncate", collapsed && "lg:hidden")}>Pengaturan</span>
                    </Link>
                </div>
            </aside>
        </>
    );
}
