"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, CheckCircle2, XCircle, ArrowLeft, RefreshCw } from "lucide-react";
import {
    listWaChannels, createWaChannel, updateWaChannel, deleteWaChannel, getWaHealth,
    type WaChannel, type CreateChannelBody,
} from "@/lib/api/whatsapp-cloud";
import { getBranches } from "@/lib/api/settings";
import { StatusBadge } from "@/components/ui/status-badge";

const EMPTY: CreateChannelBody = { label: "", phoneNumberId: "", wabaId: "", displayNumber: "", branchId: null };

export default function WhatsappSettingsPage() {
    const qc = useQueryClient();
    const [form, setForm] = useState<CreateChannelBody>(EMPTY);
    const [showForm, setShowForm] = useState(false);

    const { data: channels = [], isLoading } = useQuery({ queryKey: ["wa-channels"], queryFn: listWaChannels });
    const { data: branches = [] } = useQuery({ queryKey: ["branches"], queryFn: getBranches });
    const { data: health, refetch: refetchHealth, isFetching: healthLoading } = useQuery({
        queryKey: ["wa-health"], queryFn: getWaHealth,
    });

    const healthById = new Map((health?.channels ?? []).map((c) => [c.id, c]));

    const invalidate = () => {
        qc.invalidateQueries({ queryKey: ["wa-channels"] });
        qc.invalidateQueries({ queryKey: ["wa-health"] });
    };

    const createMut = useMutation({
        mutationFn: createWaChannel,
        onSuccess: () => { setForm(EMPTY); setShowForm(false); invalidate(); },
        onError: (e: unknown) => alert((e as { response?: { data?: { message?: string } } })?.response?.data?.message || "Gagal menambah channel"),
    });
    const updateMut = useMutation({
        mutationFn: ({ id, data }: { id: number; data: Parameters<typeof updateWaChannel>[1] }) => updateWaChannel(id, data),
        onSuccess: invalidate,
    });
    const deleteMut = useMutation({
        mutationFn: deleteWaChannel,
        onSuccess: invalidate,
        onError: (e: unknown) => alert((e as { response?: { data?: { message?: string } } })?.response?.data?.message || "Gagal menghapus"),
    });

    const branchName = (id: number | null) => (id == null ? "Semua cabang (global)" : branches.find((b: { id: number; name: string }) => b.id === id)?.name || `#${id}`);

    return (
        <div className="max-w-4xl mx-auto p-4 space-y-4">
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <Link href="/crm/whatsapp" className="p-1.5 rounded-lg hover:bg-muted"><ArrowLeft className="w-4 h-4" /></Link>
                    <h1 className="text-lg font-semibold">Channel WhatsApp (per cabang)</h1>
                </div>
                <button onClick={() => setShowForm((s) => !s)} className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg bg-primary text-primary-foreground">
                    <Plus className="w-4 h-4" /> Tambah channel
                </button>
            </div>

            <p className="text-sm opacity-60">
                Tiap nomor WhatsApp Business (dari Meta) didaftarkan di sini. <b>phone_number_id</b> dipakai
                webhook untuk me-route pesan ke cabang yang benar. Token & app secret ada di <code>.env</code> server.
            </p>

            {!health?.enabled && (
                <div className="text-sm rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 px-3 py-2">
                    Integrasi belum diaktifkan — set <code>WA_CLOUD_ENABLED=&quot;true&quot;</code> di <code>.env</code> server lalu restart.
                </div>
            )}

            {showForm && (
                <form
                    onSubmit={(e) => { e.preventDefault(); createMut.mutate(form); }}
                    className="rounded-2xl border border-border bg-card/60 p-4 grid sm:grid-cols-2 gap-3"
                >
                    <label className="text-sm">Label
                        <input required value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })}
                            placeholder="CS Pusat" className="mt-1 w-full rounded-lg bg-muted/60 px-3 py-2 outline-none" />
                    </label>
                    <label className="text-sm">Cabang
                        <select value={form.branchId ?? ""} onChange={(e) => setForm({ ...form, branchId: e.target.value ? +e.target.value : null })}
                            className="mt-1 w-full rounded-lg bg-muted/60 px-3 py-2 outline-none">
                            <option value="">Semua cabang (global)</option>
                            {branches.map((b: { id: number; name: string }) => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                    </label>
                    <label className="text-sm">phone_number_id (Meta)
                        <input required value={form.phoneNumberId} onChange={(e) => setForm({ ...form, phoneNumberId: e.target.value })}
                            placeholder="1234567890" className="mt-1 w-full rounded-lg bg-muted/60 px-3 py-2 outline-none" />
                    </label>
                    <label className="text-sm">waba_id (Meta)
                        <input required value={form.wabaId} onChange={(e) => setForm({ ...form, wabaId: e.target.value })}
                            placeholder="9876543210" className="mt-1 w-full rounded-lg bg-muted/60 px-3 py-2 outline-none" />
                    </label>
                    <label className="text-sm sm:col-span-2">Nomor tampilan (opsional)
                        <input value={form.displayNumber ?? ""} onChange={(e) => setForm({ ...form, displayNumber: e.target.value })}
                            placeholder="+62 812-3456-7890" className="mt-1 w-full rounded-lg bg-muted/60 px-3 py-2 outline-none" />
                    </label>
                    <div className="sm:col-span-2 flex gap-2 justify-end">
                        <button type="button" onClick={() => { setShowForm(false); setForm(EMPTY); }} className="text-sm px-3 py-1.5 rounded-lg bg-muted">Batal</button>
                        <button type="submit" disabled={createMut.isPending} className="text-sm px-3 py-1.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-50">Simpan</button>
                    </div>
                </form>
            )}

            <div className="flex justify-end">
                <button onClick={() => refetchHealth()} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-muted hover:bg-muted/70">
                    <RefreshCw className={`w-3.5 h-3.5 ${healthLoading ? "animate-spin" : ""}`} /> Cek koneksi
                </button>
            </div>

            <div className="space-y-2">
                {isLoading && <p className="text-sm opacity-60">Memuat…</p>}
                {!isLoading && channels.length === 0 && <p className="text-sm opacity-60">Belum ada channel terdaftar.</p>}
                {channels.map((ch: WaChannel) => {
                    const h = healthById.get(ch.id);
                    return (
                        <div key={ch.id} className="rounded-2xl border border-border bg-card/60 p-4 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-medium">{ch.label}</span>
                                    <StatusBadge tone={ch.isActive ? "success" : "neutral"}>{ch.isActive ? "Aktif" : "Nonaktif"}</StatusBadge>
                                    {h && (h.ok
                                        ? <StatusBadge tone="info" icon={CheckCircle2}>{h.verifiedName || h.displayNumber || "Terhubung"}</StatusBadge>
                                        : <StatusBadge tone="danger" icon={XCircle}>{h.error?.slice(0, 40) || "Gagal"}</StatusBadge>)}
                                </div>
                                <div className="text-xs opacity-60 mt-1 space-x-2">
                                    <span>{branchName(ch.branchId)}</span>
                                    <span>· PN {ch.phoneNumberId}</span>
                                    {ch.displayNumber && <span>· {ch.displayNumber}</span>}
                                    {ch._count && <span>· {ch._count.conversations} percakapan</span>}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <button
                                    onClick={() => updateMut.mutate({ id: ch.id, data: { isActive: !ch.isActive } })}
                                    className="text-xs px-2.5 py-1.5 rounded-lg bg-muted hover:bg-muted/70"
                                >
                                    {ch.isActive ? "Nonaktifkan" : "Aktifkan"}
                                </button>
                                <button
                                    onClick={() => { if (confirm(`Hapus channel "${ch.label}"?`)) deleteMut.mutate(ch.id); }}
                                    className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-500"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
