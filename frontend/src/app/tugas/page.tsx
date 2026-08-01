"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    getTaskItems, moveTaskItem, updateTaskItem, createTaskItem, deleteTaskItem,
    type TaskItem, type TaskStatus, type TaskPriority,
} from "@/lib/api";
import { TaskKanbanBoard, PRIORITY_LABEL } from "@/components/tugas/TaskKanbanBoard";
import { TargetSelector, targetPayload, targetValid, emptyTarget, type TaskTarget } from "@/components/tugas/TargetSelector";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { ClipboardList, Plus, CalendarClock, Loader2, X, Trash2, CheckCircle2 } from "lucide-react";
import dayjs from "dayjs";

const STATUS_LABEL: Record<TaskStatus, string> = {
    TODO: "Belum Dikerjakan",
    IN_PROGRESS: "Sedang Dikerjakan",
    DONE: "Selesai",
};
const PRIORITIES: TaskPriority[] = ["LOW", "NORMAL", "HIGH", "URGENT"];

export default function TugasPage() {
    const { canAssignTasks, currentUser } = useCurrentUser();
    const qc = useQueryClient();
    const [scope, setScope] = useState<"mine" | "all">("mine");
    const mine = !canAssignTasks || scope === "mine";

    const [detail, setDetail] = useState<TaskItem | null>(null);
    const [showCreate, setShowCreate] = useState(false);

    const { data: items = [], isLoading } = useQuery({
        queryKey: ["task-items", mine],
        queryFn: () => getTaskItems({ mine }),
        enabled: currentUser !== undefined,
    });

    const invalidate = () => qc.invalidateQueries({ queryKey: ["task-items"] });

    const moveMut = useMutation({
        mutationFn: ({ id, status, index }: { id: number; status: TaskStatus; index: number }) =>
            moveTaskItem(id, { status, index }),
        onMutate: async ({ id, status }) => {
            await qc.cancelQueries({ queryKey: ["task-items", mine] });
            const prev = qc.getQueryData<TaskItem[]>(["task-items", mine]);
            qc.setQueryData<TaskItem[]>(["task-items", mine], (old) =>
                (old || []).map((it) => (it.id === id ? { ...it, status } : it)),
            );
            return { prev };
        },
        onError: (_e, _v, ctx) => {
            if (ctx?.prev) qc.setQueryData(["task-items", mine], ctx.prev);
        },
        onSettled: invalidate,
    });

    if (currentUser === undefined) {
        return (
            <div className="flex items-center justify-center py-24">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="p-4 max-w-[96rem] mx-auto">
            <PageHeader
                title="Papan Tugas"
                description="Jadwal & tugas harian, mingguan, bulanan karyawan."
                icon={ClipboardList}
                actions={
                    canAssignTasks ? (
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" asChild>
                                <Link href="/tugas/jadwal"><CalendarClock className="h-4 w-4" /> Jadwal Rutin</Link>
                            </Button>
                            <Button size="sm" onClick={() => setShowCreate(true)}>
                                <Plus className="h-4 w-4" /> Tugas Baru
                            </Button>
                        </div>
                    ) : null
                }
            />

            {canAssignTasks && (
                <div className="mb-4 inline-flex rounded-lg border border-border bg-card p-0.5 text-sm">
                    <button
                        onClick={() => setScope("mine")}
                        className={`px-3 py-1 rounded-md transition ${scope === "mine" ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground"}`}
                    >Tugas Saya</button>
                    <button
                        onClick={() => setScope("all")}
                        className={`px-3 py-1 rounded-md transition ${scope === "all" ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground"}`}
                    >Semua Karyawan</button>
                </div>
            )}

            {isLoading ? (
                <div className="flex items-center justify-center py-24">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : items.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground">
                    <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">Belum ada tugas.</p>
                    {canAssignTasks && <p className="text-xs mt-1">Buat tugas baru atau atur jadwal rutin.</p>}
                </div>
            ) : (
                <TaskKanbanBoard
                    items={items}
                    onCardClick={setDetail}
                    onMove={(id, status, index) => moveMut.mutate({ id, status, index })}
                />
            )}

            {detail && (
                <TaskDetailModal
                    item={detail}
                    canAssignTasks={canAssignTasks}
                    onClose={() => setDetail(null)}
                    onSaved={() => { invalidate(); setDetail(null); }}
                />
            )}
            {showCreate && canAssignTasks && (
                <CreateTaskModal onClose={() => setShowCreate(false)} onSaved={() => { invalidate(); setShowCreate(false); }} />
            )}
        </div>
    );
}

// ─── Modal detail ───────────────────────────────────────────────────────────
function TaskDetailModal({ item, canAssignTasks, onClose, onSaved }: {
    item: TaskItem; canAssignTasks: boolean; onClose: () => void; onSaved: () => void;
}) {
    const [note, setNote] = useState(item.note ?? "");
    const [status, setStatus] = useState<TaskStatus>(item.status);

    const saveMut = useMutation({
        mutationFn: (data: Record<string, unknown>) => updateTaskItem(item.id, data),
        onSuccess: onSaved,
    });
    const verifyMut = useMutation({
        mutationFn: (v: boolean) => updateTaskItem(item.id, { verified: v }),
        onSuccess: onSaved,
    });
    const delMut = useMutation({
        mutationFn: () => deleteTaskItem(item.id),
        onSuccess: onSaved,
    });

    return (
        <Overlay onClose={onClose}>
            <div className="flex items-start justify-between gap-2 mb-3">
                <h2 className="text-lg font-bold text-foreground">{item.title}</h2>
                <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>
            {item.description && <p className="text-sm text-muted-foreground mb-3 whitespace-pre-wrap">{item.description}</p>}
            <div className="text-xs text-muted-foreground space-y-1 mb-4">
                <div>Penanggung jawab: <span className="text-foreground">{item.assignee?.name || "—"}</span></div>
                <div>Prioritas: <span className="text-foreground">{PRIORITY_LABEL[item.priority]}</span></div>
                {item.dueDate && <div>Jatuh tempo: <span className="text-foreground">{dayjs(item.dueDate).format("DD MMM YYYY HH:mm")}</span></div>}
                {item.verifiedByOwnerAt && <div className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Diverifikasi owner</div>}
            </div>

            <label className="block text-xs font-medium text-foreground mb-1">Status</label>
            <div className="flex gap-2 mb-4">
                {(Object.keys(STATUS_LABEL) as TaskStatus[]).map((s) => (
                    <button
                        key={s}
                        onClick={() => setStatus(s)}
                        className={`flex-1 text-xs py-1.5 rounded-md border transition ${status === s ? "border-primary bg-accent text-accent-foreground font-medium" : "border-border text-muted-foreground"}`}
                    >{STATUS_LABEL[s]}</button>
                ))}
            </div>

            <label className="block text-xs font-medium text-foreground mb-1">Catatan</label>
            <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm mb-4"
                placeholder="Catatan pengerjaan…"
            />

            <div className="flex items-center justify-between gap-2">
                <div className="flex gap-2">
                    {canAssignTasks && (
                        <>
                            <Button variant={item.verifiedByOwnerAt ? "outline" : "secondary"} size="sm"
                                onClick={() => verifyMut.mutate(!item.verifiedByOwnerAt)} disabled={verifyMut.isPending}>
                                <CheckCircle2 className="h-4 w-4" /> {item.verifiedByOwnerAt ? "Batal Verifikasi" : "Verifikasi"}
                            </Button>
                            <Button variant="destructive" size="sm" onClick={() => delMut.mutate()} disabled={delMut.isPending}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </>
                    )}
                </div>
                <Button size="sm" onClick={() => saveMut.mutate({ status, note })} disabled={saveMut.isPending}>
                    {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Simpan
                </Button>
            </div>
        </Overlay>
    );
}

// ─── Modal buat tugas (owner/manajer) ─────────────────────────────────────────
function CreateTaskModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [priority, setPriority] = useState<TaskPriority>("NORMAL");
    const [dueDate, setDueDate] = useState("");
    const [target, setTarget] = useState<TaskTarget>(emptyTarget());

    const createMut = useMutation({
        mutationFn: () => createTaskItem({
            title,
            description: description || null,
            priority,
            dueDate: dueDate ? new Date(dueDate).toISOString() : null,
            ...targetPayload(target),
        } as Partial<TaskItem>),
        onSuccess: onSaved,
    });

    return (
        <Overlay onClose={onClose}>
            <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold text-foreground">Tugas Baru</h2>
                <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-3">
                <div>
                    <label className="block text-xs font-medium text-foreground mb-1">Judul tugas *</label>
                    <input value={title} onChange={(e) => setTitle(e.target.value)}
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" placeholder="mis. Sapu & pel lantai toko" />
                </div>
                <div>
                    <label className="block text-xs font-medium text-foreground mb-1">Deskripsi</label>
                    <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
                </div>
                <TargetSelector target={target} setTarget={setTarget} />
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Prioritas</label>
                        <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}
                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                            {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Jatuh tempo</label>
                        <input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
                    </div>
                </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" size="sm" onClick={onClose}>Batal</Button>
                <Button size="sm" onClick={() => createMut.mutate()} disabled={!title || !targetValid(target) || createMut.isPending}>
                    {createMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Simpan
                </Button>
            </div>
        </Overlay>
    );
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
            <div className="w-full max-w-md rounded-xl border border-border bg-card p-4 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                {children}
            </div>
        </div>
    );
}
