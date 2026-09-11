"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { FileText, Flame, LayoutDashboard, Palette, PartyPopper, Plus, Rocket, Sparkles, Sun, Target, ThumbsUp, TrendingUp, Trophy, Zap, type LucideIcon } from "lucide-react";
import type { DesignerStats } from "@/lib/api/designers";

export type CelebrationKind = "new" | "merged" | "revised" | "existing";

// Ikon lucide (bukan emoji) supaya tampil sama di semua perangkat, termasuk yang tanpa font emoji.
const HEAD: Record<CelebrationKind, { title: (n: string) => string; sub: string; icon: LucideIcon }> = {
    new: { title: n => `Hore, ${n}!`, sub: "SO kamu berhasil dibuat & masuk ke CS", icon: PartyPopper },
    merged: { title: n => `Hore, ${n}!`, sub: "SO kamu ditempelkan ke lead yang sudah ada", icon: PartyPopper },
    revised: { title: n => `Mantap, ${n}!`, sub: "Revisi SO berhasil disimpan", icon: Sparkles },
    existing: { title: n => `Tersimpan, ${n}!`, sub: "SO berhasil disimpan", icon: ThumbsUp },
};

const CONFETTI_COLORS = ["#6366f1", "#a855f7", "#ec4899", "#f59e0b", "#10b981", "#38bdf8"];

const GENERIC = [
    { icon: Zap, text: "Desainmu bikin pelanggan senang — lanjutkan!" },
    { icon: Sparkles, text: "Kerja keren! CS siap follow-up desainmu." },
    { icon: Rocket, text: "Satu SO lagi, satu langkah lebih dekat ke rekor baru." },
    { icon: Palette, text: "Kreativitasmu jalan terus. Mantap!" },
];

type Motivation = { icon: LucideIcon; text: string; tone: "gold" | "fire" | "normal" };

/** Pesan penyemangat sesuai capaian: rekor baru → kelipatan → dekat rekor → beruntun → umum. */
export function pickMotivation(s: DesignerStats, kind: CelebrationKind, seed: string): Motivation {
    const t = s.today.so;
    const prev = s.bestDay?.previousBest ?? 0;
    if (kind === "new") {
        if (prev > 0 && t > prev) return { icon: Trophy, text: `REKOR BARU! ${t} SO hari ini — hari terbaikmu bulan ini.`, tone: "gold" };
        if ([5, 10, 15, 20, 25, 30, 40, 50, 75, 100].includes(t)) return { icon: Flame, text: `${t} SO hari ini — kamu lagi on fire!`, tone: "fire" };
        if (s.month.so > 0 && s.month.so % 50 === 0) return { icon: Rocket, text: `SO ke-${s.month.so} bulan ini. Luar biasa!`, tone: "gold" };
    }
    const gap = prev - t;
    if (prev > 0 && gap >= 0 && gap <= 3) {
        return {
            icon: Target,
            text: gap === 0 ? `Kamu menyamai rekor harianmu (${prev} SO). Satu lagi jadi rekor baru!` : `Tinggal ${gap} SO lagi menyamai rekor harianmu (${prev} SO).`,
            tone: "fire",
        };
    }
    if (s.streak >= 3) return { icon: Flame, text: `${s.streak} hari kerja beruntun kamu bikin SO. Pertahankan!`, tone: "fire" };
    if (kind === "new" && t === 1) return { icon: Sun, text: "SO pertama hari ini — awal yang keren!", tone: "normal" };
    let h = 0;
    for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return { ...GENERIC[h % GENERIC.length], tone: "normal" };
}

function usePrefersReducedMotion() {
    const [reduced, setReduced] = useState(false);
    useEffect(() => {
        const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
        if (!mq) return;
        setReduced(mq.matches);
        const on = () => setReduced(mq.matches);
        mq.addEventListener?.("change", on);
        return () => mq.removeEventListener?.("change", on);
    }, []);
    return reduced;
}

/** Angka naik dari 0 ke target (easeOutCubic). */
function CountUp({ value, animate, ms = 1000 }: { value: number; animate: boolean; ms?: number }) {
    const [v, setV] = useState(animate ? 0 : value);
    useEffect(() => {
        if (!animate) { setV(value); return; }
        let raf = 0;
        const t0 = performance.now();
        const tick = (t: number) => {
            const k = Math.min(1, (t - t0) / ms);
            setV(Math.round(value * (1 - Math.pow(1 - k, 3))));
            if (k < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [value, animate, ms]);
    return <>{v.toLocaleString("id-ID")}</>;
}

const TILE_TONE = {
    indigo: "from-indigo-50 to-white border-indigo-100 text-indigo-700 dark:from-indigo-950/60 dark:to-slate-900 dark:border-indigo-900 dark:text-indigo-300",
    fuchsia: "from-fuchsia-50 to-white border-fuchsia-100 text-fuchsia-700 dark:from-fuchsia-950/50 dark:to-slate-900 dark:border-fuchsia-900 dark:text-fuchsia-300",
    emerald: "from-emerald-50 to-white border-emerald-100 text-emerald-700 dark:from-emerald-950/50 dark:to-slate-900 dark:border-emerald-900 dark:text-emerald-300",
    slate: "from-slate-50 to-white border-slate-200 text-slate-800 dark:from-slate-800/70 dark:to-slate-900 dark:border-slate-700 dark:text-slate-100",
};

function Tile({ label, value, tone, big, animate }: { label: string; value: number; tone: keyof typeof TILE_TONE; big?: boolean; animate: boolean }) {
    return (
        <div className={`rounded-2xl border bg-gradient-to-br px-3 py-2.5 ${TILE_TONE[tone]}`}>
            <div className={`${big ? "text-3xl" : "text-xl"} font-extrabold leading-none tabular-nums`}><CountUp value={value} animate={animate} /></div>
            <div className="mt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">{label}</div>
        </div>
    );
}

const monthLabel = (key: string) =>
    new Date(`${key}-01T00:00:00+07:00`).toLocaleDateString("id-ID", { month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
const dayLabel = (d: string) =>
    new Date(`${d}T00:00:00+07:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" });

/**
 * Kartu perayaan setelah desainer menekan "Lead Order (CS)": ucapan + statistik kinerja
 * hari ini & bulan ini (dari PIN yang login) supaya desainer makin semangat bikin SO.
 */
export function CelebrationModal({ designerName, kind, soNumber, message, stats, statsLoading, onNewSO, onDashboard }: {
    designerName: string;
    kind: CelebrationKind;
    soNumber: string;
    message: string;
    stats: DesignerStats | null;
    statsLoading: boolean;
    onNewSO: () => void;
    onDashboard: () => void;
}) {
    const reduced = usePrefersReducedMotion();
    const animate = !reduced;
    const primaryRef = useRef<HTMLButtonElement>(null);
    const first = (designerName || "").trim().split(/\s+/)[0] || "Desainer";
    const head = HEAD[kind];
    const motivation = useMemo(() => (stats ? pickMotivation(stats, kind, soNumber || first) : null), [stats, kind, soNumber, first]);
    const confetti = useMemo(() => Array.from({ length: 46 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.7,
        dur: 2.4 + Math.random() * 1.8,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        w: 6 + Math.random() * 6,
        h: 9 + Math.random() * 9,
        drift: Math.round((Math.random() - 0.5) * 160),
        round: i % 3 === 0,
    })), []);

    useEffect(() => { primaryRef.current?.focus(); }, []);
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onDashboard(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onDashboard]);

    const prev = stats?.bestDay?.previousBest ?? 0;
    const today = stats?.today.so ?? 0;
    const diff = stats ? today - stats.yesterdaySameTime.so : 0;
    const avg = stats && stats.month.activeDays > 0 ? Math.round((stats.month.so / stats.month.activeDays) * 10) / 10 : 0;
    const toneCls = motivation?.tone === "gold"
        ? "bg-gradient-to-r from-amber-100 to-yellow-50 text-amber-800 border-amber-300 dark:from-amber-900/40 dark:to-yellow-900/20 dark:text-amber-200 dark:border-amber-700"
        : motivation?.tone === "fire"
            ? "bg-gradient-to-r from-orange-50 to-rose-50 text-orange-800 border-orange-200 dark:from-orange-950/40 dark:to-rose-950/30 dark:text-orange-200 dark:border-orange-900"
            : "bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-200 dark:border-indigo-900";

    return (
        <div role="dialog" aria-modal="true" aria-labelledby="hore-title"
            className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/60 backdrop-blur-sm sm:items-center sm:p-4">
            <style>{`
                @keyframes hore-fall { 0% { transform: translate3d(0,-24px,0) rotate(0deg); opacity: 1 } 100% { transform: translate3d(var(--drift),105vh,0) rotate(760deg); opacity: .85 } }
                @keyframes hore-pop { 0% { transform: translateY(28px) scale(.94); opacity: 0 } 60% { transform: translateY(-4px) scale(1.02); opacity: 1 } 100% { transform: none; opacity: 1 } }
                @keyframes hore-bounce { 0%,100% { transform: translateY(0) rotate(-6deg) } 50% { transform: translateY(-9px) rotate(6deg) } }
                @keyframes hore-shine { 0% { transform: translateX(-120%) skewX(-20deg) } 100% { transform: translateX(260%) skewX(-20deg) } }
                @keyframes hore-grow { from { width: 0 } }
            `}</style>

            {animate && kind !== "existing" && (
                <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
                    {confetti.map((c, i) => (
                        <span key={i} className="absolute top-0"
                            style={{
                                left: `${c.left}%`, width: c.w, height: c.round ? c.w : c.h, background: c.color,
                                borderRadius: c.round ? "9999px" : "2px",
                                animation: `hore-fall ${c.dur}s ${c.delay}s cubic-bezier(.2,.6,.4,1) forwards`,
                                "--drift": `${c.drift}px`,
                            } as CSSProperties} />
                    ))}
                </div>
            )}

            <div className="relative max-h-[94vh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-2xl dark:bg-slate-900 sm:max-w-md sm:rounded-3xl"
                style={animate ? { animation: "hore-pop .55s cubic-bezier(.2,.9,.3,1.2) both" } : undefined}>
                {/* Kepala */}
                <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-purple-600 to-fuchsia-500 px-6 pb-5 pt-5 text-center text-white sm:pb-6 sm:pt-7">
                    {animate && <div className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-white/20 blur-md" style={{ animation: "hore-shine 2.4s .4s ease-in-out" }} aria-hidden />}
                    <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-white/15 ring-4 ring-white/25 sm:mb-3 sm:h-20 sm:w-20"
                        style={animate ? { animation: "hore-bounce 1.6s ease-in-out infinite" } : undefined} aria-hidden>
                        <head.icon className="h-8 w-8 sm:h-10 sm:w-10" strokeWidth={2.2} />
                    </div>
                    <h2 id="hore-title" className="text-xl font-extrabold tracking-tight sm:text-2xl">{head.title(first)}</h2>
                    <p className="mt-1 text-sm font-medium text-white/90">{head.sub}</p>
                    {soNumber && (
                        <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold ring-1 ring-white/25">
                            <FileText className="h-3.5 w-3.5" /> {soNumber}
                        </span>
                    )}
                </div>

                <div className="space-y-4 px-5 pb-2 pt-4">
                    <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">{message}</p>

                    {statsLoading ? (
                        <div className="space-y-3" aria-label="Memuat statistik">
                            <div className="h-11 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
                            <div className="grid grid-cols-2 gap-3">
                                <div className="h-20 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
                                <div className="h-20 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                {[0, 1, 2].map(i => <div key={i} className="h-16 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />)}
                            </div>
                        </div>
                    ) : stats ? (
                        <>
                            {motivation && (
                                <div className={`flex items-start gap-2.5 rounded-2xl border px-3.5 py-2.5 text-sm font-semibold ${toneCls}`}>
                                    <motivation.icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
                                    <span>{motivation.text}</span>
                                </div>
                            )}

                            <section>
                                <div className="mb-2 flex items-baseline justify-between">
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Hari ini</h3>
                                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                        Kemarin jam segini: <b className="text-slate-700 dark:text-slate-200">{stats.yesterdaySameTime.so}</b> SO
                                        {diff !== 0 && (
                                            <span className={`ml-1 font-semibold ${diff > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400"}`}>
                                                {diff > 0 ? `▲ ${diff}` : `▼ ${Math.abs(diff)}`}
                                            </span>
                                        )}
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <Tile label="SO dibuat" value={stats.today.so} tone="indigo" big animate={animate} />
                                    <Tile label="Item desain" value={stats.today.items} tone="fuchsia" big animate={animate} />
                                </div>
                                {prev > 0 && (
                                    <div className="mt-3">
                                        <div className="mb-1 flex justify-between text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                            <span className="inline-flex items-center gap-1">{today >= prev && <Trophy className="h-3 w-3 text-amber-500" />}{today > prev ? "Rekor harian baru!" : today === prev ? "Menyamai rekor harianmu!" : "Menuju rekor harianmu"}</span>
                                            <span className="tabular-nums">{today} / {prev} SO</span>
                                        </div>
                                        <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                                            <div className={`h-full rounded-full ${today >= prev ? "bg-gradient-to-r from-amber-400 to-yellow-300" : "bg-gradient-to-r from-indigo-500 to-fuchsia-500"}`}
                                                style={{ width: `${Math.min(100, Math.round((today / prev) * 100))}%`, animation: animate ? "hore-grow 1.1s .2s ease-out both" : undefined }} />
                                        </div>
                                    </div>
                                )}
                            </section>

                            <section>
                                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Bulan {monthLabel(stats.month.key)}</h3>
                                <div className="grid grid-cols-3 gap-2">
                                    <Tile label="SO dibuat" value={stats.month.so} tone="slate" animate={animate} />
                                    <Tile label="Item desain" value={stats.month.items} tone="slate" animate={animate} />
                                    <Tile label="Sudah jadi nota" value={stats.month.invoiced} tone="emerald" animate={animate} />
                                </div>
                                <div className="mt-2.5 flex flex-wrap gap-1.5 text-[11px] font-medium">
                                    {stats.streak >= 2 && (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-orange-700 ring-1 ring-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:ring-orange-900"><Flame className="h-3 w-3" />{stats.streak} hari kerja beruntun</span>
                                    )}
                                    {avg > 0 && (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-slate-600 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700"><TrendingUp className="h-3 w-3" />rata-rata {avg.toLocaleString("id-ID")} SO/hari aktif</span>
                                    )}
                                    {stats.bestDay && (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900"><Trophy className="h-3 w-3" />rekor: {stats.bestDay.so} SO ({dayLabel(stats.bestDay.date)})</span>
                                    )}
                                </div>
                            </section>
                        </>
                    ) : null}
                </div>

                <div className="sticky bottom-0 grid grid-cols-2 gap-2 bg-white px-5 pb-5 pt-3 dark:bg-slate-900">
                    <button type="button" onClick={onDashboard}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                        <LayoutDashboard className="h-4 w-4" /> Ke Dashboard
                    </button>
                    <button ref={primaryRef} type="button" onClick={onNewSO}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-fuchsia-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:from-indigo-700 hover:to-fuchsia-700">
                        <Plus className="h-4 w-4" /> Buat SO Lagi
                    </button>
                </div>
            </div>
        </div>
    );
}
