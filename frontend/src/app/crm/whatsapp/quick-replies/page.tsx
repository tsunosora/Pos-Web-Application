"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Zap, Plus, Trash2 } from "lucide-react";
import {
    listWaQuickReplies, createWaQuickReply, updateWaQuickReply, deleteWaQuickReply,
    type WaQuickReply, type QuickReplyBody,
} from "@/lib/api/whatsapp-cloud";
import { StatusBadge } from "@/components/ui/status-badge";
import { WhatsappGuideButton } from "@/components/whatsapp/WhatsappGuideButton";

const EMPTY: QuickReplyBody = { shortcut: "", title: "", body: "" };

function errMsg(e: unknown, fb: string) {
    return (e as { response?: { data?: { message?: string } } })?.response?.data?.message || fb;
}

export default function WhatsappQuickRepliesPage() {
    const qc = useQueryClient();
    const [form, setForm] = useState<QuickReplyBody>(EMPTY);
    const [showForm, setShowForm] = useState(false);

    const { data: items = [], isLoading } = useQuery({ queryKey: ["wa-quick-replies"], queryFn: listWaQuickReplies });
    const invalidate = () => qc.invalidateQueries({ queryKey: ["wa-quick-replies"] });

    const createMut = useMutation({
        mutationFn: (data: QuickReplyBody) => createWaQuickReply(data),
        onSuccess: () => { setForm(EMPTY); setShowForm(false); invalidate(); },
        onError: (e) => alert(errMsg(e, "Gagal menyimpan")),
    });
    const toggleMut = useMutation({
        mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) => updateWaQuickReply(id, { isActive }),
        onSuccess: invalidate,
    });
    const deleteMut = useMutation({ mutationFn: deleteWaQuickReply, onSuccess: invalidate });

    // Pratinjau pintasan yang ter-slug (huruf kecil/underscore).
    const slugPreview = form.shortcut.toLowerCase().trim().replace(/^\/+/, "").replace(/[^a-z0-9_\s]/g, "").replace(/\s+/g, "_").slice(0, 60);
    const canSave = slugPreview.length > 0 && form.body.trim().length > 0 && !createMut.isPending;

    return (
        <div className="max-w-3xl mx-auto p-4 space-y-4">
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <Link href="/crm/whatsapp" className="p-1.5 rounded-lg hover:bg-muted"><ArrowLeft className="w-4 h-4" /></Link>
                    <Zap className="w-5 h-5 text-emerald-500" />
                    <h1 className="text-lg font-semibold">Pesan Cepat</h1>
                    <WhatsappGuideButton />
                </div>
                <button onClick={() => setShowForm((s) => !s)} className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg bg-primary text-primary-foreground">
                    <Plus className="w-4 h-4" /> Tambah
                </button>
            </div>

            <p className="text-sm opacity-60">
                Daftar balasan siap-kirim <b>milik sendiri</b> (bukan template Meta). Panggil di kotak chat inbox
                dengan mengetik <code>/pintasan</code>. Bebas teks — sah dikirim selama percakapan masih dalam 24 jam.
            </p>

            {showForm && (
                <div className="rounded-2xl border border-border bg-card/60 p-4 space-y-3">
                    <div className="grid sm:grid-cols-2 gap-3">
                        <label className="text-sm">Pintasan (setelah “/”)
                            <div className="mt-1 flex items-center rounded-lg bg-muted/60 px-3">
                                <span className="opacity-50">/</span>
                                <input value={form.shortcut} onChange={(e) => setForm({ ...form, shortcut: e.target.value })}
                                    placeholder="harga" className="flex-1 bg-transparent py-2 outline-none" />
                            </div>
                            {form.shortcut && <span className="text-[11px] opacity-50">Tersimpan sebagai <b>/{slugPreview}</b></span>}
                        </label>
                        <label className="text-sm">Judul (opsional)
                            <input value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })}
                                placeholder="Info harga" className="mt-1 w-full rounded-lg bg-muted/60 px-3 py-2 outline-none" />
                        </label>
                    </div>
                    <label className="text-sm block">Isi pesan
                        <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })}
                            rows={4} placeholder="Halo kak 🙏 untuk harga silakan cek daftar berikut…"
                            className="mt-1 w-full rounded-lg bg-muted/60 px-3 py-2 outline-none resize-none" />
                    </label>
                    <div className="flex justify-end gap-2">
                        <button onClick={() => { setShowForm(false); setForm(EMPTY); }} className="text-sm px-3 py-1.5 rounded-lg bg-muted">Batal</button>
                        <button onClick={() => createMut.mutate(form)} disabled={!canSave}
                            className="text-sm px-3 py-1.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-50">Simpan</button>
                    </div>
                </div>
            )}

            <div className="space-y-2">
                {isLoading && <p className="text-sm opacity-60">Memuat…</p>}
                {!isLoading && items.length === 0 && <p className="text-sm opacity-60">Belum ada pesan cepat.</p>}
                {items.map((q: WaQuickReply) => (
                    <div key={q.id} className="rounded-2xl border border-border bg-card/60 p-4 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <StatusBadge tone={q.isActive ? "success" : "neutral"}>/{q.shortcut}</StatusBadge>
                                {q.title && <span className="text-xs opacity-60">{q.title}</span>}
                            </div>
                            <div className="text-sm mt-1 whitespace-pre-wrap opacity-90">{q.body}</div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <button onClick={() => toggleMut.mutate({ id: q.id, isActive: !q.isActive })}
                                className="text-xs px-2.5 py-1.5 rounded-lg bg-muted hover:bg-muted/70">
                                {q.isActive ? "Nonaktifkan" : "Aktifkan"}
                            </button>
                            <button onClick={() => { if (confirm(`Hapus pesan cepat "/${q.shortcut}"?`)) deleteMut.mutate(q.id); }}
                                className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-500"><Trash2 className="w-4 h-4" /></button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
