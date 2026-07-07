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
        <main className="mx-auto max-w-[1100px] px-4 py-10 sm:px-6 sm:py-12">
            <h1 className="mb-6 text-3xl font-extrabold tracking-tight sm:mb-7 sm:text-4xl">Artikel</h1>
            {items.length === 0 ? (
                <p className="text-muted-foreground">Belum ada artikel.</p>
            ) : (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((a) => (
                        <Link
                            key={a.id}
                            href={`/artikel/${a.slug}`}
                            className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card text-inherit no-underline shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
                        >
                            {a.coverImage
                                // eslint-disable-next-line @next/next/no-img-element
                                ? <img src={img(a.coverImage)} alt={a.title} className="h-[170px] w-full object-cover" />
                                : <div className="h-[170px] bg-muted" />}
                            <div className="flex flex-1 flex-col gap-2 p-4">
                                <h2 className="text-lg font-bold leading-snug transition-colors group-hover:text-primary">{a.title}</h2>
                                {a.excerpt && <p className="line-clamp-3 text-sm text-muted-foreground">{a.excerpt}</p>}
                                <span className="mt-auto text-xs text-muted-foreground">{fmtDate(a.publishedAt)}{a.authorName ? ` · ${a.authorName}` : ""}</span>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </main>
    );
}
