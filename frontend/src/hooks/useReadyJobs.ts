"use client";

import { useQuery } from '@tanstack/react-query';
import { getProductionJobs } from '@/lib/api/production';
import { listPrintJobs } from '@/lib/api/print-queue';
import { useCurrentUser } from './useCurrentUser';
import { useBranchStore } from '@/store/branch-store';

export type ReadyJobSource = 'production' | 'print';

export interface ReadyJob {
    source: ReadyJobSource;
    id: number;
    jobNumber: string;
    transactionId: number;
    invoiceNumber: string;
    checkoutNumber: string | null;
    customerName: string | null;
    customerPhone: string | null;
    productName: string;
    variantName: string | null;
    quantity: number;
    completedAt: string | null; // production: completedAt; print: finishedAt
    branchId: number | null;
    isInterBranch: boolean;
}

/**
 * Resolve cabang aktif untuk polling ready jobs.
 * - Staff: pakai user.branchId (locked).
 * - Owner: pakai store.activeBranchId. Kalau null ("Semua Cabang"), return null.
 */
function useResolvedBranchId(): { branchId: number | null; ready: boolean } {
    const { branchId: userBranchId, isOwner } = useCurrentUser();
    const ownerActiveBranch = useBranchStore(s => s.activeBranchId);
    if (isOwner) {
        return { branchId: ownerActiveBranch, ready: true };
    }
    return { branchId: userBranchId, ready: userBranchId != null };
}

function normalizeProduction(j: any): ReadyJob {
    const txBranchId = j.transaction?.branchId ?? null;
    const prodBranchId = j.transaction?.productionBranchId ?? null;
    return {
        source: 'production',
        id: j.id,
        jobNumber: j.jobNumber,
        transactionId: j.transaction?.id ?? 0,
        invoiceNumber: j.transaction?.invoiceNumber ?? '',
        checkoutNumber: j.transaction?.checkoutNumber ?? null,
        customerName: j.transaction?.customerName ?? null,
        customerPhone: j.transaction?.customerPhone ?? null,
        productName: j.transactionItem?.productVariant?.product?.name ?? '—',
        variantName: j.transactionItem?.productVariant?.variantName ?? null,
        quantity: Number(j.transactionItem?.quantity ?? 1),
        completedAt: j.completedAt ?? null,
        branchId: j.branchId ?? null,
        isInterBranch: prodBranchId != null && prodBranchId !== txBranchId,
    };
}

function normalizePrint(j: any): ReadyJob {
    const txBranchId = j.transaction?.branchId ?? null;
    const prodBranchId = j.transaction?.productionBranchId ?? null;
    return {
        source: 'print',
        id: j.id,
        jobNumber: j.jobNumber,
        transactionId: j.transaction?.id ?? 0,
        invoiceNumber: j.transaction?.invoiceNumber ?? '',
        checkoutNumber: j.transaction?.checkoutNumber ?? null,
        customerName: j.transaction?.customerName ?? null,
        customerPhone: j.transaction?.customerPhone ?? null,
        productName: j.transactionItem?.productVariant?.product?.name ?? '—',
        variantName: j.transactionItem?.productVariant?.variantName ?? null,
        quantity: Number(j.quantity ?? 1),
        completedAt: j.finishedAt ?? null,
        branchId: (j as any).branchId ?? null,
        isInterBranch: prodBranchId != null && prodBranchId !== txBranchId,
    };
}

/**
 * Shared poller untuk semua komponen Ready Jobs (Popup, Modal, Fab).
 * Polling 30 detik. Cache di TanStack Query supaya tidak duplicate request
 * walau di-pakai 3 komponen sekaligus.
 *
 * Return jobs SELESAI (siap diambil customer) dari production + print queue,
 * scoped per cabang aktif.
 */
export function useReadyJobs() {
    const { branchId, ready } = useResolvedBranchId();

    return useQuery({
        queryKey: ['ready-jobs', branchId ?? 'all'],
        queryFn: async (): Promise<ReadyJob[]> => {
            const bid = branchId ?? undefined;
            const [prodRaw, printRaw] = await Promise.all([
                getProductionJobs('SELESAI', bid).catch(() => []),
                listPrintJobs('SELESAI', undefined, bid).catch(() => []),
            ]);
            const prod = (prodRaw ?? []).map(normalizeProduction);
            const print = (printRaw ?? []).map(normalizePrint);
            // Sort terbaru dulu (yang baru selesai biasanya lebih relevan)
            return [...prod, ...print].sort((a, b) => {
                const at = a.completedAt ? new Date(a.completedAt).getTime() : 0;
                const bt = b.completedAt ? new Date(b.completedAt).getTime() : 0;
                return bt - at;
            });
        },
        refetchInterval: 30_000,
        staleTime: 15_000,
        retry: false,
        enabled: ready,
    });
}
