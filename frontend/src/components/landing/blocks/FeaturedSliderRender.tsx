"use client";

import { useEffect, useState } from "react";
import { SliderArrows, type ArrowVariant } from "./SliderControls";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const img = (u?: string) => (!u ? "" : /^https?:/.test(u) ? u : `${API}${u}`);
const rupiah = (n: number) => "Rp " + Math.round(n || 0).toLocaleString("id-ID");

function hexToRgba(hex: string, a: number): string {
    const h = (hex || "#4f46e5").replace("#", "");
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    const n = parseInt(full, 16);
    if (Number.isNaN(n)) return `rgba(79,70,229,${a})`;
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function priceOf(p: any): number {
    const prices = (p.variants || []).map((v: any) => Number(v.price)).filter((n: number) => Number.isFinite(n) && n > 0);
    return prices.length ? Math.min(...prices) : Number(p.price) || 0;
}
function imageOf(p: any): string {
    if (p.imageUrl) return img(p.imageUrl);
    const v = (p.variants || []).find((x: any) => x.imageUrl);
    return v ? img(v.imageUrl) : "";
}

export function FeaturedSliderRender({
    eyebrow = "Unggulan",
    mode = "bestseller",
    productIds,
    limit = 3,
    autoplay = "on",
    interval = 5000,
    ctaLabel,
    ctaHref,
    accent = "#4f46e5",
    showArrows = "on",
    showDots = "on",
    arrowStyle = "circleLight",
}: {
    eyebrow?: string;
    mode?: "bestseller" | "manual";
    productIds?: number[];
    limit?: number;
    autoplay?: "on" | "off";
    interval?: number;
    ctaLabel?: string;
    ctaHref?: string;
    accent?: string;
    showArrows?: "on" | "off";
    showDots?: "on" | "off";
    arrowStyle?: ArrowVariant;
}) {
    const [items, setItems] = useState<any[] | null>(null);
    const [idx, setIdx] = useState(0);
    const lim = Math.max(1, Number(limit) || 3);

    useEffect(() => {
        const url = mode === "manual" ? `${API}/products/public` : `${API}/products/public/best-sellers?limit=${lim}`;
        fetch(url, { cache: "no-store" })
            .then((r) => r.json())
            .then((list) => {
                let arr = Array.isArray(list) ? list : [];
                if (mode === "manual") {
                    const ids = Array.isArray(productIds) ? productIds : [];
                    arr = arr.filter((p: any) => ids.includes(p.id)).sort((a: any, b: any) => ids.indexOf(a.id) - ids.indexOf(b.id));
                }
                setItems(arr.slice(0, lim));
            })
            .catch(() => setItems([]));
    }, [mode, lim, JSON.stringify(productIds)]);

    const n = items?.length || 0;
    useEffect(() => {
        if (autoplay !== "on" || n <= 1) return;
        const ms = Math.max(2500, Number(interval) || 5000);
        const t = setInterval(() => setIdx((p) => (p + 1) % n), ms);
        return () => clearInterval(t);
    }, [autoplay, interval, n]);
    useEffect(() => { if (idx > n - 1) setIdx(0); }, [n, idx]);

    if (items === null) return <section style={{ padding: 56, textAlign: "center", color: "#94a3b8" }}>Memuat…</section>;
    if (n === 0) return <section style={{ padding: 56, textAlign: "center", color: "#94a3b8" }}>Belum ada produk.</section>;

    const go = (d: number) => setIdx((p) => (p + d + n) % n);
    const p = items[Math.min(idx, n - 1)];
    const src = imageOf(p);

    return (
        <section style={{ position: "relative", overflow: "hidden", background: `linear-gradient(135deg, ${hexToRgba(accent, 0.12)} 0%, #ffffff 55%)` }}>
            <style>{`@keyframes featIn{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}@keyframes featImg{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:none}}`}</style>

            <div style={{ position: "relative", maxWidth: 1100, margin: "0 auto", padding: "56px 56px 84px", minHeight: 460 }}>
                {/* Angka peringkat raksasa (dekoratif) */}
                <div style={{ position: "absolute", top: 8, right: 24, fontSize: 180, fontWeight: 900, lineHeight: 1, color: hexToRgba(accent, 0.07), pointerEvents: "none", userSelect: "none" }}>
                    {String(idx + 1).padStart(2, "0")}
                </div>

                <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "center", position: "relative" }}>
                    {/* Gambar + blob aksen */}
                    <div style={{ position: "relative", animation: "featImg .55s ease" }}>
                        <div style={{ position: "absolute", inset: "-18px -18px 18px 18px", background: hexToRgba(accent, 0.18), borderRadius: 28, transform: "rotate(-3deg)" }} />
                        {src
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img src={src} alt={p.name} style={{ position: "relative", width: "100%", height: 380, objectFit: "cover", borderRadius: 24, boxShadow: "0 28px 50px -20px rgba(0,0,0,.45)" }} />
                            : <div style={{ position: "relative", height: 380, borderRadius: 24, background: "#e2e8f0" }} />}
                        <span style={{ position: "absolute", top: 16, left: 16, background: accent, color: "#fff", fontSize: 12, fontWeight: 800, padding: "7px 14px", borderRadius: 999, boxShadow: "0 8px 18px -6px rgba(0,0,0,.4)" }}>
                            {mode === "bestseller" ? `🔥 Terlaris #${idx + 1}` : "★ Unggulan"}
                        </span>
                    </div>

                    {/* Info */}
                    <div style={{ animation: "featIn .5s ease" }}>
                        <span style={{ display: "inline-block", background: hexToRgba(accent, 0.12), color: accent, fontSize: 12, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", padding: "6px 12px", borderRadius: 999 }}>{eyebrow}</span>
                        <h2 style={{ fontSize: 40, fontWeight: 800, lineHeight: 1.08, margin: "16px 0 0", color: "#0f172a" }}>{p.name}</h2>
                        {p.category?.name && <p style={{ color: "#94a3b8", margin: "6px 0 0", fontSize: 14 }}>{p.category.name}</p>}
                        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 18, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 30, fontWeight: 900, color: accent }}>{rupiah(priceOf(p))}</span>
                            {mode === "bestseller" && p.soldQty > 0 && (
                                <span style={{ background: "#f1f5f9", color: "#475569", fontSize: 13, fontWeight: 700, padding: "5px 12px", borderRadius: 999 }}>
                                    {Number(p.soldQty).toLocaleString("id-ID")} terjual
                                </span>
                            )}
                        </div>
                        {ctaLabel && (
                            <a href={ctaHref || "#"} style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 26, background: accent, color: "#fff", padding: "14px 30px", borderRadius: 999, fontWeight: 700, textDecoration: "none", boxShadow: `0 14px 26px -10px ${hexToRgba(accent, 0.6)}` }}>
                                {ctaLabel} →
                            </a>
                        )}
                    </div>
                </div>

                {/* Strip thumbnail (navigasi) */}
                {n > 1 && showDots === "on" && (
                    <div style={{ position: "absolute", bottom: 26, left: 56, display: "flex", gap: 10, zIndex: 3 }}>
                        {items.map((it, i) => {
                            const t = imageOf(it);
                            const active = i === idx;
                            return (
                                <button key={it.id} type="button" onClick={() => setIdx(i)} aria-label={`Produk ${i + 1}`}
                                    style={{ width: 56, height: 44, borderRadius: 10, overflow: "hidden", padding: 0, cursor: "pointer", background: "#fff", border: active ? `2px solid ${accent}` : "2px solid transparent", boxShadow: active ? `0 6px 14px -6px ${hexToRgba(accent, 0.6)}` : "0 2px 6px rgba(0,0,0,.1)", opacity: active ? 1 : 0.7, transition: "all .25s" }}>
                                    {t
                                        // eslint-disable-next-line @next/next/no-img-element
                                        ? <img src={t} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                        : <div style={{ width: "100%", height: "100%", background: "#e2e8f0" }} />}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {n > 1 && showArrows === "on" && <SliderArrows onPrev={() => go(-1)} onNext={() => go(1)} variant={arrowStyle} />}
        </section>
    );
}
