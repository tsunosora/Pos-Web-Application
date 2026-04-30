"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { ShiftReminderBanner } from "./ShiftReminderBanner";
import { BranchInboxPopup } from "./BranchInboxPopup";
import { BranchOutboxReadyPopup } from "./BranchOutboxReadyPopup";
import { ReadyJobsPopup } from "./ReadyJobsPopup";
import { ReadyJobsModal } from "./ReadyJobsModal";
import { ReadyJobsFab } from "./ReadyJobsFab";
import { useNotificationStream } from "@/hooks/useNotificationStream";
import { useShiftReminder } from "@/hooks/useShiftReminder";
import { useNotificationStore } from "@/store/notification-store";

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
    const [readyJobsModalOpen, setReadyJobsModalOpen] = useState(false);
    const isLoginPage = pathname === "/login";
    const isOpnamePage = pathname.startsWith("/opname/");
    const isProduksiPage = pathname.startsWith("/produksi");
    const isCetakPage = pathname.startsWith("/cetak");
    const isPublicProductPage = pathname.startsWith("/p/");
    const isDesignerPortal = pathname.startsWith("/so-designer");

    if (isLoginPage || isOpnamePage || isProduksiPage || isCetakPage || isPublicProductPage || isDesignerPortal) {
        return <>{children}</>;
    }

    return (
        <div className="flex h-screen overflow-hidden bg-background print:block print:h-auto print:overflow-visible">
            <AppInitializer />
            <div className="print:hidden"><ShiftReminderBanner /></div>
            <div className="print:hidden"><BranchInboxPopup /></div>
            <div className="print:hidden"><BranchOutboxReadyPopup /></div>
            <ReadyJobsPopup onOpenModal={() => setReadyJobsModalOpen(true)} />
            <ReadyJobsModal open={readyJobsModalOpen} onClose={() => setReadyJobsModalOpen(false)} />
            <ReadyJobsFab onClick={() => setReadyJobsModalOpen(true)} />
            <div className="print:hidden"><Sidebar /></div>
            <div className="flex flex-1 flex-col overflow-hidden print:block">
                <div className="print:hidden"><Header /></div>
                <main className="flex-1 overflow-y-auto print:overflow-visible">
                    <div className="p-4 sm:p-6 lg:p-8 print:p-0">
                        {children}
                    </div>
                    <Footer />
                </main>
            </div>
        </div>
    );
}
