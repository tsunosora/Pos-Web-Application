"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { SubNav } from "./SubNav";
import { getActiveSection } from "./nav-config";
import { Footer } from "./Footer";
import { ShiftReminderBanner } from "./ShiftReminderBanner";
import { DailyTargetBanner } from "./DailyTargetBanner";
import { BranchInboxPopup } from "./BranchInboxPopup";
import { BranchOutboxReadyPopup } from "./BranchOutboxReadyPopup";
import { ReadyJobsPopup } from "./ReadyJobsPopup";
import { ReadyJobsModal } from "./ReadyJobsModal";
import { ReadyJobsFab } from "./ReadyJobsFab";
import { FloatingActionDock } from "./FloatingActionDock";
import { FloatingThemeToggle } from "./FloatingThemeToggle";
import { AiChatWidget } from "@/components/ai/AiChatWidget";
import { useNotificationStream } from "@/hooks/useNotificationStream";
import { useShiftReminder } from "@/hooks/useShiftReminder";
import { useNotificationStore } from "@/store/notification-store";
import { useUIStore } from "@/store/ui-store";

interface MainLayoutProps {
    children: React.ReactNode;
}

function AppInitializer() {
    const loadFromIDB = useNotificationStore(s => s.loadFromIDB);
    useNotificationStream();
    useShiftReminder();

    useEffect(() => {
        loadFromIDB();
    }, [loadFromIDB]);

    return null;
}

export function MainLayout({ children }: MainLayoutProps) {
    const pathname = usePathname();
    const showDock = !!getActiveSection(pathname);
    const subnavOverflow = useUIStore((s) => s.subnavOverflow);
    const [readyJobsModalOpen, setReadyJobsModalOpen] = useState(false);
    const isLoginPage = pathname === "/login";
    const isOpnamePage = pathname.startsWith("/opname/");
    // /produksi (operator PIN, fullscreen) tanpa sidebar. KECUALI /produksi/pipeline (admin kanban) yang pakai sidebar normal.
    const isProduksiPage = pathname.startsWith("/produksi") && !pathname.startsWith("/produksi/pipeline");
    const isCetakPage = pathname.startsWith("/cetak");
    const isPublicProductPage = pathname.startsWith("/p/");
    const isDesignerPortal = pathname.startsWith("/so-designer");
    const isHelpPage = pathname.startsWith("/help");
    // Builder landing & halaman landing publik: full-screen tanpa chrome dashboard
    const isLandingBuilder = pathname.startsWith("/landing-builder");
    const isLandingPublic = pathname === "/landing" || pathname.startsWith("/landing/");
    const isArtikelPublic = pathname === "/artikel" || pathname.startsWith("/artikel/");
    const isMarketingPublic = pathname.startsWith("/marketing");
    // Halaman penilaian CS publik (dibuka pelanggan dari WhatsApp) — fullscreen, tanpa sidebar.
    const isNilaiPublic = pathname.startsWith("/nilai/");
    // Dashboard Owner — halaman full-screen terpisah (login app, tanpa sidebar).
    const isOwnerPage = pathname.startsWith("/owner");
    // Papan Juara TV (publik PIN, fullscreen kiosk) — tanpa sidebar/nav.
    const isTvPage = pathname.startsWith("/tv");
    // Studio Desain (iframe feeds-auto) — full-screen tanpa chrome dashboard.
    const isDesainerPage = pathname.startsWith("/desainer");
    const isStandalone = isLoginPage || isOpnamePage || isProduksiPage || isCetakPage || isPublicProductPage || isDesignerPortal || isHelpPage || isLandingBuilder || isLandingPublic || isArtikelPublic || isMarketingPublic || isNilaiPublic || isOwnerPage || isTvPage || isDesainerPage;
    // Toggle dark mode mengambang untuk halaman publik INTERNAL (staff/operator),
    // BUKAN halaman login & bukan halaman storefront publik (landing/artikel/produk).
    // /tv punya toggle dark sendiri di TvHeader → jangan dobel. /desainer = iframe
    // (studio punya tema sendiri) → jangan tampilkan toggle POS.
    const showFloatingTheme = isStandalone && !isLoginPage && !isLandingPublic && !isArtikelPublic && !isPublicProductPage && !isLandingBuilder && !isNilaiPublic && !isTvPage && !isDesainerPage;
    // Widget chat AI: di halaman POS biasa (login-authenticated) + dashboard Owner.
    // TIDAK di halaman publik/kiosk/login/desainer (bisa tanpa login → hindari 401 redirect).
    const showAiChat = !isStandalone || isOwnerPage;

    if (isStandalone) {
        return (
            <>
                {children}
                {showFloatingTheme && <FloatingThemeToggle />}
                {showAiChat && (
                    <FloatingActionDock>
                        <AiChatWidget />
                    </FloatingActionDock>
                )}
            </>
        );
    }

    return (
        <div className="relative flex h-screen overflow-hidden bg-gradient-to-br from-muted/30 via-background to-background print:block print:h-auto print:overflow-visible print:bg-white">
            {/* Ambient mesh warna di belakang permukaan kaca — wajib agar frosted
                glassmorphism terlihat (kaca mem-blur warna ini, bukan ruang kosong). */}
            <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden print:hidden">
                <div className="absolute -top-40 -left-32 h-[30rem] w-[30rem] rounded-full bg-primary/15 blur-[120px]" />
                <div className="absolute top-1/4 -right-32 h-[28rem] w-[28rem] rounded-full bg-blue-500/12 blur-[120px]" />
                <div className="absolute -bottom-40 left-1/3 h-[28rem] w-[28rem] rounded-full bg-fuchsia-500/10 blur-[130px]" />
                <div className="absolute top-1/2 left-[-6rem] h-80 w-80 rounded-full bg-emerald-400/10 blur-[110px]" />
            </div>
            <AppInitializer />
            <div className="print:hidden"><ShiftReminderBanner /></div>
            <div className="print:hidden"><DailyTargetBanner /></div>
            <div className="print:hidden"><BranchInboxPopup /></div>
            <div className="print:hidden"><BranchOutboxReadyPopup /></div>
            <ReadyJobsPopup onOpenModal={() => setReadyJobsModalOpen(true)} />
            <ReadyJobsModal open={readyJobsModalOpen} onClose={() => setReadyJobsModalOpen(false)} />
            {/* Rel tunggal kanan-bawah: Asisten AI di atas, notif orderan jadi di bawahnya.
                Satu kolom terjangkar → tak saling menumpuk / hilang di semua device. */}
            <FloatingActionDock>
                {showAiChat && <AiChatWidget />}
                <ReadyJobsFab onClick={() => setReadyJobsModalOpen(true)} />
            </FloatingActionDock>
            <div className="print:hidden"><Sidebar /></div>
            <div className="flex flex-1 flex-col min-w-0 overflow-hidden print:block">
                <div className="print:hidden"><Header /></div>
                <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden overscroll-x-none print:overflow-visible [scrollbar-gutter:stable]">
                    {/* min-h-full → area konten minimal setinggi viewport supaya Footer tak
                        "melompat" saat data async selesai load. [scrollbar-gutter:stable] →
                        gutter scrollbar selalu dicadangkan, cegah reflow kolom saat scrollbar
                        muncul (Windows/Chrome). Dua-duanya penyebab CLS di laporan. */}
                    <div className="min-h-full p-4 sm:p-6 lg:p-8 print:p-0 print:min-h-0">
                        {children}
                    </div>
                    <Footer />
                    {/* Spacer agar konten/footer tidak tertutup dock SubNav mengambang.
                        Di desktop hanya perlu saat header overflow (dock tampil). */}
                    {showDock && <div aria-hidden className={subnavOverflow ? "h-24" : "md:hidden h-24"} />}
                </main>
            </div>
            {/* Dock SubNav kaca mengambang — hanya mobile, saat ada kategori aktif & bukan di POS. */}
            {showDock && <SubNav mode="strip" />}
        </div>
    );
}
