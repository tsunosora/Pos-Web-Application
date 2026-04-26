"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, ChevronDown, Check, Globe } from "lucide-react";
import axios from "@/lib/api/client";
import { useBranchStore } from "@/store/branch-store";
import { useCurrentUser } from "@/hooks/useCurrentUser";

type Branch = {
    id: number;
    name: string;
    code: string | null;
    isActive: boolean;
};

/**
 * BranchSwitcher — dropdown untuk Owner/SuperAdmin memilih cabang aktif.
 *
 * - Staff (non-owner): tampilkan badge nama cabang saja (read-only).
 * - Owner: dropdown pilih cabang + opsi "Semua Cabang" (branchId = null).
 *
 * Mengubah pilihan akan reset TanStack Query cache via invalidate
 * (karena banyak query belum pakai branchId di queryKey sampai PR2+).
 */
export function BranchSwitcher() {
    const { isOwner, branchName, branchCode, currentUser } = useCurrentUser();
    const activeBranchId = useBranchStore((s) => s.activeBranchId);
    const setActiveBranchId = useBranchStore((s) => s.setActiveBranchId);
    const qc = useQueryClient();

    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    const { data: branches = [] } = useQuery({
        queryKey: ["company-branches-active"],
        queryFn: () => axios.get<Branch[]>("/company-branches/active").then((r) => r.data),
        staleTime: 5 * 60 * 1000,
        enabled: isOwner, // hanya fetch untuk Owner
    });

    useEffect(() => {
        function onClick(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener("mousedown", onClick);
        return () => document.removeEventListener("mousedown", onClick);
    }, []);

    // Owner dengan hanya 1 cabang: auto-pin ke cabang itu supaya halaman single-branch (POS, opname) tidak ke-block.
    useEffect(() => {
        if (isOwner && branches.length === 1 && activeBranchId !== branches[0].id) {
            setActiveBranchId(branches[0].id);
        }
    }, [isOwner, branches, activeBranchId, setActiveBranchId]);

    const handleSelect = (id: number | null) => {
        setActiveBranchId(id);
        setOpen(false);
        // Invalidate semua query — data akan refetch dengan header X-Branch-Id baru.
        qc.invalidateQueries();
    };

    // Staff: badge read-only
    if (!isOwner) {
        if (!currentUser) return null;
        if (!branchName) return null;
        return (
            <div className="hidden md:flex items-center gap-1.5 bg-slate-100 text-slate-700 px-2.5 py-1.5 rounded-full text-xs font-semibold border border-slate-200">
                <Building2 className="h-3.5 w-3.5" />
                <span className="truncate max-w-[140px]">
                    {branchCode ? `${branchCode} · ` : ""}
                    {branchName}
                </span>
            </div>
        );
    }

    // Owner dengan hanya 1 cabang: tidak ada gunanya dropdown atau "Semua Cabang".
    if (branches.length === 1) {
        const only = branches[0];
        return (
            <div className="hidden md:flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-2.5 py-1.5 rounded-full text-xs font-semibold border border-emerald-200">
                <Building2 className="h-3.5 w-3.5" />
                <span className="truncate max-w-[160px]">
                    {only.code ? `${only.code} · ` : ""}
                    {only.name}
                </span>
            </div>
        );
    }

    // Owner dengan 2+ cabang: dropdown lengkap
    const active = activeBranchId
        ? branches.find((b) => b.id === activeBranchId) ?? null
        : null;

    return (
        <div className="relative" ref={ref}>
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-2.5 sm:px-3 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-colors border border-emerald-200"
                title="Pilih cabang aktif"
            >
                {active ? (
                    <>
                        <Building2 className="h-4 w-4 shrink-0" />
                        <span className="truncate max-w-[120px] sm:max-w-[180px]">
                            {active.code ? `${active.code} · ` : ""}
                            {active.name}
                        </span>
                    </>
                ) : (
                    <>
                        <Globe className="h-4 w-4 shrink-0" />
                        <span className="hidden sm:inline">Semua Cabang</span>
                        <span className="sm:hidden">Semua</span>
                    </>
                )}
                <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
                />
            </button>

            {open && (
                <div className="absolute right-0 mt-2 w-64 rounded-xl bg-background shadow-2xl ring-1 ring-black/5 border border-border overflow-hidden z-50">
                    <div className="px-3 py-2 bg-muted/50 border-b">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                            Pilih Cabang Aktif
                        </p>
                    </div>
                    <div className="max-h-72 overflow-y-auto py-1">
                        <button
                            onClick={() => handleSelect(null)}
                            className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted transition-colors ${
                                activeBranchId === null ? "bg-emerald-50" : ""
                            }`}
                        >
                            <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="flex-1 text-left">Semua Cabang</span>
                            {activeBranchId === null && (
                                <Check className="h-4 w-4 text-emerald-600" />
                            )}
                        </button>
                        <div className="h-px bg-border my-1" />
                        {branches.length === 0 ? (
                            <p className="px-3 py-3 text-xs text-muted-foreground text-center">
                                Belum ada cabang aktif.
                            </p>
                        ) : (
                            branches.map((b) => (
                                <button
                                    key={b.id}
                                    onClick={() => handleSelect(b.id)}
                                    className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted transition-colors ${
                                        activeBranchId === b.id ? "bg-emerald-50" : ""
                                    }`}
                                >
                                    <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                                    <div className="flex-1 text-left min-w-0">
                                        <p className="truncate font-medium">{b.name}</p>
                                        {b.code && (
                                            <p className="truncate text-[11px] text-muted-foreground">
                                                {b.code}
                                            </p>
                                        )}
                                    </div>
                                    {activeBranchId === b.id && (
                                        <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                                    )}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
