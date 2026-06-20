"use client";

import { useQuery } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useBranchStore } from "@/store/branch-store";
import { getTransactionEditRequests } from "@/lib/api/transactions";
import { getPendingInvoiceCount } from "@/lib/api/sales-orders";
import { getBranchInboxUnread } from "@/lib/api/branch-inbox";
import { getBranchLedgerSummary } from "@/lib/api/branch-ledger";
import { getProductionStats } from "@/lib/api/production";
import { getPrintQueueStats } from "@/lib/api/print-queue";
import { getLeadStatusSummary, getFollowUpBadgeCount } from "@/lib/api/crm";
import type { NavItem, NavSection } from "@/components/layout/nav-config";

const BADGE_POLL_LONG = 120_000; // 2 menit
const BADGE_POLL_MED = 60_000;   // 1 menit
const BADGE_POLL_SLOW = 180_000; // 3 menit

/**
 * Hitung badge navigasi (jumlah item pending) sekali, dipakai bersama Sidebar &
 * SubNav. Query memakai queryKey unik → React Query dedupe, jadi tidak dobel fetch
 * meski hook dipanggil di dua komponen.
 */
export function useNavBadges() {
    const { isManager, branchId: userBranchId, isOwner } = useCurrentUser();
    const ownerActiveBranch = useBranchStore(s => s.activeBranchId);
    const sidebarBranchId = isOwner ? ownerActiveBranch : userBranchId;
    const common = { refetchOnWindowFocus: false, retry: false } as const;

    const { data: pendingEditRequests } = useQuery({
        queryKey: ['transaction-edit-requests', 'PENDING'],
        queryFn: () => getTransactionEditRequests('PENDING'),
        enabled: isManager, staleTime: BADGE_POLL_LONG, refetchInterval: BADGE_POLL_LONG, ...common,
    });
    const { data: pendingInvoiceData } = useQuery({
        queryKey: ['so-pending-invoice-count'],
        queryFn: getPendingInvoiceCount,
        staleTime: BADGE_POLL_LONG, refetchInterval: BADGE_POLL_LONG, ...common,
    });
    const { data: branchInboxData } = useQuery({
        queryKey: ['branch-inbox-unread'],
        queryFn: getBranchInboxUnread,
        staleTime: BADGE_POLL_MED - 5_000, refetchInterval: BADGE_POLL_MED, ...common,
    });
    const { data: ledgerSummary } = useQuery({
        queryKey: ['branch-ledger-summary-sidebar'],
        queryFn: getBranchLedgerSummary,
        staleTime: BADGE_POLL_SLOW, refetchInterval: BADGE_POLL_SLOW, ...common,
    });
    const { data: productionStats } = useQuery({
        queryKey: ['production-stats-sidebar', sidebarBranchId ?? 'all'],
        queryFn: () => getProductionStats(sidebarBranchId ?? undefined),
        staleTime: BADGE_POLL_MED, refetchInterval: BADGE_POLL_MED, ...common,
        enabled: isOwner ? true : userBranchId != null,
    });
    const { data: printStats } = useQuery({
        queryKey: ['print-queue-stats-sidebar', sidebarBranchId ?? 'all'],
        queryFn: () => getPrintQueueStats(sidebarBranchId ?? undefined),
        staleTime: BADGE_POLL_MED, refetchInterval: BADGE_POLL_MED, ...common,
        enabled: isOwner ? true : userBranchId != null,
    });
    const { data: crmSummary } = useQuery({
        queryKey: ['crm-leads-summary-sidebar', sidebarBranchId ?? 'all'],
        queryFn: getLeadStatusSummary,
        staleTime: BADGE_POLL_LONG, refetchInterval: BADGE_POLL_LONG, ...common,
        enabled: isOwner ? true : userBranchId != null,
    });
    const { data: crmFuBadge } = useQuery({
        queryKey: ['crm-fu-badge', sidebarBranchId ?? 'all'],
        queryFn: () => getFollowUpBadgeCount(true),
        staleTime: BADGE_POLL_LONG, refetchInterval: BADGE_POLL_LONG, ...common,
        enabled: isOwner ? true : userBranchId != null,
    });

    const ledgerOutstandingCount =
        ledgerSummary && ledgerSummary.mode === 'single'
            ? (ledgerSummary.outgoing.count + ledgerSummary.incoming.count > 0 ? 1 : 0)
            : 0;

    const getBadge = (item: NavItem): number => {
        switch (item.badgeKey) {
            case 'pendingInvoice': return pendingInvoiceData?.count ?? 0;
            case 'pendingEdit': return pendingEditRequests?.length ?? 0;
            case 'branchInbox': return branchInboxData?.count ?? 0;
            case 'ledgerOutstanding': return ledgerOutstandingCount;
            case 'productionReady': return productionStats?.selesai ?? 0;
            case 'printReady': return printStats?.selesai ?? 0;
            case 'crmLeadsNew': return crmSummary?.NEW ?? 0;
            case 'crmFuPending': return crmFuBadge?.count ?? 0;
            default: return 0;
        }
    };

    /** Total badge dalam satu kategori (untuk titik penanda di sidebar). */
    const getSectionBadge = (section: NavSection): number =>
        section.items.reduce((sum, it) => sum + getBadge(it), 0);

    return { getBadge, getSectionBadge };
}
