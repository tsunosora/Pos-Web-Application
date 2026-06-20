"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getArticle, createArticle, updateArticle, uploadWorkOrderImage, resolvePhotoUrl, type ArticleInput } from "@/lib/api";
import { RichTextEditor } from "@/components/articles/RichTextEditor";
import { ArrowLeft, Save, Rocket, Loader2, ImageIcon, ExternalLink } from "lucide-react";

const EMPTY: ArticleInput & { content: string } = {
    title: "", slug: "", excerpt: "", content: "", coverImage: "", status: "DRAFT", authorName: "", seoTitle: "", seoDescription: "",
};

export default function ArticleEditorPage() {
    const params = useParams();
    const router = useRouter();
    const idParam = String(params?.id || "new");
    const isNew = idParam === "new";
    const id = isNew ? 0 : parseInt(idParam, 10);

    const [form, setForm] = useState<any>(EMPTY);
    const [loaded, setLoaded] = useState(isNew);
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState("");
    const [slug, setSlug] = useState<string>("");
    const coverRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isNew) return;
        getArticle(id).then((a) => {
            setForm({
                title: a.title, slug: a.slug, excerpt: a.excerpt || "", content: a.content || "",
                coverImage: a.coverImage || "", status: a.status, authorName: a.authorName || "",
                seoTitle: a.seoTitle || "", seoDescription: a.seoDescription || "",
            });
            setSlug(a.slug);
            setLoaded(true);
        }).catch(() => { alert("Artikel tidak ditemukan"); router.push("/articles"); });
    }, [id, isNew, router]);

    const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
    const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 3000); };

    const uploadCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0]; if (!f) return;
        try { const url = await uploadWorkOrderImage(f); set("coverImage", url); }
        catch (err: any) { alert("Upload gagal: " + (err?.message || err)); }
        finally { if (coverRef.current) coverRef.current.value = ""; }
    };

    const save = async (status?: "DRAFT" | "PUBLISHED") => {
        if (!form.title?.trim()) { flash("❌ Judul wajib diisi"); return; }
        setBusy(true);
        const payload: ArticleInput = { ...form, status: status ?? form.status };
        try {
            if (isNew) {
                const created = await createArticle(payload);
                flash("✅ Tersimpan");
                router.replace(`/articles/edit/${created.id}`);
            } else {
                const updated = await updateArticle(id, payload);
                setForm((f: any) => ({ ...f, status: updated.status }));
                setSlug(updated.slug);
                flash(status === "PUBLISHED" ? "🚀 Diterbitkan" : status === "DRAFT" ? "Disimpan sebagai draft" : "✅ Tersimpan");
            }
        } catch (e: any) {
            flash("❌ " + (e?.response?.data?.message || e?.message || e));
        } finally { setBusy(false); }
    };

    if (!loaded) return <div className="py-16 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

    const coverSrc = form.coverImage ? (resolvePhotoUrl(form.coverImage) || form.coverImage) : null;
    const lbl = "block text-xs font-semibold text-muted-foreground mb-1";
    const inp = "w-full border border-border rounded-lg px-3 py-2 text-sm";

    return (
        <div className="space-y-5 max-w-3xl">
            {/* Header */}
            <div className="flex items-center justify-between gap-3">
                <Link href="/articles" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Artikel</Link>
                <div className="flex items-center gap-2">
                    {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
                    {!isNew && form.status === "PUBLISHED" && (
                        <a href={`/artikel/${slug}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border hover:bg-muted"><ExternalLink className="h-4 w-4" /> Lihat</a>
                    )}
                    <button onClick={() => save("DRAFT")} disabled={busy} className="px-3 py-1.5 rounded-lg text-sm border hover:bg-muted disabled:opacity-50 flex items-center gap-1.5"><Save className="h-4 w-4" /> Draft</button>
                    <button onClick={() => save("PUBLISHED")} disabled={busy} className="px-4 py-1.5 rounded-lg text-sm bg-primary text-primary-foreground font-semibold hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5"><Rocket className="h-4 w-4" /> Terbitkan</button>
                </div>
            </div>

            <div className="bg-card border rounded-xl p-5 space-y-4">
                <div>
                    <label className={lbl}>Judul</label>
                    <input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Judul artikel" className={`${inp} text-lg font-semibold`} />
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                        <label className={lbl}>Slug (URL) — kosongkan untuk otomatis</label>
                        <input value={form.slug} onChange={(e) => set("slug", e.target.value)} placeholder="otomatis-dari-judul" className={`${inp} font-mono`} />
                    </div>
                    <div>
                        <label className={lbl}>Penulis</label>
                        <input value={form.authorName} onChange={(e) => set("authorName", e.target.value)} placeholder="Nama penulis" className={inp} />
                    </div>
                </div>

                {/* Cover */}
                <div>
                    <label className={lbl}>Gambar Sampul</label>
                    <div className="flex items-center gap-3">
                        <div className="w-32 h-20 rounded-lg border bg-muted overflow-hidden flex items-center justify-center">
                            {coverSrc
                                // eslint-disable-next-line @next/next/no-img-element
                                ? <img src={coverSrc} alt="" className="w-full h-full object-cover" />
                                : <ImageIcon className="h-5 w-5 text-muted-foreground/40" />}
                        </div>
                        <input ref={coverRef} type="file" accept="image/*" onChange={uploadCover} className="hidden" />
                        <button onClick={() => coverRef.current?.click()} className="px-3 py-1.5 rounded-lg text-sm border hover:bg-muted">Unggah</button>
                        {form.coverImage && <button onClick={() => set("coverImage", "")} className="text-xs text-red-600">Hapus</button>}
                    </div>
                </div>

                <div>
                    <label className={lbl}>Ringkasan (excerpt)</label>
                    <textarea rows={2} value={form.excerpt} onChange={(e) => set("excerpt", e.target.value)} placeholder="Ringkasan singkat untuk kartu & SEO" className={inp} />
                </div>

                <div>
                    <label className={lbl}>Isi Artikel</label>
                    <RichTextEditor value={form.content} onChange={(html) => set("content", html)} />
                </div>
            </div>

            {/* SEO */}
            <div className="bg-card border rounded-xl p-5 space-y-3">
                <h2 className="font-semibold text-sm">SEO (opsional)</h2>
                <div>
                    <label className={lbl}>Judul SEO</label>
                    <input value={form.seoTitle} onChange={(e) => set("seoTitle", e.target.value)} placeholder="Default: judul artikel" className={inp} />
                </div>
                <div>
                    <label className={lbl}>Deskripsi SEO</label>
                    <textarea rows={2} value={form.seoDescription} onChange={(e) => set("seoDescription", e.target.value)} placeholder="Default: ringkasan" className={inp} />
                </div>
            </div>
        </div>
    );
}
