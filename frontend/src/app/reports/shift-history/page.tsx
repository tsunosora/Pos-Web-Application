"use client";

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getShiftHistory, resendShiftReport } from '@/lib/api';
import { Clock, Send, Copy, Check, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import dayjs from 'dayjs';

export default function ShiftHistoryPage() {
    const [page, setPage] = useState(1);
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [copiedId, setCopiedId] = useState<number | null>(null);

    const { data, isLoading, refetch } = useQuery({
        queryKey: ['shift-history', page],
        queryFn: () => getShiftHistory(page, 20),
    });

    const resendMutation = useMutation({
        mutationFn: (id: number) => resendShiftReport(id),
        onSuccess: () => alert('Laporan berhasil dikirim ulang ke WhatsApp!'),
        onError: (err: any) => alert(`Gagal kirim ulang: ${err?.response?.data?.message || err.message}`),
    });

    const handleCopy = (msg: string, id: number) => {
        navigator.clipboard.writeText(msg).then(() => {
            setCopiedId(id);
            setTimeout(() => setCopiedId(null), 2000);
        });
    };

    const list: any[] = data?.list || [];
    const total: number = data?.total || 0;
    const totalPages = Math.ceil(total / 20);

    if (isLoading) {
        return <div className="flex h-64 items-center justify-center text-muted-foreground">Memuat riwayat shift...</div>;
    }

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div>
                <h1 className="text-2xl font-bold text-foreground">Riwayat Tutup Shift</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Log semua tutup shift beserta backup pesan WhatsApp — bisa disalin atau dikirim ulang jika gagal.
                </p>
            </div>

            {list.length === 0 ? (
                <div className="glass rounded-xl border border-border p-16 text-center">
                    <FileText className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />
                    <p className="font-medium text-foreground">Belum ada riwayat shift</p>
                    <p className="text-sm text-muted-foreground mt-1">Riwayat akan muncul setelah tutup shift pertama.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {list.map((shift: any) => {
                        const isExpanded = expandedId === shift.id;
                        const hasMsgBackup = !!shift.whatsappMessage;
                        const totalPenerimaan = Number(shift.actualCash) + Number(shift.actualQris) + Number(shift.actualTransfer);

                        return (
                            <div key={shift.id} className="glass rounded-xl border border-border overflow-hidden">
                                {/* Header baris */}
                                <div
                                    className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-muted/30 transition-colors"
                                    onClick={() => setExpandedId(isExpanded ? null : shift.id)}
                                >
                                    <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                                        <Clock className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-semibold text-foreground">{shift.shiftName}</span>
                                            <span className="text-xs text-muted-foreground">•</span>
                                            <span className="text-sm text-muted-foreground">{shift.adminName}</span>
                                            <span className="text-xs text-muted-foreground">•</span>
                                            <span className="text-xs text-muted-foreground font-mono">
                                                {dayjs(shift.closedAt).format('DD MMM YYYY, HH:mm')}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-4 mt-1 text-sm">
                                            <span className="text-emerald-600 font-semibold">
                                                Rp {totalPenerimaan.toLocaleString('id-ID')}
                                            </span>
                                            {Number(shift.expensesTotal) > 0 && (
                                                <span className="text-orange-500 text-xs">
                                                    Pengeluaran: Rp {Number(shift.expensesTotal).toLocaleString('id-ID')}
                                                </span>
                                            )}
                                            {!hasMsgBackup && (
                                                <span className="text-xs text-muted-foreground/50 italic">Tidak ada backup WA</span>
                                            )}
                                        </div>
                                    </div>
                                    {/* Tombol aksi */}
                                    <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                                        {hasMsgBackup && (
                                            <>
                                                <button
                                                    onClick={() => handleCopy(shift.whatsappMessage, shift.id)}
                                                    title="Salin pesan WA"
                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-xs font-medium text-muted-foreground transition-colors"
                                                >
                                                    {copiedId === shift.id
                                                        ? <><Check className="w-3.5 h-3.5 text-emerald-500" /> Tersalin</>
                                                        : <><Copy className="w-3.5 h-3.5" /> Salin Pesan</>
                                                    }
                                                </button>
                                                <button
                                                    onClick={() => resendMutation.mutate(shift.id)}
                                                    disabled={resendMutation.isPending && resendMutation.variables === shift.id}
                                                    title="Kirim ulang ke WhatsApp"
                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#25D366]/10 border border-[#25D366]/30 hover:bg-[#25D366]/20 text-xs font-medium text-[#25D366] transition-colors disabled:opacity-50"
                                                >
                                                    <Send className="w-3.5 h-3.5" />
                                                    {resendMutation.isPending && resendMutation.variables === shift.id ? 'Mengirim...' : 'Kirim Ulang WA'}
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Detail ekspand: ringkasan + pesan WA */}
                                {isExpanded && (
                                    <div className="border-t border-border px-5 py-4 space-y-4 bg-muted/10">
                                        {/* Ringkasan angka */}
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                                            {[
                                                { label: 'Tunai', value: Number(shift.actualCash) },
                                                { label: 'QRIS', value: Number(shift.actualQris) },
                                                { label: 'Transfer', value: Number(shift.actualTransfer) },
                                                { label: 'Pengeluaran', value: Number(shift.expensesTotal), red: true },
                                            ].map(item => (
                                                <div key={item.label} className="bg-background rounded-lg border border-border p-3">
                                                    <p className="text-xs text-muted-foreground">{item.label}</p>
                                                    <p className={`font-bold mt-0.5 ${item.red ? 'text-orange-600' : 'text-foreground'}`}>
                                                        Rp {item.value.toLocaleString('id-ID')}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Backup pesan WA */}
                                        {hasMsgBackup && (
                                            <div className="space-y-2">
                                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Backup Pesan WhatsApp</p>
                                                <pre className="whitespace-pre-wrap text-xs bg-background border border-border rounded-lg p-3 max-h-64 overflow-y-auto font-mono text-foreground leading-relaxed">
                                                    {shift.whatsappMessage}
                                                </pre>
                                            </div>
                                        )}

                                        {shift.notes && (
                                            <div>
                                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Catatan</p>
                                                <p className="text-sm text-foreground bg-background border border-border rounded-lg px-3 py-2">{shift.notes}</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-3">
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="p-2 rounded-lg border border-border bg-background hover:bg-muted disabled:opacity-40 transition-colors"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-sm text-muted-foreground">
                        Halaman {page} dari {totalPages}
                    </span>
                    <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="p-2 rounded-lg border border-border bg-background hover:bg-muted disabled:opacity-40 transition-colors"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            )}
        </div>
    );
}
