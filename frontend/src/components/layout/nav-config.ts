import {
    LayoutDashboard, ShoppingCart, BarChart3, Package, Wallet, FileText, MapPin,
    Calculator, Banknote, Users, Store, ClipboardList, Printer, Truck, ClipboardEdit,
    TrendingDown, MousePointerClick, FileSignature, Building2, ArrowLeftRight, History,
    Inbox, BookOpen, Sparkles, MessageSquare, Workflow, Trophy, Award,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { SidebarSectionKey } from "@/store/ui-store";

export type NavBadgeKey =
    | 'pendingInvoice' | 'pendingEdit' | 'branchInbox' | 'ledgerOutstanding'
    | 'productionReady' | 'printReady' | 'crmLeadsNew' | 'crmFuPending';

export interface NavItem {
    name: string;
    href: string;
    icon: LucideIcon;
    badgeKey?: NavBadgeKey;
    managerOnly?: boolean;
}
export interface NavSection {
    key: SidebarSectionKey;
    label: string;
    icon: LucideIcon;      // ikon kategori untuk sidebar
    items: NavItem[];
}

export const TOP_LINK: NavItem = { name: "Dashboard", href: "/", icon: LayoutDashboard };

export const SECTIONS: NavSection[] = [
    {
        key: 'sales', label: 'Penjualan & Keuangan', icon: Wallet,
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
        key: 'inventory', label: 'Inventori & Stok', icon: Package,
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
        key: 'production', label: 'Produksi & Cetak', icon: Printer,
        items: [
            { name: "Titipan Masuk", href: "/titipan-masuk", icon: Inbox, badgeKey: 'branchInbox' },
            { name: "Titipan Keluar", href: "/titipan-keluar", icon: Inbox },
            { name: "Buku Titipan", href: "/branch-ledger", icon: BookOpen, badgeKey: 'ledgerOutstanding' },
            { name: "Antrian Produksi", href: "/produksi", icon: Printer, badgeKey: 'productionReady' },
            { name: "Pipeline Produksi", href: "/produksi/pipeline", icon: Workflow },
            { name: "Antrian Cetak Paper", href: "/print-queue", icon: Printer, badgeKey: 'printReady' },
            { name: "Klik Mesin Cetak", href: "/click-counting", icon: MousePointerClick },
        ],
    },
    {
        key: 'customers', label: 'Pelanggan & Order', icon: Users,
        items: [
            { name: "CRM Dashboard", href: "/crm", icon: BarChart3 },
            { name: "Data Pelanggan", href: "/customers", icon: Users },
            { name: "Leads CRM", href: "/crm/leads", icon: Sparkles, badgeKey: 'crmLeadsNew' },
            { name: "Tugas Follow-up", href: "/crm/follow-ups", icon: ClipboardList, badgeKey: 'crmFuPending' },
            { name: "Template Pesan", href: "/crm/templates", icon: MessageSquare },
            { name: "Invoice & Penawaran", href: "/invoices", icon: FileText },
            { name: "Sales Order", href: "/sales-orders", icon: FileSignature, badgeKey: 'pendingInvoice' },
            { name: "Order Cabang", href: "/branch-orders", icon: Building2 },
            { name: "Permintaan Edit", href: "/transactions/edit-requests", icon: ClipboardEdit, badgeKey: 'pendingEdit', managerOnly: true },
        ],
    },
    {
        key: 'landing', label: 'Landing Page', icon: Store,
        items: [
            { name: "Landing Page", href: "/landing-page", icon: Store },
            { name: "Artikel", href: "/articles", icon: FileText },
        ],
    },
    {
        key: 'others', label: 'Analisa & Kalkulator', icon: Calculator,
        items: [
            { name: "Peta Cuan Lokasi", href: "/maps", icon: MapPin },
            { name: "Kalkulator HPP", href: "/reports/hpp", icon: Calculator },
        ],
    },
    {
        key: 'team', label: 'Tim & Kinerja', icon: Trophy,
        items: [
            { name: "Leaderboard", href: "/leaderboard", icon: Award },
        ],
    },
];

export function isItemActive(pathname: string, href: string): boolean {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(href + '/');
}

/** Section yang memuat route saat ini (untuk highlight kategori & sub-nav header). */
export function getActiveSection(pathname: string): NavSection | undefined {
    return SECTIONS.find(s => s.items.some(it => isItemActive(pathname, it.href)));
}

/** Item pertama yang boleh diakses user (untuk tujuan klik kategori). */
export function firstItemHref(section: NavSection, isManager: boolean): string {
    const it = section.items.find(i => !i.managerOnly || isManager);
    return (it ?? section.items[0]).href;
}
