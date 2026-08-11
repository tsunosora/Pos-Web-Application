"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { X, Send, Loader2, Bot, Sparkles, Package, ChevronRight } from "lucide-react";
import { getStudioAiStatus, sendAiChat, type AiChatMessage } from "@/lib/api/studioAi";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
function imgSrc(u: string | null) {
    if (!u) return null;
    if (u.startsWith("http")) return u;
    return `${API_BASE}${u.startsWith("/") ? "" : "/"}${u}`;
}

/** Avatar: URL gambar → img; emoji/teks → span; kosong → ikon fallback. */
function renderAvatar(avatar: string | undefined, fallback: ReactNode): ReactNode {
    const a = (avatar || "").trim();
    if (!a) return fallback;
    if (/^(https?:\/\/|\/)/.test(a)) {
        const src = a.startsWith("http") ? a : imgSrc(a) || a;
        return <img src={src} alt="" className="w-full h-full object-cover" />;
    }
    return <span className="leading-none">{a}</span>;
}

// Tahap "berpikir" — istilah playful bertema meracik/menyajikan, tetap terasa progres.
const THINKING_PHRASES = [
    "Mikir dulu ya…",
    "Meracik jawaban…",
    "Mengaduk data & ide…",
    "Menyajikan…",
    "Hampir matang…",
];

function ThinkingBubble() {
    const [idx, setIdx] = useState(0);
    useEffect(() => {
        const t = setInterval(() => setIdx((i) => Math.min(i + 1, THINKING_PHRASES.length - 1)), 1800);
        return () => clearInterval(t);
    }, []);
    return (
        <div className="flex justify-start">
            <div className="bg-muted rounded-2xl rounded-bl-sm px-3 py-2 text-sm text-muted-foreground inline-flex items-center gap-2">
                <span className="flex gap-1 items-end">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-bounce [animation-delay:300ms]" />
                </span>
                <span key={idx} className="animate-in fade-in duration-300">{THINKING_PHRASES[idx]}</span>
            </div>
        </div>
    );
}

const SUGGESTIONS = [
    "Menurutmu hasil cetak yang bagus pakai produk apa?",
    "Harga banner flexi 3x1 meter?",
    "Hitung harga jual kalau HPP 5.000 mau margin 40%",
];

/** Render **tebal** + link (http/wa.me) yang bisa diklik dalam satu baris. */
function renderInline(text: string) {
    return text.split(/(\*\*[^*]+\*\*|https?:\/\/[^\s]+|wa\.me\/[0-9]+)/g).map((part, i) => {
        if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
        if (/^(https?:\/\/|wa\.me\/)/.test(part)) {
            const href = part.startsWith("http") ? part : `https://${part}`;
            return <a key={i} href={href} target="_blank" rel="noopener noreferrer" className="text-orange-600 underline break-all">{part}</a>;
        }
        return <span key={i}>{part}</span>;
    });
}

/** Renderer ringan: baris kosong = jarak, "- / •" = poin, **tebal**. Tanpa dependency. */
function RichText({ text }: { text: string }) {
    const lines = text.split("\n");
    return (
        <div className="space-y-1">
            {lines.map((line, i) => {
                const t = line.trim();
                if (!t) return <div key={i} className="h-1.5" />;
                if (/^[-*•]\s+/.test(t)) {
                    return (
                        <div key={i} className="flex gap-1.5">
                            <span className="text-orange-500 shrink-0 leading-relaxed">•</span>
                            <span className="leading-relaxed">{renderInline(t.replace(/^[-*•]\s+/, ""))}</span>
                        </div>
                    );
                }
                return <p key={i} className="leading-relaxed">{renderInline(t)}</p>;
            })}
        </div>
    );
}

/**
 * Widget chat asisten VolikoPrint (mengambang). Hanya untuk pertanyaan seputar
 * produk/harga/HPP & aplikasi ini — barrier ada di backend (/studio-ai/chat).
 * Tampil hanya bila AI aktif (status.enabled).
 */
export function AiChatWidget() {
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState<AiChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    const { data: status } = useQuery({
        queryKey: ["studio-ai-status"],
        queryFn: getStudioAiStatus,
        staleTime: 5 * 60 * 1000,
        retry: false,
    });

    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, [messages, loading]);

    if (!status?.chatEnabled) return null;

    const send = async (text: string) => {
        const msg = text.trim();
        if (!msg || loading) return;
        const history = messages;
        setMessages((m) => [...m, { role: "user", content: msg }]);
        setInput("");
        setLoading(true);
        try {
            const { reply, products } = await sendAiChat(msg, history);
            setMessages((m) => [...m, { role: "assistant", content: reply, products }]);
        } catch (e: any) {
            const err = e?.response?.data?.message || e?.message || "Gagal menghubungi asisten.";
            setMessages((m) => [...m, { role: "assistant", content: `⚠️ ${Array.isArray(err) ? err.join(", ") : err}` }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="print:hidden">
            {/* Tombol mengambang — anak dari <FloatingActionDock/> (in-flow, tak
                mengatur posisinya sendiri lagi). pointer-events-auto agar tetap
                bisa diklik walau rel-nya pointer-events-none. */}
            {!open && (
                <button
                    onClick={() => setOpen(true)}
                    className="pointer-events-auto flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-orange-500 text-xl text-white shadow-lg shadow-orange-500/30 transition-transform hover:scale-105 hover:bg-orange-600 active:scale-95"
                    aria-label="Buka Asisten AI"
                    title="Asisten AI"
                >
                    {renderAvatar(status?.aiAvatar, <Sparkles className="w-5 h-5" />)}
                </button>
            )}

            {/* Panel chat — fixed & mengatur posisinya sendiri (lepas dari rel).
                pointer-events-auto karena rel induknya pointer-events-none. */}
            {open && (
                <div className="pointer-events-auto fixed bottom-4 right-4 z-[320] w-[92vw] max-w-sm h-[70vh] max-h-[560px] flex flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/40">
                        <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center overflow-hidden text-base">
                            {renderAvatar(status?.aiAvatar, <Bot className="w-4 h-4 text-primary" />)}
                        </div>
                        <div className="min-w-0">
                            <div className="text-sm font-semibold text-foreground leading-none">{status?.aiName || "Asisten AI"}</div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">Tanya harga, HPP, & cara pakai aplikasi</div>
                        </div>
                        <button onClick={() => setOpen(false)} className="ml-auto text-muted-foreground hover:text-foreground" aria-label="Tutup">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
                        {messages.length === 0 && (
                            <div className="text-center py-6">
                                <div className="w-12 h-12 rounded-full bg-muted mx-auto mb-2 flex items-center justify-center overflow-hidden text-2xl">
                                    {renderAvatar(status?.aiAvatar, <Bot className="w-7 h-7 text-muted-foreground/50" />)}
                                </div>
                                <p className="text-xs text-muted-foreground mb-3">
                                    {status?.aiGreeting || "Halo! Saya bantu seputar produk, harga, HPP, dan penggunaan aplikasi ini."}
                                </p>
                                <div className="flex flex-col gap-1.5">
                                    {SUGGESTIONS.map((s) => (
                                        <button
                                            key={s}
                                            onClick={() => send(s)}
                                            className="text-left text-xs rounded-lg border border-border px-3 py-2 hover:border-primary hover:bg-primary/5 transition text-muted-foreground"
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        {messages.map((m, i) => (
                            <div key={i} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
                                <div
                                    className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm break-words ${
                                        m.role === "user"
                                            ? "bg-primary text-primary-foreground rounded-br-sm whitespace-pre-wrap"
                                            : "bg-muted text-foreground rounded-bl-sm"
                                    }`}
                                >
                                    {m.role === "user" ? m.content : <RichText text={m.content} />}
                                </div>
                                {m.role === "assistant" && m.products && m.products.length > 0 && (
                                    <div className="mt-2 w-full max-w-[85%] space-y-1.5">
                                        {m.products.map((p) => {
                                            const src = imgSrc(p.image);
                                            return (
                                                <button
                                                    key={p.id}
                                                    type="button"
                                                    onClick={() => { setOpen(false); router.push(`/inventory?q=${encodeURIComponent(p.name)}`); }}
                                                    title={`Buka ${p.name} di Inventori`}
                                                    className="w-full flex items-center gap-2.5 rounded-xl border border-border bg-card p-2 shadow-sm text-left hover:border-orange-500 hover:bg-orange-500/5 transition"
                                                >
                                                    {src ? (
                                                        <img src={src} alt="" className="w-11 h-11 rounded-lg object-cover shrink-0 border border-border" />
                                                    ) : (
                                                        <div className="w-11 h-11 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                                            <Package className="w-5 h-5 text-muted-foreground" />
                                                        </div>
                                                    )}
                                                    <div className="min-w-0 flex-1">
                                                        <div className="text-xs font-semibold text-foreground truncate">{p.name}</div>
                                                        {p.category && <div className="text-[10px] text-muted-foreground truncate">{p.category}</div>}
                                                        {p.priceLabel && <div className="text-xs font-bold text-orange-600 mt-0.5">{p.priceLabel}</div>}
                                                    </div>
                                                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        ))}
                        {loading && <ThinkingBubble />}
                    </div>

                    <form
                        onSubmit={(e) => { e.preventDefault(); send(input); }}
                        className="p-2.5 border-t border-border flex items-center gap-2"
                    >
                        <input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Tanya harga, HPP, atau cara pakai…"
                            className="flex-1 rounded-full border border-border bg-background px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                        />
                        <button
                            type="submit"
                            disabled={!input.trim() || loading}
                            className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50 shrink-0"
                            aria-label="Kirim"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
}
