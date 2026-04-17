"use client";

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTransactions, payOffTransaction, getSettings, getBankAccounts, getUsers } from '@/lib/api';
import { mapTransactionToReceipt, handlePrintSnap, handleShareWA } from '@/lib/receipt';
import { CreditCard, Banknote, Landmark, Wallet, CheckCircle2, X, Printer, MessageCircle, PenSquare, Search } from "lucide-react";
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

    const [selectedTrx, setSelectedTrx] = useState<any | null>(null);
    const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'QRIS' | 'BANK_TRANSFER'>('CASH');
    const [payoffBankId, setPayoffBankId] = useState<string>('');
    const [nominalBayar, setNominalBayar] = useState<string>('');
    const [checkoutCashierName, setCheckoutCashierName] = useState<string>('');
    const [checkoutPaidAt, setCheckoutPaidAt] = useState<string>('');
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

    const payOffMutation = useMutation({
        mutationFn: (id: number) => payOffTransaction(id, {
            paymentMethod,
            bankAccountId: payoffBankId ? Number(payoffBankId) : undefined,
            checkoutCashierName: checkoutCashierName.trim() || undefined,
            paidAt: checkoutPaidAt || undefined,
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['transactions'] });
            setSelectedTrx(null);
            setCheckoutCashierName('');
            setCheckoutPaidAt('');
        }
    });

    const handlePayOff = (e: React.FormEvent) => {
        e.preventDefault();
        if (paymentMethod === 'BANK_TRANSFER' && !payoffBankId) {
            alert('Silakan pilih Rekening Bank tujuan transfer!');
            return;
        }
        if (selectedTrx) {
            payOffMutation.mutate(selectedTrx.id);
        }
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
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-border">
                        <thead className="bg-muted/50">
                            <tr>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase">Pelanggan & Invoice</th>
                                <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-muted-foreground uppercase">Total Belanja</th>
                                <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-muted-foreground uppercase">DP Masuk</th>
                                <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-muted-foreground uppercase">Sisa Tagihan</th>
                                <th scope="col" className="px-6 py-4 text-center text-xs font-semibold text-muted-foreground uppercase">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="bg-card divide-y divide-border">
                            {visibleTransactions.map((trx: any) => {
                                const grandTotal = Number(trx.grandTotal);
                                const dp = Number(trx.downPayment);
                                const isPending = trx.status === 'PENDING';
                                const balance = isPending ? grandTotal : grandTotal - dp;
                                const isKredit = !isPending && dp === 0;
                                const isOverdue = trx.dueDate && dayjs(trx.dueDate).isBefore(dayjs(), 'day');
                                return (
                                    <tr key={trx.id} className="hover:bg-muted/30 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
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
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground text-right border-l border-border/50">
                                            Rp {grandTotal.toLocaleString('id-ID')}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right">
                                            {isPending
                                                ? <span className="text-sky-500 font-semibold text-xs">Belum Bayar</span>
                                                : <span className="text-emerald-600">Rp {dp.toLocaleString('id-ID')}</span>
                                            }
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-orange-600 text-right bg-orange-500/5">
                                            Rp {balance.toLocaleString('id-ID')}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => handlePrintSnap(mapTransactionToReceipt(trx, settings), 'TAGIHAN', bankAccounts)}
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
                                                    onClick={() => { setSelectedTrx(trx); setNominalBayar(''); setPaymentMethod('CASH'); setPayoffBankId(''); setCheckoutCashierName(''); setCheckoutPaidAt(''); }}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg text-sm font-medium transition-colors"
                                                >
                                                    <Wallet className="w-4 h-4" /> Pelunasan
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
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-card w-full max-w-md rounded-2xl shadow-xl overflow-hidden flex flex-col">
                        <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-muted/30">
                            <h3 className="font-semibold text-foreground">
                                {selectedTrx?.status === 'PENDING' ? 'Pembayaran Invoice' : 'Pelunasan Tagihan'}
                            </h3>
                            <button onClick={() => setSelectedTrx(null)} className="p-1.5 text-muted-foreground hover:bg-muted rounded-lg transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handlePayOff} className="p-6 space-y-6">
                            <div className="text-center space-y-1">
                                <p className="text-sm text-muted-foreground">
                                    {selectedTrx.status === 'PENDING' ? 'Total tagihan untuk' : 'Sisa tagihan untuk'} {selectedTrx.customerName || selectedTrx.invoiceNumber}
                                </p>
                                <p className="text-4xl font-bold text-foreground">
                                    Rp {(selectedTrx.status === 'PENDING' ? Number(selectedTrx.grandTotal) : Number(selectedTrx.grandTotal) - Number(selectedTrx.downPayment)).toLocaleString('id-ID')}
                                </p>
                            </div>

                            <div className="space-y-3">
                                <label className="text-sm font-medium text-foreground">Nominal Pembayaran (Konfirmasi)</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">Rp</span>
                                    <input
                                        type="number"
                                        value={nominalBayar}
                                        onChange={(e) => setNominalBayar(e.target.value)}
                                        placeholder={(selectedTrx.status === 'PENDING' ? Number(selectedTrx.grandTotal) : Number(selectedTrx.grandTotal) - Number(selectedTrx.downPayment)).toString()}
                                        className="w-full pl-12 pr-4 py-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary outline-none font-bold text-lg"
                                        required
                                    />
                                </div>
                                {(() => {
                                    const sisaTagihan = selectedTrx.status === 'PENDING' ? Number(selectedTrx.grandTotal) : Number(selectedTrx.grandTotal) - Number(selectedTrx.downPayment);
                                    const kembalian = Number(nominalBayar) - sisaTagihan;
                                    return (<>
                                        {kembalian > 0 && (
                                            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex justify-between items-center text-emerald-700">
                                                <span className="text-sm">Uang Kembalian:</span>
                                                <span className="font-bold text-lg">Rp {kembalian.toLocaleString('id-ID')}</span>
                                            </div>
                                        )}
                                        {nominalBayar && Number(nominalBayar) < sisaTagihan && (
                                            <p className="text-sm text-red-500 font-medium">Nominal bayar kurang dari sisa tagihan!</p>
                                        )}
                                    </>);
                                })()}
                            </div>

                            <div className="space-y-3">
                                <label className="text-sm font-medium text-muted-foreground">Metode Pembayaran Pelunasan</label>
                                <div className="grid grid-cols-1 gap-3">
                                    <div
                                        onClick={() => setPaymentMethod('CASH')}
                                        className={`flex items-center p-4 border rounded-xl cursor-pointer transition-all ${paymentMethod === 'CASH' ? 'border-primary bg-primary/5 shadow-sm' : 'border-border hover:border-primary/50'}`}
                                    >
                                        <div className={`p-2 rounded-lg mr-4 ${paymentMethod === 'CASH' ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                                            <Banknote className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-semibold text-foreground text-sm">Tunai (Cash)</p>
                                            <p className="text-xs text-muted-foreground">Terima uang tunai dari pelanggan</p>
                                        </div>
                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'CASH' ? 'border-primary' : 'border-muted-foreground'}`}>
                                            {paymentMethod === 'CASH' && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                                        </div>
                                    </div>

                                    <div
                                        onClick={() => setPaymentMethod('QRIS')}
                                        className={`flex items-center p-4 border rounded-xl cursor-pointer transition-all ${paymentMethod === 'QRIS' ? 'border-primary bg-primary/5 shadow-sm' : 'border-border hover:border-primary/50'}`}
                                    >
                                        <div className={`p-2 rounded-lg mr-4 ${paymentMethod === 'QRIS' ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                                            <CreditCard className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-semibold text-foreground text-sm">QRIS</p>
                                            <p className="text-xs text-muted-foreground">Scan barcode & cek mutasi</p>
                                        </div>
                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'QRIS' ? 'border-primary' : 'border-muted-foreground'}`}>
                                            {paymentMethod === 'QRIS' && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                                        </div>
                                    </div>

                                    <div
                                        onClick={() => setPaymentMethod('BANK_TRANSFER')}
                                        className={`flex items-center p-4 border rounded-xl cursor-pointer transition-all ${paymentMethod === 'BANK_TRANSFER' ? 'border-primary bg-primary/5 shadow-sm' : 'border-border hover:border-primary/50'}`}
                                    >
                                        <div className={`p-2 rounded-lg mr-4 ${paymentMethod === 'BANK_TRANSFER' ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                                            <Landmark className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-semibold text-foreground text-sm">Transfer Bank</p>
                                            <p className="text-xs text-muted-foreground">Transfer manual ke rekening toko</p>
                                        </div>
                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'BANK_TRANSFER' ? 'border-primary' : 'border-muted-foreground'}`}>
                                            {paymentMethod === 'BANK_TRANSFER' && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                                        </div>
                                    </div>

                                    {paymentMethod === 'BANK_TRANSFER' && (
                                        <div className="space-y-2 mt-4">
                                            <p className="text-sm font-bold text-foreground">Pilih Rekening Tujuan</p>
                                            <div className="space-y-2 max-h-40 overflow-y-auto">
                                                {!bankAccounts?.length
                                                    ? <p className="text-xs text-muted-foreground text-center py-3 bg-muted/20 border border-dashed border-border rounded-lg">Belum ada rekening bank.</p>
                                                    : bankAccounts.map((bank: any) => (
                                                        <label key={bank.id} className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-all ${payoffBankId === String(bank.id) ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border bg-background hover:bg-muted/30'}`}>
                                                            <input
                                                                type="radio"
                                                                name="bankSelectionDP"
                                                                value={bank.id}
                                                                checked={payoffBankId === String(bank.id)}
                                                                onChange={(e) => setPayoffBankId(e.target.value)}
                                                                className="text-primary focus:ring-primary h-4 w-4"
                                                            />
                                                            <div className="flex-1">
                                                                <p className="font-bold text-sm uppercase text-foreground">{bank.bankName}</p>
                                                                <div className="flex items-center justify-between mt-0.5">
                                                                    <span className="font-mono text-primary font-bold">{bank.accountNumber}</span>
                                                                    <span className="text-xs text-muted-foreground">a.n {bank.accountOwner}</span>
                                                                </div>
                                                            </div>
                                                        </label>
                                                    ))
                                                }
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4 pt-1 border-t border-border">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Informasi Checkout</p>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-foreground">Kasir Pelunasan</label>
                                    <select
                                        value={checkoutCashierName}
                                        onChange={e => setCheckoutCashierName(e.target.value)}
                                        className="w-full px-4 py-2.5 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm"
                                    >
                                        <option value="">Pilih kasir...</option>
                                        {users?.map((u: any) => (
                                            <option key={u.id} value={u.name}>{u.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-foreground">Tanggal & Jam Checkout</label>
                                    <input
                                        type="datetime-local"
                                        value={checkoutPaidAt}
                                        onChange={e => setCheckoutPaidAt(e.target.value)}
                                        className="w-full px-4 py-2.5 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary outline-none text-sm"
                                    />
                                    <p className="text-xs text-muted-foreground">Kosongkan = waktu sekarang</p>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={payOffMutation.isPending || !nominalBayar || Number(nominalBayar) < (selectedTrx.status === 'PENDING' ? Number(selectedTrx.grandTotal) : Number(selectedTrx.grandTotal) - Number(selectedTrx.downPayment))}
                                className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-colors shadow-md shadow-primary/20 disabled:opacity-50 flex justify-center items-center"
                            >
                                {payOffMutation.isPending ? 'Memproses...' : selectedTrx.status === 'PENDING' ? 'Proses Pembayaran' : 'Proses Pelunasan'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
