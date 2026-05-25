"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    getLeads, getLeadStatusSummary, createLead, updateLead, deleteLead,
    addLeadActivity, convertLead, closeLeadLost,
    getMessageTemplates, renderTemplate,
    uploadLeadImage, resolveLeadImageUrl, lookupCustomerByPhone, type CustomerLookupResult,
    type Lead, type LeadItem, type LeadStatus, type LeadSource, type LeadLevel, type MessageTemplate,
    LEAD_SOURCE_LABEL, LEAD_STATUS_LABEL, LEAD_LEVEL_LABEL,
} from "@/lib/api";
import api from "@/lib/api/client";
import { LeadItemsEditor, calcItemSubtotal } from "@/components/crm/LeadItemsEditor";
import { LeadImageCarousel } from "@/components/crm/LeadImageCarousel";
import {
    Plus, Search, X, Phone, MessageSquare, Calendar, MapPin, Sparkles, Trash2,
    Loader2, ChevronRight, User, Clock, AlertCircle, Tag, MessageCircle, Copy,
    CheckCircle2, XCircle, LayoutGrid, Kanban,
} from "lucide-react";
import { LeadKanbanBoard } from "@/components/crm/LeadKanbanBoard";
import dayjs from "dayjs";
import "dayjs/locale/id";
dayjs.locale("id");

// ─── Konstanta ──────────────────────────────────────────────────────────────

const STATUS_TABS: { value: LeadStatus | "ALL"; label: string; color: string }[] = [
    { value: "ALL", label: "Semua", color: "bg-gray-100 text-gray-700" },
    { value: "NEW", label: "Baru", color: "bg-blue-100 text-blue-700" },
    { value: "FOLLOW_UP", label: "Follow Up", color: "bg-amber-100 text-amber-700" },
    { value: "NEGOTIATION", label: "Negosiasi", color: "bg-purple-100 text-purple-700" },
    { value: "CLOSED_WON", label: "Closing", color: "bg-emerald-100 text-emerald-700" },
    { value: "CLOSED_LOST", label: "Lost", color: "bg-red-100 text-red-700" },
];

const SOURCE_OPTIONS: LeadSource[] = [
    "WHATSAPP", "INSTAGRAM", "FACEBOOK", "TIKTOK", "MARKETPLACE", "REFERRAL", "WEBSITE", "WALK_IN", "OTHER",
];

const LEVEL_OPTIONS: LeadLevel[] = ["HOT", "WARM", "COLD"];

const levelColor: Record<LeadLevel, string> = {
    HOT: "bg-red-100 text-red-700 border-red-200",
    WARM: "bg-amber-100 text-amber-700 border-amber-200",
    COLD: "bg-sky-100 text-sky-700 border-sky-200",
};

// ─── Page ───────────────────────────────────────────────────────────────────

export default function LeadsPage() {
    const qc = useQueryClient();
    const [tabStatus, setTabStatus] = useState<LeadStatus | "ALL">("ALL");
    const [search, setSearch] = useState("");
    const [filterSource, setFilterSource] = useState<LeadSource | "">("");
    const [formOpen, setFormOpen] = useState(false);
    const [editingLead, setEditingLead] = useState<Lead | null>(null);
    const [detailId, setDetailId] = useState<number | null>(null);
    const [viewMode, setViewMode] = useState<"card" | "kanban">("card");

    const { data: list, isLoading } = useQuery({
        queryKey: ["crm-leads", tabStatus, filterSource, search],
        queryFn: () => getLeads({
            status: tabStatus === "ALL" ? undefined : tabStatus,
            source: filterSource || undefined,
            search: search || undefined,
            limit: 100,
        }),
    });

    const { data: summary } = useQuery({
        queryKey: ["crm-leads-summary"],
        queryFn: getLeadStatusSummary,
        refetchInterval: 60_000,
    });

    const invalidate = () => {
        qc.invalidateQueries({ queryKey: ["crm-leads"] });
        qc.invalidateQueries({ queryKey: ["crm-leads-summary"] });
    };

    const createMut = useMutation({
        mutationFn: createLead,
        onSuccess: () => { invalidate(); setFormOpen(false); },
    });
    const updateMut = useMutation({
        mutationFn: ({ id, data }: { id: number; data: any }) => updateLead(id, data),
        onSuccess: () => { invalidate(); setFormOpen(false); setEditingLead(null); },
    });
    const deleteMut = useMutation({
        mutationFn: deleteLead,
        onSuccess: () => { invalidate(); setDetailId(null); },
    });

    const openCreate = () => { setEditingLead(null); setFormOpen(true); };
    const openEdit = (lead: Lead) => { setEditingLead(lead); setFormOpen(true); };

    const statusMut = useMutation({
        mutationFn: ({ id, status }: { id: number; status: LeadStatus }) => updateLead(id, { status }),
        onSuccess: invalidate,
        onError: (e: any) => alert(`Gagal ubah status: ${e?.message || e}`),
    });

    const items = list?.items ?? [];

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Sparkles className="h-6 w-6 text-indigo-600" />
                        Leads CRM
                    </h1>
                    <p className="text-sm text-gray-500">Pipeline pra-jual — pelacakan calon customer dari berbagai channel</p>
                </div>
                <div className="flex gap-2 items-center">
                    <div className="bg-gray-100 rounded-lg p-1 flex">
                        <button
                            onClick={() => setViewMode("card")}
                            className={`px-3 py-1 rounded text-xs font-semibold flex items-center gap-1 ${
                                viewMode === "card" ? "bg-white shadow text-indigo-700" : "text-gray-500"
                            }`}
                        >
                            <LayoutGrid className="h-3 w-3" /> Card
                        </button>
                        <button
                            onClick={() => setViewMode("kanban")}
                            className={`px-3 py-1 rounded text-xs font-semibold flex items-center gap-1 ${
                                viewMode === "kanban" ? "bg-white shadow text-indigo-700" : "text-gray-500"
                            }`}
                        >
                            <Kanban className="h-3 w-3" /> Kanban
                        </button>
                    </div>
                    <button
                        onClick={openCreate}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 flex items-center gap-2"
                    >
                        <Plus className="h-4 w-4" /> Lead Baru
                    </button>
                </div>
            </div>

            {/* Status tabs */}
            <div className="flex gap-2 flex-wrap">
                {STATUS_TABS.map((t) => {
                    const count = t.value === "ALL"
                        ? Object.values(summary || {}).reduce((s, n) => s + n, 0)
                        : (summary?.[t.value as LeadStatus] ?? 0);
                    const active = tabStatus === t.value;
                    return (
                        <button
                            key={t.value}
                            onClick={() => setTabStatus(t.value)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                active ? "bg-indigo-600 text-white shadow" : `${t.color} hover:opacity-80`
                            }`}
                        >
                            {t.label} <span className="ml-1 opacity-70">({count})</span>
                        </button>
                    );
                })}
            </div>

            {/* Filter bar */}
            <div className="flex gap-2 flex-wrap items-center">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Cari nama / HP / kota / kebutuhan..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                </div>
                <select
                    value={filterSource}
                    onChange={(e) => setFilterSource(e.target.value as LeadSource | "")}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                    <option value="">Semua Sumber</option>
                    {SOURCE_OPTIONS.map((s) => (
                        <option key={s} value={s}>{LEAD_SOURCE_LABEL[s]}</option>
                    ))}
                </select>
            </div>

            {/* List */}
            {isLoading ? (
                <div className="flex items-center justify-center py-12 text-gray-500">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" /> Memuat...
                </div>
            ) : items.length === 0 ? (
                <div className="bg-white border rounded-xl p-12 text-center text-gray-500">
                    <Sparkles className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                    <p>Belum ada lead. Tambah lead baru untuk mulai tracking calon customer.</p>
                </div>
            ) : viewMode === "kanban" ? (
                <LeadKanbanBoard
                    leads={items}
                    onCardClick={(l) => setDetailId(l.id)}
                    onStatusChange={(id, status) => statusMut.mutate({ id, status })}
                />
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {items.map((lead) => (
                        <LeadCard
                            key={lead.id}
                            lead={lead}
                            onClick={() => setDetailId(lead.id)}
                        />
                    ))}
                </div>
            )}

            {/* Form modal */}
            {formOpen && (
                <LeadFormModal
                    initial={editingLead}
                    onClose={() => { setFormOpen(false); setEditingLead(null); }}
                    onSubmit={(data) => {
                        if (editingLead) updateMut.mutate({ id: editingLead.id, data });
                        else createMut.mutate(data);
                    }}
                    submitting={createMut.isPending || updateMut.isPending}
                />
            )}

            {/* Detail drawer */}
            {detailId !== null && (
                <LeadDetailDrawer
                    leadId={detailId}
                    onClose={() => setDetailId(null)}
                    onEdit={(lead) => { setDetailId(null); openEdit(lead); }}
                    onDelete={(id) => {
                        if (confirm("Hapus lead ini? Aktivitas terkait ikut terhapus.")) deleteMut.mutate(id);
                    }}
                />
            )}
        </div>
    );
}

// ─── Lead Card ──────────────────────────────────────────────────────────────

function LeadCard({ lead, onClick }: { lead: Lead; onClick: () => void }) {
    const hasImage = (lead.images && lead.images.length > 0) || !!lead.imageUrl;
    const levelBadge = (
        <span className={`absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded border whitespace-nowrap shadow z-10 ${levelColor[lead.level]}`}>
            {LEAD_LEVEL_LABEL[lead.level]}
        </span>
    );
    return (
        <button
            onClick={onClick}
            className="text-left bg-white border border-gray-200 hover:border-indigo-300 hover:shadow-md rounded-xl overflow-hidden transition-all"
        >
            {/* Banner with carousel (kalau multi-image) */}
            <LeadImageCarousel
                images={lead.images || []}
                fallbackUrl={lead.imageUrl}
                alt={lead.name}
                heightClass="h-44"
                overlay={levelBadge}
            />
            <div className="p-4">
                {!hasImage && (
                    <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="font-bold text-gray-800 truncate flex-1">{lead.name}</div>
                        <span className={`text-[10px] px-2 py-0.5 rounded border whitespace-nowrap ${levelColor[lead.level]}`}>
                            {LEAD_LEVEL_LABEL[lead.level]}
                        </span>
                    </div>
                )}
                {hasImage && (
                    <div className="font-bold text-gray-800 truncate mb-2">{lead.name}</div>
                )}
            <div className="space-y-1.5 text-xs text-gray-600">
                {lead.phone && (
                    <div className="flex items-center gap-1.5">
                        <Phone className="h-3 w-3" /> {lead.phone}
                    </div>
                )}
                <div className="flex items-center gap-1.5">
                    <Tag className="h-3 w-3" /> {LEAD_SOURCE_LABEL[lead.source]}
                    {lead.sourceDetail && <span className="text-gray-400">· {lead.sourceDetail}</span>}
                </div>
                {lead.city && (
                    <div className="flex items-center gap-1.5">
                        <MapPin className="h-3 w-3" /> {lead.city}
                    </div>
                )}
                {lead.followUpDate && (
                    <div className="flex items-center gap-1.5 text-amber-700 font-medium">
                        <Calendar className="h-3 w-3" /> FU: {dayjs(lead.followUpDate).format("DD MMM YY")}
                    </div>
                )}
                {lead.assignedTo && (
                    <div className="flex items-center gap-1.5">
                        <User className="h-3 w-3" /> {lead.assignedTo.name || lead.assignedTo.email}
                    </div>
                )}
            </div>
            {lead.needs && (
                <p className="text-xs text-gray-500 mt-2 line-clamp-2">{lead.needs}</p>
            )}
            <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
                <span>{dayjs(lead.createdAt).format("DD MMM YY")}</span>
                <ChevronRight className="h-3 w-3" />
            </div>
            </div>
        </button>
    );
}

// ─── Lead Form Modal ────────────────────────────────────────────────────────

function LeadFormModal({
    initial, onClose, onSubmit, submitting,
}: {
    initial?: Lead | null;
    onClose: () => void;
    onSubmit: (data: any) => void;
    submitting: boolean;
}) {
    const [form, setForm] = useState({
        name: initial?.name ?? "",
        phone: initial?.phone ?? "",
        source: (initial?.source ?? "WHATSAPP") as LeadSource,
        sourceDetail: initial?.sourceDetail ?? "",
        level: (initial?.level ?? "WARM") as LeadLevel,
        needs: initial?.needs ?? "",
        estimatedValue: initial?.estimatedValue ? Number(initial.estimatedValue) : "",
        city: initial?.city ?? "",
        followUpDate: initial?.followUpDate ? dayjs(initial.followUpDate).format("YYYY-MM-DD") : "",
        assignedToId: initial?.assignedToId ? String(initial.assignedToId) : "",
    });
    // Multi-image: ambil dari images[] kalau ada, fallback ke imageUrl single (legacy)
    const initialImages = initial?.images && initial.images.length > 0
        ? initial.images.map(i => i.filename)
        : (initial?.imageUrl ? [initial.imageUrl] : []);
    const [imageUrls, setImageUrls] = useState<string[]>(initialImages);
    const [items, setItems] = useState<LeadItem[]>(initial?.items ?? []);
    const MAX_IMAGES = 5;
    const [uploading, setUploading] = useState(false);
    const [phoneMatches, setPhoneMatches] = useState<CustomerLookupResult[]>([]);
    const [phoneSearching, setPhoneSearching] = useState(false);
    const [phoneChecked, setPhoneChecked] = useState(false);

    // Load list of users untuk CS assignment dropdown
    const { data: users } = useQuery({
        queryKey: ["users-for-cs-assign"],
        queryFn: async () => (await api.get("/users")).data as { id: number; name: string | null; email: string }[],
        staleTime: 5 * 60_000,
    });

    // Phone lookup — debounced, hanya untuk lead baru (skip kalau edit)
    useEffect(() => {
        if (initial) return;
        const phone = form.phone.replace(/\D/g, "");
        if (phone.length < 4) {
            setPhoneMatches([]);
            setPhoneChecked(false);
            return;
        }
        setPhoneSearching(true);
        const t = setTimeout(async () => {
            try {
                const matches = await lookupCustomerByPhone(form.phone);
                setPhoneMatches(matches);
                setPhoneChecked(true);
            } catch (e) {
                console.error('[CRM] phone lookup failed:', e);
                setPhoneMatches([]);
            } finally {
                setPhoneSearching(false);
            }
        }, 350);
        return () => clearTimeout(t);
    }, [form.phone, initial]);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;
        const slotsLeft = MAX_IMAGES - imageUrls.length;
        if (slotsLeft <= 0) {
            alert(`Maksimal ${MAX_IMAGES} gambar per lead`);
            e.target.value = "";
            return;
        }
        const toUpload = files.slice(0, slotsLeft);
        setUploading(true);
        try {
            const uploaded: string[] = [];
            for (const file of toUpload) {
                if (!file.type.startsWith("image/")) {
                    alert(`${file.name}: bukan file gambar — skip`);
                    continue;
                }
                const url = await uploadLeadImage(file);
                uploaded.push(url);
            }
            setImageUrls(prev => [...prev, ...uploaded]);
        } catch (err: any) {
            alert(`Upload gagal: ${err?.message || err}`);
        } finally { setUploading(false); e.target.value = ""; }
    };

    const removeImage = (idx: number) => {
        setImageUrls(prev => prev.filter((_, i) => i !== idx));
    };
    const moveImage = (idx: number, dir: -1 | 1) => {
        setImageUrls(prev => {
            const next = [...prev];
            const target = idx + dir;
            if (target < 0 || target >= next.length) return prev;
            [next[idx], next[target]] = [next[target], next[idx]];
            return next;
        });
    };

    const useCustomerData = (c: CustomerLookupResult) => {
        setForm(f => ({ ...f, name: c.name, phone: c.phone || f.phone }));
        setPhoneMatches([]);
    };

    const itemsTotal = items.reduce((s, it) => s + calcItemSubtotal(it), 0);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit({
            ...form,
            // Kalau ada items, estimasi auto dari sum items. Kalau user manual override, pakai itu.
            estimatedValue: form.estimatedValue === "" ? (itemsTotal > 0 ? itemsTotal : undefined) : Number(form.estimatedValue),
            followUpDate: form.followUpDate || undefined,
            assignedToId: form.assignedToId === "" ? null : Number(form.assignedToId),
            imageUrls: imageUrls, // multi
            imageUrl: imageUrls[0] || null, // backward compat: first image
            items: items.map(it => ({
                productVariantId: it.productVariantId ?? null,
                description: it.description,
                quantity: it.quantity,
                unitPrice: it.unitPrice,
                widthCm: it.widthCm ?? undefined,
                heightCm: it.heightCm ?? undefined,
                unitType: it.unitType ?? undefined,
                note: it.note ?? undefined,
            })),
        });
    };

    return (
        <div className="fixed inset-0 bg-black/40 z-[200] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b px-5 py-3 flex items-center justify-between">
                    <h2 className="font-bold text-lg">{initial ? "Edit Lead" : "Lead Baru"}</h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
                        <X className="h-5 w-5" />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-5 space-y-3">
                    {/* Multi-image upload — bisa upload sampai 5 gambar, tampil sebagai slider di card */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">
                            Gambar Lead
                            <span className="text-gray-400 font-normal ml-1">
                                ({imageUrls.length}/{MAX_IMAGES}) — tampil sebagai slider di card kanban
                            </span>
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {imageUrls.map((url, idx) => {
                                const src = resolveLeadImageUrl(url) || url;
                                return (
                                    <div key={idx} className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden border-2 border-gray-200 group">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={src} alt={`Lead ${idx + 1}`} className="w-full h-full object-cover" />
                                        {idx === 0 && (
                                            <span className="absolute top-1 left-1 bg-indigo-600 text-white text-[9px] px-1.5 py-0.5 rounded font-semibold">COVER</span>
                                        )}
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1">
                                            {idx > 0 && (
                                                <button type="button" onClick={() => moveImage(idx, -1)}
                                                    className="bg-white/90 rounded p-1 text-xs" title="Geser ke kiri">←</button>
                                            )}
                                            {idx < imageUrls.length - 1 && (
                                                <button type="button" onClick={() => moveImage(idx, 1)}
                                                    className="bg-white/90 rounded p-1 text-xs" title="Geser ke kanan">→</button>
                                            )}
                                            <button type="button" onClick={() => removeImage(idx)}
                                                className="bg-red-500 text-white rounded p-1 text-xs" title="Hapus">×</button>
                                        </div>
                                    </div>
                                );
                            })}
                            {imageUrls.length < MAX_IMAGES && (
                                <label className={`aspect-square rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 transition-colors ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
                                    <span className="text-2xl text-gray-400">{uploading ? "⏳" : "+"}</span>
                                    <span className="text-[10px] text-gray-500 mt-0.5">
                                        {uploading ? "Upload..." : "Tambah"}
                                    </span>
                                    <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
                                </label>
                            )}
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1">
                            Bisa upload multiple sekaligus (Ctrl+Click). Maks 10 MB per file. Gambar pertama = COVER (tampil pertama di slider).
                        </p>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Nama *</label>
                        <input
                            required
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            placeholder="mis. PT Bina Sekolah / Andi futsal"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">No. HP</label>
                            <input
                                value={form.phone}
                                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                placeholder="08123456789"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Kota</label>
                            <input
                                value={form.city}
                                onChange={(e) => setForm({ ...form, city: e.target.value })}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                placeholder="Yogyakarta"
                            />
                        </div>
                    </div>

                    {/* Phone dedup banner — beberapa state */}
                    {!initial && form.phone.replace(/\D/g, "").length >= 4 && (
                        <>
                            {phoneSearching && (
                                <div className="text-xs text-gray-500 flex items-center gap-1.5">
                                    <Loader2 className="h-3 w-3 animate-spin" /> Mencari customer dengan HP serupa...
                                </div>
                            )}
                            {!phoneSearching && phoneMatches.length > 0 && (
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs">
                                    <div className="font-semibold text-amber-800 mb-1.5 flex items-center gap-1">
                                        ⚠️ Customer dengan HP serupa sudah terdaftar ({phoneMatches.length})
                                    </div>
                                    <div className="space-y-1.5">
                                        {phoneMatches.map(c => (
                                            <div key={c.id} className="flex items-center justify-between bg-white rounded px-2 py-1.5 border border-amber-100">
                                                <div className="min-w-0 flex-1">
                                                    <div className="font-semibold text-gray-800 truncate">{c.name}</div>
                                                    <div className="text-gray-500">{c.phone}</div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => useCustomerData(c)}
                                                    className="ml-2 px-2 py-1 bg-indigo-600 text-white rounded text-[10px] font-semibold hover:bg-indigo-700"
                                                >
                                                    Pakai Data Ini
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-[10px] text-amber-700 mt-1.5">
                                        Tip: pakai data customer existing untuk hindari duplikat. Saat convert, lead akan langsung ter-link ke customer ini.
                                    </p>
                                </div>
                            )}
                            {!phoneSearching && phoneChecked && phoneMatches.length === 0 && form.phone.replace(/\D/g, "").length >= 6 && (
                                <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1.5 flex items-center gap-1.5">
                                    ✓ HP ini belum terdaftar — aman dibuat sebagai lead baru
                                </div>
                            )}
                        </>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Sumber *</label>
                            <select
                                required
                                value={form.source}
                                onChange={(e) => setForm({ ...form, source: e.target.value as LeadSource })}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            >
                                {SOURCE_OPTIONS.map((s) => (
                                    <option key={s} value={s}>{LEAD_SOURCE_LABEL[s]}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Level</label>
                            <select
                                value={form.level}
                                onChange={(e) => setForm({ ...form, level: e.target.value as LeadLevel })}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            >
                                {LEVEL_OPTIONS.map((l) => (
                                    <option key={l} value={l}>{LEAD_LEVEL_LABEL[l]}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Detail Sumber</label>
                        <input
                            value={form.sourceDetail}
                            onChange={(e) => setForm({ ...form, sourceDetail: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            placeholder='mis. "IG @volikoprint - story balas" / "Referral kak Andi"'
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Kebutuhan (catatan bebas)</label>
                        <textarea
                            rows={2}
                            value={form.needs}
                            onChange={(e) => setForm({ ...form, needs: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            placeholder="mis. Deadline 2 minggu, ada permintaan desain khusus, dll"
                        />
                    </div>

                    {/* Daftar Produk Order — dipakai saat convert untuk SO & Invoice */}
                    <LeadItemsEditor items={items} onChange={setItems} />

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">
                                Estimasi Nilai (Rp)
                                {itemsTotal > 0 && (
                                    <span className="ml-1 text-[10px] text-indigo-600 font-normal">
                                        (auto: Rp {itemsTotal.toLocaleString("id-ID")})
                                    </span>
                                )}
                            </label>
                            <input
                                type="number"
                                min={0}
                                value={form.estimatedValue}
                                onChange={(e) => setForm({ ...form, estimatedValue: e.target.value as any })}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
                                placeholder="6000000"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Tanggal FU</label>
                            <input
                                type="date"
                                value={form.followUpDate}
                                onChange={(e) => setForm({ ...form, followUpDate: e.target.value })}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">
                            CS yang Pegang Lead Ini
                        </label>
                        <select
                            value={form.assignedToId}
                            onChange={(e) => setForm({ ...form, assignedToId: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        >
                            <option value="">— Belum di-assign —</option>
                            {(users ?? []).map((u) => (
                                <option key={u.id} value={u.id}>
                                    {u.name || u.email}
                                </option>
                            ))}
                        </select>
                        <p className="text-[10px] text-gray-500 mt-1">
                            Daftar diambil dari Manajemen User di /settings/users. CS yang pegang akan jadi default assignee untuk follow-up.
                        </p>
                    </div>

                    <div className="flex gap-2 pt-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                        >Batal</button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="flex-1 px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
                        >
                            {submitting ? "Menyimpan..." : initial ? "Simpan Perubahan" : "Buat Lead"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ─── Lead Detail Drawer ─────────────────────────────────────────────────────

function LeadDetailDrawer({
    leadId, onClose, onEdit, onDelete,
}: {
    leadId: number;
    onClose: () => void;
    onEdit: (lead: Lead) => void;
    onDelete: (id: number) => void;
}) {
    const qc = useQueryClient();
    const { data: lead, isLoading } = useQuery({
        queryKey: ["crm-lead-detail", leadId],
        queryFn: () => getLeads({ search: "" }).then(() => null), // placeholder, gantii dengan getLead
        enabled: false,
    });
    // gunakan getLead langsung
    const { data: leadDetail } = useQuery({
        queryKey: ["crm-lead", leadId],
        queryFn: async () => (await import("@/lib/api")).getLead(leadId),
    });

    const [activityText, setActivityText] = useState("");
    const [activityKind, setActivityKind] = useState("NOTE");
    const [showConvert, setShowConvert] = useState(false);
    const [showCloseLost, setShowCloseLost] = useState(false);
    const [showTemplate, setShowTemplate] = useState(false);
    const [closeLostReason, setCloseLostReason] = useState("");

    const invalidate = () => {
        qc.invalidateQueries({ queryKey: ["crm-lead", leadId] });
        qc.invalidateQueries({ queryKey: ["crm-leads"] });
        qc.invalidateQueries({ queryKey: ["crm-leads-summary"] });
    };

    const addActivityMut = useMutation({
        mutationFn: () => addLeadActivity(leadId, { kind: activityKind, text: activityText }),
        onSuccess: () => { invalidate(); setActivityText(""); },
    });

    const statusMut = useMutation({
        mutationFn: (status: LeadStatus) => updateLead(leadId, { status }),
        onSuccess: invalidate,
    });

    const convertMut = useMutation({
        mutationFn: (data: any) => convertLead(leadId, data),
        onSuccess: (result: any) => {
            invalidate();
            setShowConvert(false);
            const r = result?._convertResult;
            if (r) {
                const lines: string[] = ["✓ Lead di-convert berhasil!\n"];
                if (r.customerId) lines.push(`👤 Customer #${r.customerId}`);
                if (r.salesOrderId) {
                    let so = `📋 SPK #${r.salesOrderId}`;
                    if (r.soItemsCreated > 0) so += ` (${r.soItemsCreated} item dari katalog)`;
                    if (r.soItemsSkipped > 0) so += `\n   ⚠ ${r.soItemsSkipped} item custom di-skip (tidak ada di katalog) — masuk Invoice saja`;
                    if (r.soProofsCopied > 0) so += `\n   🖼 ${r.soProofsCopied} gambar referensi di-copy ke SPK proof`;
                    lines.push(so);
                }
                if (r.invoiceNumber) {
                    lines.push(`🧾 ${r.invoiceNumber}${r.invoiceItemsCreated > 0 ? ` (${r.invoiceItemsCreated} item)` : ''}`);
                }
                alert(lines.join('\n'));
            }
        },
    });

    const closeLostMut = useMutation({
        mutationFn: () => closeLeadLost(leadId, closeLostReason),
        onSuccess: () => { invalidate(); setShowCloseLost(false); setCloseLostReason(""); },
    });

    if (!leadDetail) {
        return (
            <div className="fixed inset-0 bg-black/40 z-[200] flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-white" />
            </div>
        );
    }

    const lead2 = leadDetail;
    const isClosed = lead2.status === "CLOSED_WON" || lead2.status === "CLOSED_LOST";

    return (
        <div className="fixed inset-0 bg-black/40 z-[200] flex justify-end" onClick={onClose}>
            <div
                className="bg-white w-full max-w-2xl h-full overflow-y-auto shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="sticky top-0 bg-white border-b px-5 py-3 flex items-center justify-between z-10">
                    <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded border ${levelColor[lead2.level]}`}>
                            {LEAD_LEVEL_LABEL[lead2.level]}
                        </span>
                        <h2 className="font-bold text-lg">{lead2.name}</h2>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Quick info */}
                <div className="p-5 space-y-4">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <Info label="Status" value={LEAD_STATUS_LABEL[lead2.status]} />
                        <Info label="Sumber" value={`${LEAD_SOURCE_LABEL[lead2.source]}${lead2.sourceDetail ? ` (${lead2.sourceDetail})` : ""}`} />
                        <Info label="HP" value={lead2.phone || "-"} />
                        <Info label="Kota" value={lead2.city || "-"} />
                        <Info label="Estimasi" value={lead2.estimatedValue ? `Rp ${Number(lead2.estimatedValue).toLocaleString("id-ID")}` : "-"} />
                        <Info label="Tanggal FU" value={lead2.followUpDate ? dayjs(lead2.followUpDate).format("DD MMM YYYY") : "-"} />
                        <Info label="Assigned" value={lead2.assignedTo?.name || lead2.assignedTo?.email || "Belum di-assign"} />
                        <Info label="Dibuat" value={dayjs(lead2.createdAt).format("DD MMM YYYY HH:mm")} />
                    </div>

                    {lead2.needs && (
                        <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3">
                            <div className="text-xs font-semibold text-indigo-700 mb-1">Kebutuhan</div>
                            <p className="text-sm text-gray-800 whitespace-pre-wrap">{lead2.needs}</p>
                        </div>
                    )}

                    {/* Daftar produk yang akan diorder */}
                    {(lead2.items && lead2.items.length > 0) && (
                        <div className="bg-white border border-gray-200 rounded-lg p-3">
                            <div className="text-xs font-semibold text-gray-700 mb-2 flex items-center justify-between">
                                <span>📦 Daftar Produk Order ({lead2.items.length} item)</span>
                                <span className="text-indigo-700 font-bold">
                                    Total: Rp {lead2.items.reduce((s: number, it: any) => s + calcItemSubtotal(it), 0).toLocaleString("id-ID", { maximumFractionDigits: 0 })}
                                </span>
                            </div>
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="border-b text-gray-500">
                                        <th className="text-left py-1.5 px-1">Produk</th>
                                        <th className="text-right py-1.5 px-1">Qty</th>
                                        <th className="text-right py-1.5 px-1">Harga</th>
                                        <th className="text-right py-1.5 px-1">Subtotal</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {lead2.items.map((it: any) => {
                                        const sub = calcItemSubtotal(it);
                                        const isCustom = !it.productVariantId;
                                        const isArea = (Number(it.widthCm) || 0) > 0 && (Number(it.heightCm) || 0) > 0;
                                        return (
                                            <tr key={it.id} className="border-t hover:bg-gray-50">
                                                <td className="py-1.5 px-1">
                                                    <div className="font-semibold">{it.description}</div>
                                                    {isCustom ? (
                                                        <span className="text-[9px] text-amber-700">⚠ custom</span>
                                                    ) : (
                                                        <span className="text-[9px] text-emerald-600">✓ katalog · {it.productVariant?.sku}</span>
                                                    )}
                                                    {it.widthCm && it.heightCm && (
                                                        <span className="text-[9px] text-gray-500 ml-1">· {it.widthCm}×{it.heightCm}cm</span>
                                                    )}
                                                </td>
                                                <td className="py-1.5 px-1 text-right font-mono">
                                                    {it.quantity}
                                                    {isArea && (
                                                        <div className="text-[9px] text-gray-400">
                                                            ×{((Number(it.widthCm) * Number(it.heightCm)) / 10000).toFixed(2)}m²
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="py-1.5 px-1 text-right font-mono text-gray-600">
                                                    {Number(it.unitPrice).toLocaleString("id-ID")}
                                                    {isArea && <div className="text-[9px] text-gray-400">/m²</div>}
                                                </td>
                                                <td className="py-1.5 px-1 text-right font-mono font-bold text-indigo-700">
                                                    {sub.toLocaleString("id-ID", { maximumFractionDigits: 0 })}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {lead2.convertedCustomer && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm">
                            <div className="font-semibold text-emerald-700 flex items-center gap-1">
                                <CheckCircle2 className="h-4 w-4" /> Sudah Convert
                            </div>
                            <div className="text-emerald-800 mt-1">
                                Customer: <strong>{lead2.convertedCustomer.name}</strong>
                                {lead2.convertedSO && <span> · SO: <strong>{lead2.convertedSO.soNumber}</strong></span>}
                            </div>
                        </div>
                    )}

                    {lead2.status === "CLOSED_LOST" && lead2.closeLostReason && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
                            <div className="font-semibold text-red-700 flex items-center gap-1">
                                <XCircle className="h-4 w-4" /> Lead Lost
                            </div>
                            <div className="text-red-800 mt-1">{lead2.closeLostReason}</div>
                        </div>
                    )}

                    {/* Status quick change */}
                    {!isClosed && (
                        <div className="flex gap-2 flex-wrap">
                            {(["NEW", "FOLLOW_UP", "NEGOTIATION"] as LeadStatus[]).map((s) => (
                                <button
                                    key={s}
                                    onClick={() => statusMut.mutate(s)}
                                    disabled={lead2.status === s || statusMut.isPending}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                                        lead2.status === s
                                            ? "bg-indigo-600 text-white"
                                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                    }`}
                                >
                                    → {LEAD_STATUS_LABEL[s]}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Actions */}
                    {!isClosed && (
                        <div className="flex gap-2 flex-wrap pt-2 border-t">
                            <button
                                onClick={() => setShowTemplate(true)}
                                className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 flex items-center gap-1"
                            >
                                <MessageCircle className="h-4 w-4" /> Copy Template WA
                            </button>
                            <button
                                onClick={() => setShowConvert(true)}
                                className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 flex items-center gap-1"
                            >
                                <CheckCircle2 className="h-4 w-4" /> Convert (Closing)
                            </button>
                            <button
                                onClick={() => setShowCloseLost(true)}
                                className="px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 flex items-center gap-1"
                            >
                                <XCircle className="h-4 w-4" /> Close Lost
                            </button>
                            <button
                                onClick={() => onEdit(lead2)}
                                className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                            >
                                Edit
                            </button>
                        </div>
                    )}

                    {/* Activity timeline */}
                    <div className="pt-3 border-t">
                        <h3 className="font-bold text-base mb-3 flex items-center gap-1">
                            <Clock className="h-4 w-4" /> Aktivitas
                        </h3>

                        {!isClosed && (
                            <div className="bg-gray-50 rounded-lg p-3 mb-3 space-y-2">
                                <div className="flex gap-2">
                                    <select
                                        value={activityKind}
                                        onChange={(e) => setActivityKind(e.target.value)}
                                        className="border border-gray-300 rounded px-2 py-1.5 text-xs"
                                    >
                                        <option value="NOTE">📝 Catatan</option>
                                        <option value="CALL">📞 Telepon</option>
                                        <option value="MESSAGE">💬 Pesan</option>
                                        <option value="MEETING">🤝 Meeting</option>
                                        <option value="PROPOSAL_SENT">📄 Penawaran</option>
                                    </select>
                                    <textarea
                                        rows={2}
                                        value={activityText}
                                        onChange={(e) => setActivityText(e.target.value)}
                                        placeholder="Tulis catatan singkat..."
                                        className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm"
                                    />
                                </div>
                                <button
                                    onClick={() => addActivityMut.mutate()}
                                    disabled={!activityText.trim() || addActivityMut.isPending}
                                    className="px-3 py-1.5 bg-indigo-600 text-white text-xs rounded font-semibold hover:bg-indigo-700 disabled:opacity-50"
                                >
                                    {addActivityMut.isPending ? "..." : "Tambah Aktivitas"}
                                </button>
                            </div>
                        )}

                        <div className="space-y-2">
                            {(lead2.activities ?? []).map((act) => (
                                <ActivityItem key={act.id} activity={act} />
                            ))}
                            {(!lead2.activities || lead2.activities.length === 0) && (
                                <p className="text-sm text-gray-500 text-center py-4">Belum ada aktivitas.</p>
                            )}
                        </div>
                    </div>

                    {/* Delete */}
                    <div className="pt-4 border-t">
                        <button
                            onClick={() => onDelete(lead2.id)}
                            className="text-xs text-red-600 hover:underline flex items-center gap-1"
                        >
                            <Trash2 className="h-3 w-3" /> Hapus lead
                        </button>
                    </div>
                </div>

                {/* Modals */}
                {showConvert && (
                    <ConvertModal
                        lead={lead2}
                        onClose={() => setShowConvert(false)}
                        onSubmit={(data) => convertMut.mutate(data)}
                        submitting={convertMut.isPending}
                    />
                )}

                {showCloseLost && (
                    <div className="fixed inset-0 bg-black/50 z-[300] flex items-center justify-center p-4">
                        <div className="bg-white rounded-xl p-5 max-w-md w-full">
                            <h3 className="font-bold text-lg mb-2">Tutup Lead (Lost)</h3>
                            <p className="text-sm text-gray-600 mb-3">Kenapa lead ini gagal closing?</p>
                            <textarea
                                rows={3}
                                value={closeLostReason}
                                onChange={(e) => setCloseLostReason(e.target.value)}
                                placeholder="mis. Customer pilih kompetitor karena harga lebih murah"
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3"
                            />
                            <div className="flex gap-2">
                                <button onClick={() => setShowCloseLost(false)} className="flex-1 px-4 py-2 border rounded-lg text-sm">Batal</button>
                                <button
                                    onClick={() => closeLostMut.mutate()}
                                    disabled={!closeLostReason.trim() || closeLostMut.isPending}
                                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                                >
                                    {closeLostMut.isPending ? "..." : "Tutup Lost"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {showTemplate && (
                    <TemplateCopyModal
                        leadId={lead2.id}
                        leadPhone={lead2.phone}
                        onClose={() => setShowTemplate(false)}
                        onActivityLogged={invalidate}
                    />
                )}
            </div>
        </div>
    );
}

function Info({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <div className="text-[10px] font-semibold text-gray-500 uppercase">{label}</div>
            <div className="text-sm text-gray-800">{value}</div>
        </div>
    );
}

function ActivityItem({ activity }: { activity: any }) {
    const KIND_ICON: Record<string, string> = {
        FIRST_CONTACT: "🎯",
        STATUS_CHANGE: "🔄",
        ASSIGNED: "👤",
        NOTE: "📝",
        CALL: "📞",
        MESSAGE: "💬",
        MEETING: "🤝",
        PROPOSAL_SENT: "📄",
        CONVERTED: "✅",
        CLOSED_LOST: "❌",
        FOLLOW_UP_DONE: "✔️",
        AFTER_SALES_SCHEDULED: "📦",
    };
    return (
        <div className="border-l-2 border-indigo-200 pl-3 py-1">
            <div className="flex items-center justify-between gap-2 text-xs">
                <div className="font-semibold text-gray-700">
                    {KIND_ICON[activity.kind] || "📌"} {activity.kind.replace(/_/g, " ")}
                </div>
                <span className="text-gray-400">{dayjs(activity.createdAt).format("DD MMM HH:mm")}</span>
            </div>
            {activity.text && <p className="text-sm text-gray-700 mt-1">{activity.text}</p>}
            {activity.createdBy?.name && (
                <p className="text-[10px] text-gray-400 mt-0.5">oleh {activity.createdBy.name}</p>
            )}
        </div>
    );
}

// ─── Convert Modal ──────────────────────────────────────────────────────────

function ConvertModal({
    lead, onClose, onSubmit, submitting,
}: {
    lead: Lead;
    onClose: () => void;
    onSubmit: (data: any) => void;
    submitting: boolean;
}) {
    const [createCustomer, setCreateCustomer] = useState(true);
    const [createSO, setCreateSO] = useState(true);
    const [designerName, setDesignerName] = useState("");
    const [createInvoice, setCreateInvoice] = useState(false);
    const [invoiceType, setInvoiceType] = useState<'INVOICE' | 'QUOTATION'>('INVOICE');
    const [notes, setNotes] = useState(lead.needs ?? "");

    const nothingSelected = !createCustomer && !createSO && !createInvoice;

    return (
        <div className="fixed inset-0 bg-black/50 z-[300] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl p-5 max-w-md w-full max-h-[90vh] overflow-y-auto">
                <h3 className="font-bold text-lg mb-2">Convert Lead → Closing</h3>
                <p className="text-sm text-gray-600 mb-4">
                    Tutup lead sebagai closing & buat dokumen yang dibutuhkan:
                    <strong className="text-gray-800"> Customer</strong>,
                    <strong className="text-gray-800"> SPK (Sales Order)</strong>, dan/atau
                    <strong className="text-gray-800"> Invoice/Quotation</strong>.
                </p>

                <div className="space-y-3">
                    {/* 1. Customer */}
                    <label className="flex items-start gap-2 text-sm cursor-pointer p-3 border rounded-lg hover:bg-gray-50">
                        <input
                            type="checkbox"
                            checked={createCustomer}
                            onChange={(e) => setCreateCustomer(e.target.checked)}
                            className="mt-1"
                        />
                        <div>
                            <div className="font-semibold">👤 Buat Customer Baru</div>
                            <div className="text-xs text-gray-500">
                                Data dari lead: <strong>{lead.name}</strong>
                                {lead.phone && ` · ${lead.phone}`}
                                <br />
                                <span className="text-gray-400">Kalau customer sudah ada (dari banner dedup di form), pilih existing — jangan duplikat.</span>
                            </div>
                        </div>
                    </label>

                    {/* 2. SPK (Sales Order) */}
                    <label className="flex items-start gap-2 text-sm cursor-pointer p-3 border rounded-lg hover:bg-gray-50">
                        <input
                            type="checkbox"
                            checked={createSO}
                            onChange={(e) => setCreateSO(e.target.checked)}
                            className="mt-1"
                        />
                        <div className="flex-1">
                            <div className="font-semibold">📋 Buat SPK (Sales Order) Draft</div>
                            <div className="text-xs text-gray-500">SPK production-bound. Lanjutkan di /sales-orders → assign desainer, isi item, kirim ke WA designer group.</div>
                        </div>
                    </label>
                    {createSO && (
                        <div className="ml-6 -mt-1">
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Nama Designer</label>
                            <input
                                value={designerName}
                                onChange={(e) => setDesignerName(e.target.value)}
                                placeholder="kosong = TBD (assign nanti)"
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            />
                        </div>
                    )}

                    {/* 3. Invoice / Quotation */}
                    <label className="flex items-start gap-2 text-sm cursor-pointer p-3 border rounded-lg hover:bg-gray-50">
                        <input
                            type="checkbox"
                            checked={createInvoice}
                            onChange={(e) => setCreateInvoice(e.target.checked)}
                            className="mt-1"
                        />
                        <div className="flex-1">
                            <div className="font-semibold">🧾 Buat Invoice / Quotation Draft</div>
                            <div className="text-xs text-gray-500">Nota tagihan atau penawaran. Lanjutkan di /invoices untuk isi item, set due date, kirim ke customer.</div>
                        </div>
                    </label>
                    {createInvoice && (
                        <div className="ml-6 -mt-1 flex gap-2">
                            <label className={`flex-1 flex items-center gap-1.5 px-3 py-2 rounded-lg border-2 cursor-pointer text-sm ${invoiceType === 'INVOICE' ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-semibold' : 'border-gray-200'}`}>
                                <input type="radio" className="hidden"
                                    checked={invoiceType === 'INVOICE'}
                                    onChange={() => setInvoiceType('INVOICE')} />
                                🧾 Invoice (INV-...)
                            </label>
                            <label className={`flex-1 flex items-center gap-1.5 px-3 py-2 rounded-lg border-2 cursor-pointer text-sm ${invoiceType === 'QUOTATION' ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold' : 'border-gray-200'}`}>
                                <input type="radio" className="hidden"
                                    checked={invoiceType === 'QUOTATION'}
                                    onChange={() => setInvoiceType('QUOTATION')} />
                                📑 Quotation (SPH-...)
                            </label>
                        </div>
                    )}

                    {/* Shared notes — di-pass ke SO & Invoice */}
                    {(createSO || createInvoice) && (
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Catatan (di-pass ke SO & Invoice)</label>
                            <textarea
                                rows={3}
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                placeholder="Detail kebutuhan, deadline, syarat khusus..."
                            />
                        </div>
                    )}
                </div>

                {nothingSelected && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mt-3">
                        ⚠️ Pilih minimal 1 dokumen untuk dibuat (atau pakai customer existing).
                    </p>
                )}

                <div className="flex gap-2 mt-5">
                    <button onClick={onClose} className="flex-1 px-4 py-2 border rounded-lg text-sm">Batal</button>
                    <button
                        onClick={() => onSubmit({
                            createCustomer,
                            createSalesOrderDraft: createSO,
                            designerName: designerName || undefined,
                            createInvoiceDraft: createInvoice,
                            invoiceType: createInvoice ? invoiceType : undefined,
                            notes: notes || undefined,
                        })}
                        disabled={submitting || (nothingSelected && !createCustomer)}
                        className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                    >
                        {submitting ? "Memproses..." : "✓ Convert (Closing)"}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Template Copy Modal ────────────────────────────────────────────────────

function TemplateCopyModal({
    leadId, leadPhone, onClose, onActivityLogged,
}: {
    leadId: number;
    leadPhone: string | null;
    onClose: () => void;
    onActivityLogged: () => void;
}) {
    const { data: templates } = useQuery({
        queryKey: ["crm-templates-active"],
        queryFn: () => getMessageTemplates({ activeOnly: true }),
    });

    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [rendered, setRendered] = useState<string>("");
    const [copied, setCopied] = useState(false);
    const [loadingRender, setLoadingRender] = useState(false);

    const handlePick = async (t: MessageTemplate) => {
        setSelectedId(t.id);
        setLoadingRender(true);
        try {
            const r = await renderTemplate(t.id, { leadId });
            setRendered(r.rendered);
        } catch (e: any) {
            alert(`Gagal render template: ${e?.message || e}`);
        } finally {
            setLoadingRender(false);
        }
    };

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(rendered);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            // Log activity
            await addLeadActivity(leadId, {
                kind: "MESSAGE",
                text: `Pesan template (${templates?.find(t => t.id === selectedId)?.name})`,
                meta: { templateId: selectedId, preview: rendered.slice(0, 200) },
            });
            onActivityLogged();
        } catch (e) {
            alert("Gagal copy ke clipboard");
        }
    };

    const handleOpenWa = () => {
        if (!leadPhone) {
            alert("Lead tidak punya nomor HP");
            return;
        }
        const phone = leadPhone.replace(/\D/g, "").replace(/^0/, "62");
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(rendered)}`, "_blank");
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-[300] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl p-5 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-lg">Pilih Template WA</h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                    {(templates ?? []).map((t) => (
                        <button
                            key={t.id}
                            onClick={() => handlePick(t)}
                            className={`text-left p-3 border rounded-lg hover:border-indigo-300 ${
                                selectedId === t.id ? "border-indigo-500 bg-indigo-50" : "border-gray-200"
                            }`}
                        >
                            <div className="text-xs text-indigo-600 font-semibold">{t.category}</div>
                            <div className="font-semibold text-sm">{t.name}</div>
                        </button>
                    ))}
                    {(!templates || templates.length === 0) && (
                        <div className="col-span-2 text-sm text-gray-500 p-4 text-center border rounded-lg">
                            Belum ada template. Buat di <a href="/crm/templates" className="text-indigo-600 underline">/crm/templates</a> dulu.
                        </div>
                    )}
                </div>

                {selectedId && (
                    <div>
                        <div className="text-xs font-semibold text-gray-600 mb-1">Preview</div>
                        {loadingRender ? (
                            <div className="bg-gray-100 rounded p-3 text-sm text-gray-500">
                                <Loader2 className="h-4 w-4 animate-spin inline" /> Rendering...
                            </div>
                        ) : (
                            <textarea
                                rows={8}
                                value={rendered}
                                onChange={(e) => setRendered(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
                            />
                        )}
                        <div className="flex gap-2 mt-3">
                            <button
                                onClick={handleCopy}
                                className={`flex-1 px-4 py-2 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 ${
                                    copied ? "bg-emerald-600 text-white" : "bg-indigo-600 text-white hover:bg-indigo-700"
                                }`}
                            >
                                {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                {copied ? "Tersalin!" : "Copy"}
                            </button>
                            <button
                                onClick={handleOpenWa}
                                disabled={!leadPhone}
                                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-semibold text-sm hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                <MessageCircle className="h-4 w-4" /> Buka WA
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
