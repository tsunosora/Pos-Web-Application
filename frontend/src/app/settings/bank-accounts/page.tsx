'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getBankAccounts, createBankAccount, updateBankAccount,
    deleteBankAccount, resetBankBalance
} from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Pencil, Trash2, RotateCcw, Check, X, Building2, AlertTriangle } from 'lucide-react';

type BankAccount = {
    id: number;
    bankName: string;
    accountNumber: string;
    accountOwner: string;
    currentBalance: number;
    isActive: boolean;
};

export default function BankAccountsPage() {
    const queryClient = useQueryClient();

    // State untuk form tambah baru
    const [showAddForm, setShowAddForm] = useState(false);
    const [newBank, setNewBank] = useState({ bankName: '', accountNumber: '', accountOwner: '' });

    // State untuk edit inline
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editData, setEditData] = useState<Partial<BankAccount>>({});

    // State untuk reset saldo
    const [resetId, setResetId] = useState<number | null>(null);
    const [newBalance, setNewBalance] = useState<number>(0);

    const { data: banks = [], isLoading } = useQuery({
        queryKey: ['bank-accounts'],
        queryFn: getBankAccounts,
    });

    const invalidate = () => queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });

    const createMutation = useMutation({
        mutationFn: createBankAccount,
        onSuccess: () => { invalidate(); setShowAddForm(false); setNewBank({ bankName: '', accountNumber: '', accountOwner: '' }); }
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: any }) => updateBankAccount(id, data),
        onSuccess: () => { invalidate(); setEditingId(null); }
    });

    const deleteMutation = useMutation({
        mutationFn: (id: number) => deleteBankAccount(id),
        onSuccess: invalidate,
    });

    const resetMutation = useMutation({
        mutationFn: ({ id, balance }: { id: number; balance: number }) => resetBankBalance(id, balance),
        onSuccess: () => { invalidate(); setResetId(null); setNewBalance(0); }
    });

    const formatRp = (val: number) =>
        new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val || 0);

    const handleDelete = (bank: BankAccount) => {
        if (confirm(`Hapus rekening "${bank.bankName} - ${bank.accountNumber}"?\n\nIni akan menghapus data rekening secara permanen.`)) {
            deleteMutation.mutate(bank.id);
        }
    };

    const startEdit = (bank: BankAccount) => {
        setEditingId(bank.id);
        setEditData({ bankName: bank.bankName, accountNumber: bank.accountNumber, accountOwner: bank.accountOwner, isActive: bank.isActive });
    };

    const startReset = (bank: BankAccount) => {
        setResetId(bank.id);
        setNewBalance(bank.currentBalance);
    };

    return (
        <div className="p-6 space-y-6 max-w-4xl">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Pengaturan Rekening Bank</h1>
                <p className="text-muted-foreground text-sm mt-1">
                    Kelola rekening bank yang digunakan untuk transaksi. Atur saldo awal sebelum memulai operasional.
                </p>
            </div>

            {/* Info box */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3 text-sm text-amber-800">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                    <p className="font-semibold">Tentang Saldo Rekening</p>
                    <p className="mt-1">
                        <strong>"Saldo Saat Ini"</strong> adalah saldo yang dipakai sistem sebagai <em>titik awal</em> untuk menghitung
                        Target Saldo Bank di laporan shift. Gunakan tombol <strong>"Reset Saldo"</strong> untuk menyesuaikan
                        saldo awal agar sesuai kondisi rekening yang sebenarnya.
                    </p>
                </div>
            </div>

            {/* List Rekening */}
            <div className="space-y-3">
                {isLoading && <p className="text-slate-400 text-sm">Memuat data rekening...</p>}

                {banks.map((bank: BankAccount) => (
                    <Card key={bank.id} className={`border ${!bank.isActive ? 'opacity-60' : ''}`}>
                        <CardContent className="p-0">
                            {/* Mode Normal */}
                            {editingId !== bank.id && resetId !== bank.id && (
                                <div className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                                    <div className="flex items-center gap-3 flex-1">
                                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                                            <Building2 className="w-5 h-5 text-blue-600" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="font-bold text-slate-800">{bank.bankName}</p>
                                                {!bank.isActive && (
                                                    <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded">Nonaktif</span>
                                                )}
                                            </div>
                                            <p className="text-sm text-slate-500">{bank.accountNumber} · {bank.accountOwner}</p>
                                        </div>
                                    </div>

                                    {/* Saldo */}
                                    <div className="text-right sm:min-w-[140px]">
                                        <p className="text-xs text-slate-400 uppercase tracking-wider">Saldo Saat Ini</p>
                                        <p className="font-bold text-xl text-slate-800">{formatRp(bank.currentBalance)}</p>
                                    </div>

                                    {/* Aksi */}
                                    <div className="flex gap-2 shrink-0">
                                        <Button
                                            variant="outline" size="sm"
                                            className="gap-1.5 text-amber-600 border-amber-200 hover:bg-amber-50"
                                            onClick={() => startReset(bank)}
                                        >
                                            <RotateCcw className="w-3.5 h-3.5" />
                                            Reset Saldo
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => startEdit(bank)}>
                                            <Pencil className="w-4 h-4 text-slate-500" />
                                        </Button>
                                        <Button
                                            variant="ghost" size="icon"
                                            className="h-9 w-9 text-red-400 hover:text-red-600 hover:bg-red-50"
                                            onClick={() => handleDelete(bank)}
                                            disabled={deleteMutation.isPending}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* Mode Reset Saldo */}
                            {resetId === bank.id && (
                                <div className="p-5 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
                                    <p className="font-semibold text-amber-800 flex items-center gap-2">
                                        <RotateCcw className="w-4 h-4" />
                                        Reset Saldo — {bank.bankName}
                                    </p>
                                    <p className="text-sm text-amber-700">
                                        Masukkan saldo aktual yang ada di rekening <strong>{bank.bankName}</strong> sekarang.
                                        Sistem akan memakai angka ini sebagai titik awal laporan shift berikutnya.
                                    </p>
                                    <div className="flex gap-3 items-end">
                                        <div className="flex-1 space-y-1">
                                            <Label className="text-sm font-medium">Saldo Aktual Rekening (Rp)</Label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">Rp</span>
                                                <Input
                                                    type="number" min="0"
                                                    className="pl-9 text-right font-bold text-lg bg-white"
                                                    value={newBalance || ''}
                                                    onChange={(e) => setNewBalance(Number(e.target.value))}
                                                    placeholder="0"
                                                    autoFocus
                                                />
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                className="bg-amber-500 hover:bg-amber-600 gap-1.5"
                                                disabled={resetMutation.isPending}
                                                onClick={() => {
                                                    if (confirm(`Set saldo ${bank.bankName} menjadi ${formatRp(newBalance)}?\n\nIni akan mengubah titik awal perhitungan laporan shift berikutnya.`)) {
                                                        resetMutation.mutate({ id: bank.id, balance: newBalance });
                                                    }
                                                }}
                                            >
                                                <Check className="w-4 h-4" />
                                                {resetMutation.isPending ? 'Menyimpan...' : 'Simpan'}
                                            </Button>
                                            <Button variant="outline" onClick={() => setResetId(null)}>
                                                <X className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Mode Edit Info Rekening */}
                            {editingId === bank.id && (
                                <div className="p-5 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
                                    <p className="font-semibold text-blue-800 flex items-center gap-2">
                                        <Pencil className="w-4 h-4" /> Edit Rekening — {bank.bankName}
                                    </p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <Label className="text-xs">Nama Bank</Label>
                                            <Input value={editData.bankName || ''} onChange={e => setEditData(p => ({ ...p, bankName: e.target.value }))} placeholder="BCA" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs">Nomor Rekening</Label>
                                            <Input value={editData.accountNumber || ''} onChange={e => setEditData(p => ({ ...p, accountNumber: e.target.value }))} placeholder="1234567890" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs">Nama Pemilik</Label>
                                            <Input value={editData.accountOwner || ''} onChange={e => setEditData(p => ({ ...p, accountOwner: e.target.value }))} placeholder="Nama Pemilik" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs">Status</Label>
                                            <select
                                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                                value={editData.isActive ? 'true' : 'false'}
                                                onChange={e => setEditData(p => ({ ...p, isActive: e.target.value === 'true' }))}
                                            >
                                                <option value="true">Aktif</option>
                                                <option value="false">Nonaktif</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 justify-end">
                                        <Button
                                            className="gap-1.5"
                                            disabled={updateMutation.isPending}
                                            onClick={() => updateMutation.mutate({ id: bank.id, data: editData })}
                                        >
                                            <Check className="w-4 h-4" />
                                            {updateMutation.isPending ? 'Menyimpan...' : 'Simpan Perubahan'}
                                        </Button>
                                        <Button variant="outline" onClick={() => setEditingId(null)}>
                                            <X className="w-4 h-4" /> Batal
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ))}

                {banks.length === 0 && !isLoading && (
                    <div className="text-center py-12 text-slate-400 border-2 border-dashed rounded-xl">
                        <Building2 className="w-12 h-12 mx-auto opacity-30 mb-3" />
                        <p>Belum ada rekening bank. Tambahkan rekening pertama di bawah.</p>
                    </div>
                )}
            </div>

            {/* Form Tambah Rekening Baru */}
            {showAddForm ? (
                <Card className="border-dashed border-2 border-blue-300 bg-blue-50/50">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Tambah Rekening Baru</CardTitle>
                        <CardDescription>Isi data rekening bank yang ingin ditambahkan.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label>Nama Bank *</Label>
                                <Input value={newBank.bankName} onChange={e => setNewBank(p => ({ ...p, bankName: e.target.value }))} placeholder="Contoh: BCA, Mandiri, BNI" />
                            </div>
                            <div className="space-y-1">
                                <Label>Nomor Rekening *</Label>
                                <Input value={newBank.accountNumber} onChange={e => setNewBank(p => ({ ...p, accountNumber: e.target.value }))} placeholder="1234567890" />
                            </div>
                            <div className="col-span-2 space-y-1">
                                <Label>Nama Pemilik Rekening *</Label>
                                <Input value={newBank.accountOwner} onChange={e => setNewBank(p => ({ ...p, accountOwner: e.target.value }))} placeholder="Nama di rekening" />
                            </div>
                        </div>
                        <p className="text-xs text-slate-500">💡 Setelah ditambahkan, gunakan tombol <strong>Reset Saldo</strong> untuk mengisi saldo awal rekening.</p>
                        <div className="flex gap-2 justify-end pt-1">
                            <Button
                                disabled={!newBank.bankName || !newBank.accountNumber || !newBank.accountOwner || createMutation.isPending}
                                onClick={() => createMutation.mutate(newBank)}
                                className="gap-1.5"
                            >
                                <Check className="w-4 h-4" />
                                {createMutation.isPending ? 'Menyimpan...' : 'Tambahkan'}
                            </Button>
                            <Button variant="outline" onClick={() => setShowAddForm(false)}>
                                <X className="w-4 h-4" /> Batal
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <Button variant="outline" className="w-full gap-2 border-dashed h-12" onClick={() => setShowAddForm(true)}>
                    <Plus className="w-4 h-4" />
                    Tambah Rekening Bank Baru
                </Button>
            )}
        </div>
    );
}
