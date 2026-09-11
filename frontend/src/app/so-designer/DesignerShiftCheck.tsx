"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AlertTriangle, Clock, KeyRound, Loader2, LogOut, UserCheck } from "lucide-react";
import { verifyDesignerPin } from "@/lib/api/designers";
import { SESSION_KEY, type DesignerSession } from "./useDesignerSession";
import { SHIFT_CHANGE_HOUR_WIB, isDesignerFormDirty, lastShiftBoundary, needsShiftCheck, setDesignerFormDirty } from "./shift-check";

const CHECK_EVERY_MS = 20_000;

function readSession(): DesignerSession | null {
    try {
        const raw = sessionStorage.getItem(SESSION_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

/**
 * Pengingat pergantian shift desainer. Lewat 13.00 WIB (atau hari baru), sesi PIN yang masih
 * terbuka wajib dipastikan: lanjut dengan PIN yang sama, atau ganti desainer. Mencegah SO shift
 * siang tercatat atas nama desainer shift pagi yang lupa keluar.
 */
export function DesignerShiftCheck() {
    const pathname = usePathname();
    const onLoginPage = pathname === "/so-designer";
    const [session, setSession] = useState<DesignerSession | null>(null);
    const [kind, setKind] = useState<"shift" | "day">("shift");
    const [pin, setPin] = useState("");
    const [checking, setChecking] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [confirmSwitch, setConfirmSwitch] = useState(false);
    const pinRef = useRef<HTMLInputElement>(null);

    const evaluate = useCallback(() => {
        if (onLoginPage) { setSession(null); return; }
        const s = readSession();
        const now = Date.now();
        if (s && needsShiftCheck(s.confirmedAt, now)) {
            setKind(lastShiftBoundary(now).kind);
            setSession(prev => (prev && prev.id === s.id ? prev : s));
        } else {
            setSession(null);
        }
    }, [onLoginPage]);

    useEffect(() => {
        evaluate();
        const timer = setInterval(evaluate, CHECK_EVERY_MS);
        const onVisible = () => { if (document.visibilityState === "visible") evaluate(); };
        document.addEventListener("visibilitychange", onVisible);
        window.addEventListener("focus", evaluate);
        return () => {
            clearInterval(timer);
            document.removeEventListener("visibilitychange", onVisible);
            window.removeEventListener("focus", evaluate);
        };
    }, [evaluate]);

    const open = !!session;
    useEffect(() => {
        if (!open) return;
        setPin("");
        setError(null);
        setConfirmSwitch(false);
        const t = setTimeout(() => pinRef.current?.focus(), 50);
        return () => clearTimeout(t);
    }, [open]);

    async function stay() {
        if (!session || !pin.trim() || checking) return;
        setChecking(true);
        setError(null);
        try {
            const res = await verifyDesignerPin(session.id, pin.trim());
            if (!res.valid || res.id !== session.id) {
                setError(`PIN salah. Kalau bukan ${session.name} yang memakai, pilih Ganti Desainer.`);
                return;
            }
            const current = readSession() ?? session;
            sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ...current, pin: pin.trim(), confirmedAt: Date.now() }));
            setSession(null);
        } catch {
            setError("Gagal menghubungi server. Coba lagi.");
        } finally {
            setChecking(false);
        }
    }

    function switchDesigner() {
        if (isDesignerFormDirty() && !confirmSwitch) { setConfirmSwitch(true); return; }
        try { sessionStorage.removeItem(SESSION_KEY); } catch { /* abaikan */ }
        setDesignerFormDirty(false);
        window.location.assign("/so-designer"); // muat ulang penuh → state halaman lama bersih
    }

    if (!open || !session) return null;
    const first = session.name.trim().split(/\s+/)[0] || session.name;
    const initials = session.name.trim().split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase();
    const hour = `${String(SHIFT_CHANGE_HOUR_WIB).padStart(2, "0")}.00`;

    return (
        <div role="dialog" aria-modal="true" aria-labelledby="shift-check-title"
            className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/70 backdrop-blur-sm sm:items-center sm:p-4">
            <div className="w-full overflow-hidden rounded-t-3xl bg-white shadow-2xl dark:bg-slate-900 sm:max-w-sm sm:rounded-3xl">
                <div className="bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 px-6 pb-5 pt-6 text-center text-white">
                    <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-white/20 ring-4 ring-white/25">
                        <Clock className="h-7 w-7" />
                    </div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-white/85">
                        {kind === "shift" ? `Pergantian shift ${hour} WIB` : "Shift baru hari ini"}
                    </p>
                    <h2 id="shift-check-title" className="mt-1 text-xl font-extrabold">Masih {first} yang pakai?</h2>
                    <p className="mt-1 text-xs text-white/90">Pastikan nama desainer benar supaya SO & kinerja tercatat atas nama yang tepat.</p>
                </div>

                <div className="space-y-4 p-5">
                    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 dark:border-slate-700 dark:bg-slate-800/60">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 text-sm font-bold text-white">{initials}</div>
                        <div className="min-w-0">
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">Sedang login sebagai</div>
                            <div className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">
                                {session.name}
                                {session.branchName && <span className="font-medium text-slate-500 dark:text-slate-400"> · {session.branchName}</span>}
                            </div>
                        </div>
                    </div>

                    <form onSubmit={e => { e.preventDefault(); stay(); }} className="space-y-2">
                        <label htmlFor="shift-check-pin" className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                            <KeyRound className="h-3.5 w-3.5" /> Masih {first}? Masukkan PIN kamu
                        </label>
                        <div className="flex gap-2">
                            <input id="shift-check-pin" ref={pinRef} type="password" inputMode="numeric" autoComplete="off"
                                value={pin} onChange={e => { setPin(e.target.value); setError(null); }} placeholder="PIN"
                                className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-center text-lg tracking-[0.4em] text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
                            <button type="submit" disabled={!pin.trim() || checking}
                                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50">
                                {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />} Lanjut
                            </button>
                        </div>
                        {error && <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{error}</p>}
                    </form>

                    <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />atau<span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                    </div>

                    <div className="space-y-2">
                        {confirmSwitch && (
                            <p className="flex items-start gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900">
                                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                SO yang sedang diisi belum disimpan dan akan hilang. Tekan sekali lagi untuk tetap ganti desainer.
                            </p>
                        )}
                        <button type="button" onClick={switchDesigner}
                            className={`inline-flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-semibold transition ${confirmSwitch ? "border-rose-400 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300" : "border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"}`}>
                            <LogOut className="h-4 w-4" /> {confirmSwitch ? "Ya, ganti desainer" : `Bukan ${first}? Ganti Desainer`}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
