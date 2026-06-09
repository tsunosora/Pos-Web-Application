"use client";

import { useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "";
const imgSrc = (u?: string) => (!u ? "" : /^https?:/.test(u) ? u : `${API}${u}`);

interface NavLink { label?: string; href?: string }

export function NavbarRender({
    brandText = "Toko",
    logoImage,
    links = [],
    ctaLabel,
    ctaHref,
    sticky = "on",
    bg = "#ffffff",
    textColor = "#0f172a",
    accent = "#4f46e5",
}: {
    brandText?: string;
    logoImage?: string;
    links?: NavLink[];
    ctaLabel?: string;
    ctaHref?: string;
    sticky?: "on" | "off";
    bg?: string;
    textColor?: string;
    accent?: string;
}) {
    const [open, setOpen] = useState(false);
    const linkStyle: React.CSSProperties = { textDecoration: "none", color: textColor, fontWeight: 600, fontSize: 14 };
    const ctaStyle: React.CSSProperties = { background: accent, color: "#fff", padding: "8px 18px", borderRadius: 999, fontWeight: 700, textDecoration: "none", fontSize: 14 };

    return (
        <header style={{ position: sticky === "on" ? "sticky" : "relative", top: 0, zIndex: 50, background: bg, borderBottom: "1px solid #eef0f3", backdropFilter: "saturate(180%) blur(6px)" }}>
            <style>{`@media (max-width:768px){.lpnav-desktop{display:none !important}.lpnav-burger{display:flex !important}}`}</style>
            <div style={{ maxWidth: 1100, margin: "0 auto", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                <a href={(links[0]?.href) || "#"} style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: textColor, fontWeight: 800, fontSize: 18 }}>
                    {logoImage
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={imgSrc(logoImage)} alt={brandText} style={{ height: 34, width: "auto", objectFit: "contain" }} />
                        : null}
                    <span>{brandText}</span>
                </a>

                {/* Desktop menu */}
                <nav className="lpnav-desktop" style={{ display: "flex", alignItems: "center", gap: 22 }}>
                    {links.map((l, i) => (
                        <a key={i} href={l.href || "#"} style={linkStyle}>{l.label}</a>
                    ))}
                    {ctaLabel && <a href={ctaHref || "#"} style={ctaStyle}>{ctaLabel}</a>}
                </nav>

                {/* Mobile burger */}
                <button className="lpnav-burger" onClick={() => setOpen((o) => !o)} aria-label="Menu" style={{ display: "none", border: "none", background: "transparent", fontSize: 26, lineHeight: 1, cursor: "pointer", color: textColor }}>
                    {open ? "✕" : "☰"}
                </button>
            </div>

            {/* Mobile dropdown */}
            {open && (
                <div style={{ padding: "8px 24px 16px", display: "flex", flexDirection: "column", gap: 12, borderTop: "1px solid #eef0f3", background: bg }}>
                    {links.map((l, i) => (
                        <a key={i} href={l.href || "#"} onClick={() => setOpen(false)} style={linkStyle}>{l.label}</a>
                    ))}
                    {ctaLabel && <a href={ctaHref || "#"} onClick={() => setOpen(false)} style={{ ...ctaStyle, textAlign: "center" }}>{ctaLabel}</a>}
                </div>
            )}
        </header>
    );
}
