"use client";

import { useEffect, useState } from "react";

/**
 * Toggle light/dark mode dengan strategi class `.dark` pada <html>
 * (cocok dengan `@custom-variant dark (&:is(.dark *))` di globals.css).
 *
 * - Nilai awal dibaca dari class yang sudah dipasang oleh inline anti-flash
 *   script di root layout (lihat src/app/layout.tsx), jadi tidak ada kedip.
 * - Pilihan user dipersist ke localStorage('theme') = 'dark' | 'light'.
 * - Jika user belum pernah memilih, default mengikuti preferensi sistem.
 */
export function useDarkMode() {
    const [isDark, setIsDark] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setIsDark(document.documentElement.classList.contains("dark"));
        setMounted(true);
    }, []);

    const setDark = (next: boolean) => {
        const root = document.documentElement;
        root.classList.toggle("dark", next);
        try {
            localStorage.setItem("theme", next ? "dark" : "light");
        } catch { /* storage tidak tersedia — abaikan */ }
        setIsDark(next);
    };

    return { isDark, mounted, toggle: () => setDark(!isDark), setDark };
}
