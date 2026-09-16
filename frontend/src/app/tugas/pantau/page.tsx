"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import dayjs from "dayjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    getTaskMonitor, getTaskRecap, sendTaskWarning, getPiketTrial, setPiketTrial, downloadPiketPdf, SHIFT_LABEL,
    type MonitorItem, type MonitorRow, type ShiftChoice,
} from "@/lib/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { PiketPlanView } from "@/components/tugas/PiketBoard";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import {
    AlertTriangle, ArrowLeft, BellRing, CalendarClock, CheckCircle2, ChevronLeft, ChevronRight,
    CircleDashed, ClipboardCheck, Clock, Download, Loader2, Lock, RefreshCw, X,
} from "lucide-react";

const SHIFT_TONE: Record<ShiftChoice, string> = {
    PAGI: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    KEDUA: "border-indigo-500/40 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
    LIBUR: "border-slate-400/40 bg-slate-500/10 text-slate-600 dark:text-slate-300",
};

export default function PantauPiketPage() {
    const { canAssignTasks, currentUser } = useCurrentUser();
    const [tab, setTab] = useState<"harian" | "rekap">("harian");

    if (currentUser === undefined) {
        return <div className="flex items-center justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
    }
    if (!canAssignTasks) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-center px-4">
                <div className="h-14 w-14 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center mb-4"><Lock className="h-7 w-7" /></div>
                <h1 className="text-xl font-bold text-foreground">Khusus Owner / Manajer</h1>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">Pemantauan piket & teguran hanya untuk owner atau manajer.</p>
                <Link href="/tugas" className="mt-5 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"><ArrowLeft className="h-4 w-4" /> Kembali ke papan tugas</Link>
            </div>
        );
    }

    return (
        <div className="p-4 max-w-5xl mx-auto">
            <PageHeader
                title="Pantau Piket"
                description="Siapa sudah mencentang tugas, siapa terlambat, dan kirim teguran."
                icon={ClipboardCheck}
                breadcrumbs={[{ label: "Papan Tugas", href: "/tugas" }, { label: "Pantau Piket" }]}
                actions={
                    <Button variant="outline" size="sm" asChild>
                        <Link href="/tugas/jadwal"><CalendarClock className="h-4 w-4" /> Jadwal Rutin</Link>
                    </Button>
                }
            />

            <div className="mb-4 inline-flex rounded-lg border border-border bg-card p-0.5 text-sm">
                {([["harian", "Harian"], ["rekap", "Rekap Bulanan"]] as const).map(([v, l]) => (
                    <button key={v} onClick={() => setTab(v)}
                        className={`px-3 py-1 rounded-md transition ${tab === v ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground"}`}>{l}</button>
                ))}
            </div>

            <TrialControl />
            <PdfControl />

            {tab === "harian" ? <DailyView /> : <RecapView />}
        </div>
    );
}

// ─── Masa uji coba ────────────────────────────────────────────────────────────────
function TrialControl() {
    const qc = useQueryClient();
    const { data } = useQuery({ queryKey: ["piket-trial"], queryFn: getPiketTrial });
    const [draft, setDraft] = useState<string | null>(null);
    const mut = useMutation({
        mutationFn: (until: string | null) => setPiketTrial(until),
        onSuccess: () => {
            setDraft(null);
            qc.invalidateQueries({ queryKey: ["piket-trial"] });
            qc.invalidateQueries({ queryKey: ["task-monitor"] });
            qc.invalidateQueries({ queryKey: ["task-recap"] });
        },
    });
    const until = data?.trialUntil ?? null;
    const active = !!until && until >= dayjs().format("YYYY-MM-DD");
    const value = draft ?? until ?? "";
    return (
        <div className={`mb-4 flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 text-sm ${active ? "border-amber-500/40 bg-amber-500/10" : "border-border bg-card"}`}>
            <span className="font-medium text-foreground">
                {active ? `Masa uji coba aktif sampai ${dayjs(until).format("DD/MM/YYYY")}` : "Masa uji coba tidak aktif"}
            </span>
            <span className="text-xs text-muted-foreground">Selama uji coba: tanpa teguran otomatis & tidak dihitung di rekap.</span>
            <div className="ml-auto flex flex-wrap items-center gap-2">
                <input type="date" value={value} onChange={(e) => setDraft(e.target.value)} aria-label="Uji coba sampai tanggal"
                    className="rounded-md border border-border bg-background px-2 py-1 text-sm" />
                <Button size="sm" variant="outline" disabled={!value || value === until || mut.isPending} onClick={() => mut.mutate(value)}>
                    {mut.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Simpan
                </Button>
                {until && (
                    <Button size="sm" variant="ghost" disabled={mut.isPending} onClick={() => mut.mutate(null)}>Akhiri uji coba</Button>
                )}
            </div>
        </div>
    );
}

// ─── PDF jadwal piket (otomatis dari jadwal; sama dengan tombol di Papan Piket) ────
function PdfControl() {
    const mut = useMutation({ mutationFn: downloadPiketPdf });
    return (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm">
            <span className="font-medium text-foreground">PDF jadwal piket</span>
            <span className="text-xs text-muted-foreground">dibuat otomatis dari jadwal, giliran &amp; masa uji coba · tanda tangan diatur di Pengaturan → Umum</span>
            {mut.isError && <span className="text-xs font-medium text-rose-600">Gagal membuat PDF. Coba lagi.</span>}
            <Button size="sm" variant="outline" className="ml-auto" disabled={mut.isPending} onClick={() => mut.mutate()}>
                {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Unduh PDF
            </Button>
        </div>
    );
}

// ─── Harian ────────────────────────────────────────────────────────────────────
function DailyView() {
    const qc = useQueryClient();
    const [date, setDate] = useState(() => dayjs().format("YYYY-MM-DD"));
    const [warnTarget, setWarnTarget] = useState<MonitorRow | null>(null);
    const [sentTo, setSentTo] = useState<string | null>(null);
    const isToday = date === dayjs().format("YYYY-MM-DD");

    const { data, isLoading, isError, refetch, isFetching } = useQuery({
        queryKey: ["task-monitor", date],
        queryFn: () => getTaskMonitor(date),
        refetchInterval: isToday ? 60_000 : false,
    });
    const rows = useMemo(() => data?.rows ?? [], [data]);
    const stats = useMemo(() => ({
        done: rows.reduce((a, r) => a + r.counts.done, 0),
        total: rows.reduce((a, r) => a + r.counts.total, 0),
        overdue: rows.reduce((a, r) => a + r.counts.overdue, 0),
        noShift: rows.filter((r) => r.shiftSlots.length > 0 && !r.checkin).length,
        unread: rows.reduce((a, r) => a + r.warnings.filter((w) => !w.acknowledgedAt).length, 0),
    }), [rows]);

    const move = (n: number) => setDate(dayjs(date).add(n, "day").format("YYYY-MM-DD"));

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="icon-sm" onClick={() => move(-1)} aria-label="Hari sebelumnya"><ChevronLeft className="h-4 w-4" /></Button>
                <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)}
                    className="rounded-md border border-border bg-background px-3 py-1.5 text-sm" />
                <Button variant="outline" size="icon-sm" onClick={() => move(1)} aria-label="Hari berikutnya"><ChevronRight className="h-4 w-4" /></Button>
                {!isToday && <Button variant="ghost" size="sm" onClick={() => setDate(dayjs().format("YYYY-MM-DD"))}>Hari ini</Button>}
                <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}>
                    <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Muat ulang
                </Button>
            </div>

            {sentTo && (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
                    <span>Teguran terkirim ke {sentTo}. Muncul sebagai pop-up saat dia membuka aplikasi.</span>
                    <button onClick={() => setSentTo(null)} aria-label="Tutup"><X className="h-4 w-4" /></button>
                </div>
            )}

            {!data?.plan && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Stat label="Tugas selesai" value={`${stats.done}/${stats.total}`} tone="text-emerald-600 dark:text-emerald-400" />
                    <Stat label="Lewat batas" value={stats.overdue} tone={stats.overdue ? "text-red-600 dark:text-red-400" : "text-foreground"} />
                    <Stat label="Belum pilih shift" value={stats.noShift} tone={stats.noShift ? "text-rose-600 dark:text-rose-400" : "text-foreground"} />
                    <Stat label="Teguran belum dibaca" value={stats.unread} tone={stats.unread ? "text-amber-600 dark:text-amber-400" : "text-foreground"} />
                </div>
            )}
            {data?.plan && <PiketPlanView plan={data.plan} />}
            {data?.trial && (
                <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                    Tanggal ini masih <b>masa uji coba</b> — karyawan boleh mencentang atau melewati, tidak ada teguran otomatis & tidak dihitung di rekap.
                </p>
            )}
            {data && (
                <p className="text-[11px] text-muted-foreground">
                    Karyawan mendapat pengingat 15 menit sebelum batas waktu. Teguran otomatis dikirim {data.graceMinutes} menit setelah batas lewat bila belum dicentang Selesai (tidak untuk yang memilih Libur).
                </p>
            )}

            {isLoading ? (
                <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : isError ? (
                <p className="py-12 text-center text-sm text-red-600">Gagal memuat data pemantauan.</p>
            ) : rows.length === 0 ? (
                data?.plan ? null : (
                    <div className="py-16 text-center text-muted-foreground">
                        <ClipboardCheck className="mx-auto mb-3 h-10 w-10 opacity-40" />
                        <p className="text-sm">Belum ada tugas atau jadwal piket pada tanggal ini.</p>
                    </div>
                )
            ) : (
                <div className="grid gap-3 md:grid-cols-2">
                    {rows.map((r) => <PersonCard key={r.userId} row={r} onWarn={() => setWarnTarget(r)} />)}
                </div>
            )}

            {warnTarget && (
                <WarnModal
                    row={warnTarget}
                    onClose={() => setWarnTarget(null)}
                    onSent={() => {
                        setSentTo(warnTarget.name || "karyawan");
                        setWarnTarget(null);
                        qc.invalidateQueries({ queryKey: ["task-monitor"] });
                    }}
                />
            )}
        </div>
    );
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone: string }) {
    return (
        <div className="rounded-xl border border-border bg-card px-3 py-2">
            <div className="text-[11px] text-muted-foreground">{label}</div>
            <div className={`text-xl font-bold ${tone}`}>{value}</div>
        </div>
    );
}

function PersonCard({ row, onWarn }: { row: MonitorRow; onWarn: () => void }) {
    const [showWarn, setShowWarn] = useState(false);
    const { done, total, doneLate, overdue } = row.counts;
    const pct = total ? Math.round((done / total) * 100) : 0;
    const missingShift = row.shiftSlots.length > 0 && !row.checkin;
    const unread = row.warnings.filter((w) => !w.acknowledgedAt).length;

    return (
        <div className={`rounded-xl border bg-card p-3 ${overdue || missingShift ? "border-red-500/40" : "border-border"}`}>
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold text-sm text-foreground">{row.name || `#${row.userId}`}</span>
                        {row.checkin ? (
                            <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${SHIFT_TONE[row.checkin.shift]}`}>{SHIFT_LABEL[row.checkin.shift]}</span>
                        ) : missingShift ? (
                            <span className="rounded-full border border-rose-500/40 bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-medium text-rose-700 dark:text-rose-300">Belum pilih shift</span>
                        ) : null}
                        {overdue > 0 && (
                            <span className="inline-flex items-center gap-0.5 rounded-full border border-red-500/40 bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:text-red-300">
                                <AlertTriangle className="h-3 w-3" /> {overdue} lewat batas
                            </span>
                        )}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                        {done}/{total} selesai{doneLate ? ` · ${doneLate} terlambat` : ""}
                        {row.checkin ? ` · pilih shift ${dayjs(row.checkin.at).format("HH:mm")}` : ""}
                    </div>
                </div>
                <Button size="sm" variant={overdue || missingShift ? "destructive" : "outline"} onClick={onWarn} className="shrink-0">
                    <BellRing className="h-4 w-4" /> Tegur
                </Button>
            </div>

            {total > 0 && (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className={`h-full rounded-full ${overdue ? "bg-red-500" : "bg-emerald-500"}`} style={{ width: `${pct}%` }} />
                </div>
            )}

            {row.items.length > 0 ? (
                <ul className="mt-2 divide-y divide-border/60">
                    {row.items.map((it) => <ItemLine key={it.id} it={it} />)}
                </ul>
            ) : (
                <p className="mt-2 text-xs text-muted-foreground">
                    {missingShift ? "Checklist shift muncul setelah dia memilih shift." : row.checkin?.shift === "LIBUR" ? "Libur / izin hari ini." : "Tidak ada tugas pada tanggal ini."}
                </p>
            )}

            {row.warnings.length > 0 && (
                <div className="mt-2 border-t border-border/60 pt-2">
                    <button onClick={() => setShowWarn((v) => !v)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                        <BellRing className="h-3 w-3" /> {row.warnings.length} teguran · {unread ? <span className="font-medium text-amber-600 dark:text-amber-400">{unread} belum dibaca</span> : "semua sudah dibaca"}
                    </button>
                    {showWarn && (
                        <ul className="mt-1.5 space-y-1.5">
                            {row.warnings.map((w) => (
                                <li key={w.id} className="rounded-md bg-muted/50 px-2 py-1.5 text-xs">
                                    <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-muted-foreground">
                                        <span>{w.kind === "AUTO" ? "Otomatis" : `Dari ${w.createdByName || "Owner"}`} · {dayjs(w.createdAt).format("HH:mm")}</span>
                                        <span className={w.acknowledgedAt ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}>
                                            {w.acknowledgedAt ? `Dibaca ${dayjs(w.acknowledgedAt).format("HH:mm")}` : "Belum dibaca"}
                                        </span>
                                    </div>
                                    <p className="mt-0.5 whitespace-pre-wrap text-foreground">{w.message}</p>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}

function ItemLine({ it }: { it: MonitorItem }) {
    const due = it.dueDate ? dayjs(it.dueDate).format("HH:mm") : null;
    let Icon = CircleDashed;
    let tone = "text-muted-foreground";
    let info = due ? `Batas ${due}` : "Belum";
    if (it.status === "DONE") {
        Icon = CheckCircle2;
        tone = it.late ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400";
        info = `${it.late ? "Terlambat" : "Selesai"} ${it.completedAt ? dayjs(it.completedAt).format("HH:mm") : ""}`.trim();
    } else if (it.overdue) {
        Icon = AlertTriangle;
        tone = "text-red-600 dark:text-red-400";
        info = `Lewat batas ${due}`;
    } else if (it.status === "IN_PROGRESS") {
        Icon = Clock;
        tone = "text-amber-600 dark:text-amber-400";
        info = due ? `Dikerjakan · batas ${due}` : "Dikerjakan";
    }
    return (
        <li className="flex items-center justify-between gap-2 py-1.5 text-sm">
            <span className="flex min-w-0 items-center gap-2">
                <Icon className={`h-4 w-4 shrink-0 ${tone}`} />
                <span className="truncate text-foreground">{it.title}</span>
            </span>
            <span className={`inline-flex shrink-0 items-center gap-1 text-xs ${tone}`}>
                {info}
                {it.warned && <BellRing className="h-3 w-3" aria-label="Sudah ditegur otomatis" />}
            </span>
        </li>
    );
}

function WarnModal({ row, onClose, onSent }: { row: MonitorRow; onClose: () => void; onSent: () => void }) {
    const first = String(row.name || "").trim().split(/\s+/)[0] || "kamu";
    const open = row.items.filter((i) => i.status !== "DONE");
    const initial = open.length
        ? `Halo ${first}, tugas berikut belum selesai:\n${open.map((i) => `- ${i.title}${i.dueDate ? ` (batas ${dayjs(i.dueDate).format("HH:mm")})` : ""}`).join("\n")}\n\nTolong segera dikerjakan lalu ubah statusnya menjadi Selesai di Papan Tugas.`
        : row.shiftSlots.length > 0 && !row.checkin
            ? `Halo ${first}, kamu belum memilih shift hari ini di aplikasi. Tolong pilih shift supaya checklist piket kamu muncul, lalu kerjakan dan centang Selesai.`
            : `Halo ${first}, `;
    const [msg, setMsg] = useState(initial);
    const mut = useMutation({ mutationFn: () => sendTaskWarning(row.userId, msg.trim()), onSuccess: onSent });
    const errMsg = (mut.error as { response?: { data?: { message?: string } } } | null)?.response?.data?.message;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
            <div className="w-full max-w-lg rounded-xl border border-border bg-card p-4 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="mb-3 flex items-center justify-between">
                    <h2 className="flex items-center gap-2 text-lg font-bold text-foreground"><BellRing className="h-5 w-5 text-rose-500" /> Tegur {row.name}</h2>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Tutup"><X className="h-5 w-5" /></button>
                </div>
                <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={8} maxLength={2000}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                    Teguran muncul sebagai pop-up hanya di aplikasi {row.name}, dan harus ditekan &quot;Saya mengerti&quot;. Kamu bisa melihat kapan dia membacanya.
                </p>
                {mut.isError && <p className="mt-2 text-xs text-red-600">{errMsg || "Gagal mengirim teguran."}</p>}
                <div className="mt-4 flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={onClose}>Batal</Button>
                    <Button variant="destructive" size="sm" onClick={() => mut.mutate()} disabled={msg.trim().length < 3 || mut.isPending}>
                        {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />} Kirim Teguran
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ─── Rekap bulanan ───────────────────────────────────────────────────────────────
function RecapView() {
    const [month, setMonth] = useState(() => dayjs().format("YYYY-MM"));
    const { data, isLoading, isError } = useQuery({
        queryKey: ["task-recap", month],
        queryFn: () => getTaskRecap(month),
    });
    const rows = data?.rows ?? [];

    return (
        <div className="space-y-3">
            <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)}
                className="rounded-md border border-border bg-background px-3 py-1.5 text-sm" />

            {isLoading ? (
                <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : isError ? (
                <p className="py-12 text-center text-sm text-red-600">Gagal memuat rekap.</p>
            ) : rows.length === 0 ? (
                <p className="py-16 text-center text-sm text-muted-foreground">Belum ada data tugas pada bulan ini.</p>
            ) : (
                <div className="overflow-x-auto rounded-xl border border-border bg-card">
                    <table className="w-full min-w-[720px] text-sm">
                        <thead>
                            <tr className="border-b border-border text-xs text-muted-foreground">
                                <th className="px-3 py-2 text-left font-medium">Karyawan</th>
                                <th className="px-2 py-2 text-center font-medium">Hari masuk</th>
                                <th className="px-2 py-2 text-center font-medium">Libur</th>
                                <th className="px-2 py-2 text-center font-medium">Tugas</th>
                                <th className="px-2 py-2 text-center font-medium">Tepat waktu</th>
                                <th className="px-2 py-2 text-center font-medium">Terlambat</th>
                                <th className="px-2 py-2 text-center font-medium">Terlewat</th>
                                <th className="px-2 py-2 text-center font-medium">Teguran</th>
                                <th className="px-3 py-2 text-left font-medium">Kepatuhan</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r) => {
                                const pct = r.compliancePct;
                                const tone = pct == null ? "bg-muted" : pct >= 90 ? "bg-emerald-500" : pct >= 70 ? "bg-amber-500" : "bg-red-500";
                                return (
                                    <tr key={r.userId} className="border-b border-border/50 last:border-0">
                                        <td className="px-3 py-2 font-medium text-foreground">{r.name}</td>
                                        <td className="px-2 py-2 text-center">{r.workDays}</td>
                                        <td className="px-2 py-2 text-center text-muted-foreground">{r.liburDays}</td>
                                        <td className="px-2 py-2 text-center">{r.total}</td>
                                        <td className="px-2 py-2 text-center text-emerald-600 dark:text-emerald-400">{r.doneOnTime}</td>
                                        <td className="px-2 py-2 text-center text-amber-600 dark:text-amber-400">{r.doneLate}</td>
                                        <td className="px-2 py-2 text-center text-red-600 dark:text-red-400">{r.missed}</td>
                                        <td className="px-2 py-2 text-center">
                                            {r.warnAuto + r.warnManual}
                                            {r.warnUnread > 0 && <span className="ml-1 text-[10px] text-amber-600 dark:text-amber-400">({r.warnUnread} belum dibaca)</span>}
                                        </td>
                                        <td className="px-3 py-2">
                                            <div className="flex items-center gap-2">
                                                <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                                                    <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct ?? 0}%` }} />
                                                </div>
                                                <span className="w-10 text-xs font-semibold text-foreground">{pct == null ? "—" : `${pct}%`}</span>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
            <p className="text-[11px] text-muted-foreground">
                Kepatuhan = tugas selesai tepat waktu ÷ tugas yang batas waktunya sudah lewat. Tugas yang batasnya belum lewat tidak dihitung.
                Teguran = otomatis + dari owner/manajer.
                {data?.trialUntil && <> Hari uji coba s/d {dayjs(data.trialUntil).format("DD/MM/YYYY")} tidak dihitung.</>}
            </p>
        </div>
    );
}
