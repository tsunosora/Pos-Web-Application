"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    getLeads, getLeadStatusSummary, createLead, updateLead, deleteLead,
    addLeadActivity, convertLead, closeLeadLost, markLeadInvalid, linkLeadToSalesOrder,
    getMessageTemplates, renderTemplate,
    uploadLeadImage, resolveLeadImageUrl, lookupCustomerByPhone, lookupCustomerByName, type CustomerLookupResult,
    type Lead, type LeadItem, type LeadStatus, type LeadSource, type LeadLevel, type MessageTemplate,
    LEAD_SOURCE_LABEL, LEAD_STATUS_LABEL, LEAD_LEVEL_LABEL,
} from "@/lib/api";
import { findActiveSOByCustomer, type ActiveSalesOrderHit } from "@/lib/api/sales-orders";
import api from "@/lib/api/client";
import { LeadItemsEditor, calcItemSubtotal } from "@/components/crm/LeadItemsEditor";
import { LeadImageCarousel } from "@/components/crm/LeadImageCarousel";
import {
    Plus, Search, X, Phone, MessageSquare, Calendar, MapPin, Sparkles, Trash2,
    Loader2, ChevronRight, ChevronLeft, User, Clock, AlertCircle, Tag, MessageCircle, Copy,
    CheckCircle2, XCircle, Filter, ChevronDown, Users, CalendarDays, Link2, Unlink, Palette,
    Receipt, Package,
} from "lucide-react";
import { LeadKanbanBoard } from "@/components/crm/LeadKanbanBoard";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import dayjs from "dayjs";
import "dayjs/locale/id";
dayjs.locale("id");

// ─── Konstanta ──────────────────────────────────────────────────────────────

const STATUS_TABS: { value: LeadStatus | "ALL"; label: string; color: string }[] = [
    { value: "ALL", label: "Semua", color: "bg-muted text-muted-foreground hover:bg-accent" },
    { value: "NEW", label: "Baru", color: "bg-blue-500/10 text-blue-600 dark:text-blue-300 hover:bg-blue-500/20" },
    { value: "FOLLOW_UP", label: "Follow Up", color: "bg-amber-500/10 text-amber-600 dark:text-amber-300 hover:bg-amber-500/20" },
    { value: "NEGOTIATION", label: "Negosiasi", color: "bg-violet-500/10 text-violet-600 dark:text-violet-300 hover:bg-violet-500/20" },
    { value: "CLOSED_WON", label: "Closing", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-500/20" },
    { value: "CLOSED_LOST", label: "Lost", color: "bg-red-500/10 text-red-600 dark:text-red-300 hover:bg-red-500/20" },
    { value: "INVALID", label: "Invalid", color: "bg-orange-500/10 text-orange-600 dark:text-orange-300 hover:bg-orange-500/20" },
];

const SOURCE_OPTIONS: LeadSource[] = [
    "WHATSAPP", "INSTAGRAM", "FACEBOOK", "TIKTOK", "MARKETPLACE", "REFERRAL", "WEBSITE", "WALK_IN", "REPEAT_ORDER", "OTHER", "CUSTOM",
];

const LEVEL_OPTIONS: LeadLevel[] = ["HOT", "WARM", "COLD"];

type DatePreset = "" | "today" | "yesterday" | "this_week" | "this_month" | "last_month" | "3_months" | "1_year" | "custom";

const DATE_PRESET_LABELS: Record<DatePreset, string> = {
    "": "Semua Waktu",
    today: "Hari Ini",
    yesterday: "Kemarin",
    this_week: "Minggu Ini",
    this_month: "Bulan Ini",
    last_month: "Bulan Lalu",
    "3_months": "3 Bulan",
    "1_year": "1 Tahun",
    custom: "Kustom",
};

function getDateRange(preset: DatePreset): { from: string; to: string } | null {
    if (!preset || preset === "custom") return null;
    const now = dayjs();
    const fmt = (d: ReturnType<typeof dayjs>) => d.format("YYYY-MM-DD");
    switch (preset) {
        case "today": return { from: fmt(now.startOf("day")), to: fmt(now) };
        case "yesterday": return { from: fmt(now.subtract(1, "day").startOf("day")), to: fmt(now.subtract(1, "day").endOf("day")) };
        case "this_week": return { from: fmt(now.startOf("week")), to: fmt(now) };
        case "this_month": return { from: fmt(now.startOf("month")), to: fmt(now) };
        case "last_month": return { from: fmt(now.subtract(1, "month").startOf("month")), to: fmt(now.subtract(1, "month").endOf("month")) };
        case "3_months": return { from: fmt(now.subtract(3, "month")), to: fmt(now) };
        case "1_year": return { from: fmt(now.subtract(1, "year")), to: fmt(now) };
        default: return null;
    }
}

// Format response time (firstResponseAt - createdAt) jadi string singkat
// + warna berdasarkan kecepatan. Return null kalau belum direspon.
function formatResponseTime(createdAt: string, firstResponseAt: string | null): { text: string; tone: "fast" | "ok" | "slow" | "late" } | null {
    if (!firstResponseAt) return null;
    const diffMs = new Date(firstResponseAt).getTime() - new Date(createdAt).getTime();
    if (diffMs < 0) return null;
    const minutes = Math.floor(diffMs / 60000);
    let text: string;
    if (minutes < 60) text = `${minutes}m`;
    else if (minutes < 60 * 24) text = `${Math.floor(minutes / 60)}j ${minutes % 60}m`;
    else text = `${Math.floor(minutes / (60 * 24))}h ${Math.floor((minutes % (60 * 24)) / 60)}j`;
    let tone: "fast" | "ok" | "slow" | "late";
    if (minutes < 15) tone = "fast";
    else if (minutes < 60) tone = "ok";
    else if (minutes < 60 * 4) tone = "slow";
    else tone = "late";
    return { text, tone };
}

const RESP_TONE_STYLE: Record<"fast" | "ok" | "slow" | "late", string> = {
    fast: "text-emerald-600 dark:text-emerald-300 bg-emerald-500/10 border-emerald-500/20",
    ok: "text-blue-600 dark:text-blue-300 bg-blue-500/10 border-blue-500/20",
    slow: "text-amber-600 dark:text-amber-300 bg-amber-500/10 border-amber-500/20",
    late: "text-red-600 dark:text-red-300 bg-red-500/10 border-red-500/20",
};

const levelColor: Record<LeadLevel, string> = {
    HOT: "bg-red-500/10 text-red-600 dark:text-red-300 border-red-500/20",
    WARM: "bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/20",
    COLD: "bg-sky-500/10 text-sky-600 dark:text-sky-300 border-sky-500/20",
};

// Warna avatar inisial deterministik berdasar nama
const AVATAR_PALETTE = [
    "bg-indigo-500/15 text-indigo-600 dark:text-indigo-300",
    "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
    "bg-amber-500/15 text-amber-600 dark:text-amber-300",
    "bg-rose-500/15 text-rose-600 dark:text-rose-300",
    "bg-violet-500/15 text-violet-600 dark:text-violet-300",
    "bg-blue-500/15 text-blue-600 dark:text-blue-300",
];
function avatarFor(name: string): { initials: string; cls: string } {
    const clean = (name || "?").trim();
    const parts = clean.split(/\s+/).filter(Boolean);
    const initials = ((parts[0]?.[0] || "") + (parts[1]?.[0] || parts[0]?.[1] || "")).toUpperCase() || "?";
    let hash = 0;
    for (let i = 0; i < clean.length; i++) hash = (hash * 31 + clean.charCodeAt(i)) >>> 0;
    return { initials, cls: AVATAR_PALETTE[hash % AVATAR_PALETTE.length] };
}

// Untuk sumber CUSTOM, tampilkan sourceDetail sebagai label. Untuk yang lain pakai LEAD_SOURCE_LABEL.
function formatSource(source: LeadSource, sourceDetail?: string | null): string {
    if (source === "CUSTOM") return sourceDetail || "Custom";
    const base = LEAD_SOURCE_LABEL[source];
    return sourceDetail ? `${base} (${sourceDetail})` : base;
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function LeadsPage() {
    const qc = useQueryClient();
    const [tabStatus, setTabStatus] = useState<LeadStatus | "ALL">("ALL");
    const [search, setSearch] = useState("");
    const [filterSource, setFilterSource] = useState<LeadSource | "">("");
    const [filterLevel, setFilterLevel] = useState<LeadLevel | "">("");
    const [filterAssignedTo, setFilterAssignedTo] = useState<number | "">("");
    const [datePreset, setDatePreset] = useState<DatePreset>("");
    const [customDateFrom, setCustomDateFrom] = useState("");
    const [customDateTo, setCustomDateTo] = useState("");
    const [showFilters, setShowFilters] = useState(false);
    const [showDateDropdown, setShowDateDropdown] = useState(false);
    const dateDropdownRef = useRef<HTMLDivElement>(null);
    const [formOpen, setFormOpen] = useState(false);
    const [editingLead, setEditingLead] = useState<Lead | null>(null);
    const [detailId, setDetailId] = useState<number | null>(null);

    const dateRange = datePreset === "custom"
        ? (customDateFrom || customDateTo ? { from: customDateFrom || "", to: customDateTo || "" } : null)
        : getDateRange(datePreset);

    const { data: list, isLoading } = useQuery({
        queryKey: ["crm-leads", tabStatus, filterSource, filterLevel, filterAssignedTo, datePreset, customDateFrom, customDateTo, search],
        queryFn: () => getLeads({
            status: tabStatus === "ALL" ? undefined : tabStatus,
            source: filterSource || undefined,
            level: filterLevel || undefined,
            assignedToId: filterAssignedTo || undefined,
            dateFrom: dateRange?.from || undefined,
            dateTo: dateRange?.to || undefined,
            search: search || undefined,
            limit: 200,
        }),
    });

    const { data: users } = useQuery({
        queryKey: ["users"],
        queryFn: async () => (await api.get("/users")).data as { id: number; name: string; email: string }[],
        staleTime: 5 * 60_000,
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

    const clearFilters = () => {
        setFilterSource("");
        setFilterLevel("");
        setFilterAssignedTo("");
        setDatePreset("");
        setCustomDateFrom("");
        setCustomDateTo("");
        setSearch("");
    };

    const activeFilterCount = [
        filterSource, filterLevel, filterAssignedTo, datePreset, search,
    ].filter(Boolean).length;

    // Close date dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (dateDropdownRef.current && !dateDropdownRef.current.contains(e.target as Node)) {
                setShowDateDropdown(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const statusMut = useMutation({
        mutationFn: ({ id, status }: { id: number; status: LeadStatus }) => updateLead(id, { status }),
        onSuccess: invalidate,
        onError: (e: any) => alert(`Gagal ubah status: ${e?.message || e}`),
    });

    const items = list?.items ?? [];

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 flex items-center justify-center shrink-0">
                        <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold leading-tight">Leads CRM</h1>
                        <p className="text-sm text-muted-foreground">Pipeline pra-jual — pelacakan calon customer dari berbagai channel</p>
                    </div>
                </div>
                <div className="flex gap-2 items-center">
                    <button
                        onClick={openCreate}
                        className="px-4 py-2 bg-primary text-primary-foreground rounded-xl font-semibold shadow-sm hover:opacity-90 transition-opacity flex items-center gap-2"
                    >
                        <Plus className="h-4 w-4" /> Lead Baru
                    </button>
                </div>
            </div>

            {/* Status tabs */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 animate-in fade-in slide-in-from-bottom-2 duration-300">
                {STATUS_TABS.map((t) => {
                    const count = t.value === "ALL"
                        ? Object.values(summary || {}).reduce((s, n) => s + n, 0)
                        : (summary?.[t.value as LeadStatus] ?? 0);
                    const active = tabStatus === t.value;
                    return (
                        <button
                            key={t.value}
                            onClick={() => setTabStatus(t.value)}
                            className={`shrink-0 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                                active ? "bg-primary text-primary-foreground shadow-sm" : t.color
                            }`}
                        >
                            {t.label}
                            <span className={`inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full text-xs font-semibold tabular-nums ${
                                active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-background/60 text-foreground"
                            }`}>
                                {count}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Filter bar */}
            <div className="space-y-2">
                {/* Row 1: search + filter toggle */}
                <div className="flex gap-2 flex-wrap items-center">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Cari nama / HP / kota / kebutuhan..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                        />
                    </div>
                    <button
                        onClick={() => setShowFilters((v) => !v)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-colors ${
                            showFilters || activeFilterCount > 0
                                ? "bg-primary/10 border-primary/30 text-primary"
                                : "bg-background border-border text-muted-foreground hover:bg-accent"
                        }`}
                    >
                        <Filter className="h-4 w-4" />
                        Filter
                        {activeFilterCount > 0 && (
                            <span className="ml-0.5 bg-primary text-primary-foreground text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none">
                                {activeFilterCount}
                            </span>
                        )}
                    </button>
                    {activeFilterCount > 0 && (
                        <button
                            onClick={clearFilters}
                            className="flex items-center gap-1 px-3 py-2 rounded-xl border border-red-500/20 text-red-600 dark:text-red-300 text-sm hover:bg-red-500/10 transition-colors"
                        >
                            <X className="h-3.5 w-3.5" /> Reset
                        </button>
                    )}
                </div>

                {/* Row 2: advanced filters (collapsible) */}
                {showFilters && (
                    <div className="relative z-40 flex gap-2 flex-wrap items-start p-3 bg-card rounded-xl border border-border shadow-sm animate-in fade-in slide-in-from-top-1 duration-200">
                        {/* Date preset */}
                        <div className="relative" ref={dateDropdownRef}>
                            <button
                                onClick={() => setShowDateDropdown((v) => !v)}
                                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm whitespace-nowrap transition-colors ${
                                    datePreset ? "bg-primary/10 border-primary/30 text-primary" : "border-border text-muted-foreground bg-background hover:bg-accent"
                                }`}
                            >
                                <CalendarDays className="h-4 w-4" />
                                {DATE_PRESET_LABELS[datePreset]}
                                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                            </button>
                            {showDateDropdown && (
                                <div className="absolute top-full left-0 mt-1 z-50 bg-card border border-border rounded-xl shadow-lg py-1 min-w-[160px] animate-in fade-in zoom-in-95 duration-150">
                                    {(Object.keys(DATE_PRESET_LABELS) as DatePreset[]).map((p) => (
                                        <button
                                            key={p}
                                            onClick={() => { setDatePreset(p); setShowDateDropdown(false); }}
                                            className={`w-full text-left px-4 py-2 text-sm hover:bg-accent transition-colors ${datePreset === p ? "text-primary font-semibold" : "text-foreground"}`}
                                        >
                                            {DATE_PRESET_LABELS[p]}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Custom date range */}
                        {datePreset === "custom" && (
                            <div className="flex items-center gap-1.5">
                                <input
                                    type="date"
                                    value={customDateFrom}
                                    onChange={(e) => setCustomDateFrom(e.target.value)}
                                    className="bg-background border border-border rounded-xl px-2 py-2 text-sm"
                                />
                                <span className="text-muted-foreground text-xs">s/d</span>
                                <input
                                    type="date"
                                    value={customDateTo}
                                    onChange={(e) => setCustomDateTo(e.target.value)}
                                    className="bg-background border border-border rounded-xl px-2 py-2 text-sm"
                                />
                            </div>
                        )}

                        {/* CS / assigned to */}
                        <div className="relative">
                            <Users className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                            <select
                                value={filterAssignedTo}
                                onChange={(e) => setFilterAssignedTo(e.target.value ? Number(e.target.value) : "")}
                                className={`pl-8 pr-3 py-2 border rounded-xl text-sm transition-colors ${
                                    filterAssignedTo ? "bg-primary/10 border-primary/30 text-primary" : "border-border text-muted-foreground bg-background"
                                }`}
                            >
                                <option value="">Semua CS</option>
                                {(users ?? []).map((u) => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Source */}
                        <select
                            value={filterSource}
                            onChange={(e) => setFilterSource(e.target.value as LeadSource | "")}
                            className={`border rounded-xl px-3 py-2 text-sm transition-colors ${
                                filterSource ? "bg-primary/10 border-primary/30 text-primary" : "border-border text-muted-foreground bg-background"
                            }`}
                        >
                            <option value="">Semua Sumber</option>
                            {SOURCE_OPTIONS.map((s) => (
                                <option key={s} value={s}>{LEAD_SOURCE_LABEL[s]}</option>
                            ))}
                        </select>

                        {/* Level pills */}
                        <div className="flex gap-1 items-center">
                            {LEVEL_OPTIONS.map((l) => (
                                <button
                                    key={l}
                                    onClick={() => setFilterLevel(filterLevel === l ? "" : l)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                                        filterLevel === l
                                            ? levelColor[l]
                                            : "bg-background border-border text-muted-foreground hover:bg-accent"
                                    }`}
                                >
                                    {LEAD_LEVEL_LABEL[l]}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* List */}
            {isLoading ? (
                <div className="flex items-center justify-center py-16 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" /> Memuat...
                </div>
            ) : items.length === 0 ? (
                <div className="bg-card border border-border rounded-2xl p-12 text-center animate-in fade-in zoom-in-95 duration-300">
                    <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                        <Sparkles className="h-7 w-7 text-muted-foreground/50" />
                    </div>
                    <p className="text-muted-foreground">Belum ada lead. Tambah lead baru untuk mulai tracking calon customer.</p>
                </div>
            ) : (
                <div className="animate-in fade-in duration-300">
                    <LeadKanbanBoard
                        leads={items}
                        onCardClick={(l) => setDetailId(l.id)}
                        onStatusChange={(id, status) => statusMut.mutate({ id, status })}
                    />
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
        intakeAt: initial?.intakeAt
            ? dayjs(initial.intakeAt).format("YYYY-MM-DDTHH:mm")
            : dayjs().format("YYYY-MM-DDTHH:mm"),
        followUpDate: initial?.followUpDate ? dayjs(initial.followUpDate).format("YYYY-MM-DD") : "",
        deliveryDeadline: initial?.deliveryDeadline ? dayjs(initial.deliveryDeadline).format("YYYY-MM-DD") : "",
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
    const [nameMatches, setNameMatches] = useState<CustomerLookupResult[]>([]);
    const [nameListOpen, setNameListOpen] = useState(false);
    const [savedCustomSources, setSavedCustomSources] = useState<string[]>([]);

    // Load custom sources dari localStorage, juga tambahkan sourceDetail lead yang sedang diedit
    useEffect(() => {
        try {
            const raw = localStorage.getItem("crm_custom_sources");
            const stored: string[] = raw ? JSON.parse(raw) : [];
            const initCustom = initial?.source === "CUSTOM" && initial.sourceDetail ? initial.sourceDetail : null;
            if (initCustom && !stored.includes(initCustom)) {
                const updated = [initCustom, ...stored].slice(0, 20);
                try { localStorage.setItem("crm_custom_sources", JSON.stringify(updated)); } catch {}
                setSavedCustomSources(updated);
            } else {
                setSavedCustomSources(stored);
            }
        } catch {}
    }, []);

    // Nilai select sumber: kalau CUSTOM+sourceDetail ada di list (case-insensitive) → pakai nama tersimpan, kalau baru → "CUSTOM_NEW"
    const matchedSavedSource = form.source === "CUSTOM"
        ? savedCustomSources.find(s => s.toLowerCase() === form.sourceDetail.toLowerCase())
        : undefined;
    const selectSourceValue = form.source === "CUSTOM"
        ? (matchedSavedSource ? `CUSTOM:${matchedSavedSource}` : "CUSTOM_NEW")
        : form.source;

    const handleSourceChange = (value: string) => {
        if (value.startsWith("CUSTOM:")) {
            setForm(f => ({ ...f, source: "CUSTOM" as LeadSource, sourceDetail: value.slice(7) }));
        } else if (value === "CUSTOM_NEW") {
            setForm(f => ({ ...f, source: "CUSTOM" as LeadSource, sourceDetail: "" }));
        } else {
            setForm(f => ({ ...f, source: value as LeadSource }));
        }
    };

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

    // Lookup customer by nama — debounced, hanya untuk lead baru
    useEffect(() => {
        if (initial) return;
        const q = form.name.trim();
        if (q.length < 2) { setNameMatches([]); return; }
        const t = setTimeout(async () => {
            try { setNameMatches(await lookupCustomerByName(q)); }
            catch { setNameMatches([]); }
        }, 300);
        return () => clearTimeout(t);
    }, [form.name, initial]);

    const useCustomerData = (c: CustomerLookupResult) => {
        setForm(f => ({ ...f, name: c.name, phone: c.phone || f.phone }));
        setPhoneMatches([]);
        setNameListOpen(false);
    };

    const itemsTotal = items.reduce((s, it) => s + calcItemSubtotal(it), 0);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Simpan custom source ke localStorage supaya bisa dipilih lagi
        if (form.source === "CUSTOM" && form.sourceDetail.trim()) {
            const label = form.sourceDetail.trim();
            const labelLower = label.toLowerCase();
            const updated = [label, ...savedCustomSources.filter(s => s.toLowerCase() !== labelLower)].slice(0, 20);
            setSavedCustomSources(updated);
            try { localStorage.setItem("crm_custom_sources", JSON.stringify(updated)); } catch {}
        }
        onSubmit({
            ...form,
            // Kalau ada items, estimasi auto dari sum items. Kalau user manual override, pakai itu.
            estimatedValue: form.estimatedValue === "" ? (itemsTotal > 0 ? itemsTotal : undefined) : Number(form.estimatedValue),
            intakeAt: form.intakeAt || undefined,
            followUpDate: form.followUpDate || undefined,
            deliveryDeadline: form.deliveryDeadline || undefined,
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
        <div className="fixed inset-0 bg-background/25 backdrop-blur-md z-[200] flex items-center justify-center p-4">
            <div className="bg-card rounded-2xl border border-border shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
                <div className="sticky top-0 bg-card/95 backdrop-blur border-b border-border px-5 py-3 flex items-center justify-between z-10">
                    <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 flex items-center justify-center">
                            <Sparkles className="h-4 w-4" />
                        </div>
                        <h2 className="font-bold text-lg">{initial ? "Edit Lead" : "Lead Baru"}</h2>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-accent rounded-lg transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-5 space-y-3">
                    {/* Multi-image upload — bisa upload sampai 5 gambar, tampil sebagai slider di card */}
                    <div>
                        <label className="block text-xs font-semibold text-muted-foreground mb-1">
                            Gambar Lead
                            <span className="text-muted-foreground font-normal ml-1">
                                ({imageUrls.length}/{MAX_IMAGES}) — tampil sebagai slider di card kanban
                            </span>
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {imageUrls.map((url, idx) => {
                                const src = resolveLeadImageUrl(url) || url;
                                return (
                                    <div key={idx} className="relative aspect-square bg-muted rounded-lg overflow-hidden border-2 border-border group">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={src} alt={`Lead ${idx + 1}`} className="w-full h-full object-cover" />
                                        {idx === 0 && (
                                            <span className="absolute top-1 left-1 bg-primary text-primary-foreground text-[9px] px-1.5 py-0.5 rounded font-semibold">COVER</span>
                                        )}
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1">
                                            {idx > 0 && (
                                                <button type="button" onClick={() => moveImage(idx, -1)}
                                                    className="bg-card text-foreground rounded p-1" title="Geser ke kiri"><ChevronLeft className="h-3.5 w-3.5" /></button>
                                            )}
                                            {idx < imageUrls.length - 1 && (
                                                <button type="button" onClick={() => moveImage(idx, 1)}
                                                    className="bg-card text-foreground rounded p-1" title="Geser ke kanan"><ChevronRight className="h-3.5 w-3.5" /></button>
                                            )}
                                            <button type="button" onClick={() => removeImage(idx)}
                                                className="bg-red-500 text-white rounded p-1" title="Hapus"><X className="h-3.5 w-3.5" /></button>
                                        </div>
                                    </div>
                                );
                            })}
                            {imageUrls.length < MAX_IMAGES && (
                                <label className={`aspect-square rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
                                    <span className="text-2xl text-muted-foreground">{uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : "+"}</span>
                                    <span className="text-[10px] text-muted-foreground mt-0.5">
                                        {uploading ? "Upload..." : "Tambah"}
                                    </span>
                                    <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
                                </label>
                            )}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">
                            Bisa upload multiple sekaligus (Ctrl+Click). Maks 10 MB per file. Gambar pertama = COVER (tampil pertama di slider).
                        </p>
                    </div>

                    <div className="relative">
                        <label className="block text-xs font-semibold text-muted-foreground mb-1">Nama *</label>
                        <input
                            required
                            value={form.name}
                            onChange={(e) => { setForm({ ...form, name: e.target.value }); setNameListOpen(true); }}
                            onFocus={() => setNameListOpen(true)}
                            onBlur={() => setTimeout(() => setNameListOpen(false), 150)}
                            autoComplete="off"
                            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                            placeholder="mis. PT Bina Sekolah / Andi futsal"
                        />
                        {!initial && nameListOpen && nameMatches.length > 0 && (
                            <div className="absolute z-20 mt-1 w-full bg-card border border-border rounded-lg shadow-lg max-h-56 overflow-y-auto">
                                <div className="px-2.5 py-1.5 text-[10px] font-semibold text-muted-foreground border-b border-border bg-muted/40">
                                    Pelanggan tersimpan ({nameMatches.length}) — klik untuk pakai
                                </div>
                                {nameMatches.map(c => (
                                    <button
                                        key={c.id}
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => useCustomerData(c)}
                                        className="w-full text-left px-3 py-2 hover:bg-primary/10 border-b border-border last:border-0 transition-colors"
                                    >
                                        <div className="font-medium text-sm text-foreground truncate">{c.name}</div>
                                        {(c.phone || c.address) && (
                                            <div className="text-[11px] text-muted-foreground truncate">
                                                {c.phone}{c.phone && c.address ? " · " : ""}{c.address}
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-muted-foreground mb-1">
                            Tanggal &amp; Jam Masuk Lead
                            {!initial && <span className="text-indigo-500 font-normal ml-1">(otomatis = sekarang)</span>}
                        </label>
                        <input
                            type="datetime-local"
                            value={form.intakeAt}
                            onChange={(e) => setForm({ ...form, intakeAt: e.target.value })}
                            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                        />
                        <p className="text-[10px] text-muted-foreground mt-1">
                            Sesuaikan jika lead ini masuk sebelumnya tapi baru diinput sekarang.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-muted-foreground mb-1">No. HP</label>
                            <input
                                value={form.phone}
                                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                                placeholder="08123456789"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-muted-foreground mb-1">Kota</label>
                            <input
                                value={form.city}
                                onChange={(e) => setForm({ ...form, city: e.target.value })}
                                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                                placeholder="Yogyakarta"
                            />
                        </div>
                    </div>

                    {/* Phone dedup banner — beberapa state */}
                    {!initial && form.phone.replace(/\D/g, "").length >= 4 && (
                        <>
                            {phoneSearching && (
                                <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                                    <Loader2 className="h-3 w-3 animate-spin" /> Mencari customer dengan HP serupa...
                                </div>
                            )}
                            {!phoneSearching && phoneMatches.length > 0 && (
                                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-xs">
                                    <div className="font-semibold text-amber-700 dark:text-amber-300 mb-1.5 flex items-center gap-1">
                                        <AlertCircle className="h-3.5 w-3.5 shrink-0" /> Customer dengan HP serupa sudah terdaftar ({phoneMatches.length})
                                    </div>
                                    <div className="space-y-1.5">
                                        {phoneMatches.map(c => (
                                            <div key={c.id} className="flex items-center justify-between bg-card rounded px-2 py-1.5 border border-amber-500/20">
                                                <div className="min-w-0 flex-1">
                                                    <div className="font-semibold text-foreground truncate">{c.name}</div>
                                                    <div className="text-muted-foreground">{c.phone}</div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => useCustomerData(c)}
                                                    className="ml-2 px-2 py-1 bg-primary text-primary-foreground rounded text-[10px] font-semibold hover:opacity-90 transition-opacity"
                                                >
                                                    Pakai Data Ini
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-[10px] text-amber-700 dark:text-amber-300/80 mt-1.5">
                                        Tip: pakai data customer existing untuk hindari duplikat. Saat convert, lead akan langsung ter-link ke customer ini.
                                    </p>
                                </div>
                            )}
                            {!phoneSearching && phoneChecked && phoneMatches.length === 0 && form.phone.replace(/\D/g, "").length >= 6 && (
                                <div className="text-xs text-emerald-600 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded px-2 py-1.5 flex items-center gap-1.5">
                                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> HP ini belum terdaftar — aman dibuat sebagai lead baru
                                </div>
                            )}
                        </>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-muted-foreground mb-1">Sumber *</label>
                            <select
                                required
                                value={selectSourceValue}
                                onChange={(e) => handleSourceChange(e.target.value)}
                                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                            >
                                {SOURCE_OPTIONS.filter(s => s !== "CUSTOM").map((s) => (
                                    <option key={s} value={s}>{LEAD_SOURCE_LABEL[s]}</option>
                                ))}
                                {savedCustomSources.length > 0 && (
                                    <optgroup label="— Sumber Tersimpan —">
                                        {savedCustomSources.map(s => (
                                            <option key={`CUSTOM:${s}`} value={`CUSTOM:${s}`}>{s}</option>
                                        ))}
                                    </optgroup>
                                )}
                                <option value="CUSTOM_NEW">+ Tambah Sumber Baru...</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-muted-foreground mb-1">Level</label>
                            <select
                                value={form.level}
                                onChange={(e) => setForm({ ...form, level: e.target.value as LeadLevel })}
                                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                            >
                                {LEVEL_OPTIONS.map((l) => (
                                    <option key={l} value={l}>{LEAD_LEVEL_LABEL[l]}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-muted-foreground mb-1">
                            {form.source === "CUSTOM" && selectSourceValue === "CUSTOM_NEW" ? (
                                <>Nama Sumber Baru <span className="text-red-500">*</span></>
                            ) : "Detail Sumber"}
                        </label>
                        <input
                            required={form.source === "CUSTOM" && selectSourceValue === "CUSTOM_NEW"}
                            value={form.sourceDetail}
                            onChange={(e) => setForm({ ...form, sourceDetail: e.target.value })}
                            className={`w-full border rounded-lg px-3 py-2 text-sm ${form.source === "CUSTOM" && selectSourceValue === "CUSTOM_NEW" ? "border-indigo-400 focus:ring-2 focus:ring-indigo-300" : "border-border"}`}
                            placeholder={
                                form.source === "CUSTOM" && selectSourceValue === "CUSTOM_NEW"
                                    ? 'mis. "Shopee", "Brosur Pameran", "Event Kampus"...'
                                    : 'mis. "IG @volikoprint - story balas" / "Referral kak Andi"'
                            }
                        />
                        {form.source === "CUSTOM" && selectSourceValue === "CUSTOM_NEW" && (
                            <p className="text-[10px] text-indigo-600 mt-1">Nama ini akan tersimpan dan bisa dipilih langsung di lain waktu.</p>
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-muted-foreground mb-1">Kebutuhan (catatan bebas)</label>
                        <textarea
                            rows={2}
                            value={form.needs}
                            onChange={(e) => setForm({ ...form, needs: e.target.value })}
                            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                            placeholder="mis. Deadline 2 minggu, ada permintaan desain khusus, dll"
                        />
                    </div>

                    {/* Daftar Produk Order — dipakai saat convert untuk SO & Invoice */}
                    <LeadItemsEditor items={items} onChange={setItems} />

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-muted-foreground mb-1">
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
                                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                                placeholder="6000000"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-muted-foreground mb-1">Tanggal FU</label>
                            <input
                                type="date"
                                value={form.followUpDate}
                                onChange={(e) => setForm({ ...form, followUpDate: e.target.value })}
                                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-muted-foreground mb-1">Tanggal Kirim Deadline</label>
                        <input
                            type="date"
                            value={form.deliveryDeadline}
                            onChange={(e) => setForm({ ...form, deliveryDeadline: e.target.value })}
                            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                        />
                        <p className="text-[10px] text-muted-foreground mt-1">Target tanggal barang/jasa harus sudah dikirim ke customer.</p>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-muted-foreground mb-1">
                            CS yang Pegang Lead Ini
                        </label>
                        <select
                            value={form.assignedToId}
                            onChange={(e) => setForm({ ...form, assignedToId: e.target.value })}
                            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                        >
                            <option value="">— Belum di-assign —</option>
                            {(users ?? []).map((u) => (
                                <option key={u.id} value={u.id}>
                                    {u.name || u.email}
                                </option>
                            ))}
                        </select>
                        <p className="text-[10px] text-muted-foreground mt-1">
                            Daftar diambil dari Manajemen User di /settings/users. CS yang pegang akan jadi default assignee untuk follow-up.
                        </p>
                    </div>

                    <div className="flex gap-2 pt-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-border rounded-lg text-sm hover:bg-accent transition-colors"
                        >Batal</button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="flex-1 px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg text-sm shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50"
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
    const { isOwner } = useCurrentUser();
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
    const [showLinkSO, setShowLinkSO] = useState(false);
    const [showPreNota, setShowPreNota] = useState(false);
    const [showCloseLost, setShowCloseLost] = useState(false);
    const [showMarkInvalid, setShowMarkInvalid] = useState(false);
    const [invalidReason, setInvalidReason] = useState("");
    const [showTemplate, setShowTemplate] = useState(false);
    const [closeLostReason, setCloseLostReason] = useState("");
    const [lostItems, setLostItems] = useState<LeadItem[]>([]);   // produk yg batal dipesan (opsional)

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

    // Cek desain pra-jual — pilih designer & verdict (simpan instan)
    const { data: designersList } = useQuery({
        queryKey: ['designers-list'],
        queryFn: async () => (await api.get('/designers')).data as { id: number; name: string; isActive: boolean }[],
        staleTime: 5 * 60_000,
    });
    const activeDesigners = (designersList || []).filter(d => d.isActive);
    const designMut = useMutation({
        mutationFn: (d: { designerName?: string | null; designVerdict?: string | null }) => updateLead(leadId, d),
        onSuccess: invalidate,
    });

    const respMut = useMutation({
        mutationFn: (firstResponseAt: string | null) => updateLead(leadId, { firstResponseAt }),
        onSuccess: invalidate,
    });

    const convertMut = useMutation({
        // Simpan dulu produk yang dipilih di modal ke lead (lead bisa dibuat tanpa
        // produk), baru convert → Nota/SO/job produksi pakai item ini.
        mutationFn: async (data: any) => {
            const { items, ...rest } = data;
            if (Array.isArray(items)) {
                const valid = items.filter((it: any) => it.productVariantId || it.customName);
                const est = valid.reduce((s: number, it: any) => s + calcItemSubtotal(it), 0);
                await updateLead(leadId, { items: valid, estimatedValue: est || undefined });
            }
            return convertLead(leadId, rest);
        },
        onSuccess: (result: any) => {
            invalidate();
            setShowConvert(false);
            const r = result?._convertResult;
            if (r) {
                const lines: string[] = ["✓ Lead di-convert berhasil!\n"];
                if (r.customerId) lines.push(`👤 Customer #${r.customerId}`);
                if (r.invoiceNumber) {
                    lines.push(`🧾 ${r.invoiceNumber}${r.invoiceItemsCreated > 0 ? ` (${r.invoiceItemsCreated} item)` : ''}`);
                }
                if (r.transactionId) {
                    let tx = `🏭 Antrian Produksi: Transaction #${r.transactionId}`;
                    if (r.transactionItemsCreated > 0) tx += `\n   ${r.transactionItemsCreated} item → job otomatis di /produksi/pipeline`;
                    if (r.transactionItemsSkipped > 0) tx += `\n   ⚠ ${r.transactionItemsSkipped} item custom di-skip (tidak punya productVariant)`;
                    lines.push(tx);
                }
                if (r.transactionError) {
                    lines.push(`⚠ Produksi gagal dibuat: ${r.transactionError}`);
                } else if (!r.transactionId && r.transactionItemsSkipped > 0) {
                    lines.push(`⚠ Tidak ada item — produksi tidak dibuat`);
                }
                if (r.salesOrderId) {
                    lines.push(`📋 SPK #${r.salesOrderId}${r.soItemsCreated > 0 ? ` (${r.soItemsCreated} item)` : ''}`);
                }
                alert(lines.join('\n'));
            }
        },
        onError: (err: any) => {
            const msg = err?.response?.data?.message || err?.message || 'Terjadi kesalahan.';
            alert(`Gagal convert: ${msg}`);
        },
    });

    // Saat Lost: kalau CS isi produk yg batal, simpan dulu ke lead (buat analisa
    // "produk apa yang sering batal"), baru tandai Lost.
    const closeLostMut = useMutation({
        mutationFn: async () => {
            const valid = lostItems.filter(it => (it as any).productVariantId || (it as any).customName);
            if (valid.length > 0) {
                const est = valid.reduce((s, it) => s + calcItemSubtotal(it), 0);
                await updateLead(leadId, { items: valid as any, estimatedValue: est });
            }
            return closeLeadLost(leadId, closeLostReason);
        },
        onSuccess: () => { invalidate(); setShowCloseLost(false); setCloseLostReason(""); setLostItems([]); },
    });

    // Prefill editor produk Lost dari item lead yang sudah ada (kalau ada)
    useEffect(() => {
        if (showCloseLost) setLostItems(((leadDetail as any)?.items as LeadItem[]) ?? []);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showCloseLost]);

    // Alur B: tautkan / lepas tautan lead ↔ SO desainer (tanpa bikin nota baru)
    const linkSOMut = useMutation({
        mutationFn: (salesOrderId: number | null) => linkLeadToSalesOrder(leadId, salesOrderId),
        onSuccess: () => { invalidate(); setShowLinkSO(false); },
        onError: (err: any) => {
            alert(`Gagal: ${err?.response?.data?.message || err?.message || 'Terjadi kesalahan.'}`);
        },
    });

    // Pra-nota (Alur B): lengkapi CS & sumber lead dulu, baru lanjut ke POS
    // di TAB YANG SAMA (window.location, bukan tab baru — anti multitab)
    const preNotaMut = useMutation({
        mutationFn: (data: { assignedToId: number; source: LeadSource; sourceDetail: string | null; soId: number }) =>
            // sourceDetail "" → backend simpan null (hapus placeholder 'SO Desainer')
            updateLead(leadId, { assignedToId: data.assignedToId, source: data.source, sourceDetail: data.sourceDetail ?? "" }),
        onSuccess: (_res, vars) => {
            invalidate();
            window.location.href = `/pos?fromSO=${vars.soId}`;
        },
        onError: (err: any) => {
            alert(`Gagal menyimpan data CS/sumber: ${err?.response?.data?.message || err?.message || 'Terjadi kesalahan.'}`);
        },
    });

    // Buat Nota DI KASIR: buat customer + SO (TANPA transaction), lalu arahkan ke
    // POS (?fromSO) — nota dibuat di kasir (model konsisten). Lead auto-closing
    // saat SO itu dibuatkan nota di POS.
    const buatNotaKasirMut = useMutation({
        mutationFn: () => convertLead(leadId, {
            createCustomer: true,
            createSalesOrderDraft: true,
            createInvoiceDraft: false,
            createProductionTransaction: false,
            markWon: false,   // lead closing nanti otomatis saat nota dibuat di POS
        }),
        onSuccess: (result: any) => {
            invalidate();
            const soId = result?._convertResult?.salesOrderId;
            if (soId) window.location.href = `/pos?fromSO=${soId}`;
            else alert("SO gagal dibuat. Coba lagi.");
        },
        onError: (e: any) => alert(`Gagal: ${e?.response?.data?.message || e?.message || e}`),
    });

    const markInvalidMut = useMutation({
        mutationFn: () => markLeadInvalid(leadId, invalidReason.trim() || undefined),
        onSuccess: () => { invalidate(); setShowMarkInvalid(false); setInvalidReason(""); },
    });

    if (!leadDetail) {
        return (
            <div className="fixed inset-0 bg-background/25 backdrop-blur-md z-[200] flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    const lead2 = leadDetail;
    const isLost    = lead2.status === "CLOSED_LOST";
    const isWon     = lead2.status === "CLOSED_WON";
    const isInvalid = lead2.status === "INVALID";

    return (
        <div className="fixed inset-0 bg-background/25 backdrop-blur-md z-[200] flex justify-end" onClick={onClose}>
            <div
                className="bg-card w-full max-w-2xl h-full overflow-y-auto border-l border-border shadow-2xl animate-in slide-in-from-right-4 fade-in duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="sticky top-0 bg-card/95 backdrop-blur border-b border-border px-5 py-3 flex items-center justify-between z-10">
                    <div className="flex items-center gap-2.5 min-w-0">
                        {(() => { const a = avatarFor(lead2.name); return (
                            <div className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${a.cls}`}>
                                {a.initials}
                            </div>
                        ); })()}
                        <div className="min-w-0">
                            <h2 className="font-bold text-lg leading-tight truncate">{lead2.name}</h2>
                            <span className={`inline-block mt-0.5 text-[10px] px-2 py-0.5 rounded-full border ${levelColor[lead2.level]}`}>
                                {LEAD_LEVEL_LABEL[lead2.level]}
                            </span>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-accent rounded-lg transition-colors shrink-0">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Image preview — carousel kalau >1, klik buka di tab baru */}
                {((lead2.images && lead2.images.length > 0) || lead2.imageUrl) && (
                    <div className="bg-muted border-b">
                        <LeadImageCarousel
                            images={lead2.images || []}
                            fallbackUrl={lead2.imageUrl}
                            alt={lead2.name}
                            heightClass="h-64"
                            onClick={(src) => {
                                if (src) window.open(src, "_blank", "noopener");
                            }}
                        />
                    </div>
                )}

                {/* Quick info */}
                <div className="p-5 space-y-4">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <Info label="Status" value={LEAD_STATUS_LABEL[lead2.status]} />
                        <Info label="Sumber" value={formatSource(lead2.source, lead2.sourceDetail)} />
                        <Info
                            label="Masuk Lead"
                            value={dayjs(lead2.intakeAt || lead2.createdAt).format("DD MMM YYYY, HH:mm")}
                        />
                        <Info label="HP" value={lead2.phone || "-"} />
                        <Info label="Kota" value={lead2.city || "-"} />
                        <Info label="Estimasi" value={lead2.estimatedValue ? `Rp ${Number(lead2.estimatedValue).toLocaleString("id-ID")}` : "-"} />
                        <Info label="Tanggal FU" value={lead2.followUpDate ? dayjs(lead2.followUpDate).format("DD MMM YYYY") : "-"} />
                        <Info label="Tgl Kirim Deadline" value={lead2.deliveryDeadline ? dayjs(lead2.deliveryDeadline).format("DD MMM YYYY") : "-"} />
                        <Info label="Assigned" value={lead2.assignedTo?.name || lead2.assignedTo?.email || "Belum di-assign"} />
                        <div className="col-span-2">
                            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Response Time CS</div>
                            {(() => {
                                const rt = formatResponseTime(lead2.createdAt, lead2.firstResponseAt);
                                if (rt) {
                                    return (
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-semibold ${RESP_TONE_STYLE[rt.tone]}`}>
                                                <Clock className="h-3 w-3" /> {rt.text}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                direspon {dayjs(lead2.firstResponseAt!).format("DD MMM YYYY HH:mm")}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => respMut.mutate(null)}
                                                disabled={respMut.isPending}
                                                className="text-[11px] text-muted-foreground hover:text-red-600 underline disabled:opacity-50"
                                            >
                                                Reset
                                            </button>
                                        </div>
                                    );
                                }
                                return (
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground italic">Belum direspon</span>
                                        <button
                                            type="button"
                                            onClick={() => respMut.mutate(new Date().toISOString())}
                                            disabled={respMut.isPending}
                                            className="text-[11px] px-2 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                                        >
                                            Tandai Direspon Sekarang
                                        </button>
                                    </div>
                                );
                            })()}
                        </div>
                        <Info label="Dibuat" value={dayjs(lead2.createdAt).format("DD MMM YYYY HH:mm")} />
                    </div>

                    {lead2.needs && (
                        <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-3">
                            <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-300 mb-1">Kebutuhan</div>
                            <p className="text-sm text-foreground whitespace-pre-wrap">{lead2.needs}</p>
                        </div>
                    )}

                    {/* Daftar produk yang akan diorder */}
                    {(lead2.items && lead2.items.length > 0) && (
                        <div className="bg-card border border-border rounded-xl p-3 shadow-sm">
                            <div className="text-xs font-semibold text-foreground mb-2 flex items-center justify-between">
                                <span className="flex items-center gap-1.5"><Package className="h-3.5 w-3.5" /> Daftar Produk Order ({lead2.items.length} item)</span>
                                <span className="text-indigo-600 dark:text-indigo-300 font-bold">
                                    Total: Rp {lead2.items.reduce((s: number, it: any) => s + calcItemSubtotal(it), 0).toLocaleString("id-ID", { maximumFractionDigits: 0 })}
                                </span>
                            </div>
                            <div className="overflow-x-auto">
                            <table className="w-full text-xs min-w-[560px]">
                                <thead>
                                    <tr className="border-b text-muted-foreground">
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
                                            <tr key={it.id} className="border-t hover:bg-muted">
                                                <td className="py-1.5 px-1">
                                                    <div className="font-semibold">{it.description}</div>
                                                    {isCustom ? (
                                                        <span className="text-[9px] text-amber-700">⚠ custom</span>
                                                    ) : (
                                                        <span className="text-[9px] text-emerald-600">✓ katalog · {it.productVariant?.sku}</span>
                                                    )}
                                                    {it.widthCm && it.heightCm && (
                                                        <span className="text-[9px] text-muted-foreground ml-1">· {it.widthCm}×{it.heightCm}{it.unitType === 'm' ? 'm' : 'cm'}</span>
                                                    )}
                                                </td>
                                                <td className="py-1.5 px-1 text-right font-mono">
                                                    {it.quantity}
                                                    {isArea && (
                                                        <div className="text-[9px] text-muted-foreground">
                                                            ×{(it.unitType === 'm' ? Number(it.widthCm) * Number(it.heightCm) : (Number(it.widthCm) * Number(it.heightCm)) / 10000).toFixed(2)}m²
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="py-1.5 px-1 text-right font-mono text-muted-foreground">
                                                    {Number(it.unitPrice).toLocaleString("id-ID")}
                                                    {isArea && <div className="text-[9px] text-muted-foreground">/m²</div>}
                                                </td>
                                                <td className="py-1.5 px-1 text-right font-mono font-bold text-indigo-600 dark:text-indigo-300">
                                                    {sub.toLocaleString("id-ID", { maximumFractionDigits: 0 })}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            </div>
                        </div>
                    )}

                    {/* Alur B: SO desainer tertaut, belum jadi nota — saat SO di-checkout di POS, lead otomatis closing */}
                    {lead2.convertedSalesOrderId && !isWon && (
                        <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-3 text-sm space-y-1">
                            <div className="font-semibold text-indigo-600 dark:text-indigo-300 flex items-center gap-1">
                                <Link2 className="h-4 w-4" /> Tertaut ke Sales Order
                            </div>
                            <div className="text-foreground">
                                SO: <strong>{lead2.convertedSO?.soNumber || `#${lead2.convertedSalesOrderId}`}</strong>
                                <span className="text-muted-foreground"> — saat SO ini dibuatkan nota di POS, lead otomatis closing ke nota yang sama (tanpa nota dobel).</span>
                            </div>
                            <div className="flex items-center gap-3 pt-1.5 border-t border-indigo-500/20">
                                <button
                                    onClick={() => setShowPreNota(true)}
                                    className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-lg font-semibold hover:opacity-90 transition-opacity inline-flex items-center gap-1"
                                >
                                    <Receipt className="h-3.5 w-3.5" /> Buat Nota di POS
                                </button>
                                <button
                                    onClick={() => { if (confirm("Lepas tautan SO dari lead ini?")) linkSOMut.mutate(null); }}
                                    disabled={linkSOMut.isPending}
                                    className="text-xs text-red-600 dark:text-red-300 hover:underline flex items-center gap-1"
                                >
                                    <Unlink className="h-3 w-3" /> Lepas tautan
                                </button>
                            </div>
                        </div>
                    )}

                    {lead2.convertedCustomer && (
                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-sm space-y-1">
                            <div className="font-semibold text-emerald-600 dark:text-emerald-300 flex items-center gap-1">
                                <CheckCircle2 className="h-4 w-4" /> Sudah Convert
                            </div>
                            <div className="text-foreground">
                                Customer: <strong>{lead2.convertedCustomer.name}</strong>
                                {lead2.convertedSO && <span> · SO: <strong>{lead2.convertedSO.soNumber}</strong></span>}
                            </div>
                            {lead2.convertedTransactionId && (
                                <div className="flex items-center gap-2 pt-1 border-t border-emerald-500/20">
                                    <span className="text-emerald-600 dark:text-emerald-300 inline-flex items-center gap-1"><Receipt className="h-3.5 w-3.5" /> Nota Produksi:</span>
                                    <a
                                        href={`/transactions/${lead2.convertedTransactionId}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-indigo-600 dark:text-indigo-300 hover:underline font-medium underline-offset-2"
                                    >
                                        Lihat Nota #{lead2.convertedTransactionId}
                                    </a>
                                </div>
                            )}
                        </div>
                    )}

                    {lead2.status === "CLOSED_LOST" && lead2.closeLostReason && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm">
                            <div className="font-semibold text-red-600 dark:text-red-300 flex items-center gap-1">
                                <XCircle className="h-4 w-4" /> Lead Lost
                            </div>
                            <div className="text-foreground mt-1">{lead2.closeLostReason}</div>
                        </div>
                    )}

                    {/* Cek Desain pra-jual — kerja tim CS + Designer */}
                    <div className="bg-card border border-border rounded-xl p-3 space-y-2">
                        <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                            <Palette className="h-4 w-4 text-violet-500 dark:text-violet-300" /> Cek Desain
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                                <label className="text-xs text-muted-foreground">Designer pengecek</label>
                                <select
                                    value={lead2.designerName ?? ""}
                                    onChange={(e) => designMut.mutate({ designerName: e.target.value || null })}
                                    disabled={designMut.isPending}
                                    className="w-full mt-0.5 bg-background border border-border rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-ring outline-none"
                                >
                                    <option value="">— Belum dicek —</option>
                                    {activeDesigners.map((d) => (
                                        <option key={d.id} value={d.name}>{d.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-muted-foreground">Hasil cek</label>
                                <select
                                    value={lead2.designVerdict ?? ""}
                                    onChange={(e) => designMut.mutate({ designVerdict: e.target.value || null })}
                                    disabled={designMut.isPending || !lead2.designerName}
                                    className="w-full mt-0.5 bg-background border border-border rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-ring outline-none disabled:opacity-50"
                                >
                                    <option value="">—</option>
                                    <option value="BISA">Bisa dicetak</option>
                                    <option value="TIDAK_BISA">Tidak bisa dicetak</option>
                                    <option value="REVISI">Perlu revisi</option>
                                </select>
                            </div>
                        </div>
                        {lead2.designerName && (
                            <p className="text-[11px] text-muted-foreground">
                                Outcome lead ini (closing/gagal) masuk KPI <strong>{lead2.designerName}</strong> & CS — kerja tim.
                            </p>
                        )}
                    </div>

                    {/* Status quick change — tampil selama bukan Lost */}
                    {!isLost && (
                        <div className="flex gap-2 flex-wrap">
                            {(["NEW", "FOLLOW_UP", "NEGOTIATION"] as LeadStatus[]).map((s) => (
                                <button
                                    key={s}
                                    onClick={() => statusMut.mutate(s)}
                                    disabled={lead2.status === s || statusMut.isPending}
                                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                                        lead2.status === s
                                            ? "bg-primary text-primary-foreground shadow-sm"
                                            : "bg-muted text-muted-foreground hover:bg-accent"
                                    }`}
                                >
                                    → {LEAD_STATUS_LABEL[s]}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 flex-wrap pt-2 border-t">
                        {/* WA template — selalu tampil */}
                        <button
                            onClick={() => setShowTemplate(true)}
                            className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 flex items-center gap-1"
                        >
                            <MessageCircle className="h-4 w-4" /> Copy Template WA
                        </button>
                        {/* Closing — tampil selama bukan Lost */}
                        {!isLost && (
                            isWon && !isOwner ? (
                                <span className="px-3 py-2 bg-muted text-muted-foreground rounded-lg text-sm flex items-center gap-1 cursor-default" title="Sudah di-convert. Hanya owner yang bisa convert ulang.">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Sudah Di-convert
                                </span>
                            ) : (
                                <>
                                    {/* UTAMA: buat nota lewat kasir POS (model konsisten) */}
                                    <button
                                        onClick={() => buatNotaKasirMut.mutate()}
                                        disabled={buatNotaKasirMut.isPending}
                                        className="px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
                                        title="Buat customer + SO, lalu lanjut ke kasir POS untuk membuat nota"
                                    >
                                        <Receipt className="h-3.5 w-3.5" /> {buatNotaKasirMut.isPending ? "Menyiapkan…" : "Buat Nota di Kasir"}
                                    </button>
                                    {/* Convert Closing — buka modal convert (buat customer + SO/nota
                                        langsung & tandai lead closing). Tombol asli, dikembalikan. */}
                                    <button
                                        onClick={() => setShowConvert(true)}
                                        className="px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white"
                                        title="Convert lead jadi closing — buat customer + SO/nota langsung (tanpa lewat kasir)"
                                    >
                                        <CheckCircle2 className="h-4 w-4" />
                                        {isWon ? "Re-convert (Owner)" : "Convert Closing"}
                                    </button>
                                </>
                            )
                        )}
                        {/* Tautkan SO desainer (Alur B) — hanya kalau belum terminal */}
                        {!isWon && !isLost && !isInvalid && (
                            <button
                                onClick={() => setShowLinkSO(true)}
                                className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity flex items-center gap-1"
                                title="Customer sudah dibuatkan SO oleh desainer? Tautkan ke lead ini — tanpa bikin nota baru."
                            >
                                <Link2 className="h-4 w-4" /> {lead2.convertedSalesOrderId ? "Ganti SO Tertaut" : "Tautkan SO"}
                            </button>
                        )}
                        {/* Close Lost — hanya kalau belum terminal */}
                        {!isWon && !isLost && !isInvalid && (
                            <button
                                onClick={() => setShowCloseLost(true)}
                                className="px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 flex items-center gap-1"
                            >
                                <XCircle className="h-4 w-4" /> Close Lost
                            </button>
                        )}
                        {/* Tandai Invalid — hanya kalau belum terminal */}
                        {!isWon && !isLost && !isInvalid && (
                            <button
                                onClick={() => setShowMarkInvalid(true)}
                                className="px-3 py-2 bg-orange-500 text-white rounded-lg text-sm font-semibold hover:bg-orange-600 flex items-center gap-1"
                            >
                                <XCircle className="h-4 w-4" /> Invalid
                            </button>
                        )}
                        {/* Edit — selalu tampil */}
                        <button
                            onClick={() => onEdit(lead2)}
                            className="px-3 py-2 border border-border rounded-lg text-sm hover:bg-accent transition-colors"
                        >
                            Edit
                        </button>
                    </div>

                    {/* Activity timeline */}
                    <div className="pt-3 border-t">
                        <h3 className="font-bold text-base mb-3 flex items-center gap-1">
                            <Clock className="h-4 w-4" /> Aktivitas
                        </h3>

                        {!isLost && (
                            <div className="bg-muted rounded-lg p-3 mb-3 space-y-2">
                                <div className="flex gap-2">
                                    <select
                                        value={activityKind}
                                        onChange={(e) => setActivityKind(e.target.value)}
                                        className="bg-background border border-border rounded-lg px-2 py-1.5 text-xs"
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
                                        className="flex-1 bg-background border border-border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                                    />
                                </div>
                                <button
                                    onClick={() => addActivityMut.mutate()}
                                    disabled={!activityText.trim() || addActivityMut.isPending}
                                    className="px-3 py-1.5 bg-primary text-primary-foreground text-xs rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
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
                                <p className="text-sm text-muted-foreground text-center py-4">Belum ada aktivitas.</p>
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

                {/* Modals — di-portal ke body agar TIDAK terjebak containing-block
                    panel drawer (transform animate-in) → modal center di viewport. */}
                {typeof document !== 'undefined' && createPortal(<>
                {showConvert && (
                    <ConvertModal
                        lead={lead2}
                        onClose={() => setShowConvert(false)}
                        onSubmit={(data) => convertMut.mutate(data)}
                        submitting={convertMut.isPending}
                    />
                )}

                {showLinkSO && (
                    <LinkSOModal
                        lead={lead2}
                        onClose={() => setShowLinkSO(false)}
                        onSelect={(soId) => linkSOMut.mutate(soId)}
                        submitting={linkSOMut.isPending}
                    />
                )}

                {showPreNota && lead2.convertedSalesOrderId && (
                    <PreNotaModal
                        lead={lead2}
                        onClose={() => setShowPreNota(false)}
                        onSubmit={(data) => preNotaMut.mutate({ ...data, soId: lead2.convertedSalesOrderId! })}
                        submitting={preNotaMut.isPending}
                    />
                )}

                {showCloseLost && (
                    <div className="fixed inset-0 bg-background/25 backdrop-blur-md z-[300] flex items-center justify-center p-4">
                        <div className="bg-card rounded-2xl border border-border shadow-xl p-5 max-w-lg w-full max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
                            <div className="flex items-center gap-2.5 mb-2">
                                <div className="h-8 w-8 rounded-lg bg-red-500/10 text-red-600 dark:text-red-300 flex items-center justify-center">
                                    <XCircle className="h-4 w-4" />
                                </div>
                                <h3 className="font-bold text-lg">Tutup Lead (Lost)</h3>
                            </div>
                            <p className="text-sm text-muted-foreground mb-3">Kenapa lead ini gagal closing?</p>
                            <textarea
                                rows={3}
                                value={closeLostReason}
                                onChange={(e) => setCloseLostReason(e.target.value)}
                                placeholder="mis. Customer pilih kompetitor karena harga lebih murah"
                                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                            />

                            {/* Produk yang batal dipesan (opsional) — buat analisa lost */}
                            <div className="mb-3 pt-2 border-t border-dashed border-border">
                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Produk yang batal dipesan (opsional)</label>
                                <p className="text-[11px] text-muted-foreground mb-1.5">Isi kalau sudah tahu tadinya mau order apa — biar terdata "produk apa yang sering batal".</p>
                                <LeadItemsEditor items={lostItems} onChange={setLostItems} />
                                {lostItems.length > 0 && (
                                    <div className="text-right text-xs text-muted-foreground mt-1">
                                        Estimasi nilai lost: <strong className="text-foreground">Rp {lostItems.reduce((s, it) => s + calcItemSubtotal(it), 0).toLocaleString("id-ID", { maximumFractionDigits: 0 })}</strong>
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setShowCloseLost(false)} className="flex-1 px-4 py-2 border border-border rounded-lg text-sm hover:bg-accent transition-colors">Batal</button>
                                <button
                                    onClick={() => closeLostMut.mutate()}
                                    disabled={!closeLostReason.trim() || closeLostMut.isPending}
                                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
                                >
                                    {closeLostMut.isPending ? "..." : "Tutup Lost"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {showMarkInvalid && (
                    <div className="fixed inset-0 bg-background/25 backdrop-blur-md z-[300] flex items-center justify-center p-4">
                        <div className="bg-card rounded-2xl border border-border shadow-xl p-5 max-w-md w-full animate-in fade-in zoom-in-95 duration-200">
                            <div className="flex items-center gap-2.5 mb-2">
                                <div className="h-8 w-8 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-300 flex items-center justify-center">
                                    <AlertCircle className="h-4 w-4" />
                                </div>
                                <h3 className="font-bold text-lg text-orange-600 dark:text-orange-300">Tandai Lead Invalid</h3>
                            </div>
                            <p className="text-sm text-muted-foreground mb-3">
                                Lead ini tidak sesuai target iklan (mis. tanya jersey padahal iklan banner).
                                Akan dicatat sebagai <strong>Invalid</strong> di leaderboard CS.
                            </p>
                            <textarea
                                rows={3}
                                value={invalidReason}
                                onChange={(e) => setInvalidReason(e.target.value)}
                                placeholder="mis. Tanya harga jersey, iklan kami untuk banner (opsional)"
                                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                                autoFocus
                            />
                            <div className="flex gap-2">
                                <button onClick={() => setShowMarkInvalid(false)} className="flex-1 px-4 py-2 border border-border rounded-lg text-sm hover:bg-accent transition-colors">Batal</button>
                                <button
                                    onClick={() => markInvalidMut.mutate()}
                                    disabled={markInvalidMut.isPending}
                                    className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors disabled:opacity-50"
                                >
                                    {markInvalidMut.isPending ? "..." : "Tandai Invalid"}
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
                </>, document.body)}
            </div>
        </div>
    );
}

function Info({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <div className="text-[10px] font-semibold text-muted-foreground uppercase">{label}</div>
            <div className="text-sm text-foreground">{value}</div>
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
        INVALID: "🚫",
        FOLLOW_UP_DONE: "✔️",
        AFTER_SALES_SCHEDULED: "📦",
    };
    const txId = activity.kind === 'CONVERTED'
        ? (activity.meta as any)?.transactionId ?? null
        : null;

    return (
        <div className="border-l-2 border-indigo-500/30 pl-3 py-1">
            <div className="flex items-center justify-between gap-2 text-xs">
                <div className="font-semibold text-foreground">
                    {KIND_ICON[activity.kind] || "📌"} {activity.kind.replace(/_/g, " ")}
                </div>
                <span className="text-muted-foreground">{dayjs(activity.createdAt).format("DD MMM HH:mm")}</span>
            </div>
            {activity.text && <p className="text-sm text-foreground mt-1">{activity.text}</p>}
            {txId && (
                <a
                    href={`/transactions/${txId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-300 hover:underline underline-offset-2 mt-1"
                >
                    <Receipt className="h-3 w-3" /> Lihat Nota #{txId}
                </a>
            )}
            {activity.createdBy?.name && (
                <p className="text-[10px] text-muted-foreground mt-0.5">oleh {activity.createdBy.name}</p>
            )}
        </div>
    );
}

// ─── Link SO Modal (Alur B) ─────────────────────────────────────────────────
// Cari SO aktif (DRAFT/SENT) milik customer lalu tautkan ke lead — tanpa convert.

const SO_STATUS_BADGE: Record<string, string> = {
    DRAFT: "bg-muted text-muted-foreground",
    SENT: "bg-blue-500/10 text-blue-600 dark:text-blue-300",
};

/**
 * Modal pra-nota (Alur B): sebelum lanjut ke POS, CS wajib mengisi siapa CS
 * yang menangani & sumber lead sebenarnya — lead bikinan desainer hanya tahu
 * "SO Desainer", sumber asli cuma diketahui CS/admin. Setelah simpan, navigasi
 * ke POS di tab yang sama (bukan tab baru).
 */
function PreNotaModal({ lead, onClose, onSubmit, submitting }: {
    lead: Lead;
    onClose: () => void;
    onSubmit: (data: { assignedToId: number; source: LeadSource; sourceDetail: string | null }) => void;
    submitting: boolean;
}) {
    // source=OTHER + detail 'SO Desainer' adalah placeholder dari Lead Order —
    // kosongkan supaya CS dipaksa memilih sumber sebenarnya
    const isPlaceholderSource = lead.source === "OTHER"
        && (lead.sourceDetail || "").toLowerCase().includes("so desainer");
    const [assignedToId, setAssignedToId] = useState<string>(lead.assignedToId ? String(lead.assignedToId) : "");
    const [source, setSource] = useState<string>(isPlaceholderSource ? "" : lead.source);
    const [sourceDetail, setSourceDetail] = useState<string>(isPlaceholderSource ? "" : (lead.sourceDetail || ""));

    const { data: users } = useQuery({
        queryKey: ["users-for-cs-assign"],
        queryFn: async () => (await api.get("/users")).data as { id: number; name: string | null; email: string }[],
        staleTime: 5 * 60_000,
    });

    const canSubmit = !!assignedToId && !!source && (source !== "CUSTOM" || sourceDetail.trim().length > 0);

    return (
        <div className="fixed inset-0 bg-background/25 backdrop-blur-md z-[300] flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-card rounded-2xl border border-border shadow-xl p-5 max-w-md w-full animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-2.5 mb-1">
                    <div className="h-8 w-8 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 flex items-center justify-center">
                        <Tag className="h-4 w-4" />
                    </div>
                    <h3 className="font-bold text-lg">Lengkapi Data Lead</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                    Sebelum buat nota di POS, isi dulu CS yang menangani & sumber lead — penting untuk KPI CS & laporan CRM.
                </p>
                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-semibold text-muted-foreground mb-1">
                            CS yang menangani <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={assignedToId}
                            onChange={(e) => setAssignedToId(e.target.value)}
                            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                        >
                            <option value="">— pilih CS / admin —</option>
                            {(users || []).map((u) => (
                                <option key={u.id} value={u.id}>{u.name || u.email}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-muted-foreground mb-1">
                            Sumber lead <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={source}
                            onChange={(e) => setSource(e.target.value)}
                            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                        >
                            <option value="">— customer ini tahu dari mana? —</option>
                            {SOURCE_OPTIONS.map((s) => (
                                <option key={s} value={s}>
                                    {s === "CUSTOM" ? "Lainnya (isi sendiri)" : LEAD_SOURCE_LABEL[s]}
                                </option>
                            ))}
                        </select>
                    </div>
                    {source === "CUSTOM" && (
                        <input
                            value={sourceDetail}
                            onChange={(e) => setSourceDetail(e.target.value)}
                            placeholder="Tulis sumber lead, mis. pameran, rekomendasi toko"
                            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                        />
                    )}
                </div>
                <div className="flex gap-2 mt-4">
                    <button onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-lg text-sm hover:bg-accent transition-colors">Batal</button>
                    <button
                        onClick={() => onSubmit({
                            assignedToId: Number(assignedToId),
                            source: source as LeadSource,
                            sourceDetail: source === "CUSTOM" ? sourceDetail.trim() : (sourceDetail.trim() || null),
                        })}
                        disabled={!canSubmit || submitting}
                        className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                        {submitting ? "Menyimpan..." : "Simpan & Buat Nota →"}
                    </button>
                </div>
            </div>
        </div>
    );
}

function LinkSOModal({
    lead, onClose, onSelect, submitting,
}: {
    lead: Lead;
    onClose: () => void;
    onSelect: (soId: number) => void;
    submitting: boolean;
}) {
    const [q, setQ] = useState(lead.phone || lead.name || "");
    const [debouncedQ, setDebouncedQ] = useState(q);

    useEffect(() => {
        const t = setTimeout(() => setDebouncedQ(q), 350);
        return () => clearTimeout(t);
    }, [q]);

    const { data: hits, isFetching } = useQuery({
        queryKey: ["so-active-by-customer", debouncedQ],
        queryFn: () => findActiveSOByCustomer(debouncedQ),
        enabled: debouncedQ.trim().length >= 2,
        staleTime: 30_000,
    });

    return (
        <div className="fixed inset-0 bg-background/25 backdrop-blur-md z-[300] flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-card rounded-2xl border border-border shadow-xl p-5 max-w-md w-full max-h-[85vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
                <h3 className="font-bold text-lg mb-1 flex items-center gap-2.5">
                    <span className="h-8 w-8 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 flex items-center justify-center">
                        <Link2 className="h-4 w-4" />
                    </span>
                    Tautkan ke Sales Order
                </h3>
                <p className="text-sm text-muted-foreground mb-3">
                    Customer ini sudah dibuatkan SO oleh desainer? Tautkan ke lead — <strong>tanpa bikin nota baru</strong>.
                    Saat SO itu di-checkout di POS, lead otomatis closing ke nota yang sama.
                </p>
                <div className="relative mb-3">
                    <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                        type="text"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Cari nama / nomor HP customer..."
                        className="w-full bg-background border border-border rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                        autoFocus
                    />
                </div>

                {isFetching && <p className="text-xs text-muted-foreground text-center py-3">Mencari SO aktif...</p>}
                {!isFetching && debouncedQ.trim().length >= 2 && (hits ?? []).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                        Tidak ada SO aktif (Draft/Terkirim) yang cocok. SO yang sudah jadi nota atau dibatalkan tidak muncul di sini.
                    </p>
                )}

                <div className="space-y-2">
                    {(hits ?? []).map((so) => (
                        <button
                            key={so.id}
                            onClick={() => onSelect(so.id)}
                            disabled={submitting}
                            className={`w-full text-left border rounded-xl p-3 transition-[box-shadow,border-color] hover:shadow-md hover:border-primary/40 disabled:opacity-50 ${lead.convertedSalesOrderId === so.id ? "border-primary/40 bg-primary/5" : "border-border bg-card"}`}
                        >
                            <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-sm text-indigo-600 dark:text-indigo-300">{so.soNumber}</span>
                                <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${SO_STATUS_BADGE[so.status] || "bg-muted text-muted-foreground"}`}>
                                    {so.status === "SENT" ? "TERKIRIM" : so.status}
                                </span>
                            </div>
                            <div className="text-sm text-foreground mt-0.5">
                                {so.customerName}{so.customerPhone ? ` · ${so.customerPhone}` : ""}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                                Desainer: {so.designerName} · {dayjs(so.createdAt).format("DD MMM YYYY, HH:mm")}
                                {lead.convertedSalesOrderId === so.id && <span className="text-primary font-semibold"> · tertaut saat ini</span>}
                            </div>
                        </button>
                    ))}
                </div>

                <div className="flex justify-end mt-4">
                    <button onClick={onClose} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted">
                        Tutup
                    </button>
                </div>
            </div>
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
    const [notes, setNotes] = useState(lead.needs ?? "");
    const [designerName, setDesignerName] = useState(lead.designerName ?? "");
    const [isExpress, setIsExpress] = useState(false);

    // ── Customer picker (when createCustomer=false) ──────────────────────
    const [existingCustomerId, setExistingCustomerId] = useState<number | null>(null);
    const [existingCustomerName, setExistingCustomerName] = useState<string>("");
    const [customerSearchPhone, setCustomerSearchPhone] = useState(lead.phone ?? "");
    const [customerMatches, setCustomerMatches] = useState<CustomerLookupResult[]>([]);
    const [customerSearching, setCustomerSearching] = useState(false);

    useEffect(() => {
        if (createCustomer) { setExistingCustomerId(null); setExistingCustomerName(""); return; }
        if (!customerSearchPhone || customerSearchPhone.replace(/\D/g, "").length < 4) return;
        const t = setTimeout(async () => {
            setCustomerSearching(true);
            try { setCustomerMatches(await lookupCustomerByPhone(customerSearchPhone)); }
            catch { setCustomerMatches([]); }
            finally { setCustomerSearching(false); }
        }, 400);
        return () => clearTimeout(t);
    }, [createCustomer, customerSearchPhone]);

    // Produk order — bisa diedit di sini (lead bisa dibuat tanpa produk dulu)
    const [convItems, setConvItems] = useState<LeadItem[]>(lead.items ?? []);
    const totalItems = convItems.length;
    const itemsWithVariant = convItems.filter(it => it.productVariantId);
    const itemsCustom = convItems.filter(it => !it.productVariantId);

    // ── Payment state ───────────────────────────────────────────────────────
    const [paymentMode, setPaymentMode] = useState<'NONE' | 'DP' | 'LUNAS'>('NONE');
    const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'TRANSFER' | 'QRIS'>('CASH');
    const [paymentAmount, setPaymentAmount] = useState<string>("");
    const [bankAccountId, setBankAccountId] = useState<string>("");
    const [marketplaceFee, setMarketplaceFee] = useState<string>("");

    // Estimasi total dari item order (yang sedang diedit).
    // Pakai helper bersama calcItemSubtotal supaya konsisten dgn subtotal lead &
    // menghormati unitType (m / cm / menit) — sebelumnya selalu /10000 (asumsi cm).
    const itemsEstimate = useMemo(() => {
        return convItems.reduce((sum, it) => sum + Math.round(calcItemSubtotal(it)), 0);
    }, [convItems]);

    // Designers list untuk picker
    const { data: designers } = useQuery({
        queryKey: ['designers-list'],
        queryFn: async () => (await api.get('/designers')).data as { id: number; name: string; isActive: boolean }[],
        staleTime: 5 * 60_000,
    });
    const activeDesigners = (designers || []).filter(d => d.isActive);

    // Bank accounts hanya di-load kalau TRANSFER dipilih
    const { data: bankAccounts } = useQuery({
        queryKey: ['bank-accounts'],
        queryFn: async () => (await import('@/lib/api/transactions')).getBankAccounts(),
        enabled: paymentMethod === 'TRANSFER' && paymentMode !== 'NONE',
        staleTime: 5 * 60_000,
    });

    const needsBankAccount = paymentMode !== 'NONE' && paymentMethod === 'TRANSFER';
    const dpInvalid = paymentMode === 'DP' && (!paymentAmount || Number(paymentAmount) <= 0);
    const bankInvalid = needsBankAccount && !bankAccountId;
    const paymentInvalid = dpInvalid || bankInvalid;

    // Peringatan cegah nota dobel: cek SO aktif (DRAFT/SENT) milik customer ini.
    // Kalau ada, sebaiknya nota dibuat dari SO itu di POS (atau lead ditautkan via Alur B).
    const soQuery = (lead.phone || lead.name || "").trim();
    const { data: activeSOs } = useQuery({
        queryKey: ["so-active-by-customer", soQuery],
        queryFn: () => findActiveSOByCustomer(soQuery),
        enabled: soQuery.length >= 2,
        staleTime: 30_000,
    });

    return (
        <div className="fixed inset-0 bg-background/25 backdrop-blur-md z-[300] flex items-center justify-center p-4">
            <div className="bg-card rounded-2xl border border-border shadow-xl p-5 max-w-md w-full max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center gap-2.5 mb-2">
                    <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 flex items-center justify-center">
                        <CheckCircle2 className="h-4 w-4" />
                    </div>
                    <h3 className="font-bold text-lg">Buat Nota & Masuk Produksi</h3>
                </div>
                {lead.status === 'CLOSED_WON' && (
                    <div className="mb-3 px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-700 dark:text-amber-300 font-medium">
                        Peringatan: lead ini sudah pernah di-convert. Re-convert akan membuat nota & job baru lagi.
                    </div>
                )}
                {lead.convertedSalesOrderId ? (
                    <div className="mb-3 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-700 dark:text-red-300 font-medium">
                        ⚠ Lead ini <strong>sudah ditautkan ke SO desainer</strong>. Nota sebaiknya dibuat dari SO itu di POS
                        (lead otomatis closing). Convert di sini akan membuat <strong>nota dobel</strong>.
                    </div>
                ) : (activeSOs ?? []).length > 0 && (
                    <div className="mb-3 px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-700 dark:text-amber-300">
                        <div className="font-semibold mb-1">⚠ Customer ini punya SO desainer yang masih aktif:</div>
                        <ul className="space-y-0.5 mb-1">
                            {(activeSOs ?? []).slice(0, 3).map(so => (
                                <li key={so.id}>• <strong>{so.soNumber}</strong> ({so.status === 'SENT' ? 'Terkirim' : 'Draft'}) — {so.customerName}, desainer {so.designerName}</li>
                            ))}
                        </ul>
                        Kalau order-nya sama, <strong>jangan convert</strong> — tutup modal ini lalu pakai tombol <strong>Tautkan SO</strong> (nota dibuat dari SO di POS, tanpa dobel).
                    </div>
                )}
                <p className="text-sm text-muted-foreground mb-4">
                    Tutup lead sebagai closing. Sistem otomatis bikin
                    <strong className="text-foreground"> Nota</strong> (masuk DP/Piutang sesuai pembayaran) dan
                    <strong className="text-foreground"> antrian produksi</strong> untuk semua item.
                </p>

                <div className="space-y-3">
                    {/* 1. Customer */}
                    <label className="flex items-start gap-2 text-sm cursor-pointer p-3 border border-border rounded-xl hover:bg-accent transition-colors">
                        <input
                            type="checkbox"
                            checked={createCustomer}
                            onChange={(e) => setCreateCustomer(e.target.checked)}
                            className="mt-1"
                        />
                        <div>
                            <div className="font-semibold">👤 Buat Customer Baru</div>
                            <div className="text-xs text-muted-foreground">
                                Data dari lead: <strong>{lead.name}</strong>
                                {lead.phone && ` · ${lead.phone}`}
                                <br />
                                <span className="text-muted-foreground">Kalau customer sudah ada, jangan centang — hindari duplikat.</span>
                            </div>
                        </div>
                    </label>

                    {/* Customer picker — tampil kalau createCustomer=false */}
                    {!createCustomer && (
                        <div className="border rounded-xl p-3 bg-amber-500/10 border-amber-500/20 space-y-2">
                            <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">Pilih Customer Existing</p>
                            {existingCustomerId ? (
                                <div className="flex items-center justify-between bg-card rounded-lg px-3 py-2 border border-emerald-500/30">
                                    <span className="text-sm font-medium text-emerald-600 dark:text-emerald-300 flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 shrink-0" /> {existingCustomerName}</span>
                                    <button
                                        type="button"
                                        onClick={() => { setExistingCustomerId(null); setExistingCustomerName(""); }}
                                        className="text-xs text-muted-foreground hover:text-red-500 ml-2"
                                    >Ganti</button>
                                </div>
                            ) : (
                                <>
                                    <input
                                        type="text"
                                        placeholder="Cari nomor HP..."
                                        value={customerSearchPhone}
                                        onChange={(e) => setCustomerSearchPhone(e.target.value)}
                                        className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                                    />
                                    {customerSearching && <p className="text-xs text-muted-foreground">Mencari...</p>}
                                    {!customerSearching && customerMatches.length === 0 && customerSearchPhone.replace(/\D/g, "").length >= 4 && (
                                        <p className="text-xs text-red-600 dark:text-red-300">Customer tidak ditemukan. Centang "Buat Customer Baru" atau cari HP lain.</p>
                                    )}
                                    {customerMatches.map(c => (
                                        <button
                                            key={c.id}
                                            type="button"
                                            onClick={() => { setExistingCustomerId(c.id); setExistingCustomerName(c.name); setCustomerMatches([]); }}
                                            className="w-full text-left px-3 py-2 rounded-lg border border-border bg-card hover:border-primary/40 hover:bg-primary/5 transition-colors text-sm"
                                        >
                                            <span className="font-medium">{c.name}</span>
                                            {c.phone && <span className="text-muted-foreground text-xs ml-2">{c.phone}</span>}
                                        </button>
                                    ))}
                                </>
                            )}
                        </div>
                    )}

                    {/* 2. Nota + Pipeline info */}
                    <div className={`flex items-start gap-2 text-sm p-3 rounded-xl border ${totalItems > 0 ? 'border-violet-500/20 bg-violet-500/10' : 'border-border bg-muted'}`}>
                        <span className="text-base leading-none mt-0.5">🧾🏭</span>
                        <div className="flex-1">
                            <div className="font-semibold">
                                Nota + Antrian Produksi
                                <span className="text-[10px] text-violet-600 dark:text-violet-300 font-normal"> (otomatis)</span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                                {totalItems > 0 ? (
                                    <>
                                        {totalItems} item
                                        {itemsWithVariant.length > 0 && ` (${itemsWithVariant.length} katalog`}
                                        {itemsCustom.length > 0 && itemsWithVariant.length > 0 && ` + ${itemsCustom.length} custom)`}
                                        {itemsCustom.length > 0 && itemsWithVariant.length === 0 && ` (${itemsCustom.length} custom)`}
                                        {itemsWithVariant.length > 0 && itemsCustom.length === 0 && ')'}
                                        {' '}→ Nota dibuat + job di-spawn ke <code>/produksi</code>.
                                    </>
                                ) : (
                                    <span className="text-amber-600">Belum ada produk. Pilih di bawah ini supaya masuk Nota &amp; pipeline produksi.</span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 2b. Produk order — bisa input di sini kalau lead dibuat tanpa produk */}
                    <div>
                        <label className="block text-xs font-semibold text-muted-foreground mb-1">Produk yang diorder</label>
                        <LeadItemsEditor items={convItems} onChange={setConvItems} />
                        {convItems.length > 0 && (
                            <div className="text-right text-xs text-muted-foreground mt-1">
                                Estimasi: <strong className="text-foreground">Rp {itemsEstimate.toLocaleString("id-ID")}</strong>
                            </div>
                        )}
                    </div>

                    {/* 3. Catatan */}
                    <div>
                        <label className="block text-xs font-semibold text-muted-foreground mb-1">Catatan (di-pass ke Nota & job produksi)</label>
                        <textarea
                            rows={2}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                            placeholder="Detail kebutuhan, deadline, syarat khusus..."
                        />
                    </div>

                    {/* 4. Desainer */}
                    <div>
                        <label className="block text-xs font-semibold text-muted-foreground mb-1">
                            Desainer yang Mengerjakan <span className="font-normal text-muted-foreground">(opsional)</span>
                        </label>
                        {activeDesigners.length > 0 ? (
                            <select
                                value={designerName}
                                onChange={(e) => setDesignerName(e.target.value)}
                                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                            >
                                <option value="">— Belum ditentukan —</option>
                                {activeDesigners.map(d => (
                                    <option key={d.id} value={d.name}>{d.name}</option>
                                ))}
                            </select>
                        ) : (
                            <input
                                type="text"
                                value={designerName}
                                onChange={(e) => setDesignerName(e.target.value)}
                                placeholder="Nama desainer..."
                                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                            />
                        )}
                    </div>

                    {/* 5. Express order */}
                    <button
                        type="button"
                        onClick={() => setIsExpress(v => !v)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors text-left ${
                            isExpress
                                ? "border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-300"
                                : "border-border bg-card text-muted-foreground hover:border-orange-500/40"
                        }`}
                    >
                        <span className={`text-lg ${isExpress ? "" : "grayscale opacity-50"}`}>⚡</span>
                        <div>
                            <div className="text-sm font-semibold">Order Express</div>
                            <div className="text-[11px] opacity-70">Tandai sebagai order yang harus didahulukan di pipeline desain</div>
                        </div>
                        <div className={`ml-auto w-9 h-5 rounded-full flex items-center transition-colors ${isExpress ? "bg-orange-400" : "bg-muted-foreground/30"}`}>
                            <div className={`w-4 h-4 rounded-full bg-card shadow transition-transform mx-0.5 ${isExpress ? "translate-x-4" : "translate-x-0"}`} />
                        </div>
                    </button>

                    {/* 6. Pembayaran */}
                    <div className="border border-blue-500/20 bg-blue-500/10 rounded-xl p-3 space-y-3">
                        <div>
                            <div className="font-semibold text-sm mb-0.5">💳 Pembayaran</div>
                            {itemsEstimate > 0 && (
                                <div className="text-[11px] text-muted-foreground">
                                    Estimasi total: <strong>Rp {itemsEstimate.toLocaleString("id-ID")}</strong>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-3 gap-1.5">
                            {(['NONE', 'DP', 'LUNAS'] as const).map((mode) => {
                                const label = mode === 'NONE' ? 'Bayar Nanti' : mode === 'DP' ? 'DP / Uang Muka' : 'Lunas';
                                const active = paymentMode === mode;
                                return (
                                    <button
                                        key={mode}
                                        type="button"
                                        onClick={() => setPaymentMode(mode)}
                                        className={`px-2 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${active ? 'border-blue-500/40 bg-blue-500/15 text-blue-600 dark:text-blue-300' : 'border-border bg-card text-muted-foreground hover:bg-accent'}`}
                                    >
                                        {label}
                                    </button>
                                );
                            })}
                        </div>

                        {paymentMode === 'NONE' && (
                            <p className="text-[11px] text-muted-foreground italic">
                                Nota status <strong>PENDING</strong> — masuk ke daftar Piutang/DP. Bisa dilunasi nanti dari halaman Transaksi.
                            </p>
                        )}

                        {paymentMode !== 'NONE' && (
                            <>
                                <div>
                                    <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Metode Pembayaran</label>
                                    <div className="grid grid-cols-3 gap-1.5">
                                        {(['CASH', 'TRANSFER', 'QRIS'] as const).map((m) => {
                                            const active = paymentMethod === m;
                                            return (
                                                <button
                                                    key={m}
                                                    type="button"
                                                    onClick={() => setPaymentMethod(m)}
                                                    className={`px-2 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${active ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-300' : 'border-border bg-card text-muted-foreground hover:bg-accent'}`}
                                                >
                                                    {m === 'CASH' ? '💵 Cash' : m === 'TRANSFER' ? '🏦 Transfer' : '📱 QRIS'}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {paymentMode === 'DP' && (
                                    <div>
                                        <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Nominal DP (Rp)</label>
                                        <input
                                            type="number"
                                            min={0}
                                            value={paymentAmount}
                                            onChange={(e) => setPaymentAmount(e.target.value)}
                                            placeholder="mis. 500000"
                                            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                                        />
                                        {dpInvalid && (
                                            <p className="text-[10px] text-red-600 mt-0.5">Nominal DP wajib diisi (&gt; 0).</p>
                                        )}
                                    </div>
                                )}

                                {paymentMode === 'LUNAS' && itemsEstimate > 0 && (
                                    <p className="text-[11px] text-emerald-600 dark:text-emerald-300 bg-emerald-500/10 rounded p-1.5">
                                        Dibayar lunas <strong>Rp {itemsEstimate.toLocaleString("id-ID")}</strong>. Nota langsung PAID, cashflow INCOME tercatat otomatis.
                                    </p>
                                )}
                                {paymentMode === 'LUNAS' && itemsEstimate === 0 && (
                                    <p className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded p-1.5">
                                        ⚠ Estimasi total Rp 0 — pastikan harga item sudah diisi. Nota akan PAID tapi <strong>tidak ada cashflow</strong> yang tercatat karena grandTotal = 0.
                                    </p>
                                )}

                                {/* Potongan marketplace — muncul saat LUNAS */}
                                {paymentMode === 'LUNAS' && (
                                    <div>
                                        <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                                            Potongan Marketplace (Rp) <span className="text-muted-foreground font-normal">— mis. fee Shopee, Tokopedia</span>
                                        </label>
                                        <input
                                            type="number"
                                            min={0}
                                            value={marketplaceFee}
                                            onChange={(e) => setMarketplaceFee(e.target.value)}
                                            placeholder="0 (kosongkan jika tidak ada)"
                                            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                                        />
                                        {Number(marketplaceFee) > 0 && itemsEstimate > 0 && (
                                            <p className="text-[10px] text-emerald-600 dark:text-emerald-300 mt-0.5">
                                                Diterima (nett): <strong>Rp {Math.max(0, itemsEstimate - Number(marketplaceFee)).toLocaleString("id-ID")}</strong>
                                                {" "}· Cashflow: INCOME {itemsEstimate.toLocaleString("id-ID")} + EXPENSE {Number(marketplaceFee).toLocaleString("id-ID")} (Biaya Platform)
                                            </p>
                                        )}
                                    </div>
                                )}

                                {needsBankAccount && (
                                    <div>
                                        <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Rekening Tujuan *</label>
                                        <select
                                            value={bankAccountId}
                                            onChange={(e) => setBankAccountId(e.target.value)}
                                            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                                        >
                                            <option value="">— Pilih rekening —</option>
                                            {(bankAccounts as any[] | undefined)?.map((acc: any) => (
                                                <option key={acc.id} value={acc.id}>
                                                    {acc.bankName} · {acc.accountNumber} ({acc.accountHolder})
                                                </option>
                                            ))}
                                        </select>
                                        {bankInvalid && (
                                            <p className="text-[10px] text-red-600 mt-0.5">Pilih rekening tujuan untuk transfer.</p>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>

                <div className="flex gap-2 mt-5">
                    <button onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-lg text-sm hover:bg-accent transition-colors">Batal</button>
                    <button
                        onClick={() => onSubmit({
                            items: convItems,
                            createCustomer,
                            customerId: !createCustomer && existingCustomerId ? existingCustomerId : undefined,
                            createSalesOrderDraft: false,
                            createInvoiceDraft: false,
                            notes: notes || undefined,
                            designerName: designerName || undefined,
                            isExpress: isExpress || undefined,
                            createProductionTransaction: true,
                            paymentMode,
                            paymentMethod: paymentMode !== 'NONE' ? paymentMethod : undefined,
                            paymentAmount: paymentMode === 'DP' ? Number(paymentAmount) || 0 : undefined,
                            bankAccountId: needsBankAccount && bankAccountId ? Number(bankAccountId) : undefined,
                            marketplaceFee: paymentMode === 'LUNAS' && Number(marketplaceFee) > 0 ? Number(marketplaceFee) : undefined,
                        })}
                        disabled={submitting || paymentInvalid || (!createCustomer && !existingCustomerId)}
                        className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50"
                    >
                        {submitting ? "Memproses..." : "✓ Buat Nota & Masuk Produksi"}
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
        <div className="fixed inset-0 bg-background/25 backdrop-blur-md z-[300] flex items-center justify-center p-4">
            <div className="bg-card rounded-2xl border border-border shadow-xl p-5 max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-lg bg-green-500/10 text-green-600 dark:text-green-300 flex items-center justify-center">
                            <MessageCircle className="h-4 w-4" />
                        </div>
                        <h3 className="font-bold text-lg">Pilih Template WA</h3>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-accent rounded-lg transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                    {(templates ?? []).map((t) => (
                        <button
                            key={t.id}
                            onClick={() => handlePick(t)}
                            className={`text-left p-3 border rounded-xl transition-[box-shadow,border-color] hover:shadow-md hover:border-primary/40 ${
                                selectedId === t.id ? "border-primary/50 bg-primary/5" : "border-border bg-card"
                            }`}
                        >
                            <div className="text-xs text-indigo-600 dark:text-indigo-300 font-semibold">{t.category}</div>
                            <div className="font-semibold text-sm">{t.name}</div>
                        </button>
                    ))}
                    {(!templates || templates.length === 0) && (
                        <div className="col-span-2 text-sm text-muted-foreground p-4 text-center border border-border rounded-xl">
                            Belum ada template. Buat di <a href="/crm/templates" className="text-indigo-600 dark:text-indigo-300 underline">/crm/templates</a> dulu.
                        </div>
                    )}
                </div>

                {selectedId && (
                    <div>
                        <div className="text-xs font-semibold text-muted-foreground mb-1">Preview</div>
                        {loadingRender ? (
                            <div className="bg-muted rounded p-3 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin inline" /> Rendering...
                            </div>
                        ) : (
                            <textarea
                                rows={8}
                                value={rendered}
                                onChange={(e) => setRendered(e.target.value)}
                                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                            />
                        )}
                        <div className="flex gap-2 mt-3">
                            <button
                                onClick={handleCopy}
                                className={`flex-1 px-4 py-2 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-colors ${
                                    copied ? "bg-emerald-600 text-white" : "bg-primary text-primary-foreground hover:opacity-90"
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
