"use client";

import { useState } from "react";
import { resolveLeadImageUrl } from "@/lib/api";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
    images: { filename: string; caption?: string | null }[];
    fallbackUrl?: string | null; // legacy lead.imageUrl single
    alt?: string;
    heightClass?: string;        // mis. "h-32" untuk kanban, "h-44" untuk list card
    overlay?: React.ReactNode;   // mis. badge level
    onClick?: () => void;
}

/**
 * Carousel sederhana — kalau >1 image tampil prev/next arrows + dot indicator.
 * Kalau 1 image (atau fallback), render image biasa.
 * Kalau tidak ada image sama sekali, return null.
 */
export function LeadImageCarousel({
    images, fallbackUrl, alt = "Lead", heightClass = "h-32", overlay, onClick,
}: Props) {
    // Compose list: prioritas images[]. Kalau kosong, pakai fallback.
    const sources = images.length > 0
        ? images.map(i => ({ src: resolveLeadImageUrl(i.filename), caption: i.caption || null }))
        : (fallbackUrl
            ? [{ src: resolveLeadImageUrl(fallbackUrl), caption: null }]
            : []);
    const valid = sources.filter(s => !!s.src) as { src: string; caption: string | null }[];

    const [idx, setIdx] = useState(0);
    if (valid.length === 0) return null;

    const safeIdx = Math.min(idx, valid.length - 1);
    const current = valid[safeIdx];
    const hasMultiple = valid.length > 1;

    const prev = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIdx((i) => (i === 0 ? valid.length - 1 : i - 1));
    };
    const next = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIdx((i) => (i === valid.length - 1 ? 0 : i + 1));
    };

    return (
        <div className={`relative w-full ${heightClass} bg-gray-100 group ${onClick ? "cursor-pointer" : ""}`} onClick={onClick}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={current.src} alt={alt} loading="lazy" decoding="async"
                className="w-full h-full object-cover" />
            {overlay}

            {hasMultiple && (
                <>
                    {/* Prev button */}
                    <button type="button" onClick={prev}
                        className="absolute left-1 top-1/2 -translate-y-1/2 w-7 h-7 bg-black/40 hover:bg-black/60 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Previous">
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                    {/* Next button */}
                    <button type="button" onClick={next}
                        className="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 bg-black/40 hover:bg-black/60 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Next">
                        <ChevronRight className="h-4 w-4" />
                    </button>
                    {/* Dot indicators */}
                    <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-1">
                        {valid.map((_, i) => (
                            <button
                                key={i}
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setIdx(i); }}
                                className={`w-1.5 h-1.5 rounded-full transition-all ${
                                    i === safeIdx ? "bg-white w-3" : "bg-white/60"
                                }`}
                                aria-label={`Go to image ${i + 1}`}
                            />
                        ))}
                    </div>
                    {/* Counter top-left */}
                    <span className="absolute top-1 left-1 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded">
                        {safeIdx + 1}/{valid.length}
                    </span>
                </>
            )}
        </div>
    );
}
