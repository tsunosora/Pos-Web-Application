"use client";

import { useState } from "react";
import dayjs from "dayjs";
import { useQuery } from "@tanstack/react-query";
import {
    CalendarDays, CheckCircle2, CircleDashed, ClipboardList, Download, FileText, Info, Loader2, Repeat, ShoppingBag, Sun, Sunset, Users, X,
} from "lucide-react";
import { downloadPinPiketPdf, getPinPiketBoard, SHIFT_LABEL, type PiketBoard, type PiketBoardTask, type PiketPlan, type ShiftChoice } from "@/lib/api";

const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const ISO_HARI = ["", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

// Sama dengan kertas jadwal piket (docs/jadwal-piket-pusat-2026-09).
const ATURAN: [string, string][] = [
    ["Area kerja", "yang ditinggal kotor menjadi tanggung jawab orang yang memakai area itu."],
    ["Tukar giliran petugas harian", "boleh bila kedua orang setuju, dan dilaporkan ke Muhammad Faisal sebelum hari tugas."],
    ["Izin atau sakit:", "kabari sebelum pukul 08.00; Muhammad Faisal menunjuk pengganti hari itu."],
    ["Setelah selesai,", "centang Selesai di aplikasi. Tambahkan catatan bila ada yang rusak atau habis."],
    ["Pemeriksaan:", "Owner memeriksa kebersihan dan memverifikasi tugas di aplikasi."],
];
const BELANJA = [
    "Lapor ke Muhammad Faisal atau admin untuk meminta uang belanja.",
    "Belanjakan sesuai kebutuhan dan wajib meminta nota.",
    "Serahkan nota beserta kembaliannya ke yang memberi uang.",
];

const dateLabel = (key: string) => {
    const d = dayjs(key);
    return `${HARI[d.day()]}, ${d.date()} ${BULAN[d.month()]} ${d.year()}`;
};

function daysLabel(t: Pick<PiketBoardTask, "frequency" | "daysOfWeek">): string {
    if (t.frequency === "DAILY") return "Setiap hari";
    if (t.frequency === "WEEKLY") {
        const d = (t.daysOfWeek || "").split(",").map(Number).filter(Boolean);
        if (d.join(",") === "1,2,3,4,5,6") return "Senin–Sabtu";
        return d.map((x) => ISO_HARI[x]).join(", ");
    }
    return t.frequency === "MONTHLY" ? "Bulanan" : "";
}

/** Deskripsi jadwal "1. …\n2. …" → daftar langkah. */
function Steps({ text }: { text: string | null }) {
    const lines = (text || "").split("\n").map((l) => l.replace(/^\s*\d+[.)]\s*/, "").trim()).filter(Boolean);
    if (!lines.length) return null;
    return (
        <ol className="mt-1.5 list-decimal space-y-0.5 pl-5 text-xs text-muted-foreground">
            {lines.map((l, i) => <li key={i}>{l}</li>)}
        </ol>
    );
}

function Section({ title, subtitle, icon: Icon, children }: {
    title: string; subtitle?: string; icon: typeof Users; children: React.ReactNode;
}) {
    return (
        <section className="rounded-2xl border border-border bg-card p-4">
            <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
                <Icon className="h-5 w-5 text-primary" /> {title}
            </h2>
            {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
            <div className="mt-3">{children}</div>
        </section>
    );
}

function TaskBlock({ t, meta }: { t: PiketBoardTask; meta?: string }) {
    return (
        <div className="py-2">
            <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                <p className="text-sm font-semibold text-foreground">{t.title}</p>
                {t.timeOfDay && <span className="text-xs font-medium text-muted-foreground">batas {t.timeOfDay.replace(":", ".")}</span>}
            </div>
            {meta && <p className="text-[11px] text-muted-foreground">{meta}</p>}
            <Steps text={t.description} />
        </div>
    );
}

const SHIFT_TONE: Record<ShiftChoice, string> = {
    PAGI: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    KEDUA: "border-indigo-500/40 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
    LIBUR: "border-slate-400/40 bg-slate-500/10 text-slate-600 dark:text-slate-300",
};

const hhDot = (t: string | null) => (t ? t.replace(":", ".") : "");

function ShiftOptions({ plan }: { plan: PiketPlan }) {
    const slots = (["PAGI", "KEDUA"] as const).filter((s) => plan.shiftOptions[s]?.length);
    if (!slots.length) return null;
    return (
        <div className="flex flex-wrap gap-2 text-xs">
            {slots.map((s) => (
                <span key={s} className={`rounded-lg border px-2 py-1 ${SHIFT_TONE[s]}`}>
                    <b>{SHIFT_LABEL[s]}:</b> {(plan.shiftOptions[s] ?? []).map((t) => `${t.title}${t.timeOfDay ? ` (${hhDot(t.timeOfDay)})` : ""}`).join(" · ")}
                </span>
            ))}
        </div>
    );
}

/** Rencana piket satu tanggal yang akan datang (kartu belum dibuat) — per karyawan. */
export function PiketPlanView({ plan }: { plan: PiketPlan }) {
    const withTasks = plan.rows.filter((r) => r.tasks.length > 0);
    const shiftOnly = plan.rows.filter((r) => r.tasks.length === 0 && r.needsShift);
    return (
        <section className="rounded-2xl border border-sky-500/30 bg-sky-500/5 p-4">
            <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
                <CalendarDays className="h-4 w-4 text-sky-600 dark:text-sky-400" /> Rencana {dateLabel(plan.dateKey)}
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
                Kartu tugas dibuat otomatis pukul 00.05 pada hari itu. Tugas shift muncul setelah karyawan memilih shift.
                {plan.trialUntil ? " Tanggal ini masih masa uji coba." : ""}
            </p>
            <div className="mt-2"><ShiftOptions plan={plan} /></div>
            {plan.rows.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">Tidak ada jadwal tugas pada tanggal ini.</p>
            ) : (
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {withTasks.map((r) => (
                        <div key={r.userId} className="rounded-xl border border-border bg-card p-3">
                            <div className="flex items-center justify-between gap-2">
                                <span className="truncate text-sm font-semibold text-foreground">{r.name}</span>
                                {r.tasks.some((t) => t.rotation) && (
                                    <span className="shrink-0 rounded-full border border-teal-500/40 bg-teal-500/10 px-1.5 py-0.5 text-[10px] font-medium text-teal-700 dark:text-teal-300">Petugas harian</span>
                                )}
                            </div>
                            <ul className="mt-1.5 space-y-0.5 text-xs">
                                {r.tasks.map((t, i) => (
                                    <li key={i} className="flex justify-between gap-2">
                                        <span className="truncate text-foreground">{t.title}</span>
                                        <span className="shrink-0 text-muted-foreground">{hhDot(t.timeOfDay)}</span>
                                    </li>
                                ))}
                            </ul>
                            {r.needsShift && <p className="mt-1.5 text-[11px] text-muted-foreground">+ tugas shift sesuai pilihan</p>}
                        </div>
                    ))}
                </div>
            )}
            {shiftOnly.length > 0 && (
                <p className="mt-2 text-xs text-muted-foreground"><b>Hanya tugas shift:</b> {shiftOnly.map((r) => r.name).join(", ")}</p>
            )}
        </section>
    );
}

/** Satu hari di "Rencana 7 hari ke depan": tugas → siapa. */
function PlanDayCompact({ plan }: { plan: PiketPlan }) {
    const byTask = new Map<string, { timeOfDay: string | null; rotation: boolean; names: string[] }>();
    for (const r of plan.rows) {
        for (const t of r.tasks) {
            if (!byTask.has(t.title)) byTask.set(t.title, { timeOfDay: t.timeOfDay, rotation: t.rotation, names: [] });
            byTask.get(t.title)!.names.push(r.name);
        }
    }
    const tasks = [...byTask.entries()].sort((a, b) => String(a[1].timeOfDay ?? "99").localeCompare(String(b[1].timeOfDay ?? "99")));
    const hasShift = Object.values(plan.shiftOptions).some((x) => x && x.length);
    const d = dayjs(plan.dateKey);
    return (
        <div className="rounded-xl border border-border bg-background/60 p-3">
            <p className="text-sm font-bold text-foreground">{HARI[d.day()]}, {d.date()} {BULAN[d.month()]}</p>
            <p className="text-[11px] text-muted-foreground">{hasShift ? "+ tugas shift sesuai pilihan" : "Toko tutup — tanpa tugas shift"}</p>
            {tasks.length === 0 ? (
                <p className="mt-1.5 text-xs text-muted-foreground">Tidak ada tugas tambahan.</p>
            ) : (
                <ul className="mt-1.5 space-y-1 text-xs">
                    {tasks.map(([title, v]) => (
                        <li key={title}>
                            <span className="font-semibold text-foreground">{title}</span>
                            {v.timeOfDay && <span className="text-muted-foreground"> · {hhDot(v.timeOfDay)}</span>}
                            <span className={`block ${v.rotation ? "font-medium text-teal-700 dark:text-teal-300" : "text-muted-foreground"}`}>{v.names.join(", ")}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

/** Tombol "Unduh jadwal (PDF)" — PDF dibuat otomatis dari jadwal & giliran terbaru. */
function PdfDownloadButton({ onDownload }: { onDownload: () => Promise<void> }) {
    const [state, setState] = useState<"idle" | "loading" | "error">("idle");
    const run = async () => {
        setState("loading");
        try { await onDownload(); setState("idle"); } catch { setState("error"); }
    };
    return (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
            <button type="button" onClick={run} disabled={state === "loading"}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60">
                {state === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {state === "loading" ? "Menyiapkan PDF…" : "Unduh jadwal (PDF)"}
            </button>
            <span className="text-xs text-muted-foreground">Kertas jadwal piket · otomatis sesuai jadwal &amp; giliran terbaru</span>
            {state === "error" && <span className="text-xs font-medium text-rose-600">Gagal mengunduh. Coba lagi.</span>}
        </div>
    );
}

/** Isi papan piket: status hari ini, kewajiban, giliran & aturan (sama dengan kertas). */
export function PiketBoardView({ data, onDownloadPdf }: { data: PiketBoard; onDownloadPdf?: () => Promise<void> }) {
    const pagi = data.shiftTasks.filter((t) => t.slot === "PAGI");
    const kedua = data.shiftTasks.filter((t) => t.slot === "KEDUA");
    const sundayExtras = data.rotationTasks
        .filter((t) => t.frequency === "WEEKLY" && (t.daysOfWeek || "") === "7")
        .map((t) => t.title.toLowerCase());

    return (
        <div className="space-y-4">
            {data.jadwalPdf && onDownloadPdf && <PdfDownloadButton onDownload={onDownloadPdf} />}

            {data.trialUntil && (
                <div className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
                    <Info className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>
                        <b>Masa uji coba sampai {dateLabel(data.trialUntil)}.</b> Lihat dulu tugasmu — boleh dicentang atau dilewati.
                        Belum ada teguran dan belum dihitung di rekap.
                    </p>
                </div>
            )}

            <Section title="Piket hari ini" subtitle={dateLabel(data.dateKey)} icon={ClipboardList}>
                {data.today.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Belum ada piket hari ini.</p>
                ) : (
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {data.today.map((p) => {
                            const done = p.tasks.filter((t) => t.status === "DONE").length;
                            return (
                                <div key={p.userId} className="rounded-xl border border-border bg-background/60 p-3">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="truncate text-sm font-semibold text-foreground">{p.name}</span>
                                        {p.shift ? (
                                            <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${SHIFT_TONE[p.shift]}`}>{SHIFT_LABEL[p.shift]}</span>
                                        ) : p.needsShift ? (
                                            <span className="shrink-0 rounded-full border border-slate-400/40 px-1.5 py-0.5 text-[10px] text-muted-foreground">Belum pilih shift</span>
                                        ) : null}
                                    </div>
                                    {p.tasks.length > 0 ? (
                                        <>
                                            <div className="mt-2 flex items-center gap-2">
                                                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                                                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.round((done / p.tasks.length) * 100)}%` }} />
                                                </div>
                                                <span className="text-[11px] text-muted-foreground">{done}/{p.tasks.length}</span>
                                            </div>
                                            <ul className="mt-2 space-y-1">
                                                {p.tasks.map((t) => (
                                                    <li key={t.id} className="flex items-center gap-2 text-xs">
                                                        {t.status === "DONE"
                                                            ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                                                            : <CircleDashed className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                                                        <span className={`flex-1 truncate ${t.status === "DONE" ? "text-muted-foreground line-through" : "text-foreground"}`}>{t.title}</span>
                                                        <span className="shrink-0 text-muted-foreground">
                                                            {t.status === "DONE" && t.completedAt ? `✓ ${dayjs(t.completedAt).format("HH:mm")}` : t.dueDate ? dayjs(t.dueDate).format("HH:mm") : ""}
                                                        </span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </>
                                    ) : (
                                        <p className="mt-2 text-xs text-muted-foreground">
                                            {p.shift === "LIBUR" ? "Libur / izin hari ini." : p.needsShift && !p.shift ? "Checklist muncul setelah memilih shift." : "Belum ada tugas."}
                                        </p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </Section>

            <Section title="Kewajiban semua karyawan" subtitle={data.shiftMembers.join(" · ")} icon={Users}>
                <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-xl border-l-4 border-amber-500 bg-amber-500/5 px-3 py-1">
                        <p className="flex items-center gap-1.5 pt-2 text-[11px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300"><Sun className="h-3.5 w-3.5" /> Yang masuk shift pagi</p>
                        <div className="divide-y divide-border/60">{pagi.map((t) => <TaskBlock key={t.id} t={t} meta={daysLabel(t)} />)}</div>
                    </div>
                    <div className="rounded-xl border-l-4 border-indigo-500 bg-indigo-500/5 px-3 py-1">
                        <p className="flex items-center gap-1.5 pt-2 text-[11px] font-bold uppercase tracking-wide text-indigo-700 dark:text-indigo-300"><Sunset className="h-3.5 w-3.5" /> Yang masuk shift kedua</p>
                        <div className="divide-y divide-border/60">{kedua.map((t) => <TaskBlock key={t.id} t={t} meta={daysLabel(t)} />)}</div>
                    </div>
                    <div className="rounded-xl border-l-4 border-rose-500 bg-rose-500/5 px-3 py-3">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-rose-600 dark:text-rose-400">Semua, setiap hari</p>
                        <p className="mt-2 text-sm font-semibold text-foreground">Cuci alat makan sendiri setelah dipakai</p>
                        <ol className="mt-1.5 list-decimal space-y-0.5 pl-5 text-xs text-muted-foreground">
                            <li>Cuci gelas, piring &amp; sendok yang kamu pakai, langsung setelah dipakai.</li>
                            <li>Tiriskan lalu kembalikan ke rak.</li>
                            <li>Jangan tinggalkan alat makan kotor di meja kerja atau wastafel.</li>
                        </ol>
                    </div>
                </div>
            </Section>

            {(data.groupTasks.length > 0 || data.rotationTasks.length > 0) && (
                <Section title="Tambahan untuk yang tinggal di toko" icon={Repeat}>
                    <div className="grid gap-x-6 md:grid-cols-2">
                        {data.groupTasks.map((t) => (
                            <TaskBlock key={t.id} t={t} meta={`${daysLabel(t)} · masing-masing: ${t.members.join(", ")}`} />
                        ))}
                        {data.rotationTasks.map((t) => (
                            <TaskBlock key={t.id} t={t} meta={`${daysLabel(t)} · petugas harian (bergilir, lihat tabel)`} />
                        ))}
                    </div>
                </Section>
            )}

            {data.upcoming && data.upcoming.length > 0 && (
                <Section
                    title="Rencana 7 hari ke depan"
                    subtitle="Supaya tidak kaget — siapa dapat tugas apa. Tugas shift (buka/tutup toko, area kerja, halaman) mengikuti pilihan shift masing-masing hari itu."
                    icon={CalendarDays}
                >
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        {data.upcoming.map((plan) => <PlanDayCompact key={plan.dateKey} plan={plan} />)}
                    </div>
                </Section>
            )}

            {data.rotation && (
                <Section title="Giliran petugas harian" subtitle={`Urutan: ${data.rotation.order.join(" → ")}`} icon={Repeat}>
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[560px] border-separate border-spacing-1 text-sm">
                            <thead>
                                <tr>
                                    <th />
                                    {data.rotation.weeks.map((w, i) => (
                                        <th key={w.start} className="px-2 text-left text-xs font-semibold text-muted-foreground">
                                            {i === 0 ? "Pekan ini" : `${i} pekan lagi`}
                                            <span className="block font-normal">mulai {dayjs(w.start).format("D/M")}</span>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {[0, 1, 2, 3, 4, 5, 6].map((di) => {
                                    const iso = di + 1;
                                    return (
                                        <tr key={di}>
                                            <th className="whitespace-nowrap pr-2 text-left text-xs font-semibold text-foreground">
                                                {ISO_HARI[iso]}
                                                {iso === 7 && sundayExtras.length > 0 && (
                                                    <span className="block text-[10px] font-medium text-teal-600 dark:text-teal-400">+ {sundayExtras.join(", ")}</span>
                                                )}
                                            </th>
                                            {data.rotation!.weeks.map((w) => {
                                                const d = w.days[di];
                                                return (
                                                    <td key={d.date} className={`rounded-lg px-2 py-1.5 text-xs font-semibold ${d.isToday ? "bg-primary text-primary-foreground" : d.active ? "bg-muted text-foreground" : "bg-muted/40 text-muted-foreground"}`}>
                                                        {d.name ?? "—"}
                                                        <span className="block text-[10px] font-normal opacity-80">{dayjs(d.date).format("D/M")}{d.isToday ? " · hari ini" : ""}</span>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </Section>
            )}

            <Section title="Aturan piket" icon={FileText}>
                <ol className="list-decimal space-y-1 pl-5 text-sm text-foreground">
                    {ATURAN.map(([b, r]) => <li key={b}><b>{b}</b> {r}</li>)}
                </ol>
                <div className="mt-3 rounded-xl border border-rose-500/40 bg-rose-500/5 p-3">
                    <p className="flex items-center gap-2 text-sm font-bold text-rose-600 dark:text-rose-400">
                        <ShoppingBag className="h-4 w-4" /> Sabun atau alat kebersihan habis / perlu dibeli?
                    </p>
                    <ol className="mt-1.5 list-decimal space-y-0.5 pl-5 text-sm text-foreground">
                        {BELANJA.map((x) => <li key={x}>{x}</li>)}
                    </ol>
                </div>
            </Section>
        </div>
    );
}

/** Papan piket layar penuh untuk pengguna PIN (/so-designer, /produksi, /cetak). */
export function PiketBoardModal({ designerId, pin, onClose }: { designerId: number; pin: string; onClose: () => void }) {
    const q = useQuery({
        queryKey: ["piket-board-pin", designerId],
        queryFn: () => getPinPiketBoard(designerId, pin),
        staleTime: 0,
        refetchOnMount: "always",
        refetchInterval: 60_000,
        retry: false,
    });
    return (
        <div role="dialog" aria-modal="true" aria-labelledby="piket-board-title" className="fixed inset-0 z-[78] flex flex-col bg-background">
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                <ClipboardList className="h-5 w-5 text-primary" />
                <h2 id="piket-board-title" className="flex-1 text-base font-bold text-foreground">Papan Piket</h2>
                <button type="button" onClick={onClose} aria-label="Tutup papan piket" className="rounded-full p-1.5 text-muted-foreground transition hover:bg-muted">
                    <X className="h-5 w-5" />
                </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <div className="mx-auto max-w-5xl">
                    {q.isLoading ? (
                        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
                    ) : q.isError || !q.data ? (
                        <p className="py-12 text-center text-sm text-rose-600">Gagal memuat papan piket.</p>
                    ) : (
                        <PiketBoardView data={q.data} onDownloadPdf={() => downloadPinPiketPdf(designerId, pin)} />
                    )}
                </div>
            </div>
        </div>
    );
}
