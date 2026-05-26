"use client";

import Link from "next/link";
import { BookOpen } from "lucide-react";

export function Footer() {
    return (
        <footer className="shrink-0 border-t border-border/50 bg-muted/30 py-4 px-6 print:hidden">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4">
                <div className="text-center">
                    <p className="text-sm font-semibold text-foreground/70 tracking-wide">
                        Voliko Print
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        &copy; 2026 Muhammad Faisal Abdul Hakim
                    </p>
                </div>
                <div className="hidden sm:block w-px h-7 bg-border/60" />
                <Link
                    href="/help"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors border border-border/50"
                >
                    <BookOpen size={13} />
                    Panduan &amp; Bantuan
                </Link>
            </div>
        </footer>
    );
}
