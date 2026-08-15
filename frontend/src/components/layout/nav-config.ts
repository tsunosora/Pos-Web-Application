import {
    LayoutDashboard, ShoppingCart, BarChart3, Package, Wallet, FileText, MapPin,
    Calculator, Banknote, Users, Store, ClipboardList, Printer, Truck, ClipboardEdit,
    TrendingDown, MousePointerClick, FileSignature, Building2, ArrowLeftRight, History,
    Inbox, BookOpen, Sparkles, MessageSquare, Workflow, Trophy, Award, Crown,
    MessageCircle, Settings, Megaphone, Bot, BellRing, CalendarClock, Palette, QrCode, Zap, ShoppingBag, Instagram, Lock,
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
    ownerOnly?: boolean;
}
export interface NavSection {
    key: SidebarSectionKey;
    label: string;
    icon: LucideIcon;      // ikon kategori untuk sidebar
    items: NavItem[];
}

export const TOP_LINK: NavItem = { name: "Dashboard", href: "/", icon: LayoutDashboard };
// Link mandiri (di luar section) — halaman owner full-screen, hanya tampil utk owner.
// Sengaja TIDAK dimasukkan ke section mana pun supaya tidak mengubah firstItemHref
// / sub-nav kategori yang sudah ada.
export const OWNER_LINK: NavItem = { name: "Dashboard Owner", href: "/owner", icon: Crown, ownerOnly: true };
// Link mandiri Studio Desain (halaman iframe full-screen /desainer). Tampil untuk
// role Designer (+ Owner/Admin/Manajer). Dirender terpisah di Sidebar (bukan section).
export const DESIGNER_LINK: NavItem = { name: "Studio Desain", href: "/desainer", icon: Palette };

export const SECTIONS: NavSection[] = [
    {
        key: 'sales', label: 'Penjualan & Keuangan', icon: Wallet,
        items: [
            { name: "Kasir POS", href: "/pos", icon: ShoppingCart },
            { name: "Rekap Penjualan", href: "/reports/sales", icon: BarChart3 },
            { name: "Laporan Laba Kotor", href: "/reports/profit", icon: BarChart3 },
            { name: "Tutup Buku Bulanan", href: "/reports/tutup-buku", icon: BookOpen, managerOnly: true },
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
        key: 'whatsapp', label: 'WhatsApp CRM', icon: MessageCircle,
        items: [
            { name: "Inbox Chat", href: "/crm/whatsapp", icon: Inbox },
            { name: "Inbox Sosial (IG/FB)", href: "/crm/social", icon: Instagram },
            { name: "Broadcast", href: "/crm/whatsapp/broadcast", icon: Megaphone },
            { name: "QR Chat", href: "/crm/whatsapp/qr", icon: QrCode },
            { name: "Pesan Cepat", href: "/crm/whatsapp/quick-replies", icon: Zap },
            { name: "Balasan Otomatis", href: "/crm/whatsapp/auto-reply", icon: Bot },
            { name: "Reminder POS", href: "/crm/whatsapp/reminders", icon: BellRing, managerOnly: true },
            { name: "Template Meta", href: "/crm/whatsapp/templates", icon: FileText },
            { name: "Katalog Produk", href: "/crm/whatsapp/catalog", icon: ShoppingBag, managerOnly: true },
            { name: "Analitik", href: "/crm/whatsapp/analytics", icon: BarChart3, managerOnly: true },
            { name: "Iklan Meta", href: "/owner/iklan", icon: MousePointerClick, ownerOnly: true },
            { name: "Pengaturan Channel", href: "/crm/whatsapp/settings", icon: Settings, managerOnly: true },
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
            { name: "Rumus HPP per Produk", href: "/owner/hpp-produk", icon: Calculator, ownerOnly: true },
            { name: "Akses Menu Role", href: "/owner/akses-menu", icon: Lock, ownerOnly: true },
        ],
    },
    {
        key: 'team', label: 'Tim & Kinerja', icon: Trophy,
        items: [
            { name: "Beranda Saya", href: "/beranda", icon: LayoutDashboard },
            { name: "Leaderboard", href: "/leaderboard", icon: Award },
            { name: "Papan Tugas", href: "/tugas", icon: ClipboardList },
            { name: "Grup Tim", href: "/tugas/grup", icon: Users, managerOnly: true },
            { name: "Jadwal Tugas", href: "/tugas/jadwal", icon: CalendarClock, managerOnly: true },
        ],
    },
];

/** Apakah user boleh melihat item ini.
 *  `allowed` = daftar href yang boleh dilihat (hasil preset/konfigurasi role).
 *  null/undefined = tanpa batas divisi (owner/manajer lihat semua). */
export function canSeeNavItem(
    it: NavItem,
    roles: { isManager: boolean; isOwner: boolean; allowed?: Set<string> | null },
): boolean {
    if (it.managerOnly && !roles.isManager) return false;
    if (it.ownerOnly && !roles.isOwner) return false;
    if (roles.allowed && !roles.allowed.has(it.href)) return false;
    return true;
}

// ── Pembatasan menu per role/divisi ──────────────────────────────────────────
// Basis menu yang SELALU boleh dilihat tiap staf (biar tak pernah "menu kosong").
const TEAM_BASE = ["/beranda", "/leaderboard", "/tugas"];

export type MenuPreset = { id: string; label: string; match: (name: string) => boolean; hrefs: string[] };

/** Preset bawaan per divisi (dicocokkan dari kata kunci nama role, huruf kecil). */
export const MENU_PRESETS: MenuPreset[] = [
    {
        id: "kasir", label: "Kasir", match: (n) => n.includes("kasir") || n.includes("cashier"),
        hrefs: [...TEAM_BASE, "/pos", "/reports/sales", "/reports/shift-history", "/transactions/dp", "/customers", "/invoices", "/sales-orders", "/cashflow"],
    },
    {
        id: "cs", label: "CS / Marketing", match: (n) => n === "cs" || n.includes("customer") || n.includes("marketing") || n.includes("sales"),
        hrefs: [...TEAM_BASE, "/crm", "/customers", "/crm/leads", "/crm/follow-ups", "/crm/templates", "/invoices", "/sales-orders", "/crm/whatsapp", "/crm/social", "/crm/whatsapp/broadcast", "/crm/whatsapp/qr", "/crm/whatsapp/quick-replies", "/crm/whatsapp/templates"],
    },
    {
        id: "designer", label: "Desainer", match: (n) => n.includes("desain") || n.includes("designer"),
        hrefs: [...TEAM_BASE, "/desainer", "/sales-orders", "/crm/leads", "/crm/whatsapp", "/produksi", "/produksi/pipeline", "/print-queue"],
    },
    {
        id: "operator", label: "Operator Produksi/Cetak", match: (n) => n.includes("operator") || n.includes("produksi") || n.includes("cetak") || n.includes("print"),
        hrefs: [...TEAM_BASE, "/produksi", "/produksi/pipeline", "/print-queue", "/click-counting", "/titipan-masuk", "/titipan-keluar", "/branch-ledger", "/inventory", "/inventory/opname", "/crm/whatsapp"],
    },
];

/** Href minimal untuk role yang tak cocok preset apa pun & belum diatur owner. */
export const MINIMAL_HREFS = TEAM_BASE;

/** Preset href untuk sebuah nama role, atau null bila tak ada yang cocok. */
export function presetHrefsFor(roleName: string | null): string[] | null {
    const n = (roleName || "").toLowerCase();
    return MENU_PRESETS.find((p) => p.match(n))?.hrefs ?? null;
}

/**
 * Set href yang boleh dilihat user.
 * - Owner / Manajer → null (lihat SEMUA menu).
 * - menuAccess (diatur owner) → pakai daftar itu (selalu sertakan /beranda).
 * - Belum diatur → preset divisi; kalau tak cocok → minimal (Beranda+Tugas+Leaderboard).
 */
export function resolveAllowedHrefs(opts: {
    isOwner: boolean;
    isManager: boolean;
    roleName: string | null;
    menuAccess: string[] | null;
}): Set<string> | null {
    if (opts.isOwner || opts.isManager) return null;
    if (opts.menuAccess) return new Set([...opts.menuAccess, "/beranda"]);
    return new Set(presetHrefsFor(opts.roleName) ?? MINIMAL_HREFS);
}

/** Item nav yang bisa diatur owner per role (kecuali yang manajer/owner-only). */
export function configurableSections(): { key: string; label: string; items: NavItem[] }[] {
    const groups = SECTIONS
        .map((s) => ({ key: String(s.key), label: s.label, items: s.items.filter((i) => !i.managerOnly && !i.ownerOnly) }))
        .filter((g) => g.items.length > 0);
    groups.push({ key: "extra", label: "Lainnya", items: [DESIGNER_LINK] });
    return groups;
}

export function isItemActive(pathname: string, href: string): boolean {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(href + '/');
}

/** Section yang memuat route saat ini (untuk highlight kategori & sub-nav header).
 *  Pakai match PALING SPESIFIK (href terpanjang) — supaya /crm/whatsapp masuk ke
 *  section "WhatsApp CRM", bukan tertangkap "/crm" (CRM Dashboard) di section
 *  Pelanggan yang cuma cocok sebagai prefix. */
export function getActiveSection(pathname: string): NavSection | undefined {
    let best: NavSection | undefined;
    let bestLen = -1;
    for (const s of SECTIONS) {
        for (const it of s.items) {
            if (isItemActive(pathname, it.href) && it.href.length > bestLen) {
                bestLen = it.href.length;
                best = s;
            }
        }
    }
    return best;
}

/** Item pertama yang boleh diakses user (untuk tujuan klik kategori). */
export function firstItemHref(section: NavSection, isManager: boolean, isOwner = false, allowed: Set<string> | null = null): string {
    const it = section.items.find(i => canSeeNavItem(i, { isManager, isOwner, allowed }));
    return (it ?? section.items[0]).href;
}
