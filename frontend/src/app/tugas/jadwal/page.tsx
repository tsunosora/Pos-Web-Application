"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    getTaskSchedules, createTaskSchedule, updateTaskSchedule, deleteTaskSchedule, generateTasksNow,
    getTaskGroups, createTaskGroup, updateTaskGroup, deleteTaskGroup, getUsers,
    type TaskSchedule, type TaskFrequency, type TaskPriority, type TaskGroup,
} from "@/lib/api";
import { PRIORITY_LABEL } from "@/components/tugas/TaskKanbanBoard";
import {
    TargetSelector, targetPayload, targetValid, targetFromSchedule, emptyTarget, type TaskTarget,
} from "@/components/tugas/TargetSelector";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import {
    CalendarClock, Plus, Loader2, Lock, ArrowLeft, X, Trash2, Zap, Repeat, Power, Users2,
} from "lucide-react";

const FREQ_LABEL: Record<TaskFrequency, string> = {
    ONCE: "Sekali", DAILY: "Harian", WEEKLY: "Mingguan", MONTHLY: "Bulanan",
};
const DOW = [
    { iso: 1, label: "Sen" }, { iso: 2, label: "Sel" }, { iso: 3, label: "Rab" },
    { iso: 4, label: "Kam" }, { iso: 5, label: "Jum" }, { iso: 6, label: "Sab" }, { iso: 7, label: "Min" },
];
const PRIORITIES: TaskPriority[] = ["LOW", "NORMAL", "HIGH", "URGENT"];

function scheduleSummary(s: TaskSchedule): string {
    if (s.frequency === "ONCE") return "Sekali";
    if (s.frequency === "DAILY") return `Setiap hari${s.skipWeekends ? " (kecuali akhir pekan)" : ""}`;
    if (s.frequency === "WEEKLY") {
        const days = (s.daysOfWeek || "").split(",").filter(Boolean)
            .map((d) => DOW.find((x) => x.iso === Number(d))?.label).filter(Boolean).join(", ");
        return `Setiap ${days || "—"}`;
    }
    if (s.frequency === "MONTHLY") return `Tanggal ${s.dayOfMonth ?? "?"} tiap bulan`;
    return "";
}
function targetLabel(s: TaskSchedule): string {
    if (s.assignee?.name) return s.assignee.name;
    if (s.group?.name) return `Grup ${s.group.name}`;
    if (s.targetRole) return `Divisi ${s.targetRole}`;
    if (s.targetAll) return "Semua karyawan";
    return "Seluruh cabang";
}

export default function JadwalTugasPage() {
    const { canAssignTasks, currentUser } = useCurrentUser();
    const qc = useQueryClient();
    const [editing, setEditing] = useState<TaskSchedule | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [showGroups, setShowGroups] = useState(false);

    const { data: schedules = [], isLoading } = useQuery({
        queryKey: ["task-schedules"],
        queryFn: getTaskSchedules,
        enabled: canAssignTasks,
    });

    const invalidate = () => qc.invalidateQueries({ queryKey: ["task-schedules"] });
    const toggleMut = useMutation({
        mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) => updateTaskSchedule(id, { isActive }),
        onSuccess: invalidate,
    });
    const delMut = useMutation({ mutationFn: (id: number) => deleteTaskSchedule(id), onSuccess: invalidate });
    const genMut = useMutation({ mutationFn: generateTasksNow });

    if (currentUser === undefined) {
        return <div className="flex items-center justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
    }
    if (!canAssignTasks) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-center px-4">
                <div className="h-14 w-14 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center mb-4"><Lock className="h-7 w-7" /></div>
                <h1 className="text-xl font-bold text-foreground">Khusus Owner / Manajer</h1>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">Pemberian & pengelolaan jadwal tugas hanya untuk owner atau manajer.</p>
                <Link href="/tugas" className="mt-5 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"><ArrowLeft className="h-4 w-4" /> Kembali ke papan tugas</Link>
            </div>
        );
    }

    return (
        <div className="p-4 max-w-4xl mx-auto">
            <PageHeader
                title="Jadwal Tugas Rutin"
                description="Buat tugas yang otomatis muncul tiap hari/minggu/bulan."
                icon={CalendarClock}
                breadcrumbs={[{ label: "Papan Tugas", href: "/tugas" }, { label: "Jadwal Rutin" }]}
                actions={
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => setShowGroups(true)}><Users2 className="h-4 w-4" /> Grup Tim</Button>
                        <Button variant="outline" size="sm" onClick={() => genMut.mutate()} disabled={genMut.isPending}>
                            {genMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />} Buat Kartu Sekarang
                        </Button>
                        <Button size="sm" onClick={() => { setEditing(null); setShowForm(true); }}><Plus className="h-4 w-4" /> Jadwal Baru</Button>
                    </div>
                }
            />

            {genMut.data && (
                <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
                    {genMut.data.created} kartu tugas dibuat dari {genMut.data.scanned} jadwal aktif.
                </div>
            )}

            {isLoading ? (
                <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : schedules.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                    <Repeat className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">Belum ada jadwal rutin.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {schedules.map((s) => (
                        <div key={s.id} className={`rounded-xl border border-border bg-card p-3 flex items-center justify-between gap-3 ${!s.isActive ? "opacity-60" : ""}`}>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-semibold text-sm text-foreground truncate">{s.title}</span>
                                    <span className="text-[10px] rounded-full border border-border px-1.5 py-0.5 text-muted-foreground">{FREQ_LABEL[s.frequency]}</span>
                                    <span className="text-[10px] rounded-full border border-border px-1.5 py-0.5 text-muted-foreground">{PRIORITY_LABEL[s.priority]}</span>
                                </div>
                                <div className="text-xs text-muted-foreground mt-0.5">
                                    {scheduleSummary(s)}{s.timeOfDay ? ` • ${s.timeOfDay}` : ""} • {targetLabel(s)}
                                </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                                <Button variant="ghost" size="icon-sm" title={s.isActive ? "Nonaktifkan" : "Aktifkan"}
                                    onClick={() => toggleMut.mutate({ id: s.id, isActive: !s.isActive })}>
                                    <Power className={`h-4 w-4 ${s.isActive ? "text-emerald-500" : "text-muted-foreground"}`} />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => { setEditing(s); setShowForm(true); }}>Edit</Button>
                                <Button variant="ghost" size="icon-sm" onClick={() => { if (confirm("Hapus jadwal ini? Kartu tugas terkait ikut terhapus.")) delMut.mutate(s.id); }}>
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showForm && (
                <ScheduleFormModal
                    editing={editing}
                    onClose={() => setShowForm(false)}
                    onSaved={() => { invalidate(); setShowForm(false); }}
                />
            )}
            {showGroups && <GroupsModal onClose={() => setShowGroups(false)} />}
        </div>
    );
}

function ScheduleFormModal({ editing, onClose, onSaved }: {
    editing: TaskSchedule | null; onClose: () => void; onSaved: () => void;
}) {
    const [title, setTitle] = useState(editing?.title ?? "");
    const [description, setDescription] = useState(editing?.description ?? "");
    const [frequency, setFrequency] = useState<TaskFrequency>(editing?.frequency ?? "DAILY");
    const [days, setDays] = useState<number[]>((editing?.daysOfWeek || "").split(",").filter(Boolean).map(Number));
    const [dayOfMonth, setDayOfMonth] = useState<string>(editing?.dayOfMonth ? String(editing.dayOfMonth) : "1");
    const [skipWeekends, setSkipWeekends] = useState(editing?.skipWeekends ?? false);
    const [timeOfDay, setTimeOfDay] = useState(editing?.timeOfDay ?? "");
    const [priority, setPriority] = useState<TaskPriority>(editing?.priority ?? "NORMAL");
    const [target, setTarget] = useState<TaskTarget>(editing ? targetFromSchedule(editing) : emptyTarget());

    const toggleDay = (iso: number) =>
        setDays((d) => (d.includes(iso) ? d.filter((x) => x !== iso) : [...d, iso].sort()));

    const buildPayload = () => ({
        title,
        description: description || null,
        frequency,
        daysOfWeek: frequency === "WEEKLY" ? days.join(",") : null,
        dayOfMonth: frequency === "MONTHLY" ? Number(dayOfMonth) : null,
        skipWeekends: frequency === "DAILY" ? skipWeekends : false,
        timeOfDay: timeOfDay || null,
        priority,
        ...targetPayload(target),
    });

    const saveMut = useMutation({
        mutationFn: () => editing ? updateTaskSchedule(editing.id, buildPayload()) : createTaskSchedule(buildPayload()),
        onSuccess: onSaved,
    });

    const valid = title.trim() && (frequency !== "WEEKLY" || days.length > 0) && targetValid(target);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
            <div className="w-full max-w-lg rounded-xl border border-border bg-card p-4 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-bold text-foreground">{editing ? "Edit Jadwal" : "Jadwal Baru"}</h2>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
                </div>

                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Judul tugas *</label>
                        <input value={title} onChange={(e) => setTitle(e.target.value)}
                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" placeholder="mis. Cek stok bahan" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Deskripsi</label>
                        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Frekuensi</label>
                        <div className="grid grid-cols-4 gap-1.5">
                            {(Object.keys(FREQ_LABEL) as TaskFrequency[]).map((f) => (
                                <button key={f} onClick={() => setFrequency(f)}
                                    className={`text-xs py-1.5 rounded-md border transition ${frequency === f ? "border-primary bg-accent text-accent-foreground font-medium" : "border-border text-muted-foreground"}`}>
                                    {FREQ_LABEL[f]}
                                </button>
                            ))}
                        </div>
                    </div>

                    {frequency === "DAILY" && (
                        <label className="flex items-center gap-2 text-sm text-foreground">
                            <input type="checkbox" checked={skipWeekends} onChange={(e) => setSkipWeekends(e.target.checked)} />
                            Lewati akhir pekan (Sabtu & Minggu)
                        </label>
                    )}
                    {frequency === "WEEKLY" && (
                        <div>
                            <label className="block text-xs font-medium text-foreground mb-1">Hari</label>
                            <div className="flex flex-wrap gap-1.5">
                                {DOW.map((d) => (
                                    <button key={d.iso} onClick={() => toggleDay(d.iso)}
                                        className={`text-xs px-2.5 py-1 rounded-full border transition ${days.includes(d.iso) ? "border-primary bg-accent text-accent-foreground font-medium" : "border-border text-muted-foreground"}`}>
                                        {d.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    {frequency === "MONTHLY" && (
                        <div>
                            <label className="block text-xs font-medium text-foreground mb-1">Tanggal (1–28)</label>
                            <input type="number" min={1} max={28} value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value)}
                                className="w-24 rounded-md border border-border bg-background px-3 py-2 text-sm" />
                            <p className="text-[11px] text-muted-foreground mt-1">Untuk bulan pendek, otomatis disesuaikan ke hari terakhir.</p>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-foreground mb-1">Jam jatuh tempo</label>
                            <input type="time" value={timeOfDay} onChange={(e) => setTimeOfDay(e.target.value)}
                                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-foreground mb-1">Prioritas</label>
                            <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}
                                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                                {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
                            </select>
                        </div>
                    </div>

                    <TargetSelector target={target} setTarget={setTarget} />
                </div>

                <div className="flex justify-end gap-2 mt-4">
                    <Button variant="outline" size="sm" onClick={onClose}>Batal</Button>
                    <Button size="sm" onClick={() => saveMut.mutate()} disabled={!valid || saveMut.isPending}>
                        {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Simpan
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ─── Kelola Grup Tim ──────────────────────────────────────────────────────────
function GroupsModal({ onClose }: { onClose: () => void }) {
    const qc = useQueryClient();
    const [editing, setEditing] = useState<TaskGroup | null>(null);
    const [creating, setCreating] = useState(false);

    const { data: groups = [], isLoading } = useQuery({ queryKey: ["task-groups"], queryFn: getTaskGroups });
    const invalidate = () => qc.invalidateQueries({ queryKey: ["task-groups"] });
    const delMut = useMutation({ mutationFn: (id: number) => deleteTaskGroup(id), onSuccess: invalidate });

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
            <div className="w-full max-w-md rounded-xl border border-border bg-card p-4 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-bold text-foreground flex items-center gap-2"><Users2 className="h-5 w-5" /> Grup Tim</h2>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
                </div>

                {editing || creating ? (
                    <GroupForm
                        group={editing}
                        onClose={() => { setEditing(null); setCreating(false); }}
                        onSaved={() => { invalidate(); setEditing(null); setCreating(false); }}
                    />
                ) : (
                    <>
                        <Button size="sm" className="mb-3" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Grup Baru</Button>
                        {isLoading ? (
                            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                        ) : groups.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-8">Belum ada grup.</p>
                        ) : (
                            <div className="space-y-2">
                                {groups.map((g) => (
                                    <div key={g.id} className="rounded-lg border border-border p-2.5 flex items-center justify-between gap-2">
                                        <div className="min-w-0">
                                            <div className="text-sm font-medium text-foreground truncate">{g.name}</div>
                                            <div className="text-xs text-muted-foreground truncate">
                                                {g.members.length} anggota: {g.members.map((m) => m.user?.name || `#${m.userId}`).join(", ") || "—"}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <Button variant="ghost" size="sm" onClick={() => setEditing(g)}>Edit</Button>
                                            <Button variant="ghost" size="icon-sm" onClick={() => { if (confirm("Hapus grup ini?")) delMut.mutate(g.id); }}>
                                                <Trash2 className="h-4 w-4 text-red-500" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

function GroupForm({ group, onClose, onSaved }: { group: TaskGroup | null; onClose: () => void; onSaved: () => void }) {
    const [name, setName] = useState(group?.name ?? "");
    const [memberIds, setMemberIds] = useState<number[]>(group?.members.map((m) => m.userId) ?? []);
    const { data: users = [] } = useQuery({ queryKey: ["users"], queryFn: getUsers });

    const toggle = (id: number) => setMemberIds((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));
    const saveMut = useMutation({
        mutationFn: () => group ? updateTaskGroup(group.id, { name, memberIds }) : createTaskGroup({ name, memberIds }),
        onSuccess: onSaved,
    });

    return (
        <div className="space-y-3">
            <div>
                <label className="block text-xs font-medium text-foreground mb-1">Nama grup *</label>
                <input value={name} onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" placeholder="mis. Tim Toko Pusat" />
            </div>
            <div>
                <label className="block text-xs font-medium text-foreground mb-1">Anggota</label>
                <div className="max-h-52 overflow-y-auto rounded-md border border-border divide-y divide-border/60">
                    {users.map((u: { id: number; name: string | null }) => (
                        <label key={u.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-accent/50">
                            <input type="checkbox" checked={memberIds.includes(u.id)} onChange={() => toggle(u.id)} />
                            {u.name || `User #${u.id}`}
                        </label>
                    ))}
                </div>
            </div>
            <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={onClose}>Batal</Button>
                <Button size="sm" onClick={() => saveMut.mutate()} disabled={!name.trim() || memberIds.length === 0 || saveMut.isPending}>
                    {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Simpan
                </Button>
            </div>
        </div>
    );
}
