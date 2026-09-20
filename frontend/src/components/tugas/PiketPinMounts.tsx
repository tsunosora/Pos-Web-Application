"use client";

import { useMemo, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { PiketPinCard, PiketPinGate } from "./PiketDailyGate";
import { MyAttendancePinCard } from "@/components/dashboard/MyAttendanceLinkCard";
import { SESSION_KEY as DESIGNER_SESSION_KEY, type DesignerSession } from "@/app/so-designer/useDesignerSession";
import { needsShiftCheck } from "@/app/so-designer/shift-check";
import { PIN_KEY as PRODUKSI_PIN_KEY, type ProduksiSession } from "@/app/produksi/produksi-utils";

const STORAGE_EVENT = "piket:storage";
const TICK_MS = 20_000;
const CETAK_KEY = "cetak_piket_identity";
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

/** Identitas PIN /cetak yang masih berlaku (null bila belum ada / kedaluwarsa). */
export function readCetakPiketIdentity(): { designerId: number; name: string; pin: string } | null {
    try {
        const idn = parseJson<CetakIdentity>(localStorage.getItem(CETAK_KEY));
        return idn && idn.expires > Date.now() ? idn : null;
    } catch { return null; }
}

/** Orang ini sudah membuktikan PIN-nya di perangkat ini dan belum kedaluwarsa. */
export function hasCetakPiketIdentity(designerId: number): boolean {
    return readCetakPiketIdentity()?.designerId === designerId;
}

/** Simpan bukti PIN /cetak (berlaku 12 jam) lalu beri tahu kartu piket & absensi. */
export function saveCetakPiketIdentity(designerId: number, name: string, pin: string) {
    try {
        const idn: CetakIdentity = { designerId, name, pin, expires: Date.now() + CETAK_TTL };
        localStorage.setItem(CETAK_KEY, JSON.stringify(idn));
        window.dispatchEvent(new Event(STORAGE_EVENT));
    } catch { /* abaikan */ }
}

/**
 * /cetak — lencana penanda bahwa tugas piket milik operator yang sedang login
 * sudah aktif. PIN-nya sendiri diminta saat memilih nama operator di halaman
 * /cetak, jadi di sini tidak ada lagi dialog PIN terpisah.
 */
export function CetakPiketIdentity({ operatorName, operators }: {
    operatorName: string; operators: { id: number; name: string }[];
}) {
    const { identity, selected, active } = useCetakIdentity(operatorName, operators);
    if (!active || !identity || !selected) return null;
    const first = selected.name.trim().split(/\s+/)[0] || selected.name;
    return (
        <>
            <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                <ShieldCheck className="h-3.5 w-3.5" /> Tugas piket {first} aktif
            </span>
            <PiketPinGate designerId={identity.designerId} pin={identity.pin} />
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

/*
 * Kartu "Absensi saya" untuk halaman kerja ber-PIN. Identitasnya memakai sumber
 * yang sama persis dengan kartu piket di atas, jadi tidak ada login tambahan:
 * PIN dikirim ke backend, backend yang menukarnya jadi tautan portal pribadi.
 */

export function DesignerAbsensiCard({ className }: { className?: string }) {
    const raw = useStorageString("session", DESIGNER_SESSION_KEY);
    const session = useMemo(() => parseJson<DesignerSession>(raw), [raw]);
    const now = useTick();
    if (!session?.id || !session.pin || now === 0) return null;
    return <MyAttendancePinCard designerId={session.id} pin={session.pin} className={className} />;
}

export function ProduksiAbsensiCard({ className }: { className?: string }) {
    const raw = useStorageString("local", PRODUKSI_PIN_KEY);
    const s = useMemo(() => parseJson<ProduksiSession>(raw), [raw]);
    const now = useTick();
    if (!s?.operatorId || !s.operatorPin || now === 0 || s.expires <= now) return null;
    return <MyAttendancePinCard designerId={s.operatorId} pin={s.operatorPin} className={className} />;
}

export function CetakAbsensiCard({ operatorName, operators, className }: {
    operatorName: string; operators: { id: number; name: string }[]; className?: string;
}) {
    const { identity, active } = useCetakIdentity(operatorName, operators);
    if (!active || !identity) return null;
    return <MyAttendancePinCard designerId={identity.designerId} pin={identity.pin} className={className} />;
}
