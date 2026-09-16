"use client";

import { useQuery } from "@tanstack/react-query";
import { ClipboardList, Loader2 } from "lucide-react";
import { downloadPiketPdf, getPiketBoard } from "@/lib/api";
import { PageHeader } from "@/components/ui/page-header";
import { PiketBoardView } from "@/components/tugas/PiketBoard";

export default function PapanPiketPage() {
    const { data, isLoading, isError } = useQuery({
        queryKey: ["piket-board"],
        queryFn: getPiketBoard,
        staleTime: 0,
        refetchOnMount: "always",
        refetchInterval: 60_000,
    });

    return (
        <div className="p-4 max-w-6xl mx-auto">
            <PageHeader
                title="Papan Piket"
                description="Pembagian piket semua karyawan, status hari ini, rincian tugas & aturannya."
                icon={ClipboardList}
                breadcrumbs={[{ label: "Papan Tugas", href: "/tugas" }, { label: "Papan Piket" }]}
            />
            {isLoading ? (
                <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : isError || !data ? (
                <p className="py-16 text-center text-sm text-rose-600">Gagal memuat papan piket.</p>
            ) : (
                <PiketBoardView data={data} onDownloadPdf={downloadPiketPdf} />
            )}
        </div>
    );
}
