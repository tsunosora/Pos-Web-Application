import Link from "next/link";
import type { Metadata } from "next";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const img = (u?: string | null) => (!u ? "" : /^https?:/.test(u) ? u : `${API}${u}`);

export const metadata: Metadata = { title: "Artikel" };

async function getList(): Promise<any[]> {
    try {
        const r = await fetch(`${API}/articles/public`, { cache: "no-store" });
        const d = await r.json();
        return Array.isArray(d) ? d : [];
    } catch {
        return [];
    }
}

function fmtDate(s?: string | null) {
    if (!s) return "";
    try { return new Date(s).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" }); } catch { return ""; }
}

export default async function ArtikelListPage() {
    const items = await getList();
    return (
        <main style={{ fontFamily: "system-ui, sans-serif", color: "#0f172a", maxWidth: 1100, margin: "0 auto", padding: "48px 24px" }}>
            <h1 style={{ fontSize: 36, fontWeight: 800, marginBottom: 28 }}>Artikel</h1>
            {items.length === 0 ? (
                <p style={{ color: "#94a3b8" }}>Belum ada artikel.</p>
            ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 24 }}>
                    {items.map((a) => (
                        <Link key={a.id} href={`/artikel/${a.slug}`} style={{ textDecoration: "none", color: "inherit", border: "1px solid #eef0f3", borderRadius: 16, overflow: "hidden", background: "#fff", display: "flex", flexDirection: "column" }}>
                            {a.coverImage
                                // eslint-disable-next-line @next/next/no-img-element
                                ? <img src={img(a.coverImage)} alt={a.title} style={{ width: "100%", height: 170, objectFit: "cover" }} />
                                : <div style={{ height: 170, background: "#f1f5f9" }} />}
                            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                                <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, lineHeight: 1.3 }}>{a.title}</h2>
                                {a.excerpt && <p style={{ color: "#64748b", fontSize: 14, margin: 0, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{a.excerpt}</p>}
                                <span style={{ marginTop: "auto", fontSize: 12, color: "#94a3b8" }}>{fmtDate(a.publishedAt)}{a.authorName ? ` · ${a.authorName}` : ""}</span>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </main>
    );
}
