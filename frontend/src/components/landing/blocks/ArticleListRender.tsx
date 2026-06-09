"use client";

import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const img = (u?: string | null) => (!u ? "" : /^https?:/.test(u) ? u : `${API}${u}`);
const fmtDate = (s?: string | null) => {
    if (!s) return "";
    try { return new Date(s).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" }); } catch { return ""; }
};

export function ArticleListRender({
    heading,
    limit = 3,
    columns = "3",
    showAllLink = "on",
}: {
    heading?: string;
    limit?: number;
    columns?: "2" | "3" | "4";
    showAllLink?: "on" | "off";
}) {
    const [items, setItems] = useState<any[] | null>(null);

    useEffect(() => {
        fetch(`${API}/articles/public?limit=${Number(limit) || 3}`, { cache: "no-store" })
            .then((r) => r.json())
            .then((d) => setItems(Array.isArray(d) ? d : []))
            .catch(() => setItems([]));
    }, [limit]);

    return (
        <section style={{ padding: "40px 24px", maxWidth: 1100, margin: "0 auto" }}>
            {heading && <h2 style={{ fontSize: 28, fontWeight: 800, textAlign: "center", marginBottom: 24, color: "#0f172a" }}>{heading}</h2>}
            {items === null ? (
                <p style={{ textAlign: "center", color: "#94a3b8" }}>Memuat…</p>
            ) : items.length === 0 ? (
                <p style={{ textAlign: "center", color: "#94a3b8" }}>Belum ada artikel.</p>
            ) : (
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${columns || 3}, 1fr)`, gap: 20 }}>
                    {items.map((a) => (
                        <a key={a.id} href={`/artikel/${a.slug}`} style={{ textDecoration: "none", color: "inherit", border: "1px solid #eef0f3", borderRadius: 14, overflow: "hidden", background: "#fff", display: "flex", flexDirection: "column" }}>
                            {a.coverImage
                                // eslint-disable-next-line @next/next/no-img-element
                                ? <img src={img(a.coverImage)} alt={a.title} style={{ width: "100%", height: 160, objectFit: "cover" }} />
                                : <div style={{ height: 160, background: "#f1f5f9" }} />}
                            <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, lineHeight: 1.3, color: "#0f172a" }}>{a.title}</h3>
                                {a.excerpt && <p style={{ color: "#64748b", fontSize: 13, margin: 0, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{a.excerpt}</p>}
                                <span style={{ marginTop: "auto", fontSize: 12, color: "#94a3b8" }}>{fmtDate(a.publishedAt)}</span>
                            </div>
                        </a>
                    ))}
                </div>
            )}
            {showAllLink === "on" && (
                <div style={{ textAlign: "center", marginTop: 24 }}>
                    <a href="/artikel" style={{ color: "#4f46e5", fontWeight: 700, textDecoration: "none" }}>Lihat semua artikel →</a>
                </div>
            )}
        </section>
    );
}
