"use client";

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { PackageCheck, X, Printer, FileText, Loader2 } from 'lucide-react';
import { useReadyJobs, ReadyJob } from '@/hooks/useReadyJobs';
import { bulkPickupProductionJobs } from '@/lib/api/production';
import { bulkPickupPrintJobs } from '@/lib/api/print-queue';

const ACK_KEY = 'ready-jobs-ack-ids';

function getAckedKeys(): string[] {
    if (typeof window === 'undefined') return [];
    try {
        return JSON.parse(localStorage.getItem(ACK_KEY) || '[]');
    } catch {
        return [];
    }
}

function saveAckedKeys(keys: string[]) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(ACK_KEY, JSON.stringify(keys.slice(-100)));
}

/** Unique key per job karena id bisa overlap antara production & print. */
const jobKey = (j: ReadyJob) => `${j.source}-${j.id}`;

interface Props {
    onOpenModal: () => void;
}

/**
 * Popup full-screen yang auto-muncul saat ada job SELESAI baru di cabang aktif.
 * Reuse pattern dari BranchOutboxReadyPopup (audio beep, ack via localStorage).
 *
 * 3 tombol aksi:
 * - "Konfirmasi Semua Diambil" → bulk pickup semua job yang muncul
 * - "Pilih per Item" → buka ReadyJobsModal untuk multi-select
 * - "Tutup Dulu" → ack tanpa pickup (job tetap SELESAI di queue, tidak muncul lagi)
 */
export function ReadyJobsPopup({ onOpenModal }: Props) {
    const queryClient = useQueryClient();
    const [dismissed, setDismissed] = useState<Set<string>>(new Set());
    const [submitting, setSubmitting] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const prevKeysRef = useRef<Set<string>>(new Set());
    // Audio throttle: minimal 30s antara dua beep — supaya kalau polling
    // rapid-fire atau popup remount, kasir tidak di-spam audio.
    const lastBeepRef = useRef<number>(0);

    const { data: jobs = [] } = useReadyJobs();

    useEffect(() => {
        setDismissed(new Set(getAckedKeys()));
    }, []);

    useEffect(() => {
        if (!jobs.length) return;
        const currentKeys = new Set(jobs.map(jobKey));
        const brandNew = jobs.filter(j => !prevKeysRef.current.has(jobKey(j)) && !dismissed.has(jobKey(j)));
        if (brandNew.length > 0 && prevKeysRef.current.size > 0) {
            const now = Date.now();
            if (now - lastBeepRef.current > 30_000) {
                try { audioRef.current?.play().catch(() => { }); } catch { /* noop */ }
                lastBeepRef.current = now;
            }
        }
        prevKeysRef.current = currentKeys;
    }, [jobs, dismissed]);

    const newItems = jobs.filter(j => !dismissed.has(jobKey(j)));
    if (newItems.length === 0) return null;

    const handleDismissAll = () => {
        const keys = newItems.map(jobKey);
        const merged = Array.from(new Set([...Array.from(dismissed), ...keys]));
        setDismissed(new Set(merged));
        saveAckedKeys(merged);
    };

    const handleConfirmAll = async () => {
        if (submitting) return;
        setSubmitting(true);
        try {
            const prodIds = newItems.filter(j => j.source === 'production').map(j => j.id);
            const printIds = newItems.filter(j => j.source === 'print').map(j => j.id);
            // Branch scoping: server-side validate. Kita pass branchId dari job pertama (sudah scoped per cabang aktif).
            const branchId = newItems[0]?.branchId ?? undefined;
            const calls: Promise<any>[] = [];
            if (prodIds.length) calls.push(bulkPickupProductionJobs(prodIds, branchId ?? undefined));
            if (printIds.length) calls.push(bulkPickupPrintJobs(printIds, branchId ?? undefined));
            await Promise.all(calls);
            // Refresh data
            await queryClient.invalidateQueries({ queryKey: ['ready-jobs'] });
            await queryClient.invalidateQueries({ queryKey: ['production-stats-sidebar'] });
            await queryClient.invalidateQueries({ queryKey: ['print-queue-stats-sidebar'] });
            // Clear ack untuk job yang sudah pickup (mereka tidak akan muncul lagi karena status DIAMBIL)
        } catch (e: any) {
            // eslint-disable-next-line no-console
            console.error('Bulk pickup gagal:', e);
            alert(`Gagal konfirmasi: ${e?.message || 'Unknown error'}`);
        } finally {
            setSubmitting(false);
        }
    };

    const handleOpenModal = () => {
        onOpenModal();
        // Sekalian dismiss popup supaya tidak overlap
        handleDismissAll();
    };

    return (
        <>
            {/* Audio beep singkat */}
            <audio ref={audioRef} preload="auto" src="data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAIlYAAESsAAACABAAZGF0YQAAAAA=" />

            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 print:hidden">
                <div className="w-full max-w-lg bg-card border-2 border-amber-500 rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                    {/* Header */}
                    <div className="flex items-center gap-3 p-4 border-b border-border bg-gradient-to-br from-amber-500/15 to-orange-500/10 rounded-t-2xl">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center animate-pulse">
                            <PackageCheck className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1">
                            <h2 className="text-base font-bold text-foreground">📦 Cetakan Siap Diambil!</h2>
                            <p className="text-xs text-muted-foreground">
                                {newItems.length} cetakan sudah jadi & siap diserahkan ke customer
                            </p>
                        </div>
                    </div>

                    {/* Body — list job */}
                    <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
                        {newItems.slice(0, 10).map((j) => (
                            <div key={jobKey(j)} className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/5">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                                        j.source === 'production'
                                            ? 'bg-blue-500/15 text-blue-600 border-blue-500/30'
                                            : 'bg-purple-500/15 text-purple-600 border-purple-500/30'
                                    }`}>
                                        {j.source === 'production' ? <FileText className="w-2.5 h-2.5" /> : <Printer className="w-2.5 h-2.5" />}
                                        {j.source === 'production' ? 'Produksi' : 'Cetak Paper'}
                                    </span>
                                    {j.isInterBranch && (
                                        <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-500/15 text-amber-700 border border-amber-500/30 rounded-full">
                                            ⚑ Titipan
                                        </span>
                                    )}
                                    <span className="text-xs font-mono text-muted-foreground">{j.checkoutNumber || j.invoiceNumber}</span>
                                </div>
                                <p className="text-sm font-semibold text-foreground">{j.customerName || 'Tanpa nama'}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {j.quantity}× {j.productName}{j.variantName ? ` — ${j.variantName}` : ''}
                                </p>
                            </div>
                        ))}
                        {newItems.length > 10 && (
                            <p className="text-center text-xs text-muted-foreground py-2">
                                +{newItems.length - 10} lainnya — pilih "Pilih per Item" untuk lihat semua
                            </p>
                        )}
                    </div>

                    {/* Footer actions */}
                    <div className="flex flex-col sm:flex-row gap-2 p-4 border-t border-border bg-muted/20 rounded-b-2xl">
                        <button onClick={handleConfirmAll} disabled={submitting}
                            className="flex-1 px-3 py-2.5 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white text-sm font-bold hover:from-amber-600 hover:to-orange-700 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5">
                            {submitting ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> Memproses…</>
                            ) : (
                                <><PackageCheck className="w-4 h-4" /> Konfirmasi Semua Diambil ({newItems.length})</>
                            )}
                        </button>
                        <button onClick={handleOpenModal} disabled={submitting}
                            className="px-3 py-2.5 rounded-xl bg-card border-2 border-border text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-50 transition-colors">
                            Pilih per Item
                        </button>
                        <button onClick={handleDismissAll} disabled={submitting}
                            className="px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5">
                            <X className="w-4 h-4" /> Tutup
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
