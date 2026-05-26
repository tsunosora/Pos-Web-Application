"use client";

import { useMemo, useState } from "react";
import {
    DndContext, DragEndEvent, DragOverlay, DragStartEvent,
    PointerSensor, useSensor, useSensors, closestCorners,
} from "@dnd-kit/core";
import { useDroppable, useDraggable } from "@dnd-kit/core";
import {
    type Lead, type LeadStatus, type LeadLevel,
    LEAD_SOURCE_LABEL, LEAD_LEVEL_LABEL, LEAD_STATUS_LABEL,
} from "@/lib/api";
import { LeadImageCarousel } from "@/components/crm/LeadImageCarousel";
import { Phone, Calendar, MapPin, GripVertical } from "lucide-react";
import dayjs from "dayjs";

const COLUMNS: { id: LeadStatus; label: string; color: string; bg: string }[] = [
    { id: "NEW",          label: "Baru",      color: "text-blue-700",    bg: "bg-blue-50 border-blue-200" },
    { id: "FOLLOW_UP",    label: "Follow Up", color: "text-amber-700",   bg: "bg-amber-50 border-amber-200" },
    { id: "NEGOTIATION",  label: "Negosiasi", color: "text-purple-700",  bg: "bg-purple-50 border-purple-200" },
    { id: "CLOSED_WON",   label: "Closing ✓", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
    { id: "CLOSED_LOST",  label: "Lost ✗",    color: "text-red-700",     bg: "bg-red-50 border-red-200" },
];

const levelColor: Record<LeadLevel, string> = {
    HOT: "bg-red-100 text-red-700 border-red-200",
    WARM: "bg-amber-100 text-amber-700 border-amber-200",
    COLD: "bg-sky-100 text-sky-700 border-sky-200",
};

interface Props {
    leads: Lead[];
    onCardClick: (lead: Lead) => void;
    onStatusChange: (leadId: number, newStatus: LeadStatus) => void;
}

export function LeadKanbanBoard({ leads, onCardClick, onStatusChange }: Props) {
    const [activeLead, setActiveLead] = useState<Lead | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    );

    const grouped = useMemo(() => {
        const g: Record<LeadStatus, Lead[]> = {
            NEW: [], FOLLOW_UP: [], NEGOTIATION: [], CLOSED_WON: [], CLOSED_LOST: [],
        };
        for (const l of leads) g[l.status]?.push(l);
        return g;
    }, [leads]);

    const handleDragStart = (e: DragStartEvent) => {
        const id = Number(e.active.id);
        const lead = leads.find((l) => l.id === id);
        if (lead) setActiveLead(lead);
    };

    const handleDragEnd = (e: DragEndEvent) => {
        setActiveLead(null);
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
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
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
                        onCardClick={onCardClick}
                    />
                ))}
            </div>
            <DragOverlay>
                {activeLead && (
                    <div className="rotate-2 opacity-90">
                        <KanbanCard lead={activeLead} onClick={() => {}} dragging />
                    </div>
                )}
            </DragOverlay>
        </DndContext>
    );
}

function Column({
    id, label, color, bg, leads, onCardClick,
}: {
    id: LeadStatus;
    label: string;
    color: string;
    bg: string;
    leads: Lead[];
    onCardClick: (lead: Lead) => void;
}) {
    const { setNodeRef, isOver } = useDroppable({ id });
    return (
        <div
            ref={setNodeRef}
            className={`rounded-xl border-2 ${bg} ${isOver ? "ring-2 ring-indigo-400" : ""} min-h-[400px] flex flex-col`}
        >
            <div className={`px-3 py-2 border-b font-bold text-sm ${color} flex items-center justify-between`}>
                <span>{label}</span>
                <span className="text-xs bg-white/60 px-2 py-0.5 rounded-full">{leads.length}</span>
            </div>
            <div className="p-2 space-y-2 flex-1 overflow-y-auto max-h-[70vh]">
                {leads.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-6">Drag lead ke sini</p>
                ) : (
                    leads.map((lead) => (
                        <KanbanCard key={lead.id} lead={lead} onClick={() => onCardClick(lead)} />
                    ))
                )}
            </div>
        </div>
    );
}

function KanbanCard({ lead, onClick, dragging }: { lead: Lead; onClick: () => void; dragging?: boolean }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: String(lead.id),
    });
    const style = transform
        ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
        : undefined;
    const hasImage = (lead.images && lead.images.length > 0) || !!lead.imageUrl;

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`bg-white border rounded-lg shadow-sm overflow-hidden ${
                isDragging ? "opacity-30" : "hover:shadow-md"
            } ${dragging ? "shadow-2xl" : ""}`}
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
            {/* Spacer kosong kalau gambar tidak ada */}
            {false && hasImage}

            <div className="flex items-start gap-2 p-3">
                <button
                    {...attributes}
                    {...listeners}
                    className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 shrink-0 pt-0.5"
                    aria-label="Drag"
                    onClick={(e) => e.stopPropagation()}
                >
                    <GripVertical className="h-4 w-4" />
                </button>
                <div className="flex-1 min-w-0" onClick={onClick} role="button" tabIndex={0}>
                    {!hasImage && (
                        <div className="flex items-center justify-between gap-2 mb-1">
                            <div className="font-semibold text-sm text-gray-800 truncate">{lead.name}</div>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded border whitespace-nowrap ${levelColor[lead.level]}`}>
                                {LEAD_LEVEL_LABEL[lead.level].replace(/^\S+\s/, "")}
                            </span>
                        </div>
                    )}
                    {hasImage && (
                        <div className="font-semibold text-sm text-gray-800 truncate mb-1">{lead.name}</div>
                    )}
                    <div className="space-y-0.5 text-[11px] text-gray-600">
                        {lead.phone && (
                            <div className="flex items-center gap-1">
                                <Phone className="h-2.5 w-2.5" /> {lead.phone}
                            </div>
                        )}
                        <div className="text-gray-500">
                            {lead.source === 'CUSTOM' ? (lead.sourceDetail || 'Custom') : LEAD_SOURCE_LABEL[lead.source]}
                        </div>
                        {lead.city && (
                            <div className="flex items-center gap-1">
                                <MapPin className="h-2.5 w-2.5" /> {lead.city}
                            </div>
                        )}
                        {lead.followUpDate && (
                            <div className="flex items-center gap-1 text-amber-700 font-medium">
                                <Calendar className="h-2.5 w-2.5" /> FU: {dayjs(lead.followUpDate).format("DD/MM")}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
