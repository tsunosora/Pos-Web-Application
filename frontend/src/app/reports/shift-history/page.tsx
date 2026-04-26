"use client";

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getShiftHistory, resendShiftReport, amendShiftReport } from '@/lib/api';
import { Clock, Send, Copy, Check, ChevronLeft, ChevronRight, FileText, Pencil, X, AlertCircle, Plus, Trash2, Loader2, History } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/responsive-table';
import dayjs from 'dayjs';
import { useBranchStore } from '@/store/branch-store';

type AmendState = {
    actualCash: string;
    actualQris: string;
    actualTransfer: string;
    tukarTransferKeCash: string;
    structuredExpenses: Record<string, { name: string; amount: string }[]>;
    kasbon: { name: string; amount: string; source: string }[];
    setorKas: { bankName: string; amount: string }[];
    tarikTunai: { bankName: string; amount: string }[];
    additionalIncomes: { bankName: string; amount: string; description: string }[];
    paymentExchanges: { from: string; to: string; amount: string; description: string }[];
    actualBankBalances: Record<string, string>;
    realBankBalances: Record<string, string>;
    notes: string;
    amendNote: string;
};

const emptyAmendState = (): AmendState => ({
    actualCash: '0',
    actualQris: '0',
    actualTransfer: '0',
    tukarTransferKeCash: '0',
    structuredExpenses: {},
    kasbon: [],
    setorKas: [],
    tarikTunai: [],
    additionalIncomes: [],
    paymentExchanges: [],
    actualBankBalances: {},
    realBankBalances: {},
    notes: '',
    amendNote: '',
});

export default function ShiftHistoryPage() {
    const queryClient = useQueryClient();
    const activeBranchId = useBranchStore((s) => s.activeBranchId);
    const [page, setPage] = useState(1);
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [copiedId, setCopiedId] = useState<number | null>(null);

    // Amend modal state
    const [amendId, setAmendId] = useState<number | null>(null);
    const [amendShift, setAmendShift] = useState<any>(null);
    const [amendState, setAmendState] = useState<AmendState>(emptyAmendState());

    const { data, isLoading, refetch } = useQuery({
        queryKey: ['shift-history', activeBranchId, page],
        queryFn: () => getShiftHistory(page, 20),
    });

    const resendMutation = useMutation({
        mutationFn: (id: number) => resendShiftReport(id),
        onSuccess: () => alert('Laporan berhasil dikirim ulang ke WhatsApp!'),
        onError: (err: any) => alert(`Gagal kirim ulang: ${err?.response?.data?.message || err.message}`),
    });

    const amendMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: Parameters<typeof amendShiftReport>[1] }) =>
            amendShiftReport(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['shift-history'] });
            setAmendId(null);
            setAmendShift(null);
            alert('Laporan shift berhasil dikoreksi!');
        },
        onError: (err: any) => alert(`Gagal koreksi: ${err?.response?.data?.message || err.message}`),
    });

    const openAmendModal = (shift: any) => {
        setAmendShift(shift);
        setAmendId(shift.id);

        // Convert structuredExpenses: number amounts → string
        const rawExp = shift.structuredExpenses || {};
        const strExp: Record<string, { name: string; amount: string }[]> = {};
        for (const [method, items] of Object.entries(rawExp as Record<string, any[]>)) {
            strExp[method] = items.map((it: any) => ({ name: it.name || '', amount: String(it.amount || 0) }));
        }

        setAmendState({
            actualCash: String(Number(shift.actualCash || 0)),
            actualQris: String(Number(shift.actualQris || 0)),
            actualTransfer: String(Number(shift.actualTransfer || 0)),
            tukarTransferKeCash: String(Number(shift.tukarTransferKeCash || 0)),
            structuredExpenses: strExp,
            kasbon: (shift.kasbon || []).map((k: any) => ({ name: k.name || '', amount: String(k.amount || 0), source: k.source || 'CASH' })),
            setorKas: (shift.setorKas || []).map((s: any) => ({ bankName: s.bankName || '', amount: String(s.amount || 0) })),
            tarikTunai: (shift.tarikTunai || []).map((t: any) => ({ bankName: t.bankName || '', amount: String(t.amount || 0) })),
            additionalIncomes: (shift.additionalIncomes || []).map((a: any) => ({ bankName: a.bankName || '', amount: String(a.amount || 0), description: a.description || '' })),
            paymentExchanges: (shift.paymentExchanges || []).map((p: any) => ({ from: p.from || '', to: p.to || '', amount: String(p.amount || 0), description: p.description || '' })),
            actualBankBalances: Object.fromEntries(Object.entries(shift.actualBankBalances || {}).map(([k, v]) => [k, String(v || 0)])),
            realBankBalances: Object.fromEntries(Object.entries(shift.realBankBalances || {}).map(([k, v]) => [k, String(v || 0)])),
            notes: shift.notes || '',
            amendNote: '',
        });
    };

    const handleAmendSubmit = () => {
        if (!amendState.amendNote.trim()) {
            alert('Catatan alasan koreksi wajib diisi.');
            return;
        }
        if (!amendId) return;

        // Parse structuredExpenses back to numbers
        const parsedExpenses: Record<string, { name: string; amount: number }[]> = {};
        for (const [method, items] of Object.entries(amendState.structuredExpenses)) {
            parsedExpenses[method] = items.map(it => ({ name: it.name, amount: Number(it.amount) || 0 }));
        }
        // Parse actualBankBalances / realBankBalances
        const parsedActualBank = Object.fromEntries(Object.entries(amendState.actualBankBalances).map(([k, v]) => [k, Number(v) || 0]));
        const parsedRealBank = Object.fromEntries(Object.entries(amendState.realBankBalances).map(([k, v]) => [k, Number(v) || 0]));

        amendMutation.mutate({
            id: amendId,
            data: {
                actualCash: Number(amendState.actualCash) || 0,
                actualQris: Number(amendState.actualQris) || 0,
                actualTransfer: Number(amendState.actualTransfer) || 0,
                tukarTransferKeCash: Number(amendState.tukarTransferKeCash) || 0,
                structuredExpenses: parsedExpenses,
                kasbon: amendState.kasbon.map(k => ({ name: k.name, amount: Number(k.amount) || 0, source: k.source })),
                setorKas: amendState.setorKas.map(s => ({ bankName: s.bankName, amount: Number(s.amount) || 0 })),
                tarikTunai: amendState.tarikTunai.map(t => ({ bankName: t.bankName, amount: Number(t.amount) || 0 })),
                additionalIncomes: amendState.additionalIncomes.map(a => ({ bankName: a.bankName, amount: Number(a.amount) || 0, description: a.description })),
                paymentExchanges: amendState.paymentExchanges.map(p => ({ from: p.from, to: p.to, amount: Number(p.amount) || 0, description: p.description })),
                actualBankBalances: parsedActualBank,
                realBankBalances: parsedRealBank,
                notes: amendState.notes,
                amendNote: amendState.amendNote,
            },
        });
    };

    // Pengeluaran terstruktur
    const addExpense = (method: string) => setAmendState(s => ({ ...s, structuredExpenses: { ...s.structuredExpenses, [method]: [...(s.structuredExpenses[method] || []), { name: '', amount: '0' }] } }));
    const removeExpense = (method: string, idx: number) => setAmendState(s => ({ ...s, structuredExpenses: { ...s.structuredExpenses, [method]: s.structuredExpenses[method].filter((_, i) => i !== idx) } }));
    const updateExpense = (method: string, idx: number, field: 'name' | 'amount', value: string) => setAmendState(s => { const arr = [...(s.structuredExpenses[method] || [])]; arr[idx] = { ...arr[idx], [field]: value }; return { ...s, structuredExpenses: { ...s.structuredExpenses, [method]: arr } }; });

    // Kasbon
    const addKasbon = () => setAmendState(s => ({ ...s, kasbon: [...s.kasbon, { name: '', amount: '0', source: 'CASH' }] }));
    const removeKasbon = (i: number) => setAmendState(s => ({ ...s, kasbon: s.kasbon.filter((_, idx) => idx !== i) }));
    const updateKasbon = (i: number, field: string, value: string) => setAmendState(s => { const arr = [...s.kasbon]; arr[i] = { ...arr[i], [field]: value }; return { ...s, kasbon: arr }; });

    // Setor Kas
    const addSetorKas = () => setAmendState(s => ({ ...s, setorKas: [...s.setorKas, { bankName: '', amount: '0' }] }));
    const removeSetorKas = (i: number) => setAmendState(s => ({ ...s, setorKas: s.setorKas.filter((_, idx) => idx !== i) }));
    const updateSetorKas = (i: number, field: string, value: string) => setAmendState(s => { const arr = [...s.setorKas]; arr[i] = { ...arr[i], [field]: value }; return { ...s, setorKas: arr }; });

    // Tarik Tunai
    const addTarikTunai = () => setAmendState(s => ({ ...s, tarikTunai: [...s.tarikTunai, { bankName: '', amount: '0' }] }));
    const removeTarikTunai = (i: number) => setAmendState(s => ({ ...s, tarikTunai: s.tarikTunai.filter((_, idx) => idx !== i) }));
    const updateTarikTunai = (i: number, field: string, value: string) => setAmendState(s => { const arr = [...s.tarikTunai]; arr[i] = { ...arr[i], [field]: value }; return { ...s, tarikTunai: arr }; });

    // Pendapatan Tambahan
    const addAdditionalIncome = () => setAmendState(s => ({ ...s, additionalIncomes: [...s.additionalIncomes, { bankName: '', amount: '0', description: '' }] }));
    const removeAdditionalIncome = (i: number) => setAmendState(s => ({ ...s, additionalIncomes: s.additionalIncomes.filter((_, idx) => idx !== i) }));
    const updateAdditionalIncome = (i: number, field: string, value: string) => setAmendState(s => { const arr = [...s.additionalIncomes]; arr[i] = { ...arr[i], [field]: value }; return { ...s, additionalIncomes: arr }; });

    // Pertukaran Metode
    const addPaymentExchange = () => setAmendState(s => ({ ...s, paymentExchanges: [...s.paymentExchanges, { from: '', to: '', amount: '0', description: '' }] }));
    const removePaymentExchange = (i: number) => setAmendState(s => ({ ...s, paymentExchanges: s.paymentExchanges.filter((_, idx) => idx !== i) }));
    const updatePaymentExchange = (i: number, field: string, value: string) => setAmendState(s => { const arr = [...s.paymentExchanges]; arr[i] = { ...arr[i], [field]: value }; return { ...s, paymentExchanges: arr }; });

    // Hitung saldo kas bersih secara live dari state saat ini
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
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto">
            <PageHeader
                title="Riwayat Tutup Shift"
                description="Log semua tutup shift beserta backup pesan WhatsApp — bisa disalin atau dikirim ulang jika gagal"
                icon={History}
                breadcrumbs={[{ label: 'Laporan' }, { label: 'Riwayat Shift' }]}
            />

            <div className="space-y-6">
            {list.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-card">
                    <EmptyState
                        icon={FileText}
                        title="Belum ada riwayat shift"
                        description="Riwayat akan muncul setelah tutup shift pertama."
                    />
                </div>
            ) : (
                <div className="space-y-3">
                    {list.map((shift: any) => {
                        const isExpanded = expandedId === shift.id;
                        const hasMsgBackup = !!shift.whatsappMessage;
                        const totalPenerimaan = Number(shift.actualCash) + Number(shift.actualQris) + Number(shift.actualTransfer);

                        return (
                            <div key={shift.id} className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
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
                                        {shift.amendedAt && (
                                            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 text-xs font-medium">
                                                <Pencil className="w-3 h-3" />
                                                Dikoreksi {dayjs(shift.amendedAt).format('DD/MM/YY')}
                                            </span>
                                        )}
                                        <button
                                            onClick={() => openAmendModal(shift)}
                                            title="Koreksi laporan ini"
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-xs font-medium text-amber-700 dark:text-amber-400 transition-colors"
                                        >
                                            <Pencil className="w-3.5 h-3.5" />
                                            Koreksi
                                        </button>
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

                                        {/* Amend info */}
                                        {shift.amendedAt && (
                                            <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 space-y-1">
                                                <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                                                    <Pencil className="w-3.5 h-3.5" />
                                                    Laporan Dikoreksi — {dayjs(shift.amendedAt).format('DD MMM YYYY, HH:mm')}
                                                </div>
                                                {shift.amendNote && (
                                                    <p className="text-sm text-amber-800 dark:text-amber-300">{shift.amendNote}</p>
                                                )}
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

            {/* Modal Koreksi Laporan — Full Screen */}
            {amendId !== null && amendShift && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm overflow-y-auto">
                    <div className="min-h-full flex items-start justify-center p-4 py-8">
                        <div className="w-full max-w-2xl bg-background rounded-2xl border border-border shadow-2xl flex flex-col">
                            {/* Header */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                                <div>
                                    <h2 className="font-semibold text-foreground">Koreksi Laporan Shift</h2>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        {amendShift.shiftName} — {amendShift.adminName} — {dayjs(amendShift.closedAt).format('DD MMM YYYY, HH:mm')}
                                    </p>
                                </div>
                                <button
                                    onClick={() => { setAmendId(null); setAmendShift(null); setAmendState(emptyAmendState()); }}
                                    className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Body */}
                            <div className="flex-1 px-6 py-5 space-y-6 overflow-y-auto">
                                {/* Warning */}
                                <div className="flex gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3">
                                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                    <p className="text-xs text-amber-700 dark:text-amber-300">
                                        Koreksi ini mengubah data laporan shift. Data transaksi sistem tidak berubah. Wajib isi alasan koreksi.
                                    </p>
                                </div>

                                {/* Context info */}
                                <div className="grid grid-cols-3 gap-3 text-xs">
                                    {[
                                        { label: 'Ekspektasi Tunai', val: Number(amendShift.expectedCash || 0) },
                                        { label: 'Ekspektasi QRIS', val: Number(amendShift.expectedQris || 0) },
                                        { label: 'Ekspektasi Transfer', val: Number(amendShift.expectedTransfer || 0) },
                                    ].map(({ label, val }) => (
                                        <div key={label} className="bg-muted/50 rounded-lg p-2 text-center">
                                            <p className="text-muted-foreground">{label}</p>
                                            <p className="font-semibold text-foreground mt-0.5">Rp {val.toLocaleString('id-ID')}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* === SECTION: Saldo Aktual === */}
                                <section>
                                    <h3 className="text-sm font-semibold text-foreground mb-3 pb-1.5 border-b border-border">Saldo Aktual</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        {[
                                            { key: 'actualCash', label: 'Kas Tunai (Rp)' },
                                            { key: 'actualQris', label: 'QRIS (Rp)' },
                                            { key: 'actualTransfer', label: 'Transfer (Rp)' },
                                        ].map(({ key, label }) => (
                                            <div key={key}>
                                                <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
                                                <input
                                                    type="number" min={0}
                                                    value={amendState[key as keyof AmendState] as string}
                                                    onChange={e => setAmendState(s => ({ ...s, [key]: e.target.value }))}
                                                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                {/* Panduan skenario */}
                                <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 px-4 py-3 space-y-2">
                                    <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">Panduan Koreksi</p>
                                    <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1.5">
                                        <p><span className="font-medium">Tambah keterangan pengeluaran, saldo tetap:</span> Naikkan nilai <em>Kas Tunai</em> sebesar jumlah pengeluaran yang ditambahkan. Contoh: tambah pengeluaran ATK Rp 50.000 → naikkan Kas Tunai +50.000.</p>
                                        <p><span className="font-medium">Ubah saldo saja, keterangan tetap:</span> Cukup ubah nilai <em>Kas Tunai / QRIS</em>, biarkan bagian lain tidak berubah.</p>
                                    </div>
                                </div>

                                {/* === SECTION: Saldo Bank === */}
                                {Object.keys(amendState.actualBankBalances).length > 0 && (
                                    <section>
                                        <h3 className="text-sm font-semibold text-foreground mb-3 pb-1.5 border-b border-border">Saldo Bank</h3>
                                        <div className="space-y-3">
                                            {Object.keys(amendState.actualBankBalances).map(bank => (
                                                <div key={bank} className="grid grid-cols-3 gap-3 items-end">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-sm font-medium text-foreground">{bank}</span>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs text-muted-foreground mb-1">Saldo Laporan mBanking</label>
                                                        <input
                                                            type="number" min={0}
                                                            value={amendState.actualBankBalances[bank] || '0'}
                                                            onChange={e => setAmendState(s => ({ ...s, actualBankBalances: { ...s.actualBankBalances, [bank]: e.target.value } }))}
                                                            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs text-muted-foreground mb-1">Saldo Real di Bank</label>
                                                        <input
                                                            type="number" min={0}
                                                            value={amendState.realBankBalances[bank] || '0'}
                                                            onChange={e => setAmendState(s => ({ ...s, realBankBalances: { ...s.realBankBalances, [bank]: e.target.value } }))}
                                                            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                )}

                                {/* === SECTION: Tukar Transfer ke Cash === */}
                                <section>
                                    <h3 className="text-sm font-semibold text-foreground mb-3 pb-1.5 border-b border-border">Tukar Transfer ke Cash</h3>
                                    <div className="max-w-xs">
                                        <label className="block text-xs text-muted-foreground mb-1">Nominal (Rp)</label>
                                        <input
                                            type="number" min={0}
                                            value={amendState.tukarTransferKeCash}
                                            onChange={e => setAmendState(s => ({ ...s, tukarTransferKeCash: e.target.value }))}
                                            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                        />
                                    </div>
                                </section>

                                {/* === SECTION: Pengeluaran Terstruktur === */}
                                {Object.keys(amendState.structuredExpenses).length > 0 && (
                                    <section>
                                        <h3 className="text-sm font-semibold text-foreground mb-3 pb-1.5 border-b border-border">Pengeluaran</h3>
                                        <div className="space-y-4">
                                            {Object.entries(amendState.structuredExpenses).map(([method, items]) => (
                                                <div key={method}>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{method}</p>
                                                        <button
                                                            onClick={() => addExpense(method)}
                                                            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                                                        >
                                                            <Plus className="w-3.5 h-3.5" /> Tambah
                                                        </button>
                                                    </div>
                                                    {items.length === 0 ? (
                                                        <p className="text-xs text-muted-foreground italic px-1">Tidak ada pengeluaran.</p>
                                                    ) : (
                                                        <div className="space-y-2">
                                                            {items.map((item, idx) => (
                                                                <div key={idx} className="flex gap-2 items-center">
                                                                    <input
                                                                        placeholder="Keterangan"
                                                                        value={item.name}
                                                                        onChange={e => updateExpense(method, idx, 'name', e.target.value)}
                                                                        className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                                                    />
                                                                    <input
                                                                        type="number" min={0} placeholder="0"
                                                                        value={item.amount}
                                                                        onChange={e => updateExpense(method, idx, 'amount', e.target.value)}
                                                                        className="w-32 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                                                    />
                                                                    <button onClick={() => removeExpense(method, idx)} className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors">
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                )}

                                {/* === SECTION: Kasbon === */}
                                <section>
                                    <div className="flex items-center justify-between mb-3 pb-1.5 border-b border-border">
                                        <h3 className="text-sm font-semibold text-foreground">Kasbon</h3>
                                        <button onClick={addKasbon} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
                                            <Plus className="w-3.5 h-3.5" /> Tambah
                                        </button>
                                    </div>
                                    {amendState.kasbon.length === 0 ? (
                                        <p className="text-xs text-muted-foreground italic">Tidak ada kasbon.</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {amendState.kasbon.map((item, i) => (
                                                <div key={i} className="flex gap-2 items-center">
                                                    <input placeholder="Nama" value={item.name} onChange={e => updateKasbon(i, 'name', e.target.value)}
                                                        className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                                                    <input type="number" min={0} placeholder="0" value={item.amount} onChange={e => updateKasbon(i, 'amount', e.target.value)}
                                                        className="w-32 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                                                    <select value={item.source} onChange={e => updateKasbon(i, 'source', e.target.value)}
                                                        className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                                                        <option value="CASH">CASH</option>
                                                        <option value="QRIS">QRIS</option>
                                                        <option value="TRANSFER">TRANSFER</option>
                                                    </select>
                                                    <button onClick={() => removeKasbon(i)} className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </section>

                                {/* === SECTION: Setor Kas === */}
                                <section>
                                    <div className="flex items-center justify-between mb-3 pb-1.5 border-b border-border">
                                        <h3 className="text-sm font-semibold text-foreground">Setor Kas ke Bank</h3>
                                        <button onClick={addSetorKas} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
                                            <Plus className="w-3.5 h-3.5" /> Tambah
                                        </button>
                                    </div>
                                    {amendState.setorKas.length === 0 ? (
                                        <p className="text-xs text-muted-foreground italic">Tidak ada setor kas.</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {amendState.setorKas.map((item, i) => (
                                                <div key={i} className="flex gap-2 items-center">
                                                    <input placeholder="Nama Bank" value={item.bankName} onChange={e => updateSetorKas(i, 'bankName', e.target.value)}
                                                        className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                                                    <input type="number" min={0} placeholder="0" value={item.amount} onChange={e => updateSetorKas(i, 'amount', e.target.value)}
                                                        className="w-36 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                                                    <button onClick={() => removeSetorKas(i)} className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </section>

                                {/* === SECTION: Tarik Tunai === */}
                                <section>
                                    <div className="flex items-center justify-between mb-3 pb-1.5 border-b border-border">
                                        <h3 className="text-sm font-semibold text-foreground">Tarik Tunai dari Bank</h3>
                                        <button onClick={addTarikTunai} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
                                            <Plus className="w-3.5 h-3.5" /> Tambah
                                        </button>
                                    </div>
                                    {amendState.tarikTunai.length === 0 ? (
                                        <p className="text-xs text-muted-foreground italic">Tidak ada tarik tunai.</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {amendState.tarikTunai.map((item, i) => (
                                                <div key={i} className="flex gap-2 items-center">
                                                    <input placeholder="Nama Bank" value={item.bankName} onChange={e => updateTarikTunai(i, 'bankName', e.target.value)}
                                                        className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                                                    <input type="number" min={0} placeholder="0" value={item.amount} onChange={e => updateTarikTunai(i, 'amount', e.target.value)}
                                                        className="w-36 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                                                    <button onClick={() => removeTarikTunai(i)} className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </section>

                                {/* === SECTION: Pendapatan Tambahan === */}
                                <section>
                                    <div className="flex items-center justify-between mb-3 pb-1.5 border-b border-border">
                                        <h3 className="text-sm font-semibold text-foreground">Pendapatan Tambahan</h3>
                                        <button onClick={addAdditionalIncome} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
                                            <Plus className="w-3.5 h-3.5" /> Tambah
                                        </button>
                                    </div>
                                    {amendState.additionalIncomes.length === 0 ? (
                                        <p className="text-xs text-muted-foreground italic">Tidak ada pendapatan tambahan.</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {amendState.additionalIncomes.map((item, i) => (
                                                <div key={i} className="flex gap-2 items-center flex-wrap sm:flex-nowrap">
                                                    <input placeholder="Bank/Sumber" value={item.bankName} onChange={e => updateAdditionalIncome(i, 'bankName', e.target.value)}
                                                        className="flex-1 min-w-[120px] px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                                                    <input type="number" min={0} placeholder="0" value={item.amount} onChange={e => updateAdditionalIncome(i, 'amount', e.target.value)}
                                                        className="w-32 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                                                    <input placeholder="Keterangan" value={item.description} onChange={e => updateAdditionalIncome(i, 'description', e.target.value)}
                                                        className="flex-1 min-w-[120px] px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                                                    <button onClick={() => removeAdditionalIncome(i)} className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </section>

                                {/* === SECTION: Pertukaran Metode === */}
                                <section>
                                    <div className="flex items-center justify-between mb-3 pb-1.5 border-b border-border">
                                        <h3 className="text-sm font-semibold text-foreground">Pertukaran Metode Pembayaran</h3>
                                        <button onClick={addPaymentExchange} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
                                            <Plus className="w-3.5 h-3.5" /> Tambah
                                        </button>
                                    </div>
                                    {amendState.paymentExchanges.length === 0 ? (
                                        <p className="text-xs text-muted-foreground italic">Tidak ada pertukaran metode.</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {amendState.paymentExchanges.map((item, i) => (
                                                <div key={i} className="flex gap-2 items-center flex-wrap sm:flex-nowrap">
                                                    <input placeholder="Dari" value={item.from} onChange={e => updatePaymentExchange(i, 'from', e.target.value)}
                                                        className="w-24 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                                                    <span className="text-muted-foreground text-sm shrink-0">→</span>
                                                    <input placeholder="Ke" value={item.to} onChange={e => updatePaymentExchange(i, 'to', e.target.value)}
                                                        className="w-24 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                                                    <input type="number" min={0} placeholder="0" value={item.amount} onChange={e => updatePaymentExchange(i, 'amount', e.target.value)}
                                                        className="w-32 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                                                    <input placeholder="Keterangan" value={item.description} onChange={e => updatePaymentExchange(i, 'description', e.target.value)}
                                                        className="flex-1 min-w-[100px] px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                                                    <button onClick={() => removePaymentExchange(i)} className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </section>

                                {/* === SECTION: Catatan === */}
                                <section>
                                    <h3 className="text-sm font-semibold text-foreground mb-3 pb-1.5 border-b border-border">Catatan</h3>
                                    <textarea
                                        rows={2}
                                        value={amendState.notes}
                                        onChange={e => setAmendState(s => ({ ...s, notes: e.target.value }))}
                                        placeholder="Catatan tambahan untuk laporan ini..."
                                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                                    />
                                </section>

                                {/* === SECTION: Alasan Koreksi (WAJIB) === */}
                                <section>
                                    <h3 className="text-sm font-semibold text-foreground mb-3 pb-1.5 border-b border-border">
                                        Alasan Koreksi <span className="text-destructive">*</span>
                                    </h3>
                                    <textarea
                                        rows={3}
                                        value={amendState.amendNote}
                                        onChange={e => setAmendState(s => ({ ...s, amendNote: e.target.value }))}
                                        placeholder="Tuliskan alasan mengapa laporan ini dikoreksi, mis: salah hitung tunai, lupa mencatat pengeluaran..."
                                        className={`w-full px-3 py-2 rounded-lg border bg-background text-foreground text-sm focus:outline-none focus:ring-2 resize-none transition-colors ${amendState.amendNote.trim() ? 'border-border focus:ring-primary/50' : 'border-destructive/50 focus:ring-destructive/30'}`}
                                    />
                                    {!amendState.amendNote.trim() && (
                                        <p className="text-xs text-destructive mt-1">Wajib diisi sebelum menyimpan koreksi.</p>
                                    )}
                                </section>
                            </div>

                            {/* Footer */}
                            <div className="flex gap-3 px-6 py-4 border-t border-border">
                                <button
                                    onClick={() => { setAmendId(null); setAmendShift(null); setAmendState(emptyAmendState()); }}
                                    className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-background hover:bg-muted text-sm font-medium text-foreground transition-colors"
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={handleAmendSubmit}
                                    disabled={amendMutation.isPending || !amendState.amendNote.trim()}
                                    className="flex-1 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
                                >
                                    {amendMutation.isPending ? 'Menyimpan...' : 'Simpan Koreksi'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            </div>
        </div>
    );
}
