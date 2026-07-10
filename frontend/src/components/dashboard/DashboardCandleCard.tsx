"use client";

import dynamic from "next/dynamic";
import { useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import "dayjs/locale/id";
import { Loader2, CandlestickChart, ArrowUpRight } from "lucide-react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useBranchStore } from "@/store/branch-store";
import { getFinanceCandles, type FinanceTimeframe } from "@/lib/api/finance-analytics";
import { JournalDrawer } from "@/components/owner/finance/JournalDrawer";

dayjs.locale("id");

const CandleChart = dynamic(
    () => import("@/components/owner/finance/CandleChart").then((m) => m.CandleChart),
    {
        ssr: false,
        loading: () => (
            <div className="grid h-[300px] place-items-center text-muted-foreground">
                <Loader2 className="animate-spin" />
            </div>
        ),
    },
);

const TF: { value: FinanceTimeframe; label: string; days: number }[] = [
    { value: "day", label: "Harian", days: 45 },
    { value: "week", label: "Mingguan", days: 180 },
    { value: "month", label: "Bulanan", days: 730 },
];

/** Rentang bucket dari 1 candle yang diklik (untuk drill-down jurnal). */
function bucketRange(time: string, tf: FinanceTimeframe) {
    const d = dayjs(time);
    if (tf === "month")
        return {
            startDate: d.startOf("month").format("YYYY-MM-DD"),
            endDate: d.endOf("month").format("YYYY-MM-DD"),
        };
    if (tf === "week")
        return { startDate: d.format("YYYY-MM-DD"), endDate: d.add(6, "day").format("YYYY-MM-DD") };
    return { startDate: time, endDate: time };
}

export function DashboardCandleCard() {
    const { isOwner } = useCurrentUser();
    const activeBranchId = useBranchStore((s) => s.activeBranchId);
    const [tf, setTf] = useState<FinanceTimeframe>("day");
    const [drill, setDrill] = useState<{ startDate: string; endDate: string } | null>(null);
    const includeFixed = true;

    const range = useMemo(() => {
        const today = dayjs().format("YYYY-MM-DD");
        const cfg = TF.find((t) => t.value === tf)!;
        return { startDate: dayjs().subtract(cfg.days, "day").format("YYYY-MM-DD"), endDate: today };
    }, [tf]);

    const { data, isLoading } = useQuery({
        queryKey: ["finance-candles", tf, range.startDate, range.endDate, includeFixed, activeBranchId],
        queryFn: () => getFinanceCandles(tf, range.startDate, range.endDate, includeFixed),
        enabled: isOwner,
    });

    const onCandleClick = useCallback((time: string) => setDrill(bucketRange(time, tf)), [tf]);

    // Grafik saldo kas = data keuangan sensitif → khusus owner (endpoint candles juga owner-only).
    if (!isOwner) return null;

    return (
        <div className="glass-card rounded-2xl p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                        <CandlestickChart className="h-5 w-5 text-foreground" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-foreground">Grafik Saldo Kas</p>
                        <p className="text-xs text-muted-foreground">Klik candle untuk lihat Jurnal Keuangan</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex w-fit gap-1 rounded-xl bg-muted p-1">
                        {TF.map((t) => (
                            <button
                                key={t.value}
                                onClick={() => setTf(t.value)}
                                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                                    tf === t.value
                                        ? "bg-card text-foreground shadow"
                                        : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                    <Link
                        href="/owner/analisa-keuangan"
                        className="hidden items-center gap-1 text-xs text-muted-foreground hover:text-foreground sm:inline-flex"
                    >
                        Analisa penuh <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                </div>
            </div>

            {isLoading ? (
                <div className="grid h-[300px] place-items-center text-muted-foreground">
                    <Loader2 className="animate-spin" />
                </div>
            ) : data && data.candles.length ? (
                <CandleChart candles={data.candles} onCandleClick={onCandleClick} height={300} />
            ) : (
                <div className="grid h-[300px] place-items-center text-sm text-muted-foreground">
                    Belum ada data pada rentang ini.
                </div>
            )}

            <JournalDrawer
                open={!!drill}
                startDate={drill?.startDate || range.startDate}
                endDate={drill?.endDate || range.endDate}
                includeFixed={includeFixed}
                onClose={() => setDrill(null)}
            />
        </div>
    );
}
