"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, X, Send, Loader2, Bot, Sparkles } from "lucide-react";
import { getStudioAiStatus, sendAiChat, type AiChatMessage } from "@/lib/api/studioAi";

const SUGGESTIONS = [
    "Harga banner flexi 3x1 meter?",
    "Hitung harga jual kalau HPP 5.000 mau margin 40%",
    "Produk apa saja yang stoknya menipis?",
];

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
            const { reply } = await sendAiChat(msg, history);
            setMessages((m) => [...m, { role: "assistant", content: reply }]);
        } catch (e: any) {
            const err = e?.response?.data?.message || e?.message || "Gagal menghubungi asisten.";
            setMessages((m) => [...m, { role: "assistant", content: `⚠️ ${Array.isArray(err) ? err.join(", ") : err}` }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="print:hidden">
            {/* Tombol mengambang */}
            {!open && (
                <button
                    onClick={() => setOpen(true)}
                    className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full bg-primary text-primary-foreground shadow-lg px-4 py-3 hover:brightness-110 transition"
                    aria-label="Buka Asisten AI"
                >
                    <Sparkles className="w-5 h-5" />
                    <span className="text-sm font-semibold hidden sm:inline">Asisten AI</span>
                </button>
            )}

            {/* Panel chat */}
            {open && (
                <div className="fixed bottom-4 right-4 z-50 w-[92vw] max-w-sm h-[70vh] max-h-[560px] flex flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
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
                                    className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words ${
                                        m.role === "user"
                                            ? "bg-primary text-primary-foreground rounded-br-sm"
                                            : "bg-muted text-foreground rounded-bl-sm"
                                    }`}
                                >
                                    {m.content}
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
