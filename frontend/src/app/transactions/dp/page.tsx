"use client";

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTransactions, payOffTransaction, addDPTransaction, getSettings, getBankAccounts, getUsers } from '@/lib/api';
import { mapTransactionToReceipt, handleShareWA } from '@/lib/receipt';
import { useReceiptPrinter } from '@/lib/useReceiptPrinter';
import { CreditCard, Banknote, Landmark, Wallet, CheckCircle2, X, Printer, MessageCircle, PenSquare, Search, PlusCircle } from "lucide-react";
import dayjs from "dayjs";
import Link from 'next/link';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import EditTransactionModal from '@/app/reports/sales/EditTransactionModal';

export default function DPTransactionsPage() {
    const queryClient = useQueryClient();
    const { data: transactions, isLoading } = useQuery({ queryKey: ['transactions'], queryFn: () => getTransactions() });
    const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: getSettings });
    const { data: bankAccounts } = useQuery({ queryKey: ['bank-accounts'], queryFn: getBankAccounts });
    const { data: users } = useQuery({ queryKey: ['users'], queryFn: getUsers });
    const { isManager } = useCurrentUser();
    const { printReceipt, thermalModal } = useReceiptPrinter(settings, bankAccounts);

    const [selectedTrx, setSelectedTrx] = useState<any | null>(null);
    const [payMode, setPayMode] = useState<'PARTIAL' | 'FULL'>('FULL');  // PARTIAL=tambah DP, FULL=lunas
    const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'QRIS' | 'BANK_TRANSFER'>('CASH');
    const [payoffBankId, setPayoffBankId] = useState<string>('');
    const [nominalBayar, setNominalBayar] = useState<string>('');
    const [checkoutCashierName, setCheckoutCashierName] = useState<string>('');
    const [checkoutPaidAt, setCheckoutPaidAt] = useState<string>('');
    const [feeItemsPayoff, setFeeItemsPayoff] = useState<{ name: string; amount: string }[]>([]);
    const [editTrx, setEditTrx] = useState<any | null>(null);

    const [activeTab, setActiveTab] = useState<'Semua' | 'DP' | 'Kredit' | 'Bayar Nanti'>('Semua');
    const [search, setSearch] = useState('');

    const allUnpaid = transactions?.filter((t: any) => t.status === 'PARTIAL' || t.status === 'PENDING') || [];
    const bayarNantiList = allUnpaid.filter((t: any) => t.status === 'PENDING');
    const dpTransactions = allUnpaid.filter((t: any) => t.status === 'PARTIAL');
    const kreditList = dpTransactions.filter((t: any) => Number(t.downPayment) === 0);
    const dpList = dpTransactions.filter((t: any) => Number(t.downPayment) > 0);
    const byTab = activeTab === 'DP' ? dpList
        : activeTab === 'Kredit' ? kreditList
        : activeTab === 'Bayar Nanti' ? bayarNantiList
        : allUnpaid;
    const q = search.trim().toLowerCase();
    const visibleTransactions = q
        ? byTab.filter((t: any) =>
            (t.customerName || '').toLowerCase().includes(q) ||
            (t.invoiceNumber || '').toLowerCase().includes(q)
          )
        : byTab;

    const resetModal = () => {
        setSelectedTrx(null);
        setPayMode('FULL');
        setNominalBayar('');
        setPaymentMethod('CASH');
        setPayoffBankId('');
        setCheckoutCashierName('');
        setCheckoutPaidAt('');
        setFeeItemsPayoff([]);
    };

    const feeItemsPayoffNum = feeItemsPayoff.reduce((s, f) => s + (Number(f.amount) || 0), 0);

    const payOffMutation = useMutation({
        mutationFn: (id: number) => {
            const validFeeItems = feeItemsPayoff.filter(f => Number(f.amount) > 0).map(f => ({ name: f.name || 'Potongan', amount: Number(f.amount) }));
            return payOffTransaction(id, {
                paymentMethod,
                bankAccountId: payoffBankId ? Number(payoffBankId) : undefined,
                checkoutCashierName: checkoutCashierName.trim() || undefined,
                paidAt: checkoutPaidAt || undefined,
                marketplaceFeeItems: validFeeItems.length > 0 ? validFeeItems : undefined,
            });
        },
        onSuccess: (data: any) => {
            queryClient.invalidateQueries({ queryKey: ['transactions'] });
            // Cetak nota pelunasan (LUNAS) ikut Format Nota Default. `data` (hasil
            // pelunasan server) tak berisi items → gabung dgn selectedTrx yg punya items.
            const paidTrx = selectedTrx ? { ...selectedTrx, ...data } : data;
            resetModal();
            printReceipt(mapTransactionToReceipt(paidTrx, settings), 'LUNAS');
        }
    });

    const addDPMutation = useMutation({
        mutationFn: ({ id, amount }: { id: number; amount: number }) => addDPTransaction(id, {
            amount,
            paymentMethod,
            bankAccountId: payoffBankId ? Number(payoffBankId) : undefined,
        }),
        onSuccess: (data: any) => {
            queryClient.invalidateQueries({ queryKey: ['transactions'] });
            // Kalau penambahan DP membuat transaksi jadi LUNAS, cetak nota pelunasan.
            const updatedTrx = selectedTrx ? { ...selectedTrx, ...data } : data;
            const becamePaid = data?.status === 'PAID';
            resetModal();
            if (becamePaid) printReceipt(mapTransactionToReceipt(updatedTrx, settings), 'LUNAS');
        }
    });

    const handlePayOff = (e: React.FormEvent) => {
        e.preventDefault();
        if (paymentMethod === 'BANK_TRANSFER' && !payoffBankId) {
            alert('Silakan pilih Rekening Bank tujuan transfer!');
            return;
        }
        if (!selectedTrx) return;
        if (payMode === 'PARTIAL') {
            const amount = Number(nominalBayar);
            const remaining = selectedTrx.status === 'PENDING'
                ? Number(selectedTrx.grandTotal)
                : Number(selectedTrx.grandTotal) - Number(selectedTrx.downPayment);
            if (!amount || amount <= 0) { alert('Nominal harus lebih dari 0!'); return; }
            if (amount > remaining) { alert(`Nominal melebihi sisa tagihan (Rp ${remaining.toLocaleString('id-ID')})!`); return; }
            addDPMutation.mutate({ id: selectedTrx.id, amount });
        } else {
            payOffMutation.mutate(selectedTrx.id);
        }
    };

    const openModal = (trx: any) => {
        setSelectedTrx(trx);
        setPayMode('FULL');
        setNominalBayar('');
        setPaymentMethod('CASH');
        setPayoffBankId('');
        setCheckoutCashierName('');
        setCheckoutPaidAt('');
        setFeeItemsPayoff([]);
    };

    if (isLoading) {
        return <div className="flex h-screen items-center justify-center text-muted-foreground">Memuat Daftar Piutang...</div>;
    }

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div className="sm:flex sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Daftar DP / Piutang</h1>
                    <p className="mt-1 text-sm text-muted-foreground">Kumpulan transaksi dengan pembayaran sebagian atau kredit.</p>
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2 flex-wrap">
                {(['Semua', 'DP', 'Kredit', 'Bayar Nanti'] as const).map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                        className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-all ${
                            activeTab === tab
                                ? tab === 'Kredit' ? 'bg-violet-600 text-white border-violet-600'
                                : tab === 'Bayar Nanti' ? 'bg-sky-600 text-white border-sky-600'
                                : 'bg-primary text-primary-foreground border-primary'
                                : 'bg-background border-border text-muted-foreground hover:border-primary/40'
                        }`}>
                        {tab}
                        <span className="ml-1.5 text-[11px] font-bold opacity-70">
                            {tab === 'Semua' ? allUnpaid.length
                                : tab === 'DP' ? dpList.length
                                : tab === 'Kredit' ? kreditList.length
                                : bayarNantiList.length}
                        </span>
                    </button>
                ))}
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Cari nama pelanggan atau nomor invoice..."
                    className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none"
                />
                {search && (
                    <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="glass p-6 rounded-xl border border-orange-500/20 bg-orange-500/5 flex flex-col justify-center">
                    <p className="text-sm font-medium text-orange-700 mb-1">Total Tagihan Belum Lunas</p>
                    <h2 className="text-3xl font-bold text-orange-600">
                        Rp {visibleTransactions.reduce((acc: number, t: any) => acc + (t.status === 'PENDING' ? Number(t.grandTotal) : Number(t.grandTotal) - Number(t.downPayment)), 0).toLocaleString('id-ID')}
                    </h2>
                </div>
                <div className="glass p-6 rounded-xl border border-border flex flex-col justify-center">
                    <p className="text-sm font-medium text-muted-foreground mb-1">
                        {activeTab === 'Kredit' ? 'Nota Kredit Aktif' : activeTab === 'DP' ? 'Nota DP Aktif' : 'Total Nota Aktif'}
                    </p>
                    <h2 className="text-3xl font-bold text-foreground">{visibleTransactions.length} <span className="text-lg text-muted-foreground font-normal ml-1">Nota</span></h2>
                </div>
            </div>

            {/* Table */}
            <div className="glass rounded-xl border border-border overflow-hidden">
                <div className="hidden lg:block overflow-x-auto">
                    <table className="min-w-full divide-y divide-border">
                        <thead className="bg-muted/50">
                            <tr>
                                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Pelanggan & Invoice</th>
                                <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase">Total Belanja</th>
                                <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase">DP Masuk</th>
                                <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase">Sisa Tagihan</th>
                                <th scope="col" className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {visibleTransactions.map((trx: any) => {
                                const grandTotal = Number(trx.grandTotal);
                                const dp = Number(trx.downPayment);
                                const isPending = trx.status === 'PENDING';
                                const balance = isPending ? grandTotal : grandTotal - dp;
                                const isKredit = !isPending && dp === 0;
                                const isOverdue = trx.dueDate && dayjs(trx.dueDate).isBefore(dayjs(), 'day');
                                return (
                                    <tr key={trx.id} className="hover:bg-muted/30 transition-colors">
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <p className="font-semibold text-foreground">{trx.customerName || 'Pelanggan Umum'}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-sm text-primary font-mono">{trx.invoiceNumber}</span>
                                                <span className="text-xs text-muted-foreground">• {dayjs(trx.createdAt).format('DD MMM YYYY')}</span>
                                                {isPending
                                                    ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-sky-500/10 text-sky-600 border border-sky-500/20">BAYAR NANTI</span>
                                                    : isKredit
                                                    ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-600 border border-violet-500/20">KREDIT</span>
                                                    : <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20">DP</span>
                                                }
                                            </div>
                                            {trx.dueDate && (
                                                <p className={`text-[11px] mt-0.5 font-medium ${isOverdue ? 'text-red-500' : 'text-muted-foreground'}`}>
                                                    {isOverdue ? '⚠ Lewat jatuh tempo: ' : 'Jatuh tempo: '}
                                                    {dayjs(trx.dueDate).format('DD MMM YYYY')}
                                                </p>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-foreground text-right border-l border-border/50">
                                            Rp {grandTotal.toLocaleString('id-ID')}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-right">
                                            {isPending
                                                ? <span className="text-sky-500 font-semibold text-xs">Belum Bayar</span>
                                                : <span className="text-emerald-600">Rp {dp.toLocaleString('id-ID')}</span>
                                            }
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-orange-600 text-right bg-orange-500/5">
                                            Rp {balance.toLocaleString('id-ID')}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <div className="flex items-center justify-center gap-1.5">
                                                <button
                                                    onClick={() => printReceipt(mapTransactionToReceipt(trx, settings), 'TAGIHAN')}
                                                    title="Cetak Struk DP"
                                                    className="p-1.5 bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary rounded-lg transition-colors outline-none"
                                                >
                                                    <Printer className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleShareWA(mapTransactionToReceipt(trx, settings), 'TAGIHAN', bankAccounts)}
                                                    title="Kirim Struk WA"
                                                    className="p-1.5 bg-muted text-muted-foreground hover:bg-[#25D366]/10 hover:text-[#25D366] rounded-lg transition-colors outline-none"
                                                >
                                                    <MessageCircle className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => setEditTrx(trx)}
                                                    title={isManager ? 'Edit Transaksi' : 'Ajukan Perubahan'}
                                                    className="p-1.5 bg-muted text-muted-foreground hover:bg-amber-500/10 hover:text-amber-600 rounded-lg transition-colors outline-none"
                                                >
                                                    <PenSquare className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => openModal(trx)}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg text-sm font-medium transition-colors"
                                                >
                                                    <Wallet className="w-4 h-4" /> Bayar
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {visibleTransactions.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center">
                                        <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3 opacity-20" />
                                        <p className="text-base font-medium text-foreground">Tidak ada piutang aktif</p>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            {q ? `Tidak ada hasil untuk "${search}".`
                                                : activeTab === 'Kredit' ? 'Belum ada nota kredit.'
                                                : activeTab === 'DP' ? 'Belum ada DP aktif.'
                                                : activeTab === 'Bayar Nanti' ? 'Belum ada invoice bayar nanti.'
                                                : 'Semua transaksi sudah lunas.'}
                                        </p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Mobile: daftar kartu (tabel disembunyikan di < md) */}
                <div className="lg:hidden divide-y divide-border">
                    {visibleTransactions.map((trx: any) => {
                        const grandTotal = Number(trx.grandTotal);
                        const dp = Number(trx.downPayment);
                        const isPending = trx.status === 'PENDING';
                        const balance = isPending ? grandTotal : grandTotal - dp;
                        const isKredit = !isPending && dp === 0;
                        const isOverdue = trx.dueDate && dayjs(trx.dueDate).isBefore(dayjs(), 'day');
                        return (
                            <div key={trx.id} className="p-4 space-y-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="font-semibold text-foreground truncate">{trx.customerName || 'Pelanggan Umum'}</p>
                                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                            <span className="text-xs text-primary font-mono">{trx.invoiceNumber}</span>
                                            {isPending
                                                ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-sky-500/10 text-sky-600 border border-sky-500/20">BAYAR NANTI</span>
                                                : isKredit
                                                ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-600 border border-violet-500/20">KREDIT</span>
                                                : <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20">DP</span>}
                                        </div>
                                        {trx.dueDate && (
                                            <p className={`text-[11px] mt-0.5 font-medium ${isOverdue ? 'text-red-500' : 'text-muted-foreground'}`}>
                                                {isOverdue ? '⚠ Lewat jatuh tempo: ' : 'Jatuh tempo: '}{dayjs(trx.dueDate).format('DD MMM YYYY')}
                                            </p>
                                        )}
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-[11px] text-muted-foreground">Sisa Tagihan</p>
                                        <p className="text-base font-bold text-orange-600">Rp {balance.toLocaleString('id-ID')}</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className="rounded-lg bg-muted/40 px-2.5 py-1.5">
                                        <span className="text-muted-foreground">Total Belanja</span>
                                        <div className="font-semibold text-foreground">Rp {grandTotal.toLocaleString('id-ID')}</div>
                                    </div>
                                    <div className="rounded-lg bg-muted/40 px-2.5 py-1.5">
                                        <span className="text-muted-foreground">DP Masuk</span>
                                        <div className={`font-semibold ${isPending ? 'text-sky-500' : 'text-emerald-600'}`}>{isPending ? 'Belum Bayar' : `Rp ${dp.toLocaleString('id-ID')}`}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => openModal(trx)} className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg text-sm font-semibold transition-colors">
                                        <Wallet className="w-4 h-4" /> Bayar
                                    </button>
                                    <button onClick={() => printReceipt(mapTransactionToReceipt(trx, settings), 'TAGIHAN')} title="Cetak" className="h-9 w-9 inline-flex items-center justify-center bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary rounded-lg transition-colors">
                                        <Printer className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => handleShareWA(mapTransactionToReceipt(trx, settings), 'TAGIHAN', bankAccounts)} title="Kirim WA" className="h-9 w-9 inline-flex items-center justify-center bg-muted text-muted-foreground hover:bg-[#25D366]/10 hover:text-[#25D366] rounded-lg transition-colors">
                                        <MessageCircle className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => setEditTrx(trx)} title={isManager ? 'Edit' : 'Ajukan Perubahan'} className="h-9 w-9 inline-flex items-center justify-center bg-muted text-muted-foreground hover:bg-amber-500/10 hover:text-amber-600 rounded-lg transition-colors">
                                        <PenSquare className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                    {visibleTransactions.length === 0 && (
                        <div className="px-6 py-12 text-center">
                            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3 opacity-20" />
                            <p className="text-base font-medium text-foreground">Tidak ada piutang aktif</p>
                            <p className="text-sm text-muted-foreground mt-1">
                                {q ? `Tidak ada hasil untuk "${search}".`
                                    : activeTab === 'Kredit' ? 'Belum ada nota kredit.'
                                    : activeTab === 'DP' ? 'Belum ada DP aktif.'
                                    : activeTab === 'Bayar Nanti' ? 'Belum ada invoice bayar nanti.'
                                    : 'Semua transaksi sudah lunas.'}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Edit Modal */}
            {editTrx && (
                <EditTransactionModal
                    transaction={editTrx}
                    isManager={isManager}
                    onClose={() => setEditTrx(null)}
                    onSuccess={() => {
                        setEditTrx(null);
                        queryClient.invalidateQueries({ queryKey: ['transactions'] });
                    }}
                    onDeleted={() => {
                        setEditTrx(null);
                        queryClient.invalidateQueries({ queryKey: ['transactions'] });
                    }}
                />
            )}

            {/* PayOff Modal */}
            {selectedTrx && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/25 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="glass-strong w-full max-w-md rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[92vh]">
                        <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-muted/30 shrink-0">
                            <div>
                                <h3 className="font-semibold text-foreground">Pembayaran Tagihan</h3>
                                <p className="text-xs text-muted-foreground">{selectedTrx.customerName || selectedTrx.invoiceNumber} · {selectedTrx.invoiceNumber}</p>
                            </div>
                            <button onClick={resetModal} className="p-1.5 text-muted-foreground hover:bg-muted rounded-lg transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handlePayOff} className="p-6 space-y-5 overflow-y-auto">
                            {/* Info sisa tagihan */}
                            {(() => {
                                const sisaTagihan = selectedTrx.status === 'PENDING'
                                    ? Number(selectedTrx.grandTotal)
                                    : Number(selectedTrx.grandTotal) - Number(selectedTrx.downPayment);
                                return (
                                    <div className="text-center space-y-1 pb-2 border-b border-dashed border-border">
                                        <p className="text-xs text-muted-foreground">Sisa tagihan {selectedTrx.customerName || selectedTrx.invoiceNumber}</p>
                                        <p className="text-3xl font-bold text-orange-600">Rp {sisaTagihan.toLocaleString('id-ID')}</p>
                                        {selectedTrx.status === 'PARTIAL' && Number(selectedTrx.downPayment) > 0 && (
                                            <p className="text-xs text-muted-foreground">
                                                Total Rp {Number(selectedTrx.grandTotal).toLocaleString('id-ID')} · DP masuk Rp {Number(selectedTrx.downPayment).toLocaleString('id-ID')}
                                            </p>
                                        )}
                                    </div>
                                );
                            })()}

                            {/* Toggle mode bayar */}
                            <div className="grid grid-cols-2 gap-2">
                                <button type="button" onClick={() => { setPayMode('PARTIAL'); setNominalBayar(''); }}
                                    className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-bold transition-all ${payMode === 'PARTIAL' ? 'border-amber-500 bg-amber-500/10 text-amber-700' : 'border-border bg-muted/30 text-muted-foreground hover:border-amber-400/50'}`}>
                                    <PlusCircle className="w-4 h-4" />
                                    Tambah DP
                                </button>
                                <button type="button" onClick={() => { setPayMode('FULL'); setNominalBayar(''); }}
                                    className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-bold transition-all ${payMode === 'FULL' ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700' : 'border-border bg-muted/30 text-muted-foreground hover:border-emerald-400/50'}`}>
                                    <CheckCircle2 className="w-4 h-4" />
                                    Lunas Penuh
                                </button>
                            </div>

                            {/* Nominal — hanya untuk mode PARTIAL */}
                            {payMode === 'PARTIAL' && (() => {
                                const sisaTagihan = selectedTrx.status === 'PENDING'
                                    ? Number(selectedTrx.grandTotal)
                                    : Number(selectedTrx.grandTotal) - Number(selectedTrx.downPayment);
                                const nominalNum = Number(nominalBayar);
                                const sisaSetelah = sisaTagihan - nominalNum;
                                return (
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-foreground">Nominal DP yang Dibayar</label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm">Rp</span>
                                            <input
                                                type="number"
                                                value={nominalBayar}
                                                onChange={e => setNominalBayar(e.target.value)}
                                                placeholder="Masukkan nominal DP..."
                                                min="1"
                                                max={sisaTagihan}
                                                className="w-full pl-12 pr-4 py-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-amber-400 outline-none font-bold text-lg"
                                                required={payMode === 'PARTIAL'}
                                                autoFocus
                                            />
                                        </div>
                                        {nominalBayar !== '' && nominalNum > 0 && (
                                            nominalNum >= sisaTagihan ? (
                                                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs text-emerald-700 font-semibold text-center">
                                                    Nominal mencukupi — transaksi akan otomatis <strong>LUNAS</strong>
                                                </div>
                                            ) : (
                                                <div className="flex justify-between items-center p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-700 font-semibold">
                                                    <span>Sisa setelah DP ini:</span>
                                                    <span>Rp {sisaSetelah.toLocaleString('id-ID')}</span>
                                                </div>
                                            )
                                        )}
                                        {nominalBayar !== '' && nominalNum > sisaTagihan && (
                                            <p className="text-xs text-red-500 font-medium">Nominal melebihi sisa tagihan!</p>
                                        )}
                                    </div>
                                );
                            })()}

                            {/* Nominal untuk mode FULL — konfirmasi kembalian */}
                            {payMode === 'FULL' && (() => {
                                const sisaTagihan = selectedTrx.status === 'PENDING'
                                    ? Number(selectedTrx.grandTotal)
                                    : Number(selectedTrx.grandTotal) - Number(selectedTrx.downPayment);
                                const kembalian = Number(nominalBayar) - sisaTagihan;
                                // Fee efektif: dari input baru (prioritas) atau tersimpan di transaksi
                                const effectiveFee = feeItemsPayoffNum > 0 ? feeItemsPayoffNum : (Number(selectedTrx.marketplaceFee) || 0);
                                const displayFeeItems: { name: string; amount: number }[] = feeItemsPayoffNum > 0
                                    ? feeItemsPayoff.filter(f => Number(f.amount) > 0).map(f => ({ name: f.name || 'Potongan', amount: Number(f.amount) }))
                                    : Array.isArray(selectedTrx.marketplaceFeeItems) ? selectedTrx.marketplaceFeeItems : [];
                                return (
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-foreground">Nominal Diterima (Opsional)</label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm">Rp</span>
                                            <input
                                                type="number"
                                                value={nominalBayar}
                                                onChange={e => setNominalBayar(e.target.value)}
                                                placeholder={sisaTagihan.toString()}
                                                className="w-full pl-12 pr-4 py-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary outline-none font-bold text-lg"
                                            />
                                        </div>
                                        {kembalian > 0 && (
                                            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex justify-between items-center text-emerald-700 text-sm">
                                                <span>Uang Kembalian:</span>
                                                <span className="font-bold">Rp {kembalian.toLocaleString('id-ID')}</span>
                                            </div>
                                        )}
                                        {/* Input potongan marketplace saat pelunasan */}
                                        <div className="space-y-1.5 pt-1 border-t border-dashed border-border">
                                            <div className="flex items-center justify-between">
                                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Potongan Platform / Fee</label>
                                                <button
                                                    type="button"
                                                    onClick={() => setFeeItemsPayoff(prev => [...prev, { name: '', amount: '' }])}
                                                    className="text-xs text-primary hover:underline font-medium"
                                                >
                                                    + Tambah
                                                </button>
                                            </div>
                                            {feeItemsPayoff.map((fi, idx) => (
                                                <div key={idx} className="flex gap-1.5">
                                                    <input
                                                        type="text"
                                                        value={fi.name}
                                                        onChange={e => setFeeItemsPayoff(prev => prev.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))}
                                                        placeholder="Nama (cth: Shopee)"
                                                        className="flex-1 px-2.5 py-1.5 bg-background border border-border rounded-lg text-xs focus:ring-1 focus:ring-primary outline-none"
                                                    />
                                                    <div className="relative w-28">
                                                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">Rp</span>
                                                        <input
                                                            type="number"
                                                            value={fi.amount}
                                                            onChange={e => setFeeItemsPayoff(prev => prev.map((x, i) => i === idx ? { ...x, amount: e.target.value } : x))}
                                                            placeholder="0"
                                                            className="w-full pl-7 pr-2 py-1.5 bg-background border border-border rounded-lg text-xs focus:ring-1 focus:ring-primary outline-none"
                                                        />
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setFeeItemsPayoff(prev => prev.filter((_, i) => i !== idx))}
                                                        className="p-1.5 text-muted-foreground hover:text-red-500 transition-colors"
                                                    >
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            ))}
                                            {feeItemsPayoff.length === 0 && (Number(selectedTrx.marketplaceFee) || 0) === 0 && (
                                                <p className="text-xs text-muted-foreground italic">Klik "+ Tambah" jika ada potongan platform (Shopee, Tokopedia, dll)</p>
                                            )}
                                        </div>
                                        {/* Ringkasan fee */}
                                        {effectiveFee > 0 && (
                                            <div className="p-2.5 bg-red-500/5 border border-red-500/20 rounded-lg space-y-0.5 text-xs">
                                                {displayFeeItems.length > 0 ? displayFeeItems.map((fi, i) => (
                                                    <div key={i} className="flex justify-between text-red-700">
                                                        <span>{fi.name || 'Potongan'}</span>
                                                        <span>− Rp {Number(fi.amount).toLocaleString('id-ID')}</span>
                                                    </div>
                                                )) : (
                                                    <div className="flex justify-between text-red-700">
                                                        <span>Potongan Marketplace</span>
                                                        <span>− Rp {effectiveFee.toLocaleString('id-ID')}</span>
                                                    </div>
                                                )}
                                                <div className="flex justify-between text-red-700 font-semibold border-t border-red-200 pt-0.5 mt-0.5">
                                                    <span>Total Potongan</span>
                                                    <span>− Rp {effectiveFee.toLocaleString('id-ID')}</span>
                                                </div>
                                                <div className="flex justify-between text-emerald-700 font-bold">
                                                    <span>Diterima (nett)</span>
                                                    <span>Rp {Math.max(0, sisaTagihan - effectiveFee).toLocaleString('id-ID')}</span>
                                                </div>
                                                <p className="text-muted-foreground pt-0.5">Cashflow: INCOME {sisaTagihan.toLocaleString('id-ID')} + EXPENSE {effectiveFee.toLocaleString('id-ID')} (Biaya Platform)</p>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}

                            {/* Metode Pembayaran — compact grid untuk DP, full card untuk FULL */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground">
                                    {payMode === 'PARTIAL' ? 'Metode Pembayaran DP' : 'Metode Pembayaran Pelunasan'}
                                </label>
                                {payMode === 'PARTIAL' ? (
                                    /* Mode DP — tampilan compact */
                                    <div className="grid grid-cols-3 gap-2">
                                        {([
                                            { id: 'CASH', label: 'Tunai', icon: <Banknote className="w-4 h-4" /> },
                                            { id: 'QRIS', label: 'QRIS', icon: <CreditCard className="w-4 h-4" /> },
                                            { id: 'BANK_TRANSFER', label: 'Transfer', icon: <Landmark className="w-4 h-4" /> },
                                        ] as const).map(m => (
                                            <button key={m.id} type="button" onClick={() => { setPaymentMethod(m.id); if (m.id !== 'BANK_TRANSFER') setPayoffBankId(''); }}
                                                className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border-2 text-xs font-bold transition-all ${paymentMethod === m.id ? 'border-amber-500 bg-amber-500/10 text-amber-700' : 'border-border bg-muted/30 text-muted-foreground hover:border-amber-400/40'}`}>
                                                {m.icon}{m.label}
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    /* Mode FULL — tampilan card detail */
                                    <div className="grid grid-cols-1 gap-2">
                                        {([
                                            { id: 'CASH', label: 'Tunai (Cash)', desc: 'Terima uang tunai dari pelanggan', icon: <Banknote className="w-5 h-5" /> },
                                            { id: 'QRIS', label: 'QRIS', desc: 'Scan barcode & cek mutasi', icon: <CreditCard className="w-5 h-5" /> },
                                            { id: 'BANK_TRANSFER', label: 'Transfer Bank', desc: 'Transfer manual ke rekening toko', icon: <Landmark className="w-5 h-5" /> },
                                        ] as const).map(m => (
                                            <div key={m.id} onClick={() => { setPaymentMethod(m.id); if (m.id !== 'BANK_TRANSFER') setPayoffBankId(''); }}
                                                className={`flex items-center p-3 border rounded-xl cursor-pointer transition-all ${paymentMethod === m.id ? 'border-primary bg-primary/5 shadow-sm' : 'border-border hover:border-primary/50'}`}>
                                                <div className={`p-2 rounded-lg mr-3 ${paymentMethod === m.id ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                                                    {m.icon}
                                                </div>
                                                <div className="flex-1">
                                                    <p className="font-semibold text-foreground text-sm">{m.label}</p>
                                                    <p className="text-xs text-muted-foreground">{m.desc}</p>
                                                </div>
                                                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${paymentMethod === m.id ? 'border-primary' : 'border-muted-foreground'}`}>
                                                    {paymentMethod === m.id && <div className="w-2 h-2 rounded-full bg-primary" />}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Pilih rekening bank */}
                                {paymentMethod === 'BANK_TRANSFER' && (
                                    <div className="space-y-1.5 pt-1">
                                        <p className="text-xs font-semibold text-foreground">Pilih Rekening Tujuan</p>
                                        <div className="space-y-1.5 max-h-36 overflow-y-auto">
                                            {!bankAccounts?.length
                                                ? <p className="text-xs text-muted-foreground text-center py-3 bg-muted/20 border border-dashed border-border rounded-lg">Belum ada rekening bank.</p>
                                                : bankAccounts.map((bank: any) => (
                                                    <label key={bank.id} className={`flex items-center gap-3 p-2.5 border rounded-xl cursor-pointer transition-all ${payoffBankId === String(bank.id) ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border bg-background hover:bg-muted/30'}`}>
                                                        <input type="radio" name="bankSelectionDP" value={bank.id}
                                                            checked={payoffBankId === String(bank.id)}
                                                            onChange={e => setPayoffBankId(e.target.value)}
                                                            className="text-primary focus:ring-primary h-4 w-4" />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-bold text-xs uppercase text-foreground">{bank.bankName}</p>
                                                            <div className="flex items-center justify-between">
                                                                <span className="font-mono text-primary text-xs font-bold">{bank.accountNumber}</span>
                                                                <span className="text-[10px] text-muted-foreground">a.n {bank.accountOwner}</span>
                                                            </div>
                                                        </div>
                                                    </label>
                                                ))
                                            }
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Info checkout — hanya untuk mode LUNAS PENUH */}
                            {payMode === 'FULL' && (
                                <div className="space-y-3 pt-2 border-t border-border">
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Informasi Checkout</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-foreground">Kasir Pelunasan</label>
                                            <select value={checkoutCashierName} onChange={e => setCheckoutCashierName(e.target.value)}
                                                className="w-full px-3 py-2 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm">
                                                <option value="">Pilih kasir...</option>
                                                {users?.map((u: any) => (
                                                    <option key={u.id} value={u.name}>{u.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-foreground">Tgl & Jam Checkout</label>
                                            <input type="datetime-local" value={checkoutPaidAt} onChange={e => setCheckoutPaidAt(e.target.value)}
                                                className="w-full px-3 py-2 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm" />
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground">Kosongkan tanggal = waktu sekarang</p>
                                </div>
                            )}

                            {/* Submit button */}
                            {(() => {
                                const sisaTagihan = selectedTrx.status === 'PENDING'
                                    ? Number(selectedTrx.grandTotal)
                                    : Number(selectedTrx.grandTotal) - Number(selectedTrx.downPayment);
                                const nominalNum = Number(nominalBayar);
                                const isPending = payOffMutation.isPending || addDPMutation.isPending;
                                const isPartialDisabled = payMode === 'PARTIAL' && (!nominalBayar || nominalNum <= 0 || nominalNum > sisaTagihan);
                                return (
                                    <button type="submit" disabled={isPending || isPartialDisabled}
                                        className={`w-full py-3 rounded-xl font-bold transition-colors shadow-md disabled:opacity-50 flex justify-center items-center gap-2 text-sm ${
                                            payMode === 'PARTIAL'
                                                ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20'
                                                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20'
                                        }`}>
                                        {isPending ? 'Memproses...' : payMode === 'PARTIAL'
                                            ? (nominalBayar && nominalNum >= sisaTagihan ? <><CheckCircle2 className="w-4 h-4" /> Bayar DP (akan LUNAS)</> : <><PlusCircle className="w-4 h-4" /> Tambah DP</>)
                                            : <><CheckCircle2 className="w-4 h-4" /> Proses Pelunasan</>
                                        }
                                    </button>
                                );
                            })()}
                        </form>
                    </div>
                </div>
            )}
            {thermalModal}
        </div>
    );
}
