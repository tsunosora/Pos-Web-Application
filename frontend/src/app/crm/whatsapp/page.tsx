"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Send, Search, Check, CheckCheck, Clock, AlertCircle, UserCheck, MessageSquare, Settings, HelpCircle } from "lucide-react";
import { WhatsappGuideModal } from "@/components/whatsapp/WhatsappGuideModal";
import {
    listWaConversations, getWaMessages, replyWaText, replyWaTemplate, updateWaConversation,
    listWaTemplates, isWindowOpen, WA_STATUS_LABEL,
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

function MsgStatusTick({ status }: { status: WaMessage["status"] }) {
    if (status === "READ") return <CheckCheck className="w-3.5 h-3.5 text-sky-400" />;
    if (status === "DELIVERED") return <CheckCheck className="w-3.5 h-3.5 opacity-60" />;
    if (status === "SENT") return <Check className="w-3.5 h-3.5 opacity-60" />;
    if (status === "FAILED") return <AlertCircle className="w-3.5 h-3.5 text-red-400" />;
    return <Clock className="w-3 h-3 opacity-50" />;
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

    const [showGuide, setShowGuide] = useState(false);
    const [draft, setDraft] = useState("");
    const replyMut = useMutation({
        mutationFn: (text: string) => replyWaText(selectedId as number, text),
        onSuccess: () => {
            setDraft("");
            qc.invalidateQueries({ queryKey: ["wa-messages", selectedId] });
            qc.invalidateQueries({ queryKey: ["wa-convos"] });
        },
        onError: (e: unknown) => {
            const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
            alert(msg || "Gagal mengirim pesan");
        },
    });

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
            <WhatsappGuideModal open={showGuide} onClose={() => setShowGuide(false)} />
            {/* ─── Panel kiri: daftar chat ─── */}
            <aside className="w-full max-w-sm flex flex-col rounded-2xl border border-border bg-card/60 backdrop-blur overflow-hidden">
                <div className="p-3 border-b border-border space-y-2">
                    <div className="flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-emerald-500" />
                        <h1 className="font-semibold">WhatsApp CRM</h1>
                        <button onClick={() => setShowGuide(true)} title="Panduan penggunaan" className="ml-auto p-1.5 rounded-lg hover:bg-muted">
                            <HelpCircle className="w-4 h-4 opacity-70" />
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
                            {messages.map((m) => {
                                const out = m.direction === "OUTBOUND";
                                return (
                                    <div key={m.id} className={`flex ${out ? "justify-end" : "justify-start"}`}>
                                        <div
                                            className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                                                out
                                                    ? "bg-emerald-500 text-white rounded-br-sm"
                                                    : "bg-card border border-border rounded-bl-sm"
                                            }`}
                                        >
                                            {m.type === "TEMPLATE" && (
                                                <div className={`text-[10px] mb-0.5 ${out ? "text-white/70" : "opacity-50"}`}>
                                                    template: {m.templateName}
                                                </div>
                                            )}
                                            <div className="whitespace-pre-wrap break-words">
                                                {m.body || <span className="italic opacity-60">[{m.type.toLowerCase()}]</span>}
                                            </div>
                                            <div className={`flex items-center gap-1 justify-end mt-0.5 text-[10px] ${out ? "text-white/70" : "opacity-50"}`}>
                                                {clockTime(m.createdAt)}
                                                {out && <MsgStatusTick status={m.status} />}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={bottomRef} />
                        </div>

                        {/* Composer — guard jendela 24 jam */}
                        {selected.contact.optedOut ? (
                            <div className="p-3 border-t border-border text-sm text-center text-red-500 bg-red-500/5">
                                Kontak sudah berhenti berlangganan (opt-out). Tidak bisa dikirimi pesan.
                            </div>
                        ) : windowOpen ? (
                            <form
                                className="p-3 border-t border-border flex items-end gap-2"
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    if (draft.trim()) replyMut.mutate(draft.trim());
                                }}
                            >
                                <textarea
                                    value={draft}
                                    onChange={(e) => setDraft(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && !e.shiftKey) {
                                            e.preventDefault();
                                            if (draft.trim()) replyMut.mutate(draft.trim());
                                        }
                                    }}
                                    rows={1}
                                    placeholder="Ketik balasan… (Enter kirim, Shift+Enter baris baru)"
                                    className="flex-1 resize-none rounded-xl bg-muted/60 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 max-h-32"
                                />
                                <button
                                    type="submit"
                                    disabled={!draft.trim() || replyMut.isPending}
                                    className="rounded-xl bg-emerald-500 text-white p-2.5 disabled:opacity-40 hover:bg-emerald-600 transition"
                                >
                                    <Send className="w-4 h-4" />
                                </button>
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
