"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useNotificationStore } from "@/store/notification-store";
import { Clock, FileText, X, Bell } from "lucide-react";

const AUTO_DISMISS_MS = 60_000; // auto-dismiss setelah 60 detik

export function ShiftReminderBanner() {
    const router = useRouter();
    const banner = useNotificationStore(s => s.shiftBanner);
    const dismiss = useNotificationStore(s => s.dismissShiftBanner);
    const [countdown, setCountdown] = useState(60);
    const [visible, setVisible] = useState(false);

    // Animate in ketika banner muncul
    useEffect(() => {
        if (banner?.visible) {
            setCountdown(60);
            setVisible(false);
            // Trigger animation frame setelah mount
            const t = setTimeout(() => setVisible(true), 30);
            return () => clearTimeout(t);
        } else {
            setVisible(false);
        }
    }, [banner?.visible]);

    // Countdown auto-dismiss
    useEffect(() => {
        if (!banner?.visible) return;
        const interval = setInterval(() => {
            setCountdown(c => {
                if (c <= 1) {
                    // Defer store mutation supaya tidak trigger setState lintas komponen
                    // di tengah React render cycle (penyebab warning "Cannot update a component
                    // while rendering a different component").
                    queueMicrotask(dismiss);
                    return 0;
                }
                return c - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [banner?.visible, dismiss]);

    if (!banner?.visible) return null;

    const handleGoToShift = () => {
        dismiss();
        router.push('/pos/close-shift');
    };

    const circumference = 2 * Math.PI * 22; // r=22
    const progress = ((60 - countdown) / 60) * circumference;

    return (
        // Overlay backdrop
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Blurred backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={dismiss}
            />

            {/* Banner card */}
            <div
                className={`relative z-10 w-full max-w-md transition-all duration-500 ${
                    visible
                        ? 'opacity-100 scale-100 translate-y-0'
                        : 'opacity-0 scale-90 translate-y-4'
                }`}
            >
                {/* Glowing ring */}
                <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 opacity-75 blur-md animate-pulse" />

                <div className="relative bg-card rounded-2xl border border-indigo-200 shadow-2xl overflow-hidden">
                    {/* Top gradient bar */}
                    <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500" />

                    {/* Header */}
                    <div className="px-6 pt-5 pb-4 bg-gradient-to-b from-indigo-50 to-background">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                                {/* Animated bell icon */}
                                <div className="relative w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center shadow-inner">
                                    <Bell className="w-6 h-6 text-indigo-600 animate-[wiggle_1s_ease-in-out_infinite]" />
                                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-500 border-2 border-background animate-ping" />
                                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-500 border-2 border-background" />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-indigo-500 uppercase tracking-widest">
                                        Pengingat Shift
                                    </p>
                                    <h2 className="text-xl font-bold text-foreground leading-tight">
                                        Waktu Tutup {banner.shiftLabel}!
                                    </h2>
                                </div>
                            </div>

                            {/* Countdown ring */}
                            <div className="relative shrink-0 w-14 h-14">
                                <svg className="w-14 h-14 -rotate-90" viewBox="0 0 48 48">
                                    <circle cx="24" cy="24" r="22" fill="none" stroke="#e0e7ff" strokeWidth="4" />
                                    <circle
                                        cx="24" cy="24" r="22" fill="none"
                                        stroke="#6366f1" strokeWidth="4"
                                        strokeDasharray={circumference}
                                        strokeDashoffset={circumference - progress}
                                        strokeLinecap="round"
                                        className="transition-all duration-1000"
                                    />
                                </svg>
                                <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-indigo-600">
                                    {countdown}s
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Body */}
                    <div className="px-6 py-4 space-y-3">
                        {/* Time display */}
                        <div className="flex items-center gap-3 bg-indigo-50 rounded-xl px-4 py-3 border border-indigo-100">
                            <Clock className="w-5 h-5 text-indigo-500 shrink-0" />
                            <div>
                                <p className="text-xs text-muted-foreground">Jam yang ditentukan</p>
                                <p className="text-2xl font-black text-indigo-700 tracking-tight font-mono">
                                    {banner.time}
                                </p>
                            </div>
                        </div>

                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Sudah saatnya mengirimkan <strong>laporan tutup shift</strong>.
                            Pastikan semua transaksi sudah dicatat sebelum mengakhiri shift.
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="px-6 pb-5 flex gap-3">
                        <button
                            onClick={handleGoToShift}
                            className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.97] text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-indigo-200"
                        >
                            <FileText className="w-4 h-4" />
                            Buka Laporan Shift
                        </button>
                        <button
                            onClick={dismiss}
                            className="flex items-center justify-center gap-1.5 border border-border text-muted-foreground hover:bg-muted px-4 py-3 rounded-xl transition-colors text-sm font-medium"
                        >
                            <X className="w-4 h-4" />
                            Nanti
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
