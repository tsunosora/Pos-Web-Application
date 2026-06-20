"use client";

import { Moon, Sun } from "lucide-react";
import { useDarkMode } from "@/hooks/useDarkMode";

export function ThemeToggle() {
    const { isDark, mounted, toggle } = useDarkMode();

    return (
        <button
            type="button"
            role="switch"
            aria-checked={isDark}
            onClick={toggle}
            aria-label={isDark ? "Beralih ke mode terang" : "Beralih ke mode gelap"}
            title={isDark ? "Mode terang" : "Mode gelap"}
            className="relative inline-flex h-7 w-[52px] shrink-0 items-center rounded-full border border-border/60 bg-muted/60 px-0.5 backdrop-blur-xl backdrop-saturate-150 shadow-[inset_0_1px_2px_rgb(0_0_0/0.12)] transition-colors hover:border-primary/40"
        >
            {/* Ikon konteks di track (terlihat di sisi yang tidak tertutup knob) */}
            <Sun className="pointer-events-none absolute left-[7px] h-3.5 w-3.5 text-amber-500/70" />
            <Moon className="pointer-events-none absolute right-[7px] h-3.5 w-3.5 text-indigo-400/70" />

            {/* Knob kaca yang meluncur */}
            <span
                className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full bg-card shadow-md ring-1 ring-border/50 ${
                    mounted ? "transition-transform duration-300 ease-out" : ""
                } ${isDark ? "translate-x-[24px]" : "translate-x-0"}`}
            >
                {mounted && (
                    isDark
                        ? <Moon className="h-3.5 w-3.5 text-indigo-400" />
                        : <Sun className="h-3.5 w-3.5 text-amber-500" />
                )}
            </span>
        </button>
    );
}
