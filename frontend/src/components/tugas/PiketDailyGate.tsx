"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import dayjs from "dayjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    AlarmClock, BellRing, CalendarCheck, Check, CheckCircle2, ClipboardList, Loader2, Moon, Sun, Sunset, X,
} from "lucide-react";
import {
    getPiketMyDay, piketCheckin, getMyTaskWarnings, ackMyTaskWarnings, getMyUpcomingTasks, getMyTodayTasks, updateTaskItem,
    getPinPiketState, pinPiketCheckin, pinAckTaskWarnings, pinCompleteTask, SHIFT_LABEL,
    type MyTaskWarning, type PiketMyDay, type PinPiketState, type PinTodayTask, type ShiftChoice, type UpcomingTasks,
} from "@/lib/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { PiketBoardModal } from "./PiketBoard";

const OPEN_EVENT = "piket:open-checkin";
const SNOOZE_MS = 30 * 60 * 1000;
const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

const SHIFT_META: Record<ShiftChoice, { icon: typeof Sun; tone: string }> = {
    PAGI: { icon: Sun, tone: "from-amber-500 to-orange-500" },
    KEDUA: { icon: Sunset, tone: "from-indigo-600 to-purple-600" },
    LIBUR: { icon: Moon, tone: "from-slate-500 to-slate-600" },
};

const todayKey = () => dayjs().format("YYYY-MM-DD");
const hhmmOf = (ms: number) => dayjs(ms).format("HH:mm");
const firstNameOf = (name?: string | null) => String(name || "").trim().split(/\s+/)[0] || "kamu";
const shortDate = (key: string) => { const d = dayjs(key); return `${HARI[d.day()]}, ${d.date()} ${BULAN[d.month()]}`; };

type Upcoming = UpcomingTasks & { receivedAt: number };

/** Buka pemilih shift dari mana saja (mis. chip di Papan Tugas / daftar tugas PIN). */
export function openShiftPicker() {
    window.dispatchEvent(new Event(OPEN_EVENT));
}

// Penanda disimpan per identitas (akun "u:18" / PIN "d:4") — perangkat kerja dipakai bergantian.
function readSnooze(identity: string, dateKey: string): number {
    try {
        const [k, until] = (sessionStorage.getItem(`piket-checkin-snooze:${identity}`) || "").split("|");
        return k === dateKey ? Number(until) || 0 : 0;
    } catch {
        return 0;
    }
}
function writeSnooze(identity: string, dateKey: string) {
    try { sessionStorage.setItem(`piket-checkin-snooze:${identity}`, `${dateKey}|${Date.now() + SNOOZE_MS}`); } catch { /* abaikan */ }
}
/** Pengingat yang sudah ditutup (per identitas, per kartu) — tetap tersembunyi setelah muat ulang. */
function readDismissed(identity: string): number[] {
    try {
        const v = JSON.parse(localStorage.getItem(`piket-reminder-dismissed:${identity}`) || "[]");
        return Array.isArray(v) ? v.filter((x) => typeof x === "number") : [];
    } catch {
        return [];
    }
}
function writeDismissed(identity: string, ids: number[]) {
    try { localStorage.setItem(`piket-reminder-dismissed:${identity}`, JSON.stringify(ids.slice(-100))); } catch { /* abaikan */ }
}

interface MutLike<V> {
    mutate(v: V, opts?: { onSuccess?: () => void }): void;
    isPending: boolean;
    isError: boolean;
    variables?: V;
}

interface PiketPopupsProps {
    identity: string;
    firstName: string;
    /** Tautan ke Papan Tugas — hanya untuk login akun (halaman PIN tak bisa membukanya). */
    boardLink: boolean;
    day?: PiketMyDay;
    dayReady: boolean;
    refetchDay: () => void;
    warnings: MyTaskWarning[];
    warningsReady: boolean;
    upcoming?: Upcoming;
    upcomingReady: boolean;
    checkin: MutLike<ShiftChoice>;
    ack: MutLike<number[]>;
    done: MutLike<number>;
    /** Mode PIN: buka daftar tugas hari ini (dari pop-up teguran). */
    onOpenTasks?: () => void;
}

/**
 * Inti pop-up piket untuk SATU orang (tak pernah milik orang lain), berurutan:
 * 1) teguran (wajib "Saya mengerti"), 2) pilih shift hari ini, 3) pengingat
 * 15 menit sebelum jam batas. Sumber data: akun login atau PIN karyawan.
 */
function PiketPopups(p: PiketPopupsProps) {
    const [forceOpen, setForceOpen] = useState(false);
    const [now, setNow] = useState(() => Date.now());
    const [snoozeTick, setSnoozeTick] = useState(0);
    const [dismissedLocal, setDismissedLocal] = useState<{ identity?: string; ids: number[] }>({ ids: [] });

    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 20_000); // cukup rapat utk pengingat per menit
        const open = () => setForceOpen(true);
        window.addEventListener(OPEN_EVENT, open);
        return () => { clearInterval(t); window.removeEventListener(OPEN_EVENT, open); };
    }, []);

    // Data dari cache persisten bisa milik hari kemarin → minta ulang.
    const day = p.day;
    const stale = !!day && day.dateKey !== todayKey();
    useEffect(() => { if (stale) p.refetchDay(); }, [stale, now]); // eslint-disable-line react-hooks/exhaustive-deps

    // 1) Teguran — hanya hasil yang diambil setelah halaman dibuka (bukan sisa cache).
    const warnings = p.warningsReady ? p.warnings : [];
    if (warnings.length > 0) {
        const ids = warnings.map((w) => w.id);
        return (
            <WarningsModal
                first={p.firstName}
                warnings={warnings}
                pending={p.ack.isPending}
                error={p.ack.isError}
                boardLink={p.boardLink}
                onAck={() => p.ack.mutate(ids)}
                onOpenTasks={p.onOpenTasks ? () => { p.ack.mutate(ids); p.onOpenTasks?.(); } : undefined}
            />
        );
    }

    // 2) Pilih shift hari ini.
    void snoozeTick; // re-render setelah "Nanti saja"
    const mustPick = !!day && !day.checkin;
    const showPicker = !!day && !stale && p.dayReady && day.needsCheckin &&
        (forceOpen || (mustPick && readSnooze(p.identity, day.dateKey) <= now));
    if (showPicker && day) {
        return (
            <ShiftPickerModal
                day={day}
                first={p.firstName}
                pending={p.checkin.isPending ? p.checkin.variables : undefined}
                error={p.checkin.isError}
                onPick={(s) => p.checkin.mutate(s, { onSuccess: () => setForceOpen(false) })}
                onLater={mustPick ? () => {
                    writeSnooze(p.identity, day.dateKey);
                    setForceOpen(false);
                    setSnoozeTick((n) => n + 1);
                } : undefined}
                onClose={!mustPick ? () => setForceOpen(false) : undefined}
            />
        );
    }

    // 3) Pengingat ramah: mulai X menit sebelum jam batas sampai teguran otomatis.
    const up = p.upcomingReady ? p.upcoming : undefined;
    if (!up) return null;
    const dismissed = dismissedLocal.identity === p.identity ? dismissedLocal.ids : readDismissed(p.identity);
    const nowSrv = now + (new Date(up.serverNow).getTime() - up.receivedAt); // koreksi jam perangkat
    const reminders = up.items.filter((it) => {
        if (it.status === "DONE" || !it.dueDate || dismissed.includes(it.id)) return false;
        const due = new Date(it.dueDate).getTime();
        return nowSrv >= due - up.remindBeforeMinutes * 60000 && nowSrv < due + up.graceMinutes * 60000;
    });
    if (reminders.length === 0) return null;
    return (
        <ReminderCard
            items={reminders}
            nowSrv={nowSrv}
            graceMinutes={up.graceMinutes}
            trial={!!day?.trialUntil}
            boardLink={p.boardLink}
            pendingId={p.done.isPending ? p.done.variables : undefined}
            error={p.done.isError}
            onDone={(id) => p.done.mutate(id)}
            onDismiss={() => {
                const next = [...dismissed, ...reminders.map((r) => r.id)];
                setDismissedLocal({ identity: p.identity, ids: next });
                writeDismissed(p.identity, next);
            }}
        />
    );
}

// ─── Sumber: akun login (dashboard & halaman ber-sidebar) ────────────────────────
function useMyId(): number | undefined {
    const { currentUser } = useCurrentUser();
    return (currentUser as { id?: number } | undefined)?.id;
}

function useMyDay(uid: number | undefined) {
    return useQuery({
        queryKey: ["piket-my-day", uid],
        queryFn: getPiketMyDay,
        enabled: !!uid,
        // Selalu dianggap usang: saat halaman dibuka id user baru tersedia setelah
        // cache persisten dipulihkan (kunci query berganti) → harus ambil ulang.
        staleTime: 0,
        refetchOnMount: "always",
        refetchInterval: 5 * 60_000,
        refetchOnWindowFocus: true,
    });
}

/** Pop-up piket untuk karyawan yang login akun (dipasang di MainLayout). */
export function PiketDailyGate() {
    const uid = useMyId();
    const { currentUser } = useCurrentUser();
    const qc = useQueryClient();

    const dayQ = useMyDay(uid);
    const warnQ = useQuery({
        queryKey: ["piket-my-warnings", uid],
        queryFn: getMyTaskWarnings,
        enabled: !!uid,
        staleTime: 0, // teguran baru harus langsung tampil saat halaman dibuka
        refetchOnMount: "always",
        refetchInterval: 60_000,
        refetchOnWindowFocus: true,
    });
    const upQ = useQuery({
        queryKey: ["piket-upcoming", uid],
        // receivedAt → selisih jam perangkat vs server bisa dikoreksi.
        queryFn: async (): Promise<Upcoming> => ({ ...(await getMyUpcomingTasks()), receivedAt: Date.now() }),
        enabled: !!uid,
        staleTime: 0,
        refetchOnMount: "always",
        refetchInterval: 5 * 60_000,
        refetchOnWindowFocus: true,
    });

    const checkinMut = useMutation({
        mutationFn: piketCheckin,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["piket-my-day"] });
            qc.invalidateQueries({ queryKey: ["task-items"] });
            qc.invalidateQueries({ queryKey: ["piket-upcoming"] });
            qc.invalidateQueries({ queryKey: ["piket-today"] });
        },
    });
    const ackMut = useMutation({
        mutationFn: (ids: number[]) => ackMyTaskWarnings(ids),
        onSuccess: () => {
            qc.setQueryData(["piket-my-warnings", uid], []);
            qc.invalidateQueries({ queryKey: ["piket-my-warnings"] });
        },
    });
    const doneMut = useMutation({
        mutationFn: (id: number) => updateTaskItem(id, { status: "DONE" }),
        onSuccess: (_d, id) => {
            qc.setQueryData<Upcoming>(["piket-upcoming", uid], (old) => old ? { ...old, items: old.items.filter((i) => i.id !== id) } : old);
            qc.invalidateQueries({ queryKey: ["task-items"] });
            qc.invalidateQueries({ queryKey: ["piket-upcoming"] });
            qc.invalidateQueries({ queryKey: ["piket-today"] });
        },
    });

    if (!uid) return null;
    return (
        <PiketPopups
            identity={`u:${uid}`}
            firstName={firstNameOf((currentUser as { name?: string } | undefined)?.name)}
            boardLink
            day={dayQ.data}
            dayReady={dayQ.isFetchedAfterMount}
            refetchDay={() => { void dayQ.refetch(); }}
            warnings={warnQ.data ?? []}
            warningsReady={warnQ.isFetchedAfterMount}
            upcoming={upQ.data}
            upcomingReady={upQ.isFetchedAfterMount}
            checkin={checkinMut}
            ack={ackMut}
            done={doneMut}
        />
    );
}

// ─── Sumber: PIN karyawan (/so-designer, /produksi, /cetak — tanpa login akun) ──
type PinState = PinPiketState & { receivedAt: number };

/** Data + aksi piket untuk pengguna PIN — dipakai pop-up & kartu "Piket hari ini" (cache sama). */
function usePinPiket(designerId: number, pin: string) {
    const qc = useQueryClient();
    const key = ["piket-pin-state", designerId];

    const q = useQuery({
        queryKey: key,
        queryFn: async (): Promise<PinState> => ({ ...(await getPinPiketState(designerId, pin)), receivedAt: Date.now() }),
        staleTime: 0,
        refetchOnMount: "always",
        refetchInterval: 60_000,
        refetchOnWindowFocus: true,
        retry: false,
    });
    const refresh = () => { void qc.invalidateQueries({ queryKey: ["piket-pin-state", designerId] }); };

    const checkinMut = useMutation({
        mutationFn: (s: ShiftChoice) => pinPiketCheckin(designerId, pin, s),
        onSuccess: refresh,
    });
    const ackMut = useMutation({
        mutationFn: (ids: number[]) => pinAckTaskWarnings(designerId, pin, ids),
        onSuccess: () => {
            qc.setQueryData<PinState>(key, (old) => (old && old.linked ? { ...old, warnings: [] } : old));
            refresh();
        },
    });
    const doneMut = useMutation({
        mutationFn: (id: number) => pinCompleteTask(designerId, pin, id),
        onSuccess: (_d, id) => {
            qc.setQueryData<PinState>(key, (old) => (old && old.linked ? {
                ...old,
                upcoming: { ...old.upcoming, items: old.upcoming.items.filter((i) => i.id !== id) },
                today: old.today.map((t) => (t.id === id ? { ...t, status: "DONE" as const, completedAt: new Date().toISOString() } : t)),
            } : old));
            refresh();
        },
    });

    const data = q.data && q.data.linked ? q.data : undefined;
    return { data, ready: q.isFetchedAfterMount, refresh, checkinMut, ackMut, doneMut };
}

/**
 * Pop-up piket + tombol "Tugas piket" untuk pengguna PIN. Data selalu milik akun
 * tugas yang terhubung ke PIN itu (Pengaturan → Desainer → Akun tugas).
 */
// Kanan-bawah: kiri-bawah halaman PIN sudah dipakai tombol ganti tema.
export function PiketPinGate({ designerId, pin, taskButtonClassName = "bottom-4 right-4" }: {
    designerId: number; pin: string; taskButtonClassName?: string;
}) {
    const [tasksOpen, setTasksOpen] = useState(false);
    const [boardOpen, setBoardOpen] = useState(false);
    const { data, ready, refresh, checkinMut, ackMut, doneMut } = usePinPiket(designerId, pin);
    if (!data) return null;
    return (
        <>
            <PiketPopups
                identity={`d:${designerId}`}
                firstName={firstNameOf(data.name)}
                boardLink={false}
                day={data.day}
                dayReady={ready}
                refetchDay={refresh}
                warnings={data.warnings}
                warningsReady={ready}
                upcoming={{ ...data.upcoming, receivedAt: data.receivedAt }}
                upcomingReady={ready}
                checkin={checkinMut}
                ack={ackMut}
                done={doneMut}
                onOpenTasks={() => setTasksOpen(true)}
            />
            {ready && (
                <TodayTasksPill tasks={data.today} day={data.day} className={taskButtonClassName} onClick={() => setTasksOpen(true)} />
            )}
            {tasksOpen && (
                <TodayTasksSheet
                    first={firstNameOf(data.name)}
                    day={data.day}
                    tasks={data.today}
                    pendingId={doneMut.isPending ? doneMut.variables : undefined}
                    error={doneMut.isError}
                    onDone={(id) => doneMut.mutate(id)}
                    onChangeShift={() => { setTasksOpen(false); openShiftPicker(); }}
                    onOpenBoard={() => { setTasksOpen(false); setBoardOpen(true); }}
                    onClose={() => setTasksOpen(false)}
                />
            )}
            {boardOpen && <PiketBoardModal designerId={designerId} pin={pin} onClose={() => setBoardOpen(false)} />}
        </>
    );
}

// ─── Tampilan ────────────────────────────────────────────────────────────────────
function WarningsModal({ first, warnings, pending, error, boardLink, onAck, onOpenTasks }: {
    first: string; warnings: MyTaskWarning[]; pending: boolean; error: boolean; boardLink: boolean;
    onAck: () => void; onOpenTasks?: () => void;
}) {
    const secondaryCls = "inline-flex flex-1 items-center justify-center rounded-xl border border-slate-300 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800";
    return (
        <div role="dialog" aria-modal="true" aria-labelledby="piket-warn-title"
            className="fixed inset-0 z-[85] flex items-end justify-center bg-slate-950/70 backdrop-blur-sm sm:items-center sm:p-4">
            <div className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl dark:bg-slate-900 sm:max-w-md sm:rounded-3xl">
                <div className="bg-gradient-to-br from-rose-600 via-red-500 to-orange-500 px-6 pb-5 pt-6 text-center text-white">
                    <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-white/20 ring-4 ring-white/25">
                        <BellRing className="h-7 w-7" />
                    </div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-white/85">Teguran untuk {first}</p>
                    <h2 id="piket-warn-title" className="mt-1 text-xl font-extrabold">
                        {warnings.length > 1 ? `Ada ${warnings.length} teguran tugas` : "Ada tugas yang perlu perhatian"}
                    </h2>
                    <p className="mt-1 text-xs text-white/90">Pesan ini hanya terlihat oleh kamu.</p>
                </div>

                <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-5">
                    {warnings.map((w) => (
                        <div key={w.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
                            <div className="flex items-center justify-between gap-2 text-[11px]">
                                <span className={`rounded-full px-2 py-0.5 font-semibold ${w.kind === "AUTO" ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300" : "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"}`}>
                                    {w.kind === "AUTO" ? "Otomatis · lewat batas" : `Dari ${w.createdByName || "Owner"}`}
                                </span>
                                <span className="text-slate-500 dark:text-slate-400">{dayjs(w.createdAt).format("DD/MM HH:mm")}</span>
                            </div>
                            <p className="mt-1.5 whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-100">{w.message}</p>
                            {w.item?.status === "DONE" && (
                                <p className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                    <CheckCircle2 className="h-3.5 w-3.5" /> Tugas ini sudah kamu selesaikan
                                </p>
                            )}
                        </div>
                    ))}
                </div>

                <div className="space-y-2 border-t border-slate-200 p-4 dark:border-slate-700">
                    {error && <p className="text-center text-xs font-medium text-rose-600">Gagal menyimpan. Coba lagi.</p>}
                    <div className="flex flex-col-reverse gap-2 sm:flex-row">
                        {boardLink ? (
                            <Link href="/tugas" onClick={onAck} className={secondaryCls}>Buka Papan Tugas</Link>
                        ) : onOpenTasks ? (
                            <button type="button" onClick={onOpenTasks} className={secondaryCls}>Lihat tugas saya</button>
                        ) : null}
                        <button type="button" onClick={onAck} disabled={pending}
                            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-orange-500 py-2.5 text-sm font-semibold text-white shadow-lg shadow-rose-500/25 transition hover:from-rose-700 hover:to-orange-600 disabled:opacity-60">
                            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Saya mengerti
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ShiftPickerModal({ day, first, pending, error, onPick, onLater, onClose }: {
    day: PiketMyDay; first: string; pending?: ShiftChoice; error: boolean;
    onPick: (s: ShiftChoice) => void; onLater?: () => void; onClose?: () => void;
}) {
    const d = dayjs(day.dateKey);
    const dateLabel = `${HARI[d.day()]}, ${d.date()} ${BULAN[d.month()]} ${d.year()}`;
    const choices: ShiftChoice[] = [
        ...(["PAGI", "KEDUA"] as const).filter((s) => day.slots.includes(s)),
        "LIBUR",
    ];

    return (
        <div role="dialog" aria-modal="true" aria-labelledby="piket-shift-title"
            className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/70 backdrop-blur-sm sm:items-center sm:p-4">
            <div className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl dark:bg-slate-900 sm:max-w-md sm:rounded-3xl">
                <div className="bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 px-6 pb-5 pt-6 text-center text-white">
                    <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-white/20 ring-4 ring-white/25">
                        <CalendarCheck className="h-7 w-7" />
                    </div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-white/85">{dateLabel}</p>
                    <h2 id="piket-shift-title" className="mt-1 text-xl font-extrabold">Halo {first}, hari ini masuk shift apa?</h2>
                    <p className="mt-1 text-xs text-white/90">
                        {day.trialUntil
                            ? `Masa uji coba s/d ${shortDate(day.trialUntil)} — lihat dulu tugasmu, boleh dilewati.`
                            : "Pilih supaya checklist piket kamu muncul."}
                    </p>
                </div>

                <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-5">
                    {choices.map((s) => {
                        const Icon = SHIFT_META[s].icon;
                        const tasks = day.tasksBySlot?.[s] ?? [];
                        const current = day.checkin?.shift === s;
                        return (
                            <button key={s} type="button" onClick={() => onPick(s)} disabled={!!pending}
                                className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition disabled:opacity-60 ${current ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/30 dark:bg-emerald-950/30" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/60"}`}>
                                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white ${SHIFT_META[s].tone}`}>
                                    {pending === s ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon className="h-5 w-5" />}
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
                                        {SHIFT_LABEL[s]}
                                        {current && <span className="rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">Pilihan kamu</span>}
                                    </span>
                                    <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                                        {s === "LIBUR" ? "Tidak masuk hari ini — tidak ada checklist shift." : tasks.length ? tasks.join(" · ") : "Checklist shift"}
                                    </span>
                                </span>
                            </button>
                        );
                    })}
                    {error && <p className="text-center text-xs font-medium text-rose-600">Gagal menyimpan pilihan. Coba lagi.</p>}
                    {day.checkin && (
                        <p className="text-center text-[11px] text-slate-500 dark:text-slate-400">
                            Mengganti shift menghapus checklist shift lain yang belum dikerjakan.
                        </p>
                    )}
                </div>

                {(onLater || onClose) && (
                    <div className="border-t border-slate-200 p-3 text-center dark:border-slate-700">
                        <button type="button" onClick={onLater ?? onClose}
                            className="text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200">
                            {onLater ? "Nanti saja (30 menit)" : "Tutup"}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

function ReminderCard({ items, nowSrv, graceMinutes, trial, boardLink, pendingId, error, onDone, onDismiss }: {
    items: UpcomingTasks["items"]; nowSrv: number; graceMinutes: number; trial: boolean; boardLink: boolean;
    pendingId?: number; error: boolean; onDone: (id: number) => void; onDismiss: () => void;
}) {
    return (
        <div role="status" aria-live="polite" className="fixed inset-x-3 top-20 z-[70] sm:inset-x-auto sm:right-6 sm:w-96">
            <div className="overflow-hidden rounded-2xl border border-amber-300 bg-white shadow-2xl shadow-amber-500/10 dark:border-amber-800 dark:bg-slate-900">
                <div className="flex items-center gap-2 bg-gradient-to-r from-amber-400 to-orange-400 px-4 py-2.5 text-white">
                    <AlarmClock className="h-5 w-5 shrink-0" />
                    <p className="flex-1 text-sm font-bold">Pengingat tugas</p>
                    <button type="button" onClick={onDismiss} aria-label="Tutup pengingat" className="rounded-full p-1 transition hover:bg-white/20">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
                    {items.map((it) => {
                        const due = new Date(it.dueDate as string).getTime();
                        const mins = Math.ceil((due - nowSrv) / 60000);
                        return (
                            <li key={it.id} className="flex items-center gap-3 px-4 py-2.5">
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{it.title}</p>
                                    <p className="text-xs text-amber-700 dark:text-amber-400">
                                        {mins > 0
                                            ? `Batas pukul ${hhmmOf(due)} · ${mins} menit lagi`
                                            : trial
                                                ? `Batas ${hhmmOf(due)} lewat · masa uji coba, tidak ada teguran`
                                                : `Batas ${hhmmOf(due)} lewat · centang sebelum ${hhmmOf(due + graceMinutes * 60000)} agar tidak ditegur`}
                                    </p>
                                </div>
                                <DoneButton pending={pendingId === it.id} onClick={() => onDone(it.id)} />
                            </li>
                        );
                    })}
                </ul>
                {error && <p className="px-4 pt-2 text-xs font-medium text-rose-600">Gagal menandai selesai. Coba lagi.</p>}
                <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-4 py-2 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    <span>{trial ? "Masa uji coba — boleh dicentang atau dilewati." : "Pengingat ini bukan teguran."}</span>
                    {boardLink && <Link href="/tugas" className="font-semibold text-amber-700 hover:underline dark:text-amber-400">Buka Papan Tugas</Link>}
                </div>
            </div>
        </div>
    );
}

function DoneButton({ pending, onClick }: { pending: boolean; onClick: () => void }) {
    return (
        <button type="button" onClick={onClick} disabled={pending}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60">
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            <span>Selesai</span>
        </button>
    );
}

/** Tombol mengambang di halaman PIN: jumlah tugas piket hari ini. */
function TodayTasksPill({ tasks, day, className, onClick }: {
    tasks: PinTodayTask[]; day: PiketMyDay; className: string; onClick: () => void;
}) {
    const total = tasks.length;
    const done = tasks.filter((t) => t.status === "DONE").length;
    const needPick = day.needsCheckin && !day.checkin;
    if (!total && !needPick) return null;
    const allDone = total > 0 && done === total;
    const tone = needPick
        ? "bg-rose-600 text-white ring-rose-700"
        : allDone
            ? "bg-emerald-600 text-white ring-emerald-700"
            : "bg-white text-slate-800 ring-slate-200 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-700";
    return (
        <button type="button" onClick={onClick}
            className={`fixed z-[60] inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold shadow-lg ring-1 transition hover:scale-[1.02] ${tone} ${className}`}>
            <ClipboardList className="h-4 w-4" />
            <span>{needPick ? "Pilih shift piket" : `Tugas piket ${done}/${total}`}</span>
        </button>
    );
}

/** Daftar checklist hari ini untuk pengguna PIN — dicentang langsung tanpa Papan Tugas. */
function TodayTasksSheet({ first, day, tasks, pendingId, error, onDone, onChangeShift, onOpenBoard, onClose }: {
    first: string; day: PiketMyDay; tasks: PinTodayTask[]; pendingId?: number; error: boolean;
    onDone: (id: number) => void; onChangeShift: () => void; onOpenBoard: () => void; onClose: () => void;
}) {
    const done = tasks.filter((t) => t.status === "DONE").length;
    return (
        <div role="dialog" aria-modal="true" aria-labelledby="piket-today-title" onClick={onClose}
            className="fixed inset-0 z-[75] flex items-end justify-center bg-slate-950/60 backdrop-blur-sm sm:items-center sm:p-4">
            <div onClick={(e) => e.stopPropagation()}
                className="flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl dark:bg-slate-900 sm:max-w-md sm:rounded-3xl">
                <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
                        <ClipboardList className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                        <p id="piket-today-title" className="text-sm font-bold text-slate-800 dark:text-slate-100">Tugas piket {first} hari ini</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{done}/{tasks.length} selesai</p>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Tutup daftar tugas"
                        className="rounded-full p-1.5 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {day.needsCheckin && (
                    <div className="flex items-center justify-between gap-2 bg-emerald-50 px-5 py-2 text-xs dark:bg-emerald-950/30">
                        <span className="text-slate-700 dark:text-slate-200">
                            {day.checkin
                                ? <span>Shift hari ini: <b>{SHIFT_LABEL[day.checkin.shift]}</b></span>
                                : <b className="text-rose-600">Belum pilih shift</b>}
                        </span>
                        <button type="button" onClick={onChangeShift} className="font-semibold text-emerald-700 hover:underline dark:text-emerald-400">
                            {day.checkin ? "Ganti shift" : "Pilih shift"}
                        </button>
                    </div>
                )}

                <ul className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
                    {tasks.length === 0 ? (
                        <li className="px-5 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                            {day.needsCheckin && !day.checkin ? "Pilih shift dulu supaya checklist piket muncul." : "Tidak ada tugas hari ini."}
                        </li>
                    ) : tasks.map((t) => {
                        const isDone = t.status === "DONE";
                        return (
                            <li key={t.id} className="flex items-center gap-3 px-5 py-3">
                                {isDone
                                    ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                                    : <span className="h-5 w-5 shrink-0 rounded-full border-2 border-slate-300 dark:border-slate-600" />}
                                <div className="min-w-0 flex-1">
                                    <p className={`text-sm font-semibold ${isDone ? "text-slate-400 line-through" : "text-slate-800 dark:text-slate-100"}`}>{t.title}</p>
                                    {!isDone && t.description && (
                                        <p className="line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{t.description}</p>
                                    )}
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        {isDone
                                            ? `Selesai ${t.completedAt ? dayjs(t.completedAt).format("HH:mm") : ""}`.trim()
                                            : t.dueDate ? `Batas ${dayjs(t.dueDate).format("HH:mm")}` : "Tanpa jam batas"}
                                    </p>
                                </div>
                                {!isDone && <DoneButton pending={pendingId === t.id} onClick={() => onDone(t.id)} />}
                            </li>
                        );
                    })}
                </ul>
                {error && <p className="px-5 pb-3 text-xs font-medium text-rose-600">Gagal menandai selesai. Coba lagi.</p>}
                <div className="border-t border-slate-200 px-5 py-3 dark:border-slate-700">
                    {day.trialUntil && (
                        <p className="mb-2 text-center text-[11px] text-amber-700 dark:text-amber-300">
                            Masa uji coba s/d {shortDate(day.trialUntil)} — boleh dicentang atau dilewati, belum ada teguran.
                        </p>
                    )}
                    <button type="button" onClick={onOpenBoard}
                        className="w-full rounded-xl border border-slate-300 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                        Lihat papan piket &amp; aturan
                    </button>
                </div>
            </div>
        </div>
    );
}

/** Chip kecil di Papan Tugas: shift hari ini + tombol ganti. */
export function MyShiftChip() {
    const uid = useMyId();
    const { data } = useMyDay(uid);
    if (!data?.needsCheckin || data.dateKey !== todayKey()) return null;
    return (
        <button type="button" onClick={openShiftPicker}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition ${data.checkin ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300" : "border-rose-500/40 bg-rose-500/10 text-rose-700 hover:bg-rose-500/15 dark:text-rose-300"}`}>
            <CalendarCheck className="h-3.5 w-3.5" />
            {data.checkin
                ? <span>Hari ini: <b>{SHIFT_LABEL[data.checkin.shift]}</b> · Ganti</span>
                : <b>Pilih shift hari ini</b>}
        </button>
    );
}

// ─── Kartu "Piket hari ini" di halaman kerja ─────────────────────────────────────
/** Checklist piket hari ini (dashboard CS, /so-designer, /produksi, /cetak). */
function PiketTodayCard({ first, day, tasks, pendingId, error, onDone, onPickShift, boardHref, onOpenBoard, className = "" }: {
    first: string; day: PiketMyDay; tasks: PinTodayTask[]; pendingId?: number; error: boolean;
    onDone: (id: number) => void; onPickShift: () => void; boardHref?: string; onOpenBoard?: () => void; className?: string;
}) {
    const [showDone, setShowDone] = useState(false);
    const open = tasks.filter((t) => t.status !== "DONE");
    const doneTasks = tasks.filter((t) => t.status === "DONE");
    const needPick = day.needsCheckin && !day.checkin;

    // Belum ada piket hari ini → info kapan jadwal piket mulai (kalau ada).
    if (!tasks.length && !day.needsCheckin) {
        if (!day.startsOn) return null;
        const d = dayjs(day.startsOn);
        return (
            <div className={`flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 ${className}`}>
                <ClipboardList className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <p className="text-sm text-foreground">
                    Jadwal piket kamu mulai <b>{HARI[d.day()]}, {d.date()} {BULAN[d.month()]} {d.year()}</b>. Checklist, pengingat &amp; teguran piket akan muncul di sini.
                </p>
            </div>
        );
    }

    return (
        <section aria-label="Piket hari ini" className={`overflow-hidden rounded-2xl border border-border bg-card shadow-sm ${className}`}>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-border px-4 py-2.5">
                <ClipboardList className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <h2 className="text-sm font-bold text-foreground">Piket hari ini</h2>
                {day.checkin && (
                    <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                        {SHIFT_LABEL[day.checkin.shift]}
                    </span>
                )}
                <span className="ml-auto text-xs text-muted-foreground">{tasks.length > 0 ? `${doneTasks.length}/${tasks.length} selesai` : ""}</span>
                {day.checkin && (
                    <button type="button" onClick={onPickShift} className="text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400">
                        Ganti shift
                    </button>
                )}
            </div>

            {day.trialUntil && (
                <p className="border-b border-border bg-amber-500/10 px-4 py-1.5 text-xs text-amber-800 dark:text-amber-200">
                    Masa uji coba s/d {shortDate(day.trialUntil)} — lihat dulu tugasmu, boleh dicentang atau dilewati. Belum ada teguran.
                </p>
            )}

            {needPick && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-rose-500/5 px-4 py-2.5">
                    <span className="text-sm text-foreground">Halo {first}, pilih shift hari ini supaya checklist piketmu muncul.</span>
                    <button type="button" onClick={onPickShift}
                        className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-700">
                        Pilih shift
                    </button>
                </div>
            )}

            {open.length > 0 ? (
                <ul className="divide-y divide-border/60">
                    {open.map((t) => (
                        <li key={t.id} className="flex items-center gap-3 px-4 py-2">
                            <span className="h-4 w-4 shrink-0 rounded-full border-2 border-muted-foreground/40" />
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-foreground">{t.title}</p>
                                <p className="text-xs text-muted-foreground">{t.dueDate ? `Batas ${dayjs(t.dueDate).format("HH:mm")}` : "Tanpa jam batas"}</p>
                            </div>
                            <DoneButton pending={pendingId === t.id} onClick={() => onDone(t.id)} />
                        </li>
                    ))}
                </ul>
            ) : tasks.length > 0 ? (
                <p className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="h-4 w-4 shrink-0" /> Semua piket hari ini sudah selesai. Terima kasih, {first}!
                </p>
            ) : !needPick ? (
                <p className="px-4 py-2.5 text-sm text-muted-foreground">
                    {day.checkin?.shift === "LIBUR" ? "Libur / izin hari ini — tidak ada checklist piket." : "Tidak ada tugas piket hari ini."}
                </p>
            ) : null}

            {doneTasks.length > 0 && open.length > 0 && (
                <>
                    <button type="button" onClick={() => setShowDone((v) => !v)}
                        className="w-full border-t border-border px-4 py-1.5 text-left text-xs text-muted-foreground transition hover:text-foreground">
                        {showDone ? "Sembunyikan" : "Lihat"} {doneTasks.length} tugas yang sudah selesai
                    </button>
                    {showDone && (
                        <ul className="divide-y divide-border/60 border-t border-border">
                            {doneTasks.map((t) => (
                                <li key={t.id} className="flex items-center gap-3 px-4 py-1.5">
                                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                                    <span className="flex-1 truncate text-sm text-muted-foreground line-through">{t.title}</span>
                                    <span className="text-xs text-muted-foreground">{t.completedAt ? dayjs(t.completedAt).format("HH:mm") : ""}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </>
            )}
            {error && <p className="px-4 pb-2 text-xs font-medium text-rose-600">Gagal menandai selesai. Coba lagi.</p>}
            {(boardHref || onOpenBoard) && (
                <div className="border-t border-border px-4 py-1.5 text-right">
                    {boardHref ? (
                        <Link href={boardHref} className="text-xs font-semibold text-primary hover:underline">Lihat papan piket semua karyawan →</Link>
                    ) : (
                        <button type="button" onClick={onOpenBoard} className="text-xs font-semibold text-primary hover:underline">Lihat papan piket semua karyawan →</button>
                    )}
                </div>
            )}
        </section>
    );
}

/** Kartu piket hari ini untuk karyawan yang login akun (mis. dashboard CS). */
export function MyPiketCard({ className }: { className?: string }) {
    const uid = useMyId();
    const { currentUser } = useCurrentUser();
    const qc = useQueryClient();
    const dayQ = useMyDay(uid);
    const todayQ = useQuery({
        queryKey: ["piket-today", uid],
        queryFn: getMyTodayTasks,
        enabled: !!uid,
        staleTime: 0,
        refetchOnMount: "always",
        refetchInterval: 2 * 60_000,
        refetchOnWindowFocus: true,
    });
    const doneMut = useMutation({
        mutationFn: (id: number) => updateTaskItem(id, { status: "DONE" }),
        onSuccess: (_d, id) => {
            qc.setQueryData<PinTodayTask[]>(["piket-today", uid], (old) =>
                old?.map((t) => (t.id === id ? { ...t, status: "DONE" as const, completedAt: new Date().toISOString() } : t)));
            qc.invalidateQueries({ queryKey: ["piket-today"] });
            qc.invalidateQueries({ queryKey: ["piket-upcoming"] });
            qc.invalidateQueries({ queryKey: ["task-items"] });
        },
    });

    const day = dayQ.data;
    if (!uid || !day || !dayQ.isFetchedAfterMount || !todayQ.isFetchedAfterMount || day.dateKey !== todayKey()) return null;
    return (
        <PiketTodayCard
            first={firstNameOf((currentUser as { name?: string } | undefined)?.name)}
            day={day}
            tasks={todayQ.data ?? []}
            pendingId={doneMut.isPending ? doneMut.variables : undefined}
            error={doneMut.isError}
            onDone={(id) => doneMut.mutate(id)}
            onPickShift={openShiftPicker}
            boardHref="/tugas/papan-piket"
            className={className}
        />
    );
}

/** Kartu piket hari ini untuk pengguna PIN (/so-designer, /produksi, /cetak). */
export function PiketPinCard({ designerId, pin, className }: { designerId: number; pin: string; className?: string }) {
    const { data, ready, doneMut } = usePinPiket(designerId, pin);
    const [boardOpen, setBoardOpen] = useState(false);
    if (!data || !ready) return null;
    return (
        <>
        {boardOpen && <PiketBoardModal designerId={designerId} pin={pin} onClose={() => setBoardOpen(false)} />}
        <PiketTodayCard
            first={firstNameOf(data.name)}
            day={data.day}
            tasks={data.today}
            pendingId={doneMut.isPending ? doneMut.variables : undefined}
            error={doneMut.isError}
            onDone={(id) => doneMut.mutate(id)}
            onPickShift={openShiftPicker}
            onOpenBoard={() => setBoardOpen(true)}
            className={className}
        />
        </>
    );
}
