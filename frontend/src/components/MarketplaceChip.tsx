"use client";

import { ShoppingBag } from "lucide-react";

/** Chip platform marketplace (mis. "Shopee") di samping nama pelanggan; no. pesanan di tooltip. */
export function MarketplaceChip({ platform, orderNo, className = "" }: { platform?: string | null; orderNo?: string | null; className?: string }) {
    const p = (platform ?? "").trim();
    if (!p) return null;
    const tip = orderNo ? `${p} · No. pesanan ${orderNo}` : `Order marketplace: ${p}`;
    return (
        <span
            title={tip}
            className={`inline-flex max-w-full items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 align-middle text-[10px] font-semibold leading-tight text-sky-700 dark:text-sky-300 ${className}`}
        >
            <ShoppingBag className="h-2.5 w-2.5 shrink-0" />
            <span className="min-w-0 max-w-[10rem] truncate">{p}</span>
        </span>
    );
}
