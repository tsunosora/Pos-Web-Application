"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Send, Search, MessageSquare, Instagram, Facebook, Settings, Plus, Trash2, X } from "lucide-react";
import {
    listSocialConversations, getSocialMessages, replySocial,
    listSocialChannels, createSocialChannel, deleteSocialChannel, detectSocialInstagram, listPagesFromToken,
    PLATFORM_LABEL, type FbPage,
    type SocialPlatform, type SocialConversation, type SocialMessage, type SocialChannel, type CreateSocialChannelBody,
} from "@/lib/api/social";
import { getBranches } from "@/lib/api/settings";

function timeAgo(iso: string | null): string {
    if (!iso) return "";
    const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (m < 1) return "baru";
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}j`;
    return `${Math.floor(h / 24)}h`;
}
const contactName = (c: SocialConversation["contact"]) => c.name || `${c.platform === "INSTAGRAM" ? "IG" : "FB"} ${c.externalId.slice(-6)}`;
const PlatformIcon = ({ p, className }: { p: SocialPlatform; className?: string }) =>
    p === "INSTAGRAM" ? <Instagram className={className} /> : <Facebook className={className} />;

export default function SocialInboxPage() {
    const qc = useQueryClient();
    const [platform, setPlatform] = useState<SocialPlatform | "ALL">("ALL");
    const [search, setSearch] = useState("");
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [draft, setDraft] = useState("");
    const [showChannels, setShowChannels] = useState(false);

    const { data: convData, isLoading } = useQuery({
        queryKey: ["social-convos", platform, search],
        queryFn: () => listSocialConversations({ platform: platform === "ALL" ? undefined : platform, q: search.trim() || undefined, take: 50 }),
        refetchInterval: 8000,
    });
    const conversations = convData?.items ?? [];
    const selected = useMemo(() => conversations.find((c) => c.id === selectedId) ?? null, [conversations, selectedId]);

    const { data: msgData } = useQuery({
        queryKey: ["social-messages", selectedId],
        queryFn: () => getSocialMessages(selectedId as number, { take: 50 }),
        enabled: selectedId != null,
        refetchInterval: 5000,
    });
    const messages = msgData?.items ?? [];
    const bottomRef = useRef<HTMLDivElement>(null);
    useEffect(() => { bottomRef.current?.scrollIntoView(); }, [messages.length, selectedId]);
    useEffect(() => { setDraft(""); }, [selectedId]);
    useEffect(() => { if (selectedId != null) qc.invalidateQueries({ queryKey: ["social-convos"] }); }, [msgData, selectedId, qc]);

    const replyMut = useMutation({
        mutationFn: (text: string) => replySocial(selectedId as number, text),
        onSuccess: () => {
            setDraft("");
            qc.invalidateQueries({ queryKey: ["social-messages", selectedId] });
            qc.invalidateQueries({ queryKey: ["social-convos"] });
        },
        onError: (e: unknown) => alert((e as { response?: { data?: { message?: string } } })?.response?.data?.message || "Gagal mengirim"),
    });
    const send = () => { if (draft.trim() && !replyMut.isPending) replyMut.mutate(draft.trim()); };

    return (
        <div className="flex h-[calc(100vh-8rem)] gap-3 p-3">
            <aside className="w-full max-w-sm flex flex-col rounded-2xl border border-border bg-card/60 overflow-hidden">
                <div className="p-3 border-b border-border space-y-2">
                    <div className="flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-pink-500" />
                        <h1 className="font-semibold">Inbox Sosial</h1>
                        <button onClick={() => setShowChannels(true)} title="Kelola channel" className="ml-auto p-1.5 rounded-lg hover:bg-muted">
                            <Settings className="w-4 h-4 opacity-70" />
                        </button>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50" />
                        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama…"
                            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-muted/60 text-sm outline-none" />
                    </div>
                    <div className="flex gap-1">
                        {(["ALL", "MESSENGER", "INSTAGRAM"] as const).map((p) => (
                            <button key={p} onClick={() => setPlatform(p)}
                                className={`px-2.5 py-1 rounded-full text-xs ${platform === p ? "bg-primary text-primary-foreground" : "bg-muted/60 hover:bg-muted"}`}>
                                {p === "ALL" ? "Semua" : PLATFORM_LABEL[p]}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {isLoading && <p className="text-sm opacity-60 p-3">Memuat…</p>}
                    {!isLoading && conversations.length === 0 && <p className="text-sm opacity-60 p-3">Belum ada percakapan.</p>}
                    {conversations.map((c) => (
                        <button key={c.id} onClick={() => setSelectedId(c.id)}
                            className={`w-full text-left px-3 py-2.5 border-b border-border/50 hover:bg-muted/40 flex gap-3 ${selectedId === c.id ? "bg-muted/60" : ""}`}>
                            <div className="w-10 h-10 rounded-full bg-pink-500/15 grid place-items-center text-pink-600 shrink-0">
                                <PlatformIcon p={c.contact.platform} className="w-5 h-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="font-medium truncate">{contactName(c.contact)}</span>
                                    <span className="text-[10px] opacity-50 shrink-0">{timeAgo(c.lastMessageAt)}</span>
                                </div>
                                <div className="flex items-center justify-between gap-2 mt-0.5">
                                    <span className="text-[11px] opacity-60 truncate">{PLATFORM_LABEL[c.contact.platform]}{c.assignedTo?.name ? ` · ${c.assignedTo.name}` : ""}</span>
                                    {c.unreadCount > 0 && <span className="bg-pink-500 text-white text-[10px] rounded-full px-1.5 min-w-[18px] text-center shrink-0">{c.unreadCount}</span>}
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </aside>

            <section className="flex-1 flex flex-col rounded-2xl border border-border bg-card/60 overflow-hidden">
                {!selected ? (
                    <div className="flex-1 grid place-items-center opacity-50 text-sm">Pilih percakapan untuk mulai membalas.</div>
                ) : (
                    <>
                        <header className="p-3 border-b border-border flex items-center gap-2">
                            <PlatformIcon p={selected.contact.platform} className="w-5 h-5 text-pink-500" />
                            <div className="min-w-0">
                                <div className="font-semibold truncate">{contactName(selected.contact)}</div>
                                <div className="text-xs opacity-60">{PLATFORM_LABEL[selected.contact.platform]} · {selected.channel.label}</div>
                            </div>
                        </header>
                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {messages.map((m: SocialMessage) => {
                                const out = m.direction === "OUTBOUND";
                                return (
                                    <div key={m.id} className={`flex ${out ? "justify-end" : "justify-start"}`}>
                                        <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${out ? "bg-emerald-500 text-white" : "bg-muted"}`}>
                                            {m.mediaUrl && m.type !== "TEXT" && (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={m.mediaUrl} alt="lampiran" className="rounded-lg max-w-full max-h-60 mb-1 object-contain" />
                                            )}
                                            {m.body && <div className="whitespace-pre-wrap break-words">{m.body}</div>}
                                            <div className={`text-[10px] mt-0.5 ${out ? "text-white/70" : "opacity-50"}`}>
                                                {new Date(m.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                                                {out && m.sentBy?.name ? ` · ${m.sentBy.name}` : ""}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={bottomRef} />
                        </div>
                        <form className="p-3 border-t border-border flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); send(); }}>
                            <textarea value={draft} onChange={(e) => setDraft(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                                rows={1} placeholder="Ketik balasan… (Enter kirim)"
                                className="flex-1 resize-none rounded-xl bg-muted/60 px-3 py-2 text-sm outline-none max-h-32" />
                            <button type="submit" disabled={!draft.trim() || replyMut.isPending}
                                className="rounded-xl bg-emerald-500 text-white p-2.5 disabled:opacity-40 hover:bg-emerald-600 shrink-0">
                                <Send className="w-4 h-4" />
                            </button>
                        </form>
                        <p className="text-[11px] opacity-50 text-center pb-2">Catatan: balasan hanya sah dalam jendela 24 jam (aturan Meta).</p>
                    </>
                )}
            </section>

            {showChannels && <ChannelManager onClose={() => setShowChannels(false)} />}
        </div>
    );
}

function ChannelManager({ onClose }: { onClose: () => void }) {
    const qc = useQueryClient();
    const [form, setForm] = useState<CreateSocialChannelBody>({ label: "", platform: "MESSENGER", pageId: "", igId: "", accessToken: "", branchId: null });
    const { data: channels = [] } = useQuery({ queryKey: ["social-channels"], queryFn: listSocialChannels });
    const { data: branches = [] } = useQuery({ queryKey: ["branches"], queryFn: getBranches });
    const invalidate = () => qc.invalidateQueries({ queryKey: ["social-channels"] });
    const createMut = useMutation({
        mutationFn: () => createSocialChannel(form),
        onSuccess: () => { setForm({ label: "", platform: "MESSENGER", pageId: "", igId: "", accessToken: "", branchId: null }); invalidate(); },
        onError: (e: unknown) => alert((e as { response?: { data?: { message?: string } } })?.response?.data?.message || "Gagal menambah channel"),
    });
    const delMut = useMutation({ mutationFn: (id: number) => deleteSocialChannel(id), onSuccess: invalidate });
    const detectMut = useMutation({
        mutationFn: () => detectSocialInstagram(form.pageId.trim(), form.accessToken.trim()),
        onSuccess: (ig) => setForm((f) => ({ ...f, igId: ig.id, label: f.label || ig.username || ig.name || f.label })),
        onError: (e: unknown) => alert((e as { response?: { data?: { message?: string } } })?.response?.data?.message || "Gagal deteksi IG"),
    });

    // Ambil Page + token otomatis dari 1 token login.
    const [loginToken, setLoginToken] = useState("");
    const [pages, setPages] = useState<FbPage[]>([]);
    const pagesMut = useMutation({
        mutationFn: () => listPagesFromToken(loginToken.trim()),
        onSuccess: (p) => setPages(p),
        onError: (e: unknown) => alert((e as { response?: { data?: { message?: string } } })?.response?.data?.message || "Gagal ambil Page"),
    });
    const usePage = (p: FbPage) => {
        setForm((f) => ({
            ...f,
            pageId: p.id,
            accessToken: p.accessToken,
            igId: p.ig?.id ?? f.igId,
            label: f.label || (f.platform === "INSTAGRAM" ? (p.ig?.username || p.name) : p.name),
        }));
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
            <div className="w-full max-w-lg max-h-[88vh] flex flex-col rounded-2xl border border-border bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-2 p-4 border-b border-border">
                    <Settings className="w-5 h-5 text-pink-500" />
                    <h2 className="font-semibold">Channel Messenger / Instagram</h2>
                    <button onClick={onClose} className="ml-auto p-1 rounded-lg hover:bg-muted"><X className="w-4 h-4" /></button>
                </div>
                <div className="overflow-y-auto p-4 space-y-4">
                    <p className="text-xs opacity-60">
                        Daftarkan Page (Messenger) / akun IG. Set webhook Meta ke <code>/social/webhook</code>.
                    </p>

                    {/* Cara mudah: tempel 1 token login → ambil Page + token otomatis */}
                    <div className="rounded-xl border border-dashed border-border bg-card/40 p-3 space-y-2">
                        <div className="text-sm font-medium">⚡ Ambil Page otomatis</div>
                        <p className="text-[11px] opacity-60">Tempel <b>token login</b> (User/System User dengan izin <code>pages_show_list</code> + <code>pages_messaging</code>) → aplikasi ambilkan Page ID, Page Access Token, &amp; IG ID.</p>
                        <div className="flex gap-2">
                            <input type="password" value={loginToken} onChange={(e) => setLoginToken(e.target.value)} placeholder="Tempel token login…"
                                className="flex-1 rounded-lg bg-muted/60 px-3 py-1.5 text-sm outline-none font-mono" />
                            <button type="button" onClick={() => pagesMut.mutate()} disabled={pagesMut.isPending || !loginToken.trim()}
                                className="text-sm px-3 py-1.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-50 whitespace-nowrap">
                                {pagesMut.isPending ? "Mengambil…" : "Ambil Page"}
                            </button>
                        </div>
                        {pages.length > 0 && (
                            <div className="space-y-1">
                                {pages.map((p) => (
                                    <button key={p.id} type="button" onClick={() => usePage(p)}
                                        className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted text-sm">
                                        <Facebook className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                        <span className="min-w-0 flex-1 truncate">{p.name} {p.ig ? <span className="text-pink-500">· IG @{p.ig.username || p.ig.id}</span> : ""}</span>
                                        <span className="text-[11px] opacity-60 shrink-0">pakai →</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="grid sm:grid-cols-2 gap-2">
                        <label className="text-sm">Label
                            <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Voliko FB / IG"
                                className="mt-1 w-full rounded-lg bg-muted/60 px-3 py-2 outline-none" />
                        </label>
                        <label className="text-sm">Platform
                            <select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value as SocialPlatform })}
                                className="mt-1 w-full rounded-lg bg-muted/60 px-3 py-2 outline-none">
                                <option value="MESSENGER">Messenger</option>
                                <option value="INSTAGRAM">Instagram</option>
                            </select>
                        </label>
                        <label className="text-sm">Page ID
                            <input value={form.pageId} onChange={(e) => setForm({ ...form, pageId: e.target.value })} placeholder="1234567890"
                                className="mt-1 w-full rounded-lg bg-muted/60 px-3 py-2 outline-none" />
                        </label>
                        {form.platform === "INSTAGRAM" && (
                            <label className="text-sm">IG business ID
                                <div className="mt-1 flex gap-2">
                                    <input value={form.igId ?? ""} onChange={(e) => setForm({ ...form, igId: e.target.value })} placeholder="17841400000"
                                        className="flex-1 rounded-lg bg-muted/60 px-3 py-2 outline-none" />
                                    <button type="button" onClick={() => detectMut.mutate()} disabled={detectMut.isPending || !form.pageId.trim() || !form.accessToken.trim()}
                                        className="text-xs px-2.5 py-1 rounded-lg bg-muted hover:bg-muted/70 disabled:opacity-50 whitespace-nowrap">
                                        {detectMut.isPending ? "Deteksi…" : "Deteksi dari Page"}
                                    </button>
                                </div>
                                <span className="text-[11px] opacity-50">Isi Page ID + token dulu, lalu klik Deteksi.</span>
                            </label>
                        )}
                        <label className="text-sm sm:col-span-2">Page Access Token
                            <input type="password" value={form.accessToken} onChange={(e) => setForm({ ...form, accessToken: e.target.value })} placeholder="EAAG…"
                                className="mt-1 w-full rounded-lg bg-muted/60 px-3 py-2 outline-none font-mono" />
                        </label>
                        <label className="text-sm sm:col-span-2">Cabang
                            <select value={form.branchId ?? ""} onChange={(e) => setForm({ ...form, branchId: e.target.value ? +e.target.value : null })}
                                className="mt-1 w-full rounded-lg bg-muted/60 px-3 py-2 outline-none">
                                <option value="">Semua cabang</option>
                                {branches.map((b: { id: number; name: string }) => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                        </label>
                    </div>
                    <button onClick={() => createMut.mutate()} disabled={createMut.isPending || !form.label.trim() || !form.pageId.trim() || !form.accessToken.trim()}
                        className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-50">
                        <Plus className="w-4 h-4" /> Tambah channel
                    </button>

                    <div className="space-y-1.5">
                        {channels.map((ch: SocialChannel) => (
                            <div key={ch.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                                <PlatformIcon p={ch.platform} className="w-4 h-4 text-pink-500" />
                                <div className="min-w-0 flex-1">
                                    <div className="truncate">{ch.label} <span className="text-xs opacity-50">({PLATFORM_LABEL[ch.platform]})</span></div>
                                    <div className="text-[11px] opacity-50 font-mono truncate">Page {ch.pageId}{ch.igId ? ` · IG ${ch.igId}` : ""}</div>
                                </div>
                                <button onClick={() => { if (confirm(`Hapus channel "${ch.label}"?`)) delMut.mutate(ch.id); }} className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-500"><Trash2 className="w-4 h-4" /></button>
                            </div>
                        ))}
                        {channels.length === 0 && <p className="text-xs opacity-60">Belum ada channel.</p>}
                    </div>
                </div>
            </div>
        </div>
    );
}
