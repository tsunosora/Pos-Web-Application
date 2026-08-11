"use client";

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { getActiveSection } from './nav-config';
import { useUIStore } from '@/store/ui-store';

/**
 * Rel tunggal untuk semua tombol mengambang di pojok kanan-bawah
 * (Asisten AI + notifikasi orderan jadi). Menjamin keduanya:
 * - sejajar di kanan & tak pernah saling menumpuk (satu kolom, jarak tetap),
 * - naik-turun bersama saat dock SubNav aktif (mobile) / header overflow (desktop),
 * - aman dari safe-area (notch/gesture bar) di semua device,
 * - tidak menghalangi konten: container pointer-events-none, hanya tombol
 *   di dalamnya yang menerima klik (pointer-events-auto).
 *
 * Anak pertama = paling ATAS, anak terakhir = paling BAWAH (menempel baseline).
 * Urutan render di MainLayout: <AiChatWidget /> lalu <ReadyJobsFab /> →
 * AI di atas, notif orderan di bawahnya.
 */
export function FloatingActionDock({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    // Dock SubNav mengambang di bawah → naikkan rel agar tidak tertutup:
    // di mobile saat ada kategori aktif, di desktop saat header SubNav overflow.
    const lifted = !!getActiveSection(pathname);
    const subnavOverflow = useUIStore((s) => s.subnavOverflow);

    return (
        <div
            aria-hidden={false}
            // z-[310] supaya di atas cart sidebar POS (z-[300]).
            className={`pointer-events-none fixed right-4 sm:right-6 z-[310] print:hidden flex flex-col items-end gap-3 ${
                lifted
                    ? 'bottom-[calc(6.5rem_+_env(safe-area-inset-bottom))]'
                    : 'bottom-[max(1rem,env(safe-area-inset-bottom))]'
            } ${subnavOverflow ? 'md:bottom-[calc(6.5rem_+_env(safe-area-inset-bottom))]' : 'md:bottom-6'}`}
        >
            {children}
        </div>
    );
}
