"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Paginasi client-side untuk daftar panjang. Aktif hanya saat jumlah item
 * melebihi `pageSize` (default 20) — di bawah itu semua item tampil dan
 * PaginationBar tidak dirender.
 *
 * Pakai:
 *   const pg = usePagination(items, 20);
 *   ... pg.pageItems.map(...) ...
 *   <PaginationBar {...pg} />
 */
export function usePagination<T>(items: T[], pageSize = 20) {
    const [page, setPage] = useState(1);
    const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
    const safePage = Math.min(page, totalPages); // auto-koreksi saat data menyusut
    const pageItems = useMemo(
        () => (totalPages <= 1 ? items : items.slice((safePage - 1) * pageSize, safePage * pageSize)),
        [items, safePage, pageSize, totalPages],
    );
    return { page: safePage, setPage, totalPages, pageItems, total: items.length, pageSize };
}

export function PaginationBar({
    page, totalPages, total, pageSize, setPage,
}: {
    page: number;
    totalPages: number;
    total: number;
    pageSize: number;
    setPage: (p: number) => void;
}) {
    if (totalPages <= 1) return null;
    const from = (page - 1) * pageSize + 1;
    const to = Math.min(page * pageSize, total);
    return (
        <div className="flex items-center justify-between gap-2 pt-2 text-xs text-muted-foreground">
            <span>
                {from}–{to} dari {total}
            </span>
            <div className="flex items-center gap-1.5">
                <button
                    type="button"
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page <= 1}
                    className="p-1.5 rounded-lg border border-border bg-background hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    title="Halaman sebelumnya"
                >
                    <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="font-semibold text-foreground px-1 whitespace-nowrap">
                    {page} / {totalPages}
                </span>
                <button
                    type="button"
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page >= totalPages}
                    className="p-1.5 rounded-lg border border-border bg-background hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    title="Halaman berikutnya"
                >
                    <ChevronRight className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    );
}
