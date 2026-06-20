"use client";

import { useEffect, useRef } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import LinkExt from "@tiptap/extension-link";
import ImageExt from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import { uploadWorkOrderImage } from "@/lib/api";

// Style float gambar (agar teks bisa di sampingnya)
const IMG_ALIGN: Record<string, string> = {
    left: "float:left;margin:4px 16px 12px 0;max-width:50%;",
    right: "float:right;margin:4px 0 12px 16px;max-width:50%;",
    center: "display:block;margin:12px auto;",
    none: "",
};

// Extend Image: simpan atribut `align` → render jadi style float + data-align (round-trip)
const AlignImage = ImageExt.extend({
    addAttributes() {
        return {
            ...(this.parent?.() as any),
            align: {
                default: null,
                parseHTML: (el: HTMLElement) => el.getAttribute("data-align"),
                renderHTML: (attrs: any) =>
                    attrs.align ? { "data-align": attrs.align, style: IMG_ALIGN[attrs.align] || "" } : {},
            },
        };
    },
});

function Btn({ active, onClick, children, title }: { active?: boolean; onClick: () => void; children: React.ReactNode; title: string }) {
    return (
        <button
            type="button" title={title}
            onMouseDown={(e) => { e.preventDefault(); onClick(); }}
            className={`px-2.5 py-1 rounded text-sm border transition-colors ${active ? "bg-accent text-foreground border-border" : "bg-card text-muted-foreground border-border hover:bg-accent"}`}
        >
            {children}
        </button>
    );
}

function Toolbar({ editor }: { editor: Editor }) {
    const fileRef = useRef<HTMLInputElement>(null);
    const imgActive = editor.isActive("image");
    const imgAlign = (editor.getAttributes("image") as any)?.align;

    const addImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0]; if (!f) return;
        try { const url = await uploadWorkOrderImage(f); const API = process.env.NEXT_PUBLIC_API_URL || ""; editor.chain().focus().setImage({ src: /^https?:/.test(url) ? url : `${API}${url}` }).run(); }
        catch (err: any) { alert("Upload gagal: " + (err?.message || err)); }
        finally { if (fileRef.current) fileRef.current.value = ""; }
    };

    const setLink = () => {
        const prev = editor.getAttributes("link").href as string | undefined;
        const url = window.prompt("URL link:", prev || "https://");
        if (url === null) return;
        if (url === "") { editor.chain().focus().unsetLink().run(); return; }
        editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    };

    const setImgAlign = (a: string) => editor.chain().focus().updateAttributes("image", { align: a }).run();

    return (
        <div className="flex flex-wrap gap-1 p-2 border-b border-border bg-muted sticky top-0 z-10">
            <Btn title="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><b>B</b></Btn>
            <Btn title="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><i>I</i></Btn>
            <span className="w-px bg-border mx-1" />
            <Btn title="Judul H2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</Btn>
            <Btn title="Judul H3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</Btn>
            <span className="w-px bg-border mx-1" />
            {/* Perataan teks */}
            <Btn title="Rata kiri" active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()}>⬅</Btn>
            <Btn title="Rata tengah" active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()}>⬌</Btn>
            <Btn title="Rata kanan" active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()}>➡</Btn>
            <Btn title="Rata kiri-kanan (justify)" active={editor.isActive({ textAlign: "justify" })} onClick={() => editor.chain().focus().setTextAlign("justify").run()}>☰</Btn>
            <span className="w-px bg-border mx-1" />
            <Btn title="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>• List</Btn>
            <Btn title="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. List</Btn>
            <Btn title="Quote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>❝</Btn>
            <span className="w-px bg-border mx-1" />
            <Btn title="Link" active={editor.isActive("link")} onClick={setLink}>🔗</Btn>
            <Btn title="Gambar" onClick={() => fileRef.current?.click()}>🖼️</Btn>
            <input ref={fileRef} type="file" accept="image/*" onChange={addImage} className="hidden" />
            {/* Posisi gambar (muncul saat gambar dipilih) */}
            {imgActive && (
                <>
                    <span className="w-px bg-border mx-1" />
                    <span className="text-[11px] text-muted-foreground self-center mr-1">Gambar:</span>
                    <Btn title="Gambar kiri (teks di kanan)" active={imgAlign === "left"} onClick={() => setImgAlign("left")}>⇤</Btn>
                    <Btn title="Gambar tengah" active={imgAlign === "center"} onClick={() => setImgAlign("center")}>⇆</Btn>
                    <Btn title="Gambar kanan (teks di kiri)" active={imgAlign === "right"} onClick={() => setImgAlign("right")}>⇥</Btn>
                    <Btn title="Gambar normal (lebar penuh)" active={!imgAlign || imgAlign === "none"} onClick={() => setImgAlign("none")}>▭</Btn>
                </>
            )}
            <span className="w-px bg-border mx-1" />
            <Btn title="Undo" onClick={() => editor.chain().focus().undo().run()}>↶</Btn>
            <Btn title="Redo" onClick={() => editor.chain().focus().redo().run()}>↷</Btn>
        </div>
    );
}

export function RichTextEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
    const editor = useEditor({
        extensions: [
            StarterKit,
            LinkExt.configure({ openOnClick: false, autolink: true }),
            AlignImage.configure({ inline: false }),
            TextAlign.configure({ types: ["heading", "paragraph"] }),
        ],
        content: value || "",
        immediatelyRender: false,
        editorProps: { attributes: { class: "article-prose" } },
        onUpdate: ({ editor }) => onChange(editor.getHTML()),
    });

    useEffect(() => {
        if (editor && value && value !== editor.getHTML()) {
            editor.commands.setContent(value, { emitUpdate: false });
        }
    }, [value, editor]);

    return (
        <div className="border border-border rounded-lg overflow-hidden bg-background text-foreground">
            <style>{`
.article-prose{min-height:320px;padding:16px 20px;outline:none;line-height:1.7;color:var(--foreground)}
.article-prose:after{content:"";display:block;clear:both}
.article-prose:focus{outline:none}
.article-prose h2{font-size:1.5rem;font-weight:700;margin:1.2em 0 .4em}
.article-prose h3{font-size:1.2rem;font-weight:700;margin:1em 0 .3em}
.article-prose p{margin:.6em 0}
.article-prose ul{list-style:disc;padding-left:1.4em;margin:.6em 0}
.article-prose ol{list-style:decimal;padding-left:1.4em;margin:.6em 0}
.article-prose blockquote{border-left:3px solid var(--border);padding-left:1em;color:var(--muted-foreground);margin:.8em 0}
.article-prose img{max-width:100%;border-radius:10px;margin:.6em 0}
.article-prose img.ProseMirror-selectednode{outline:2px solid #4f46e5}
.article-prose a{color:#4f46e5;text-decoration:underline}
.article-prose:empty:before{content:"Tulis isi artikel di sini…";color:var(--muted-foreground)}
`}</style>
            {editor && <Toolbar editor={editor} />}
            <EditorContent editor={editor} />
        </div>
    );
}
