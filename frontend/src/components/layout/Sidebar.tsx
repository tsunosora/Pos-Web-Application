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
} from "lucide-react";
import { useUIStore } from "@/store/ui-store";
import { useQuery } from "@tanstack/react-query";
import { getSettings } from "@/lib/api";

const navigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Kasir POS", href: "/pos", icon: ShoppingCart },
    { name: "Rekap Penjualan", href: "/reports/sales", icon: BarChart3 },
    { name: "Laporan Laba Kotor", href: "/reports/profit", icon: BarChart3 },
    { name: "Daftar DP / Piutang", href: "/transactions/dp", icon: Wallet },
    { name: "Manajemen Stok", href: "/inventory", icon: Package },
    { name: "Data Supplier", href: "/inventory/suppliers", icon: Truck },
    { name: "Stok Opname", href: "/inventory/opname", icon: ClipboardList },
    { name: "Antrian Produksi", href: "/produksi", icon: Printer },
    { name: "Cashflow Bisnis", href: "/cashflow", icon: Banknote },
    { name: "Data Pelanggan", href: "/customers", icon: Users },
    { name: "Invoice & Penawaran", href: "/invoices", icon: FileText },
    { name: "Peta Cuan Lokasi", href: "/maps", icon: MapPin },
    { name: "Kalkulator HPP", href: "/reports/hpp", icon: Calculator },
];

export function Sidebar() {
    const pathname = usePathname();
    const { isSidebarOpen, closeSidebar } = useUIStore();

    // Ambil nama dan logo toko dari settings
    const { data: settings } = useQuery({
        queryKey: ['store-settings'],
        queryFn: getSettings,
        staleTime: 5 * 60 * 1000,
    });

    const storeName = settings?.storeName || 'PosPro';
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const logoUrl = settings?.logoImageUrl ? `${API_URL}${settings.logoImageUrl}` : null;

    return (
        <>
            {/* Mobile backdrop */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
                    onClick={closeSidebar}
                />
            )}

            {/* Sidebar */}
            <div className={cn(
                "fixed inset-y-0 left-0 z-50 flex h-full w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-transform duration-300 ease-in-out lg:static lg:translate-x-0",
                isSidebarOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                {/* Header Sidebar — Logo & Nama Toko */}
                <div className="flex h-16 shrink-0 items-center justify-between px-4 bg-sidebar-accent/30 border-b border-sidebar-border/50">
                    <div className="flex items-center gap-2.5 min-w-0">
                        {/* Logo Toko */}
                        <div className="h-8 w-8 rounded-lg bg-sidebar-primary flex items-center justify-center shrink-0 overflow-hidden">
                            {logoUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={logoUrl} alt="Logo Toko" className="h-full w-full object-cover" />
                            ) : (
                                <Store className="h-5 w-5 text-sidebar-primary-foreground" />
                            )}
                        </div>
                        {/* Nama Toko */}
                        <span className="text-base font-bold text-sidebar-foreground tracking-tight truncate" title={storeName}>
                            {storeName}
                        </span>
                    </div>

                    {/* Close button untuk mobile */}
                    <button
                        className="lg:hidden text-sidebar-foreground/70 hover:text-sidebar-foreground p-1 rounded-md shrink-0"
                        onClick={closeSidebar}
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Navigation links */}
                <div className="flex flex-1 flex-col overflow-y-auto pt-5 pb-4">
                    <nav className="flex-1 space-y-1 px-3">
                        {navigation.map((item) => {
                            const isActive = pathname === item.href ||
                                (item.href !== '/' && pathname.startsWith(item.href + "/")) ||
                                (item.href !== '/' && pathname === item.href);
                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    onClick={() => {
                                        if (window.innerWidth < 1024) closeSidebar();
                                    }}
                                    className={cn(
                                        isActive
                                            ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                                            : "hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
                                        "group flex items-center rounded-md px-3 py-2.5 text-sm font-medium transition-all"
                                    )}
                                >
                                    <item.icon
                                        className={cn(
                                            isActive ? "text-sidebar-accent-foreground" : "text-sidebar-foreground/70 group-hover:text-sidebar-accent-foreground",
                                            "mr-3 h-5 w-5 flex-shrink-0 transition-colors"
                                        )}
                                        aria-hidden="true"
                                    />
                                    {item.name}
                                </Link>
                            );
                        })}
                    </nav>
                </div>

                {/* Footer Sidebar — Settings */}
                <div className="shrink-0 border-t border-sidebar-border p-4">
                    <Link
                        href="/settings"
                        onClick={() => { if (window.innerWidth < 1024) closeSidebar(); }}
                        className="group flex items-center rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-all"
                    >
                        <Settings className="mr-3 h-5 w-5 text-sidebar-foreground/70 group-hover:text-sidebar-foreground transition-colors" />
                        Pengaturan
                    </Link>
                </div>
            </div>
        </>
    );
}
