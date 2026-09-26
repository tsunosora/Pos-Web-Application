"use client";

/**
 * Spanduk keadaan lisensi — SATU tempat, dipasang sekali di `MainLayout` tepat di bawah header.
 * Jangan menyalinnya ke halaman mana pun: dua spanduk yang mengabarkan hal yang sama membuat
 * orang belajar mengabaikan dua-duanya.
 *
 * Sengaja BUKAN modal (beda dengan `ShiftReminderBanner` & `DailyTargetBanner`): kasir yang
 * sedang melayani pelanggan tidak boleh harus menutup kotak dialog dulu. Ini strip tipis yang
 * bisa diabaikan sambil kerja.
 *
 * Kapan tampil (aturannya di `lib/lisensi/aturan-menu.ts` → `spandukLisensi()`):
 * - `tenggang`  → peringatan halus, masih boleh mencatat, bisa ditutup (kembali besok).
 * - `hanya_baca`→ spanduk jelas, tidak bisa ditutup.
 * - `tanpa_lisensi` / penegakan mati → TIDAK ADA APA-APA. Instalasi yang belum tersambung ke
 *   qendali.com itu keadaan normal; mengganggunya cuma bikin bising.
 */

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { AlertTriangle, Lock, Receipt, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useLisensi } from "@/hooks/useLisensi";

// Peringatan tenggang yang ditutup hanya diam SEHARI — isinya tanggal "YYYY-MM-DD".
// Kalau ditutup selamanya, pemilik bisa lupa sampai aplikasinya benar-benar hanya-baca.
const KUNCI_TUTUP = "qendali-spanduk-tenggang-ditutup";

const hariIni = () => new Date().toISOString().slice(0, 10);

// Simpanan kecil "ditutup tanggal berapa", dibaca lewat `useSyncExternalStore` — bukan
// useState+useEffect. Alasannya: localStorage itu sistem di luar React dan tidak ada di server,
// jadi membacanya di dalam efek berarti satu render tambahan tiap halaman dibuka (dan ESLint
// React memang melarangnya). `tutupSesi` jadi cadangan kalau localStorage diblokir (mode privat):
// tanpa itu spanduknya muncul lagi tiap pindah halaman walau baru ditutup.
let tutupSesi: string | null = null;
const pendengar = new Set<() => void>();

function bacaTutup(): string | null {
    try {
        return localStorage.getItem(KUNCI_TUTUP) ?? tutupSesi;
    } catch {
        return tutupSesi;
    }
}

function berlanggananTutup(beriTahu: () => void): () => void {
    pendengar.add(beriTahu);
    return () => { pendengar.delete(beriTahu); };
}

function catatTutup(tanggal: string): void {
    tutupSesi = tanggal;
    try {
        localStorage.setItem(KUNCI_TUTUP, tanggal);
    } catch {
        /* abaikan — `tutupSesi` sudah cukup untuk sesi ini */
    }
    pendengar.forEach((f) => f());
}

export function SpandukLisensi() {
    const { spanduk } = useLisensi();
    const { isOwner } = useCurrentUser();
    // Di server belum ada localStorage → null, lalu React menyelaraskannya saat hidrasi.
    const ditutupPada = useSyncExternalStore(berlanggananTutup, bacaTutup, () => null);

    if (!spanduk) return null;
    if (spanduk.bisaDitutup && ditutupPada === hariIni()) return null;

    const genting = spanduk.nada === "genting";
    const Ikon = genting ? Lock : AlertTriangle;
    const tutup = () => catatTutup(hariIni());

    return (
        <div
            role={genting ? "alert" : "status"}
            className={cn(
                "flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 border-b px-4 py-2 text-sm print:hidden",
                genting
                    ? "border-red-500/40 bg-red-500/10 text-red-900 dark:text-red-100"
                    : "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100",
            )}
        >
            <Ikon className={cn("h-4 w-4 shrink-0", genting ? "text-red-600" : "text-amber-600")} aria-hidden="true" />
            <span className="font-semibold">{spanduk.judul}.</span>
            <span className="min-w-0 flex-1 opacity-90">{spanduk.pesan}</span>

            {/* Tautan jalan keluar hanya untuk pemilik: halaman Langganan memang ownerOnly dan
                backend menolaknya juga, jadi mengirim kasir ke sana cuma memberi dia galat. */}
            {isOwner ? (
                <Link
                    href="/settings/langganan"
                    className={cn(
                        "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold text-white transition-colors",
                        genting ? "bg-red-600 hover:bg-red-700" : "bg-amber-600 hover:bg-amber-700",
                    )}
                >
                    <Receipt className="h-3.5 w-3.5" /> Buka Langganan
                </Link>
            ) : (
                <span className="shrink-0 text-xs opacity-80">Beri tahu pemilik: Pengaturan → Langganan.</span>
            )}

            {spanduk.bisaDitutup && (
                <button
                    type="button"
                    onClick={tutup}
                    aria-label="Sembunyikan sampai besok"
                    title="Sembunyikan sampai besok"
                    className="shrink-0 rounded-md p-1 opacity-70 transition hover:bg-black/10 hover:opacity-100 dark:hover:bg-white/10"
                >
                    <X className="h-4 w-4" />
                </button>
            )}
        </div>
    );
}
