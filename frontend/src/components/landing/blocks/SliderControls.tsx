"use client";

import React from "react";

export type ArrowVariant = "circleDark" | "circleLight" | "minimal";

function Chevron({ dir }: { dir: "left" | "right" }) {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
            {dir === "left" ? <polyline points="15 18 9 12 15 6" /> : <polyline points="9 18 15 12 9 6" />}
        </svg>
    );
}

function arrowStyle(side: "left" | "right", variant: ArrowVariant): React.CSSProperties {
    const common: React.CSSProperties = {
        position: "absolute", top: "50%", transform: "translateY(-50%)", [side]: 16,
        width: 44, height: 44, borderRadius: 999, padding: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", zIndex: 3,
    };
    if (variant === "circleLight") return { ...common, background: "#fff", color: "#0f172a", border: "1px solid #e2e8f0", boxShadow: "0 4px 12px rgba(0,0,0,.12)" };
    if (variant === "minimal") return { ...common, background: "transparent", color: "currentColor", border: "none" };
    return { ...common, background: "rgba(0,0,0,.4)", color: "#fff", border: "none" }; // circleDark
}

export function SliderArrows({ onPrev, onNext, variant = "circleDark" }: { onPrev: () => void; onNext: () => void; variant?: ArrowVariant }) {
    return (
        <>
            <button type="button" aria-label="Sebelumnya" onClick={onPrev} style={arrowStyle("left", variant)}><Chevron dir="left" /></button>
            <button type="button" aria-label="Berikutnya" onClick={onNext} style={arrowStyle("right", variant)}><Chevron dir="right" /></button>
        </>
    );
}

export function SliderDots({ count, index, onSelect, color = "#ffffff" }: { count: number; index: number; onSelect: (i: number) => void; color?: string }) {
    return (
        <div style={{ position: "absolute", bottom: 18, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 8, zIndex: 3 }}>
            {Array.from({ length: count }).map((_, i) => (
                <button
                    key={i}
                    type="button"
                    aria-label={`Slide ${i + 1}`}
                    onClick={() => onSelect(i)}
                    style={{
                        width: i === index ? 24 : 10, height: 10, borderRadius: 999, border: "none", cursor: "pointer",
                        background: i === index ? color : "rgba(148,163,184,.6)", transition: "width .3s",
                    }}
                />
            ))}
        </div>
    );
}
