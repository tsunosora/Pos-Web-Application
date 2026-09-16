"use client";

import { useState } from "react";
import Link from "next/link";
import dayjs from "dayjs";
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
    ArrowUp, ArrowDown, ClipboardCheck,
} from "lucide-react";

const FREQ_LABEL: Record<TaskFrequency, string> = {
    ONCE: "Sekali", DAILY: "Harian", WEEKLY: "Mingguan", MONTHLY: "Bulanan",
};
const DOW = [
    { iso: 1, label: "Sen" }, { iso: 2, label: "Sel" }, { iso: 3, label: "Rab" },
    { iso: 4, label: "Kam" }, { iso: 5, label: "Jum" }, { iso: 6, label: "Sab" }, { iso: 7, label: "Min" },
];
const PRIORITIES: TaskPriority[] = ["LOW", "NORMAL", "HIGH", "URGENT"];
const SLOT_LABEL = { PAGI: "Shift Pagi", KEDUA: "Shift Kedua" } as const;

type UserLite = { id: number; name: string | null };

const parseIds = (csv?: string | null) => (csv || "").split(",").filter(Boolean).map(Number);

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
function targetLabel(s: TaskSchedule, nameOf: (id: number) => string): string {
    if (s.rotationUserIds) return `Bergilir: ${parseIds(s.rotationUserIds).map(nameOf).join(" → ")}`;
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
    const { data: users = [] } = useQuery<UserLite[]>({ queryKey: ["users"], queryFn: getUsers, enabled: canAssignTasks });
    const nameOf = (id: number) => users.find((u) => u.id === id)?.name || `#${id}`;

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
                        <Button variant="outline" size="sm" asChild><Link href="/tugas/pantau"><ClipboardCheck className="h-4 w-4" /> Pantau Piket</Link></Button>
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
                    {genMut.data.created} kartu tugas dibuat dari {genMut.data.scanned} jadwal aktif. Jadwal khusus shift dibuat saat karyawan memilih shift.
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
                                    {s.shiftSlot && (
                                        <span className={`text-[10px] rounded-full border px-1.5 py-0.5 ${s.shiftSlot === "PAGI" ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300" : "border-indigo-500/40 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300"}`}>
                                            {SLOT_LABEL[s.shiftSlot]}
                                        </span>
                                    )}
                                    {s.rotationUserIds && (
                                        <span className="text-[10px] rounded-full border border-teal-500/40 bg-teal-500/10 px-1.5 py-0.5 text-teal-700 dark:text-teal-300">Giliran</span>
                                    )}
                                </div>
                                <div className="text-xs text-muted-foreground mt-0.5">
                                    {scheduleSummary(s)}{s.timeOfDay ? ` • ${s.timeOfDay}` : ""} • {targetLabel(s, nameOf)}
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
                    users={users}
                    onClose={() => setShowForm(false)}
                    onSaved={() => { invalidate(); setShowForm(false); }}
                />
            )}
            {showGroups && <GroupsModal onClose={() => setShowGroups(false)} />}
        </div>
    );
}

function ScheduleFormModal({ editing, users, onClose, onSaved }: {
    editing: TaskSchedule | null; users: UserLite[]; onClose: () => void; onSaved: () => void;
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
    const [shiftSlot, setShiftSlot] = useState<"" | "PAGI" | "KEDUA">(editing?.shiftSlot ?? "");
    const [useRotation, setUseRotation] = useState(!!editing?.rotationUserIds);
    const [rotation, setRotation] = useState<number[]>(parseIds(editing?.rotationUserIds));
    const [startDate, setStartDate] = useState(editing?.startDate ? dayjs(editing.startDate).format("YYYY-MM-DD") : dayjs().format("YYYY-MM-DD"));

    const toggleDay = (iso: number) =>
        setDays((d) => (d.includes(iso) ? d.filter((x) => x !== iso) : [...d, iso].sort()));

    const shiftAllowed = !useRotation && frequency !== "ONCE";
    const buildPayload = () => ({
        title,
        description: description || null,
        frequency,
        daysOfWeek: frequency === "WEEKLY" ? days.join(",") : null,
        dayOfMonth: frequency === "MONTHLY" ? Number(dayOfMonth) : null,
        skipWeekends: frequency === "DAILY" ? skipWeekends : false,
        timeOfDay: timeOfDay || null,
        priority,
        ...targetPayload(useRotation ? emptyTarget() : target),
        shiftSlot: shiftAllowed && shiftSlot ? shiftSlot : null,
        rotationUserIds: useRotation ? rotation.join(",") : null,
        ...(useRotation ? { startDate } : {}),
    });

    const saveMut = useMutation({
        mutationFn: () => editing ? updateTaskSchedule(editing.id, buildPayload()) : createTaskSchedule(buildPayload()),
        onSuccess: onSaved,
    });
    const errMsg = (saveMut.error as { response?: { data?: { message?: string | string[] } } } | null)?.response?.data?.message;

    const valid = title.trim() && (frequency !== "WEEKLY" || days.length > 0) &&
        (useRotation ? rotation.length > 0 && !!startDate : targetValid(target));

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
                            <label className="block text-xs font-medium text-foreground mb-1">Jam batas (jatuh tempo)</label>
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
                    {timeOfDay && (
                        <p className="-mt-1 text-[11px] text-muted-foreground">Pengingat muncul 15 menit sebelum jam batas. Belum dicentang Selesai 15 menit setelah jam batas → teguran otomatis.</p>
                    )}

                    <div>
                        <label className="block text-xs font-medium text-foreground mb-1">Cara pembagian</label>
                        <div className="grid grid-cols-2 gap-1.5">
                            {([[false, "Penerima tetap"], [true, "Giliran bergilir harian"]] as const).map(([v, l]) => (
                                <button key={String(v)} type="button" onClick={() => setUseRotation(v)}
                                    className={`text-xs py-1.5 rounded-md border transition ${useRotation === v ? "border-primary bg-accent text-accent-foreground font-medium" : "border-border text-muted-foreground"}`}>{l}</button>
                            ))}
                        </div>
                    </div>

                    {useRotation ? (
                        <RotationEditor users={users} rotation={rotation} setRotation={setRotation} startDate={startDate} setStartDate={setStartDate} />
                    ) : (
                        <TargetSelector target={target} setTarget={setTarget} />
                    )}

                    {shiftAllowed && (
                        <div>
                            <label className="block text-xs font-medium text-foreground mb-1">Khusus shift (piket)</label>
                            <div className="grid grid-cols-3 gap-1.5">
                                {([["", "Tidak terikat shift"], ["PAGI", "Shift Pagi"], ["KEDUA", "Shift Kedua"]] as const).map(([v, l]) => (
                                    <button key={v || "none"} type="button" onClick={() => setShiftSlot(v)}
                                        className={`text-xs py-1.5 rounded-md border transition ${shiftSlot === v ? "border-primary bg-accent text-accent-foreground font-medium" : "border-border text-muted-foreground"}`}>{l}</button>
                                ))}
                            </div>
                            {shiftSlot && (
                                <p className="text-[11px] text-muted-foreground mt-1">
                                    Kartu hanya dibuat untuk penerima yang memilih <b>{SLOT_LABEL[shiftSlot]}</b> hari itu di aplikasi (pop-up pilih shift).
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {saveMut.isError && (
                    <p className="mt-3 text-xs text-red-600">{Array.isArray(errMsg) ? errMsg.join(", ") : errMsg || "Gagal menyimpan jadwal."}</p>
                )}
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

function RotationEditor({ users, rotation, setRotation, startDate, setStartDate }: {
    users: UserLite[]; rotation: number[]; setRotation: (r: number[]) => void;
    startDate: string; setStartDate: (s: string) => void;
}) {
    const nameOf = (id: number) => users.find((u) => u.id === id)?.name || `#${id}`;
    const move = (i: number, d: -1 | 1) => {
        const j = i + d;
        if (j < 0 || j >= rotation.length) return;
        const next = [...rotation];
        [next[i], next[j]] = [next[j], next[i]];
        setRotation(next);
    };
    const n = rotation.length;
    const preview = n && startDate
        ? Array.from({ length: 7 }, (_, k) => {
            const d = dayjs().startOf("day").add(k, "day");
            const diff = d.diff(dayjs(startDate).startOf("day"), "day");
            return { d, who: nameOf(rotation[((diff % n) + n) % n]) };
        })
        : [];

    return (
        <div className="space-y-2 rounded-lg border border-border p-2.5">
            <label className="block text-xs font-medium text-foreground">Urutan giliran</label>
            {rotation.length > 0 && (
                <ol className="space-y-1">
                    {rotation.map((id, i) => (
                        <li key={id} className="flex items-center gap-2 rounded-md border border-border px-2 py-1 text-sm">
                            <span className="w-5 text-xs text-muted-foreground">{i + 1}.</span>
                            <span className="flex-1 truncate text-foreground">{nameOf(id)}</span>
                            <Button variant="ghost" size="icon-sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Naikkan"><ArrowUp className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon-sm" onClick={() => move(i, 1)} disabled={i === rotation.length - 1} aria-label="Turunkan"><ArrowDown className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon-sm" onClick={() => setRotation(rotation.filter((x) => x !== id))} aria-label="Hapus"><X className="h-3.5 w-3.5 text-red-500" /></Button>
                        </li>
                    ))}
                </ol>
            )}
            <select value="" onChange={(e) => { const v = Number(e.target.value); if (v && !rotation.includes(v)) setRotation([...rotation, v]); }}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                <option value="">+ Tambah karyawan ke giliran</option>
                {users.filter((u) => !rotation.includes(u.id)).map((u) => <option key={u.id} value={u.id}>{u.name || `User #${u.id}`}</option>)}
            </select>
            <div>
                <label className="block text-xs font-medium text-foreground mb-1">Mulai giliran (hari itu = orang nomor 1)</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                    className="rounded-md border border-border bg-background px-3 py-1.5 text-sm" />
            </div>
            {preview.length > 0 && (
                <div className="text-[11px] text-muted-foreground">
                    <span className="font-medium text-foreground">7 hari ke depan:</span>{" "}
                    {preview.map((p) => `${p.d.format("DD/MM")} ${p.who}`).join(" · ")}
                </div>
            )}
            <p className="text-[11px] text-muted-foreground">Jadwal Mingguan (mis. hanya Minggu) memakai hitungan hari yang sama, jadi petugas hari Minggu = petugas giliran hari itu.</p>
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
