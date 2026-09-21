"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Send, Search, MessageSquare, Instagram, Facebook, Settings, Plus, Trash2, X, ArrowLeft, ExternalLink,
    RefreshCw, EyeOff, Eye, MailOpen, CheckCheck, Reply, UserPlus, Radio, KeyRound, Info, Clock,
} from "lucide-react";
import {
    listSocialConversations, getSocialMessages, replySocial,
    listSocialChannels, createSocialChannel, updateSocialChannel, deleteSocialChannel, listPagesFromToken, testSocialConnection, getSocialWebhookDebug,
    getSocialCounts, createLeadFromSocialContact, subscribeSocialChannel,
    listSocialComments, getSocialCommentThread, replySocialComment, hideSocialComment, updateSocialCommentThread,
    createLeadFromSocialComment, syncSocialComments, getSocialSyncStatus,
    PLATFORM_LABEL, type FbPage, type CommentFilter, type CommentSyncResult, type CommentSyncStatus,
    type SocialPlatform, type SocialConversation, type SocialMessage, type SocialChannel, type CreateSocialChannelBody,
    type SocialComment, type SocialCommentThread,
} from "@/lib/api/social";
import { LEAD_STATUS_LABEL, type LeadStatus } from "@/lib/api/crm";
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
const fmtTime = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
const errMsg = (e: unknown, fallback: string) =>
    (e as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;
const contactName = (c: SocialConversation["contact"]) => c.name || `${c.platform === "INSTAGRAM" ? "IG" : "FB"} ${c.externalId.slice(-6)}`;
const authorLabel = (c: Pick<SocialComment, "authorName">, platform: SocialPlatform) =>
    c.authorName ? (platform === "INSTAGRAM" ? `@${c.authorName}` : c.authorName) : "Pengguna";
/** Token IG Login berawalan "IG", token Facebook/Page berawalan "EAA" — salah tempel = "Cannot parse access token". */
function tokenMismatch(platform: SocialPlatform, token: string): string | null {
    const t = token.trim();
    if (platform === "MESSENGER" && /^IG/.test(t)) return "Ini token Instagram (IG…). Ubah Platform menjadi Instagram, lalu tempel di kolom Access Token.";
    if (platform === "INSTAGRAM" && /^EAA/.test(t)) return "Ini token Facebook (EAA…). Untuk Instagram pakai token dari App Dashboard → Instagram → “Buat token akses” (berawalan IG…).";
    return null;
}
/**
 * Pesan otomatis Meta ("Facebook membuat obrolan ini karena X mengomentari postingan
 * Anda…") — bukan tulisan pelanggan. Pesan lama mungkin belum bertipe SYSTEM, jadi
 * dikenali juga dari teksnya.
 */
const NOTICE_RE = /^(Facebook|Instagram|Meta) (membuat obrolan ini|created this (chat|conversation))\b/i;
const isNotice = (m: SocialMessage) => m.type === "SYSTEM" || (!!m.body && NOTICE_RE.test(m.body.trim()));
function splitNotice(body: string | null): { text: string; url: string | null } {
    const b = body ?? "";
    const url = b.match(/\((https?:\/\/[^\s)]+)\)\s*$/)?.[1] ?? null;
    return { text: url ? b.slice(0, b.lastIndexOf("(" + url)).replace(/\s*(Lihat komentar|See comment|View comment)\s*$/i, "").trim() : b.trim(), url };
}
/**
 * Jendela balas Meta: DM hanya boleh dibalas lewat API dalam 24 jam sejak pesan
 * terakhir pelanggan. `undefined` = belum diketahui (data lama di cache) → jangan blokir.
 */
const REPLY_WINDOW_MS = 24 * 3600 * 1000;
function replyWindow(lastInboundAt: string | null | undefined): { known: boolean; open: boolean; leftMs: number; until: Date | null } {
    if (lastInboundAt === undefined) return { known: false, open: true, leftMs: 0, until: null };
    if (!lastInboundAt) return { known: true, open: false, leftMs: 0, until: null };
    const until = new Date(new Date(lastInboundAt).getTime() + REPLY_WINDOW_MS);
    const leftMs = until.getTime() - Date.now();
    return { known: true, open: leftMs > 0, leftMs, until };
}
const fmtLeft = (ms: number) => {
    const m = Math.max(1, Math.floor(ms / 60000));
    return m < 60 ? `${m} menit` : `${Math.floor(m / 60)} jam`;
};
/** Buka percakapan di aplikasi Meta (jendela 24 jam tidak berlaku di sana). */
function openInAppUrl(c: SocialConversation): string {
    if (c.contact.platform === "INSTAGRAM") {
        return c.contact.name && /^[A-Za-z0-9._]+$/.test(c.contact.name) ? `https://ig.me/m/${c.contact.name}` : "https://www.instagram.com/direct/inbox/";
    }
    return `https://business.facebook.com/latest/inbox/all${c.channel.pageId ? `?asset_id=${c.channel.pageId}` : ""}`;
}
const PlatformIcon = ({ p, className }: { p: SocialPlatform; className?: string }) =>
    p === "INSTAGRAM" ? <Instagram className={className} /> : <Facebook className={className} />;

function Avatar({ name, platform }: { name: string; platform: SocialPlatform }) {
    return (
        <div className="relative w-10 h-10 shrink-0">
            <div className="w-10 h-10 rounded-full bg-pink-500/15 grid place-items-center text-pink-600 font-semibold text-sm uppercase">
                {name.replace(/^@/, "").charAt(0) || "?"}
            </div>
            <span className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full grid place-items-center ring-2 ring-card ${platform === "INSTAGRAM" ? "bg-pink-500" : "bg-blue-600"}`}>
                <PlatformIcon p={platform} className="w-2.5 h-2.5 text-white" />
            </span>
        </div>
    );
}

function PanelSection({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="p-4 border-b border-border/60 space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide opacity-60">{title}</h3>
            {children}
        </section>
    );
}

/** Blok "Tahapan prospek": tautan ke prospek CRM, atau tombol untuk membuatnya. */
function LeadBlock({ lead, pending, onCreate }: { lead: { id: number; name: string; status: string } | null | undefined; pending: boolean; onCreate: () => void }) {
    if (lead) {
        return (
            <Link href={`/crm/leads?leadId=${lead.id}`} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted/50">
                <span className="truncate">{lead.name}</span>
                <span className="text-[11px] rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 shrink-0">
                    {LEAD_STATUS_LABEL[lead.status as LeadStatus] ?? lead.status}
                </span>
            </Link>
        );
    }
    return (
        <>
            <p className="text-xs opacity-60">Belum tercatat sebagai prospek.</p>
            <button onClick={onCreate} disabled={pending}
                className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm disabled:opacity-50">
                <UserPlus className="w-4 h-4" /> {pending ? "Menyimpan…" : "Tandai sebagai prospek"}
            </button>
        </>
    );
}

type Tab = "ALL" | "MESSENGER" | "INSTAGRAM" | "FB_COMMENTS" | "IG_COMMENTS";

interface SyncControl { run: () => void; pending: boolean; status?: CommentSyncStatus }

/** Keterangan sinkron otomatis + tombol Sinkronkan + error channel (di atas daftar DM & komentar). */
function SyncBar({ sync, platform }: { sync: SyncControl; platform?: SocialPlatform }) {
    const errors = (sync.status?.results ?? []).filter((r) => r.error && (!platform || r.platform === platform));
    return (
        <>
            <div className="flex items-center gap-2 text-[11px]">
                <span className="opacity-60 min-w-0 truncate" title="DM & komentar juga masuk seketika lewat webhook bila Meta mengirimnya">
                    {sync.status?.intervalMinutes ? `Otomatis tiap ${sync.status.intervalMinutes} menit` : "Sinkron otomatis mati"}
                    {sync.status?.lastSyncAt ? ` · terakhir ${timeAgo(sync.status.lastSyncAt) === "baru" ? "barusan" : `${timeAgo(sync.status.lastSyncAt)} lalu`}` : ""}
                </span>
                <button onClick={sync.run} disabled={sync.pending}
                    className="ml-auto shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg bg-muted/70 hover:bg-muted disabled:opacity-50">
                    <RefreshCw className={`w-3.5 h-3.5 ${sync.pending ? "animate-spin" : ""}`} /> {sync.pending ? "Menyinkronkan…" : "Sinkronkan"}
                </button>
            </div>
            {errors.map((r) => (
                <p key={r.channelId} className="text-[11px] text-red-600 dark:text-red-400 break-words">{r.label}: {r.error}</p>
            ))}
        </>
    );
}

export default function SocialInboxPage() {
    const qc = useQueryClient();
    const [tab, setTab] = useState<Tab>("ALL");
    const [showChannels, setShowChannels] = useState(false);
    const [syncResult, setSyncResult] = useState<CommentSyncResult | null>(null);

    const { data: counts } = useQuery({ queryKey: ["social-counts"], queryFn: getSocialCounts, refetchInterval: 15000 });
    const badge: Record<Tab, number> = {
        ALL: (counts?.dm.MESSENGER ?? 0) + (counts?.dm.INSTAGRAM ?? 0),
        MESSENGER: counts?.dm.MESSENGER ?? 0,
        INSTAGRAM: counts?.dm.INSTAGRAM ?? 0,
        FB_COMMENTS: counts?.comments.MESSENGER ?? 0,
        IG_COMMENTS: counts?.comments.INSTAGRAM ?? 0,
    };

    const { data: syncStatus } = useQuery({ queryKey: ["social-sync-status"], queryFn: getSocialSyncStatus, refetchInterval: 60000 });
    const syncMut = useMutation({
        mutationFn: syncSocialComments,
        onSuccess: (r) => {
            setSyncResult(r);
            qc.invalidateQueries({ queryKey: ["social-comments"] });
            qc.invalidateQueries({ queryKey: ["social-convos"] });
            qc.invalidateQueries({ queryKey: ["social-counts"] });
            qc.invalidateQueries({ queryKey: ["social-sync-status"] });
        },
        onError: (e: unknown) => alert(errMsg(e, "Gagal sinkron komentar")),
    });

    const tabBtn = (key: Tab, label: string) => (
        <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm whitespace-nowrap border-b-2 -mb-px ${tab === key ? "border-primary font-medium" : "border-transparent opacity-70 hover:opacity-100"}`}>
            {label}
            {badge[key] > 0 && <span className="bg-pink-500 text-white text-[10px] rounded-full px-1.5 min-w-[18px] text-center">{badge[key]}</span>}
        </button>
    );

    return (
        <div className="flex flex-col h-[calc(100dvh-8rem)] gap-2 p-2 md:p-3">
            <div className="flex items-center gap-2 flex-wrap">
                <MessageSquare className="w-5 h-5 text-pink-500" />
                <h1 className="font-semibold">Inbox Sosial</h1>
                <span className="text-xs opacity-60 hidden sm:inline">DM &amp; komentar Instagram / Facebook dalam satu tempat</span>
                <div className="ml-auto flex items-center gap-1.5">
                    <button onClick={() => syncMut.mutate()} disabled={syncMut.isPending}
                        title="Tarik komentar & DM terbaru dari Instagram/Facebook (juga berjalan otomatis tiap 5 menit)"
                        className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-muted/70 hover:bg-muted disabled:opacity-50">
                        <RefreshCw className={`w-4 h-4 ${syncMut.isPending ? "animate-spin" : ""}`} />
                        {syncMut.isPending ? "Menyinkronkan…" : <>Sinkronkan<span className="hidden sm:inline"> komentar &amp; DM</span></>}
                    </button>
                    <button onClick={() => setShowChannels(true)} title="Kelola channel" className="p-2 rounded-lg hover:bg-muted">
                        <Settings className="w-4 h-4 opacity-70" />
                    </button>
                </div>
            </div>

            {syncResult && (
                <div className="rounded-xl border border-border bg-card/60 px-3 py-2 text-sm flex gap-2">
                    <div className="flex-1 space-y-0.5">
                        {syncResult.results.length === 0 && <div className="opacity-70">Belum ada channel aktif.</div>}
                        {syncResult.results.map((r) => (
                            <div key={r.channelId} className={r.error ? "text-red-600 dark:text-red-400" : ""}>
                                <PlatformIcon p={r.platform} className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />
                                <b>{r.label}</b>: {r.error ? r.error : `${r.added} komentar baru dari ${r.posts} postingan · ${r.dmAdded} pesan DM baru dari ${r.dmConversations} percakapan`}
                            </div>
                        ))}
                    </div>
                    <button onClick={() => setSyncResult(null)} className="p-1 rounded hover:bg-muted self-start"><X className="w-4 h-4" /></button>
                </div>
            )}

            <nav className="flex overflow-x-auto border-b border-border">
                {tabBtn("ALL", "Semua pesan")}
                {tabBtn("MESSENGER", "Messenger")}
                {tabBtn("INSTAGRAM", "Instagram")}
                <Link href="/crm/whatsapp" className="flex items-center gap-1 px-3 py-2 text-sm whitespace-nowrap border-b-2 border-transparent -mb-px opacity-70 hover:opacity-100">
                    WhatsApp <ExternalLink className="w-3 h-3" />
                </Link>
                {tabBtn("FB_COMMENTS", "Komentar Facebook")}
                {tabBtn("IG_COMMENTS", "Komentar Instagram")}
            </nav>

            <div className="flex-1 min-h-0">
                {tab === "FB_COMMENTS" || tab === "IG_COMMENTS" ? (
                    <CommentsInbox key={tab} platform={tab === "IG_COMMENTS" ? "INSTAGRAM" : "MESSENGER"} onOpenDm={(p) => setTab(p)}
                        sync={{ run: () => syncMut.mutate(), pending: syncMut.isPending, status: syncStatus }} />
                ) : (
                    <DmInbox key={tab} platform={tab === "ALL" ? undefined : tab}
                        sync={{ run: () => syncMut.mutate(), pending: syncMut.isPending, status: syncStatus }} />
                )}
            </div>

            {showChannels && <ChannelManager onClose={() => setShowChannels(false)} />}
        </div>
    );
}

// ─── DM (Messenger / Instagram) ──────────────────────────────────────────────
function DmInbox({ platform, sync }: { platform?: SocialPlatform; sync: SyncControl }) {
    const qc = useQueryClient();
    const [search, setSearch] = useState("");
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [draft, setDraft] = useState("");
    const [sendError, setSendError] = useState<string | null>(null);

    const { data: convData, isLoading } = useQuery({
        queryKey: ["social-convos", platform ?? "ALL", search],
        queryFn: () => listSocialConversations({ platform, q: search.trim() || undefined, take: 50 }),
        refetchInterval: 8000,
    });
    const conversations = useMemo(() => convData?.items ?? [], [convData]);
    const selected = useMemo(() => conversations.find((c) => c.id === selectedId) ?? null, [conversations, selectedId]);
    const open = (id: number | null) => { setSelectedId(id); setDraft(""); setSendError(null); };

    const { data: msgData } = useQuery({
        queryKey: ["social-messages", selectedId],
        queryFn: () => getSocialMessages(selectedId as number, { take: 50 }),
        enabled: selectedId != null,
        refetchInterval: 5000,
    });
    const messages = msgData?.items ?? [];
    const bottomRef = useRef<HTMLDivElement>(null);
    useEffect(() => { bottomRef.current?.scrollIntoView(); }, [messages.length, selectedId]);
    useEffect(() => {
        if (selectedId == null) return;
        qc.invalidateQueries({ queryKey: ["social-convos"] });
        qc.invalidateQueries({ queryKey: ["social-counts"] });
    }, [msgData, selectedId, qc]);

    const replyMut = useMutation({
        mutationFn: (text: string) => replySocial(selectedId as number, text),
        onSuccess: () => {
            setDraft("");
            setSendError(null);
            qc.invalidateQueries({ queryKey: ["social-messages", selectedId] });
            qc.invalidateQueries({ queryKey: ["social-convos"] });
        },
        onError: (e: unknown) => setSendError(errMsg(e, "Gagal mengirim")),
    });
    const send = () => { if (draft.trim() && !replyMut.isPending) replyMut.mutate(draft.trim()); };

    const leadMut = useMutation({
        mutationFn: (contactId: number) => createLeadFromSocialContact(contactId),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["social-convos"] }),
        onError: (e: unknown) => alert(errMsg(e, "Gagal membuat prospek")),
    });

    return (
        <div className="flex h-full gap-3">
            <aside className={`w-full md:w-80 lg:w-96 shrink-0 flex-col rounded-2xl border border-border bg-card/60 overflow-hidden ${selectedId ? "hidden md:flex" : "flex"}`}>
                <div className="p-3 border-b border-border space-y-2">
                    <SyncBar sync={sync} platform={platform} />
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50" />
                        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama…"
                            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-muted/60 text-sm outline-none" />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {isLoading && <p className="text-sm opacity-60 p-3">Memuat…</p>}
                    {!isLoading && conversations.length === 0 && (
                        <p className="text-sm opacity-60 p-3">Belum ada percakapan. DM baru masuk otomatis; tekan “Sinkronkan” untuk menarik percakapan yang sudah ada.</p>
                    )}
                    {conversations.map((c) => (
                        <button key={c.id} onClick={() => open(c.id)}
                            className={`w-full text-left px-3 py-2.5 border-b border-border/50 hover:bg-muted/40 flex gap-3 ${selectedId === c.id ? "bg-muted/60" : ""}`}>
                            <Avatar name={contactName(c.contact)} platform={c.contact.platform} />
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                    <span className={`truncate ${c.unreadCount > 0 ? "font-semibold" : "font-medium"}`}>{contactName(c.contact)}</span>
                                    <span className="text-[10px] opacity-50 shrink-0">{timeAgo(c.lastMessageAt)}</span>
                                </div>
                                <div className="flex items-center justify-between gap-2 mt-0.5">
                                    <span className="text-[11px] opacity-60 truncate">{PLATFORM_LABEL[c.contact.platform]}{c.assignedTo?.name ? ` · ${c.assignedTo.name}` : ""}</span>
                                    {c.unreadCount > 0 && <span className="bg-pink-500 text-white text-[10px] rounded-full px-1.5 min-w-[18px] text-center shrink-0">{c.unreadCount}</span>}
                                </div>
                                {(() => {
                                    const w = replyWindow(c.lastInboundAt);
                                    if (!w.known && !c.contact.lead) return null;
                                    return (
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {w.known && (w.open
                                                ? <span className="text-[10px] rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-1.5">bisa dibalas · sisa {fmtLeft(w.leftMs)}</span>
                                                : <span className="text-[10px] rounded-full bg-muted px-1.5 opacity-70">lewat 24 jam</span>)}
                                            {c.contact.lead && <span className="text-[10px] rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-1.5">Prospek</span>}
                                        </div>
                                    );
                                })()}
                            </div>
                        </button>
                    ))}
                </div>
            </aside>

            <section className={`flex-1 min-w-0 flex-col rounded-2xl border border-border bg-card/60 overflow-hidden ${selectedId ? "flex" : "hidden md:flex"}`}>
                {!selected ? (
                    <div className="flex-1 grid place-items-center opacity-50 text-sm">Pilih percakapan untuk mulai membalas.</div>
                ) : (
                    <>
                        <header className="p-3 border-b border-border flex items-center gap-2">
                            <button onClick={() => open(null)} className="md:hidden p-1 -ml-1 rounded-lg hover:bg-muted" aria-label="Kembali">
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                            <PlatformIcon p={selected.contact.platform} className="w-5 h-5 text-pink-500 shrink-0" />
                            <div className="min-w-0">
                                <div className="font-semibold truncate">{contactName(selected.contact)}</div>
                                <div className="text-xs opacity-60 truncate">{PLATFORM_LABEL[selected.contact.platform]} · {selected.channel.label}</div>
                            </div>
                        </header>
                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {messages.map((m: SocialMessage) => {
                                if (isNotice(m)) {
                                    const n = splitNotice(m.body);
                                    return (
                                        <div key={m.id} className="flex justify-center">
                                            <div className="max-w-[85%] rounded-xl border border-border/60 bg-muted/40 px-3 py-2 text-[11px] text-center opacity-80">
                                                <div className="flex items-center justify-center gap-1 font-medium">
                                                    <Info className="w-3.5 h-3.5" /> Catatan sistem {PLATFORM_LABEL[selected.contact.platform]}
                                                </div>
                                                <p className="mt-0.5 whitespace-pre-wrap break-words">{n.text}</p>
                                                {n.url && (
                                                    <a href={n.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-primary underline">
                                                        Lihat komentar <ExternalLink className="w-3 h-3" />
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    );
                                }
                                const out = m.direction === "OUTBOUND";
                                return (
                                    <div key={m.id} className={`flex ${out ? "justify-end" : "justify-start"}`}>
                                        <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${out ? "bg-emerald-500 text-white" : "bg-muted"}`}>
                                            {m.mediaUrl && m.type === "VIDEO" && (
                                                <video src={m.mediaUrl} controls className="rounded-lg max-w-full max-h-60 mb-1" />
                                            )}
                                            {m.mediaUrl && m.type === "FILE" && (
                                                <a href={m.mediaUrl} target="_blank" rel="noopener noreferrer" className="underline block mb-1">Buka lampiran</a>
                                            )}
                                            {m.mediaUrl && m.type !== "TEXT" && m.type !== "VIDEO" && m.type !== "FILE" && (
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
                        {(() => {
                            const w = replyWindow(selected.lastInboundAt);
                            if (!w.open) {
                                return (
                                    <div className="p-3 border-t border-border">
                                        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm space-y-2">
                                            <div className="flex gap-2">
                                                <Clock className="w-4 h-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
                                                <p>
                                                    <b>Jendela balas 24 jam sudah lewat.</b>{" "}
                                                    {selected.lastInboundAt
                                                        ? `Pesan terakhir pelanggan ${fmtTime(selected.lastInboundAt)}.`
                                                        : "Pelanggan belum mengirim pesan di percakapan ini."}{" "}
                                                    Meta hanya mengizinkan balasan lewat PosPro dalam 24 jam — balas langsung dari aplikasi.
                                                </p>
                                            </div>
                                            <a href={openInAppUrl(selected)} target="_blank" rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-sm">
                                                {selected.contact.platform === "INSTAGRAM" ? "Buka di Instagram" : "Buka Inbox Messenger"} <ExternalLink className="w-3.5 h-3.5" />
                                            </a>
                                        </div>
                                        <p className="text-[11px] opacity-50 text-center pt-1.5">Begitu pelanggan membalas, kolom ketik muncul lagi di sini.</p>
                                    </div>
                                );
                            }
                            return (
                                <>
                                    {sendError && (
                                        <div className="mx-3 mt-2 rounded-lg bg-red-500/10 text-red-700 dark:text-red-300 text-xs px-3 py-2 flex gap-2">
                                            <span className="flex-1 break-words">{sendError}</span>
                                            <button onClick={() => setSendError(null)} aria-label="Tutup"><X className="w-3.5 h-3.5" /></button>
                                        </div>
                                    )}
                                    <form className="p-3 border-t border-border flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); send(); }}>
                                        <textarea value={draft} onChange={(e) => { setDraft(e.target.value); if (sendError) setSendError(null); }}
                                            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                                            rows={1} placeholder="Ketik balasan… (Enter kirim)"
                                            className="flex-1 resize-none rounded-xl bg-muted/60 px-3 py-2 text-sm outline-none max-h-32" />
                                        <button type="submit" disabled={!draft.trim() || replyMut.isPending}
                                            className="rounded-xl bg-emerald-500 text-white p-2.5 disabled:opacity-40 hover:bg-emerald-600 shrink-0">
                                            <Send className="w-4 h-4" />
                                        </button>
                                    </form>
                                    <p className="text-[11px] opacity-50 text-center pb-2">
                                        {w.known && w.until
                                            ? `Bisa dibalas sampai ${fmtTime(w.until.toISOString())} (sisa ${fmtLeft(w.leftMs)}) — aturan 24 jam Meta.`
                                            : "Catatan: balasan hanya sah dalam jendela 24 jam (aturan Meta)."}
                                    </p>
                                </>
                            );
                        })()}
                    </>
                )}
            </section>

            {selected && (
                <aside className="hidden xl:flex w-72 shrink-0 flex-col rounded-2xl border border-border bg-card/60 overflow-y-auto">
                    <PanelSection title="Detail kontak">
                        <div className="flex items-center gap-3">
                            <Avatar name={contactName(selected.contact)} platform={selected.contact.platform} />
                            <div className="min-w-0">
                                <div className="font-medium truncate">{contactName(selected.contact)}</div>
                                <div className="text-xs opacity-60">{PLATFORM_LABEL[selected.contact.platform]} · {selected.channel.label}</div>
                            </div>
                        </div>
                        {selected.assignedTo?.name && <div className="text-xs opacity-70">Ditangani: {selected.assignedTo.name}</div>}
                    </PanelSection>
                    <PanelSection title="Tahapan prospek">
                        <LeadBlock lead={selected.contact.lead} pending={leadMut.isPending} onCreate={() => leadMut.mutate(selected.contact.id)} />
                    </PanelSection>
                </aside>
            )}
        </div>
    );
}

// ─── Komentar postingan ──────────────────────────────────────────────────────
const FILTERS: Array<{ key: CommentFilter; label: string }> = [
    { key: "all", label: "Semua" },
    { key: "unread", label: "Belum dibaca" },
    { key: "needs_reply", label: "Perlu dibalas" },
    { key: "hidden", label: "Disembunyikan" },
];


function CommentsInbox({ platform, onOpenDm, sync }: { platform: SocialPlatform; onOpenDm: (tab: SocialPlatform) => void; sync: SyncControl }) {
    const qc = useQueryClient();
    const [filter, setFilter] = useState<CommentFilter>("all");
    const [search, setSearch] = useState("");
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [draft, setDraft] = useState("");
    const [mode, setMode] = useState<"public" | "private">("public");
    const [target, setTarget] = useState<SocialComment | null>(null);
    const [dmSent, setDmSent] = useState(false);

    const { data: listData, isLoading } = useQuery({
        queryKey: ["social-comments", platform, filter, search],
        queryFn: () => listSocialComments({ platform, filter, q: search.trim() || undefined, take: 50 }),
        refetchInterval: 10000,
    });
    const threads = listData?.items ?? [];

    const { data: thread } = useQuery({
        queryKey: ["social-comment-thread", selectedId],
        queryFn: () => getSocialCommentThread(selectedId as number),
        enabled: selectedId != null,
        refetchInterval: 10000,
    });
    // Membuka utas = dibaca → segarkan angka di daftar & tab.
    useEffect(() => {
        if (!thread) return;
        qc.invalidateQueries({ queryKey: ["social-comments"] });
        qc.invalidateQueries({ queryKey: ["social-counts"] });
    }, [thread?.id, qc]); // eslint-disable-line react-hooks/exhaustive-deps
    const open = (id: number | null) => { setSelectedId(id); setDraft(""); setMode("public"); setTarget(null); setDmSent(false); };

    const bottomRef = useRef<HTMLDivElement>(null);
    useEffect(() => { bottomRef.current?.scrollIntoView(); }, [thread?.replies.length, selectedId]);

    const refresh = () => {
        qc.invalidateQueries({ queryKey: ["social-comment-thread", selectedId] });
        qc.invalidateQueries({ queryKey: ["social-comments"] });
        qc.invalidateQueries({ queryKey: ["social-counts"] });
    };
    const replyMut = useMutation({
        mutationFn: (body: { text: string; mode: "public" | "private"; targetId?: number }) => replySocialComment(selectedId as number, body),
        onSuccess: (_r, v) => {
            setDraft("");
            setTarget(null);
            if (v.mode === "private") {
                setDmSent(true);
                setMode("public");
                qc.invalidateQueries({ queryKey: ["social-convos"] });
            }
            refresh();
        },
        onError: (e: unknown) => alert(errMsg(e, "Gagal mengirim balasan")),
    });
    const hideMut = useMutation({
        mutationFn: ({ id, hidden }: { id: number; hidden: boolean }) => hideSocialComment(id, hidden),
        onSuccess: refresh,
        onError: (e: unknown) => alert(errMsg(e, "Gagal mengubah komentar")),
    });
    const flagMut = useMutation({
        mutationFn: (body: { isRead?: boolean; needsReply?: boolean }) => updateSocialCommentThread(selectedId as number, body),
        onSuccess: (_r, v) => { if (v.isRead === false) open(null); refresh(); },
    });
    const leadMut = useMutation({
        mutationFn: () => createLeadFromSocialComment(selectedId as number),
        onSuccess: refresh,
        onError: (e: unknown) => alert(errMsg(e, "Gagal membuat prospek")),
    });

    const send = () => {
        const text = draft.trim();
        if (!text || replyMut.isPending) return;
        replyMut.mutate({ text, mode, targetId: mode === "private" ? target?.id : undefined });
    };
    const dmTo = (c: SocialComment) => { setMode("private"); setTarget(c); };
    const canDm = !!thread && [thread, ...thread.replies].some((c) => c.direction === "INBOUND" && !c.privateReplyAt);
    const who = thread ? authorLabel(thread, platform) : "";

    const bubble = (c: SocialComment, isRoot: boolean) => {
        const out = c.direction === "OUTBOUND";
        return (
            <div key={c.id} className={`flex flex-col ${out ? "items-end" : "items-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${out ? "bg-emerald-500 text-white" : isRoot ? "bg-muted ring-1 ring-pink-500/30" : "bg-muted"} ${c.isHidden ? "opacity-60" : ""}`}>
                    <div className={`text-[11px] font-semibold mb-0.5 ${out ? "text-white/90" : "opacity-80"}`}>
                        {out ? (thread?.channel.label ?? "Kita") + (c.sentBy?.name ? ` · ${c.sentBy.name}` : "") : authorLabel(c, platform)}
                    </div>
                    {c.body ? <div className="whitespace-pre-wrap break-words">{c.body}</div> : <div className="italic opacity-60">(isi komentar tidak tersedia)</div>}
                    <div className={`text-[10px] mt-1 flex flex-wrap gap-x-2 ${out ? "text-white/70" : "opacity-50"}`}>
                        <span>{fmtTime(c.commentedAt)}</span>
                        {c.isHidden && <span>· disembunyikan</span>}
                        {c.privateReplyAt && <span>· sudah dibalas via DM</span>}
                    </div>
                </div>
                {!out && (
                    <div className="flex gap-3 text-[11px] mt-0.5 px-2 opacity-70">
                        {!c.privateReplyAt && (
                            <button onClick={() => dmTo(c)} className="flex items-center gap-1 hover:opacity-100 hover:underline"><Reply className="w-3 h-3" /> Balas via DM</button>
                        )}
                        <button onClick={() => hideMut.mutate({ id: c.id, hidden: !c.isHidden })} disabled={hideMut.isPending}
                            className="flex items-center gap-1 hover:opacity-100 hover:underline">
                            {c.isHidden ? <><Eye className="w-3 h-3" /> Tampilkan</> : <><EyeOff className="w-3 h-3" /> Sembunyikan</>}
                        </button>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="flex h-full gap-3">
            <aside className={`w-full md:w-80 lg:w-96 shrink-0 flex-col rounded-2xl border border-border bg-card/60 overflow-hidden ${selectedId ? "hidden md:flex" : "flex"}`}>
                <div className="p-3 border-b border-border space-y-2">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50" />
                        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama atau isi komentar…"
                            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-muted/60 text-sm outline-none" />
                    </div>
                    <SyncBar sync={sync} platform={platform} />
                    <div className="flex gap-1 flex-wrap">
                        {FILTERS.map((f) => (
                            <button key={f.key} onClick={() => setFilter(f.key)}
                                className={`px-2.5 py-1 rounded-full text-xs ${filter === f.key ? "bg-primary text-primary-foreground" : "bg-muted/60 hover:bg-muted"}`}>
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {isLoading && <p className="text-sm opacity-60 p-3">Memuat…</p>}
                    {!isLoading && threads.length === 0 && (
                        <p className="text-sm opacity-60 p-3">
                            {filter === "all" && !search
                                ? "Belum ada komentar. Tekan “Sinkronkan komentar” untuk menarik komentar dari postingan terbaru, atau aktifkan webhook di pengaturan channel (ikon ⚙)."
                                : "Tidak ada komentar yang cocok."}
                        </p>
                    )}
                    {threads.map((t: SocialCommentThread) => {
                        const last = t.replies[0];
                        const preview = last
                            ? `${last.direction === "OUTBOUND" ? "Anda" : authorLabel(last, platform)}: ${last.body ?? ""}`
                            : t.body ?? "";
                        const n = t._count?.replies ?? 0;
                        return (
                            <button key={t.id} onClick={() => open(t.id)}
                                className={`w-full text-left px-3 py-2.5 border-b border-border/50 hover:bg-muted/40 flex gap-3 ${selectedId === t.id ? "bg-muted/60" : ""}`}>
                                <Avatar name={authorLabel(t, platform)} platform={platform} />
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className={`truncate ${!t.isRead ? "font-semibold" : "font-medium"}`}>{authorLabel(t, platform)}</span>
                                        <span className="text-[10px] opacity-50 shrink-0 flex items-center gap-1">
                                            {timeAgo(t.lastActivityAt)}
                                            {!t.isRead && <span className="w-2 h-2 rounded-full bg-pink-500" />}
                                        </span>
                                    </div>
                                    <p className={`text-xs line-clamp-2 break-words ${!t.isRead ? "opacity-90" : "opacity-60"}`}>{preview}</p>
                                    <div className="flex flex-wrap items-center gap-1 mt-1">
                                        {t.needsReply && !t.isHidden && <span className="text-[10px] rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 px-1.5">Perlu dibalas</span>}
                                        {t.isHidden && <span className="text-[10px] rounded-full bg-muted px-1.5">Disembunyikan</span>}
                                        {t.lead && <span className="text-[10px] rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-1.5">Prospek</span>}
                                        {n > 0 && <span className="text-[10px] opacity-50">{n} balasan</span>}
                                    </div>
                                </div>
                                {t.post.mediaUrl && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={t.post.mediaUrl} alt="" className="w-10 h-10 rounded-md object-cover shrink-0 bg-muted" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
                                )}
                            </button>
                        );
                    })}
                </div>
            </aside>

            <section className={`flex-1 min-w-0 flex-col rounded-2xl border border-border bg-card/60 overflow-hidden ${selectedId ? "flex" : "hidden md:flex"}`}>
                {!selectedId || !thread ? (
                    <div className="flex-1 grid place-items-center opacity-50 text-sm">{selectedId ? "Memuat…" : "Pilih komentar untuk membalas."}</div>
                ) : (
                    <>
                        <header className="p-3 border-b border-border flex items-center gap-2">
                            <button onClick={() => open(null)} className="md:hidden p-1 -ml-1 rounded-lg hover:bg-muted" aria-label="Kembali">
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                            <div className="min-w-0 flex-1">
                                <div className="font-semibold truncate">{who}</div>
                                <div className="text-xs opacity-60 truncate">Komentar {platform === "INSTAGRAM" ? "Instagram" : "Facebook"} · {thread.channel.label}</div>
                            </div>
                            <button onClick={() => flagMut.mutate({ needsReply: !thread.needsReply })} disabled={flagMut.isPending}
                                title={thread.needsReply ? "Tandai selesai tanpa membalas (mis. komentar emoji)" : "Kembalikan ke daftar Perlu dibalas"}
                                className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg hover:bg-muted">
                                <CheckCheck className="w-4 h-4" /> <span className="hidden lg:inline">{thread.needsReply ? "Tandai selesai" : "Tandai perlu dibalas"}</span>
                            </button>
                            <button onClick={() => flagMut.mutate({ isRead: false })} title="Tandai belum dibaca" className="p-1.5 rounded-lg hover:bg-muted">
                                <MailOpen className="w-4 h-4" />
                            </button>
                            {thread.post.permalink && (
                                <a href={thread.post.permalink} target="_blank" rel="noopener noreferrer" title="Buka postingan" className="p-1.5 rounded-lg hover:bg-muted">
                                    <ExternalLink className="w-4 h-4" />
                                </a>
                            )}
                        </header>

                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            <div className="flex gap-3 rounded-xl border border-border bg-card/70 p-3">
                                {thread.post.mediaUrl && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={thread.post.mediaUrl} alt="postingan" className="w-16 h-16 rounded-lg object-cover shrink-0 bg-muted" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                                )}
                                <div className="min-w-0 text-sm">
                                    <p className="line-clamp-3 whitespace-pre-wrap break-words">{thread.post.caption || <span className="italic opacity-60">Postingan tanpa keterangan</span>}</p>
                                    <div className="text-[11px] opacity-60 mt-1">
                                        {thread.post.postedAt ? `Diposting ${fmtTime(thread.post.postedAt)}` : "Postingan"}
                                        {thread.otherThreadsOnPost ? ` · ${thread.otherThreadsOnPost} komentar lain di postingan ini` : ""}
                                    </div>
                                </div>
                            </div>
                            {bubble(thread, true)}
                            {thread.replies.length > 0 && (
                                <div className="ml-3 md:ml-6 pl-3 border-l-2 border-border space-y-2">
                                    {thread.replies.map((r) => bubble(r, false))}
                                </div>
                            )}
                            {dmSent && (
                                <div className="rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs px-3 py-2 flex items-center gap-2">
                                    DM terkirim. Balasan pelanggan akan muncul di tab {PLATFORM_LABEL[platform]}.
                                    <button onClick={() => onOpenDm(platform)} className="underline font-medium">Buka</button>
                                </div>
                            )}
                            <div ref={bottomRef} />
                        </div>

                        <form className="p-3 border-t border-border space-y-2" onSubmit={(e) => { e.preventDefault(); send(); }}>
                            <div className="flex items-center gap-2 flex-wrap">
                                <div className="inline-flex rounded-lg bg-muted/60 p-0.5 text-xs">
                                    <button type="button" onClick={() => { setMode("public"); setTarget(null); }}
                                        className={`px-2.5 py-1 rounded-md ${mode === "public" ? "bg-card shadow-sm font-medium" : "opacity-70"}`}>Balas publik</button>
                                    <button type="button" onClick={() => setMode("private")} disabled={!canDm}
                                        title={canDm ? "Kirim pesan pribadi ke penulis komentar" : "Semua komentar di utas ini sudah dibalas via DM"}
                                        className={`px-2.5 py-1 rounded-md disabled:opacity-40 ${mode === "private" ? "bg-card shadow-sm font-medium" : "opacity-70"}`}>Kirim DM</button>
                                </div>
                                {mode === "private" && target && (
                                    <span className="text-[11px] rounded-full bg-muted px-2 py-0.5 flex items-center gap-1 max-w-full">
                                        <span className="truncate">DM untuk: “{(target.body ?? "").slice(0, 40)}”</span>
                                        <button type="button" onClick={() => setTarget(null)}><X className="w-3 h-3" /></button>
                                    </span>
                                )}
                            </div>
                            <div className="flex items-end gap-2">
                                <textarea value={draft} onChange={(e) => setDraft(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                                    rows={1} placeholder={mode === "public" ? `Balas komentar ${who}…` : `Pesan pribadi ke ${who}…`}
                                    className="flex-1 resize-none rounded-xl bg-muted/60 px-3 py-2 text-sm outline-none max-h-32" />
                                <button type="submit" disabled={!draft.trim() || replyMut.isPending}
                                    className="rounded-xl bg-emerald-500 text-white p-2.5 disabled:opacity-40 hover:bg-emerald-600 shrink-0">
                                    <Send className="w-4 h-4" />
                                </button>
                            </div>
                            <p className="text-[11px] opacity-50">
                                {mode === "public"
                                    ? "Balasan tampil untuk semua orang di bawah komentar ini. Enter kirim, Shift+Enter baris baru."
                                    : "DM dari komentar hanya bisa sekali per komentar dan paling lama 7 hari setelah komentar dibuat (aturan Meta)."}
                            </p>
                        </form>
                    </>
                )}
            </section>

            {thread && selectedId && (
                <aside className="hidden xl:flex w-72 shrink-0 flex-col rounded-2xl border border-border bg-card/60 overflow-y-auto">
                    <PanelSection title="Detail kontak">
                        <div className="flex items-center gap-3">
                            <Avatar name={who} platform={platform} />
                            <div className="min-w-0">
                                <div className="font-medium truncate">{who}</div>
                                <div className="text-xs opacity-60">Komentar {platform === "INSTAGRAM" ? "Instagram" : "Facebook"}</div>
                            </div>
                        </div>
                        {platform === "INSTAGRAM" && thread.authorName && (
                            <a href={`https://www.instagram.com/${encodeURIComponent(thread.authorName)}/`} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1.5 text-sm text-pink-600 hover:underline">
                                <Instagram className="w-4 h-4" /> Lihat profil Instagram
                            </a>
                        )}
                    </PanelSection>
                    <PanelSection title="Tahapan prospek">
                        <LeadBlock lead={thread.lead} pending={leadMut.isPending} onCreate={() => leadMut.mutate()} />
                    </PanelSection>
                    <PanelSection title="Postingan">
                        <p className="text-sm line-clamp-6 whitespace-pre-wrap break-words">{thread.post.caption || "—"}</p>
                        {thread.post.permalink && (
                            <a href={thread.post.permalink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-primary hover:underline">
                                Buka postingan <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                        )}
                    </PanelSection>
                </aside>
            )}
        </div>
    );
}

// ─── Pengaturan channel ──────────────────────────────────────────────────────
function ChannelManager({ onClose }: { onClose: () => void }) {
    const qc = useQueryClient();
    const [form, setForm] = useState<CreateSocialChannelBody>({ label: "", platform: "MESSENGER", pageId: "", igId: "", accessToken: "", branchId: null });
    const { data: channels = [] } = useQuery({ queryKey: ["social-channels"], queryFn: listSocialChannels });
    const { data: branches = [] } = useQuery({ queryKey: ["branches"], queryFn: getBranches });
    const invalidate = () => qc.invalidateQueries({ queryKey: ["social-channels"] });
    const createMut = useMutation({
        mutationFn: () => createSocialChannel(form),
        onSuccess: () => { setForm({ label: "", platform: "MESSENGER", pageId: "", igId: "", accessToken: "", branchId: null }); invalidate(); },
        onError: (e: unknown) => alert(errMsg(e, "Gagal menambah channel")),
    });
    const delMut = useMutation({ mutationFn: (id: number) => deleteSocialChannel(id), onSuccess: invalidate });
    // Ganti token tanpa menghapus channel (hapus channel = riwayat DM & komentar ikut terhapus).
    const [tokenFor, setTokenFor] = useState<number | null>(null);
    const [newToken, setNewToken] = useState("");
    const tokenMut = useMutation({
        mutationFn: async (ch: SocialChannel) => {
            const r = await testSocialConnection({ platform: ch.platform, pageId: ch.pageId, igId: ch.igId ?? undefined, accessToken: newToken });
            await updateSocialChannel(ch.id, { accessToken: newToken });
            return r;
        },
        onSuccess: (r) => { alert(`✓ Token diganti — akun: ${r.name || r.id}`); setTokenFor(null); setNewToken(""); invalidate(); },
        onError: (e: unknown) => alert(`${errMsg(e, "Gagal mengganti token")}\nToken lama tetap dipakai.`),
    });
    const testMut = useMutation({
        mutationFn: () => testSocialConnection({ platform: form.platform, pageId: form.pageId, igId: form.igId ?? undefined, accessToken: form.accessToken }),
        onSuccess: (r) => alert(`✓ Koneksi OK — akun: ${r.name || r.id}`),
        onError: (e: unknown) => alert(errMsg(e, "Tes gagal")),
    });
    const subMut = useMutation({
        mutationFn: (id: number) => subscribeSocialChannel(id),
        onSuccess: (r) => alert(`✓ Webhook akun aktif: ${r.fields.join(", ")}.\nKomentar & DM baru akan masuk otomatis (pastikan field yang sama juga dicentang di App Dashboard → Webhooks).`),
        onError: (e: unknown) => alert(errMsg(e, "Gagal mengaktifkan webhook")),
    });
    const webhookMut = useMutation({
        mutationFn: getSocialWebhookDebug,
        onSuccess: (d) => {
            const w = d.lastWebhook;
            if (!w) return alert("Belum ada webhook masuk dari Meta.\n→ Berarti Meta belum mengirim event. Cek: webhook di App terverifikasi, field 'messages' & 'comments' (IG) / 'feed' (FB) di-subscribe, tombol “Aktifkan webhook” di channel sudah ditekan, dan app sudah Live.");
            alert(`Webhook terakhir masuk:\n• Waktu: ${new Date(w.at).toLocaleString("id-ID")}\n• object: ${w.object}\n• field: ${w.fields || "-"}\n• entries: ${w.entries}\n• signature OK: ${w.signatureOk === null ? "(tak dicek)" : w.signatureOk}\n\n${w.signatureOk === false ? "⚠️ Signature GAGAL → IG_APP_SECRET (Instagram) / WA_APP_SECRET (Facebook) di server tidak cocok dengan App Secret di Meta." : "Meta menghubungi server ✓"}`);
        },
        onError: (e: unknown) => alert(errMsg(e, "Gagal cek webhook")),
    });

    // Ambil Page + token otomatis dari 1 token login.
    const [loginToken, setLoginToken] = useState("");
    const [pages, setPages] = useState<FbPage[]>([]);
    const pagesMut = useMutation({
        mutationFn: () => listPagesFromToken(loginToken.trim()),
        onSuccess: (p) => setPages(p),
        onError: (e: unknown) => alert(errMsg(e, "Gagal ambil Page")),
    });
    const pickPage = (p: FbPage) => {
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
                        <b>Instagram</b> (Instagram API with Login): isi <b>IG User ID</b> + token dari halaman &quot;Buat token&quot; di App Dashboard.
                        <b> Messenger</b>: isi Page + Page token. Set webhook Meta ke <code>/social/webhook</code>.
                        Untuk <b>komentar</b>, token butuh izin <code>instagram_business_manage_comments</code> (IG) atau{" "}
                        <code>pages_read_engagement</code>, <code>pages_read_user_content</code>, <code>pages_manage_engagement</code> (FB).
                    </p>

                    {/* Cara mudah (khusus Messenger/FB Page): tempel 1 token login → ambil Page */}
                    {form.platform === "MESSENGER" && (
                    <div className="rounded-xl border border-dashed border-border bg-card/40 p-3 space-y-2">
                        <div className="text-sm font-medium">⚡ Ambil Page otomatis</div>
                        <p className="text-[11px] opacity-60">Tempel <b>token login</b> (User/System User dengan izin <code>pages_show_list</code> + <code>pages_messaging</code>) → aplikasi ambilkan Page ID, Page Access Token, &amp; IG ID.</p>
                        <div className="flex gap-2">
                            <input type="password" value={loginToken} onChange={(e) => setLoginToken(e.target.value)} placeholder="Tempel token login…"
                                className="flex-1 rounded-lg bg-muted/60 px-3 py-1.5 text-sm outline-none font-mono" />
                            <button type="button" onClick={() => pagesMut.mutate()} disabled={pagesMut.isPending || !loginToken.trim() || !!tokenMismatch("MESSENGER", loginToken)}
                                className="text-sm px-3 py-1.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-50 whitespace-nowrap">
                                {pagesMut.isPending ? "Mengambil…" : "Ambil Page"}
                            </button>
                        </div>
                        {tokenMismatch("MESSENGER", loginToken) && <p className="text-[11px] text-red-600 dark:text-red-400">{tokenMismatch("MESSENGER", loginToken)}</p>}
                        {pages.length > 0 && (
                            <div className="space-y-1">
                                {pages.map((p) => (
                                    <button key={p.id} type="button" onClick={() => pickPage(p)}
                                        className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted text-sm">
                                        <Facebook className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                        <span className="min-w-0 flex-1 truncate">{p.name} {p.ig ? <span className="text-pink-500">· IG @{p.ig.username || p.ig.id}</span> : ""}</span>
                                        <span className="text-[11px] opacity-60 shrink-0">pakai →</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    )}
                    <div className="grid sm:grid-cols-2 gap-2">
                        <label className="text-sm">Label
                            <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="mis. Toko Anda – Instagram"
                                className="mt-1 w-full rounded-lg bg-muted/60 px-3 py-2 outline-none" />
                        </label>
                        <label className="text-sm">Platform
                            <select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value as SocialPlatform })}
                                className="mt-1 w-full rounded-lg bg-muted/60 px-3 py-2 outline-none">
                                <option value="MESSENGER">Messenger</option>
                                <option value="INSTAGRAM">Instagram</option>
                            </select>
                        </label>
                        {form.platform === "MESSENGER" ? (
                            <label className="text-sm">Page ID
                                <input value={form.pageId} onChange={(e) => setForm({ ...form, pageId: e.target.value })} placeholder="1234567890"
                                    className="mt-1 w-full rounded-lg bg-muted/60 px-3 py-2 outline-none" />
                            </label>
                        ) : (
                            <label className="text-sm">IG User ID
                                <input value={form.igId ?? ""} onChange={(e) => setForm({ ...form, igId: e.target.value })} placeholder="1784…………… (17 digit)"
                                    className="mt-1 w-full rounded-lg bg-muted/60 px-3 py-2 outline-none font-mono" />
                                <span className="text-[11px] opacity-50">Dari App Dashboard → Instagram → “Buat token akses” (angka di bawah nama akun).</span>
                            </label>
                        )}
                        <label className="text-sm sm:col-span-2">Access Token
                            <input type="password" value={form.accessToken} onChange={(e) => setForm({ ...form, accessToken: e.target.value })} placeholder={form.platform === "INSTAGRAM" ? "Token dari 'Buat token' Instagram…" : "Page token (EAAG…)"}
                                className="mt-1 w-full rounded-lg bg-muted/60 px-3 py-2 outline-none font-mono" />
                            {tokenMismatch(form.platform, form.accessToken) && <span className="text-[11px] text-red-600 dark:text-red-400">{tokenMismatch(form.platform, form.accessToken)}</span>}
                        </label>
                        <label className="text-sm sm:col-span-2">Cabang
                            <select value={form.branchId ?? ""} onChange={(e) => setForm({ ...form, branchId: e.target.value ? +e.target.value : null })}
                                className="mt-1 w-full rounded-lg bg-muted/60 px-3 py-2 outline-none">
                                <option value="">Semua cabang</option>
                                {branches.map((b: { id: number; name: string }) => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                        </label>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button onClick={() => testMut.mutate()} disabled={testMut.isPending || !form.accessToken.trim() || (form.platform === "MESSENGER" ? !form.pageId.trim() : !(form.igId ?? "").trim())}
                            className="text-sm px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/70 disabled:opacity-50">
                            {testMut.isPending ? "Menguji…" : "Tes koneksi"}
                        </button>
                        <button onClick={() => webhookMut.mutate()} disabled={webhookMut.isPending}
                            className="text-sm px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/70 disabled:opacity-50">
                            {webhookMut.isPending ? "Cek…" : "Cek webhook masuk"}
                        </button>
                        <button onClick={() => createMut.mutate()} disabled={createMut.isPending || !form.label.trim() || !form.accessToken.trim() || (form.platform === "MESSENGER" ? !form.pageId.trim() : !(form.igId ?? "").trim())}
                            className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-50">
                            <Plus className="w-4 h-4" /> Tambah channel
                        </button>
                    </div>

                    <div className="space-y-1.5">
                        {channels.map((ch: SocialChannel) => (
                            <div key={ch.id} className="rounded-lg border border-border px-3 py-2 text-sm space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                                <PlatformIcon p={ch.platform} className="w-4 h-4 text-pink-500" />
                                <div className="min-w-0 flex-1">
                                    <div className="truncate">{ch.label} <span className="text-xs opacity-50">({PLATFORM_LABEL[ch.platform]})</span></div>
                                    <div className="text-[11px] opacity-50 font-mono truncate">Page {ch.pageId}{ch.igId ? ` · IG ${ch.igId}` : ""}</div>
                                </div>
                                <button onClick={() => subMut.mutate(ch.id)} disabled={subMut.isPending}
                                    title={`Aktifkan webhook akun (${ch.platform === "INSTAGRAM" ? "comments, messages" : "feed, messages"})`}
                                    className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-muted hover:bg-muted/70 disabled:opacity-50 whitespace-nowrap">
                                    <Radio className="w-3.5 h-3.5" /> Aktifkan webhook
                                </button>
                                <button onClick={() => { setTokenFor(tokenFor === ch.id ? null : ch.id); setNewToken(""); }} title="Ganti access token (mis. token kedaluwarsa)"
                                    className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-muted hover:bg-muted/70 whitespace-nowrap">
                                    <KeyRound className="w-3.5 h-3.5" /> Ganti token
                                </button>
                                <button onClick={() => { if (confirm(`Hapus channel "${ch.label}"?\n\nSemua percakapan DM & komentar channel ini ikut terhapus. Untuk memperbarui token, pakai "Ganti token".`)) delMut.mutate(ch.id); }} className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-500"><Trash2 className="w-4 h-4" /></button>
                            </div>
                            {tokenFor === ch.id && (
                                <div className="space-y-1">
                                    <div className="flex gap-2">
                                        <input type="password" value={newToken} onChange={(e) => setNewToken(e.target.value)} autoFocus
                                            placeholder={ch.platform === "INSTAGRAM" ? "Token baru dari “Buat token akses” (IG…)" : "Page token baru (EAA…)"}
                                            className="flex-1 min-w-0 rounded-lg bg-muted/60 px-3 py-1.5 text-sm outline-none font-mono" />
                                        <button onClick={() => tokenMut.mutate(ch)} disabled={tokenMut.isPending || !newToken.trim() || !!tokenMismatch(ch.platform, newToken)}
                                            className="text-sm px-3 py-1.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-50 whitespace-nowrap">
                                            {tokenMut.isPending ? "Menguji…" : "Tes & simpan"}
                                        </button>
                                    </div>
                                    {tokenMismatch(ch.platform, newToken) && <p className="text-[11px] text-red-600 dark:text-red-400">{tokenMismatch(ch.platform, newToken)}</p>}
                                    <p className="text-[11px] opacity-60">Token dites ke Meta dulu; kalau gagal, token lama tetap dipakai. Riwayat DM &amp; komentar tidak berubah.</p>
                                </div>
                            )}
                            </div>
                        ))}
                        {channels.length === 0 && <p className="text-xs opacity-60">Belum ada channel.</p>}
                    </div>
                </div>
            </div>
        </div>
    );
}
