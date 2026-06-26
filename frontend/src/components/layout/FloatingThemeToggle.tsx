"use client";

import { Moon, Sun } from "lucide-react";
import { useDarkMode } from "@/hooks/useDarkMode";

/**
 * Tombol ganti dark/light mode mengambang — untuk halaman publik (cetak,
 * so-designer, produksi, marketing, dll) yang tidak punya header app/ThemeToggle.
 * Mengambang di kiri-bawah (kanan-bawah biasanya dipakai FAB lain).
 */
export function FloatingThemeToggle() {
    const { isDark, mounted, toggle } = useDarkMode();

    return (
        <button
            type="button"
            onClick={toggle}
            aria-label={isDark ? "Beralih ke mode terang" : "Beralih ke mode gelap"}
            title={isDark ? "Mode terang" : "Mode gelap"}
            className="fixed bottom-4 left-4 z-[60] h-11 w-11 rounded-full bg-card border border-border shadow-lg flex items-center justify-center text-foreground hover:scale-105 active:scale-95 transition-transform print:hidden"
        >
            {mounted && (isDark
                ? <Sun className="h-5 w-5 text-amber-400" />
                : <Moon className="h-5 w-5 text-indigo-500" />)}
        </button>
    );
}
