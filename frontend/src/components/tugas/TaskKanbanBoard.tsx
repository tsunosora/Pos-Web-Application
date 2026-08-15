"use client";

import { memo, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
    DndContext, DragEndEvent, DragOverlay, DragStartEvent,
    PointerSensor, TouchSensor, useSensor, useSensors,
    rectIntersection, MeasuringStrategy,
    useDroppable, useDraggable,
} from "@dnd-kit/core";
import type { TaskItem, TaskStatus, TaskPriority } from "@/lib/api/task-board";
import { badgeToneClass, type BadgeTone } from "@/components/ui/status-badge";
import { GripVertical, User, CalendarClock, CheckCircle2, Repeat, AlertTriangle, ImageIcon } from "lucide-react";
import dayjs from "dayjs";

const COLUMNS: { id: TaskStatus; label: string; color: string; bg: string }[] = [
    { id: "TODO",        label: "Belum Dikerjakan", color: "text-slate-600 dark:text-slate-300",   bg: "bg-slate-500/10 border-slate-500/20" },
    { id: "IN_PROGRESS", label: "Sedang Dikerjakan", color: "text-amber-600 dark:text-amber-300",  bg: "bg-amber-500/10 border-amber-500/20" },
    { id: "DONE",        label: "Selesai",           color: "text-emerald-600 dark:text-emerald-300", bg: "bg-emerald-500/10 border-emerald-500/20" },
];

export const PRIORITY_TONE: Record<TaskPriority, BadgeTone> = {
    URGENT: "danger",
    HIGH: "warning",
    NORMAL: "neutral",
    LOW: "info",
};
export const PRIORITY_LABEL: Record<TaskPriority, string> = {
    URGENT: "Mendesak",
    HIGH: "Penting",
    NORMAL: "Normal",
    LOW: "Rendah",
};

interface Props {
    items: TaskItem[];
    onCardClick: (item: TaskItem) => void;
    onMove: (id: number, newStatus: TaskStatus, index: number) => void;
}

export function TaskKanbanBoard({ items, onCardClick, onMove }: Props) {
    const [activeId, setActiveId] = useState<number | null>(null);
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    );

    const grouped = useMemo(() => {
        const g: Record<TaskStatus, TaskItem[]> = { TODO: [], IN_PROGRESS: [], DONE: [] };
        for (const it of items) g[it.status]?.push(it);
        return g;
    }, [items]);

    const activeItem = activeId != null ? items.find((i) => i.id === activeId) ?? null : null;

    const handleDragStart = (e: DragStartEvent) => setActiveId(Number(e.active.id));

    const handleDragEnd = (e: DragEndEvent) => {
        setActiveId(null);
        if (!e.over) return;
        const id = Number(e.active.id);
        const newStatus = e.over.id as TaskStatus;
        const it = items.find((i) => i.id === id);
        if (!it || it.status === newStatus) return;
        onMove(id, newStatus, grouped[newStatus].length);
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {COLUMNS.map((col) => (
                    <Column
                        key={col.id}
                        id={col.id}
                        label={col.label}
                        color={col.color}
                        bg={col.bg}
                        items={grouped[col.id]}
                        activeId={activeId}
                        onCardClick={onCardClick}
                    />
                ))}
            </div>
            {mounted && createPortal(
                <DragOverlay dropAnimation={null}>
                    {activeItem && (
                        <div className="rotate-2 cursor-grabbing" style={{ willChange: "transform", transform: "translateZ(0)" }}>
                            <TaskCardView item={activeItem} onClick={() => {}} overlay />
                        </div>
                    )}
                </DragOverlay>,
                document.body,
            )}
        </DndContext>
    );
}

const Column = memo(function Column({
    id, label, color, bg, items, activeId, onCardClick,
}: {
    id: TaskStatus;
    label: string;
    color: string;
    bg: string;
    items: TaskItem[];
    activeId: number | null;
    onCardClick: (item: TaskItem) => void;
}) {
    const { setNodeRef, isOver } = useDroppable({ id });
    return (
        <div
            ref={setNodeRef}
            className={`rounded-xl border-2 ${bg} ${isOver ? "ring-2 ring-primary" : ""} min-h-[400px] flex flex-col`}
        >
            <div className={`px-3 py-2 border-b border-border/60 font-bold text-sm ${color} flex items-center justify-between sticky top-0 bg-inherit z-10`}>
                <span>{label}</span>
                <span className="text-xs bg-card/60 px-2 py-0.5 rounded-full">{items.length}</span>
            </div>
            <div className="p-2 space-y-2 flex-1 overflow-y-auto max-h-[70vh]">
                {items.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-6">Geser tugas ke sini</p>
                ) : (
                    items.map((it) => (
                        <TaskCard
                            key={it.id}
                            item={it}
                            isActive={activeId === it.id}
                            onClick={() => onCardClick(it)}
                        />
                    ))
                )}
            </div>
        </div>
    );
});

const TaskCard = memo(function TaskCard({ item, isActive, onClick }: { item: TaskItem; isActive: boolean; onClick: () => void }) {
    const { attributes, listeners, setNodeRef } = useDraggable({ id: String(item.id) });
    return (
        <div ref={setNodeRef} {...attributes} {...listeners} style={{ touchAction: "none" }}>
            <TaskCardView item={item} onClick={onClick} isDragging={isActive} />
        </div>
    );
});

const TaskCardView = memo(function TaskCardView({
    item, onClick, isDragging, overlay,
}: {
    item: TaskItem;
    onClick: () => void;
    isDragging?: boolean;
    overlay?: boolean;
}) {
    const overdue = item.status !== "DONE" && item.dueDate && dayjs(item.dueDate).isBefore(dayjs());
    return (
        <div
            className={`bg-card border rounded-lg overflow-hidden transition-[box-shadow,border-color] cursor-grab active:cursor-grabbing ${
                overlay ? "border-primary shadow-2xl" : "border-border shadow-sm"
            } ${isDragging ? "opacity-30" : "hover:shadow-md"}`}
        >
            <div className="flex items-start gap-2 p-3">
                <GripVertical className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden />
                <div className="flex-1 min-w-0" onClick={onClick} role="button" tabIndex={0}>
                    <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="font-semibold text-sm text-foreground truncate">{item.title}</div>
                        {item.verifiedByOwnerAt && (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" aria-label="Diverifikasi owner" />
                        )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1 mb-1.5">
                        <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${badgeToneClass[PRIORITY_TONE[item.priority]]}`}>
                            {PRIORITY_LABEL[item.priority]}
                        </span>
                        {item.scheduleId != null && (
                            <span className="inline-flex items-center gap-0.5 rounded-full border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                <Repeat className="h-2.5 w-2.5" /> Rutin
                            </span>
                        )}
                        {item.imageUrls && item.imageUrls.length > 0 && (
                            <span className="inline-flex items-center gap-0.5 rounded-full border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                <ImageIcon className="h-2.5 w-2.5" /> {item.imageUrls.length}
                            </span>
                        )}
                    </div>
                    <div className="space-y-0.5 text-[11px] text-muted-foreground">
                        <div className="flex items-center gap-1">
                            <User className="h-2.5 w-2.5" /> {item.assignee?.name || "Tanpa penanggung jawab"}
                        </div>
                        {item.dueDate && (
                            <div className={`flex items-center gap-1 font-medium ${overdue ? "text-red-600 dark:text-red-400" : ""}`}>
                                {overdue ? <AlertTriangle className="h-2.5 w-2.5" /> : <CalendarClock className="h-2.5 w-2.5" />}
                                {dayjs(item.dueDate).format("DD/MM HH:mm")}
                                {overdue && " • terlambat"}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
});
