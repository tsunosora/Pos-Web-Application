"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, ArrowDownRight, ArrowUpRight, ArrowRightLeft, Loader2 } from "lucide-react";
import { getCashflows, createCashflow } from "@/lib/api";
import dayjs from "dayjs";

export default function CashflowPage() {
    const queryClient = useQueryClient();
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    // Form state
    const [type, setType] = useState<"INCOME" | "EXPENSE">("INCOME");
    const [category, setCategory] = useState("");
    const [amount, setAmount] = useState("");
    const [note, setNote] = useState("");

    const { data, isLoading } = useQuery({
        queryKey: ['cashflows'],
        queryFn: getCashflows
    });

    const createMutation = useMutation({
        mutationFn: createCashflow,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['cashflows'] });
            setIsDialogOpen(false);
            setCategory("");
            setAmount("");
            setNote("");
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!category || !amount) return;

        createMutation.mutate({
            type,
            category,
            amount: parseFloat(amount),
            note
        });
    };

    const entries = data?.list || [];
    const summary = data?.summary || { totalIncome: 0, totalExpense: 0, balance: 0 };

    return (
        <div className="space-y-6">
            <div className="sm:flex sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Cashflow Bisnis</h1>
                    <p className="mt-1 text-sm text-muted-foreground">Catat pemasukan dan pengeluaran manual di luar transaksi POS.</p>
                </div>
                <div className="mt-4 sm:mt-0 flex gap-3">
                    <button
                        onClick={() => setIsDialogOpen(true)}
                        className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm"
                    >
                        <Plus className="h-4 w-4" />
                        Tambah Entry
                    </button>
                </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass p-5 rounded-xl border border-border">
                    <div className="flex items-center gap-3 text-chart-3 mb-2">
                        <div className="p-2 bg-chart-3/10 rounded-lg"><ArrowUpRight className="h-5 w-5" /></div>
                        <span className="font-medium text-sm">Total Pemasukan</span>
                    </div>
                    <h2 className="text-2xl font-bold text-foreground">Rp {summary.totalIncome.toLocaleString('id-ID')}</h2>
                </div>
                <div className="glass p-5 rounded-xl border border-border">
                    <div className="flex items-center gap-3 text-destructive mb-2">
                        <div className="p-2 bg-destructive/10 rounded-lg"><ArrowDownRight className="h-5 w-5" /></div>
                        <span className="font-medium text-sm">Total Pengeluaran</span>
                    </div>
                    <h2 className="text-2xl font-bold text-foreground">Rp {summary.totalExpense.toLocaleString('id-ID')}</h2>
                </div>
                <div className="glass p-5 rounded-xl border border-border">
                    <div className="flex items-center gap-3 text-chart-2 mb-2">
                        <div className="p-2 bg-chart-2/10 rounded-lg"><ArrowRightLeft className="h-5 w-5" /></div>
                        <span className="font-medium text-sm">Saldo Bersih</span>
                    </div>
                    <h2 className="text-2xl font-bold text-foreground">Rp {summary.balance.toLocaleString('id-ID')}</h2>
                </div>
            </div>

            {/* List */}
            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-border flex justify-between items-center">
                    <h3 className="font-semibold text-foreground">Histori Cashflow</h3>
                </div>
                <div className="divide-y divide-border">
                    {isLoading ? (
                        <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                    ) : entries.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground">Belum ada catatan cashflow.</div>
                    ) : (
                        entries.map((entry: any) => (
                            <div key={entry.id} className="p-6 flex items-center justify-between hover:bg-muted/30 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className={`p-3 rounded-full ${entry.type === 'INCOME' ? 'bg-chart-3/10 text-chart-3' : 'bg-destructive/10 text-destructive'}`}>
                                        {entry.type === 'INCOME' ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
                                    </div>
                                    <div>
                                        <h4 className="font-medium text-foreground">{entry.category}</h4>
                                        <p className="text-sm text-muted-foreground">{dayjs(entry.date).format('DD MMM YYYY HH:mm')} &bull; {entry.note || '-'}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className={`font-bold ${entry.type === 'INCOME' ? 'text-chart-3' : 'text-foreground'}`}>
                                        {entry.type === 'INCOME' ? '+' : '-'} Rp {parseFloat(entry.amount).toLocaleString('id-ID')}
                                    </p>
                                    <p className="text-xs text-muted-foreground">Oleh: {entry.user?.email || 'System'}</p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Dialog */}
            {isDialogOpen && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-card w-full max-w-md rounded-xl border border-border shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-border flex justify-between items-center">
                            <h3 className="font-semibold text-foreground">Tambah Entry Cashflow</h3>
                            <button onClick={() => setIsDialogOpen(false)} className="text-muted-foreground hover:text-foreground">&times;</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground">Tipe</label>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                                        <input type="radio" checked={type === 'INCOME'} onChange={() => setType('INCOME')} className="text-primary focus:ring-primary" />
                                        Pemasukan
                                    </label>
                                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                                        <input type="radio" checked={type === 'EXPENSE'} onChange={() => setType('EXPENSE')} className="text-primary focus:ring-primary" />
                                        Pengeluaran
                                    </label>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground">Kategori</label>
                                <input required type="text" value={category} onChange={e => setCategory(e.target.value)} placeholder="Contoh: Operasional, Modal, dll..." className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground">Nominal (Rp)</label>
                                <input required type="number" min="0" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground">Catatan / Keterangan</label>
                                <textarea rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder="Opsional" className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"></textarea>
                            </div>
                            <div className="pt-4 flex justify-end gap-3">
                                <button type="button" onClick={() => setIsDialogOpen(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground border border-input hover:bg-muted/50 transition-colors">Batal</button>
                                <button type="submit" disabled={createMutation.isPending} className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
                                    {createMutation.isPending ? 'Menyimpan...' : 'Simpan Entry'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
