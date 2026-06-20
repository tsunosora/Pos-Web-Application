"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    getFollowUps, markFollowUpDone, skipFollowUp, deleteFollowUp,
    type FollowUp, type FollowUpStatus, type FollowUpType,
    FOLLOW_UP_TYPE_LABEL, FOLLOW_UP_STATUS_LABEL,
    getMessageTemplates, renderTemplate, type MessageTemplate,
} from "@/lib/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
    Loader2, Phone, Calendar, CheckCircle2, SkipForward, MessageCircle,
    User, AlertCircle, Trash2, ClipboardList, Sparkles, X, Copy,
} from "lucide-react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/id";
dayjs.extend(relativeTime);
dayjs.locale("id");

const TYPE_COLOR: Record<FollowUpType, string> = {
    LEAD_FU: "bg-blue-100 text-blue-700 border-blue-200",
    AFTER_SALES: "bg-purple-100 text-purple-700 border-purple-200",
    REPEAT_ORDER: "bg-emerald-100 text-emerald-700 border-emerald-200",
    PAYMENT_REMINDER: "bg-amber-100 text-amber-700 border-amber-200",
};

const TYPE_ICON: Record<FollowUpType, string> = {
    LEAD_FU: "🎯",
    AFTER_SALES: "📦",
    REPEAT_ORDER: "🔄",
    PAYMENT_REMINDER: "💰",
};

export default function FollowUpsPage() {
    const qc = useQueryClient();
    const { currentUser } = useCurrentUser();
    const user = currentUser;
    const [scope, setScope] = useState<"mine" | "all">("mine");
    const [statusFilter, setStatusFilter] = useState<FollowUpStatus>("PENDING");
    const [typeFilter, setTypeFilter] = useState<FollowUpType | "">("");
    const [doneNotesModal, setDoneNotesModal] = useState<FollowUp | null>(null);
    const [doneNotesText, setDoneNotesText] = useState("");
    const [templateModal, setTemplateModal] = useState<FollowUp | null>(null);

    const { data: list, isLoading } = useQuery({
        queryKey: ["crm-follow-ups", scope, statusFilter, typeFilter, user?.id],
        queryFn: () => getFollowUps({
            status: statusFilter,
            type: typeFilter || undefined,
            assignedToId: scope === "mine" ? user?.id : undefined,
            limit: 200,
        }),
        enabled: !!user,
    });

    const invalidate = () => {
        qc.invalidateQueries({ queryKey: ["crm-follow-ups"] });
        qc.invalidateQueries({ queryKey: ["crm-fu-badge"] });
    };

    const doneMut = useMutation({
        mutationFn: ({ id, notes }: { id: number; notes?: string }) => markFollowUpDone(id, notes),
        onSuccess: () => { invalidate(); setDoneNotesModal(null); setDoneNotesText(""); },
    });
    const skipMut = useMutation({ mutationFn: skipFollowUp, onSuccess: invalidate });
    const deleteMut = useMutation({ mutationFn: deleteFollowUp, onSuccess: invalidate });

    const items = list?.items ?? [];
    const todayEnd = dayjs().endOf("day");

    const overdue = items.filter(f => f.status === "PENDING" && dayjs(f.dueDate).isBefore(todayEnd));
    const upcoming = items.filter(f => f.status === "PENDING" && dayjs(f.dueDate).isAfter(todayEnd));
    const done = items.filter(f => f.status !== "PENDING");

    return (
        <div className="space-y-4">
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <ClipboardList className="h-6 w-6 text-indigo-600" />
                    Tugas Follow-up
                </h1>
                <p className="text-sm text-muted-foreground">
                    Tugas FU lead, after-sales, repeat order. Klik Mark Done setelah dihubungi.
                </p>
            </div>

            {/* Scope tabs */}
            <div className="flex gap-2 flex-wrap">
                <button
                    onClick={() => setScope("mine")}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium ${
                        scope === "mine" ? "bg-indigo-600 text-white" : "bg-muted hover:bg-accent"
                    }`}
                >
                    👤 Tugas Saya
                </button>
                <button
                    onClick={() => setScope("all")}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium ${
                        scope === "all" ? "bg-indigo-600 text-white" : "bg-muted hover:bg-accent"
                    }`}
                >
                    🌐 Semua
                </button>
            </div>

            {/* Filter */}
            <div className="flex gap-2 flex-wrap items-center text-sm">
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as FollowUpStatus)}
                    className="border border-border rounded-lg px-3 py-2"
                >
                    <option value="PENDING">Pending</option>
                    <option value="DONE">Selesai</option>
                    <option value="SKIPPED">Dilewati</option>
                </select>
                <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value as FollowUpType | "")}
                    className="border border-border rounded-lg px-3 py-2"
                >
                    <option value="">Semua Jenis</option>
                    {(Object.keys(FOLLOW_UP_TYPE_LABEL) as FollowUpType[]).map((t) => (
                        <option key={t} value={t}>{FOLLOW_UP_TYPE_LABEL[t]}</option>
                    ))}
                </select>
            </div>

            {/* Stats */}
            {statusFilter === "PENDING" && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <StatCard label="Overdue" value={overdue.length} color="text-red-600" bg="bg-red-50 border-red-200" />
                    <StatCard label="Upcoming" value={upcoming.length} color="text-amber-600" bg="bg-amber-50 border-amber-200" />
                    <StatCard label="Total Pending" value={items.length} color="text-indigo-600" bg="bg-indigo-50 border-indigo-200" />
                </div>
            )}

            {isLoading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" /> Memuat...
                </div>
            ) : items.length === 0 ? (
                <div className="bg-card border rounded-xl p-12 text-center text-muted-foreground">
                    <Sparkles className="h-10 w-10 mx-auto mb-2 text-muted-foreground/40" />
                    <p>Tidak ada tugas {FOLLOW_UP_STATUS_LABEL[statusFilter].toLowerCase()}.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {statusFilter === "PENDING" && overdue.length > 0 && (
                        <Section title="🔥 Overdue" items={overdue} variant="overdue"
                            onDone={(fu) => { setDoneNotesModal(fu); setDoneNotesText(""); }}
                            onSkip={(id) => skipMut.mutate(id)}
                            onTemplate={(fu) => setTemplateModal(fu)}
                            onDelete={(id) => deleteMut.mutate(id)} />
                    )}
                    {statusFilter === "PENDING" && upcoming.length > 0 && (
                        <Section title="📅 Akan Datang" items={upcoming} variant="upcoming"
                            onDone={(fu) => { setDoneNotesModal(fu); setDoneNotesText(""); }}
                            onSkip={(id) => skipMut.mutate(id)}
                            onTemplate={(fu) => setTemplateModal(fu)}
                            onDelete={(id) => deleteMut.mutate(id)} />
                    )}
                    {statusFilter !== "PENDING" && (
                        <Section title={FOLLOW_UP_STATUS_LABEL[statusFilter]} items={done} variant="done"
                            onDone={() => { }} onSkip={() => { }} onTemplate={() => { }}
                            onDelete={(id) => deleteMut.mutate(id)} />
                    )}
                </div>
            )}

            {/* Done modal */}
            {doneNotesModal && (
                <div className="fixed inset-0 bg-background/25 backdrop-blur-md z-[300] flex items-center justify-center p-4">
                    <div className="bg-card rounded-xl p-5 max-w-md w-full">
                        <h3 className="font-bold text-lg mb-2">Mark FU Selesai</h3>
                        <p className="text-sm text-muted-foreground mb-3">
                            {doneNotesModal.lead?.name || doneNotesModal.customer?.name} —{" "}
                            <span className="font-semibold">{FOLLOW_UP_TYPE_LABEL[doneNotesModal.type]}</span>
                        </p>
                        <label className="block text-xs font-semibold text-muted-foreground mb-1">Catatan (opsional)</label>
                        <textarea
                            rows={3}
                            value={doneNotesText}
                            onChange={(e) => setDoneNotesText(e.target.value)}
                            placeholder="mis. Sudah ditelepon, customer puas, minta repeat bulan depan"
                            className="w-full border border-border rounded-lg px-3 py-2 text-sm mb-3"
                        />
                        <div className="flex gap-2">
                            <button onClick={() => setDoneNotesModal(null)} className="flex-1 px-4 py-2 border rounded-lg text-sm">Batal</button>
                            <button
                                onClick={() => doneMut.mutate({ id: doneNotesModal.id, notes: doneNotesText || undefined })}
                                disabled={doneMut.isPending}
                                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                            >
                                {doneMut.isPending ? "..." : "✓ Selesai"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Template copy modal */}
            {templateModal && (
                <FUTemplateModal
                    followUp={templateModal}
                    onClose={() => setTemplateModal(null)}
                />
            )}
        </div>
    );
}

function StatCard({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
    return (
        <div className={`border rounded-lg p-3 ${bg}`}>
            <div className="text-[10px] uppercase font-bold text-muted-foreground">{label}</div>
            <div className={`text-2xl font-bold font-mono ${color}`}>{value}</div>
        </div>
    );
}

function Section({
    title, items, variant, onDone, onSkip, onTemplate, onDelete,
}: {
    title: string;
    items: FollowUp[];
    variant: "overdue" | "upcoming" | "done";
    onDone: (fu: FollowUp) => void;
    onSkip: (id: number) => void;
    onTemplate: (fu: FollowUp) => void;
    onDelete: (id: number) => void;
}) {
    return (
        <div>
            <h2 className="font-bold text-sm text-muted-foreground uppercase mb-2">
                {title} ({items.length})
            </h2>
            <div className="space-y-2">
                {items.map((fu) => (
                    <FUItem
                        key={fu.id}
                        followUp={fu}
                        variant={variant}
                        onDone={() => onDone(fu)}
                        onSkip={() => onSkip(fu.id)}
                        onTemplate={() => onTemplate(fu)}
                        onDelete={() => {
                            if (confirm("Hapus FU ini?")) onDelete(fu.id);
                        }}
                    />
                ))}
            </div>
        </div>
    );
}

function FUItem({ followUp, variant, onDone, onSkip, onTemplate, onDelete }: {
    followUp: FollowUp;
    variant: "overdue" | "upcoming" | "done";
    onDone: () => void;
    onSkip: () => void;
    onTemplate: () => void;
    onDelete: () => void;
}) {
    const target = followUp.lead || followUp.customer;
    const targetType = followUp.lead ? "Lead" : "Customer";
    const targetLink = followUp.lead
        ? `/crm/leads`
        : `/customers`;
    const due = dayjs(followUp.dueDate);
    const isOverdue = variant === "overdue";
    const phone = (target as any)?.phone as string | undefined;

    return (
        <div className={`bg-card border rounded-xl p-4 ${isOverdue ? "border-red-300" : "border-border"}`}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-[10px] px-2 py-0.5 rounded border ${TYPE_COLOR[followUp.type]}`}>
                            {TYPE_ICON[followUp.type]} {FOLLOW_UP_TYPE_LABEL[followUp.type]}
                        </span>
                        <span className={`text-xs font-semibold ${isOverdue ? "text-red-600" : "text-muted-foreground"}`}>
                            <Calendar className="h-3 w-3 inline mr-1" />
                            {due.format("DD MMM YYYY")} ({due.fromNow()})
                        </span>
                    </div>
                    <div className="font-bold text-foreground">
                        {target?.name || "(Tanpa target)"} <span className="text-xs text-muted-foreground">· {targetType}</span>
                    </div>
                    {phone && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <Phone className="h-3 w-3" /> {phone}
                        </div>
                    )}
                    {followUp.notes && (
                        <p className="text-sm text-muted-foreground mt-1.5">{followUp.notes}</p>
                    )}
                    {followUp.doneNotes && (
                        <p className="text-sm text-emerald-700 mt-1.5 bg-emerald-50 px-2 py-1 rounded inline-block">
                            ✓ {followUp.doneNotes}
                        </p>
                    )}
                    {followUp.assignedTo && (
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <User className="h-3 w-3" /> {followUp.assignedTo.name || followUp.assignedTo.email}
                        </p>
                    )}
                </div>

                {variant !== "done" && (
                    <div className="flex flex-col gap-1.5 shrink-0">
                        <button
                            onClick={onDone}
                            className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 flex items-center gap-1"
                        >
                            <CheckCircle2 className="h-3 w-3" /> Selesai
                        </button>
                        {phone && (
                            <button
                                onClick={onTemplate}
                                className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 flex items-center gap-1"
                            >
                                <MessageCircle className="h-3 w-3" /> WA
                            </button>
                        )}
                        <button
                            onClick={onSkip}
                            className="px-3 py-1.5 border border-border rounded-lg text-xs font-semibold hover:bg-muted flex items-center gap-1"
                        >
                            <SkipForward className="h-3 w-3" /> Skip
                        </button>
                    </div>
                )}
                {variant === "done" && (
                    <button
                        onClick={onDelete}
                        className="text-xs text-red-500 hover:underline flex items-center gap-1"
                    >
                        <Trash2 className="h-3 w-3" /> Hapus
                    </button>
                )}
            </div>
        </div>
    );
}

function FUTemplateModal({ followUp, onClose }: { followUp: FollowUp; onClose: () => void }) {
    const { data: templates } = useQuery({
        queryKey: ["crm-templates-active"],
        queryFn: () => getMessageTemplates({ activeOnly: true }),
    });
    const [selected, setSelected] = useState<MessageTemplate | null>(null);
    const [rendered, setRendered] = useState("");
    const [copied, setCopied] = useState(false);

    const target = followUp.lead || followUp.customer;
    const phone = (target as any)?.phone as string | undefined;

    const handlePick = async (t: MessageTemplate) => {
        setSelected(t);
        try {
            const r = await renderTemplate(t.id, {
                leadId: followUp.leadId ?? undefined,
                customerId: followUp.customerId ?? undefined,
            });
            setRendered(r.rendered);
        } catch (e: any) {
            alert(`Gagal render: ${e?.message || e}`);
        }
    };

    const handleCopy = async () => {
        await navigator.clipboard.writeText(rendered);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleOpenWa = () => {
        if (!phone) return;
        const p = phone.replace(/\D/g, "").replace(/^0/, "62");
        window.open(`https://wa.me/${p}?text=${encodeURIComponent(rendered)}`, "_blank");
    };

    return (
        <div className="fixed inset-0 bg-background/25 backdrop-blur-md z-[300] flex items-center justify-center p-4">
            <div className="bg-card rounded-xl p-5 max-w-xl w-full max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-lg">Pilih Template WA</h3>
                    <button onClick={onClose} className="p-1 hover:bg-muted rounded"><X className="h-5 w-5" /></button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                    {(templates ?? []).map((t) => (
                        <button
                            key={t.id}
                            onClick={() => handlePick(t)}
                            className={`text-left p-2 border rounded-lg hover:border-indigo-300 ${
                                selected?.id === t.id ? "border-indigo-500 bg-indigo-50" : "border-border"
                            }`}
                        >
                            <div className="text-[10px] text-indigo-600 font-semibold">{t.category}</div>
                            <div className="font-semibold text-sm">{t.name}</div>
                        </button>
                    ))}
                </div>

                {selected && (
                    <>
                        <textarea
                            rows={8}
                            value={rendered}
                            onChange={(e) => setRendered(e.target.value)}
                            className="w-full border border-border rounded-lg px-3 py-2 text-sm font-mono"
                        />
                        <div className="flex gap-2 mt-3">
                            <button
                                onClick={handleCopy}
                                className={`flex-1 px-4 py-2 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 ${
                                    copied ? "bg-emerald-600 text-white" : "bg-indigo-600 text-white"
                                }`}
                            >
                                {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                {copied ? "Tersalin!" : "Copy"}
                            </button>
                            <button
                                onClick={handleOpenWa}
                                disabled={!phone}
                                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-semibold text-sm hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                <MessageCircle className="h-4 w-4" /> Buka WA
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
