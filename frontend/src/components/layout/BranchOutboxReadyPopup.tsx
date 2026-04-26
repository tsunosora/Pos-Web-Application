"use client";

import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { getBranchOutboxReady } from '@/lib/api/branch-inbox';
import { PackageCheck, X, AlertTriangle } from 'lucide-react';

const ACK_KEY = 'branch-outbox-ready-ack-ids';

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

export function BranchOutboxReadyPopup() {
    const [dismissed, setDismissed] = useState<Set<number>>(new Set());
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const prevIdsRef = useRef<Set<number>>(new Set());

    const { data } = useQuery({
        queryKey: ['branch-outbox-ready'],
        queryFn: getBranchOutboxReady,
        refetchInterval: 15_000,
        retry: false,
    });

    useEffect(() => {
        setDismissed(new Set(getAckedIds()));
    }, []);

    useEffect(() => {
        if (!data?.latest?.length) return;
        const currentIds = new Set(data.latest.map(x => x.id));
        const brandNew = data.latest.filter(x => !prevIdsRef.current.has(x.id) && !dismissed.has(x.id));
        if (brandNew.length > 0 && prevIdsRef.current.size > 0) {
            try { audioRef.current?.play().catch(() => { /* ignored */ }); } catch { /* noop */ }
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

    return (
        <>
            <audio ref={audioRef} preload="auto" src="data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAIlYAAESsAAACABAAZGF0YQAAAAA=" />

            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
                <div className="w-full max-w-lg bg-card border-2 border-emerald-500 rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                    {/* Header */}
                    <div className="flex items-center gap-3 p-4 border-b border-border bg-emerald-500/10 rounded-t-2xl">
                        <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center animate-pulse">
                            <PackageCheck className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1">
                            <h2 className="text-base font-bold text-foreground">✅ Cetakan Siap Diambil</h2>
                            <p className="text-xs text-muted-foreground">
                                {newItems.length} titipan sudah selesai & siap diambil dari cabang pelaksana
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
                                <div key={it.id} className={`p-3 rounded-xl border ${isExpress ? 'border-red-500/50 bg-red-500/5' : 'border-emerald-500/30 bg-emerald-500/5'}`}>
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                        {isExpress && (
                                            <span className="text-[10px] font-bold px-2 py-0.5 bg-red-500 text-white rounded-full flex items-center gap-1">
                                                <AlertTriangle className="w-2.5 h-2.5" /> EXPRESS
                                            </span>
                                        )}
                                        <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-500/15 text-emerald-600 border border-emerald-500/30 rounded-full">
                                            ambil di {it.productionBranch?.code || it.productionBranch?.name || '—'}
                                        </span>
                                        <span className="text-xs font-mono text-muted-foreground">{it.invoiceNumber}</span>
                                    </div>
                                    <p className="text-sm font-semibold text-foreground">{it.customerName || 'Tanpa nama'}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        {itemSummary}{moreCount > 0 ? ` +${moreCount} lagi` : ''}
                                    </p>
                                    {it.handoverReadyAt && (
                                        <p className="text-[11px] text-emerald-600 mt-1 font-medium">
                                            Siap sejak: {new Date(it.handoverReadyAt).toLocaleString('id-ID')}
                                        </p>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Footer actions */}
                    <div className="flex gap-2 p-4 border-t border-border bg-muted/20 rounded-b-2xl">
                        <button onClick={handleDismissAll}
                            className="flex-1 px-3 py-2 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 transition-colors flex items-center justify-center gap-1.5">
                            <X className="w-4 h-4" /> Oke, Mengerti
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
