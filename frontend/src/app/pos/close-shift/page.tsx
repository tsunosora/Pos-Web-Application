'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getShiftExpectations, closeShift } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ArrowLeft, UploadCloud, FileText, Camera, CheckCircle2, ChevronRight, Calculator, AlertTriangle, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function CloseShiftPage() {
    const router = useRouter();

    const [actualCash, setActualCash] = useState<number>(0);
    const [actualQris, setActualQris] = useState<number>(0);
    const [actualBankBalances, setActualBankBalances] = useState<Record<string, number>>({});

    const [expensesTotal, setExpensesTotal] = useState<number>(0);
    const [notes, setNotes] = useState('');
    const [shiftName, setShiftName] = useState('Shift Siang');
    const [files, setFiles] = useState<File[]>([]);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const { data: shiftData, isLoading, isError } = useQuery({
        queryKey: ['shift-expectations'],
        queryFn: getShiftExpectations,
    });

    // Initialize state when data loads
    useEffect(() => {
        if (shiftData?.systemBankBalances) {
            const initialBanks: Record<string, number> = {};
            Object.keys(shiftData.systemBankBalances).forEach(bank => {
                initialBanks[bank] = 0;
            });
            setActualBankBalances(initialBanks);
        }
    }, [shiftData]);

    const closeShiftMutation = useMutation({
        mutationFn: closeShift,
        onSuccess: () => {
            alert('Laporan Tutup Shift berhasil dikirim ke WhatsApp Group!');
            router.push('/pos');
        },
        onError: (err: any) => {
            alert('Gagal mengirim laporan shift: ' + err.message);
        }
    });

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFiles(Array.from(e.target.files));
        }
    };

    const calculateDifference = (actual: number, expected: number) => {
        return actual - expected;
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount || 0);
    };

    const renderDifferenceBadge = (diff: number) => {
        if (diff === 0) return <span className="text-green-600 bg-green-50 px-2 py-1 rounded-md text-xs font-bold border border-green-200">✅ BALANCE</span>;
        if (diff > 0) return <span className="text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md text-xs font-bold border border-emerald-200">🟢 LEBIH {formatCurrency(diff)}</span>;
        return <span className="text-red-700 bg-red-50 px-2 py-1 rounded-md text-xs font-bold border border-red-200">🔴 KURANG {formatCurrency(Math.abs(diff))}</span>;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!shiftData) return;

        if (!confirm('Apakah anda yakin nominal fisik & saldo bank sudah sesuai dan ingin mengirim Laporan Tutup Shift sekarang?')) {
            return;
        }

        const formData = new FormData();
        formData.append('adminName', 'Kasir');
        formData.append('shiftName', shiftName);
        formData.append('openedAt', shiftData.openedAt || new Date().toISOString());
        formData.append('closedAt', new Date().toISOString());

        formData.append('expectedCash', String(shiftData.expectedCash || 0));
        formData.append('expectedQris', String(shiftData.expectedQris || 0));
        formData.append('expectedTransfer', String(shiftData.expectedTransfer || 0));

        formData.append('actualCash', String(actualCash));
        formData.append('actualQris', String(actualQris));
        formData.append('actualTransfer', '0'); // we rely on detailed actualBankBalances now
        formData.append('expensesTotal', String(expensesTotal));
        formData.append('notes', notes);

        formData.append('expectedBankBalances', JSON.stringify(shiftData.grossBankIncomes || {}));
        formData.append('actualBankBalances', JSON.stringify(actualBankBalances));
        formData.append('shiftExpenses', JSON.stringify(shiftData.shiftExpenses || []));

        files.forEach(file => {
            formData.append('proofImages', file);
        });

        closeShiftMutation.mutate(formData);
    };

    if (isLoading) return <div className="p-8 text-center text-muted-foreground animate-pulse flex flex-col items-center"><Calculator className="w-12 h-12 mb-4 opacity-50" /> Memuat data kalkulasi pintar shift...</div>;
    if (isError) return <div className="p-8 text-center text-red-500 flex flex-col items-center"><AlertTriangle className="w-12 h-12 mb-4" /> Gagal memuat data shift. Pastikan server nyala.</div>;

    const expectedCash = shiftData?.expectedCash || 0;
    const expectedQris = shiftData?.expectedQris || 0; // expected QRIS is just net Qris income
    let grossAll = (shiftData?.grossCash || 0) + (shiftData?.grossQris || 0);
    Object.values(shiftData?.grossBankIncomes || {}).forEach((val: any) => grossAll += val);

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <header className="bg-white border-b sticky top-0 z-10 shadow-sm">
                <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/pos">
                            <Button variant="ghost" size="icon" className="rounded-full hover:bg-slate-100">
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">Laporan Tutup Shift (Rekonsiliasi)</h1>
                            <p className="text-xs text-slate-500 font-medium tracking-wide drop-shadow-sm">POS System &bull; WA Bot Integrated</p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-4 py-8 max-w-7xl">
                <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative items-start">

                    {/* LEFT PANEL : SYSTEM READ-ONLY */}
                    <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-24">
                        <Card className="border-indigo-100 shadow-md shadow-indigo-100/50 bg-gradient-to-b from-white to-slate-50/50">
                            <CardHeader className="pb-4 border-b border-indigo-50">
                                <CardTitle className="text-lg flex items-center gap-2 text-slate-800">
                                    <Calculator className="w-5 h-5 text-indigo-500" />
                                    Data Target Sistem
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-4 space-y-5 text-sm">
                                <div className="p-3 bg-indigo-50/50 rounded flex justify-between items-center text-indigo-900 border border-indigo-100">
                                    <span className="font-semibold">Gross Income Shift Ini</span>
                                    <span className="font-extrabold">{formatCurrency(grossAll)}</span>
                                </div>

                                <div className="space-y-2 border-b pb-4">
                                    <h4 className="font-semibold text-slate-700 text-xs tracking-wider uppercase">Nilai Netto Diharapkan (Net Income):</h4>
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-600">💵 Uang Tunai di Laci</span>
                                        <span className="font-bold text-slate-900">{formatCurrency(expectedCash)}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-600">📱 EDC QRIS Shift Ini</span>
                                        <span className="font-bold text-slate-900">{formatCurrency(expectedQris)}</span>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <h4 className="font-semibold text-slate-700 text-xs tracking-wider uppercase">Saldo Sistem Saat Ini (Absolute):</h4>
                                    {shiftData?.systemBankBalances && Object.entries(shiftData.systemBankBalances).map(([bank, sysval]: [string, any]) => (
                                        <div key={bank} className="flex justify-between items-center bg-white p-2 border rounded">
                                            <span className="font-medium text-slate-600">{bank}</span>
                                            <span className="font-bold text-slate-800">{formatCurrency(sysval)}</span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* RIGHT PANEL : USER INPUT */}
                    <div className="lg:col-span-8 space-y-6">
                        <Card className="border-slate-200">
                            <CardHeader className="pb-4">
                                <CardTitle className="text-lg">1. Data Personel</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-slate-600">Nama Kasir</Label>
                                        <Input value="Kasir" disabled className="bg-slate-50" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-slate-600">Shift Kerja</Label>
                                        <select
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                            value={shiftName}
                                            onChange={(e) => setShiftName(e.target.value)}
                                            required
                                        >
                                            <option value="Shift Pagi">Shift Pagi</option>
                                            <option value="Shift Siang">Shift Siang</option>
                                            <option value="Long Shift">Long Shift</option>
                                        </select>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-slate-200 border-t-4 border-t-blue-500">
                            <CardHeader className="pb-4">
                                <CardTitle className="text-lg">2. Kas Aktual (Shift Net Income)</CardTitle>
                                <CardDescription>Berapa banyak uang lembaran/koin yang Anda lihat di laci kasir saat ini? Dan berapa total mutasi masuk EDC QRIS untuk hari ini?</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* CASH */}
                                <div className="p-4 border rounded-xl bg-white focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                                    <div className="flex justify-between gap-4">
                                        <div className="flex-1">
                                            <Label className="text-base font-bold text-slate-800">💵 Total Uang Tunai di Laci</Label>
                                        </div>
                                        <div className="flex-1 relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">Rp</span>
                                            <Input
                                                type="number" min="0" required
                                                className="pl-9 font-bold text-right"
                                                value={actualCash || ''}
                                                onChange={(e) => setActualCash(Number(e.target.value))}
                                                placeholder="0"
                                            />
                                        </div>
                                    </div>
                                    <div className="mt-2 flex justify-end">
                                        {renderDifferenceBadge(calculateDifference(actualCash, expectedCash))}
                                    </div>
                                </div>

                                {/* QRIS */}
                                <div className="p-4 border rounded-xl bg-white focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                                    <div className="flex justify-between gap-4">
                                        <div className="flex-1">
                                            <Label className="text-base font-bold text-slate-800">📱 Total Mutasi Masuk EDC QRIS</Label>
                                        </div>
                                        <div className="flex-1 relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">Rp</span>
                                            <Input
                                                type="number" min="0" required
                                                className="pl-9 font-bold text-right"
                                                value={actualQris || ''}
                                                onChange={(e) => setActualQris(Number(e.target.value))}
                                                placeholder="0"
                                            />
                                        </div>
                                    </div>
                                    <div className="mt-2 flex justify-end">
                                        {renderDifferenceBadge(calculateDifference(actualQris, expectedQris))}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-slate-200 border-t-4 border-t-purple-500">
                            <CardHeader className="pb-4">
                                <CardTitle className="text-lg">3. Saldo Rekening Bank (Absolute)</CardTitle>
                                <CardDescription>Cek aplikasi mBanking Anda. Ketikkan saldo paling mutakhir milik tiap rekening saat ini pelaporan!</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {shiftData?.systemBankBalances && Object.keys(shiftData.systemBankBalances).map(bankName => {
                                    const expectedBankAbsolute = shiftData.systemBankBalances[bankName] || 0;
                                    const actVal = actualBankBalances[bankName] ?? 0;

                                    return (
                                        <div key={bankName} className="p-4 border rounded-xl bg-white focus-within:ring-2 focus-within:ring-purple-100 transition-all">
                                            <div className="flex justify-between gap-4">
                                                <div className="flex-1">
                                                    <Label className="text-base font-bold text-slate-800">💳 {bankName}</Label>
                                                </div>
                                                <div className="flex-1 relative">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">Rp</span>
                                                    <Input
                                                        type="number" min="0" required
                                                        className="pl-9 font-bold text-right"
                                                        value={actVal || ''}
                                                        onChange={(e) => setActualBankBalances(prev => ({ ...prev, [bankName]: Number(e.target.value) }))}
                                                        placeholder="0"
                                                    />
                                                </div>
                                            </div>
                                            <div className="mt-2 text-xs flex justify-between text-slate-500 items-center">
                                                <span>Target Sistem: {formatCurrency(expectedBankAbsolute)}</span>
                                                {renderDifferenceBadge(calculateDifference(actVal, expectedBankAbsolute))}
                                            </div>
                                        </div>
                                    );
                                })}
                                {(!shiftData?.systemBankBalances || Object.keys(shiftData.systemBankBalances).length === 0) && (
                                    <p className="text-sm text-slate-500 border p-4 bg-slate-50 rounded italic text-center">Tidak ada rekening bank aktif yang terdaftar di sistem.</p>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="border-slate-200 border-t-4 border-t-emerald-500">
                            <CardHeader className="pb-4">
                                <CardTitle className="text-lg">4. Bukti Lampiran & Catatan Khusus</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-3">
                                    <Label className="text-sm font-bold text-slate-800">Upload Foto Struk / Bukti Laci Kas / Mesin EDC</Label>
                                    <div
                                        className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:bg-slate-50 cursor-pointer flex flex-col items-center justify-center gap-2"
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        <Camera className="w-10 h-10 text-slate-400" />
                                        <p className="text-sm text-slate-600">Klik untuk melampirkan file foto ke Broadcast WA</p>
                                        <Input ref={fileInputRef} type="file" className="hidden" accept="image/*" multiple onChange={handleFileChange} />
                                    </div>
                                    {files.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mt-3">
                                            {files.map((file, idx) => (
                                                <div key={idx} className="bg-slate-100 border border-slate-200 text-xs px-3 py-1.5 rounded-full flex items-center gap-2">
                                                    <span>{file.name}</span>
                                                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-3">
                                    <Label className="text-sm font-bold text-slate-800">Catatan Khusus (Tambahan yang belum masuk sistem)</Label>
                                    <Textarea
                                        placeholder="Misal: Saya ambil Rp 5.000 dari laci kas karena beli isi ulang spidol dadakan."
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        className="resize-none min-h-[80px]"
                                    />
                                    {/* Additional hidden input for standalone expense outside of system if any */}
                                    {notes.length > 0 && <div className="flex items-center gap-4 border p-3 rounded-lg bg-orange-50/50 mt-2">
                                        <Label className="text-sm font-semibold flex-1">Isi Nominal (JIKA ADA uang kas dipakai berdasar catatan ini):</Label>
                                        <Input type="number" value={expensesTotal || ''} onChange={(e) => setExpensesTotal(Number(e.target.value))} placeholder="0" className="w-1/3 bg-white" />
                                    </div>}
                                </div>
                            </CardContent>
                        </Card>

                        <div className="flex justify-end pt-4 pb-12 sticky bottom-0 bg-slate-50/80 backdrop-blur-md px-4 py-4 rounded-t-2xl z-20 border-t border-slate-200">
                            <Button
                                type="submit"
                                size="lg"
                                disabled={closeShiftMutation.isPending}
                                className="w-full sm:w-auto text-lg gap-2 shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 bg-blue-600 hover:bg-blue-700 font-bold px-12"
                            >
                                {closeShiftMutation.isPending ? 'Mengirim...' : 'Kirim Tutup Shift WA'}
                                {!closeShiftMutation.isPending && <ChevronRight className="w-5 h-5" />}
                            </Button>
                        </div>
                    </div>
                </form>
            </main>
        </div>
    );
}
