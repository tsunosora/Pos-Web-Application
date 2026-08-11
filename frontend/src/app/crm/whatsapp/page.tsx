"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Send, Search, Check, CheckCheck, Clock, AlertCircle, UserCheck, MessageSquare, Settings, Download, Paperclip, X, Smile, CornerUpLeft, ExternalLink, PenSquare, FilePlus2, Pencil, ArrowLeft, ShoppingBag, Bell, BellOff, SlidersHorizontal, Play } from "lucide-react";
import { WhatsappGuideButton } from "@/components/whatsapp/WhatsappGuideButton";
import { EmojiPicker } from "@/components/whatsapp/EmojiPicker";
import {
    listWaConversations, getWaMessages, replyWaText, replyWaTemplate, updateWaConversation,
    listWaTemplates, isWindowOpen, WA_STATUS_LABEL, resolveWaConversationByLead,
    getWaMessageMediaUrl, downloadWaMessageMedia, replyWaMedia, reactWaMessage,
    listWaChannels, startWaConversation, listWaQuickReplies, listWaAgents, getWaConversationSalesOrders,
    setWaContactName, waContactName, listWaCatalog, sendWaProduct,
    type WaConversation, type WaMessage, type WaConversationStatus, type WaTemplate, type WaChannel, type WaQuickReply, type WaAgent, type WaCatalogProduct,
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

// Preset nada notifikasi (disintesis Web Audio — tanpa file). t=offset detik, d=durasi.
const NOTIF_TONES: Record<string, { label: string; notes: Array<{ f: number; t: number; d: number }> }> = {
    beep: { label: "Beep", notes: [{ f: 880, t: 0, d: 0.12 }, { f: 660, t: 0.12, d: 0.2 }] },
    ding: { label: "Ding", notes: [{ f: 1318, t: 0, d: 0.35 }] },
    chime: { label: "Chime", notes: [{ f: 660, t: 0, d: 0.12 }, { f: 990, t: 0.12, d: 0.28 }] },
    tritone: { label: "Tri-tone", notes: [{ f: 784, t: 0, d: 0.1 }, { f: 988, t: 0.1, d: 0.1 }, { f: 1319, t: 0.2, d: 0.28 }] },
    pop: { label: "Pop", notes: [{ f: 520, t: 0, d: 0.08 }] },
};

// Label ringkas tahap pipeline lead (untuk badge di header inbox).
const LEAD_STAGE_LABEL: Record<string, string> = {
    NEW: "Baru", FOLLOW_UP: "Follow-up", NEGOTIATION: "Nego",
    CLOSED_WON: "Closing ✓", CLOSED_LOST: "Batal", INVALID: "Invalid",
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
function MediaAttachment({ m, onImageClick }: { m: WaMessage; onImageClick?: (id: number) => void }) {
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
                <img
                    src={url}
                    alt="lampiran"
                    onClick={() => onImageClick?.(m.id)}
                    className="rounded-lg max-w-full max-h-72 object-contain cursor-zoom-in"
                />
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

// Gabung 2 daftar pesan (dedup by id, urut naik). Argumen kedua menimpa yang pertama
// → panggil merge(prev, incoming) agar data terbaru (status/reaksi) menang.
function mergeMessages(a: WaMessage[], b: WaMessage[]): WaMessage[] {
    const map = new Map<number, WaMessage>();
    for (const m of a) map.set(m.id, m);
    for (const m of b) map.set(m.id, m);
    return Array.from(map.values()).sort((x, y) => x.id - y.id);
}

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

// Pratinjau gambar layar penuh (lightbox) — muat ulang blob sendiri agar independen.
function ImageLightbox({ messageId, onClose }: { messageId: number; onClose: () => void }) {
    const [url, setUrl] = useState<string | null>(null);
    const [err, setErr] = useState(false);
    useEffect(() => {
        let active = true;
        let created: string | null = null;
        getWaMessageMediaUrl(messageId)
            .then((u) => { if (active) { created = u; setUrl(u); } else URL.revokeObjectURL(u); })
            .catch(() => { if (active) setErr(true); });
        return () => { active = false; if (created) URL.revokeObjectURL(created); };
    }, [messageId]);
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        document.addEventListener("keydown", onKey);
        document.body.style.overflow = "hidden";
        return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
    }, [onClose]);
    return (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4" onClick={onClose}>
            <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white" aria-label="Tutup">
                <X className="w-5 h-5" />
            </button>
            <button
                onClick={(e) => { e.stopPropagation(); downloadWaMessageMedia(messageId, `gambar-${messageId}.jpg`); }}
                className="absolute top-4 right-16 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
                aria-label="Unduh"
            >
                <Download className="w-5 h-5" />
            </button>
            {err ? (
                <div className="text-white/80">Gagal memuat gambar</div>
            ) : !url ? (
                <div className="text-white/60 animate-pulse">Memuat…</div>
            ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt="pratinjau" className="max-w-full max-h-full object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
            )}
        </div>
    );
}

function MessageBubble({ m, onReply, onReact, onImageClick }: {
    m: WaMessage;
    onReply: (m: WaMessage) => void;
    onReact: (id: number, emoji: string) => void;
    onImageClick: (id: number) => void;
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
                            <MediaAttachment m={m} onImageClick={onImageClick} />
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
    const { currentUser, isDesigner, isOperator } = useCurrentUser();
    const scopedInbox = isDesigner || isOperator; // lihat "milik saya + pool", bukan semua
    const [tab, setTab] = useState<WaConversationStatus | "ALL">("ALL");
    const [search, setSearch] = useState("");
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [composeOpen, setComposeOpen] = useState(false);
    // Filter penugasan: "all" (desainer = milikku + belum di-assign), "me", "unassigned", "so" (SO desainer).
    const [assignee, setAssignee] = useState<"all" | "me" | "unassigned" | "so">("all");
    const bottomRef = useRef<HTMLDivElement>(null);

    // Deep-link "Buka chat WA" dari pipeline: ?conv=<id> atau ?leadId=<id>.
    // Baca dari window (client-only) — hindari Suspense boundary useSearchParams.
    useEffect(() => {
        if (typeof window === "undefined") return;
        const sp = new URLSearchParams(window.location.search);
        const conv = sp.get("conv");
        const leadId = sp.get("leadId");
        if (conv) { setSelectedId(Number(conv)); return; }
        if (leadId) {
            resolveWaConversationByLead(Number(leadId))
                .then((r) => {
                    if (r.conversationId) setSelectedId(r.conversationId);
                    else alert("Belum ada percakapan WhatsApp untuk lead ini.");
                })
                .catch(() => {});
        }
    }, []);

    // Daftar percakapan — polling 8 dtk (realtime ringan untuk MVP).
    const { data: convData, isLoading } = useQuery({
        queryKey: ["wa-convos", tab, search, assignee],
        queryFn: () => listWaConversations({
            status: tab === "ALL" ? undefined : tab,
            q: search.trim() || undefined,
            assignee: assignee === "all" ? undefined : assignee,
            take: 50,
        }),
        refetchInterval: 20000, // fallback lambat — realtime ditangani SSE
        refetchIntervalInBackground: true, // tetap poll walau window tak fokus
        refetchOnWindowFocus: true,
    });
    const conversations = convData?.items ?? [];

    // ─── Notifikasi pesan masuk (bunyi + notifikasi OS) ──────────────────────
    const [soundOn, setSoundOn] = useState(true);
    useEffect(() => { try { setSoundOn(localStorage.getItem("wa_sound") !== "off"); } catch { /* noop */ } }, []);
    const toggleSound = () => setSoundOn((v) => { const nv = !v; try { localStorage.setItem("wa_sound", nv ? "on" : "off"); } catch { /* noop */ } return nv; });

    const audioCtxRef = useRef<AudioContext | null>(null);
    useEffect(() => {
        if (typeof window === "undefined") return;
        if ("Notification" in window && Notification.permission === "default") Notification.requestPermission().catch(() => {});
        const resume = () => {
            if (!audioCtxRef.current) {
                try { audioCtxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)(); } catch { /* noop */ }
            }
            audioCtxRef.current?.resume?.();
        };
        window.addEventListener("pointerdown", resume, { once: true });
        window.addEventListener("keydown", resume, { once: true });
        return () => { window.removeEventListener("pointerdown", resume); window.removeEventListener("keydown", resume); };
    }, []);
    // Nada notifikasi terpilih (preset atau custom data URL) — tersimpan di localStorage.
    const [tone, setTone] = useState("beep");
    const [customTone, setCustomTone] = useState<string | null>(null);
    const [notifOpen, setNotifOpen] = useState(false);
    useEffect(() => {
        try { setTone(localStorage.getItem("wa_tone") || "beep"); setCustomTone(localStorage.getItem("wa_tone_custom")); } catch { /* noop */ }
    }, []);
    const playNotif = () => {
        // Custom (audio yang diupload) → putar via <audio>.
        if (tone === "custom" && customTone) {
            try { const a = new Audio(customTone); a.volume = 0.6; void a.play().catch(() => {}); } catch { /* noop */ }
            return;
        }
        const ctx = audioCtxRef.current;
        if (!ctx) return;
        const preset = NOTIF_TONES[tone] || NOTIF_TONES.beep;
        const base = ctx.currentTime;
        for (const n of preset.notes) {
            try {
                const o = ctx.createOscillator(), g = ctx.createGain();
                o.connect(g); g.connect(ctx.destination);
                o.type = "sine";
                o.frequency.setValueAtTime(n.f, base + n.t);
                g.gain.setValueAtTime(0.0001, base + n.t);
                g.gain.exponentialRampToValueAtTime(0.18, base + n.t + 0.02);
                g.gain.exponentialRampToValueAtTime(0.0001, base + n.t + n.d);
                o.start(base + n.t); o.stop(base + n.t + n.d + 0.02);
            } catch { /* noop */ }
        }
    };
    const chooseTone = (k: string) => {
        setTone(k);
        try { localStorage.setItem("wa_tone", k); } catch { /* noop */ }
        audioCtxRef.current?.resume?.();
    };
    const onCustomTone = (file: File | undefined) => {
        if (!file) return;
        if (file.size > 400 * 1024) { alert("Ukuran nada maksimal 400KB"); return; }
        const r = new FileReader();
        r.onload = () => {
            const url = r.result as string;
            setCustomTone(url); setTone("custom");
            try { localStorage.setItem("wa_tone_custom", url); localStorage.setItem("wa_tone", "custom"); } catch { alert("Nada terlalu besar untuk disimpan"); }
        };
        r.readAsDataURL(file);
    };
    const prevUnreadRef = useRef<Map<number, number> | null>(null);
    useEffect(() => {
        if (!convData?.items) return;
        const cur = new Map<number, number>();
        let hit: WaConversation | null = null;
        for (const c of convData.items) {
            cur.set(c.id, c.unreadCount);
            const prev = prevUnreadRef.current?.get(c.id) ?? 0;
            if (prevUnreadRef.current && c.unreadCount > prev) hit = c;
        }
        const firstLoad = prevUnreadRef.current === null;
        prevUnreadRef.current = cur;
        if (firstLoad || !hit) return;
        if (soundOn) playNotif();
        if (typeof document !== "undefined" && document.hidden && "Notification" in window && Notification.permission === "granted") {
            const n = new Notification(`Pesan baru — ${waContactName(hit.contact)}`, { body: "Ada pesan WhatsApp masuk", tag: `wa-${hit.id}` });
            const target = hit.id;
            n.onclick = () => { window.focus(); setSelectedId(target); n.close(); };
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [convData, soundOn]);

    const selected = useMemo(
        () => conversations.find((c) => c.id === selectedId) ?? null,
        [conversations, selectedId],
    );

    // Pesan terbaru percakapan terpilih — polling 3 dtk (near real-time) + saat fokus balik.
    const { data: msgData } = useQuery({
        queryKey: ["wa-messages", selectedId],
        queryFn: () => getWaMessages(selectedId as number, { take: 50 }),
        enabled: selectedId != null,
        refetchInterval: 20000, // fallback lambat — realtime ditangani SSE
        refetchIntervalInBackground: true,
        refetchOnWindowFocus: true,
    });

    const [messages, setMessages] = useState<WaMessage[]>([]);
    const [hasMoreOlder, setHasMoreOlder] = useState(true);
    const [loadingOlder, setLoadingOlder] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const firstLoadRef = useRef(true);

    // ─── Real-time via SSE ── refetch HANYA saat ada event (bukan polling tiap detik).
    const selectedIdRef = useRef(selectedId);
    useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);
    useEffect(() => {
        const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
        if (!token) return;
        const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
        const es = new EventSource(`${API}/whatsapp/stream?token=${encodeURIComponent(token)}`);
        es.onmessage = (ev) => {
            let e: { type?: string; conversationId?: number } | null = null;
            try { e = JSON.parse(ev.data); } catch { return; }
            if (!e || e.type === "ping") return; // heartbeat → abaikan
            qc.invalidateQueries({ queryKey: ["wa-convos"] });
            if (e.conversationId && e.conversationId === selectedIdRef.current) {
                qc.invalidateQueries({ queryKey: ["wa-messages", selectedIdRef.current] });
            }
        };
        es.onopen = () => {
            // (re)connect → tarik ulang agar tak ada event terlewat saat koneksi sempat putus.
            qc.invalidateQueries({ queryKey: ["wa-convos"] });
            if (selectedIdRef.current) qc.invalidateQueries({ queryKey: ["wa-messages", selectedIdRef.current] });
        };
        return () => es.close();
    }, [qc]);

    // Reset daftar pesan saat pindah percakapan (HARUS sebelum efek merge).
    useEffect(() => {
        setMessages([]);
        setHasMoreOlder(true);
        setLoadingOlder(false);
        firstLoadRef.current = true;
    }, [selectedId]);

    // Gabung hasil polling (halaman terbaru) → data terbaru menimpa (status/reaksi).
    useEffect(() => {
        if (!msgData?.items) return;
        setMessages((prev) => mergeMessages(prev, msgData.items));
    }, [msgData]);

    // Infinite scroll: muat pesan lama saat scroll mendekati atas.
    const loadOlder = async () => {
        if (loadingOlder || !hasMoreOlder || messages.length === 0 || selectedId == null) return;
        setLoadingOlder(true);
        const el = scrollRef.current;
        const prevHeight = el?.scrollHeight ?? 0;
        try {
            const res = await getWaMessages(selectedId, { cursor: messages[0].id, take: 50 });
            if (res.items.length) setMessages((prev) => mergeMessages(res.items, prev));
            setHasMoreOlder(res.nextCursor != null);
            requestAnimationFrame(() => { if (el) el.scrollTop = el.scrollHeight - prevHeight; });
        } catch {
            // abaikan — coba lagi saat scroll berikutnya
        } finally {
            setLoadingOlder(false);
        }
    };

    const onMessagesScroll = () => {
        const el = scrollRef.current;
        if (el && el.scrollTop < 60 && hasMoreOlder && !loadingOlder) loadOlder();
    };

    // Auto-scroll: instan saat buka; smooth hanya bila sudah di dekat bawah (tak ganggu baca riwayat).
    useEffect(() => {
        const el = scrollRef.current;
        if (!el || messages.length === 0) return;
        if (firstLoadRef.current) {
            firstLoadRef.current = false;
            bottomRef.current?.scrollIntoView();
            return;
        }
        const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
        if (nearBottom) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Reset unread saat buka → refresh daftar.
    useEffect(() => {
        if (selectedId != null) qc.invalidateQueries({ queryKey: ["wa-convos"] });
    }, [msgData, selectedId, qc]);

    const [draft, setDraft] = useState("");
    const [replyingTo, setReplyingTo] = useState<WaMessage | null>(null);
    const [lightboxId, setLightboxId] = useState<number | null>(null);
    const [pendingFiles, setPendingFiles] = useState<File[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [showEmoji, setShowEmoji] = useState(false);
    const emojiWrapRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    // Pesan cepat ala WhatsApp: ketik "/" → daftar template, pilih → teks masuk.
    const [qrIndex, setQrIndex] = useState(0);
    const [qrDismissed, setQrDismissed] = useState(false);

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
        // Optimistic: pesan langsung tampil (status "mengirim…") tanpa nunggu round-trip.
        onMutate: (v: { text: string; replyTo?: string }) => {
            const tempId = Date.now() + Math.floor(Math.random() * 1000);
            const optimistic: WaMessage = {
                id: tempId,
                direction: "OUTBOUND" as WaMessage["direction"],
                type: "TEXT" as WaMessage["type"],
                status: "QUEUED",
                body: v.text,
                templateName: null,
                mediaUrl: null,
                mediaMimeType: null,
                waMessageId: null,
                reactionsJson: null,
                replyTo: replyingTo
                    ? { id: replyingTo.id, direction: replyingTo.direction, type: replyingTo.type, body: replyingTo.body }
                    : null,
                createdAt: new Date().toISOString(),
                sentBy: null,
            };
            const prevDraft = v.text;
            const prevReplyingTo = replyingTo;
            setMessages((prev) => mergeMessages(prev, [optimistic]));
            setDraft("");
            setReplyingTo(null);
            requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
            return { tempId, prevDraft, prevReplyingTo };
        },
        onSuccess: (realMsg, _v, ctx) => {
            // Ganti pesan sementara dgn hasil asli dari server (tanpa kedip / refetch).
            setMessages((prev) => mergeMessages(prev.filter((m) => m.id !== ctx?.tempId), [realMsg]));
            qc.invalidateQueries({ queryKey: ["wa-convos"] });
        },
        onError: (e: unknown, _v, ctx) => {
            // Gagal: buang pesan sementara & kembalikan teks agar mudah kirim ulang.
            if (ctx) {
                setMessages((prev) => prev.filter((m) => m.id !== ctx.tempId));
                setDraft(ctx.prevDraft);
                setReplyingTo(ctx.prevReplyingTo ?? null);
            }
            const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
            alert(msg || "Gagal mengirim pesan");
        },
    });

    // Progres kirim banyak lampiran (mis. "Mengirim 2/5…").
    const [sendProgress, setSendProgress] = useState<{ current: number; total: number } | null>(null);
    const mediaMut = useMutation({
        // Kirim banyak lampiran berurutan; caption (draft) & konteks reply hanya di gambar pertama.
        mutationFn: async (payload: { files: File[]; caption?: string; replyTo?: string }) => {
            const total = payload.files.length;
            for (let i = 0; i < total; i++) {
                setSendProgress({ current: i + 1, total });
                await replyWaMedia(
                    selectedId as number,
                    payload.files[i],
                    i === 0 ? payload.caption : undefined,
                    i === 0 ? payload.replyTo : undefined,
                );
            }
        },
        onSuccess: () => {
            setDraft("");
            setPendingFiles([]);
            setReplyingTo(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
            qc.invalidateQueries({ queryKey: ["wa-messages", selectedId] });
            qc.invalidateQueries({ queryKey: ["wa-convos"] });
        },
        onError: (e: unknown) => {
            const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
            alert(msg || "Gagal mengirim lampiran");
        },
        onSettled: () => setSendProgress(null),
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
        if (pendingFiles.length) {
            mediaMut.mutate({ files: pendingFiles, caption: draft.trim() || undefined, replyTo });
        } else if (draft.trim()) {
            replyMut.mutate({ text: draft.trim(), replyTo });
        }
    };

    // Object URL thumbnail per lampiran gambar (dibuat & di-revoke otomatis).
    const [pendingPreviews, setPendingPreviews] = useState<Array<string | null>>([]);
    useEffect(() => {
        const urls = pendingFiles.map((f) => (f.type.startsWith("image/") ? URL.createObjectURL(f) : null));
        setPendingPreviews(urls);
        return () => urls.forEach((u) => u && URL.revokeObjectURL(u));
    }, [pendingFiles]);
    const removePendingAt = (idx: number) => {
        setPendingFiles((prev) => prev.filter((_, i) => i !== idx));
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    // Tempel (Ctrl+V) gambar/screenshot dari clipboard → jadikan lampiran.
    // Teks biasa dibiarkan default (masuk ke textarea).
    const handleComposerPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        const imgs: File[] = [];
        Array.from(items).forEach((it, i) => {
            if (it.kind !== "file") return;
            const file = it.getAsFile();
            if (file && file.type.startsWith("image/")) {
                const ext = (file.type.split("/")[1] || "png").replace("jpeg", "jpg");
                const named = new File([file], file.name && file.name !== "image.png" ? file.name : `tempel-${Date.now()}-${i}.${ext}`, { type: file.type });
                imgs.push(named);
            }
        });
        if (imgs.length) {
            e.preventDefault();
            setPendingFiles((prev) => [...prev, ...imgs]);
        }
    };

    // Bersihkan draft & lampiran saat pindah percakapan.
    useEffect(() => {
        setDraft("");
        setPendingFiles([]);
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

    // CS ubah nama kontak (prioritas tampil). Kosongkan = kembali ke nama profil WA.
    const renameMut = useMutation({
        mutationFn: (v: { contactId: number; name: string | null }) => setWaContactName(v.contactId, v.name),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["wa-convos"] }),
        onError: (e: unknown) => alert((e as { response?: { data?: { message?: string } } })?.response?.data?.message || "Gagal menyimpan nama"),
    });
    const promptRename = () => {
        if (!selected) return;
        const cur = selected.contact.customName || selected.contact.profileName || "";
        const input = window.prompt("Nama kontak (kosongkan untuk pakai nama WhatsApp):", cur);
        if (input === null) return; // batal
        renameMut.mutate({ contactId: selected.contact.id, name: input.trim() || null });
    };

    // Kirim produk katalog ke chat (interactive product message).
    const [showProducts, setShowProducts] = useState(false);
    const sendProductMut = useMutation({
        mutationFn: (p: WaCatalogProduct) => sendWaProduct(selectedId as number, {
            productRetailerId: p.retailerId || "",
            productName: p.name || undefined,
            bodyText: draft.trim() || undefined,
        }),
        onSuccess: () => {
            setDraft("");
            setShowProducts(false);
            qc.invalidateQueries({ queryKey: ["wa-messages", selectedId] });
            qc.invalidateQueries({ queryKey: ["wa-convos"] });
        },
        onError: (e: unknown) => alert((e as { response?: { data?: { message?: string } } })?.response?.data?.message || "Gagal mengirim produk"),
    });

    // Template APPROVED — dipakai saat jendela 24 jam tutup.
    const [tplId, setTplId] = useState<number | null>(null);
    const { data: templates = [] } = useQuery({
        queryKey: ["wa-templates-approved"],
        queryFn: listWaTemplates,
        enabled: selectedId != null,
        select: (all: WaTemplate[]) => all.filter((t) => t.status === "APPROVED"),
    });
    // Pesan cepat / canned message (daftar sendiri, BUKAN template Meta).
    const { data: quickReplies = [] } = useQuery({
        queryKey: ["wa-quick-replies"],
        queryFn: listWaQuickReplies,
        enabled: selectedId != null,
        select: (all: WaQuickReply[]) => all.filter((q) => q.isActive),
    });
    // Agen yang bisa ditugaskan (untuk "Oper ke…").
    const { data: agents = [] } = useQuery({
        queryKey: ["wa-agents"], queryFn: listWaAgents, enabled: selectedId != null,
    });
    // SO yang terkait percakapan terpilih (badge "SO" di header).
    const { data: convSalesOrders = [] } = useQuery({
        queryKey: ["wa-convo-sos", selectedId], queryFn: () => getWaConversationSalesOrders(selectedId as number),
        enabled: selectedId != null,
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

    // Popup pesan cepat: aktif saat draft diawali "/" (belum ada baris baru).
    const slashActive = !qrDismissed && draft.startsWith("/") && !draft.includes("\n");
    const slashQuery = draft.slice(1).toLowerCase().trim();
    const quickMatches = slashActive
        ? quickReplies
              .filter((q) =>
                  q.shortcut.toLowerCase().includes(slashQuery) ||
                  (q.title || "").toLowerCase().includes(slashQuery) ||
                  q.body.toLowerCase().includes(slashQuery),
              )
              .slice(0, 6)
        : [];
    useEffect(() => { setQrIndex(0); }, [slashQuery, slashActive]);
    const pickQuick = (q: WaQuickReply) => {
        setDraft(q.body);
        setQrDismissed(true);
        requestAnimationFrame(() => textareaRef.current?.focus());
    };

    return (
        <div className="flex h-[calc(100dvh-8rem)] gap-3 p-2 md:p-3">
            {/* ─── Panel kiri: daftar chat (di HP: full-screen; sembunyi saat ada chat dipilih) ─── */}
            <aside className={`w-full md:max-w-sm flex-col rounded-2xl border border-border bg-card/60 backdrop-blur overflow-hidden ${selectedId ? "hidden md:flex" : "flex"}`}>
                <div className="p-3 border-b border-border space-y-2">
                    <div className="flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-emerald-500" />
                        <h1 className="font-semibold">WhatsApp CRM</h1>
                        <WhatsappGuideButton className="ml-auto p-1.5 rounded-lg hover:bg-muted" />
                        <button onClick={toggleSound} title={soundOn ? "Bunyi notifikasi: aktif" : "Bunyi notifikasi: nonaktif"}
                            className={`p-1.5 rounded-lg hover:bg-muted ${soundOn ? "text-emerald-500" : "opacity-60"}`}>
                            {soundOn ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                        </button>
                        <button onClick={() => setNotifOpen(true)} title="Atur nada notifikasi"
                            className="p-1.5 rounded-lg hover:bg-muted opacity-70">
                            <SlidersHorizontal className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setComposeOpen(true)} title="Chat baru — simpan nomor & kirim pesan"
                            className="p-1.5 rounded-lg hover:bg-muted text-emerald-500">
                            <PenSquare className="w-4 h-4" />
                        </button>
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
                    {/* Filter penugasan */}
                    <div className="flex gap-1 flex-wrap">
                        {([
                            { key: "all", label: scopedInbox ? "Milik saya + pool" : "Semua" },
                            ...(isDesigner ? [{ key: "so", label: "SO saya" } as const] : []),
                            { key: "me", label: "Chat saya" },
                            { key: "unassigned", label: "Belum di-assign" },
                        ] as const).map((f) => (
                            <button
                                key={f.key}
                                onClick={() => setAssignee(f.key)}
                                className={`px-2.5 py-1 rounded-full text-[11px] transition ${
                                    assignee === f.key ? "bg-emerald-500 text-white" : "bg-muted/60 hover:bg-muted"
                                }`}
                            >
                                {f.label}
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
                                {waContactName(c.contact).replace(/^\+/, "").slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="font-medium truncate">{waContactName(c.contact)}</span>
                                    <span className="text-[10px] opacity-50 shrink-0">{timeAgo(c.lastMessageAt)}</span>
                                </div>
                                {/* Nomor HP */}
                                <div className="text-xs opacity-60 truncate">+{c.contact.waId}</div>
                                {/* Status lead + CS yang handle */}
                                <div className="flex items-center justify-between gap-2 mt-0.5">
                                    <span className="text-[11px] truncate flex items-center gap-1 min-w-0">
                                        {(() => {
                                            const st = c.contact.lead?.status;
                                            const done = st === "CLOSED_WON" || st === "CLOSED_LOST" || st === "INVALID";
                                            if (st && !done) return <span className="rounded-full bg-muted px-1.5 py-0.5 shrink-0">{LEAD_STAGE_LABEL[st] ?? st}</span>;
                                            if (c.contact.customerId) return <span className="rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 shrink-0">Pelanggan lama</span>;
                                            if (done) return <span className="opacity-50 shrink-0">Selesai</span>;
                                            return <span className="opacity-50 shrink-0">Kontak baru</span>;
                                        })()}
                                        {c.assignedTo?.name && <span className="opacity-60 truncate">· {c.assignedTo.name}</span>}
                                    </span>
                                    {c.unreadCount > 0 && (
                                        <span className="bg-emerald-500 text-white text-[10px] rounded-full px-1.5 min-w-[18px] text-center shrink-0">
                                            {c.unreadCount}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </aside>

            {/* ─── Panel kanan: thread (di HP: full-screen; sembunyi saat belum ada chat dipilih) ─── */}
            <section className={`flex-1 flex-col rounded-2xl border border-border bg-card/60 backdrop-blur overflow-hidden ${selectedId ? "flex" : "hidden md:flex"}`}>
                {!selected ? (
                    <div className="flex-1 grid place-items-center opacity-50 text-sm">
                        Pilih percakapan untuk mulai membalas.
                    </div>
                ) : (
                    <>
                        <header className="p-3 border-b border-border flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                                <button
                                    type="button"
                                    onClick={() => setSelectedId(null)}
                                    aria-label="Kembali ke daftar chat"
                                    className="md:hidden -ml-1 p-1.5 rounded-lg hover:bg-muted shrink-0"
                                >
                                    <ArrowLeft className="w-5 h-5" />
                                </button>
                                <div className="min-w-0">
                                <div className="font-semibold truncate flex items-center gap-1.5">
                                    <span className="truncate">{waContactName(selected.contact)}</span>
                                    <button
                                        type="button"
                                        onClick={promptRename}
                                        title="Ubah nama kontak"
                                        className="p-1 rounded-md hover:bg-muted opacity-60 hover:opacity-100 shrink-0"
                                    >
                                        <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                                <div className="text-xs opacity-60 flex flex-wrap items-center gap-x-2 gap-y-1">
                                    <span>+{selected.contact.waId}</span>
                                    <StatusBadge tone={STATUS_TONE[selected.status]}>
                                        {WA_STATUS_LABEL[selected.status]}
                                    </StatusBadge>
                                    {selected.assignedTo?.name && (
                                        <span className="opacity-70">· {selected.assignedTo.name}</span>
                                    )}
                                    {selected.contact.lead && (
                                        <Link
                                            href={`/crm/leads?leadId=${selected.contact.lead.id}`}
                                            className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-300 hover:underline"
                                            title="Buka lead di pipeline"
                                        >
                                            <ExternalLink className="w-3 h-3" />
                                            Lead: {LEAD_STAGE_LABEL[selected.contact.lead.status] ?? selected.contact.lead.status}
                                        </Link>
                                    )}
                                    {convSalesOrders.map((so) => (
                                        <Link
                                            key={so.id}
                                            href={`/sales-orders/${so.id}`}
                                            className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-300 hover:underline"
                                            title={`SO ${so.soNumber} · desainer ${so.designerName} · ${so.status}`}
                                        >
                                            <ExternalLink className="w-3 h-3" />
                                            SO: {so.soNumber}
                                        </Link>
                                    ))}
                                </div>
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 shrink-0 md:flex-nowrap">
                                <Link
                                    href={(() => {
                                        const c = selected.contact;
                                        const params = new URLSearchParams();
                                        params.set("customerName", c.customer?.name || c.profileName || c.lead?.name || "");
                                        params.set("phone", c.waId || "");
                                        if (c.customer?.address) params.set("address", c.customer.address);
                                        if (c.customerId) params.set("customerId", String(c.customerId));
                                        return `/sales-orders/new?${params.toString()}`;
                                    })()}
                                    className="text-xs px-2.5 py-1.5 rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 flex items-center gap-1"
                                    title="Buat Sales Order dari pelanggan ini"
                                >
                                    <FilePlus2 className="w-3.5 h-3.5" /> Buat SO
                                </Link>
                                {agents.length > 0 && (
                                    <select
                                        value=""
                                        onChange={(e) => { const v = e.target.value; if (v) assignMut.mutate({ assignedToId: Number(v) }); e.currentTarget.value = ""; }}
                                        className="text-xs rounded-lg bg-muted/60 px-2 py-1.5 outline-none max-w-[9.5rem]"
                                        title="Oper percakapan ke agen / desainer"
                                    >
                                        <option value="">Oper ke…</option>
                                        {agents.filter((a) => a.id !== selected.assignedToId).map((a) => (
                                            <option key={a.id} value={a.id}>{a.name || `#${a.id}`}{a.roleName ? ` (${a.roleName})` : ""}</option>
                                        ))}
                                    </select>
                                )}
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

                        <div ref={scrollRef} onScroll={onMessagesScroll} className="flex-1 overflow-y-auto p-4 space-y-2 bg-muted/20">
                            {loadingOlder && (
                                <div className="text-center text-xs opacity-60 py-1">Memuat pesan lama…</div>
                            )}
                            {!hasMoreOlder && messages.length > 0 && (
                                <div className="text-center text-[11px] opacity-40 py-1">— awal percakapan —</div>
                            )}
                            {messages.map((m) => (
                                <MessageBubble
                                    key={m.id}
                                    m={m}
                                    onReply={setReplyingTo}
                                    onReact={(id, emoji) => reactMut.mutate({ id, emoji })}
                                    onImageClick={setLightboxId}
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

                                {/* Preview lampiran terpilih (galeri thumbnail) */}
                                {pendingFiles.length > 0 && (
                                    <div className="bg-muted/60 rounded-lg px-2.5 py-2 space-y-1.5">
                                        <div className="text-[11px] opacity-60">{pendingFiles.length} lampiran{pendingFiles.length > 1 ? " — caption menempel di gambar pertama" : ""}</div>
                                        <div className="flex flex-wrap gap-2">
                                            {pendingFiles.map((f, i) => (
                                                <div key={i} className="relative group">
                                                    {pendingPreviews[i] ? (
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        <img src={pendingPreviews[i]!} alt={f.name} className="w-16 h-16 rounded-md object-cover border border-border" />
                                                    ) : (
                                                        <div className="w-16 h-16 rounded-md border border-border flex flex-col items-center justify-center text-[9px] p-1 text-center bg-background/60">
                                                            <Paperclip className="w-3.5 h-3.5 mb-0.5" />
                                                            <span className="truncate w-full">{f.name.split(".").pop()?.toUpperCase()}</span>
                                                        </div>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => removePendingAt(i)}
                                                        className="absolute -top-1.5 -right-1.5 bg-black/70 text-white rounded-full p-0.5 hover:bg-black"
                                                        aria-label="Hapus lampiran"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <div className="flex items-end gap-2">
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        multiple
                                        className="hidden"
                                        accept="image/jpeg,image/png,image/webp,video/mp4,video/3gpp,audio/*,application/pdf,text/plain,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                                        onChange={(e) => { const fs = Array.from(e.target.files ?? []); if (fs.length) setPendingFiles((prev) => [...prev, ...fs]); }}
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
                                    <button
                                        type="button"
                                        onClick={() => setShowProducts(true)}
                                        className="rounded-xl bg-muted/60 text-foreground p-2.5 hover:bg-muted transition shrink-0"
                                        title="Kirim produk dari katalog"
                                    >
                                        <ShoppingBag className="w-4 h-4" />
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
                                    <div className="relative flex-1">
                                        {/* Popup pesan cepat (trigger "/") */}
                                        {slashActive && (
                                            <div className="absolute bottom-full left-0 right-0 mb-2 z-30 rounded-xl border border-border bg-card shadow-lg overflow-hidden">
                                                <div className="px-3 py-1.5 text-[11px] opacity-60 border-b border-border flex items-center justify-between">
                                                    <span>⚡ Pesan cepat</span>
                                                    <span className="opacity-70">↑↓ Enter · Esc batal</span>
                                                </div>
                                                <div className="max-h-64 overflow-y-auto">
                                                    {quickMatches.length === 0 ? (
                                                        <div className="px-3 py-2 text-xs opacity-60">
                                                            {quickReplies.length === 0 ? (
                                                                <>Belum ada pesan cepat. <Link href="/crm/whatsapp/quick-replies" className="underline">Buat →</Link></>
                                                            ) : "Tidak ada yang cocok."}
                                                        </div>
                                                    ) : (
                                                        quickMatches.map((q, i) => (
                                                            <button
                                                                type="button"
                                                                key={q.id}
                                                                onMouseEnter={() => setQrIndex(i)}
                                                                onClick={() => pickQuick(q)}
                                                                className={`w-full text-left px-3 py-2 ${i === qrIndex ? "bg-muted" : "hover:bg-muted/60"}`}
                                                            >
                                                                <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                                                    /{q.shortcut}{q.title ? <span className="opacity-60 font-normal"> · {q.title}</span> : null}
                                                                </div>
                                                                <div className="text-[11px] opacity-60 line-clamp-2 whitespace-pre-wrap">{q.body}</div>
                                                            </button>
                                                        ))
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                        <textarea
                                            ref={textareaRef}
                                            value={draft}
                                            onChange={(e) => { setDraft(e.target.value); setQrDismissed(false); }}
                                            onPaste={handleComposerPaste}
                                            onKeyDown={(e) => {
                                                if (slashActive && quickMatches.length) {
                                                    if (e.key === "ArrowDown") { e.preventDefault(); setQrIndex((i) => (i + 1) % quickMatches.length); return; }
                                                    if (e.key === "ArrowUp") { e.preventDefault(); setQrIndex((i) => (i - 1 + quickMatches.length) % quickMatches.length); return; }
                                                    if ((e.key === "Enter" && !e.shiftKey) || e.key === "Tab") { e.preventDefault(); pickQuick(quickMatches[qrIndex]); return; }
                                                    if (e.key === "Escape") { e.preventDefault(); setQrDismissed(true); return; }
                                                }
                                                if (e.key === "Enter" && !e.shiftKey) {
                                                    e.preventDefault();
                                                    sendComposer();
                                                }
                                            }}
                                            rows={1}
                                            placeholder={pendingFiles.length ? "Tambah keterangan (opsional)…" : "Ketik balasan…  ( / untuk pesan cepat )"}
                                            className="w-full resize-none rounded-xl bg-muted/60 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 max-h-32"
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={(!draft.trim() && pendingFiles.length === 0) || mediaMut.isPending || replyMut.isPending}
                                        className="rounded-xl bg-emerald-500 text-white p-2.5 disabled:opacity-40 hover:bg-emerald-600 transition shrink-0"
                                    >
                                        <Send className="w-4 h-4" />
                                    </button>
                                </div>
                                {mediaMut.isPending && (
                                    <div className="text-[11px] opacity-60 text-center animate-pulse">
                                        {sendProgress && sendProgress.total > 1
                                            ? `Mengirim ${sendProgress.current}/${sendProgress.total} lampiran…`
                                            : "Mengunggah lampiran…"}
                                    </div>
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

            {lightboxId != null && <ImageLightbox messageId={lightboxId} onClose={() => setLightboxId(null)} />}
            {notifOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setNotifOpen(false)}>
                    <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-4 space-y-3 shadow-xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                            <Bell className="w-5 h-5 text-emerald-500" />
                            <h2 className="font-semibold">Nada notifikasi</h2>
                            <button onClick={() => setNotifOpen(false)} className="ml-auto p-1 rounded-lg hover:bg-muted"><X className="w-4 h-4" /></button>
                        </div>
                        <label className="flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={soundOn} onChange={toggleSound} /> Bunyikan notifikasi
                        </label>
                        <div className="space-y-1">
                            {Object.entries(NOTIF_TONES).map(([k, v]) => (
                                <div key={k} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${tone === k ? "bg-muted" : "hover:bg-muted/60"}`}>
                                    <label className="flex items-center gap-2 text-sm flex-1 cursor-pointer">
                                        <input type="radio" name="tone" checked={tone === k} onChange={() => chooseTone(k)} /> {v.label}
                                    </label>
                                    <button type="button" onClick={() => { audioCtxRef.current?.resume?.(); chooseTone(k); setTimeout(playNotif, 60); }}
                                        className="p-1 rounded hover:bg-muted" title="Dengar"><Play className="w-3.5 h-3.5" /></button>
                                </div>
                            ))}
                            <div className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${tone === "custom" ? "bg-muted" : "hover:bg-muted/60"}`}>
                                <label className="flex items-center gap-2 text-sm flex-1 cursor-pointer">
                                    <input type="radio" name="tone" checked={tone === "custom"} disabled={!customTone} onChange={() => chooseTone("custom")} />
                                    Nada sendiri {customTone ? "" : "(belum diunggah)"}
                                </label>
                                {customTone && (
                                    <button type="button" onClick={() => { chooseTone("custom"); setTimeout(playNotif, 60); }} className="p-1 rounded hover:bg-muted" title="Dengar"><Play className="w-3.5 h-3.5" /></button>
                                )}
                            </div>
                        </div>
                        <label className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/70 cursor-pointer">
                            <PenSquare className="w-3.5 h-3.5" /> Unggah nada (audio, maks 400KB)
                            <input type="file" accept="audio/*" className="hidden" onChange={(e) => { onCustomTone(e.target.files?.[0]); e.currentTarget.value = ""; }} />
                        </label>
                        <p className="text-[11px] opacity-50">Klik ▶ untuk mendengar. Pilihan tersimpan otomatis di perangkat ini.</p>
                    </div>
                </div>
            )}
            {showProducts && selected && (
                <ProductPickerModal
                    channelId={selected.channel.id}
                    sending={sendProductMut.isPending}
                    onPick={(p) => sendProductMut.mutate(p)}
                    onClose={() => setShowProducts(false)}
                />
            )}
            {composeOpen && (
                <NewChatModal
                    onClose={() => setComposeOpen(false)}
                    onStarted={(conversationId) => {
                        setComposeOpen(false);
                        setTab("ALL");
                        setSearch("");
                        setSelectedId(conversationId);
                        qc.invalidateQueries({ queryKey: ["wa-convos"] });
                    }}
                />
            )}
        </div>
    );
}

// ─── Modal "Chat Baru": simpan nomor baru + kirim template pembuka ───────────
function NewChatModal({ onClose, onStarted }: { onClose: () => void; onStarted: (conversationId: number) => void }) {
    const [phone, setPhone] = useState("");
    const [name, setName] = useState("");
    const [channelId, setChannelId] = useState<number | "">("");
    const [tplId, setTplId] = useState<number | "">("");

    const { data: channels = [] } = useQuery({
        queryKey: ["wa-channels"],
        queryFn: listWaChannels,
        select: (all: WaChannel[]) => all.filter((c) => c.isActive),
    });
    const { data: templates = [] } = useQuery({
        queryKey: ["wa-templates-approved"],
        queryFn: listWaTemplates,
        select: (all: WaTemplate[]) => all.filter((t) => t.status === "APPROVED"),
    });

    // Pilih channel default (yang pertama) saat data siap.
    useEffect(() => {
        if (channelId === "" && channels.length > 0) setChannelId(channels[0].id);
    }, [channels, channelId]);

    const selectedTpl = templates.find((t) => t.id === tplId);
    // Deteksi jumlah variabel {{n}} di body template (kalau ada, pesan pertama butuh isian → belum didukung di modal ini).
    const varCount = selectedTpl ? (selectedTpl.bodyText.match(/\{\{\s*\d+\s*\}\}/g) || []).length : 0;

    const startMut = useMutation({
        mutationFn: () => {
            if (!selectedTpl) throw new Error("Pilih template pembuka");
            return startWaConversation({
                channelId: channelId as number,
                phone: phone.trim(),
                name: name.trim() || undefined,
                template: { name: selectedTpl.name, language: selectedTpl.language, previewText: selectedTpl.bodyText },
            });
        },
        onSuccess: (res) => onStarted(res.conversationId),
        onError: (e: unknown) => {
            const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
            alert(msg || (e as Error).message || "Gagal memulai chat");
        },
    });

    const digits = phone.replace(/[^0-9]/g, "");
    const canSend = digits.length >= 8 && channelId !== "" && tplId !== "" && varCount === 0 && !startMut.isPending;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
            <div className="w-full max-w-md rounded-2xl border border-border bg-card p-4 space-y-3 shadow-xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-2">
                    <PenSquare className="w-5 h-5 text-emerald-500" />
                    <h2 className="font-semibold">Chat Baru</h2>
                    <button onClick={onClose} className="ml-auto p-1 rounded-lg hover:bg-muted"><X className="w-4 h-4" /></button>
                </div>
                <p className="text-xs opacity-60">
                    Simpan nomor baru & kirim pesan pertama. Nomor tersimpan sebagai kontak + lead CRM.
                    Pesan pertama <b>wajib pakai template</b> (aturan Meta); pelanggan bisa dibalas bebas setelah membalas.
                </p>

                <label className="block text-sm space-y-1">
                    <span className="opacity-70">Nomor WhatsApp</span>
                    <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0812xxxx / 62812xxxx" inputMode="tel"
                        className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm" />
                </label>

                <label className="block text-sm space-y-1">
                    <span className="opacity-70">Nama <span className="opacity-50">(opsional)</span></span>
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama kontak"
                        className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm" />
                </label>

                <label className="block text-sm space-y-1">
                    <span className="opacity-70">Kirim dari nomor</span>
                    <select value={channelId} onChange={(e) => setChannelId(e.target.value === "" ? "" : Number(e.target.value))}
                        className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm">
                        <option value="">Pilih channel…</option>
                        {channels.map((c) => (
                            <option key={c.id} value={c.id}>{c.label}{c.displayNumber ? ` (${c.displayNumber})` : ""}</option>
                        ))}
                    </select>
                    {channels.length === 0 && <span className="text-xs text-amber-500">Belum ada channel aktif.</span>}
                </label>

                <label className="block text-sm space-y-1">
                    <span className="opacity-70">Template pembuka</span>
                    {templates.length === 0 ? (
                        <span className="text-xs text-amber-500 block">
                            Belum ada template disetujui. <Link href="/crm/whatsapp/templates" className="underline">Kelola template →</Link>
                        </span>
                    ) : (
                        <select value={tplId} onChange={(e) => setTplId(e.target.value === "" ? "" : Number(e.target.value))}
                            className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm">
                            <option value="">Pilih template…</option>
                            {templates.map((t) => (
                                <option key={t.id} value={t.id}>{t.name} ({t.language})</option>
                            ))}
                        </select>
                    )}
                </label>

                {selectedTpl && (
                    <div className="text-xs rounded-lg bg-muted/60 p-2 whitespace-pre-wrap">{selectedTpl.bodyText}</div>
                )}
                {varCount > 0 && (
                    <div className="text-xs text-amber-500">
                        Template ini punya {varCount} variabel ({"{{1}}"}…). Untuk pesan berisi variabel, kirim lewat menu <b>Broadcast</b> dulu.
                    </div>
                )}

                <button onClick={() => startMut.mutate()} disabled={!canSend}
                    className="w-full rounded-lg bg-emerald-500 text-white py-2 text-sm font-medium disabled:opacity-50">
                    {startMut.isPending ? "Mengirim…" : "Simpan & Kirim"}
                </button>
            </div>
        </div>
    );
}

// ─── Modal pilih produk katalog untuk dikirim ke chat ────────────────────────
function ProductPickerModal({ channelId, sending, onPick, onClose }: {
    channelId: number;
    sending: boolean;
    onPick: (p: WaCatalogProduct) => void;
    onClose: () => void;
}) {
    const [q, setQ] = useState("");
    const [sku, setSku] = useState("");
    const { data: products = [], isLoading, error } = useQuery({
        queryKey: ["wa-catalog", channelId],
        queryFn: () => listWaCatalog(channelId),
        retry: false,
    });
    const shown = products.filter((p) => !q || (p.name || "").toLowerCase().includes(q.toLowerCase()));
    const sendSku = () => {
        const id = sku.trim();
        if (!id) return;
        onPick({ id: `manual-${id}`, retailerId: id, name: id, description: null, price: null, currency: null, imageUrl: null, url: null, availability: null });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
            <div className="w-full max-w-md max-h-[85vh] flex flex-col rounded-2xl border border-border bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-2 p-4 border-b border-border">
                    <ShoppingBag className="w-5 h-5 text-emerald-500" />
                    <h2 className="font-semibold">Kirim produk katalog</h2>
                    <button onClick={onClose} className="ml-auto p-1 rounded-lg hover:bg-muted"><X className="w-4 h-4" /></button>
                </div>
                <div className="p-3 border-b border-border">
                    <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari produk…"
                        className="w-full rounded-lg bg-muted/60 px-3 py-1.5 text-sm outline-none" />
                </div>
                <div className="overflow-y-auto p-2">
                    {isLoading ? (
                        <p className="text-sm opacity-60 p-3">Memuat katalog…</p>
                    ) : error ? (
                        <p className="text-sm text-amber-600 dark:text-amber-400 p-3">
                            {(error as { response?: { data?: { message?: string } } })?.response?.data?.message || "Gagal memuat katalog. Cek koneksi katalog di Commerce Manager."}
                        </p>
                    ) : shown.length === 0 ? (
                        <p className="text-sm opacity-60 p-3">Tidak ada produk. <Link href="/crm/whatsapp/catalog" className="underline">Kelola katalog →</Link></p>
                    ) : (
                        <ul className="space-y-1">
                            {shown.map((p) => (
                                <li key={p.id}>
                                    <button
                                        type="button"
                                        disabled={sending || !p.retailerId}
                                        onClick={() => onPick(p)}
                                        className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-muted text-left disabled:opacity-50"
                                        title={!p.retailerId ? "Produk tanpa SKU tak bisa dikirim" : "Kirim produk ini"}
                                    >
                                        {p.imageUrl ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={p.imageUrl} alt={p.name ?? ""} className="w-12 h-12 rounded-md object-cover border border-border shrink-0" />
                                        ) : (
                                            <div className="w-12 h-12 rounded-md bg-muted grid place-items-center shrink-0"><ShoppingBag className="w-4 h-4 opacity-50" /></div>
                                        )}
                                        <div className="min-w-0 flex-1">
                                            <div className="text-sm truncate">{p.name}</div>
                                            <div className="text-xs text-emerald-600 dark:text-emerald-400">{p.price}</div>
                                        </div>
                                        <Send className="w-4 h-4 opacity-60 shrink-0" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                {/* Fallback: kirim via SKU manual (tak butuh izin catalog_management) */}
                <div className="border-t border-border p-3 space-y-1.5">
                    <div className="text-[11px] opacity-60">Atau kirim via <b>SKU/ID produk</b> (dari Commerce Manager) — tanpa perlu izin katalog:</div>
                    <div className="flex gap-2">
                        <input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="mis. spanduk_flexi_01"
                            className="flex-1 rounded-lg bg-muted/60 px-3 py-1.5 text-sm outline-none font-mono"
                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); sendSku(); } }} />
                        <button type="button" onClick={sendSku} disabled={sending || !sku.trim()}
                            className="text-sm px-3 py-1.5 rounded-lg bg-emerald-500 text-white disabled:opacity-50 flex items-center gap-1">
                            <Send className="w-3.5 h-3.5" /> Kirim
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
