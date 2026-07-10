"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useBranchStore } from "@/store/branch-store";
import { getDailyTargetStatus } from "@/lib/api/reports";
import { AlertTriangle, X, TrendingDown } from "lucide-react";

const EOD_ALERT_HOUR = 20; // jam mulai peringatan akhir hari (format 24 jam)
const DISMISS_KEY = "pospro-target-alert-dismissed"; // value = "YYYY-MM-DD"

const rupiah = (n: number) => "Rp " + Math.round(n).toLocaleString("id-ID");

export function DailyTargetBanner() {
    const activeBranchId = useBranchStore((s) => s.activeBranchId);
    const [visible, setVisible] = useState(false);
    const [dismissedToday, setDismissedToday] = useState(false);
    const [now, setNow] = useState<Date | null>(null);

    // Tick tiap menit supaya gate jam ter-evaluasi tanpa reload.
    useEffect(() => {
        setNow(new Date());
        const t = setInterval(() => setNow(new Date()), 60_000);
        return () => clearInterval(t);
    }, []);

    const isEod = !!now && now.getHours() >= EOD_ALERT_HOUR;

    const { data } = useQuery({
        queryKey: ["daily-target-status", activeBranchId],
        queryFn: getDailyTargetStatus,
        refetchInterval: 5 * 60_000,
        enabled: isEod, // hanya fetch saat sudah lewat ambang (cache di-share dgn kartu)
    });

    const missed = useMemo(
        () => (data?.branches ?? []).filter((b) => !b.met && b.dailyTarget > 0),
        [data],
    );

    // Cek dedupe harian saat data siap
    useEffect(() => {
        if (!data) return;
        let already = false;
        try {
            already = localStorage.getItem(DISMISS_KEY) === data.today;
        } catch {
            /* ignore */
        }
        setDismissedToday(already);
    }, [data]);

    const shouldShow = isEod && missed.length > 0 && !dismissedToday;

    // Animate in
    useEffect(() => {
        if (shouldShow) {
            const t = setTimeout(() => setVisible(true), 30);
            return () => clearTimeout(t);
        }
        setVisible(false);
    }, [shouldShow]);

    const dismiss = () => {
        try {
            if (data) localStorage.setItem(DISMISS_KEY, data.today);
        } catch {
            /* ignore */
        }
        setDismissedToday(true);
        setVisible(false);
    };

    if (!shouldShow) return null;

    const totalShortfall = missed.reduce((s, b) => s + b.shortfall, 0);

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/65 backdrop-blur-3xl" onClick={dismiss} />

            <div
                className={`relative z-10 w-full max-w-md transition-all duration-500 ${
                    visible
                        ? "opacity-100 scale-100 translate-y-0"
                        : "opacity-0 scale-90 translate-y-4"
                }`}
            >
                {/* Glow ring */}
                <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-red-500 via-orange-500 to-red-500 opacity-75 blur-md animate-pulse" />

                <div className="relative overflow-hidden rounded-2xl border border-red-200 bg-card shadow-2xl">
                    <div className="h-1.5 bg-gradient-to-r from-red-500 via-orange-500 to-red-500" />

                    {/* Header */}
                    <div className="bg-gradient-to-b from-red-50 to-background px-6 pb-4 pt-5">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 shadow-inner">
                                    <AlertTriangle className="h-6 w-6 text-red-600" />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-widest text-red-500">
                                        Target Belum Tercapai
                                    </p>
                                    <h2 className="text-xl font-bold leading-tight text-foreground">
                                        {missed.length === 1
                                            ? "Omzet hari ini di bawah target"
                                            : `${missed.length} cabang di bawah target`}
                                    </h2>
                                </div>
                            </div>
                            <button
                                onClick={dismiss}
                                aria-label="Tutup"
                                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                    </div>

                    {/* Body: rincian cabang meleset */}
                    <div className="space-y-2 px-6 py-4">
                        {missed.map((b) => (
                            <div
                                key={b.branchId}
                                className="flex items-center justify-between rounded-xl border border-red-100 bg-red-50 px-4 py-2.5"
                            >
                                <div className="flex items-center gap-2">
                                    <TrendingDown className="h-4 w-4 shrink-0 text-red-500" />
                                    <span className="text-sm font-medium text-foreground">
                                        {b.branchName}
                                    </span>
                                </div>
                                <div className="text-right">
                                    <p className="font-mono text-sm font-bold text-red-700">
                                        {rupiah(b.todayOmzet)}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground">
                                        target {rupiah(b.dailyTarget)}
                                    </p>
                                </div>
                            </div>
                        ))}
                        <p className="pt-1 text-sm leading-relaxed text-muted-foreground">
                            Kekurangan total{" "}
                            <strong className="text-red-600">{rupiah(totalShortfall)}</strong> untuk
                            menutup beban tetap bulanan hari ini.
                        </p>
                    </div>

                    {/* Action */}
                    <div className="px-6 pb-5">
                        <button
                            onClick={dismiss}
                            className="w-full rounded-xl bg-red-600 py-3 font-semibold text-white shadow-lg transition-all hover:bg-red-700 active:scale-[0.97]"
                        >
                            Mengerti
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
