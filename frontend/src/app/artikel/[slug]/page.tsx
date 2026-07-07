import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

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
        <main className="text-foreground">
            {/* Konten artikel di-render via dangerouslySetInnerHTML, jadi styling
                pakai scoped <style> dengan CSS variable token agar tema-aware. */}
            <style>{`
.article-content{line-height:1.8;font-size:1.0625rem;color:var(--foreground)}
.article-content:after{content:"";display:block;clear:both}
.article-content h2{font-size:1.6rem;font-weight:800;margin:1.4em 0 .4em}
.article-content h3{font-size:1.25rem;font-weight:700;margin:1.1em 0 .3em}
.article-content p{margin:.8em 0}
.article-content ul{list-style:disc;padding-left:1.5em;margin:.7em 0}
.article-content ol{list-style:decimal;padding-left:1.5em;margin:.7em 0}
.article-content blockquote{border-left:4px solid var(--border);padding-left:1em;color:var(--muted-foreground);margin:1em 0;font-style:italic}
.article-content img{max-width:100%;border-radius:12px;margin:1em 0}
.article-content a{color:var(--accent-foreground);text-decoration:underline;font-weight:500}
`}</style>

            <article className="mx-auto max-w-[760px] px-4 pb-20 pt-10 sm:px-6 sm:pt-12">
                <Link href="/artikel" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground no-underline transition-colors hover:text-foreground">
                    <ArrowLeft className="h-4 w-4" /> Semua Artikel
                </Link>
                <h1 className="mb-2.5 mt-4 text-3xl font-extrabold leading-tight sm:text-[40px]">{a.title}</h1>
                <p className="mb-6 text-sm text-muted-foreground">
                    {fmtDate(a.publishedAt)}{a.authorName ? ` · ${a.authorName}` : ""}
                </p>
                {a.coverImage && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img(a.coverImage)} alt={a.title} className="mb-7 max-h-[420px] w-full rounded-2xl object-cover" />
                )}
                {/* Konten ditulis admin (tepercaya) */}
                <div className="article-content" dangerouslySetInnerHTML={{ __html: a.content || "" }} />
            </article>
        </main>
    );
}
