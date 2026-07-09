"use client";

import { memo, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
    DndContext, DragEndEvent, DragOverlay, DragStartEvent,
    PointerSensor, TouchSensor, useSensor, useSensors,
    rectIntersection, MeasuringStrategy,
    useDroppable, useDraggable,
} from "@dnd-kit/core";
import {
    type Lead, type LeadStatus, type LeadLevel,
    LEAD_SOURCE_LABEL, LEAD_LEVEL_LABEL,
} from "@/lib/api";
import { LeadImageCarousel } from "@/components/crm/LeadImageCarousel";
import { Phone, Calendar, MapPin, GripVertical } from "lucide-react";
import dayjs from "dayjs";

const COLUMNS: { id: LeadStatus; label: string; color: string; bg: string }[] = [
    { id: "NEW",          label: "Baru",      color: "text-blue-600 dark:text-blue-300",       bg: "bg-blue-500/10 border-blue-500/20" },
    { id: "FOLLOW_UP",    label: "Follow Up", color: "text-amber-600 dark:text-amber-300",     bg: "bg-amber-500/10 border-amber-500/20" },
    { id: "NEGOTIATION",  label: "Negosiasi", color: "text-violet-600 dark:text-violet-300",   bg: "bg-violet-500/10 border-violet-500/20" },
    { id: "CLOSED_WON",   label: "Closing ✓", color: "text-emerald-600 dark:text-emerald-300", bg: "bg-emerald-500/10 border-emerald-500/20" },
    { id: "CLOSED_LOST",  label: "Lost ✗",    color: "text-red-600 dark:text-red-300",         bg: "bg-red-500/10 border-red-500/20" },
];

const levelColor: Record<LeadLevel, string> = {
    HOT: "bg-red-500/10 text-red-600 dark:text-red-300 border-red-500/20",
    WARM: "bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/20",
    COLD: "bg-sky-500/10 text-sky-600 dark:text-sky-300 border-sky-500/20",
};

interface Props {
    leads: Lead[];
    onCardClick: (lead: Lead) => void;
    onStatusChange: (leadId: number, newStatus: LeadStatus) => void;
}

export function LeadKanbanBoard({ leads, onCardClick, onStatusChange }: Props) {
    const [activeId, setActiveId] = useState<number | null>(null);
    // Portal overlay hanya di-mount di client (butuh document.body).
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    // Sama persis dengan pipeline produksi (drag-drop yang mulus):
    // - PointerSensor distance 8 → tap = buka detail, geser 8px = drag
    // - TouchSensor delay 200ms → di HP, tahan dulu baru drag (scroll tetap jalan)
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    );

    const grouped = useMemo(() => {
        const g: Record<LeadStatus, Lead[]> = {
            NEW: [], FOLLOW_UP: [], NEGOTIATION: [], CLOSED_WON: [], CLOSED_LOST: [], INVALID: [],
        };
        for (const l of leads) g[l.status]?.push(l);
        return g;
    }, [leads]);

    const activeLead = activeId != null ? leads.find((l) => l.id === activeId) ?? null : null;

    const handleDragStart = (e: DragStartEvent) => {
        setActiveId(Number(e.active.id));
    };

    const handleDragEnd = (e: DragEndEvent) => {
        setActiveId(null);
        if (!e.over) return;
        const leadId = Number(e.active.id);
        const newStatus = e.over.id as LeadStatus;
        const lead = leads.find((l) => l.id === leadId);
        if (!lead || lead.status === newStatus) return;
        onStatusChange(leadId, newStatus);
    };

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={rectIntersection}
            measuring={{ droppable: { strategy: MeasuringStrategy.BeforeDragging } }}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveId(null)}
        >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {COLUMNS.map((col) => (
                    <Column
                        key={col.id}
                        id={col.id}
                        label={col.label}
                        color={col.color}
                        bg={col.bg}
                        leads={grouped[col.id]}
                        activeId={activeId}
                        onCardClick={onCardClick}
                    />
                ))}
            </div>
            {/* Overlay di-PORTAL ke <body> supaya position:fixed-nya mengacu ke
                viewport, lepas dari ancestor ber-transform/animate-in yang bikin
                overlay meleset dari kursor. React context tetap tembus lewat portal
                → DragOverlay masih terhubung ke DndContext. Ukuran = kartu asli
                (dnd-kit menyamakan ke node aktif) → tepat di bawah kursor. */}
            {mounted && createPortal(
                <DragOverlay dropAnimation={null}>
                    {activeLead && (
                        <div className="rotate-2 cursor-grabbing" style={{ willChange: "transform", transform: "translateZ(0)" }}>
                            <KanbanCardView lead={activeLead} onClick={() => {}} overlay />
                        </div>
                    )}
                </DragOverlay>,
                document.body,
            )}
        </DndContext>
    );
}

const Column = memo(function Column({
    id, label, color, bg, leads, activeId, onCardClick,
}: {
    id: LeadStatus;
    label: string;
    color: string;
    bg: string;
    leads: Lead[];
    activeId: number | null;
    onCardClick: (lead: Lead) => void;
}) {
    const { setNodeRef, isOver } = useDroppable({ id });
    return (
        <div
            ref={setNodeRef}
            className={`rounded-xl border-2 ${bg} ${isOver ? "ring-2 ring-primary" : ""} min-h-[400px] flex flex-col`}
        >
            <div className={`px-3 py-2 border-b border-border/60 font-bold text-sm ${color} flex items-center justify-between sticky top-0 bg-inherit z-10`}>
                <span>{label}</span>
                <span className="text-xs bg-card/60 px-2 py-0.5 rounded-full">{leads.length}</span>
            </div>
            <div className="p-2 space-y-2 flex-1 overflow-y-auto max-h-[70vh]">
                {leads.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-6">Drag lead ke sini</p>
                ) : (
                    leads.map((lead) => (
                        <KanbanCard
                            key={lead.id}
                            lead={lead}
                            isActive={activeId === lead.id}
                            onClick={() => onCardClick(lead)}
                        />
                    ))
                )}
            </div>
        </div>
    );
});

// Wrapper draggable tipis. Sama seperti pipeline: SELURUH kartu jadi drag source
// (bukan cuma grip). useDraggable subscribe ke DnD context → re-render tiap
// pointer move; tapi render-nya cuma <div>, murah. Konten berat (KanbanCardView)
// di-memo terpisah → tidak re-render selama drag. touchAction:none supaya di HP
// tidak scroll saat drag.
const KanbanCard = memo(function KanbanCard({ lead, isActive, onClick }: { lead: Lead; isActive: boolean; onClick: () => void }) {
    const { attributes, listeners, setNodeRef } = useDraggable({ id: String(lead.id) });
    return (
        <div ref={setNodeRef} {...attributes} {...listeners} style={{ touchAction: "none" }}>
            <KanbanCardView lead={lead} onClick={onClick} isDragging={isActive} />
        </div>
    );
});

// Tampilan penuh kartu (memoized, tanpa hook dnd) — tidak re-render selama drag.
const KanbanCardView = memo(function KanbanCardView({
    lead, onClick, isDragging, overlay,
}: {
    lead: Lead;
    onClick: () => void;
    isDragging?: boolean;
    overlay?: boolean;
}) {
    const hasImage = (lead.images && lead.images.length > 0) || !!lead.imageUrl;

    return (
        <div
            className={`bg-card border rounded-lg overflow-hidden transition-[box-shadow,border-color] cursor-grab active:cursor-grabbing ${
                overlay ? "border-primary shadow-2xl" : "border-border shadow-sm"
            } ${isDragging ? "opacity-30" : "hover:shadow-md"}`}
        >
            {/* Banner with carousel (kalau multi-image) */}
            <LeadImageCarousel
                images={lead.images || []}
                fallbackUrl={lead.imageUrl}
                alt={lead.name}
                heightClass="h-32"
                onClick={onClick}
                overlay={
                    <span className={`absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded border whitespace-nowrap shadow-sm z-10 ${levelColor[lead.level]}`}>
                        {LEAD_LEVEL_LABEL[lead.level]}
                    </span>
                }
            />

            <div className="flex items-start gap-2 p-3">
                <GripVertical className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden />
                <div className="flex-1 min-w-0" onClick={onClick} role="button" tabIndex={0}>
                    {!hasImage && (
                        <div className="flex items-center justify-between gap-2 mb-1">
                            <div className="font-semibold text-sm text-foreground truncate">{lead.name}</div>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded border whitespace-nowrap ${levelColor[lead.level]}`}>
                                {LEAD_LEVEL_LABEL[lead.level].replace(/^\S+\s/, "")}
                            </span>
                        </div>
                    )}
                    {hasImage && (
                        <div className="font-semibold text-sm text-foreground truncate mb-1">{lead.name}</div>
                    )}
                    <div className="space-y-0.5 text-[11px] text-muted-foreground">
                        {lead.phone && (
                            <div className="flex items-center gap-1">
                                <Phone className="h-2.5 w-2.5" /> {lead.phone}
                            </div>
                        )}
                        <div className="text-muted-foreground">
                            {lead.source === 'CUSTOM' ? (lead.sourceDetail || 'Custom') : LEAD_SOURCE_LABEL[lead.source]}
                        </div>
                        {lead.city && (
                            <div className="flex items-center gap-1">
                                <MapPin className="h-2.5 w-2.5" /> {lead.city}
                            </div>
                        )}
                        {lead.followUpDate && (
                            <div className="flex items-center gap-1 text-amber-600 dark:text-amber-300 font-medium">
                                <Calendar className="h-2.5 w-2.5" /> FU: {dayjs(lead.followUpDate).format("DD/MM")}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
});
