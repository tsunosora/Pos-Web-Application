'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getShiftExpectations, closeShift, getStaffList } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
    ArrowLeft, Camera, CheckCircle2, ChevronRight,
    Calculator, AlertTriangle, Plus, Trash2, Users, Clock
} from 'lucide-react';
import Link from 'next/link';

// Tipe untuk item pengeluaran (nama + jumlah)
type ExpenseItem = { name: string; amount: number };
// Pengeluaran dikelompokkan per metode: { "CASH": [...], "BCA": [...] }
type StructuredExpenses = Record<string, ExpenseItem[]>;

export default function CloseShiftPage() {
    const router = useRouter();

    // ─── State: Data Kasir & Shift ───────────────────────────────────────
    const [adminName, setAdminName] = useState('');
    const [shiftName, setShiftName] = useState('Shift Pagi');

    // ─── State: Saldo Aktual ─────────────────────────────────────────────
    const [actualCash, setActualCash] = useState<number>(0);
    const [actualQris, setActualQris] = useState<number>(0);
    // Saldo Laporan mBanking (yang tertera di layar saat lapor)
    const [actualBankBalances, setActualBankBalances] = useState<Record<string, number>>({});
    // Saldo Real di Bank (yang benar-benar ada / transfer actua)
    const [realBankBalances, setRealBankBalances] = useState<Record<string, number>>({});

    // ─── State: Pengeluaran Terstruktur ──────────────────────────────────
    const [structuredExpenses, setStructuredExpenses] = useState<StructuredExpenses>({});

    // ─── State: Catatan & Bukti ──────────────────────────────────────────
    const [notes, setNotes] = useState('');
    const [files, setFiles] = useState<File[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ─── Data dari API ───────────────────────────────────────────────────
    const { data: shiftData, isLoading, isError } = useQuery({
        queryKey: ['shift-expectations'],
        queryFn: getShiftExpectations,
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

            // Inisialisasi pengeluaran: satu section per bank + CASH
            const initExpenses: StructuredExpenses = { CASH: [] };
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

        if (!confirm(`Apakah data sudah benar?\n\nKasir: ${adminName}\nShift: ${shiftName}\n\nSetelah dikirim, hanya Admin yang bisa melakukan koreksi.`)) return;

        const formData = new FormData();
        formData.append('adminName', adminName);
        formData.append('shiftName', shiftName);
        formData.append('openedAt', shiftData.openedAt || new Date().toISOString());
        formData.append('closedAt', new Date().toISOString());

        formData.append('expectedCash', String(shiftData.expectedCash || 0));
        formData.append('expectedQris', String(shiftData.expectedQris || 0));
        formData.append('expectedTransfer', String(shiftData.expectedTransfer || 0));

        formData.append('actualCash', String(actualCash));
        formData.append('actualQris', String(actualQris));
        formData.append('actualTransfer', '0');
        formData.append('expensesTotal', String(getTotalExpenses()));
        formData.append('notes', notes);

        formData.append('expectedBankBalances', JSON.stringify(shiftData.grossBankIncomes || {}));
        formData.append('actualBankBalances', JSON.stringify(actualBankBalances));
        formData.append('realBankBalances', JSON.stringify(realBankBalances));
        formData.append('shiftExpenses', JSON.stringify(shiftData.shiftExpenses || []));
        formData.append('structuredExpenses', JSON.stringify(structuredExpenses));

        files.forEach(file => formData.append('proofImages', file));
        closeShiftMutation.mutate(formData);
    };

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

    const expectedCash = shiftData?.expectedCash || 0;
    const expectedQris = shiftData?.expectedQris || 0;
    let grossAll = (shiftData?.grossCash || 0) + (shiftData?.grossQris || 0);
    Object.values(shiftData?.grossBankIncomes || {}).forEach((v: any) => grossAll += v);

    const SHIFT_OPTIONS = ['Shift Pagi', 'Shift Siang', 'Long Shift'];

    // Metode pengeluaran: bank-bank dulu, Cash terakhir
    const expenseMethods = [
        ...Object.keys(structuredExpenses).filter(m => m !== 'CASH'),
        'CASH'
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

                                {/* Target Saldo Sistem */}
                                <div className="space-y-1">
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Target Saldo Kasir</p>
                                    <div className="flex justify-between py-1 border-b">
                                        <span className="text-slate-600">Uang tunai di laci</span>
                                        <span className="font-semibold text-slate-800">{formatCurrency(expectedCash)}</span>
                                    </div>
                                    <div className="flex justify-between py-1 border-b">
                                        <span className="text-slate-600">EDC QRIS shift ini</span>
                                        <span className="font-semibold text-slate-800">{formatCurrency(expectedQris)}</span>
                                    </div>
                                </div>

                                {/* Saldo Sistem per Bank */}
                                <div className="space-y-1">
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Target Saldo Bank</p>
                                    {shiftData?.systemBankBalances && Object.entries(shiftData.systemBankBalances).map(([bank, sysval]: [string, any]) => (
                                        <div key={bank} className="flex justify-between items-center bg-white p-2 border rounded">
                                            <span className="text-slate-600">{bank}</span>
                                            <span className="font-bold text-slate-800">{formatCurrency(sysval)}</span>
                                        </div>
                                    ))}
                                </div>
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
                                                {method === 'CASH' ? '💵' : '💳'} Pengeluaran {method}
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

                        {/* ── Kartu 4: Saldo Bank (Laporan & Real) ── */}
                        <Card className="border-t-4 border-t-purple-500 border-slate-200">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base">4. Saldo Rekening Bank</CardTitle>
                                <CardDescription>
                                    Buka mBanking dan isi kedua kolom untuk setiap rekening.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {shiftData?.systemBankBalances && Object.keys(shiftData.systemBankBalances).map(bankName => {
                                    const expectedBankAbs = shiftData.systemBankBalances[bankName] || 0;
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
                                <CardTitle className="text-base">5. Lampiran & Catatan</CardTitle>
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
