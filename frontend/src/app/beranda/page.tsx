"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
    getTaskItems,
    getKpiReport, getDesignerLeaderboard, getOperatorLeaderboard,
    type TaskItem,
} from "@/lib/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import {
    LayoutDashboard, ClipboardList, ListTodo, Loader2, AlertTriangle, CheckCircle2,
    CalendarClock, TrendingUp, ShoppingCart, MessageCircle, Award, Sparkles, Palette, ArrowRight,
} from "lucide-react";
import dayjs from "dayjs";
import type { LucideIcon } from "lucide-react";

const rp = (n: number) => "Rp " + Math.round(n || 0).toLocaleString("id-ID");
const norm = (s?: string | null) => (s || "").trim().toLowerCase();

type Kpi = { label: string; value: string; icon: LucideIcon }[];

export default function BerandaPage() {
    const { currentUser, isOwner, isDesigner, isOperator, branchName } = useCurrentUser();

    // ── Tugas pribadi ────────────────────────────────────────────────────────
    const { data: tasks = [], isLoading: tasksLoading } = useQuery({
        queryKey: ["task-items", true],
        queryFn: () => getTaskItems({ mine: true }),
        enabled: currentUser !== undefined,
    });

    const taskStats = useMemo(() => {
        const now = dayjs();
        let todo = 0, inProgress = 0, done = 0, overdue = 0;
        const upcoming: TaskItem[] = [];
        for (const t of tasks) {
            if (t.status === "TODO") todo++;
            else if (t.status === "IN_PROGRESS") inProgress++;
            else if (t.status === "DONE") done++;
            const late = t.status !== "DONE" && t.dueDate && dayjs(t.dueDate).isBefore(now);
            if (late) overdue++;
            if (t.status !== "DONE") upcoming.push(t);
        }
        upcoming.sort((a, b) => {
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;
            return dayjs(a.dueDate).valueOf() - dayjs(b.dueDate).valueOf();
        });
        return { todo, inProgress, done, overdue, active: todo + inProgress, upcoming: upcoming.slice(0, 6) };
    }, [tasks]);

    // ── KPI pribadi (dari leaderboard sesuai divisi) ─────────────────────────
    const division: "designer" | "operator" | "cs" = isDesigner ? "designer" : isOperator ? "operator" : "cs";
    const { data: kpi = null, isLoading: kpiLoading } = useQuery<Kpi | null>({
        queryKey: ["beranda-kpi", division, currentUser?.id],
        enabled: currentUser !== undefined && !isOwner,
        staleTime: 5 * 60 * 1000,
        queryFn: async (): Promise<Kpi | null> => {
            const me = norm(currentUser?.name);
            if (division === "designer") {
                const r = await getDesignerLeaderboard({ period: "month" });
                const row = r.leaderboard.find((e) => norm(e.name) === me);
                if (!row) return null;
                return [
                    { label: "Desain Selesai", value: String(row.selesai), icon: CheckCircle2 },
                    { label: "Sedang Dikerjakan", value: String(row.wip), icon: ListTodo },
                    { label: "Omzet (bagian)", value: rp(row.omzetShare), icon: TrendingUp },
                    { label: "Total Pcs", value: String(row.pcs), icon: ClipboardList },
                ];
            }
            if (division === "operator") {
                const r = await getOperatorLeaderboard({ period: "month" });
                const row = r.leaderboard.find((e) => norm(e.name) === me);
                if (!row) return null;
                return [
                    { label: "Job Ditangani", value: String(row.total), icon: ClipboardList },
                    { label: "Pcs Dicetak", value: String(row.printPcs), icon: ListTodo },
                    { label: "Produksi Selesai", value: String(row.prodDone), icon: CheckCircle2 },
                    { label: "Omzet (bagian)", value: rp(row.omzetShare), icon: TrendingUp },
                ];
            }
            // CS / default (di-key userId)
            const r = await getKpiReport({ period: "month" });
            const row = r.leaderboard.find((e) => e.userId === currentUser?.id);
            if (!row) return null;
            return [
                { label: "Closing", value: String(row.dealsClosed), icon: CheckCircle2 },
                { label: "Pcs Order", value: String(row.pcsOrdered), icon: ClipboardList },
                { label: "Omzet (bagian)", value: rp(row.omzetShare), icon: TrendingUp },
                { label: "Closing Rate", value: `${Math.round((row.closingRate || 0) * 100)}%`, icon: TrendingUp },
            ];
        },
    });

    // ── Pintasan cepat ───────────────────────────────────────────────────────
    const shortcuts = useMemo(() => {
        const base: { name: string; href: string; icon: LucideIcon }[] = [
            { name: "Papan Tugas", href: "/tugas", icon: ClipboardList },
            { name: "Kasir POS", href: "/pos", icon: ShoppingCart },
            { name: "Inbox WhatsApp", href: "/crm/whatsapp", icon: MessageCircle },
            { name: "Leads CRM", href: "/crm/leads", icon: Sparkles },
            { name: "Leaderboard", href: "/leaderboard", icon: Award },
        ];
        if (isDesigner) base.push({ name: "Studio Desain", href: "/desainer", icon: Palette });
        return base;
    }, [isDesigner]);

    if (currentUser === undefined) {
        return (
            <div className="flex items-center justify-center py-24">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    const firstName = (currentUser?.name || "").split(" ")[0] || "Rekan";

    return (
        <div className="p-4 max-w-[80rem] mx-auto">
            <PageHeader
                title={`Halo, ${firstName} 👋`}
                description={`${dayjs().format("dddd, DD MMMM YYYY")}${branchName ? " · " + branchName : ""}`}
                icon={LayoutDashboard}
                actions={
                    <Button variant="outline" size="sm" asChild>
                        <Link href="/tugas"><ClipboardList className="h-4 w-4" /> Buka Papan Tugas</Link>
                    </Button>
                }
            />

            {isOwner && (
                <div className="mb-4 rounded-lg border border-border bg-accent/40 px-4 py-3 text-sm text-muted-foreground flex items-center justify-between gap-2">
                    <span>Anda owner — dashboard lengkap ada di halaman khusus.</span>
                    <Button variant="ghost" size="sm" asChild><Link href="/owner">Dashboard Owner <ArrowRight className="h-4 w-4" /></Link></Button>
                </div>
            )}

            {/* Ringkasan tugas pribadi */}
            <section className="mb-6">
                <h2 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                    <ClipboardList className="h-4 w-4" /> Ringkasan Tugas Saya
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <StatCard label="Belum Dikerjakan" value={taskStats.todo} icon={ListTodo} tone="slate" />
                    <StatCard label="Sedang Dikerjakan" value={taskStats.inProgress} icon={Loader2} tone="amber" />
                    <StatCard label="Selesai" value={taskStats.done} icon={CheckCircle2} tone="emerald" />
                    <StatCard label="Terlambat" value={taskStats.overdue} icon={AlertTriangle} tone="red" />
                </div>

                <div className="mt-3 rounded-lg border border-border bg-card p-3">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-foreground">Perlu dikerjakan</span>
                        <Link href="/tugas" className="text-xs text-primary hover:underline flex items-center gap-0.5">Semua <ArrowRight className="h-3 w-3" /></Link>
                    </div>
                    {tasksLoading ? (
                        <div className="py-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                    ) : taskStats.upcoming.length === 0 ? (
                        <p className="text-center text-xs text-muted-foreground py-6">🎉 Tidak ada tugas tertunda. Kerja bagus!</p>
                    ) : (
                        <ul className="divide-y divide-border">
                            {taskStats.upcoming.map((t) => {
                                const overdue = t.dueDate && dayjs(t.dueDate).isBefore(dayjs());
                                return (
                                    <li key={t.id} className="py-2 flex items-center justify-between gap-2">
                                        <div className="min-w-0">
                                            <div className="text-sm text-foreground truncate">{t.title}</div>
                                            {t.dueDate && (
                                                <div className={`text-[11px] flex items-center gap-1 ${overdue ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
                                                    {overdue ? <AlertTriangle className="h-3 w-3" /> : <CalendarClock className="h-3 w-3" />}
                                                    {dayjs(t.dueDate).format("DD MMM HH:mm")}{overdue && " • terlambat"}
                                                </div>
                                            )}
                                        </div>
                                        <span className={`shrink-0 text-[10px] rounded-full px-2 py-0.5 border ${t.status === "IN_PROGRESS" ? "border-amber-500/30 text-amber-600 dark:text-amber-300 bg-amber-500/10" : "border-border text-muted-foreground"}`}>
                                            {t.status === "IN_PROGRESS" ? "Berjalan" : "Baru"}
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            </section>

            {/* KPI pribadi */}
            {!isOwner && (
                <section className="mb-6">
                    <h2 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                        <TrendingUp className="h-4 w-4" /> Kinerja Saya Bulan Ini
                    </h2>
                    {kpiLoading ? (
                        <div className="rounded-lg border border-border bg-card py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                    ) : !kpi ? (
                        <div className="rounded-lg border border-border bg-card px-4 py-6 text-center text-xs text-muted-foreground">
                            Belum ada data kinerja bulan ini untuk akun Anda.
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {kpi.map((k) => (
                                <div key={k.label} className="rounded-lg border border-border bg-card p-3">
                                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1">
                                        <k.icon className="h-3.5 w-3.5" /> {k.label}
                                    </div>
                                    <div className="text-lg font-bold text-foreground tabular-nums">{k.value}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            )}

            {/* Pintasan cepat */}
            <section>
                <h2 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                    <ArrowRight className="h-4 w-4" /> Pintasan Cepat
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                    {shortcuts.map((s) => (
                        <Link key={s.href} href={s.href}
                            className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-card p-4 text-center hover:border-primary hover:shadow-md transition">
                            <s.icon className="h-6 w-6 text-primary" />
                            <span className="text-xs font-medium text-foreground">{s.name}</span>
                        </Link>
                    ))}
                </div>
            </section>
        </div>
    );
}

function StatCard({ label, value, icon: Icon, tone }: { label: string; value: number; icon: LucideIcon; tone: "slate" | "amber" | "emerald" | "red" }) {
    const toneClass: Record<string, string> = {
        slate: "text-slate-600 dark:text-slate-300",
        amber: "text-amber-600 dark:text-amber-300",
        emerald: "text-emerald-600 dark:text-emerald-300",
        red: "text-red-600 dark:text-red-400",
    };
    return (
        <div className="rounded-lg border border-border bg-card p-3">
            <div className={`flex items-center gap-1.5 text-[11px] mb-1 ${toneClass[tone]}`}>
                <Icon className="h-3.5 w-3.5" /> {label}
            </div>
            <div className="text-2xl font-bold text-foreground tabular-nums">{value}</div>
        </div>
    );
}
