"use client";

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
    listBranchInbox,
    acknowledgeBranchInbox,
    markBranchInboxReady,
    markBranchInboxHandover,
    BranchInboxEntry,
    HandoverStatus,
} from '@/lib/api/branch-inbox';
import { startPrintJob, finishPrintJob, pickupPrintJob } from '@/lib/api/print-queue';
import { Inbox, Package, Printer, Clock, CheckCircle2, ArrowRight, Truck, AlertCircle, Play, ExternalLink } from 'lucide-react';

const TABS: { key: HandoverStatus | 'ALL'; label: string; color: string }[] = [
    { key: 'BARU', label: 'Baru Masuk', color: 'text-red-500' },
    { key: 'DIPROSES', label: 'Diproses', color: 'text-blue-500' },
    { key: 'SIAP_AMBIL', label: 'Siap Ambil', color: 'text-green-500' },
    { key: 'DISERAHKAN', label: 'Selesai', color: 'text-muted-foreground' },
    { key: 'ALL', label: 'Semua', color: 'text-foreground' },
];

function formatDeadline(iso: string | null): { label: string; urgent: boolean } {
    if (!iso) return { label: 'Tanpa deadline', urgent: false };
    const d = new Date(iso);
    const now = new Date();
    const diffMs = d.getTime() - now.getTime();
    const diffH = Math.round(diffMs / 3600000);
    const urgent = diffMs < 6 * 3600000;
    if (diffMs < 0) return { label: 'LEWAT DEADLINE', urgent: true };
    if (diffH < 24) return { label: `${diffH} jam lagi`, urgent };
    const diffD = Math.round(diffH / 24);
    return { label: `${diffD} hari lagi`, urgent };
}

function itemBadge(mode: string, requiresProduction: boolean) {
    if (mode === 'AREA_BASED' && requiresProduction) {
        return { label: 'Produksi', icon: Printer, color: 'bg-purple-500/15 text-purple-600 border-purple-500/30' };
    }
    if (requiresProduction) {
        return { label: 'Cetak Paper', icon: Printer, color: 'bg-cyan-500/15 text-cyan-600 border-cyan-500/30' };
    }
    return { label: 'Barang Jadi', icon: Package, color: 'bg-slate-500/15 text-slate-600 border-slate-500/30' };
}

export default function TitipanMasukPage() {
    const [tab, setTab] = useState<HandoverStatus | 'ALL'>('BARU');
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const qc = useQueryClient();

    const { data: list = [], isLoading, error } = useQuery({
        queryKey: ['branch-inbox', tab],
        queryFn: () => listBranchInbox(tab === 'ALL' ? undefined : tab),
        refetchInterval: 20_000,
    });

    const invalidate = () => {
        qc.invalidateQueries({ queryKey: ['branch-inbox'] });
        qc.invalidateQueries({ queryKey: ['branch-inbox-unread'] });
    };

    const ackMut = useMutation({ mutationFn: acknowledgeBranchInbox, onSuccess: invalidate });
    const readyMut = useMutation({ mutationFn: markBranchInboxReady, onSuccess: invalidate });
    const handoverMut = useMutation({ mutationFn: markBranchInboxHandover, onSuccess: invalidate });

    const startPrintMut = useMutation({ mutationFn: (id: number) => startPrintJob(id), onSuccess: invalidate });
    const finishPrintMut = useMutation({ mutationFn: (id: number) => finishPrintJob(id), onSuccess: invalidate });
    const pickupPrintMut = useMutation({ mutationFn: (id: number) => pickupPrintJob(id), onSuccess: invalidate });

    return (
        <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                    <Inbox className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                    <h1 className="text-xl md:text-2xl font-bold text-foreground">Titipan Cetak Masuk</h1>
                    <p className="text-xs text-muted-foreground">Pesanan dari cabang lain yang dikerjakan di sini</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0">
                {TABS.map(t => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        className={`shrink-0 px-3 py-2 rounded-lg text-xs font-bold border-2 transition-all ${tab === t.key
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/30'}`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {error && (
                <div className="p-4 rounded-xl border-2 border-destructive/30 bg-destructive/10 text-destructive text-sm flex gap-2 items-start">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                        <p className="font-semibold">Gagal memuat inbox</p>
                        <p className="text-xs mt-0.5">{(error as any)?.response?.data?.message || (error as any)?.message}</p>
                        <p className="text-xs mt-1 opacity-70">Catatan: Owner/SuperAdmin perlu pilih cabang spesifik di topbar (bukan mode "Semua Cabang").</p>
                    </div>
                </div>
            )}

            {isLoading ? (
                <div className="p-8 text-center text-muted-foreground text-sm">Memuat...</div>
            ) : list.length === 0 ? (
                <div className="p-12 text-center">
                    <Inbox className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
                    <p className="text-sm font-semibold text-muted-foreground">Tidak ada titipan {tab !== 'ALL' ? `dengan status "${TABS.find(t => t.key === tab)?.label}"` : ''}</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {list.map((entry: BranchInboxEntry) => {
                        const dl = formatDeadline(entry.productionDeadline);
                        const isExpanded = expandedId === entry.id;
                        const isExpress = entry.productionPriority === 'EXPRESS';
                        return (
                            <div key={entry.id} className={`border rounded-2xl overflow-hidden transition-all ${entry.handoverStatus === 'BARU' ? 'border-red-500/50 bg-red-500/5' : 'border-border bg-card'}`}>
                                <div className={`h-1 ${isExpress ? 'bg-red-500' : entry.handoverStatus === 'BARU' ? 'bg-amber-500' : 'bg-muted'}`} />
                                <div className="p-4">
                                    <div className="flex items-start justify-between gap-2 flex-wrap">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                                {isExpress && (
                                                    <span className="text-[10px] font-bold px-2 py-0.5 bg-red-500 text-white rounded-full">EXPRESS</span>
                                                )}
                                                <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-500/15 text-amber-600 border border-amber-500/30 rounded-full">
                                                    ⚑ dari {entry.sourceBranch?.code || entry.sourceBranch?.name}
                                                </span>
                                                <StatusChip status={entry.handoverStatus} />
                                                <span className="text-xs font-mono text-muted-foreground">{entry.invoiceNumber}</span>
                                            </div>
                                            <p className="font-semibold text-sm text-foreground">{entry.customerName || 'Tanpa nama'}</p>
                                            {entry.customerPhone && <p className="text-xs text-muted-foreground">{entry.customerPhone}</p>}
                                        </div>
                                        <div className={`text-xs font-medium shrink-0 flex items-center gap-1 ${dl.urgent ? 'text-red-500 font-bold' : 'text-muted-foreground'}`}>
                                            <Clock className="w-3 h-3" /> {dl.label}
                                        </div>
                                    </div>

                                    {/* Ringkasan item */}
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                        {entry.items.slice(0, isExpanded ? entry.items.length : 3).map(it => {
                                            const b = itemBadge(it.pricingMode, it.requiresProduction);
                                            return (
                                                <span key={it.id} className={`inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg border ${b.color}`}>
                                                    <b.icon className="w-3 h-3" />
                                                    {it.quantity}× {it.productName}
                                                    {it.pricingMode === 'AREA_BASED' && it.widthCm && it.heightCm
                                                        ? ` (${it.widthCm}×${it.heightCm}cm)`
                                                        : ''}
                                                </span>
                                            );
                                        })}
                                        {!isExpanded && entry.items.length > 3 && (
                                            <button onClick={() => setExpandedId(entry.id)} className="text-[11px] px-2 py-1 rounded-lg bg-muted text-muted-foreground hover:bg-muted/70">
                                                +{entry.items.length - 3} item lainnya
                                            </button>
                                        )}
                                    </div>

                                    {entry.productionNotes && (
                                        <div className="mt-2 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
                                            <span className="font-medium">Catatan:</span> {entry.productionNotes}
                                        </div>
                                    )}

                                    {/* Detail expanded: status job per-item + inline actions */}
                                    {isExpanded && (
                                        <div className="mt-3 pt-3 border-t border-dashed border-border space-y-2">
                                            {entry.items.map(it => (
                                                <div key={it.id} className="p-2 rounded-lg bg-muted/30 space-y-1.5">
                                                    <div className="flex items-center gap-2 flex-wrap text-xs">
                                                        <span className="font-medium text-foreground">{it.quantity}× {it.productName}</span>
                                                        {it.variantName && <span className="text-muted-foreground">{it.variantName}</span>}
                                                        {it.productionJob && (
                                                            <span className="px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-600 text-[10px] font-mono">
                                                                {it.productionJob.jobNumber} · {it.productionJob.status}
                                                            </span>
                                                        )}
                                                        {it.printJob && (
                                                            <span className="px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-600 text-[10px] font-mono">
                                                                {it.printJob.jobNumber} · {it.printJob.status}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {it.note && <p className="text-[11px] italic text-muted-foreground">Catatan: {it.note}</p>}

                                                    {/* Inline action: PrintJob shortcut */}
                                                    {it.printJob && (
                                                        <div className="flex gap-1.5 flex-wrap">
                                                            {it.printJob.status === 'ANTRIAN' && (
                                                                <button onClick={() => startPrintMut.mutate(it.printJob!.id)} disabled={startPrintMut.isPending}
                                                                    className="px-2.5 py-1 bg-indigo-500 text-white rounded-lg text-[11px] font-bold active:scale-95 transition-transform disabled:opacity-50 flex items-center gap-1">
                                                                    <Play className="w-3 h-3" /> Mulai Cetak
                                                                </button>
                                                            )}
                                                            {it.printJob.status === 'PROSES' && (
                                                                <button onClick={() => finishPrintMut.mutate(it.printJob!.id)} disabled={finishPrintMut.isPending}
                                                                    className="px-2.5 py-1 bg-green-500 text-white rounded-lg text-[11px] font-bold active:scale-95 transition-transform disabled:opacity-50 flex items-center gap-1">
                                                                    <CheckCircle2 className="w-3 h-3" /> Selesai Cetak
                                                                </button>
                                                            )}
                                                            {it.printJob.status === 'SELESAI' && (
                                                                <button onClick={() => pickupPrintMut.mutate(it.printJob!.id)} disabled={pickupPrintMut.isPending}
                                                                    className="px-2.5 py-1 bg-sky-500 text-white rounded-lg text-[11px] font-bold active:scale-95 transition-transform disabled:opacity-50 flex items-center gap-1">
                                                                    <Truck className="w-3 h-3" /> Diambil
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* ProductionJob: shortcut link (butuh roll selection → buka /produksi) */}
                                                    {it.productionJob && it.productionJob.status === 'ANTRIAN' && (
                                                        <Link href="/produksi" target="_blank"
                                                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-500 text-white rounded-lg text-[11px] font-bold active:scale-95 transition-transform">
                                                            <ExternalLink className="w-3 h-3" /> Proses di /produksi
                                                        </Link>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Actions */}
                                    <div className="mt-3 flex flex-wrap gap-2 justify-end items-center">
                                        <button onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                                            className="text-xs text-muted-foreground hover:text-foreground underline">
                                            {isExpanded ? 'Sembunyikan' : 'Lihat detail'}
                                        </button>
                                        <div className="flex-1" />
                                        {entry.handoverStatus === 'BARU' && (
                                            <button onClick={() => ackMut.mutate(entry.id)} disabled={ackMut.isPending}
                                                className="px-3 py-1.5 bg-blue-500 text-white rounded-xl text-xs font-bold active:scale-95 transition-transform disabled:opacity-50 flex items-center gap-1">
                                                <ArrowRight className="w-3.5 h-3.5" /> Terima & Kerjakan
                                            </button>
                                        )}
                                        {(entry.handoverStatus === 'DIPROSES' || entry.handoverStatus === 'BARU') && (
                                            <button onClick={() => readyMut.mutate(entry.id)} disabled={readyMut.isPending}
                                                className="px-3 py-1.5 bg-green-500 text-white rounded-xl text-xs font-bold active:scale-95 transition-transform disabled:opacity-50 flex items-center gap-1">
                                                <CheckCircle2 className="w-3.5 h-3.5" /> Tandai Siap
                                            </button>
                                        )}
                                        {entry.handoverStatus === 'SIAP_AMBIL' && (
                                            <button onClick={() => handoverMut.mutate(entry.id)} disabled={handoverMut.isPending}
                                                className="px-3 py-1.5 bg-muted text-foreground border border-border rounded-xl text-xs font-medium active:scale-95 transition-transform disabled:opacity-50 flex items-center gap-1">
                                                <Truck className="w-3.5 h-3.5" /> Diserahkan
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function StatusChip({ status }: { status: HandoverStatus }) {
    const map: Record<HandoverStatus, { label: string; cls: string }> = {
        BARU: { label: 'BARU', cls: 'bg-red-500/15 text-red-600 border-red-500/30' },
        DIPROSES: { label: 'DIPROSES', cls: 'bg-blue-500/15 text-blue-600 border-blue-500/30' },
        SIAP_AMBIL: { label: 'SIAP AMBIL', cls: 'bg-green-500/15 text-green-600 border-green-500/30' },
        DISERAHKAN: { label: 'DISERAHKAN', cls: 'bg-muted text-muted-foreground border-border' },
    };
    const s = map[status] ?? map.BARU;
    return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${s.cls}`}>{s.label}</span>;
}
