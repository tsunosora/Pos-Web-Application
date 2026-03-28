"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Plus, ArrowDownRight, ArrowUpRight, ArrowRightLeft, Loader2,
    Pencil, Trash2, TrendingUp, BarChart3, Download, Filter, X, Store
} from "lucide-react";
import {
    getCashflows, createCashflow, updateCashflow, deleteCashflow,
    getCashflowMonthlyTrend, getCashflowCategoryBreakdown, getCashflowPlatformBreakdown
} from "@/lib/api";
import dayjs from "dayjs";
import {
    AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Legend
} from "recharts";

// --- Types ---
type CashflowEntry = {
    id: number;
    type: 'INCOME' | 'EXPENSE';
    category: string;
    platformSource?: string | null;
    amount: string;
    note?: string;
    date: string;
    userId?: number | null;
    user?: { email: string; name?: string } | null;
};

type PeriodKey = 'this_month' | 'last_3_months' | 'this_year' | 'all';

const PERIODS: { key: PeriodKey; label: string }[] = [
    { key: 'this_month', label: 'Bulan Ini' },
    { key: 'last_3_months', label: '3 Bulan' },
    { key: 'this_year', label: 'Tahun Ini' },
    { key: 'all', label: 'Semua' },
];

const INCOME_CATEGORIES = ['Penjualan Lunas', 'Pembayaran DP', 'Pelunasan DP', 'Modal Usaha', 'Investasi', 'Pinjaman', 'Lainnya'];
const EXPENSE_CATEGORIES = ['Operasional', 'Bahan Baku', 'Gaji Karyawan', 'Sewa', 'Listrik & Air', 'Transportasi', 'Marketing', 'Pemeliharaan', 'Pajak', 'Lainnya'];
const PLATFORM_OPTIONS = ['POS (Offline)', 'Tokopedia', 'Shopee', 'Lincah', 'TikTok Shop', 'Lainnya'];

function getPeriodDates(period: PeriodKey): { startDate?: string; endDate?: string } {
    const now = dayjs();
    if (period === 'this_month') return { startDate: now.startOf('month').format('YYYY-MM-DD'), endDate: now.endOf('month').format('YYYY-MM-DD') };
    if (period === 'last_3_months') return { startDate: now.subtract(2, 'month').startOf('month').format('YYYY-MM-DD'), endDate: now.endOf('month').format('YYYY-MM-DD') };
    if (period === 'this_year') return { startDate: now.startOf('year').format('YYYY-MM-DD'), endDate: now.endOf('year').format('YYYY-MM-DD') };
    return {};
}

const fmt = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;
const fmtShort = (n: number) => {
    if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)}jt`;
    if (n >= 1_000) return `Rp ${(n / 1_000).toFixed(0)}k`;
    return `Rp ${n}`;
};

// --- Edit Modal ---
function EditModal({ entry, onClose, onSave, isPending }: { entry: CashflowEntry; onClose: () => void; onSave: (id: number, data: any) => void; isPending?: boolean }) {
    const [category, setCategory] = useState(entry.category);
    const [amount, setAmount] = useState(parseFloat(entry.amount).toString());
    const [note, setNote] = useState(entry.note ?? '');
    const [platformSource, setPlatformSource] = useState(entry.platformSource ?? 'POS (Offline)');
    const [customPlatform, setCustomPlatform] = useState('');
    const categories = entry.type === 'INCOME' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const finalPlatform = entry.type === 'INCOME'
            ? (platformSource === 'Lainnya' ? (customPlatform || 'Lainnya') : platformSource)
            : null;
        onSave(entry.id, { category, amount: parseFloat(amount), note, platformSource: finalPlatform });
    };

    return (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-card w-full max-w-md rounded-xl border border-border shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-border flex justify-between items-center">
                    <h3 className="font-semibold text-foreground">Edit Entry Cashflow</h3>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">Kategori</label>
                        <select value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                            {categories.map(c => <option key={c} value={c}>{c}</option>)}
                            {!categories.includes(category) && <option value={category}>{category}</option>}
                        </select>
                    </div>
                    {entry.type === 'INCOME' && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">Platform Sumber</label>
                            <select value={platformSource} onChange={e => setPlatformSource(e.target.value)} className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                                {PLATFORM_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                            {platformSource === 'Lainnya' && (
                                <input
                                    type="text"
                                    value={customPlatform}
                                    onChange={e => setCustomPlatform(e.target.value)}
                                    placeholder="Nama platform..."
                                    className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                />
                            )}
                        </div>
                    )}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">Nominal (Rp)</label>
                        <input required type="number" min="0" value={amount} onChange={e => setAmount(e.target.value)} className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">Catatan</label>
                        <textarea rows={3} value={note} onChange={e => setNote(e.target.value)} className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
                    </div>
                    <div className="pt-4 flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground border border-input hover:bg-muted/50 transition-colors">Batal</button>
                        <button type="submit" disabled={isPending} className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">{isPending ? 'Menyimpan...' : 'Simpan'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function CashflowPage() {
    const queryClient = useQueryClient();

    // Period filter
    const [period, setPeriod] = useState<PeriodKey>('this_month');
    const { startDate, endDate } = getPeriodDates(period);

    // Add entry dialog
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [type, setType] = useState<'INCOME' | 'EXPENSE'>('INCOME');
    const [category, setCategory] = useState('');
    const [customCategory, setCustomCategory] = useState('');
    const [amount, setAmount] = useState('');
    const [note, setNote] = useState('');
    const [platformSource, setPlatformSource] = useState('POS (Offline)');
    const [customPlatform, setCustomPlatform] = useState('');

    // Edit + delete
    const [editEntry, setEditEntry] = useState<CashflowEntry | null>(null);
    const [deleteId, setDeleteId] = useState<number | null>(null);

    // Filter
    const [filterType, setFilterType] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');

    const { data, isLoading } = useQuery({
        queryKey: ['cashflows', startDate, endDate],
        queryFn: () => getCashflows(startDate, endDate),
    });

    const { data: trendData } = useQuery({
        queryKey: ['cashflow-trend'],
        queryFn: getCashflowMonthlyTrend,
    });

    const { data: categoryData } = useQuery({
        queryKey: ['cashflow-categories', startDate, endDate],
        queryFn: () => getCashflowCategoryBreakdown(startDate, endDate),
    });

    const { data: platformData } = useQuery({
        queryKey: ['cashflow-platforms', startDate, endDate],
        queryFn: () => getCashflowPlatformBreakdown(startDate, endDate),
    });

    const invalidateAll = () => {
        queryClient.invalidateQueries({ queryKey: ['cashflows'] });
        queryClient.invalidateQueries({ queryKey: ['cashflow-categories'] });
        queryClient.invalidateQueries({ queryKey: ['cashflow-trend'] });
        queryClient.invalidateQueries({ queryKey: ['cashflow-platforms'] });
    };

    const createMutation = useMutation({
        mutationFn: createCashflow,
        onSuccess: () => {
            invalidateAll();
            setIsDialogOpen(false);
            setCategory('');
            setCustomCategory('');
            setAmount('');
            setNote('');
            setPlatformSource('POS (Offline)');
            setCustomPlatform('');
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: any }) => updateCashflow(id, data),
        onSuccess: () => {
            invalidateAll();
            setEditEntry(null);
        },
    });

    const deleteMutation = useMutation({
        mutationFn: deleteCashflow,
        onSuccess: () => {
            invalidateAll();
            setDeleteId(null);
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const finalCategory = category === 'Lainnya' ? customCategory : category;
        if (!finalCategory || !amount) return;
        const finalPlatform = type === 'INCOME'
            ? (platformSource === 'Lainnya' ? (customPlatform || 'Lainnya') : platformSource)
            : null;
        createMutation.mutate({ type, category: finalCategory, amount: parseFloat(amount), note, platformSource: finalPlatform });
    };

    const entries: CashflowEntry[] = data?.list ?? [];
    const summary = data?.summary ?? { totalIncome: 0, totalExpense: 0, balance: 0 };

    const filteredEntries = useMemo(() => {
        if (filterType === 'ALL') return entries;
        return entries.filter(e => e.type === filterType);
    }, [entries, filterType]);

    const categoryOptions = type === 'INCOME' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

    const handleExport = async () => {
        const XLSX = await import('xlsx');
        const { saveAs } = await import('file-saver');
        const rows = entries.map(e => ({
            'Tanggal': dayjs(e.date).format('DD/MM/YYYY HH:mm'),
            'Tipe': e.type === 'INCOME' ? 'Pemasukan' : 'Pengeluaran',
            'Kategori': e.category,
            'Platform': e.platformSource ?? '-',
            'Nominal': parseFloat(e.amount),
            'Catatan': e.note ?? '',
            'Sumber': e.userId ? 'Manual' : 'Otomatis (Transaksi)',
            'Oleh': e.user?.email ?? 'System',
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Cashflow');
        const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        saveAs(new Blob([buf], { type: 'application/octet-stream' }), `cashflow-${dayjs().format('YYYY-MM-DD')}.xlsx`);
    };

    const expenseCategories = categoryData?.expense ?? [];
    const incomeCategories = categoryData?.income ?? [];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="sm:flex sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Cashflow Bisnis</h1>
                    <p className="mt-1 text-sm text-muted-foreground">Pantau arus kas masuk dan keluar bisnis Anda.</p>
                </div>
                <div className="mt-4 sm:mt-0 flex gap-3">
                    <button onClick={handleExport} className="flex items-center gap-2 border border-input bg-card text-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-muted/50 transition-colors shadow-sm">
                        <Download className="h-4 w-4" />
                        Export Excel
                    </button>
                    <button onClick={() => setIsDialogOpen(true)} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm">
                        <Plus className="h-4 w-4" />
                        Tambah Entry
                    </button>
                </div>
            </div>

            {/* Period filter */}
            <div className="flex items-center gap-2 flex-wrap">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Periode:</span>
                {PERIODS.map(p => (
                    <button key={p.key} onClick={() => setPeriod(p.key)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${period === p.key ? 'bg-primary text-primary-foreground' : 'bg-muted/40 text-muted-foreground hover:bg-muted/70'}`}>
                        {p.label}
                    </button>
                ))}
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass p-5 rounded-xl border border-border">
                    <div className="flex items-center gap-3 text-emerald-500 mb-2">
                        <div className="p-2 bg-emerald-500/10 rounded-lg"><ArrowUpRight className="h-5 w-5" /></div>
                        <span className="font-medium text-sm">Total Pemasukan</span>
                    </div>
                    <h2 className="text-2xl font-bold text-foreground">{fmt(summary.totalIncome)}</h2>
                    <p className="text-xs text-muted-foreground mt-1">{PERIODS.find(p2 => p2.key === period)?.label}</p>
                </div>
                <div className="glass p-5 rounded-xl border border-border">
                    <div className="flex items-center gap-3 text-destructive mb-2">
                        <div className="p-2 bg-destructive/10 rounded-lg"><ArrowDownRight className="h-5 w-5" /></div>
                        <span className="font-medium text-sm">Total Pengeluaran</span>
                    </div>
                    <h2 className="text-2xl font-bold text-foreground">{fmt(summary.totalExpense)}</h2>
                    <p className="text-xs text-muted-foreground mt-1">{PERIODS.find(p2 => p2.key === period)?.label}</p>
                </div>
                <div className={`glass p-5 rounded-xl border ${summary.balance >= 0 ? 'border-emerald-500/30' : 'border-destructive/30'}`}>
                    <div className={`flex items-center gap-3 mb-2 ${summary.balance >= 0 ? 'text-chart-2' : 'text-destructive'}`}>
                        <div className={`p-2 rounded-lg ${summary.balance >= 0 ? 'bg-chart-2/10' : 'bg-destructive/10'}`}><ArrowRightLeft className="h-5 w-5" /></div>
                        <span className="font-medium text-sm">Saldo Bersih</span>
                    </div>
                    <h2 className={`text-2xl font-bold ${summary.balance >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
                        {summary.balance < 0 ? '-' : ''}{fmt(Math.abs(summary.balance))}
                    </h2>
                    <p className="text-xs text-muted-foreground mt-1">{summary.balance >= 0 ? 'Positif — arus kas sehat' : 'Negatif — pengeluaran melebihi pemasukan'}</p>
                </div>
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Monthly trend */}
                <div className="bg-card rounded-xl border border-border shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        <h3 className="font-semibold text-foreground">Tren 6 Bulan</h3>
                    </div>
                    {trendData ? (
                        <ResponsiveContainer width="100%" height={220}>
                            <AreaChart data={trendData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="cfIncome" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="cfExpense" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                <XAxis dataKey="month" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: any) => fmtShort(v)} className="text-muted-foreground" width={70} />
                                <Tooltip formatter={(v: any) => fmt(v)} />
                                <Legend />
                                <Area type="monotone" dataKey="income" name="Pemasukan" stroke="#10b981" fill="url(#cfIncome)" strokeWidth={2} />
                                <Area type="monotone" dataKey="expense" name="Pengeluaran" stroke="#ef4444" fill="url(#cfExpense)" strokeWidth={2} />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-[220px] flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                    )}
                </div>

                {/* Category breakdown */}
                <div className="bg-card rounded-xl border border-border shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <BarChart3 className="h-4 w-4 text-primary" />
                        <h3 className="font-semibold text-foreground">Pengeluaran per Kategori</h3>
                    </div>
                    {expenseCategories.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={expenseCategories.slice(0, 7)} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: any) => fmtShort(v)} className="text-muted-foreground" />
                                <YAxis type="category" dataKey="category" tick={{ fontSize: 11 }} width={110} className="text-muted-foreground" />
                                <Tooltip formatter={(v: any) => fmt(v)} />
                                <Bar dataKey="total" name="Pengeluaran" fill="#ef4444" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">Belum ada data pengeluaran.</div>
                    )}
                </div>
            </div>

            {/* Income category + platform breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Income category breakdown */}
                {incomeCategories.length > 0 && (
                    <div className="bg-card rounded-xl border border-border shadow-sm p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <BarChart3 className="h-4 w-4 text-emerald-500" />
                            <h3 className="font-semibold text-foreground">Pemasukan per Kategori</h3>
                        </div>
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={incomeCategories.slice(0, 7)} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: any) => fmtShort(v)} className="text-muted-foreground" />
                                <YAxis type="category" dataKey="category" tick={{ fontSize: 11 }} width={130} className="text-muted-foreground" />
                                <Tooltip formatter={(v: any) => fmt(v)} />
                                <Bar dataKey="total" name="Pemasukan" fill="#10b981" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {/* Platform breakdown */}
                {platformData && platformData.length > 0 && (
                    <div className="bg-card rounded-xl border border-border shadow-sm p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Store className="h-4 w-4 text-primary" />
                            <h3 className="font-semibold text-foreground">Pemasukan per Platform</h3>
                        </div>
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={platformData.slice(0, 7)} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: any) => fmtShort(v)} className="text-muted-foreground" />
                                <YAxis type="category" dataKey="platform" tick={{ fontSize: 11 }} width={110} className="text-muted-foreground" />
                                <Tooltip formatter={(v: any) => fmt(v)} />
                                <Bar dataKey="total" name="Pemasukan" fill="#6366f1" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>

            {/* History list */}
            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-border flex justify-between items-center flex-wrap gap-3">
                    <h3 className="font-semibold text-foreground">Histori Cashflow</h3>
                    <div className="flex gap-2">
                        {(['ALL', 'INCOME', 'EXPENSE'] as const).map(f => (
                            <button key={f} onClick={() => setFilterType(f)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterType === f ? 'bg-primary text-primary-foreground' : 'bg-muted/40 text-muted-foreground hover:bg-muted/70'}`}>
                                {f === 'ALL' ? 'Semua' : f === 'INCOME' ? 'Pemasukan' : 'Pengeluaran'}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="divide-y divide-border">
                    {isLoading ? (
                        <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                    ) : filteredEntries.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground">Belum ada catatan cashflow untuk periode ini.</div>
                    ) : (
                        filteredEntries.map((entry) => (
                            <div key={entry.id} className="p-4 sm:p-6 flex items-center justify-between hover:bg-muted/30 transition-colors gap-4">
                                <div className="flex items-center gap-4 min-w-0">
                                    <div className={`p-3 rounded-full shrink-0 ${entry.type === 'INCOME' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-destructive/10 text-destructive'}`}>
                                        {entry.type === 'INCOME' ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h4 className="font-medium text-foreground">{entry.category}</h4>
                                            {!entry.userId && (
                                                <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">Otomatis</span>
                                            )}
                                            {entry.type === 'INCOME' && entry.platformSource && (
                                                <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{entry.platformSource}</span>
                                            )}
                                        </div>
                                        <p className="text-sm text-muted-foreground truncate">{dayjs(entry.date).format('DD MMM YYYY HH:mm')} &bull; {entry.note || '-'}</p>
                                        <p className="text-xs text-muted-foreground">Oleh: {entry.user?.email ?? 'System'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                    <div className="text-right">
                                        <p className={`font-bold ${entry.type === 'INCOME' ? 'text-emerald-500' : 'text-destructive'}`}>
                                            {entry.type === 'INCOME' ? '+' : '-'} {fmt(parseFloat(entry.amount))}
                                        </p>
                                    </div>
                                    {/* Only allow edit/delete for manual entries */}
                                    {entry.userId && (
                                        <div className="flex gap-1">
                                            <button onClick={() => setEditEntry(entry)} className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                                                <Pencil className="h-4 w-4" />
                                            </button>
                                            <button onClick={() => setDeleteId(entry.id)} className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Add entry dialog */}
            {isDialogOpen && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-card w-full max-w-md rounded-xl border border-border shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-border flex justify-between items-center">
                            <h3 className="font-semibold text-foreground">Tambah Entry Cashflow</h3>
                            <button onClick={() => setIsDialogOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground">Tipe</label>
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => { setType('INCOME'); setCategory(''); }}
                                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors border ${type === 'INCOME' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' : 'border-input text-muted-foreground hover:bg-muted/50'}`}>
                                        Pemasukan
                                    </button>
                                    <button type="button" onClick={() => { setType('EXPENSE'); setCategory(''); }}
                                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors border ${type === 'EXPENSE' ? 'bg-destructive/10 text-destructive border-destructive/30' : 'border-input text-muted-foreground hover:bg-muted/50'}`}>
                                        Pengeluaran
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground">Kategori</label>
                                <select required value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                                    <option value="">-- Pilih Kategori --</option>
                                    {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                {category === 'Lainnya' && (
                                    <input required type="text" value={customCategory} onChange={e => setCustomCategory(e.target.value)} placeholder="Nama kategori..." className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                                )}
                            </div>
                            {type === 'INCOME' && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-foreground">Platform Sumber</label>
                                    <select value={platformSource} onChange={e => setPlatformSource(e.target.value)} className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                                        {PLATFORM_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                    {platformSource === 'Lainnya' && (
                                        <input
                                            type="text"
                                            value={customPlatform}
                                            onChange={e => setCustomPlatform(e.target.value)}
                                            placeholder="Nama platform (misal: Lazada, Grab Food...)"
                                            className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                        />
                                    )}
                                </div>
                            )}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground">Nominal (Rp)</label>
                                <input required type="number" min="0" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground">Catatan / Keterangan</label>
                                <textarea rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder="Opsional" className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
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

            {/* Edit dialog */}
            {editEntry && (
                <EditModal
                    entry={editEntry}
                    onClose={() => setEditEntry(null)}
                    onSave={(id, data) => updateMutation.mutate({ id, data })}
                    isPending={updateMutation.isPending}
                />
            )}

            {/* Delete confirm */}
            {deleteId !== null && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-card w-full max-w-sm rounded-xl border border-border shadow-lg p-6 animate-in fade-in zoom-in-95 duration-200">
                        <h3 className="font-semibold text-foreground mb-2">Hapus Entry?</h3>
                        <p className="text-sm text-muted-foreground mb-6">Tindakan ini tidak dapat dibatalkan.</p>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setDeleteId(null)} className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground border border-input hover:bg-muted/50 transition-colors">Batal</button>
                            <button onClick={() => deleteMutation.mutate(deleteId)} disabled={deleteMutation.isPending} className="px-4 py-2 rounded-lg text-sm font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50">
                                {deleteMutation.isPending ? 'Menghapus...' : 'Hapus'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
