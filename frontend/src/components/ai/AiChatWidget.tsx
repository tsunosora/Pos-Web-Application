"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, X, Send, Loader2, Bot, Sparkles } from "lucide-react";
import { getStudioAiStatus, sendAiChat, type AiChatMessage } from "@/lib/api/studioAi";

const SUGGESTIONS = [
    "Menurutmu hasil cetak yang bagus pakai produk apa?",
    "Harga banner flexi 3x1 meter?",
    "Hitung harga jual kalau HPP 5.000 mau margin 40%",
];

/** Render **tebal** dalam satu baris. */
function renderInline(text: string) {
    return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
        /^\*\*[^*]+\*\*$/.test(part)
            ? <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>
            : <span key={i}>{part}</span>,
    );
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
    // Posisi bubble (bisa digeser). right/bottom dalam px, disimpan di localStorage.
    const [pos, setPos] = useState<{ right: number; bottom: number }>({ right: 20, bottom: 96 });
    const posRef = useRef(pos);
    const drag = useRef<{ x: number; y: number; right: number; bottom: number; moved: boolean } | null>(null);

    const { data: status } = useQuery({
        queryKey: ["studio-ai-status"],
        queryFn: getStudioAiStatus,
        staleTime: 5 * 60 * 1000,
        retry: false,
    });

    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, [messages, loading]);

    useEffect(() => {
        try {
            const s = localStorage.getItem("ai_chat_pos");
            if (s) { const p = JSON.parse(s); posRef.current = p; setPos(p); }
        } catch { /* ignore */ }
    }, []);

    if (!status?.chatEnabled) return null;

    const send = async (text: string) => {
        const msg = text.trim();
        if (!msg || loading) return;
        const history = messages;
        setMessages((m) => [...m, { role: "user", content: msg }]);
        setInput("");
        setLoading(true);
        try {
            const { reply } = await sendAiChat(msg, history);
            setMessages((m) => [...m, { role: "assistant", content: reply }]);
        } catch (e: any) {
            const err = e?.response?.data?.message || e?.message || "Gagal menghubungi asisten.";
            setMessages((m) => [...m, { role: "assistant", content: `⚠️ ${Array.isArray(err) ? err.join(", ") : err}` }]);
        } finally {
            setLoading(false);
        }
    };

    // Geser bubble (klik = buka; tahan-geser = pindah, posisi disimpan).
    const startDrag = (e: any) => {
        e.currentTarget?.setPointerCapture?.(e.pointerId);
        drag.current = { x: e.clientX, y: e.clientY, right: posRef.current.right, bottom: posRef.current.bottom, moved: false };
    };
    const moveDrag = (e: any) => {
        const d = drag.current;
        if (!d) return;
        const dx = e.clientX - d.x, dy = e.clientY - d.y;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) d.moved = true;
        const right = Math.max(8, Math.min(window.innerWidth - 64, d.right - dx));
        const bottom = Math.max(8, Math.min(window.innerHeight - 64, d.bottom - dy));
        posRef.current = { right, bottom };
        setPos({ right, bottom });
    };
    const endDrag = () => {
        const moved = drag.current?.moved;
        drag.current = null;
        if (moved) { try { localStorage.setItem("ai_chat_pos", JSON.stringify(posRef.current)); } catch { /* ignore */ } }
        else setOpen(true);
    };

    return (
        <div className="print:hidden">
            {/* Tombol mengambang */}
            {!open && (
                <button
                    onPointerDown={startDrag}
                    onPointerMove={moveDrag}
                    onPointerUp={endDrag}
                    style={{ right: pos.right, bottom: pos.bottom, touchAction: "none" }}
                    className="fixed z-[290] w-14 h-14 rounded-full bg-orange-500 hover:bg-orange-600 text-white shadow-2xl flex items-center justify-center transition active:scale-95 cursor-grab active:cursor-grabbing"
                    aria-label="Buka Asisten AI (tahan & geser untuk memindah)"
                    title="Asisten AI — klik untuk buka, tahan & geser untuk pindah"
                >
                    <Sparkles className="w-6 h-6" />
                </button>
            )}

            {/* Panel chat */}
            {open && (
                <div className="fixed bottom-4 right-4 z-[320] w-[92vw] max-w-sm h-[70vh] max-h-[560px] flex flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/40">
                        <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
                            <Bot className="w-4 h-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                            <div className="text-sm font-semibold text-foreground leading-none">Asisten VolikoPrint</div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">Tanya harga, HPP, & cara pakai aplikasi</div>
                        </div>
                        <button onClick={() => setOpen(false)} className="ml-auto text-muted-foreground hover:text-foreground" aria-label="Tutup">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
                        {messages.length === 0 && (
                            <div className="text-center py-6">
                                <Bot className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                                <p className="text-xs text-muted-foreground mb-3">
                                    Halo! Saya bantu seputar <b>produk, harga, HPP</b>, dan penggunaan aplikasi ini.
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
                            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                                <div
                                    className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm break-words ${
                                        m.role === "user"
                                            ? "bg-primary text-primary-foreground rounded-br-sm whitespace-pre-wrap"
                                            : "bg-muted text-foreground rounded-bl-sm"
                                    }`}
                                >
                                    {m.role === "user" ? m.content : <RichText text={m.content} />}
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className="flex justify-start">
                                <div className="bg-muted rounded-2xl rounded-bl-sm px-3 py-2 text-sm text-muted-foreground inline-flex items-center gap-2">
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Mengetik…
                                </div>
                            </div>
                        )}
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
