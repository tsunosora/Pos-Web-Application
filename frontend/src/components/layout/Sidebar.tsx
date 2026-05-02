"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
    LayoutDashboard,
    ShoppingCart,
    BarChart3,
    Package,
    Wallet,
    FileText,
    MapPin,
    Calculator,
    Settings,
    Banknote,
    Users,
    X,
    Store,
    ClipboardList,
    Printer,
    Truck,
    ClipboardEdit,
    TrendingDown,
    MousePointerClick,
    FileSignature,
    Building2,
    ChevronDown,
    ArrowLeftRight,
    History,
    Inbox,
    BookOpen,
} from "lucide-react";
import { useUIStore, SidebarSectionKey } from "@/store/ui-store";
import { useQuery } from "@tanstack/react-query";
import { getSettings } from "@/lib/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { getTransactionEditRequests } from "@/lib/api/transactions";
import { getPendingInvoiceCount } from "@/lib/api/sales-orders";
import { getBranchInboxUnread } from "@/lib/api/branch-inbox";
import { getBranchLedgerSummary } from "@/lib/api/branch-ledger";
import { getProductionStats } from "@/lib/api/production";
import { getPrintQueueStats } from "@/lib/api/print-queue";
import { useBranchStore } from "@/store/branch-store";
import type { LucideIcon } from "lucide-react";

// ── Tipe & data navigasi ─────────────────────────────────────────────────────
interface NavItem {
    name: string;
    href: string;
    icon: LucideIcon;
    badgeKey?: 'pendingInvoice' | 'pendingEdit' | 'branchInbox' | 'ledgerOutstanding' | 'productionReady' | 'printReady';
    managerOnly?: boolean;
}
interface NavSection {
    key: SidebarSectionKey;
    label: string;
    items: NavItem[];
}

const TOP_LINK: NavItem = { name: "Dashboard", href: "/", icon: LayoutDashboard };

const SECTIONS: NavSection[] = [
    {
        key: 'sales',
        label: 'Penjualan & Keuangan',
        items: [
            { name: "Kasir POS", href: "/pos", icon: ShoppingCart },
            { name: "Rekap Penjualan", href: "/reports/sales", icon: BarChart3 },
            { name: "Laporan Laba Kotor", href: "/reports/profit", icon: BarChart3 },
            { name: "Riwayat Tutup Shift", href: "/reports/shift-history", icon: History },
            { name: "DP / Piutang", href: "/transactions/dp", icon: Wallet },
            { name: "Cashflow Bisnis", href: "/cashflow", icon: Banknote },
        ],
    },
    {
        key: 'inventory',
        label: 'Inventori & Stok',
        items: [
            { name: "Manajemen Stok", href: "/inventory", icon: Package },
            { name: "Laporan Stok", href: "/reports/stock", icon: TrendingDown },
            { name: "Laporan Bahan Titipan", href: "/reports/inter-branch-usage", icon: ArrowLeftRight },
            { name: "Stok Opname", href: "/inventory/opname", icon: ClipboardList },
            { name: "Transfer Stok Cabang", href: "/inventory/transfer", icon: ArrowLeftRight },
            { name: "Data Supplier", href: "/inventory/suppliers", icon: Truck },
        ],
    },
    {
        key: 'production',
        label: 'Produksi & Cetak',
        items: [
            { name: "Titipan Masuk", href: "/titipan-masuk", icon: Inbox, badgeKey: 'branchInbox' },
            { name: "Titipan Keluar", href: "/titipan-keluar", icon: Inbox },
            { name: "Buku Titipan", href: "/branch-ledger", icon: BookOpen, badgeKey: 'ledgerOutstanding' },
            { name: "Antrian Produksi", href: "/produksi", icon: Printer, badgeKey: 'productionReady' },
            { name: "Antrian Cetak Paper", href: "/print-queue", icon: Printer, badgeKey: 'printReady' },
            { name: "Klik Mesin Cetak", href: "/click-counting", icon: MousePointerClick },
        ],
    },
    {
        key: 'customers',
        label: 'Pelanggan & Order',
        items: [
            { name: "Data Pelanggan", href: "/customers", icon: Users },
            { name: "Invoice & Penawaran", href: "/invoices", icon: FileText },
            { name: "Sales Order", href: "/sales-orders", icon: FileSignature, badgeKey: 'pendingInvoice' },
            { name: "Order Cabang", href: "/branch-orders", icon: Building2 },
            { name: "Permintaan Edit", href: "/transactions/edit-requests", icon: ClipboardEdit, badgeKey: 'pendingEdit', managerOnly: true },
        ],
    },
    {
        key: 'others',
        label: 'Analisa & Kalkulator',
        items: [
            { name: "Peta Cuan Lokasi", href: "/maps", icon: MapPin },
            { name: "Kalkulator HPP", href: "/reports/hpp", icon: Calculator },
        ],
    },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
function isItemActive(pathname: string, href: string): boolean {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(href + '/');
}

// ── Komponen ─────────────────────────────────────────────────────────────────
export function Sidebar() {
    const pathname = usePathname();
    const { isSidebarOpen, closeSidebar, collapsedSections, toggleSection } = useUIStore();
    const { isManager } = useCurrentUser();

    const { data: settings } = useQuery({
        queryKey: ['store-settings'],
        queryFn: getSettings,
        staleTime: 5 * 60 * 1000,
    });

    const { data: pendingEditRequests } = useQuery({
        queryKey: ['transaction-edit-requests', 'PENDING'],
        queryFn: () => getTransactionEditRequests('PENDING'),
        enabled: isManager,
        staleTime: 60_000,
        refetchInterval: 60_000,
    });
    const pendingEditCount = pendingEditRequests?.length ?? 0;

    const { data: pendingInvoiceData } = useQuery({
        queryKey: ['so-pending-invoice-count'],
        queryFn: getPendingInvoiceCount,
        staleTime: 30_000,
        refetchInterval: 30_000,
    });
    const pendingInvoiceCount = pendingInvoiceData?.count ?? 0;

    const { data: branchInboxData } = useQuery({
        queryKey: ['branch-inbox-unread'],
        queryFn: getBranchInboxUnread,
        // Naikkan ke 30s biar selaras dengan BranchInboxPopup. Share queryKey
        // dengan popup → cuma 1 fetch per interval, tidak duplikat.
        staleTime: 25_000,
        refetchInterval: 30_000,
        retry: false,
    });
    const branchInboxCount = branchInboxData?.count ?? 0;

    const { data: ledgerSummary } = useQuery({
        queryKey: ['branch-ledger-summary-sidebar'],
        queryFn: getBranchLedgerSummary,
        staleTime: 60_000,
        refetchInterval: 60_000,
        retry: false,
    });
    const ledgerOutstandingCount =
        ledgerSummary && ledgerSummary.mode === 'single'
            ? (ledgerSummary.outgoing.count + ledgerSummary.incoming.count > 0 ? 1 : 0)
            : 0;

    // Sidebar badge untuk Antrian Produksi & Antrian Cetak Paper —
    // tampilkan jumlah job SELESAI (siap diambil customer) di cabang aktif.
    // Resolve cabang: staff pakai user.branchId, owner pakai store.activeBranchId.
    const { branchId: userBranchId, isOwner } = useCurrentUser();
    const ownerActiveBranch = useBranchStore(s => s.activeBranchId);
    const sidebarBranchId = isOwner ? ownerActiveBranch : userBranchId;

    const { data: productionStats } = useQuery({
        queryKey: ['production-stats-sidebar', sidebarBranchId ?? 'all'],
        queryFn: () => getProductionStats(sidebarBranchId ?? undefined),
        staleTime: 30_000,
        refetchInterval: 30_000,
        retry: false,
        enabled: isOwner ? true : userBranchId != null,
    });
    const productionReadyCount = productionStats?.selesai ?? 0;

    const { data: printStats } = useQuery({
        queryKey: ['print-queue-stats-sidebar', sidebarBranchId ?? 'all'],
        queryFn: () => getPrintQueueStats(sidebarBranchId ?? undefined),
        staleTime: 30_000,
        refetchInterval: 30_000,
        retry: false,
        enabled: isOwner ? true : userBranchId != null,
    });
    const printReadyCount = printStats?.selesai ?? 0;

    const storeName = settings?.storeName || 'PosPro';
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const logoUrl = settings?.logoImageUrl ? `${API_URL}${settings.logoImageUrl}` : null;

    const handleLinkClick = () => {
        if (typeof window !== 'undefined' && window.innerWidth < 1024) closeSidebar();
    };

    function getBadge(item: NavItem): number {
        if (item.badgeKey === 'pendingInvoice') return pendingInvoiceCount;
        if (item.badgeKey === 'pendingEdit') return pendingEditCount;
        if (item.badgeKey === 'branchInbox') return branchInboxCount;
        if (item.badgeKey === 'ledgerOutstanding') return ledgerOutstandingCount;
        if (item.badgeKey === 'productionReady') return productionReadyCount;
        if (item.badgeKey === 'printReady') return printReadyCount;
        return 0;
    }

    function NavLink({ item }: { item: NavItem }) {
        const active = isItemActive(pathname, item.href);
        const badge = getBadge(item);
        return (
            <Link
                href={item.href}
                onClick={handleLinkClick}
                className={cn(
                    "group flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-all",
                    active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                        : "text-sidebar-foreground/85 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
                )}
                aria-current={active ? 'page' : undefined}
            >
                <item.icon
                    className={cn(
                        "mr-2.5 h-4.5 w-4.5 flex-shrink-0 transition-colors",
                        active ? "text-sidebar-accent-foreground" : "text-sidebar-foreground/60 group-hover:text-sidebar-accent-foreground",
                    )}
                    style={{ width: 18, height: 18 }}
                    aria-hidden="true"
                />
                <span className="truncate">{item.name}</span>
                {badge > 0 && (
                    <span className="ml-auto bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[20px] h-[18px] flex items-center justify-center px-1.5">
                        {badge > 99 ? '99+' : badge}
                    </span>
                )}
            </Link>
        );
    }

    return (
        <>
            {/* Mobile backdrop */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm lg:hidden"
                    onClick={closeSidebar}
                    aria-hidden="true"
                />
            )}

            {/* Sidebar shell */}
            <aside
                className={cn(
                    "fixed inset-y-0 left-0 z-50 flex h-full w-72 flex-col bg-sidebar text-sidebar-foreground",
                    "border-r border-sidebar-border shadow-xl lg:shadow-none",
                    "transition-transform duration-300 ease-in-out",
                    "lg:static lg:translate-x-0 lg:w-64",
                    isSidebarOpen ? "translate-x-0" : "-translate-x-full",
                )}
                aria-label="Navigasi utama"
            >
                {/* Brand header */}
                <div className="flex h-16 shrink-0 items-center justify-between gap-2 px-4 bg-sidebar-accent/30 border-b border-sidebar-border/60">
                    <Link
                        href="/"
                        onClick={handleLinkClick}
                        className="flex items-center gap-2.5 min-w-0 flex-1 group"
                    >
                        <div className="h-9 w-9 rounded-xl bg-sidebar-primary flex items-center justify-center shrink-0 overflow-hidden ring-1 ring-sidebar-border/40 group-hover:ring-sidebar-primary/40 transition">
                            {logoUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={logoUrl} alt="Logo Toko" className="h-full w-full object-cover" />
                            ) : (
                                <Store className="h-5 w-5 text-sidebar-primary-foreground" />
                            )}
                        </div>
                        <span className="text-base font-bold tracking-tight truncate" title={storeName}>
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

                {/* Nav scroll area */}
                <nav className="flex-1 overflow-y-auto px-3 py-4">
                    {/* Top-level: Dashboard */}
                    <div className="mb-3">
                        <NavLink item={TOP_LINK} />
                    </div>

                    {/* Sections */}
                    <div className="space-y-3">
                        {SECTIONS.map((section) => {
                            const visibleItems = section.items.filter(it => !it.managerOnly || isManager);
                            if (visibleItems.length === 0) return null;

                            const collapsed = collapsedSections[section.key];
                            // Auto-expand kalau ada item aktif di section ini
                            const hasActive = visibleItems.some(it => isItemActive(pathname, it.href));
                            const open = hasActive ? true : !collapsed;

                            return (
                                <div key={section.key}>
                                    <button
                                        type="button"
                                        onClick={() => toggleSection(section.key)}
                                        className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/55 hover:text-sidebar-foreground/80 transition-colors rounded-md"
                                        aria-expanded={open}
                                    >
                                        <span>{section.label}</span>
                                        <ChevronDown
                                            className={cn(
                                                "h-3.5 w-3.5 transition-transform duration-200",
                                                open ? "rotate-0" : "-rotate-90",
                                            )}
                                        />
                                    </button>
                                    {open && (
                                        <div className="mt-1 space-y-0.5">
                                            {visibleItems.map(item => (
                                                <NavLink key={item.href} item={item} />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </nav>

                {/* Footer: Settings */}
                <div className="shrink-0 border-t border-sidebar-border/60 p-3 bg-sidebar-accent/20">
                    <Link
                        href="/settings"
                        onClick={handleLinkClick}
                        className={cn(
                            "group flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                            isItemActive(pathname, '/settings')
                                ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                                : "text-sidebar-foreground/85 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                        )}
                    >
                        <Settings className="mr-2.5 h-[18px] w-[18px] text-sidebar-foreground/60 group-hover:text-sidebar-foreground transition-colors" />
                        Pengaturan
                    </Link>
                </div>
            </aside>
        </>
    );
}
