"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getHrSummary, type HrSummary } from "@/lib/api/hr";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { badgeToneClass } from "@/components/ui/status-badge";
import { CalendarClock, Clock, ExternalLink, Trophy, UserCheck } from "lucide-react";

// Alamat aplikasi HR milik tiap toko — dari env build, bukan tertanam di kode (T-34).
const RATEMYSTAFF_URL = process.env.NEXT_PUBLIC_HR_APP_URL || "";
const ROLE_OWNER = ["owner", "superadmin", "super_admin", "super admin", "pemilik"];

/** Berapa nama yang ditampilkan — kartu ini sengaja dangkal, detail ada di RateMyStaff. */
const MAKS_NAMA = 3;

function Angka({ nilai, label, tone }: { nilai: string; label: string; tone?: string }) {
    return (
        <div className="min-w-0">
            <div className={`text-sm font-bold leading-none ${tone ?? ""}`}>{nilai}</div>
            <div className="mt-1 truncate text-[11px] text-muted-foreground">{label}</div>
        </div>
    );
}

function Kerangka() {
    return (
        <div className="glass-card rounded-2xl p-5">
            <div className="mb-4 h-4 w-32 animate-pulse rounded bg-muted" />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                    <div key={i}>
                        <div className="h-6 w-16 animate-pulse rounded bg-muted" />
                        <div className="mt-2 h-3 w-20 animate-pulse rounded bg-muted/70" />
                    </div>
                ))}
            </div>
            <div className="mt-4 h-3 w-48 animate-pulse rounded bg-muted/70" />
        </div>
    );
}

/**
 * Kartu "Sekilas HR" — menjawab "bagaimana tim hari ini?" dalam sekali lihat.
 * Sengaja dangkal: tanpa tabel & tanpa aksi. Untuk mendalam → RateMyStaff.
 *
 * Datanya lewat backend PosPro (/hr/summary), BUKAN langsung ke RateMyStaff,
 * supaya kunci API tidak pernah sampai ke browser.
 */
export function HrSummaryCard() {
    const { roleName } = useCurrentUser();
    const boleh = useMemo(() => {
        const n = (roleName ?? "").toLowerCase();
        if (!n) return false;
        return ROLE_OWNER.includes(n) || n.includes("manajer") || n.includes("manager");
    }, [roleName]);

    const { data, isLoading } = useQuery<HrSummary>({
        queryKey: ["hr-summary"],
        queryFn: getHrSummary,
        enabled: boleh,
        refetchInterval: 5 * 60_000, // kartu sekilas, tak perlu real-time
        staleTime: 60_000,
        retry: false,
    });

    if (!boleh) return null;
    if (isLoading) return <Kerangka />;

    const judul = (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-bold">
                <UserCheck className="h-4 w-4 text-primary" /> Sekilas HR
                {data?.date && (
                    <span className="text-[11px] font-normal text-muted-foreground">
                        {new Date(data.date).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })}
                    </span>
                )}
            </h3>
            {RATEMYSTAFF_URL && <a
                href={RATEMYSTAFF_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
            >
                Buka RateMyStaff <ExternalLink className="h-3 w-3" />
            </a>}
        </div>
    );

    // RateMyStaff mati/lambat → kartu tetap tampil tenang, bukan error merah.
    if (!data?.available) {
        return (
            <div className="glass-card rounded-2xl p-5">
                {judul}
                <p className="text-xs text-muted-foreground">
                    Data HR tak bisa dihubungi saat ini. Coba lagi beberapa menit lagi.
                </p>
            </div>
        );
    }

    const a = data.attendance;
    const telat = (data.lateToday ?? []).slice(0, MAKS_NAMA);
    const poinAktif = data.points?.enabled && (data.points.top ?? []).length > 0;
    const poin = (data.points?.top ?? []).slice(0, MAKS_NAMA);
    const menunggu = data.pendingLeave ?? 0;

    return (
        <div className="glass-card rounded-2xl p-5">
            {judul}

            {menunggu > 0 && (
                <div className={`${badgeToneClass.warning} mb-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold`}>
                    <CalendarClock className="h-3 w-3" />
                    {menunggu} izin menunggu persetujuan
                </div>
            )}

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="min-w-0">
                    <div className="text-2xl font-bold leading-none">
                        {a ? `${a.present}/${a.employees}` : "–"}
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                        hadir hari ini{a ? ` · ${a.rate}%` : ""}
                    </div>
                </div>

                <div className="min-w-0">
                    <div className={`text-2xl font-bold leading-none ${a && a.late > 0 ? "text-amber-600 dark:text-amber-400" : ""}`}>
                        {a?.late ?? 0}
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Clock className="h-3 w-3 shrink-0" /> terlambat
                    </div>
                </div>

                <Angka nilai={String(a?.notYetIn ?? 0)} label="belum absen" />
                <Angka nilai={String(a?.leave ?? 0)} label="izin hari ini" />
            </div>

            {telat.length > 0 && (
                <p className="mt-3 truncate text-[11px] text-muted-foreground" title={telat.map((t) => `${t.name} ${t.clockIn}`).join(", ")}>
                    Telat: {telat.map((t) => `${t.name} (${t.clockIn})`).join(" · ")}
                    {(data.lateToday?.length ?? 0) > MAKS_NAMA ? " …" : ""}
                </p>
            )}

            {poinAktif && (
                <div className="mt-4 border-t border-border/60 pt-3">
                    <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                        <Trophy className="h-3 w-3 text-amber-500" />
                        Poin {data.points?.periodLabel ?? "bulan ini"}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                        {poin.map((p, i) => (
                            <span key={p.name} className="text-xs">
                                <span className="text-muted-foreground">{i + 1}.</span>{" "}
                                <span className="font-medium">{p.name}</span>{" "}
                                <span className="text-muted-foreground">{p.points.toLocaleString("id-ID")}</span>
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
