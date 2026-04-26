"use client";

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { getBranchInboxUnread, acknowledgeBranchInbox } from '@/lib/api/branch-inbox';
import { Inbox, AlertTriangle, X } from 'lucide-react';

const ACK_KEY = 'branch-inbox-last-ack-ids';

function getAckedIds(): number[] {
    if (typeof window === 'undefined') return [];
    try {
        return JSON.parse(localStorage.getItem(ACK_KEY) || '[]');
    } catch {
        return [];
    }
}

function saveAckedIds(ids: number[]) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(ACK_KEY, JSON.stringify(ids.slice(-50)));
}

export function BranchInboxPopup() {
    const qc = useQueryClient();
    const [dismissed, setDismissed] = useState<Set<number>>(new Set());
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const prevIdsRef = useRef<Set<number>>(new Set());

    const { data } = useQuery({
        queryKey: ['branch-inbox-unread'],
        queryFn: getBranchInboxUnread,
        refetchInterval: 15_000,
        retry: false,
    });

    // Hydrate dismissed from localStorage
    useEffect(() => {
        setDismissed(new Set(getAckedIds()));
    }, []);

    // Play sound when NEW titipan muncul yang belum pernah dilihat
    useEffect(() => {
        if (!data?.latest?.length) return;
        const currentIds = new Set(data.latest.map(x => x.id));
        const brandNew = data.latest.filter(x => !prevIdsRef.current.has(x.id) && !dismissed.has(x.id));
        if (brandNew.length > 0 && prevIdsRef.current.size > 0) {
            // play beep
            try {
                audioRef.current?.play().catch(() => { /* ignored */ });
            } catch { /* noop */ }
        }
        prevIdsRef.current = currentIds;
    }, [data, dismissed]);

    const newItems = (data?.latest ?? []).filter(x => !dismissed.has(x.id));
    if (newItems.length === 0) return null;

    const handleDismissAll = () => {
        const ids = newItems.map(x => x.id);
        const merged = Array.from(new Set([...Array.from(dismissed), ...ids]));
        setDismissed(new Set(merged));
        saveAckedIds(merged);
    };

    const handleAcceptAll = async () => {
        // Acknowledge semua titipan baru ke BE
        try {
            await Promise.all(newItems.map(x => acknowledgeBranchInbox(x.id)));
        } catch { /* noop */ }
        handleDismissAll();
        qc.invalidateQueries({ queryKey: ['branch-inbox-unread'] });
        qc.invalidateQueries({ queryKey: ['branch-inbox'] });
    };

    return (
        <>
            {/* Hidden beep audio (data URI short sine) */}
            <audio ref={audioRef} preload="auto" src="data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAIlYAAESsAAACABAAZGF0YQAAAAA=" />

            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
                <div className="w-full max-w-lg bg-card border-2 border-amber-500 rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                    {/* Header */}
                    <div className="flex items-center gap-3 p-4 border-b border-border bg-amber-500/10 rounded-t-2xl">
                        <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center animate-pulse">
                            <Inbox className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1">
                            <h2 className="text-base font-bold text-foreground">🔔 Titipan Cetak Baru</h2>
                            <p className="text-xs text-muted-foreground">
                                {newItems.length} pesanan masuk dari cabang lain
                            </p>
                        </div>
                    </div>

                    {/* Body */}
                    <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
                        {newItems.map((it) => {
                            const isExpress = it.productionPriority === 'EXPRESS';
                            const itemSummary = it.items.slice(0, 3).map(i => `${i.quantity}× ${i.productVariant.product.name}`).join(', ');
                            const moreCount = it.items.length - 3;
                            return (
                                <div key={it.id} className={`p-3 rounded-xl border ${isExpress ? 'border-red-500/50 bg-red-500/5' : 'border-border bg-muted/30'}`}>
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                        {isExpress && (
                                            <span className="text-[10px] font-bold px-2 py-0.5 bg-red-500 text-white rounded-full flex items-center gap-1">
                                                <AlertTriangle className="w-2.5 h-2.5" /> EXPRESS
                                            </span>
                                        )}
                                        <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-500/15 text-amber-600 border border-amber-500/30 rounded-full">
                                            dari {it.branch?.code || it.branch?.name}
                                        </span>
                                        <span className="text-xs font-mono text-muted-foreground">{it.invoiceNumber}</span>
                                    </div>
                                    <p className="text-sm font-semibold text-foreground">{it.customerName || 'Tanpa nama'}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        {itemSummary}{moreCount > 0 ? ` +${moreCount} lagi` : ''}
                                    </p>
                                    {it.productionDeadline && (
                                        <p className="text-[11px] text-muted-foreground mt-1">
                                            Deadline: {new Date(it.productionDeadline).toLocaleString('id-ID')}
                                        </p>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Footer actions */}
                    <div className="flex gap-2 p-4 border-t border-border bg-muted/20 rounded-b-2xl">
                        <button onClick={handleDismissAll}
                            className="flex-1 px-3 py-2 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors flex items-center justify-center gap-1.5">
                            <X className="w-4 h-4" /> Tutup Dulu
                        </button>
                        <Link href="/titipan-masuk" onClick={handleDismissAll}
                            className="flex-1 px-3 py-2 rounded-xl border-2 border-primary bg-primary/10 text-sm font-bold text-primary hover:bg-primary/20 transition-colors flex items-center justify-center">
                            Lihat Detail
                        </Link>
                        <button onClick={handleAcceptAll}
                            className="flex-1 px-3 py-2 rounded-xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 transition-colors">
                            Terima Semua
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
