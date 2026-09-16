"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { BellRing, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { verifyDesignerPin } from "@/lib/api/designers";
import { PiketPinCard, PiketPinGate } from "./PiketDailyGate";
import { SESSION_KEY as DESIGNER_SESSION_KEY, type DesignerSession } from "@/app/so-designer/useDesignerSession";
import { needsShiftCheck } from "@/app/so-designer/shift-check";
import { PIN_KEY as PRODUKSI_PIN_KEY, type ProduksiSession } from "@/app/produksi/produksi-utils";

const STORAGE_EVENT = "piket:storage";
const TICK_MS = 20_000;
const CETAK_KEY = "cetak_piket_identity";
const CETAK_SKIP_KEY = "cetak_piket_skip";
const CETAK_TTL = 12 * 60 * 60 * 1000;

/** Nilai web storage yang reaktif (poll + focus + event), aman untuk render server. */
function useStorageString(kind: "local" | "session", key: string): string | null {
    return useSyncExternalStore(
        (cb) => {
            const t = setInterval(cb, 3000);
            window.addEventListener("focus", cb);
            window.addEventListener("storage", cb);
            window.addEventListener(STORAGE_EVENT, cb);
            return () => {
                clearInterval(t);
                window.removeEventListener("focus", cb);
                window.removeEventListener("storage", cb);
                window.removeEventListener(STORAGE_EVENT, cb);
            };
        },
        () => {
            try { return (kind === "local" ? localStorage : sessionStorage).getItem(key); } catch { return null; }
        },
        () => null,
    );
}

/** Jam kasar (per 20 detik) tanpa memanggil Date.now() saat render. */
function useTick(): number {
    return useSyncExternalStore(
        (cb) => { const t = setInterval(cb, TICK_MS); return () => clearInterval(t); },
        () => Math.floor(Date.now() / TICK_MS) * TICK_MS,
        () => 0,
    );
}

function parseJson<T>(raw: string | null): T | null {
    try { return raw ? (JSON.parse(raw) as T) : null; } catch { return null; }
}

/** /so-designer — desainer yang login dengan nama + PIN. */
export function DesignerPiketGate() {
    const pathname = usePathname();
    const raw = useStorageString("session", DESIGNER_SESSION_KEY);
    const session = useMemo(() => parseJson<DesignerSession>(raw), [raw]);
    const now = useTick();
    if (pathname === "/so-designer" || !session?.id || !session.pin) return null;
    // Tunggu konfirmasi "masih desainer yang sama?" (13.00) selesai dulu — jangan menumpuk pop-up.
    if (now === 0 || needsShiftCheck(session.confirmedAt, now)) return null;
    // Form SO punya bar aksi di bawah → tombol tugas dinaikkan.
    return <PiketPinGate designerId={session.id} pin={session.pin} taskButtonClassName="bottom-24 right-3" />;
}

/** /produksi — operator yang login dengan nama + PIN pribadi (bukan PIN cabang). */
export function ProduksiPiketGate() {
    const raw = useStorageString("local", PRODUKSI_PIN_KEY);
    const s = useMemo(() => parseJson<ProduksiSession>(raw), [raw]);
    const now = useTick();
    if (!s?.operatorId || !s.operatorPin || now === 0 || s.expires <= now) return null;
    return <PiketPinGate designerId={s.operatorId} pin={s.operatorPin} />;
}

/** Kartu "Piket hari ini" di dashboard portal desainer. */
export function DesignerPiketCard({ className }: { className?: string }) {
    const raw = useStorageString("session", DESIGNER_SESSION_KEY);
    const session = useMemo(() => parseJson<DesignerSession>(raw), [raw]);
    const now = useTick();
    if (!session?.id || !session.pin || now === 0) return null;
    return <PiketPinCard designerId={session.id} pin={session.pin} className={className} />;
}

/** Kartu "Piket hari ini" di /produksi (operator login nama + PIN pribadi). */
export function ProduksiPiketCard({ className }: { className?: string }) {
    const raw = useStorageString("local", PRODUKSI_PIN_KEY);
    const s = useMemo(() => parseJson<ProduksiSession>(raw), [raw]);
    const now = useTick();
    if (!s?.operatorId || !s.operatorPin || now === 0 || s.expires <= now) return null;
    return <PiketPinCard designerId={s.operatorId} pin={s.operatorPin} className={className} />;
}

interface CetakIdentity { designerId: number; name: string; pin: string; expires: number }

/** Operator /cetak yang dipilih + identitas PIN yang tersimpan (aktif bila cocok & belum kedaluwarsa). */
function useCetakIdentity(operatorName: string, operators: { id: number; name: string }[]) {
    const raw = useStorageString("local", CETAK_KEY);
    const identity = useMemo(() => parseJson<CetakIdentity>(raw), [raw]);
    const now = useTick();
    const selected = operators.find((o) => o.name === operatorName) ?? null;
    const active = !!selected && now !== 0 && !!identity && identity.designerId === selected.id && identity.expires > now;
    return { identity, selected, now, active };
}

export function clearCetakPiketIdentity() {
    try { localStorage.removeItem(CETAK_KEY); } catch { /* abaikan */ }
}

function readSkipped(): number[] {
    try {
        const v = JSON.parse(sessionStorage.getItem(CETAK_SKIP_KEY) || "[]");
        return Array.isArray(v) ? v.filter((x) => typeof x === "number") : [];
    } catch {
        return [];
    }
}

/**
 * /cetak — operator dipilih dari dropdown (tanpa PIN). Agar pop-up piket miliknya
 * muncul, operator memastikan dirinya sekali dengan PIN pribadi.
 */
export function CetakPiketIdentity({ operatorName, operators }: {
    operatorName: string; operators: { id: number; name: string }[];
}) {
    const { identity, selected, now, active } = useCetakIdentity(operatorName, operators);
    const [open, setOpen] = useState(false);
    const [skipped, setSkipped] = useState<number[]>(() => readSkipped());
    const [pin, setPin] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    if (!selected || now === 0) return null;
    const autoOpen = !active && !skipped.includes(selected.id);
    const first = selected.name.trim().split(/\s+/)[0] || selected.name;

    const close = () => {
        const next = skipped.includes(selected.id) ? skipped : [...skipped, selected.id];
        setSkipped(next);
        try { sessionStorage.setItem(CETAK_SKIP_KEY, JSON.stringify(next)); } catch { /* abaikan */ }
        setOpen(false);
        setPin("");
        setError(null);
    };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!pin.trim() || loading) return;
        setLoading(true);
        setError(null);
        try {
            const r = await verifyDesignerPin(selected.id, pin.trim());
            if (!r.valid) { setError(`PIN salah. Kalau bukan ${first}, ganti nama operator dulu.`); return; }
            const idn: CetakIdentity = { designerId: selected.id, name: selected.name, pin: pin.trim(), expires: Date.now() + CETAK_TTL };
            localStorage.setItem(CETAK_KEY, JSON.stringify(idn));
            window.dispatchEvent(new Event(STORAGE_EVENT));
            close();
        } catch {
            setError("Gagal menghubungi server. Coba lagi.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            {active ? (
                <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                    <ShieldCheck className="h-3.5 w-3.5" /> Tugas piket {first} aktif
                </span>
            ) : (
                <button type="button" onClick={() => setOpen(true)}
                    className="mt-1 inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 transition hover:bg-amber-500/15 dark:text-amber-300">
                    <BellRing className="h-3.5 w-3.5" /> Tampilkan tugas piket {first}
                </button>
            )}

            {active && identity && <PiketPinGate designerId={identity.designerId} pin={identity.pin} />}

            {!active && (open || autoOpen) && (
                <div role="dialog" aria-modal="true" aria-labelledby="cetak-piket-title"
                    className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/60 backdrop-blur-sm sm:items-center sm:p-4">
                    <form onSubmit={submit} className="w-full overflow-hidden rounded-t-3xl bg-white shadow-2xl dark:bg-slate-900 sm:max-w-sm sm:rounded-3xl">
                        <div className="bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 px-6 pb-5 pt-6 text-center text-white">
                            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-white/20 ring-4 ring-white/25">
                                <KeyRound className="h-6 w-6" />
                            </div>
                            <h2 id="cetak-piket-title" className="text-lg font-extrabold">Halo {first}, masukkan PIN kamu</h2>
                            <p className="mt-1 text-xs text-white/90">Supaya tugas piket, pengingat &amp; teguran milikmu muncul di halaman ini.</p>
                        </div>
                        <div className="space-y-3 p-5">
                            <input type="password" inputMode="numeric" autoComplete="off" aria-label="PIN pribadi"
                                value={pin} onChange={(e) => { setPin(e.target.value); setError(null); }} placeholder="PIN"
                                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-center text-lg tracking-[0.4em] text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
                            {error && <p className="text-center text-xs font-medium text-rose-600">{error}</p>}
                            <button type="submit" disabled={!pin.trim() || loading}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50">
                                {loading && <Loader2 className="h-4 w-4 animate-spin" />} Tampilkan tugas saya
                            </button>
                            <button type="button" onClick={close}
                                className="w-full text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200">
                                Nanti saja
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </>
    );
}

/** Kartu "Piket hari ini" di /cetak — tampil setelah operator memastikan PIN-nya. */
export function CetakPiketCard({ operatorName, operators, className }: {
    operatorName: string; operators: { id: number; name: string }[]; className?: string;
}) {
    const { identity, active } = useCetakIdentity(operatorName, operators);
    if (!active || !identity) return null;
    return <PiketPinCard designerId={identity.designerId} pin={identity.pin} className={className} />;
}
