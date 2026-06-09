import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const img = (u?: string | null) => (!u ? "" : /^https?:/.test(u) ? u : `${API}${u}`);

async function getArticle(slug: string): Promise<any | null> {
    try {
        const r = await fetch(`${API}/articles/public/${encodeURIComponent(slug)}`, { cache: "no-store" });
        if (!r.ok) return null;
        return await r.json();
    } catch {
        return null;
    }
}

function fmtDate(s?: string | null) {
    if (!s) return "";
    try { return new Date(s).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" }); } catch { return ""; }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
    const a = await getArticle(params.slug);
    if (!a) return { title: "Artikel" };
    return {
        title: a.seoTitle || a.title,
        description: a.seoDescription || a.excerpt || undefined,
        openGraph: a.coverImage ? { images: [img(a.coverImage)] } : undefined,
    };
}

export default async function ArtikelDetailPage({ params }: { params: { slug: string } }) {
    const a = await getArticle(params.slug);
    if (!a) notFound();

    return (
        <main style={{ fontFamily: "system-ui, sans-serif", color: "#0f172a" }}>
            <style>{`
.article-content{line-height:1.8;font-size:17px;color:#1f2937}
.article-content:after{content:"";display:block;clear:both}
.article-content h2{font-size:1.6rem;font-weight:800;margin:1.4em 0 .4em}
.article-content h3{font-size:1.25rem;font-weight:700;margin:1.1em 0 .3em}
.article-content p{margin:.8em 0}
.article-content ul{list-style:disc;padding-left:1.5em;margin:.7em 0}
.article-content ol{list-style:decimal;padding-left:1.5em;margin:.7em 0}
.article-content blockquote{border-left:4px solid #cbd5e1;padding-left:1em;color:#64748b;margin:1em 0;font-style:italic}
.article-content img{max-width:100%;border-radius:12px;margin:1em 0}
.article-content a{color:#4f46e5;text-decoration:underline}
`}</style>

            <article style={{ maxWidth: 760, margin: "0 auto", padding: "48px 24px 80px" }}>
                <Link href="/artikel" style={{ color: "#64748b", textDecoration: "none", fontSize: 14 }}>← Semua Artikel</Link>
                <h1 style={{ fontSize: 40, fontWeight: 800, lineHeight: 1.1, margin: "18px 0 10px" }}>{a.title}</h1>
                <p style={{ color: "#94a3b8", fontSize: 14, marginBottom: 24 }}>
                    {fmtDate(a.publishedAt)}{a.authorName ? ` · ${a.authorName}` : ""}
                </p>
                {a.coverImage && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img(a.coverImage)} alt={a.title} style={{ width: "100%", maxHeight: 420, objectFit: "cover", borderRadius: 16, marginBottom: 28 }} />
                )}
                {/* Konten ditulis admin (tepercaya) */}
                <div className="article-content" dangerouslySetInnerHTML={{ __html: a.content || "" }} />
            </article>
        </main>
    );
}
