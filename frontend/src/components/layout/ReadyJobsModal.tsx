"use client";

import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { X, PackageCheck, Search, FileText, Printer, Loader2, CheckSquare, Square } from 'lucide-react';
import { useReadyJobs, ReadyJob } from '@/hooks/useReadyJobs';
import { bulkPickupProductionJobs } from '@/lib/api/production';
import { bulkPickupPrintJobs } from '@/lib/api/print-queue';

interface Props {
    open: boolean;
    onClose: () => void;
}

const jobKey = (j: ReadyJob) => `${j.source}-${j.id}`;

/**
 * Modal multi-select untuk konfirmasi diambil.
 * Default: semua tercentang. Kasir uncheck yang belum diambil customer.
 * Search by customer name / invoice / job number.
 * Group by customer name supaya nota satu customer kelihatan satu kelompok.
 */
export function ReadyJobsModal({ open, onClose }: Props) {
    const queryClient = useQueryClient();
    const { data: jobs = [], isLoading } = useReadyJobs();
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [search, setSearch] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [toastMsg, setToastMsg] = useState<string | null>(null);

    // Default: semua tercentang setiap kali jobs berubah (mis. setelah pickup, list refresh)
    useEffect(() => {
        if (!open) return;
        setSelected(new Set(jobs.map(jobKey)));
    }, [open, jobs]);

    // Auto-close kalau modal sudah open tapi list jadi kosong (semua sudah pickup)
    useEffect(() => {
        if (open && !isLoading && jobs.length === 0) {
            const t = setTimeout(() => onClose(), 800);
            return () => clearTimeout(t);
        }
    }, [open, isLoading, jobs.length, onClose]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return jobs;
        return jobs.filter(j =>
            (j.customerName ?? '').toLowerCase().includes(q) ||
            j.invoiceNumber.toLowerCase().includes(q) ||
            (j.checkoutNumber ?? '').toLowerCase().includes(q) ||
            j.jobNumber.toLowerCase().includes(q) ||
            j.productName.toLowerCase().includes(q),
        );
    }, [jobs, search]);

    // Group by customer name
    const grouped = useMemo(() => {
        const map = new Map<string, ReadyJob[]>();
        for (const j of filtered) {
            const k = j.customerName ?? '— Tanpa Nama —';
            const arr = map.get(k) ?? [];
            arr.push(j);
            map.set(k, arr);
        }
        return Array.from(map.entries());
    }, [filtered]);

    const toggleOne = (key: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });
    };

    const toggleGroup = (groupJobs: ReadyJob[]) => {
        const keys = groupJobs.map(jobKey);
        const allSelected = keys.every(k => selected.has(k));
        setSelected(prev => {
            const next = new Set(prev);
            if (allSelected) keys.forEach(k => next.delete(k));
            else keys.forEach(k => next.add(k));
            return next;
        });
    };

    const selectAll = () => setSelected(new Set(filtered.map(jobKey)));
    const clearAll = () => setSelected(new Set());

    const selectedCount = filtered.filter(j => selected.has(jobKey(j))).length;

    const handleConfirm = async () => {
        if (submitting || selectedCount === 0) return;
        setSubmitting(true);
        setToastMsg(null);
        try {
            const picked = filtered.filter(j => selected.has(jobKey(j)));
            const prodIds = picked.filter(j => j.source === 'production').map(j => j.id);
            const printIds = picked.filter(j => j.source === 'print').map(j => j.id);
            const branchId = picked[0]?.branchId ?? undefined;

            const calls: Promise<{ updated: number }>[] = [];
            if (prodIds.length) calls.push(bulkPickupProductionJobs(prodIds, branchId ?? undefined));
            if (printIds.length) calls.push(bulkPickupPrintJobs(printIds, branchId ?? undefined));
            const results = await Promise.all(calls);
            const total = results.reduce((s, r) => s + (r.updated ?? 0), 0);

            await queryClient.invalidateQueries({ queryKey: ['ready-jobs'] });
            await queryClient.invalidateQueries({ queryKey: ['production-stats-sidebar'] });
            await queryClient.invalidateQueries({ queryKey: ['print-queue-stats-sidebar'] });

            setToastMsg(`✓ ${total} cetakan dikonfirmasi diambil`);
            // Auto-close kalau habis (handled by useEffect)
        } catch (e: any) {
            setToastMsg(`✗ Gagal: ${e?.message || 'Unknown'}`);
        } finally {
            setSubmitting(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-[110] flex items-center justify-center p-4 print:hidden">
            <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border">
                    <div className="flex items-center gap-2">
                        <PackageCheck className="w-5 h-5 text-amber-600" />
                        <div>
                            <h2 className="font-bold text-base">Cetakan Siap Diambil</h2>
                            <p className="text-xs text-muted-foreground">
                                {selectedCount} dari {filtered.length} dipilih
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Search + bulk toggle */}
                <div className="p-3 border-b border-border space-y-2">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="search"
                            placeholder="Cari customer / invoice / nomor job…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary"
                        />
                    </div>
                    <div className="flex gap-2 text-xs">
                        <button onClick={selectAll} className="px-2.5 py-1 rounded border border-border hover:bg-muted font-medium">Pilih Semua</button>
                        <button onClick={clearAll} className="px-2.5 py-1 rounded border border-border hover:bg-muted font-medium">Hapus Pilihan</button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                    {isLoading ? (
                        <div className="flex justify-center py-10">
                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="py-10 text-center text-sm text-muted-foreground">
                            {jobs.length === 0 ? 'Tidak ada cetakan siap diambil saat ini.' : 'Tidak ada hasil untuk pencarian Anda.'}
                        </div>
                    ) : (
                        grouped.map(([customer, items]) => {
                            const allInGroup = items.every(j => selected.has(jobKey(j)));
                            const someInGroup = items.some(j => selected.has(jobKey(j)));
                            return (
                                <div key={customer} className="border border-border rounded-lg overflow-hidden">
                                    {/* Group header */}
                                    <button
                                        onClick={() => toggleGroup(items)}
                                        className="w-full flex items-center gap-2 px-3 py-2 bg-muted/40 hover:bg-muted/70 transition-colors text-left"
                                    >
                                        {allInGroup ? (
                                            <CheckSquare className="w-4 h-4 text-primary shrink-0" />
                                        ) : someInGroup ? (
                                            <CheckSquare className="w-4 h-4 text-primary/50 shrink-0" />
                                        ) : (
                                            <Square className="w-4 h-4 text-muted-foreground shrink-0" />
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-sm truncate">{customer}</p>
                                            <p className="text-[11px] text-muted-foreground">{items.length} cetakan</p>
                                        </div>
                                    </button>
                                    {/* Group items */}
                                    <div className="divide-y divide-border">
                                        {items.map(j => {
                                            const k = jobKey(j);
                                            const checked = selected.has(k);
                                            return (
                                                <label key={k}
                                                    className={`flex items-start gap-2 px-3 py-2 cursor-pointer hover:bg-muted/30 transition-colors ${checked ? 'bg-amber-500/5' : ''}`}>
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        onChange={() => toggleOne(k)}
                                                        className="mt-0.5 w-4 h-4 accent-amber-500"
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border flex items-center gap-1 ${
                                                                j.source === 'production'
                                                                    ? 'bg-blue-500/15 text-blue-600 border-blue-500/30'
                                                                    : 'bg-purple-500/15 text-purple-600 border-purple-500/30'
                                                            }`}>
                                                                {j.source === 'production' ? <FileText className="w-2.5 h-2.5" /> : <Printer className="w-2.5 h-2.5" />}
                                                                {j.source === 'production' ? 'Produksi' : 'Cetak'}
                                                            </span>
                                                            {j.isInterBranch && (
                                                                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-amber-500/15 text-amber-700 border border-amber-500/30 rounded">⚑ Titipan</span>
                                                            )}
                                                            <span className="text-xs font-mono text-muted-foreground">{j.checkoutNumber || j.invoiceNumber}</span>
                                                            <span className="text-[10px] text-muted-foreground">· {j.jobNumber}</span>
                                                        </div>
                                                        <p className="text-sm mt-0.5">
                                                            {j.quantity}× {j.productName}
                                                            {j.variantName && <span className="text-muted-foreground"> — {j.variantName}</span>}
                                                        </p>
                                                    </div>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                <div className="border-t border-border p-3 flex items-center gap-2 bg-muted/20">
                    {toastMsg && (
                        <span className={`text-xs flex-1 ${toastMsg.startsWith('✓') ? 'text-emerald-600' : 'text-red-600'}`}>{toastMsg}</span>
                    )}
                    <button onClick={onClose} disabled={submitting}
                        className="px-3 py-2 text-sm rounded-lg border border-border hover:bg-muted disabled:opacity-50 ml-auto">
                        Tutup
                    </button>
                    <button onClick={handleConfirm} disabled={submitting || selectedCount === 0}
                        className="px-4 py-2 text-sm font-bold rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 text-white hover:from-amber-600 hover:to-orange-700 disabled:opacity-50 flex items-center gap-1.5">
                        {submitting ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Memproses…</>
                        ) : (
                            <><PackageCheck className="w-4 h-4" /> Konfirmasi {selectedCount} Diambil</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
