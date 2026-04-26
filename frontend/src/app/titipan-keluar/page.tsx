"use client";

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listBranchOutbox, confirmBranchOutboxPickup, type BranchOutboxEntry, type HandoverStatus } from '@/lib/api/branch-inbox';
import { Send, Clock, CheckCircle2, Truck, PackageCheck, AlertTriangle, Inbox } from 'lucide-react';

type TabKey = 'BARU' | 'DIPROSES' | 'SIAP_AMBIL' | 'DISERAHKAN' | 'ALL';

const TABS: { key: TabKey; label: string; icon: any; color: string }[] = [
    { key: 'BARU', label: 'Dikirim', icon: Send, color: 'text-amber-600' },
    { key: 'DIPROSES', label: 'Dikerjakan', icon: Clock, color: 'text-blue-600' },
    { key: 'SIAP_AMBIL', label: 'Siap Diambil', icon: PackageCheck, color: 'text-emerald-600' },
    { key: 'DISERAHKAN', label: 'Selesai', icon: CheckCircle2, color: 'text-gray-500' },
    { key: 'ALL', label: 'Semua', icon: Inbox, color: 'text-foreground' },
];

function StatusChip({ s }: { s: HandoverStatus }) {
    const cfg: Record<HandoverStatus, { bg: string; text: string; label: string }> = {
        BARU: { bg: 'bg-amber-500/15 border-amber-500/30', text: 'text-amber-700', label: 'Menunggu diterima' },
        DIPROSES: { bg: 'bg-blue-500/15 border-blue-500/30', text: 'text-blue-700', label: 'Sedang dikerjakan' },
        SIAP_AMBIL: { bg: 'bg-emerald-500/15 border-emerald-500/30', text: 'text-emerald-700', label: 'Siap diambil' },
        DISERAHKAN: { bg: 'bg-gray-500/15 border-gray-500/30', text: 'text-gray-600', label: 'Selesai' },
    };
    const c = cfg[s] || cfg.BARU;
    return (
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${c.bg} ${c.text}`}>
            {c.label}
        </span>
    );
}

export default function TitipanKeluarPage() {
    const [tab, setTab] = useState<TabKey>('ALL');
    const [expanded, setExpanded] = useState<Set<number>>(new Set());
    const qc = useQueryClient();

    const { data: entries = [], isLoading } = useQuery({
        queryKey: ['branch-outbox', tab],
        queryFn: () => listBranchOutbox(tab === 'ALL' ? undefined : tab),
        refetchInterval: 15_000,
    });

    const confirmMut = useMutation({
        mutationFn: (id: number) => confirmBranchOutboxPickup(id),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['branch-outbox'] });
            qc.invalidateQueries({ queryKey: ['branch-outbox-ready'] });
        },
    });

    const counts = useMemo(() => {
        const acc: Record<string, number> = { BARU: 0, DIPROSES: 0, SIAP_AMBIL: 0, DISERAHKAN: 0, ALL: 0 };
        for (const e of entries) {
            acc[e.handoverStatus] = (acc[e.handoverStatus] || 0) + 1;
            acc.ALL++;
        }
        return acc;
    }, [entries]);

    const toggle = (id: number) => setExpanded(prev => {
        const s = new Set(prev);
        if (s.has(id)) s.delete(id); else s.add(id);
        return s;
    });

    return (
        <div className="space-y-4">
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Send className="w-6 h-6 text-amber-500" />
                    Titipan Keluar
                </h1>
                <p className="text-sm text-muted-foreground">Daftar orderan yang Anda titip-cetak ke cabang lain</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 flex-wrap border-b border-border">
                {TABS.map(t => {
                    const Icon = t.icon;
                    const count = counts[t.key] || 0;
                    const active = tab === t.key;
                    return (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className={`px-3 py-2 text-sm font-medium flex items-center gap-1.5 border-b-2 transition-colors ${active
                                ? 'border-primary text-primary'
                                : 'border-transparent text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            <Icon className={`w-4 h-4 ${active ? '' : t.color}`} />
                            {t.label}
                            {count > 0 && (
                                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${active ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>
                                    {count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* List */}
            {isLoading ? (
                <div className="text-center py-10 text-muted-foreground">Memuat…</div>
            ) : entries.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground border-2 border-dashed border-border rounded-xl">
                    <Send className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p>Belum ada titipan keluar</p>
                    <p className="text-xs mt-1">Saat checkout, pilih "Titip ke Cabang Lain" untuk mengirim orderan ke cabang lain</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {entries.map((it: BranchOutboxEntry) => {
                        const isExpress = it.productionPriority === 'EXPRESS';
                        const isExpanded = expanded.has(it.id);
                        const isReady = it.handoverStatus === 'SIAP_AMBIL';
                        return (
                            <div key={it.id} className={`border rounded-xl overflow-hidden ${isReady ? 'border-emerald-500/50 bg-emerald-500/5' : isExpress ? 'border-red-500/50 bg-red-500/5' : 'border-border bg-card'}`}>
                                <button onClick={() => toggle(it.id)} className="w-full p-3 text-left hover:bg-muted/30 transition-colors">
                                    <div className="flex items-start justify-between gap-2 flex-wrap">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                                {isExpress && (
                                                    <span className="text-[10px] font-bold px-2 py-0.5 bg-red-500 text-white rounded-full flex items-center gap-1">
                                                        <AlertTriangle className="w-2.5 h-2.5" /> EXPRESS
                                                    </span>
                                                )}
                                                <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-500/15 text-amber-700 border border-amber-500/30 rounded-full">
                                                    → {it.targetBranch?.code || it.targetBranch?.name || '—'}
                                                </span>
                                                <StatusChip s={it.handoverStatus} />
                                                <span className="text-xs font-mono text-muted-foreground">{it.invoiceNumber}</span>
                                            </div>
                                            <p className="text-sm font-semibold">{it.customerName || 'Tanpa nama'}</p>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                {it.itemCount} item — {new Date(it.createdAt).toLocaleString('id-ID')}
                                            </p>
                                            {isReady && it.handoverReadyAt && (
                                                <p className="text-[11px] text-emerald-600 font-medium mt-1 flex items-center gap-1">
                                                    <PackageCheck className="w-3 h-3" />
                                                    Siap diambil sejak {new Date(it.handoverReadyAt).toLocaleString('id-ID')}
                                                </p>
                                            )}
                                            {it.handoverDoneAt && (
                                                <p className="text-[11px] text-gray-500 mt-1 flex items-center gap-1">
                                                    <CheckCircle2 className="w-3 h-3" />
                                                    Diambil {new Date(it.handoverDoneAt).toLocaleString('id-ID')}
                                                </p>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-bold">Rp {it.grandTotal.toLocaleString('id-ID')}</div>
                                        </div>
                                    </div>
                                </button>

                                {isExpanded && (
                                    <div className="px-3 pb-3 pt-1 space-y-2 border-t border-border/50">
                                        {it.items.map(i => (
                                            <div key={i.id} className="p-2 bg-muted/20 rounded-lg text-xs">
                                                <div className="flex items-center justify-between gap-2">
                                                    <div>
                                                        <span className="font-semibold">{i.quantity}× {i.productName}</span>
                                                        {i.variantName && <span className="text-muted-foreground"> · {i.variantName}</span>}
                                                    </div>
                                                    <span className="text-[10px] px-1.5 py-0.5 bg-muted border border-border rounded-full">{i.pricingMode}</span>
                                                </div>
                                                {i.widthCm && i.heightCm && (
                                                    <p className="text-muted-foreground mt-0.5">
                                                        {i.widthCm}×{i.heightCm} cm{i.pcs ? ` · ${i.pcs} pcs` : ''}
                                                    </p>
                                                )}
                                                {i.note && <p className="text-muted-foreground italic mt-0.5">Catatan: {i.note}</p>}
                                            </div>
                                        ))}
                                        {it.productionNotes && (
                                            <div className="p-2 bg-amber-500/5 border border-amber-500/30 rounded-lg text-xs">
                                                <span className="font-semibold text-amber-700">Catatan produksi:</span> {it.productionNotes}
                                            </div>
                                        )}
                                        {isReady && (
                                            <div className="pt-2">
                                                <button
                                                    onClick={() => confirmMut.mutate(it.id)}
                                                    disabled={confirmMut.isPending}
                                                    className="w-full px-3 py-2 bg-emerald-500 text-white rounded-lg text-sm font-bold hover:bg-emerald-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5">
                                                    <Truck className="w-4 h-4" />
                                                    Konfirmasi Sudah Diambil
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
