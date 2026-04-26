'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getShiftExpectations, closeShift, getStaffList } from '@/lib/api';
import { useBranchStore } from '@/store/branch-store';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
    ArrowLeft, Camera, CheckCircle2, ChevronRight,
    Calculator, AlertTriangle, Plus, Trash2, Users, Clock, Banknote, UserCheck, ArrowRightLeft
} from 'lucide-react';
import Link from 'next/link';

// Tipe untuk item pengeluaran (nama + jumlah)
type ExpenseItem = { name: string; amount: number };
// Pengeluaran dikelompokkan per metode: { "CASH": [...], "BCA": [...] }
type StructuredExpenses = Record<string, ExpenseItem[]>;
// Pemasukan tambahan langsung ke rekening dari luar POS
type AdditionalIncomeItem = { bankName: string; amount: number; description: string };
// Pertukaran antar metode pembayaran (QRIS↔Tunai, titip transfer, dll)
type PaymentExchangeItem = { from: string; to: string; amount: number; description: string };

export default function CloseShiftPage() {
    const router = useRouter();

    // ─── State: Data Kasir & Shift ───────────────────────────────────────
    const [adminName, setAdminName] = useState('');
    const [shiftName, setShiftName] = useState('Shift Pagi');
    const [reportDate, setReportDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [closeTime, setCloseTime] = useState(() => {
        const now = new Date();
        return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    });

    // ─── State: Saldo Aktual ─────────────────────────────────────────────
    const [actualCash, setActualCash] = useState<number>(0);
    const [actualQris, setActualQris] = useState<number>(0);
    const [realQrisBalance, setRealQrisBalance] = useState<number>(0);
    // Saldo Laporan mBanking (yang tertera di layar saat lapor)
    const [actualBankBalances, setActualBankBalances] = useState<Record<string, number>>({});
    // Saldo Real di Bank (yang benar-benar ada / transfer actua)
    const [realBankBalances, setRealBankBalances] = useState<Record<string, number>>({});

    // ─── State: Pengeluaran Terstruktur ──────────────────────────────────
    const [structuredExpenses, setStructuredExpenses] = useState<StructuredExpenses>({});

    // ─── State: Kasbon & Setor Kas & Tarik Tunai ────────────────────────
    const [kasbon, setKasbon] = useState<{ name: string; amount: number; source: string }[]>([]);
    const [setorKas, setSetorKas] = useState<{ bankName: string; amount: number }[]>([]);
    const [tarikTunai, setTarikTunai] = useState<{ bankName: string; amount: number }[]>([]);
    const [tukarTransferKeCash, setTukarTransferKeCash] = useState<number>(0);
    const [additionalIncomes, setAdditionalIncomes] = useState<AdditionalIncomeItem[]>([]);
    const [paymentExchanges, setPaymentExchanges] = useState<PaymentExchangeItem[]>([]);

    // ─── State: Catatan & Bukti ──────────────────────────────────────────
    const [notes, setNotes] = useState('');
    const [files, setFiles] = useState<File[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ─── Branch context ─────────────────────────────────────────────────
    const { isOwner } = useCurrentUser();
    const activeBranchId = useBranchStore(s => s.activeBranchId);
    const needsBranchPick = isOwner && activeBranchId == null;

    // ─── Data dari API ───────────────────────────────────────────────────
    const { data: shiftData, isLoading, isError } = useQuery({
        queryKey: ['shift-expectations', activeBranchId],
        queryFn: getShiftExpectations,
        enabled: !needsBranchPick,
    });

    const { data: staffList = [] } = useQuery({
        queryKey: ['staff-list'],
        queryFn: getStaffList,
    });

    // Inisialisasi state saldo bank saat data shift dimuat
    useEffect(() => {
        if (shiftData?.systemBankBalances) {
            const initialBanks: Record<string, number> = {};
            Object.keys(shiftData.systemBankBalances).forEach(bank => {
                initialBanks[bank] = 0;
            });
            setActualBankBalances(initialBanks);
            setRealBankBalances({ ...initialBanks });

            // Inisialisasi pengeluaran: QRIS + bank-bank + CASH
            const initExpenses: StructuredExpenses = { QRIS: [], CASH: [] };
            Object.keys(shiftData.systemBankBalances).forEach(bank => {
                initExpenses[bank] = [];
            });
            setStructuredExpenses(initExpenses);
        }
    }, [shiftData]);

    // ─── Mutation Submit ─────────────────────────────────────────────────
    const closeShiftMutation = useMutation({
        mutationFn: closeShift,
        onSuccess: () => {
            alert('✅ Laporan Tutup Shift berhasil dikirim ke WhatsApp Group!');
            router.push('/pos');
        },
        onError: (err: any) => {
            alert('❌ Gagal mengirim laporan: ' + err.message);
        }
    });

    // ─── Helper: Pengeluaran ─────────────────────────────────────────────
    const addExpenseItem = (method: string) => {
        setStructuredExpenses(prev => ({
            ...prev,
            [method]: [...(prev[method] || []), { name: '', amount: 0 }]
        }));
    };

    const updateExpenseItem = (method: string, idx: number, field: 'name' | 'amount', value: string | number) => {
        setStructuredExpenses(prev => {
            const updated = [...(prev[method] || [])];
            updated[idx] = { ...updated[idx], [field]: field === 'amount' ? Number(value) : value };
            return { ...prev, [method]: updated };
        });
    };

    const removeExpenseItem = (method: string, idx: number) => {
        setStructuredExpenses(prev => ({
            ...prev,
            [method]: (prev[method] || []).filter((_, i) => i !== idx)
        }));
    };

    const getTotalExpenses = () => {
        let total = 0;
        for (const items of Object.values(structuredExpenses)) {
            for (const item of items) total += Number(item.amount) || 0;
        }
        return total;
    };

    // ─── Helper: Kasbon ──────────────────────────────────────────────────
    const addKasbon = () => setKasbon(prev => [...prev, { name: '', amount: 0, source: 'Kas Toko' }]);
    const updateKasbon = (idx: number, field: 'name' | 'amount' | 'source', value: string | number) =>
        setKasbon(prev => prev.map((k, i) => i === idx ? { ...k, [field]: field === 'amount' ? Number(value) : value } : k));
    const removeKasbon = (idx: number) => setKasbon(prev => prev.filter((_, i) => i !== idx));
    const getTotalKasbon = () => kasbon.reduce((sum, k) => sum + (Number(k.amount) || 0), 0);
    const getCashExpenseTotal = () =>
        (structuredExpenses['CASH'] || []).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const getQrisExpenseTotal = () =>
        (structuredExpenses['QRIS'] || []).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const getTotalKasbonToko = () =>
        kasbon.filter(k => !k.source || k.source === 'Kas Toko')
              .reduce((sum, k) => sum + (Number(k.amount) || 0), 0);

    // ─── Helper: Pemasukan Tambahan Eksternal ────────────────────────────
    const addAdditionalIncome = () =>
        setAdditionalIncomes(prev => [...prev, { bankName: bankOptions[0] || '', amount: 0, description: '' }]);
    const updateAdditionalIncome = (idx: number, field: keyof AdditionalIncomeItem, value: string | number) =>
        setAdditionalIncomes(prev => prev.map((item, i) =>
            i === idx ? { ...item, [field]: field === 'amount' ? Number(value) : value } : item));
    const removeAdditionalIncome = (idx: number) =>
        setAdditionalIncomes(prev => prev.filter((_, i) => i !== idx));
    const getTotalAdditionalIncomes = () =>
        additionalIncomes.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);

    // ─── Helper: Pertukaran Metode Pembayaran ────────────────────────────
    const addPaymentExchange = () =>
        setPaymentExchanges(prev => [...prev, { from: 'QRIS', to: 'CASH', amount: 0, description: '' }]);
    const updatePaymentExchange = (idx: number, field: keyof PaymentExchangeItem, value: string | number) =>
        setPaymentExchanges(prev => prev.map((e, i) =>
            i === idx ? { ...e, [field]: field === 'amount' ? Number(value) : value } : e));
    const removePaymentExchange = (idx: number) =>
        setPaymentExchanges(prev => prev.filter((_, i) => i !== idx));

    const getExchangeCashEffect = () =>
        paymentExchanges.reduce((sum, e) => {
            if (e.to === 'CASH') return sum + (Number(e.amount) || 0);
            if (e.from === 'CASH') return sum - (Number(e.amount) || 0);
            return sum;
        }, 0);

    const getExchangeBankEffect = (bankName: string) =>
        paymentExchanges.reduce((sum, e) => {
            if (e.to === bankName) return sum + (Number(e.amount) || 0);
            if (e.from === bankName) return sum - (Number(e.amount) || 0);
            return sum;
        }, 0);

    // ─── Helper: Setor Kas ───────────────────────────────────────────────
    const bankOptions = Object.keys(shiftData?.systemBankBalances || {});
    const addSetorKas = () => setSetorKas(prev => [...prev, { bankName: bankOptions[0] || '', amount: 0 }]);
    const updateSetorKas = (idx: number, field: 'bankName' | 'amount', value: string | number) =>
        setSetorKas(prev => prev.map((s, i) => i === idx ? { ...s, [field]: field === 'amount' ? Number(value) : value } : s));
    const removeSetorKas = (idx: number) => setSetorKas(prev => prev.filter((_, i) => i !== idx));
    const getTotalSetorKas = () => setorKas.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);

    // ─── Helper: Tarik Tunai dari Rekening ──────────────────────────────
    const addTarikTunai = () => setTarikTunai(prev => [...prev, { bankName: bankOptions[0] || '', amount: 0 }]);
    const updateTarikTunai = (idx: number, field: 'bankName' | 'amount', value: string | number) =>
        setTarikTunai(prev => prev.map((s, i) => i === idx ? { ...s, [field]: field === 'amount' ? Number(value) : value } : s));
    const removeTarikTunai = (idx: number) => setTarikTunai(prev => prev.filter((_, i) => i !== idx));
    const getTotalTarikTunai = () => tarikTunai.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);

    // ─── Adjusted Expected ───────────────────────────────────────────────
    // Setor kas: kas berkurang, bank bertambah
    // Tarik tunai: kas bertambah, bank berkurang
    // Tukar transfer ke cash: kas bertambah (dari konversi transfer)
    const adjustedExpectedCash = (shiftData?.expectedCash || 0)
        - getTotalSetorKas()
        + getTotalTarikTunai()
        + tukarTransferKeCash
        - getCashExpenseTotal()
        - getTotalKasbonToko()
        + getExchangeCashEffect();
    const getAdjustedExpectedBank = (bankName: string) => {
        const base = shiftData?.systemBankBalances?.[bankName] || 0;
        const setor = setorKas.filter(s => s.bankName === bankName).reduce((sum, s) => sum + s.amount, 0);
        const tarik = tarikTunai.filter(s => s.bankName === bankName).reduce((sum, s) => sum + s.amount, 0);
        const additional = additionalIncomes
            .filter(i => i.bankName === bankName)
            .reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
        const exchange = getExchangeBankEffect(bankName);
        return base + setor - tarik + additional + exchange;
    };

    // ─── Helper: Format & Badge ──────────────────────────────────────────
    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount || 0);

    const diff = (actual: number, expected: number) => actual - expected;

    const renderBadge = (d: number) => {
        if (d === 0) return <span className="text-green-700 bg-green-50 px-2 py-1 rounded text-xs font-bold border border-green-200">✅ BALANCE</span>;
        if (d > 0) return <span className="text-emerald-700 bg-emerald-50 px-2 py-1 rounded text-xs font-bold border border-emerald-200">🟢 LEBIH {formatCurrency(d)}</span>;
        return <span className="text-red-700 bg-red-50 px-2 py-1 rounded text-xs font-bold border border-red-200">🔴 KURANG {formatCurrency(Math.abs(d))}</span>;
    };

    // ─── Submit ──────────────────────────────────────────────────────────
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!shiftData) return;
        if (!adminName) { alert('Pilih nama kasir terlebih dahulu!'); return; }

        // Build closedAt from selected date + close time — avoid wrong date if submitted late
        const closedAtDate = new Date(`${reportDate}T${closeTime}:00`);
        // Validate: closedAt must not be in the future
        if (closedAtDate > new Date()) {
            alert('⚠️ Waktu tutup shift tidak boleh di masa depan. Periksa tanggal dan jam tutup shift.');
            return;
        }

        // openedAt: use last shift closedAt, but cap it to reportDate if it's after closedAtDate
        const openedAtRaw = shiftData.openedAt ? new Date(shiftData.openedAt) : null;
        const openedAt = openedAtRaw && openedAtRaw < closedAtDate
            ? openedAtRaw.toISOString()
            : new Date(`${reportDate}T00:00:00`).toISOString();

        if (!confirm(`Apakah data sudah benar?\n\nKasir: ${adminName}\nShift: ${shiftName}\nTanggal: ${reportDate}\nJam Tutup: ${closeTime}\n\nSetelah dikirim, hanya Admin yang bisa melakukan koreksi.`)) return;

        const formData = new FormData();
        formData.append('adminName', adminName);
        formData.append('shiftName', shiftName);
        formData.append('reportDate', reportDate);
        formData.append('openedAt', openedAt);
        formData.append('closedAt', closedAtDate.toISOString());

        formData.append('expectedCash', String(adjustedExpectedCash));
        formData.append('expectedQris', String(shiftData.expectedQris || 0));
        formData.append('expectedTransfer', String(shiftData.expectedTransfer || 0));

        formData.append('actualCash', String(actualCash));
        formData.append('actualQris', String(actualQris));
        formData.append('realQrisBalance', String(realQrisBalance));
        formData.append('actualTransfer', '0');
        formData.append('expensesTotal', String(getTotalExpenses()));
        formData.append('notes', notes);

        formData.append('expectedBankBalances', JSON.stringify(shiftData.grossBankIncomes || {}));
        formData.append('actualBankBalances', JSON.stringify(actualBankBalances));
        formData.append('realBankBalances', JSON.stringify(realBankBalances));
        formData.append('shiftExpenses', JSON.stringify(shiftData.shiftExpenses || []));
        formData.append('structuredExpenses', JSON.stringify(structuredExpenses));
        formData.append('kasbon', JSON.stringify(kasbon.filter(k => k.name && k.amount > 0)));
        formData.append('setorKas', JSON.stringify(setorKas.filter(s => s.bankName && s.amount > 0)));
        formData.append('tarikTunai', JSON.stringify(tarikTunai.filter(s => s.bankName && s.amount > 0)));
        formData.append('additionalIncomes', JSON.stringify(additionalIncomes.filter(i => i.bankName && i.amount > 0)));
        formData.append('tukarTransferKeCash', String(tukarTransferKeCash || 0));
        formData.append('paymentExchanges', JSON.stringify(paymentExchanges.filter(e => e.amount > 0)));

        files.forEach(file => formData.append('proofImages', file));
        closeShiftMutation.mutate(formData);
    };

    // ─── Guard: Owner harus pilih cabang dulu ────────────────────────────
    if (needsBranchPick) return (
        <div className="p-8 max-w-xl mx-auto">
            <Card className="border-amber-200 bg-amber-50">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-amber-800">
                        <AlertTriangle className="w-5 h-5" /> Pilih Cabang Dulu
                    </CardTitle>
                    <CardDescription className="text-amber-700">
                        Anda sedang dalam mode &quot;Semua Cabang&quot;. Tutup shift harus dilakukan per cabang. Pilih cabang aktif lewat dropdown di atas (header).
                    </CardDescription>
                </CardHeader>
            </Card>
        </div>
    );

    // ─── Loading / Error States ──────────────────────────────────────────
    if (isLoading) return (
        <div className="p-8 text-center text-slate-500 animate-pulse flex flex-col items-center gap-3">
            <Calculator className="w-12 h-12 opacity-40" />
            <p>Memuat data shift...</p>
        </div>
    );
    if (isError) return (
        <div className="p-8 text-center text-red-500 flex flex-col items-center gap-3">
            <AlertTriangle className="w-12 h-12" />
            <p>Gagal memuat data shift. Pastikan server berjalan.</p>
        </div>
    );

    const expectedCash = adjustedExpectedCash;
    const expectedQris = shiftData?.expectedQris || 0;
    let grossAll = (shiftData?.grossCash || 0) + (shiftData?.grossQris || 0);
    Object.values(shiftData?.grossBankIncomes || {}).forEach((v: any) => grossAll += v);

    // Adjusted QRIS target (real-time: expenses + payment exchanges)
    const adjustedExpectedQris = expectedQris
        - getQrisExpenseTotal()
        + paymentExchanges.reduce((sum, ex) => {
            if (ex.to === 'QRIS') return sum + (Number(ex.amount) || 0);
            if (ex.from === 'QRIS') return sum - (Number(ex.amount) || 0);
            return sum;
        }, 0);

    // Net effects on non-system payment methods (Dana, GoPay, OVO, etc.) from exchanges
    const nonSystemExchangeEffects: Record<string, number> = {};
    const systemMethods = new Set(['CASH', 'QRIS', ...bankOptions]);
    for (const ex of paymentExchanges) {
        if (!ex.amount || ex.amount <= 0) continue;
        if (!systemMethods.has(ex.from)) {
            nonSystemExchangeEffects[ex.from] = (nonSystemExchangeEffects[ex.from] || 0) - ex.amount;
        }
        if (!systemMethods.has(ex.to)) {
            nonSystemExchangeEffects[ex.to] = (nonSystemExchangeEffects[ex.to] || 0) + ex.amount;
        }
    }

    const SHIFT_OPTIONS = ['Shift Pagi', 'Shift Siang', 'Long Shift'];

    // Metode pengeluaran: QRIS dulu, lalu bank-bank, Cash terakhir
    const expenseMethods = [
        ...Object.keys(structuredExpenses).filter(m => m !== 'CASH' && m !== 'QRIS'),
        ...(structuredExpenses['QRIS'] !== undefined ? ['QRIS'] : []),
        'CASH',
    ];

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <header className="bg-white border-b sticky top-0 z-10 shadow-sm">
                <div className="container mx-auto px-4 h-16 flex items-center gap-4">
                    <Link href="/pos">
                        <Button variant="ghost" size="icon" className="rounded-full">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-slate-800">Laporan Tutup Shift</h1>
                        <p className="text-xs text-slate-500">POS System • WA Bot Terintegrasi</p>
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-4 py-8 max-w-7xl">
                <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

                    {/* ══════════ PANEL KIRI: DATA SISTEM (READ-ONLY) ══════════ */}
                    <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-24">
                        <Card className="border-indigo-100 shadow-md bg-gradient-to-b from-white to-slate-50/50">
                            <CardHeader className="pb-4 border-b border-indigo-50">
                                <CardTitle className="text-base flex items-center gap-2 text-slate-800">
                                    <Calculator className="w-5 h-5 text-indigo-500" />
                                    Data Sistem (Otomatis)
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-4 space-y-4 text-sm">
                                <div className="p-3 bg-indigo-50 rounded-lg flex justify-between items-center border border-indigo-100">
                                    <span className="font-semibold text-indigo-900">Total Gross Shift</span>
                                    <span className="font-extrabold text-indigo-900">{formatCurrency(grossAll)}</span>
                                </div>

                                {/* Pendapatan per Metode */}
                                <div className="space-y-1">
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pendapatan Shift Ini</p>
                                    <div className="flex justify-between py-1 border-b">
                                        <span className="text-slate-600">💵 Cash</span>
                                        <span className="font-semibold">{formatCurrency(shiftData?.grossCash || 0)}</span>
                                    </div>
                                    {Object.entries(shiftData?.grossBankIncomes || {}).map(([bank, val]: [string, any]) => (
                                        <div key={bank} className="flex justify-between py-1 border-b">
                                            <span className="text-slate-600">💳 {bank}</span>
                                            <span className="font-semibold">{formatCurrency(val)}</span>
                                        </div>
                                    ))}
                                    <div className="flex justify-between py-1 border-b">
                                        <span className="text-slate-600">📱 QRIS</span>
                                        <span className="font-semibold">{formatCurrency(shiftData?.grossQris || 0)}</span>
                                    </div>
                                </div>

                                {/* Target Saldo Kasir — real-time */}
                                <div className="space-y-1">
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                                        Target Saldo
                                        <span className="text-indigo-400 font-normal normal-case">(live)</span>
                                    </p>

                                    {/* Cash */}
                                    {(() => {
                                        const base = shiftData?.expectedCash || 0;
                                        const d = adjustedExpectedCash - base;
                                        return (
                                            <div className="flex justify-between items-center py-1 border-b gap-2">
                                                <span className="text-slate-600">💵 Tunai di laci</span>
                                                <div className="text-right">
                                                    <span className="font-semibold text-slate-800">{formatCurrency(adjustedExpectedCash)}</span>
                                                    {d !== 0 && (
                                                        <p className={`text-xs ${d > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                                            {d > 0 ? '+' : ''}{formatCurrency(d)}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    {/* QRIS */}
                                    {(() => {
                                        const d = adjustedExpectedQris - expectedQris;
                                        return (
                                            <div className="flex justify-between items-center py-1 border-b gap-2">
                                                <span className="text-slate-600">📱 QRIS</span>
                                                <div className="text-right">
                                                    <span className="font-semibold text-slate-800">{formatCurrency(adjustedExpectedQris)}</span>
                                                    {d !== 0 && (
                                                        <p className={`text-xs ${d > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                                            {d > 0 ? '+' : ''}{formatCurrency(d)}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>

                                {/* Target Bank — real-time */}
                                {shiftData?.systemBankBalances && Object.keys(shiftData.systemBankBalances).length > 0 && (
                                    <div className="space-y-1">
                                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Target Bank</p>
                                        {Object.entries(shiftData.systemBankBalances).map(([bank, sysval]: [string, any]) => {
                                            const adjusted = getAdjustedExpectedBank(bank);
                                            const d = adjusted - sysval;
                                            return (
                                                <div key={bank} className="flex justify-between items-center bg-white p-2 border rounded gap-2">
                                                    <span className="text-slate-600 text-sm">💳 {bank}</span>
                                                    <div className="text-right">
                                                        <span className="font-bold text-slate-800">{formatCurrency(adjusted)}</span>
                                                        {d !== 0 && (
                                                            <p className={`text-xs ${d > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                                                {d > 0 ? '+' : ''}{formatCurrency(d)}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Non-system payment methods (Dana, GoPay, OVO, dll) — hanya jika ada pertukaran */}
                                {Object.keys(nonSystemExchangeEffects).length > 0 && (
                                    <div className="space-y-1 pt-1 border-t border-indigo-100">
                                        <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wider flex items-center gap-1">
                                            <ArrowRightLeft className="w-3 h-3" /> Pertukaran Aktif
                                        </p>
                                        {Object.entries(nonSystemExchangeEffects).map(([method, effect]) => (
                                            <div key={method} className="flex justify-between items-center bg-indigo-50 p-2 border border-indigo-100 rounded gap-2">
                                                <span className="text-slate-700 text-sm font-medium">💳 {method}</span>
                                                <span className={`font-bold text-sm ${effect > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                                    {effect > 0 ? '+' : ''}{formatCurrency(effect)}
                                                </span>
                                            </div>
                                        ))}
                                        <p className="text-xs text-indigo-400 italic">Net perubahan dari pertukaran shift ini.</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* ══════════ PANEL KANAN: INPUT KASIR ══════════ */}
                    <div className="lg:col-span-8 space-y-6">

                        {/* ── Kartu 1: Data Personel ── */}
                        <Card className="border-slate-200">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Users className="w-4 h-4 text-blue-500" />
                                    1. Data Personel
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 gap-4">
                                    {/* Dropdown Nama Kasir */}
                                    <div className="space-y-2">
                                        <Label className="text-slate-700 font-semibold">Nama Kasir / CS</Label>
                                        <select
                                            required
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                            value={adminName}
                                            onChange={(e) => setAdminName(e.target.value)}
                                        >
                                            <option value="">-- Pilih Nama --</option>
                                            {staffList.map((staff: { id: number; name: string }) => (
                                                <option key={staff.id} value={staff.name}>{staff.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Pilihan Shift */}
                                    <div className="space-y-2">
                                        <Label className="text-slate-700 font-semibold">
                                            <Clock className="w-4 h-4 inline mr-1" />
                                            Shift Kerja
                                        </Label>
                                        <select
                                            required
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                            value={shiftName}
                                            onChange={(e) => setShiftName(e.target.value)}
                                        >
                                            {SHIFT_OPTIONS.map(s => (
                                                <option key={s} value={s}>{s}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Tanggal & Jam Tutup Shift */}
                                <div className="space-y-2 mt-4">
                                    <Label className="text-slate-700 font-semibold">Tanggal & Jam Tutup Shift</Label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <p className="text-xs text-slate-500">Tanggal</p>
                                            <input
                                                type="date"
                                                required
                                                value={reportDate}
                                                max={new Date().toISOString().slice(0, 10)}
                                                onChange={(e) => setReportDate(e.target.value)}
                                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-xs text-slate-500">Jam Tutup</p>
                                            <input
                                                type="time"
                                                required
                                                value={closeTime}
                                                onChange={(e) => setCloseTime(e.target.value)}
                                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                            />
                                        </div>
                                    </div>
                                    {reportDate !== new Date().toISOString().slice(0, 10) && (
                                        <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                            <p className="text-xs text-amber-700">
                                                Laporan akan dicatat pada tanggal <strong>{reportDate}</strong> jam <strong>{closeTime}</strong>. Semua cashflow shift ini akan menggunakan tanggal tersebut.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* ── Kartu 2: Kas Aktual (Cash + QRIS) ── */}
                        <Card className="border-t-4 border-t-blue-500 border-slate-200">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base">2. Kas Aktual</CardTitle>
                                <CardDescription>Input saldo fisik yang kamu hitung / lihat di layar EDC.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {/* Cash di Laci */}
                                <div className="p-4 border rounded-xl bg-white">
                                    <div className="flex justify-between gap-4 items-center">
                                        <Label className="font-bold text-slate-800">💵 Uang Tunai di Laci</Label>
                                        <div className="relative w-48">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">Rp</span>
                                            <Input
                                                type="number" min="0" required
                                                className="pl-9 text-right font-bold"
                                                value={actualCash || ''}
                                                onChange={(e) => setActualCash(Number(e.target.value))}
                                                placeholder="0"
                                            />
                                        </div>
                                    </div>
                                    <div className="mt-2 flex justify-end">
                                        {renderBadge(diff(actualCash, expectedCash))}
                                    </div>
                                </div>

                                {/* QRIS */}
                                <div className="p-4 border rounded-xl bg-white">
                                    <div className="flex justify-between gap-4 items-center">
                                        <Label className="font-bold text-slate-800">📱 Total Mutasi Masuk QRIS</Label>
                                        <div className="relative w-48">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">Rp</span>
                                            <Input
                                                type="number" min="0" required
                                                className="pl-9 text-right font-bold"
                                                value={actualQris || ''}
                                                onChange={(e) => setActualQris(Number(e.target.value))}
                                                placeholder="0"
                                            />
                                        </div>
                                    </div>
                                    <div className="mt-2 flex justify-end">
                                        {renderBadge(diff(actualQris, expectedQris))}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* ── Kartu 3: Pengeluaran Terstruktur ── */}
                        <Card className="border-t-4 border-t-orange-500 border-slate-200">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base">3. Pengeluaran Shift Ini</CardTitle>
                                <CardDescription>Catat semua pengeluaran kas/bank yang terjadi di shift ini.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-5">
                                {expenseMethods.map(method => (
                                    <div key={method} className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <p className="font-semibold text-slate-700 text-sm">
                                                {method === 'CASH' ? '💵' : method === 'QRIS' ? '📱' : '💳'} Pengeluaran {method}
                                            </p>
                                            <Button
                                                type="button" variant="outline" size="sm"
                                                className="h-7 text-xs gap-1"
                                                onClick={() => addExpenseItem(method)}
                                            >
                                                <Plus className="w-3 h-3" /> Tambah Item
                                            </Button>
                                        </div>

                                        {(structuredExpenses[method] || []).length === 0 && (
                                            <p className="text-xs text-slate-400 italic pl-1">Belum ada pengeluaran</p>
                                        )}

                                        {(structuredExpenses[method] || []).map((item, idx) => (
                                            <div key={idx} className="flex gap-2 items-center">
                                                <span className="text-slate-400 text-sm w-5 text-right">{idx + 1}.</span>
                                                <Input
                                                    placeholder="Keterangan pengeluaran"
                                                    className="flex-1 text-sm"
                                                    value={item.name}
                                                    onChange={(e) => updateExpenseItem(method, idx, 'name', e.target.value)}
                                                />
                                                <div className="relative w-36">
                                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">Rp</span>
                                                    <Input
                                                        type="number" min="0"
                                                        className="pl-7 text-right text-sm"
                                                        value={item.amount || ''}
                                                        onChange={(e) => updateExpenseItem(method, idx, 'amount', e.target.value)}
                                                        placeholder="0"
                                                    />
                                                </div>
                                                <Button
                                                    type="button" variant="ghost" size="icon"
                                                    className="h-9 w-9 text-red-400 hover:text-red-600 hover:bg-red-50"
                                                    onClick={() => removeExpenseItem(method, idx)}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                ))}

                                {/* Total Pengeluaran */}
                                <div className="flex justify-between items-center pt-2 border-t font-semibold">
                                    <span className="text-slate-700">Total Pengeluaran</span>
                                    <span className="text-orange-600">{formatCurrency(getTotalExpenses())}</span>
                                </div>
                            </CardContent>
                        </Card>

                        {/* ── Kartu 3.5: Pemasukan Tambahan / Eksternal ── */}
                        <Card className="border-t-4 border-t-green-500 border-slate-200">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base">4. Pemasukan Tambahan / Eksternal</CardTitle>
                                <CardDescription>
                                    Catat pemasukan yang masuk langsung ke rekening dari luar sistem POS
                                    (transfer customer, Shopee/Tokopedia payout, GoPay payout, dll).
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm text-slate-500">Pemasukan ini akan dicatat sebagai Cashflow dan menambah target saldo rekening.</p>
                                    <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={addAdditionalIncome} disabled={bankOptions.length === 0}>
                                        <Plus className="w-3 h-3" /> Tambah
                                    </Button>
                                </div>
                                {bankOptions.length === 0 && (
                                    <p className="text-xs text-slate-400 italic pl-1">Tidak ada rekening bank aktif.</p>
                                )}
                                {additionalIncomes.length === 0 && bankOptions.length > 0 && (
                                    <p className="text-xs text-slate-400 italic pl-1">Belum ada pemasukan tambahan</p>
                                )}
                                {additionalIncomes.map((item, idx) => (
                                    <div key={idx} className="flex gap-2 items-center">
                                        <span className="text-slate-400 text-sm w-5 text-right">{idx + 1}.</span>
                                        <select
                                            className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring w-32"
                                            value={item.bankName}
                                            onChange={(e) => updateAdditionalIncome(idx, 'bankName', e.target.value)}
                                        >
                                            {bankOptions.map(b => <option key={b} value={b}>{b}</option>)}
                                        </select>
                                        <Input
                                            placeholder="Sumber (Shopee, Transfer, dll)"
                                            className="flex-1 text-sm"
                                            value={item.description}
                                            onChange={(e) => updateAdditionalIncome(idx, 'description', e.target.value)}
                                        />
                                        <div className="relative w-36">
                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">Rp</span>
                                            <Input
                                                type="number" min="0"
                                                className="pl-7 text-right text-sm"
                                                value={item.amount || ''}
                                                onChange={(e) => updateAdditionalIncome(idx, 'amount', e.target.value)}
                                                placeholder="0"
                                            />
                                        </div>
                                        <Button type="button" variant="ghost" size="icon"
                                            className="h-9 w-9 text-red-400 hover:text-red-600 hover:bg-red-50"
                                            onClick={() => removeAdditionalIncome(idx)}>
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ))}
                                {additionalIncomes.length > 0 && (
                                    <>
                                        <div className="flex justify-between items-center pt-2 border-t font-semibold">
                                            <span className="text-slate-700">Total Pemasukan Tambahan</span>
                                            <span className="text-green-600">{formatCurrency(getTotalAdditionalIncomes())}</span>
                                        </div>
                                        <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1">
                                            💡 Target saldo rekening tujuan otomatis bertambah sesuai pemasukan di atas.
                                        </p>
                                    </>
                                )}
                            </CardContent>
                        </Card>

                        {/* ── Kartu 3.5: Setor Kas & Kasbon ── */}
                        <Card className="border-t-4 border-t-cyan-500 border-slate-200">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base">4. Setor Kas & Kasbon</CardTitle>
                                <CardDescription>Catat mutasi kas fisik ↔ rekening dan kasbon karyawan di shift ini.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">

                                {/* Setor Kas ke Rekening */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <p className="font-semibold text-slate-700 text-sm flex items-center gap-1.5">
                                            <Banknote className="w-4 h-4 text-cyan-600" /> Setor Kas ke Rekening
                                        </p>
                                        <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={addSetorKas} disabled={bankOptions.length === 0}>
                                            <Plus className="w-3 h-3" /> Tambah
                                        </Button>
                                    </div>
                                    {bankOptions.length === 0 && (
                                        <p className="text-xs text-slate-400 italic pl-1">Tidak ada rekening bank aktif.</p>
                                    )}
                                    {setorKas.length === 0 && bankOptions.length > 0 && (
                                        <p className="text-xs text-slate-400 italic pl-1">Belum ada setor kas</p>
                                    )}
                                    {setorKas.map((s, idx) => (
                                        <div key={idx} className="flex gap-2 items-center">
                                            <span className="text-slate-400 text-sm w-5 text-right">{idx + 1}.</span>
                                            <select
                                                className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring flex-1"
                                                value={s.bankName}
                                                onChange={(e) => updateSetorKas(idx, 'bankName', e.target.value)}
                                            >
                                                {bankOptions.map(b => <option key={b} value={b}>{b}</option>)}
                                            </select>
                                            <div className="relative w-36">
                                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">Rp</span>
                                                <Input type="number" min="0" className="pl-7 text-right text-sm" value={s.amount || ''} onChange={(e) => updateSetorKas(idx, 'amount', e.target.value)} placeholder="0" />
                                            </div>
                                            <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => removeSetorKas(idx)}>
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    ))}
                                    {setorKas.length > 0 && (
                                        <p className="text-xs text-cyan-700 bg-cyan-50 border border-cyan-200 rounded px-2 py-1">
                                            💡 Target kas tunai otomatis berkurang {formatCurrency(getTotalSetorKas())} — target saldo rekening tujuan bertambah.
                                        </p>
                                    )}
                                </div>

                                {/* Tarik Tunai dari Rekening */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <p className="font-semibold text-slate-700 text-sm flex items-center gap-1.5">
                                            <Banknote className="w-4 h-4 text-emerald-600" /> Tarik Tunai dari Rekening
                                        </p>
                                        <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={addTarikTunai} disabled={bankOptions.length === 0}>
                                            <Plus className="w-3 h-3" /> Tambah
                                        </Button>
                                    </div>
                                    {tarikTunai.length === 0 && bankOptions.length > 0 && (
                                        <p className="text-xs text-slate-400 italic pl-1">Belum ada tarik tunai</p>
                                    )}
                                    {tarikTunai.map((s, idx) => (
                                        <div key={idx} className="flex gap-2 items-center">
                                            <span className="text-slate-400 text-sm w-5 text-right">{idx + 1}.</span>
                                            <select
                                                className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring flex-1"
                                                value={s.bankName}
                                                onChange={(e) => updateTarikTunai(idx, 'bankName', e.target.value)}
                                            >
                                                {bankOptions.map(b => <option key={b} value={b}>{b}</option>)}
                                            </select>
                                            <div className="relative w-36">
                                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">Rp</span>
                                                <Input type="number" min="0" className="pl-7 text-right text-sm" value={s.amount || ''} onChange={(e) => updateTarikTunai(idx, 'amount', e.target.value)} placeholder="0" />
                                            </div>
                                            <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => removeTarikTunai(idx)}>
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    ))}
                                    {tarikTunai.length > 0 && (
                                        <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1">
                                            💡 Target kas tunai otomatis bertambah {formatCurrency(getTotalTarikTunai())} — target saldo rekening asal berkurang.
                                        </p>
                                    )}
                                </div>

                                {/* Tukar Transfer ke Cash */}
                                <div className="space-y-2">
                                    <p className="font-semibold text-slate-700 text-sm flex items-center gap-1.5">
                                        <Banknote className="w-4 h-4 text-violet-600" /> Tukar Transfer ke Cash
                                    </p>
                                    <p className="text-xs text-slate-500">Jumlah transfer masuk yang dikonversi menjadi uang tunai (contoh: tarik tunai dari rekening transfer).</p>
                                    <div className="flex gap-2 items-center">
                                        <span className="text-slate-400 text-xs shrink-0">Rp</span>
                                        <Input
                                            type="number" min="0"
                                            className="text-right text-sm"
                                            value={tukarTransferKeCash || ''}
                                            onChange={(e) => setTukarTransferKeCash(Number(e.target.value) || 0)}
                                            placeholder="0"
                                        />
                                    </div>
                                    {tukarTransferKeCash > 0 && (
                                        <p className="text-xs text-violet-700 bg-violet-50 border border-violet-200 rounded px-2 py-1">
                                            💡 Target kas tunai otomatis bertambah {formatCurrency(tukarTransferKeCash)} dari konversi transfer.
                                        </p>
                                    )}
                                </div>

                                {/* Pertukaran Metode Pembayaran */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <p className="font-semibold text-slate-700 text-sm flex items-center gap-1.5">
                                            <ArrowRightLeft className="w-4 h-4 text-indigo-600" /> Pertukaran Metode Pembayaran
                                        </p>
                                        <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={addPaymentExchange}>
                                            <Plus className="w-3 h-3" /> Tambah
                                        </Button>
                                    </div>
                                    <p className="text-xs text-slate-500">
                                        Catat penukaran antar metode: QRIS↔Tunai, Transfer↔Tunai, atau titip transfer karyawan.
                                    </p>
                                    {paymentExchanges.length === 0 && (
                                        <p className="text-xs text-slate-400 italic pl-1">Belum ada pertukaran</p>
                                    )}
                                    {paymentExchanges.map((ex, idx) => {
                                        const allMethods = ['CASH', 'QRIS', ...bankOptions, 'Dana', 'GoPay', 'OVO', 'ShopeePay', 'LinkAja'];
                                        const impacts: string[] = [];
                                        if (ex.amount > 0) {
                                            if (ex.to === 'CASH') impacts.push(`Tunai +${formatCurrency(ex.amount)}`);
                                            if (ex.from === 'CASH') impacts.push(`Tunai −${formatCurrency(ex.amount)}`);
                                            if (bankOptions.includes(ex.from) && ex.from !== 'CASH') impacts.push(`${ex.from} −${formatCurrency(ex.amount)}`);
                                            if (bankOptions.includes(ex.to) && ex.to !== 'CASH') impacts.push(`${ex.to} +${formatCurrency(ex.amount)}`);
                                        }
                                        return (
                                            <div key={idx} className="p-2.5 rounded-lg border border-indigo-100 bg-indigo-50/40 space-y-2">
                                                <div className="flex gap-2 items-center">
                                                    <span className="text-slate-400 text-sm w-5 text-right shrink-0">{idx + 1}.</span>
                                                    <select
                                                        className="flex-1 h-9 text-sm rounded border border-input bg-background px-2 focus:outline-none focus:ring-1 focus:ring-ring"
                                                        value={ex.from}
                                                        onChange={(e) => updatePaymentExchange(idx, 'from', e.target.value)}
                                                    >
                                                        {allMethods.map(m => <option key={m} value={m}>{m === 'CASH' ? '💵 CASH' : m === 'QRIS' ? '📱 QRIS' : `💳 ${m}`}</option>)}
                                                    </select>
                                                    <ArrowRightLeft className="w-4 h-4 text-slate-400 shrink-0" />
                                                    <select
                                                        className="flex-1 h-9 text-sm rounded border border-input bg-background px-2 focus:outline-none focus:ring-1 focus:ring-ring"
                                                        value={ex.to}
                                                        onChange={(e) => updatePaymentExchange(idx, 'to', e.target.value)}
                                                    >
                                                        {allMethods.map(m => <option key={m} value={m}>{m === 'CASH' ? '💵 CASH' : m === 'QRIS' ? '📱 QRIS' : `💳 ${m}`}</option>)}
                                                    </select>
                                                    <div className="relative w-32 shrink-0">
                                                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">Rp</span>
                                                        <Input
                                                            type="number" min="0"
                                                            className="pl-7 text-right text-sm"
                                                            value={ex.amount || ''}
                                                            onChange={(e) => updatePaymentExchange(idx, 'amount', e.target.value)}
                                                            placeholder="0"
                                                        />
                                                    </div>
                                                    <Button type="button" variant="ghost" size="icon"
                                                        className="h-9 w-9 text-red-400 hover:text-red-600 hover:bg-red-50 shrink-0"
                                                        onClick={() => removePaymentExchange(idx)}>
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                                <div className="pl-7">
                                                    <Input
                                                        placeholder="Keterangan (nama karyawan, alasan...)"
                                                        className="text-xs bg-white"
                                                        value={ex.description}
                                                        onChange={(e) => updatePaymentExchange(idx, 'description', e.target.value)}
                                                    />
                                                </div>
                                                {impacts.length > 0 && (
                                                    <p className="text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 rounded px-2 py-1 ml-7">
                                                        💡 Dampak target: {impacts.join(' • ')}
                                                    </p>
                                                )}
                                                {ex.amount > 0 && impacts.length === 0 && (
                                                    <p className="text-xs text-slate-400 italic ml-7">ℹ️ Dicatat di laporan, tidak mempengaruhi target saldo sistem.</p>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Kasbon Karyawan */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <p className="font-semibold text-slate-700 text-sm flex items-center gap-1.5">
                                            <UserCheck className="w-4 h-4 text-amber-600" /> Kasbon Karyawan
                                        </p>
                                        <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={addKasbon}>
                                            <Plus className="w-3 h-3" /> Tambah
                                        </Button>
                                    </div>
                                    {kasbon.length === 0 && (
                                        <p className="text-xs text-slate-400 italic pl-1">Belum ada kasbon</p>
                                    )}
                                    {kasbon.map((k, idx) => (
                                        <div key={idx} className="space-y-1.5 p-2.5 rounded-lg border border-slate-200 bg-slate-50">
                                            <div className="flex gap-2 items-center">
                                                <span className="text-slate-400 text-sm w-5 text-right">{idx + 1}.</span>
                                                <Input placeholder="Nama karyawan" className="flex-1 text-sm bg-white" value={k.name} onChange={(e) => updateKasbon(idx, 'name', e.target.value)} />
                                                <div className="relative w-36">
                                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">Rp</span>
                                                    <Input type="number" min="0" className="pl-7 text-right text-sm bg-white" value={k.amount || ''} onChange={(e) => updateKasbon(idx, 'amount', e.target.value)} placeholder="0" />
                                                </div>
                                                <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => removeKasbon(idx)}>
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                            <div className="flex items-center gap-2 pl-7">
                                                <span className="text-xs text-slate-500 shrink-0">Sumber:</span>
                                                <select
                                                    className="flex-1 h-7 text-xs rounded border border-slate-200 bg-white px-2 focus:outline-none focus:ring-1 focus:ring-ring"
                                                    value={k.source}
                                                    onChange={(e) => updateKasbon(idx, 'source', e.target.value)}
                                                >
                                                    <option value="Kas Toko">Kas Toko (mengurangi saldo toko)</option>
                                                    <option value="Owner">Owner / Pemilik</option>
                                                    <option value="Lainnya">Lainnya (tidak mengurangi saldo toko)</option>
                                                </select>
                                            </div>
                                            {k.source !== 'Kas Toko' && (
                                                <p className="text-xs text-blue-600 pl-7">ℹ️ Kasbon ini tidak mengurangi saldo kas toko.</p>
                                            )}
                                        </div>
                                    ))}
                                    {kasbon.length > 0 && (
                                        <div className="flex justify-between items-center pt-1 border-t text-sm font-semibold">
                                            <span className="text-slate-600">Total Kasbon</span>
                                            <span className="text-amber-600">{formatCurrency(getTotalKasbon())}</span>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* ── Kartu 4: Saldo Bank (Laporan & Real) ── */}
                        <Card className="border-t-4 border-t-purple-500 border-slate-200">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base">5. Saldo Rekening Bank</CardTitle>
                                <CardDescription>
                                    Buka mBanking dan isi kedua kolom untuk setiap rekening.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {shiftData?.systemBankBalances && Object.keys(shiftData.systemBankBalances).map(bankName => {
                                    const expectedBankAbs = getAdjustedExpectedBank(bankName);
                                    const laporan = actualBankBalances[bankName] ?? 0;
                                    const real = realBankBalances[bankName] ?? 0;
                                    const selisih = real - laporan;

                                    return (
                                        <div key={bankName} className="p-4 border rounded-xl bg-white space-y-3">
                                            <p className="font-bold text-slate-800">💳 {bankName}</p>
                                            <p className="text-xs text-slate-400">Target sistem: {formatCurrency(expectedBankAbs)}</p>

                                            <div className="grid grid-cols-2 gap-3">
                                                {/* Saldo Laporan */}
                                                <div className="space-y-1">
                                                    <Label className="text-xs text-slate-500">Saldo di Laporan mBanking</Label>
                                                    <div className="relative">
                                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">Rp</span>
                                                        <Input
                                                            type="number" min="0"
                                                            className="pl-9 text-right text-sm"
                                                            value={laporan || ''}
                                                            onChange={(e) => setActualBankBalances(prev => ({ ...prev, [bankName]: Number(e.target.value) }))}
                                                            placeholder="0"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Saldo Real */}
                                                <div className="space-y-1">
                                                    <Label className="text-xs text-slate-500">Saldo Real di Bank</Label>
                                                    <div className="relative">
                                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">Rp</span>
                                                        <Input
                                                            type="number" min="0"
                                                            className="pl-9 text-right text-sm font-bold"
                                                            value={real || ''}
                                                            onChange={(e) => setRealBankBalances(prev => ({ ...prev, [bankName]: Number(e.target.value) }))}
                                                            placeholder="0"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Selisih sistem vs aktual */}
                                            <div className="flex justify-between items-center text-xs pt-1">
                                                <span className="text-slate-500">Selisih sistem vs aktual</span>
                                                {renderBadge(diff(real, expectedBankAbs))}
                                            </div>
                                            {selisih !== 0 && (
                                                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 p-1.5 rounded">
                                                    ⚠️ Saldo laporan vs real berbeda: {formatCurrency(Math.abs(selisih))}
                                                </p>
                                            )}
                                        </div>
                                    );
                                })}

                                {/* QRIS sebagai rekening */}
                                <div className="p-4 border rounded-xl bg-white space-y-3">
                                    <p className="font-bold text-slate-800">📱 QRIS</p>
                                    <p className="text-xs text-slate-400">Target sistem: {formatCurrency(shiftData?.expectedQris || 0)}</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <Label className="text-xs text-slate-500">Saldo di Aplikasi QRIS</Label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">Rp</span>
                                                <Input
                                                    type="number" min="0"
                                                    className="pl-9 text-right text-sm"
                                                    value={actualQris || ''}
                                                    onChange={(e) => setActualQris(Number(e.target.value))}
                                                    placeholder="0"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs text-slate-500">Saldo Real QRIS</Label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">Rp</span>
                                                <Input
                                                    type="number" min="0"
                                                    className="pl-9 text-right text-sm font-bold"
                                                    value={realQrisBalance || ''}
                                                    onChange={(e) => setRealQrisBalance(Number(e.target.value))}
                                                    placeholder="0"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center text-xs pt-1">
                                        <span className="text-slate-500">Selisih sistem vs aktual</span>
                                        {renderBadge(diff(actualQris, shiftData?.expectedQris || 0))}
                                    </div>
                                    {realQrisBalance !== actualQris && realQrisBalance > 0 && (
                                        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 p-1.5 rounded">
                                            ⚠️ Saldo laporan vs real berbeda: {formatCurrency(Math.abs(realQrisBalance - actualQris))}
                                        </p>
                                    )}
                                </div>

                                {(!shiftData?.systemBankBalances || Object.keys(shiftData.systemBankBalances).length === 0) && (
                                    <p className="text-sm text-slate-400 text-center p-4 border rounded italic">
                                        Tidak ada rekening bank aktif yang terdaftar.
                                    </p>
                                )}
                            </CardContent>
                        </Card>

                        {/* ── Kartu 5: Lampiran & Catatan ── */}
                        <Card className="border-t-4 border-t-emerald-500 border-slate-200">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base">6. Lampiran & Catatan</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Upload Foto */}
                                <div className="space-y-2">
                                    <Label className="font-semibold text-slate-800">Foto Bukti (Struk, Laci, EDC)</Label>
                                    <div
                                        className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:bg-slate-50 cursor-pointer flex flex-col items-center gap-2"
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        <Camera className="w-8 h-8 text-slate-400" />
                                        <p className="text-sm text-slate-500">Klik untuk lampirkan foto</p>
                                        <Input ref={fileInputRef} type="file" className="hidden" accept="image/*" multiple onChange={(e) => e.target.files && setFiles(Array.from(e.target.files))} />
                                    </div>
                                    {files.length > 0 && (
                                        <div className="flex flex-wrap gap-2">
                                            {files.map((file, idx) => (
                                                <div key={idx} className="bg-slate-100 text-xs px-3 py-1.5 rounded-full flex items-center gap-2">
                                                    <span>{file.name}</span>
                                                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Catatan Tambahan */}
                                <div className="space-y-2">
                                    <Label className="font-semibold text-slate-800">Catatan Tambahan (Opsional)</Label>
                                    <Textarea
                                        placeholder="Misal: Ada tamu yang bayar nanti, barang titipan, dll."
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        className="resize-none min-h-[70px]"
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* ── Tombol Submit ── */}
                        <div className="flex justify-end sticky bottom-0 bg-slate-50/80 backdrop-blur-md px-4 py-4 rounded-t-2xl z-20 border-t border-slate-200">
                            <Button
                                type="submit"
                                size="lg"
                                disabled={closeShiftMutation.isPending || !adminName}
                                className="w-full sm:w-auto text-base gap-2 bg-blue-600 hover:bg-blue-700 font-bold px-10 shadow-lg shadow-blue-500/30"
                            >
                                {closeShiftMutation.isPending ? 'Mengirim...' : '📤 Kirim Laporan Shift ke WA'}
                                {!closeShiftMutation.isPending && <ChevronRight className="w-5 h-5" />}
                            </Button>
                        </div>

                    </div>
                </form>
            </main>
        </div>
    );
}
