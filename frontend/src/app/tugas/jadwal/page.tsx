"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    getTaskSchedules, createTaskSchedule, updateTaskSchedule, deleteTaskSchedule, generateTasksNow,
    getUsers, getRoles,
    type TaskSchedule, type TaskFrequency, type TaskPriority,
} from "@/lib/api";
import { PRIORITY_LABEL } from "@/components/tugas/TaskKanbanBoard";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import {
    CalendarClock, Plus, Loader2, Lock, ArrowLeft, X, Trash2, Zap, Repeat, Power,
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

export default function JadwalTugasPage() {
    const { isManager, currentUser } = useCurrentUser();
    const qc = useQueryClient();
    const [editing, setEditing] = useState<TaskSchedule | null>(null);
    const [showForm, setShowForm] = useState(false);

    const { data: schedules = [], isLoading } = useQuery({
        queryKey: ["task-schedules"],
        queryFn: getTaskSchedules,
        enabled: isManager,
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
    if (!isManager) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-center px-4">
                <div className="h-14 w-14 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center mb-4"><Lock className="h-7 w-7" /></div>
                <h1 className="text-xl font-bold text-foreground">Khusus Owner / Admin</h1>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">Pengelolaan jadwal tugas hanya untuk owner atau admin.</p>
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
                    <div className="flex gap-2">
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
                                    {scheduleSummary(s)}{s.timeOfDay ? ` • ${s.timeOfDay}` : ""}
                                    {s.assignee?.name ? ` • ${s.assignee.name}` : s.targetRole ? ` • semua ${s.targetRole}` : " • seluruh cabang"}
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
    const [target, setTarget] = useState<"user" | "role" | "branch">(
        editing?.assigneeId ? "user" : editing?.targetRole ? "role" : "branch",
    );
    const [assigneeId, setAssigneeId] = useState<string>(editing?.assigneeId ? String(editing.assigneeId) : "");
    const [targetRole, setTargetRole] = useState<string>(editing?.targetRole ?? "");

    const { data: users = [] } = useQuery({ queryKey: ["users"], queryFn: getUsers });
    const { data: roles = [] } = useQuery({ queryKey: ["roles"], queryFn: getRoles });

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
        assigneeId: target === "user" && assigneeId ? Number(assigneeId) : null,
        targetRole: target === "role" && targetRole ? targetRole : null,
    });

    const saveMut = useMutation({
        mutationFn: () => editing ? updateTaskSchedule(editing.id, buildPayload()) : createTaskSchedule(buildPayload()),
        onSuccess: onSaved,
    });

    const valid = title.trim() && (frequency !== "WEEKLY" || days.length > 0) && (target !== "role" || targetRole);

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

                    <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Penerima tugas</label>
                        <div className="grid grid-cols-3 gap-1.5 mb-2">
                            {([["user", "Karyawan"], ["role", "Per Divisi"], ["branch", "Seluruh Cabang"]] as const).map(([v, l]) => (
                                <button key={v} onClick={() => setTarget(v)}
                                    className={`text-xs py-1.5 rounded-md border transition ${target === v ? "border-primary bg-accent text-accent-foreground font-medium" : "border-border text-muted-foreground"}`}>{l}</button>
                            ))}
                        </div>
                        {target === "user" && (
                            <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}
                                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                                <option value="">— Pilih karyawan —</option>
                                {users.map((u: { id: number; name: string | null }) => <option key={u.id} value={u.id}>{u.name || `User #${u.id}`}</option>)}
                            </select>
                        )}
                        {target === "role" && (
                            <select value={targetRole} onChange={(e) => setTargetRole(e.target.value)}
                                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                                <option value="">— Pilih divisi —</option>
                                {roles.map((r: { id: number; name: string }) => <option key={r.id} value={r.name}>{r.name}</option>)}
                            </select>
                        )}
                    </div>
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
