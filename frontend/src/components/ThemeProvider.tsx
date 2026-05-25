"use client";

import { useEffect, useState } from "react";
import { getPublicSettings } from "@/lib/api";

/**
 * Inject CSS variables app-wide dari StoreSettings.theme:
 *   --theme-primary       : warna utama (solid mode) atau gradient color 1
 *   --theme-secondary     : gradient color 2 (only if mode=GRADIENT)
 *   --theme-bg            : computed background (solid color atau linear-gradient)
 *   --theme-primary-rgb   : "R, G, B" untuk pakai dengan opacity (mis. rgb(var(--theme-primary-rgb) / 0.1))
 *
 * Component yang mau ikut theme:
 *   <div style={{ background: 'var(--theme-bg)' }} />
 *   <button className="bg-[var(--theme-primary)] hover:opacity-90" />
 */

interface ThemeSettings {
    mode: 'SOLID' | 'GRADIENT';
    primaryColor: string;
    secondaryColor: string;
    gradientDirection: string;
}

const DEFAULT_THEME: ThemeSettings = {
    mode: 'SOLID',
    primaryColor: '#4F46E5',
    secondaryColor: '#7C3AED',
    gradientDirection: '135deg',
};

function hexToRgb(hex: string): { r: number; g: number; b: number } {
    const cleaned = hex.replace('#', '');
    return {
        r: parseInt(cleaned.substring(0, 2), 16),
        g: parseInt(cleaned.substring(2, 4), 16),
        b: parseInt(cleaned.substring(4, 6), 16),
    };
}

function hexToRgbString(hex: string): string {
    const { r, g, b } = hexToRgb(hex);
    return `${r}, ${g}, ${b}`;
}

/** Pilih foreground color (text di atas warna primary): white kalau warna gelap, black kalau terang. */
function pickForeground(hex: string): string {
    const { r, g, b } = hexToRgb(hex);
    // Standard luminance formula (WCAG-ish), 0-255 range
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b);
    return luminance > 160 ? '#000000' : '#FFFFFF';
}

function buildBg(theme: ThemeSettings): string {
    if (theme.mode === 'GRADIENT') {
        return `linear-gradient(${theme.gradientDirection}, ${theme.primaryColor}, ${theme.secondaryColor})`;
    }
    return theme.primaryColor;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setTheme] = useState<ThemeSettings>(DEFAULT_THEME);

    useEffect(() => {
        getPublicSettings().then((s: any) => {
            if (s?.theme) setTheme({ ...DEFAULT_THEME, ...s.theme });
        }).catch(() => { /* fallback to default */ });
    }, []);

    const fg = pickForeground(theme.primaryColor);
    const css = `
        :root {
            /* Custom theme vars — pakai di component kustom kamu */
            --theme-primary: ${theme.primaryColor};
            --theme-secondary: ${theme.secondaryColor};
            --theme-bg: ${buildBg(theme)};
            --theme-primary-rgb: ${hexToRgbString(theme.primaryColor)};
            --theme-secondary-rgb: ${hexToRgbString(theme.secondaryColor)};

            /* Override Tailwind/shadcn vars supaya bg-primary, text-primary,
               ring-primary, sidebar-primary, chart-1, dll ikut warna tema. */
            --primary: ${theme.primaryColor};
            --primary-foreground: ${fg};
            --ring: ${theme.primaryColor};
            --sidebar-primary: ${theme.primaryColor};
            --sidebar-primary-foreground: ${fg};
            --sidebar-ring: ${theme.primaryColor};
            --chart-1: ${theme.primaryColor};
        }
    `;

    return (
        <>
            <style dangerouslySetInnerHTML={{ __html: css }} />
            {children}
        </>
    );
}
