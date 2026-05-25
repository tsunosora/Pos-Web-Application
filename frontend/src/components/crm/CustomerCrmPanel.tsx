"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    getCustomerCrmTimeline, updateCustomerCrm,
    createFollowUp, markFollowUpDone,
    type FollowUpType, FOLLOW_UP_TYPE_LABEL,
    getMessageTemplates, renderTemplate, type MessageTemplate,
} from "@/lib/api";
import api from "@/lib/api/client";
import {
    User, Plus, Loader2, ClipboardList, MessageCircle, CheckCircle2, X, Copy,
    Tag as TagIcon, Sparkles,
} from "lucide-react";
import dayjs from "dayjs";
import "dayjs/locale/id";
dayjs.locale("id");

const KIND_LABEL: Record<string, string> = {
    FIRST_CONTACT: "🎯 Kontak Pertama",
    STATUS_CHANGE: "🔄 Status Berubah",
    ASSIGNED: "👤 Di-assign",
    NOTE: "📝 Catatan",
    CALL: "📞 Telepon",
    MESSAGE: "💬 Pesan",
    MEETING: "🤝 Meeting",
    PROPOSAL_SENT: "📄 Penawaran",
    CONVERTED: "✅ Convert",
    CLOSED_LOST: "❌ Closed Lost",
    FOLLOW_UP_DONE: "✔️ FU Selesai",
    FOLLOW_UP_SCHEDULED: "📅 FU Dijadwalkan",
    AFTER_SALES_SCHEDULED: "📦 After-Sales Dijadwalkan",
};

export function CustomerCrmPanel({ customerId }: { customerId: number }) {
    const qc = useQueryClient();
    const { data, isLoading } = useQuery({
        queryKey: ["customer-crm", customerId],
        queryFn: () => getCustomerCrmTimeline(customerId),
    });
    const { data: users } = useQuery({
        queryKey: ["users-for-assign"],
        queryFn: async () => (await api.get("/users")).data as { id: number; name: string | null; email: string }[],
        staleTime: 5 * 60_000,
    });

    const [showCreateFu, setShowCreateFu] = useState(false);
    const [showTemplate, setShowTemplate] = useState(false);

    const invalidate = () => qc.invalidateQueries({ queryKey: ["customer-crm", customerId] });

    const assignMut = useMutation({
        mutationFn: (assignedCsId: number | null) => updateCustomerCrm(customerId, { assignedCsId }),
        onSuccess: invalidate,
    });

    const doneMut = useMutation({
        mutationFn: (id: number) => markFollowUpDone(id),
        onSuccess: invalidate,
    });

    if (isLoading) {
        return (
            <div className="border-t border-border pt-4 mt-4 flex items-center justify-center py-6 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Memuat CRM...
            </div>
        );
    }
    if (!data) return null;

    const c = data.customer;
    const phone = c.phone;

    return (
        <div className="border-t border-border pt-4 mt-4">
            <h3 className="font-bold text-base mb-3 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-indigo-600" /> CRM
            </h3>

            {/* Assigned CS + Lead Source */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3 text-sm">
                <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">CS yang Pegang</label>
                    <select
                        value={c.assignedCs?.id ?? ""}
                        onChange={(e) => {
                            const v = e.target.value;
                            assignMut.mutate(v === "" ? null : Number(v));
                        }}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    >
                        <option value="">— Belum di-assign —</option>
                        {(users ?? []).map((u) => (
                            <option key={u.id} value={u.id}>{u.name || u.email}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Asal Lead</label>
                    <div className="px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-sm">
                        {c.leadSource || <span className="text-gray-400">Tidak ada data</span>}
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 flex-wrap mb-4">
                <button
                    onClick={() => setShowCreateFu(true)}
                    className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 flex items-center gap-1"
                >
                    <Plus className="h-3 w-3" /> Buat Follow-up
                </button>
                {phone && (
                    <button
                        onClick={() => setShowTemplate(true)}
                        className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 flex items-center gap-1"
                    >
                        <MessageCircle className="h-3 w-3" /> Copy Template WA
                    </button>
                )}
            </div>

            {/* Pending Follow-ups */}
            {data.followUps.length > 0 && (
                <div className="mb-4">
                    <h4 className="font-semibold text-sm text-gray-600 mb-2 flex items-center gap-1">
                        <ClipboardList className="h-4 w-4" /> Follow-up
                    </h4>
                    <div className="space-y-1.5">
                        {data.followUps.map((fu: any) => (
                            <div
                                key={fu.id}
                                className={`flex items-center gap-2 text-sm border rounded px-2 py-1.5 ${
                                    fu.status === "PENDING" ? "bg-amber-50 border-amber-200" : "bg-gray-50 border-gray-200 opacity-70"
                                }`}
                            >
                                <span className="text-xs font-semibold">
                                    {fu.status === "DONE" ? "✓" : fu.status === "SKIPPED" ? "↷" : "○"}
                                </span>
                                <span className="text-xs text-gray-600">
                                    {FOLLOW_UP_TYPE_LABEL[fu.type as FollowUpType]}
                                </span>
                                <span className="text-xs text-gray-500">
                                    {dayjs(fu.dueDate).format("DD MMM")}
                                </span>
                                {fu.notes && <span className="text-xs text-gray-700 truncate flex-1">— {fu.notes}</span>}
                                {fu.status === "PENDING" && (
                                    <button
                                        onClick={() => doneMut.mutate(fu.id)}
                                        className="ml-auto text-xs px-2 py-0.5 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                                    >
                                        ✓ Selesai
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Activity Timeline */}
            <div>
                <h4 className="font-semibold text-sm text-gray-600 mb-2">Timeline Aktivitas</h4>
                {data.activities.length === 0 ? (
                    <p className="text-xs text-gray-500 italic">Belum ada aktivitas CRM untuk customer ini.</p>
                ) : (
                    <div className="space-y-1.5">
                        {data.activities.slice(0, 10).map((a: any) => (
                            <div key={a.id} className="border-l-2 border-indigo-200 pl-3 py-0.5">
                                <div className="flex items-center justify-between gap-2 text-xs">
                                    <span className="font-semibold text-gray-700">
                                        {KIND_LABEL[a.kind] || a.kind}
                                    </span>
                                    <span className="text-gray-400">
                                        {dayjs(a.createdAt).format("DD MMM HH:mm")}
                                    </span>
                                </div>
                                {a.text && <p className="text-xs text-gray-700">{a.text}</p>}
                            </div>
                        ))}
                        {data.activities.length > 10 && (
                            <p className="text-xs text-gray-400 italic">... dan {data.activities.length - 10} lagi</p>
                        )}
                    </div>
                )}
            </div>

            {/* Create FU modal */}
            {showCreateFu && (
                <CreateFuModal
                    customerId={customerId}
                    onClose={() => setShowCreateFu(false)}
                    onCreated={() => { setShowCreateFu(false); invalidate(); }}
                />
            )}

            {/* Template modal */}
            {showTemplate && phone && (
                <CustomerTemplateModal
                    customerId={customerId}
                    phone={phone}
                    onClose={() => setShowTemplate(false)}
                />
            )}
        </div>
    );
}

function CreateFuModal({
    customerId, onClose, onCreated,
}: {
    customerId: number;
    onClose: () => void;
    onCreated: () => void;
}) {
    const [type, setType] = useState<FollowUpType>("REPEAT_ORDER");
    const [dueDate, setDueDate] = useState(dayjs().add(1, "day").format("YYYY-MM-DD"));
    const [notes, setNotes] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await createFollowUp({ customerId, type, dueDate, notes: notes || undefined });
            onCreated();
        } catch (err: any) {
            alert(`Gagal: ${err?.message || err}`);
        } finally { setSubmitting(false); }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-[400] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl p-5 max-w-md w-full">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-lg">Buat Follow-up</h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="h-5 w-5" /></button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-3">
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Jenis</label>
                        <select value={type} onChange={(e) => setType(e.target.value as FollowUpType)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                            {(Object.keys(FOLLOW_UP_TYPE_LABEL) as FollowUpType[]).map(t => (
                                <option key={t} value={t}>{FOLLOW_UP_TYPE_LABEL[t]}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Tanggal *</label>
                        <input type="date" value={dueDate} required onChange={(e) => setDueDate(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Catatan</label>
                        <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            placeholder="mis. Nudge repeat order kostum komunitas" />
                    </div>
                    <div className="flex gap-2">
                        <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border rounded-lg text-sm">Batal</button>
                        <button type="submit" disabled={submitting}
                            className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50">
                            {submitting ? "..." : "Buat FU"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function CustomerTemplateModal({
    customerId, phone, onClose,
}: {
    customerId: number;
    phone: string;
    onClose: () => void;
}) {
    const { data: templates } = useQuery({
        queryKey: ["crm-templates-active"],
        queryFn: () => getMessageTemplates({ activeOnly: true }),
    });
    const [selected, setSelected] = useState<MessageTemplate | null>(null);
    const [rendered, setRendered] = useState("");
    const [copied, setCopied] = useState(false);

    const handlePick = async (t: MessageTemplate) => {
        setSelected(t);
        try {
            const r = await renderTemplate(t.id, { customerId });
            setRendered(r.rendered);
        } catch (e: any) {
            alert(`Render gagal: ${e?.message || e}`);
        }
    };

    const handleCopy = async () => {
        await navigator.clipboard.writeText(rendered);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleOpenWa = () => {
        const p = phone.replace(/\D/g, "").replace(/^0/, "62");
        window.open(`https://wa.me/${p}?text=${encodeURIComponent(rendered)}`, "_blank");
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-[400] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl p-5 max-w-xl w-full max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-lg">Copy Template WA</h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="h-5 w-5" /></button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                    {(templates ?? []).map((t) => (
                        <button key={t.id} onClick={() => handlePick(t)}
                            className={`text-left p-2 border rounded-lg hover:border-indigo-300 ${
                                selected?.id === t.id ? "border-indigo-500 bg-indigo-50" : "border-gray-200"
                            }`}>
                            <div className="text-[10px] text-indigo-600 font-semibold">{t.category}</div>
                            <div className="font-semibold text-sm">{t.name}</div>
                        </button>
                    ))}
                </div>
                {selected && (
                    <>
                        <textarea rows={8} value={rendered} onChange={(e) => setRendered(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono" />
                        <div className="flex gap-2 mt-3">
                            <button onClick={handleCopy}
                                className={`flex-1 px-4 py-2 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 ${
                                    copied ? "bg-emerald-600 text-white" : "bg-indigo-600 text-white"
                                }`}>
                                {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                {copied ? "Tersalin!" : "Copy"}
                            </button>
                            <button onClick={handleOpenWa}
                                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-semibold text-sm flex items-center justify-center gap-2">
                                <MessageCircle className="h-4 w-4" /> Buka WA
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
