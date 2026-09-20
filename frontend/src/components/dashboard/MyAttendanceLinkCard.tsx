"use client";

import { useQuery } from "@tanstack/react-query";
import { getMyHrPortal, getMyHrPortalByPin, type HrMyPortal } from "@/lib/api/hr";
import { CalendarCheck2, ExternalLink } from "lucide-react";

/**
 * Kartu kecil "Absensi saya" — tiap karyawan membuka portal pribadinya sendiri
 * di RateMyStaff (`/me/<token>`, terkunci PIN).
 *
 * Sengaja hanya tautan: datanya tetap dibaca di RateMyStaff supaya PosPro tidak
 * ikut menanggung beban & tidak menyimpan data absensi per orang. Tautannya
 * diambil lewat backend PosPro berdasarkan akun yang sedang login, jadi tak bisa
 * dipakai melihat portal orang lain.
 */
export function MyAttendanceLinkCard() {
    const { data } = useQuery<HrMyPortal>({
        queryKey: ["hr-my-portal"],
        queryFn: getMyHrPortal,
        staleTime: 10 * 60_000,
        retry: false,
    });

    return <KartuPortal data={data} />;
}

/** Tampilan kartunya — dipakai versi login maupun versi PIN. */
function KartuPortal({ data, className }: { data?: HrMyPortal; className?: string }) {
    // Belum dipetakan ke karyawan RateMyStaff / RateMyStaff mati → kartu disembunyikan.
    if (!data?.found || !data.portalUrl) return null;

    return (
        <a
            href={data.portalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`glass-card flex items-center gap-3 rounded-2xl p-4 transition-colors hover:bg-muted/20 ${className ?? ""}`}
        >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
                <CalendarCheck2 className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">
                    Absensi saya{data.name ? ` — ${data.name}` : ""}
                </div>
                <div className="truncate text-[11px] text-muted-foreground">
                    {data.hasPin
                        ? "Buka portal pribadi: absensi, penilaian & poin"
                        : "Buka portal — buat PIN dulu, lalu lihat absensi & poin"}
                </div>
            </div>
            <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
        </a>
    );
}

/**
 * Versi halaman kerja ber-PIN (/so-designer, /produksi, /cetak): identitas
 * dibuktikan dengan PIN pribadi yang sama dengan kartu piket, bukan token login.
 */
export function MyAttendancePinCard({ designerId, pin, className }: {
    designerId: number;
    pin: string;
    className?: string;
}) {
    const { data } = useQuery<HrMyPortal>({
        queryKey: ["hr-my-portal-pin", designerId],
        queryFn: () => getMyHrPortalByPin(designerId, pin),
        enabled: !!designerId && !!pin,
        staleTime: 10 * 60_000,
        retry: false,
    });
    return <KartuPortal data={data} className={className} />;
}
