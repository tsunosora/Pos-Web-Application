"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Send, Search, Check, CheckCheck, Clock, AlertCircle, UserCheck, MessageSquare, Settings, Download, Paperclip, X, Smile, CornerUpLeft } from "lucide-react";
import { WhatsappGuideButton } from "@/components/whatsapp/WhatsappGuideButton";
import { EmojiPicker } from "@/components/whatsapp/EmojiPicker";
import {
    listWaConversations, getWaMessages, replyWaText, replyWaTemplate, updateWaConversation,
    listWaTemplates, isWindowOpen, WA_STATUS_LABEL,
    getWaMessageMediaUrl, downloadWaMessageMedia, replyWaMedia, reactWaMessage,
    type WaConversation, type WaMessage, type WaConversationStatus, type WaTemplate,
} from "@/lib/api/whatsapp-cloud";
import { StatusBadge, type BadgeTone } from "@/components/ui/status-badge";
import { useCurrentUser } from "@/hooks/useCurrentUser";

const STATUS_TABS: Array<{ key: WaConversationStatus | "ALL"; label: string }> = [
    { key: "ALL", label: "Semua" },
    { key: "OPEN", label: "Terbuka" },
    { key: "PENDING", label: "Menunggu" },
    { key: "CLOSED", label: "Selesai" },
];

const STATUS_TONE: Record<WaConversationStatus, BadgeTone> = {
    OPEN: "success", PENDING: "warning", SNOOZED: "info", CLOSED: "neutral",
};

function timeAgo(iso: string | null): string {
    if (!iso) return "";
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "baru saja";
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}j`;
    return `${Math.floor(h / 24)}h`;
}

function clockTime(iso: string): string {
    return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

const MEDIA_TYPES = new Set<WaMessage["type"]>(["IMAGE", "STICKER", "VIDEO", "AUDIO", "DOCUMENT"]);

/** Lampiran media inbound/outbound: gambar/video/audio ditampilkan, semua bisa diunduh. */
function MediaAttachment({ m }: { m: WaMessage }) {
    const [url, setUrl] = useState<string | null>(null);
    const [err, setErr] = useState(false);
    const visual = m.type === "IMAGE" || m.type === "STICKER" || m.type === "VIDEO" || m.type === "AUDIO";

    useEffect(() => {
        if (!visual) return;
        let active = true;
        let created: string | null = null;
        getWaMessageMediaUrl(m.id)
            .then((u) => { if (active) { created = u; setUrl(u); } else { URL.revokeObjectURL(u); } })
            .catch(() => { if (active) setErr(true); });
        return () => { active = false; if (created) URL.revokeObjectURL(created); };
    }, [m.id, visual]);

    const dlBtn = (
        <button
            type="button"
            onClick={() => downloadWaMessageMedia(m.id, `${m.type.toLowerCase()}-${m.id}`)}
            className="mt-1 inline-flex items-center gap-1 text-[11px] underline opacity-80 hover:opacity-100"
        >
            <Download className="w-3 h-3" /> Unduh
        </button>
    );

    if (m.type === "IMAGE" || m.type === "STICKER") {
        if (err) return <div className="text-xs italic opacity-60">[gambar gagal dimuat]</div>;
        if (!url) return <div className="text-xs opacity-60 py-6 px-10 animate-pulse">Memuat gambar…</div>;
        return (
            <div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="lampiran" className="rounded-lg max-w-full max-h-72 object-contain" />
                {dlBtn}
            </div>
        );
    }
    if (m.type === "VIDEO") {
        if (err) return <div className="text-xs italic opacity-60">[video gagal dimuat]</div>;
        if (!url) return <div className="text-xs opacity-60 py-4">Memuat video…</div>;
        return <div><video src={url} controls className="rounded-lg max-w-full max-h-72" />{dlBtn}</div>;
    }
    if (m.type === "AUDIO") {
        if (err) return <div className="text-xs italic opacity-60">[audio gagal dimuat]</div>;
        if (!url) return <div className="text-xs opacity-60 py-2">Memuat audio…</div>;
        return <div><audio src={url} controls className="max-w-full" />{dlBtn}</div>;
    }
    // DOCUMENT / berkas lain → tombol unduh langsung.
    return (
        <button
            type="button"
            onClick={() => downloadWaMessageMedia(m.id, `dokumen-${m.id}`)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black/10 hover:bg-black/20 text-sm"
        >
            <Download className="w-4 h-4" />
            <span className="underline">Unduh berkas</span>
        </button>
    );
}

function MsgStatusTick({ status }: { status: WaMessage["status"] }) {
    if (status === "READ") return <CheckCheck className="w-3.5 h-3.5 text-sky-400" />;
    if (status === "DELIVERED") return <CheckCheck className="w-3.5 h-3.5 opacity-60" />;
    if (status === "SENT") return <Check className="w-3.5 h-3.5 opacity-60" />;
    if (status === "FAILED") return <AlertCircle className="w-3.5 h-3.5 text-red-400" />;
    return <Clock className="w-3 h-3 opacity-50" />;
}

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

function mediaLabel(type: WaMessage["type"]): { icon: string; label: string } {
    switch (type) {
        case "IMAGE": return { icon: "🖼️", label: "Foto" };
        case "STICKER": return { icon: "🩷", label: "Stiker" };
        case "VIDEO": return { icon: "🎥", label: "Video" };
        case "AUDIO": return { icon: "🎵", label: "Pesan suara" };
        case "DOCUMENT": return { icon: "📄", label: "Dokumen" };
        default: return { icon: "", label: `[${type.toLowerCase()}]` };
    }
}

// Loncat ke pesan yang dikutip + kilas sorot sebentar.
function scrollToMessage(id: number) {
    const el = document.getElementById(`wa-msg-${id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-emerald-400");
    setTimeout(() => el.classList.remove("ring-2", "ring-emerald-400"), 1500);
}

// Ringkasan pesan terkutip: thumbnail utk gambar/stiker, ikon+label utk media lain.
function QuotedContent({ msg }: { msg: { id: number; type: WaMessage["type"]; body: string | null; direction: WaMessage["direction"] } }) {
    const isImg = msg.type === "IMAGE" || msg.type === "STICKER";
    const isMedia = MEDIA_TYPES.has(msg.type);
    const [thumb, setThumb] = useState<string | null>(null);
    useEffect(() => {
        if (!isImg) return;
        let active = true;
        let created: string | null = null;
        getWaMessageMediaUrl(msg.id)
            .then((u) => { if (active) { created = u; setThumb(u); } else URL.revokeObjectURL(u); })
            .catch(() => {});
        return () => { active = false; if (created) URL.revokeObjectURL(created); };
    }, [msg.id, isImg]);
    const { icon, label } = mediaLabel(msg.type);
    return (
        <div className="flex items-center gap-2 min-w-0">
            {isImg && thumb && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumb} alt="" className="w-9 h-9 rounded object-cover shrink-0" />
            )}
            <div className="min-w-0">
                <div className="opacity-70 text-[11px]">{msg.direction === "OUTBOUND" ? "Anda" : "Pelanggan"}</div>
                <div className="truncate opacity-90">
                    {isMedia ? <span>{icon} {msg.body || label}</span> : (msg.body || <span className="italic opacity-60">[pesan]</span>)}
                </div>
            </div>
        </div>
    );
}

function BubbleActions({ m, out, onReply, onReact }: {
    m: WaMessage;
    out: boolean;
    onReply: (m: WaMessage) => void;
    onReact: (id: number, emoji: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const wrapRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!open) return;
        const h = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false); };
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, [open]);
    const current = m.reactionsJson?.agent;
    return (
        <div ref={wrapRef} className={`relative flex items-center gap-0.5 self-center transition-opacity ${open ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
            <button type="button" onClick={() => onReply(m)} title="Balas" className="p-1 rounded-full hover:bg-muted text-muted-foreground">
                <CornerUpLeft className="w-3.5 h-3.5" />
            </button>
            <button type="button" onClick={() => setOpen((o) => !o)} title="Reaksi" className="p-1 rounded-full hover:bg-muted text-muted-foreground">
                <Smile className="w-3.5 h-3.5" />
            </button>
            {open && (
                <div className={`absolute bottom-full mb-1 ${out ? "right-0" : "left-0"} flex gap-0.5 bg-card border border-border rounded-full px-1.5 py-1 shadow-lg z-30`}>
                    {QUICK_REACTIONS.map((e) => (
                        <button
                            key={e}
                            type="button"
                            onClick={() => { onReact(m.id, current === e ? "" : e); setOpen(false); }}
                            className={`text-lg leading-none p-0.5 rounded-full hover:bg-muted ${current === e ? "bg-emerald-100 dark:bg-emerald-900" : ""}`}
                        >
                            {e}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

function MessageBubble({ m, onReply, onReact }: {
    m: WaMessage;
    onReply: (m: WaMessage) => void;
    onReact: (id: number, emoji: string) => void;
}) {
    const out = m.direction === "OUTBOUND";
    const reactions = m.reactionsJson || {};
    const reactionEmojis = [reactions.customer, reactions.agent].filter(Boolean) as string[];
    const canAct = !!m.waMessageId; // hanya pesan ber-ID WhatsApp yang bisa dibalas/direaksi

    return (
        <div className={`group flex items-end gap-1 ${out ? "justify-end" : "justify-start"}`}>
            {out && canAct && <BubbleActions m={m} out={out} onReply={onReply} onReact={onReact} />}
            <div id={`wa-msg-${m.id}`} className="relative max-w-[75%] rounded-2xl transition-shadow">
                <div className={`rounded-2xl px-3 py-2 text-sm shadow-sm ${out ? "bg-emerald-500 text-white rounded-br-sm" : "bg-card border border-border rounded-bl-sm"}`}>
                    {m.replyTo && (
                        <button
                            type="button"
                            onClick={() => scrollToMessage(m.replyTo!.id)}
                            className={`w-full text-left mb-1 rounded-lg border-l-2 pl-2 pr-2 py-1 text-xs cursor-pointer transition-opacity hover:opacity-80 ${out ? "border-white/60 bg-white/10" : "border-emerald-500 bg-muted/50"}`}
                            title="Lihat pesan asli"
                        >
                            <QuotedContent msg={m.replyTo} />
                        </button>
                    )}
                    {m.type === "TEMPLATE" && (
                        <div className={`text-[10px] mb-0.5 ${out ? "text-white/70" : "opacity-50"}`}>template: {m.templateName}</div>
                    )}
                    {MEDIA_TYPES.has(m.type) ? (
                        <div className="space-y-1">
                            <MediaAttachment m={m} />
                            {m.body && <div className="whitespace-pre-wrap break-words">{m.body}</div>}
                        </div>
                    ) : (
                        <div className="whitespace-pre-wrap break-words">
                            {m.body || <span className="italic opacity-60">[{m.type.toLowerCase()}]</span>}
                        </div>
                    )}
                    <div className={`flex items-center gap-1 justify-end mt-0.5 text-[10px] ${out ? "text-white/70" : "opacity-50"}`}>
                        {clockTime(m.createdAt)}
                        {out && <MsgStatusTick status={m.status} />}
                    </div>
                </div>
                {reactionEmojis.length > 0 && (
                    <div className={`absolute -bottom-2 ${out ? "right-2" : "left-2"} bg-card border border-border rounded-full px-1.5 py-0.5 text-xs shadow-sm`}>
                        {reactionEmojis.join(" ")}
                    </div>
                )}
            </div>
            {!out && canAct && <BubbleActions m={m} out={out} onReply={onReply} onReact={onReact} />}
        </div>
    );
}

export default function WhatsappInboxPage() {
    const qc = useQueryClient();
    const { currentUser } = useCurrentUser();
    const [tab, setTab] = useState<WaConversationStatus | "ALL">("ALL");
    const [search, setSearch] = useState("");
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const bottomRef = useRef<HTMLDivElement>(null);

    // Daftar percakapan — polling 8 dtk (realtime ringan untuk MVP).
    const { data: convData, isLoading } = useQuery({
        queryKey: ["wa-convos", tab, search],
        queryFn: () => listWaConversations({
            status: tab === "ALL" ? undefined : tab,
            q: search.trim() || undefined,
            take: 50,
        }),
        refetchInterval: 8000,
    });
    const conversations = convData?.items ?? [];

    const selected = useMemo(
        () => conversations.find((c) => c.id === selectedId) ?? null,
        [conversations, selectedId],
    );

    // Pesan percakapan terpilih — polling 6 dtk.
    const { data: msgData } = useQuery({
        queryKey: ["wa-messages", selectedId],
        queryFn: () => getWaMessages(selectedId as number, { take: 80 }),
        enabled: selectedId != null,
        refetchInterval: 6000,
    });
    const messages = msgData?.items ?? [];

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages.length, selectedId]);

    // Reset unread saat buka → refresh daftar.
    useEffect(() => {
        if (selectedId != null) qc.invalidateQueries({ queryKey: ["wa-convos"] });
    }, [msgData, selectedId, qc]);

    const [draft, setDraft] = useState("");
    const [replyingTo, setReplyingTo] = useState<WaMessage | null>(null);
    const [pendingFile, setPendingFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [showEmoji, setShowEmoji] = useState(false);
    const emojiWrapRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Sisipkan emoji di posisi kursor (atau di akhir bila tak ada seleksi).
    const insertEmoji = (emoji: string) => {
        const ta = textareaRef.current;
        if (ta && typeof ta.selectionStart === "number") {
            const s = ta.selectionStart, e = ta.selectionEnd;
            setDraft((d) => d.slice(0, s) + emoji + d.slice(e));
            requestAnimationFrame(() => {
                ta.focus();
                const pos = s + emoji.length;
                ta.setSelectionRange(pos, pos);
            });
        } else {
            setDraft((d) => d + emoji);
        }
    };

    // Tutup emoji picker saat klik di luar.
    useEffect(() => {
        if (!showEmoji) return;
        const onDown = (ev: MouseEvent) => {
            if (emojiWrapRef.current && !emojiWrapRef.current.contains(ev.target as Node)) setShowEmoji(false);
        };
        document.addEventListener("mousedown", onDown);
        return () => document.removeEventListener("mousedown", onDown);
    }, [showEmoji]);
    const replyMut = useMutation({
        mutationFn: (v: { text: string; replyTo?: string }) => replyWaText(selectedId as number, v.text, v.replyTo),
        onSuccess: () => {
            setDraft("");
            setReplyingTo(null);
            qc.invalidateQueries({ queryKey: ["wa-messages", selectedId] });
            qc.invalidateQueries({ queryKey: ["wa-convos"] });
        },
        onError: (e: unknown) => {
            const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
            alert(msg || "Gagal mengirim pesan");
        },
    });

    const mediaMut = useMutation({
        mutationFn: (payload: { file: File; caption?: string; replyTo?: string }) =>
            replyWaMedia(selectedId as number, payload.file, payload.caption, payload.replyTo),
        onSuccess: () => {
            setDraft("");
            setPendingFile(null);
            setReplyingTo(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
            qc.invalidateQueries({ queryKey: ["wa-messages", selectedId] });
            qc.invalidateQueries({ queryKey: ["wa-convos"] });
        },
        onError: (e: unknown) => {
            const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
            alert(msg || "Gagal mengirim lampiran");
        },
    });

    const reactMut = useMutation({
        mutationFn: (v: { id: number; emoji: string }) => reactWaMessage(v.id, v.emoji),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["wa-messages", selectedId] }),
        onError: (e: unknown) => {
            const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
            alert(msg || "Gagal mengirim reaksi");
        },
    });

    // Kirim: kalau ada lampiran → media (draft jadi caption), else teks biasa.
    const sendComposer = () => {
        if (mediaMut.isPending || replyMut.isPending) return;
        const replyTo = replyingTo?.waMessageId || undefined;
        if (pendingFile) {
            mediaMut.mutate({ file: pendingFile, caption: draft.trim() || undefined, replyTo });
        } else if (draft.trim()) {
            replyMut.mutate({ text: draft.trim(), replyTo });
        }
    };

    // Bersihkan draft & lampiran saat pindah percakapan.
    useEffect(() => {
        setDraft("");
        setPendingFile(null);
        setShowEmoji(false);
        setReplyingTo(null);
    }, [selectedId]);

    const assignMut = useMutation({
        mutationFn: (data: { assignedToId?: number | null; status?: WaConversationStatus }) =>
            updateWaConversation(selectedId as number, data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["wa-convos"] });
            qc.invalidateQueries({ queryKey: ["wa-messages", selectedId] });
        },
    });

    // Template APPROVED — dipakai saat jendela 24 jam tutup.
    const [tplId, setTplId] = useState<number | null>(null);
    const { data: templates = [] } = useQuery({
        queryKey: ["wa-templates-approved"],
        queryFn: listWaTemplates,
        enabled: selectedId != null,
        select: (all: WaTemplate[]) => all.filter((t) => t.status === "APPROVED"),
    });
    const templateReplyMut = useMutation({
        mutationFn: () => {
            const tpl = templates.find((t) => t.id === tplId);
            if (!tpl) throw new Error("Template belum dipilih");
            return replyWaTemplate(selectedId as number, { name: tpl.name, language: tpl.language, previewText: tpl.bodyText });
        },
        onSuccess: () => {
            setTplId(null);
            qc.invalidateQueries({ queryKey: ["wa-messages", selectedId] });
            qc.invalidateQueries({ queryKey: ["wa-convos"] });
        },
        onError: (e: unknown) => {
            const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
            alert(msg || "Gagal mengirim template");
        },
    });

    const windowOpen = selected ? isWindowOpen(selected) : false;

    return (
        <div className="flex h-[calc(100vh-8rem)] gap-3 p-3">
            {/* ─── Panel kiri: daftar chat ─── */}
            <aside className="w-full max-w-sm flex flex-col rounded-2xl border border-border bg-card/60 backdrop-blur overflow-hidden">
                <div className="p-3 border-b border-border space-y-2">
                    <div className="flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-emerald-500" />
                        <h1 className="font-semibold">WhatsApp CRM</h1>
                        <WhatsappGuideButton className="ml-auto p-1.5 rounded-lg hover:bg-muted" />
                        <Link href="/crm/whatsapp/settings" title="Pengaturan channel" className="p-1.5 rounded-lg hover:bg-muted">
                            <Settings className="w-4 h-4 opacity-70" />
                        </Link>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Cari nama / nomor…"
                            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-muted/60 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                        />
                    </div>
                    <div className="flex gap-1">
                        {STATUS_TABS.map((t) => (
                            <button
                                key={t.key}
                                onClick={() => setTab(t.key)}
                                className={`px-2.5 py-1 rounded-full text-xs transition ${
                                    tab === t.key ? "bg-primary text-primary-foreground" : "bg-muted/60 hover:bg-muted"
                                }`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {isLoading && <p className="p-4 text-sm opacity-60">Memuat…</p>}
                    {!isLoading && conversations.length === 0 && (
                        <p className="p-4 text-sm opacity-60">Belum ada percakapan.</p>
                    )}
                    {conversations.map((c) => (
                        <button
                            key={c.id}
                            onClick={() => setSelectedId(c.id)}
                            className={`w-full text-left px-3 py-2.5 border-b border-border/50 hover:bg-muted/40 transition flex gap-3 ${
                                selectedId === c.id ? "bg-muted/60" : ""
                            }`}
                        >
                            <div className="w-10 h-10 rounded-full bg-emerald-500/20 grid place-items-center text-emerald-600 font-semibold shrink-0">
                                {(c.contact.profileName || c.contact.waId).slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="font-medium truncate">
                                        {c.contact.profileName || `+${c.contact.waId}`}
                                    </span>
                                    <span className="text-[10px] opacity-50 shrink-0">{timeAgo(c.lastMessageAt)}</span>
                                </div>
                                <div className="flex items-center justify-between gap-2 mt-0.5">
                                    <span className="text-xs opacity-60 truncate">
                                        {c.contact.leadId ? "🔗 Lead" : c.contact.customerId ? "🔗 Pelanggan" : "Kontak baru"}
                                        {c.channel?.label ? ` · ${c.channel.label}` : ""}
                                    </span>
                                    {c.unreadCount > 0 && (
                                        <span className="bg-emerald-500 text-white text-[10px] rounded-full px-1.5 min-w-[18px] text-center">
                                            {c.unreadCount}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </aside>

            {/* ─── Panel kanan: thread ─── */}
            <section className="flex-1 flex flex-col rounded-2xl border border-border bg-card/60 backdrop-blur overflow-hidden">
                {!selected ? (
                    <div className="flex-1 grid place-items-center opacity-50 text-sm">
                        Pilih percakapan untuk mulai membalas.
                    </div>
                ) : (
                    <>
                        <header className="p-3 border-b border-border flex items-center justify-between gap-2">
                            <div className="min-w-0">
                                <div className="font-semibold truncate">
                                    {selected.contact.profileName || `+${selected.contact.waId}`}
                                </div>
                                <div className="text-xs opacity-60 flex items-center gap-2">
                                    <span>+{selected.contact.waId}</span>
                                    <StatusBadge tone={STATUS_TONE[selected.status]}>
                                        {WA_STATUS_LABEL[selected.status]}
                                    </StatusBadge>
                                    {selected.assignedTo?.name && (
                                        <span className="opacity-70">· {selected.assignedTo.name}</span>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                {currentUser?.id && selected.assignedToId !== currentUser.id && (
                                    <button
                                        onClick={() => assignMut.mutate({ assignedToId: currentUser.id })}
                                        className="text-xs px-2.5 py-1.5 rounded-lg bg-muted hover:bg-muted/70 flex items-center gap-1"
                                    >
                                        <UserCheck className="w-3.5 h-3.5" /> Ambil
                                    </button>
                                )}
                                {selected.status !== "CLOSED" ? (
                                    <button
                                        onClick={() => assignMut.mutate({ status: "CLOSED" })}
                                        className="text-xs px-2.5 py-1.5 rounded-lg bg-muted hover:bg-muted/70"
                                    >
                                        Selesai
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => assignMut.mutate({ status: "OPEN" })}
                                        className="text-xs px-2.5 py-1.5 rounded-lg bg-muted hover:bg-muted/70"
                                    >
                                        Buka lagi
                                    </button>
                                )}
                            </div>
                        </header>

                        <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-muted/20">
                            {messages.map((m) => (
                                <MessageBubble
                                    key={m.id}
                                    m={m}
                                    onReply={setReplyingTo}
                                    onReact={(id, emoji) => reactMut.mutate({ id, emoji })}
                                />
                            ))}
                            <div ref={bottomRef} />
                        </div>

                        {/* Composer — guard jendela 24 jam */}
                        {selected.contact.optedOut ? (
                            <div className="p-3 border-t border-border text-sm text-center text-red-500 bg-red-500/5">
                                Kontak sudah berhenti berlangganan (opt-out). Tidak bisa dikirimi pesan.
                            </div>
                        ) : windowOpen ? (
                            <form
                                className="p-3 border-t border-border space-y-2"
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    sendComposer();
                                }}
                            >
                                {/* Pratinjau pesan yang dibalas */}
                                {replyingTo && (
                                    <div className="flex items-center gap-2 text-xs bg-muted/60 rounded-lg px-2.5 py-1.5 border-l-2 border-emerald-500">
                                        <CornerUpLeft className="w-3.5 h-3.5 shrink-0" />
                                        <div className="min-w-0 flex-1">
                                            <QuotedContent msg={replyingTo} />
                                        </div>
                                        <button type="button" onClick={() => setReplyingTo(null)} className="p-0.5 rounded hover:bg-muted shrink-0" aria-label="Batal balas">
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                )}

                                {/* Preview lampiran terpilih */}
                                {pendingFile && (
                                    <div className="flex items-center gap-2 text-xs bg-muted/60 rounded-lg px-2.5 py-1.5">
                                        <Paperclip className="w-3.5 h-3.5 shrink-0" />
                                        <span className="truncate flex-1">{pendingFile.name}</span>
                                        <span className="opacity-60 shrink-0">{(pendingFile.size / 1024).toFixed(0)} KB</span>
                                        <button
                                            type="button"
                                            onClick={() => { setPendingFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                                            className="p-0.5 rounded hover:bg-muted shrink-0"
                                            aria-label="Batal lampiran"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                )}
                                <div className="flex items-end gap-2">
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        className="hidden"
                                        accept="image/jpeg,image/png,image/webp,video/mp4,video/3gpp,audio/*,application/pdf,text/plain,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                                        onChange={(e) => setPendingFile(e.target.files?.[0] ?? null)}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={mediaMut.isPending}
                                        className="rounded-xl bg-muted/60 text-foreground p-2.5 hover:bg-muted disabled:opacity-40 transition shrink-0"
                                        title="Lampirkan gambar / dokumen / file"
                                    >
                                        <Paperclip className="w-4 h-4" />
                                    </button>
                                    <div ref={emojiWrapRef} className="relative shrink-0">
                                        {showEmoji && (
                                            <div className="absolute bottom-full left-0 mb-2 z-20">
                                                <EmojiPicker onPick={insertEmoji} />
                                            </div>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => setShowEmoji((s) => !s)}
                                            className={`rounded-xl p-2.5 transition shrink-0 ${showEmoji ? "bg-emerald-500 text-white" : "bg-muted/60 text-foreground hover:bg-muted"}`}
                                            title="Emoji"
                                        >
                                            <Smile className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <textarea
                                        ref={textareaRef}
                                        value={draft}
                                        onChange={(e) => setDraft(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" && !e.shiftKey) {
                                                e.preventDefault();
                                                sendComposer();
                                            }
                                        }}
                                        rows={1}
                                        placeholder={pendingFile ? "Tambah keterangan (opsional)…" : "Ketik balasan… (Enter kirim, Shift+Enter baris baru)"}
                                        className="flex-1 resize-none rounded-xl bg-muted/60 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 max-h-32"
                                    />
                                    <button
                                        type="submit"
                                        disabled={(!draft.trim() && !pendingFile) || mediaMut.isPending || replyMut.isPending}
                                        className="rounded-xl bg-emerald-500 text-white p-2.5 disabled:opacity-40 hover:bg-emerald-600 transition shrink-0"
                                    >
                                        <Send className="w-4 h-4" />
                                    </button>
                                </div>
                                {mediaMut.isPending && (
                                    <div className="text-[11px] opacity-60 text-center animate-pulse">Mengunggah lampiran…</div>
                                )}
                            </form>
                        ) : (
                            <div className="p-3 border-t border-border bg-amber-500/5 space-y-2">
                                <div className="text-xs text-amber-600 text-center">
                                    ⏰ Di luar jendela 24 jam — hanya boleh kirim pesan <b>template</b> yang disetujui Meta.
                                </div>
                                {templates.length === 0 ? (
                                    <div className="text-xs text-center opacity-70">
                                        Belum ada template disetujui.{" "}
                                        <Link href="/crm/whatsapp/templates" className="underline">Kelola template →</Link>
                                    </div>
                                ) : (
                                    <div className="flex items-end gap-2">
                                        <select
                                            value={tplId ?? ""}
                                            onChange={(e) => setTplId(e.target.value ? +e.target.value : null)}
                                            className="flex-1 rounded-xl bg-muted/60 px-3 py-2 text-sm outline-none"
                                        >
                                            <option value="">Pilih template…</option>
                                            {templates.map((t) => (
                                                <option key={t.id} value={t.id}>{t.name} ({t.language})</option>
                                            ))}
                                        </select>
                                        <button
                                            onClick={() => tplId && templateReplyMut.mutate()}
                                            disabled={!tplId || templateReplyMut.isPending}
                                            className="rounded-xl bg-emerald-500 text-white p-2.5 disabled:opacity-40 hover:bg-emerald-600 transition"
                                        >
                                            <Send className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </section>
        </div>
    );
}
