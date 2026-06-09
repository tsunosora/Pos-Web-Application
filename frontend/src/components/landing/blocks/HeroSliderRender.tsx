"use client";

import { useEffect, useState } from "react";
import { SliderArrows, SliderDots, type ArrowVariant } from "./SliderControls";

const API = process.env.NEXT_PUBLIC_API_URL || "";
const imgSrc = (u?: string) => (!u ? "" : /^https?:/.test(u) ? u : `${API}${u}`);

interface Slide {
    title?: string;
    subtitle?: string;
    image?: string;
    ctaLabel?: string;
    ctaHref?: string;
    align?: "left" | "center" | "right";
}

export function HeroSliderRender({
    slides = [],
    interval = 5000,
    minHeight = 440,
    autoplay = "on",
    showArrows = "on",
    showDots = "on",
    arrowStyle = "circleDark",
}: {
    slides?: Slide[];
    interval?: number;
    minHeight?: number;
    autoplay?: "on" | "off";
    showArrows?: "on" | "off";
    showDots?: "on" | "off";
    arrowStyle?: ArrowVariant;
}) {
    const [idx, setIdx] = useState(0);
    const n = slides.length;

    useEffect(() => {
        if (autoplay !== "on" || n <= 1) return;
        const ms = Math.max(2000, Number(interval) || 5000);
        const t = setInterval(() => setIdx((p) => (p + 1) % n), ms);
        return () => clearInterval(t);
    }, [autoplay, interval, n]);

    // jaga idx tetap valid kalau slide dikurangi di editor
    useEffect(() => { if (idx > n - 1) setIdx(0); }, [n, idx]);

    if (n === 0) {
        return (
            <section style={{ minHeight, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#4f46e5,#7c3aed)", color: "#fff" }}>
                <p>Tambah slide di panel kanan.</p>
            </section>
        );
    }

    const go = (d: number) => setIdx((p) => (p + d + n) % n);

    return (
        <section style={{ position: "relative", minHeight, overflow: "hidden" }}>
            {slides.map((s, i) => {
                const align = s.align || "center";
                const active = i === idx;
                return (
                    <div
                        key={i}
                        style={{
                            position: "absolute", inset: 0,
                            display: "flex", flexDirection: "column", justifyContent: "center",
                            alignItems: align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start",
                            textAlign: align, padding: "48px 56px", color: "#fff",
                            backgroundImage: s.image
                                ? `linear-gradient(rgba(0,0,0,.45),rgba(0,0,0,.45)), url(${imgSrc(s.image)})`
                                : "linear-gradient(135deg,#4f46e5,#7c3aed)",
                            backgroundSize: "cover", backgroundPosition: "center",
                            opacity: active ? 1 : 0,
                            transition: "opacity .6s ease",
                            pointerEvents: active ? "auto" : "none",
                        }}
                    >
                        {s.title && <h1 style={{ fontSize: 44, fontWeight: 800, margin: 0, maxWidth: 820, lineHeight: 1.1 }}>{s.title}</h1>}
                        {s.subtitle && <p style={{ fontSize: 18, marginTop: 16, maxWidth: 640, opacity: 0.95 }}>{s.subtitle}</p>}
                        {s.ctaLabel && (
                            <a href={s.ctaHref || "#"} style={{ marginTop: 24, background: "#fff", color: "#4f46e5", padding: "12px 24px", borderRadius: 999, fontWeight: 700, textDecoration: "none", display: "inline-block" }}>
                                {s.ctaLabel}
                            </a>
                        )}
                    </div>
                );
            })}

            {n > 1 && showArrows === "on" && <SliderArrows onPrev={() => go(-1)} onNext={() => go(1)} variant={arrowStyle} />}
            {n > 1 && showDots === "on" && <SliderDots count={n} index={idx} onSelect={setIdx} color="#ffffff" />}
        </section>
    );
}
